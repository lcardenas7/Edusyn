import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { XpSource, Prisma } from '@prisma/client';
import { BADGE_CATALOG, BadgeStats } from './badge-catalog';

export interface GrantXpParams {
  institutionId: string;
  studentId: string;
  studentEnrollmentId?: string;
  source: XpSource;
  amount: number;
  skill?: string | null;
  reason?: string;
  /** Clave única para no conceder dos veces el mismo hecho (idempotencia). */
  idempotencyKey: string;
}

export interface EarnedBadge {
  code: string;
  name: string;
  description: string;
  emoji: string;
  tier: string;
}

export interface GrantXpResult {
  granted: boolean; // false si ya se había concedido (idempotente) o amount<=0
  awarded: number; // XP realmente concedido en esta llamada
  leveledUp: boolean;
  identity: {
    totalXp: number;
    level: number;
    currentStreak: number;
    longestStreak: number;
  } | null;
  newBadges: EarnedBadge[]; // insignias recién ganadas en esta concesión
}

@Injectable()
export class LearningIdentityService {
  private readonly logger = new Logger(LearningIdentityService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Curva de nivel (XP por dominio) ───────────────────────────────────────
  // Cuadrática y estable: para alcanzar el nivel L se necesitan 50*(L-1)^2 XP.
  //   L2=50, L3=200, L4=450, L5=800 …  → progresión que se siente pero no infla.
  static levelForXp(totalXp: number): number {
    if (totalXp <= 0) return 1;
    return Math.floor(Math.sqrt(totalXp / 50)) + 1;
  }
  static xpForLevel(level: number): number {
    return 50 * Math.pow(Math.max(level - 1, 0), 2);
  }

  private startOfDay(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  /** Recalcula la racha diaria a partir de la última actividad registrada. */
  private computeStreak(
    prev: { currentStreak: number; longestStreak: number; lastActivityDate: Date | null },
    now: Date,
  ): { currentStreak: number; longestStreak: number; lastActivityDate: Date } {
    const today = this.startOfDay(now);
    const last = prev.lastActivityDate ? this.startOfDay(prev.lastActivityDate) : null;
    let currentStreak: number;
    if (!last) {
      currentStreak = 1;
    } else {
      const diffDays = Math.round((today.getTime() - last.getTime()) / 86400000);
      if (diffDays <= 0) currentStreak = Math.max(prev.currentStreak, 1); // mismo día
      else if (diffDays === 1) currentStreak = prev.currentStreak + 1; // día consecutivo
      else currentStreak = 1; // se rompió la racha
    }
    const longestStreak = Math.max(prev.longestStreak, currentStreak);
    return { currentStreak, longestStreak, lastActivityDate: today };
  }

  private addSkillXp(current: Prisma.JsonValue | null | undefined, skill: string | null | undefined, amount: number): Prisma.InputJsonValue {
    const obj: Record<string, number> = (current && typeof current === 'object' && !Array.isArray(current))
      ? { ...(current as Record<string, number>) }
      : {};
    if (skill) obj[skill] = (obj[skill] || 0) + amount;
    return obj;
  }

  /**
   * Concede XP a un estudiante de forma idempotente. XP por DOMINIO: quien llama
   * solo debe invocar esto cuando el estudiante DEMOSTRÓ algo (acertó, completó),
   * nunca por avanzar. Nunca lanza: ante error devuelve granted:false (la
   * gamificación jamás debe romper el flujo académico).
   */
  async grantXp(params: GrantXpParams): Promise<GrantXpResult> {
    const { institutionId, studentId, source, amount, idempotencyKey } = params;
    if (!institutionId || !studentId || amount <= 0) {
      return { granted: false, awarded: 0, leveledUp: false, identity: null, newBadges: [] };
    }
    try {
      const tx = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.xpEvent.findUnique({ where: { idempotencyKey }, select: { id: true } });
        const current = await tx.learningIdentity.findUnique({ where: { studentId } });
        if (existing) {
          return {
            granted: false, identityId: current?.id ?? null, awarded: 0, leveledUp: false,
            identity: current && { totalXp: current.totalXp, level: current.level, currentStreak: current.currentStreak, longestStreak: current.longestStreak },
          };
        }

        const base = current ?? await tx.learningIdentity.create({ data: { institutionId, studentId } });
        const streak = this.computeStreak(base, new Date());
        const totalXp = base.totalXp + amount;
        const level = LearningIdentityService.levelForXp(totalXp);
        const leveledUp = level > base.level;
        const skillXp = this.addSkillXp(base.skillXp, params.skill, amount);

        const updated = await tx.learningIdentity.update({
          where: { id: base.id },
          data: {
            totalXp, level, skillXp,
            currentStreak: streak.currentStreak,
            longestStreak: streak.longestStreak,
            lastActivityDate: streak.lastActivityDate,
          },
        });
        await tx.xpEvent.create({
          data: {
            institutionId, identityId: updated.id, studentId,
            studentEnrollmentId: params.studentEnrollmentId,
            source, skill: params.skill ?? null, amount, reason: params.reason, idempotencyKey,
          },
        });
        return {
          granted: true, identityId: updated.id, awarded: amount, leveledUp,
          identity: { totalXp: updated.totalXp, level: updated.level, currentStreak: updated.currentStreak, longestStreak: updated.longestStreak },
        };
      });

      // Evaluar insignias fuera de la transacción de XP (solo si se concedió algo).
      let newBadges: EarnedBadge[] = [];
      if (tx.granted && tx.identityId) {
        newBadges = await this.evaluateAndAwardBadges(tx.identityId, studentId, institutionId);
      }
      return { granted: tx.granted, awarded: tx.awarded, leveledUp: tx.leveledUp, identity: tx.identity ?? null, newBadges };
    } catch (err: any) {
      // Carrera en idempotencyKey (unique) u otro error: nunca romper el flujo.
      this.logger.warn(`grantXp no concedió (${idempotencyKey}): ${err?.message || err}`);
      const identity = await this.prisma.learningIdentity.findUnique({ where: { studentId } }).catch(() => null);
      return {
        granted: false, awarded: 0, leveledUp: false, newBadges: [],
        identity: identity && { totalXp: identity.totalXp, level: identity.level, currentStreak: identity.currentStreak, longestStreak: identity.longestStreak },
      };
    }
  }

