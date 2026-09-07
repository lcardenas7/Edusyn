import { Reflector } from '@nestjs/core';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

/**
 * Congelado PRELIMINARY — comportamiento completo.
 *
 * La condición de fondo, en una frase: **un preliminar debe parecerse a un cierre en todo salvo en
 * ser un cierre**. Misma estructura académica, mismos números; distinto tipo, distinto momento,
 * distinta numeración, distintos permisos. Y sobre todo: no cierra nada y no toca ninguna nota.
 *
 * La numeración pura está en `preliminary-snapshot-version.spec.ts`. Aquí se prueba el flujo.
 */

const CTX = { academicStructure: 'AREAS_SUBJECTS', minPassingGrade: 3.0, maxGradeValue: 5, minGradeValue: 1 };

function alumno(enrollmentId: string, notas: number[]) {
  return {
    enrollmentId,
    student: { id: enrollmentId },
    group: { id: 'g1' },
    areaGrades: [{ calculationType: 'AVERAGE', subjects: notas.map((grade, i) => ({ id: `s${i}`, grade })) }],
    subjectGrades: [],
    structureSource: 'calculated',
    attendance: {},
    achievements: [],
    observations: [],
  };
}

function montar(opts: { status?: string; minPreliminary?: number | null; maxOficial?: number | null; cards?: any[] } = {}) {
  const cards = opts.cards ?? [alumno('e1', [5, 4]), alumno('e2', [2, 4])];
  const creados: any[] = [];
  const prisma: any = {
    academicTerm: {
      findUnique: jest.fn().mockResolvedValue({
        id: 't1',
        status: opts.status ?? 'OPEN',
        academicYearId: 'y1',
        academicYear: { id: 'y1', institutionId: 'inst-1' },
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    group: { findMany: jest.fn().mockResolvedValue([{ id: 'g1', name: 'A', grade: { name: '5' } }]) },
    termReportCardSnapshot: {
      aggregate: jest.fn().mockImplementation(({ where }: any) =>
        where?.snapshotType === 'PRELIMINARY'
          ? Promise.resolve({ _min: { version: opts.minPreliminary ?? null } })
          : Promise.resolve({ _max: { version: opts.maxOficial ?? null } }),
      ),
      create: jest.fn().mockImplementation(({ data }: any) => {
        creados.push(data);
        return Promise.resolve({});
      }),
    },
    // Cualquier escritura de nota pasaría por aquí. Se dejan como espías para poder afirmar
    // que el preliminar NO las llama.
    studentGrade: { update: jest.fn(), updateMany: jest.fn(), create: jest.fn(), createMany: jest.fn(), delete: jest.fn() },
  };
  const institutionContext: any = { getContext: jest.fn().mockResolvedValue(CTX) };
  const svc = new ReportsService(
    prisma, null as any, null as any, null as any, null as any, institutionContext, null as any, null as any,
  );
  jest.spyOn(svc as any, 'buildGroupReportCards').mockResolvedValue({
    institution: { id: 'inst-1' },
    academicYear: { id: 'y1' },
    term: { id: 't1' },
    academicStructure: 'AREAS_SUBJECTS',
    displayConfig: { mode: 'QUANTITATIVE' },
    reportContent: { showLearning: true },
    cards,
    generatedAt: new Date('2026-01-01T00:00:00Z'),
  });
  return { svc, prisma, creados };
}

// ═══════════════════════════════════════════════════════════════════════════
// A · Estructura: un preliminar NO es un boletín empobrecido
// ═══════════════════════════════════════════════════════════════════════════
describe('PRELIMINARY · estructura académica completa', () => {
  it('congela exactamente las mismas claves que un cierre oficial', async () => {
    const prelim = montar();
    await prelim.svc.createPreliminarySnapshot('t1', 'u1');

    const oficial = montar({ status: 'CLOSED' });
    await oficial.svc.finalizeTerm('t1', 'u1');

    expect(Object.keys(prelim.creados[0].data).sort())
      .toEqual(Object.keys(oficial.creados[0].data).sort());
  });

  it('el contenido académico es idéntico al del cierre, campo por campo', async () => {
    const prelim = montar();
    await prelim.svc.createPreliminarySnapshot('t1', 'u1');
    const oficial = montar({ status: 'CLOSED' });
    await oficial.svc.finalizeTerm('t1', 'u1');

    // Todo salvo lo que DEBE diferenciarlos.
    const academico = (fila: any) => {
      const { ...d } = fila.data;
      return d;
    };
    expect(academico(prelim.creados[0])).toEqual(academico(oficial.creados[0]));
    expect(academico(prelim.creados[1])).toEqual(academico(oficial.creados[1]));
  });

  it('trae ranking, promedio y estado de promoción calculados', async () => {
    const { svc, creados } = montar();
    await svc.createPreliminarySnapshot('t1', 'u1');

    const e1 = creados.find((c) => c.studentEnrollmentId === 'e1')!.data;
    const e2 = creados.find((c) => c.studentEnrollmentId === 'e2')!.data;

    expect(e1.generalAverage).toBe(4.5);
    expect(e1.rank).toBe(1);
    expect(e1.promotionStatus).toBe('APRUEBA');

    expect(e2.generalAverage).toBe(3);
    expect(e2.rank).toBe(2);
    expect(e2.promotionStatus).toBe('NO_APRUEBA');
    expect(e2.failedSubjectsCount).toBe(1);

    expect(e1.totalStudentsRanked).toBe(2);
  });

  it('conserva el contrato de publicación congelado (C-4)', async () => {
    const { svc, creados } = montar();
    await svc.createPreliminarySnapshot('t1', 'u1');
    for (const campo of ['reportContent', 'academicStructure', 'displayConfig']) {
      expect(creados[0].data).toHaveProperty(campo);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// B · Numeración: nunca desplaza la secuencia oficial
// ═══════════════════════════════════════════════════════════════════════════
describe('PRELIMINARY · numeración frente a los cierres', () => {
  it('el primero se guarda con versión −1 y tipo PRELIMINARY', async () => {
    const { svc, creados } = montar();
    const res = await svc.createPreliminarySnapshot('t1', 'u1');

    expect(res.version).toBe(-1);
    expect(creados.every((c) => c.version === -1)).toBe(true);
    expect(creados.every((c) => c.snapshotType === 'PRELIMINARY')).toBe(true);
  });

  it('varios preliminares seguidos bajan de uno en uno', async () => {
    expect((await montar({ minPreliminary: -1 }).svc.createPreliminarySnapshot('t1', 'u')).version).toBe(-2);
    expect((await montar({ minPreliminary: -2 }).svc.createPreliminarySnapshot('t1', 'u')).version).toBe(-3);
  });

  it('tras varios preliminares, el PRIMER cierre oficial sigue siendo la versión 1', async () => {
    // Éste es el fallo que la numeración negativa existe para evitar: si los preliminares
    // contaran en MAX(version), el cierre habría nacido con versión 0.
    const { svc, creados } = montar({ status: 'CLOSED', minPreliminary: -3, maxOficial: null });
    const res = await svc.finalizeTerm('t1', 'u1');

    expect(res.version).toBe(1);
    expect(creados.every((c) => c.version === 1)).toBe(true);
  });

  it('un re-snapshot oficial conserva su propia secuencia, ignorando los preliminares', async () => {
    const { svc } = montar({ status: 'FINALIZED', minPreliminary: -5, maxOficial: 2 });
    const res = await svc.reSnapshotTerm('t1', 'u1');
    expect(res.version).toBe(3);
  });

  it('el cálculo oficial excluye PRELIMINARY explícitamente en la consulta', async () => {
    const { svc, prisma } = montar({ status: 'CLOSED' });
    await svc.finalizeTerm('t1', 'u1');

    const consultaOficial = prisma.termReportCardSnapshot.aggregate.mock.calls
      .map((c: any[]) => c[0])
      .find((a: any) => a._max);
    expect(consultaOficial.where.snapshotType).toEqual({ not: 'PRELIMINARY' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C · Lo que un preliminar NO puede hacer
// ═══════════════════════════════════════════════════════════════════════════
describe('PRELIMINARY · no cierra y no toca notas', () => {
  it('no modifica el estado del período', async () => {
    const { svc, prisma } = montar({ status: 'OPEN' });
    const res = await svc.createPreliminarySnapshot('t1', 'u1');

    expect(prisma.academicTerm.update).not.toHaveBeenCalled();
    expect(res.termStatus).toBe('OPEN');
  });

  it('no escribe ninguna nota', async () => {
    const { svc, prisma } = montar();
    await svc.createPreliminarySnapshot('t1', 'u1');

    for (const op of Object.values(prisma.studentGrade) as jest.Mock[]) {
      expect(op).not.toHaveBeenCalled();
    }
  });

  it('funciona con el período ABIERTO — que es justamente su razón de ser', async () => {
    const { svc } = montar({ status: 'OPEN' });
    await expect(svc.createPreliminarySnapshot('t1', 'u1')).resolves.toMatchObject({ success: true });
  });

  it('se rechaza sobre un período ya FINALIZED', async () => {
    const { svc, prisma } = montar({ status: 'FINALIZED' });
    await expect(svc.createPreliminarySnapshot('t1', 'u1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.termReportCardSnapshot.create).not.toHaveBeenCalled();
  });

  it('período inexistente → 404, sin escribir nada', async () => {
    const { svc, prisma } = montar();
    prisma.academicTerm.findUnique.mockResolvedValue(null);
    await expect(svc.createPreliminarySnapshot('nope', 'u1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.termReportCardSnapshot.create).not.toHaveBeenCalled();
  });

  it('sin grupos activos no inventa un congelado vacío', async () => {
    const { svc, prisma } = montar();
    prisma.group.findMany.mockResolvedValue([]);
    await expect(svc.createPreliminarySnapshot('t1', 'u1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('un grupo que falla no aborta los demás y queda reportado', async () => {
    const { svc } = montar();
    (svc as any).buildGroupReportCards.mockRejectedValueOnce(new Error('grupo roto'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await svc.createPreliminarySnapshot('t1', 'u1');

    expect(res.totalSnapshots).toBe(0);
    expect(res.groupResults[0].error).toBe('grupo roto');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D · Permisos y aislamiento (a nivel de aplicación)
// ═══════════════════════════════════════════════════════════════════════════
describe('PRELIMINARY · permisos y tenant', () => {
  const handler = ReportsController.prototype.createPreliminarySnapshot;

  it('lo pueden pedir coordinación y administración, según la decisión del rector', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, handler) as string[];
    expect(roles.sort()).toEqual(['ADMIN_INSTITUTIONAL', 'COORDINADOR', 'SUPERADMIN']);
  });

  it('NO lo puede pedir un docente ni un estudiante', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, handler) as string[];
    expect(roles).not.toContain('DOCENTE');
    expect(roles).not.toContain('ESTUDIANTE');
  });

  it('cuelga de una ruta propia, distinta de la de finalizar', () => {
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('terms/:termId/preliminary-snapshot');
    expect(new Reflector().get(ROLES_KEY, ReportsController.prototype.finalizeTerm))
      .not.toContain('COORDINADOR');
  });

  it('exige que el período pertenezca a la institución antes de congelar nada', async () => {
    const reportsService = {
      assertTermScope: jest.fn().mockRejectedValue(new NotFoundException()),
      createPreliminarySnapshot: jest.fn(),
    };
    const controller = new ReportsController(
      reportsService as any, {} as any, {} as any,
      { getUserCapabilities: jest.fn() } as any, {} as any,
      { recordSingle: jest.fn(), recordBulk: jest.fn() } as any,
    );

    await expect(
      controller.createPreliminarySnapshot('t-de-otra', { user: { sub: 'u1', institutionId: 'inst-1' } }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(reportsService.createPreliminarySnapshot).not.toHaveBeenCalled();
  });
});
