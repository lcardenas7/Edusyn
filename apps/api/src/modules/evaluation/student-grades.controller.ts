import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BulkUpsertGradesDto, UpsertStudentGradeDto } from './dto/upsert-student-grade.dto';
import { StudentGradesService } from './student-grades.service';
import { actorFromRequest } from './grade-audit-actor.util';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';
import { RequireTenantContext } from '../auth/decorators/require-tenant-context.decorator';
import { ValidateTenantContextGuard } from '../../common/guards/validate-tenant-context.guard';

@Controller('student-grades')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentGradesController {
  constructor(
    private readonly studentGradesService: StudentGradesService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  @UseGuards(ValidateTenantContextGuard)
  @RequireTenantContext()
  async upsert(@Body() dto: UpsertStudentGradeDto, @Request() req: any) {
    return this.studentGradesService.upsert(dto, actorFromRequest(req));
  }

  @Post('bulk')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  @UseGuards(ValidateTenantContextGuard)
  @RequireTenantContext()
  async bulkUpsert(@Body() dto: BulkUpsertGradesDto, @Request() req: any) {
    return this.studentGradesService.bulkUpsert(dto.evaluativeActivityId, dto.grades, actorFromRequest(req));
  }

  @Get('by-activity')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getByActivity(@Query('evaluativeActivityId') evaluativeActivityId: string) {
    return this.studentGradesService.getByActivity(evaluativeActivityId);
  }

  @Get('by-student')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE', 'ACUDIENTE')
  async getByStudent(@Query('studentEnrollmentId') studentEnrollmentId: string) {
    return this.studentGradesService.getByStudent(studentEnrollmentId);
  }

  @Get('component-average')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE', 'ACUDIENTE')
  async getComponentAverage(
    @Request() req: any,
    @Query('studentEnrollmentId') studentEnrollmentId: string,
    @Query('academicTermId') academicTermId: string,
    @Query('componentId') componentId: string,
  ) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    const average = await this.studentGradesService.calculateComponentAverage(
      studentEnrollmentId,
      academicTermId,
      componentId,
      institutionId,
    );
    return { average };
  }

  @Get('term-grade')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE', 'ACUDIENTE')
  async getTermGrade(
    @Request() req: any,
    @Query('studentEnrollmentId') studentEnrollmentId: string,
    @Query('teacherAssignmentId') teacherAssignmentId: string,
    @Query('academicTermId') academicTermId: string,
  ) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.studentGradesService.calculateTermGrade(
      studentEnrollmentId,
      teacherAssignmentId,
      academicTermId,
      institutionId,
    );
  }

  @Get('annual-grade')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE', 'ACUDIENTE')
  async getAnnualGrade(
    @Request() req: any,
    @Query('studentEnrollmentId') studentEnrollmentId: string,
    @Query('teacherAssignmentId') teacherAssignmentId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.studentGradesService.calculateAnnualGrade(
      studentEnrollmentId,
      teacherAssignmentId,
      academicYearId,
      institutionId,
    );
  }

  @Get('performance-level')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE', 'ACUDIENTE')
  async getPerformanceLevel(
    @Request() req: any,
    @Query('score') score: string,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.studentGradesService.getPerformanceLevel(instId, parseFloat(score));
  }
}