  /** Cuenta hitos del ledger y otorga las insignias recién cumplidas (idempotente). */
  private async evaluateAndAwardBadges(identityId: string, studentId: string, institutionId: string): Promise<EarnedBadge[]> {
    try {
      const identity = await this.prisma.learningIdentity.findUnique({
        where: { id: identityId },
        select: { totalXp: true, level: true, currentStreak: true, longestStreak: true },
      });
      if (!identity) return [];

      const [lessonsCompleted, quizzesGraded, awarded] = await Promise.all([
        this.prisma.xpEvent.count({ where: { identityId, source: 'LESSON_COMPLETE' } }),
        this.prisma.xpEvent.count({ where: { identityId, source: 'QUIZ_GRADED' } }),
        this.prisma.learningBadgeAward.findMany({ where: { studentId }, select: { badgeCode: true } }),
      ]);

      const stats: BadgeStats = {
        totalXp: identity.totalXp, level: identity.level,
        currentStreak: identity.currentStreak, longestStreak: identity.longestStreak,
        lessonsCompleted, quizzesGraded,
      };
      const alreadyHave = new Set(awarded.map(a => a.badgeCode));
      const toAward = BADGE_CATALOG.filter(b => b.earned(stats) && !alreadyHave.has(b.code));
      if (!toAward.length) return [];

      await this.prisma.learningBadgeAward.createMany({
        data: toAward.map(b => ({ institutionId, identityId, studentId, badgeCode: b.code })),
        skipDuplicates: true, // idempotente ante carreras
      });
      return toAward.map(b => ({ code: b.code, name: b.name, description: b.description, emoji: b.emoji, tier: b.tier }));
    } catch (err: any) {
      this.logger.warn(`evaluateAndAwardBadges falló (no crítico): ${err?.message || err}`);
      return [];
    }
  }

  /** Catálogo completo con estado ganado/bloqueado para el estudiante (progreso privado). */
  async getBadges(studentId: string) {
    const identity = await this.prisma.learningIdentity.findUnique({ where: { studentId }, select: { id: true } });
    const awarded = identity
      ? await this.prisma.learningBadgeAward.findMany({ where: { studentId }, select: { badgeCode: true, earnedAt: true } })
      : [];
    const earnedAtByCode = new Map(awarded.map(a => [a.badgeCode, a.earnedAt]));
    const badges = BADGE_CATALOG.map(b => ({
      code: b.code, name: b.name, description: b.description, emoji: b.emoji, tier: b.tier,
      earned: earnedAtByCode.has(b.code),
      earnedAt: earnedAtByCode.get(b.code) ?? null,
    }));
    return { total: BADGE_CATALOG.length, earned: awarded.length, badges };
  }

  /** Identidad + umbrales de nivel para pintar la barra de progreso. */
  async getByStudent(studentId: string) {
    const identity = await this.prisma.learningIdentity.findUnique({ where: { studentId } });
    const totalXp = identity?.totalXp ?? 0;
    const level = identity?.level ?? 1;
    return {
      totalXp,
      level,
      currentStreak: identity?.currentStreak ?? 0,
      longestStreak: identity?.longestStreak ?? 0,
      skillXp: (identity?.skillXp as Record<string, number> | null) ?? {},
      levelFloorXp: LearningIdentityService.xpForLevel(level),
      levelCeilXp: LearningIdentityService.xpForLevel(level + 1),
      lastActivityDate: identity?.lastActivityDate ?? null,
    };
  }
}
