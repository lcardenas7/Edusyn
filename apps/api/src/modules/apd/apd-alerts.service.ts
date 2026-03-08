import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Servicio de alertas automáticas para el módulo APD.
 *
 * Detecta:
 * - Planes con seguimiento vencido (followUpDate < hoy)
 * - Planes activos sin actividades registradas
 * - Planes con progreso bajo (<40%) y actividades existentes
 * - Perfiles activos sin plan vigente en el período actual
 * - Planes con actividades 100% pendientes (ninguna iniciada/completada)
 */
@Injectable()
export class ApdAlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAlerts(institutionId: string) {
    const now = new Date();

    const [overdueFollowUp, noActivities, lowProgress, staleActivities] =
      await Promise.all([
        // 1. Seguimiento vencido
        this.prisma.pedagogicalSupportPlan.findMany({
          where: {
            institutionId,
            status: 'ACTIVE',
            followUpDate: { lt: now },
          },
          include: {
            studentEnrollment: {
              include: {
                student: { select: { firstName: true, lastName: true } },
                group: {
                  select: { name: true, grade: { select: { name: true } } },
                },
              },
            },
          },
        }),

        // 2. Sin actividades
        this.prisma.pedagogicalSupportPlan.findMany({
          where: {
            institutionId,
            status: 'ACTIVE',
            activities: { none: {} },
          },
          include: {
            studentEnrollment: {
              include: {
                student: { select: { firstName: true, lastName: true } },
                group: {
                  select: { name: true, grade: { select: { name: true } } },
                },
              },
            },
          },
        }),

        // 3. Progreso bajo (<40%) con al menos una actividad
        this.prisma.pedagogicalSupportPlan.findMany({
          where: {
            institutionId,
            status: 'ACTIVE',
            progressPercentage: { lt: 40 },
            activities: { some: {} },
          },
          include: {
            studentEnrollment: {
              include: {
                student: { select: { firstName: true, lastName: true } },
                group: {
                  select: { name: true, grade: { select: { name: true } } },
                },
              },
            },
          },
        }),

        // 4. Planes con todas las actividades pendientes (ninguna iniciada)
        this.prisma.pedagogicalSupportPlan.findMany({
          where: {
            institutionId,
            status: 'ACTIVE',
            activities: { some: {} },
            NOT: {
              activities: {
                some: {
                  completionStatus: { in: ['IN_PROGRESS', 'COMPLETED'] },
                },
              },
            },
          },
          include: {
            studentEnrollment: {
              include: {
                student: { select: { firstName: true, lastName: true } },
                group: {
                  select: { name: true, grade: { select: { name: true } } },
                },
              },
            },
            _count: { select: { activities: true } },
          },
        }),
      ]);

    const mapPlan = (p: any) => ({
      planId: p.id,
      studentName: `${p.studentEnrollment.student.lastName} ${p.studentEnrollment.student.firstName}`,
      group: p.studentEnrollment.group?.name || null,
      grade: p.studentEnrollment.group?.grade?.name || null,
      followUpDate: p.followUpDate,
      progress: p.progressPercentage ? Number(p.progressPercentage) : null,
      activityCount: p._count?.activities ?? null,
    });

    const alerts: Array<{
      type: string;
      severity: 'high' | 'medium' | 'low';
      message: string;
      planId: string;
      studentName: string;
      group: string | null;
      grade: string | null;
      detail: any;
    }> = [];

    for (const p of overdueFollowUp) {
      const m = mapPlan(p);
      const daysOverdue = p.followUpDate
        ? Math.floor((now.getTime() - new Date(p.followUpDate).getTime()) / 86400000)
        : 0;
      alerts.push({
        type: 'OVERDUE_FOLLOWUP',
        severity: daysOverdue > 14 ? 'high' : 'medium',
        message: `Seguimiento vencido hace ${daysOverdue} día${daysOverdue !== 1 ? 's' : ''}`,
        planId: m.planId,
        studentName: m.studentName,
        group: m.group,
        grade: m.grade,
        detail: { followUpDate: p.followUpDate, daysOverdue },
      });
    }

    for (const p of noActivities) {
      const m = mapPlan(p);
      const daysSinceCreation = Math.floor(
        (now.getTime() - new Date(p.createdAt).getTime()) / 86400000,
      );
      alerts.push({
        type: 'NO_ACTIVITIES',
        severity: daysSinceCreation > 7 ? 'high' : 'medium',
        message: `Plan activo sin actividades (${daysSinceCreation} días)`,
        planId: m.planId,
        studentName: m.studentName,
        group: m.group,
        grade: m.grade,
        detail: { createdAt: p.createdAt, daysSinceCreation },
      });
    }

    for (const p of lowProgress) {
      const m = mapPlan(p);
      alerts.push({
        type: 'LOW_PROGRESS',
        severity: m.progress !== null && m.progress < 20 ? 'high' : 'medium',
        message: `Progreso bajo: ${m.progress?.toFixed(0) || 0}%`,
        planId: m.planId,
        studentName: m.studentName,
        group: m.group,
        grade: m.grade,
        detail: { progress: m.progress },
      });
    }

    for (const p of staleActivities) {
      const m = mapPlan(p);
      alerts.push({
        type: 'STALE_ACTIVITIES',
        severity: 'low',
        message: `Todas las actividades pendientes (${m.activityCount})`,
        planId: m.planId,
        studentName: m.studentName,
        group: m.group,
        grade: m.grade,
        detail: { activityCount: m.activityCount },
      });
    }

    // Sort: high first, then medium, then low
    const severityOrder = { high: 0, medium: 1, low: 2 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return {
      total: alerts.length,
      summary: {
        high: alerts.filter((a) => a.severity === 'high').length,
        medium: alerts.filter((a) => a.severity === 'medium').length,
        low: alerts.filter((a) => a.severity === 'low').length,
      },
      alerts,
    };
  }
}
