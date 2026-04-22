import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import { GuestService } from './guest.service';

/**
 * Gestión de sesiones de Lección Live (Nearpod-style).
 * El docente controla el avance; los invitados reciben el slide actual vía polling/SSE.
 */
@Injectable()
export class LiveLessonService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly guestService: GuestService,
  ) {}

  /** Crea una sesión Live de una lección (solo si playMode=LIVE). */
  async create(params: { lessonId: string; teacherId: string; guestMode?: 'GUESTS_ONLY' | 'MIXED' | 'DISABLED' }) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: params.lessonId },
      include: {
        activity: { select: { id: true, classroomId: true, classroom: { select: { ownerUserId: true, isPersonal: true } } } },
        slides: { orderBy: { sortOrder: 'asc' }, select: { id: true } },
      },
    });
    if (!lesson) throw new NotFoundException('Lección no encontrada');

    if (lesson.activity.classroom.isPersonal && lesson.activity.classroom.ownerUserId !== params.teacherId) {
      throw new ForbiddenException('No eres el dueño de esta lección');
    }
    if (lesson.slides.length === 0) {
      throw new BadRequestException('La lección no tiene diapositivas');
    }

    const joinCode = await this.guestService.generateUniqueJoinCode('LESSON');

    return this.prisma.liveLessonSession.create({
      data: {
        lessonId: lesson.id,
        activityId: lesson.activity.id,
        classroomId: lesson.activity.classroomId,
        teacherId: params.teacherId,
        joinCode,
        guestMode: params.guestMode || 'GUESTS_ONLY',
        status: 'LOBBY',
        currentSlideIndex: 0,
      },
    });
  }

  async start(sessionId: string, teacherId: string) {
    await this.assertTeacher(sessionId, teacherId);
    return this.prisma.liveLessonSession.update({
      where: { id: sessionId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });
  }

  async advance(sessionId: string, teacherId: string, currentSlideIndex: number) {
    await this.assertTeacher(sessionId, teacherId);
    return this.prisma.liveLessonSession.update({
      where: { id: sessionId },
      data: { currentSlideIndex },
    });
  }

  async pause(sessionId: string, teacherId: string) {
    await this.assertTeacher(sessionId, teacherId);
    return this.prisma.liveLessonSession.update({
      where: { id: sessionId },
      data: { status: 'PAUSED' },
    });
  }

  async resume(sessionId: string, teacherId: string) {
    await this.assertTeacher(sessionId, teacherId);
    return this.prisma.liveLessonSession.update({
      where: { id: sessionId },
      data: { status: 'RUNNING' },
    });
  }

  async finish(sessionId: string, teacherId: string) {
    await this.assertTeacher(sessionId, teacherId);
    return this.prisma.liveLessonSession.update({
      where: { id: sessionId },
      data: { status: 'FINISHED', endedAt: new Date() },
    });
  }

  /** Vista pública del estado actual (para invitados: qué slide mostrar). */
  async publicStatus(sessionId: string) {
    const session = await this.prisma.liveLessonSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true, status: true, currentSlideIndex: true, guestsCount: true,
        lesson: {
          select: {
            id: true, title: true, description: true, coverImage: true,
            badgeEmoji: true, badgeColor: true,
            slides: {
              orderBy: { sortOrder: 'asc' },
              select: {
                id: true, type: true, title: true, body: true,
                imageUrl: true, videoUrl: true, audioUrl: true, layout: true,
                activityData: true, badgeEmoji: true, badgeTitle: true,
              },
            },
          },
        },
      },
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');
    return session;
  }

  /** Reacciones agregadas para el docente (conteo por emoji + slideIndex). */
  async reactionStats(sessionId: string, teacherId: string) {
    await this.assertTeacher(sessionId, teacherId);
    const reactions = await this.prisma.liveSessionReaction.groupBy({
      by: ['emoji', 'slideIndex'],
      where: { sessionId },
      _count: true,
    });
    return reactions.map(r => ({
      emoji: r.emoji,
      slideIndex: r.slideIndex,
      count: r._count,
    }));
  }

  private async assertTeacher(sessionId: string, teacherId: string) {
    const session = await this.prisma.liveLessonSession.findUnique({
      where: { id: sessionId },
      select: { teacherId: true },
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');
    if (session.teacherId !== teacherId) {
      throw new ForbiddenException('No eres el docente de esta sesión');
    }
  }
}
