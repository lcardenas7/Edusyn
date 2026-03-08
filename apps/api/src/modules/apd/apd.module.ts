import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ApdController } from './apd.controller';
import { ApdService } from './apd.service';
import { ApdAuditService } from './apd-audit.service';
import { ApdProgressService } from './apd-progress.service';
import { ApdAlertsService } from './apd-alerts.service';
import { ApdAcademicService } from './apd-academic.service';
import { ApdAiService } from './ai/apd-ai.service';

@Module({
  imports: [PrismaModule],
  controllers: [ApdController],
  providers: [
    ApdService,
    ApdAuditService,
    ApdProgressService,
    ApdAlertsService,
    ApdAcademicService,
    ApdAiService,
  ],
  exports: [
    ApdService,
    ApdAuditService,
    ApdProgressService,
    ApdAlertsService,
    ApdAcademicService,
    ApdAiService,
  ],
})
export class ApdModule {}
