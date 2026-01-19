import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { StatisticsService } from './statistics.service';

@Controller('statistics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getFullStatistics(
    @Query('institutionId') institutionId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('academicTermId') academicTermId?: string,
  ) {
    return this.statisticsService.getFullStatistics(institutionId, academicYearId, academicTermId);
  }

  @Get('general')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getGeneralStats(
    @Query('institutionId') institutionId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.statisticsService.getGeneralStats(institutionId, academicYearId);
  }

  @Get('performance-distribution')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getPerformanceDistribution(
    @Query('institutionId') institutionId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('academicTermId') academicTermId?: string,
  ) {
    return this.statisticsService.getPerformanceDistribution(institutionId, academicYearId, academicTermId);
  }

  @Get('subjects')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getSubjectStats(
    @Query('institutionId') institutionId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('academicTermId') academicTermId?: string,
  ) {
    return this.statisticsService.getSubjectStats(institutionId, academicYearId, academicTermId);
  }

  @Get('groups')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getGroupStats(
    @Query('institutionId') institutionId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('academicTermId') academicTermId?: string,
  ) {
    return this.statisticsService.getGroupStats(institutionId, academicYearId, academicTermId);
  }
}
