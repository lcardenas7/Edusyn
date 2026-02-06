import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { ScheduleEntriesService } from './schedule-entries.service';
import { ScheduleValidatorService } from './schedule-validator.service';
import { ScheduleEntriesController } from './schedule-entries.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ScheduleEntriesController],
  providers: [ScheduleEntriesService, ScheduleValidatorService],
  exports: [ScheduleEntriesService, ScheduleValidatorService],
})
export class ScheduleEntriesModule {}
