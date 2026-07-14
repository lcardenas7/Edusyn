import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AbpService } from './abp.service';
import { AbpController } from './abp.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AbpController],
  providers: [AbpService],
  exports: [AbpService],
})
export class AbpModule {}
