import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { PreventiveAlertStatus } from '@prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ExecutePreventiveCutDto } from './dto/execute-preventive-cut.dto';
import { UpsertPreventiveCutConfigDto } from './dto/upsert-preventive-cut-config.dto';
import { UpdatePreventiveAlertDto } from './dto/update-preventive-alert.dto';
import { PreventiveCutsService } from './preventive-cuts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';

@Controller('preventive-cuts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PreventiveCutsController {
  constructor(
    private readonly preventiveCutsService: PreventiveCutsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('config')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async upsertConfig(@Request() req: any, @Body() dto: UpsertPreventiveCutConfigDto) {
    const institutionId = await requireInstitutionId(this.prisma as any, req, req.query?.institutionId);
    return this.preventiveCutsService.upsertConfig(institutionId, dto);
  }

  @Get('config')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getConfig(@Request() req: any, @Query('academicTermId') academicTermId: string) {
    const institutionId = await requireInstitutionId(this.prisma as any, req, req.query?.institutionId);
    return this.preventiveCutsService.getConfig(institutionId, academicTermId);
  }

  @Post('execute')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async execute(@Request() req: any, @Body() dto: ExecutePreventiveCutDto) {
    const institutionId = await requireInstitutionId(this.prisma as any, req, req.query?.institutionId);
    return this.preventiveCutsService.execute(institutionId, dto);
  }

  @Get('alerts')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async listAlerts(
    @Request() req: any,
    @Query('teacherAssignmentId') teacherAssignmentId?: string,
    @Query('academicTermId') academicTermId?: string,
    @Query('studentEnrollmentId') studentEnrollmentId?: string,
    @Query('status') status?: PreventiveAlertStatus,
  ) {
    const institutionId = await requireInstitutionId(this.prisma as any, req, req.query?.institutionId);
    return this.preventiveCutsService.listAlerts(institutionId, {
      teacherAssignmentId,
      academicTermId,
      studentEnrollmentId,
      status,
    });
  }

  @Patch('alerts/:id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async updateAlert(@Request() req: any, @Param('id') id: string, @Body() dto: UpdatePreventiveAlertDto) {
    const institutionId = await requireInstitutionId(this.prisma as any, req, req.query?.institutionId);
    return this.preventiveCutsService.updateAlert(institutionId, id, dto);
  }

  // ── Corte preventivo consolidado por grupo (solo lectura) ──────────────────
  @Get('group-view')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async groupView(
    @Request() req: any,
    @Query('academicTermId') academicTermId: string,
    @Query('groupId') groupId: string,
    @Query('cutoffDate') cutoffDate?: string,
    @Query('threshold') threshold?: string,
  ) {
    const institutionId = await requireInstitutionId(this.prisma as any, req, req.query?.institutionId);
    return this.preventiveCutsService.executeGroupView(institutionId, {
      academicTermId,
      groupId,
      cutoffDate: cutoffDate ? new Date(cutoffDate) : undefined,
      threshold: threshold ? Number(threshold) : undefined,
    });
  }

  @Get('pdf/group')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async groupPdf(
    @Request() req: any,
    @Res() res: Response,
    @Query('academicTermId') academicTermId: string,
    @Query('groupId') groupId: string,
    @Query('cutoffDate') cutoffDate?: string,
    @Query('threshold') threshold?: string,
    @Query('showGrades') showGrades?: string,
  ) {
    const institutionId = await requireInstitutionId(this.prisma as any, req, req.query?.institutionId);
    const pdf = await this.preventiveCutsService.generateGroupPdf(institutionId, {
      academicTermId,
      groupId,
      cutoffDate: cutoffDate ? new Date(cutoffDate) : undefined,
      threshold: threshold ? Number(threshold) : undefined,
      showGrades: showGrades !== 'false',
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="corte-preventivo-grupo.pdf"');
    res.end(pdf);
  }

  @Get('pdf/student')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async studentPdf(
    @Request() req: any,
    @Res() res: Response,
    @Query('academicTermId') academicTermId: string,
    @Query('groupId') groupId: string,
    @Query('studentEnrollmentId') studentEnrollmentId: string,
    @Query('cutoffDate') cutoffDate?: string,
    @Query('threshold') threshold?: string,
    @Query('showGrades') showGrades?: string,
  ) {
    const institutionId = await requireInstitutionId(this.prisma as any, req, req.query?.institutionId);
    const pdf = await this.preventiveCutsService.generateStudentPdf(institutionId, {
      academicTermId,
      groupId,
      studentEnrollmentId,
      cutoffDate: cutoffDate ? new Date(cutoffDate) : undefined,
      threshold: threshold ? Number(threshold) : undefined,
      showGrades: showGrades !== 'false',
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="corte-preventivo-estudiante.pdf"');
    res.end(pdf);
  }
}
