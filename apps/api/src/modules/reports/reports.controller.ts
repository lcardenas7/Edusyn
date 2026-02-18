import { Controller, Post, Get, Put, Body, Param, Query, Res, Request, UseGuards, ForbiddenException } from '@nestjs/common';
import type { Response } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReportsService } from './reports.service';
import { ReportsExportService } from './reports-export.service';
import { AcademicPdfService } from './academic-pdf.service';
import { GenerateReportCardDto, GenerateBulkReportCardsDto } from './dto/generate-report-card.dto';
import { CapabilitiesService } from '../capabilities/capabilities.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly reportsExportService: ReportsExportService,
    private readonly academicPdfService: AcademicPdfService,
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
  // REPORTES ACADÉMICOS INSTITUCIONALES
  // Motor de consulta: Rendimiento, Riesgo, Histórico, Gestión Docente
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('academic/subject-averages')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getSubjectAverages(
    @Request() req,
    @Query('academicYearId') academicYearId: string,
    @Query('groupId') groupId?: string,
    @Query('termId') termId?: string,
    @Query('stage') stage?: string,
  ) {
    const institutionId = req.user.institutionId;
    return this.reportsService.getSubjectAverages(institutionId, academicYearId, groupId, termId, stage);
  }

  @Get('academic/student-ranking')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getStudentRanking(
    @Request() req,
    @Query('academicYearId') academicYearId: string,
    @Query('groupId') groupId: string,
    @Query('termId') termId?: string,
  ) {
    const institutionId = req.user.institutionId;
    return this.reportsService.getStudentRanking(institutionId, academicYearId, groupId, termId);
  }

  @Get('academic/grade-distribution')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getGradeDistribution(
    @Request() req,
    @Query('academicYearId') academicYearId: string,
    @Query('groupId') groupId: string,
    @Query('subjectId') subjectId?: string,
    @Query('termId') termId?: string,
  ) {
    const institutionId = req.user.institutionId;
    return this.reportsService.getGradeDistribution(institutionId, academicYearId, groupId, subjectId, termId);
  }

  @Get('academic/failed-subjects')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getFailedSubjects(
    @Request() req,
    @Query('academicYearId') academicYearId: string,
    @Query('groupId') groupId: string,
    @Query('termId') termId?: string,
  ) {
    const institutionId = req.user.institutionId;
    return this.reportsService.getFailedSubjects(institutionId, academicYearId, groupId, termId);
  }

  @Get('academic/recovery-list')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getRecoveryList(
    @Request() req,
    @Query('academicYearId') academicYearId: string,
    @Query('groupId') groupId: string,
    @Query('termId') termId?: string,
    @Query('minScore') minScore?: string,
    @Query('maxScore') maxScore?: string,
  ) {
    const institutionId = req.user.institutionId;
    return this.reportsService.getRecoveryList(
      institutionId, academicYearId, groupId, termId,
      minScore ? parseFloat(minScore) : undefined,
      maxScore ? parseFloat(maxScore) : undefined,
    );
  }

  @Get('academic/promotion-projection')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getPromotionProjection(
    @Request() req,
    @Query('academicYearId') academicYearId: string,
    @Query('groupId') groupId: string,
  ) {
    const institutionId = req.user.institutionId;
    return this.reportsService.getPromotionProjection(institutionId, academicYearId, groupId);
  }

  @Get('academic/period-comparison')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getPeriodComparison(
    @Request() req,
    @Query('academicYearId') academicYearId: string,
    @Query('groupId') groupId?: string,
    @Query('studentEnrollmentId') studentEnrollmentId?: string,
  ) {
    const institutionId = req.user.institutionId;
    return this.reportsService.getPeriodComparison(institutionId, academicYearId, groupId, studentEnrollmentId);
  }

  @Get('academic/student-history')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getStudentHistory(
    @Query('studentId') studentId: string,
  ) {
    return this.reportsService.getStudentHistory(studentId);
  }

  @Get('academic/subject-analysis')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getSubjectAnalysis(
    @Request() req,
    @Query('academicYearId') academicYearId: string,
    @Query('subjectId') subjectId: string,
    @Query('groupId') groupId?: string,
  ) {
    const institutionId = req.user.institutionId;
    return this.reportsService.getSubjectAnalysis(institutionId, academicYearId, subjectId, groupId);
  }

  @Get('academic/teacher-performance')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getTeacherPerformance(
    @Request() req,
    @Query('academicYearId') academicYearId: string,
    @Query('teacherId') teacherId?: string,
  ) {
    const institutionId = req.user.institutionId;
    return this.reportsService.getTeacherPerformance(institutionId, academicYearId, teacherId);
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

  // ═══════════════════════════════════════════════════════════════════════════
  // CICLO DE VIDA DE PERÍODOS: VALIDACIÓN, CIERRE, FINALIZACIÓN Y REAPERTURA
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('terms/:termId/validate-grades')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async validateTermGrades(
    @Param('termId') termId: string,
  ) {
    return this.reportsService.validateTermGrades(termId);
  }

  @Post('terms/:termId/close')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async closeTerm(
    @Param('termId') termId: string,
  ) {
    return this.reportsService.closeTerm(termId);
  }

  @Post('terms/:termId/finalize')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async finalizeTerm(
    @Param('termId') termId: string,
    @Request() req,
  ) {
    const userId = req.user.sub || req.user.id;
    return this.reportsService.finalizeTerm(termId, userId);
  }

  @Post('terms/:termId/reopen')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async reopenFinalizedTerm(
    @Param('termId') termId: string,
    @Body() body: { reason: string },
    @Request() req,
  ) {
    const userId = req.user.sub || req.user.id;
    return this.reportsService.reopenFinalizedTerm(termId, body.reason, userId);
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

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORTACIONES EXCEL
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('export/consolidated')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async exportConsolidated(
    @Request() req,
    @Res() res: Response,
    @Query('academicYearId') academicYearId: string,
    @Query('groupId') groupId: string,
    @Query('termId') termId?: string,
  ) {
    const institutionId = req.user.institutionId;
    const workbook = await this.reportsExportService.exportConsolidatedGradeSheet(
      institutionId, academicYearId, groupId, termId,
    );
    this.sendExcel(res, workbook, 'sabana-academica');
  }

  @Get('export/grade-distribution')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async exportGradeDistribution(
    @Request() req,
    @Res() res: Response,
    @Query('academicYearId') academicYearId: string,
    @Query('groupId') groupId: string,
    @Query('subjectId') subjectId?: string,
    @Query('termId') termId?: string,
  ) {
    const institutionId = req.user.institutionId;
    const workbook = await this.reportsExportService.exportGradeDistribution(
      institutionId, academicYearId, groupId, subjectId, termId,
    );
    this.sendExcel(res, workbook, 'distribucion-desempeno');
  }

  @Get('export/teacher-performance')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async exportTeacherPerformance(
    @Request() req,
    @Res() res: Response,
    @Query('academicYearId') academicYearId: string,
    @Query('teacherId') teacherId?: string,
  ) {
    const institutionId = req.user.institutionId;
    const workbook = await this.reportsExportService.exportTeacherPerformance(
      institutionId, academicYearId, teacherId,
    );
    this.sendExcel(res, workbook, 'rendimiento-docente');
  }

  @Get('export/student-ranking')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async exportStudentRanking(
    @Request() req,
    @Res() res: Response,
    @Query('academicYearId') academicYearId: string,
    @Query('groupId') groupId: string,
    @Query('termId') termId?: string,
  ) {
    const institutionId = req.user.institutionId;
    const workbook = await this.reportsExportService.exportStudentRanking(
      institutionId, academicYearId, groupId, termId,
    );
    this.sendExcel(res, workbook, 'ranking-estudiantes');
  }

  @Get('export/failed-subjects')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async exportFailedSubjects(
    @Request() req,
    @Res() res: Response,
    @Query('academicYearId') academicYearId: string,
    @Query('groupId') groupId: string,
    @Query('termId') termId?: string,
  ) {
    const institutionId = req.user.institutionId;
    const workbook = await this.reportsExportService.exportFailedSubjects(
      institutionId, academicYearId, groupId, termId,
    );
    this.sendExcel(res, workbook, 'asignaturas-reprobadas');
  }

  @Get('export/recovery-list')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async exportRecoveryList(
    @Request() req,
    @Res() res: Response,
    @Query('academicYearId') academicYearId: string,
    @Query('groupId') groupId: string,
    @Query('termId') termId?: string,
  ) {
    const institutionId = req.user.institutionId;
    const workbook = await this.reportsExportService.exportRecoveryList(
      institutionId, academicYearId, groupId, termId,
    );
    this.sendExcel(res, workbook, 'listado-recuperacion');
  }

  @Get('export/promotion-projection')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async exportPromotionProjection(
    @Request() req,
    @Res() res: Response,
    @Query('academicYearId') academicYearId: string,
    @Query('groupId') groupId: string,
  ) {
    const institutionId = req.user.institutionId;
    const workbook = await this.reportsExportService.exportPromotionProjection(
      institutionId, academicYearId, groupId,
    );
    this.sendExcel(res, workbook, 'proyeccion-promocion');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PDFs FORMALES
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('pdf/recovery-certificate')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async pdfRecoveryCertificate(
    @Request() req,
    @Res() res: Response,
    @Query('academicYearId') academicYearId: string,
    @Query('groupId') groupId: string,
    @Query('termId') termId?: string,
  ) {
    const institutionId = req.user.institutionId;
    const buffer = await this.academicPdfService.generateRecoveryCertificate(
      institutionId, academicYearId, groupId, termId,
    );
    this.sendPdf(res, buffer, 'certificado-recuperacion');
  }

  @Get('pdf/non-promoted')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async pdfNonPromoted(
    @Request() req,
    @Res() res: Response,
    @Query('academicYearId') academicYearId: string,
    @Query('groupId') groupId: string,
  ) {
    const institutionId = req.user.institutionId;
    const buffer = await this.academicPdfService.generateNonPromotedReport(
      institutionId, academicYearId, groupId,
    );
    this.sendPdf(res, buffer, 'acta-no-promovidos');
  }

  @Get('pdf/statistical-summary')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async pdfStatisticalSummary(
    @Request() req,
    @Res() res: Response,
    @Query('academicYearId') academicYearId: string,
    @Query('groupId') groupId: string,
    @Query('termId') termId?: string,
  ) {
    const institutionId = req.user.institutionId;
    const buffer = await this.academicPdfService.generateStatisticalSummary(
      institutionId, academicYearId, groupId, termId,
    );
    this.sendPdf(res, buffer, 'consolidado-estadistico');
  }

  @Get('pdf/student-history/:studentId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async pdfStudentHistory(
    @Param('studentId') studentId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.academicPdfService.generateStudentHistoryCertificate(studentId);
    this.sendPdf(res, buffer, `certificado-historico-${studentId}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORTES INSTITUCIONALES
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('institutional-statistics')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getInstitutionalStatistics(
    @Request() req,
    @Query('academicYearId') academicYearId: string,
    @Query('termId') termId?: string,
  ) {
    const institutionId = req.user.institutionId;
    return this.reportsService.getInstitutionalStatistics(institutionId, academicYearId, termId);
  }

  @Get('annual-comparison')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getAnnualComparison(
    @Request() req,
    @Query('academicYearIds') academicYearIds: string,
  ) {
    const institutionId = req.user.institutionId;
    const ids = academicYearIds ? academicYearIds.split(',').filter(Boolean) : [];
    return this.reportsService.getAnnualComparison(institutionId, ids);
  }

  // ─── Helpers para enviar archivos ─────────────────────────────────────────
  private sendPdf(res: Response, buffer: Buffer, filename: string) {
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  private async sendExcel(res: Response, workbook: any, filename: string) {
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  }
}
