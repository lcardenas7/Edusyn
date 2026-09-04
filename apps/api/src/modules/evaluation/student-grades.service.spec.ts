import { StudentGradesService } from './student-grades.service';

/**
 * A-11 / INV-10 — La nota anual (usada por promoción, previsualización, cambio de
 * grado y el endpoint anual) debe leer la nota CANÓNICA del período
 * (`PeriodFinalGrade`, que ya refleja el override manual C-1 y la recuperación),
 * y solo recalcular desde `PartialGrade` como fallback cuando no exista.
 *
 * El repo casi no tiene tests; estos cubren la regresión concreta que motivó A-11
 * ("un estudiante que aprobó la recuperación era marcado repitente").
 */
describe('StudentGradesService.calculateAnnualGrade (A-11 / INV-10)', () => {
  function makePrismaMock() {
    return {
      academicTerm: { findMany: jest.fn() },
      teacherAssignment: { findUnique: jest.fn() },
      periodFinalGrade: { findUnique: jest.fn() },
      finalComponent: { findMany: jest.fn() },
      finalComponentGrade: { findUnique: jest.fn() },
      evaluationPlan: { findUnique: jest.fn() },
      partialGrade: { findMany: jest.fn() },
    };
  }

  const singleTerm = [{ id: 't1', name: 'P1', weightPercentage: 100, order: 1 }];

  it('usa PeriodFinalGrade (canónico) y NO recalcula desde parciales cuando existe', async () => {
    const prisma = makePrismaMock();
    prisma.academicTerm.findMany.mockResolvedValue(singleTerm);
    prisma.teacherAssignment.findUnique.mockResolvedValue({ subjectId: 'sub1' });
    // Nota canónica = 4.0 (p.ej. recuperada). Si recalculara desde parciales daría otra cosa.
    prisma.periodFinalGrade.findUnique.mockResolvedValue({ finalScore: 4.0 });
    prisma.finalComponent.findMany.mockResolvedValue([]);

    const svc = new StudentGradesService(prisma as any, { record: jest.fn(), recordMany: jest.fn() } as any);
    const res = await svc.calculateAnnualGrade('e1', 'ta1', 'y1');

    expect(res.annualGrade).toBe(4.0);
    expect(prisma.periodFinalGrade.findUnique).toHaveBeenCalledTimes(1);
    // Prueba de que NO se recalculó desde parciales:
    expect(prisma.evaluationPlan.findUnique).not.toHaveBeenCalled();
    expect(prisma.partialGrade.findMany).not.toHaveBeenCalled();
  });

  it('cae al recálculo desde PartialGrade cuando NO existe PeriodFinalGrade', async () => {
    const prisma = makePrismaMock();
    prisma.academicTerm.findMany.mockResolvedValue(singleTerm);
    prisma.teacherAssignment.findUnique.mockResolvedValue({ subjectId: 'sub1' });
    prisma.periodFinalGrade.findUnique.mockResolvedValue(null); // sin nota canónica aún
    prisma.evaluationPlan.findUnique.mockResolvedValue({
      components: [
        { componentId: 'c1', percentage: 100, component: { id: 'c1', code: 'COG', name: 'Cognitivo' } },
      ],
    });
    prisma.partialGrade.findMany.mockResolvedValue([{ componentType: 'COG', score: 3.5 }]);
    prisma.finalComponent.findMany.mockResolvedValue([]);

    const svc = new StudentGradesService(prisma as any, { record: jest.fn(), recordMany: jest.fn() } as any);
    const res = await svc.calculateAnnualGrade('e1', 'ta1', 'y1');

    expect(res.annualGrade).toBe(3.5);
    expect(prisma.evaluationPlan.findUnique).toHaveBeenCalled(); // sí recalculó (fallback)
  });

  it('si la asignación no tiene subjectId, recalcula (no rompe)', async () => {
    const prisma = makePrismaMock();
    prisma.academicTerm.findMany.mockResolvedValue(singleTerm);
    prisma.teacherAssignment.findUnique.mockResolvedValue({ subjectId: null });
    prisma.evaluationPlan.findUnique.mockResolvedValue({
      components: [
        { componentId: 'c1', percentage: 100, component: { id: 'c1', code: 'COG', name: 'Cognitivo' } },
      ],
    });
    prisma.partialGrade.findMany.mockResolvedValue([{ componentType: 'COG', score: 3.0 }]);
    prisma.finalComponent.findMany.mockResolvedValue([]);

    const svc = new StudentGradesService(prisma as any, { record: jest.fn(), recordMany: jest.fn() } as any);
    const res = await svc.calculateAnnualGrade('e1', 'ta1', 'y1');

    expect(res.annualGrade).toBe(3.0);
    // No se consultó PeriodFinalGrade porque no hay subjectId para la coordenada.
    expect(prisma.periodFinalGrade.findUnique).not.toHaveBeenCalled();
  });
});
