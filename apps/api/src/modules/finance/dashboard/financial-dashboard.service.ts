import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class FinancialDashboardService {
  constructor(private prisma: PrismaService) {}

  async getDashboardData(institutionId: string) {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    const [
      portfolioStats,
      monthlyIncome,
      monthlyExpenses,
      yearlyIncome,
      yearlyExpenses,
      recentPayments,
      overdueObligations,
      incomeByCategory,
      expenseByCategory,
    ] = await Promise.all([
      // Estadísticas de cartera
      this.getPortfolioStats(institutionId),
      // Ingresos del mes
      this.prisma.financialPayment.aggregate({
        where: { institutionId, voidedAt: null, paymentDate: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
        _count: true,
      }),
      // Egresos del mes
      this.prisma.financialExpense.aggregate({
        where: { institutionId, voidedAt: null, expenseDate: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
        _count: true,
      }),
      // Ingresos del año
      this.prisma.financialPayment.aggregate({
        where: { institutionId, voidedAt: null, paymentDate: { gte: startOfYear } },
        _sum: { amount: true },
      }),
      // Egresos del año
      this.prisma.financialExpense.aggregate({
        where: { institutionId, voidedAt: null, expenseDate: { gte: startOfYear } },
        _sum: { amount: true },
      }),
      // Últimos pagos
      this.prisma.financialPayment.findMany({
        where: { institutionId, voidedAt: null },
        include: { thirdParty: true, obligation: { include: { concept: true } } },
        orderBy: { paymentDate: 'desc' },
        take: 10,
      }),
      // Obligaciones vencidas
      this.prisma.financialObligation.findMany({
        where: { institutionId, status: { in: ['PENDING', 'PARTIAL'] }, dueDate: { lt: today } },
        include: { thirdParty: true, concept: true },
        orderBy: { dueDate: 'asc' },
        take: 10,
      }),
      // Ingresos por categoría (mes)
      this.getIncomeByCategory(institutionId, startOfMonth, endOfMonth),
      // Egresos por categoría (mes)
      this.getExpenseByCategory(institutionId, startOfMonth, endOfMonth),
    ]);

    return {
      summary: {
        monthlyIncome: monthlyIncome._sum.amount || 0,
        monthlyIncomeCount: monthlyIncome._count,
        monthlyExpenses: monthlyExpenses._sum.amount || 0,
        monthlyExpensesCount: monthlyExpenses._count,
        monthlyBalance: Number(monthlyIncome._sum.amount || 0) - Number(monthlyExpenses._sum.amount || 0),
        yearlyIncome: yearlyIncome._sum.amount || 0,
        yearlyExpenses: yearlyExpenses._sum.amount || 0,
        yearlyBalance: Number(yearlyIncome._sum.amount || 0) - Number(yearlyExpenses._sum.amount || 0),
      },
      portfolio: portfolioStats,
      recentPayments,
      overdueObligations,
      incomeByCategory,
      expenseByCategory,
    };
  }

  private async getPortfolioStats(institutionId: string) {
    const [pending, partial, overdue, paid] = await Promise.all([
      this.prisma.financialObligation.aggregate({
        where: { institutionId, status: 'PENDING' },
        _sum: { balance: true },
        _count: true,
      }),
      this.prisma.financialObligation.aggregate({
        where: { institutionId, status: 'PARTIAL' },
        _sum: { balance: true },
        _count: true,
      }),
      this.prisma.financialObligation.aggregate({
        where: { institutionId, status: 'OVERDUE' },
        _sum: { balance: true },
        _count: true,
      }),
      this.prisma.financialObligation.aggregate({
        where: { institutionId, status: 'PAID' },
        _sum: { totalAmount: true },
        _count: true,
      }),
    ]);

    return {
      pending: { count: pending._count, amount: pending._sum.balance || 0 },
      partial: { count: partial._count, amount: partial._sum.balance || 0 },
      overdue: { count: overdue._count, amount: overdue._sum.balance || 0 },
      paid: { count: paid._count, amount: paid._sum.totalAmount || 0 },
      totalPortfolio: Number(pending._sum.balance || 0) + Number(partial._sum.balance || 0) + Number(overdue._sum.balance || 0),
    };
  }

  private async getIncomeByCategory(institutionId: string, startDate: Date, endDate: Date) {
    const payments = await this.prisma.financialPayment.findMany({
      where: { institutionId, voidedAt: null, paymentDate: { gte: startDate, lte: endDate } },
      include: { obligation: { include: { concept: { include: { category: true } } } } },
    });

    const byCategory: Record<string, { name: string; amount: number; count: number }> = {};
    for (const payment of payments) {
      const categoryName = payment.obligation?.concept?.category?.name || 'Sin categoría';
      if (!byCategory[categoryName]) {
        byCategory[categoryName] = { name: categoryName, amount: 0, count: 0 };
      }
      byCategory[categoryName].amount += Number(payment.amount);
      byCategory[categoryName].count++;
    }

    return Object.values(byCategory).sort((a, b) => b.amount - a.amount);
  }

  private async getExpenseByCategory(institutionId: string, startDate: Date, endDate: Date) {
    const expenses = await this.prisma.financialExpense.findMany({
      where: { institutionId, voidedAt: null, expenseDate: { gte: startDate, lte: endDate } },
      include: { category: true },
    });

    const byCategory: Record<string, { name: string; amount: number; count: number }> = {};
    for (const expense of expenses) {
      const categoryName = expense.category?.name || 'Sin categoría';
      if (!byCategory[categoryName]) {
        byCategory[categoryName] = { name: categoryName, amount: 0, count: 0 };
      }
      byCategory[categoryName].amount += Number(expense.amount);
      byCategory[categoryName].count++;
    }

    return Object.values(byCategory).sort((a, b) => b.amount - a.amount);
  }
}
