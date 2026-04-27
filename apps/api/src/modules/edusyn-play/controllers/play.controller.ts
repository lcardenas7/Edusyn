import {
  Body, Controller, Delete, Get, MessageEvent,
  Param, Patch, Post, Put, Query, Request, Res, Sse, UnauthorizedException, UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Observable, map, concat, of, from, EMPTY, switchMap } from 'rxjs';
import * as jwt from 'jsonwebtoken';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SkipTenantCheck } from '../../auth/decorators/skip-tenant-check.decorator';
import { PlayService } from '../services/play.service';
import { PlayStreamService } from '../services/play-stream.service';
import { GuestTokenService } from '../services/guest-token.service';

/**
 * Endpoints privados del panel /play del docente personal.
 * Requieren JWT. Todos filtran automáticamente por ownerUserId.
 */
@Controller('play')
export class PlayController {
  private readonly jwtSecret: string;

  constructor(
    private readonly playService: PlayService,
    private readonly playStream: PlayStreamService,
    private readonly guestTokens: GuestTokenService,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret = this.configService.getOrThrow<string>('JWT_SECRET');
  }

  @UseGuards(JwtAuthGuard)
  @Get('dashboard')
  async dashboard(@Request() req: any) {
    return this.playService.dashboard(req.user.id);
  }

