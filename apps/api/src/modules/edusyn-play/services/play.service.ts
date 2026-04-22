import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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
