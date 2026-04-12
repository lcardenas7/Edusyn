import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { Subject } from 'rxjs';

// SSE event types
export type LiveEventType =
  | 'PING'
  | 'SESSION_STARTED'
  | 'QUESTION'
  | 'ANSWER_PROGRESS'
  | 'RANKING'
  | 'QUESTION_CLOSED'
  | 'SESSION_FINISHED'
  | 'SESSION_ENDED'
  | 'SESSION_RESET';

export interface LiveEvent {
  type: LiveEventType;
  data: any;
}

@Injectable()
export class LiveSessionService implements OnModuleDestroy {
  private readonly logger = new Logger(LiveSessionService.name);
  // Map of sessionId → Subject for SSE broadcasting
  private streams = new Map<string, Subject<LiveEvent>>();
  // Map of sessionId → heartbeat interval
  private heartbeats = new Map<string, ReturnType<typeof setInterval>>();
  // Map of sessionId → creation timestamp (for orphan detection)
  private streamCreatedAt = new Map<string, number>();
  // Map of sessionId → Set of connected studentEnrollmentIds (for auto-close)
  private connectedStudents = new Map<string, Set<string>>();
  // Map of sessionId → timer for auto-closing current question
  private questionTimers = new Map<string, ReturnType<typeof setTimeout>>();
  // Map of sessionId → Set of questionIdx already closed (prevent double broadcast)
  private closedQuestions = new Map<string, Set<number>>();
  // Map of sessionId → snapshot of connected students count at question start (for reliable auto-close)
  private questionConnectedSnapshot = new Map<string, number>();
  // Map of sessionId → current question data (for timer auto-close without Prisma query)
  private currentQuestionData = new Map<string, { questionIdx: number; questionId: string; correctAnswer: any; explanation: string | null }>();
  // Map of sessionId → Map of enrollmentId → avatarId (for ranking display)
  private studentAvatars = new Map<string, Map<string, string>>();

  constructor(private prisma: PrismaService) {}

  // Track student connection and store avatar
  trackStudentConnection(sessionId: string, studentEnrollmentId: string, avatarId?: string) {
    if (!this.connectedStudents.has(sessionId)) {
      this.connectedStudents.set(sessionId, new Set());
    }
    this.connectedStudents.get(sessionId)!.add(studentEnrollmentId);
    
    // Store avatar for ranking display
    if (avatarId) {
      if (!this.studentAvatars.has(sessionId)) {
        this.studentAvatars.set(sessionId, new Map());
      }
      this.studentAvatars.get(sessionId)!.set(studentEnrollmentId, avatarId);
    }
    
    this.logger.log(`Student ${studentEnrollmentId} connected to session ${sessionId} with avatar ${avatarId || 'none'}. Total: ${this.connectedStudents.get(sessionId)!.size}`);
  }

  // Get student avatar
  getStudentAvatar(sessionId: string, studentEnrollmentId: string): string | undefined {
    return this.studentAvatars.get(sessionId)?.get(studentEnrollmentId);
  }

  // Get connected student count
  getConnectedStudentCount(sessionId: string): number {
    return this.connectedStudents.get(sessionId)?.size || 0;
  }

