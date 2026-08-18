/**
 * Regla canónica de vigencia de evidencias/imprescindibles (D-12).
 *
 * Vive aparte porque la consumen dos servicios —`AchievementService` (planilla y
 * captura) y `ReportsService` (boletín)— y una regla académica duplicada en dos
 * sitios es exactamente el patrón de doble fuente de verdad que este rediseño
 * está eliminando.
 *
 * REGLA
 *   Una evidencia retirada desde el período `T` sigue vigente en todo período `P`
 *   del mismo año académico con `P.order < T.order`, y deja de serlo desde `T`.
 *
 * NO se usan `AcademicTerm.startDate` / `endDate`: el 41 % de los períodos en
 * producción no las tiene. NO se usa la existencia de valoraciones: sería un proxy
 * inestable. `retiredAt` es sólo trazabilidad y nunca participa aquí.
 *
 * FAIL-OPEN deliberado: ante un dato inconsistente (período desconocido) la
 * evidencia se conserva. En un boletín, ocultar información es peor que mostrarla.
 */

export interface RetirableEvidence {
  retiredFromTermId: string | null;
}

export function isEvidenceVigente(
  evidence: RetirableEvidence,
  currentTermOrder: number | null | undefined,
  retirementTermOrderById: Map<string, number>,
): boolean {
  if (!evidence.retiredFromTermId) return true; // activa
  if (currentTermOrder === null || currentTermOrder === undefined) return true; // fail-open
  const retiredOrder = retirementTermOrderById.get(evidence.retiredFromTermId);
  if (retiredOrder === undefined) return true; // fail-open
  return currentTermOrder < retiredOrder;
}

/** Ids de período de retiro presentes en una lista de evidencias (sin repetir). */
export function collectRetirementTermIds(evidences: RetirableEvidence[]): string[] {
  return [...new Set(evidences.map((e) => e.retiredFromTermId).filter((id): id is string => !!id))];
}
