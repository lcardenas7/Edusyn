import { ReportsService } from './reports.service';
import { AcademicDataSourceService } from './academic-data-source.service';

/**
 * C-4 · Congelar el contrato de publicación en el snapshot
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Criterios autorizados:
 *   1. finalizeTerm congela reportContent, academicStructure y displayConfig.
 *   2. reSnapshotTerm congela exactamente los mismos tres.
 *   3. RecoverySnapshotService NO se toca (queda para F3).
 *   4. No se reescriben snapshots históricos.
 *   5. Se mantiene el degradado para snapshots que carezcan de los campos.
 *   6. Los documentos FINALIZED consumen los valores CONGELADOS, no configuración viva.
 *   7. getReportCardYear preserva el valor de CADA período, no sólo el del último.
 *
 * Estas pruebas deben FALLAR con el comportamiento actual.
 */

const CAMPOS_C4 = ['reportContent', 'academicStructure', 'displayConfig'] as const;

const CONFIG_PUBLICACION = {
  showLearning: true,
  showEvidences: false,
  learningLabelSingular: 'Propósito',
  evidenceLabelPlural: 'Imprescindibles',
  valuationScope: 'EVIDENCE',
};

// ═══════════════════════════════════════════════════════════════════════════
// Criterios 1 y 2 · los escritores congelan los tres campos
// ═══════════════════════════════════════════════════════════════════════════
describe('C-4 · escritores', () => {
  function setup(status: 'CLOSED' | 'FINALIZED') {
    const prisma: any = {
      academicTerm: {
        findUnique: jest.fn().mockResolvedValue({ id: 't1', status, academicYearId: 'y1', academicYear: { id: 'y1', institutionId: 'inst-1' } }),
        update: jest.fn().mockResolvedValue({}),
      },
      group: { findMany: jest.fn().mockResolvedValue([{ id: 'g1', name: 'A', grade: { name: 'Transición' } }]) },
      termReportCardSnapshot: { aggregate: jest.fn().mockResolvedValue({ _max: { version: 0 } }), create: jest.fn().mockResolvedValue({}) },
    };
    const institutionContext: any = { getContext: jest.fn().mockResolvedValue({ academicStructure: 'DIMENSIONS', minPassingGrade: 3.0 }) };
    const svc = new ReportsService(prisma, null as any, null as any, null as any, null as any, institutionContext, null as any, null as any);
    jest.spyOn(svc as any, 'buildGroupReportCards').mockResolvedValue({
      institution: { id: 'inst-1' }, academicYear: { id: 'y1' }, term: { id: 't1' },
      academicStructure: 'DIMENSIONS',
      displayConfig: { mode: 'QUALITATIVE' },
      reportContent: CONFIG_PUBLICACION,
      cards: [{
        enrollmentId: 'e1', student: {}, group: {}, areaGrades: [], subjectGrades: [],
        structureSource: 'calculated', attendance: {}, achievements: [], observations: [],
      }],
      generatedAt: new Date(),
    });
    return { svc, prisma };
  }

  const payload = (prisma: any) => prisma.termReportCardSnapshot.create.mock.calls[0][0].data.data;

  it('CRITERIO 1 · finalizeTerm congela los tres campos con el valor vigente al finalizar', async () => {
    const { svc, prisma } = setup('CLOSED');

    await svc.finalizeTerm('t1', 'u1');

    const data = payload(prisma);
    expect(data.reportContent).toEqual(CONFIG_PUBLICACION);
    expect(data.academicStructure).toBe('DIMENSIONS');
    expect(data.displayConfig).toEqual({ mode: 'QUALITATIVE' });
  });

  it('CRITERIO 2 · reSnapshotTerm congela exactamente los mismos tres campos', async () => {
    const { svc, prisma } = setup('FINALIZED');

    await svc.reSnapshotTerm('t1', 'u1');

    const data = payload(prisma);
    expect(data.reportContent).toEqual(CONFIG_PUBLICACION);
    expect(data.academicStructure).toBe('DIMENSIONS');
    expect(data.displayConfig).toEqual({ mode: 'QUALITATIVE' });
  });

  it('los dos escritores producen el MISMO conjunto de claves', async () => {
    const a = setup('CLOSED');
    await a.svc.finalizeTerm('t1', 'u1');
    const b = setup('FINALIZED');
    await b.svc.reSnapshotTerm('t1', 'u1');

    expect(Object.keys(payload(a.prisma)).sort()).toEqual(Object.keys(payload(b.prisma)).sort());
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Criterios 5 y 6 · lectura: valores congelados, con degradado histórico
// ═══════════════════════════════════════════════════════════════════════════
describe('C-4 · lectura del snapshot', () => {
  function makeDS(snapshotData: any) {
    const prisma: any = {
      academicTerm: { findUnique: jest.fn().mockResolvedValue({ id: 't1', status: 'FINALIZED' }) },
      termReopeningRecord: { count: jest.fn().mockResolvedValue(0) },
      termReportCardSnapshot: {
        aggregate: jest.fn().mockResolvedValue({ _max: { version: 1 } }),
        findMany: jest.fn().mockResolvedValue([{ studentEnrollmentId: 'e1', data: snapshotData }]),
        findFirst: jest.fn().mockResolvedValue({ data: snapshotData, version: 1 }),
      },
    };
    return new AcademicDataSourceService(prisma);
  }

  const base = {
    institution: {}, academicYear: {}, term: {}, student: {}, group: { id: 'g1' },
    areaGrades: [], subjectGrades: [], structureSource: 'calculated', attendance: {},
    achievements: [], observations: [], generatedAt: 'x',
  };

  it('CRITERIO 6 · la reconstrucción de grupo entrega el reportContent CONGELADO', async () => {
    const ds = makeDS({ ...base, reportContent: CONFIG_PUBLICACION, academicStructure: 'DIMENSIONS', displayConfig: { mode: 'QUALITATIVE' } });

    const r = await ds.getGroupReportCardData('g1', 't1', jest.fn());

    expect(r.data.reportContent).toEqual(CONFIG_PUBLICACION);
    expect(r.data.academicStructure).toBe('DIMENSIONS');
    expect(r.data.displayConfig).toEqual({ mode: 'QUALITATIVE' });
  });

  it('CRITERIO 6 · no se consulta configuración viva en el camino FINALIZED', async () => {
    const ds = makeDS({ ...base, reportContent: CONFIG_PUBLICACION });
    const buildLive = jest.fn();

    await ds.getGroupReportCardData('g1', 't1', buildLive);

    expect(buildLive).not.toHaveBeenCalled();
  });

  it('CRITERIO 5 · snapshot histórico sin los tres campos → undefined, SIN valor por defecto', async () => {
    const ds = makeDS({ ...base });

    const r = await ds.getGroupReportCardData('g1', 't1', jest.fn());

    // El degradado vive en las plantillas; el motor no debe inventar valores.
    for (const campo of CAMPOS_C4) expect(r.data[campo]).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Criterio 7 · multiperíodo preserva el valor de CADA período
// ═══════════════════════════════════════════════════════════════════════════
describe('C-4 · getReportCardYear (criterio 7)', () => {
  function setup(perPeriodData: any[]) {
    const prisma: any = {
      studentEnrollment: { findUnique: jest.fn().mockResolvedValue({ academicYearId: 'y1', institutionId: 'inst-1', groupId: 'g1' }) },
      teacherAssignment: { findMany: jest.fn().mockResolvedValue([]) },
      performanceScale: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const academicYearService: any = {
      getTermsByAcademicYear: jest.fn().mockResolvedValue([
        { id: 't1', name: 'P1', order: 1, type: 'PERIOD' },
        { id: 't2', name: 'P2', order: 2, type: 'PERIOD' },
        { id: 't3', name: 'P3', order: 3, type: 'PERIOD' },
      ]),
    };
    const studentGradesService: any = { getPerformanceLevelFromScale: jest.fn().mockReturnValue(null) };
    const svc = new ReportsService(prisma, studentGradesService, null as any, null as any, academicYearService, null as any, null as any, null as any);
    const spy = jest.spyOn(svc as any, 'getReportCardData');
    perPeriodData.forEach(d => spy.mockResolvedValueOnce(d));
    return { svc };
  }

  const periodo = (extra: any = {}) => ({
    institution: {}, academicYear: {}, student: {}, group: {},
    areaGrades: [], subjectGrades: [], attendance: { absent: 0, excused: 0 },
    observations: [], achievements: [], generatedAt: 'x', ...extra,
  });

  it('CRITERIO 7 · cada período conserva SU propio contrato de publicación', async () => {
    const p1 = { ...CONFIG_PUBLICACION, learningLabelSingular: 'Propósito' };
    const p2 = { ...CONFIG_PUBLICACION, learningLabelSingular: 'Aprendizaje' };
    const { svc } = setup([
      periodo({ reportContent: p1, academicStructure: 'DIMENSIONS', displayConfig: { mode: 'A' } }),
      periodo({ reportContent: p2, academicStructure: 'AREAS_SUBJECTS', displayConfig: { mode: 'B' } }),
    ]);

    const r: any = await svc.getReportCardYear('e1', 't2');

    expect(r.periods).toHaveLength(2);
    expect(r.periods[0].reportContent).toEqual(p1);
    expect(r.periods[0].academicStructure).toBe('DIMENSIONS');
    expect(r.periods[0].displayConfig).toEqual({ mode: 'A' });
    expect(r.periods[1].reportContent).toEqual(p2);
    expect(r.periods[1].academicStructure).toBe('AREAS_SUBJECTS');
    expect(r.periods[1].displayConfig).toEqual({ mode: 'B' });
  });

  it('CRITERIO 7 · el nivel superior NO pierde el valor si el último período carece de él', async () => {
    const { svc } = setup([
      periodo({ reportContent: CONFIG_PUBLICACION, academicStructure: 'DIMENSIONS', displayConfig: { mode: 'A' } }),
      periodo(), // snapshot histórico sin los campos
    ]);

    const r: any = await svc.getReportCardYear('e1', 't2');

    // Antes se tomaba ciegamente el último período y se perdía todo.
    expect(r.reportContent).toEqual(CONFIG_PUBLICACION);
    expect(r.academicStructure).toBe('DIMENSIONS');
    expect(r.displayConfig).toEqual({ mode: 'A' });
  });

  it('el nivel superior prioriza el período MÁS RECIENTE que tenga valor', async () => {
    const viejo = { ...CONFIG_PUBLICACION, learningLabelSingular: 'Viejo' };
    const nuevo = { ...CONFIG_PUBLICACION, learningLabelSingular: 'Nuevo' };
    const { svc } = setup([
      periodo({ reportContent: viejo }),
      periodo({ reportContent: nuevo }),
      periodo(), // sin valor
    ]);

    const r: any = await svc.getReportCardYear('e1', 't3');

    expect(r.reportContent).toEqual(nuevo);
  });

  it('CRITERIO 5 · si NINGÚN período tiene los campos, quedan undefined', async () => {
    const { svc } = setup([periodo(), periodo()]);

    const r: any = await svc.getReportCardYear('e1', 't2');

    for (const campo of CAMPOS_C4) expect(r[campo]).toBeUndefined();
    expect(r.periods[0].reportContent).toBeUndefined();
  });
});
