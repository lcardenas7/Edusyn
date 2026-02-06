import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';

// Submódulos
import { ThirdPartiesModule } from './third-parties/third-parties.module';
import { CategoriesModule } from './categories/categories.module';
import { ConceptsModule } from './concepts/concepts.module';
import { ObligationsModule } from './obligations/obligations.module';
import { PaymentsModule } from './payments/payments.module';
import { ExpensesModule } from './expenses/expenses.module';
import { InvoicesModule } from './invoices/invoices.module';
import { FinancialReportsModule } from './reports/financial-reports.module';
import { FinancialSettingsModule } from './settings/financial-settings.module';
import { FinancialDashboardModule } from './dashboard/financial-dashboard.module';

@Module({
  imports: [
    PrismaModule,
    ThirdPartiesModule,
    CategoriesModule,
    ConceptsModule,
    ObligationsModule,
    PaymentsModule,
    ExpensesModule,
    InvoicesModule,
    FinancialReportsModule,
    FinancialSettingsModule,
    FinancialDashboardModule,
  ],
  exports: [
    ThirdPartiesModule,
    CategoriesModule,
    ConceptsModule,
    ObligationsModule,
    PaymentsModule,
    ExpensesModule,
    InvoicesModule,
    FinancialReportsModule,
    FinancialSettingsModule,
    FinancialDashboardModule,
  ],
})
export class FinanceModule {}
