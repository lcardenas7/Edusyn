import { ReportsService } from './reports.service';

/**
 * CARACTERIZACIÓN de los datos derivados del snapshot (ranking, promedio, promoción).
 *
 * Estas pruebas se escribieron **antes** de extraer la lógica duplicada entre `finalizeTerm` y
 * `reSnapshotTerm`, y describen lo que el código hace HOY — no lo que debería hacer. Su función es
 * exactamente una: si la extracción cambia una regla académica, esto se pone rojo.
 *
 * Por eso cada caso se ejecuta contra **los dos** caminos. Eran dos copias del mismo bloque; si tras
 * el refactor dejaran de coincidir, el fallo aparece aquí y no en un boletín de un estudiante.
 */

const CTX = { academicStructure: 'AREAS_SUBJECTS', minPassingGrade: 3.0, maxGradeValue: 5, minGradeValue: 1 };

/** Un estudiante con sus notas ya resueltas en una sola área calculable. */
function alumno(enrollmentId: string, notas: (number | null)[], calculationType = 'AVERAGE') {
  return {
    enrollmentId,
    student: { id: enrollmentId },
    group: {},
    areaGrades: [{ calculationType, subjects: notas.map((grade, i) => ({ id: `s${i}`, grade })) }],
    subjectGrades: [],
    structureSource: 'calculated',
    attendance: {},
    achievements: [],
    observations: [],
  };
}

