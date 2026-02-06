import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PerformanceGeneratorService } from './performance-generator.service';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';

@Controller('performance-generator')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PerformanceGeneratorController {
  constructor(
    private readonly generatorService: PerformanceGeneratorService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('student')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async generateStudentPerformances(
    @Request() req: any,
    @Query('studentEnrollmentId') studentEnrollmentId: string,
    @Query('academicTermId') academicTermId: string,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.generatorService.generateStudentPerformances(
      studentEnrollmentId,
      academicTermId,
      instId,
    );
  }

  @Get('report')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getPerformanceReport(
    @Request() req: any,
    @Query('academicTermId') academicTermId: string,
    @Query('institutionId') institutionId?: string,
    @Query('groupId') groupId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.generatorService.getPerformanceReport(
      instId,
      academicTermId,
      groupId,
    );
  }

  @Get('scale')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getPerformanceScale(@Request() req: any, @Query('institutionId') institutionId?: string) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.generatorService.getPerformanceScale(instId);
  }
}
