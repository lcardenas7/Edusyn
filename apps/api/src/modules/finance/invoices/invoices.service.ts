import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  async findAll(institutionId: string, filters?: {
    thirdPartyId?: string;
    status?: string;
    type?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || 50, 200);
    const skip = (page - 1) * limit;

    const where: Prisma.FinancialInvoiceWhereInput = {
      institutionId,
      ...(filters?.thirdPartyId && { thirdPartyId: filters.thirdPartyId }),
      ...(filters?.status && { status: filters.status as any }),
      ...(filters?.type && { type: filters.type as any }),
    };

    const [data, total] = await Promise.all([
      this.prisma.financialInvoice.findMany({
        where,
        include: {
          thirdParty: { select: { id: true, name: true, document: true } },
          _count: { select: { items: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { issueDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.financialInvoice.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, institutionId: string) {
    const invoice = await this.prisma.financialInvoice.findFirst({
      where: { id, institutionId },
      include: {
        thirdParty: true,
        items: { include: { obligation: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Factura no encontrada');
    }

    return invoice;
  }

  async create(institutionId: string, userId: string, data: {
    thirdPartyId: string;
    type: 'INCOME' | 'EXPENSE';
    items: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      obligationId?: string;
    }>;
    dueDate?: Date;
    notes?: string;
  }) {
    const invoiceNumber = await this.generateInvoiceNumber(institutionId);

    let subtotal = 0;
    const itemsData = data.items.map(item => {
      const total = item.quantity * item.unitPrice;
      subtotal += total;
      return {
        description: item.description,
        quantity: item.quantity,
        unitPrice: new Prisma.Decimal(item.unitPrice),
        total: new Prisma.Decimal(total),
        obligationId: item.obligationId,
      };
    });

    return this.prisma.financialInvoice.create({
      data: {
        institutionId,
        thirdPartyId: data.thirdPartyId,
        invoiceNumber,
        type: data.type,
        status: 'DRAFT',
        subtotal: new Prisma.Decimal(subtotal),
        total: new Prisma.Decimal(subtotal),
        dueDate: data.dueDate,
        notes: data.notes,
        createdById: userId,
        items: { create: itemsData },
      },
      include: { thirdParty: true, items: true },
    });
  }

  async issue(id: string, institutionId: string) {
    await this.findOne(id, institutionId);

    return this.prisma.financialInvoice.update({
      where: { id },
      data: { status: 'ISSUED', issueDate: new Date() },
    });
  }

  async cancel(id: string, institutionId: string, userId: string, reason: string) {
    await this.findOne(id, institutionId);

    return this.prisma.financialInvoice.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledById: userId,
        cancelledAt: new Date(),
        cancelReason: reason,
      },
    });
  }

  private async generateInvoiceNumber(institutionId: string): Promise<string> {
    const settings = await this.prisma.financialSettings.findUnique({
      where: { institutionId },
    });

    const prefix = settings?.invoicePrefix || 'FAC';
    const nextNumber = settings?.invoiceNextNumber || 1;

    await this.prisma.financialSettings.upsert({
      where: { institutionId },
      create: { institutionId, invoiceNextNumber: nextNumber + 1 },
      update: { invoiceNextNumber: nextNumber + 1 },
    });

    return `${prefix}-${String(nextNumber).padStart(6, '0')}`;
  }
}
