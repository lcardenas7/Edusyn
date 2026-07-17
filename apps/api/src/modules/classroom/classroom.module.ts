import { Module } from '@nestjs/common';
import { ClassroomController } from './classroom.controller';
import { ClassroomService } from './classroom.service';
import { ClassroomCronService } from './classroom.cron';
import { AttitudinalService } from './attitudinal.service';
import { LessonService } from './lesson.service';
import { CompletionService } from './gating/completion.service';
import { ActivityGatingService } from './gating/activity-gating.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ApdModule } from '../apd/apd.module';
import { GamificationModule } from '../gamification/gamification.module';
import { LearningRouteModule } from '../learning-route/learning-route.module';

@Module({
  imports: [PrismaModule, ApdModule, GamificationModule, LearningRouteModule],
  controllers: [ClassroomController],
  providers: [ClassroomService, ClassroomCronService, AttitudinalService, LessonService, CompletionService, ActivityGatingService],
  exports: [ClassroomService, AttitudinalService, LessonService, ActivityGatingService],
})
export class ClassroomModule {}
