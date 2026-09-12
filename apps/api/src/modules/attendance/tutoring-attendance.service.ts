import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

/**
 * Asistencia de tutoría (dirección de grupo).
 *
 * **Aislamiento (2026-09-11).** `recordBulk` cargaba el grupo por id y **deducía de él la
 * institución**: con el id de un grupo de otro colegio se registraba tutoría dentro de esa
 * institución, y la comprobación de «director de grupo» se hacía contra ese grupo ajeno. Las
 * lecturas y los reportes recibían grupo o matrícula sin contexto. Ahora la institución la pone el
 * ACTOR y toda consulta se acota.
 *
 * `Group` no tiene `institutionId` en el esquema: se acota por `campus.institutionId`.
 * Un recurso ajeno responde 404 —igual que uno inexistente— ANTES de comprobar permisos internos,
 * para no revelar que existe.
 */
@Injectable()
export class TutoringAttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Fecha válida: un parámetro mal formado es 400, no un `Invalid Date`. */
  private fecha(valor: string | Date, campo = 'fecha'): Date {
    const d = valor instanceof Date ? valor : new Date(valor);
    if (Number.isNaN(d.getTime())) throw new BadRequestException(`La ${campo} no es válida`);
    return d;
  }

  private fechaOpcional(valor: string | undefined, campo: string): Date | undefined {
    return valor === undefined || valor === null || valor === '' ? undefined : this.fecha(valor, campo);
  }

  /** El grupo, por su sede. 404 si no existe o es de otro colegio. */
  private async groupInScope(institutionId: string, groupId: string) {
    if (!groupId) throw new BadRequestException('Se requiere el grupo');
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, campus: { institutionId } },
      select: { id: true, directorId: true, campusId: true },
    });
    if (!group) throw new NotFoundException('Grupo no encontrado');
    return group;
  }

  /** La matrícula, solo si es de esta institución. */
  private async enrollmentInScope(institutionId: string, studentEnrollmentId: string) {
    if (!studentEnrollmentId) throw new BadRequestException('Se requiere la matrícula');
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: { id: studentEnrollmentId, institutionId, group: { campus: { institutionId } } },
      select: { id: true, groupId: true, academicYearId: true },
    });
    if (!enrollment) throw new NotFoundException('Matrícula no encontrada');
    return enrollment;
  }

  /** El año lectivo, solo si es de esta institución. */
  private async yearInScope(institutionId: string, academicYearId: string) {
    if (!academicYearId) throw new BadRequestException('Se requiere el año lectivo');
    const year = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, institutionId }, select: { id: true },
    });
    if (!year) throw new NotFoundException('Año lectivo no encontrado');
    return year;
  }

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
  /**
   * Registro masivo de tutoría. La institución llega del ACTOR: antes se deducía del grupo que
   * enviaba el cliente, así que con un grupo ajeno se escribía en otra institución y la regla de
   * «solo el director» se comprobaba contra el director de ese grupo ajeno.
   *
   * Las matrículas deben ser de la misma institución **y de ese grupo**. Todo va en una sola
   * transacción, revalidando dentro, y sin `upsert` por clave única sin acotar.
   */
  async recordBulk(dto: {
    groupId: string;
    institutionId: string;
    teacherId: string;
    date: string;
    userRoles?: string[];
    isSuperAdmin?: boolean;
    records: Array<{
      studentEnrollmentId: string;
      status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
      observations?: string;
    }>;
  }) {
    const institutionId = dto.institutionId;
    const date = this.fecha(dto.date);
    const group = await this.groupInScope(institutionId, dto.groupId);

    // Verificar que la feature está habilitada
    const enabled = await this.isTutoringEnabled(institutionId);
    if (!enabled) {
      throw new ForbiddenException('La asistencia de tutoría no está habilitada para esta institución');
    }

    // Admin/Rector/Coordinador pueden registrar en cualquier grupo; docente solo en su grupo dirigido
    const isAdmin = dto.isSuperAdmin === true
      || (dto.userRoles || []).some(r => ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR'].includes(r));
    if (!isAdmin && group.directorId !== dto.teacherId) {
      throw new ForbiddenException('Solo el director de grupo puede registrar asistencia de tutoría');
    }

    const registros = Array.isArray(dto.records) ? dto.records : [];
    if (registros.length === 0) throw new BadRequestException('No se recibió ningún registro de asistencia');

    const enrollmentIds = [...new Set(registros.map((r) => r.studentEnrollmentId))];
    const validas = await this.prisma.studentEnrollment.findMany({
      where: {
        id: { in: enrollmentIds },
        institutionId,
        groupId: dto.groupId,
        group: { campus: { institutionId } },
      },
      select: { id: true },
    });
    if (validas.length !== enrollmentIds.length) throw new NotFoundException('Matrícula no encontrada');

    const existentes = await this.prisma.tutoringAttendance.findMany({
      where: { institutionId, groupId: dto.groupId, date, studentEnrollmentId: { in: enrollmentIds } },
      select: { id: true, studentEnrollmentId: true },
    });
    const previos = new Map(existentes.map((e) => [e.studentEnrollmentId, e.id]));

    return this.prisma.$transaction(async () => {
      const sigueSiendoPropio = await this.prisma.group.count({
        where: { id: dto.groupId, campus: { institutionId } },
      });
      if (sigueSiendoPropio !== 1) throw new NotFoundException('Grupo no encontrado');

      const resultados: any[] = [];
      for (const record of registros) {
        const previo = previos.get(record.studentEnrollmentId);
        if (previo) {
          const filas = await this.prisma.tutoringAttendance.updateMany({
            where: { id: previo, institutionId },
            data: { status: record.status, observations: record.observations, teacherId: dto.teacherId },
          });
          if (filas.count !== 1) throw new NotFoundException('Registro de tutoría no encontrado');
          resultados.push({ id: previo, studentEnrollmentId: record.studentEnrollmentId, status: record.status });
        } else {
          resultados.push(await this.prisma.tutoringAttendance.create({
            data: {
              institutionId,
              groupId: dto.groupId,
              teacherId: dto.teacherId,
              studentEnrollmentId: record.studentEnrollmentId,
              date,
              status: record.status,
              observations: record.observations,
            },
          }));
        }
      }
      return resultados;
    });
  }

  /**
   * Obtiene registros de tutoría por grupo y fecha
   */
  async getByGroupAndDate(groupId: string, date: string, institutionId: string) {
    await this.groupInScope(institutionId, groupId);
    return this.prisma.tutoringAttendance.findMany({
      where: {
        institutionId,
        groupId,
        date: this.fecha(date),
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
  async getStudentSummary(studentEnrollmentId: string, institutionId: string, startDate?: string, endDate?: string) {
    await this.enrollmentInScope(institutionId, studentEnrollmentId);
    const whereClause: any = { studentEnrollmentId, institutionId };

    const desde = this.fechaOpcional(startDate, 'fecha inicial');
    const hasta = this.fechaOpcional(endDate, 'fecha final');
    if (desde || hasta) {
      whereClause.date = {
        ...(desde && { gte: desde }),
        ...(hasta && { lte: hasta }),
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
   * Verifica que el usuario pueda consultar reportes de tutoría del grupo.
   * Admin/Rector/Coordinador: cualquier grupo de su institución.
   * Docente: solo los grupos que dirige.
   */
  async assertCanReadGroupReport(groupId: string, institutionId: string, userId: string, userRoles: string[], isSuperAdmin = false) {
    // La frontera institucional va PRIMERO y es indistinguible de «no existe»: antes se cargaba el
    // grupo por id y un grupo ajeno respondía 403, confirmando su existencia.
    const group = await this.groupInScope(institutionId, groupId);

    // `isSuperAdmin` es imprescindible: el superadmin de plataforma NO tiene
    // roles en InstitutionUserRole (pasa el RolesGuard por su propio flag), así
    // que mirar solo los nombres de rol lo trataría como docente y lo bloquearía.
    const isAdmin = isSuperAdmin || (userRoles || []).some((r) =>
      ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR'].includes(r),
    );
    if (!isAdmin && group.directorId !== userId) {
      throw new ForbiddenException('Solo el director de grupo puede consultar la tutoría de este grupo');
    }
    return group;
  }

  /**
   * Reporte de asistencia de tutoría por grupo (para reportes administrativos)
   */
  async getReportByGroup(groupId: string, academicYearId: string, institutionId: string, params?: { startDate?: string; endDate?: string; includeWithdrawn?: boolean }) {
    await this.groupInScope(institutionId, groupId);
    await this.yearInScope(institutionId, academicYearId);
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        institutionId,
        groupId,
        academicYearId,
        group: { campus: { institutionId } },
        ...(params?.includeWithdrawn ? {} : { status: 'ACTIVE' }),
      },
      include: {
        student: true,
        group: { include: { grade: true } },
      },
      orderBy: { student: { lastName: 'asc' } },
    });

    const enrollmentIds = enrollments.map(e => e.id);
    if (enrollmentIds.length === 0) return [];

    // Cada extremo del rango se aplica por separado: exigir ambos hacía que
    // "desde X" sin "hasta" se ignorara en silencio.
    const dateFilter: any = {};
    const desdeR = this.fechaOpcional(params?.startDate, 'fecha inicial');
    const hastaR = this.fechaOpcional(params?.endDate, 'fecha final');
    if (desdeR || hastaR) {
      dateFilter.date = {
        ...(desdeR && { gte: desdeR }),
        ...(hastaR && { lte: hastaR }),
      };
    }

    const allRecords = await this.prisma.tutoringAttendance.findMany({
      where: {
        institutionId,
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
        enrollmentStatus: enrollment.status,
        isWithdrawn: enrollment.status !== 'ACTIVE',
      };
    });
  }

  /**
   * Reporte detallado (dia a dia) de asistencia de tutoria.
   * Es el equivalente de attendance.getDetailedReport pero sobre TutoringAttendance:
   * permite consultar la tutoria de un estudiante concreto, no solo el consolidado
   * del grupo.
   */
  async getDetailedReport(params: {
    institutionId: string;
    academicYearId: string;
    groupIds?: string[];
    groupId?: string;
    studentEnrollmentId?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    includeWithdrawn?: boolean;
  }) {
    await this.yearInScope(params.institutionId, params.academicYearId);
    if (params.groupId) await this.groupInScope(params.institutionId, params.groupId);
    if (params.studentEnrollmentId) await this.enrollmentInScope(params.institutionId, params.studentEnrollmentId);

    const enrollmentWhere: any = {
      institutionId: params.institutionId,
      academicYearId: params.academicYearId,
      group: { campus: { institutionId: params.institutionId } },
      ...(params.includeWithdrawn ? {} : { status: 'ACTIVE' }),
    };
    if (params.groupId) enrollmentWhere.groupId = params.groupId;
    else if (params.groupIds?.length) enrollmentWhere.groupId = { in: params.groupIds };

    const whereClause: any = {
      institutionId: params.institutionId,
      studentEnrollment: enrollmentWhere,
    };

    if (params.studentEnrollmentId) whereClause.studentEnrollmentId = params.studentEnrollmentId;
    // Solo estados válidos: el filtro "Estado" se comparte entre reportes con
    // vocabularios distintos y un valor ajeno vaciaba el reporte sin explicación.
    if (params.status && ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].includes(params.status)) {
      whereClause.status = params.status;
    }

    const desdeD = this.fechaOpcional(params.startDate, 'fecha inicial');
    const hastaD = this.fechaOpcional(params.endDate, 'fecha final');
    if (desdeD || hastaD) {
      whereClause.date = {
        ...(desdeD && { gte: desdeD }),
        ...(hastaD && { lte: hastaD }),
      };
    }

    const records = await this.prisma.tutoringAttendance.findMany({
      where: whereClause,
      include: {
        studentEnrollment: {
          include: {
            student: true,
            group: { include: { grade: true } },
          },
        },
        teacher: { select: { firstName: true, lastName: true } },
      },
      orderBy: [
        { date: 'desc' },
        { studentEnrollment: { student: { lastName: 'asc' } } },
      ],
      take: 1000,
    });

    return records.map((record) => ({
      id: record.id,
      date: record.date,
      status: record.status,
      observations: record.observations,
      studentName: [
        record.studentEnrollment.student.lastName,
        (record.studentEnrollment.student as any).secondLastName,
        record.studentEnrollment.student.firstName,
        (record.studentEnrollment.student as any).secondName,
      ]
        .filter(Boolean)
        .join(' '),
      groupName: `${record.studentEnrollment.group.grade?.name || ''} ${record.studentEnrollment.group.name}`.trim(),
      teacherName: record.teacher ? `${record.teacher.firstName} ${record.teacher.lastName}` : '',
      enrollmentStatus: record.studentEnrollment.status,
      isWithdrawn: record.studentEnrollment.status !== 'ACTIVE',
    }));
  }
}
