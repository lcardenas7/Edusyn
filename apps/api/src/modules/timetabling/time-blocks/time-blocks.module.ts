import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { TimeBlocksService } from './time-blocks.service';
import { TimeBlocksController } from './time-blocks.controller';

@Module({
  imports: [PrismaModule],
  controllers: [TimeBlocksController],
  providers: [TimeBlocksService],
  exports: [TimeBlocksService],
})
export class TimeBlocksModule {}
