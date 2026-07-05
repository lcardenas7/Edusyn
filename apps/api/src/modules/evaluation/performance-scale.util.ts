import { PerformanceLevel } from '@prisma/client';

export interface ResolvedScaleLevel {
  level: PerformanceLevel;
  label: string;
  order: number;
  isApproved: boolean;
}

/**
 * Q-1: defaults derivados del enum cuando la escala no tiene los campos
 * enriquecidos configurados (label / order / isApproved en null).
 * Orden: SUPERIOR(4) > ALTO(3) > BASICO(2) > BAJO(1). BAJO no aprueba.
 */
const LEVEL_DEFAULTS: Record<PerformanceLevel, { label: string; order: number; isApproved: boolean }> = {
  SUPERIOR: { label: 'Superior', order: 4, isApproved: true },
  ALTO: { label: 'Alto', order: 3, isApproved: true },
  BASICO: { label: 'Básico', order: 2, isApproved: true },
  BAJO: { label: 'Bajo', order: 1, isApproved: false },
};

/**
 * Q-1: resuelve label/order/isApproved de un nivel de la escala. Usa los valores
 * configurados por la institución si existen; si son null, cae a los defaults del
 * enum. Fuente única de la semántica de un nivel de desempeño.
 */
export function resolveScaleLevel(scale: {
  level: PerformanceLevel;
  label?: string | null;
  order?: number | null;
  isApproved?: boolean | null;
}): ResolvedScaleLevel {
  const defaults = LEVEL_DEFAULTS[scale.level];
  return {
    level: scale.level,
    label: scale.label ?? defaults.label,
    order: scale.order ?? defaults.order,
    isApproved: scale.isApproved ?? defaults.isApproved,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSOLIDACIÓN — derivar la tabla PerformanceScale desde la config JSON
// ═══════════════════════════════════════════════════════════════════════════

const ENUM_LEVELS: PerformanceLevel[] = ['SUPERIOR', 'ALTO', 'BASICO', 'BAJO'];

export interface DerivedScaleRow {
  level: PerformanceLevel;
  minScore: number;
  maxScore: number;
  label: string | null;
  order: number | null;
  isApproved: boolean | null;
  descriptor: string | null;
}

/**
 * Escala por defecto (0–5 colombiano, Decreto 1290) cuando la institución no
 * tiene niveles configurados en ningún lado. Coincide con el seed demo.
 */
export const DEFAULT_PERFORMANCE_SCALE: DerivedScaleRow[] = [
  { level: 'SUPERIOR', minScore: 4.6, maxScore: 5.0, label: 'Superior', order: 4, isApproved: true, descriptor: null },
  { level: 'ALTO', minScore: 4.0, maxScore: 4.5, label: 'Alto', order: 3, isApproved: true, descriptor: null },
  { level: 'BASICO', minScore: 3.0, maxScore: 3.9, label: 'Básico', order: 2, isApproved: true, descriptor: null },
  { level: 'BAJO', minScore: 1.0, maxScore: 2.9, label: 'Bajo', order: 1, isApproved: false, descriptor: null },
];

/**
 * Valida que un conjunto de rangos de escala sea coherente: sin min>max, sin
 * solapes y sin huecos mayores a 0.1 (la adyacencia 2.9→3.0 es válida por el
 * redondeo a 1 decimal). Devuelve la lista de problemas (vacía = OK). No lanza.
 */
export function validateScaleRanges(
  rows: Array<{ level: PerformanceLevel; minScore: number; maxScore: number }>,
): string[] {
  const issues: string[] = [];
  for (const r of rows) {
    if (r.minScore > r.maxScore) {
      issues.push(`${r.level}: mínimo (${r.minScore}) mayor que máximo (${r.maxScore})`);
    }
  }
  const sorted = [...rows].sort((a, b) => a.minScore - b.minScore);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (cur.minScore <= prev.maxScore) {
      issues.push(
        `Solape entre ${prev.level} [${prev.minScore}-${prev.maxScore}] y ${cur.level} [${cur.minScore}-${cur.maxScore}]`,
      );
    } else if (cur.minScore - prev.maxScore > 0.1 + 1e-9) {
      issues.push(
        `Hueco entre ${prev.level} (máx ${prev.maxScore}) y ${cur.level} (mín ${cur.minScore})`,
      );
    }
  }
  return issues;
}

/** Mapea una lista de niveles de la config (gradingConfig o academicLevels) a filas de escala. */
function mapConfigLevels(levels: any): DerivedScaleRow[] {
  if (!Array.isArray(levels)) return [];
  const rows: DerivedScaleRow[] = [];
  for (const l of levels) {
    const code = String(l?.code ?? '').toUpperCase() as PerformanceLevel;
    if (!ENUM_LEVELS.includes(code)) continue;
    if (l?.minScore == null || l?.maxScore == null) continue;
    rows.push({
      level: code,
      minScore: Number(l.minScore),
      maxScore: Number(l.maxScore),
      label: l.name ?? null,
      order: typeof l.order === 'number' ? l.order : null,
      isApproved: typeof l.isApproved === 'boolean' ? l.isApproved : null,
      descriptor: l.description ?? l.descriptor ?? null,
    });
  }
  return rows;
}

/**
 * Deriva las filas de `PerformanceScale` (tabla que lee el boletín) a partir de la
 * configuración de la institución. Precedencia:
 *   1) gradingConfig.performanceLevels
 *   2) primer nivel numérico de academicLevelsConfig con performanceLevels
 *   3) escala por defecto 0–5
 * Así la tabla refleja lo que el admin YA configuró, sin sembrar valores a ciegas.
 */
export function deriveScaleFromConfig(
  gradingConfig: any,
  academicLevelsConfig: any,
): DerivedScaleRow[] {
  const fromGrading = mapConfigLevels(gradingConfig?.performanceLevels);
  if (fromGrading.length > 0) return fromGrading;

  if (Array.isArray(academicLevelsConfig)) {
    for (const lvl of academicLevelsConfig) {
      const fromLevel = mapConfigLevels(lvl?.performanceLevels);
      if (fromLevel.length > 0) return fromLevel;
    }
  }

  return DEFAULT_PERFORMANCE_SCALE.map((r) => ({ ...r }));
}
