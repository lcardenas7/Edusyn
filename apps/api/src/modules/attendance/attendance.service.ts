import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { RecordAttendanceDto, UpdateAttendanceDto } from './dto/record-attendance.dto';
import {
  calculateExpectedClassesBatch,
  type TeacherAssignmentInfo,
  type ScheduleEntryInfo,
  type DateRange,
} from '../../engines/AttendanceSchedulingEngine';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async recordBulk(dto: RecordAttendanceDto) {
    const date = new Date(dto.date);
    const ta = await this.prisma.teacherAssignment.findUnique({ where: { id: dto.teacherAssignmentId }, select: { institutionId: true } });
    const instId = ta!.institutionId;

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
          institutionId: instId,
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
  // OPTIMIZADO: 2 queries batch + agrupación en memoria (antes: N+1)
  async getReportByGroup(groupId: string, academicYearId: string, params?: { startDate?: string; endDate?: string; subjectId?: string }) {
    // QUERY 1: Obtener todos los estudiantes del grupo
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

    const enrollmentIds = enrollments.map(e => e.id);
    if (enrollmentIds.length === 0) return [];

    // QUERY 2: Batch — TODOS los registros de asistencia del grupo
    const dateFilter: any = {};
    if (params?.startDate && params?.endDate) {
      dateFilter.date = {
        gte: new Date(params.startDate),
        lte: new Date(params.endDate),
      };
    }

    const allRecords = await this.prisma.attendanceRecord.findMany({
      where: {
        studentEnrollmentId: { in: enrollmentIds },
        ...dateFilter,
        ...(params?.subjectId ? { teacherAssignment: { subjectId: params.subjectId } } : {}),
      },
    });

    // Agrupar en memoria por enrollmentId — O(n)
    const recordsByEnrollment = new Map<string, typeof allRecords>();
    for (const rec of allRecords) {
      const list = recordsByEnrollment.get(rec.studentEnrollmentId) || [];
      list.push(rec);
      recordsByEnrollment.set(rec.studentEnrollmentId, list);
    }

    // Construir resultado — 0 queries
    return enrollments.map((enrollment) => {
      const records = recordsByEnrollment.get(enrollment.id) || [];
      const total = records.length;
      const present = records.filter((r) => r.status === 'PRESENT').length;
      const absent = records.filter((r) => r.status === 'ABSENT').length;
      const late = records.filter((r) => r.status === 'LATE').length;
      const excused = records.filter((r) => r.status === 'EXCUSED').length;
      const attendanceRate = total > 0 ? Math.round(((present + late + excused) / total) * 100) : 100;

      let status = 'Normal';
      if (attendanceRate < 70) status = 'Riesgo';
      else if (attendanceRate < 85) status = 'Alerta';

      return {
        studentName: [enrollment.student.lastName, (enrollment.student as any).secondLastName, enrollment.student.firstName, (enrollment.student as any).secondName].filter(Boolean).join(' '),
        groupName: `${enrollment.group.grade?.name || ''} ${enrollment.group.name}`,
        totalClasses: total,
        present,
        absent,
        late,
        excused,
        attendanceRate,
        status,
      };
    });
  }

  // Reporte consolidado institucional
  // OPTIMIZADO: 3 queries batch + agrupación en memoria (antes: N+1 doble por grupo y asignatura)
  async getConsolidatedReport(params: {
    academicYearId: string;
    startDate?: string;
    endDate?: string;
    subjectId?: string;
  }) {
    // QUERY 1: Obtener enrollments con grupo y grado (para mapear groupId → gradeName)
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { academicYearId: params.academicYearId, status: 'ACTIVE' },
      select: {
        id: true,
        groupId: true,
        group: { select: { id: true, name: true, grade: { select: { name: true } } } },
      },
    });

    if (enrollments.length === 0) return { byGrade: [], bySubject: [] };

    // Mapas de lookup
    const enrollmentToGroup = new Map<string, string>();
    const groupToGrade = new Map<string, string>();
    for (const e of enrollments) {
      enrollmentToGroup.set(e.id, e.groupId);
      if (!groupToGrade.has(e.groupId)) {
        groupToGrade.set(e.groupId, e.group.grade?.name || 'Sin grado');
      }
    }

    const enrollmentIds = enrollments.map(e => e.id);

    // QUERY 2: Batch — TODOS los registros de asistencia del año con teacherAssignment.subjectId
    const dateFilter: any = {};
    if (params.startDate && params.endDate) {
      dateFilter.date = {
        gte: new Date(params.startDate),
        lte: new Date(params.endDate),
      };
    }

    const allRecords = await this.prisma.attendanceRecord.findMany({
      where: {
        studentEnrollmentId: { in: enrollmentIds },
        ...dateFilter,
        ...(params.subjectId ? { teacherAssignment: { subjectId: params.subjectId } } : {}),
      },
      select: {
        studentEnrollmentId: true,
        status: true,
        teacherAssignment: {
          select: { subjectId: true },
        },
      },
    });

    // QUERY 3: Obtener nombres de asignaturas (1 query)
    const subjectIds = [...new Set(allRecords.map(r => r.teacherAssignment.subjectId))];
    const subjects = await this.prisma.subject.findMany({
      where: { id: { in: subjectIds } },
      select: { id: true, name: true },
    });
    const subjectNameMap = new Map(subjects.map(s => [s.id, s.name]));

    // ─── Agrupación en memoria — 0 queries ───

    // Consolidado por grado
    const gradeMap = new Map<string, { name: string; total: number; present: number; absent: number; late: number; excused: number }>();

    for (const rec of allRecords) {
      const groupId = enrollmentToGroup.get(rec.studentEnrollmentId);
      const gradeName = groupId ? (groupToGrade.get(groupId) || 'Sin grado') : 'Sin grado';

      if (!gradeMap.has(gradeName)) {
        gradeMap.set(gradeName, { name: gradeName, total: 0, present: 0, absent: 0, late: 0, excused: 0 });
      }
      const g = gradeMap.get(gradeName)!;
      g.total++;
      if (rec.status === 'PRESENT') g.present++;
      else if (rec.status === 'ABSENT') g.absent++;
      else if (rec.status === 'LATE') g.late++;
      else if (rec.status === 'EXCUSED') g.excused++;
    }

    const byGrade = [...gradeMap.values()].map(data => ({
      ...data,
      attendanceRate: data.total > 0 ? Math.round(((data.present + data.late + data.excused) / data.total) * 100) : 0,
    }));

    // Consolidado por asignatura
    const subjectMap = new Map<string, { name: string; total: number; present: number; absent: number; late: number; excused: number }>();

    for (const rec of allRecords) {
      const subjectId = rec.teacherAssignment.subjectId;
      const subjectName = subjectNameMap.get(subjectId) || 'Sin asignatura';

      if (!subjectMap.has(subjectId)) {
        subjectMap.set(subjectId, { name: subjectName, total: 0, present: 0, absent: 0, late: 0, excused: 0 });
      }
      const s = subjectMap.get(subjectId)!;
      s.total++;
      if (rec.status === 'PRESENT') s.present++;
      else if (rec.status === 'ABSENT') s.absent++;
      else if (rec.status === 'LATE') s.late++;
      else if (rec.status === 'EXCUSED') s.excused++;
    }

    const bySubject = [...subjectMap.values()]
      .filter(data => data.total > 0)
      .map(data => ({
        ...data,
        attendanceRate: Math.round(((data.present + data.late + data.excused) / data.total) * 100),
      }));

    return { byGrade, bySubject };
  }

  // Reporte de cumplimiento docente - clases registradas vs esperadas
  // OPTIMIZADO: 2 queries batch + agrupación en memoria (antes: N+1)
  async getTeacherComplianceReport(params: {
    academicYearId: string;
    teacherId?: string;
    groupId?: string;
    subjectId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    // QUERY 1: Obtener todas las asignaciones de docentes
    const whereClause: any = {
      academicYearId: params.academicYearId,
    };

    if (params.teacherId) whereClause.teacherId = params.teacherId;
    if (params.groupId) whereClause.groupId = params.groupId;
    if (params.subjectId) whereClause.subjectId = params.subjectId;

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

    const assignmentIds = assignments.map(a => a.id);
    if (assignmentIds.length === 0) return [];

    // QUERY 2: Batch — TODOS los registros de asistencia de todas las asignaciones
    const dateFilter: any = {};
    if (params.startDate && params.endDate) {
      dateFilter.date = {
        gte: new Date(params.startDate),
        lte: new Date(params.endDate),
      };
    }

    const allRecords = await this.prisma.attendanceRecord.findMany({
      where: {
        teacherAssignmentId: { in: assignmentIds },
        ...dateFilter,
      },
      select: {
        teacherAssignmentId: true,
        date: true,
      },
    });

    // Agrupar en memoria: Map<assignmentId, Set<dateString>> para días únicos — O(n)
    const datesByAssignment = new Map<string, Set<string>>();
    for (const rec of allRecords) {
      const dates = datesByAssignment.get(rec.teacherAssignmentId) || new Set();
      dates.add(rec.date.toISOString().split('T')[0]);
      datesByAssignment.set(rec.teacherAssignmentId, dates);
    }

    // ─── Calcular clases programadas usando AttendanceSchedulingEngine ───
    let rangeStart: Date;
    let rangeEnd: Date;
    if (params.startDate && params.endDate) {
      rangeStart = new Date(params.startDate);
      rangeEnd = new Date(params.endDate);
    } else {
      const academicYear = await this.prisma.academicYear.findUnique({
        where: { id: params.academicYearId },
        select: { startDate: true, endDate: true },
      });
      rangeStart = academicYear?.startDate ? new Date(academicYear.startDate) : new Date();
      rangeEnd = academicYear?.endDate ? new Date(academicYear.endDate) : new Date();
    }
    const dateRange: DateRange = { start: rangeStart, end: rangeEnd };

    // QUERY 3: Obtener entradas de horario para las asignaciones (si existen)
    const scheduleEntries = await this.prisma.scheduleEntry.findMany({
      where: {
        teacherAssignmentId: { in: assignmentIds },
        academicYearId: params.academicYearId,
      },
      select: {
        teacherAssignmentId: true,
        dayOfWeek: true,
      },
    });

    // Preparar datos para el engine
    const assignmentInfos: TeacherAssignmentInfo[] = assignments.map(a => ({
      id: a.id,
      teacherId: a.teacherId,
      groupId: a.groupId,
      subjectId: a.subjectId,
      weeklyHours: a.weeklyHours,
    }));
    const scheduleInfos: ScheduleEntryInfo[] = scheduleEntries
      .filter(e => e.teacherAssignmentId != null)
      .map(e => ({
        teacherAssignmentId: e.teacherAssignmentId!,
        dayOfWeek: e.dayOfWeek,
      }));

    // Calcular clases esperadas por asignación (usa horario real o weeklyHours como fallback)
    const expectedMap = calculateExpectedClassesBatch(assignmentInfos, scheduleInfos, dateRange);

    // Construir resultados
    const results = assignments.map((assignment) => {
      const uniqueDates = datesByAssignment.get(assignment.id);
      const classesRegistered = uniqueDates ? uniqueDates.size : 0;
      const expected = expectedMap.get(assignment.id);
      const classesScheduled = expected?.expectedClasses || Math.max(1, assignment.weeklyHours);
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
        calculationSource: expected?.source || 'WEEKLY_HOURS',
      };
    });

    // Agrupar por docente en memoria
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
      classesNotRegistered: Math.max(0, teacher.classesScheduled - teacher.classesRegistered),
      complianceRate: teacher.classesScheduled > 0
        ? Math.min(100, Math.round((teacher.classesRegistered / teacher.classesScheduled) * 100))
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
      studentName: [record.studentEnrollment.student.lastName, (record.studentEnrollment.student as any).secondLastName, record.studentEnrollment.student.firstName, (record.studentEnrollment.student as any).secondName].filter(Boolean).join(' '),
      groupName: `${record.studentEnrollment.group.grade?.name || ''} ${record.studentEnrollment.group.name}`,
      subjectName: record.teacherAssignment.subject.name,
      teacherName: `${record.teacherAssignment.teacher.firstName} ${record.teacherAssignment.teacher.lastName}`,
    }));
  }
}
