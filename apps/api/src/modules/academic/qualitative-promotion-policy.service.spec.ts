import { QualitativePromotionPolicyService } from './qualitative-promotion-policy.service';

describe('annual qualitative policy history', () => {
  const tx = { academicYear: { findFirst: jest.fn(), updateMany: jest.fn() }, grade: { findFirst: jest.fn() } };
  const prisma = { ...tx, $transaction: jest.fn((callback: any) => callback(tx)) };
  const service = new QualitativePromotionPolicyService(prisma as any);
  const input = { valuationScope: 'PURPOSE' as const, requireFinalReport: true,
    decisionMode: 'CONFIRMED' as const, expectedRevision: 0, reason: 'Configuración QA' };
  beforeEach(() => {
    jest.clearAllMocks();
    tx.academicYear.findFirst.mockResolvedValue({ status: 'ACTIVE', qualitativePromotionPolicies: [] });
    tx.grade.findFirst.mockResolvedValue({ academicStructure: 'DIMENSIONS' });
    tx.academicYear.updateMany.mockResolvedValue({ count: 1 });
  });
  it('stores server actor and scope, retaining previous revisions', async () => {
    const old = { gradeId: 'g', revision: 1, reason: 'Anterior' };
    tx.academicYear.findFirst.mockResolvedValue({ status: 'ACTIVE', qualitativePromotionPolicies: [old] });
    const result = await service.revise('i', 'y', 'g', 'actor', { ...input, expectedRevision: 1 });
    expect(result).toMatchObject({ institutionId: 'i', academicYearId: 'y', revision: 2, approvedById: 'actor' });
    expect(tx.academicYear.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ institutionId: 'i', qualitativePromotionPolicies: { equals: [old] } }),
      data: { qualitativePromotionPolicies: [old, result] },
    }));
  });
  it('rejects a foreign year without writing', async () => {
    tx.academicYear.findFirst.mockResolvedValue(null);
    await expect(service.revise('i', 'foreign', 'g', 'actor', input)).rejects.toThrow('Año lectivo no encontrado');
    expect(tx.academicYear.updateMany).not.toHaveBeenCalled();
  });
  it('preserves closed-year policy', async () => {
    tx.academicYear.findFirst.mockResolvedValue({ status: 'CLOSED', qualitativePromotionPolicies: [] });
    await expect(service.revise('i', 'y', 'g', 'actor', input)).rejects.toThrow('año cerrado');
    expect(tx.academicYear.updateMany).not.toHaveBeenCalled();
  });
  it('rejects stale form revisions', async () => {
    await expect(service.revise('i', 'y', 'g', 'actor', { ...input, expectedRevision: 2 })).rejects.toThrow('Recarga');
  });
  it('rejects a concurrent close or update', async () => {
    tx.academicYear.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.revise('i', 'y', 'g', 'actor', input)).rejects.toThrow('cambiaron');
  });
  it('rejects numeric grades and incomplete configuration', async () => {
    tx.grade.findFirst.mockResolvedValue({ academicStructure: 'AREAS_SUBJECTS' });
    await expect(service.revise('i', 'y', 'g', 'actor', input)).rejects.toThrow('dimensiones');
    await expect(service.revise('i', 'y', 'g', 'actor', { ...input, reason: '' })).rejects.toThrow('incompleta');
  });
});
