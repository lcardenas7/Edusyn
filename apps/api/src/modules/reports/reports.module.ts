import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { EvaluationModule } from '../evaluation/evaluation.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { AcademicModule } from '../academic/academic.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { AcademicDataSourceService } from './academic-data-source.service';
import { ReportsExportService } from './reports-export.service';
import { AcademicPdfService } from './academic-pdf.service';
import { ValidateReportTenantGuard } from './guards/validate-report-tenant.guard';

@Module({
  imports: [PrismaModule, EvaluationModule, AttendanceModule, AcademicModule],
  controllers: [ReportsController],
  providers: [ReportsService, AcademicDataSourceService, ReportsExportService, AcademicPdfService, ValidateReportTenantGuard],
  exports: [ReportsService, AcademicDataSourceService, ReportsExportService, AcademicPdfService],
})
export class ReportsModule {}
