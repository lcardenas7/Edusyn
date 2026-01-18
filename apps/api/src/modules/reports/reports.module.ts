import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { EvaluationModule } from '../evaluation/evaluation.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [PrismaModule, EvaluationModule, AttendanceModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
