import { Module } from '@nestjs/common';
import { ClassroomController } from './classroom.controller';
import { ClassroomB1Controller } from './classroom-b1.controller';
import { ClassroomService } from './classroom.service';
import { ClassroomCronService } from './classroom.cron';
import { ActivityNotificationsService } from './activity-notifications.service';
import { AttitudinalService } from './attitudinal.service';
import { LessonService } from './lesson.service';
import { CompletionService } from './gating/completion.service';
import { ActivityGatingService } from './gating/activity-gating.service';
import { ClassroomTenantAccessService } from './classroom-tenant-access.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ApdModule } from '../apd/apd.module';
import { GamificationModule } from '../gamification/gamification.module';
import { LearningRouteModule } from '../learning-route/learning-route.module';
import { EvaluationModule } from '../evaluation/evaluation.module';
import { FormativeEvaluationService } from './formative-evaluation.service';
import { FormativeEvaluationController } from './formative-evaluation.controller';

@Module({
  imports: [PrismaModule, ApdModule, GamificationModule, LearningRouteModule, EvaluationModule],
  // Las rutas literales restantes del controlador original preceden a @Get(':id') de B1.
  controllers: [ClassroomController, ClassroomB1Controller, FormativeEvaluationController],
  providers: [ClassroomService, ClassroomCronService, ActivityNotificationsService, AttitudinalService, FormativeEvaluationService, LessonService, CompletionService, ActivityGatingService, ClassroomTenantAccessService],
  exports: [ClassroomService, AttitudinalService, LessonService, ActivityGatingService],
})
export class ClassroomModule {}
