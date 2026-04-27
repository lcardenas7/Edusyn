import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PlayWorkspaceService } from './play-workspace.service';
import { PlayStreamService } from './play-stream.service';
import { GuestTokenService } from './guest-token.service';

/**
 * Servicio del panel /play del docente personal.
 * Todas las queries filtran por ownerUserId para aislar un docente de otro.
 */
@Injectable()
export class PlayService {
  // Límites Free (Fase 1)
  static readonly LIMITS = {
    MAX_QUIZZES: 10,
    MAX_LESSONS: 5,
    MAX_SESSIONS_PER_MONTH: 20,
    MAX_PARTICIPANTS_PER_SESSION: 50,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly workspace: PlayWorkspaceService,
    private readonly stream: PlayStreamService,
    private readonly guestTokenService: GuestTokenService,
  ) {}

  private async resolveClassroom(userId: string): Promise<string> {
    const ws = await this.workspace.ensureTeacherWorkspace(userId);
    return ws.classroomId;
  }

  async dashboard(userId: string) {
    const classroomId = await this.resolveClassroom(userId);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [quizCount, lessonCount, sessionsThisMonth, totalSessions, totalGuests] = await Promise.all([
      this.prisma.classroomActivity.count({
        where: { classroomId, type: { in: ['QUIZ', 'EXAM', 'LIVE_QUIZ', 'HOME_QUIZ'] as any } },
      }),
      this.prisma.classroomActivity.count({
        where: { classroomId, type: 'LESSON' as any },
      }),
      this.prisma.liveSession.count({
        where: { classroomId, createdAt: { gte: monthStart } },
      }),
      this.prisma.liveSession.count({ where: { classroomId } }),
      this.prisma.liveSessionGuest.count({
        where: {
          sessionId: {
            in: (await this.prisma.liveSession.findMany({
              where: { classroomId },
              select: { id: true },
            })).map(s => s.id),
          },
        },
      }),
    ]);

    return {
      limits: PlayService.LIMITS,
      stats: {
        quizCount,
        lessonCount,
        sessionsThisMonth,
        totalSessions,
        totalGuests,
      },
      usage: {
        quizzesRemaining: Math.max(0, PlayService.LIMITS.MAX_QUIZZES - quizCount),
        lessonsRemaining: Math.max(0, PlayService.LIMITS.MAX_LESSONS - lessonCount),
        sessionsRemaining: Math.max(0, PlayService.LIMITS.MAX_SESSIONS_PER_MONTH - sessionsThisMonth),
      },
    };
  }

