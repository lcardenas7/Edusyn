import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LiveSessionService } from './live-session.service';

@Injectable()
export class LiveSessionCronService {
  private readonly logger = new Logger(LiveSessionCronService.name);

  constructor(private readonly liveSessionService: LiveSessionService) {}

  @Cron('0 */5 * * * *') // Every 5 minutes
  async handleOrphanedStreams() {
    try {
      await this.liveSessionService.cleanupOrphanedStreams();
    } catch (error) {
      this.logger.error('Error cleaning orphaned SSE streams', error);
    }
  }
}
