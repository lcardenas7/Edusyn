import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface ConvertGradesDto {
  maxScore?: number;
  minScore?: number;
  passingScore?: number;
  method?: 'PROPORTIONAL';
}

/**
 * Convierte los resultados de una sesión (quiz o lección live) en notas
 * usando una escala configurable. No crea ActivitySubmission — solo genera
 * una planilla descargable para el docente.
 */
@Injectable()
export class ConversionService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertSessionOwner(sessionId: string, userId: string): Promise<{ kind: 'QUIZ' | 'LESSON'; title: string }> {
    const quiz = await this.prisma.liveSession.findUnique({
      where: { id: sessionId },
      select: { teacherId: true, activity: { select: { title: true } } },
    });
    if (quiz) {
      if (quiz.teacherId !== userId) throw new ForbiddenException('No eres el docente de esta sesión');
      return { kind: 'QUIZ', title: quiz.activity.title };
    }
    const lesson = await this.prisma.liveLessonSession.findUnique({
      where: { id: sessionId },
      select: { teacherId: true, lesson: { select: { title: true } } },
    });
    if (lesson) {
      if (lesson.teacherId !== userId) throw new ForbiddenException('No eres el docente de esta sesión');
      return { kind: 'LESSON', title: lesson.lesson.title };
    }
    throw new NotFoundException('Sesión no encontrada');
  }

  /** Calcula la planilla de notas según el % de aciertos de cada invitado. */
  async computeGrades(sessionId: string, userId: string, dto: ConvertGradesDto) {
    const info = await this.assertSessionOwner(sessionId, userId);
    const maxScore = dto.maxScore ?? 5;
    const minScore = dto.minScore ?? 1;
    const passingScore = dto.passingScore ?? 3;

    const guests = await this.prisma.liveSessionGuest.findMany({
      where: { sessionId },
      orderBy: [{ score: 'desc' }, { correctAnswers: 'desc' }],
      select: {
        id: true, nickname: true, avatarEmoji: true,
        score: true, correctAnswers: true, totalAnswers: true, percent: true,
      },
    });

    const rows = guests.map((g, idx) => {
      const pct = (g.percent ?? 0) / 100;
      const grade = Math.round((pct * (maxScore - minScore) + minScore) * 100) / 100;
      return {
        rank: idx + 1,
        nickname: g.nickname,
        avatarEmoji: g.avatarEmoji,
        correct: g.correctAnswers,
        total: g.totalAnswers,
        percent: Math.round((g.percent ?? 0) * 100) / 100,
        grade,
        passed: grade >= passingScore,
      };
    });

    return {
      session: { id: sessionId, kind: info.kind, title: info.title },
      config: { maxScore, minScore, passingScore, method: dto.method || 'PROPORTIONAL' },
      rows,
    };
  }

  /** Guarda el snapshot de la conversión en BD y devuelve resultado. */
  async saveConversion(sessionId: string, userId: string, dto: ConvertGradesDto) {
    const result = await this.computeGrades(sessionId, userId, dto);
    await this.prisma.guestGradeConversion.create({
      data: {
        sessionId,
        createdByUserId: userId,
        maxScore: result.config.maxScore,
        minScore: result.config.minScore,
        passingScore: result.config.passingScore,
        method: result.config.method,
        payload: result as any,
      },
    });
    return result;
  }

  /** Genera CSV para descarga. */
  async exportCsv(sessionId: string, userId: string): Promise<string> {
    const last = await this.prisma.guestGradeConversion.findFirst({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });
    const result = last
      ? (last.payload as any)
      : await this.computeGrades(sessionId, userId, {});

    const header = 'Puesto,Apodo,Aciertos,Total,% aciertos,Nota,Estado\n';
    const rows = (result.rows || []).map((r: any) =>
      [r.rank, `"${r.nickname.replace(/"/g, '""')}"`, r.correct, r.total, r.percent, r.grade, r.passed ? 'Aprobado' : 'Reprobado'].join(',')
    ).join('\n');

    return header + rows + '\n';
  }
}
