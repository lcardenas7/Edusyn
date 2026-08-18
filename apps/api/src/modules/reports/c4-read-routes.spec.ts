import * as fs from 'fs';
import * as path from 'path';
import { ReportsService } from './reports.service';
import { AcademicDataSourceService } from './academic-data-source.service';

/**
 * F0 · C-4 — MAPA DE RUTAS DE LECTURA DEL SNAPSHOT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Complementa `c4-snapshot-baseline.spec.ts`. Aquí se caracterizan las rutas que
 * faltaban: el boletín multiperíodo, los snapshots de recuperación y la asimetría
 * entre escritores.
 *
 * Hallazgo que motiva este archivo: NO hay un único contrato de snapshot. Existen
 * TRES escritores con DOS formas distintas de payload, y la ruta de lectura no
 * distingue cuál lo escribió. Todo esto es comportamiento ACTUAL, sin corregir.
 */

const CAMPOS_C4 = ['reportContent', 'academicStructure', 'displayConfig'] as const;

// ═══════════════════════════════════════════════════════════════════════════
// 1 · Los tres escritores no producen el mismo payload
// ═══════════════════════════════════════════════════════════════════════════
describe('C-4 · rutas de ESCRITURA — tres escritores, dos formas', () => {
  const reportsSrc = fs.readFileSync(path.join(__dirname, 'reports.service.ts'), 'utf8');
  const recoverySrc = fs.readFileSync(
    path.join(__dirname, '..', 'recovery', 'recovery-snapshot.service.ts'), 'utf8',
  );

  const payloadDe = (src: string, marca: string) => {
    const i = src.indexOf(marca);
    const inicio = src.indexOf('data: {', i);
    return src.slice(inicio, inicio + 1200);
  };

  // Las dos aserciones estáticas que había aquí sobre finalizeTerm y reSnapshotTerm se
  // retiraron: la de reSnapshotTerm era un FALSO POSITIVO —su anclaje caía en el
  // `update({ data: { status: 'OPEN' } })` temporal, no en el payload del snapshot— y el
  // comportamiento de ambos escritores está cubierto de forma CONDUCTUAL en
  // `c4-snapshot-baseline.spec.ts` y `c4-implementation.spec.ts`.

  it('[DEFECTO CONGELADO · C-4] RecoverySnapshotService SÍ escribe academicStructure y displayConfig', () => {
    // Anclar en el `create`, no en la primera aparición de POST_RECOVERY (que es
    // una consulta `findFirst` mucho antes en el archivo).
    const payload = payloadDe(recoverySrc, 'termReportCardSnapshot.create');

    // Asimetría real: el snapshot POST_RECOVERY conserva dos de los tres campos…
    expect(payload).toContain('academicStructure: groupData.academicStructure');
    expect(payload).toContain('displayConfig: groupData.displayConfig');
    // …pero tampoco guarda reportContent.
    expect(recoverySrc).not.toContain('reportContent');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2 · La consecuencia: el mismo período cambia de forma tras una recuperación
// ═══════════════════════════════════════════════════════════════════════════
describe('C-4 · consecuencia de la asimetría entre escritores', () => {
  function makeDS(snapshotData: any) {
    const prisma: any = {
      academicTerm: { findUnique: jest.fn().mockResolvedValue({ id: 't1', status: 'FINALIZED' }) },
      termReopeningRecord: { count: jest.fn().mockResolvedValue(0) },
      termReportCardSnapshot: {
        aggregate: jest.fn().mockResolvedValue({ _max: { version: 2 } }),
        findMany: jest.fn().mockResolvedValue([{ studentEnrollmentId: 'e1', data: snapshotData }]),
      },
    };
    return new AcademicDataSourceService(prisma);
  }

  const base = {
    institution: {}, academicYear: {}, term: {}, student: {}, group: { id: 'g1' },
    areaGrades: [], subjectGrades: [], structureSource: 'calculated', attendance: {},
    achievements: [], observations: [], generatedAt: 'x',
  };

  it('[DEFECTO CONGELADO · C-4] snapshot INITIAL_CLOSE → academicStructure undefined', async () => {
    const ds = makeDS({ ...base }); // forma de finalizeTerm

    const r = await ds.getGroupReportCardData('g1', 't1', jest.fn());

    expect(r.data.academicStructure).toBeUndefined();
    expect(r.data.displayConfig).toBeUndefined();
  });

  it('[DEFECTO CONGELADO · C-4] snapshot POST_RECOVERY → academicStructure SÍ llega', async () => {
    const ds = makeDS({ ...base, academicStructure: 'DIMENSIONS', displayConfig: { mode: 'QUALITATIVE' } });

    const r = await ds.getGroupReportCardData('g1', 't1', jest.fn());

    // El MISMO período, leído por la MISMA ruta, se comporta distinto según qué
    // escritor generó la última versión del snapshot. Sigue siendo cierto tras C-4:
    // RecoverySnapshotService no se tocó (queda para F3).
    expect(r.data.academicStructure).toBe('DIMENSIONS');
    expect(r.data.displayConfig).toEqual({ mode: 'QUALITATIVE' });
    // Este fixture no trae reportContent, así que llega undefined: tras C-4 la
    // reconstrucción SÍ lo propaga cuando existe (ver c4-snapshot-baseline).
    expect(r.data.reportContent).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3 · getReportCardYear — boletín multiperíodo
// ═══════════════════════════════════════════════════════════════════════════
describe('C-4 · getReportCardYear (multiperíodo)', () => {
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
      ]),
    };
    const studentGradesService: any = { getPerformanceLevelFromScale: jest.fn().mockReturnValue(null) };
    const svc = new ReportsService(prisma, studentGradesService, null as any, null as any, academicYearService, null as any, null as any, null as any);
    const spy = jest.spyOn(svc as any, 'getReportCardData');
    perPeriodData.forEach(d => spy.mockResolvedValueOnce(d));
    return { svc, spy };
  }

  const periodo = (extra: any = {}) => ({
    institution: {}, academicYear: {}, student: {}, group: {},
    areaGrades: [], subjectGrades: [], attendance: { absent: 0, excused: 0 },
    observations: [], achievements: [], generatedAt: 'x', ...extra,
  });

  // Antes [DEFECTO CONGELADO · C-4]: el retorno multiperíodo no propagaba reportContent.
  it('[CORREGIDO por C-4] propaga reportContent al documento anual', async () => {
    const { svc } = setup([
      periodo(),
      periodo({ reportContent: { showLearning: true }, academicStructure: 'DIMENSIONS' }),
    ]);

    const r: any = await svc.getReportCardYear('e1', 't2');

    expect(r.reportContent).toEqual({ showLearning: true });
  });

  // Antes [DEFECTO CONGELADO · C-4]: los tres campos salían sólo del último período y
  // se perdían si ése era un snapshot histórico.
  it('[CORREGIDO por C-4] cada período conserva su valor y el nivel superior no lo pierde', async () => {
    const { svc } = setup([
      periodo({ academicStructure: 'DIMENSIONS', displayConfig: { mode: 'QUALITATIVE' } }), // P1
      periodo(), // P2 sin los campos (p. ej. snapshot histórico)
    ]);

    const r: any = await svc.getReportCardYear('e1', 't2');

    // P1 conserva el suyo…
    expect(r.periods[0].academicStructure).toBe('DIMENSIONS');
    expect(r.periods[1].academicStructure).toBeUndefined();
    // …y el nivel superior toma el más reciente que lo tenga, en vez de perderlo.
    expect(r.academicStructure).toBe('DIMENSIONS');
    expect(r.displayConfig).toEqual({ mode: 'QUALITATIVE' });
  });

  it('compone período a período delegando en getReportCardData (snapshot o vivo)', async () => {
    const { svc, spy } = setup([periodo(), periodo()]);

    await svc.getReportCardYear('e1', 't2');

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls.map(c => c[1])).toEqual(['t1', 't2']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4 · Ruta que SÍ conserva los campos: el documento por estudiante
// ═══════════════════════════════════════════════════════════════════════════
describe('C-4 · la ruta que realmente arma el documento', () => {
  it('getStudentReportCardData entrega el snapshot CRUDO: conservaría los tres campos', async () => {
    const prisma: any = {
      academicTerm: { findUnique: jest.fn().mockResolvedValue({ id: 't1', status: 'FINALIZED' }) },
      termReopeningRecord: { count: jest.fn().mockResolvedValue(0) },
      termReportCardSnapshot: {
        findFirst: jest.fn().mockResolvedValue({
          version: 1,
          data: {
            student: {}, group: {}, areaGrades: [],
            reportContent: { showLearning: true, learningLabelSingular: 'Propósito' },
            academicStructure: 'DIMENSIONS',
            displayConfig: { mode: 'QUALITATIVE' },
          },
        }),
      },
    };
    const ds = new AcademicDataSourceService(prisma);

    const r = await ds.getStudentReportCardData('e1', 't1', jest.fn());

    // Sin reconstrucción: lo que esté en `data` llega tal cual. Es la ruta que usa
    // el frontend para generar el HTML de cada estudiante.
    for (const campo of CAMPOS_C4) expect(r.data[campo]).toBeDefined();
  });

  it('el frontend arma el documento por la ruta INDIVIDUAL, no por la de grupo', () => {
    const front = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', '..', 'web', 'src', 'pages', 'ReportCards.tsx'), 'utf8',
    );
    // buildStudentHtml consume getReportCard (individual) y getReportCardYear.
    expect(front).toContain('reportsApi.getReportCard(student.enrollmentId');
    expect(front).toContain('reportsApi.getReportCardYear(student.enrollmentId');
    // getGroupReportCardList sólo alimenta la tabla de estudiantes.
    expect(front).toContain('reportsApi.getGroupReportCardList');
  });

  it('las plantillas degradan a valores por defecto cuando falta reportContent', () => {
    const tpl = fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'web', 'src', 'pages', 'reportCardTemplates.ts'), 'utf8');

    // transicion-propositos: `data.reportContent || {}` → etiquetas y flags por defecto.
    expect(tpl).toContain('const rc = data.reportContent || {}');
    // renderLearningBlocks: sin config cae al comportamiento histórico.
    expect(tpl).toContain('if (!cfg || blocks.length === 0)');
  });
});
