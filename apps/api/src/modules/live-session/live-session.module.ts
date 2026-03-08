import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { LiveSessionController } from './live-session.controller';
import { LiveSessionService } from './live-session.service';
import { LiveSessionCronService } from './live-session.cron';

@Module({
  imports: [PrismaModule],
  controllers: [LiveSessionController],
  providers: [LiveSessionService, LiveSessionCronService],
  exports: [LiveSessionService],
})
export class LiveSessionModule {}
