import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';

import { TimeBlocksModule } from './time-blocks/time-blocks.module';
import { RoomsModule } from './rooms/rooms.module';
import { ScheduleConfigModule } from './schedule-config/schedule-config.module';
import { TeacherAvailabilityModule } from './teacher-availability/teacher-availability.module';
import { ScheduleEntriesModule } from './schedule-entries/schedule-entries.module';

@Module({
  imports: [
    PrismaModule,
    TimeBlocksModule,
    RoomsModule,
    ScheduleConfigModule,
    TeacherAvailabilityModule,
    ScheduleEntriesModule,
  ],
  exports: [
    TimeBlocksModule,
    RoomsModule,
    ScheduleConfigModule,
    TeacherAvailabilityModule,
    ScheduleEntriesModule,
  ],
})
export class TimetablingModule {}
