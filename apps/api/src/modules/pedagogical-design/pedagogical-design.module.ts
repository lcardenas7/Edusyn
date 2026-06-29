import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ApdModule } from '../apd/apd.module';
import { PedagogicalDesignController } from './pedagogical-design.controller';
import { PedagogicalDesignService } from './pedagogical-design.service';

@Module({
  imports: [PrismaModule, ApdModule],
  controllers: [PedagogicalDesignController],
  providers: [PedagogicalDesignService],
  exports: [PedagogicalDesignService],
})
export class PedagogicalDesignModule {}
