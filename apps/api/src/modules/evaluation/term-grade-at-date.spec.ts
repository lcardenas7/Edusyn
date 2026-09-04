import { StudentGradesService } from './student-grades.service';

/**
 * calculateTermGradeAtDate (motor del Corte Preventivo y del modo "parcial" de
 * Asignaturas Reprobadas).
 *
 * Regresión: el corte leía de StudentGrade/EvaluativeActivity (vacío) en vez de
 * PartialGrade (la planilla) y no tenía fallback sin plan → devolvía null para todos
 * → el informe salía "s/d / al día" aunque hubiera estudiantes reprobando.
 */
describe('StudentGradesService.calculateTermGradeAtDate', () => {
  const cutoff = new Date('2026-07-05T12:00:00');

  function makeService(opts: { plan?: any; partials?: any[] }) {
    const prisma: any = {
      evaluationPlan: { findUnique: jest.fn().mockResolvedValue(opts.plan ?? null) },
      partialGrade: {
        findMany: jest.fn().mockImplementation(({ where }: any) => {
          const upper = where?.createdAt?.lte as Date | undefined;
          const rows = (opts.partials ?? []).filter((p) => !upper || p.createdAt <= upper);
          return Promise.resolve(rows);
        }),
      },
    };
    return new StudentGradesService(prisma, { record: jest.fn(), recordMany: jest.fn() } as any);
  }

  it('SIN plan + parciales → promedio simple (no "s/d")', async () => {
    const svc = makeService({
      plan: null,
      partials: [
        { componentType: 'COGNITIVO', score: 2.0, createdAt: new Date('2026-06-01') },
        { componentType: 'COGNITIVO', score: 4.0, createdAt: new Date('2026-06-10') },
      ],
    });
    const res = await svc.calculateTermGradeAtDate('e1', 'ta1', 't1', cutoff);
    expect(res.grade).toBe(3.0);
  });

  it('SIN parciales → null (genuinamente sin datos)', async () => {
    const svc = makeService({ plan: null, partials: [] });
    const res = await svc.calculateTermGradeAtDate('e1', 'ta1', 't1', cutoff);
    expect(res.grade).toBeNull();
  });

  it('CON plan → promedio ponderado por componentType desde PartialGrade', async () => {
    const plan = {
      components: [
        { componentId: 'c1', percentage: 50, component: { code: 'COGNITIVO', name: 'Cognitivo' } },
        { componentId: 'c2', percentage: 50, component: { code: 'ACTITUDINAL', name: 'Actitudinal' } },
      ],
    };
    const svc = makeService({
      plan,
      partials: [
        { componentType: 'COGNITIVO', score: 2.0, createdAt: new Date('2026-06-01') },
        { componentType: 'ACTITUDINAL', score: 4.0, createdAt: new Date('2026-06-01') },
      ],
    });
    const res = await svc.calculateTermGradeAtDate('e1', 'ta1', 't1', cutoff);
    expect(res.grade).toBe(3.0); // (2*0.5 + 4*0.5)
  });

  it('excluye parciales cargados DESPUÉS de la fecha de corte', async () => {
    const svc = makeService({
      plan: null,
      partials: [
        { componentType: 'COGNITIVO', score: 2.0, createdAt: new Date('2026-06-01') }, // dentro
        { componentType: 'COGNITIVO', score: 5.0, createdAt: new Date('2026-08-01') }, // fuera (después del corte)
      ],
    });
    const res = await svc.calculateTermGradeAtDate('e1', 'ta1', 't1', cutoff);
    expect(res.grade).toBe(2.0); // solo cuenta la del 1 de junio
  });
});
