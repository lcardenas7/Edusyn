import { Controller, Post, Get, Put, Body, Param, Query, Res, Request, UseGuards, ForbiddenException } from '@nestjs/common';
import type { Response } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReportsService } from './reports.service';
import { GenerateReportCardDto, GenerateBulkReportCardsDto } from './dto/generate-report-card.dto';
import { CapabilitiesService } from '../capabilities/capabilities.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly capabilitiesService: CapabilitiesService,
  ) {}

  @Get('report-card/:studentEnrollmentId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE')
  async getReportCardData(
    @Request() req,
    @Param('studentEnrollmentId') studentEnrollmentId: string,
    @Query('academicTermId') academicTermId: string,
  ) {
    // Validar capability para DOCENTE
    const userId = req.user.sub || req.user.id;
    const institutionId = req.user.institutionId;
    if (institutionId) {
      const userCaps = await this.capabilitiesService.getUserCapabilities(userId, institutionId);
      const isFullAccess = userCaps.effectiveRoles.some(r =>
        ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR'].includes(r),
      );
      if (!isFullAccess) {
        const canViewOwnCourse = userCaps.capabilities.includes('VIEW_OWN_COURSE_REPORTS');
        const canViewTutorGroup = userCaps.capabilities.includes('VIEW_TUTOR_GROUP_REPORTS');
        if (!canViewOwnCourse && !canViewTutorGroup) {
          throw new ForbiddenException('No tienes permiso para ver reportes de estudiantes');
        }
      }
    }
    return this.reportsService.getReportCardData(studentEnrollmentId, academicTermId);
  }

  @Get('report-card/:studentEnrollmentId/pdf')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE')
  async downloadReportCardPdf(
    @Param('studentEnrollmentId') studentEnrollmentId: string,
    @Query('academicTermId') academicTermId: string,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.reportsService.generateReportCardPdf(
      studentEnrollmentId,
      academicTermId,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="boletin-${studentEnrollmentId}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @Post('report-cards/bulk')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async generateBulkReportCards(@Body() dto: GenerateBulkReportCardsDto) {
    return this.reportsService.generateBulkReportCards(
      dto.groupId,
      dto.academicTermId,
      dto.academicYearId,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORTES PREDICTIVOS - NOTA MÍNIMA REQUERIDA
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Calcula la nota mínima requerida para aprobar cada asignatura de un estudiante.
   * Considera períodos con sus pesos, notas ya obtenidas, y nota mínima aprobatoria.
   */
  @Get('minimum-grade/:studentEnrollmentId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getMinimumGradeRequired(
    @Param('studentEnrollmentId') studentEnrollmentId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.reportsService.calculateMinimumGradeRequired(
      studentEnrollmentId,
      academicYearId,
    );
  }

  /**
   * Calcula la nota mínima requerida para todos los estudiantes de un grupo.
   * Retorna un resumen con estudiantes en riesgo y asignaturas críticas.
   */
  @Get('minimum-grade/group/:groupId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getMinimumGradeForGroup(
    @Request() req,
    @Param('groupId') groupId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    // Validar capability: DOCENTE solo puede ver grupos donde dicta o es tutor
    const userId = req.user.sub || req.user.id;
    const institutionId = req.user.institutionId;
    if (institutionId) {
      const userCaps = await this.capabilitiesService.getUserCapabilities(userId, institutionId);
      const isFullAccess = userCaps.effectiveRoles.some(r =>
        ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR'].includes(r),
      );
      if (!isFullAccess) {
        const canViewOwnCourse = userCaps.capabilities.includes('VIEW_OWN_COURSE_REPORTS');
        const canViewTutorGroup = userCaps.capabilities.includes('VIEW_TUTOR_GROUP_REPORTS');
        const isOwnGroup = userCaps.teacherAssignmentGroupIds.includes(groupId);
        const isTutorGroup = userCaps.tutorGroupIds.includes(groupId);
        if (!(canViewOwnCourse && isOwnGroup) && !(canViewTutorGroup && isTutorGroup)) {
          throw new ForbiddenException('No tienes permiso para ver reportes de este grupo');
        }
      }
    }
    return this.reportsService.calculateMinimumGradeForGroup(
      groupId,
      academicYearId,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURACIÓN DE BOLETINES
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('report-card-config')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getReportCardConfig(@Request() req) {
    const institutionId = req.user.institutionId;
    return this.reportsService.getReportCardConfig(institutionId);
  }

  @Put('report-card-config')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async updateReportCardConfig(@Request() req, @Body() data: any) {
    const institutionId = req.user.institutionId;
    return this.reportsService.updateReportCardConfig(institutionId, data);
  }

  @Get('report-cards/group/:groupId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getGroupReportCardList(
    @Request() req,
    @Param('groupId') groupId: string,
    @Query('academicTermId') academicTermId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    // Validar capability: DOCENTE solo puede ver su grupo o grupo tutor
    const userId = req.user.sub || req.user.id;
    const institutionId = req.user.institutionId;
    if (institutionId) {
      const userCaps = await this.capabilitiesService.getUserCapabilities(userId, institutionId);
      const isFullAccess = userCaps.effectiveRoles.some(r =>
        ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR'].includes(r),
      );
      if (!isFullAccess) {
        const canViewOwnCourse = userCaps.capabilities.includes('VIEW_OWN_COURSE_REPORTS');
        const canViewTutorGroup = userCaps.capabilities.includes('VIEW_TUTOR_GROUP_REPORTS');
        const isOwnGroup = userCaps.teacherAssignmentGroupIds.includes(groupId);
        const isTutorGroup = userCaps.tutorGroupIds.includes(groupId);
        if (!(canViewOwnCourse && isOwnGroup) && !(canViewTutorGroup && isTutorGroup)) {
          throw new ForbiddenException('No tienes permiso para ver boletines de este grupo');
        }
      }
    }
    return this.reportsService.getGroupReportCardList(groupId, academicTermId, academicYearId);
  }
}
