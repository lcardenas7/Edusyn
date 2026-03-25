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
  | 'SESSION_FINISHED';

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

  constructor(private prisma: PrismaService) {}

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
    if (stream) stream.next(event);
  }

  private cleanupStream(sessionId: string) {
    const hb = this.heartbeats.get(sessionId);
    if (hb) clearInterval(hb);
    this.heartbeats.delete(sessionId);
    this.streamCreatedAt.delete(sessionId);
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
      select: { id: true, type: true, text: true, imageUrl: true, options: true, points: true, sortOrder: true, context: { select: { id: true, title: true, text: true, imageUrl: true } } },
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
        context: q.context || null,
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

    // Count enrolled students for accurate progress display
    const totalEnrolled = await this.prisma.studentEnrollment.count({
      where: {
        groupId: classroom.teacherAssignment.groupId,
        academicYearId: classroom.teacherAssignment.academicYearId,
        status: 'ACTIVE',
      },
    });

    this.broadcast(sessionId, {
      type: 'ANSWER_PROGRESS',
      data: { questionId, totalAnswered, totalExpected: totalEnrolled },
    });

    // NOTE: We do NOT auto-close the question from the backend.
    // The teacher's timer handles closing via closeQuestion().
    // Previous auto-close was unreliable (closed prematurely on Q1
    // because totalConnected == 1 after first answer).

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
    const session = await this.validateTeacherSession(sessionId, teacherId);

    const updated = await this.prisma.liveSession.update({
      where: { id: sessionId },
      data: { status: 'FINISHED', finishedAt: new Date() },
    });

    // Auto-generate grades for ALL students
    await this.autoGradeFromLiveQuiz(sessionId, session.activityId);

    const ranking = await this.getRanking(sessionId, 10);
    this.broadcast(sessionId, { type: 'SESSION_FINISHED', data: ranking });

    // Cleanup stream after short delay
    setTimeout(() => this.cleanupStream(sessionId), 5000);

    return { session: updated, ranking };
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
        select: { id: true, mode: true, classroomId: true },
      });
      if (!session) return;

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
      const studentScores = new Map<string, { totalPoints: number; correctCount: number; answeredQuestions: Set<string>; answers: typeof liveAnswers }>();
      for (const la of liveAnswers) {
        if (!studentScores.has(la.studentEnrollmentId)) {
          studentScores.set(la.studentEnrollmentId, { totalPoints: 0, correctCount: 0, answeredQuestions: new Set(), answers: [] });
        }
        const entry = studentScores.get(la.studentEnrollmentId)!;
        entry.totalPoints += la.points;
        if (la.isCorrect) entry.correctCount++;
        entry.answeredQuestions.add(la.questionId);
        entry.answers.push(la);
      }

      // For TEAM mode: compute team average correctness for members without answers
      let teamAvgCorrectness = new Map<string, number>();
      if (session.mode === 'TEAM') {
        // Get team membership
        const teamMembers = await this.prisma.liveSessionTeamMember.findMany({
          where: { team: { sessionId } },
          select: { studentEnrollmentId: true, teamId: true },
        });

        // Group correctness by team
        const teamStudentCorrectness = new Map<string, number[]>();
        for (const tm of teamMembers) {
          const data = studentScores.get(tm.studentEnrollmentId);
          const correctRatio = data ? data.correctCount / questions.length : 0;
          if (!teamStudentCorrectness.has(tm.teamId)) teamStudentCorrectness.set(tm.teamId, []);
          teamStudentCorrectness.get(tm.teamId)!.push(correctRatio);
        }
        for (const [teamId, ratios] of teamStudentCorrectness) {
          const activeRatios = ratios.filter(r => r > 0);
          const avg = activeRatios.length > 0 ? activeRatios.reduce((s, r) => s + r, 0) / activeRatios.length : 0;
          teamAvgCorrectness.set(teamId, avg);
        }

        // Assign team average correctness to members without answers
        for (const tm of teamMembers) {
          if (!studentScores.has(tm.studentEnrollmentId)) {
            const avgCorrect = teamAvgCorrectness.get(tm.teamId) || 0;
            const avgCorrectCount = Math.round(avgCorrect * questions.length);
            studentScores.set(tm.studentEnrollmentId, { totalPoints: 0, correctCount: avgCorrectCount, answeredQuestions: new Set(), answers: [] });
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
        const correctCount = scoreData?.correctCount || 0;
        const totalQ = questions.length;

        // Grade based on CORRECTNESS RATIO (not speed-weighted points)
        // This ensures a student with more correct answers always gets a higher grade
        // Speed only affects ranking position, not academic grade
        const correctnessRatio = totalQ > 0 ? correctCount / totalQ : 0;
        const normalizedScore = correctnessRatio * maxScore;
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
    if (teamCount >= 12) throw new BadRequestException('Máximo 12 equipos permitidos');

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
