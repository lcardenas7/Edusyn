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
import { EvaluationModule } from '../evaluation/evaluation.module';
import { FormativeEvaluationService } from './formative-evaluation.service';
import { FormativeEvaluationController } from './formative-evaluation.controller';

@Module({
  imports: [PrismaModule, ApdModule, GamificationModule, LearningRouteModule, EvaluationModule],
  controllers: [ClassroomController, FormativeEvaluationController],
  providers: [ClassroomService, ClassroomCronService, AttitudinalService, FormativeEvaluationService, LessonService, CompletionService, ActivityGatingService],
  exports: [ClassroomService, AttitudinalService, LessonService, ActivityGatingService],
})
export class ClassroomModule {}
