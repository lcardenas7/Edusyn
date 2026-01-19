import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { GalleryController } from './gallery.controller';
import { GalleryService } from './gallery.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    AnnouncementsController,
    GalleryController,
    EventsController,
    DashboardController,
    StatisticsController,
  ],
  providers: [
    AnnouncementsService,
    GalleryService,
    EventsService,
    DashboardService,
    StatisticsService,
  ],
  exports: [AnnouncementsService, GalleryService, EventsService, DashboardService, StatisticsService],
})
export class DashboardModule {}
