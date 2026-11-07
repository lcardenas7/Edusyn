import { QualitativeYearAssessmentService } from './qualitative-year-assessment.service';

describe('annual qualitative assessment with real coverage', () => {
  const terms = [1, 2, 3, 4].map(n => ({ id: `p${n}`, name: `P${n}`, order: n }));
  const policy = { institutionId: 'i', academicYearId: 'y', gradeId: 'grade', revision: 1,
    mode: 'QUALITATIVE_CONTINUITY', valuationScope: 'PURPOSE', requireFinalReport: false, decisionMode: 'ON_COMPLETION' };
  const prisma: any = {
    studentEnrollment: { findFirst: jest.fn() }, academicYear: { findFirst: jest.fn() },
    teacherAssignment: { findMany: jest.fn() }, achievementConfig: { findUnique: jest.fn() },
    achievement: { findMany: jest.fn() }, studentAchievement: { findMany: jest.fn() },
  };
  const templates: any = { getEffectiveStructureForGroupInScope: jest.fn() };
  const service = new QualitativeYearAssessmentService(prisma, templates);
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.studentEnrollment.findFirst.mockResolvedValue({ status: 'ACTIVE', academicYearId: 'y', groupId: 'g', group: { gradeId: 'grade', grade: { academicStructure: 'DIMENSIONS' } } });
    prisma.academicYear.findFirst.mockResolvedValue({ id: 'y', terms, qualitativePromotionPolicies: [policy] });
    prisma.teacherAssignment.findMany.mockResolvedValue([]);
    prisma.achievementConfig.findUnique.mockResolvedValue({ valuationScope: 'EVIDENCE' });
    prisma.achievement.findMany.mockResolvedValue([{ id: 'a', gradeId: 'grade', subjectId: 'd', academicTermId: null, evidences: [] }]);
    prisma.studentAchievement.findMany.mockResolvedValue(terms.map(t => ({ studentEnrollmentId: 'e', academicTermId: t.id, achievementId: 'a' })));
    templates.getEffectiveStructureForGroupInScope.mockResolvedValue({ areas: [{ templateSubjects: [
      { subjectId: 'd', subject: { subjectType: 'PRESCHOOL_DIMENSION', name: 'Comunicativa' } },
    ] }] });
  });
  it('uses the annual policy scope and four real coverage cells without numerical grades', async () => {
    expect((await service.assess('e', 'i')).status).toBe('CONTINUE');
    expect(templates.getEffectiveStructureForGroupInScope).toHaveBeenCalledWith('g', 'y', 'i');
  });
  it('holds a missing period valuation', async () => {
    prisma.studentAchievement.findMany.mockResolvedValue([{ studentEnrollmentId: 'e', academicTermId: 'p1', achievementId: 'a' }]);
    expect((await service.assess('e', 'i')).reasons).toContain('P2 · Comunicativa: faltan 1 valoraciones');
  });
  it('does not infer a policy for an unconfigured year', async () => {
    prisma.academicYear.findFirst.mockResolvedValue({ id: 'y', terms, qualitativePromotionPolicies: [] });
    expect((await service.assess('e', 'i')).status).toBe('REVIEW_PENDING');
    expect(templates.getEffectiveStructureForGroupInScope).not.toHaveBeenCalled();
  });
  it('does not approve an empty plan', async () => {
    templates.getEffectiveStructureForGroupInScope.mockResolvedValue({ areas: [] });
    expect((await service.assess('e', 'i')).reasons).toContain('P1: no hay dimensiones configuradas');
  });
  it('rejects confirmation for an inactive enrollment', async () => {
    prisma.studentEnrollment.findFirst.mockResolvedValue({ status: 'WITHDRAWN' });
    await expect(service.assess('e', 'i', { reportText: 'QA', approvedById: 'rector' })).rejects.toThrow('matrícula activa');
  });
  it('does not use the qualitative route for a quantitative grade', async () => {
    prisma.studentEnrollment.findFirst.mockResolvedValue({ status: 'ACTIVE', group: { grade: { academicStructure: 'SUBJECTS' } } });
    await expect(service.assess('e', 'i')).rejects.toThrow('grado cualitativo');
  });
  it('does not pretend that a required report or confirmation exists', async () => {
    prisma.academicYear.findFirst.mockResolvedValue({ id: 'y', terms, qualitativePromotionPolicies: [
      { ...policy, requireFinalReport: true, decisionMode: 'CONFIRMED' },
    ] });
    const result = await service.assess('e', 'i');
    expect(result.status).toBe('REVIEW_PENDING');
    expect(result.reasons).toContain('Falta el informe descriptivo final');
  });
  it('accepts a recorded report and confirmation only for the same evidence fingerprint', async () => {
    const confirmedPolicy = { ...policy, requireFinalReport: true, decisionMode: 'CONFIRMED' };
    const year = { id: 'y', terms, qualitativePromotionPolicies: [confirmedPolicy], qualitativePromotionDecisions: [] as any[] };
    prisma.academicYear.findFirst.mockResolvedValue(year);
    const reviewed = await service.assess('e', 'i', { reportText: 'Informe descriptivo QA', approvedById: 'rector' });
    year.qualitativePromotionDecisions.push({ enrollmentId: 'e', evidenceFingerprint: reviewed.evidenceFingerprint,
      institutionId: 'i', academicYearId: 'y', outcome: 'CONTINUE',
      policyRevision: 1, reportText: 'Informe descriptivo QA', approvedById: 'rector' });
    expect((await service.assess('e', 'i')).status).toBe('CONTINUE');
    prisma.studentAchievement.findMany.mockResolvedValue(terms.map(t => ({ studentEnrollmentId: 'e', academicTermId: t.id,
      achievementId: 'a', performanceLevel: 'EP', updatedAt: new Date('2026-11-06') })));
    expect((await service.assess('e', 'i')).status).toBe('REVIEW_PENDING');
  });
});
