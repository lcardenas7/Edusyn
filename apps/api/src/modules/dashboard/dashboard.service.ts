import { Injectable } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { EventsService } from './events.service';
import { GalleryService } from './gallery.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly announcementsService: AnnouncementsService,
    private readonly eventsService: EventsService,
    private readonly galleryService: GalleryService,
  ) {}

  async getDashboardData(institutionId?: string) {
    const [announcements, events, gallery, birthdays] = await Promise.all([
      this.announcementsService.list(institutionId, true),
      this.eventsService.list(institutionId, true, true),
      this.galleryService.list(institutionId, undefined, true),
      this.eventsService.getBirthdays(institutionId),
    ]);

    return {
      announcements: announcements.slice(0, 5),
      upcomingEvents: events.slice(0, 5),
      gallery: gallery.slice(0, 8),
      birthdays: birthdays.slice(0, 10),
    };
  }
}
