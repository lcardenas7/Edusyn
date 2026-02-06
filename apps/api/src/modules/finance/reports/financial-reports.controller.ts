import { Controller, Get, Query, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FinancialReportsService } from './financial-reports.service';

@Controller('finance/reports')
@UseGuards(JwtAuthGuard)
export class FinancialReportsController {
  constructor(private readonly reportsService: FinancialReportsService) {}

  @Get('portfolio-by-grade')
  async getPortfolioByGrade(@Request() req) {
    return this.reportsService.getPortfolioByGrade(req.user.institutionId);
  }

  @Get('top-debtors')
  async getTopDebtors(@Request() req, @Query('limit') limit?: string) {
    return this.reportsService.getTopDebtors(req.user.institutionId, limit ? parseInt(limit) : 20);
  }

  @Get('monthly-balance')
  async getMonthlyBalance(@Request() req, @Query('year') year?: string) {
    return this.reportsService.getMonthlyBalance(req.user.institutionId, year ? parseInt(year) : new Date().getFullYear());
  }

  @Get('profitability')
  async getProfitabilityByConcept(@Request() req) {
    return this.reportsService.getProfitabilityByConcept(req.user.institutionId);
  }

  @Get('student/:studentId')
  async getStudentFinancialHistory(@Request() req, @Param('studentId') studentId: string) {
    return this.reportsService.getStudentFinancialHistory(req.user.institutionId, studentId);
  }
}
