import { Body, Controller, Delete, Get, Param, Post, Put, Request, UseGuards } from '@nestjs/common';
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

  // ── Quizzes ──────────────────────────────────────────
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

  // ── Questions ────────────────────────────────────────
  @Get('quizzes/:activityId/questions')
  async listQuestions(@Request() req: any, @Param('activityId') activityId: string) {
    return this.playService.listQuestions(activityId, req.user.id);
  }

  @Post('quizzes/:activityId/questions')
  async addQuestion(@Request() req: any, @Param('activityId') activityId: string, @Body() body: {
    type: string; text: string; options?: any; correctAnswer?: string;
    points?: number; explanation?: string; imageUrl?: string;
  }) {
    return this.playService.addQuestion(activityId, req.user.id, body);
  }

  @Put('questions/:questionId')
  async updateQuestion(@Request() req: any, @Param('questionId') questionId: string, @Body() body: {
    text?: string; options?: any; correctAnswer?: string;
    points?: number; explanation?: string; imageUrl?: string;
  }) {
    return this.playService.updateQuestion(questionId, req.user.id, body);
  }

  @Delete('questions/:questionId')
  async deleteQuestion(@Request() req: any, @Param('questionId') questionId: string) {
    return this.playService.deleteQuestion(questionId, req.user.id);
  }

  // ── Lessons ──────────────────────────────────────────
  @Get('lessons')
  async listLessons(@Request() req: any) {
    return this.playService.listLessons(req.user.id);
  }

  @Post('lessons')
  async createLesson(@Request() req: any, @Body() body: { title: string; description?: string }) {
    return this.playService.createLesson(req.user.id, body);
  }

  @Delete('lessons/:id')
  async deleteLesson(@Request() req: any, @Param('id') id: string) {
    return this.playService.deleteLesson(req.user.id, id);
  }

  // ── Sessions ─────────────────────────────────────────
  @Get('sessions')
  async listSessions(@Request() req: any) {
    return this.playService.listSessions(req.user.id);
  }
}
