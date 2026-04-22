import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PlayWorkspaceService } from './play-workspace.service';

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
    await this.assertActivityOwnership(activityId, userId);
    return this.prisma.activityQuestion.findMany({
      where: { activityId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async addQuestion(activityId: string, userId: string, dto: {
    type: string; text: string; options?: any; correctAnswer?: string;
    points?: number; explanation?: string; imageUrl?: string;
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
        points: dto.points ?? 10,
        explanation: dto.explanation ?? undefined,
        imageUrl: dto.imageUrl ?? undefined,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    });
  }

  async updateQuestion(questionId: string, userId: string, dto: {
    text?: string; options?: any; correctAnswer?: string;
    points?: number; explanation?: string; imageUrl?: string;
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
        text: dto.text,
        options: dto.options,
        correctAnswer: dto.correctAnswer,
        points: dto.points,
        explanation: dto.explanation,
        imageUrl: dto.imageUrl,
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
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');
    if (session.status !== 'WAITING') throw new BadRequestException('La sesión ya fue iniciada');

    const updated = await this.prisma.liveSession.update({
      where: { id: sessionId },
      data: { status: 'ACTIVE', startedAt: new Date(), currentQuestionIdx: 0 },
    });

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

    const totalQuestions = session.activity.questions.length;
    const nextIdx = session.currentQuestionIdx + 1;

    if (nextIdx >= totalQuestions) {
      // Finish
      await this.prisma.liveSession.update({
        where: { id: sessionId },
        data: { status: 'FINISHED', finishedAt: new Date() },
      });
      return { finished: true, currentQuestionIdx: nextIdx, totalQuestions };
    }

    await this.prisma.liveSession.update({
      where: { id: sessionId },
      data: { currentQuestionIdx: nextIdx },
    });

    const question = session.activity.questions[nextIdx];
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
      select: { id: true, nickname: true, avatarEmoji: true, score: true, correctAnswers: true, totalAnswered: true },
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
    return { finished: true };
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
