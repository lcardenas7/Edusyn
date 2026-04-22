import { Body, Controller, Delete, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
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

  @Post('quizzes')
  async createQuiz(@Request() req: any, @Body() body: { title: string; description?: string; type?: string }) {
    return this.playService.createQuiz(req.user.id, body);
  }

  @Delete('quizzes/:id')
  async deleteQuiz(@Request() req: any, @Param('id') id: string) {
    return this.playService.deleteQuiz(req.user.id, id);
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
