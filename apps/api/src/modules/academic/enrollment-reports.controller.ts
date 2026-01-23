import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { EnrollmentReportsService } from './enrollment-reports.service';

@Controller('enrollment-reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EnrollmentReportsController {
  constructor(private readonly reportsService: EnrollmentReportsService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // LISTADO DE MATRICULADOS - PDF
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('list/:academicYearId/pdf')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'SECRETARIA')
  async getEnrollmentListPdf(
    @Param('academicYearId') academicYearId: string,
    @Query('gradeId') gradeId: string,
    @Query('groupId') groupId: string,
    @Query('status') status: string,
    @Res() res: Response,
  ) {
    const buffer = await this.reportsService.generateEnrollmentListPdf(
      academicYearId,
      { gradeId, groupId, status }
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="matriculados_${academicYearId}.pdf"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LISTADO DE MATRICULADOS - EXCEL
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('list/:academicYearId/excel')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'SECRETARIA')
  async getEnrollmentListExcel(
    @Param('academicYearId') academicYearId: string,
    @Query('gradeId') gradeId: string,
    @Query('groupId') groupId: string,
    @Query('status') status: string,
    @Res() res: Response,
  ) {
    const buffer = await this.reportsService.generateEnrollmentListExcel(
      academicYearId,
      { gradeId, groupId, status }
    );

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="matriculados_${academicYearId}.xlsx"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ESTADÍSTICAS POR GRADO - PDF
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('stats/:academicYearId/pdf')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR')
  async getStatsByGradePdf(
    @Param('academicYearId') academicYearId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.reportsService.generateStatsByGradePdf(academicYearId);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="estadisticas_matricula_${academicYearId}.pdf"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }
}
