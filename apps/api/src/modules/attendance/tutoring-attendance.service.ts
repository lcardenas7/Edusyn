import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TutoringAttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verifica si la institución tiene habilitada la feature TUTORING_ATTENDANCE
   */
  async isTutoringEnabled(institutionId: string): Promise<boolean> {
    const mod = await this.prisma.institutionModule.findFirst({
      where: {
        institutionId,
        module: 'ATTENDANCE',
        isActive: true,
      },
    });
    if (!mod) return false;
    return mod.features.includes('TUTORING_ATTENDANCE');
  }

  /**
   * Obtiene los grupos que dirige un docente (donde es director de grupo)
   */
  async getDirectedGroups(teacherId: string, institutionId: string) {
    const activeYear = await this.prisma.academicYear.findFirst({
      where: { institutionId, status: 'ACTIVE' },
    });
    if (!activeYear) return [];

    return this.prisma.group.findMany({
      where: {
        directorId: teacherId,
        campus: { institutionId },
      },
      include: {
        grade: true,
        shift: true,
        campus: true,
      },
    });
  }

  /**
   * Registra asistencia de tutoría en bulk (upsert por grupo+estudiante+fecha)
   */
  async recordBulk(dto: {
    groupId: string;
    teacherId: string;
    date: string;
    records: Array<{
      studentEnrollmentId: string;
      status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
      observations?: string;
    }>;
  }) {
    const date = new Date(dto.date);

    // Verificar que el grupo existe y obtener institutionId
    const group = await this.prisma.group.findUnique({
      where: { id: dto.groupId },
      include: { campus: true },
    });
    if (!group) throw new BadRequestException('Grupo no encontrado');

    const institutionId = group.campus.institutionId;

    // Verificar que la feature está habilitada
    const enabled = await this.isTutoringEnabled(institutionId);
    if (!enabled) {
      throw new ForbiddenException('La asistencia de tutoría no está habilitada para esta institución');
    }

    // Verificar que el docente es director de este grupo
    if (group.directorId !== dto.teacherId) {
      throw new ForbiddenException('Solo el director de grupo puede registrar asistencia de tutoría');
    }

    const operations = dto.records.map((record) =>
      this.prisma.tutoringAttendance.upsert({
        where: {
          groupId_studentEnrollmentId_date: {
            groupId: dto.groupId,
            studentEnrollmentId: record.studentEnrollmentId,
            date,
          },
        },
        update: {
          status: record.status,
          observations: record.observations,
          teacherId: dto.teacherId,
        },
        create: {
          institutionId,
          groupId: dto.groupId,
          teacherId: dto.teacherId,
          studentEnrollmentId: record.studentEnrollmentId,
          date,
          status: record.status,
          observations: record.observations,
        },
      }),
    );

    return this.prisma.$transaction(operations);
  }

  /**
   * Obtiene registros de tutoría por grupo y fecha
   */
  async getByGroupAndDate(groupId: string, date: string) {
    return this.prisma.tutoringAttendance.findMany({
      where: {
        groupId,
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

  /**
   * Resumen de asistencia de tutoría por estudiante
   */
  async getStudentSummary(studentEnrollmentId: string, startDate?: string, endDate?: string) {
    const whereClause: any = { studentEnrollmentId };

    if (startDate && endDate) {
      whereClause.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const records = await this.prisma.tutoringAttendance.findMany({
      where: whereClause,
    });

    const total = records.length;
    const present = records.filter((r) => r.status === 'PRESENT').length;
    const absent = records.filter((r) => r.status === 'ABSENT').length;
    const late = records.filter((r) => r.status === 'LATE').length;
    const excused = records.filter((r) => r.status === 'EXCUSED').length;

    return {
      total,
      present,
      absent,
      late,
      excused,
      attendanceRate: total > 0 ? Math.round(((present + late + excused) / total) * 100) : 0,
    };
  }

  /**
   * Reporte de asistencia de tutoría por grupo (para reportes administrativos)
   */
  async getReportByGroup(groupId: string, academicYearId: string, params?: { startDate?: string; endDate?: string }) {
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        groupId,
        academicYearId,
        status: 'ACTIVE',
      },
      include: {
        student: true,
        group: { include: { grade: true } },
      },
      orderBy: { student: { lastName: 'asc' } },
    });

    const enrollmentIds = enrollments.map(e => e.id);
    if (enrollmentIds.length === 0) return [];

    const dateFilter: any = {};
    if (params?.startDate && params?.endDate) {
      dateFilter.date = {
        gte: new Date(params.startDate),
        lte: new Date(params.endDate),
      };
    }

    const allRecords = await this.prisma.tutoringAttendance.findMany({
      where: {
        studentEnrollmentId: { in: enrollmentIds },
        groupId,
        ...dateFilter,
      },
    });

    const recordsByEnrollment = new Map<string, typeof allRecords>();
    for (const rec of allRecords) {
      const list = recordsByEnrollment.get(rec.studentEnrollmentId) || [];
      list.push(rec);
      recordsByEnrollment.set(rec.studentEnrollmentId, list);
    }

    return enrollments.map((enrollment) => {
      const records = recordsByEnrollment.get(enrollment.id) || [];
      const total = records.length;
      const present = records.filter((r) => r.status === 'PRESENT').length;
      const absent = records.filter((r) => r.status === 'ABSENT').length;
      const late = records.filter((r) => r.status === 'LATE').length;
      const excused = records.filter((r) => r.status === 'EXCUSED').length;
      const attendanceRate = total > 0 ? Math.round(((present + late + excused) / total) * 100) : 100;

      return {
        studentName: [enrollment.student.lastName, (enrollment.student as any).secondLastName, enrollment.student.firstName, (enrollment.student as any).secondName].filter(Boolean).join(' '),
        groupName: `${enrollment.group.grade?.name || ''} ${enrollment.group.name}`,
        totalDays: total,
        present,
        absent,
        late,
        excused,
        attendanceRate,
        status: attendanceRate < 70 ? 'Riesgo' : attendanceRate < 85 ? 'Alerta' : 'Normal',
      };
    });
  }
}
