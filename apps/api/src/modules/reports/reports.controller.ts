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
}
