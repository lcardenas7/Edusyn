import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FinalRecoveryService } from './final-recovery.service';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';

@Controller('final-recovery')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinalRecoveryController {
  constructor(
    private readonly finalRecoveryService: FinalRecoveryService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('detect')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async detectAreasNeedingRecovery(
    @Req() req: any,
    @Query('academicYearId') academicYearId: string,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.finalRecoveryService.detectAreasNeedingRecovery(academicYearId, instId);
  }

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async create(@Body() data: any) {
    return this.finalRecoveryService.create(data);
  }

  @Get('by-year')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async findByYear(
    @Query('academicYearId') academicYearId: string,
    @Query('status') status?: string,
  ) {
    return this.finalRecoveryService.findByYear(academicYearId, status as any);
  }

  @Get('by-student/:studentEnrollmentId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async findByStudent(@Param('studentEnrollmentId') studentEnrollmentId: string) {
    return this.finalRecoveryService.findByStudent(studentEnrollmentId);
  }

  @Patch(':id/plan')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async updatePlan(@Param('id') id: string, @Body() data: any) {
    return this.finalRecoveryService.updatePlan(id, data);
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
    return this.finalRecoveryService.registerResult(id, data, instId);
  }

  @Patch(':id/approve')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async approveRecovery(
    @Param('id') id: string,
    @Body() data: any,
    @Req() req: any,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.finalRecoveryService.approveRecovery(
      id,
      { ...data, approvedById: req.user.id },
      instId,
    );
  }

  @Get('stats')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getStats(@Query('academicYearId') academicYearId: string) {
    return this.finalRecoveryService.getRecoveryStats(academicYearId);
  }
}
