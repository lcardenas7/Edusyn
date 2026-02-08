import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { ScheduleGeneratorService } from './schedule-generator.service';
import { TimetableExcelService } from './timetable-excel.service';
import { ScheduleGeneratorController } from './schedule-generator.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ScheduleGeneratorController],
  providers: [ScheduleGeneratorService, TimetableExcelService],
  exports: [ScheduleGeneratorService, TimetableExcelService],
})
export class ScheduleGeneratorModule {}
