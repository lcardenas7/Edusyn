import { Controller, Get, Post, Body, Res, UseGuards, Query } from '@nestjs/common';
import type { Response } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MenReportsService } from './men-reports.service';
import { GenerateReportDto, PromotionReportDto } from './dto/men-reports.dto';

@Controller('men-reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'COORDINATOR')
export class MenReportsController {
  constructor(private readonly menReportsService: MenReportsService) {}

  @Post('simat/export')
  async exportSimat(@Body() dto: GenerateReportDto, @Res() res: Response) {
    const workbook = await this.menReportsService.generateSimatExport(dto);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=simat_export.xlsx',
    );

    await workbook.xlsx.write(res);
    res.end();
  }

  @Post('enrollment/stats')
  async getEnrollmentStats(@Body() dto: GenerateReportDto) {
    return this.menReportsService.generateEnrollmentStats(dto);
  }

  @Post('promotion')
  async getPromotionReport(@Body() dto: PromotionReportDto) {
    return this.menReportsService.generatePromotionReport(dto);
  }

  @Post('promotion/export')
  async exportPromotion(@Body() dto: PromotionReportDto, @Res() res: Response) {
    const workbook = await this.menReportsService.generatePromotionExcel(dto);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=promocion.xlsx',
    );

    await workbook.xlsx.write(res);
    res.end();
  }

  @Post('attendance')
  async getAttendanceReport(@Body() dto: GenerateReportDto) {
    return this.menReportsService.generateAttendanceReport(dto);
  }
}
