import { StudentGradesService } from './student-grades.service';

/**
 * FASE 0 · Caracterización de la NOTA ANUAL antes de tocar nada.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Por qué existe este archivo
 * ---------------------------
 * Vamos a hacer configurable que una fuente de evaluación (p. ej. un examen
 * semestral) NO aplique a determinados grados. Antes de eso hay que FIJAR el
 * comportamiento actual, para poder demostrar después —y no sólo afirmar— que
 * la nota anual de las instituciones existentes no cambió ni un decimal.
 *
 * Estas pruebas describen lo que Edusyn hace HOY. Si alguna se pone en rojo
 * durante el rediseño, es una regresión, no una mejora.
 *
 * Las tres reglas que quedan fijadas:
 *
 *   R1 · La ausencia de nota EXCLUYE la fuente del cálculo. Nunca vale 0.
 *   R2 · Las fuentes restantes se RENORMALIZAN sobre la suma de sus pesos.
 *   R3 · `AcademicTerm` y `FinalComponent` se tratan de forma IDÉNTICA: son
 *        dos listas que se concatenan, sin distinguir `type`.
 *
 * Contexto medido en producción el 2026-08-18, que es lo que hace seguro el
 * rediseño: 0 `FinalComponentGrade`, 0 notas en términos `SEMESTER_EXAM`, y
 * una sola institución (Ciudadela) con semestrales configurados.
 */
