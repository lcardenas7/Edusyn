import {
  componentApplies,
  resolveComponentScope,
  filterApplicableComponents,
  scopeReasonLabel,
  ScopedComponent,
} from './final-component-scope.util';
import { StudentGradesService } from './student-grades.service';

/**
 * D-19 · Alcance de las fuentes de evaluación final.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Una institución puede tener pruebas semestrales sin que TODOS sus grados o
 * asignaturas las presenten. Hasta ahora eso sólo podía inferirse de la
 * ausencia de nota, lo cual es indistinguible de «al docente le falta subirla».
 *
 * Estas pruebas fijan la resolución jerárquica y, sobre todo, la GARANTÍA DE NO
 * REGRESIÓN: con `scopeMode = ALL_GRADES` (el DEFAULT) y sin reglas, el cálculo
 * es idéntico al histórico.
 */

const FC1 = 'fc-semestral-1';
const FC2 = 'fc-semestral-2';
const G8 = 'grado-octavo';
const G9 = 'grado-noveno';
const MAT = 'subj-matematicas';
const EDF = 'subj-edu-fisica';

const todos = (id: string): ScopedComponent => ({ id, scopeMode: 'ALL_GRADES' });
const selectivo = (id: string): ScopedComponent => ({ id, scopeMode: 'SELECTED_GRADES' });

