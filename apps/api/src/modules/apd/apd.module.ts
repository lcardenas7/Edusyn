import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ApdController } from './apd.controller';
import { ApdService } from './apd.service';
import { ApdAuditService } from './apd-audit.service';
import { ApdProgressService } from './apd-progress.service';

@Module({
  imports: [PrismaModule],
  controllers: [ApdController],
  providers: [ApdService, ApdAuditService, ApdProgressService],
  exports: [ApdService, ApdAuditService, ApdProgressService],
})
export class ApdModule {}
