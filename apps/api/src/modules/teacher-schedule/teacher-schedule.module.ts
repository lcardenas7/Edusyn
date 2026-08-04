import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TeacherScheduleService } from './teacher-schedule.service';
import { TeacherScheduleController } from './teacher-schedule.controller';

@Module({
  imports: [PrismaModule],
  controllers: [TeacherScheduleController],
  providers: [TeacherScheduleService],
  exports: [TeacherScheduleService],
})
export class TeacherScheduleModule {}
