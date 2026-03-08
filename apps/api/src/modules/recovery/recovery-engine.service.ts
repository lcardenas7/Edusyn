import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RecoveryImpactType, RecoveryStatus, PromotionStatus } from '@prisma/client';
import { RecoveryConfigService } from './recovery-config.service';

/**
 * RecoveryEngineService
 * 
 * Motor centralizado de cálculos para recuperaciones académicas.
 * Elimina duplicación de lógica entre PeriodRecoveryService y FinalRecoveryService.
 * 
 * Responsabilidades:
 * - Calcular nota final según tipo de impacto
 * - Validar intentos restantes
 * - Determinar estado de recuperación
 * - Recalcular estado de promoción del estudiante
 * - Generar estadísticas enriquecidas
 */
@Injectable()
export class RecoveryEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: RecoveryConfigService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // CÁLCULO DE NOTA SEGÚN TIPO DE IMPACTO
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Calcula la nota final después de una recuperación según el impactType configurado.
   * Esta lógica estaba duplicada en PeriodRecoveryService y FinalRecoveryService.
   */
  calculateRecoveryImpact(params: {
    originalScore: number;
    recoveryScore: number;
    maxScore: number;
    minPassingScore: number;
    impactType: RecoveryImpactType;
  }): { finalScore: number; status: RecoveryStatus } {
    const { originalScore, recoveryScore, maxScore, minPassingScore, impactType } = params;

    let finalScore: number;

    switch (impactType) {
      case 'ADJUST_TO_MINIMUM':
        // Si aprueba → nota mínima; si no aprueba → la nota de recuperación
        finalScore = Math.min(
          recoveryScore >= minPassingScore ? minPassingScore : recoveryScore,
          maxScore,
        );
        break;

      case 'AVERAGE_WITH_ORIGINAL':
        // Promedio entre la nota original y la nota de recuperación
        finalScore = Math.min((originalScore + recoveryScore) / 2, maxScore);
        break;

      case 'REPLACE_IF_HIGHER':
        // Reemplaza solo si la nota de recuperación es mayor
        finalScore = Math.min(Math.max(originalScore, recoveryScore), maxScore);
        break;

      case 'QUALITATIVE_ONLY':
        // No cambia la nota numérica, solo registro cualitativo
        finalScore = originalScore;
        break;

      default:
        finalScore = Math.min(recoveryScore, maxScore);
    }

    // Redondear a 2 decimales
    finalScore = Math.round(finalScore * 100) / 100;

    const status: RecoveryStatus = finalScore >= minPassingScore ? 'APPROVED' : 'NOT_APPROVED';

    return { finalScore, status };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDACIÓN DE INTENTOS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Valida si un estudiante puede intentar una recuperación más.
   */
  async validateAttempt(params: {
    studentEnrollmentId: string;
    subjectId?: string;
    areaId?: string;
    academicTermId?: string;
    academicYearId?: string;
    maxAttempts: number;
    type: 'PERIOD' | 'FINAL';
  }): Promise<{ canAttempt: boolean; currentAttempt: number; reason?: string }> {
    const { type, maxAttempts } = params;

    let currentAttempt: number;

    if (type === 'PERIOD') {
      currentAttempt = await this.prisma.periodRecovery.count({
        where: {
          studentEnrollmentId: params.studentEnrollmentId,
          subjectId: params.subjectId,
          academicTermId: params.academicTermId,
        },
      });
    } else {
      currentAttempt = await this.prisma.finalRecoveryPlan.count({
        where: {
          studentEnrollmentId: params.studentEnrollmentId,
          areaId: params.areaId,
          academicYearId: params.academicYearId,
        },
      });
    }

    if (currentAttempt >= maxAttempts) {
      return {
        canAttempt: false,
        currentAttempt,
        reason: `Se alcanzó el máximo de ${maxAttempts} intento(s) de recuperación`,
      };
    }

    return { canAttempt: true, currentAttempt: currentAttempt + 1 };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RECÁLCULO DE ESTADO DE PROMOCIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Recalcula el promotionStatus de un estudiante basándose en:
   * - Notas finales de período/año
   * - Resultado de recuperaciones
   * - Configuración institucional (umbrales de reprobación automática)
   */
  async recalculatePromotionStatus(
    studentEnrollmentId: string,
    institutionId: string,
  ): Promise<PromotionStatus> {
    const enrollment = await this.prisma.studentEnrollment.findUnique({
      where: { id: studentEnrollmentId },
      include: {
        academicYear: true,
        finalRecoveryPlans: true,
        periodRecoveries: true,
      },
    });

    if (!enrollment) return 'IN_PROGRESS';

    const config = await this.configService.getOrCreateDefaultConfig(
      institutionId,
      enrollment.academicYearId,
    );

    // Contar áreas/asignaturas reprobadas en recuperación final
    const finalPlans = enrollment.finalRecoveryPlans;
    const pendingFinals = finalPlans.filter(p => 
      p.status === 'PENDING' || p.status === 'ASSIGNED' || p.status === 'IN_PROGRESS',
    );
    const failedFinals = finalPlans.filter(p => p.status === 'NOT_APPROVED');
    const approvedFinals = finalPlans.filter(p => p.status === 'APPROVED');

    let newStatus: PromotionStatus;

    // Si tiene recuperaciones finales pendientes
    if (pendingFinals.length > 0) {
      newStatus = 'PENDING_RECOVERY';
    }
    // Si todas las recuperaciones fueron aprobadas
    else if (finalPlans.length > 0 && failedFinals.length === 0 && pendingFinals.length === 0) {
      newStatus = approvedFinals.length > 0 ? 'PROMOTED_AFTER_RECOVERY' : 'PROMOTED';
    }
    // Verificar umbrales de reprobación automática
    else if (config.autoRetainAreas && failedFinals.length >= config.autoRetainAreas) {
      newStatus = 'RETAINED';
    }
    // Si tiene áreas reprobadas pero dentro del límite recuperable
    else if (failedFinals.length > 0) {
      newStatus = 'RETAINED';
    }
    // Sin planes de recuperación final → en progreso o promovido
    else if (finalPlans.length === 0) {
      newStatus = 'IN_PROGRESS';
    }
    else {
      newStatus = 'IN_PROGRESS';
    }

    // Actualizar en BD
    await this.prisma.studentEnrollment.update({
      where: { id: studentEnrollmentId },
      data: { promotionStatus: newStatus },
    });

    return newStatus;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ESTADÍSTICAS ENRIQUECIDAS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Genera estadísticas detalladas de recuperaciones para coordinadores.
   */
  async getEnrichedStats(params: {
    academicTermId?: string;
    academicYearId?: string;
    institutionId: string;
    type: 'PERIOD' | 'FINAL';
  }) {
    if (params.type === 'PERIOD' && params.academicTermId) {
      return this.getPeriodStats(params.academicTermId, params.institutionId);
    }
    if (params.type === 'FINAL' && params.academicYearId) {
      return this.getFinalStats(params.academicYearId, params.institutionId);
    }
    return null;
  }

  private async getPeriodStats(academicTermId: string, institutionId: string) {
    const recoveries = await this.prisma.periodRecovery.findMany({
      where: { academicTermId, institutionId },
      select: { status: true, recoveryScore: true, originalScore: true, finalScore: true },
    });

    const total = recoveries.length;
    const byStatus = this.countByStatus(recoveries);
    const approved = byStatus['APPROVED'] || 0;
    const notApproved = byStatus['NOT_APPROVED'] || 0;
    const completed = approved + notApproved;

    return {
      studentsNeedingRecovery: total,
      recoveriesCreated: total,
      recoveriesApproved: approved,
      recoveriesRejected: notApproved,
      pendingRecoveries: (byStatus['PENDING'] || 0) + (byStatus['ASSIGNED'] || 0) + (byStatus['IN_PROGRESS'] || 0),
      reviewPending: byStatus['REVIEW_PENDING'] || 0,
      cancelled: byStatus['CANCELLED'] || 0,
      successRate: completed > 0 ? Math.round((approved / completed) * 100) : 0,
      byStatus,
    };
  }

  private async getFinalStats(academicYearId: string, institutionId: string) {
    const plans = await this.prisma.finalRecoveryPlan.findMany({
      where: { academicYearId, institutionId },
      select: { status: true, recoveryScore: true, originalAreaScore: true, finalAreaScore: true },
    });

    const total = plans.length;
    const byStatus = this.countByStatus(plans);
    const approved = byStatus['APPROVED'] || 0;
    const notApproved = byStatus['NOT_APPROVED'] || 0;
    const completed = approved + notApproved;

    // Contar estados de promoción
    const promotionStats = await this.prisma.studentEnrollment.groupBy({
      by: ['promotionStatus'],
      where: {
        academicYear: { id: academicYearId },
        institutionId,
      },
      _count: true,
    });

    const promotionByStatus = promotionStats.reduce((acc, p) => {
      acc[p.promotionStatus] = p._count;
      return acc;
    }, {} as Record<string, number>);

    return {
      studentsNeedingRecovery: total,
      recoveriesCreated: total,
      recoveriesApproved: approved,
      recoveriesRejected: notApproved,
      pendingRecoveries: (byStatus['PENDING'] || 0) + (byStatus['ASSIGNED'] || 0) + (byStatus['IN_PROGRESS'] || 0),
      reviewPending: byStatus['REVIEW_PENDING'] || 0,
      cancelled: byStatus['CANCELLED'] || 0,
      successRate: completed > 0 ? Math.round((approved / completed) * 100) : 0,
      byStatus,
      promotionByStatus,
    };
  }

  private countByStatus(items: { status: string }[]): Record<string, number> {
    return items.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDACIÓN GENERAL
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Valida si una recuperación puede ser creada según la configuración.
   */
  async validateRecoveryCreation(params: {
    institutionId: string;
    academicYearId: string;
    type: 'PERIOD' | 'FINAL';
  }): Promise<{ allowed: boolean; reason?: string }> {
    const config = await this.configService.getOrCreateDefaultConfig(
      params.institutionId,
      params.academicYearId,
    );

    if (params.type === 'PERIOD' && !config.periodRecoveryEnabled) {
      return { allowed: false, reason: 'La recuperación por período está deshabilitada para esta institución' };
    }

    if (params.type === 'FINAL' && !config.finalRecoveryEnabled) {
      return { allowed: false, reason: 'La recuperación final está deshabilitada para esta institución' };
    }

    // Verificar ventana de fechas
    const now = new Date();
    if (params.type === 'PERIOD') {
      if (config.periodRecoveryStartDate && now < config.periodRecoveryStartDate) {
        return { allowed: false, reason: `La ventana de recuperación de período abre el ${config.periodRecoveryStartDate.toLocaleDateString('es-CO')}` };
      }
      if (config.periodRecoveryEndDate && now > config.periodRecoveryEndDate) {
        return { allowed: false, reason: `La ventana de recuperación de período cerró el ${config.periodRecoveryEndDate.toLocaleDateString('es-CO')}` };
      }
    } else {
      if (config.finalRecoveryStartDate && now < config.finalRecoveryStartDate) {
        return { allowed: false, reason: `La ventana de recuperación final abre el ${config.finalRecoveryStartDate.toLocaleDateString('es-CO')}` };
      }
      if (config.finalRecoveryEndDate && now > config.finalRecoveryEndDate) {
        return { allowed: false, reason: `La ventana de recuperación final cerró el ${config.finalRecoveryEndDate.toLocaleDateString('es-CO')}` };
      }
    }

    return { allowed: true };
  }

  /**
   * Obtiene la regla granular aplicable para un tipo de actividad específico.
   * Si no existe una regla granular, usa la configuración general.
   */
  async getApplicableRule(params: {
    institutionId: string;
    academicYearId: string;
    type: 'PERIOD' | 'FINAL';
    activityType?: string;
  }) {
    const config = await this.configService.getOrCreateDefaultConfig(
      params.institutionId,
      params.academicYearId,
    );

    // Buscar regla granular si se especifica activityType
    if (params.activityType) {
      const rule = await this.prisma.recoveryRule.findFirst({
        where: {
          recoveryConfigId: config.id,
          appliesTo: params.type,
          activityType: params.activityType as any,
          isEnabled: true,
        },
      });

      if (rule) {
        return {
          maxScore: Number(rule.maxScore),
          impactType: rule.impactType,
          maxAttempts: rule.maxAttempts,
          source: 'RULE' as const,
        };
      }
    }

    // Fallback a configuración general
    if (params.type === 'PERIOD') {
      return {
        maxScore: Number(config.periodMaxScore),
        impactType: config.periodImpactType,
        maxAttempts: config.periodRecoveryMaxAttempts,
        source: 'CONFIG' as const,
      };
    }

    return {
      maxScore: Number(config.finalMaxScore),
      impactType: config.finalImpactType,
      maxAttempts: config.finalRecoveryMaxAttempts,
      source: 'CONFIG' as const,
    };
  }
}
