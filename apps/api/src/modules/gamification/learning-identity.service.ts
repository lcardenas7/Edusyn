import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { XpSource, Prisma } from '@prisma/client';

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
      return { granted: false, awarded: 0, leveledUp: false, identity: null };
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.xpEvent.findUnique({ where: { idempotencyKey }, select: { id: true } });
        const current = await tx.learningIdentity.findUnique({ where: { studentId } });
        if (existing) {
          return {
            granted: false, awarded: 0, leveledUp: false,
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
          granted: true, awarded: amount, leveledUp,
          identity: { totalXp: updated.totalXp, level: updated.level, currentStreak: updated.currentStreak, longestStreak: updated.longestStreak },
        };
      });
    } catch (err: any) {
      // Carrera en idempotencyKey (unique) u otro error: nunca romper el flujo.
      this.logger.warn(`grantXp no concedió (${idempotencyKey}): ${err?.message || err}`);
      const identity = await this.prisma.learningIdentity.findUnique({ where: { studentId } }).catch(() => null);
      return {
        granted: false, awarded: 0, leveledUp: false,
        identity: identity && { totalXp: identity.totalXp, level: identity.level, currentStreak: identity.currentStreak, longestStreak: identity.longestStreak },
      };
    }
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
