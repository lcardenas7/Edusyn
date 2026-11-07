import { QualitativeYearAssessmentService } from './qualitative-year-assessment.service';
import { createHash } from 'node:crypto';

describe('qualitative confirmation persistence', () => {
  const tx = { academicYear: { findFirst: jest.fn(), updateMany: jest.fn() } };
  const prisma: any = { $transaction: jest.fn((callback: any) => callback(tx)) };
  let service: QualitativeYearAssessmentService;
  const input = { reportText: 'Informe QA', reason: 'Revisión institucional QA', expectedFingerprint: 'reviewed' };
  beforeEach(() => {
    jest.clearAllMocks();
    service = new QualitativeYearAssessmentService(prisma, null as any);
    jest.spyOn(service, 'assess').mockResolvedValue({ status: 'CONTINUE', reasons: [], policyRevision: 2,
      academicYearId: 'y', evidenceFingerprint: 'reviewed', policyHistoryFingerprint: createHash('sha256').update('[]').digest('hex'), periods: [], reportText: '', confirmationCurrent: false, approvedAt: null });
    tx.academicYear.findFirst.mockResolvedValue({ id: 'y', status: 'ACTIVE', qualitativePromotionPolicies: [], qualitativePromotionDecisions: [] });
    tx.academicYear.updateMany.mockResolvedValue({ count: 1 });
  });
  it('records server actor, report, reviewed evidence and reason', async () => {
    const record = await service.confirm('e', 'i', 'rector', input);
    expect(record).toMatchObject({ enrollmentId: 'e', institutionId: 'i', approvedById: 'rector',
      reportText: 'Informe QA', policyRevision: 2, evidenceFingerprint: 'reviewed' });
    expect(tx.academicYear.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ institutionId: 'i', status: 'ACTIVE', qualitativePromotionDecisions: { equals: [] } }),
      data: { qualitativePromotionDecisions: [record] },
    }));
  });
  it('rejects a changed assessment before writing', async () => {
    await expect(service.confirm('e', 'i', 'rector', { ...input, expectedFingerprint: 'old' })).rejects.toThrow('cambió');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('rejects unmet requirements even when the evidence matches', async () => {
    jest.spyOn(service, 'assess').mockResolvedValue({ status: 'REVIEW_PENDING', reasons: ['Falta P3'], policyRevision: 2,
      academicYearId: 'y', evidenceFingerprint: 'reviewed', policyHistoryFingerprint: createHash('sha256').update('[]').digest('hex'), periods: [], reportText: '', confirmationCurrent: false, approvedAt: null });
    await expect(service.confirm('e', 'i', 'rector', input)).rejects.toThrow('pendientes');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('rejects a year closed during review', async () => {
    tx.academicYear.findFirst.mockResolvedValue({ id: 'y', status: 'CLOSED' });
    await expect(service.confirm('e', 'i', 'rector', input)).rejects.toThrow('año activo');
    expect(tx.academicYear.updateMany).not.toHaveBeenCalled();
  });
  it('rejects a concurrent year or decision update', async () => {
    tx.academicYear.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.confirm('e', 'i', 'rector', input)).rejects.toThrow('cambió');
  });
  it('rejects malformed reasons without invoking assessment', async () => {
    await expect(service.confirm('e', 'i', 'rector', { ...input, reason: 123 } as any)).rejects.toThrow('Indica informe');
    expect(service.assess).not.toHaveBeenCalled();
  });
  it('rejects policy changes between assessment and the write transaction', async () => {
    tx.academicYear.findFirst.mockResolvedValue({ id: 'y', status: 'ACTIVE',
      qualitativePromotionPolicies: [{ revision: 3 }], qualitativePromotionDecisions: [] });
    await expect(service.confirm('e', 'i', 'rector', input)).rejects.toThrow('política cambió');
    expect(tx.academicYear.updateMany).not.toHaveBeenCalled();
  });
});
