import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RecoveryPeriodConfigService {
  constructor(private prisma: PrismaService) {}

  async getByAcademicYear(academicYearId: string) {
    const terms = await this.prisma.academicTerm.findMany({
      where: { academicYearId },
      include: {
        recoveryPeriodConfig: true,
      },
      orderBy: { order: 'asc' },
    });

    return terms.map(term => ({
      id: term.id,
      name: term.name,
      order: term.order,
      startDate: term.startDate,
      endDate: term.endDate,
      config: term.recoveryPeriodConfig || {
        isOpen: false,
        openDate: null,
        closeDate: null,
        allowLateEntry: false,
        lateEntryDays: 0,
      },
    }));
  }

  async upsertConfig(academicTermId: string, data: {
    isOpen: boolean;
    openDate?: Date | null;
    closeDate?: Date | null;
    allowLateEntry?: boolean;
    lateEntryDays?: number;
  }) {
    return this.prisma.recoveryPeriodConfig.upsert({
      where: { academicTermId },
      update: {
        isOpen: data.isOpen,
        openDate: data.openDate,
        closeDate: data.closeDate,
        allowLateEntry: data.allowLateEntry ?? false,
        lateEntryDays: data.lateEntryDays ?? 0,
      },
      create: {
        academicTermId,
        isOpen: data.isOpen,
        openDate: data.openDate,
        closeDate: data.closeDate,
        allowLateEntry: data.allowLateEntry ?? false,
        lateEntryDays: data.lateEntryDays ?? 0,
      },
    });
  }

  async isPeriodOpen(academicTermId: string): Promise<{ isOpen: boolean; reason?: string }> {
    const config = await this.prisma.recoveryPeriodConfig.findUnique({
      where: { academicTermId },
    });

    if (!config) {
      return { isOpen: false, reason: 'Período de recuperación no configurado' };
    }

    if (!config.isOpen) {
      return { isOpen: false, reason: 'El período de recuperación está cerrado' };
    }

    const now = new Date();

    if (config.openDate && now < config.openDate) {
      return { 
        isOpen: false, 
        reason: `El período de recuperación abre el ${config.openDate.toLocaleDateString('es-CO')}` 
      };
    }

    if (config.closeDate) {
      const closeDate = new Date(config.closeDate);
      if (config.allowLateEntry && config.lateEntryDays > 0) {
        closeDate.setDate(closeDate.getDate() + config.lateEntryDays);
      }
      if (now > closeDate) {
        return { 
          isOpen: false, 
          reason: `El período de recuperación cerró el ${config.closeDate.toLocaleDateString('es-CO')}` 
        };
      }
    }

    return { isOpen: true };
  }

  async getPeriodsStatus(academicYearId: string) {
    const terms = await this.prisma.academicTerm.findMany({
      where: { academicYearId },
      include: {
        recoveryPeriodConfig: true,
      },
      orderBy: { order: 'asc' },
    });

    const now = new Date();

    return terms.map(term => {
      const config = term.recoveryPeriodConfig;
      let status: 'open' | 'closed' | 'upcoming' | 'not_configured' = 'not_configured';
      let canEnterRecoveries = false;

      if (config) {
        if (!config.isOpen) {
          status = 'closed';
        } else if (config.openDate && now < config.openDate) {
          status = 'upcoming';
        } else if (config.closeDate) {
          let effectiveCloseDate = new Date(config.closeDate);
          if (config.allowLateEntry && config.lateEntryDays > 0) {
            effectiveCloseDate.setDate(effectiveCloseDate.getDate() + config.lateEntryDays);
          }
          if (now > effectiveCloseDate) {
            status = 'closed';
          } else {
            status = 'open';
            canEnterRecoveries = true;
          }
        } else {
          status = 'open';
          canEnterRecoveries = true;
        }
      }

      return {
        id: term.id,
        name: term.name,
        order: term.order,
        status,
        canEnterRecoveries,
        openDate: config?.openDate,
        closeDate: config?.closeDate,
        allowLateEntry: config?.allowLateEntry || false,
        lateEntryDays: config?.lateEntryDays || 0,
      };
    });
  }
}
