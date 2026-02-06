import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AcademicModule } from '../academic/academic.module';
import { MenReportsController } from './men-reports.controller';
import { MenReportsService } from './men-reports.service';

@Module({
  imports: [PrismaModule, AcademicModule],
  controllers: [MenReportsController],
  providers: [MenReportsService],
  exports: [MenReportsService],
})
export class MenReportsModule {}
