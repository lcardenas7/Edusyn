/** Domain contract. Policy and decision must be loaded in the tenant/year scope by the caller. */
export interface QualitativePromotionPolicy {
  institutionId: string;
  academicYearId: string;
  gradeId: string;
  revision: number;
  mode: 'QUALITATIVE_CONTINUITY';
  valuationScope: 'PURPOSE' | 'EVIDENCE';
  requireFinalReport: boolean;
  decisionMode: 'CONFIRMED' | 'ON_COMPLETION';
}

export interface QualitativePromotionInput {
  institutionId: string;
  academicYearId: string;
  gradeId: string;
  enrollmentId: string;
  policy: QualitativePromotionPolicy | null;
  // The shared completeness service resolves applicable catalog and evidence retirement.
  periods: Array<{ id: string; name: string; dimensions: Array<{
    id: string; name: string; expectedIds: string[]; valuedIds: string[];
  }> }>;
  finalReportComplete: boolean;
  confirmation?: { enrollmentId: string; policyRevision: number; approvedById: string; outcome: 'CONTINUE' | 'REVIEW' };
}

export function evaluateQualitativePromotion(input: QualitativePromotionInput) {
  const reasons: string[] = [];
  const policy = input.policy;
  if (!policy || policy.institutionId !== input.institutionId || policy.academicYearId !== input.academicYearId
    || policy.gradeId !== input.gradeId || !Number.isInteger(policy.revision) || policy.revision < 1
    || policy.mode !== 'QUALITATIVE_CONTINUITY' || !['PURPOSE', 'EVIDENCE'].includes(policy.valuationScope)
    || typeof policy.requireFinalReport !== 'boolean'
    || !['CONFIRMED', 'ON_COMPLETION'].includes(policy.decisionMode)) {
    return { status: 'REVIEW_PENDING' as const, policyRevision: null, reasons: ['Falta una política cualitativa válida para el grado y año'] };
  }
  if (!input.periods.length) reasons.push('No hay períodos académicos para evaluar');
  for (const period of input.periods) {
    if (!period.dimensions.length) reasons.push(`${period.name}: no hay dimensiones configuradas`);
    for (const dimension of period.dimensions) {
      const expected = new Set(dimension.expectedIds);
      const valued = new Set(dimension.valuedIds);
      if (!expected.size) reasons.push(`${period.name} · ${dimension.name}: no hay obligaciones configuradas`);
      const missing = [...expected].filter(id => !valued.has(id));
      if (missing.length) reasons.push(`${period.name} · ${dimension.name}: faltan ${missing.length} valoraciones`);
    }
  }
  if (policy.requireFinalReport && !input.finalReportComplete) reasons.push('Falta el informe descriptivo final');
  if (policy.decisionMode === 'CONFIRMED') {
    const confirmation = input.confirmation;
    if (!confirmation || confirmation.enrollmentId !== input.enrollmentId || confirmation.policyRevision !== policy.revision
      || !confirmation.approvedById || confirmation.outcome !== 'CONTINUE') {
      reasons.push('Falta confirmar la continuidad con la versión vigente de la política');
    }
  }
  return { status: reasons.length ? 'REVIEW_PENDING' as const : 'CONTINUE' as const,
    policyRevision: policy.revision, reasons };
}
