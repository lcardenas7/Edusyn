import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Servicio de cálculo automático de progressPercentage.
 * 
 * Fórmula:
 *   progressPercentage =
 *     (completedActivities / totalActivities) * 70
 *     + (avg(progressIndicator) / 5) * 30
 * 
 * Reglas:
 * - Sin actividades ni avances → 0%; solo avances → promedio / 5
 * - Si no hay logs → solo ponderar actividades (100% del peso en actividades)
 * - Recalcular automáticamente al actualizar actividad o progress log
 */
@Injectable()
export class ApdProgressService {
  constructor(private readonly prisma: PrismaService) {}

  async recalculate(supportPlanId: string, institutionId: string): Promise<number> {
    if (!institutionId || !supportPlanId || !await this.prisma.pedagogicalSupportPlan.findFirst({
      where: { id: supportPlanId, institutionId }, select: { id: true },
    })) throw new NotFoundException('Plan no encontrado.');
    const [activities, logs] = await Promise.all([
      this.prisma.supportActivity.findMany({
        where: { supportPlanId, supportPlan: { institutionId } },
        select: { completionStatus: true },
      }),
      this.prisma.supportProgressLog.findMany({
        where: { supportPlanId, supportPlan: { institutionId } },
        select: { progressIndicator: true },
      }),
    ]);

    const totalActivities = activities.length;

    // Sin actividades ni avances → 0%.
    if (totalActivities === 0 && logs.length === 0) {
      await this.updatePlanProgress(supportPlanId, institutionId, 0);
      return 0;
    }

    // Componente de actividades (70% o 100% si no hay logs)
    let activityScore = 0;
    if (totalActivities > 0) {
      const completedActivities = activities.filter(
        (a) => a.completionStatus === 'COMPLETED',
      ).length;
      activityScore = completedActivities / totalActivities;
    }

    // Componente de logs de progreso (30%)
    let logScore = 0;
    const hasLogs = logs.length > 0;
    if (hasLogs) {
      const avgIndicator =
        logs.reduce((sum, l) => sum + l.progressIndicator, 0) / logs.length;
      logScore = avgIndicator / 5;
    }

    // Calcular porcentaje final
    let percentage: number;
    if (!hasLogs) {
      // Sin logs → 100% del peso en actividades
      percentage = activityScore * 100;
    } else if (totalActivities === 0) {
      // Sin actividades pero con logs → 100% del peso en logs
      percentage = logScore * 100;
    } else {
      // Fórmula estándar
      percentage = activityScore * 70 + logScore * 30;
    }

    // Redondear a 2 decimales
    percentage = Math.round(percentage * 100) / 100;

    await this.updatePlanProgress(supportPlanId, institutionId, percentage);
    return percentage;
  }

  private async updatePlanProgress(
    supportPlanId: string,
    institutionId: string,
    percentage: number,
  ) {
    await this.prisma.pedagogicalSupportPlan.update({
      where: { id: supportPlanId, institutionId },
      data: { progressPercentage: new Decimal(percentage) },
    });
  }
}
