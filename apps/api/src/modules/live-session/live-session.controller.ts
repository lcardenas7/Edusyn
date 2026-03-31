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
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConfigService } from '@nestjs/config';
import { LiveSessionService, LiveEvent } from './live-session.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Observable, map, concat, of, from, EMPTY, switchMap } from 'rxjs';
import * as jwt from 'jsonwebtoken';
import { SkipTenantCheck } from '../auth/decorators/skip-tenant-check.decorator';

@Controller('live-session')
export class LiveSessionController {
  private readonly jwtSecret: string;

  constructor(
    private readonly liveSessionService: LiveSessionService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.jwtSecret = this.configService.getOrThrow<string>('JWT_SECRET');
  }

  // Verifica que la sesión pertenezca a la misma institución del usuario
  private async verifySessionTenant(sessionId: string, userInstitutionId: string | null) {
    if (!userInstitutionId) throw new ForbiddenException('Se requiere institución activa');
    const session = await this.prisma.liveSession.findUnique({
      where: { id: sessionId },
      select: { classroom: { select: { teacherAssignment: { select: { institutionId: true } } } } },
    });
    if (!session) return; // Let service handle NotFoundException
    const sessionInstitutionId = session.classroom?.teacherAssignment?.institutionId;
    if (sessionInstitutionId && sessionInstitutionId !== userInstitutionId) {
      throw new ForbiddenException('No tienes acceso a esta sesión');
    }
  }

