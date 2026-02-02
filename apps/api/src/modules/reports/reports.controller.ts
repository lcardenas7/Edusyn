import { Controller, Post, Get, Body, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReportsService } from './reports.service';
import { GenerateReportCardDto, GenerateBulkReportCardsDto } from './dto/generate-report-card.dto';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('report-card/:studentEnrollmentId')
  @Roles('ADMIN', 'COORDINATOR', 'TEACHER', 'STUDENT')
  async getReportCardData(
    @Param('studentEnrollmentId') studentEnrollmentId: string,
    @Query('academicTermId') academicTermId: string,
  ) {
    return this.reportsService.getReportCardData(studentEnrollmentId, academicTermId);
  }

  @Get('report-card/:studentEnrollmentId/pdf')
  @Roles('ADMIN', 'COORDINATOR', 'TEACHER', 'STUDENT')
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
  @Roles('ADMIN', 'COORDINATOR')
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
    @Param('groupId') groupId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.reportsService.calculateMinimumGradeForGroup(
      groupId,
      academicYearId,
    );
  }
}
