import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

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

    // Obtener todos los estudiantes del año académico
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        academicYearId: config.academicTerm.academicYearId,
        status: 'ACTIVE'
      },
      select: { id: true }
    });

    // Obtener la versión máxima actual para cada estudiante
    const existingSnapshots = await this.prisma.termReportCardSnapshot.groupBy({
      by: ['studentEnrollmentId'],
      where: { academicTermId },
      _max: { version: true }
    });

    const versionMap: Record<string, number> = {};
    existingSnapshots.forEach(s => {
      versionMap[s.studentEnrollmentId] = s._max.version || 0;
    });

    // Crear snapshots POST_RECOVERY para cada estudiante
    const snapshotsToCreate = enrollments.map(enr => {
      const currentVersion = versionMap[enr.id] || 0;
      const recoveryChanges = changesByStudent[enr.id] || null;

      return {
        academicTermId,
        studentEnrollmentId: enr.id,
        version: currentVersion + 1,
        snapshotType: 'POST_RECOVERY' as ReportCardSnapshotType,
        generatedById: userId,
        recoveryChanges,
        data: {} // Se llenará con el boletín actualizado
      };
    });

    // Crear todos los snapshots en una transacción
    const result = await this.prisma.$transaction(async (tx) => {
      // Crear snapshots
      const created = await tx.termReportCardSnapshot.createMany({
        data: snapshotsToCreate
      });

      // Actualizar estado del proceso
      await tx.recoveryPeriodConfig.update({
        where: { academicTermId },
        data: {
          recoveryPhaseStatus: 'SNAPSHOT_CREATED',
          snapshotCreatedAt: new Date()
        }
      });

      return created;
    });

    return {
      success: true,
      message: `Snapshots POST_RECOVERY creados para ${result.count} estudiantes`,
      snapshotsCreated: result.count,
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
