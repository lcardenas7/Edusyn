import { Module } from '@nestjs/common';
import { ElectionsController } from './elections.controller';
import { ElectionsService } from './elections.service';
import { ElectionsReportsService } from './elections-reports.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ElectionsController],
  providers: [ElectionsService, ElectionsReportsService],
  exports: [ElectionsService, ElectionsReportsService],
})
export class ElectionsModule {}
