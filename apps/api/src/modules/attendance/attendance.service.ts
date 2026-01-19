import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { RecordAttendanceDto, UpdateAttendanceDto } from './dto/record-attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async recordBulk(dto: RecordAttendanceDto) {
    const date = new Date(dto.date);

    const operations = dto.records.map((record) =>
      this.prisma.attendanceRecord.upsert({
        where: {
          teacherAssignmentId_studentEnrollmentId_date: {
            teacherAssignmentId: dto.teacherAssignmentId,
            studentEnrollmentId: record.studentEnrollmentId,
            date,
          },
        },
        update: {
          status: record.status,
          observations: record.observations,
        },
        create: {
          teacherAssignmentId: dto.teacherAssignmentId,
          studentEnrollmentId: record.studentEnrollmentId,
          date,
          status: record.status,
          observations: record.observations,
        },
      }),
    );

    return this.prisma.$transaction(operations);
  }

  async update(id: string, dto: UpdateAttendanceDto) {
    return this.prisma.attendanceRecord.update({
      where: { id },
      data: {
        status: dto.status,
        observations: dto.observations,
      },
    });
  }

  async getByAssignmentAndDate(teacherAssignmentId: string, date: string) {
    return this.prisma.attendanceRecord.findMany({
      where: {
        teacherAssignmentId,
        date: new Date(date),
      },
      include: {
        studentEnrollment: {
          include: {
            student: true,
          },
        },
      },
      orderBy: {
        studentEnrollment: {
          student: {
            lastName: 'asc',
          },
        },
      },
    });
  }

  async getByStudent(studentEnrollmentId: string, startDate?: string, endDate?: string) {
    return this.prisma.attendanceRecord.findMany({
      where: {
        studentEnrollmentId,
        ...(startDate && endDate
          ? {
              date: {
                gte: new Date(startDate),
                lte: new Date(endDate),
              },
            }
          : {}),
      },
      include: {
        teacherAssignment: {
          include: {
            subject: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  async getStudentSummary(studentEnrollmentId: string, academicTermId?: string) {
    const whereClause: any = { studentEnrollmentId };

    if (academicTermId) {
      const term = await this.prisma.academicTerm.findUnique({
        where: { id: academicTermId },
      });
      if (term?.startDate && term?.endDate) {
        whereClause.date = {
          gte: term.startDate,
          lte: term.endDate,
        };
      }
    }

    const records = await this.prisma.attendanceRecord.findMany({
      where: whereClause,
    });

    const summary = {
      total: records.length,
      present: records.filter((r) => r.status === 'PRESENT').length,
      absent: records.filter((r) => r.status === 'ABSENT').length,
      late: records.filter((r) => r.status === 'LATE').length,
      excused: records.filter((r) => r.status === 'EXCUSED').length,
      attendanceRate: 0,
    };

    if (summary.total > 0) {
      summary.attendanceRate = Math.round(
        ((summary.present + summary.late + summary.excused) / summary.total) * 100,
      );
    }

    return summary;
  }

  async getGroupAttendanceReport(teacherAssignmentId: string, startDate: string, endDate: string) {
    const assignment = await this.prisma.teacherAssignment.findUnique({
      where: { id: teacherAssignmentId },
      include: {
        group: true,
        subject: true,
      },
    });

    if (!assignment) {
      throw new Error('Teacher assignment not found');
    }

    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        groupId: assignment.groupId,
        academicYearId: assignment.academicYearId,
        status: 'ACTIVE',
      },
      include: {
        student: true,
        attendanceRecords: {
          where: {
            teacherAssignmentId,
            date: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          },
        },
      },
      orderBy: {
        student: {
          lastName: 'asc',
        },
      },
    });

    return enrollments.map((enrollment) => {
      const records = enrollment.attendanceRecords;
      const total = records.length;
      const present = records.filter((r) => r.status === 'PRESENT').length;
      const absent = records.filter((r) => r.status === 'ABSENT').length;
      const late = records.filter((r) => r.status === 'LATE').length;
      const excused = records.filter((r) => r.status === 'EXCUSED').length;

      return {
        student: {
          id: enrollment.student.id,
          firstName: enrollment.student.firstName,
          lastName: enrollment.student.lastName,
          documentNumber: enrollment.student.documentNumber,
        },
        enrollmentId: enrollment.id,
        summary: {
          total,
          present,
          absent,
          late,
          excused,
          attendanceRate: total > 0 ? Math.round(((present + late + excused) / total) * 100) : 0,
        },
      };
    });
  }

  async getAttendanceReportByGroup(groupId: string, academicYearId: string, startDate?: string, endDate?: string, subjectId?: string) {
    // Construir filtro de fechas
    let dateFilter: any = {};
    if (startDate && endDate) {
      dateFilter = {
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      };
    }

    // Construir filtro de asignatura (a través de teacherAssignment)
    let assignmentFilter: any = {};
    if (subjectId) {
      assignmentFilter = {
        teacherAssignment: {
          subjectId: subjectId,
        },
      };
    }

    // Buscar enrollments
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        groupId,
        academicYearId,
      },
      include: {
        student: true,
        group: {
          include: {
            grade: true,
          },
        },
        attendanceRecords: {
          where: {
            ...dateFilter,
            ...assignmentFilter,
          },
          include: {
            teacherAssignment: {
              include: {
                subject: true,
                teacher: true,
              },
            },
          },
        },
      },
      orderBy: {
        student: {
          lastName: 'asc',
        },
      },
    });

    // Solo incluir estudiantes que tienen registros de asistencia
    const enrollmentsWithRecords = enrollments.filter((e) => e.attendanceRecords.length > 0);

    // Calcular días hábiles (registros únicos por fecha)
    const allDates = new Set<string>();
    enrollmentsWithRecords.forEach((e) => {
      e.attendanceRecords.forEach((r) => {
        allDates.add(r.date.toISOString().split('T')[0]);
      });
    });
    const totalDays = allDates.size;

    return enrollmentsWithRecords.map((enrollment, index) => {
      const records = enrollment.attendanceRecords;
      const totalClasses = records.length; // Total de clases/sesiones registradas
      const present = records.filter((r) => r.status === 'PRESENT').length;
      const absent = records.filter((r) => r.status === 'ABSENT').length;
      const late = records.filter((r) => r.status === 'LATE').length;
      const excused = records.filter((r) => r.status === 'EXCUSED').length;
      
      // Asistencias = Presente + Tarde + Excusa (no cuentan como falta)
      const attended = present + late + excused;
      // Porcentaje de asistencia
      const attendanceRate = totalClasses > 0 ? Math.round((attended / totalClasses) * 100) : 100;
      
      // Determinar estado basado en porcentaje
      let status = 'Normal';
      if (attendanceRate < 80) {
        status = 'Riesgo';
      } else if (attendanceRate < 90) {
        status = 'Alerta';
      }

      return {
        nro: index + 1,
        studentEnrollmentId: enrollment.id,
        name: `${enrollment.student.lastName} ${enrollment.student.firstName}`.toUpperCase(),
        group: `${enrollment.group.grade?.name || ''} ${enrollment.group.name}`,
        totalClasses, // Antes era "days" - ahora es "Total de clases registradas"
        present, // Clases con estado PRESENT
        attended, // Total asistencias (present + late + excused)
        absent, // Fallas
        late, // Tardanzas
        excused, // Excusas
        pct: attendanceRate,
        status, // Normal, Alerta, Riesgo
      };
    });
  }

  // Reporte detallado por día y asignatura
  async getDetailedAttendanceReport(params: {
    groupId?: string;
    academicYearId: string;
    date?: string;
    startDate?: string;
    endDate?: string;
    subjectId?: string;
    teacherId?: string;
    studentEnrollmentId?: string;
    status?: string;
  }) {
    const where: any = {};

    // Filtro por fecha específica o rango
    if (params.date) {
      where.date = new Date(params.date);
    } else if (params.startDate && params.endDate) {
      where.date = {
        gte: new Date(params.startDate),
        lte: new Date(params.endDate),
      };
    }

    // Filtro por estudiante
    if (params.studentEnrollmentId) {
      where.studentEnrollmentId = params.studentEnrollmentId;
    }

    // Filtro por estado
    if (params.status) {
      where.status = params.status;
    }

    // Filtro por asignatura o docente (a través de teacherAssignment)
    if (params.subjectId || params.teacherId || params.groupId) {
      where.teacherAssignment = {};
      if (params.subjectId) {
        where.teacherAssignment.subjectId = params.subjectId;
      }
      if (params.teacherId) {
        where.teacherAssignment.teacherId = params.teacherId;
      }
      if (params.groupId) {
        where.teacherAssignment.groupId = params.groupId;
      }
    }

    // Filtro por año académico
    where.studentEnrollment = {
      academicYearId: params.academicYearId,
    };

    const records = await this.prisma.attendanceRecord.findMany({
      where,
      include: {
        studentEnrollment: {
          include: {
            student: true,
            group: {
              include: {
                grade: true,
              },
            },
          },
        },
        teacherAssignment: {
          include: {
            subject: true,
            teacher: true,
          },
        },
      },
      orderBy: [
        { date: 'desc' },
        { studentEnrollment: { student: { lastName: 'asc' } } },
      ],
    });

    return records.map((record, index) => ({
      nro: index + 1,
      date: record.date.toISOString().split('T')[0],
      student: `${record.studentEnrollment.student.lastName} ${record.studentEnrollment.student.firstName}`.toUpperCase(),
      group: `${record.studentEnrollment.group.grade?.name || ''} ${record.studentEnrollment.group.name}`,
      subject: record.teacherAssignment.subject?.name || 'N/A',
      teacher: record.teacherAssignment.teacher
        ? `${record.teacherAssignment.teacher.firstName} ${record.teacherAssignment.teacher.lastName}`
        : 'N/A',
      status: record.status,
      observations: record.observations || '',
    }));
  }

  // Eliminar todos los registros de asistencia (solo para admin)
  async deleteAllRecords() {
    return this.prisma.attendanceRecord.deleteMany({});
  }

  // Reporte de gestión docente - clases programadas vs registradas
  async getTeacherComplianceReport(params: {
    academicYearId: string;
    teacherId?: string;
    groupId?: string;
    subjectId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { academicYearId, teacherId, groupId, subjectId, startDate, endDate } = params;

    if (!academicYearId) {
      return [];
    }

    // Obtener todas las asignaciones de docentes para el año académico
    const whereAssignment: any = {
      academicYearId,
    };
    if (teacherId) whereAssignment.teacherId = teacherId;
    if (groupId) whereAssignment.groupId = groupId;
    if (subjectId) whereAssignment.subjectId = subjectId;

    const assignments = await this.prisma.teacherAssignment.findMany({
      where: whereAssignment,
      include: {
        teacher: true,
        subject: true,
        group: {
          include: {
            grade: true,
          },
        },
      },
    });

    if (assignments.length === 0) {
      return [];
    }

    // Para cada asignación, contar las fechas únicas de registros de asistencia
    const results: any[] = [];

    for (const assignment of assignments) {
      // Construir filtro de fecha para los registros
      const whereRecords: any = {
        teacherAssignmentId: assignment.id,
      };

      if (startDate || endDate) {
        whereRecords.date = {};
        if (startDate) whereRecords.date.gte = new Date(startDate);
        if (endDate) whereRecords.date.lte = new Date(endDate);
      }

      // Contar fechas únicas donde se registró asistencia (clases registradas)
      const records = await this.prisma.attendanceRecord.findMany({
        where: whereRecords,
        select: {
          date: true,
        },
      });

      // Obtener fechas únicas manualmente
      const uniqueDates = new Set(records.map(r => r.date.toISOString().split('T')[0]));
      const classesRegistered = uniqueDates.size;

      // Calcular clases programadas basado en la intensidad horaria semanal
      const hoursPerWeek = assignment.weeklyHours || 1;
      
      // Calcular semanas entre fechas (o usar un valor por defecto)
      let weeksInPeriod = 16; // Valor por defecto: 4 meses aprox
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        weeksInPeriod = Math.ceil(diffDays / 7);
      }

      const classesScheduled = hoursPerWeek * weeksInPeriod;
      const classesNotRegistered = Math.max(0, classesScheduled - classesRegistered);
      const complianceRate = classesScheduled > 0 
        ? Math.round((classesRegistered / classesScheduled) * 100) 
        : 0;

      results.push({
        teacherId: assignment.teacherId,
        teacher: assignment.teacher 
          ? `${assignment.teacher.firstName} ${assignment.teacher.lastName}`.toUpperCase()
          : 'N/A',
        subject: assignment.subject?.name || 'N/A',
        group: `${assignment.group?.grade?.name || ''} ${assignment.group?.name || ''}`,
        classesScheduled,
        classesRegistered,
        classesNotRegistered,
        complianceRate,
      });
    }

    // Agrupar por docente si hay múltiples asignaturas
    const groupedByTeacher = new Map<string, any>();
    
    for (const item of results) {
      if (!groupedByTeacher.has(item.teacherId)) {
        groupedByTeacher.set(item.teacherId, {
          teacherId: item.teacherId,
          teacher: item.teacher,
          assignments: [],
          totalScheduled: 0,
          totalRegistered: 0,
          totalNotRegistered: 0,
        });
      }
      
      const teacher = groupedByTeacher.get(item.teacherId);
      teacher.assignments.push({
        subject: item.subject,
        group: item.group,
        classesScheduled: item.classesScheduled,
        classesRegistered: item.classesRegistered,
        classesNotRegistered: item.classesNotRegistered,
        complianceRate: item.complianceRate,
      });
      teacher.totalScheduled += item.classesScheduled;
      teacher.totalRegistered += item.classesRegistered;
      teacher.totalNotRegistered += item.classesNotRegistered;
    }

    // Calcular porcentaje de cumplimiento total por docente
    const finalResults = Array.from(groupedByTeacher.values()).map((t, idx) => ({
      nro: idx + 1,
      teacherId: t.teacherId,
      teacher: t.teacher,
      classesScheduled: t.totalScheduled,
      classesRegistered: t.totalRegistered,
      classesNotRegistered: t.totalNotRegistered,
      complianceRate: t.totalScheduled > 0 
        ? Math.round((t.totalRegistered / t.totalScheduled) * 100) 
        : 0,
      assignments: t.assignments,
    }));

    return finalResults.sort((a, b) => a.teacher.localeCompare(b.teacher));
  }

  // Reporte consolidado institucional - optimizado
  async getConsolidatedReport(params: {
    academicYearId: string;
    startDate?: string;
    endDate?: string;
    subjectId?: string;
  }) {
    const { academicYearId, startDate, endDate, subjectId } = params;

    if (!academicYearId) {
      return { byGrade: [], bySubject: [] };
    }

    // Construir filtro de fechas
    let dateFilter: any = {};
    if (startDate && endDate) {
      dateFilter = {
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      };
    }

    // Obtener todos los registros de asistencia del año con sus relaciones
    const whereClause: any = {
      teacherAssignment: {
        academicYearId,
      },
      ...dateFilter,
    };

    if (subjectId) {
      whereClause.teacherAssignment.subjectId = subjectId;
    }

    const records = await this.prisma.attendanceRecord.findMany({
      where: whereClause,
      include: {
        studentEnrollment: {
          include: {
            group: {
              include: {
                grade: true,
              },
            },
          },
        },
        teacherAssignment: {
          include: {
            subject: true,
          },
        },
      },
    });

    // Agrupar por grado
    const byGradeMap = new Map<string, { 
      grade: string, 
      totalRecords: number, 
      present: number, 
      absent: number, 
      late: number, 
      excused: number,
      students: Set<string>
    }>();

    // Agrupar por asignatura
    const bySubjectMap = new Map<string, { 
      subject: string, 
      totalRecords: number, 
      present: number, 
      absent: number, 
      late: number, 
      excused: number,
      students: Set<string>
    }>();

    for (const record of records) {
      const gradeName = record.studentEnrollment?.group?.grade?.name || 'Sin grado';
      const subjectName = record.teacherAssignment?.subject?.name || 'Sin asignatura';
      const studentId = record.studentEnrollmentId;

      // Por grado
      if (!byGradeMap.has(gradeName)) {
        byGradeMap.set(gradeName, { 
          grade: gradeName, 
          totalRecords: 0, 
          present: 0, 
          absent: 0, 
          late: 0, 
          excused: 0,
          students: new Set()
        });
      }
      const gradeData = byGradeMap.get(gradeName)!;
      gradeData.totalRecords++;
      gradeData.students.add(studentId);
      if (record.status === 'PRESENT') gradeData.present++;
      else if (record.status === 'ABSENT') gradeData.absent++;
      else if (record.status === 'LATE') gradeData.late++;
      else if (record.status === 'EXCUSED') gradeData.excused++;

      // Por asignatura
      if (!bySubjectMap.has(subjectName)) {
        bySubjectMap.set(subjectName, { 
          subject: subjectName, 
          totalRecords: 0, 
          present: 0, 
          absent: 0, 
          late: 0, 
          excused: 0,
          students: new Set()
        });
      }
      const subjectData = bySubjectMap.get(subjectName)!;
      subjectData.totalRecords++;
      subjectData.students.add(studentId);
      if (record.status === 'PRESENT') subjectData.present++;
      else if (record.status === 'ABSENT') subjectData.absent++;
      else if (record.status === 'LATE') subjectData.late++;
      else if (record.status === 'EXCUSED') subjectData.excused++;
    }

    // Convertir a arrays con porcentajes
    const byGrade = Array.from(byGradeMap.values())
      .map((g, idx) => ({
        nro: idx + 1,
        grade: g.grade,
        totalStudents: g.students.size,
        totalRecords: g.totalRecords,
        present: g.present,
        absent: g.absent,
        late: g.late,
        excused: g.excused,
        pct: g.totalRecords > 0 ? Math.round(((g.present + g.late + g.excused) / g.totalRecords) * 100) : 0,
      }))
      .sort((a, b) => a.grade.localeCompare(b.grade));

    const bySubject = Array.from(bySubjectMap.values())
      .map((s, idx) => ({
        nro: idx + 1,
        subject: s.subject,
        totalStudents: s.students.size,
        totalRecords: s.totalRecords,
        present: s.present,
        absent: s.absent,
        late: s.late,
        excused: s.excused,
        pct: s.totalRecords > 0 ? Math.round(((s.present + s.late + s.excused) / s.totalRecords) * 100) : 0,
      }))
      .sort((a, b) => a.subject.localeCompare(b.subject));

    // Renumerar después de ordenar
    byGrade.forEach((g, idx) => g.nro = idx + 1);
    bySubject.forEach((s, idx) => s.nro = idx + 1);

    return { byGrade, bySubject };
  }
}
