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
