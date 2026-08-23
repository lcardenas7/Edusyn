import { NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AchievementService } from './achievement.service';
import { AchievementConfigService } from './achievement-config.service';
import { AchievementController } from './achievement.controller';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';

/**
 * Aislamiento multi-tenant de las LECTURAS de `achievements` — hallazgo A-17.
 *
 * Las 13 lecturas HTTP del módulo caían en tres formas distintas, y por eso no se
 * les aplicó el mismo remedio mecánicamente:
 *
 *  Grupo A (4) · recibían `institutionId` del PATH o del QUERY y lo trataban como
 *    autoridad. No necesitan aserto: la consulta ya filtra por institución; basta
 *    sustituir el ancla por la del actor.
 *  Grupo B (7) · reciben `teacherAssignmentId`. Dos de ellas lo desreferencian a
 *    `groupId`/`subjectId`; las otras cinco lo expanden con `getAllAssignmentIds`
 *    a todas las asignaciones del mismo (año, grupo, asignatura). El aserto va
 *    ANTES de esa expansión.
 *  Grupo C (2) · reciben el id del recurso: basta comprobar su pertenencia.
 *
 * `academicTermId` no se cotejaba en NINGUNA de las 7 del Grupo B.
 *
 * FUERA DE ALCANCE: `reports.service.ts` lee `StudentAchievement` en 3 sitios.
 * A-17 cierra las lecturas HTTP del módulo, no todas las lecturas de sus entidades.
 */

const A = 'inst-aaa';
const B = 'inst-bbb';

const actorDe = (institutionId: string | null, roles: string[] = ['DOCENTE']) => ({
  user: { id: 'u1', institutionId, isSuperAdmin: false, roles },
});
const superAdmin = () => ({
  user: { id: 'sa', institutionId: null, isSuperAdmin: true, roles: ['SUPERADMIN'] },
});

