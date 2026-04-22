import * as crypto from 'crypto';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import { GuestTokenService } from './guest-token.service';
import { generateJoinCode } from '../utils/join-code.util';

export type SessionKind = 'QUIZ' | 'LESSON';

const NICKNAME_BLACKLIST = [
  'puta', 'puto', 'mierda', 'pene', 'verga', 'coño', 'culo', 'polla',
  'admin', 'docente', 'teacher', 'edusyn',
];

const NICKNAME_REGEX = /^[\p{L}\p{N}_\-\.]{2,20}$/u;

/**
 * Servicio de invitados (guests) de Edusyn Play.
 * Maneja el join público, submit de respuestas, reacciones y ranking.
 */
@Injectable()
export class GuestService {
  static readonly MAX_GUESTS_PER_SESSION = 50; // Límite Free

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: GuestTokenService,
  ) {}

  /** Genera un joinCode único (6 dígitos). Reintenta si colisiona. */
  async generateUniqueJoinCode(kind: SessionKind): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const code = generateJoinCode();
      const collision = kind === 'QUIZ'
        ? await this.prisma.liveSession.findUnique({ where: { joinCode: code } })
        : await this.prisma.liveLessonSession.findUnique({ where: { joinCode: code } });
      if (!collision) return code;
    }
    throw new BadRequestException('No se pudo generar un código único, intenta de nuevo');
  }

  private hashIp(ip: string | undefined): string | null {
    if (!ip) return null;
    return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 32);
  }

  private validateNickname(nickname: string): string {
    const clean = (nickname || '').trim();
    if (!NICKNAME_REGEX.test(clean)) {
      throw new BadRequestException('Apodo inválido. Usa 2-20 caracteres, solo letras, números, _ o -');
    }
    const lower = clean.toLowerCase();
    if (NICKNAME_BLACKLIST.some(bad => lower.includes(bad))) {
      throw new BadRequestException('Apodo no permitido, elige otro');
    }
    return clean;
  }

  /**
   * Valida un código y devuelve info mínima de la sesión (público).
   */
  async lookupByCode(code: string): Promise<{
    sessionId: string;
    sessionKind: SessionKind;
    title: string;
    status: string;
    guestsCount: number;
    allowJoin: boolean;
  }> {
    const quiz = await this.prisma.liveSession.findUnique({
      where: { joinCode: code },
      select: {
        id: true, status: true, guestMode: true, guestsCount: true,
        activity: { select: { title: true } },
      },
    });
    if (quiz) {
      if (quiz.guestMode === 'DISABLED') throw new ForbiddenException('Los invitados no están habilitados en esta sesión');
      return {
        sessionId: quiz.id,
        sessionKind: 'QUIZ',
        title: quiz.activity.title,
        status: quiz.status,
        guestsCount: quiz.guestsCount,
        allowJoin: quiz.status === 'WAITING' || quiz.status === 'ACTIVE',
      };
    }

    const lesson = await this.prisma.liveLessonSession.findUnique({
      where: { joinCode: code },
      select: {
        id: true, status: true, guestMode: true, guestsCount: true,
        lesson: { select: { title: true } },
      },
    });
    if (lesson) {
      if (lesson.guestMode === 'DISABLED') throw new ForbiddenException('Los invitados no están habilitados en esta lección');
      return {
        sessionId: lesson.id,
        sessionKind: 'LESSON',
        title: lesson.lesson.title,
        status: lesson.status,
        guestsCount: lesson.guestsCount,
        allowJoin: lesson.status === 'LOBBY' || lesson.status === 'RUNNING',
      };
    }

    throw new NotFoundException('Código no encontrado');
  }

  /**
   * Invitado se une a una sesión.
   * Devuelve guestToken + info de la sesión.
   */
  async joinSession(params: {
    code: string;
    nickname: string;
    avatarEmoji?: string;
    ip?: string;
    userAgent?: string;
    fingerprint?: string;
  }): Promise<{
    guestToken: string;
    guestId: string;
    sessionId: string;
    sessionKind: SessionKind;
    title: string;
    nickname: string;
  }> {
    const info = await this.lookupByCode(params.code);
    if (!info.allowJoin) {
      throw new ForbiddenException('Esta sesión ya no admite nuevos participantes');
    }
    if (info.guestsCount >= GuestService.MAX_GUESTS_PER_SESSION) {
      throw new ForbiddenException(`Sesión llena (máx ${GuestService.MAX_GUESTS_PER_SESSION} participantes)`);
    }

    const nickname = this.validateNickname(params.nickname);

    // Check nickname único en la sesión
    const taken = await this.prisma.liveSessionGuest.findFirst({
      where: { sessionId: info.sessionId, nickname },
    });
    if (taken) throw new BadRequestException('Ese apodo ya está en uso, elige otro');

    // Crear guest (con token temporal; se reemplazará)
    const tempToken = `tmp-${Date.now()}-${Math.random()}`;
    const guest = await this.prisma.liveSessionGuest.create({
      data: {
        sessionId: info.sessionId,
        sessionKind: info.sessionKind,
        nickname,
        avatarEmoji: params.avatarEmoji || '🦊',
        guestToken: tempToken,
        ipHash: this.hashIp(params.ip),
        userAgent: params.userAgent?.slice(0, 500),
        fingerprint: params.fingerprint?.slice(0, 200),
      },
    });

    // Firmar JWT de guest y actualizar
    const token = await this.tokens.sign({
      type: 'guest',
      guestId: guest.id,
      sessionId: info.sessionId,
      sessionKind: info.sessionKind,
      nickname,
    });

    await this.prisma.liveSessionGuest.update({
      where: { id: guest.id },
      data: { guestToken: token },
    });

    // Incrementar contador
    if (info.sessionKind === 'QUIZ') {
      await this.prisma.liveSession.update({
        where: { id: info.sessionId },
        data: { guestsCount: { increment: 1 } },
      });
    } else {
      await this.prisma.liveLessonSession.update({
        where: { id: info.sessionId },
        data: { guestsCount: { increment: 1 } },
      });
    }

    return {
      guestToken: token,
      guestId: guest.id,
      sessionId: info.sessionId,
      sessionKind: info.sessionKind,
      title: info.title,
      nickname,
    };
  }

  /**
   * Invitado envía una respuesta.
   * Calcula scoring automático si la pregunta tiene correctAnswer.
   */
  async submitAnswer(params: {
    guestId: string;
    questionId?: string;
    slideId?: string;
    selectedOption?: string;
    answerText?: string;
    timeTakenMs?: number;
  }): Promise<{ isCorrect: boolean; pointsAwarded: number }> {
    const guest = await this.prisma.liveSessionGuest.findUnique({
      where: { id: params.guestId },
    });
    if (!guest) throw new NotFoundException('Invitado no encontrado');

    let isCorrect = false;
    let pointsAwarded = 0;

    // Resolver correctAnswer + points (desde pregunta o slide)
    if (params.questionId) {
      const q = await this.prisma.activityQuestion.findUnique({
        where: { id: params.questionId },
        select: { correctAnswer: true, points: true },
      });
      if (q) {
        const submitted = (params.selectedOption || params.answerText || '').trim().toLowerCase();
        const correct = (q.correctAnswer || '').trim().toLowerCase();
        isCorrect = correct.length > 0 && submitted === correct;
        pointsAwarded = isCorrect ? Math.round(Number(q.points || 1) * 100) : 0;
      }
    } else if (params.slideId) {
      const slide = await this.prisma.lessonSlide.findUnique({
        where: { id: params.slideId },
        select: { activityData: true },
      });
      if (slide?.activityData) {
        const data = slide.activityData as any;
        const submitted = (params.selectedOption || params.answerText || '').trim().toLowerCase();
        const correct = (data.correctAnswer || '').trim().toLowerCase();
        isCorrect = correct.length > 0 && submitted === correct;
        pointsAwarded = isCorrect ? Math.round(Number(data.points || 1) * 100) : 0;
      }
    }

    await this.prisma.liveSessionGuestAnswer.create({
      data: {
        guestId: params.guestId,
        questionId: params.questionId || null,
        slideId: params.slideId || null,
        selectedOption: params.selectedOption || null,
        answerText: params.answerText || null,
        isCorrect,
        pointsAwarded,
        timeTakenMs: params.timeTakenMs ?? null,
      },
    });

    // Actualizar agregados del guest
    const total = guest.totalAnswers + 1;
    const correctCount = guest.correctAnswers + (isCorrect ? 1 : 0);
    const newScore = guest.score + pointsAwarded;
    const percent = total > 0 ? (correctCount / total) * 100 : 0;

    await this.prisma.liveSessionGuest.update({
      where: { id: params.guestId },
      data: {
        score: newScore,
        correctAnswers: correctCount,
        totalAnswers: total,
        percent,
        lastSeenAt: new Date(),
      },
    });

    return { isCorrect, pointsAwarded };
  }

  /** Registra una reacción en vivo (💡 🤔 ❤ 👏) */
  async submitReaction(guestId: string, sessionId: string, emoji: string, slideIndex?: number) {
    const allowed = ['💡', '🤔', '❤', '👏', '🔥', '👍'];
    if (!allowed.includes(emoji)) {
      throw new BadRequestException('Emoji no permitido');
    }
    return this.prisma.liveSessionReaction.create({
      data: {
        sessionId,
        slideIndex: slideIndex ?? null,
        guestId,
        emoji,
      },
    });
  }

  /** Ranking completo de la sesión (mezclado si es mixta; por ahora solo guests) */
  async ranking(sessionId: string): Promise<Array<{
    guestId: string;
    nickname: string;
    avatarEmoji: string | null;
    score: number;
    correctAnswers: number;
    totalAnswers: number;
    percent: number;
    rank: number;
  }>> {
    const guests = await this.prisma.liveSessionGuest.findMany({
      where: { sessionId },
      orderBy: [{ score: 'desc' }, { correctAnswers: 'desc' }, { joinedAt: 'asc' }],
      select: {
        id: true, nickname: true, avatarEmoji: true,
        score: true, correctAnswers: true, totalAnswers: true, percent: true,
      },
    });
    return guests.map((g, idx) => ({
      guestId: g.id,
      nickname: g.nickname,
      avatarEmoji: g.avatarEmoji,
      score: g.score,
      correctAnswers: g.correctAnswers,
      totalAnswers: g.totalAnswers,
      percent: g.percent ?? 0,
      rank: idx + 1,
    }));
  }
}
