import { Module } from '@nestjs/common';
import { ElectionsController } from './elections.controller';
import { ElectionsService } from './elections.service';
import { ElectionsReportsService } from './elections-reports.service';
import { ElectionAuditService } from './election-audit.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ElectionsController],
  providers: [ElectionsService, ElectionsReportsService, ElectionAuditService],
  exports: [ElectionsService, ElectionsReportsService, ElectionAuditService],
})
export class ElectionsModule {}
