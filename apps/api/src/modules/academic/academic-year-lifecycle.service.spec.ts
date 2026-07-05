import { AcademicYearLifecycleService } from './academic-year-lifecycle.service';

/**
 * P2 — getPassingGrade toma la nota mínima aprobatoria como el minScore más bajo
 * entre los niveles que APRUEBAN (isApproved, con defaults del enum), en vez de
 * asumir "BASICO". Así queda atado a la escala real (Q-1) y consistente.
 */
describe('AcademicYearLifecycleService.getPassingGrade (P2)', () => {
  function svc(scales: any[]) {
    const prisma = { performanceScale: { findMany: jest.fn().mockResolvedValue(scales) } };
    return new AcademicYearLifecycleService(prisma as any, {} as any, {} as any, {} as any);
  }

  it('devuelve el minScore más bajo entre niveles que aprueban', async () => {
    const s = svc([
      { level: 'SUPERIOR', minScore: 4.5, maxScore: 5, isApproved: true },
      { level: 'BASICO', minScore: 3, maxScore: 3.9, isApproved: true },
      { level: 'BAJO', minScore: 1, maxScore: 2.9, isApproved: false },
    ]);
    expect(await s.getPassingGrade('i1')).toBe(3);
  });

  it('usa defaults del enum cuando isApproved es null (BAJO no aprueba)', async () => {
    const s = svc([
      { level: 'BASICO', minScore: 3, maxScore: 3.9, isApproved: null },
      { level: 'BAJO', minScore: 1, maxScore: 2.9, isApproved: null },
    ]);
    expect(await s.getPassingGrade('i1')).toBe(3);
  });

  it('respeta un umbral aprobatorio distinto (ej. ALTO como mínimo aprobatorio)', async () => {
    const s = svc([
      { level: 'ALTO', minScore: 4, maxScore: 5, isApproved: true },
      { level: 'BASICO', minScore: 3, maxScore: 3.9, isApproved: false },
      { level: 'BAJO', minScore: 1, maxScore: 2.9, isApproved: false },
    ]);
    expect(await s.getPassingGrade('i1')).toBe(4);
  });

  it('sin escala configurada → default 3.0', async () => {
    const s = svc([]);
    expect(await s.getPassingGrade('i1')).toBe(3.0);
  });
});
