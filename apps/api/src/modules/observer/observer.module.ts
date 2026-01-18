import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { ObserverController } from './observer.controller';
import { ObserverService } from './observer.service';

@Module({
  imports: [PrismaModule],
  controllers: [ObserverController],
  providers: [ObserverService],
  exports: [ObserverService],
})
export class ObserverModule {}
