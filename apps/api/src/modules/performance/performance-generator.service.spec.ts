import { PerformanceGeneratorService } from './performance-generator.service';

/**
 * Q-0 — El generador de desempeños (narrativa cualitativa) debe leer las notas
 * de PartialGrade (planilla moderna), no de StudentGrade (legacy). Antes, si el
 * docente usaba la planilla moderna, el generador veía 0 notas y todos salían
 * en nivel "BAJO". Fallback a StudentGrade solo si no hay parciales.
 */
describe('PerformanceGeneratorService (Q-0)', () => {
  function makePrisma() {
    return {
      partialGrade: { findMany: jest.fn() },
      studentGrade: { findMany: jest.fn() },
    };
  }

  it('lee PartialGrade (planilla) cuando existe y NO cae al legacy', async () => {
    const prisma = makePrisma();
    prisma.partialGrade.findMany.mockResolvedValue([
      { componentType: 'COGNITIVO', score: 4.0 },
      { componentType: 'COGNITIVO', score: 3.0 },
      { componentType: 'PROCEDIMENTAL', score: 5.0 },
      { componentType: 'ACTITUDINAL', score: 4.0 },
    ]);

    const svc = new PerformanceGeneratorService(prisma as any);
    const res = await (svc as any).getDimensionScores('e1', 'ta1', 't1');

    expect(res.COGNITIVO).toBe(3.5); // (4 + 3) / 2
    expect(res.PROCEDIMENTAL).toBe(5.0);
    expect(res.ACTITUDINAL).toBe(4.0);
    expect(prisma.studentGrade.findMany).not.toHaveBeenCalled();
  });

  it('cae a StudentGrade (legacy) solo si no hay parciales', async () => {
    const prisma = makePrisma();
    prisma.partialGrade.findMany.mockResolvedValue([]);
    prisma.studentGrade.findMany.mockResolvedValue([
      { score: 4.0, evaluativeActivity: { component: { code: 'COG', name: 'Cognitivo' } } },
      { score: 2.0, evaluativeActivity: { component: { code: 'SABER', name: 'Saber' } } },
    ]);

    const svc = new PerformanceGeneratorService(prisma as any);
    const res = await (svc as any).getDimensionScores('e1', 'ta1', 't1');

    expect(res.COGNITIVO).toBe(3.0); // (4 + 2) / 2, ambos mapean a COGNITIVO
    expect(prisma.studentGrade.findMany).toHaveBeenCalled();
  });

  it('mapea variantes de código de componente a la dimensión', () => {
    const svc = new PerformanceGeneratorService({} as any);
    const map = (c: string) => (svc as any).componentCodeToDimension(c);
    expect(map('COGNITIVO')).toBe('COGNITIVO');
    expect(map('COG')).toBe('COGNITIVO');
    expect(map('PROCEDIMENTAL')).toBe('PROCEDIMENTAL');
    expect(map('HACER')).toBe('PROCEDIMENTAL');
    expect(map('ACTITUDINAL')).toBe('ACTITUDINAL');
    expect(map('SER')).toBe('ACTITUDINAL');
    expect(map('OTRO')).toBeNull();
  });
});
