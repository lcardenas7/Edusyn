import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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
  | 'SESSION_FINISHED';

export interface LiveEvent {
  type: LiveEventType;
  data: any;
}

@Injectable()
export class LiveSessionService {
  // Map of sessionId → Subject for SSE broadcasting
  private streams = new Map<string, Subject<LiveEvent>>();
  // Map of sessionId → heartbeat interval
  private heartbeats = new Map<string, ReturnType<typeof setInterval>>();

  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // SSE Stream Management
  // ═══════════════════════════════════════════════════════════════════════════

  getOrCreateStream(sessionId: string): Subject<LiveEvent> {
    if (!this.streams.has(sessionId)) {
      const subject = new Subject<LiveEvent>();
      this.streams.set(sessionId, subject);
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
    if (stream) stream.next(event);
  }

  private cleanupStream(sessionId: string) {
    const hb = this.heartbeats.get(sessionId);
    if (hb) clearInterval(hb);
    this.heartbeats.delete(sessionId);
    const stream = this.streams.get(sessionId);
    if (stream) {
      stream.complete();
      this.streams.delete(sessionId);
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
      include: { questions: { orderBy: { sortOrder: 'asc' }, select: { id: true } } },
    });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    if (activity.questions.length === 0) {
      throw new BadRequestException('La actividad no tiene preguntas');
    }

    // Close any existing WAITING/ACTIVE session for this classroom
    await this.prisma.liveSession.updateMany({
      where: { classroomId, status: { in: ['WAITING', 'ACTIVE'] } },
      data: { status: 'FINISHED', finishedAt: new Date() },
    });

    return this.prisma.liveSession.create({
      data: {
        classroomId,
        activityId,
        teacherId,
        mode: mode as any,
        config,
        status: 'WAITING',
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
      include: {
        activity: {
          select: {
            id: true,
            title: true,
            timeLimitMinutes: true,
            questions: {
              orderBy: { sortOrder: 'asc' },
              select: { id: true, type: true, text: true, imageUrl: true, options: true, points: true, correctAnswer: true, sortOrder: true },
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
      where: { classroomId, status: { in: ['WAITING', 'ACTIVE'] } },
      select: { id: true, status: true, mode: true, currentQuestionIdx: true },
    });
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

    const questions = await this.prisma.activityQuestion.findMany({
      where: { activityId: session.activityId },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, type: true, text: true, imageUrl: true, options: true, points: true, sortOrder: true },
    });

    const nextIdx = session.currentQuestionIdx + 1;
    if (nextIdx >= questions.length) {
      // No more questions - finish
      return this.finishSession(sessionId, teacherId);
    }

    await this.prisma.liveSession.update({
      where: { id: sessionId },
      data: { currentQuestionIdx: nextIdx },
    });

    const q = questions[nextIdx];
    const config = (session.config as any) || {};
    const isBonus = config.bonusQuestions?.includes(nextIdx) || false;
    const multiplier = config.multipliers?.[String(nextIdx)] || 1;
    const timeLimit = config.timeLimitOverride || 15;

    // Broadcast question to all connected clients (no correctAnswer!)
    this.broadcast(sessionId, {
      type: 'QUESTION',
      data: {
        index: nextIdx,
        total: questions.length,
        questionId: q.id,
        type: q.type,
        text: q.text,
        imageUrl: q.imageUrl,
        options: q.options,
        points: Number(q.points),
        isBonus,
        multiplier,
        timeLimit,
      },
    });

    return { index: nextIdx, total: questions.length, question: q };
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
      select: { id: true, status: true, classroomId: true, activityId: true, currentQuestionIdx: true, config: true, mode: true },
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
    const currentQ = questions[session.currentQuestionIdx];
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

    // Save answer (1 query)
    const saved = await this.prisma.liveSessionAnswer.create({
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

    // Broadcast progress (1 query)
    const progress = await this.prisma.liveSessionAnswer.count({
      where: { sessionId, questionId },
    });

    this.broadcast(sessionId, {
      type: 'ANSWER_PROGRESS',
      data: { questionId, totalAnswered: progress },
    });

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
    
    // Get the correct answer for current question
    const questions = await this.prisma.activityQuestion.findMany({
      where: { activityId: session.activityId },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, correctAnswer: true, explanation: true },
    });
    const currentQ = questions[session.currentQuestionIdx];

    this.broadcast(sessionId, {
      type: 'QUESTION_CLOSED',
      data: {
        questionId: currentQ?.id,
        correctAnswer: currentQ?.correctAnswer,
        explanation: currentQ?.explanation,
      },
    });

    return { success: true };
  }

  async finishSession(sessionId: string, teacherId: string) {
    await this.validateTeacherSession(sessionId, teacherId);

    const updated = await this.prisma.liveSession.update({
      where: { id: sessionId },
      data: { status: 'FINISHED', finishedAt: new Date() },
    });

    const ranking = await this.getRanking(sessionId, 10);
    this.broadcast(sessionId, { type: 'SESSION_FINISHED', data: ranking });

    // Cleanup stream after short delay
    setTimeout(() => this.cleanupStream(sessionId), 5000);

    return { session: updated, ranking };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Ranking (optimized: only TOP N)
  // ═══════════════════════════════════════════════════════════════════════════

  private async getRanking(sessionId: string, limit = 5) {
    const session = await this.prisma.liveSession.findUnique({
      where: { id: sessionId },
      select: { mode: true },
    });

    if (session?.mode === 'TEAM') {
      return this.getTeamRanking(sessionId, limit);
    }

    // Individual ranking: SUM(points) GROUP BY studentEnrollmentId, TOP N
    const results = await this.prisma.liveSessionAnswer.groupBy({
      by: ['studentEnrollmentId'],
      where: { sessionId },
      _sum: { points: true },
      _count: { isCorrect: true },
      orderBy: { _sum: { points: 'desc' } },
      take: limit,
    });

    // Fetch student names for top N only
    const enrollmentIds = results.map((r) => r.studentEnrollmentId);
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { id: { in: enrollmentIds } },
      select: { id: true, student: { select: { firstName: true, lastName: true } } },
    });
    const nameMap = new Map(enrollments.map((e) => [e.id, `${e.student.firstName} ${e.student.lastName}`]));

    // Count correct answers
    const correctCounts = await this.prisma.liveSessionAnswer.groupBy({
      by: ['studentEnrollmentId'],
      where: { sessionId, isCorrect: true, studentEnrollmentId: { in: enrollmentIds } },
      _count: true,
    });
    const correctMap = new Map(correctCounts.map((c) => [c.studentEnrollmentId, c._count]));

    return results.map((r, i) => ({
      rank: i + 1,
      studentEnrollmentId: r.studentEnrollmentId,
      name: nameMap.get(r.studentEnrollmentId) || 'Desconocido',
      totalPoints: Math.round(r._sum.points || 0),
      correctAnswers: correctMap.get(r.studentEnrollmentId) || 0,
    }));
  }

  private async getTeamRanking(sessionId: string, limit = 5) {
    const results = await this.prisma.liveSessionAnswer.groupBy({
      by: ['teamId'],
      where: { sessionId, teamId: { not: null } },
      _sum: { points: true },
      orderBy: { _sum: { points: 'desc' } },
      take: limit,
    });

    const teamIds = results.map((r) => r.teamId!).filter(Boolean);
    const teams = await this.prisma.liveSessionTeam.findMany({
      where: { id: { in: teamIds } },
      select: { id: true, name: true, color: true },
    });
    const teamMap = new Map(teams.map((t) => [t.id, t]));

    return results.map((r, i) => ({
      rank: i + 1,
      teamId: r.teamId,
      name: teamMap.get(r.teamId!)?.name || 'Equipo',
      color: teamMap.get(r.teamId!)?.color || '#6366f1',
      totalPoints: Math.round(r._sum.points || 0),
    }));
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

  // ═══════════════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private async validateTeacherSession(sessionId: string, teacherId: string) {
    const session = await this.prisma.liveSession.findUnique({
      where: { id: sessionId },
      select: { id: true, teacherId: true, status: true, activityId: true, currentQuestionIdx: true, config: true, classroomId: true, mode: true },
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