describe('D-19 · resolución de alcance (función pura)', () => {
  describe('precedencia 3 · el modo del componente decide cuando no hay reglas', () => {
    it('ALL_GRADES sin reglas ⇒ aplica — el comportamiento histórico', () => {
      const d = resolveComponentScope(todos(FC1), G8, MAT, []);
      expect(d).toEqual({ applies: true, source: 'DEFAULT_MODE' });
    });

    it('SELECTED_GRADES sin reglas ⇒ NO aplica a nadie, de forma explícita', () => {
      const d = resolveComponentScope(selectivo(FC1), G8, MAT, []);
      expect(d).toEqual({ applies: false, source: 'DEFAULT_MODE' });
    });
  });

  describe('precedencia 2 · regla de GRADO (subjectId = null)', () => {
    const reglas = [{ finalComponentId: FC1, gradeId: G8, subjectId: null, applies: false }];

    it('excluye todas las asignaturas de ese grado', () => {
      expect(componentApplies(todos(FC1), G8, MAT, reglas)).toBe(false);
      expect(componentApplies(todos(FC1), G8, EDF, reglas)).toBe(false);
    });

    it('no contamina a otros grados ni a otras fuentes', () => {
      expect(componentApplies(todos(FC1), G9, MAT, reglas)).toBe(true);
      expect(componentApplies(todos(FC2), G8, MAT, reglas)).toBe(true);
    });

    it('en modo SELECTED_GRADES, una regla con applies=true INCLUYE ese grado', () => {
      const incluir = [{ finalComponentId: FC1, gradeId: G9, subjectId: null, applies: true }];
      expect(componentApplies(selectivo(FC1), G9, MAT, incluir)).toBe(true);
      expect(componentApplies(selectivo(FC1), G8, MAT, incluir)).toBe(false);
    });
  });

  describe('precedencia 1 · la EXCEPCIÓN por asignatura gana al grado', () => {
    // El caso que una lista negra pura NO sabía expresar:
    // 8.º no presenta el semestral, EXCEPTO en Matemáticas.
    const reglas = [
      { finalComponentId: FC1, gradeId: G8, subjectId: null, applies: false },
      { finalComponentId: FC1, gradeId: G8, subjectId: MAT, applies: true },
    ];

    it('Matemáticas se rescata del grado excluido', () => {
      expect(resolveComponentScope(todos(FC1), G8, MAT, reglas)).toEqual({
        applies: true,
        source: 'SUBJECT_RULE',
      });
    });

    it('el resto del grado sigue excluido', () => {
      expect(resolveComponentScope(todos(FC1), G8, EDF, reglas)).toEqual({
        applies: false,
        source: 'GRADE_RULE',
      });
    });

    it('y al revés: grado incluido con una asignatura exceptuada', () => {
      const inverso = [
        { finalComponentId: FC1, gradeId: G8, subjectId: null, applies: true },
        { finalComponentId: FC1, gradeId: G8, subjectId: EDF, applies: false },
      ];
      expect(componentApplies(todos(FC1), G8, MAT, inverso)).toBe(true);
      expect(componentApplies(todos(FC1), G8, EDF, inverso)).toBe(false);
    });

    it('el orden de las filas no altera el resultado', () => {
      const alReves = [...reglas].reverse();
      expect(componentApplies(todos(FC1), G8, MAT, alReves)).toBe(true);
      expect(componentApplies(todos(FC1), G8, EDF, alReves)).toBe(false);
    });
  });

  describe('fail-open ante datos incompletos', () => {
    it('sin grado conocido la fuente APLICA, aunque el modo sea selectivo', () => {
      const reglas = [{ finalComponentId: FC1, gradeId: G8, subjectId: null, applies: false }];
      expect(resolveComponentScope(todos(FC1), null, MAT, reglas)).toEqual({ applies: true, source: 'FAIL_OPEN' });
      expect(resolveComponentScope(selectivo(FC1), undefined, MAT, [])).toEqual({ applies: true, source: 'FAIL_OPEN' });
    });

    it('sin asignatura conocida sólo decide la regla de grado', () => {
      expect(componentApplies(todos(FC1), G8, null, [{ finalComponentId: FC1, gradeId: G8, subjectId: null, applies: false }])).toBe(false);
      expect(componentApplies(todos(FC1), G8, null, [{ finalComponentId: FC1, gradeId: G8, subjectId: EDF, applies: false }])).toBe(true);
    });
  });

  describe('motivo legible, para poder explicarlo', () => {
    it('distingue quién tomó la decisión', () => {
      expect(scopeReasonLabel(resolveComponentScope(todos(FC1), G8, MAT, [{ finalComponentId: FC1, gradeId: G8, subjectId: null, applies: false }])))
        .toBe('Este grado no presenta esta evaluación.');
      expect(scopeReasonLabel(resolveComponentScope(todos(FC1), G8, EDF, [{ finalComponentId: FC1, gradeId: G8, subjectId: EDF, applies: false }])))
        .toBe('Esta asignatura no presenta esta evaluación.');
      expect(scopeReasonLabel(resolveComponentScope(selectivo(FC1), G8, MAT, []))).toBe('Esta evaluación sólo aplica a los grados seleccionados.');
      expect(scopeReasonLabel(resolveComponentScope(todos(FC1), G8, MAT, []))).toBeNull();
    });
  });

  describe('filtrado de listas', () => {
    it('sin reglas y todo en ALL_GRADES devuelve la MISMA lista', () => {
      const comps = [todos(FC1), todos(FC2)];
      expect(filterApplicableComponents(comps, G8, MAT, [])).toBe(comps); // misma referencia: atajo
    });

    it('descarta sólo las fuentes que no aplican', () => {
      const comps = [todos(FC1), todos(FC2)];
      const r = filterApplicableComponents(comps, G8, MAT, [
        { finalComponentId: FC1, gradeId: G8, subjectId: null, applies: false },
      ]);
      expect(r.map((c) => c.id)).toEqual([FC2]);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Integración con el cálculo real de la nota anual
// ═══════════════════════════════════════════════════════════════════════════
describe('D-19 · efecto en calculateAnnualGrade', () => {
  function makeService(opts: {
    scopeMode?: 'ALL_GRADES' | 'SELECTED_GRADES';
    reglas?: Array<{ finalComponentId: string; gradeId: string; subjectId: string | null; applies: boolean }>;
    notasPorTermino?: Record<string, number | null>;
    notasPorComponente?: Record<string, number | null>;
  }) {
    const mode = opts.scopeMode ?? 'ALL_GRADES';
    const notasT = opts.notasPorTermino ?? {};
    const notasC = opts.notasPorComponente ?? {};
    const scopeFindMany = jest.fn().mockResolvedValue(opts.reglas ?? []);

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
          { id: FC1, name: 'Prueba Semestral I', weightPercentage: 10, order: 1, scopeMode: mode },
          { id: FC2, name: 'Prueba Semestral II', weightPercentage: 10, order: 2, scopeMode: mode },
        ]),
      },
      finalComponentScope: { findMany: scopeFindMany },
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
    const svc = new StudentGradesService(prisma, { record: jest.fn(), recordMany: jest.fn() } as any);
    jest.spyOn(svc as any, 'calculateTermGrade').mockResolvedValue({ grade: null, components: [] });
    return { svc, prisma, scopeFindMany };
  }

  const NOTAS_PERIODOS = { p1: 4.0, p2: 4.0, p3: 4.0, p4: 4.0 };

  it('GARANTÍA DE NO REGRESIÓN: ALL_GRADES sin reglas ⇒ resultado histórico', async () => {
    const { svc } = makeService({
      notasPorTermino: NOTAS_PERIODOS,
      notasPorComponente: { [FC1]: 3.0, [FC2]: 3.0 },
    });
    const { annualGrade, sources } = await svc.calculateAnnualGrade('e1', 'ta1', 'y1');
    expect(annualGrade).toBe(3.8); // (4×80 + 3×20)/100
    expect(sources).toHaveLength(6);
  });

  it('el grado excluido no ve las fuentes: no cuentan como nota faltante', async () => {
    const { svc } = makeService({
      reglas: [
        { finalComponentId: FC1, gradeId: G8, subjectId: null, applies: false },
        { finalComponentId: FC2, gradeId: G8, subjectId: null, applies: false },
      ],
      notasPorTermino: NOTAS_PERIODOS,
    });
    const { annualGrade, sources } = await svc.calculateAnnualGrade('e1', 'ta1', 'y1');
    expect(sources).toHaveLength(4);
    expect(sources.some((s) => s.type === 'final_component')).toBe(false);
    expect(annualGrade).toBe(4.0); // renormalizado sobre 80
  });

  it('excluir una fuente NUNCA la convierte en 0', async () => {
    const { svc } = makeService({
      reglas: [
        { finalComponentId: FC1, gradeId: G8, subjectId: null, applies: false },
        { finalComponentId: FC2, gradeId: G8, subjectId: null, applies: false },
      ],
      notasPorTermino: { p1: 5.0, p2: 5.0, p3: 5.0, p4: 5.0 },
    });
    // Con 0 saldría (5×80 + 0×20)/100 = 4.0. Excluyendo: 5.0.
    expect((await svc.calculateAnnualGrade('e1', 'ta1', 'y1')).annualGrade).toBe(5.0);
  });

  it('la EXCEPCIÓN por asignatura rescata la fuente para Matemáticas', async () => {
    const { svc } = makeService({
      reglas: [
        { finalComponentId: FC1, gradeId: G8, subjectId: null, applies: false },
        { finalComponentId: FC1, gradeId: G8, subjectId: MAT, applies: true },
        { finalComponentId: FC2, gradeId: G8, subjectId: null, applies: false },
      ],
      notasPorTermino: NOTAS_PERIODOS,
      notasPorComponente: { [FC1]: 3.0 },
    });
    const { annualGrade, sources } = await svc.calculateAnnualGrade('e1', 'ta1', 'y1');
    expect(sources.filter((s) => s.type === 'final_component')).toHaveLength(1);
    expect(annualGrade).toBe(3.9); // (4×80 + 3×10)/90
  });

  it('SELECTED_GRADES sin reglas: ninguna fuente entra en el cálculo', async () => {
    const { svc } = makeService({ scopeMode: 'SELECTED_GRADES', notasPorTermino: NOTAS_PERIODOS });
    const { sources, annualGrade } = await svc.calculateAnnualGrade('e1', 'ta1', 'y1');
    expect(sources.filter((s) => s.type === 'final_component')).toHaveLength(0);
    expect(annualGrade).toBe(4.0);
  });

  it('no consulta el alcance si la institución no tiene componentes', async () => {
    const { svc, prisma, scopeFindMany } = makeService({ notasPorTermino: NOTAS_PERIODOS });
    prisma.finalComponent.findMany.mockResolvedValue([]);
    await svc.calculateAnnualGrade('e1', 'ta1', 'y1');
    expect(scopeFindMany).not.toHaveBeenCalled();
  });

  it('consulta el alcance UNA sola vez, no una por componente', async () => {
    const { svc, scopeFindMany } = makeService({ notasPorTermino: NOTAS_PERIODOS });
    await svc.calculateAnnualGrade('e1', 'ta1', 'y1');
    expect(scopeFindMany).toHaveBeenCalledTimes(1);
  });
});
