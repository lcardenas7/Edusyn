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

  // Reporte de asistencia por grupo (para reportes administrativos)
  async getReportByGroup(groupId: string, academicYearId: string, params?: { startDate?: string; endDate?: string; subjectId?: string }) {
    const whereClause: any = {
      studentEnrollment: {
        groupId,
        academicYearId,
        status: 'ACTIVE',
      },
    };

    if (params?.startDate && params?.endDate) {
      whereClause.date = {
        gte: new Date(params.startDate),
        lte: new Date(params.endDate),
      };
    }

    if (params?.subjectId) {
      whereClause.teacherAssignment = {
        subjectId: params.subjectId,
      };
    }

    // Obtener todos los estudiantes del grupo
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        groupId,
        academicYearId,
        status: 'ACTIVE',
      },
      include: {
        student: true,
        group: {
          include: { grade: true },
        },
      },
      orderBy: {
        student: { lastName: 'asc' },
      },
    });

    // Obtener registros de asistencia para cada estudiante
    const results = await Promise.all(
      enrollments.map(async (enrollment) => {
        const records = await this.prisma.attendanceRecord.findMany({
          where: {
            studentEnrollmentId: enrollment.id,
            ...whereClause.date ? { date: whereClause.date } : {},
            ...params?.subjectId ? { teacherAssignment: { subjectId: params.subjectId } } : {},
          },
        });

        const total = records.length;
        const present = records.filter((r) => r.status === 'PRESENT').length;
        const absent = records.filter((r) => r.status === 'ABSENT').length;
        const late = records.filter((r) => r.status === 'LATE').length;
        const excused = records.filter((r) => r.status === 'EXCUSED').length;
        const attendanceRate = total > 0 ? Math.round(((present + late + excused) / total) * 100) : 100;

        // Determinar estado
        let status = 'Normal';
        if (attendanceRate < 70) status = 'Riesgo';
        else if (attendanceRate < 85) status = 'Alerta';

        return {
          studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
          groupName: `${enrollment.group.grade?.name || ''} ${enrollment.group.name}`,
          totalClasses: total,
          present,
          absent,
          late,
          excused,
          attendanceRate,
          status,
        };
      }),
    );

    return results;
  }

  // Reporte consolidado institucional
  async getConsolidatedReport(params: {
    academicYearId: string;
    startDate?: string;
    endDate?: string;
    subjectId?: string;
  }) {
    const dateFilter: any = {};
    if (params.startDate && params.endDate) {
      dateFilter.date = {
        gte: new Date(params.startDate),
        lte: new Date(params.endDate),
      };
    }

    // Obtener todos los grupos del año académico a través de enrollments
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { academicYearId: params.academicYearId },
      select: { groupId: true },
      distinct: ['groupId'],
    });
    
    const groupIds = enrollments.map(e => e.groupId);
    const groups = await this.prisma.group.findMany({
      where: { id: { in: groupIds } },
      include: { grade: true },
    });

    // Consolidado por grado
    const byGrade: any[] = [];
    const gradeMap = new Map<string, { name: string; total: number; present: number; absent: number; late: number; excused: number }>();

    for (const group of groups) {
      const gradeName = group.grade?.name || 'Sin grado';
      
      const whereClause: any = {
        studentEnrollment: {
          groupId: group.id,
          academicYearId: params.academicYearId,
        },
        ...dateFilter,
      };

      if (params.subjectId) {
        whereClause.teacherAssignment = { subjectId: params.subjectId };
      }

      const records = await this.prisma.attendanceRecord.findMany({
        where: whereClause,
      });

      if (!gradeMap.has(gradeName)) {
        gradeMap.set(gradeName, { name: gradeName, total: 0, present: 0, absent: 0, late: 0, excused: 0 });
      }

      const gradeData = gradeMap.get(gradeName)!;
      gradeData.total += records.length;
      gradeData.present += records.filter(r => r.status === 'PRESENT').length;
      gradeData.absent += records.filter(r => r.status === 'ABSENT').length;
      gradeData.late += records.filter(r => r.status === 'LATE').length;
      gradeData.excused += records.filter(r => r.status === 'EXCUSED').length;
    }

    gradeMap.forEach((data) => {
      byGrade.push({
        ...data,
        attendanceRate: data.total > 0 ? Math.round(((data.present + data.late + data.excused) / data.total) * 100) : 0,
      });
    });

    // Consolidado por asignatura
    const bySubject: any[] = [];
    const subjects = await this.prisma.subject.findMany({
      where: params.subjectId ? { id: params.subjectId } : {},
    });

    for (const subject of subjects) {
      const records = await this.prisma.attendanceRecord.findMany({
        where: {
          teacherAssignment: {
            subjectId: subject.id,
            academicYearId: params.academicYearId,
          },
          ...dateFilter,
        },
      });

      if (records.length > 0) {
        const total = records.length;
        const present = records.filter(r => r.status === 'PRESENT').length;
        const absent = records.filter(r => r.status === 'ABSENT').length;
        const late = records.filter(r => r.status === 'LATE').length;
        const excused = records.filter(r => r.status === 'EXCUSED').length;

        bySubject.push({
          name: subject.name,
          total,
          present,
          absent,
          late,
          excused,
          attendanceRate: Math.round(((present + late + excused) / total) * 100),
        });
      }
    }

    return { byGrade, bySubject };
  }

  // Reporte de cumplimiento docente - clases registradas vs esperadas
  async getTeacherComplianceReport(params: {
    academicYearId: string;
    teacherId?: string;
    groupId?: string;
    subjectId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    // Obtener todas las asignaciones de docentes
    const whereClause: any = {
      academicYearId: params.academicYearId,
    };

    if (params.teacherId) {
      whereClause.teacherId = params.teacherId;
    }

    if (params.groupId) {
      whereClause.groupId = params.groupId;
    }

    if (params.subjectId) {
      whereClause.subjectId = params.subjectId;
    }

    const assignments = await this.prisma.teacherAssignment.findMany({
      where: whereClause,
      include: {
        teacher: true,
        subject: true,
        group: {
          include: { grade: true },
        },
      },
    });

    // Para cada asignación, contar los días únicos con registros de asistencia
    const results = await Promise.all(
      assignments.map(async (assignment) => {
        const dateFilter: any = {};
        if (params.startDate && params.endDate) {
          dateFilter.date = {
            gte: new Date(params.startDate),
            lte: new Date(params.endDate),
          };
        }

        // Contar días únicos con registros de asistencia
        const records = await this.prisma.attendanceRecord.findMany({
          where: {
            teacherAssignmentId: assignment.id,
            ...dateFilter,
          },
          select: {
            date: true,
          },
          distinct: ['date'],
        });

        const classesRegistered = records.length;
        
        // Estimar clases programadas (asumiendo 1 clase por día hábil por semana)
        // Esto es una aproximación - idealmente vendría de un horario
        let classesScheduled = 20; // Por defecto 20 clases por período
        if (params.startDate && params.endDate) {
          const start = new Date(params.startDate);
          const end = new Date(params.endDate);
          const weeks = Math.ceil((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
          classesScheduled = Math.max(weeks, 1); // Al menos 1 clase por semana
        }

        const complianceRate = classesScheduled > 0 
          ? Math.round((classesRegistered / classesScheduled) * 100) 
          : 0;

        return {
          teacherName: `${assignment.teacher.firstName} ${assignment.teacher.lastName}`,
          subjectName: assignment.subject.name,
          groupName: `${assignment.group.grade?.name || ''} ${assignment.group.name}`,
          classesScheduled,
          classesRegistered,
          classesNotRegistered: Math.max(0, classesScheduled - classesRegistered),
          complianceRate: Math.min(100, complianceRate),
        };
      }),
    );

    // Agrupar por docente
    const groupedByTeacher = results.reduce((acc: any, item) => {
      const key = item.teacherName;
      if (!acc[key]) {
        acc[key] = {
          teacherName: item.teacherName,
          classesScheduled: 0,
          classesRegistered: 0,
          classesNotRegistered: 0,
          details: [],
        };
      }
      acc[key].classesScheduled += item.classesScheduled;
      acc[key].classesRegistered += item.classesRegistered;
      acc[key].classesNotRegistered += item.classesNotRegistered;
      acc[key].details.push({
        subject: item.subjectName,
        group: item.groupName,
        registered: item.classesRegistered,
        scheduled: item.classesScheduled,
      });
      return acc;
    }, {});

    return Object.values(groupedByTeacher).map((teacher: any) => ({
      ...teacher,
      complianceRate: teacher.classesScheduled > 0 
        ? Math.round((teacher.classesRegistered / teacher.classesScheduled) * 100)
        : 0,
    }));
  }

  // Reporte detallado de asistencia
  async getDetailedReport(params: {
    academicYearId: string;
    groupId?: string;
    startDate?: string;
    endDate?: string;
    subjectId?: string;
    teacherId?: string;
    studentEnrollmentId?: string;
    status?: string;
  }) {
    const whereClause: any = {};

    if (params.groupId) {
      whereClause.studentEnrollment = {
        groupId: params.groupId,
        academicYearId: params.academicYearId,
      };
    } else {
      whereClause.studentEnrollment = {
        academicYearId: params.academicYearId,
      };
    }

    if (params.startDate && params.endDate) {
      whereClause.date = {
        gte: new Date(params.startDate),
        lte: new Date(params.endDate),
      };
    }

    if (params.subjectId) {
      whereClause.teacherAssignment = {
        ...whereClause.teacherAssignment,
        subjectId: params.subjectId,
      };
    }

    if (params.teacherId) {
      whereClause.teacherAssignment = {
        ...whereClause.teacherAssignment,
        teacherId: params.teacherId,
      };
    }

    if (params.studentEnrollmentId) {
      whereClause.studentEnrollmentId = params.studentEnrollmentId;
    }

    if (params.status) {
      whereClause.status = params.status;
    }

    const records = await this.prisma.attendanceRecord.findMany({
      where: whereClause,
      include: {
        studentEnrollment: {
          include: {
            student: true,
            group: {
              include: { grade: true },
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
      take: 1000, // Limitar resultados
    });

    return records.map((record) => ({
      id: record.id,
      date: record.date,
      status: record.status,
      observations: record.observations,
      studentName: `${record.studentEnrollment.student.firstName} ${record.studentEnrollment.student.lastName}`,
      groupName: `${record.studentEnrollment.group.grade?.name || ''} ${record.studentEnrollment.group.name}`,
      subjectName: record.teacherAssignment.subject.name,
      teacherName: `${record.teacherAssignment.teacher.firstName} ${record.teacherAssignment.teacher.lastName}`,
    }));
  }
}
