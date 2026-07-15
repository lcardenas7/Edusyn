import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { GamificationModule } from '../gamification/gamification.module';
import { AbpService } from './abp.service';
import { AbpController } from './abp.controller';

@Module({
  imports: [PrismaModule, GamificationModule],
  controllers: [AbpController],
  providers: [AbpService],
  exports: [AbpService],
})
export class AbpModule {}
