import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  async findAll(institutionId: string, filters?: {
    categoryId?: string;
    providerId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }) {
    return this.prisma.financialExpense.findMany({
      where: {
        institutionId,
        voidedAt: null,
        ...(filters?.categoryId && { categoryId: filters.categoryId }),
        ...(filters?.providerId && { providerId: filters.providerId }),
        ...(filters?.dateFrom || filters?.dateTo ? {
          expenseDate: {
            ...(filters.dateFrom && { gte: filters.dateFrom }),
            ...(filters.dateTo && { lte: filters.dateTo }),
          },
        } : {}),
      },
      include: {
        category: true,
        provider: true,
        registeredBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { expenseDate: 'desc' },
    });
  }

  async findOne(id: string, institutionId: string) {
    const expense = await this.prisma.financialExpense.findFirst({
      where: { id, institutionId },
      include: {
        category: true,
        provider: true,
        registeredBy: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!expense) {
      throw new NotFoundException('Egreso no encontrado');
    }

    return expense;
  }

  async create(institutionId: string, userId: string, data: {
    categoryId: string;
    providerId?: string;
    description: string;
    amount: number;
    expenseDate?: Date;
    invoiceNumber?: string;
    invoiceDate?: Date;
    paymentMethod?: string;
    transactionRef?: string;
    notes?: string;
  }) {
    return this.prisma.financialExpense.create({
      data: {
        institutionId,
        categoryId: data.categoryId,
        providerId: data.providerId,
        description: data.description,
        amount: new Prisma.Decimal(data.amount),
        expenseDate: data.expenseDate || new Date(),
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.invoiceDate,
        paymentMethod: data.paymentMethod as any,
        transactionRef: data.transactionRef,
        notes: data.notes,
        registeredById: userId,
      },
      include: { category: true, provider: true },
    });
  }

  async approve(id: string, institutionId: string, userId: string) {
    await this.findOne(id, institutionId);

    return this.prisma.financialExpense.update({
      where: { id },
      data: {
        approvedById: userId,
        approvedAt: new Date(),
      },
    });
  }

  async void(id: string, institutionId: string, userId: string, reason: string) {
    await this.findOne(id, institutionId);

    return this.prisma.financialExpense.update({
      where: { id },
      data: {
        voidedAt: new Date(),
        voidedById: userId,
        voidReason: reason,
      },
    });
  }

  async getExpenseStats(institutionId: string, dateFrom?: Date, dateTo?: Date) {
    const where: any = { institutionId, voidedAt: null };
    if (dateFrom || dateTo) {
      where.expenseDate = {};
      if (dateFrom) where.expenseDate.gte = dateFrom;
      if (dateTo) where.expenseDate.lte = dateTo;
    }

    const [total, byCategory] = await Promise.all([
      this.prisma.financialExpense.aggregate({
        where,
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.financialExpense.groupBy({
        by: ['categoryId'],
        where,
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return { total, byCategory };
  }
}
