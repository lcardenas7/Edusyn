import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { StatisticsService } from './statistics.service';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';

@Controller('statistics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StatisticsController {
  constructor(
    private readonly statisticsService: StatisticsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getFullStatistics(
    @Request() req: any,
    @Query('institutionId') institutionId?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('academicTermId') academicTermId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.statisticsService.getFullStatistics(instId, academicYearId, academicTermId);
  }

  @Get('general')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getGeneralStats(
    @Request() req: any,
    @Query('institutionId') institutionId?: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.statisticsService.getGeneralStats(instId, academicYearId);
  }

  @Get('performance-distribution')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getPerformanceDistribution(
    @Request() req: any,
    @Query('institutionId') institutionId?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('academicTermId') academicTermId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.statisticsService.getPerformanceDistribution(instId, academicYearId, academicTermId);
  }

  @Get('subjects')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getSubjectStats(
    @Request() req: any,
    @Query('institutionId') institutionId?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('academicTermId') academicTermId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.statisticsService.getSubjectStats(instId, academicYearId, academicTermId);
  }

  @Get('groups')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getGroupStats(
    @Request() req: any,
    @Query('institutionId') institutionId?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('academicTermId') academicTermId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.statisticsService.getGroupStats(instId, academicYearId, academicTermId);
  }
}
