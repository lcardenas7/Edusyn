import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { LearningIdentityService } from './learning-identity.service';
import { GamificationController } from './gamification.controller';

@Module({
  imports: [PrismaModule],
  controllers: [GamificationController],
  providers: [LearningIdentityService],
  exports: [LearningIdentityService],
})
export class GamificationModule {}