  async createQuiz(userId: string, data: { title: string; description?: string; type?: string }) {
    await this.enforceFreeLimits(userId, 'QUIZ');
    const classroomId = await this.resolveClassroom(userId);

    // Buscar o crear la sección default "Quizzes"
    let section = await this.prisma.classroomSection.findFirst({
      where: { classroomId, title: 'Quizzes' },
    });
    if (!section) {
      const maxOrder = await this.prisma.classroomSection.aggregate({
        where: { classroomId },
        _max: { sortOrder: true },
      });
      section = await this.prisma.classroomSection.create({
        data: { classroomId, title: 'Quizzes', sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
      });
    }

    const validTypes = ['QUIZ', 'LIVE_QUIZ', 'HOME_QUIZ'];
    const actType = validTypes.includes(data.type || '') ? data.type! : 'LIVE_QUIZ';

    return this.prisma.classroomActivity.create({
      data: {
        classroomId,
        sectionId: section.id,
        title: data.title.trim(),
        description: data.description?.trim() || undefined,
        type: actType as any,
        isPublished: false,
        isVisible: true,
        maxScore: 100,
      },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        isPublished: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async deleteQuiz(userId: string, quizId: string) {
    const classroomId = await this.resolveClassroom(userId);
    const activity = await this.prisma.classroomActivity.findFirst({
      where: { id: quizId, classroomId },
    });
    if (!activity) throw new NotFoundException('Quiz no encontrado');
    await this.prisma.classroomActivity.delete({ where: { id: quizId } });
    return { deleted: true };
  }

  async listQuizzes(userId: string) {
    const classroomId = await this.resolveClassroom(userId);
    return this.prisma.classroomActivity.findMany({
      where: {
        classroomId,
        type: { in: ['QUIZ', 'EXAM', 'LIVE_QUIZ', 'HOME_QUIZ'] as any },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        isPublished: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async listLessons(userId: string) {
    const classroomId = await this.resolveClassroom(userId);
    return this.prisma.classroomActivity.findMany({
      where: { classroomId, type: 'LESSON' as any },
      orderBy: { createdAt: 'desc' },
      include: {
        lesson: {
          select: { id: true, title: true, playMode: true, estimatedMinutes: true, badgeEmoji: true },
        },
      },
    });
  }

  private async assertQuizOwnership(activityId: string, userId: string) {
    const classroomId = await this.resolveClassroom(userId);
    const activity = await this.prisma.classroomActivity.findFirst({
      where: { id: activityId, classroomId },
    });
    if (!activity) throw new NotFoundException('Quiz no encontrado');
    return activity;
  }

  async updateQuiz(userId: string, quizId: string, data: { title?: string; description?: string }) {
    await this.assertQuizOwnership(quizId, userId);
    return this.prisma.classroomActivity.update({
      where: { id: quizId },
      data: { title: data.title, description: data.description },
      select: { id: true, title: true, description: true },
    });
  }

  async reorderQuestions(userId: string, activityId: string, order: string[]) {
    await this.assertQuizOwnership(activityId, userId);
    await Promise.all(
      order.map((qId, idx) =>
        this.prisma.activityQuestion.updateMany({
          where: { id: qId, activityId },
          data: { sortOrder: idx },
        })
      )
    );
    return { reordered: true };
  }

  private async assertLessonOwnership(activityId: string, userId: string) {
    const classroomId = await this.resolveClassroom(userId);
    const activity = await this.prisma.classroomActivity.findFirst({
      where: { id: activityId, classroomId, type: 'LESSON' as any },
      include: {
        lesson: {
          include: {
            slides: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });
    if (!activity || !activity.lesson) throw new NotFoundException('Lección no encontrada');
    return activity;
  }

  async getLesson(userId: string, activityId: string) {
    const activity = await this.assertLessonOwnership(activityId, userId);
    return {
      id: activity.id,
      title: activity.title,
      description: activity.description,
      type: activity.type,
      isPublished: activity.isPublished,
      createdAt: activity.createdAt,
      updatedAt: activity.updatedAt,
      lesson: activity.lesson,
    };
  }

  async createLessonSlide(userId: string, activityId: string, data: {
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
    const activity = await this.assertLessonOwnership(activityId, userId);
    const lesson = activity.lesson!;
    const maxSort = await this.prisma.lessonSlide.aggregate({
      where: { lessonId: lesson.id },
      _max: { sortOrder: true },
    });

    return this.prisma.lessonSlide.create({
      data: {
        lessonId: lesson.id,
        type: data.type,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        title: data.title ?? undefined,
        body: data.body ?? undefined,
        imageUrl: data.imageUrl ?? undefined,
        videoUrl: data.videoUrl ?? undefined,
        audioUrl: data.audioUrl ?? undefined,
        layout: data.layout ?? undefined,
        activityData: data.activityData ?? undefined,
        badgeEmoji: data.badgeEmoji ?? undefined,
        badgeTitle: data.badgeTitle ?? undefined,
      },
    });
  }

  async updateLessonSlide(userId: string, activityId: string, slideId: string, data: {
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
    const activity = await this.assertLessonOwnership(activityId, userId);
    const lesson = activity.lesson!;
    const slide = await this.prisma.lessonSlide.findFirst({
      where: { id: slideId, lessonId: lesson.id },
    });
    if (!slide) throw new NotFoundException('Slide no encontrado');

    return this.prisma.lessonSlide.update({
      where: { id: slideId },
      data: {
        type: data.type,
        title: data.title,
        body: data.body,
        imageUrl: data.imageUrl,
        videoUrl: data.videoUrl,
        audioUrl: data.audioUrl,
        layout: data.layout,
        activityData: data.activityData,
        badgeEmoji: data.badgeEmoji,
        badgeTitle: data.badgeTitle,
      },
    });
  }

  async deleteLessonSlide(userId: string, activityId: string, slideId: string) {
    const activity = await this.assertLessonOwnership(activityId, userId);
    const lesson = activity.lesson!;
    const slide = await this.prisma.lessonSlide.findFirst({
      where: { id: slideId, lessonId: lesson.id },
    });
    if (!slide) throw new NotFoundException('Slide no encontrado');

    await this.prisma.lessonSlide.delete({ where: { id: slideId } });

    const remaining = await this.prisma.lessonSlide.findMany({
      where: { lessonId: lesson.id },
      orderBy: { sortOrder: 'asc' },
      select: { id: true },
    });

    await this.prisma.$transaction(
      remaining.map((item, index) =>
        this.prisma.lessonSlide.update({
          where: { id: item.id },
          data: { sortOrder: index },
        }),
      ),
    );

    return { deleted: true };
  }

  async reorderLessonSlides(userId: string, activityId: string, order: string[]) {
    const activity = await this.assertLessonOwnership(activityId, userId);
    const lesson = activity.lesson!;
    const currentSlides = lesson.slides;
    if (currentSlides.length !== order.length) {
      throw new BadRequestException('El orden enviado no coincide con la cantidad de slides');
    }

    const currentIds = new Set(currentSlides.map((slide) => slide.id));
    for (const slideId of order) {
      if (!currentIds.has(slideId)) {
        throw new BadRequestException('El orden contiene slides inválidos');
      }
    }

    await this.prisma.$transaction(
      order.map((slideId, index) =>
        this.prisma.lessonSlide.update({
          where: { id: slideId },
          data: { sortOrder: index },
        }),
      ),
    );

    return this.prisma.lessonSlide.findMany({
      where: { lessonId: lesson.id },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async listSessions(userId: string) {
    const classroomId = await this.resolveClassroom(userId);
    return this.prisma.liveSession.findMany({
      where: { classroomId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        status: true,
        joinCode: true,
        guestMode: true,
        guestsCount: true,
        createdAt: true,
        startedAt: true,
        finishedAt: true,
        activity: { select: { id: true, title: true, type: true } },
      },
    });
  }

  /**
   * Valida que el usuario dueño coincida con el ownerUserId del recurso.
   * Uso: antes de mutar una actividad o sesión desde /play/*.
   */
  async assertOwnership(userId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.liveSession.findUnique({
      where: { id: sessionId },
      select: { classroom: { select: { ownerUserId: true, isPersonal: true } } },
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');
    if (session.classroom.isPersonal && session.classroom.ownerUserId !== userId) {
      throw new ForbiddenException('No tienes acceso a esta sesión');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUESTIONS CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  private async assertActivityOwnership(activityId: string, userId: string) {
    const classroomId = await this.resolveClassroom(userId);
    const activity = await this.prisma.classroomActivity.findFirst({
      where: { id: activityId, classroomId },
    });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    return activity;
  }

  async listQuestions(activityId: string, userId: string) {
    const activity = await this.assertActivityOwnership(activityId, userId);
    const questions = await this.prisma.activityQuestion.findMany({
      where: { activityId },
      orderBy: { sortOrder: 'asc' },
    });
    return { title: activity.title, description: activity.description ?? '', questions };
  }

  async addQuestion(activityId: string, userId: string, dto: {
    type: string; text: string; options?: any; correctAnswer?: string;
    points?: number; explanation?: string; imageUrl?: string; timeLimitSeconds?: number;
  }) {
    await this.assertActivityOwnership(activityId, userId);
    const maxSort = await this.prisma.activityQuestion.aggregate({
      where: { activityId },
      _max: { sortOrder: true },
    });
    return this.prisma.activityQuestion.create({
      data: {
        activityId,
        type: dto.type as any,
        text: dto.text,
        options: dto.options ?? undefined,
        correctAnswer: dto.correctAnswer ?? undefined,
        points: dto.points ?? 1000,
        explanation: dto.explanation ?? undefined,
        imageUrl: dto.imageUrl ?? undefined,
        timeLimitSeconds: dto.timeLimitSeconds ?? undefined,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    });
  }

  async updateQuestion(questionId: string, userId: string, dto: {
    type?: string; text?: string; options?: any; correctAnswer?: string;
    points?: number; explanation?: string; imageUrl?: string; timeLimitSeconds?: number;
  }) {
    const q = await this.prisma.activityQuestion.findUnique({
      where: { id: questionId },
      include: { activity: { select: { classroomId: true } } },
    });
    if (!q) throw new NotFoundException('Pregunta no encontrada');
    const classroomId = await this.resolveClassroom(userId);
    if (q.activity.classroomId !== classroomId) throw new ForbiddenException('Sin acceso');

    return this.prisma.activityQuestion.update({
      where: { id: questionId },
      data: {
        ...(dto.type && { type: dto.type as any }),
        text: dto.text,
        options: dto.options,
        correctAnswer: dto.correctAnswer,
        points: dto.points,
        explanation: dto.explanation,
        imageUrl: dto.imageUrl,
        timeLimitSeconds: dto.timeLimitSeconds,
      },
    });
  }

  async deleteQuestion(questionId: string, userId: string) {
    const q = await this.prisma.activityQuestion.findUnique({
      where: { id: questionId },
      include: { activity: { select: { classroomId: true } } },
    });
    if (!q) throw new NotFoundException('Pregunta no encontrada');
    const classroomId = await this.resolveClassroom(userId);
    if (q.activity.classroomId !== classroomId) throw new ForbiddenException('Sin acceso');
    await this.prisma.activityQuestion.delete({ where: { id: questionId } });
    return { deleted: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LIVE QUIZ SESSION
  // ═══════════════════════════════════════════════════════════════════════════

  async createLiveQuizSession(userId: string, activityId: string) {
    const classroomId = await this.resolveClassroom(userId);
    const activity = await this.prisma.classroomActivity.findFirst({
      where: { id: activityId, classroomId },
      include: { questions: { orderBy: { sortOrder: 'asc' }, select: { id: true } } },
    });
    if (!activity) throw new NotFoundException('Quiz no encontrado');
    if (activity.questions.length === 0) throw new BadRequestException('El quiz no tiene preguntas. Agrega al menos una antes de jugar.');

    await this.enforceFreeLimits(userId, 'SESSION');

    // Close old WAITING/ACTIVE sessions
    await this.prisma.liveSession.updateMany({
      where: { classroomId, status: { in: ['WAITING', 'ACTIVE'] } },
      data: { status: 'FINISHED', finishedAt: new Date() },
    });

    // Generate unique join code
    let joinCode: string | null = null;
    for (let i = 0; i < 10; i++) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const existing = await this.prisma.liveSession.findUnique({ where: { joinCode: code } });
      if (!existing) { joinCode = code; break; }
    }
    if (!joinCode) throw new BadRequestException('No se pudo generar código, intenta de nuevo');

    const questionOrder = activity.questions.map(q => q.id);

    const session = await this.prisma.liveSession.create({
      data: {
        classroomId,
        activityId,
        teacherId: userId,
        mode: 'INDIVIDUAL',
        deliveryMode: 'SYNC',
        status: 'WAITING',
        joinCode,
        guestMode: 'GUESTS_ONLY',
        guestsCount: 0,
        config: { questionOrder },
      },
    });

    // Pre-crear stream para que los invitados puedan conectarse antes de que inicie
    this.stream.getOrCreateStream(session.id);

    return {
      id: session.id,
      joinCode: session.joinCode,
      status: session.status,
      guestsCount: session.guestsCount,
      activityTitle: activity.title,
      questionCount: activity.questions.length,
    };
  }

  async startLiveQuizSession(userId: string, sessionId: string) {
    const classroomId = await this.resolveClassroom(userId);
    const session = await this.prisma.liveSession.findFirst({
      where: { id: sessionId, classroomId, teacherId: userId },
      include: { activity: { include: { questions: { orderBy: { sortOrder: 'asc' } } } } },
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');
    if (session.status !== 'WAITING') throw new BadRequestException('La sesión ya fue iniciada');

    const now = new Date();
    const updated = await this.prisma.liveSession.update({
      where: { id: sessionId },
      data: { status: 'ACTIVE', startedAt: now, currentQuestionIdx: 0 },
    });

    // Emitir primera pregunta al iniciar
    const firstQuestion = session.activity?.questions?.[0];
    if (firstQuestion) {
      const openedAt = Date.now();
      this.stream.emit(sessionId, {
        type: 'QUESTION_OPENED',
        data: {
          questionIndex: 0,
          totalQuestions: session.activity.questions.length,
          questionOpenedAt: openedAt,
          question: {
            id: firstQuestion.id,
            type: firstQuestion.type,
            text: firstQuestion.text,
            options: firstQuestion.options,
            points: firstQuestion.points,
            imageUrl: (firstQuestion as any).imageUrl ?? null,
            timeLimitSeconds: firstQuestion.timeLimitSeconds ?? null,
          },
        },
      });
      // Schedule server-driven auto-close
      this.scheduleQuestionClose(sessionId, firstQuestion.id, 0, session.activity.questions.length, firstQuestion.timeLimitSeconds ?? null, openedAt);
    } else {
      this.stream.emit(sessionId, { type: 'SESSION_STARTED', data: { sessionId } });
    }

    return { id: updated.id, status: updated.status, currentQuestionIdx: updated.currentQuestionIdx };
  }

  async nextQuestionLive(userId: string, sessionId: string) {
    const classroomId = await this.resolveClassroom(userId);
    const session = await this.prisma.liveSession.findFirst({
      where: { id: sessionId, classroomId, teacherId: userId },
      include: { activity: { include: { questions: { orderBy: { sortOrder: 'asc' } } } } },
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');
    if (session.status !== 'ACTIVE') throw new BadRequestException('La sesión no está activa');

    // Cancel any pending auto-close timer for current question
    this.cancelQuestionClose(sessionId);

    const totalQuestions = session.activity.questions.length;
    const nextIdx = session.currentQuestionIdx + 1;

    // Always emit QUESTION_CLOSED for current question before advancing
    await this.emitQuestionClosed(sessionId, session.currentQuestionIdx);

    if (nextIdx >= totalQuestions) {
      // Finish
      await this.prisma.liveSession.update({
        where: { id: sessionId },
        data: { status: 'FINISHED', finishedAt: new Date() },
      });

      // Calcular ranking final de invitados
      const guests = await this.prisma.liveSessionGuest.findMany({
        where: { sessionId },
        orderBy: [{ score: 'desc' }, { correctAnswers: 'desc' }],
        select: { id: true, nickname: true, avatarEmoji: true, score: true, correctAnswers: true, totalAnswers: true },
      });
      this.stream.emit(sessionId, {
        type: 'SESSION_FINISHED',
        data: { ranking: guests },
      });
      this.stream.finishStream(sessionId);
      this.guestTokenService.revokeSession(sessionId);
      return { finished: true, currentQuestionIdx: nextIdx, totalQuestions };
    }

    await this.prisma.liveSession.update({
      where: { id: sessionId },
      data: { currentQuestionIdx: nextIdx },
    });

    const question = session.activity.questions[nextIdx];
    const openedAt = Date.now();
    this.stream.emit(sessionId, {
      type: 'QUESTION_OPENED',
      data: {
        questionIndex: nextIdx,
        totalQuestions,
        questionOpenedAt: openedAt,
        question: {
          id: question.id,
          type: question.type,
          text: question.text,
          options: question.options,
          points: question.points,
          imageUrl: (question as any).imageUrl ?? null,
          timeLimitSeconds: (question as any).timeLimitSeconds ?? null,
        },
      },
    });
    // Schedule server-driven auto-close
    this.scheduleQuestionClose(sessionId, question.id, nextIdx, totalQuestions, (question as any).timeLimitSeconds ?? null, openedAt);
    return {
      finished: false,
      currentQuestionIdx: nextIdx,
      totalQuestions,
      question: {
        id: question.id,
        type: question.type,
        text: question.text,
        options: question.options,
        points: question.points,
      },
    };
  }

  async getLiveQuizStatus(userId: string, sessionId: string) {
    const classroomId = await this.resolveClassroom(userId);
    const session = await this.prisma.liveSession.findFirst({
      where: { id: sessionId, classroomId, teacherId: userId },
      include: {
        activity: {
          select: {
            title: true,
            questions: { orderBy: { sortOrder: 'asc' }, select: { id: true, type: true, text: true, options: true, points: true } },
          },
        },
      },
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');

    const guests = await this.prisma.liveSessionGuest.findMany({
      where: { sessionId },
      orderBy: [{ score: 'desc' }, { correctAnswers: 'desc' }],
      select: { id: true, nickname: true, avatarEmoji: true, score: true, correctAnswers: true, totalAnswers: true },
    });

    return {
      id: session.id,
      joinCode: session.joinCode,
      status: session.status,
      guestsCount: session.guestsCount,
      currentQuestionIdx: session.currentQuestionIdx,
      activityTitle: session.activity.title,
      totalQuestions: session.activity.questions.length,
      questions: session.activity.questions,
      guests,
    };
  }

  async finishLiveQuiz(userId: string, sessionId: string) {
    const classroomId = await this.resolveClassroom(userId);
    const session = await this.prisma.liveSession.findFirst({
      where: { id: sessionId, classroomId, teacherId: userId },
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');
    await this.prisma.liveSession.update({
      where: { id: sessionId },
      data: { status: 'FINISHED', finishedAt: new Date() },
    });
    const guests = await this.prisma.liveSessionGuest.findMany({
      where: { sessionId },
      orderBy: [{ score: 'desc' }, { correctAnswers: 'desc' }],
      select: { id: true, nickname: true, avatarEmoji: true, score: true, correctAnswers: true, totalAnswers: true },
    });
    this.stream.emit(sessionId, { type: 'SESSION_FINISHED', data: { ranking: guests } });
    this.stream.finishStream(sessionId);
    this.guestTokenService.revokeSession(sessionId);
    return { finished: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SERVER-DRIVEN TIMER
  // ═══════════════════════════════════════════════════════════════════════════

  /** Per-session timers for auto-close */
  private readonly questionTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** questionOpenedAt timestamp per session for speed-factor scoring */
  readonly questionOpenedAt = new Map<string, number>();

  private scheduleQuestionClose(
    sessionId: string,
    questionId: string,
    questionIdx: number,
    totalQuestions: number,
    timeLimitSeconds: number | null,
    openedAt: number,
  ) {
    const seconds = timeLimitSeconds && timeLimitSeconds > 0 ? timeLimitSeconds : 30;
    this.questionOpenedAt.set(sessionId, openedAt);
    const timer = setTimeout(async () => {
      this.questionTimers.delete(sessionId);
      await this.emitQuestionClosed(sessionId, questionIdx);
    }, seconds * 1000);
    this.questionTimers.set(sessionId, timer);
  }

  cancelQuestionClose(sessionId: string) {
    const existing = this.questionTimers.get(sessionId);
    if (existing) {
      clearTimeout(existing);
      this.questionTimers.delete(sessionId);
    }
  }

  /** Emits QUESTION_CLOSED with answer stats and top ranking. */
  async emitQuestionClosed(sessionId: string, questionIdx: number) {
    // Get answer stats for this question index
    const session = await this.prisma.liveSession.findUnique({
      where: { id: sessionId },
      select: { guestsCount: true, config: true },
    });
    const answeredCount = await this.prisma.liveSessionGuestAnswer.count({
      where: {
        guest: { sessionId },
      },
    });
    // Top-5 ranking for reveal
    const ranking = await this.prisma.liveSessionGuest.findMany({
      where: { sessionId },
      orderBy: [{ score: 'desc' }, { correctAnswers: 'desc' }],
      take: 5,
      select: { id: true, nickname: true, avatarEmoji: true, score: true, correctAnswers: true, totalAnswers: true },
    });
    this.stream.emit(sessionId, {
      type: 'QUESTION_CLOSED',
      data: {
        questionIdx,
        answeredCount,
        totalGuests: session?.guestsCount ?? 0,
        ranking,
      },
    });
    this.questionOpenedAt.delete(sessionId);
  }

  /**
   * Devuelve el estado actual de la sesión para el evento inicial SSE.
   * Retorna null si la sesión no existe o ya terminó.
   */
  async getSessionStateForSSE(sessionId: string): Promise<any | null> {
    const session = await this.prisma.liveSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        status: true,
        joinCode: true,
        guestsCount: true,
        currentQuestionIdx: true,
        config: true,
        activity: {
          select: {
            title: true,
            questions: {
              orderBy: { sortOrder: 'asc' },
              select: { id: true, type: true, text: true, options: true, points: true, timeLimitSeconds: true },
            },
          },
        },
      },
    });
    if (!session) return null;

    const totalQuestions = session.activity?.questions?.length ?? 0;
    const currentIdx = session.currentQuestionIdx;
    const currentQuestion =
      session.status === 'ACTIVE' && currentIdx >= 0 && session.activity?.questions?.[currentIdx]
        ? session.activity.questions[currentIdx]
        : null;

    return {
      id: session.id,
      status: session.status,
      joinCode: session.joinCode,
      guestsCount: session.guestsCount,
      totalQuestions,
      currentQuestionIdx: currentIdx,
      activityTitle: session.activity?.title,
      currentQuestion,
    };
  }

  /**
   * Emite un evento GUEST_JOINED a todos los clientes SSE de la sesión.
   * Llamado por GuestService después del join exitoso.
   */
  emitGuestJoined(sessionId: string, data: { nickname: string; avatarEmoji: string; guestsCount: number }): void {
    this.stream.emit(sessionId, { type: 'GUEST_JOINED', data });
  }

  /**
   * Emite RANKING_UPDATED tras cada respuesta de invitado.
   */
  async emitRankingUpdate(sessionId: string): Promise<void> {
    const guests = await this.prisma.liveSessionGuest.findMany({
      where: { sessionId },
      orderBy: [{ score: 'desc' }, { correctAnswers: 'desc' }],
      take: 20,
      select: { id: true, nickname: true, avatarEmoji: true, score: true, correctAnswers: true, totalAnswers: true },
    });
    this.stream.emit(sessionId, { type: 'RANKING_UPDATED', data: { ranking: guests } });
  }

  emitReaction(sessionId: string, data: { guestId: string; emoji: string; slideIndex?: number | null }): void {
    this.stream.emit(sessionId, { type: 'REACTION', data });
  }

  // F6.25: Pausar / Reanudar pregunta activa
  private readonly pausedTimers = new Map<string, { remaining: number; pausedAt: number }>();

  async pauseSession(userId: string, sessionId: string) {
    const classroomId = await this.resolveClassroom(userId);
    const session = await this.prisma.liveSession.findFirst({
      where: { id: sessionId, classroomId, teacherId: userId },
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');
    if (session.status !== 'ACTIVE') throw new BadRequestException('La sesión no está activa');
    if (this.pausedTimers.has(sessionId)) return { paused: true }; // ya pausada

    const existing = this.questionTimers.get(sessionId);
    const openedAt = this.questionOpenedAt.get(sessionId);
    if (existing && openedAt) {
      const elapsed = Date.now() - openedAt;
      const q = await this.prisma.liveSession.findUnique({
        where: { id: sessionId },
        select: { activity: { select: { questions: { orderBy: { sortOrder: 'asc' }, select: { timeLimitSeconds: true } } } }, currentQuestionIdx: true },
      });
      const timeLimitMs = ((q?.activity.questions[q.currentQuestionIdx ?? 0] as any)?.timeLimitSeconds ?? 30) * 1000;
      const remaining = Math.max(0, timeLimitMs - elapsed);
      clearTimeout(existing);
      this.questionTimers.delete(sessionId);
      this.pausedTimers.set(sessionId, { remaining, pausedAt: Date.now() });
    }
    this.stream.emit(sessionId, { type: 'SESSION_PAUSED', data: {} });
    return { paused: true };
  }

  async resumeSession(userId: string, sessionId: string) {
    const classroomId = await this.resolveClassroom(userId);
    const session = await this.prisma.liveSession.findFirst({
      where: { id: sessionId, classroomId, teacherId: userId },
      include: { activity: { include: { questions: { orderBy: { sortOrder: 'asc' } } } } },
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');
    const pauseInfo = this.pausedTimers.get(sessionId);
    if (!pauseInfo) return { paused: false }; // no estaba pausada

    this.pausedTimers.delete(sessionId);
    const idx = session.currentQuestionIdx;
    const question = session.activity.questions[idx];
    if (question && pauseInfo.remaining > 0) {
      const newOpenedAt = Date.now() - (((question as any).timeLimitSeconds ?? 30) * 1000 - pauseInfo.remaining);
      this.questionOpenedAt.set(sessionId, newOpenedAt);
      const timer = setTimeout(async () => {
        this.questionTimers.delete(sessionId);
        await this.emitQuestionClosed(sessionId, idx);
      }, pauseInfo.remaining);
      this.questionTimers.set(sessionId, timer);
    }
    this.stream.emit(sessionId, { type: 'SESSION_RESUMED', data: { remainingMs: pauseInfo.remaining } });
    return { paused: false, remainingMs: pauseInfo.remaining };
  }

  // F6.27: Volver a jugar (mismos guests o shuffle)
  async replaySession(userId: string, sessionId: string, options?: { shuffle?: boolean; keepGuests?: boolean }) {
    const classroomId = await this.resolveClassroom(userId);
    const session = await this.prisma.liveSession.findFirst({
      where: { id: sessionId, classroomId, teacherId: userId },
      select: { activityId: true, guestMode: true, status: true },
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');

    const newSession = await this.prisma.liveSession.create({
      data: {
        classroomId,
        teacherId: userId,
        activityId: session.activityId,
        status: 'WAITING',
        joinCode: await this.generateUniqueJoinCode(),
        guestMode: session.guestMode,
        guestsCount: 0,
        config: options?.shuffle ? ({ shuffle: true } as any) : undefined,
      },
    });
    return {
      id: newSession.id,
      joinCode: newSession.joinCode,
      status: newSession.status,
    };
  }

  private async generateUniqueJoinCode(): Promise<string> {
    let code: string;
    let attempts = 0;
    do {
      code = Math.floor(100000 + Math.random() * 900000).toString();
      const existing = await this.prisma.liveSession.findFirst({ where: { joinCode: code, status: { in: ['WAITING', 'ACTIVE'] } } });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);
    return code!;
  }

  /** F6.24: Emite ANSWER_STATS tras cada respuesta de invitado. */
  emitAnswerStats(sessionId: string, data: { questionId: string; answeredCount: number; totalGuests: number; percent: number }): void {
    this.stream.emit(sessionId, { type: 'ANSWER_STATS', data });
  }

  // F6.37: Métricas de calidad por pregunta
  async getQuestionStats(userId: string, sessionId: string) {
    const classroomId = await this.resolveClassroom(userId);
    const session = await this.prisma.liveSession.findFirst({
      where: { id: sessionId, classroomId, teacherId: userId },
      include: {
        activity: {
          select: {
            questions: { orderBy: { sortOrder: 'asc' }, select: { id: true, text: true, correctAnswer: true, points: true } },
          },
        },
      },
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');

    const questions = session.activity?.questions ?? [];
    const stats = await Promise.all(
      questions.map(async (q) => {
        const answers = await this.prisma.liveSessionGuestAnswer.findMany({
          where: { questionId: q.id, guest: { sessionId } },
          select: { isCorrect: true, timeTakenMs: true, selectedOption: true, answerText: true },
        });
        const total = answers.length;
        const correct = answers.filter(a => a.isCorrect).length;
        const avgTimeMs = total > 0
          ? answers.filter(a => a.timeTakenMs != null).reduce((s, a) => s + (a.timeTakenMs ?? 0), 0) /
            Math.max(1, answers.filter(a => a.timeTakenMs != null).length)
          : null;
        return {
          questionId: q.id,
          questionText: q.text,
          total,
          correct,
          incorrect: total - correct,
          pctCorrect: total > 0 ? Math.round((correct / total) * 100) : 0,
          avgTimeSec: avgTimeMs != null ? Math.round(avgTimeMs / 1000) : null,
          difficulty: total > 0 ? (correct / total < 0.4 ? 'HARD' : correct / total < 0.7 ? 'MEDIUM' : 'EASY') : 'N/A',
        };
      }),
    );

    return {
      sessionId,
      totalGuests: session.guestsCount,
      questions: stats,
      hardest: stats.sort((a, b) => a.pctCorrect - b.pctCorrect)[0] ?? null,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LESSONS CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  async createLesson(userId: string, data: { title: string; description?: string }) {
    await this.enforceFreeLimits(userId, 'LESSON');
    const classroomId = await this.resolveClassroom(userId);

    let section = await this.prisma.classroomSection.findFirst({
      where: { classroomId, title: 'Lecciones' },
    });
    if (!section) {
      const maxOrder = await this.prisma.classroomSection.aggregate({
        where: { classroomId },
        _max: { sortOrder: true },
      });
      section = await this.prisma.classroomSection.create({
        data: { classroomId, title: 'Lecciones', sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
      });
    }

    const activity = await this.prisma.classroomActivity.create({
      data: {
        classroomId,
        sectionId: section.id,
        title: data.title.trim(),
        description: data.description?.trim() || undefined,
        type: 'LESSON' as any,
        isPublished: false,
        isVisible: true,
        maxScore: 100,
      },
    });

    const lesson = await this.prisma.lesson.create({
      data: {
        activityId: activity.id,
        title: data.title.trim(),
        playMode: 'LIVE',
      },
    });

    return {
      id: activity.id,
      title: activity.title,
      description: activity.description,
      type: activity.type,
      isPublished: activity.isPublished,
      createdAt: activity.createdAt,
      lesson: { id: lesson.id, title: lesson.title, playMode: lesson.playMode },
    };
  }

  async deleteLesson(userId: string, activityId: string) {
    const classroomId = await this.resolveClassroom(userId);
    const activity = await this.prisma.classroomActivity.findFirst({
      where: { id: activityId, classroomId, type: 'LESSON' as any },
      include: { lesson: true },
    });
    if (!activity) throw new NotFoundException('Lección no encontrada');
    if (activity.lesson) {
      await this.prisma.lesson.delete({ where: { id: activity.lesson.id } });
    }
    await this.prisma.classroomActivity.delete({ where: { id: activityId } });
    return { deleted: true };
  }

  async enforceFreeLimits(userId: string, kind: 'QUIZ' | 'LESSON' | 'SESSION'): Promise<void> {
    const d = await this.dashboard(userId);
    if (kind === 'QUIZ' && d.stats.quizCount >= PlayService.LIMITS.MAX_QUIZZES) {
      throw new ForbiddenException(`Límite del plan Free: ${PlayService.LIMITS.MAX_QUIZZES} quizzes. Actualiza a Pro para ilimitado.`);
    }
    if (kind === 'LESSON' && d.stats.lessonCount >= PlayService.LIMITS.MAX_LESSONS) {
      throw new ForbiddenException(`Límite del plan Free: ${PlayService.LIMITS.MAX_LESSONS} lecciones. Actualiza a Pro para ilimitado.`);
    }
    if (kind === 'SESSION' && d.stats.sessionsThisMonth >= PlayService.LIMITS.MAX_SESSIONS_PER_MONTH) {
      throw new ForbiddenException(`Límite del plan Free: ${PlayService.LIMITS.MAX_SESSIONS_PER_MONTH} sesiones/mes. Actualiza a Pro para ilimitado.`);
    }
  }
}
