import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AchievementService } from './achievement.service';
import { AchievementConfigService } from './achievement-config.service';
import { AchievementController } from './achievement.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AchievementController],
  providers: [AchievementService, AchievementConfigService],
  exports: [AchievementService, AchievementConfigService],
})
export class AchievementsModule {}
