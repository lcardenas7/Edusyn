import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClassroomService } from './classroom.service';

@Injectable()
export class ClassroomCronService {
  private readonly logger = new Logger(ClassroomCronService.name);

  constructor(private readonly classroomService: ClassroomService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledPublications() {
    try {
      const count = await this.classroomService.processScheduledPublications();
      if (count > 0) {
        this.logger.log(`Publicadas ${count} actividades programadas`);
      }
    } catch (error) {
      this.logger.error('Error procesando publicaciones programadas', error);
    }
  }
}
