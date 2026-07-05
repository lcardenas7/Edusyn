import { AcademicYearLifecycleService } from './academic-year-lifecycle.service';

/**
 * getPassingGrade — C-3 (Opción A): umbral aprobatorio POR NIVEL desde
 * academicLevelsConfig, con fallback al umbral global (PerformanceScale) y a 3.0.
 */
describe('AcademicYearLifecycleService.getPassingGrade (umbral por nivel)', () => {
  const levelsConfig = [
    { code: 'PRIMARIA', name: 'Primaria', grades: ['5A', '4A'], minPassingGrade: 3.5 },
    { code: 'BACHILLERATO', name: 'Bachillerato', grades: ['10A'], minPassingGrade: 3.0 },
  ];

  function makeService(opts: { levels?: any; scales?: any[] } = {}) {
    const prisma: any = {
      institution: { findUnique: jest.fn().mockResolvedValue({ academicLevelsConfig: opts.levels ?? null }) },
      performanceScale: { findMany: jest.fn().mockResolvedValue(opts.scales ?? []) },
    };
    return new AcademicYearLifecycleService(prisma, null as any, null as any, null as any);
  }

  it('usa el minPassingGrade del nivel que coincide por stage/name', async () => {
    const svc = makeService({ levels: levelsConfig });
    await expect(svc.getPassingGrade('inst1', { stage: 'PRIMARIA' })).resolves.toBe(3.5);
  });

  it('coincide por gradeName dentro de grades[]', async () => {
    const svc = makeService({ levels: levelsConfig });
    await expect(svc.getPassingGrade('inst1', { gradeName: '10A' })).resolves.toBe(3.0);
  });

  it('sin match de nivel → cae al umbral global (PerformanceScale)', async () => {
    const svc = makeService({ levels: levelsConfig, scales: [{ level: 'BASICO', minScore: 3.2, maxScore: 3.9 }] });
    await expect(svc.getPassingGrade('inst1', { stage: 'DESCONOCIDO' })).resolves.toBe(3.2);
  });

  it('sin nivel y sin escala → default 3.0', async () => {
    const svc = makeService({});
    await expect(svc.getPassingGrade('inst1')).resolves.toBe(3.0);
  });

  it('multinivel: primaria (3.5) y bachillerato (3.0) dan umbrales distintos', async () => {
    const svc = makeService({ levels: levelsConfig });
    const prim = await svc.getPassingGrade('inst1', { gradeName: '5A' });
    const bach = await svc.getPassingGrade('inst1', { gradeName: '10A' });
    expect(prim).toBe(3.5);
    expect(bach).toBe(3.0);
  });
});
