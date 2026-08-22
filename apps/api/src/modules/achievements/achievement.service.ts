import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException, Optional, Logger } from '@nestjs/common';
import { PerformanceLevel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GradeAuditService, GradeAuditActor } from '../evaluation/grade-audit.service';
import { RetirableEvidence, isEvidenceVigente, collectRetirementTermIds } from './evidence-vigencia.util';

/** Origen de auditoría E-5 para el catálogo de evidencias/imprescindibles (D-12). */
export const EVIDENCE_AUDIT_SOURCE = 'ACHIEVEMENT_EVIDENCE';

@Injectable()
export class AchievementService {
  private readonly logger = new Logger(AchievementService.name);

  // `gradeAudit` es opcional a propósito: auditar nunca debe ser requisito para
  // construir el servicio ni para que una operación de catálogo funcione.
  constructor(
    private prisma: PrismaService,
    @Optional() private readonly gradeAudit?: GradeAuditService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // AISLAMIENTO MULTI-TENANT (A-1 / A-2 / A-3)
  // ═══════════════════════════════════════════════════════════════════════════
  // Un `institutionId` correcto en la fila NO demuestra aislamiento si se derivó
  // de un FK que eligió el cliente. Antes, estas escrituras hacían
  // `institutionId: enr.institutionId` a partir del `studentEnrollmentId` del
  // cuerpo: la fila quedaba coherente y el actor nunca se comprobaba.
  //
  // Rutas canónicas verificadas contra schema.prisma
  // (docs/security/DISENO-ACHIEVEMENTS-A1-A3.md §5):
  //
  //   studentEnrollmentId   -> StudentEnrollment.institutionId      (columna directa)
  //   achievementEvidenceId -> achievement.institutionId            (FK obligatoria, D-5)
  //   academicTermId        -> academicYear.institutionId           (sin columna propia)
  //   subjectId            -> area.institutionId                    (sin columna propia)

  /**
   * Exige que TODOS los identificadores recibidos del cliente pertenezcan a
   * `institutionId` (el tenant efectivo del actor).
   *
   * No basta comprobarlos por separado: al anclarlos todos al mismo tenant queda
   * implicada su coherencia mutua, de modo que una combinación como
   * `enrollment(A) + evidence(A) + term(B)` se rechaza aunque el actor sea de A.
   *
   * Cada mensaje conserva el que la ruta ya devolvía, y un recurso inexistente es
   * indistinguible de uno ajeno: no se revela la existencia de datos de otro tenant.
   */
  private async assertOwnership(
    institutionId: string,
    ids: {
      studentEnrollmentId?: string;
      achievementEvidenceId?: string;
      academicTermId?: string;
      subjectId?: string;
    },
  ) {
    if (ids.studentEnrollmentId !== undefined) {
      const row = await this.prisma.studentEnrollment.findFirst({
        where: { id: ids.studentEnrollmentId, institutionId },
        select: { id: true },
      });
      if (!row) throw new NotFoundException('Matrícula no encontrada');
    }

    if (ids.achievementEvidenceId !== undefined) {
      const row = await this.prisma.achievementEvidence.findFirst({
        where: { id: ids.achievementEvidenceId, achievement: { institutionId } },
        select: { id: true },
      });
      if (!row) throw new NotFoundException('Imprescindible no encontrado');
    }

    if (ids.academicTermId !== undefined) {
      const row = await this.prisma.academicTerm.findFirst({
        where: { id: ids.academicTermId, academicYear: { institutionId } },
        select: { id: true },
      });
      if (!row) throw new NotFoundException('Período académico no encontrado');
    }

    if (ids.subjectId !== undefined) {
      const row = await this.prisma.subject.findFirst({
        where: { id: ids.subjectId, area: { institutionId } },
        select: { id: true },
      });
      if (!row) throw new NotFoundException('Asignatura no encontrada');
    }
  }

  // ============================================
  // VIGENCIA DE EVIDENCIAS POR PERÍODO (D-12)
  // ============================================

  /**
   * Regla canónica de vigencia (D-12).
   *
   * Una evidencia retirada desde el período `T` sigue vigente en todo período `P`
   * del mismo año académico con `P.order < T.order`, y deja de serlo desde `T`.
   *
   * NO se usan `startDate`/`endDate` — el 41 % de los períodos en producción no las
   * tiene — ni la existencia de valoraciones, que sería un proxy inestable.
   * `retiredAt` no participa: es sólo trazabilidad.
   *
   * Ante un dato inconsistente (período desconocido) se falla ABIERTO, conservando la
   * evidencia: ocultar información de un boletín es peor que mostrarla de más.
   */
  private async keepVigentes<T extends RetirableEvidence>(
    evidences: T[],
    academicTermId: string,
  ): Promise<T[]> {
    if (evidences.length === 0) return evidences;
    const retiredTermIds = collectRetirementTermIds(evidences);
    if (retiredTermIds.length === 0) return evidences; // ninguna retirada → nada que filtrar

    const terms = await this.prisma.academicTerm.findMany({
      where: { id: { in: [...retiredTermIds, academicTermId] } },
      select: { id: true, order: true },
    });
    const orderById = new Map(terms.map((t) => [t.id, t.order]));
    const currentOrder = orderById.get(academicTermId);

    return evidences.filter((e) => isEvidenceVigente(e, currentOrder, orderById));
  }

  // ============================================
  // LOGROS ACADÉMICOS
  // ============================================

  /**
   * Helper: Obtener IDs de todas las asignaciones (actual + históricas) para el mismo grupo+materia+año.
   */
  private async getAllAssignmentIds(teacherAssignmentId: string): Promise<string[]> {
    const current = await this.prisma.teacherAssignment.findUnique({
      where: { id: teacherAssignmentId },
      select: { academicYearId: true, groupId: true, subjectId: true },
    });
    if (!current) return [teacherAssignmentId];
    const all = await this.prisma.teacherAssignment.findMany({
      where: {
        academicYearId: current.academicYearId,
        groupId: current.groupId,
        subjectId: current.subjectId,
      },
      select: { id: true },
    });
    return all.map(a => a.id);
  }

  async getAchievementsByAssignment(teacherAssignmentId: string, academicTermId: string) {
    const assignmentIds = await this.getAllAssignmentIds(teacherAssignmentId);
    const assignment = await this.prisma.teacherAssignment.findUnique({
      where: { id: teacherAssignmentId },
      select: {
        academicYearId: true,
        subjectId: true,
        group: { select: { gradeId: true } },
      },
    });
    if (!assignment) throw new NotFoundException('Asignación docente no encontrada');

    const achievements = await this.prisma.achievement.findMany({
      where: {
        isPromotional: false,
        OR: [
          // Flujo tradicional: aprendizajes creados para la asignación y período.
          { teacherAssignmentId: { in: assignmentIds }, academicTermId },
          // Catálogo compartido: los propósitos anuales o del período aplican a
          // todos los grupos del mismo grado y dimensión.
          {
            teacherAssignmentId: null,
            gradeId: assignment.group.gradeId,
            subjectId: assignment.subjectId,
            academicYearId: assignment.academicYearId,
            OR: [{ academicTermId }, { academicTermId: null }],
          },
        ],
      },
      orderBy: { orderNumber: 'asc' },
      include: {
        studentAchievements: {
          where: { academicTermId },
          include: {
            studentEnrollment: {
              include: {
                student: true,
              },
            },
          },
        },
        attitudinalAchievements: true,
        levelDescriptors: true,
        evidences: { orderBy: { orderNumber: 'asc' } },
      },
    });

    // D-12 / H-18: la planilla del docente sólo ofrece las evidencias VIGENTES en el
    // período consultado. Una evidencia retirada desde un período anterior o igual no
    // puede recibir valoraciones nuevas, así que no debe siquiera aparecer.
    for (const achievement of achievements) {
      achievement.evidences = await this.keepVigentes(achievement.evidences, academicTermId);
    }
    return achievements;
  }

  // ============================================
  // CONVIVENCIA (registro textual libre del docente)
  // ============================================

  /** Entradas de convivencia de todos los estudiantes del grupo, para el período. */
  async getConvivenciaByAssignment(teacherAssignmentId: string, academicTermId: string) {
    const ta = await this.prisma.teacherAssignment.findUnique({
      where: { id: teacherAssignmentId },
      select: { subjectId: true, groupId: true },
    });
    if (!ta) throw new NotFoundException('Asignación docente no encontrada');
    return this.prisma.convivenciaEntry.findMany({
      where: {
        subjectId: ta.subjectId,
        academicTermId,
        studentEnrollment: { groupId: ta.groupId },
      },
      include: { studentEnrollment: { include: { student: true } } },
    });
  }

  /** Crea/actualiza los desempeños y valoraciones de convivencia de un estudiante. */
  async upsertConvivenciaEntry(data: {
    studentEnrollmentId: string;
    academicTermId: string;
    subjectId: string;
    text: string;
    items?: Array<{ text: string; level?: string | null }>;
    createdById?: string;
  }, institutionId: string) {
    // A-3: los tres identificadores vienen del cliente. Se exige que los tres
    // pertenezcan al tenant del actor ANTES de cualquier escritura.
    await this.assertOwnership(institutionId, {
      studentEnrollmentId: data.studentEnrollmentId,
      academicTermId: data.academicTermId,
      subjectId: data.subjectId,
    });
    const validLevels = new Set(['SUPERIOR', 'ALTO', 'BASICO', 'BAJO']);
    const items = Array.isArray(data.items)
      ? data.items
          .map(item => ({
            text: String(item?.text ?? '').trim(),
            level: validLevels.has(String(item?.level ?? '').toUpperCase())
              ? String(item?.level).toUpperCase()
              : null,
          }))
          .filter(item => item.text)
      : null;
    // El campo legado sigue siendo una representación legible de los desempeños.
    const text = items ? items.map(item => item.text).join('\n') : (data.text ?? '').trim();
    return this.prisma.convivenciaEntry.upsert({
      where: {
        studentEnrollmentId_academicTermId_subjectId: {
          studentEnrollmentId: data.studentEnrollmentId,
          academicTermId: data.academicTermId,
          subjectId: data.subjectId,
        },
      },
      update: { text, items: items as any, createdById: data.createdById },
      create: {
        institutionId,
        studentEnrollmentId: data.studentEnrollmentId,
        academicTermId: data.academicTermId,
        subjectId: data.subjectId,
        text,
        items: items as any,
        createdById: data.createdById,
      },
    });
  }

  // ============================================
  // VALORACIÓN POR IMPRESCINDIBLE (modo EVIDENCE)
  // ============================================

  /** Valoraciones por evidencia de todos los estudiantes del grupo de la asignación, para el período. */
  async getEvidenceValuationsByAssignment(teacherAssignmentId: string, academicTermId: string) {
    const ta = await this.prisma.teacherAssignment.findUnique({
      where: { id: teacherAssignmentId },
      select: { groupId: true },
    });
    if (!ta) throw new NotFoundException('Asignación docente no encontrada');
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { groupId: ta.groupId },
      select: { id: true },
    });
    const enrollmentIds = enrollments.map((e) => e.id);
    if (enrollmentIds.length === 0) return [];
    return this.prisma.studentEvidenceValuation.findMany({
      where: { studentEnrollmentId: { in: enrollmentIds }, academicTermId },
    });
  }

  /** Crea/actualiza la valoración de un imprescindible para un estudiante en un período. */
  async upsertEvidenceValuation(data: {
    studentEnrollmentId: string;
    achievementEvidenceId: string;
    academicTermId: string;
    performanceLevel: PerformanceLevel;
    observation?: string | null;
    createdById?: string;
  }, institutionId: string) {
    // A-1: los tres identificadores vienen del cliente. El aserto corre ANTES de la
    // guarda D-12/H-19 a propósito: si la evidencia fuese de otro tenant y estuviese
    // retirada, devolver el ConflictException revelaría que existe y en qué estado.
    // Con este orden, un recurso ajeno siempre responde NotFoundException.
    await this.assertOwnership(institutionId, {
      studentEnrollmentId: data.studentEnrollmentId,
      achievementEvidenceId: data.achievementEvidenceId,
      academicTermId: data.academicTermId,
    });

    // D-12 / H-19: una evidencia retirada no admite valoraciones nuevas ni
    // actualizaciones en los períodos desde los que fue retirada. Las valoraciones de
    // períodos anteriores siguen siendo editables porque allí la evidencia es vigente.
    const evidence = await this.prisma.achievementEvidence.findUnique({
      where: { id: data.achievementEvidenceId },
      select: { id: true, text: true, retiredFromTermId: true },
    });
    if (!evidence) throw new NotFoundException('Imprescindible no encontrado');
    const vigentes = await this.keepVigentes([evidence], data.academicTermId);
    if (vigentes.length === 0) {
      throw new ConflictException(
        `«${evidence.text}» fue retirado del catálogo y no admite valoraciones en este período. ` +
        'Las valoraciones de períodos anteriores se conservan intactas.',
      );
    }

    return this.prisma.studentEvidenceValuation.upsert({
      where: {
        studentEnrollmentId_achievementEvidenceId_academicTermId: {
          studentEnrollmentId: data.studentEnrollmentId,
          achievementEvidenceId: data.achievementEvidenceId,
          academicTermId: data.academicTermId,
        },
      },
      update: {
        performanceLevel: data.performanceLevel,
        observation: data.observation ?? null,
        createdById: data.createdById,
      },
      create: {
        institutionId,
        studentEnrollmentId: data.studentEnrollmentId,
        achievementEvidenceId: data.achievementEvidenceId,
        academicTermId: data.academicTermId,
        performanceLevel: data.performanceLevel,
        observation: data.observation ?? null,
        createdById: data.createdById,
      },
    });
  }

  /** Elimina la valoración de un imprescindible (cuando el docente la quita). */
  async deleteEvidenceValuation(
    studentEnrollmentId: string,
    achievementEvidenceId: string,
    academicTermId: string,
    institutionId: string,
  ) {
    // A-2: el índice único (studentEnrollmentId, achievementEvidenceId, academicTermId)
    // acota el borrado a UNA fila como máximo, pero sin este aserto bastaba un solo
    // identificador ajeno para borrar la valoración de otra institución.
    await this.assertOwnership(institutionId, {
      studentEnrollmentId,
      achievementEvidenceId,
      academicTermId,
    });
    await this.prisma.studentEvidenceValuation.deleteMany({
      where: { studentEnrollmentId, achievementEvidenceId, academicTermId },
    });
    return { success: true };
  }

  // ============================================
  // CATÁLOGO COMPARTIDO DE TRANSICIÓN (admin)
  // ============================================

  private async assertCatalogScope(data: {
    institutionId: string;
    gradeId: string;
    subjectId: string;
    academicYearId: string;
    academicTermId?: string | null;
  }) {
    const [grade, subject, academicYear, term] = await Promise.all([
      this.prisma.grade.findFirst({ where: { id: data.gradeId, institutionId: data.institutionId }, select: { id: true } }),
      this.prisma.subject.findFirst({ where: { id: data.subjectId, area: { institutionId: data.institutionId } }, select: { id: true, code: true, subjectType: true } }),
      this.prisma.academicYear.findFirst({ where: { id: data.academicYearId, institutionId: data.institutionId }, select: { id: true } }),
      data.academicTermId
        ? this.prisma.academicTerm.findFirst({ where: { id: data.academicTermId, academicYearId: data.academicYearId }, select: { id: true, order: true } })
        : Promise.resolve(null),
    ]);

    if (!grade || !subject || !academicYear) {
      throw new NotFoundException('El grado, dimensión o año académico no pertenece a la institución');
    }
    if (subject.subjectType !== 'PRESCHOOL_DIMENSION') {
      throw new BadRequestException('El catálogo compartido solo admite dimensiones de preescolar');
    }
    if (data.academicTermId && !term) {
      throw new BadRequestException('El período no pertenece al año académico seleccionado');
    }
    return { subject, term };
  }

  async getCatalogAchievements(data: {
    institutionId: string;
    gradeId: string;
    subjectId: string;
    academicYearId: string;
    academicTermId?: string;
  }) {
    await this.assertCatalogScope(data);
    return this.prisma.achievement.findMany({
      where: {
        institutionId: data.institutionId,
        gradeId: data.gradeId,
        subjectId: data.subjectId,
        academicYearId: data.academicYearId,
        // El catálogo de un período incluye TAMBIÉN los propósitos anuales
        // (academicTermId = null), que por definición aplican a todos los períodos.
        // Mismo criterio que el boletín (reports.service.ts, buildGroupReportCards),
        // que ya los incluye: tener dos filtros distintos sobre el mismo catálogo hacía
        // que el editor los ocultara justo al seleccionar período — y el retiro lógico
        // (D-12) EXIGE seleccionar período, así que un catálogo anual era irretirable.
        ...(data.academicTermId
          ? { OR: [{ academicTermId: data.academicTermId }, { academicTermId: null }] }
          : { academicTermId: null }),
        teacherAssignmentId: null,
        isPromotional: false,
      },
      orderBy: { orderNumber: 'asc' },
      include: { evidences: { orderBy: { orderNumber: 'asc' } }, levelDescriptors: true },
    });
  }

  async createCatalogAchievement(data: {
    institutionId: string;
    gradeId: string;
    subjectId: string;
    academicYearId: string;
    academicTermId?: string;
    baseDescription: string;
    evidences?: Array<{ text: string }>;
    levelDescriptors?: Array<{ levelCode: string; text: string }>;
  }) {
    const description = data.baseDescription?.trim();
    if (!description) throw new BadRequestException('El propósito es obligatorio');
    const { subject, term } = await this.assertCatalogScope(data);
    const scope = {
      gradeId: data.gradeId,
      subjectId: data.subjectId,
      academicYearId: data.academicYearId,
      academicTermId: data.academicTermId ?? null,
      teacherAssignmentId: null,
      isPromotional: false,
    };
    const last = await this.prisma.achievement.findFirst({
      where: scope,
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });
    const orderNumber = (last?.orderNumber ?? 0) + 1;
    const subjectCode = (subject.code || 'DIM').slice(0, 8).toUpperCase();
    const periodCode = term ? `P${term.order}` : 'ANUAL';
    const evidences = (data.evidences ?? []).filter((e) => e.text?.trim());
    const descriptors = (data.levelDescriptors ?? []).filter((d) => d.levelCode && d.text?.trim());

    return this.prisma.achievement.create({
      data: {
        institutionId: data.institutionId,
        code: `PROP-${subjectCode}-${periodCode}-${String(orderNumber).padStart(2, '0')}`,
        ...scope,
        orderNumber,
        achievementType: 'ACADEMIC',
        baseDescription: description,
        ...(evidences.length ? { evidences: { create: evidences.map((e, index) => ({ text: e.text.trim(), orderNumber: index + 1 })) } } : {}),
        ...(descriptors.length ? { levelDescriptors: { create: descriptors.map((d) => ({ levelCode: d.levelCode, text: d.text.trim() })) } } : {}),
      },
      include: { evidences: { orderBy: { orderNumber: 'asc' } }, levelDescriptors: true },
    });
  }

  private async assertCatalogWritable(achievementId: string, canManageCatalog: boolean) {
    if (canManageCatalog) return;
    const achievement = await this.prisma.achievement.findUnique({
      where: { id: achievementId },
      select: { gradeId: true, teacherAssignmentId: true },
    });
    if (!achievement) throw new NotFoundException('Propósito no encontrado');
    if (achievement.gradeId && !achievement.teacherAssignmentId) {
      throw new ForbiddenException('Los propósitos del catálogo de Transición solo los puede editar el administrador o coordinador');
    }
  }

  async getPromotionalAchievements(teacherAssignmentId: string) {
    const assignmentIds = await this.getAllAssignmentIds(teacherAssignmentId);
    return this.prisma.achievement.findMany({
      where: {
        teacherAssignmentId: { in: assignmentIds },
        isPromotional: true,
      },
      include: {
        studentAchievements: {
          include: {
            studentEnrollment: {
              include: {
                student: true,
              },
            },
          },
        },
      },
    });
  }

  async createAchievement(data: {
    teacherAssignmentId: string;
    academicTermId: string;
    orderNumber: number;
    baseDescription: string;
    isPromotional?: boolean;
    achievementType?: 'ACADEMIC' | 'ATTITUDINAL' | 'PROMOTIONAL';
    levelDescriptors?: Array<{ levelCode: string; text: string }>;
    evidences?: Array<{ text: string }>;
  }) {
    // Generate code automatically
    const assignment = await this.prisma.teacherAssignment.findUnique({
      where: { id: data.teacherAssignmentId },
      include: {
        subject: true,
        academicYear: true,
      },
    });

    const term = await this.prisma.academicTerm.findUnique({
      where: { id: data.academicTermId },
    });

    // Generate code: LOG-[SUBJECT_CODE]-P[PERIOD]-[ORDER]
    const subjectCode = assignment?.subject?.name?.substring(0, 3).toUpperCase() || 'XXX';
    const periodOrder = term?.order || 1;
    const typePrefix = data.isPromotional ? 'PROM' : (data.achievementType === 'ATTITUDINAL' ? 'ACT' : 'LOG');
    const code = `${typePrefix}-${subjectCode}-P${periodOrder}-${String(data.orderNumber).padStart(2, '0')}`;

    const ta = await this.prisma.teacherAssignment.findUnique({ where: { id: data.teacherAssignmentId }, select: { institutionId: true } });
    const descriptors = (data.levelDescriptors ?? []).filter((d) => d.levelCode && d.text?.trim());
    const evidences = (data.evidences ?? []).filter((e) => e.text?.trim());
    return this.prisma.achievement.create({
      data: {
        institutionId: ta!.institutionId,
        code,
        teacherAssignmentId: data.teacherAssignmentId,
        academicTermId: data.academicTermId,
        orderNumber: data.orderNumber,
        achievementType: data.achievementType ?? 'ACADEMIC',
        baseDescription: data.baseDescription,
        isPromotional: data.isPromotional ?? false,
        ...(descriptors.length > 0
          ? { levelDescriptors: { create: descriptors.map((d) => ({ levelCode: d.levelCode, text: d.text.trim() })) } }
          : {}),
        ...(evidences.length > 0
          ? { evidences: { create: evidences.map((e, i) => ({ text: e.text.trim(), orderNumber: i + 1 })) } }
          : {}),
      },
      include: { levelDescriptors: true, evidences: { orderBy: { orderNumber: 'asc' } } },
    });
  }

  async updateAchievement(id: string, data: { baseDescription: string; levelDescriptors?: Array<{ levelCode: string; text: string }>; evidences?: Array<{ id?: string; text: string }> }, canManageCatalog = true) {
    await this.assertCatalogWritable(id, canManageCatalog);
    // Reemplazo total de descriptores solo si el cliente los envía (undefined = no tocar).
    // Los descriptores NO llevan histórico colgando (nadie los referencia), así que el
    // reemplazo total sigue siendo seguro aquí.
    if (data.levelDescriptors !== undefined) {
      const descriptors = data.levelDescriptors.filter((d) => d.levelCode && d.text?.trim());
      await this.prisma.achievementLevelDescriptor.deleteMany({ where: { achievementId: id } });
      if (descriptors.length > 0) {
        await this.prisma.achievementLevelDescriptor.createMany({
          data: descriptors.map((d) => ({ achievementId: id, levelCode: d.levelCode, text: d.text.trim() })),
          skipDuplicates: true,
        });
      }
    }
    // Evidencias: reconciliación por id (undefined = no tocar). Ver reconcileEvidences.
    if (data.evidences !== undefined) {
      await this.reconcileEvidences(id, data.evidences);
    }
    return this.prisma.achievement.update({
      where: { id },
      data: { baseDescription: data.baseDescription },
      include: { levelDescriptors: true, evidences: { orderBy: { orderNumber: 'asc' } } },
    });
  }

  /**
   * Reconciliación de evidencias por id.
   *
   * REGLA: editar el texto de una evidencia NO es crear una evidencia nueva.
   * El id debe sobrevivir a la edición porque `StudentEvidenceValuation` lo referencia
   * por escalar (sin FK): si el id cambia, las valoraciones históricas del docente
   * quedan huérfanas e invisibles, sin error y sin forma de recuperarlas.
   *
   * Antes esto era `deleteMany` + `createMany`, que regeneraba TODOS los ids en cada
   * guardado del catálogo — bastaba corregir una tilde para perder el período completo.
   *
   *   item con id conocido → UPDATE (texto y orden), conserva el id
   *   item sin id          → se empareja por texto exacto con una evidencia existente
   *                          aún no emparejada (tolerancia a clientes que no envían id);
   *                          si no hay coincidencia → CREATE
   *   existente ausente    → baja SOLO si no tiene valoraciones registradas.
   *                          Si las tiene, se aborta toda la operación: borrarla
   *                          destruiría historia académica.
   *
   * El plan se calcula completo ANTES de escribir, y se aplica en una transacción,
   * para que un guardado bloqueado no quede aplicado a medias.
   */
  private async reconcileEvidences(achievementId: string, incoming: Array<{ id?: string; text: string }>) {
    const items = incoming
      .filter((e) => e.text?.trim())
      .map((e) => ({ id: e.id, text: e.text.trim() }));

    const existing = await this.prisma.achievementEvidence.findMany({
      where: { achievementId },
      select: { id: true, text: true, orderNumber: true },
      orderBy: { orderNumber: 'asc' },
    });
    const existingById = new Map(existing.map((e) => [e.id, e]));

    const matchedIds = new Set<string>();
    const toUpdate: Array<{ id: string; text: string; orderNumber: number }> = [];
    const toCreate: Array<{ text: string; orderNumber: number }> = [];

    items.forEach((item, index) => {
      const orderNumber = index + 1;
      // 1) Emparejar por id explícito (camino normal).
      if (item.id && existingById.has(item.id) && !matchedIds.has(item.id)) {
        matchedIds.add(item.id);
        const prev = existingById.get(item.id)!;
        if (prev.text !== item.text || prev.orderNumber !== orderNumber) {
          toUpdate.push({ id: item.id, text: item.text, orderNumber });
        }
        return;
      }
      // 2) Sin id: emparejar por texto exacto con una existente aún libre. Evita que un
      //    cliente que no envía ids duplique el catálogo y provoque bajas masivas.
      const byText = existing.find((e) => !matchedIds.has(e.id) && e.text === item.text);
      if (byText) {
        matchedIds.add(byText.id);
        if (byText.orderNumber !== orderNumber) {
          toUpdate.push({ id: byText.id, text: item.text, orderNumber });
        }
        return;
      }
      // 3) Realmente nueva.
      toCreate.push({ text: item.text, orderNumber });
    });

    const removed = existing.filter((e) => !matchedIds.has(e.id));

    // Guarda de integridad: nunca borrar una evidencia con valoraciones registradas.
    if (removed.length > 0) {
      const valuations = await this.prisma.studentEvidenceValuation.findMany({
        where: { achievementEvidenceId: { in: removed.map((e) => e.id) } },
        select: { achievementEvidenceId: true },
      });
      if (valuations.length > 0) {
        const countById = new Map<string, number>();
        for (const v of valuations) {
          countById.set(v.achievementEvidenceId, (countById.get(v.achievementEvidenceId) ?? 0) + 1);
        }
        const detail = removed
          .filter((e) => countById.has(e.id))
          .map((e) => `«${e.text}» (${countById.get(e.id)} valoración(es))`)
          .join(', ');
        throw new ConflictException(
          `No se puede quitar del catálogo: ${detail}. ` +
          'Ya tiene valoraciones registradas por los docentes y eliminarla borraría esa historia académica. ' +
          'Edite su texto en lugar de quitarla, o solicite su retiro explícito.',
        );
      }
    }

    const ops: any[] = [
      ...toUpdate.map((u) =>
        this.prisma.achievementEvidence.update({
          where: { id: u.id },
          data: { text: u.text, orderNumber: u.orderNumber },
        }),
      ),
      ...toCreate.map((c) =>
        this.prisma.achievementEvidence.create({
          data: { achievementId, text: c.text, orderNumber: c.orderNumber },
        }),
      ),
    ];
    if (removed.length > 0) {
      ops.push(
        this.prisma.achievementEvidence.deleteMany({ where: { id: { in: removed.map((e) => e.id) } } }),
      );
    }
    if (ops.length > 0) {
      await this.prisma.$transaction(ops);
    }
  }

  /**
   * Borra un propósito/aprendizaje completo.
   *
   * Guarda de integridad (F2): borrar el propósito **cascadea** a sus
   * `AchievementEvidence`. Si alguno tiene valoraciones, la FK
   * `StudentEvidenceValuation_achievementEvidenceId_fkey` (ON DELETE RESTRICT)
   * aborta la operación con un `23503` crudo que el usuario vería como un 500.
   *
   * Aquí se detecta antes: ni siquiera se intenta el DELETE. La FK sigue siendo la
   * última barrera —si esta guarda no viera la valoración, la base seguiría
   * rechazando—, pero deja de ser la primera.
   *
   * Basta UNA valoración en UN imprescindible para proteger el propósito entero:
   * no existe borrado parcial. El conteo no se limita al período en curso.
   *
   * Guarda de historia académica (F2): el propósito cascadea además a
   * `StudentAchievement` —nivel de desempeño, texto y juicio aprobados por el
   * docente, observación del boletín—. Ahí la base de datos **no** opone resistencia:
   * su FK es `Cascade`, así que sin esta guarda la pérdida sería silenciosa.
   *
   * Guarda de contenido actitudinal (F2): `AttitudinalAchievement` también cascadea
   * y también guarda texto redactado por el docente que llega al boletín. No lleva
   * `studentEnrollmentId` —no es historia por estudiante—, pero se pierde igual.
   *
   * Las tres se comprueban ANTES de cualquier operación destructiva, en este orden:
   * permisos → historia académica → valoraciones por imprescindible → actitudinal.
   */
  async deleteAchievement(id: string, canManageCatalog = true) {
    await this.assertCatalogWritable(id, canManageCatalog);

    const academicHistory = await this.prisma.studentAchievement.count({
      where: { achievementId: id },
    });
    if (academicHistory > 0) {
      const achievement = await this.prisma.achievement.findUnique({
        where: { id },
        select: { baseDescription: true },
      });
      throw new ConflictException(
        `No se puede eliminar este propósito «${achievement?.baseDescription ?? ''}»: ` +
        `tiene ${academicHistory} registro(s) de historia académica. ` +
        'Eliminarlo borraría también los desempeños, textos y juicios ya aprobados por los ' +
        'docentes. Edite su texto en lugar de eliminarlo.',
      );
    }

    const evidences = await this.prisma.achievementEvidence.findMany({
      where: { achievementId: id },
      select: { id: true, text: true },
    });

    if (evidences.length > 0) {
      const valuations = await this.prisma.studentEvidenceValuation.findMany({
        where: { achievementEvidenceId: { in: evidences.map((e) => e.id) } },
        select: { achievementEvidenceId: true },
      });
      if (valuations.length > 0) {
        const countById = new Map<string, number>();
        for (const v of valuations) {
          countById.set(v.achievementEvidenceId, (countById.get(v.achievementEvidenceId) ?? 0) + 1);
        }
        const detail = evidences
          .filter((e) => countById.has(e.id))
          .map((e) => `«${e.text}» (${countById.get(e.id)} valoración(es))`)
          .join(', ');
        throw new ConflictException(
          `No se puede eliminar este propósito: ${detail}. ` +
          'Eliminarlo borraría también sus imprescindibles y con ellos la historia académica ' +
          'ya registrada por los docentes. Edite su texto en lugar de eliminarlo, o retire los ' +
          'imprescindibles que ya no apliquen.',
        );
      }
    }

    const attitudinal = await this.prisma.attitudinalAchievement.count({
      where: { achievementId: id },
    });
    if (attitudinal > 0) {
      const achievement = await this.prisma.achievement.findUnique({
        where: { id },
        select: { baseDescription: true },
      });
      throw new ConflictException(
        `No se puede eliminar este propósito «${achievement?.baseDescription ?? ''}»: ` +
        `tiene ${attitudinal} registro(s) de contenido actitudinal. ` +
        'Eliminarlo borraría también el texto redactado por el docente. ' +
        'Edite su texto en lugar de eliminarlo.',
      );
    }

    return this.prisma.achievement.delete({
      where: { id },
    });
  }

  // ============================================
  // EVIDENCIAS DE APRENDIZAJE
  // ============================================

  async createEvidence(achievementId: string, text: string, canManageCatalog = true) {
    await this.assertCatalogWritable(achievementId, canManageCatalog);
    const clean = text?.trim();
    if (!clean) throw new BadRequestException('El texto de la evidencia es obligatorio');
    const last = await this.prisma.achievementEvidence.findFirst({
      where: { achievementId },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });
    return this.prisma.achievementEvidence.create({
      data: { achievementId, text: clean, orderNumber: (last?.orderNumber ?? 0) + 1 },
    });
  }

  /**
   * Corrección de contenido. NO cambia el estado de retiro: para eso existen
   * `retireEvidence` / `reactivateEvidence` (D-12). `isActive` ya no se acepta.
   */
  async updateEvidence(id: string, data: { text?: string }, canManageCatalog = true) {
    const evidence = await this.prisma.achievementEvidence.findUnique({ where: { id }, select: { achievementId: true } });
    if (!evidence) throw new NotFoundException('Imprescindible no encontrado');
    await this.assertCatalogWritable(evidence.achievementId, canManageCatalog);
    const updateData: any = {};
    if (data.text !== undefined) {
      const clean = data.text.trim();
      if (!clean) throw new BadRequestException('El texto de la evidencia es obligatorio');
      updateData.text = clean;
    }
    return this.prisma.achievementEvidence.update({ where: { id }, data: updateData });
  }

  // ============================================
  // RETIRO Y REACTIVACIÓN (D-12)
  // ============================================

  /** Contexto común de retiro/reactivación: evidencia + aprendizaje + año académico. */
  private async loadEvidenceContext(evidenceId: string, canManageCatalog: boolean) {
    const evidence = await this.prisma.achievementEvidence.findUnique({
      where: { id: evidenceId },
      select: { id: true, text: true, achievementId: true, retiredFromTermId: true, retiredAt: true },
    });
    if (!evidence) throw new NotFoundException('Imprescindible no encontrado');
    await this.assertCatalogWritable(evidence.achievementId, canManageCatalog);

    const achievement = await this.prisma.achievement.findUnique({
      where: { id: evidence.achievementId },
      select: {
        id: true,
        institutionId: true,
        baseDescription: true,
        academicYearId: true,
        teacherAssignment: { select: { academicYearId: true } },
      },
    });
    if (!achievement) throw new NotFoundException('Aprendizaje no encontrado');

    const yearId = achievement.academicYearId ?? achievement.teacherAssignment?.academicYearId ?? null;
    return { evidence, achievement, yearId };
  }

  /**
   * Auditoría E-5. Nunca puede impedir la operación de catálogo.
   *
   * El retiro ya está persistido cuando se llama a este método: si la auditoría
   * fallara y la excepción se propagara, el cliente recibiría un error mientras el
   * cambio quedó aplicado, dejando estado y respuesta divergentes. Por eso el fallo
   * se atrapa aquí y se registra en el log, en lugar de confiar en que el servicio
   * de auditoría trague siempre sus propios errores.
   *
   * No se silencia: queda constancia en el log del sistema.
   */
  private async auditEvidenceStateChange(params: {
    institutionId: string;
    academicTermId: string | null;
    evidence: { id: string; text: string };
    achievement: { id: string; baseDescription: string };
    operation: 'RETIRE' | 'REACTIVATE';
    reason?: string | null;
    valuationCount: number;
    previous: Record<string, unknown>;
    next: Record<string, unknown>;
    actor?: GradeAuditActor;
  }) {
    try {
      await this.recordEvidenceAudit(params);
    } catch (err: any) {
      this.logger.error(
        `No se pudo auditar ${params.operation} del imprescindible ${params.evidence.id} ` +
        `(aprendizaje ${params.achievement.id}): ${err?.message || err}. ` +
        'La operación de catálogo SÍ se aplicó.',
      );
    }
  }

  private async recordEvidenceAudit(params: {
    institutionId: string;
    academicTermId: string | null;
    evidence: { id: string; text: string };
    achievement: { id: string; baseDescription: string };
    operation: 'RETIRE' | 'REACTIVATE';
    reason?: string | null;
    valuationCount: number;
    previous: Record<string, unknown>;
    next: Record<string, unknown>;
    actor?: GradeAuditActor;
  }) {
    await this.gradeAudit?.record(
      {
        institutionId: params.institutionId,
        source: EVIDENCE_AUDIT_SOURCE,
        action: 'UPDATE',
        academicTermId: params.academicTermId,
        activityName: params.evidence.text,
        previousValue: {
          operation: params.operation,
          evidenceId: params.evidence.id,
          achievementId: params.achievement.id,
          achievement: params.achievement.baseDescription,
          valuationCount: params.valuationCount,
          ...params.previous,
        },
        newValue: {
          operation: params.operation,
          evidenceId: params.evidence.id,
          reason: params.reason ?? null,
          ...params.next,
        },
      },
      params.actor,
    );
  }

  /**
   * Retira una evidencia del catálogo desde un período concreto (D-12).
   *
   * El período se recibe EXPLÍCITAMENTE: el modelo no tiene ningún concepto de
   * "período en curso" y toda la aplicación trabaja con un período seleccionado por
   * el usuario. No se infiere por fechas.
   *
   * Conserva el id, el registro y todas las valoraciones. No toca ninguna
   * `StudentEvidenceValuation`, ni ningún snapshot.
   */
  async retireEvidence(
    evidenceId: string,
    data: { academicTermId: string; reason?: string },
    actor?: GradeAuditActor,
    canManageCatalog = true,
  ) {
    const { evidence, achievement, yearId } = await this.loadEvidenceContext(evidenceId, canManageCatalog);

    const term = await this.prisma.academicTerm.findUnique({
      where: { id: data.academicTermId },
      select: { id: true, name: true, status: true, order: true, academicYearId: true },
    });
    if (!term) throw new NotFoundException('Período académico no encontrado');

    // Mismo contexto académico: no se retira apuntando al período de otro año.
    if (yearId && term.academicYearId !== yearId) {
      throw new BadRequestException(
        'El período indicado no pertenece al año académico de este aprendizaje.',
      );
    }

    // No se puede alterar retrospectivamente una estructura ya cerrada o finalizada.
    if (term.status !== 'OPEN') {
      throw new ConflictException(
        `No se puede retirar desde «${term.name}»: el período está en estado ${term.status}. ` +
        'Retirar desde un período cerrado o finalizado eliminaría obligaciones ya consolidadas. ' +
        'Elija un período abierto.',
      );
    }

    const valuationCount = await this.prisma.studentEvidenceValuation.count({
      where: { achievementEvidenceId: evidenceId },
    });

    const updated = await this.prisma.achievementEvidence.update({
      where: { id: evidenceId },
      data: { retiredFromTermId: term.id, retiredAt: new Date() },
    });

    await this.auditEvidenceStateChange({
      institutionId: achievement.institutionId,
      academicTermId: term.id,
      evidence,
      achievement,
      operation: 'RETIRE',
      reason: data.reason,
      valuationCount,
      previous: { retiredFromTermId: evidence.retiredFromTermId, retiredAt: evidence.retiredAt },
      next: { retiredFromTermId: term.id, retiredFromTermName: term.name, retiredAt: updated.retiredAt },
      actor,
    });

    return updated;
  }

  /**
   * Reactiva una evidencia retirada (D-12). Efecto exclusivamente prospectivo:
   * no modifica valoraciones históricas ni snapshots, y no reescribe el pasado.
   */
  async reactivateEvidence(
    evidenceId: string,
    data: { reason?: string } = {},
    actor?: GradeAuditActor,
    canManageCatalog = true,
  ) {
    const { evidence, achievement } = await this.loadEvidenceContext(evidenceId, canManageCatalog);

    if (!evidence.retiredFromTermId) {
      throw new BadRequestException('El imprescindible ya está activo.');
    }

    // El período desde el que se retiró debe seguir siendo modificable: reactivar
    // repondría la obligación en un período que ya fue cerrado o finalizado.
    const retiredTerm = await this.prisma.academicTerm.findUnique({
      where: { id: evidence.retiredFromTermId },
      select: { id: true, name: true, status: true },
    });
    if (retiredTerm && retiredTerm.status !== 'OPEN') {
      throw new ConflictException(
        `No se puede reactivar: fue retirado desde «${retiredTerm.name}», que está en estado ${retiredTerm.status}. ` +
        'Reactivarlo repondría una obligación en un período ya consolidado.',
      );
    }

    const valuationCount = await this.prisma.studentEvidenceValuation.count({
      where: { achievementEvidenceId: evidenceId },
    });

    const updated = await this.prisma.achievementEvidence.update({
      where: { id: evidenceId },
      data: { retiredFromTermId: null, retiredAt: null },
    });

    await this.auditEvidenceStateChange({
      institutionId: achievement.institutionId,
      academicTermId: evidence.retiredFromTermId,
      evidence,
      achievement,
      operation: 'REACTIVATE',
      reason: data.reason,
      valuationCount,
      previous: { retiredFromTermId: evidence.retiredFromTermId, retiredAt: evidence.retiredAt },
      next: { retiredFromTermId: null, retiredAt: null },
      actor,
    });

    return updated;
  }

  /**
   * Baja de una evidencia del catálogo.
   *
   * Misma guarda de integridad que `reconcileEvidences`: una evidencia que ya tiene
   * valoraciones académicas NO puede eliminarse físicamente, porque
   * `StudentEvidenceValuation.achievementEvidenceId` es un escalar sin FK y las
   * valoraciones quedarían huérfanas e invisibles.
   *
   * El conteo NO se limita al período en curso: una valoración de cualquier período
   * anterior es historia académica y basta para bloquear la eliminación.
   *
   * D-12: retiro y eliminación son ORTOGONALES. Para sacar del catálogo una evidencia
   * ya evaluada existe `retireEvidence` (retiro lógico y prospectivo). El estado de
   * retiro NO sustituye ni debilita esta guarda: una evidencia retirada que tenga
   * valoraciones sigue siendo indestructible.
   */
  async deleteEvidence(id: string, canManageCatalog = true) {
    const evidence = await this.prisma.achievementEvidence.findUnique({ where: { id }, select: { achievementId: true, text: true } });
    if (!evidence) throw new NotFoundException('Imprescindible no encontrado');
    await this.assertCatalogWritable(evidence.achievementId, canManageCatalog);

    const valuations = await this.prisma.studentEvidenceValuation.count({
      where: { achievementEvidenceId: id },
    });
    if (valuations > 0) {
      throw new ConflictException(
        `No se puede eliminar «${evidence.text}»: ya tiene ${valuations} valoración(es) académica(s) registrada(s) ` +
        'por los docentes, en este período o en períodos anteriores. Eliminarla borraría esa historia. ' +
        'Puede editar su texto; para retirarla del catálogo se requiere una decisión institucional.',
      );
    }

    return this.prisma.achievementEvidence.delete({ where: { id } });
  }

  /** Reordena las evidencias de un aprendizaje según el arreglo de IDs recibido. */
  async reorderEvidences(achievementId: string, orderedIds: string[], canManageCatalog = true) {
    await this.assertCatalogWritable(achievementId, canManageCatalog);
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.achievementEvidence.updateMany({
          where: { id, achievementId },
          data: { orderNumber: index + 1 },
        }),
      ),
    );
    return this.prisma.achievementEvidence.findMany({
      where: { achievementId },
      orderBy: { orderNumber: 'asc' },
    });
  }

  /** Duplica un aprendizaje con sus evidencias y descriptores de nivel (sin las valoraciones de estudiantes). */
  async duplicateAchievement(id: string) {
    const source = await this.prisma.achievement.findUnique({
      where: { id },
      include: { levelDescriptors: true, evidences: { orderBy: { orderNumber: 'asc' } } },
    });
    if (!source) throw new NotFoundException('Aprendizaje no encontrado');

    // Siguiente orderNumber disponible para la misma asignación/período/tipo promocional.
    const last = await this.prisma.achievement.findFirst({
      where: {
        teacherAssignmentId: source.teacherAssignmentId,
        academicTermId: source.academicTermId,
        isPromotional: source.isPromotional,
      },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });
    const nextOrder = (last?.orderNumber ?? 0) + 1;
    const code = `${source.code}-COPIA-${nextOrder}`;

    return this.prisma.achievement.create({
      data: {
        institutionId: source.institutionId,
        code,
        teacherAssignmentId: source.teacherAssignmentId,
        academicTermId: source.academicTermId,
        orderNumber: nextOrder,
        achievementType: source.achievementType,
        baseDescription: source.baseDescription,
        isPromotional: source.isPromotional,
        ...(source.levelDescriptors.length > 0
          ? { levelDescriptors: { create: source.levelDescriptors.map((d) => ({ levelCode: d.levelCode, text: d.text })) } }
          : {}),
        // D-12: una copia nace SIEMPRE activa. No se arrastra el estado de retiro del
        // original: retirar es una decisión sobre un objeto concreto, no sobre su texto.
        ...(source.evidences.length > 0
          ? { evidences: { create: source.evidences.map((e) => ({ text: e.text, orderNumber: e.orderNumber })) } }
          : {}),
      },
      include: { levelDescriptors: true, evidences: { orderBy: { orderNumber: 'asc' } } },
    });
  }

  // ============================================
  // LOGROS ACTITUDINALES
  // ============================================

  async getAttitudinalAchievements(teacherAssignmentId: string, academicTermId: string) {
    const assignmentIds = await this.getAllAssignmentIds(teacherAssignmentId);
    return this.prisma.attitudinalAchievement.findMany({
      where: {
        teacherAssignmentId: { in: assignmentIds },
        academicTermId,
      },
      include: {
        achievement: true,
      },
    });
  }

  async upsertAttitudinalAchievement(data: {
    teacherAssignmentId: string;
    academicTermId: string;
    achievementId?: string; // null = general per period
    description: string;
  }) {
    // Check if exists
    const existing = await this.prisma.attitudinalAchievement.findFirst({
      where: {
        teacherAssignmentId: data.teacherAssignmentId,
        academicTermId: data.academicTermId,
        achievementId: data.achievementId ?? null,
      },
    });

    if (existing) {
      return this.prisma.attitudinalAchievement.update({
        where: { id: existing.id },
        data: { description: data.description },
      });
    }

    const ta2 = await this.prisma.teacherAssignment.findUnique({ where: { id: data.teacherAssignmentId }, select: { institutionId: true } });
    return this.prisma.attitudinalAchievement.create({
      data: {
        institutionId: ta2!.institutionId,
        teacherAssignmentId: data.teacherAssignmentId,
        academicTermId: data.academicTermId,
        achievementId: data.achievementId,
        description: data.description,
      },
    });
  }

  // ============================================
  // LOGROS DE ESTUDIANTES
  // ============================================

  async getStudentAchievements(achievementId: string) {
    return this.prisma.studentAchievement.findMany({
      where: { achievementId },
      include: {
        studentEnrollment: {
          include: {
            student: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async getStudentAchievementsByEnrollment(studentEnrollmentId: string, academicTermId?: string) {
    const whereClause: any = { studentEnrollmentId };
    
    if (academicTermId) {
      whereClause.academicTermId = academicTermId;
    }

    return this.prisma.studentAchievement.findMany({
      where: whereClause,
      include: {
        achievement: {
          include: {
            teacherAssignment: {
              include: {
                subject: true,
              },
            },
          },
        },
      },
    });
  }

  async generateStudentAchievementSuggestion(
    achievementId: string,
    studentEnrollmentId: string,
    performanceLevel: 'BAJO' | 'BASICO' | 'ALTO' | 'SUPERIOR',
    institutionId: string,
  ) {
    // Get the base achievement
    const achievement = await this.prisma.achievement.findUnique({
      where: { id: achievementId },
    });

    if (!achievement) {
      throw new NotFoundException('Logro no encontrado');
    }

    // Get value judgment template
    const config = await this.prisma.achievementConfig.findUnique({
      where: { institutionId },
      include: {
        valueJudgmentTemplates: {
          where: { level: performanceLevel, isActive: true },
        },
      },
    });

    // Generate suggested text based on performance level
    const baseText = achievement.baseDescription;
    let suggestedText = baseText;

    // Modify text based on performance level
    switch (performanceLevel) {
      case 'BAJO':
        suggestedText = `Presenta dificultades en: ${baseText.toLowerCase()}`;
        break;
      case 'BASICO':
        suggestedText = `Desarrolla parcialmente: ${baseText.toLowerCase()}`;
        break;
      case 'ALTO':
      case 'SUPERIOR':
        suggestedText = baseText; // Keep original for high performers
        break;
    }

    // Get judgment template
    const judgmentTemplate = config?.valueJudgmentTemplates?.[0]?.template || '';

    return {
      suggestedText,
      suggestedJudgment: judgmentTemplate,
    };
  }

  async updateStudentObservation(id: string, observation: string) {
    return this.prisma.studentAchievement.update({
      where: { id },
      data: { observation },
    });
  }

  async upsertStudentAchievement(data: {
    studentEnrollmentId: string;
    achievementId: string;
    academicTermId?: string; // período de la valoración (para aprendizajes anuales/compartidos)
    performanceLevel: 'BAJO' | 'BASICO' | 'ALTO' | 'SUPERIOR';
    suggestedText?: string;
    approvedText?: string;
    isTextApproved?: boolean;
    suggestedJudgment?: string;
    approvedJudgment?: string;
    isJudgmentApproved?: boolean;
    attitudinalText?: string;
    observation?: string;
    approvedById?: string;
  }) {
    // Resolver el período de la valoración: explícito, o el del aprendizaje (por-período).
    let academicTermId = data.academicTermId ?? null;
    if (!academicTermId) {
      const ach = await this.prisma.achievement.findUnique({
        where: { id: data.achievementId },
        select: { academicTermId: true },
      });
      academicTermId = ach?.academicTermId ?? null;
    }
    if (!academicTermId) {
      throw new BadRequestException('El período de la valoración es obligatorio para aprendizajes anuales o compartidos');
    }

    const existing = await this.prisma.studentAchievement.findFirst({
      where: {
        studentEnrollmentId: data.studentEnrollmentId,
        achievementId: data.achievementId,
        academicTermId,
      },
    });

    const updateData: any = {
      performanceLevel: data.performanceLevel,
    };

    if (data.suggestedText !== undefined) updateData.suggestedText = data.suggestedText;
    if (data.approvedText !== undefined) updateData.approvedText = data.approvedText;
    if (data.isTextApproved !== undefined) updateData.isTextApproved = data.isTextApproved;
    if (data.suggestedJudgment !== undefined) updateData.suggestedJudgment = data.suggestedJudgment;
    if (data.approvedJudgment !== undefined) updateData.approvedJudgment = data.approvedJudgment;
    if (data.isJudgmentApproved !== undefined) updateData.isJudgmentApproved = data.isJudgmentApproved;
    if (data.attitudinalText !== undefined) updateData.attitudinalText = data.attitudinalText;
    if (data.observation !== undefined) updateData.observation = data.observation;

    // If approving, set approval metadata
    if (data.isTextApproved && data.isJudgmentApproved && data.approvedById) {
      updateData.approvedAt = new Date();
      updateData.approvedById = data.approvedById;
    }

    if (existing) {
      return this.prisma.studentAchievement.update({
        where: { id: existing.id },
        data: updateData,
      });
    }

    const enr = await this.prisma.studentEnrollment.findUnique({ where: { id: data.studentEnrollmentId }, select: { institutionId: true } });
    return this.prisma.studentAchievement.create({
      data: {
        institutionId: enr!.institutionId,
        studentEnrollmentId: data.studentEnrollmentId,
        achievementId: data.achievementId,
        academicTermId,
        performanceLevel: data.performanceLevel,
        suggestedText: data.suggestedText,
        approvedText: data.approvedText,
        isTextApproved: data.isTextApproved ?? false,
        suggestedJudgment: data.suggestedJudgment,
        approvedJudgment: data.approvedJudgment,
        isJudgmentApproved: data.isJudgmentApproved ?? false,
        attitudinalText: data.attitudinalText,
      },
    });
  }

  async approveStudentAchievement(
    id: string,
    approvedById: string,
    data: {
      approvedText: string;
      approvedJudgment?: string;
    },
  ) {
    return this.prisma.studentAchievement.update({
      where: { id },
      data: {
        approvedText: data.approvedText,
        isTextApproved: true,
        approvedJudgment: data.approvedJudgment,
        isJudgmentApproved: !!data.approvedJudgment,
        approvedAt: new Date(),
        approvedById,
      },
    });
  }

  // ============================================
  // BULK OPERATIONS
  // ============================================

  async bulkGenerateSuggestions(
    achievementId: string,
    institutionId: string,
    studentGrades: Array<{
      studentEnrollmentId: string;
      finalGrade: number;
    }>,
    academicTermId?: string,
  ) {
    // Get performance scale
    const scales = await this.prisma.performanceScale.findMany({
      where: { institutionId },
      orderBy: { minScore: 'asc' },
    });

    const results = await Promise.all(
      studentGrades.map(async (sg) => {
        // Determine performance level from grade
        const level = this.getPerformanceLevelFromGrade(sg.finalGrade, scales);
        
        // Generate suggestion
        const suggestion = await this.generateStudentAchievementSuggestion(
          achievementId,
          sg.studentEnrollmentId,
          level,
          institutionId,
        );

        // Save to database
        return this.upsertStudentAchievement({
          studentEnrollmentId: sg.studentEnrollmentId,
          achievementId,
          academicTermId,
          performanceLevel: level,
          suggestedText: suggestion.suggestedText,
          suggestedJudgment: suggestion.suggestedJudgment,
        });
      }),
    );

    return results;
  }

  private getPerformanceLevelFromGrade(
    grade: number,
    scales: Array<{ level: string; minScore: any; maxScore: any }>,
  ): 'BAJO' | 'BASICO' | 'ALTO' | 'SUPERIOR' {
    for (const scale of scales) {
      const min = Number(scale.minScore);
      const max = Number(scale.maxScore);
      if (grade >= min && grade <= max) {
        return scale.level as 'BAJO' | 'BASICO' | 'ALTO' | 'SUPERIOR';
      }
    }
    // Default to BAJO if no match
    return 'BAJO';
  }

  // ============================================
  // BULK ASSIGN & AUTO-FILL OBSERVATION
  // ============================================

  async bulkAssignAchievement(
    achievementId: string,
    studentEnrollmentIds: string[],
    institutionId: string,
    academicTermId?: string,
  ) {
    // Get performance scales for the institution
    const scales = await this.prisma.performanceScale.findMany({
      where: { institutionId },
      orderBy: { minScore: 'asc' },
    });

    // Get the achievement to know its assignment/term for fetching grades
    const achievement = await this.prisma.achievement.findUnique({
      where: { id: achievementId },
      include: { teacherAssignment: true },
    });

    if (!achievement) {
      throw new NotFoundException('Logro no encontrado');
    }
    const valuationTermId = academicTermId ?? achievement.academicTermId;
    if (!valuationTermId) {
      throw new BadRequestException('El período de la valoración es obligatorio para aprendizajes anuales o compartidos');
    }

    // Get existing final grades for these students (solo aplica a aprendizajes por-período
    // ligados a una asignación/asignatura; los aprendizajes anuales/compartidos no usan nota).
    const subjectId = achievement.teacherAssignment?.subjectId ?? achievement.subjectId ?? null;
    const gradeMap = new Map<string, number>();
    if (achievement.academicTermId && subjectId) {
      const finalGrades = await this.prisma.periodFinalGrade.findMany({
        where: {
          studentEnrollment: { id: { in: studentEnrollmentIds } },
          academicTermId: achievement.academicTermId,
          subjectId,
        },
        include: { studentEnrollment: true },
      });
      for (const fg of finalGrades) {
        gradeMap.set(fg.studentEnrollmentId, Number(fg.finalScore));
      }
    }

    const results = await Promise.all(
      studentEnrollmentIds.map(async (enrollmentId) => {
        const grade = gradeMap.get(enrollmentId) || 0;
        const level = this.getPerformanceLevelFromGrade(grade, scales);

        return this.upsertStudentAchievement({
          studentEnrollmentId: enrollmentId,
          achievementId,
          academicTermId: valuationTermId,
          performanceLevel: level as any,
        });
      }),
    );

    return results;
  }

  async autoFillObservations(
    achievementId: string,
    institutionId: string,
  ) {
    // Get observation templates for this institution
    const config = await this.prisma.achievementConfig.findUnique({
      where: { institutionId },
      include: {
        observationTemplates: {
          where: { isActive: true },
        },
      },
    });

    const templateMap = new Map<string, string>();
    for (const t of config?.observationTemplates || []) {
      templateMap.set(t.level, t.template);
    }

    // Get all student achievements for this achievement
    const studentAchievements = await this.prisma.studentAchievement.findMany({
      where: { achievementId },
    });

    const results = await Promise.all(
      studentAchievements.map(async (sa) => {
        const template = templateMap.get(sa.performanceLevel);
        if (template) {
          return this.prisma.studentAchievement.update({
            where: { id: sa.id },
            data: { observation: template },
          });
        }
        return sa;
      }),
    );

    return results;
  }

  // ============================================
  // VALIDATION
  // ============================================

  async validatePeriodAchievements(
    teacherAssignmentId: string,
    academicTermId: string,
    requiredCount: number,
  ) {
    const assignmentIds = await this.getAllAssignmentIds(teacherAssignmentId);
    const achievements = await this.prisma.achievement.findMany({
      where: {
        teacherAssignmentId: { in: assignmentIds },
        academicTermId,
        isPromotional: false,
      },
    });

    const missingCount = requiredCount - achievements.length;
    
    return {
      isComplete: missingCount <= 0,
      currentCount: achievements.length,
      requiredCount,
      missingCount: Math.max(0, missingCount),
    };
  }

  async getUnapprovedStudentAchievements(teacherAssignmentId: string, academicTermId: string) {
    const assignmentIds = await this.getAllAssignmentIds(teacherAssignmentId);
    return this.prisma.studentAchievement.findMany({
      where: {
        achievement: {
          teacherAssignmentId: { in: assignmentIds },
          academicTermId,
        },
        OR: [
          { isTextApproved: false },
          { isJudgmentApproved: false },
        ],
      },
      include: {
        studentEnrollment: {
          include: {
            student: true,
          },
        },
        achievement: true,
      },
    });
  }
}
