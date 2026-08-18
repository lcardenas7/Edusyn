import { componentApplies, exclusionReason } from './final-component-scope.util';
import { StudentGradesService } from './student-grades.service';

/**
 * D-19 · Alcance de las fuentes de evaluación final.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Una institución puede tener pruebas semestrales sin que TODOS sus grados o
 * asignaturas las presenten. Hasta ahora eso sólo podía inferirse de la
 * ausencia de nota, lo cual es indistinguible de «al docente le falta subirla».
 *
 * Estas pruebas fijan la regla y, sobre todo, fijan la GARANTÍA DE NO
 * REGRESIÓN: sin exclusiones configuradas, el cálculo es idéntico al histórico.
 */

const FC1 = 'fc-semestral-1';
const FC2 = 'fc-semestral-2';
const G8 = 'grado-octavo';
const G9 = 'grado-noveno';
const MAT = 'subj-matematicas';
const EDF = 'subj-edu-fisica';

describe('D-19 · regla de alcance (función pura)', () => {
  it('sin exclusiones, TODO aplica — el comportamiento histórico', () => {
    expect(componentApplies(FC1, G8, MAT, [])).toBe(true);
    expect(componentApplies(FC2, G9, EDF, [])).toBe(true);
  });

  describe('precedencia 2 · exclusión de GRADO completo (subjectId = null)', () => {
    const exclusiones = [{ finalComponentId: FC1, gradeId: G8, subjectId: null }];

    it('ninguna asignatura de ese grado presenta esa fuente', () => {
      expect(componentApplies(FC1, G8, MAT, exclusiones)).toBe(false);
      expect(componentApplies(FC1, G8, EDF, exclusiones)).toBe(false);
    });

    it('no contamina a otros grados', () => {
      expect(componentApplies(FC1, G9, MAT, exclusiones)).toBe(true);
    });

    it('no contamina a otras fuentes', () => {
      expect(componentApplies(FC2, G8, MAT, exclusiones)).toBe(true);
    });
  });

  describe('precedencia 1 · exclusión de GRADO + ASIGNATURA', () => {
    const exclusiones = [{ finalComponentId: FC1, gradeId: G8, subjectId: EDF }];

    it('sólo esa asignatura de ese grado queda fuera', () => {
      expect(componentApplies(FC1, G8, EDF, exclusiones)).toBe(false);
      expect(componentApplies(FC1, G8, MAT, exclusiones)).toBe(true);
    });

    it('la misma asignatura en otro grado sigue aplicando', () => {
      expect(componentApplies(FC1, G9, EDF, exclusiones)).toBe(true);
    });
  });

  describe('excluir siempre RESTA, nunca suma', () => {
    it('una exclusión de grado no se “rescata” con una de asignatura', () => {
      // Ambas filas coexisten; la de grado manda porque ninguna re-incluye.
      const exclusiones = [
        { finalComponentId: FC1, gradeId: G8, subjectId: null },
        { finalComponentId: FC1, gradeId: G8, subjectId: MAT },
      ];
      expect(componentApplies(FC1, G8, MAT, exclusiones)).toBe(false);
      expect(componentApplies(FC1, G8, EDF, exclusiones)).toBe(false);
    });
  });

  describe('fail-open ante datos incompletos', () => {
    it('sin grado conocido, la fuente APLICA (no se descarta en silencio)', () => {
      const exclusiones = [{ finalComponentId: FC1, gradeId: G8, subjectId: null }];
      expect(componentApplies(FC1, null, MAT, exclusiones)).toBe(true);
      expect(componentApplies(FC1, undefined, MAT, exclusiones)).toBe(true);
    });

    it('sin asignatura conocida, sólo cae por exclusión de grado completo', () => {
      expect(componentApplies(FC1, G8, null, [{ finalComponentId: FC1, gradeId: G8, subjectId: null }])).toBe(false);
      expect(componentApplies(FC1, G8, null, [{ finalComponentId: FC1, gradeId: G8, subjectId: EDF }])).toBe(true);
    });
  });

  describe('motivo de la exclusión, para poder explicarla', () => {
    it('distingue grado completo de asignatura concreta', () => {
      expect(exclusionReason(FC1, G8, MAT, [{ finalComponentId: FC1, gradeId: G8, subjectId: null }])).toBe('GRADE');
      expect(exclusionReason(FC1, G8, EDF, [{ finalComponentId: FC1, gradeId: G8, subjectId: EDF }])).toBe('GRADE_SUBJECT');
      expect(exclusionReason(FC1, G8, MAT, [])).toBeNull();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Integración con el cálculo real de la nota anual
// ═══════════════════════════════════════════════════════════════════════════
describe('D-19 · efecto en calculateAnnualGrade', () => {
  function makeService(opts: {
    exclusiones?: Array<{ finalComponentId: string; gradeId: string; subjectId: string | null }>;
    notasPorTermino?: Record<string, number | null>;
    notasPorComponente?: Record<string, number | null>;
  }) {
    const notasT = opts.notasPorTermino ?? {};
    const notasC = opts.notasPorComponente ?? {};
    const exclusionFindMany = jest.fn().mockResolvedValue(opts.exclusiones ?? []);

    const prisma: any = {
      academicTerm: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'p1', name: 'P1', type: 'PERIOD', weightPercentage: 20 },
          { id: 'p2', name: 'P2', type: 'PERIOD', weightPercentage: 20 },
          { id: 'p3', name: 'P3', type: 'PERIOD', weightPercentage: 20 },
          { id: 'p4', name: 'P4', type: 'PERIOD', weightPercentage: 20 },
        ]),
      },
      teacherAssignment: { findUnique: jest.fn().mockResolvedValue({ subjectId: MAT, group: { gradeId: G8 } }) },
      finalComponent: {
        findMany: jest.fn().mockResolvedValue([
          { id: FC1, name: 'Prueba Semestral I', weightPercentage: 10, order: 1 },
          { id: FC2, name: 'Prueba Semestral II', weightPercentage: 10, order: 2 },
        ]),
      },
      finalComponentExclusion: { findMany: exclusionFindMany },
      periodFinalGrade: {
        findUnique: jest.fn(async (a: any) => {
          const n = notasT[a.where.studentEnrollmentId_academicTermId_subjectId.academicTermId];
          return n === null || n === undefined ? null : { finalScore: n };
        }),
      },
      finalComponentGrade: {
        findUnique: jest.fn(async (a: any) => {
          const n = notasC[a.where.studentEnrollmentId_teacherAssignmentId_finalComponentId.finalComponentId];
          return n === null || n === undefined ? null : { grade: n };
        }),
      },
    };
    const svc = new StudentGradesService(prisma);
    jest.spyOn(svc as any, 'calculateTermGrade').mockResolvedValue({ grade: null, components: [] });
    return { svc, prisma, exclusionFindMany };
  }

  const NOTAS_PERIODOS = { p1: 4.0, p2: 4.0, p3: 4.0, p4: 4.0 };

  it('GARANTÍA DE NO REGRESIÓN: sin exclusiones el resultado es el histórico', async () => {
    const { svc } = makeService({
      notasPorTermino: NOTAS_PERIODOS,
      notasPorComponente: { [FC1]: 3.0, [FC2]: 3.0 },
    });
    // (4×80 + 3×20)/100 = 3.8 — idéntico a la línea base
    const { annualGrade, sources } = await svc.calculateAnnualGrade('e1', 'ta1', 'y1');
    expect(annualGrade).toBe(3.8);
    expect(sources).toHaveLength(6);
  });

  it('el grado excluido no ve las fuentes: desaparecen de `sources`, no cuentan como nota faltante', async () => {
    const { svc } = makeService({
      exclusiones: [
        { finalComponentId: FC1, gradeId: G8, subjectId: null },
        { finalComponentId: FC2, gradeId: G8, subjectId: null },
      ],
      notasPorTermino: NOTAS_PERIODOS,
    });
    const { annualGrade, sources } = await svc.calculateAnnualGrade('e1', 'ta1', 'y1');

    expect(sources).toHaveLength(4); // sólo los 4 períodos
    expect(sources.some((s) => s.type === 'final_component')).toBe(false);
    expect(annualGrade).toBe(4.0); // renormalizado sobre 80
  });

  it('excluir una fuente NUNCA la convierte en 0', async () => {
    const conExclusion = makeService({
      exclusiones: [{ finalComponentId: FC1, gradeId: G8, subjectId: null }, { finalComponentId: FC2, gradeId: G8, subjectId: null }],
      notasPorTermino: { p1: 5.0, p2: 5.0, p3: 5.0, p4: 5.0 },
    });
    const { annualGrade } = await conExclusion.svc.calculateAnnualGrade('e1', 'ta1', 'y1');
    // Con 0 saldría (5×80 + 0×20)/100 = 4.0. Excluyendo: 5.0.
    expect(annualGrade).toBe(5.0);
  });

  it('excluir sólo una de las dos fuentes deja la otra viva', async () => {
    const { svc } = makeService({
      exclusiones: [{ finalComponentId: FC1, gradeId: G8, subjectId: null }],
      notasPorTermino: NOTAS_PERIODOS,
      notasPorComponente: { [FC2]: 3.0 },
    });
    const { annualGrade, sources } = await svc.calculateAnnualGrade('e1', 'ta1', 'y1');
    expect(sources.filter((s) => s.type === 'final_component')).toHaveLength(1);
    // (4×80 + 3×10)/90 = 3.888… → 3.9
    expect(annualGrade).toBe(3.9);
  });

  it('la exclusión por asignatura respeta a las demás asignaturas del grado', async () => {
    // La asignación es de MATEMÁTICAS; se excluye EDUCACIÓN FÍSICA.
    const { svc } = makeService({
      exclusiones: [{ finalComponentId: FC1, gradeId: G8, subjectId: EDF }],
      notasPorTermino: NOTAS_PERIODOS,
      notasPorComponente: { [FC1]: 3.0, [FC2]: 3.0 },
    });
    const { sources } = await svc.calculateAnnualGrade('e1', 'ta1', 'y1');
    expect(sources.filter((s) => s.type === 'final_component')).toHaveLength(2);
  });

  it('no consulta la tabla de exclusiones si la institución no tiene componentes', async () => {
    const { svc, prisma, exclusionFindMany } = makeService({ notasPorTermino: NOTAS_PERIODOS });
    prisma.finalComponent.findMany.mockResolvedValue([]);

    await svc.calculateAnnualGrade('e1', 'ta1', 'y1');

    // Las 4 instituciones sin pruebas semestrales ni rozan la tabla nueva.
    expect(exclusionFindMany).not.toHaveBeenCalled();
  });

  it('consulta las exclusiones UNA sola vez, no una por componente', async () => {
    const { svc, exclusionFindMany } = makeService({ notasPorTermino: NOTAS_PERIODOS });
    await svc.calculateAnnualGrade('e1', 'ta1', 'y1');
    expect(exclusionFindMany).toHaveBeenCalledTimes(1);
  });
});
