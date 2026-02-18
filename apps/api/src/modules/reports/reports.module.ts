import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { EvaluationModule } from '../evaluation/evaluation.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { AcademicModule } from '../academic/academic.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { AcademicDataSourceService } from './academic-data-source.service';

@Module({
  imports: [PrismaModule, EvaluationModule, AttendanceModule, AcademicModule],
  controllers: [ReportsController],
  providers: [ReportsService, AcademicDataSourceService],
  exports: [ReportsService, AcademicDataSourceService],
})
export class ReportsModule {}