  // Verifica que el classroom pertenezca a la misma institución
  private async verifyClassroomTenant(classroomId: string, userInstitutionId: string | null) {
    if (!userInstitutionId) throw new ForbiddenException('Se requiere institución activa');
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: classroomId },
      select: { teacherAssignment: { select: { institutionId: true } } },
    });
    if (!classroom) return;
    if (classroom.teacherAssignment?.institutionId !== userInstitutionId) {
      throw new ForbiddenException('No tienes acceso a esta aula');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SSE Stream — GET /live-session/:id/stream
  // ═══════════════════════════════════════════════════════════════════════════

  // ⚠️ NO agregar @UseGuards(JwtAuthGuard) aquí. El SSE mantiene la conexión abierta
  // indefinidamente. Si JwtAuthGuard se activa, el TenantContextInterceptor abre una
  // transacción interactiva que bloquea 1 conexión del pool POR CADA cliente SSE.
  // Con 35 estudiantes = 35 conexiones bloqueadas permanentemente → pool agotado.
  // La auth se hace manualmente via query param token (línea siguiente).
  @SkipTenantCheck()
  @Sse(':id/stream')
  stream(
    @Param('id') sessionId: string, 
    @Query('token') token?: string,
    @Query('enrollmentId') enrollmentId?: string,
  ): Observable<MessageEvent> {
    // EventSource can't send headers — validate JWT from query param
    if (!token) throw new UnauthorizedException('Token requerido');
    let payload: any;
    try {
      payload = jwt.verify(token, this.jwtSecret);
    } catch {
      throw new UnauthorizedException('Token inválido');
    }

    // Tenant validation for SSE: verify token has institutionId
    if (!payload.institutionId && !payload.isSuperAdmin) {
      throw new ForbiddenException('Token sin institución activa');
    }

    // Track student connection for auto-close feature
    if (enrollmentId) {
      this.liveSessionService.trackStudentConnection(sessionId, enrollmentId);
    }

    const subject = this.liveSessionService.getOrCreateStream(sessionId);

    // Live stream of future events
    const live$ = subject.asObservable().pipe(
      map((event: LiveEvent) => ({
        type: event.type,
        data: event.data,
      } as MessageEvent)),
    );

    // Replay current question for clients joining mid-question (async → Observable)
    const replay$ = from(this.liveSessionService.getReplayEvent(sessionId)).pipe(
      switchMap((event) =>
        event
          ? of({ type: event.type, data: event.data } as MessageEvent)
          : EMPTY,
      ),
    );

    // Replay first, then live stream
    return concat(replay$, live$);
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
    await this.verifyClassroomTenant(body.classroomId, req.user.institutionId);
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
  async getSession(@Param('id') sessionId: string, @Request() req: any) {
    await this.verifySessionTenant(sessionId, req.user.institutionId);
    return this.liveSessionService.getSession(sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('active/:classroomId')
  async getActiveSession(@Param('classroomId') classroomId: string, @Request() req: any) {
    await this.verifyClassroomTenant(classroomId, req.user.institutionId);
    return this.liveSessionService.getActiveSession(classroomId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/start')
  async start(@Param('id') sessionId: string, @Request() req: any) {
    await this.verifySessionTenant(sessionId, req.user.institutionId);
    return this.liveSessionService.startSession(sessionId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/next-question')
  async nextQuestion(@Param('id') sessionId: string, @Request() req: any) {
    await this.verifySessionTenant(sessionId, req.user.institutionId);
    return this.liveSessionService.nextQuestion(sessionId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/close-question')
  async closeQuestion(@Param('id') sessionId: string, @Request() req: any) {
    await this.verifySessionTenant(sessionId, req.user.institutionId);
    return this.liveSessionService.closeQuestion(sessionId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/show-ranking')
  async showRanking(@Param('id') sessionId: string, @Request() req: any) {
    await this.verifySessionTenant(sessionId, req.user.institutionId);
    return this.liveSessionService.showRanking(sessionId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/finish')
  async finish(@Param('id') sessionId: string, @Request() req: any) {
    await this.verifySessionTenant(sessionId, req.user.institutionId);
    return this.liveSessionService.finishSession(sessionId, req.user.id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Team Endpoints
  // ═══════════════════════════════════════════════════════════════════════════

  @UseGuards(JwtAuthGuard)
  @Post(':id/teams')
  async createTeams(
    @Param('id') sessionId: string,
    @Request() req: any,
    @Body() body: { teams: { name: string; color?: string }[] },
  ) {
    await this.verifySessionTenant(sessionId, req.user.institutionId);
    return this.liveSessionService.createTeams(sessionId, req.user.id, body.teams);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/teams')
  async getTeams(@Param('id') sessionId: string, @Request() req: any) {
    await this.verifySessionTenant(sessionId, req.user.institutionId);
    return this.liveSessionService.getTeams(sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/join-team')
  async joinTeam(
    @Param('id') sessionId: string,
    @Request() req: any,
    @Body() body: { teamId: string },
  ) {
    await this.verifySessionTenant(sessionId, req.user.institutionId);
    return this.liveSessionService.joinTeam(sessionId, body.teamId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/add-partner')
  async addPartner(
    @Param('id') sessionId: string,
    @Request() req: any,
    @Body() body: { teamId: string; studentEnrollmentId: string },
  ) {
    await this.verifySessionTenant(sessionId, req.user.institutionId);
    return this.liveSessionService.addPartnerToTeam(sessionId, body.teamId, body.studentEnrollmentId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/search-students')
  async searchStudents(
    @Param('id') sessionId: string,
    @Request() req: any,
    @Query('q') query?: string,
  ) {
    await this.verifySessionTenant(sessionId, req.user.institutionId);
    return this.liveSessionService.searchGroupStudents(sessionId, query || '');
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/create-team')
  async createTeam(
    @Param('id') sessionId: string,
    @Request() req: any,
    @Body() body: { name: string },
  ) {
    await this.verifySessionTenant(sessionId, req.user.institutionId);
    return this.liveSessionService.createTeamByStudent(sessionId, body.name, req.user.id);
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
    await this.verifySessionTenant(sessionId, req.user.institutionId);
    return this.liveSessionService.submitAnswer(
      sessionId,
      body.questionId,
      req.user.id,
      body.answer,
      body.responseTimeMs,
    );
  }
}
