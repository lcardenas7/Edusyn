import { BadRequestException, Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { RecordAttendanceDto, UpdateAttendanceDto } from './dto/record-attendance.dto';
import { AttendanceAuditService, AttendanceAuditActor, AttendanceAuditEventInput } from './attendance-audit.service';
import {
  calculateExpectedClassesBatch,
  type TeacherAssignmentInfo,
  type ScheduleEntryInfo,
  type DateRange,
} from '../../engines/AttendanceSchedulingEngine';

/**
 * Asistencia por asignatura.
 *
 * **Aislamiento (2026-09-11).** Nueve de las diez rutas HTTP entraban con el identificador del
 * cliente y consultaban por id: `recordBulk` cargaba la asignación docente por id y **deducía de
 * esa fila el colegio y el año**, así que registraba asistencia —y auditoría— dentro de otra
 * institución; `update` cargaba y actualizaba por id; las lecturas y los cinco reportes aceptaban
 * asignación, matrícula, grupo, año o materia sin contexto. Ahora la institución la pone el ACTOR y
 * cada operación valida la cadena real del esquema:
 *
 *   asignación docente → institución (propia) · matrícula → institución (propia)
 *   grupo → sede → institución   ·   materia → área → institución
 *   registro de asistencia → institución (propia) + su asignación y su matrícula
 *
 * `Group` y `Subject` **no tienen `institutionId`** en el esquema: se acotan por `campus` y `area`.
 * Un recurso ajeno responde 404, igual que uno inexistente.
 */
@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceAudit: AttendanceAuditService,
  ) {}

  // ─── Guardas de pertenencia ────────────────────────────────────────────────

  /** Fecha válida. Un parámetro mal formado es 400, no un `Invalid Date` que envenena la consulta. */
  private fecha(valor: string | Date, campo = 'fecha'): Date {
    const d = valor instanceof Date ? valor : new Date(valor);
    if (Number.isNaN(d.getTime())) throw new BadRequestException(`La ${campo} no es válida`);
    return d;
  }

  private fechaOpcional(valor: string | undefined, campo: string): Date | undefined {
    return valor === undefined || valor === null || valor === '' ? undefined : this.fecha(valor, campo);
  }

  /** La asignación docente, solo si es de esta institución (y su año/grupo/materia también). */
  private async assignmentInScope(institutionId: string, teacherAssignmentId: string) {
    if (!teacherAssignmentId) throw new BadRequestException('Se requiere la asignación');
    const assignment = await this.prisma.teacherAssignment.findFirst({
      where: {
        id: teacherAssignmentId,
        institutionId,
        academicYear: { institutionId },
        group: { campus: { institutionId } },
      },
      select: { id: true, institutionId: true, academicYearId: true, groupId: true, subjectId: true, teacherId: true },
    });
    if (!assignment) throw new NotFoundException('Asignación no encontrada');
    return assignment;
  }

  /** La matrícula, solo si es de esta institución. */
  private async enrollmentInScope(institutionId: string, studentEnrollmentId: string) {
    if (!studentEnrollmentId) throw new BadRequestException('Se requiere la matrícula');
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: { id: studentEnrollmentId, institutionId, group: { campus: { institutionId } } },
      select: { id: true, academicYearId: true, groupId: true, studentId: true, status: true },
    });
    if (!enrollment) throw new NotFoundException('Matrícula no encontrada');
    return enrollment;
  }

  /** El año lectivo, solo si es de esta institución. */
  private async yearInScope(institutionId: string, academicYearId: string) {
    if (!academicYearId) throw new BadRequestException('Se requiere el año lectivo');
    const year = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, institutionId },
      select: { id: true, startDate: true, endDate: true },
    });
    if (!year) throw new NotFoundException('Año lectivo no encontrado');
    return year;
  }

  /** El grupo, por su sede: `Group` no lleva `institutionId` propio. */
  private async groupInScope(institutionId: string, groupId: string) {
    if (!groupId) throw new BadRequestException('Se requiere el grupo');
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, campus: { institutionId } },
      select: { id: true, campusId: true },
    });
    if (!group) throw new NotFoundException('Grupo no encontrado');
    return group;
  }

  /** La materia, por su área: `Subject` no lleva `institutionId` propio. */
  private async subjectInScope(institutionId: string, subjectId: string) {
    const subject = await this.prisma.subject.findFirst({
      where: { id: subjectId, area: { institutionId } },
      select: { id: true },
    });
    if (!subject) throw new NotFoundException('Asignatura no encontrada');
    return subject;
  }

  /**
   * M-3: impide modificar asistencia de una fecha que cae dentro de un período FINALIZED.
   * Solo bloquea cuando hay certeza (el período tiene rango de fechas que contiene la fecha).
   */
  private async guardAttendanceDateNotFinalized(academicYearId: string, date: Date): Promise<void> {
    const finalizedTerm = await this.prisma.academicTerm.findFirst({
      where: {
        academicYearId,
        status: 'FINALIZED',
        startDate: { lte: date },
        endDate: { gte: date },
      },
      select: { name: true },
    });
    if (finalizedTerm) {
      throw new ForbiddenException(
        `La asistencia de esta fecha pertenece a un período finalizado (${finalizedTerm.name}). Debe reabrirse formalmente para modificarla.`,
      );
    }
  }

  /**
   * Registro masivo de asistencia.
   *
   * La institución la pone el ACTOR. Antes se cargaba la asignación por id **sin institución** y de
   * esa fila se deducían el colegio y el año: con el id de otra institución se escribía asistencia
   * y auditoría dentro de ella.
   *
   * Las matrículas tienen que ser de la misma institución **y del grupo y año de la asignación**:
   * sin eso se podía colgar un registro de un estudiante de otro curso —o de otro colegio— a una
   * asignación propia. Registro y auditoría van en una sola transacción, revalidando dentro.
   */
  async recordBulk(dto: RecordAttendanceDto, institutionId: string, actor?: AttendanceAuditActor) {
    const date = this.fecha(dto.date);
    const assignment = await this.assignmentInScope(institutionId, dto.teacherAssignmentId);
    await this.guardAttendanceDateNotFinalized(assignment.academicYearId, date);

    const registros = Array.isArray(dto.records) ? dto.records : [];
    if (registros.length === 0) throw new BadRequestException('No se recibió ningún registro de asistencia');

    const enrollmentIds = [...new Set(registros.map((r) => r.studentEnrollmentId))];
    const validas = await this.prisma.studentEnrollment.findMany({
      where: {
        id: { in: enrollmentIds },
        institutionId,
        groupId: assignment.groupId,
        academicYearId: assignment.academicYearId,
        group: { campus: { institutionId } },
      },
      select: { id: true },
    });
    if (validas.length !== enrollmentIds.length) throw new NotFoundException('Matrícula no encontrada');

    // Estado previo (para auditoría forense: estado anterior vs nuevo)
    const existing = await this.prisma.attendanceRecord.findMany({
      where: { institutionId, teacherAssignmentId: dto.teacherAssignmentId, date, studentEnrollmentId: { in: enrollmentIds } },
      select: { id: true, studentEnrollmentId: true, status: true },
    });
    const prevMap = new Map(existing.map((e) => [e.studentEnrollmentId, { id: e.id, status: e.status as string }]));

    return this.prisma.$transaction(async () => {
      // Revalidación DENTRO de la transacción: cierra la carrera entre la guarda y la escritura.
      const sigueSiendoPropia = await this.prisma.teacherAssignment.count({
        where: { id: dto.teacherAssignmentId, institutionId },
      });
      if (sigueSiendoPropia !== 1) throw new NotFoundException('Asignación no encontrada');

      const results: any[] = [];
      const auditEvents: AttendanceAuditEventInput[] = [];

      for (const record of registros) {
        const previo = prevMap.get(record.studentEnrollmentId);
        if (previo) {
          // `upsert` por la clave única sola cruzaría instituciones si dos filas compartieran
          // clave: se actualiza acotado por institución.
          const filas = await this.prisma.attendanceRecord.updateMany({
            where: { id: previo.id, institutionId },
            data: { status: record.status, observations: record.observations },
          });
          if (filas.count !== 1) throw new NotFoundException('Registro de asistencia no encontrado');
          results.push({ id: previo.id, studentEnrollmentId: record.studentEnrollmentId, status: record.status });
          if (previo.status !== record.status) {
            auditEvents.push({
              institutionId, action: 'UPDATE', attendanceRecordId: previo.id,
              studentEnrollmentId: record.studentEnrollmentId, teacherAssignmentId: dto.teacherAssignmentId,
              date, previousStatus: previo.status, newStatus: record.status,
            });
          }
        } else {
          const creado = await this.prisma.attendanceRecord.create({
            data: {
              institutionId,
              teacherAssignmentId: dto.teacherAssignmentId,
              studentEnrollmentId: record.studentEnrollmentId,
              date,
              status: record.status,
              observations: record.observations,
            },
          });
          results.push(creado);
          auditEvents.push({
            institutionId, action: 'CREATE', attendanceRecordId: creado.id,
            studentEnrollmentId: record.studentEnrollmentId, teacherAssignmentId: dto.teacherAssignmentId,
            date, previousStatus: null, newStatus: record.status,
          });
        }
      }

      await this.attendanceAudit.recordMany(auditEvents, actor);
      return results;
    });
  }

  /**
   * Corrige un registro. Antes se cargaba y se actualizaba por id: con el id de otra institución se
   * editaba su asistencia y se escribía su auditoría. La fila se busca acotada —también por la
   * relación, por si una FK histórica quedó incoherente— y la escritura va con `updateMany` sobre
   * la misma institución. Solo se editan estado y observaciones.
   */
  async update(id: string, dto: UpdateAttendanceDto, institutionId: string, actor?: AttendanceAuditActor) {
    const record = await this.prisma.attendanceRecord.findFirst({
      where: {
        id, institutionId,
        teacherAssignment: { institutionId },
        studentEnrollment: { institutionId },
      },
      select: {
        date: true, status: true, institutionId: true,
        studentEnrollmentId: true, teacherAssignmentId: true,
        teacherAssignment: { select: { academicYearId: true } },
      },
    });
    if (!record) throw new NotFoundException('Registro de asistencia no encontrado');
    await this.guardAttendanceDateNotFinalized(record.teacherAssignment.academicYearId, record.date);

    return this.prisma.$transaction(async () => {
      const filas = await this.prisma.attendanceRecord.updateMany({
        where: { id, institutionId },
        data: { status: dto.status, observations: dto.observations },
      });
      if (filas.count !== 1) throw new NotFoundException('Registro de asistencia no encontrado');

      if (record.status !== dto.status) {
        await this.attendanceAudit.recordMany([{
          institutionId, action: 'UPDATE', attendanceRecordId: id,
          studentEnrollmentId: record.studentEnrollmentId, teacherAssignmentId: record.teacherAssignmentId,
          date: record.date, previousStatus: record.status as string, newStatus: dto.status,
        }], actor);
      }
      return this.prisma.attendanceRecord.findFirst({ where: { id, institutionId } });
    });
  }

  async getByAssignmentAndDate(teacherAssignmentId: string, date: string, institutionId: string) {
    await this.assignmentInScope(institutionId, teacherAssignmentId);
    return this.prisma.attendanceRecord.findMany({
      where: {
        institutionId,
        teacherAssignmentId,
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

  async getByStudent(studentEnrollmentId: string, institutionId: string, startDate?: string, endDate?: string) {
    await this.enrollmentInScope(institutionId, studentEnrollmentId);
    const desde = this.fechaOpcional(startDate, 'fecha inicial');
    const hasta = this.fechaOpcional(endDate, 'fecha final');
    return this.prisma.attendanceRecord.findMany({
      where: {
        institutionId,
        studentEnrollmentId,
        ...(desde || hasta
          ? {
              date: {
                ...(desde && { gte: desde }),
                ...(hasta && { lte: hasta }),
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

  async getStudentSummary(studentEnrollmentId: string, institutionId: string, academicTermId?: string) {
    if (!institutionId) throw new NotFoundException('Institución no encontrada');
    const enrollment = await this.prisma.studentEnrollment.findFirst({ where: { id: studentEnrollmentId, institutionId }, select: { id: true, academicYearId: true } });
    if (!enrollment) throw new NotFoundException('Matrícula no encontrada');
    const whereClause: any = { studentEnrollmentId, institutionId };

    if (academicTermId) {
      const term = await this.prisma.academicTerm.findFirst({
        where: { id: academicTermId, academicYear: { institutionId } },
      });
      if (!term || term.academicYearId !== enrollment.academicYearId) throw new NotFoundException('Período no encontrado');
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

  async getGroupAttendanceReport(teacherAssignmentId: string, startDate: string, endDate: string, institutionId: string) {
    // Antes cargaba la asignación por id y, si no existía, lanzaba un `Error` genérico → 500.
    const assignment = await this.assignmentInScope(institutionId, teacherAssignmentId);
    const desde = this.fecha(startDate, 'fecha inicial');
    const hasta = this.fecha(endDate, 'fecha final');

    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        institutionId,
        groupId: assignment.groupId,
        academicYearId: assignment.academicYearId,
        status: 'ACTIVE',
        group: { campus: { institutionId } },
      },
      include: {
        student: true,
        attendanceRecords: {
          where: {
            institutionId,
            teacherAssignmentId,
            date: {
              gte: desde,
              lte: hasta,
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
  async getReportByGroup(groupId: string, academicYearId: string, institutionId: string, params?: { startDate?: string; endDate?: string; subjectId?: string; includeWithdrawn?: boolean }) {
    // Grupo, año y materia se validan ANTES de tocar matrículas o registros: el grupo se acota por
    // su sede porque `Group` no tiene institución propia.
    await this.groupInScope(institutionId, groupId);
    await this.yearInScope(institutionId, academicYearId);
    if (params?.subjectId) await this.subjectInScope(institutionId, params.subjectId);
    // QUERY 1: Obtener todos los estudiantes del grupo.
    // Por defecto solo matrículas ACTIVE. `includeWithdrawn` suma las retiradas:
    // su asistencia existe en la base y sin esta opción era invisible en todo reporte.
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
    // Cada extremo se aplica por separado: exigir ambos hacía que "desde X" sin
    // "hasta" se ignorara en silencio y el reporte saliera con todo el año.
    const dateFilter: any = {};
    const desde = this.fechaOpcional(params?.startDate, 'fecha inicial');
    const hasta = this.fechaOpcional(params?.endDate, 'fecha final');
    if (desde || hasta) {
      dateFilter.date = {
        ...(desde && { gte: desde }),
        ...(hasta && { lte: hasta }),
      };
    }

    const allRecords = await this.prisma.attendanceRecord.findMany({
      where: {
        institutionId,
        studentEnrollmentId: { in: enrollmentIds },
        teacherAssignment: {
          institutionId,
          ...(params?.subjectId ? { subjectId: params.subjectId } : {}),
        },
        ...dateFilter,
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
        enrollmentStatus: enrollment.status,
        isWithdrawn: enrollment.status !== 'ACTIVE',
      };
    });
  }

  // Reporte consolidado institucional
  // OPTIMIZADO: 3 queries batch + agrupación en memoria (antes: N+1 doble por grupo y asignatura)
  async getConsolidatedReport(params: {
    academicYearId: string;
    institutionId: string;
    startDate?: string;
    endDate?: string;
    subjectId?: string;
    includeWithdrawn?: boolean;
  }) {
    // La institución ya no es opcional: antes, si el resolvedor no la daba, el reporte se armaba
    // solo con el año y una petición con el año de otro colegio devolvía sus datos.
    const institutionId = params.institutionId;
    await this.yearInScope(institutionId, params.academicYearId);
    if (params.subjectId) await this.subjectInScope(institutionId, params.subjectId);
    // QUERY 1: Obtener enrollments con grupo y grado (para mapear groupId → gradeName).
    // El academicYearId ya acota a una institución, pero se filtra también por
    // institutionId cuando el controlador lo resuelve: defensa en profundidad.
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        institutionId,
        academicYearId: params.academicYearId,
        group: { campus: { institutionId } },
        ...(params.includeWithdrawn ? {} : { status: 'ACTIVE' }),
      },
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
    // Cada extremo del rango se aplica por separado (ver getReportByGroup).
    const dateFilter: any = {};
    const desdeC = this.fechaOpcional(params.startDate, 'fecha inicial');
    const hastaC = this.fechaOpcional(params.endDate, 'fecha final');
    if (desdeC || hastaC) {
      dateFilter.date = {
        ...(desdeC && { gte: desdeC }),
        ...(hastaC && { lte: hastaC }),
      };
    }

    const allRecords = await this.prisma.attendanceRecord.findMany({
      where: {
        institutionId,
        studentEnrollmentId: { in: enrollmentIds },
        teacherAssignment: {
          institutionId,
          ...(params.subjectId ? { subjectId: params.subjectId } : {}),
        },
        ...dateFilter,
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
      where: { id: { in: subjectIds }, area: { institutionId } },
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
    institutionId: string;
    teacherId?: string;
    groupId?: string;
    subjectId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    // Año, grupo y materia se validan antes de listar asignaciones: con el año de otro colegio
    // este reporte devolvía sus asignaciones, sus docentes y su cumplimiento.
    const institutionId = params.institutionId;
    await this.yearInScope(institutionId, params.academicYearId);
    if (params.groupId) await this.groupInScope(institutionId, params.groupId);
    if (params.subjectId) await this.subjectInScope(institutionId, params.subjectId);

    // QUERY 1: Obtener todas las asignaciones de docentes
    const whereClause: any = {
      institutionId,
      academicYearId: params.academicYearId,
      group: { campus: { institutionId } },
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
    const desdeT = this.fechaOpcional(params.startDate, 'fecha inicial');
    const hastaT = this.fechaOpcional(params.endDate, 'fecha final');
    if (desdeT || hastaT) {
      dateFilter.date = {
        ...(desdeT && { gte: desdeT }),
        ...(hastaT && { lte: hastaT }),
      };
    }

    const allRecords = await this.prisma.attendanceRecord.findMany({
      where: {
        institutionId,
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
    // Cada extremo se resuelve por separado: con solo "desde" se tomaba todo el
    // año, y las clases programadas dejaban de cuadrar con las registradas.
    // El año ya se validó arriba dentro de la institución: se reutiliza en vez de volver a
    // consultarlo por id sin filtro.
    const anio = await this.prisma.academicYear.findFirst({
      where: { id: params.academicYearId, institutionId },
      select: { startDate: true, endDate: true },
    });
    let rangeStart: Date;
    let rangeEnd: Date;
    if (desdeT || hastaT) {
      rangeStart = desdeT ?? (anio?.startDate || new Date(new Date().getFullYear(), 0, 1));
      rangeEnd = hastaT ?? (anio?.endDate || new Date());
    } else {
      rangeStart = anio?.startDate ? new Date(anio.startDate) : new Date();
      rangeEnd = anio?.endDate ? new Date(anio.endDate) : new Date();
    }
    const dateRange: DateRange = { start: rangeStart, end: rangeEnd };

    // QUERY 3: Obtener entradas de horario para las asignaciones (si existen)
    const scheduleEntries = await this.prisma.scheduleEntry.findMany({
      where: {
        institutionId,
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
    institutionId: string;
    groupId?: string;
    startDate?: string;
    endDate?: string;
    subjectId?: string;
    teacherId?: string;
    studentEnrollmentId?: string;
    status?: string;
    includeWithdrawn?: boolean;
    limit?: number;
  }) {
    // Cada referencia recibida se valida antes de contar y listar: año, grupo, materia y matrícula.
    const institutionId = params.institutionId;
    await this.yearInScope(institutionId, params.academicYearId);
    if (params.groupId) await this.groupInScope(institutionId, params.groupId);
    if (params.subjectId) await this.subjectInScope(institutionId, params.subjectId);
    if (params.studentEnrollmentId) await this.enrollmentInScope(institutionId, params.studentEnrollmentId);

    const whereClause: any = { institutionId };

    whereClause.studentEnrollment = {
      institutionId,
      academicYearId: params.academicYearId,
      group: { campus: { institutionId } },
      ...(params.groupId ? { groupId: params.groupId } : {}),
      // Coherente con el resto de reportes: por defecto solo matrículas ACTIVE.
      ...(params.includeWithdrawn ? {} : { status: 'ACTIVE' }),
    };

    // La asignación SIEMPRE se acota, haya o no filtros de materia o docente.
    whereClause.teacherAssignment = { institutionId };

    // Cada extremo del rango se aplica por separado (ver getReportByGroup).
    const desdeD = this.fechaOpcional(params.startDate, 'fecha inicial');
    const hastaD = this.fechaOpcional(params.endDate, 'fecha final');
    if (desdeD || hastaD) {
      whereClause.date = {
        ...(desdeD && { gte: desdeD }),
        ...(hastaD && { lte: hastaD }),
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

    // Solo estados válidos de AttendanceStatus. El filtro "Estado" se comparte
    // entre reportes cuyos vocabularios difieren (Normal/Alerta/Riesgo vs
    // PRESENT/ABSENT/...), y un valor del otro reporte devolvía cero filas sin
    // explicación. Un valor desconocido se ignora en vez de vaciar el reporte.
    const VALID_STATUS = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
    if (params.status && VALID_STATUS.includes(params.status)) {
      whereClause.status = params.status;
    }

    const total = await this.prisma.attendanceRecord.count({ where: whereClause });
    const limit = Math.min(Math.max(params.limit ?? 2000, 1), 10000);

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
      take: limit,
    });

    const rows = records.map((record) => ({
      id: record.id,
      date: record.date,
      status: record.status,
      observations: record.observations,
      studentName: [record.studentEnrollment.student.lastName, (record.studentEnrollment.student as any).secondLastName, record.studentEnrollment.student.firstName, (record.studentEnrollment.student as any).secondName].filter(Boolean).join(' '),
      groupName: `${record.studentEnrollment.group.grade?.name || ''} ${record.studentEnrollment.group.name}`,
      subjectName: record.teacherAssignment.subject.name,
      teacherName: `${record.teacherAssignment.teacher.firstName} ${record.teacherAssignment.teacher.lastName}`,
      enrollmentStatus: record.studentEnrollment.status,
      isWithdrawn: record.studentEnrollment.status !== 'ACTIVE',
    }));

    // Se devuelve `total` y `truncated` porque antes el corte era mudo: con 8.946
    // registros el usuario veía 1.000 y creía estar viéndolo todo.
    return { rows, total, limit, truncated: total > rows.length };
  }
}
