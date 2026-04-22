import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PlayService } from '../services/play.service';

/**
 * Endpoints privados del panel /play del docente personal.
 * Requieren JWT. Todos filtran automáticamente por ownerUserId.
 */
@Controller('play')
@UseGuards(JwtAuthGuard)
export class PlayController {
  constructor(private readonly playService: PlayService) {}

  @Get('dashboard')
  async dashboard(@Request() req: any) {
    return this.playService.dashboard(req.user.id);
  }

  @Get('quizzes')
  async listQuizzes(@Request() req: any) {
    return this.playService.listQuizzes(req.user.id);
  }

  @Get('lessons')
  async listLessons(@Request() req: any) {
    return this.playService.listLessons(req.user.id);
  }

  @Get('sessions')
  async listSessions(@Request() req: any) {
    return this.playService.listSessions(req.user.id);
  }
}