  onModuleDestroy() {
    for (const sessionId of [...this.streams.keys()]) {
      this.cleanupStream(sessionId);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SSE Stream Management
  // ═══════════════════════════════════════════════════════════════════════════

  getOrCreateStream(sessionId: string): Subject<LiveEvent> {
    if (!this.streams.has(sessionId)) {
      const subject = new Subject<LiveEvent>();
      this.streams.set(sessionId, subject);
      this.streamCreatedAt.set(sessionId, Date.now());
      // Heartbeat every 25s to keep Railway connection alive
      const hb = setInterval(() => {
        subject.next({ type: 'PING', data: { ts: Date.now() } });
      }, 25000);
      this.heartbeats.set(sessionId, hb);
    }
    return this.streams.get(sessionId)!;
  }

  private broadcast(sessionId: string, event: LiveEvent) {
    const stream = this.streams.get(sessionId);
    if (stream) {
      stream.next(event);
    } else {
      this.logger.warn(`broadcast(${event.type}) failed: no stream for session ${sessionId}`);
    }
  }

  /**
   * Build a replay QUESTION event for a new SSE client joining mid-question.
   * Returns null if session is not ACTIVE or no current question.
   */
  async getReplayEvent(sessionId: string): Promise<LiveEvent | null> {
    const session = await this.prisma.liveSession.findUnique({
      where: { id: sessionId },
      select: { status: true, currentQuestionIdx: true, activityId: true, config: true },
    });
    this.logger.log(`getReplayEvent: session=${sessionId}, status=${session?.status}, questionIdx=${session?.currentQuestionIdx}`);
    if (!session || session.status !== 'ACTIVE' || session.currentQuestionIdx < 0) {
      this.logger.log(`getReplayEvent: returning null (session not active or no question)`);
      return null;
    }

    // Check if question is already closed (answer_reveal phase) — don't replay
    if (this.closedQuestions.get(sessionId)?.has(session.currentQuestionIdx)) {
      this.logger.log(`getReplayEvent: returning null (question already closed)`);
      return null;
    }

    const questions = await this.prisma.activityQuestion.findMany({
      where: { activityId: session.activityId },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, type: true, text: true, imageUrl: true, options: true, points: true, context: true },
    });
    const orderedQuestions = this.orderQuestionsForSession(questions, session.config);
    const q = orderedQuestions[session.currentQuestionIdx];
    if (!q) {
      this.logger.log(`getReplayEvent: returning null (question not found at index ${session.currentQuestionIdx})`);
      return null;
    }

    const config = (session.config as any) || {};
    const isBonus = config.bonusQuestions?.includes(session.currentQuestionIdx) || false;
    const multiplier = config.multipliers?.[String(session.currentQuestionIdx)] || 1;
    const timeLimit = config.timeLimitOverride || 15;

    this.logger.log(`getReplayEvent: sending QUESTION event for questionId=${q.id}, index=${session.currentQuestionIdx}`);
    return {
      type: 'QUESTION',
      data: {
        index: session.currentQuestionIdx,
        total: orderedQuestions.length,
        questionId: q.id,
        type: q.type,
        text: q.text,
        imageUrl: q.imageUrl,
        options: q.options,
        points: Number(q.points),
        isBonus,
        multiplier,
        timeLimit,
        context: q.context || null,
      },
    };
  }

  private cleanupStream(sessionId: string) {
    const hb = this.heartbeats.get(sessionId);
    if (hb) clearInterval(hb);
    this.heartbeats.delete(sessionId);
    this.streamCreatedAt.delete(sessionId);
    this.connectedStudents.delete(sessionId);
    this.clearQuestionTimer(sessionId);
    this.closedQuestions.delete(sessionId);
    this.questionConnectedSnapshot.delete(sessionId);
    this.currentQuestionData.delete(sessionId);
    this.studentAvatars.delete(sessionId);
    const stream = this.streams.get(sessionId);
    if (stream) {
      stream.complete();
      this.streams.delete(sessionId);
    }
  }

  /**
   * Limpia streams huérfanos: sesiones que ya terminaron en BD
   * o que llevan más de 2 horas abiertas sin actividad.
   * Llamado por LiveSessionCronService cada 5 minutos.
   */
  async cleanupOrphanedStreams() {
    const sessionIds = [...this.streams.keys()];
    if (sessionIds.length === 0) return;

    const TWO_HOURS = 2 * 60 * 60 * 1000;
    let cleaned = 0;

    // Check which sessions are still ACTIVE/WAITING in DB
    const activeSessions = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "LiveSession"
      WHERE id = ANY(${sessionIds})
        AND status IN ('ACTIVE', 'WAITING')
    `;
    const activeIds = new Set(activeSessions.map(s => s.id));

    for (const sessionId of sessionIds) {
      const isActive = activeIds.has(sessionId);
      const createdAt = this.streamCreatedAt.get(sessionId) || 0;
      const age = Date.now() - createdAt;

      // Clean if: session finished/doesn't exist in DB, OR stream older than 2h
      if (!isActive || age > TWO_HOURS) {
        this.cleanupStream(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.log(`Cleaned ${cleaned} orphaned SSE streams (${this.streams.size} remaining)`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Session CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  async createSession(
    classroomId: string,
    activityId: string,
    teacherId: string,
    mode: 'INDIVIDUAL' | 'TEAM' = 'INDIVIDUAL',
    config?: any,
  ) {
    // Validate ownership
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: classroomId },
      include: { teacherAssignment: { select: { teacherId: true } } },
    });
    if (!classroom || classroom.teacherAssignment.teacherId !== teacherId) {
      throw new ForbiddenException('No tiene permisos sobre esta aula');
    }

    // Validate activity belongs to classroom and has questions
    const activity = await this.prisma.classroomActivity.findFirst({
      where: { id: activityId, classroomId },
      select: {
        id: true,
        shuffleQuestions: true,
        questions: { orderBy: { sortOrder: 'asc' }, select: { id: true } },
      },
    });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    if (activity.questions.length === 0) {
      throw new BadRequestException('La actividad no tiene preguntas');
    }

    const questionOrder = activity.shuffleQuestions
      ? this.shuffleArray(activity.questions.map((q) => q.id))
      : activity.questions.map((q) => q.id);

    const deliveryMode = config?.deliveryMode === 'ASYNC_HOME' ? 'ASYNC_HOME' : 'SYNC';
    const finalConfig = {
      ...(config || {}),
      questionOrder,
      deliveryMode,
    };

    // Close any existing WAITING/ACTIVE session for this classroom
    const oldSessions = await this.prisma.liveSession.findMany({
      where: { classroomId, status: { in: ['WAITING', 'ACTIVE'] } },
      select: { id: true },
    });
    if (oldSessions.length > 0) {
      // Notify connected students that old session is over
      for (const old of oldSessions) {
        this.broadcast(old.id, { type: 'SESSION_ENDED', data: {} });
        // Cleanup stream & timers after a short delay so the event is delivered
        setTimeout(() => this.cleanupStream(old.id), 2000);
      }
      await this.prisma.liveSession.updateMany({
        where: { classroomId, status: { in: ['WAITING', 'ACTIVE'] } },
        data: { status: 'FINISHED', finishedAt: new Date() },
      });
    }

    return this.prisma.liveSession.create({
      data: {
        classroomId,
        activityId,
        teacherId,
        mode: mode as any,
        deliveryMode,
        config: finalConfig,
        status: 'WAITING',
        parentSessionId: null,
        studentEnrollmentId: null,
      },
      include: {
        activity: {
          select: {
            id: true,
            title: true,
            questions: {
              orderBy: { sortOrder: 'asc' },
              select: { id: true, type: true, text: true, imageUrl: true, options: true, points: true, sortOrder: true },
            },
          },
        },
      },
    });
  }

  async getSession(sessionId: string) {
    const session = await this.prisma.liveSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        classroomId: true,
        teacherId: true,
        activityId: true,
        status: true,
        mode: true,
        deliveryMode: true,
        parentSessionId: true,
        studentEnrollmentId: true,
        currentQuestionIdx: true,
        config: true,
        createdAt: true,
        startedAt: true,
        finishedAt: true,
        parentSession: { select: { id: true, deliveryMode: true } },
        studentEnrollment: { select: { id: true, student: { select: { id: true, firstName: true, lastName: true } } } },
        activity: {
          select: {
            id: true,
            title: true,
            timeLimitMinutes: true,
            questions: {
              orderBy: { sortOrder: 'asc' },
              select: { id: true, type: true, text: true, imageUrl: true, options: true, points: true, correctAnswer: true, sortOrder: true, context: { select: { id: true, title: true, text: true, imageUrl: true } } },
            },
          },
        },
        teams: { include: { members: { include: { studentEnrollment: { include: { student: { select: { id: true, firstName: true, lastName: true } } } } } } } },
      },
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');
    return session;
  }

  async getActiveSession(classroomId: string) {
    return this.prisma.liveSession.findFirst({
      where: { classroomId, status: { in: ['WAITING', 'ACTIVE'] }, parentSessionId: null },
      select: {
        id: true,
        status: true,
        mode: true,
        currentQuestionIdx: true,
        activityId: true,
        config: true,
        teacherId: true,
        deliveryMode: true,
        parentSessionId: true,
      },
    });
  }

  private isAsyncHomeConfig(config: any): boolean {
    return (config as any)?.deliveryMode === 'ASYNC_HOME';
  }

  async joinAsyncHomeSession(parentSessionId: string, userId: string) {
    const parentSession = await this.prisma.liveSession.findUnique({
      where: { id: parentSessionId },
      select: { id: true, classroomId: true, activityId: true, teacherId: true, status: true, config: true, deliveryMode: true },
    });
    if (!parentSession) throw new NotFoundException('Sesión no encontrada');

    const parentConfig = (parentSession.config as any) || {};
    if (parentSession.deliveryMode !== 'ASYNC_HOME' && !this.isAsyncHomeConfig(parentConfig)) {
      throw new BadRequestException('La sesión no es de tipo Live Quiz en casa');
    }
    if (parentSession.status === 'FINISHED') {
      throw new BadRequestException('La sesión ya finalizó');
    }

    const classroom = await this.prisma.classroom.findUnique({
      where: { id: parentSession.classroomId },
      include: { teacherAssignment: { select: { groupId: true, academicYearId: true } } },
    });
    if (!classroom) throw new NotFoundException('Aula no encontrada');

    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: {
        student: { userId },
        groupId: classroom.teacherAssignment.groupId,
        academicYearId: classroom.teacherAssignment.academicYearId,
        status: 'ACTIVE',
      },
    });
    if (!enrollment) throw new ForbiddenException('No está matriculado en este grupo');

    const existingSessions = await this.prisma.liveSession.findMany({
      where: {
        parentSessionId,
        studentEnrollmentId: enrollment.id,
      },
      select: { id: true, status: true, config: true, teacherId: true, parentSessionId: true, studentEnrollmentId: true, deliveryMode: true },
    });

    const existing = existingSessions.find((s) => {
      const cfg = (s.config as any) || {};
      return s.parentSessionId === parentSessionId && s.studentEnrollmentId === enrollment.id || cfg.asyncParentSessionId === parentSessionId && cfg.asyncEnrollmentId === enrollment.id;
    });

    if (existing) {
      return this.getSession(existing.id);
    }

    const questionOrder = Array.isArray(parentConfig.questionOrder) && parentConfig.questionOrder.length > 0
      ? parentConfig.questionOrder
      : parentConfig.questionOrder || [];

    const childConfig = {
      ...parentConfig,
      deliveryMode: 'ASYNC_HOME',
      asyncParentSessionId: parentSessionId,
      asyncEnrollmentId: enrollment.id,
      autoClose: true,
      questionOrder,
    };

    const childSession = await this.prisma.liveSession.create({
      data: {
        classroomId: parentSession.classroomId,
        teacherId: parentSession.teacherId,
        activityId: parentSession.activityId,
        mode: 'INDIVIDUAL',
        status: 'WAITING',
        currentQuestionIdx: -1,
        deliveryMode: 'ASYNC_HOME',
        parentSessionId,
        studentEnrollmentId: enrollment.id,
        config: childConfig,
      },
    });

    await this.startSession(childSession.id, parentSession.teacherId);
    await this.nextQuestion(childSession.id, parentSession.teacherId);

    return this.getSession(childSession.id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Game Flow
  // ═══════════════════════════════════════════════════════════════════════════

  async startSession(sessionId: string, teacherId: string) {
    const session = await this.validateTeacherSession(sessionId, teacherId);
    if (session.status !== 'WAITING') {
      throw new BadRequestException('La sesión ya fue iniciada');
    }

    const updated = await this.prisma.liveSession.update({
      where: { id: sessionId },
      data: { status: 'ACTIVE', startedAt: new Date(), currentQuestionIdx: -1 },
    });

    this.broadcast(sessionId, { type: 'SESSION_STARTED', data: { sessionId } });
    return updated;
  }

  async nextQuestion(sessionId: string, teacherId: string) {
    const session = await this.validateTeacherSession(sessionId, teacherId);
    if (session.status !== 'ACTIVE') {
      throw new BadRequestException('La sesión no está activa');
    }

    return this.advanceQuestion(sessionId, session);
  }

  async advanceAsyncHomeQuestion(sessionId: string, userId: string, expectedQuestionIdx: number) {
    const session = await this.prisma.liveSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        status: true,
        currentQuestionIdx: true,
        deliveryMode: true,
        parentSessionId: true,
        studentEnrollmentId: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Sesión no encontrada');
    }

    if (session.deliveryMode !== 'ASYNC_HOME' || !session.parentSessionId || !session.studentEnrollmentId) {
      throw new BadRequestException('La sesión no corresponde a un Live Quiz en casa');
    }

    const enrollment = await this.prisma.studentEnrollment.findUnique({
      where: { id: session.studentEnrollmentId },
      select: { student: { select: { userId: true } } },
    });

    if (!enrollment || enrollment.student.userId !== userId) {
      throw new ForbiddenException('No tiene permisos sobre esta sesión');
    }

    // If already finished (e.g. auto-advance finished it), return final ranking
    if (session.status === 'FINISHED') {
      const updatedSession = await this.getSession(sessionId);
      const ranking = await this.getRanking(sessionId, 10);
      return { session: updatedSession, ranking };
    }

    if (session.status !== 'ACTIVE') {
      throw new BadRequestException('La sesión no está activa');
    }

    // If the backend is still on the question the student just answered (or behind it),
    // advance it now. If it already advanced, just return the current session state.
    if (session.currentQuestionIdx <= expectedQuestionIdx) {
      await this.advanceQuestion(sessionId);
    }

    const updatedSession = await this.getSession(sessionId);
    if (updatedSession.status === 'FINISHED') {
      const ranking = await this.getRanking(sessionId, 10);
      return { session: updatedSession, ranking };
    }

    return updatedSession;
  }

  private async advanceQuestion(sessionId: string, sessionOverride?: {
    activityId: string;
    currentQuestionIdx: number;
    config: any;
    teacherId: string;
    status: string;
  }) {
    const session = sessionOverride || await this.prisma.liveSession.findUnique({
      where: { id: sessionId },
      select: { activityId: true, currentQuestionIdx: true, config: true, teacherId: true, status: true },
    });
    if (!session) {
      throw new NotFoundException('Sesión no encontrada');
    }
    if (session.status !== 'ACTIVE') {
      throw new BadRequestException('La sesión no está activa');
    }

    const questions = await this.prisma.activityQuestion.findMany({
      where: { activityId: session.activityId },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, type: true, text: true, imageUrl: true, options: true, points: true, sortOrder: true, context: { select: { id: true, title: true, text: true, imageUrl: true } } },
    });
    const orderedQuestions = this.orderQuestionsForSession(questions, session.config);

    const nextIdx = session.currentQuestionIdx + 1;
    if (nextIdx >= orderedQuestions.length) {
      if (sessionOverride) {
        return this.finishSession(sessionId, session.teacherId);
      }
      return this.finishSession(sessionId, session.teacherId);
    }

    await this.prisma.liveSession.update({
      where: { id: sessionId },
      data: { currentQuestionIdx: nextIdx },
    });

    const q = orderedQuestions[nextIdx];
    const config = (session.config as any) || {};
    const isBonus = config.bonusQuestions?.includes(nextIdx) || false;
    const multiplier = config.multipliers?.[String(nextIdx)] || 1;
    const timeLimit = config.timeLimitOverride || 15;

    // Cancel any pending timer from previous question & reset closed tracking for new question
    this.clearQuestionTimer(sessionId);
    this.closedQuestions.delete(sessionId); // allow new question to be closed by timer/auto-close
    // Snapshot connected students count for reliable auto-close
    this.questionConnectedSnapshot.set(sessionId, this.getConnectedStudentCount(sessionId));

    this.broadcast(sessionId, {
      type: 'QUESTION',
      data: {
        index: nextIdx,
        total: orderedQuestions.length,
        questionId: q.id,
        type: q.type,
        text: q.text,
        imageUrl: q.imageUrl,
        options: q.options,
        points: Number(q.points),
        isBonus,
        multiplier,
        timeLimit,
        context: q.context || null,
      },
    });

    // Store current question data for timer auto-close (avoids Prisma query in setTimeout)
    // Need to fetch correctAnswer and explanation since 'q' doesn't have them
    const fullQuestion = await this.prisma.activityQuestion.findUnique({
      where: { id: q.id },
      select: { correctAnswer: true, explanation: true },
    });
    this.currentQuestionData.set(sessionId, {
      questionIdx: nextIdx,
      questionId: q.id,
      correctAnswer: fullQuestion?.correctAnswer,
      explanation: fullQuestion?.explanation || null,
    });

    // Start server-side auto-close timer (reliable fallback)
    this.logger.log(`Starting question ${nextIdx} for session ${sessionId} with timeLimit=${timeLimit}s, connectedStudents=${this.getConnectedStudentCount(sessionId)}`);
    this.startQuestionTimer(sessionId, nextIdx, timeLimit);

    return { index: nextIdx, total: orderedQuestions.length, question: q };
  }

  async submitAnswer(
    sessionId: string,
    questionId: string,
    userId: string,
    answer: string,
    responseTimeMs: number,
  ) {
    const session = await this.prisma.liveSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        status: true,
        classroomId: true,
        activityId: true,
        currentQuestionIdx: true,
        config: true,
        mode: true,
        deliveryMode: true,
        parentSessionId: true,
      },
    });
    if (!session || session.status !== 'ACTIVE') {
      throw new BadRequestException('La sesión no está activa');
    }

    // Get enrollment
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: session.classroomId },
      include: { teacherAssignment: { select: { groupId: true, academicYearId: true } } },
    });
    if (!classroom) throw new NotFoundException('Aula no encontrada');

    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: {
        student: { userId },
        groupId: classroom.teacherAssignment.groupId,
        academicYearId: classroom.teacherAssignment.academicYearId,
        status: 'ACTIVE',
      },
    });
    if (!enrollment) throw new ForbiddenException('No está matriculado en este grupo');

    // Check not already answered
    const existing = await this.prisma.liveSessionAnswer.findUnique({
      where: {
        sessionId_questionId_studentEnrollmentId: {
          sessionId,
          questionId,
          studentEnrollmentId: enrollment.id,
        },
      },
    });
    if (existing) throw new BadRequestException('Ya respondió esta pregunta');

    // Verify question is the current one
    const questions = await this.prisma.activityQuestion.findMany({
      where: { activityId: session.activityId },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, correctAnswer: true, points: true, type: true, options: true },
    });
    const orderedQuestions = this.orderQuestionsForSession(questions, session.config);
    const currentQ = orderedQuestions[session.currentQuestionIdx];
    if (!currentQ || currentQ.id !== questionId) {
      throw new BadRequestException('La pregunta no es la actual');
    }

    // Check correctness
    const isCorrect = this.checkAnswer(currentQ, answer);

    // Calculate points
    const config = (session.config as any) || {};
    const timeLimit = (config.timeLimitOverride || 15) * 1000; // ms
    const basePoints = Number(currentQ.points) * 1000;
    const isBonus = config.bonusQuestions?.includes(session.currentQuestionIdx) || false;
    const multiplier = config.multipliers?.[String(session.currentQuestionIdx)] || 1;

    let points = 0;
    if (isCorrect) {
      // points = base * (1 - responseTime / (timeLimit * 2)), clamped to [0, base]
      points = basePoints * (1 - responseTimeMs / (timeLimit * 2));
      points = Math.max(0, Math.round(points));
      if (isBonus) points = points * multiplier;
    }

    // Get teamId if TEAM mode
    let teamId: string | null = null;
    if (session.mode === 'TEAM') {
      const membership = await this.prisma.liveSessionTeamMember.findFirst({
        where: { studentEnrollmentId: enrollment.id, team: { sessionId } },
      });
      teamId = membership?.teamId || null;
    }

    // Save answer (1 query) — catch duplicate from concurrent submission
    let saved;
    try {
      saved = await this.prisma.liveSessionAnswer.create({
        data: {
          sessionId,
          questionId,
          studentEnrollmentId: enrollment.id,
          teamId,
          answer,
          isCorrect,
          responseTimeMs: Math.min(responseTimeMs, timeLimit),
          points,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ya respondió esta pregunta');
      }
      throw e;
    }

    // Broadcast progress
    const totalAnswered = await this.prisma.liveSessionAnswer.count({
      where: { sessionId, questionId },
    });

    // Use current connected count (more accurate as students may join/leave during question)
    const connectedCountNow = this.getConnectedStudentCount(sessionId);
    const snapshotCount = this.questionConnectedSnapshot.get(sessionId) || 0;
    // Use the larger of snapshot or current count to be safe
    const connectedCount = Math.max(connectedCountNow, snapshotCount);
    this.logger.log(`submitAnswer: connectedNow=${connectedCountNow}, snapshot=${snapshotCount}, using=${connectedCount}`);
    
    // Fallback to enrolled count for display if no one connected yet
    const totalEnrolled = await this.prisma.studentEnrollment.count({
      where: {
        groupId: classroom.teacherAssignment.groupId,
        academicYearId: classroom.teacherAssignment.academicYearId,
        status: 'ACTIVE',
      },
    });

    const isAsyncHomeChild = session.deliveryMode === 'ASYNC_HOME' && !!session.parentSessionId;
    // Show connected count if available, otherwise enrolled; in home mode each session is 1 student
    const totalExpected = isAsyncHomeChild ? 1 : (connectedCount > 0 ? connectedCount : totalEnrolled);

    this.broadcast(sessionId, {
      type: 'ANSWER_PROGRESS',
      data: { questionId, totalAnswered, totalExpected, connectedCount },
    });

    if (session.deliveryMode === 'ASYNC_HOME' && session.parentSessionId) {
      try {
        const ranking = await this.getAsyncHomeRanking(session.parentSessionId, session.activityId, 10);
        this.broadcast(session.parentSessionId, { type: 'RANKING', data: ranking });
        this.broadcast(sessionId, { type: 'RANKING', data: ranking });
      } catch (err) {
        this.logger.warn(`Failed to broadcast async-home ranking for parent ${session.parentSessionId}: ${err instanceof Error ? err.message : err}`);
      }
    }

    // Auto-close question when ALL CONNECTED students have answered
    // Use connectedCount if > 0, otherwise fall back to enrolled count
    // IMPORTANT: If connectedCount is 0 but we have answers, use totalAnswered as minimum expected
    let effectiveExpected = isAsyncHomeChild ? 1 : (connectedCount > 0 ? connectedCount : totalEnrolled);
    // Safety: if we have more answers than expected, adjust expected to match
    if (totalAnswered > effectiveExpected && effectiveExpected > 0) {
      effectiveExpected = totalAnswered;
    }
    // If no one is tracked as connected but someone answered, assume at least 1 connected
    if (connectedCount === 0 && totalAnswered > 0) {
      effectiveExpected = totalAnswered;
      this.logger.warn(`No connected students tracked but ${totalAnswered} answered - using totalAnswered as expected`);
    }
    this.logger.log(`Answer progress: ${totalAnswered}/${effectiveExpected} (connected=${connectedCount}, enrolled=${totalEnrolled}) for session ${sessionId}, question ${session.currentQuestionIdx}`);
    if (effectiveExpected > 0 && totalAnswered >= effectiveExpected) {
      // Auto-close: pre-fetch question data NOW (while transaction is open)
      // then broadcast after a small delay
      this.logger.log(`Auto-closing question for session ${sessionId} (all ${totalAnswered}/${effectiveExpected} answered)`);
      
      // Pre-fetch the question data while we're still in the transaction
      const questions = await this.prisma.activityQuestion.findMany({
        where: { activityId: session.activityId },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, correctAnswer: true, explanation: true },
      });
      const orderedQuestions = this.orderQuestionsForSession(questions, session.config);
      const currentQ = orderedQuestions[session.currentQuestionIdx];
      
      if (currentQ) {
        // Use setTimeout with 300ms delay to ensure the HTTP response reaches the client
        // before we broadcast QUESTION_CLOSED (otherwise client shows "no respondiste")
        setTimeout(() => {
          this.doCloseQuestionWithData(sessionId, session.currentQuestionIdx, currentQ);
        }, 300);
      }
    }

    return { isCorrect, points: saved.points };
  }

  async showRanking(sessionId: string, teacherId: string) {
    await this.validateTeacherSession(sessionId, teacherId);
    const ranking = await this.getRanking(sessionId);
    this.broadcast(sessionId, { type: 'RANKING', data: ranking });
    return ranking;
  }

  async closeQuestion(sessionId: string, teacherId: string) {
    const session = await this.validateTeacherSession(sessionId, teacherId);
    await this.doCloseQuestion(sessionId, session.activityId, session.currentQuestionIdx);
    return { success: true };
  }

  // Internal close question logic — used by teacher action, timer, and auto-close
  private async doCloseQuestion(sessionId: string, activityId: string, questionIdx: number) {
    this.logger.log(`doCloseQuestion called: session=${sessionId}, question=${questionIdx}, hasStream=${this.streams.has(sessionId)}`);
    // Cancel any pending timer for this question
    this.clearQuestionTimer(sessionId);

    // Prevent double broadcast for same question
    if (!this.closedQuestions.has(sessionId)) {
      this.closedQuestions.set(sessionId, new Set());
    }
    if (this.closedQuestions.get(sessionId)!.has(questionIdx)) {
      this.logger.log(`Question ${questionIdx} already closed for session ${sessionId}, skipping`);
      return;
    }
    this.closedQuestions.get(sessionId)!.add(questionIdx);

    const session = await this.prisma.liveSession.findUnique({
      where: { id: sessionId },
      select: { config: true },
    });

    const questions = await this.prisma.activityQuestion.findMany({
      where: { activityId },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, correctAnswer: true, explanation: true },
    });
    const orderedQuestions = this.orderQuestionsForSession(questions, session?.config);
    const currentQ = orderedQuestions[questionIdx];
    if (!currentQ) return;

    this.broadcastQuestionClosed(sessionId, questionIdx, currentQ);
  }

  // Close question with pre-fetched data (avoids transaction issues)
  private doCloseQuestionWithData(
    sessionId: string,
    questionIdx: number,
    questionData: { id: string; correctAnswer: any; explanation: string | null },
  ) {
    this.logger.log(`doCloseQuestionWithData called: session=${sessionId}, question=${questionIdx}`);
    this.clearQuestionTimer(sessionId);

    // Prevent double broadcast
    if (!this.closedQuestions.has(sessionId)) {
      this.closedQuestions.set(sessionId, new Set());
    }
    if (this.closedQuestions.get(sessionId)!.has(questionIdx)) {
      this.logger.log(`Question ${questionIdx} already closed for session ${sessionId}, skipping`);
      return;
    }
    this.closedQuestions.get(sessionId)!.add(questionIdx);

    this.broadcastQuestionClosed(sessionId, questionIdx, questionData);
  }

  // Shared broadcast logic
  private broadcastQuestionClosed(
    sessionId: string,
    questionIdx: number,
    questionData: { id: string; correctAnswer: any; explanation: string | null },
  ) {
    this.logger.log(`Broadcasting QUESTION_CLOSED for session ${sessionId}, question ${questionIdx}, questionId=${questionData.id}`);
    this.broadcast(sessionId, {
      type: 'QUESTION_CLOSED',
      data: {
        questionId: questionData.id,
        correctAnswer: questionData.correctAnswer,
        explanation: questionData.explanation,
      },
    });
    this.logger.log(`QUESTION_CLOSED broadcast completed for session ${sessionId}`);

    this.prisma.liveSession
      .findUnique({
        where: { id: sessionId },
        select: { deliveryMode: true, teacherId: true, status: true },
      })
      .then((session) => {
        if (!session || session.deliveryMode !== 'ASYNC_HOME' || session.status !== 'ACTIVE') return;
        setTimeout(() => {
          this.advanceQuestion(sessionId).catch((err) => {
            this.logger.warn(`Auto-advance failed for async session ${sessionId}: ${err instanceof Error ? err.message : err}`);
          });
        }, 700);
      })
      .catch((err) => {
        this.logger.warn(`Could not resolve async-home session after close for ${sessionId}: ${err instanceof Error ? err.message : err}`);
      });
  }

  // Server-side timer: auto-close question when time runs out
  private startQuestionTimer(sessionId: string, questionIdx: number, timeLimitSeconds: number) {
    this.clearQuestionTimer(sessionId);
    const delayMs = (timeLimitSeconds + 2) * 1000; // +2s buffer for network latency
    this.logger.log(`Server timer set: question ${questionIdx}, session ${sessionId}, will fire in ${delayMs}ms`);
    const timer = setTimeout(() => {
      this.logger.log(`Server timer FIRED: auto-closing question ${questionIdx} for session ${sessionId}`);
      // Use pre-loaded question data to avoid Prisma transaction issues
      const questionData = this.currentQuestionData.get(sessionId);
      if (questionData && questionData.questionIdx === questionIdx) {
        this.doCloseQuestionWithData(sessionId, questionIdx, {
          id: questionData.questionId,
          correctAnswer: questionData.correctAnswer,
          explanation: questionData.explanation,
        });
      } else {
        this.logger.warn(`Timer fired but no question data found for session ${sessionId}, question ${questionIdx}`);
      }
    }, delayMs);
    this.questionTimers.set(sessionId, timer);
  }

  private clearQuestionTimer(sessionId: string) {
    const existing = this.questionTimers.get(sessionId);
    if (existing) {
      clearTimeout(existing);
      this.questionTimers.delete(sessionId);
    }
  }

  async resetSession(sessionId: string, teacherId: string) {
    const session = await this.validateTeacherSession(sessionId, teacherId);

    // Delete all answers for this session
    const deleted = await this.prisma.liveSessionAnswer.deleteMany({
      where: { sessionId },
    });

    // Reset session status to WAITING so it can be started again
    await this.prisma.liveSession.update({
      where: { id: sessionId },
      data: { 
        status: 'WAITING', 
        currentQuestionIdx: -1,
        startedAt: null,
        finishedAt: null,
      },
    });

    // Clear any stored avatars for this session
    this.studentAvatars.delete(sessionId);
    
    // Broadcast reset event to all connected clients
    this.broadcast(sessionId, { type: 'SESSION_RESET', data: { deletedAnswers: deleted.count } });

    this.logger.log(`Session ${sessionId} reset by teacher ${teacherId}. Deleted ${deleted.count} answers.`);

    return { success: true, deletedAnswers: deleted.count };
  }

  async finishSession(sessionId: string, teacherId: string) {
    const session = await this.validateTeacherSession(sessionId, teacherId);

    const updated = await this.prisma.liveSession.update({
      where: { id: sessionId },
      data: { status: 'FINISHED', finishedAt: new Date() },
    });

    // Auto-generate grades depending on delivery mode
    if (session.deliveryMode === 'ASYNC_HOME' && session.parentSessionId) {
      await this.autoGradeAsyncHomeChildSession(sessionId, session.activityId, session.studentEnrollmentId || undefined);
    } else if (session.deliveryMode !== 'ASYNC_HOME') {
      // Auto-generate grades for ALL students
      await this.autoGradeFromLiveQuiz(sessionId, session.activityId);
    }

    const ranking = await this.getRanking(sessionId, 10);
    this.broadcast(sessionId, { type: 'SESSION_FINISHED', data: ranking });
    // Also broadcast SESSION_ENDED so students who are in question/answer phase know it's over
    this.broadcast(sessionId, { type: 'SESSION_ENDED', data: {} });

    // Cleanup connected students tracking
    this.connectedStudents.delete(sessionId);

    // Cleanup stream after short delay
    setTimeout(() => this.cleanupStream(sessionId), 5000);

    return { session: updated, ranking };
  }

  private async autoGradeAsyncHomeChildSession(sessionId: string, activityId: string, studentEnrollmentId?: string) {
    try {
      if (!studentEnrollmentId) return;

      const [activity, questions, enrollment] = await Promise.all([
        this.prisma.classroomActivity.findUnique({
          where: { id: activityId },
          select: { id: true, maxScore: true },
        }),
        this.prisma.activityQuestion.findMany({
          where: { activityId },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, points: true },
        }),
        this.prisma.studentEnrollment.findUnique({
          where: { id: studentEnrollmentId },
          select: { id: true },
        }),
      ]);

      if (!activity || !enrollment) return;

      const existing = await this.prisma.activitySubmission.findFirst({
        where: { activityId, studentEnrollmentId },
      });
      if (existing) return;

      const totalPossiblePoints = questions.reduce((sum, q) => sum + Number(q.points), 0);
      const questionPointsMap = new Map(questions.map((q) => [q.id, Number(q.points)]));

      const liveAnswers = await this.prisma.liveSessionAnswer.findMany({
        where: { sessionId, studentEnrollmentId },
        select: { questionId: true, isCorrect: true, points: true, answer: true },
      });

      const now = new Date();
      const startedAt = await this.prisma.liveSession.findUnique({
        where: { id: sessionId },
        select: { startedAt: true },
      });
      const timeSpentSeconds = startedAt?.startedAt ? Math.floor((now.getTime() - startedAt.startedAt.getTime()) / 1000) : null;

      let totalPoints = 0;
      let academicPoints = 0;
      let correctCount = 0;

      for (const answer of liveAnswers) {
        totalPoints += Number(answer.points || 0);
        if (answer.isCorrect) {
          correctCount += 1;
          academicPoints += questionPointsMap.get(answer.questionId) || 0;
        }
      }

      const maxScore = activity.maxScore ? Number(activity.maxScore) : totalPossiblePoints;
      const academicRatio = totalPossiblePoints > 0 ? academicPoints / totalPossiblePoints : 0;
      const normalizedScore = academicRatio * maxScore;
      const clampedScore = Math.min(Math.max(Math.round(normalizedScore * 10) / 10, 0), maxScore);

      const submission = await this.prisma.activitySubmission.create({
        data: {
          activityId,
          studentEnrollmentId,
          status: 'AUTO_GRADED',
          score: clampedScore,
          submittedAt: now,
          gradedAt: now,
          timeSpentSeconds,
          content: `Live Quiz en casa — ${correctCount}/${questions.length} correctas${totalPoints > 0 ? ` (${Math.round(totalPoints).toLocaleString()} pts)` : ''}${correctCount === 0 && totalPoints === 0 ? ' — Sin participación' : ''}`,
        },
        select: { id: true },
      });

      await Promise.all(
        liveAnswers.map((answer) =>
          this.prisma.questionAnswer.create({
            data: {
              submissionId: submission.id,
              questionId: answer.questionId,
              answer: answer.answer,
              isCorrect: answer.isCorrect,
              pointsEarned: answer.points,
            },
          }),
        ),
      );
    } catch (err) {
      console.error('Auto-grade async home failed:', err);
    }
  }

  /**
   * Auto-grade: creates ActivitySubmission + QuestionAnswer for every student
   * in the group. For TEAM mode, team members who didn't answer get the team's
   * average score. For INDIVIDUAL mode, students who didn't participate get 0.
   */
  private async autoGradeFromLiveQuiz(sessionId: string, activityId: string) {
    try {
      const session = await this.prisma.liveSession.findUnique({
        where: { id: sessionId },
        select: { id: true, mode: true, classroomId: true, deliveryMode: true, studentEnrollmentId: true },
      });
      if (!session) return;

      if (session.deliveryMode === 'ASYNC_HOME' && session.studentEnrollmentId) {
        await this.autoGradeAsyncHomeChildSession(sessionId, activityId, session.studentEnrollmentId);
        return;
      }

      const classroom = await this.prisma.classroom.findUnique({
        where: { id: session.classroomId },
        include: { teacherAssignment: { select: { groupId: true, academicYearId: true } } },
      });
      if (!classroom) return;

      const activity = await this.prisma.classroomActivity.findUnique({
        where: { id: activityId },
        select: { id: true, maxScore: true },
      });
      if (!activity) return;

      // Get all questions and their total points
      const questions = await this.prisma.activityQuestion.findMany({
        where: { activityId },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, points: true },
      });
      const totalPossiblePoints = questions.reduce((s, q) => s + Number(q.points), 0);
      const questionPointsMap = new Map(questions.map((q) => [q.id, Number(q.points)]));
      const maxScore = activity.maxScore ? Number(activity.maxScore) : totalPossiblePoints;

      // Get all enrolled students
      const enrollments = await this.prisma.studentEnrollment.findMany({
        where: {
          groupId: classroom.teacherAssignment.groupId,
          academicYearId: classroom.teacherAssignment.academicYearId,
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      // Get all live answers for this session
      const liveAnswers = await this.prisma.liveSessionAnswer.findMany({
        where: { sessionId },
        select: { studentEnrollmentId: true, questionId: true, isCorrect: true, points: true, answer: true, teamId: true },
      });

      // Build per-student score map (tracking correctness for grading)
      const studentScores = new Map<string, { totalPoints: number; academicPoints: number; correctCount: number; answeredQuestions: Set<string>; answers: typeof liveAnswers }>();
      for (const la of liveAnswers) {
        if (!studentScores.has(la.studentEnrollmentId)) {
          studentScores.set(la.studentEnrollmentId, { totalPoints: 0, academicPoints: 0, correctCount: 0, answeredQuestions: new Set(), answers: [] });
        }
        const entry = studentScores.get(la.studentEnrollmentId)!;
        entry.totalPoints += la.points;
        if (la.isCorrect) {
          entry.correctCount++;
          entry.academicPoints += questionPointsMap.get(la.questionId) || 0;
        }
        entry.answeredQuestions.add(la.questionId);
        entry.answers.push(la);
      }

      // For TEAM mode: compute team average correctness for members without answers
      let teamAvgCorrectness = new Map<string, number>();
      let teamAvgAcademicRatio = new Map<string, number>();
      if (session.mode === 'TEAM') {
        // Get team membership
        const teamMembers = await this.prisma.liveSessionTeamMember.findMany({
          where: { team: { sessionId } },
          select: { studentEnrollmentId: true, teamId: true },
        });

        // Group correctness by team
        const teamStudentCorrectness = new Map<string, number[]>();
        const teamStudentAcademicRatios = new Map<string, number[]>();
        for (const tm of teamMembers) {
          const data = studentScores.get(tm.studentEnrollmentId);
          const correctRatio = data ? data.correctCount / questions.length : 0;
          const academicRatio = data && totalPossiblePoints > 0 ? data.academicPoints / totalPossiblePoints : 0;
          if (!teamStudentCorrectness.has(tm.teamId)) teamStudentCorrectness.set(tm.teamId, []);
          if (!teamStudentAcademicRatios.has(tm.teamId)) teamStudentAcademicRatios.set(tm.teamId, []);
          teamStudentCorrectness.get(tm.teamId)!.push(correctRatio);
          teamStudentAcademicRatios.get(tm.teamId)!.push(academicRatio);
        }
        for (const [teamId, ratios] of teamStudentCorrectness) {
          const activeRatios = ratios.filter(r => r > 0);
          const avg = activeRatios.length > 0 ? activeRatios.reduce((s, r) => s + r, 0) / activeRatios.length : 0;
          teamAvgCorrectness.set(teamId, avg);
        }
        for (const [teamId, ratios] of teamStudentAcademicRatios) {
          const activeRatios = ratios.filter(r => r > 0);
          const avg = activeRatios.length > 0 ? activeRatios.reduce((s, r) => s + r, 0) / activeRatios.length : 0;
          teamAvgAcademicRatio.set(teamId, avg);
        }

        // Assign team average correctness to members without answers
        for (const tm of teamMembers) {
          if (!studentScores.has(tm.studentEnrollmentId)) {
            const avgCorrect = teamAvgCorrectness.get(tm.teamId) || 0;
            const avgAcademicRatio = teamAvgAcademicRatio.get(tm.teamId) || 0;
            const avgCorrectCount = Math.round(avgCorrect * questions.length);
            const avgAcademicPoints = avgAcademicRatio * totalPossiblePoints;
            studentScores.set(tm.studentEnrollmentId, { totalPoints: 0, academicPoints: avgAcademicPoints, correctCount: avgCorrectCount, answeredQuestions: new Set(), answers: [] });
          }
        }
      }

      // Now create ActivitySubmission for each enrolled student
      const now = new Date();
      for (const enrollment of enrollments) {
        // Skip if submission already exists
        const existing = await this.prisma.activitySubmission.findFirst({
          where: { activityId, studentEnrollmentId: enrollment.id },
        });
        if (existing) continue;

        const scoreData = studentScores.get(enrollment.id);
        const rawPoints = scoreData?.totalPoints || 0;
        const academicPoints = scoreData?.academicPoints || 0;
        const correctCount = scoreData?.correctCount || 0;
        const totalQ = questions.length;

        const academicRatio = totalPossiblePoints > 0 ? academicPoints / totalPossiblePoints : 0;
        const normalizedScore = academicRatio * maxScore;
        const clampedScore = Math.min(Math.max(Math.round(normalizedScore * 10) / 10, 0), maxScore);

        await this.prisma.activitySubmission.create({
          data: {
            activityId,
            studentEnrollmentId: enrollment.id,
            status: 'AUTO_GRADED',
            score: clampedScore,
            submittedAt: now,
            gradedAt: now,
            content: `Live Quiz — ${correctCount}/${totalQ} correctas${rawPoints > 0 ? ` (${Math.round(rawPoints).toLocaleString()} pts)` : ''}${correctCount === 0 && rawPoints === 0 ? ' — Sin participación' : ''}`,
          },
        });
      }
    } catch (err) {
      // Don't fail the session finish if grading fails
      console.error('Auto-grade from live quiz failed:', err);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Ranking (optimized: only TOP N)
  // ═══════════════════════════════════════════════════════════════════════════

  private async getRanking(sessionId: string, limit = 5) {
    const session = await this.prisma.liveSession.findUnique({
      where: { id: sessionId },
      select: { mode: true, activityId: true, deliveryMode: true, parentSessionId: true },
    });

    if (!session?.activityId) {
      return [];
    }

    if (session.deliveryMode === 'ASYNC_HOME' && !session.parentSessionId) {
      return this.getAsyncHomeRanking(sessionId, session.activityId, limit);
    }

    if (session?.mode === 'TEAM') {
      return this.getTeamRanking(sessionId, session.activityId, limit);
    }

    const [answers, questions] = await Promise.all([
      this.prisma.liveSessionAnswer.findMany({
        where: { sessionId },
        select: { studentEnrollmentId: true, isCorrect: true, points: true, responseTimeMs: true, questionId: true },
      }),
      this.prisma.activityQuestion.findMany({
        where: { activityId: session.activityId },
        select: { id: true, points: true },
      }),
    ]);

    const questionPointsMap = new Map(questions.map((question) => [question.id, Number(question.points)]));
    const aggregates = new Map<string, { studentEnrollmentId: string; totalPoints: number; academicPoints: number; correctAnswers: number; totalResponseTimeMs: number }>();

    for (const answer of answers) {
      if (!aggregates.has(answer.studentEnrollmentId)) {
        aggregates.set(answer.studentEnrollmentId, {
          studentEnrollmentId: answer.studentEnrollmentId,
          totalPoints: 0,
          academicPoints: 0,
          correctAnswers: 0,
          totalResponseTimeMs: 0,
        });
      }

      const entry = aggregates.get(answer.studentEnrollmentId)!;
      entry.totalPoints += Number(answer.points || 0);
      entry.totalResponseTimeMs += Number(answer.responseTimeMs || 0);

      if (answer.isCorrect) {
        entry.correctAnswers += 1;
        entry.academicPoints += questionPointsMap.get(answer.questionId) || 0;
      }
    }

    const sortedResults = [...aggregates.values()].sort((a, b) => {
      if (b.academicPoints !== a.academicPoints) return b.academicPoints - a.academicPoints;
      if (b.correctAnswers !== a.correctAnswers) return b.correctAnswers - a.correctAnswers;
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (a.totalResponseTimeMs !== b.totalResponseTimeMs) return a.totalResponseTimeMs - b.totalResponseTimeMs;
      return a.studentEnrollmentId.localeCompare(b.studentEnrollmentId);
    });

    const topResults = sortedResults.slice(0, limit);
    const enrollmentIds = topResults.map((result) => result.studentEnrollmentId);
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { id: { in: enrollmentIds } },
      select: { id: true, student: { select: { firstName: true, lastName: true } } },
    });
    const nameMap = new Map(enrollments.map((e) => [e.id, `${e.student.firstName} ${e.student.lastName}`]));

    return topResults.map((result, i) => ({
      rank: i + 1,
      studentEnrollmentId: result.studentEnrollmentId,
      name: nameMap.get(result.studentEnrollmentId) || 'Desconocido',
      totalPoints: Math.round(result.totalPoints),
      academicPoints: Math.round(result.academicPoints * 100) / 100,
      correctAnswers: result.correctAnswers,
      avatarId: this.getStudentAvatar(sessionId, result.studentEnrollmentId),
    }));
  }

  private async getAsyncHomeRanking(parentSessionId: string, activityId: string, limit = 5) {
    // Get parent session status and total expected students
    const [parentSession, childSessions, classroom] = await Promise.all([
      this.prisma.liveSession.findUnique({
        where: { id: parentSessionId },
        select: { status: true, classroomId: true },
      }),
      this.prisma.liveSession.findMany({
        where: { parentSessionId },
        select: { id: true, status: true },
      }),
      this.prisma.liveSession.findUnique({
        where: { id: parentSessionId },
        select: { classroom: { select: { teacherAssignment: { select: { groupId: true, academicYearId: true } } } } },
      }),
    ]);

    // Count total enrolled students for context
    let totalExpected = 0;
    if (classroom?.classroom?.teacherAssignment) {
      const ta = classroom.classroom.teacherAssignment;
      totalExpected = await this.prisma.studentEnrollment.count({
        where: { groupId: ta.groupId, academicYearId: ta.academicYearId, status: 'ACTIVE' },
      });
    }

    const completedCount = childSessions.filter((s) => s.status === 'FINISHED').length;
    const isSessionFinished = parentSession?.status === 'FINISHED';

    if (childSessions.length === 0) {
      return {
        ranking: [],
        meta: { completedCount: 0, totalExpected, isSessionFinished, isPartial: !isSessionFinished },
      };
    }

    const childSessionIds = childSessions.map((session) => session.id);
    const [answers, questions] = await Promise.all([
      this.prisma.liveSessionAnswer.findMany({
        where: { sessionId: { in: childSessionIds } },
        select: { sessionId: true, studentEnrollmentId: true, isCorrect: true, points: true, responseTimeMs: true, questionId: true },
      }),
      this.prisma.activityQuestion.findMany({
        where: { activityId },
        select: { id: true, points: true },
      }),
    ]);

    const questionPointsMap = new Map(questions.map((question) => [question.id, Number(question.points)]));
    const aggregates = new Map<string, { studentEnrollmentId: string; sessionId: string; totalPoints: number; academicPoints: number; correctAnswers: number; totalResponseTimeMs: number }>();

    for (const answer of answers) {
      if (!aggregates.has(answer.studentEnrollmentId)) {
        aggregates.set(answer.studentEnrollmentId, {
          studentEnrollmentId: answer.studentEnrollmentId,
          sessionId: answer.sessionId,
          totalPoints: 0,
          academicPoints: 0,
          correctAnswers: 0,
          totalResponseTimeMs: 0,
        });
      }

      const entry = aggregates.get(answer.studentEnrollmentId)!;
      entry.totalPoints += Number(answer.points || 0);
      entry.totalResponseTimeMs += Number(answer.responseTimeMs || 0);
      if (answer.isCorrect) {
        entry.correctAnswers += 1;
        entry.academicPoints += questionPointsMap.get(answer.questionId) || 0;
      }
    }

    const sortedResults = [...aggregates.values()].sort((a, b) => {
      if (b.academicPoints !== a.academicPoints) return b.academicPoints - a.academicPoints;
      if (b.correctAnswers !== a.correctAnswers) return b.correctAnswers - a.correctAnswers;
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (a.totalResponseTimeMs !== b.totalResponseTimeMs) return a.totalResponseTimeMs - b.totalResponseTimeMs;
      return a.studentEnrollmentId.localeCompare(b.studentEnrollmentId);
    });

    const topResults = sortedResults.slice(0, limit);
    const enrollmentIds = topResults.map((result) => result.studentEnrollmentId);
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { id: { in: enrollmentIds } },
      select: { id: true, student: { select: { firstName: true, lastName: true } } },
    });
    const nameMap = new Map(enrollments.map((e) => [e.id, `${e.student.firstName} ${e.student.lastName}`]));

    const ranking = topResults.map((result, i) => ({
      rank: i + 1,
      studentEnrollmentId: result.studentEnrollmentId,
      name: nameMap.get(result.studentEnrollmentId) || 'Desconocido',
      totalPoints: Math.round(result.totalPoints),
      academicPoints: Math.round(result.academicPoints * 100) / 100,
      correctAnswers: result.correctAnswers,
      avatarId: this.getStudentAvatar(result.sessionId, result.studentEnrollmentId),
    }));

    return {
      ranking,
      meta: { completedCount, totalExpected, isSessionFinished, isPartial: !isSessionFinished },
    };
  }

  private async getTeamRanking(sessionId: string, activityId: string, limit = 5) {
    const [answers, questions] = await Promise.all([
      this.prisma.liveSessionAnswer.findMany({
        where: { sessionId, teamId: { not: null } },
        select: { teamId: true, isCorrect: true, points: true, responseTimeMs: true, questionId: true },
      }),
      this.prisma.activityQuestion.findMany({
        where: { activityId },
        select: { id: true, points: true },
      }),
    ]);

    const questionPointsMap = new Map(questions.map((question) => [question.id, Number(question.points)]));
    const teamAggregates = new Map<string, { teamId: string; totalPoints: number; academicPoints: number; correctAnswers: number; totalResponseTimeMs: number }>();

    for (const answer of answers) {
      if (!answer.teamId) continue;

      if (!teamAggregates.has(answer.teamId)) {
        teamAggregates.set(answer.teamId, {
          teamId: answer.teamId,
          totalPoints: 0,
          academicPoints: 0,
          correctAnswers: 0,
          totalResponseTimeMs: 0,
        });
      }

      const entry = teamAggregates.get(answer.teamId)!;
      entry.totalPoints += Number(answer.points || 0);
      entry.totalResponseTimeMs += Number(answer.responseTimeMs || 0);

      if (answer.isCorrect) {
        entry.correctAnswers += 1;
        entry.academicPoints += questionPointsMap.get(answer.questionId) || 0;
      }
    }

    const topResults = [...teamAggregates.values()]
      .sort((a, b) => {
        if (b.academicPoints !== a.academicPoints) return b.academicPoints - a.academicPoints;
        if (b.correctAnswers !== a.correctAnswers) return b.correctAnswers - a.correctAnswers;
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        if (a.totalResponseTimeMs !== b.totalResponseTimeMs) return a.totalResponseTimeMs - b.totalResponseTimeMs;
        return a.teamId.localeCompare(b.teamId);
      })
      .slice(0, limit);

    const teamIds = topResults.map((result) => result.teamId).filter(Boolean);
    const teams = await this.prisma.liveSessionTeam.findMany({
      where: { id: { in: teamIds } },
      select: { id: true, name: true, color: true },
    });
    const teamMap = new Map(teams.map((t) => [t.id, t]));

    return topResults.map((result, i) => ({
      rank: i + 1,
      teamId: result.teamId,
      name: teamMap.get(result.teamId)?.name || 'Equipo',
      color: teamMap.get(result.teamId)?.color || '#6366f1',
      totalPoints: Math.round(result.totalPoints),
      academicPoints: Math.round(result.academicPoints * 100) / 100,
      correctAnswers: result.correctAnswers,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Team Management
  // ═══════════════════════════════════════════════════════════════════════════

  async createTeams(sessionId: string, teacherId: string, teams: { name: string; color?: string }[]) {
    const session = await this.validateTeacherSession(sessionId, teacherId);
    if (session.mode !== 'TEAM') {
      throw new BadRequestException('La sesión no está en modo equipos');
    }
    // Delete existing teams
    await this.prisma.liveSessionTeamMember.deleteMany({
      where: { team: { sessionId } },
    });
    await this.prisma.liveSessionTeam.deleteMany({ where: { sessionId } });

    const TEAM_COLORS = ['#6366f1', '#f43f5e', '#22c55e', '#f97316', '#06b6d4', '#8b5cf6', '#eab308', '#ec4899'];
    const created = await Promise.all(
      teams.map((t, i) =>
        this.prisma.liveSessionTeam.create({
          data: {
            sessionId,
            name: t.name,
            color: t.color || TEAM_COLORS[i % TEAM_COLORS.length],
          },
        }),
      ),
    );

    // Broadcast updated teams
    this.broadcast(sessionId, {
      type: 'TEAMS_UPDATED' as any,
      data: created,
    });

    return created;
  }

  // Student creates a team (Kahoot-style)
  async createTeamByStudent(sessionId: string, teamName: string, userId: string) {
    const session = await this.prisma.liveSession.findUnique({
      where: { id: sessionId },
      select: { id: true, mode: true, status: true, classroomId: true, config: true },
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');
    if (session.mode !== 'TEAM') throw new BadRequestException('La sesión no está en modo equipos');
    if (session.status === 'FINISHED') throw new BadRequestException('La sesión ya finalizó');

    // Check if teamAssignment allows student creation
    const config = (session.config as any) || {};
    if (config.teamAssignment === 'TEACHER_ASSIGNED') {
      throw new ForbiddenException('El docente asigna los equipos en esta sesión');
    }

    // Get student enrollment
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: session.classroomId },
      include: { teacherAssignment: { select: { groupId: true, academicYearId: true } } },
    });
    if (!classroom) throw new NotFoundException('Aula no encontrada');

    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: {
        student: { userId },
        groupId: classroom.teacherAssignment.groupId,
        academicYearId: classroom.teacherAssignment.academicYearId,
        status: 'ACTIVE',
      },
    });
    if (!enrollment) throw new ForbiddenException('No está matriculado en este grupo');

    // Check if team name already exists
    const existing = await this.prisma.liveSessionTeam.findFirst({
      where: { sessionId, name: { equals: teamName.trim(), mode: 'insensitive' } },
    });
    if (existing) throw new BadRequestException('Ya existe un equipo con ese nombre');

    // Limit max teams
    const teamCount = await this.prisma.liveSessionTeam.count({ where: { sessionId } });
    if (teamCount >= 20) throw new BadRequestException('Máximo 20 equipos permitidos');

    // Remove student from any existing team
    await this.prisma.liveSessionTeamMember.deleteMany({
      where: { studentEnrollmentId: enrollment.id, team: { sessionId } },
    });

    // Create team with random color
    const TEAM_COLORS = ['#6366f1', '#f43f5e', '#22c55e', '#f97316', '#06b6d4', '#8b5cf6', '#eab308', '#ec4899', '#14b8a6', '#f472b6', '#84cc16', '#a855f7'];
    const team = await this.prisma.liveSessionTeam.create({
      data: {
        sessionId,
        name: teamName.trim(),
        color: TEAM_COLORS[teamCount % TEAM_COLORS.length],
      },
    });

    // Add creator as first member
    await this.prisma.liveSessionTeamMember.create({
      data: { teamId: team.id, studentEnrollmentId: enrollment.id },
    });

    // Broadcast updated teams
    const teams = await this.getTeams(sessionId);
    this.broadcast(sessionId, { type: 'TEAMS_UPDATED' as any, data: teams });

    return team;
  }

  async getTeams(sessionId: string) {
    return this.prisma.liveSessionTeam.findMany({
      where: { sessionId },
      include: {
        members: {
          include: {
            studentEnrollment: {
              include: { student: { select: { firstName: true, lastName: true } } },
            },
          },
        },
      },
    });
  }

  async addPartnerToTeam(sessionId: string, teamId: string, studentEnrollmentId: string, requesterId: string) {
    const session = await this.prisma.liveSession.findUnique({
      where: { id: sessionId },
      select: { id: true, mode: true, status: true, classroomId: true },
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');
    if (session.mode !== 'TEAM') throw new BadRequestException('La sesión no está en modo equipos');
    if (session.status === 'FINISHED') throw new BadRequestException('La sesión ya finalizó');

    // Verify the requester is in this team (or is the teacher)
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: session.classroomId },
      include: { teacherAssignment: { select: { groupId: true, academicYearId: true, teacherId: true } } },
    });
    if (!classroom) throw new NotFoundException('Aula no encontrada');

    const isTeacher = classroom.teacherAssignment.teacherId === requesterId;
    if (!isTeacher) {
      // Verify requester is enrolled and in this team
      const requesterEnrollment = await this.prisma.studentEnrollment.findFirst({
        where: {
          student: { userId: requesterId },
          groupId: classroom.teacherAssignment.groupId,
          academicYearId: classroom.teacherAssignment.academicYearId,
          status: 'ACTIVE',
        },
      });
      if (!requesterEnrollment) throw new ForbiddenException('No está matriculado');
      const requesterMember = await this.prisma.liveSessionTeamMember.findFirst({
        where: { studentEnrollmentId: requesterEnrollment.id, teamId },
      });
      if (!requesterMember) throw new ForbiddenException('No perteneces a este equipo');
    }

    // Verify target student is enrolled in same group
    const targetEnrollment = await this.prisma.studentEnrollment.findUnique({
      where: { id: studentEnrollmentId },
      select: { id: true, groupId: true, academicYearId: true },
    });
    if (!targetEnrollment || targetEnrollment.groupId !== classroom.teacherAssignment.groupId) {
      throw new BadRequestException('El estudiante no pertenece a este grupo');
    }

    // Remove from any existing team
    await this.prisma.liveSessionTeamMember.deleteMany({
      where: { studentEnrollmentId, team: { sessionId } },
    });

    // Add to team
    await this.prisma.liveSessionTeamMember.create({
      data: { teamId, studentEnrollmentId },
    });

    // Broadcast
    const teams = await this.getTeams(sessionId);
    this.broadcast(sessionId, { type: 'TEAMS_UPDATED' as any, data: teams });
    return { success: true };
  }

  async searchGroupStudents(sessionId: string, query: string) {
    const session = await this.prisma.liveSession.findUnique({
      where: { id: sessionId },
      select: { classroomId: true },
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');

    const classroom = await this.prisma.classroom.findUnique({
      where: { id: session.classroomId },
      include: { teacherAssignment: { select: { groupId: true, academicYearId: true } } },
    });
    if (!classroom) throw new NotFoundException('Aula no encontrada');

    // Get all enrolled students in this group
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        groupId: classroom.teacherAssignment.groupId,
        academicYearId: classroom.teacherAssignment.academicYearId,
        status: 'ACTIVE',
        student: query ? {
          OR: [
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
          ],
        } : undefined,
      },
      include: { student: { select: { firstName: true, lastName: true } } },
      take: 20,
      orderBy: { student: { lastName: 'asc' } },
    });

    // Check which are already in a team
    const memberRecords = await this.prisma.liveSessionTeamMember.findMany({
      where: { studentEnrollmentId: { in: enrollments.map(e => e.id) }, team: { sessionId } },
      select: { studentEnrollmentId: true, teamId: true },
    });
    const teamMap = new Map(memberRecords.map(m => [m.studentEnrollmentId, m.teamId]));

    return enrollments.map(e => ({
      enrollmentId: e.id,
      name: `${e.student.firstName} ${e.student.lastName}`,
      teamId: teamMap.get(e.id) || null,
    }));
  }

  async joinTeam(sessionId: string, teamId: string, userId: string) {
    const session = await this.prisma.liveSession.findUnique({
      where: { id: sessionId },
      select: { id: true, mode: true, status: true, classroomId: true },
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');
    if (session.mode !== 'TEAM') throw new BadRequestException('La sesión no está en modo equipos');
    if (session.status === 'FINISHED') throw new BadRequestException('La sesión ya finalizó');

    // Get enrollment
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: session.classroomId },
      include: { teacherAssignment: { select: { groupId: true, academicYearId: true } } },
    });
    if (!classroom) throw new NotFoundException('Aula no encontrada');

    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: {
        student: { userId },
        groupId: classroom.teacherAssignment.groupId,
        academicYearId: classroom.teacherAssignment.academicYearId,
        status: 'ACTIVE',
      },
    });
    if (!enrollment) throw new ForbiddenException('No está matriculado');

    // Remove from any existing team in this session
    await this.prisma.liveSessionTeamMember.deleteMany({
      where: { studentEnrollmentId: enrollment.id, team: { sessionId } },
    });

    // Join the new team
    const member = await this.prisma.liveSessionTeamMember.create({
      data: { teamId, studentEnrollmentId: enrollment.id },
    });

    // Broadcast updated teams
    const teams = await this.getTeams(sessionId);
    this.broadcast(sessionId, { type: 'TEAMS_UPDATED' as any, data: teams });

    return member;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Answer Checking
  // ═══════════════════════════════════════════════════════════════════════════

  private checkAnswer(question: { type: string; correctAnswer: string | null; options: any }, answer: string): boolean {
    if (!question.correctAnswer) return false;
    const correct = question.correctAnswer.trim().toLowerCase();
    const given = answer.trim().toLowerCase();

    switch (question.type) {
      case 'MULTIPLE_CHOICE':
      case 'TRUE_FALSE':
        return given === correct;

      case 'MULTIPLE_SELECT': {
        try {
          const correctArr = JSON.parse(correct) as string[];
          const givenArr = JSON.parse(given) as string[];
          return (
            correctArr.length === givenArr.length &&
            correctArr.every((c) => givenArr.includes(c))
          );
        } catch {
          return false;
        }
      }

      case 'SHORT_ANSWER':
        return given === correct;

      case 'FILL_BLANK': {
        try {
          const correctBlanks = JSON.parse(correct) as string[];
          const givenBlanks = JSON.parse(given) as string[];
          return (
            correctBlanks.length === givenBlanks.length &&
            correctBlanks.every((c, i) => c.trim().toLowerCase() === (givenBlanks[i] || '').trim().toLowerCase())
          );
        } catch {
          return false;
        }
      }

      case 'ORDERING': {
        try {
          const correctOrder = JSON.parse(correct) as string[];
          const givenOrder = JSON.parse(given) as string[];
          return JSON.stringify(correctOrder) === JSON.stringify(givenOrder);
        } catch {
          return false;
        }
      }

      case 'MATCHING': {
        try {
          const correctPairs = JSON.parse(correct) as Record<string, string>;
          const givenPairs = JSON.parse(given) as Record<string, string>;
          const keys = Object.keys(correctPairs);
          return keys.every(
            (k) => (givenPairs[k] || '').trim().toLowerCase() === correctPairs[k].trim().toLowerCase(),
          );
        } catch {
          return false;
        }
      }

      default:
        return given === correct;
    }
  }

  private shuffleArray<T>(items: T[]): T[] {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  private orderQuestionsForSession<T extends { id: string }>(questions: T[], config: any): T[] {
    const questionOrder = Array.isArray(config?.questionOrder) ? (config.questionOrder as string[]) : [];
    if (questionOrder.length === 0) return questions;

    const byId = new Map(questions.map((question) => [question.id, question]));
    const ordered = questionOrder
      .map((id) => byId.get(id))
      .filter((question): question is T => Boolean(question));

    if (ordered.length === questions.length) return ordered;

    const orderedIds = new Set(ordered.map((question) => question.id));
    const missing = questions.filter((question) => !orderedIds.has(question.id));
    return [...ordered, ...missing];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private async validateTeacherSession(sessionId: string, teacherId: string) {
    const session = await this.prisma.liveSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        teacherId: true,
        status: true,
        activityId: true,
        currentQuestionIdx: true,
        config: true,
        classroomId: true,
        mode: true,
        deliveryMode: true,
        parentSessionId: true,
        studentEnrollmentId: true,
      },
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');
    if (session.teacherId !== teacherId) {
      throw new ForbiddenException('No tiene permisos sobre esta sesión');
    }
    return session;
  }

  async getConnectedCount(sessionId: string): Promise<number> {
    const stream = this.streams.get(sessionId);
    if (!stream) return 0;
    return stream.observed ? stream.observers.length : 0;
  }
}
