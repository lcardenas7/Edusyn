import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ApdAiService } from './apd-ai.service';

/**
 * Orquestador de IA (docs/DISENO_PEDAGOGICO_IA.md §21).
 * Decide qué modelo usar según el PLAN de la institución (free/premium), controla
 * la cuota mensual de tokens, mide el consumo y cachea respuestas idénticas.
 * La degradación es elegante: si premium no tiene key, cae al free con aviso.
 */

const PERIOD_DAYS = 30;
const FREE_DEFAULT_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';
const PREMIUM_DEFAULT_MODEL = 'gemini-2.0-flash';

export interface AiRoute { provider: string; model?: string; tier: string; degraded?: boolean }
export interface PlanView { tier: string; monthlyTokenQuota: number; tokensUsedThisMonth: number; modelOverride?: string | null }

interface CacheEntry { value: any; at: number }

@Injectable()
export class AiOrchestratorService {
  private readonly logger = new Logger(AiOrchestratorService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly cacheTtlMs = 60 * 60 * 1000; // 1h
  private readonly cacheMax = 500;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: ApdAiService,
  ) {}

  /** Plan de la institución; si no existe, FREE por defecto (sin crear fila). */
  async getPlan(institutionId: string): Promise<PlanView> {
    const p = await this.prisma.institutionAiPlan.findUnique({ where: { institutionId } });
    if (!p) return { tier: 'FREE', monthlyTokenQuota: 2_000_000, tokensUsedThisMonth: 0, modelOverride: null };
    return { tier: p.tier, monthlyTokenQuota: p.monthlyTokenQuota, tokensUsedThisMonth: p.tokensUsedThisMonth, modelOverride: p.modelOverride };
  }

  /** Elige el modelo según tier; degrada a free si premium no tiene key. */
  chooseRoute(plan: PlanView): AiRoute {
    if (plan.tier === 'PREMIUM' || plan.tier === 'BYOK') {
      if (this.ai.providerAvailable('GEMINI')) {
        return { provider: 'GEMINI', model: plan.modelOverride || PREMIUM_DEFAULT_MODEL, tier: plan.tier };
      }
      // Sin key premium configurada → degradar a free, pero avisar en logs.
      this.logger.warn(`Institución con plan ${plan.tier} pero sin key premium (GEMINI). Degradando a free.`);
      return { provider: 'OPENROUTER', model: FREE_DEFAULT_MODEL, tier: plan.tier, degraded: true };
    }
    return { provider: 'OPENROUTER', model: plan.modelOverride || FREE_DEFAULT_MODEL, tier: 'FREE' };
  }

  /** ¿La institución tiene cuota disponible este mes? */
  async withinQuota(institutionId: string): Promise<boolean> {
    const plan = await this.prisma.institutionAiPlan.findUnique({ where: { institutionId } });
    if (!plan) return true; // sin fila = free por defecto, sin bloqueo todavía
    if (this.periodExpired(plan.periodResetAt)) return true; // se reseteará al registrar
    return plan.tokensUsedThisMonth < plan.monthlyTokenQuota;
  }

  /** Registra consumo de tokens (crea el plan si no existe, resetea mensualmente). */
  async recordUsage(institutionId: string, tokens: number): Promise<void> {
    const now = new Date();
    const plan = await this.prisma.institutionAiPlan.findUnique({ where: { institutionId } });
    if (!plan) {
      await this.prisma.institutionAiPlan.create({
        data: { institutionId, tokensUsedThisMonth: Math.max(0, tokens), periodResetAt: now },
      });
      return;
    }
    const reset = this.periodExpired(plan.periodResetAt);
    await this.prisma.institutionAiPlan.update({
      where: { institutionId },
      data: reset
        ? { tokensUsedThisMonth: Math.max(0, tokens), periodResetAt: now }
        : { tokensUsedThisMonth: { increment: Math.max(0, tokens) } },
    });
  }

  private periodExpired(resetAt: Date): boolean {
    return Date.now() - new Date(resetAt).getTime() > PERIOD_DAYS * 86400000;
  }

  /** Estimación simple de tokens (≈ 4 chars/token) cuando el proveedor no la da. */
  estimateTokens(...texts: string[]): number {
    const chars = texts.reduce((a, t) => a + (t?.length || 0), 0);
    return Math.ceil(chars / 4);
  }

  // ── Caché en memoria (peticiones idénticas no vuelven a gastar IA) ──────────
  getCached(key: string): any | null {
    const e = this.cache.get(key);
    if (!e) return null;
    if (Date.now() - e.at > this.cacheTtlMs) { this.cache.delete(key); return null; }
    return e.value;
  }
  setCached(key: string, value: any): void {
    if (this.cache.size >= this.cacheMax) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(key, { value, at: Date.now() });
  }
}