function buildDb() {
  const assignments = [
    { id: 'ta-a', institutionId: A, academicYearId: 'y-a', groupId: 'g-a', subjectId: 'sub-a', group: { gradeId: 'gr-a' } },
    { id: 'ta-a2', institutionId: A, academicYearId: 'y-a', groupId: 'g-a', subjectId: 'sub-a', group: { gradeId: 'gr-a' } }, // hermana
    { id: 'ta-b', institutionId: B, academicYearId: 'y-b', groupId: 'g-b', subjectId: 'sub-b', group: { gradeId: 'gr-b' } },
  ];
  const years = [{ id: 'y-a', institutionId: A }, { id: 'y-b', institutionId: B }];
  const terms = [{ id: 't-a', academicYearId: 'y-a' }, { id: 't-b', academicYearId: 'y-b' }];
  const enrollments = [{ id: 'enr-a', institutionId: A, groupId: 'g-a' }, { id: 'enr-b', institutionId: B, groupId: 'g-b' }];
  const achievements = [{ id: 'ach-a', institutionId: A }, { id: 'ach-b', institutionId: B }];
  const grades = [{ id: 'gr-a', institutionId: A }, { id: 'gr-b', institutionId: B }];
  const areas = [{ id: 'area-a', institutionId: A }, { id: 'area-b', institutionId: B }];
  const subjects = [
    { id: 'sub-a', areaId: 'area-a', code: 'DIM', subjectType: 'PRESCHOOL_DIMENSION' },
    { id: 'sub-b', areaId: 'area-b', code: 'DIM', subjectType: 'PRESCHOOL_DIMENSION' },
  ];

  /** Registra cada consulta de datos para poder afirmar qué ámbito se leyó. */
  const reads: Array<{ model: string; where: any }> = [];
  const log = (model: string) => (args: any) => { reads.push({ model, where: args?.where }); };

  const yearOf = (t: any) => years.find((y) => y.id === t.academicYearId);
  const areaOf = (s: any) => areas.find((a) => a.id === s.areaId);

  const prisma: any = {
    teacherAssignment: {
      findFirst: jest.fn(async ({ where }: any) =>
        assignments.find((a) => a.id === where.id && (where.institutionId === undefined || a.institutionId === where.institutionId)) ?? null,
      ),
      findUnique: jest.fn(async ({ where }: any) => assignments.find((a) => a.id === where.id) ?? null),
      findMany: jest.fn(async ({ where }: any) =>
        assignments.filter((a) => a.academicYearId === where.academicYearId && a.groupId === where.groupId && a.subjectId === where.subjectId)
          .map((a) => ({ id: a.id })),
      ),
    },
    academicTerm: {
      findFirst: jest.fn(async ({ where }: any) =>
        terms.find((t) => t.id === where.id &&
          (where.academicYear?.institutionId === undefined || yearOf(t)?.institutionId === where.academicYear.institutionId) &&
          (where.academicYearId === undefined || t.academicYearId === where.academicYearId)) ?? null,
      ),
      findMany: jest.fn(async () => []),
    },
    studentEnrollment: {
      findFirst: jest.fn(async ({ where }: any) =>
        enrollments.find((e) => e.id === where.id && (where.institutionId === undefined || e.institutionId === where.institutionId)) ?? null,
      ),
      findMany: jest.fn(async (args: any) => { log('studentEnrollment')(args); return enrollments.filter((e) => e.groupId === args.where.groupId).map((e) => ({ id: e.id })); }),
    },
    achievement: {
      findFirst: jest.fn(async ({ where }: any) =>
        achievements.find((a) => a.id === where.id && (where.institutionId === undefined || a.institutionId === where.institutionId)) ?? null,
      ),
      findMany: jest.fn(async (args: any) => { log('achievement')(args); return []; }),
    },
    grade: { findFirst: jest.fn(async ({ where }: any) => grades.find((g) => g.id === where.id && g.institutionId === where.institutionId) ?? null) },
    subject: {
      findFirst: jest.fn(async ({ where }: any) =>
        subjects.find((s) => s.id === where.id && (where.area?.institutionId === undefined || areaOf(s)?.institutionId === where.area.institutionId)) ?? null,
      ),
    },
    academicYear: { findFirst: jest.fn(async ({ where }: any) => years.find((y) => y.id === where.id && y.institutionId === where.institutionId) ?? null) },
    convivenciaEntry: { findMany: jest.fn(async (args: any) => { log('convivenciaEntry')(args); return []; }) },
    studentEvidenceValuation: { findMany: jest.fn(async (args: any) => { log('studentEvidenceValuation')(args); return []; }) },
    studentAchievement: { findMany: jest.fn(async (args: any) => { log('studentAchievement')(args); return []; }) },
    attitudinalAchievement: { findMany: jest.fn(async (args: any) => { log('attitudinalAchievement')(args); return []; }) },
    achievementConfig: {
      findUnique: jest.fn(async (args: any) => { log('achievementConfig')(args); return { id: 'cfg-' + args.where.institutionId }; }),
    },
    valueJudgmentTemplate: { findMany: jest.fn(async (args: any) => { log('valueJudgmentTemplate')(args); return []; }) },
    observationTemplate: { findMany: jest.fn(async (args: any) => { log('observationTemplate')(args); return []; }) },
    institutionUser: { findFirst: jest.fn(async () => null) },
  };

  return { prisma, reads };
}

const build = () => {
  const db = buildDb();
  const service = new AchievementService(db.prisma as any);
  const config = new AchievementConfigService(db.prisma as any);
  const controller = new AchievementController(service, config as any, db.prisma as any);
  return { ...db, service, config, controller };
};

const CAT = (inst: string, grade: string, sub: string, year: string) => ({
  institutionId: inst, gradeId: grade, subjectId: sub, academicYearId: year,
});

