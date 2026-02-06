import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class FinancialReportsService {
  constructor(private prisma: PrismaService) {}

  // Cartera por grado - Resumen simplificado
  async getPortfolioByGrade(institutionId: string) {
    // Obtener todas las obligaciones pendientes agrupadas
    const obligations = await this.prisma.financialObligation.groupBy({
      by: ['thirdPartyId'],
      where: { 
        institutionId, 
        status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } 
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
  async getTopDebtors(institutionId: string, limit = 20) {
    return this.prisma.financialObligation.groupBy({
      by: ['thirdPartyId'],
      where: { institutionId, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
      _sum: { balance: true },
      orderBy: { _sum: { balance: 'desc' } },
      take: limit,
    });
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
        income: income._sum.amount || 0,
        expense: expense._sum.amount || 0,
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

    const result = [];
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
        totalCharged: obligations._sum.totalAmount || 0,
        totalCollected: obligations._sum.paidAmount || 0,
        totalExpenses: expenses._sum.amount || 0,
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
