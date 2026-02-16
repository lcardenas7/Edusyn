import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class FinancialReportsService {
  constructor(private prisma: PrismaService) {}

  // Cartera por grado - Resumen simplificado
  async getPortfolioByGrade(institutionId: string) {
    // Obtener todas las obligaciones con saldo pendiente
    // Incluye: PARTIAL, OVERDUE, y PENDING (con o sin vencimiento)
    const obligations = await this.prisma.financialObligation.groupBy({
      by: ['thirdPartyId'],
      where: { 
        institutionId,
        status: { notIn: ['PAID', 'CANCELLED'] },
      },
      _sum: { balance: true, totalAmount: true },
      _count: true,
    });

    const totalPortfolio = obligations.reduce((sum, o) => sum + Number(o._sum.balance || 0), 0);
    const totalCharged = obligations.reduce((sum, o) => sum + Number(o._sum.totalAmount || 0), 0);

    return {
      totalThirdParties: obligations.length,
      totalObligations: obligations.reduce((sum, o) => sum + o._count, 0),
      totalCharged,
      totalPortfolio,
      byThirdParty: obligations.slice(0, 20), // Top 20
    };
  }

  // Top morosos
  // Prioriza obligaciones vencidas (OVERDUE o PENDING con dueDate < now)
  async getTopDebtors(institutionId: string, limit = 20) {
    const now = new Date();
    const grouped = await this.prisma.financialObligation.groupBy({
      by: ['thirdPartyId'],
      where: {
        institutionId,
        status: { notIn: ['PAID', 'CANCELLED'] },
        OR: [
          { status: 'OVERDUE' },
          { status: 'PARTIAL' },
          { status: 'PENDING', dueDate: { lt: now } },
        ],
      },
      _sum: { balance: true },
      orderBy: { _sum: { balance: 'desc' } },
      take: limit,
    });

    // Enrich with third party names
    const thirdPartyIds = grouped.map(g => g.thirdPartyId);
    const thirdParties = await this.prisma.financialThirdParty.findMany({
      where: { id: { in: thirdPartyIds } },
      select: { id: true, name: true, document: true, type: true },
    });
    const tpMap = new Map(thirdParties.map(tp => [tp.id, tp]));

    return grouped.map(g => ({
      thirdPartyId: g.thirdPartyId,
      thirdPartyName: tpMap.get(g.thirdPartyId)?.name || 'Desconocido',
      thirdPartyDocument: tpMap.get(g.thirdPartyId)?.document || null,
      thirdPartyType: tpMap.get(g.thirdPartyId)?.type || null,
      _sum: g._sum,
    }));
  }

  // Balance mensual
  async getMonthlyBalance(institutionId: string, year: number) {
    const months: Array<{ month: number; income: number; expense: number; balance: number }> = [];
    for (let month = 1; month <= 12; month++) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const [income, expense] = await Promise.all([
        this.prisma.financialPayment.aggregate({
          where: { institutionId, voidedAt: null, paymentDate: { gte: startDate, lte: endDate } },
          _sum: { amount: true },
        }),
        this.prisma.financialExpense.aggregate({
          where: { institutionId, voidedAt: null, expenseDate: { gte: startDate, lte: endDate } },
          _sum: { amount: true },
        }),
      ]);

      months.push({
        month,
        income: Number(income._sum.amount || 0),
        expense: Number(expense._sum.amount || 0),
        balance: Number(income._sum.amount || 0) - Number(expense._sum.amount || 0),
      });
    }

    return months;
  }

  // Rentabilidad por concepto
  async getProfitabilityByConcept(institutionId: string) {
    const concepts = await this.prisma.chargeConcept.findMany({
      where: { institutionId },
      include: { category: true },
    });

    const result: { conceptId: string; conceptName: string; categoryName: string; totalCharged: number; totalCollected: number; totalExpenses: number; profit: number; obligationCount: number }[] = [];
    for (const concept of concepts) {
      const [obligations, expenses] = await Promise.all([
        this.prisma.financialObligation.aggregate({
          where: { conceptId: concept.id },
          _sum: { paidAmount: true, totalAmount: true },
          _count: true,
        }),
        this.prisma.financialExpense.aggregate({
          where: { categoryId: concept.categoryId },
          _sum: { amount: true },
        }),
      ]);

      result.push({
        conceptId: concept.id,
        conceptName: concept.name,
        categoryName: concept.category.name,
        totalCharged: Number(obligations._sum.totalAmount || 0),
        totalCollected: Number(obligations._sum.paidAmount || 0),
        totalExpenses: Number(expenses._sum.amount || 0),
        profit: Number(obligations._sum.paidAmount || 0) - Number(expenses._sum.amount || 0),
        obligationCount: obligations._count,
      });
    }

    return result.sort((a, b) => b.profit - a.profit);
  }

  // Historial financiero de un estudiante
  async getStudentFinancialHistory(institutionId: string, studentId: string) {
    const thirdParty = await this.prisma.financialThirdParty.findFirst({
      where: { institutionId, type: 'STUDENT', referenceId: studentId },
    });

    if (!thirdParty) return { obligations: [], payments: [], summary: null };

    const [obligations, payments] = await Promise.all([
      this.prisma.financialObligation.findMany({
        where: { thirdPartyId: thirdParty.id },
        include: { concept: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.financialPayment.findMany({
        where: { thirdPartyId: thirdParty.id, voidedAt: null },
        include: { obligation: { include: { concept: true } } },
        orderBy: { paymentDate: 'desc' },
      }),
    ]);

    const summary = {
      totalCharged: obligations.reduce((sum, o) => sum + Number(o.totalAmount), 0),
      totalPaid: obligations.reduce((sum, o) => sum + Number(o.paidAmount), 0),
      totalPending: obligations.reduce((sum, o) => sum + Number(o.balance), 0),
    };

    return { thirdParty, obligations, payments, summary };
  }
}
