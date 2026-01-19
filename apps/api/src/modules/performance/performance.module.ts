import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PerformanceConfigService } from './performance-config.service';
import { PerformanceConfigController } from './performance-config.controller';
import { SubjectPerformanceService } from './subject-performance.service';
import { SubjectPerformanceController } from './subject-performance.controller';
import { PerformanceGeneratorService } from './performance-generator.service';
import { PerformanceGeneratorController } from './performance-generator.controller';

@Module({
  imports: [PrismaModule],
  controllers: [
    PerformanceConfigController,
    SubjectPerformanceController,
    PerformanceGeneratorController,
  ],
  providers: [
    PerformanceConfigService,
    SubjectPerformanceService,
    PerformanceGeneratorService,
  ],
  exports: [
    PerformanceConfigService,
    SubjectPerformanceService,
    PerformanceGeneratorService,
  ],
})
export class PerformanceModule {}
