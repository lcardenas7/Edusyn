import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FinancialDashboardService } from './financial-dashboard.service';

@Controller('finance/dashboard')
@UseGuards(JwtAuthGuard)
export class FinancialDashboardController {
  constructor(private readonly dashboardService: FinancialDashboardService) {}

  @Get()
  async getDashboardData(@Request() req) {
    return this.dashboardService.getDashboardData(req.user.institutionId);
  }
}
