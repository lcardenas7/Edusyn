import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { LiveSessionController } from './live-session.controller';
import { LiveSessionService } from './live-session.service';

@Module({
  imports: [PrismaModule],
  controllers: [LiveSessionController],
  providers: [LiveSessionService],
  exports: [LiveSessionService],
})
export class LiveSessionModule {}
