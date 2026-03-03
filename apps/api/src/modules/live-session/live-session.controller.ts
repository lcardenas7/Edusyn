import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Request,
  Sse,
  MessageEvent,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConfigService } from '@nestjs/config';
import { LiveSessionService, LiveEvent } from './live-session.service';
import { Observable, map } from 'rxjs';
import * as jwt from 'jsonwebtoken';

@Controller('live-session')
export class LiveSessionController {
  private readonly jwtSecret: string;

  constructor(
    private readonly liveSessionService: LiveSessionService,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret = this.configService.getOrThrow<string>('JWT_SECRET');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SSE Stream — GET /live-session/:id/stream
  // ═══════════════════════════════════════════════════════════════════════════

  @Sse(':id/stream')
  stream(@Param('id') sessionId: string, @Query('token') token?: string): Observable<MessageEvent> {
    // EventSource can't send headers — validate JWT from query param
    if (!token) throw new UnauthorizedException('Token requerido');
    try {
      jwt.verify(token, this.jwtSecret);
    } catch {
      throw new UnauthorizedException('Token inválido');
    }
    const subject = this.liveSessionService.getOrCreateStream(sessionId);
    return subject.asObservable().pipe(
      map((event: LiveEvent) => ({
        type: event.type,
        data: JSON.stringify(event.data),
      } as MessageEvent)),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Teacher Endpoints
  // ═══════════════════════════════════════════════════════════════════════════

  @UseGuards(JwtAuthGuard)
  @Post('create')
  async create(
    @Request() req: any,
    @Body() body: { classroomId: string; activityId: string; mode?: 'INDIVIDUAL' | 'TEAM'; config?: any },
  ) {
    return this.liveSessionService.createSession(
      body.classroomId,
      body.activityId,
      req.user.id,
      body.mode,
      body.config,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getSession(@Param('id') sessionId: string) {
    return this.liveSessionService.getSession(sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('active/:classroomId')
  async getActiveSession(@Param('classroomId') classroomId: string) {
    return this.liveSessionService.getActiveSession(classroomId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/start')
  async start(@Param('id') sessionId: string, @Request() req: any) {
    return this.liveSessionService.startSession(sessionId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/next-question')
  async nextQuestion(@Param('id') sessionId: string, @Request() req: any) {
    return this.liveSessionService.nextQuestion(sessionId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/close-question')
  async closeQuestion(@Param('id') sessionId: string, @Request() req: any) {
    return this.liveSessionService.closeQuestion(sessionId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/show-ranking')
  async showRanking(@Param('id') sessionId: string, @Request() req: any) {
    return this.liveSessionService.showRanking(sessionId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/finish')
  async finish(@Param('id') sessionId: string, @Request() req: any) {
    return this.liveSessionService.finishSession(sessionId, req.user.id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Student Endpoint
  // ═══════════════════════════════════════════════════════════════════════════

  @UseGuards(JwtAuthGuard)
  @Post(':id/answer')
  async answer(
    @Param('id') sessionId: string,
    @Request() req: any,
    @Body() body: { questionId: string; answer: string; responseTimeMs: number },
  ) {
    return this.liveSessionService.submitAnswer(
      sessionId,
      body.questionId,
      req.user.id,
      body.answer,
      body.responseTimeMs,
    );
  }
}
