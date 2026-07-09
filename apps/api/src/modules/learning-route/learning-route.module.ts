import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { LearningRouteService } from './learning-route.service';
import { CompetencyEvidenceService } from './competency-evidence.service';
import { LearningRouteController } from './learning-route.controller';

@Module({
  imports: [PrismaModule],
  controllers: [LearningRouteController],
  providers: [LearningRouteService, CompetencyEvidenceService],
  exports: [LearningRouteService, CompetencyEvidenceService],
})
export class LearningRouteModule {}