function montar(cards: any[], ctx: any = CTX) {
  const creados: any[] = [];
  const prisma: any = {
    academicTerm: {
      findUnique: jest.fn().mockResolvedValue({
        id: 't1',
        status: 'CLOSED',
        academicYearId: 'y1',
        academicYear: { id: 'y1', institutionId: 'inst-1' },
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    group: { findMany: jest.fn().mockResolvedValue([{ id: 'g1', name: 'A', grade: { name: '5' } }]) },
    termReportCardSnapshot: {
      aggregate: jest.fn().mockResolvedValue({ _max: { version: 0 }, _min: { version: null } }),
      create: jest.fn().mockImplementation(({ data }: any) => {
        creados.push(data);
        return Promise.resolve({});
      }),
    },
  };
  const institutionContext: any = { getContext: jest.fn().mockResolvedValue(ctx) };
  const svc = new ReportsService(
    prisma, null as any, null as any, null as any, null as any, institutionContext, null as any, null as any,
  );
  jest.spyOn(svc as any, 'buildGroupReportCards').mockResolvedValue({
    institution: { id: 'inst-1' },
    academicYear: { id: 'y1' },
    term: { id: 't1' },
    academicStructure: 'AREAS_SUBJECTS',
    displayConfig: {},
    reportContent: {},
    cards,
    generatedAt: new Date('2026-01-01T00:00:00Z'),
  });
  return { svc, prisma, creados };
}

/** El mismo escenario por los dos caminos. `reSnapshotTerm` exige el término FINALIZED. */
async function porAmbosCaminos(cards: any[], ctx: any = CTX) {
  const f = montar(cards, ctx);
  await f.svc.finalizeTerm('t1', 'u1');

  const r = montar(cards, ctx);
  r.prisma.academicTerm.findUnique.mockResolvedValue({
    id: 't1', status: 'FINALIZED', academicYearId: 'y1', academicYear: { id: 'y1', institutionId: 'inst-1' },
  });
  await r.svc.reSnapshotTerm('t1', 'u1');

  const datos = (c: any[]) => c.map((s) => ({ id: s.studentEnrollmentId, ...s.data }));
  return { finalize: datos(f.creados), reSnapshot: datos(r.creados), fixtures: { f, r } };
}

describe('Datos derivados del snapshot · caracterización', () => {
  it('los dos caminos producen datos derivados idénticos', async () => {
    const { finalize, reSnapshot } = await porAmbosCaminos([
      alumno('e1', [5, 4]),
      alumno('e2', [3, 2]),
      alumno('e3', [4, 4]),
    ]);

    const derivados = (xs: any[]) =>
      xs.map((d) => ({
        id: d.id, rank: d.rank, totalStudentsRanked: d.totalStudentsRanked,
        generalAverage: d.generalAverage, approvedSubjectsCount: d.approvedSubjectsCount,
        failedSubjectsCount: d.failedSubjectsCount, promotionStatus: d.promotionStatus,
      }));

    expect(derivados(finalize)).toEqual(derivados(reSnapshot));
  });

  it('el promedio se redondea a un decimal', async () => {
    // (5 + 4 + 4) / 3 = 4.333… → 4.3
    const { finalize, reSnapshot } = await porAmbosCaminos([alumno('e1', [5, 4, 4])]);
    expect(finalize[0].generalAverage).toBe(4.3);
    expect(reSnapshot[0].generalAverage).toBe(4.3);
  });

  it('el ranking ordena por promedio descendente y empieza en 1', async () => {
    const { finalize } = await porAmbosCaminos([
      alumno('e1', [3]),
      alumno('e2', [5]),
      alumno('e3', [4]),
    ]);
    const rango = Object.fromEntries(finalize.map((d) => [d.id, d.rank]));
    expect(rango).toEqual({ e2: 1, e3: 2, e1: 3 });
    expect(finalize.every((d) => d.totalStudentsRanked === 3)).toBe(true);
  });

  it('quien no tiene notas queda fuera del ranking y no reduce el total', async () => {
    const { finalize } = await porAmbosCaminos([
      alumno('e1', [5]),
      alumno('sin-notas', []),
    ]);
    const sin = finalize.find((d) => d.id === 'sin-notas')!;
    expect(sin.rank).toBeNull();
    expect(sin.generalAverage).toBeNull();
    expect(sin.promotionStatus).toBe('PENDIENTE');
    expect(finalize.find((d) => d.id === 'e1')!.totalStudentsRanked).toBe(1);
  });

  it('las áreas INFORMATIVE no cuentan para promedio, promoción ni ranking', async () => {
    const cards = [{
      ...alumno('e1', [5]),
      areaGrades: [
        { calculationType: 'AVERAGE', subjects: [{ id: 'a', grade: 5 }] },
        { calculationType: 'INFORMATIVE', subjects: [{ id: 'b', grade: 1 }] },
      ],
    }];
    const { finalize, reSnapshot } = await porAmbosCaminos(cards);
    expect(finalize[0].generalAverage).toBe(5);
    expect(finalize[0].failedSubjectsCount).toBe(0);
    expect(finalize[0].promotionStatus).toBe('APRUEBA');
    expect(reSnapshot[0].generalAverage).toBe(5);
  });

  it('las asignaturas sin nota se ignoran en el promedio', async () => {
    const { finalize } = await porAmbosCaminos([alumno('e1', [4, null, null])]);
    expect(finalize[0].generalAverage).toBe(4);
    expect(finalize[0].approvedSubjectsCount).toBe(1);
  });

  it('una sola asignatura reprobada basta para NO_APRUEBA', async () => {
    const { finalize } = await porAmbosCaminos([alumno('e1', [5, 5, 2.9])]);
    expect(finalize[0].promotionStatus).toBe('NO_APRUEBA');
    expect(finalize[0].failedSubjectsCount).toBe(1);
    expect(finalize[0].approvedSubjectsCount).toBe(2);
  });

  it('la nota mínima aprobatoria es inclusiva: 3.0 aprueba', async () => {
    const { finalize } = await porAmbosCaminos([alumno('e1', [3.0])]);
    expect(finalize[0].promotionStatus).toBe('APRUEBA');
    expect(finalize[0].failedSubjectsCount).toBe(0);
  });

  it('en preescolar (DIMENSIONS) nadie reprueba', async () => {
    // Regla de `isFailing`: con estructura DIMENSIONS siempre devuelve false.
    const { finalize } = await porAmbosCaminos(
      [alumno('e1', [1, 1])],
      { ...CTX, academicStructure: 'DIMENSIONS' },
    );
    expect(finalize[0].failedSubjectsCount).toBe(0);
    expect(finalize[0].promotionStatus).toBe('APRUEBA');
  });

  it('un grupo que falla no impide que se procesen los demás', async () => {
    const { svc, prisma, creados } = montar([alumno('e1', [5])]);
    prisma.group.findMany.mockResolvedValue([{ id: 'malo' }, { id: 'g1' }]);
    const spy = jest.spyOn(svc as any, 'buildGroupReportCards');
    spy.mockRejectedValueOnce(new Error('grupo roto'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await svc.finalizeTerm('t1', 'u1');

    expect(res.totalSnapshots).toBe(1);
    expect(creados).toHaveLength(1);
  });
});