// ═══════════════════════════════════════════════════════════════════════════════
// GRUPO A · el institutionId del cliente deja de ser autoridad (rutas 1-4)
// ═══════════════════════════════════════════════════════════════════════════════
describe('Grupo A · config y catálogo', () => {
  it('1 · GET /config/:institutionId — un path ajeno NO cambia el tenant efectivo', async () => {
    const { controller, reads } = build();
    await controller.getConfig(B, actorDe(A));            // pide la config de B…
    expect(reads[0].where).toEqual({ institutionId: A }); // …y se consulta la de A
  });

  it('2 · GET /config/:institutionId/templates — idem', async () => {
    const { controller, reads } = build();
    await controller.getValueJudgmentTemplates(B, actorDe(A));
    expect(reads[0].where).toEqual({ institutionId: A });
  });

  it('3 · GET /config/:institutionId/observation-templates — idem', async () => {
    const { controller, reads } = build();
    await controller.getObservationTemplates(B, actorDe(A));
    expect(reads[0].where).toEqual({ institutionId: A });
  });

  it('4 · GET /catalog — institutionId=B con recursos coherentes de B es rechazado', async () => {
    const { controller } = build();
    await expect(
      controller.getCatalogAchievements(CAT(B, 'gr-b', 'sub-b', 'y-b') as any, actorDe(A)),
    ).rejects.toThrow(NotFoundException);
  });

  it('4 · GET /catalog — el ámbito consultado usa la institución del actor', async () => {
    const { controller, reads } = build();
    await controller.getCatalogAchievements(CAT(B, 'gr-a', 'sub-a', 'y-a') as any, actorDe(A));
    const q = reads.find((r) => r.model === 'achievement');
    expect(q!.where.institutionId).toBe(A);
  });

  it('4 · A/A legítimo sigue funcionando', async () => {
    const { controller, reads } = build();
    await controller.getCatalogAchievements(CAT(A, 'gr-a', 'sub-a', 'y-a') as any, actorDe(A));
    expect(reads.some((r) => r.model === 'achievement')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GRUPO B · teacherAssignmentId (rutas 5,6,7,8,9,12,13)
// ═══════════════════════════════════════════════════════════════════════════════
describe('Grupo B · lecturas por asignación docente', () => {
  const casos: Array<[string, (c: any, ta: string, term: string, actor: any) => Promise<any>]> = [
    ['5 · convivencia', (c, ta, term, a) => c.getConvivencia(ta, term, a)],
    ['6 · evidence-valuations', (c, ta, term, a) => c.getEvidenceValuations(ta, term, a)],
    ['7 · by-assignment', (c, ta, term, a) => c.getAchievementsByAssignment(ta, term, a)],
    ['9 · attitudinal', (c, ta, term, a) => c.getAttitudinalAchievements(ta, term, a)],
    ['12 · validate', (c, ta, term, a) => c.validatePeriodAchievements(ta, term, '2', a)],
    ['13 · unapproved', (c, ta, term, a) => c.getUnapprovedStudentAchievements(ta, term, a)],
  ];

  it.each(casos)('%s · A/A permitido', async (_n, call) => {
    const { controller, reads } = build();
    await call(controller, 'ta-a', 't-a', actorDe(A));
    expect(reads.length).toBeGreaterThan(0);
  });

  it.each(casos)('%s · A/B: asignación de B no devuelve datos de B', async (_n, call) => {
    const { controller, reads } = build();
    await expect(call(controller, 'ta-b', 't-b', actorDe(A))).rejects.toThrow(NotFoundException);
    expect(reads).toHaveLength(0);
  });

  it.each(casos)('%s · B/A: actor de B no lee la asignación de A', async (_n, call) => {
    const { controller, reads } = build();
    await expect(call(controller, 'ta-a', 't-a', actorDe(B))).rejects.toThrow(NotFoundException);
    expect(reads).toHaveLength(0);
  });

  it.each(casos)('%s · asignación A + período B → rechazado', async (_n, call) => {
    const { controller, reads } = build();
    await expect(call(controller, 'ta-a', 't-b', actorDe(A))).rejects.toThrow(NotFoundException);
    expect(reads).toHaveLength(0);
  });

  it.each(casos)('%s · asignación inexistente = asignación ajena', async (_n, call) => {
    const { controller } = build();
    const ajena = await call(build().controller, 'ta-b', 't-a', actorDe(A)).catch((e: any) => e);
    const inexistente = await call(controller, 'no-existe', 't-a', actorDe(A)).catch((e: any) => e);
    expect(inexistente.message).toBe(ajena.message);
  });

  it('8 · promotional — A/A, A/B y B/A', async () => {
    const ok = build();
    await ok.controller.getPromotionalAchievements('ta-a', actorDe(A));
    expect(ok.reads.length).toBeGreaterThan(0);

    const ko = build();
    await expect(ko.controller.getPromotionalAchievements('ta-b', actorDe(A))).rejects.toThrow(NotFoundException);
    expect(ko.reads).toHaveLength(0);

    const ko2 = build();
    await expect(ko2.controller.getPromotionalAchievements('ta-a', actorDe(B))).rejects.toThrow(NotFoundException);
    expect(ko2.reads).toHaveLength(0);
  });

  it('la expansión getAllAssignmentIds SIGUE funcionando tras el aserto', async () => {
    const { controller, prisma, reads } = build();
    await controller.getAchievementsByAssignment('ta-a', 't-a', actorDe(A));
    // Debe haber consultado las asignaciones hermanas del mismo (año, grupo, asignatura)…
    expect(prisma.teacherAssignment.findMany).toHaveBeenCalled();
    // …y filtrado por las DOS de A, no solo por la recibida.
    const q = reads.find((r) => r.model === 'achievement');
    expect(q!.where.OR[0].teacherAssignmentId.in).toEqual(['ta-a', 'ta-a2']);
  });

  it('5/6 siguen resolviendo por grupo tras el aserto', async () => {
    const c1 = build();
    await c1.controller.getConvivencia('ta-a', 't-a', actorDe(A));
    expect(c1.reads.find((r) => r.model === 'convivenciaEntry')!.where.studentEnrollment).toEqual({ groupId: 'g-a' });

    const c2 = build();
    await c2.controller.getEvidenceValuations('ta-a', 't-a', actorDe(A));
    expect(c2.reads.find((r) => r.model === 'studentEnrollment')!.where).toEqual({ groupId: 'g-a' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GRUPO C · id de recurso (rutas 10, 11)
// ═══════════════════════════════════════════════════════════════════════════════
describe('Grupo C · lecturas por id de recurso', () => {
  it('10 · students/:achievementId — A/A, A/B, B/A', async () => {
    const ok = build();
    await ok.controller.getStudentAchievements('ach-a', actorDe(A));
    expect(ok.reads.some((r) => r.model === 'studentAchievement')).toBe(true);

    const ko = build();
    await expect(ko.controller.getStudentAchievements('ach-b', actorDe(A))).rejects.toThrow(NotFoundException);
    expect(ko.reads).toHaveLength(0);

    const ko2 = build();
    await expect(ko2.controller.getStudentAchievements('ach-a', actorDe(B))).rejects.toThrow(NotFoundException);
    expect(ko2.reads).toHaveLength(0);
  });

  it('10 · aprendizaje inexistente = aprendizaje ajeno', async () => {
    const ajeno = await build().controller.getStudentAchievements('ach-b', actorDe(A)).catch((e: any) => e);
    const inex = await build().controller.getStudentAchievements('no-existe', actorDe(A)).catch((e: any) => e);
    expect(inex.message).toBe(ajeno.message);
  });

  it('11 · by-enrollment — A/A, A/B, B/A', async () => {
    const ok = build();
    await ok.controller.getStudentAchievementsByEnrollment('enr-a', actorDe(A), 't-a');
    expect(ok.reads.some((r) => r.model === 'studentAchievement')).toBe(true);

    const ko = build();
    await expect(ko.controller.getStudentAchievementsByEnrollment('enr-b', actorDe(A), 't-b')).rejects.toThrow(NotFoundException);
    expect(ko.reads).toHaveLength(0);

    const ko2 = build();
    await expect(ko2.controller.getStudentAchievementsByEnrollment('enr-a', actorDe(B), 't-a')).rejects.toThrow(NotFoundException);
    expect(ko2.reads).toHaveLength(0);
  });

  it('11 · matrícula A + período B → rechazado', async () => {
    const { controller, reads } = build();
    await expect(
      controller.getStudentAchievementsByEnrollment('enr-a', actorDe(A), 't-b'),
    ).rejects.toThrow(NotFoundException);
    expect(reads).toHaveLength(0);
  });

  it('11 · sin academicTermId sigue funcionando (parámetro opcional)', async () => {
    const { controller, reads } = build();
    await controller.getStudentAchievementsByEnrollment('enr-a', actorDe(A));
    expect(reads.find((r) => r.model === 'studentAchievement')!.where).toEqual({ studentEnrollmentId: 'enr-a' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SuperAdmin — misma política que A-1…A-5, sin excepción para A-17
// ═══════════════════════════════════════════════════════════════════════════════
describe('SuperAdmin', () => {
  it('sin InstitutionUser no obtiene institución y la lectura se rechaza', async () => {
    const { controller, reads } = build();
    await expect(controller.getStudentAchievements('ach-a', superAdmin())).rejects.toThrow();
    expect(reads).toHaveLength(0);
  });

  it('tampoco puede leer la config indicando el path de otra institución', async () => {
    const { controller, reads } = build();
    await expect(controller.getConfig(B, superAdmin())).rejects.toThrow();
    expect(reads).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Roles intactos
// ═══════════════════════════════════════════════════════════════════════════════
describe('los @Roles de las 13 lecturas no cambian', () => {
  const reflector = new Reflector();
  const rolesDe = (m: string) => reflector.get<string[]>(ROLES_KEY, (AchievementController.prototype as any)[m]);
  const CUATRO = ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE'];
  const TRES = ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR'];

  it.each([
    ['getConfig', CUATRO],
    ['getValueJudgmentTemplates', TRES],
    ['getObservationTemplates', CUATRO],
    ['getCatalogAchievements', TRES],
    ['getConvivencia', CUATRO],
    ['getEvidenceValuations', CUATRO],
    ['getAchievementsByAssignment', CUATRO],
    ['getPromotionalAchievements', CUATRO],
    ['getAttitudinalAchievements', CUATRO],
    ['getStudentAchievements', CUATRO],
    ['getStudentAchievementsByEnrollment', CUATRO],
    ['validatePeriodAchievements', CUATRO],
    ['getUnapprovedStudentAchievements', CUATRO],
  ])('%s conserva sus roles', (m, esperado) => {
    expect(rolesDe(m as string)).toEqual(esperado);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Frontera: ninguna lectura HTTP del módulo queda sin resolver institución
// ═══════════════════════════════════════════════════════════════════════════════
describe('frontera de lectura HTTP del módulo', () => {
  it('las 15 lecturas de los controladores resuelven institución', () => {
    const fs = require('fs');
    const path = require('path');
    const abiertas: string[] = [];
    for (const f of fs.readdirSync(__dirname).filter((x: string) => x.endsWith('.controller.ts'))) {
      const L = fs.readFileSync(path.join(__dirname, f), 'utf8').split(/\r?\n/);
      const M = /@(Get|Post|Put|Patch|Delete)\(/;
      const st: number[] = [];
      L.forEach((l: string, i: number) => { if (M.test(l)) st.push(i); });
      for (let k = 0; k < st.length; k++) {
        const body = L.slice(st[k], k + 1 < st.length ? st[k + 1] : L.length).join('\n');
        if (!/^\s*@Get\(/m.test(body.split('\n')[0])) continue;
        if (!/requireInstitutionId|resolveInstitutionId/.test(body)) {
          abiertas.push(f + ' :: ' + (/@Get\(\s*'([^']*)'/.exec(body)?.[1] ?? '(raíz)'));
        }
      }
    }
    expect(abiertas).toEqual([]);
  });
});
