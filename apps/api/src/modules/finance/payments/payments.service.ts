import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PaymentMethod, Prisma } from '@prisma/client';
import { ObligationsService } from '../obligations/obligations.service';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private obligationsService: ObligationsService,
  ) {}

  async findAll(institutionId: string, filters?: {
    thirdPartyId?: string;
    obligationId?: string;
    paymentMethod?: PaymentMethod;
    dateFrom?: Date;
    dateTo?: Date;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || 100, 500);
    const skip = (page - 1) * limit;

    const where: Prisma.FinancialPaymentWhereInput = {
      institutionId,
      voidedAt: null,
      ...(filters?.thirdPartyId && { thirdPartyId: filters.thirdPartyId }),
      ...(filters?.obligationId && { obligationId: filters.obligationId }),
      ...(filters?.paymentMethod && { paymentMethod: filters.paymentMethod }),
      ...(filters?.dateFrom || filters?.dateTo ? {
        paymentDate: {
          ...(filters.dateFrom && { gte: filters.dateFrom }),
          ...(filters.dateTo && { lte: filters.dateTo }),
        },
      } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.financialPayment.findMany({
        where,
        include: {
          thirdParty: { select: { id: true, name: true, document: true } },
          obligation: { select: { id: true, conceptId: true, concept: { select: { id: true, name: true } } } },
          receivedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { paymentDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.financialPayment.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, institutionId: string) {
    const payment = await this.prisma.financialPayment.findFirst({
      where: { id, institutionId },
      include: {
        thirdParty: true,
        obligation: { include: { concept: true } },
        receivedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!payment) {
      throw new NotFoundException('Pago no encontrado');
    }

    return payment;
  }

  async create(institutionId: string, userId: string, data: {
    obligationId?: string;
    thirdPartyId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    transactionRef?: string;
    notes?: string;
  }) {
    // Validar que el tercero existe
    const thirdParty = await this.prisma.financialThirdParty.findFirst({
      where: { id: data.thirdPartyId, institutionId },
    });

    if (!thirdParty) {
      throw new NotFoundException('Tercero no encontrado');
    }

    // Si hay obligación, validar
    if (data.obligationId) {
      const obligation = await this.prisma.financialObligation.findFirst({
        where: { id: data.obligationId, institutionId },
      });

      if (!obligation) {
        throw new NotFoundException('Obligación no encontrada');
      }

      if (obligation.status === 'PAID' || obligation.status === 'CANCELLED') {
        throw new BadRequestException('La obligación ya está pagada o cancelada');
      }
    }

    const receiptNumber = await this.generateReceiptNumber(institutionId);

    // Transacción atómica: crear pago + actualizar obligación + actualizar factura
    const payment = await this.prisma.$transaction(async (tx) => {
      const createdPayment = await tx.financialPayment.create({
        data: {
          institutionId,
          thirdPartyId: data.thirdPartyId,
          obligationId: data.obligationId,
          amount: new Prisma.Decimal(data.amount),
          paymentMethod: data.paymentMethod,
          transactionRef: data.transactionRef,
          receiptNumber,
          notes: data.notes,
          receivedById: userId,
        },
        include: {
          thirdParty: true,
          obligation: true,
        },
      });

      // Actualizar saldo de la obligación si aplica
      if (data.obligationId) {
        // Inline updateBalance logic dentro de la transacción
        const obligation = await tx.financialObligation.findUnique({
          where: { id: data.obligationId },
        });

        if (obligation) {
          const newPaidAmount = Number(obligation.paidAmount) + data.amount;
          const newBalance = Number(obligation.totalAmount) - newPaidAmount;
          const newStatus = newBalance <= 0 ? 'PAID' : (newPaidAmount > 0 ? 'PARTIAL' : obligation.status);

          await tx.financialObligation.update({
            where: { id: data.obligationId },
            data: {
              paidAmount: new Prisma.Decimal(newPaidAmount),
              balance: new Prisma.Decimal(Math.max(0, newBalance)),
              status: newStatus,
              paidDate: newStatus === 'PAID' ? new Date() : null,
            },
          });

          // Verificar si hay facturas asociadas y marcarlas como PAID
          await this.checkAndUpdateInvoiceStatusTx(tx, data.obligationId);
        }
      }

      return createdPayment;
    });

    return payment;
  }

  async void(id: string, institutionId: string, userId: string, reason: string) {
    const payment = await this.findOne(id, institutionId);

    if (payment.voidedAt) {
      throw new BadRequestException('El pago ya está anulado');
    }

    const voidedPayment = await this.prisma.financialPayment.update({
      where: { id },
      data: {
        voidedAt: new Date(),
        voidedById: userId,
        voidReason: reason,
      },
    });

    // Revertir el saldo de la obligación si aplica
    if (payment.obligationId) {
      await this.obligationsService.updateBalance(payment.obligationId, -Number(payment.amount));
    }

    return voidedPayment;
  }

  // Cierre de caja diario
  async closeCashRegister(institutionId: string, userId: string, data: {
    closeDate: Date;
    physicalCash?: number;
    notes?: string;
  }) {
    const startOfDay = new Date(data.closeDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(data.closeDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Obtener totales por método de pago
    const payments = await this.prisma.financialPayment.groupBy({
      by: ['paymentMethod'],
      where: {
        institutionId,
        voidedAt: null,
        paymentDate: { gte: startOfDay, lte: endOfDay },
      },
      _sum: { amount: true },
    });

    let cashTotal = 0, transferTotal = 0, cardTotal = 0, otherTotal = 0;

    for (const p of payments) {
      const amount = Number(p._sum.amount || 0);
      switch (p.paymentMethod) {
        case 'CASH':
          cashTotal = amount;
          break;
        case 'TRANSFER':
        case 'PSE':
        case 'NEQUI':
        case 'DAVIPLATA':
          transferTotal += amount;
          break;
        case 'CARD':
          cardTotal = amount;
          break;
        default:
          otherTotal += amount;
      }
    }

    const grandTotal = cashTotal + transferTotal + cardTotal + otherTotal;
    const difference = data.physicalCash !== undefined ? data.physicalCash - cashTotal : null;

    return this.prisma.cashRegisterClose.upsert({
      where: {
        institutionId_closeDate: {
          institutionId,
          closeDate: startOfDay,
        },
      },
      create: {
        institutionId,
        closeDate: startOfDay,
        cashTotal: new Prisma.Decimal(cashTotal),
        transferTotal: new Prisma.Decimal(transferTotal),
        cardTotal: new Prisma.Decimal(cardTotal),
        otherTotal: new Prisma.Decimal(otherTotal),
        grandTotal: new Prisma.Decimal(grandTotal),
        physicalCash: data.physicalCash ? new Prisma.Decimal(data.physicalCash) : null,
        difference: difference !== null ? new Prisma.Decimal(difference) : null,
        notes: data.notes,
        closedById: userId,
      },
      update: {
        cashTotal: new Prisma.Decimal(cashTotal),
        transferTotal: new Prisma.Decimal(transferTotal),
        cardTotal: new Prisma.Decimal(cardTotal),
        otherTotal: new Prisma.Decimal(otherTotal),
        grandTotal: new Prisma.Decimal(grandTotal),
        physicalCash: data.physicalCash ? new Prisma.Decimal(data.physicalCash) : null,
        difference: difference !== null ? new Prisma.Decimal(difference) : null,
        notes: data.notes,
        closedById: userId,
        closedAt: new Date(),
      },
    });
  }

  // Estadísticas de recaudo
  async getCollectionStats(institutionId: string, dateFrom?: Date, dateTo?: Date) {
    const where: any = {
      institutionId,
      voidedAt: null,
    };

    if (dateFrom || dateTo) {
      where.paymentDate = {};
      if (dateFrom) where.paymentDate.gte = dateFrom;
      if (dateTo) where.paymentDate.lte = dateTo;
    }

    const [total, byMethod, byDay] = await Promise.all([
      this.prisma.financialPayment.aggregate({
        where,
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.financialPayment.groupBy({
        by: ['paymentMethod'],
        where,
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.$queryRaw`
        SELECT DATE(payment_date) as date, SUM(amount) as total
        FROM "FinancialPayment"
        WHERE institution_id = ${institutionId}
          AND voided_at IS NULL
          ${dateFrom ? Prisma.sql`AND payment_date >= ${dateFrom}` : Prisma.empty}
          ${dateTo ? Prisma.sql`AND payment_date <= ${dateTo}` : Prisma.empty}
        GROUP BY DATE(payment_date)
        ORDER BY date DESC
        LIMIT 30
      `,
    ]);

    return {
      total: {
        amount: total._sum.amount || 0,
        count: total._count,
      },
      byMethod,
      byDay,
    };
  }

  private async checkAndUpdateInvoiceStatusTx(
    tx: Prisma.TransactionClient,
    obligationId: string,
  ): Promise<void> {
    // Buscar items de factura que referencian esta obligación
    const invoiceItems = await tx.financialInvoiceItem.findMany({
      where: { obligationId },
      select: { invoiceId: true },
    });

    if (invoiceItems.length === 0) return;

    // Obtener IDs únicos de facturas
    const invoiceIds = [...new Set(invoiceItems.map(item => item.invoiceId))];

    for (const invoiceId of invoiceIds) {
      // Obtener todas las obligaciones vinculadas a esta factura
      const allItems = await tx.financialInvoiceItem.findMany({
        where: { invoiceId, obligationId: { not: null } },
        include: { obligation: { select: { status: true } } },
      });

      // Si todas las obligaciones están PAID, marcar factura como PAID
      const allPaid = allItems.every(item => item.obligation?.status === 'PAID');

      if (allPaid) {
        await tx.financialInvoice.update({
          where: { id: invoiceId },
          data: { status: 'PAID', paidDate: new Date() },
        });
      }
    }
  }

  private async generateReceiptNumber(institutionId: string): Promise<string> {
    const result = await this.prisma.$transaction(async (tx) => {
      // Ensure settings exist with default values
      await tx.financialSettings.upsert({
        where: { institutionId },
        create: { institutionId, receiptNextNumber: 1 },
        update: {},
      });

      // Atomic increment and return updated record
      const updated = await tx.financialSettings.update({
        where: { institutionId },
        data: { receiptNextNumber: { increment: 1 } },
      });

      return {
        prefix: updated.receiptPrefix || 'REC',
        number: updated.receiptNextNumber,
      };
    });

    return `${result.prefix}-${String(result.number).padStart(6, '0')}`;
  }
}
