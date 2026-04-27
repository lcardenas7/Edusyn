import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Cron de limpieza para Edusyn Play.
 * - Cierra sesiones WAITING > 4h (lobbies abandonados)
 * - Cierra sesiones ACTIVE > 6h (partidas que nadie finalizó)
 */
@Injectable()
export class PlayCronService {
  private readonly logger = new Logger(PlayCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 */30 * * * *') // Cada 30 minutos
  async handleOrphanSessions() {
    try {
      const now = Date.now();
      const fourHoursAgo = new Date(now - 4 * 60 * 60 * 1000);
      const sixHoursAgo = new Date(now - 6 * 60 * 60 * 1000);

      const result = await this.prisma.liveSession.updateMany({
        where: {
          OR: [
            { status: 'WAITING', createdAt: { lt: fourHoursAgo } },
            { status: 'ACTIVE', startedAt: { lt: sixHoursAgo } },
          ],
        },
        data: { status: 'FINISHED', finishedAt: new Date() },
      });

      if (result.count > 0) {
        this.logger.warn(`Cerradas ${result.count} sesiones huérfanas de Play`);
      }
    } catch (error) {
      this.logger.error('Error cerrando sesiones huérfanas', error);
    }
  }
}
