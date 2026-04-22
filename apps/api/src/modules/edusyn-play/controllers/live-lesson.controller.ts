import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SkipTenantCheck } from '../../auth/decorators/skip-tenant-check.decorator';
import { LiveLessonService } from '../services/live-lesson.service';

/** Endpoints privados del docente para controlar una Lección Live. */
@Controller('live-lesson-session')
@UseGuards(JwtAuthGuard)
export class LiveLessonController {
  constructor(private readonly service: LiveLessonService) {}

  @Post()
  async create(@Request() req: any, @Body() body: { lessonId: string; guestMode?: 'GUESTS_ONLY' | 'MIXED' | 'DISABLED' }) {
    return this.service.create({ lessonId: body.lessonId, teacherId: req.user.id, guestMode: body.guestMode });
  }

  @Post(':id/start')
  async start(@Request() req: any, @Param('id') id: string) {
    return this.service.start(id, req.user.id);
  }

  @Patch(':id/advance')
  async advance(@Request() req: any, @Param('id') id: string, @Body() body: { currentSlideIndex: number }) {
    return this.service.advance(id, req.user.id, body.currentSlideIndex);
  }

  @Post(':id/pause')
  async pause(@Request() req: any, @Param('id') id: string) {
    return this.service.pause(id, req.user.id);
  }

  @Post(':id/resume')
  async resume(@Request() req: any, @Param('id') id: string) {
    return this.service.resume(id, req.user.id);
  }

  @Post(':id/finish')
  async finish(@Request() req: any, @Param('id') id: string) {
    return this.service.finish(id, req.user.id);
  }

  @Get(':id/reaction-stats')
  async reactionStats(@Request() req: any, @Param('id') id: string) {
    return this.service.reactionStats(id, req.user.id);
  }
}

/** Endpoint público para invitados: consultar estado actual de una Lección Live. */
@Controller('public/lesson-session')
@SkipTenantCheck()
export class LiveLessonPublicController {
  constructor(private readonly service: LiveLessonService) {}

  @Get(':id/status')
  async status(@Param('id') id: string) {
    return this.service.publicStatus(id);
  }
}
