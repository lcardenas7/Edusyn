import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ApdModule } from '../apd/apd.module';
import { LearningRouteService } from './learning-route.service';
import { CompetencyEvidenceService } from './competency-evidence.service';
import { LearningRouteController } from './learning-route.controller';

@Module({
  imports: [PrismaModule, ApdModule],
  controllers: [LearningRouteController],
  providers: [LearningRouteService, CompetencyEvidenceService],
  exports: [LearningRouteService, CompetencyEvidenceService],
})
export class LearningRouteModule {}
