import { Module } from '@nestjs/common';
import { ClassroomController } from './classroom.controller';
import { ClassroomService } from './classroom.service';
import { ClassroomCronService } from './classroom.cron';
import { AttitudinalService } from './attitudinal.service';
import { LessonService } from './lesson.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ApdModule } from '../apd/apd.module';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [PrismaModule, ApdModule, GamificationModule],
  controllers: [ClassroomController],
  providers: [ClassroomService, ClassroomCronService, AttitudinalService, LessonService],
  exports: [ClassroomService, AttitudinalService, LessonService],
})
export class ClassroomModule {}
