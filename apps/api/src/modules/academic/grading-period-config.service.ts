import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  addDateOnlyDays,
  colombiaTodayKey,
  compareDateOnlyToColombiaToday,
  formatDateOnlyInColombia,
} from '../../common/utils/date-window.util';

@Injectable()
export class GradingPeriodConfigService {
  constructor(private prisma: PrismaService) {}

  // Obtener configuración de todos los períodos de un año académico
  async getByAcademicYear(academicYearId: string) {
    const terms = await this.prisma.academicTerm.findMany({
      where: { academicYearId },
      include: {
        gradingPeriodConfig: true,
      },
      orderBy: { order: 'asc' },
    });

    return terms.map((term) => ({
      id: term.id,
      name: term.name,
      order: term.order,
      startDate: term.startDate,
      endDate: term.endDate,
      config: term.gradingPeriodConfig || {
        isOpen: false,
        openDate: null,
        closeDate: null,
        allowLateEntry: false,
        lateEntryDays: 0,
      },
    }));
  }

  // Actualizar o crear configuración de un período
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
    return this.prisma.gradingPeriodConfig.upsert({
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

  // Verificar si un período está abierto para calificaciones
  async isPeriodOpen(
    academicTermId: string,
  ): Promise<{ isOpen: boolean; reason?: string }> {
    const config = await this.prisma.gradingPeriodConfig.findUnique({
      where: { academicTermId },
    });

    if (!config) {
      return {
        isOpen: false,
        reason: 'Período no configurado para calificaciones',
      };
    }

    if (!config.isOpen) {
      return {
        isOpen: false,
        reason: 'El período está cerrado para calificaciones',
      };
    }

    // Verificar fecha de apertura
    if (
      config.openDate &&
      compareDateOnlyToColombiaToday(config.openDate) > 0
    ) {
      return {
        isOpen: false,
        reason: `El período abre el ${formatDateOnlyInColombia(config.openDate)}`,
      };
    }

    // Verificar fecha de cierre
    if (config.closeDate) {
      // Si permite entrada tardía, agregar días adicionales
      const closeDateKey =
        config.allowLateEntry && config.lateEntryDays > 0
          ? addDateOnlyDays(config.closeDate, config.lateEntryDays)
          : config.closeDate.toISOString().slice(0, 10);

      if (closeDateKey < colombiaTodayKey()) {
        return {
          isOpen: false,
          reason: `El período cerró el ${formatDateOnlyInColombia(config.closeDate)}`,
        };
      }
    }

    return { isOpen: true };
  }

  // Obtener estado de todos los períodos para un docente
  async getPeriodsStatus(academicYearId: string) {
    const terms = await this.prisma.academicTerm.findMany({
      where: { academicYearId },
      include: {
        gradingPeriodConfig: true,
      },
      orderBy: { order: 'asc' },
    });

    const today = colombiaTodayKey();

    return terms.map((term) => {
      const config = term.gradingPeriodConfig;
      let status: 'open' | 'closed' | 'upcoming' | 'not_configured' =
        'not_configured';
      let canEnterGrades = false;
      // Por qué está cerrado: 'toggle' = deshabilitado manualmente,
      // 'date' = la ventana está habilitada pero su fecha de cierre ya pasó.
      let closedBy: 'toggle' | 'date' | null = null;

      if (config) {
        if (!config.isOpen) {
          status = 'closed';
          closedBy = 'toggle';
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
            closedBy = 'date';
          } else {
            status = 'open';
            canEnterGrades = true;
          }
        } else {
          status = 'open';
          canEnterGrades = true;
        }
      }

      return {
        id: term.id,
        name: term.name,
        order: term.order,
        status,
        canEnterGrades,
        closedBy,
        openDate: config?.openDate,
        closeDate: config?.closeDate,
        allowLateEntry: config?.allowLateEntry || false,
        lateEntryDays: config?.lateEntryDays || 0,
      };
    });
  }
}