describe('calculateAnnualGrade — línea base antes del alcance por grado', () => {
  /**
   * Monta el servicio con un Prisma simulado.
   * `notasPorTermino` y `notasPorComponente`: `null` = el estudiante NO tiene
   * nota en esa fuente, que es justo el caso que nos interesa caracterizar.
   */
  function makeService(opts: {
    terminos: Array<{ id: string; name: string; type: 'PERIOD' | 'SEMESTER_EXAM'; weightPercentage: number }>;
    componentes?: Array<{ id: string; name: string; weightPercentage: number }>;
    notasPorTermino?: Record<string, number | null>;
    notasPorComponente?: Record<string, number | null>;
  }) {
    const notasT = opts.notasPorTermino ?? {};
    const notasC = opts.notasPorComponente ?? {};

    const prisma: any = {
      academicTerm: { findMany: jest.fn().mockResolvedValue(opts.terminos) },
      teacherAssignment: {
        findUnique: jest.fn().mockResolvedValue({ subjectId: 'subj-1', group: { gradeId: 'grade-1' } }),
      },
      finalComponent: { findMany: jest.fn().mockResolvedValue(opts.componentes ?? []) },
      // D-19: alcance de las fuentes finales. SIN exclusiones, que es el estado
      // de todas las instituciones tras la migración (la tabla nace vacía) y el
      // que debe reproducir exactamente el comportamiento histórico.
      finalComponentExclusion: { findMany: jest.fn().mockResolvedValue([]) },
      periodFinalGrade: {
        findUnique: jest.fn(async (args: any) => {
          const termId = args.where.studentEnrollmentId_academicTermId_subjectId.academicTermId;
          const nota = notasT[termId];
          return nota === null || nota === undefined ? null : { finalScore: nota };
        }),
      },
      finalComponentGrade: {
        findUnique: jest.fn(async (args: any) => {
          const compId = args.where.studentEnrollmentId_teacherAssignmentId_finalComponentId.finalComponentId;
          const nota = notasC[compId];
          return nota === null || nota === undefined ? null : { grade: nota };
        }),
      },
    };

    const svc = new StudentGradesService(prisma);
    // Sin PeriodFinalGrade el servicio recalcula desde PartialGrade; en estas
    // pruebas la nota canónica es la única fuente, así que anulamos el respaldo.
    jest.spyOn(svc as any, 'calculateTermGrade').mockResolvedValue({ grade: null, components: [] });
    return svc;
  }

  const CUATRO_PERIODOS = [
    { id: 'p1', name: 'Primer Período', type: 'PERIOD' as const, weightPercentage: 20 },
    { id: 'p2', name: 'Segundo Período', type: 'PERIOD' as const, weightPercentage: 20 },
    { id: 'p3', name: 'Tercer Período', type: 'PERIOD' as const, weightPercentage: 20 },
    { id: 'p4', name: 'Cuarto Período', type: 'PERIOD' as const, weightPercentage: 20 },
  ];
  const DOS_SEMESTRALES = [
    { id: 'fc1', name: 'Prueba Semestral I', weightPercentage: 10 },
    { id: 'fc2', name: 'Prueba Semestral II', weightPercentage: 10 },
  ];

  const anual = (svc: StudentGradesService) =>
    svc.calculateAnnualGrade('enr-1', 'ta-1', 'y-1').then((r) => r.annualGrade);

  // ═════════════════════════════════════════════════════════════════════════
  // R1 · La ausencia NUNCA vale 0
  // ═════════════════════════════════════════════════════════════════════════
  describe('R1 · la ausencia de nota excluye la fuente, nunca la convierte en 0', () => {
    it('sin ninguna nota, la anual es null (no 0)', async () => {
      const svc = makeService({ terminos: CUATRO_PERIODOS });
      expect(await anual(svc)).toBeNull();
    });

    it('el escenario de 8.º: 4 períodos con nota, 2 semestrales sin ella', async () => {
      const svc = makeService({
        terminos: CUATRO_PERIODOS,
        componentes: DOS_SEMESTRALES,
        notasPorTermino: { p1: 4.0, p2: 3.5, p3: 4.5, p4: 3.0 },
        notasPorComponente: { fc1: null, fc2: null },
      });
      // Promedio de los 4 períodos: (4.0+3.5+4.5+3.0)/4 = 3.75, y la anual se
      // REDONDEA A UN DECIMAL -> 3.8. El redondeo es parte del contrato actual.
      // Si los semestrales contaran como 0 saldría 3.0: un castigo de 0.8.
      expect(await anual(svc)).toBe(3.8);
    });

    it('un solo período con nota vale esa nota, no se diluye entre los demás', async () => {
      const svc = makeService({
        terminos: CUATRO_PERIODOS,
        notasPorTermino: { p1: 4.0, p2: null, p3: null, p4: null },
      });
      expect(await anual(svc)).toBe(4.0);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // R2 · Renormalización sobre las fuentes válidas
  // ═════════════════════════════════════════════════════════════════════════
  describe('R2 · las fuentes con nota se renormalizan sobre la suma de sus pesos', () => {
    it('con las 6 fuentes completas (100 %), pondera de forma directa', async () => {
      const svc = makeService({
        terminos: CUATRO_PERIODOS,
        componentes: DOS_SEMESTRALES,
        notasPorTermino: { p1: 4.0, p2: 4.0, p3: 4.0, p4: 4.0 },
        notasPorComponente: { fc1: 3.0, fc2: 3.0 },
      });
      // (4×80 + 3×20)/100 = 3.8
      expect(await anual(svc)).toBe(3.8);
    });

    it('faltando un semestral, renormaliza sobre 90 y NO sobre 100', async () => {
      const svc = makeService({
        terminos: CUATRO_PERIODOS,
        componentes: DOS_SEMESTRALES,
        notasPorTermino: { p1: 4.0, p2: 4.0, p3: 4.0, p4: 4.0 },
        notasPorComponente: { fc1: 3.0, fc2: null },
      });
      // (4×80 + 3×10) = 350 -> 350/90 = 3.888... -> 3.9
      // Sobre 100 daría 3.5: la diferencia es exactamente la renormalización.
      expect(await anual(svc)).toBe(3.9);
    });

    it('los pesos declarados pueden sumar más de 100 y aun así el resultado se normaliza', async () => {
      // Caso REAL de Ciudadela hoy: 4 períodos (80) + 2 SEMESTER_EXAM (20) + 2
      // FinalComponent (20) = 120 % declarado. La aritmética se autocorrige,
      // pero la configuración miente. Queda fijado como comportamiento actual.
      const svc = makeService({
        terminos: [
          ...CUATRO_PERIODOS,
          { id: 's1', name: 'Examen Semestral 1', type: 'SEMESTER_EXAM' as const, weightPercentage: 10 },
          { id: 's2', name: 'Examen Semestral 2', type: 'SEMESTER_EXAM' as const, weightPercentage: 10 },
        ],
        componentes: DOS_SEMESTRALES,
        notasPorTermino: { p1: 4.0, p2: 4.0, p3: 4.0, p4: 4.0, s1: 4.0, s2: 4.0 },
        notasPorComponente: { fc1: 4.0, fc2: 4.0 },
      });
      // Todas valen 4.0: el resultado es 4.0 sea cual sea el divisor.
      expect(await anual(svc)).toBe(4.0);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // R3 · Términos y componentes se tratan igual
  // ═════════════════════════════════════════════════════════════════════════
  describe('R3 · `AcademicTerm` y `FinalComponent` se concatenan sin distinguir tipo', () => {
    it('un SEMESTER_EXAM se trata exactamente igual que un PERIOD', async () => {
      const svc = makeService({
        terminos: [
          { id: 'p1', name: 'Primer Período', type: 'PERIOD', weightPercentage: 50 },
          { id: 's1', name: 'Examen Semestral 1', type: 'SEMESTER_EXAM', weightPercentage: 50 },
        ],
        notasPorTermino: { p1: 5.0, s1: 3.0 },
      });
      expect(await anual(svc)).toBe(4.0);
    });

    it('`sources` expone las dos familias con su tipo, para trazabilidad', async () => {
      const svc = makeService({
        terminos: CUATRO_PERIODOS,
        componentes: DOS_SEMESTRALES,
        notasPorTermino: { p1: 4.0, p2: null, p3: null, p4: null },
        notasPorComponente: { fc1: 3.0, fc2: null },
      });
      const { sources } = await svc.calculateAnnualGrade('enr-1', 'ta-1', 'y-1');

      expect(sources).toHaveLength(6); // 4 términos + 2 componentes
      expect(sources.filter((s) => s.type === 'period')).toHaveLength(4);
      expect(sources.filter((s) => s.type === 'final_component')).toHaveLength(2);
      // Las fuentes SIN nota siguen apareciendo, con grade null: el consumidor
      // puede distinguir «no tiene nota» de «no existe la fuente».
      expect(sources.filter((s) => s.grade === null)).toHaveLength(4);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // El punto ciego que el rediseño viene a resolver
  // ═════════════════════════════════════════════════════════════════════════
  describe('punto ciego actual · «no aplica» es indistinguible de «falta la nota»', () => {
    it('un grado que NO presenta semestral y otro al que le FALTA producen el mismo resultado', async () => {
      const noPresenta = makeService({
        terminos: CUATRO_PERIODOS,
        componentes: DOS_SEMESTRALES,
        notasPorTermino: { p1: 4.0, p2: 4.0, p3: 4.0, p4: 4.0 },
        notasPorComponente: { fc1: null, fc2: null },
      });
      const faltaSubirla = makeService({
        terminos: CUATRO_PERIODOS,
        componentes: DOS_SEMESTRALES,
        notasPorTermino: { p1: 4.0, p2: 4.0, p3: 4.0, p4: 4.0 },
        notasPorComponente: { fc1: null, fc2: null },
      });

      expect(await anual(noPresenta)).toBe(await anual(faltaSubirla));
      // Ambos dan 4.0 y el sistema no puede decir cuál es cuál.
      // El alcance explícito (FinalComponentExclusion) es lo que romperá este empate.
    });
  });
});
