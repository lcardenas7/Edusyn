import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PeriodRecoveryService } from './period-recovery.service';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';

@Controller('period-recovery')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PeriodRecoveryController {
  constructor(
    private readonly periodRecoveryService: PeriodRecoveryService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('detect')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async detectStudentsNeedingRecovery(
    @Req() req: any,
    @Query('academicTermId') academicTermId: string,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.periodRecoveryService.detectStudentsNeedingRecovery(academicTermId, instId);
  }

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async create(@Body() data: any, @Req() req: any) {
    return this.periodRecoveryService.create({
      ...data,
      assignedById: req.user.id,
    });
  }

  @Get('by-term')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async findByTerm(
    @Query('academicTermId') academicTermId: string,
    @Query('status') status?: string,
  ) {
    return this.periodRecoveryService.findByTerm(academicTermId, status as any);
  }

  @Get('by-student/:studentEnrollmentId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async findByStudent(@Param('studentEnrollmentId') studentEnrollmentId: string) {
    return this.periodRecoveryService.findByStudent(studentEnrollmentId);
  }

  @Patch(':id/activity')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async updateActivity(@Param('id') id: string, @Body() data: any) {
    return this.periodRecoveryService.updateActivity(id, data);
  }

  @Patch(':id/result')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async registerResult(
    @Param('id') id: string,
    @Body() data: any,
    @Req() req: any,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.periodRecoveryService.registerResult(
      id,
      { ...data, evaluatedById: req.user.id },
      instId,
    );
  }

  @Get('stats')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getStats(@Query('academicTermId') academicTermId: string) {
    return this.periodRecoveryService.getRecoveryStats(academicTermId);
  }
}
