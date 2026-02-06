import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { FinancialDashboardService } from './financial-dashboard.service';
import { FinancialDashboardController } from './financial-dashboard.controller';

@Module({
  imports: [PrismaModule],
  controllers: [FinancialDashboardController],
  providers: [FinancialDashboardService],
  exports: [FinancialDashboardService],
})
export class FinancialDashboardModule {}
