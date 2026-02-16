import { Module } from '@nestjs/common';
import { PedagogicalSupportController } from './pedagogical-support.controller';
import { PedagogicalSupportService } from './pedagogical-support.service';

@Module({
  controllers: [PedagogicalSupportController],
  providers: [PedagogicalSupportService],
  exports: [PedagogicalSupportService],
})
export class PedagogicalSupportModule {}
