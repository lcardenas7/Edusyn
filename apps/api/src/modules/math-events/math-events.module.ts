import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MathEventsController } from './math-events.controller';
import { MathEventsService } from './math-events.service';
import { MathEventPushService } from './math-event-push.service';
@Module({
  imports: [PrismaModule],
  controllers: [MathEventsController],
  providers: [MathEventsService, MathEventPushService],
})
export class MathEventsModule {}
