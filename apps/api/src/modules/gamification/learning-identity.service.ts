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
      // SIN transacción interactiva. Una $transaction que expira o aborta puede devolver
      // su conexión al pool en estado "current transaction is aborted" (25P02) y hacer
      // fallar con 500 la siguiente query de CUALQUIER request (así "se borraba" el texto
      // del canvas ABP). La gamificación no amerita ese riesgo: cada paso de abajo es
      // autocommit y atómico o idempotente por sí mismo.

      // 1) Identidad (idempotente): upsert; si aun así hay carrera, releer.
      let base = await this.prisma.learningIdentity.upsert({
        where: { studentId },
        create: { institutionId, studentId },
        update: {},
      }).catch(() => null);
      if (!base) base = await this.prisma.learningIdentity.findUnique({ where: { studentId } });
      if (!base) return { granted: false, awarded: 0, leveledUp: false, identity: null, newBadges: [] };

      // 2) Reclamar la idempotencyKey: createMany + skipDuplicates es un INSERT atómico
      //    que no lanza por duplicado; count=0 → el XP ya se concedió antes.
      const claim = await this.prisma.xpEvent.createMany({
        data: [{
          institutionId, identityId: base.id, studentId,
          studentEnrollmentId: params.studentEnrollmentId,
          source, skill: params.skill ?? null, amount, reason: params.reason, idempotencyKey,
        }],
        skipDuplicates: true,
      });
      if (claim.count === 0) {
        return {
          granted: false, awarded: 0, leveledUp: false, newBadges: [],
          identity: { totalXp: base.totalXp, level: base.level, currentStreak: base.currentStreak, longestStreak: base.longestStreak },
        };
      }

      // 3) Sumar XP de forma atómica en SQL (increment: sin lost-update entre keys
      //    distintas del mismo estudiante) y releer el total real.
      await this.prisma.learningIdentity.update({
        where: { id: base.id },
        data: { totalXp: { increment: amount } },
      });
      const fresh = await this.prisma.learningIdentity.findUnique({ where: { id: base.id } });
      const totalXp = fresh?.totalXp ?? base.totalXp + amount;

      // 4) Derivados (nivel, racha, skill): se calculan del total releído. skillXp es un
      //    read-modify-write con carrera teórica mínima — aceptable en gamificación.
      const streak = this.computeStreak(fresh ?? base, new Date());
      const level = LearningIdentityService.levelForXp(totalXp);
      const leveledUp = level > base.level;
      const skillXp = this.addSkillXp((fresh ?? base).skillXp, params.skill, amount);
      const updated = await this.prisma.learningIdentity.update({
        where: { id: base.id },
        data: {
          level, skillXp,
          currentStreak: streak.currentStreak,
          longestStreak: streak.longestStreak,
          lastActivityDate: streak.lastActivityDate,
        },
      });

      const newBadges = await this.evaluateAndAwardBadges(base.id, studentId, institutionId);
      return {
        granted: true, awarded: amount, leveledUp, newBadges,
        identity: { totalXp: updated.totalXp, level: updated.level, currentStreak: updated.currentStreak, longestStreak: updated.longestStreak },
      };
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

  /**
   * Revierte el XP de una lección para un estudiante y reevalúa sus insignias.
   * Se usa cuando el docente BORRA el intento de la lección: elimina los XpEvents de
   * esa lección (`lesson:<lessonId>:…`), ajusta totalXp/level/skillXp y revoca las
   * insignias que ya no correspondan. Nota: aunque las insignias son "permanentes" en
   * el flujo normal, un borrado administrativo del intento sí las revierte para dejar
   * el estado consistente. Nunca lanza (la gamificación no rompe el flujo académico).
   */
  async revokeLessonRewards(studentEnrollmentId: string, lessonId: string): Promise<void> {
    try {
      const events = await this.prisma.xpEvent.findMany({
        where: { studentEnrollmentId, idempotencyKey: { startsWith: `lesson:${lessonId}:` } },
        select: { id: true, amount: true, skill: true, identityId: true, studentId: true },
      });
      if (!events.length) return;
      const identityId = events[0].identityId;
      const studentId = events[0].studentId;

      await this.prisma.$transaction(async (tx) => {
        const identity = await tx.learningIdentity.findUnique({ where: { id: identityId } });
        if (!identity) return;
        let total = 0;
        let skillXp: any = identity.skillXp;
        for (const e of events) {
          total += e.amount;
          if (e.skill) skillXp = this.addSkillXp(skillXp, e.skill, -e.amount);
        }
        const newTotalXp = Math.max(0, identity.totalXp - total);
        await tx.learningIdentity.update({
          where: { id: identityId },
          data: { totalXp: newTotalXp, level: LearningIdentityService.levelForXp(newTotalXp), skillXp },
        });
        await tx.xpEvent.deleteMany({ where: { id: { in: events.map(e => e.id) } } });
      });

      await this.revokeBadgesNoLongerEarned(identityId, studentId);
    } catch (err: any) {
      this.logger.warn(`revokeLessonRewards falló (no crítico): ${err?.message || err}`);
    }
  }

  /** Tras revertir XP, revoca las insignias del estudiante que ya no cumple. */
  private async revokeBadgesNoLongerEarned(identityId: string, studentId: string): Promise<void> {
    const identity = await this.prisma.learningIdentity.findUnique({
      where: { id: identityId },
      select: { totalXp: true, level: true, currentStreak: true, longestStreak: true },
    });
    if (!identity) return;
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
    const toRevoke = awarded
      .map(a => a.badgeCode)
      .filter(code => { const def = BADGE_CATALOG.find(b => b.code === code); return def ? !def.earned(stats) : false; });
    if (toRevoke.length) {
      await this.prisma.learningBadgeAward.deleteMany({ where: { studentId, badgeCode: { in: toRevoke } } });
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
