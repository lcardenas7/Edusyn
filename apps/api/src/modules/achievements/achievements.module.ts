import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AchievementService } from './achievement.service';
import { AchievementConfigService } from './achievement-config.service';
import { AchievementController } from './achievement.controller';
import { AchievementBankService } from './achievement-bank.service';
import { AchievementBankController } from './achievement-bank.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AchievementController, AchievementBankController],
  providers: [AchievementService, AchievementConfigService, AchievementBankService],
  exports: [AchievementService, AchievementConfigService, AchievementBankService],
})
export class AchievementsModule {}
