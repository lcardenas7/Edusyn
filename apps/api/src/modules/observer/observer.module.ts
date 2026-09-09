import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { ObserverController } from './observer.controller';
import { ObserverService } from './observer.service';
import { ObserverActaPdfService } from './observer-acta-pdf.service';

@Module({
  imports: [PrismaModule],
  controllers: [ObserverController],
  providers: [ObserverService, ObserverActaPdfService],
  exports: [ObserverService, ObserverActaPdfService],
})
export class ObserverModule {}
