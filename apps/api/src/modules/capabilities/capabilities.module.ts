import { Module, Global } from '@nestjs/common';
import { CapabilitiesService } from './capabilities.service';
import { CapabilitiesController } from './capabilities.controller';
import { CapabilitiesGuard } from './capabilities.guard';
import { PrismaModule } from '../../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [CapabilitiesController],
  providers: [CapabilitiesService, CapabilitiesGuard],
  exports: [CapabilitiesService, CapabilitiesGuard],
})
export class CapabilitiesModule {}
