import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { LearningRouteService } from './learning-route.service';
import { LearningRouteController } from './learning-route.controller';

@Module({
  imports: [PrismaModule],
  controllers: [LearningRouteController],
  providers: [LearningRouteService],
  exports: [LearningRouteService],
})
export class LearningRouteModule {}
