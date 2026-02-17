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
    // Numeración
    invoicePrefix?: string;
    receiptPrefix?: string;
    // Mora
    defaultLateFeeType?: string;
    defaultLateFeeValue?: number;
    defaultGracePeriodDays?: number;
    // Modo facturación
    billingMode?: string;
    // Datos fiscales / DIAN
    taxId?: string;
    businessName?: string;
    taxRegime?: string;
    ciiu?: string;
    economicActivity?: string;
    // Resolución DIAN
    invoiceResolution?: string;
    invoiceResolutionDate?: string;
    invoiceResolutionPrefix?: string;
    invoiceRangeFrom?: number;
    invoiceRangeTo?: number;
    // Visual
    invoiceLogoUrl?: string;
    invoicePageSize?: string;
    invoicePrimaryColor?: string;
    invoiceSecondaryColor?: string;
    invoiceFooterText?: string;
    invoiceShowQR?: boolean;
    invoiceShowBankAccounts?: boolean;
    // Contacto
    invoiceCity?: string;
    invoiceAddress?: string;
    invoicePhone?: string;
    invoiceEmail?: string;
    // Cuentas bancarias
    bankAccounts?: any;
    // Notificaciones
    sendPaymentReminders?: boolean;
    reminderDaysBefore?: number;
    // Proveedor electrónico (futuro)
    electronicProvider?: string;
    electronicProviderKey?: string;
    electronicProviderUrl?: string;
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
