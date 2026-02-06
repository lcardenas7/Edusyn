import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { FinancialSettingsService } from './financial-settings.service';
import { FinancialSettingsController } from './financial-settings.controller';

@Module({
  imports: [PrismaModule],
  controllers: [FinancialSettingsController],
  providers: [FinancialSettingsService],
  exports: [FinancialSettingsService],
})
export class FinancialSettingsModule {}
