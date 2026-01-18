import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { MenReportsController } from './men-reports.controller';
import { MenReportsService } from './men-reports.service';

@Module({
  imports: [PrismaModule],
  controllers: [MenReportsController],
  providers: [MenReportsService],
  exports: [MenReportsService],
})
export class MenReportsModule {}
