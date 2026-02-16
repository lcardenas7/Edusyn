import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class FinancialSettingsService {
  constructor(private prisma: PrismaService) {}

  async get(institutionId: string) {
    let settings = await this.prisma.financialSettings.findUnique({
      where: { institutionId },
    });

    if (!settings) {
      settings = await this.prisma.financialSettings.create({
        data: { institutionId },
      });
    }

    return settings;
  }

  async update(institutionId: string, data: {
    invoicePrefix?: string;
    receiptPrefix?: string;
    defaultLateFeeType?: string;
    defaultLateFeeValue?: number;
    defaultGracePeriodDays?: number;
    taxId?: string;
    taxRegime?: string;
    bankAccounts?: any;
    sendPaymentReminders?: boolean;
    reminderDaysBefore?: number;
    invoiceLogoUrl?: string;
    invoiceResolution?: string;
    invoiceResolutionDate?: string;
    invoiceRangeFrom?: number;
    invoiceRangeTo?: number;
    invoiceFooterText?: string;
    invoicePageSize?: string;
    invoiceCity?: string;
    invoicePhone?: string;
    invoiceEmail?: string;
    economicActivity?: string;
  }) {
    const { defaultLateFeeValue, invoiceResolutionDate, ...rest } = data;

    const updateData: any = { ...rest };
    if (defaultLateFeeValue !== undefined) {
      updateData.defaultLateFeeValue = defaultLateFeeValue ? new Prisma.Decimal(defaultLateFeeValue) : null;
    }
    if (invoiceResolutionDate !== undefined) {
      updateData.invoiceResolutionDate = invoiceResolutionDate ? new Date(invoiceResolutionDate) : null;
    }

    return this.prisma.financialSettings.upsert({
      where: { institutionId },
      create: {
        institutionId,
        ...updateData,
      },
      update: updateData,
    });
  }
}
