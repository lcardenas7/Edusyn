import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { ScheduleConfigService } from './schedule-config.service';
import { ScheduleConfigController } from './schedule-config.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ScheduleConfigController],
  providers: [ScheduleConfigService],
  exports: [ScheduleConfigService],
})
export class ScheduleConfigModule {}
