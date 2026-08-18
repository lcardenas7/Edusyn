import * as fs from 'fs';
import * as path from 'path';
import { ReportsService } from './reports.service';
import { AcademicDataSourceService } from './academic-data-source.service';

/**
 * F0-MÍNIMO · AMPLIACIÓN PARA C-4 — PRUEBAS DE CARACTERIZACIÓN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * C-4 dice: «finalizeTerm no congela reportContent», y por eso el boletín cambia de
 * aspecto tras finalizar. Antes de corregirlo hay que fijar qué hace HOY el trío:
 *
 *   finalizeTerm · reSnapshotTerm · AcademicDataSourceService
 *
 * Ninguna prueba afirma lo que DEBERÍA pasar. Todas describen el código actual.
 * Las marcadas [DEFECTO CONGELADO · C-4] deben FALLAR cuando se implemente C-4:
 * ese fallo es la señal de que la corrección surtió efecto.
 *
 * Alcance deliberadamente limitado: `buildGroupReportCards` NO se caracteriza entero
 * (ver el bloque D y el informe). Sólo se responde la pregunta concreta de C-4.
 */

// Los tres campos que C-4 pretende congelar.
const CAMPOS_C4 = ['reportContent', 'academicStructure', 'displayConfig'] as const;

// ═══════════════════════════════════════════════════════════════════════════
// A · finalizeTerm — inventario exacto del payload congelado
// ═══════════════════════════════════════════════════════════════════════════
describe('C-4 · A · finalizeTerm — qué entra en TermReportCardSnapshot.data', () => {
  function setup() {
    const prisma: any = {
      academicTerm: {
        findUnique: jest.fn().mockResolvedValue({ id: 't1', status: 'CLOSED', academicYearId: 'y1', academicYear: { id: 'y1', institutionId: 'inst-1' } }),
        update: jest.fn().mockResolvedValue({}),
      },
      group: { findMany: jest.fn().mockResolvedValue([{ id: 'g1' }]) },
      termReportCardSnapshot: { aggregate: jest.fn().mockResolvedValue({ _max: { version: 0 } }), create: jest.fn().mockResolvedValue({}) },
    };
    const institutionContext: any = { getContext: jest.fn().mockResolvedValue({ academicStructure: 'AREAS_SUBJECTS', minPassingGrade: 3.0 }) };
    const svc = new ReportsService(prisma, null as any, null as any, null as any, null as any, institutionContext, null as any, null as any);
    jest.spyOn(svc as any, 'buildGroupReportCards').mockResolvedValue({
      institution: { id: 'inst-1' }, academicYear: { id: 'y1' }, term: { id: 't1' },
      academicStructure: 'DIMENSIONS',
      displayConfig: { mode: 'QUALITATIVE' },
      reportContent: { showLearning: true, learningLabelSingular: 'Propósito', valuationScope: 'EVIDENCE' },
      cards: [{
        enrollmentId: 'e1', student: {}, group: {}, areaGrades: [], subjectGrades: [],
        structureSource: 'calculated', attendance: {}, achievements: [], observations: [],
      }],
      generatedAt: new Date(),
    });
    return { svc, prisma };
  }

  it('el payload contiene EXACTAMENTE este conjunto de claves', async () => {
    const { svc, prisma } = setup();

    await svc.finalizeTerm('t1', 'u1');

    const data = prisma.termReportCardSnapshot.create.mock.calls[0][0].data.data;
    // Tras C-4 el conjunto pasó de 18 a 21 claves: se sumaron los tres del contrato
    // de publicación.
    expect(Object.keys(data).sort()).toEqual([
      'academicStructure', 'academicYear', 'achievements', 'approvedSubjectsCount', 'areaGrades',
      'attendance', 'displayConfig', 'failedSubjectsCount', 'generalAverage', 'generatedAt',
      'group', 'institution', 'observations', 'promotionStatus', 'rank', 'reportContent',
      'structureSource', 'student', 'subjectGrades', 'term', 'totalStudentsRanked',
    ]);
  });

  // Antes [DEFECTO CONGELADO · C-4]. Convertida al corregirse.
  it('[CORREGIDO por C-4] congela los tres campos que produce el generador', async () => {
    const { svc, prisma } = setup();

    await svc.finalizeTerm('t1', 'u1');

    const data = prisma.termReportCardSnapshot.create.mock.calls[0][0].data.data;
    for (const campo of CAMPOS_C4) expect(data[campo]).toBeDefined();
    expect(data.academicStructure).toBe('DIMENSIONS');
    expect(data.reportContent.learningLabelSingular).toBe('Propósito');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// B · reSnapshotTerm — ¿mismo payload que finalizeTerm?
// ═══════════════════════════════════════════════════════════════════════════
describe('C-4 · B · reSnapshotTerm', () => {
  function setup() {
    const prisma: any = {
      academicTerm: {
        findUnique: jest.fn().mockResolvedValue({ id: 't1', status: 'FINALIZED', academicYearId: 'y1', academicYear: { id: 'y1', institutionId: 'inst-1' } }),
        update: jest.fn().mockResolvedValue({}),
      },
      group: { findMany: jest.fn().mockResolvedValue([{ id: 'g1', name: 'A', grade: { name: '5' } }]) },
      termReportCardSnapshot: { aggregate: jest.fn().mockResolvedValue({ _max: { version: 3 } }), create: jest.fn().mockResolvedValue({}) },
    };
    const institutionContext: any = { getContext: jest.fn().mockResolvedValue({ academicStructure: 'AREAS_SUBJECTS', minPassingGrade: 3.0 }) };
    const svc = new ReportsService(prisma, null as any, null as any, null as any, null as any, institutionContext, null as any, null as any);
    jest.spyOn(svc as any, 'buildGroupReportCards').mockResolvedValue({
      institution: {}, academicYear: {}, term: {},
      academicStructure: 'DIMENSIONS', displayConfig: { mode: 'QUALITATIVE' }, reportContent: { showLearning: true },
      cards: [{ enrollmentId: 'e1', student: {}, group: {}, areaGrades: [], subjectGrades: [], structureSource: 'calculated', attendance: {}, achievements: [], observations: [] }],
      generatedAt: new Date(),
    });
    return { svc, prisma };
  }

  it('exige estado FINALIZED', async () => {
    const { svc, prisma } = setup();
    prisma.academicTerm.findUnique.mockResolvedValue({ id: 't1', status: 'OPEN', academicYearId: 'y1', academicYear: { id: 'y1', institutionId: 'inst-1' } });

    await expect(svc.reSnapshotTerm('t1', 'u1')).rejects.toThrow(/FINALIZED/);
  });

  it('crea una versión nueva (max+1) y conserva snapshotType INITIAL_CLOSE', async () => {
    const { svc, prisma } = setup();

    const r = await svc.reSnapshotTerm('t1', 'u1');

    expect(r.version).toBe(4);
    expect(prisma.termReportCardSnapshot.create.mock.calls[0][0].data.snapshotType).toBe('INITIAL_CLOSE');
  });

  // Antes [DEFECTO CONGELADO · C-4]. Convertida al corregirse.
  it('[CORREGIDO por C-4] congela los tres campos, igual que finalizeTerm', async () => {
    const { svc, prisma } = setup();

    await svc.reSnapshotTerm('t1', 'u1');

    const data = prisma.termReportCardSnapshot.create.mock.calls[0][0].data.data;
    for (const campo of CAMPOS_C4) expect(data[campo]).toBeDefined();
    expect(data.academicStructure).toBe('DIMENSIONS');
  });

  it('[DEFECTO CONGELADO] abre temporalmente el período a OPEN y lo restaura a FINALIZED', async () => {
    const { svc, prisma } = setup();

    await svc.reSnapshotTerm('t1', 'u1');

    // Durante esa ventana, cualquier escritura concurrente pasaría la guarda de FINALIZED.
    const estados = prisma.academicTerm.update.mock.calls.map((c: any[]) => c[0].data.status);
    expect(estados).toEqual(['OPEN', 'FINALIZED']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C · AcademicDataSourceService — qué sale del snapshot y qué se reconstruye
// ═══════════════════════════════════════════════════════════════════════════
describe('C-4 · C · AcademicDataSourceService', () => {
  function makeDS(snapshotData: any, status = 'FINALIZED') {
    const prisma: any = {
      academicTerm: { findUnique: jest.fn().mockResolvedValue({ id: 't1', status }) },
      termReopeningRecord: { count: jest.fn().mockResolvedValue(0) },
      termReportCardSnapshot: {
        aggregate: jest.fn().mockResolvedValue({ _max: { version: 1 } }),
        findMany: jest.fn().mockResolvedValue([{ studentEnrollmentId: 'e1', data: snapshotData }]),
        findFirst: jest.fn().mockResolvedValue({ data: snapshotData, version: 1 }),
      },
    };
    return { ds: new AcademicDataSourceService(prisma), prisma };
  }

  const snapshotBase = (extra: any = {}) => ({
    institution: { id: 'inst-1' }, academicYear: { id: 'y1' }, term: { id: 't1' },
    student: { id: 's1' }, group: { id: 'g1' }, areaGrades: [], subjectGrades: [],
    structureSource: 'calculated', attendance: {}, achievements: [], observations: [],
    generatedAt: '2026-01-01', rank: 3, generalAverage: 4.1, promotionStatus: 'APRUEBA', failedSubjectsCount: 0,
    ...extra,
  });

  it('FINALIZED + snapshot → NO se llama al generador en vivo', async () => {
    const { ds } = makeDS(snapshotBase());
    const buildLive = jest.fn();

    const r = await ds.getGroupReportCardData('g1', 't1', buildLive);

    expect(buildLive).not.toHaveBeenCalled();
    expect(r.meta.source).toBe('snapshot');
    expect(r.meta.snapshotVersion).toBe(1);
  });

  it('OPEN / CLOSED → sí se llama al generador en vivo y no se lee snapshot', async () => {
    for (const status of ['OPEN', 'CLOSED']) {
      const { ds, prisma } = makeDS(snapshotBase(), status);
      const buildLive = jest.fn().mockResolvedValue({ cards: [], reportContent: { showLearning: true } });

      const r = await ds.getGroupReportCardData('g1', 't1', buildLive);

      expect(buildLive).toHaveBeenCalledWith('g1', 't1');
      expect(r.meta.source).toBe('live');
      expect(prisma.termReportCardSnapshot.findMany).not.toHaveBeenCalled();
      // En vivo, reportContent SÍ llega al consumidor.
      expect(r.data.reportContent).toBeDefined();
    }
  });

  // Antes [DEFECTO CONGELADO · C-4]: la reconstrucción omitía reportContent aunque el
  // snapshot lo contuviera. Convertida al corregirse.
  it('[CORREGIDO por C-4] la reconstrucción de GRUPO entrega los tres campos congelados', async () => {
    const { ds } = makeDS(snapshotBase({
      reportContent: { showLearning: true, learningLabelSingular: 'Propósito' },
      academicStructure: 'DIMENSIONS',
      displayConfig: { mode: 'QUALITATIVE' },
    }));

    const r = await ds.getGroupReportCardData('g1', 't1', jest.fn());

    expect(r.data.academicStructure).toBe('DIMENSIONS');
    expect(r.data.displayConfig).toEqual({ mode: 'QUALITATIVE' });
    expect(r.data.reportContent).toEqual({ showLearning: true, learningLabelSingular: 'Propósito' });
  });

  it('[DEFECTO CONGELADO · C-4] snapshot histórico SIN los tres campos → llegan undefined', async () => {
    const { ds } = makeDS(snapshotBase()); // ninguno de los tres

    const r = await ds.getGroupReportCardData('g1', 't1', jest.fn());

    for (const campo of CAMPOS_C4) expect(r.data[campo]).toBeUndefined();
  });

  it('snapshot sin reportContent pero CON academicStructure y displayConfig', async () => {
    const { ds } = makeDS(snapshotBase({ academicStructure: 'AREAS_SUBJECTS', displayConfig: { mode: 'QUANTITATIVE' } }));

    const r = await ds.getGroupReportCardData('g1', 't1', jest.fn());

    expect(r.data.academicStructure).toBe('AREAS_SUBJECTS');
    expect(r.data.displayConfig).toEqual({ mode: 'QUANTITATIVE' });
    expect(r.data.reportContent).toBeUndefined();
  });

  it('snapshot sin academicStructure → undefined, sin valor por defecto', async () => {
    const { ds } = makeDS(snapshotBase({ displayConfig: { mode: 'X' } }));

    const r = await ds.getGroupReportCardData('g1', 't1', jest.fn());

    expect(r.data.academicStructure).toBeUndefined();
  });

  it('snapshot sin displayConfig → undefined, sin valor por defecto', async () => {
    const { ds } = makeDS(snapshotBase({ academicStructure: 'DIMENSIONS' }));

    const r = await ds.getGroupReportCardData('g1', 't1', jest.fn());

    expect(r.data.displayConfig).toBeUndefined();
  });

  it('snapshot antiguo sin campos enriquecidos → se rellenan con null, no se recalculan', async () => {
    const { ds } = makeDS({
      institution: {}, academicYear: {}, term: {}, student: {}, group: { id: 'g1' },
      areaGrades: [], subjectGrades: [], structureSource: 'calculated', attendance: {},
      achievements: [], observations: [], generatedAt: '2025-01-01',
    });

    const r = await ds.getGroupReportCardData('g1', 't1', jest.fn());

    expect(r.data.cards[0].rank).toBeNull();
    expect(r.data.cards[0].generalAverage).toBeNull();
    expect(r.data.cards[0].promotionStatus).toBeNull();
  });

  it('ASIMETRÍA · el camino INDIVIDUAL devuelve el snapshot crudo y sí conservaría reportContent', async () => {
    const { ds } = makeDS(snapshotBase({ reportContent: { showLearning: true } }));

    const r = await ds.getStudentReportCardData('e1', 't1', jest.fn());

    // Aquí no hay reconstrucción: se entrega `data` tal cual. Si C-4 congelara
    // reportContent, este camino ya lo serviría, pero el de grupo no.
    expect(r.data.reportContent).toEqual({ showLearning: true });
  });

  it('FINALIZED sin snapshots → ConflictException explícito, sin caer a datos vivos', async () => {
    const { ds, prisma } = makeDS(snapshotBase());
    prisma.termReportCardSnapshot.aggregate.mockResolvedValue({ _max: { version: null } });
    const buildLive = jest.fn();

    await expect(ds.getGroupReportCardData('g1', 't1', buildLive)).rejects.toThrow(/snapshots/i);
    expect(buildLive).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D · buildGroupReportCards — sólo la pregunta de C-4
// ═══════════════════════════════════════════════════════════════════════════
describe('C-4 · D · ¿el boletín consume configuración congelada o viva?', () => {
  it('reportContent se arma con consultas VIVAS de configuración', () => {
    // Caracterización estática, deliberada: mockear el generador entero excede el
    // alcance autorizado de F0-MÍNIMO. Lo que importa para C-4 es de dónde sale el dato.
    const src = fs.readFileSync(path.join(__dirname, 'reports.service.ts'), 'utf8');
    const inicio = src.indexOf('const reportContent = {');
    const bloque = src.slice(inicio, inicio + 1800);

    expect(src).toContain('achievementConfig.findUnique');
    expect(src).toContain('reportCardConfig.findUnique');
    expect(bloque).toContain('achConfig?.');
    expect(bloque).toContain('rcConfig?.');
  });

  it('[DEFECTO CONGELADO · C-4] en el camino FINALIZED no se consulta configuración ni se lee del snapshot', async () => {
    const prisma: any = {
      academicTerm: { findUnique: jest.fn().mockResolvedValue({ id: 't1', status: 'FINALIZED' }) },
      termReopeningRecord: { count: jest.fn().mockResolvedValue(0) },
      termReportCardSnapshot: {
        aggregate: jest.fn().mockResolvedValue({ _max: { version: 1 } }),
        findMany: jest.fn().mockResolvedValue([{
          studentEnrollmentId: 'e1',
          data: { institution: {}, academicYear: {}, term: {}, student: {}, group: { id: 'g1' }, areaGrades: [], subjectGrades: [], structureSource: 'calculated', attendance: {}, achievements: [], observations: [], generatedAt: 'x' },
        }]),
      },
      // Si alguien intentara consultar configuración por aquí, reventaría.
    };
    const ds = new AcademicDataSourceService(prisma);
    const buildLive = jest.fn();

    const r = await ds.getGroupReportCardData('g1', 't1', buildLive);

    // Ni viva (no se llama al generador) ni congelada (el snapshot no lo tiene):
    // el boletín finalizado simplemente NO recibe reportContent.
    expect(buildLive).not.toHaveBeenCalled();
    expect((prisma as any).achievementConfig).toBeUndefined();
    expect((prisma as any).reportCardConfig).toBeUndefined();
    expect(r.data.reportContent).toBeUndefined();
  });
});