  // ── Quizzes ──────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('quizzes')
  async listQuizzes(@Request() req: any) {
    return this.playService.listQuizzes(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('quizzes')
  async createQuiz(@Request() req: any, @Body() body: { title: string; description?: string; type?: string }) {
    return this.playService.createQuiz(req.user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('quizzes/:id')
  async updateQuiz(@Request() req: any, @Param('id') id: string, @Body() body: { title?: string; description?: string }) {
    return this.playService.updateQuiz(req.user.id, id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('quizzes/:id/questions/reorder')
  async reorderQuestions(@Request() req: any, @Param('id') id: string, @Body() body: { order: string[] }) {
    return this.playService.reorderQuestions(req.user.id, id, body.order);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('quizzes/:id')
  async deleteQuiz(@Request() req: any, @Param('id') id: string) {
    return this.playService.deleteQuiz(req.user.id, id);
  }

  // ── Questions ────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('quizzes/:activityId/questions')
  async listQuestions(@Request() req: any, @Param('activityId') activityId: string) {
    return this.playService.listQuestions(activityId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('quizzes/:activityId/questions')
  async addQuestion(@Request() req: any, @Param('activityId') activityId: string, @Body() body: {
    type: string; text: string; options?: any; correctAnswer?: string;
    points?: number; explanation?: string; imageUrl?: string; timeLimitSeconds?: number;
  }) {
    return this.playService.addQuestion(activityId, req.user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Put('questions/:questionId')
  async updateQuestion(@Request() req: any, @Param('questionId') questionId: string, @Body() body: {
    type?: string; text?: string; options?: any; correctAnswer?: string;
    points?: number; explanation?: string; imageUrl?: string; timeLimitSeconds?: number;
  }) {
    return this.playService.updateQuestion(questionId, req.user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('questions/:questionId')
  async deleteQuestion(@Request() req: any, @Param('questionId') questionId: string) {
    return this.playService.deleteQuestion(questionId, req.user.id);
  }

  // ── Lessons ──────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('lessons')
  async listLessons(@Request() req: any) {
    return this.playService.listLessons(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('lessons/:id')
  async getLesson(@Request() req: any, @Param('id') id: string) {
    return this.playService.getLesson(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('lessons')
  async createLesson(@Request() req: any, @Body() body: { title: string; description?: string }) {
    return this.playService.createLesson(req.user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('lessons/:id/slides')
  async createLessonSlide(@Request() req: any, @Param('id') id: string, @Body() body: {
    type: 'CONTENT' | 'ACTIVITY' | 'CHECKPOINT' | 'BADGE_REVEAL';
    title?: string;
    body?: string;
    imageUrl?: string;
    videoUrl?: string;
    audioUrl?: string;
    layout?: string;
    activityData?: any;
    badgeEmoji?: string;
    badgeTitle?: string;
  }) {
    return this.playService.createLessonSlide(req.user.id, id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Put('lessons/:id/slides/:slideId')
  async updateLessonSlide(@Request() req: any, @Param('id') id: string, @Param('slideId') slideId: string, @Body() body: {
    type?: 'CONTENT' | 'ACTIVITY' | 'CHECKPOINT' | 'BADGE_REVEAL';
    title?: string | null;
    body?: string | null;
    imageUrl?: string | null;
    videoUrl?: string | null;
    audioUrl?: string | null;
    layout?: string | null;
    activityData?: any;
    badgeEmoji?: string | null;
    badgeTitle?: string | null;
  }) {
    return this.playService.updateLessonSlide(req.user.id, id, slideId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('lessons/:id/slides/:slideId')
  async deleteLessonSlide(@Request() req: any, @Param('id') id: string, @Param('slideId') slideId: string) {
    return this.playService.deleteLessonSlide(req.user.id, id, slideId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('lessons/:id/slides/reorder')
  async reorderLessonSlides(@Request() req: any, @Param('id') id: string, @Body() body: { order: string[] }) {
    return this.playService.reorderLessonSlides(req.user.id, id, body.order);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('lessons/:id')
  async deleteLesson(@Request() req: any, @Param('id') id: string) {
    return this.playService.deleteLesson(req.user.id, id);
  }

  // ── Live Quiz Session ─────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('quizzes/:activityId/live')
  async createLiveQuiz(@Request() req: any, @Param('activityId') activityId: string) {
    return this.playService.createLiveQuizSession(req.user.id, activityId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('live/:sessionId')
  async getLiveQuizStatus(@Request() req: any, @Param('sessionId') sessionId: string) {
    return this.playService.getLiveQuizStatus(req.user.id, sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('live/:sessionId/start')
  async startLiveQuiz(@Request() req: any, @Param('sessionId') sessionId: string) {
    return this.playService.startLiveQuizSession(req.user.id, sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('live/:sessionId/next')
  async nextQuestionLive(@Request() req: any, @Param('sessionId') sessionId: string) {
    return this.playService.nextQuestionLive(req.user.id, sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('live/:sessionId/finish')
  async finishLiveQuiz(@Request() req: any, @Param('sessionId') sessionId: string) {
    return this.playService.finishLiveQuiz(req.user.id, sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('live/:sessionId/pause')
  async pauseSession(@Request() req: any, @Param('sessionId') sessionId: string) {
    return this.playService.pauseSession(req.user.id, sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('live/:sessionId/resume')
  async resumeSession(@Request() req: any, @Param('sessionId') sessionId: string) {
    return this.playService.resumeSession(req.user.id, sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('live/:sessionId/replay')
  async replaySession(@Request() req: any, @Param('sessionId') sessionId: string, @Body() body?: { shuffle?: boolean; keepGuests?: boolean }) {
    return this.playService.replaySession(req.user.id, sessionId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('live/:sessionId/question-stats')
  async getQuestionStats(@Request() req: any, @Param('sessionId') sessionId: string) {
    return this.playService.getQuestionStats(req.user.id, sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('live/:sessionId/export-csv')
  async exportCsv(@Request() req: any, @Param('sessionId') sessionId: string, @Res() res: Response) {
    const csv = await this.playService.exportSessionCsv(req.user.id, sessionId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="session-${sessionId}.csv"`);
    res.send('\uFEFF' + csv);
  }

  // ── Sessions ─────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  async listSessions(@Request() req: any) {
    return this.playService.listSessions(req.user.id);
  }

  // ── SSE Stream ───────────────────────────────────────
  // ⚠️  NO proteger con JwtAuthGuard ni TenantContextInterceptor.
  //     EventSource no puede enviar headers → auth por query param.
  //     @SkipTenantCheck() evita la transacción interactiva de Prisma
  //     que bloquearía el pool con una conexión por cliente SSE.
  @SkipTenantCheck()
  @Sse('live/:sessionId/stream')
  streamLiveSession(
    @Param('sessionId') sessionId: string,
    @Query('token') token?: string,
    @Query('guestToken') guestToken?: string,
  ): Observable<MessageEvent> {
    if (!token && !guestToken) throw new UnauthorizedException('Token requerido');
    if (token) {
      return from((async () => {
        let payload: any;
        try {
          payload = jwt.verify(token, this.jwtSecret);
        } catch {
          throw new UnauthorizedException('Token inválido');
        }
        const userId = payload?.sub;
        if (!userId || typeof userId !== 'string') {
          throw new UnauthorizedException('Token inválido');
        }
        await this.playService.assertOwnership(userId, sessionId);
        return true;
      })()).pipe(
        switchMap(() => {
          const subject = this.playStream.getOrCreateStream(sessionId);
          const initial$ = from(this.playService.getSessionStateForSSE(sessionId)).pipe(
            switchMap((state) =>
              state
                ? of({ type: 'SESSION_STATE', data: state } as MessageEvent)
                : EMPTY,
            ),
          );
          const live$ = subject.asObservable().pipe(
            map((event) => ({ type: event.type, data: event.data } as MessageEvent)),
          );
          return concat(initial$, live$);
        }),
      );
    }
    if (guestToken) {
      return from(this.guestTokens.verify(guestToken)).pipe(
        switchMap((payload) => {
          if (payload.sessionId !== sessionId || payload.sessionKind !== 'QUIZ') {
            throw new UnauthorizedException('Token de invitado inválido para esta sesión');
          }
          const subject = this.playStream.getOrCreateStream(sessionId);
          const initial$ = from(this.playService.getSessionStateForSSE(sessionId)).pipe(
            switchMap((state) =>
              state
                ? of({ type: 'SESSION_STATE', data: state } as MessageEvent)
                : EMPTY,
            ),
          );
          const live$ = subject.asObservable().pipe(
            map((event) => ({ type: event.type, data: event.data } as MessageEvent)),
          );
          return concat(initial$, live$);
        }),
      );
    }

    throw new UnauthorizedException('Token requerido');
  }
}
