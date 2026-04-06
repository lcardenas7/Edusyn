import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportsService } from '../reports/reports.service';
import { InstitutionContextService } from '../institution-context/institution-context.service';
import { isFailing } from '../../engines/academic-rules.engine';

// Tipos definidos en schema pero aún no generados en Prisma client
// Se usarán strings hasta que se ejecute prisma generate
type ReportCardSnapshotType = 'INITIAL_CLOSE' | 'POST_RECOVERY' | 'FINAL_CLOSE' | 'REOPENED';
type RecoveryPhaseStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'PENDING_SNAPSHOT' | 'SNAPSHOT_CREATED' | 'FINALIZED';

/**
 * RecoverySnapshotService
 * 
 * Gestiona el ciclo de vida de los snapshots de recuperación:
 * - Cierre de ventana de recuperación
 * - Creación de snapshots POST_RECOVERY
 * - Seguimiento del estado del proceso
 * - Integración con boletines
 */
@Injectable()
export class RecoverySnapshotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reportsService: ReportsService,
    private readonly institutionContext: InstitutionContextService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // ESTADO DEL PROCESO DE RECUPERACIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Obtiene el estado actual del proceso de recuperación de un período
   */
  async getRecoveryStatus(academicTermId: string) {
    const config = await this.prisma.recoveryPeriodConfig.findUnique({
      where: { academicTermId },
      include: {
        academicTerm: {
          select: { id: true, name: true, status: true, academicYearId: true }
        },
        closedBy: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    if (!config) {
      return {
        academicTermId,
        hasConfig: false,
        status: 'NOT_CONFIGURED' as const,
        message: 'No hay configuración de recuperación para este período'
      };
    }

    // Contar recuperaciones por estado
    const recoveryStats = await this.prisma.periodRecovery.groupBy({
      by: ['status'],
      where: { academicTermId },
      _count: true
    });

    const stats = {
      total: 0,
      pending: 0,
      inProgress: 0,
      completed: 0,
      approved: 0,
      notApproved: 0
    };

    recoveryStats.forEach(s => {
      stats.total += s._count;
      if (s.status === 'ASSIGNED') stats.pending += s._count;
      if (s.status === 'IN_PROGRESS' || s.status === 'REVIEW_PENDING') stats.inProgress += s._count;
      if (s.status === 'COMPLETED') stats.completed += s._count;
      if (s.status === 'APPROVED') stats.approved += s._count;
      if (s.status === 'NOT_APPROVED') stats.notApproved += s._count;
    });

    // Verificar si hay snapshot POST_RECOVERY
    const postRecoverySnapshot = await this.prisma.termReportCardSnapshot.findFirst({
      where: {
        academicTermId,
        snapshotType: 'POST_RECOVERY'
      },
      select: { id: true, version: true, generatedAt: true }
    });

    return {
      academicTermId,
      hasConfig: true,
      config: {
        isOpen: config.isOpen,
        openDate: config.openDate,
        closeDate: config.closeDate,
        recoveryPhaseStatus: config.recoveryPhaseStatus,
        snapshotCreatedAt: config.snapshotCreatedAt,
        closedAt: config.closedAt,
        closedBy: config.closedBy ? { id: config.closedBy.id, name: `${config.closedBy.firstName} ${config.closedBy.lastName}` } : null
      },
      stats,
      canCloseWindow: config.isOpen && stats.pending === 0 && stats.inProgress === 0,
      canCreateSnapshot: config.recoveryPhaseStatus === 'PENDING_SNAPSHOT' || 
                         (config.recoveryPhaseStatus === 'IN_PROGRESS' && !config.isOpen),
      hasPostRecoverySnapshot: !!postRecoverySnapshot,
      postRecoverySnapshot
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CIERRE DE VENTANA DE RECUPERACIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Cierra la ventana de recuperación de un período.
   * Puede ser automático (por fecha) o manual (por coordinador).
   * 
   * @param academicTermId ID del período académico
   * @param userId ID del usuario que cierra (null si es automático)
   * @param force Forzar cierre aunque haya recuperaciones pendientes
   */
  async closeRecoveryWindow(
    academicTermId: string,
    userId?: string,
    force: boolean = false
  ) {
    const config = await this.prisma.recoveryPeriodConfig.findUnique({
      where: { academicTermId },
      include: { academicTerm: { select: { name: true } } }
    });

    if (!config) {
      throw new BadRequestException('No hay configuración de recuperación para este período');
    }

    if (!config.isOpen) {
      throw new BadRequestException('La ventana de recuperación ya está cerrada');
    }

    // Verificar si hay recuperaciones pendientes
    const pendingCount = await this.prisma.periodRecovery.count({
      where: {
        academicTermId,
        status: { in: ['ASSIGNED', 'IN_PROGRESS', 'REVIEW_PENDING'] }
      }
    });

    if (pendingCount > 0 && !force) {
      throw new BadRequestException(
        `Hay ${pendingCount} recuperación(es) pendiente(s). Use force=true para cerrar de todas formas.`
      );
    }

    // Cerrar ventana
    const updated = await this.prisma.recoveryPeriodConfig.update({
      where: { academicTermId },
      data: {
        isOpen: false,
        closedAt: new Date(),
        closedById: userId || null,
        recoveryPhaseStatus: 'PENDING_SNAPSHOT'
      }
    });

    return {
      success: true,
      message: `Ventana de recuperación del ${config.academicTerm.name} cerrada`,
      pendingRecoveries: pendingCount,
      nextStep: 'Crear snapshot POST_RECOVERY para actualizar boletines',
      config: updated
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CREACIÓN DE SNAPSHOT POST_RECOVERY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Crea snapshots POST_RECOVERY para todos los estudiantes del período.
   * Esto actualiza los boletines con las notas de recuperación.
   * 
   * @param academicTermId ID del período académico
   * @param userId ID del usuario que genera el snapshot
   */
  async createPostRecoverySnapshots(
    academicTermId: string,
    userId: string
  ) {
    const config = await this.prisma.recoveryPeriodConfig.findUnique({
      where: { academicTermId },
      include: { 
        academicTerm: { 
          select: { 
            id: true, 
            name: true, 
            status: true,
            academicYearId: true,
            academicYear: { select: { institutionId: true } }
          } 
        } 
      }
    });

    if (!config) {
      throw new BadRequestException('No hay configuración de recuperación para este período');
    }

    if (config.isOpen) {
      throw new BadRequestException('Debe cerrar la ventana de recuperación antes de crear el snapshot');
    }

    if (config.recoveryPhaseStatus === 'SNAPSHOT_CREATED' || config.recoveryPhaseStatus === 'FINALIZED') {
      throw new BadRequestException('Ya se creó el snapshot POST_RECOVERY para este período');
    }

    const institutionId = config.academicTerm.academicYear.institutionId;
    const originalTermStatus = config.academicTerm.status;

    // Obtener todas las recuperaciones completadas del período
    const completedRecoveries = await this.prisma.periodRecovery.findMany({
      where: {
        academicTermId,
        status: { in: ['APPROVED', 'NOT_APPROVED', 'COMPLETED'] }
      },
      include: {
        studentEnrollment: { select: { id: true, studentId: true } },
        subject: { select: { id: true, name: true } }
      }
    });

    // Agrupar cambios por estudiante
    const changesByStudent: Record<string, any[]> = {};
    completedRecoveries.forEach(rec => {
      const enrollmentId = rec.studentEnrollmentId;
      if (!changesByStudent[enrollmentId]) {
        changesByStudent[enrollmentId] = [];
      }
      changesByStudent[enrollmentId].push({
        subjectId: rec.subjectId,
        subjectName: rec.subject.name,
        originalScore: rec.originalScore,
        recoveryScore: rec.recoveryScore,
        finalScore: rec.finalScore,
        status: rec.status,
        impactType: rec.impactType
      });
      });

    const groups = await this.prisma.group.findMany({
      where: {
        studentEnrollments: {
          some: {
            academicYearId: config.academicTerm.academicYearId,
            status: 'ACTIVE'
          }
        }
      },
      select: { id: true, name: true, grade: { select: { name: true } } }
    });

    if (groups.length === 0) {
      throw new BadRequestException('No hay grupos con estudiantes activos para generar snapshots');
    }

    const lastVersion = await this.prisma.termReportCardSnapshot.aggregate({
      where: { academicTermId },
      _max: { version: true }
    });

    const version = (lastVersion._max.version ?? 0) + 1;
    const rulesCtx = await this.institutionContext.getContext(institutionId);
    let totalSnapshots = 0;

    if (originalTermStatus === 'FINALIZED') {
      await this.prisma.academicTerm.update({
        where: { id: academicTermId },
        data: { status: 'OPEN' }
      });
    }

    try {
      for (const group of groups) {
        const groupData = await this.reportsService.buildGroupReportCards(group.id, academicTermId);

        const cardStats = groupData.cards.map((card) => {
          const allGrades = card.subjectGrades.filter((s: any) => s.grade !== null);
          const generalAverage = allGrades.length > 0
            ? Math.round((allGrades.reduce((sum: number, s: any) => sum + s.grade!, 0) / allGrades.length) * 10) / 10
            : null;
          const failedCount = allGrades.filter((s: any) => isFailing(s.grade ?? 0, rulesCtx)).length;
          const approvedCount = allGrades.length - failedCount;
          const promotionStatus = allGrades.length === 0
            ? 'PENDIENTE'
            : failedCount === 0 ? 'APRUEBA' : 'NO_APRUEBA';
          return { enrollmentId: card.enrollmentId, generalAverage, failedCount, approvedCount, promotionStatus };
        });

        const ranked = [...cardStats]
          .filter(s => s.generalAverage !== null)
          .sort((a, b) => (b.generalAverage ?? 0) - (a.generalAverage ?? 0));
        const totalStudentsRanked = ranked.length;
        const rankMap = new Map<string, number>();
        for (let i = 0; i < ranked.length; i++) {
          rankMap.set(ranked[i].enrollmentId, i + 1);
        }

        for (const card of groupData.cards) {
          const stats = cardStats.find(s => s.enrollmentId === card.enrollmentId)!;
          await this.prisma.termReportCardSnapshot.create({
            data: {
              academicTermId,
              studentEnrollmentId: card.enrollmentId,
              version,
              snapshotType: 'POST_RECOVERY' as ReportCardSnapshotType,
              generatedById: userId,
              recoveryChanges: changesByStudent[card.enrollmentId] || null,
              data: {
                institution: groupData.institution,
                academicYear: groupData.academicYear,
                term: groupData.term,
                academicStructure: groupData.academicStructure,
                displayConfig: groupData.displayConfig,
                student: card.student,
                group: card.group,
                areaGrades: card.areaGrades,
                subjectGrades: card.subjectGrades,
                structureSource: card.structureSource,
                attendance: card.attendance,
                achievements: card.achievements,
                observations: card.observations,
                generatedAt: groupData.generatedAt,
                rank: rankMap.get(card.enrollmentId) ?? null,
                totalStudentsRanked,
                generalAverage: stats.generalAverage,
                approvedSubjectsCount: stats.approvedCount,
                failedSubjectsCount: stats.failedCount,
                promotionStatus: stats.promotionStatus,
              } as any
            }
          });
          totalSnapshots++;
        }
      }

      await this.prisma.recoveryPeriodConfig.update({
        where: { academicTermId },
        data: {
          recoveryPhaseStatus: 'SNAPSHOT_CREATED',
          snapshotCreatedAt: new Date()
        }
      });
    } finally {
      if (originalTermStatus === 'FINALIZED') {
        await this.prisma.academicTerm.update({
          where: { id: academicTermId },
          data: { status: 'FINALIZED' }
        });
      }
    }

    return {
      success: true,
      message: `Snapshots POST_RECOVERY creados para ${totalSnapshots} estudiantes`,
      snapshotsCreated: totalSnapshots,
      studentsWithRecoveryChanges: Object.keys(changesByStudent).length,
      nextStep: 'Los boletines ahora reflejan las notas de recuperación'
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FINALIZACIÓN DEL PROCESO
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Finaliza el proceso de recuperación del período.
   * Marca el proceso como completamente terminado.
   */
  async finalizeRecoveryProcess(academicTermId: string) {
    const config = await this.prisma.recoveryPeriodConfig.findUnique({
      where: { academicTermId }
    });

    if (!config) {
      throw new BadRequestException('No hay configuración de recuperación para este período');
    }

    if (config.recoveryPhaseStatus !== 'SNAPSHOT_CREATED') {
      throw new BadRequestException('Debe crear el snapshot POST_RECOVERY antes de finalizar');
    }

    await this.prisma.recoveryPeriodConfig.update({
      where: { academicTermId },
      data: { recoveryPhaseStatus: 'FINALIZED' }
    });

    return {
      success: true,
      message: 'Proceso de recuperación finalizado',
      status: 'FINALIZED'
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPARACIÓN DE SNAPSHOTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Compara el snapshot inicial con el POST_RECOVERY para un estudiante
   */
  async compareSnapshots(academicTermId: string, studentEnrollmentId: string) {
    const snapshots = await this.prisma.termReportCardSnapshot.findMany({
      where: { academicTermId, studentEnrollmentId },
      orderBy: { version: 'asc' }
    });

    const initial = snapshots.find(s => s.snapshotType === 'INITIAL_CLOSE');
    const postRecovery = snapshots.find(s => s.snapshotType === 'POST_RECOVERY');

    if (!initial) {
      return { hasComparison: false, message: 'No hay snapshot inicial' };
    }

    if (!postRecovery) {
      return { hasComparison: false, message: 'No hay snapshot POST_RECOVERY' };
    }

    return {
      hasComparison: true,
      initial: {
        version: initial.version,
        generatedAt: initial.generatedAt
      },
      postRecovery: {
        version: postRecovery.version,
        generatedAt: postRecovery.generatedAt,
        recoveryChanges: postRecovery.recoveryChanges
      }
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RESUMEN DEL FLUJO PARA UI
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Obtiene el flujo completo del proceso de recuperación para mostrar en UI
   */
  async getRecoveryWorkflow(academicTermId: string) {
    const status = await this.getRecoveryStatus(academicTermId);

    const steps = [
      {
        order: 1,
        name: 'Cierre de Planilla',
        description: 'Cerrar la planilla de notas del período para crear el snapshot inicial',
        status: 'completed', // Asumimos que ya se hizo si estamos en recuperación
        icon: 'ClipboardCheck'
      },
      {
        order: 2,
        name: 'Ventana de Recuperación',
        description: 'Período abierto para que estudiantes realicen actividades de recuperación',
        status: status.config?.isOpen ? 'in_progress' : 
                status.config?.recoveryPhaseStatus === 'NOT_STARTED' ? 'pending' : 'completed',
        icon: 'Clock',
        details: status.config ? {
          openDate: status.config.openDate,
          closeDate: status.config.closeDate,
          isOpen: status.config.isOpen
        } : null
      },
      {
        order: 3,
        name: 'Registro de Resultados',
        description: 'Docentes registran las notas de las actividades de recuperación',
        status: (status.stats?.total ?? 0) === 0 ? 'pending' :
                (status.stats?.pending ?? 0) > 0 || (status.stats?.inProgress ?? 0) > 0 ? 'in_progress' : 'completed',
        icon: 'FileEdit',
        details: status.stats
      },
      {
        order: 4,
        name: 'Cierre de Ventana',
        description: 'Cerrar la ventana de recuperación para proceder con el snapshot',
        status: !status.config?.isOpen && status.config?.closedAt ? 'completed' : 
                status.canCloseWindow ? 'ready' : 'pending',
        icon: 'Lock',
        action: status.canCloseWindow ? 'closeRecoveryWindow' : null
      },
      {
        order: 5,
        name: 'Crear Snapshot POST_RECOVERY',
        description: 'Generar nueva versión de boletines con notas de recuperación',
        status: status.hasPostRecoverySnapshot ? 'completed' :
                status.canCreateSnapshot ? 'ready' : 'pending',
        icon: 'Camera',
        action: status.canCreateSnapshot ? 'createPostRecoverySnapshots' : null
      },
      {
        order: 6,
        name: 'Finalizar Proceso',
        description: 'Marcar el proceso de recuperación como completado',
        status: status.config?.recoveryPhaseStatus === 'FINALIZED' ? 'completed' :
                status.config?.recoveryPhaseStatus === 'SNAPSHOT_CREATED' ? 'ready' : 'pending',
        icon: 'CheckCircle',
        action: status.config?.recoveryPhaseStatus === 'SNAPSHOT_CREATED' ? 'finalizeRecoveryProcess' : null
      }
    ];

    const stats = status.stats ?? { total: 0, pending: 0, inProgress: 0, completed: 0, approved: 0, notApproved: 0 };

    return {
      academicTermId,
      currentPhase: status.config?.recoveryPhaseStatus || 'NOT_CONFIGURED',
      steps,
      summary: {
        totalRecoveries: stats.total,
        completed: stats.completed + stats.approved + stats.notApproved,
        pending: stats.pending + stats.inProgress,
        approved: stats.approved,
        notApproved: stats.notApproved
      }
    };
  }
}
