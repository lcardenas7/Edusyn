import { InstitutionContextService } from './institution-context.service';
import { RecoveryConfigService } from '../recovery/recovery-config.service';

describe('InstitutionContextService academic year', () => {
  const configs: Record<string, { periodMaxScore: number; maxAreasRecoverable: number }> = {
    'year-2025': { periodMaxScore: 3.1, maxAreasRecoverable: 1 },
    'year-2026': { periodMaxScore: 3.7, maxAreasRecoverable: 2 },
  };
  const prisma = {
    $queryRaw: jest.fn(),
    academicYear: { findFirst: jest.fn() },
    recoveryConfig: { findFirst: jest.fn(), upsert: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
  };
  let service: InstitutionContextService;

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$queryRaw.mockResolvedValue([{ gradingConfig: {}, academicLevelsConfig: [] }]);
    prisma.academicYear.findFirst.mockResolvedValue({ id: 'year-2026' });
    prisma.recoveryConfig.findFirst.mockImplementation(async ({ where }: any) =>
      where.institutionId === 'school-a' && where.academicYear.institutionId === 'school-a'
        ? configs[where.academicYearId] ?? null : null,
    );
    service = new InstitutionContextService(prisma as any);
  });

  it('uses separate cached rules for two years and scopes each to the institution', async () => {
    expect((await service.getContext('school-a', 'year-2025')).maxAreasRecoverable).toBe(1);
    expect((await service.getContext('school-a', 'year-2026')).maxAreasRecoverable).toBe(2);
    expect(prisma.recoveryConfig.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { institutionId: 'school-a', academicYearId: 'year-2025', academicYear: { institutionId: 'school-a' } },
    }));
    await service.getContext('school-a', 'year-2025');
    expect(prisma.recoveryConfig.findFirst).toHaveBeenCalledTimes(2);
  });

  it('selects the active year when none is supplied and never picks an arbitrary historical config', async () => {
    const result = await service.getContext('school-a');
    expect(result.recoveryMaxScore).toBe(3.7);
    expect(prisma.academicYear.findFirst).toHaveBeenCalledWith({
      where: { institutionId: 'school-a', status: 'ACTIVE' }, orderBy: { year: 'desc' }, select: { id: true },
    });
  });

  it('does not select a historical recovery configuration if no year is active', async () => {
    prisma.academicYear.findFirst.mockResolvedValue(null);
    const result = await service.getContext('school-a');
    expect(prisma.recoveryConfig.findFirst).not.toHaveBeenCalled();
    expect(result.recoveryMaxScore).toBe(result.minPassingGrade);
  });

  it('invalidates every cached year after recovery configuration is saved', async () => {
    await service.getContext('school-a', 'year-2025');
    await service.getContext('school-a', 'year-2026');
    prisma.recoveryConfig.upsert.mockResolvedValue({ id: 'saved' });
    const recoveryService = new RecoveryConfigService(prisma as any, service);
    await recoveryService.upsertConfig({ institutionId: 'school-a', academicYearId: 'year-2026', maxAreasRecoverable: 3 });
    await service.getContext('school-a', 'year-2025');
    await service.getContext('school-a', 'year-2026');
    expect(prisma.recoveryConfig.findFirst).toHaveBeenCalledTimes(4);
  });
});
