import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  addDateOnlyDays,
  colombiaTodayKey,
  compareDateOnlyToColombiaToday,
  formatDateOnlyInColombia,
} from '../../common/utils/date-window.util';

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

    return terms.map((term) => ({
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

  async upsertConfig(
    academicTermId: string,
    data: {
      isOpen: boolean;
      openDate?: Date | null;
      closeDate?: Date | null;
      allowLateEntry?: boolean;
      lateEntryDays?: number;
    },
  ) {
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

  async isPeriodOpen(
    academicTermId: string,
  ): Promise<{ isOpen: boolean; reason?: string }> {
    const config = await this.prisma.recoveryPeriodConfig.findUnique({
      where: { academicTermId },
    });

    if (!config) {
      return {
        isOpen: false,
        reason: 'Período de recuperación no configurado',
      };
    }

    if (!config.isOpen) {
      return {
        isOpen: false,
        reason: 'El período de recuperación está cerrado',
      };
    }

    if (
      config.openDate &&
      compareDateOnlyToColombiaToday(config.openDate) > 0
    ) {
      return {
        isOpen: false,
        reason: `El período de recuperación abre el ${formatDateOnlyInColombia(config.openDate)}`,
      };
    }

    if (config.closeDate) {
      const closeDateKey =
        config.allowLateEntry && config.lateEntryDays > 0
          ? addDateOnlyDays(config.closeDate, config.lateEntryDays)
          : config.closeDate.toISOString().slice(0, 10);
      if (closeDateKey < colombiaTodayKey()) {
        return {
          isOpen: false,
          reason: `El período de recuperación cerró el ${formatDateOnlyInColombia(config.closeDate)}`,
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

    const today = colombiaTodayKey();

    return terms.map((term) => {
      const config = term.recoveryPeriodConfig;
      let status: 'open' | 'closed' | 'upcoming' | 'not_configured' =
        'not_configured';
      let canEnterRecoveries = false;

      if (config) {
        if (!config.isOpen) {
          status = 'closed';
        } else if (
          config.openDate &&
          compareDateOnlyToColombiaToday(config.openDate) > 0
        ) {
          status = 'upcoming';
        } else if (config.closeDate) {
          const effectiveCloseDate =
            config.allowLateEntry && config.lateEntryDays > 0
              ? addDateOnlyDays(config.closeDate, config.lateEntryDays)
              : config.closeDate.toISOString().slice(0, 10);
          if (today > effectiveCloseDate) {
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
