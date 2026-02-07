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
      this.announcementsService.list(institutionId, true, 5),
      this.eventsService.list(institutionId, true, true, 5),
      this.galleryService.list(institutionId, undefined, true, 8),
      this.eventsService.getBirthdays(institutionId),
    ]);

    return {
      announcements,
      upcomingEvents: events,
      gallery,
      birthdays: birthdays.slice(0, 10),
    };
  }
}
