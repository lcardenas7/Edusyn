import { evaluateQualitativePromotion, QualitativePromotionInput } from './qualitative-promotion.engine';

function complete(): QualitativePromotionInput {
  return { institutionId: 'i', academicYearId: 'y', gradeId: 'g', enrollmentId: 'e',
    policy: { institutionId: 'i', academicYearId: 'y', gradeId: 'g', revision: 2,
      mode: 'QUALITATIVE_CONTINUITY', valuationScope: 'PURPOSE', requireFinalReport: true, decisionMode: 'CONFIRMED' },
    periods: [1, 2, 3, 4].map(n => ({ id: `p${n}`, name: `P${n}`,
      dimensions: [{ id: 'd', name: 'Comunicativa', expectedIds: ['a'], valuedIds: ['a'] }] })),
    finalReportComplete: true,
    confirmation: { enrollmentId: 'e', policyRevision: 2, approvedById: 'rector', outcome: 'CONTINUE' } };
}

describe('qualitative continuity policy', () => {
  it('continues only after complete periods, report and confirmation', () => {
    expect(evaluateQualitativePromotion(complete()).status).toBe('CONTINUE');
  });
  it.each(['institutionId', 'academicYearId', 'gradeId'] as const)('rejects a policy for another %s', key => {
    const data = complete(); data.policy![key] = 'other';
    expect(evaluateQualitativePromotion(data).status).toBe('REVIEW_PENDING');
  });
  it('does not treat missing catalog as complete', () => {
    const data = complete(); data.periods[0].dimensions[0].expectedIds = [];
    expect(evaluateQualitativePromotion(data).status).toBe('REVIEW_PENDING');
  });
  it('does not count an unrelated valuation as the missing obligation', () => {
    const data = complete(); data.periods[2].dimensions[0].valuedIds = ['unrelated'];
    expect(evaluateQualitativePromotion(data).reasons).toContain('P3 · Comunicativa: faltan 1 valoraciones');
  });
  it('invalidates confirmation after policy revision changes', () => {
    const data = complete(); data.policy!.revision = 3;
    expect(evaluateQualitativePromotion(data).status).toBe('REVIEW_PENDING');
  });
  it('holds incomplete reports even with confirmation', () => {
    const data = complete(); data.finalReportComplete = false;
    expect(evaluateQualitativePromotion(data).status).toBe('REVIEW_PENDING');
  });
  it('supports institution-selected continuity on completion', () => {
    const data = complete(); data.policy!.decisionMode = 'ON_COMPLETION'; data.confirmation = undefined;
    expect(evaluateQualitativePromotion(data).status).toBe('CONTINUE');
  });
  it('never infers repetition from absent data', () => {
    const data = complete(); data.periods = [];
    expect(evaluateQualitativePromotion(data).status).toBe('REVIEW_PENDING');
  });
});
