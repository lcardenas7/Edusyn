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
  }) {
    return this.prisma.financialSettings.upsert({
      where: { institutionId },
      create: {
        institutionId,
        ...data,
        defaultLateFeeValue: data.defaultLateFeeValue 
          ? new Prisma.Decimal(data.defaultLateFeeValue) 
          : null,
      },
      update: {
        ...data,
        defaultLateFeeValue: data.defaultLateFeeValue !== undefined
          ? (data.defaultLateFeeValue ? new Prisma.Decimal(data.defaultLateFeeValue) : null)
          : undefined,
      },
    });
  }
}
