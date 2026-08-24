import { NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AchievementService } from './achievement.service';
import { AchievementController } from './achievement.controller';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';

/**
 * Aislamiento multi-tenant del CRUD de aprendizajes y evidencias — A-6…A-12.
 *
 * Este bloque no se parecía a los anteriores: cinco de las once rutas construyen
 * mensajes de error interpolando datos del recurso —el texto del aprendizaje, el de
 * sus evidencias, el número de valoraciones, el nombre y estado del período—. Con un
 * id ajeno, un actor de A podía EXTRAER ese contenido de B sin escribir una sola fila.
 *
 * Por eso la propiedad que se protege aquí no es solo «no escribió», sino
 * «no pudo descubrir nada del recurso ajeno antes de ser rechazado»: el aserto corre
 * antes de `assertCatalogWritable`, de `loadEvidenceContext`, de `reconcileEvidences`
 * y de cualquier consulta de valoraciones.
 *
 * Las ocho salvaguardas académicas quedan INTACTAS y se fijan nominalmente abajo.
 */

const A = 'inst-aaa';
const B = 'inst-bbb';

const actorDe = (institutionId: string | null, roles: string[] = ['DOCENTE']) => ({
  user: { id: 'u1', email: 'u@a', institutionId, isSuperAdmin: false, roles },
});
const coord = (institutionId: string | null) => ({
  user: { id: 'u1', email: 'u@a', institutionId, isSuperAdmin: false, roles: ['COORDINADOR'] },
});
const superAdmin = () => ({
  user: { id: 'sa', email: 's@a', institutionId: null, isSuperAdmin: true, roles: ['SUPERADMIN'] },
});

function buildDb() {
  const assignments = [
    { id: 'ta-a', institutionId: A, academicYearId: 'y-a', groupId: 'g-a', subjectId: 'sub-a' },
    { id: 'ta-b', institutionId: B, academicYearId: 'y-b', groupId: 'g-b', subjectId: 'sub-b' },
  ];
  const years = [{ id: 'y-a', institutionId: A }, { id: 'y-b', institutionId: B }];
  const terms = [
    { id: 't-a', academicYearId: 'y-a', order: 2, status: 'OPEN', name: 'Periodo A' },
    { id: 't-a-prev', academicYearId: 'y-a', order: 1, status: 'OPEN', name: 'Periodo A previo' },
    { id: 't-b', academicYearId: 'y-b', order: 2, status: 'OPEN', name: 'SECRETO-PERIODO-B' },
  ];
  const achievements = [
    { id: 'ach-a', institutionId: A, baseDescription: 'Aprendizaje de A', academicYearId: 'y-a', academicTermId: 't-a', teacherAssignmentId: 'ta-a', gradeId: null, teacherAssignment: { academicYearId: 'y-a' } },
    { id: 'ach-b', institutionId: B, baseDescription: 'SECRETO-TEXTO-B', academicYearId: 'y-b', academicTermId: 't-b', teacherAssignmentId: 'ta-b', gradeId: null, teacherAssignment: { academicYearId: 'y-b' } },
  ];
  const evidences = [
    { id: 'ev-a', achievementId: 'ach-a', text: 'Evidencia de A', retiredFromTermId: null, retiredAt: null, orderNumber: 1 },
    { id: 'ev-b', achievementId: 'ach-b', text: 'SECRETO-EVIDENCIA-B', retiredFromTermId: 't-b', retiredAt: new Date(), orderNumber: 1 },
  ];
  const attitudinal = [
    { id: 'at-a', institutionId: A, teacherAssignmentId: 'ta-a', academicTermId: 't-a', achievementId: null },
    // Fila INCOHERENTE: terna de A, institutionId de B (escenario E)
    { id: 'at-incoh', institutionId: B, teacherAssignmentId: 'ta-a', academicTermId: 't-a-prev', achievementId: null },
  ];

  const writes: Array<{ op: string; args: any }> = [];
  const w = (op: string) => jest.fn(async (args: any) => { writes.push({ op, args }); return { id: 'new', ...(args?.data ?? {}) }; });

  const yearOf = (t: any) => years.find((y) => y.id === t.academicYearId);
  const achOf = (e: any) => achievements.find((a) => a.id === e.achievementId);

  const prisma: any = {
    teacherAssignment: {
      findFirst: jest.fn(async ({ where }: any) => assignments.find((a) => a.id === where.id && (where.institutionId === undefined || a.institutionId === where.institutionId)) ?? null),
      findUnique: jest.fn(async ({ where }: any) => {
        const a = assignments.find((x) => x.id === where.id);
        return a ? { ...a, subject: { code: 'MAT' }, group: { gradeId: 'gr-a' } } : null;
      }),
      findMany: jest.fn(async () => assignments.map((a) => ({ id: a.id }))),
    },
    academicTerm: {
      findFirst: jest.fn(async ({ where }: any) => terms.find((t) => t.id === where.id &&
        (where.academicYear?.institutionId === undefined || yearOf(t)?.institutionId === where.academicYear.institutionId)) ?? null),
      findUnique: jest.fn(async ({ where }: any) => terms.find((t) => t.id === where.id) ?? null),
      findMany: jest.fn(async () => terms.map((t) => ({ id: t.id, order: t.order }))),
    },
    achievement: {
      findFirst: jest.fn(async ({ where }: any) => achievements.find((a) => a.id === where.id && (where.institutionId === undefined || a.institutionId === where.institutionId)) ?? null),
      findUnique: jest.fn(async ({ where }: any) => { const a = achievements.find((x) => x.id === where.id); return a ? { ...a, levelDescriptors: [], evidences: [], code: 'LOG-1', achievementType: 'ACADEMIC', orderNumber: 1 } : null; }),
      findMany: jest.fn(async () => []),
      create: w('achievement.create'),
      update: w('achievement.update'),
      delete: w('achievement.delete'),
    },
    achievementEvidence: {
      findFirst: jest.fn(async ({ where }: any) => evidences.find((e) => e.id === where.id &&
        (where.achievement?.institutionId === undefined || achOf(e)?.institutionId === where.achievement.institutionId)) ?? null),
      findUnique: jest.fn(async ({ where }: any) => evidences.find((e) => e.id === where.id) ?? null),
      findMany: jest.fn(async ({ where }: any) => evidences.filter((e) => e.achievementId === where?.achievementId)),
      create: w('evidence.create'),
      update: w('evidence.update'),
      updateMany: w('evidence.updateMany'),
      delete: w('evidence.delete'),
      deleteMany: w('evidence.deleteMany'),
    },
    achievementLevelDescriptor: { deleteMany: w('descriptor.deleteMany'), createMany: w('descriptor.createMany') },
    studentAchievement: { count: jest.fn(async () => 0), findMany: jest.fn(async () => []) },
    studentEvidenceValuation: { count: jest.fn(async () => 0), findMany: jest.fn(async () => []) },
    attitudinalAchievement: {
      findFirst: jest.fn(async ({ where }: any) => attitudinal.find((a) =>
        a.teacherAssignmentId === where.teacherAssignmentId &&
        a.academicTermId === where.academicTermId &&
        a.achievementId === (where.achievementId ?? null)) ?? null),
      count: jest.fn(async () => 0),
      update: w('attitudinal.update'),
      create: w('attitudinal.create'),
    },
    $transaction: jest.fn(async (ops: any) => (typeof ops === 'function' ? ops(prisma) : Promise.all(ops))),
    institutionUser: { findFirst: jest.fn(async () => null) },
  };
  return { prisma, writes };
}

const build = () => {
  const db = buildDb();
  const service = new AchievementService(db.prisma as any);
  const controller = new AchievementController(service, {} as any, db.prisma as any);
  return { ...db, service, controller };
};

const NUEVO = (ta: string, term: string) => ({
  teacherAssignmentId: ta, academicTermId: term, orderNumber: 1, baseDescription: 'Nuevo',
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1) Matriz A/A · A/B · B/A por ruta
// ═══════════════════════════════════════════════════════════════════════════════
type Caso = [string, (c: any, id: string, actor: any) => Promise<any>];
const porAchievement: Caso[] = [
  ['A-7a · PUT /:id', (c, id, a) => c.updateAchievement(id, { baseDescription: 'x' }, a)],
  ['A-7b · POST /:id/duplicate', (c, id, a) => c.duplicateAchievement(id, a)],
  ['A-7c · DELETE /:id', (c, id, a) => c.deleteAchievement(id, a)],
  ['A-8a · POST /:id/evidences', (c, id, a) => c.createEvidence(id, { text: 'x' }, a)],
  ['A-8b · PUT /:id/evidences/reorder', (c, id, a) => c.reorderEvidences(id, { orderedIds: ['ev-a'] }, a)],
];
const porEvidencia: Caso[] = [
  ['A-9 · PUT /evidences/:id', (c, id, a) => c.updateEvidence(id, { text: 'x' }, a)],
  ['A-11 · PUT /evidences/:id/reactivate', (c, id, a) => c.reactivateEvidence(id, {}, a)],
  ['A-12a · DELETE /evidences/:id', (c, id, a) => c.deleteEvidence(id, a)],
];

describe('A-6…A-12 · rutas por achievementId', () => {
  it.each(porAchievement)('%s · A/A permitido', async (_n, call) => {
    const { controller, writes } = build();
    await call(controller, 'ach-a', actorDe(A));
    expect(writes.length).toBeGreaterThan(0);
  });

  it.each(porAchievement)('%s · A/B rechazado sin escribir', async (_n, call) => {
    const { controller, writes } = build();
    await expect(call(controller, 'ach-b', actorDe(A))).rejects.toThrow(NotFoundException);
    expect(writes).toHaveLength(0);
  });

  it.each(porAchievement)('%s · B/A rechazado sin escribir', async (_n, call) => {
    const { controller, writes } = build();
    await expect(call(controller, 'ach-a', actorDe(B))).rejects.toThrow(NotFoundException);
    expect(writes).toHaveLength(0);
  });

  it.each(porAchievement)('%s · inexistente ≡ ajeno', async (_n, call) => {
    const ajeno = await call(build().controller, 'ach-b', actorDe(A)).catch((e: any) => e);
    const inex = await call(build().controller, 'no-existe', actorDe(A)).catch((e: any) => e);
    expect(inex.message).toBe(ajeno.message);
  });
});

describe('A-6…A-12 · rutas por achievementEvidenceId', () => {
  it.each(porEvidencia)('%s · A/B rechazado sin escribir', async (_n, call) => {
    const { controller, writes } = build();
    await expect(call(controller, 'ev-b', coord(A))).rejects.toThrow(NotFoundException);
    expect(writes).toHaveLength(0);
  });

  it.each(porEvidencia)('%s · B/A rechazado sin escribir', async (_n, call) => {
    const { controller, writes } = build();
    await expect(call(controller, 'ev-a', coord(B))).rejects.toThrow(NotFoundException);
    expect(writes).toHaveLength(0);
  });

  it.each(porEvidencia)('%s · inexistente ≡ ajeno', async (_n, call) => {
    const ajeno = await call(build().controller, 'ev-b', coord(A)).catch((e: any) => e);
    const inex = await call(build().controller, 'no-existe', coord(A)).catch((e: any) => e);
    expect(inex.message).toBe(ajeno.message);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2) NO-FUGA POR MENSAJE — la propiedad propia de este bloque
// ═══════════════════════════════════════════════════════════════════════════════
describe('no se descubre NADA del recurso ajeno antes del rechazo', () => {
  const noFiltra = (err: any) => {
    expect(err).toBeInstanceOf(NotFoundException);
    expect(err).not.toBeInstanceOf(ConflictException);
    expect(err).not.toBeInstanceOf(ForbiddenException);
    expect(err.message).not.toMatch(/SECRETO/);
  };

  it('DELETE /achievements/:id no revela el texto del aprendizaje ni el de sus evidencias', async () => {
    const { controller, prisma } = build();
    const err = await controller.deleteAchievement('ach-b', actorDe(A)).catch((e: any) => e);
    noFiltra(err);
    // Y ninguna de las consultas que construyen el mensaje llegó a ejecutarse.
    expect(prisma.studentAchievement.count).not.toHaveBeenCalled();
    expect(prisma.studentEvidenceValuation.findMany).not.toHaveBeenCalled();
  });

  it('PUT /achievements/:id no llega a reconcileEvidences', async () => {
    const { controller, prisma } = build();
    const err = await controller
      .updateAchievement('ach-b', { baseDescription: 'x', evidences: [] }, actorDe(A))
      .catch((e: any) => e);
    noFiltra(err);
    expect(prisma.achievementEvidence.findMany).not.toHaveBeenCalled();
    expect(prisma.studentEvidenceValuation.findMany).not.toHaveBeenCalled();
  });

  it('DELETE /evidences/:id no revela el texto de la evidencia ni su recuento', async () => {
    const { controller, prisma } = build();
    const err = await controller.deleteEvidence('ev-b', coord(A)).catch((e: any) => e);
    noFiltra(err);
    expect(prisma.studentEvidenceValuation.count).not.toHaveBeenCalled();
  });

  it('PUT /evidences/:id/retire no revela el nombre del período ajeno', async () => {
    const { controller, prisma } = build();
    const err = await controller
      .retireEvidence('ev-b', { academicTermId: 't-b' }, coord(A))
      .catch((e: any) => e);
    noFiltra(err);
    expect(prisma.achievement.findUnique).not.toHaveBeenCalled();
  });

  it('PUT /evidences/:id/reactivate no revela el período desde el que se retiró', async () => {
    const { controller } = build();
    const err = await controller.reactivateEvidence('ev-b', {}, coord(A)).catch((e: any) => e);
    noFiltra(err);
  });

  it('assertCatalogWritable NO se ejecuta con un recurso ajeno', async () => {
    // Si corriera, un DOCENTE recibiría ForbiddenException en vez de NotFound,
    // confirmando que el recurso existe y es de catálogo compartido.
    const { controller } = build();
    const err = await controller.deleteAchievement('ach-b', actorDe(A)).catch((e: any) => e);
    expect(err).toBeInstanceOf(NotFoundException);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3) Multi-FK
// ═══════════════════════════════════════════════════════════════════════════════
describe('coherencia multi-FK', () => {
  it('POST /achievements · A/A permitido', async () => {
    const { controller, writes } = build();
    await controller.createAchievement(NUEVO('ta-a', 't-a') as any, actorDe(A));
    expect(writes.some((x) => x.op === 'achievement.create')).toBe(true);
  });

  it('POST /achievements · asignación A + período B → rechazado', async () => {
    const { controller, writes } = build();
    await expect(controller.createAchievement(NUEVO('ta-a', 't-b') as any, actorDe(A))).rejects.toThrow(NotFoundException);
    expect(writes).toHaveLength(0);
  });

  it('POST /achievements · asignación B + período A → rechazado', async () => {
    const { controller, writes } = build();
    await expect(controller.createAchievement(NUEVO('ta-b', 't-a') as any, actorDe(A))).rejects.toThrow(NotFoundException);
    expect(writes).toHaveLength(0);
  });

  it('POST /achievements · escribe el institutionId DEL ACTOR, no el de la asignación', async () => {
    const { controller, writes } = build();
    await controller.createAchievement(NUEVO('ta-a', 't-a') as any, actorDe(A));
    expect(writes.find((x) => x.op === 'achievement.create')!.args.data.institutionId).toBe(A);
  });

  it('PUT /attitudinal · aprendizaje de B con asignación y período de A → rechazado', async () => {
    const { controller, writes } = build();
    await expect(
      controller.upsertAttitudinalAchievement({ teacherAssignmentId: 'ta-a', academicTermId: 't-a', achievementId: 'ach-b', description: 'x' } as any, actorDe(A)),
    ).rejects.toThrow(NotFoundException);
    expect(writes).toHaveLength(0);
  });

  it('PUT /evidences/:id/retire · evidencia A + período B → rechazado', async () => {
    const { controller, writes } = build();
    await expect(
      controller.retireEvidence('ev-a', { academicTermId: 't-b' }, coord(A)),
    ).rejects.toThrow(NotFoundException);
    expect(writes).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4) Escenario E en attitudinal (mismo criterio que A-4/A-5)
// ═══════════════════════════════════════════════════════════════════════════════
describe('A-12 · escenario E', () => {
  it('NO actualiza una fila existente cuyo institutionId es incoherente', async () => {
    const { controller, writes } = build();
    await expect(
      controller.upsertAttitudinalAchievement({ teacherAssignmentId: 'ta-a', academicTermId: 't-a-prev', description: 'x' } as any, actorDe(A)),
    ).rejects.toThrow(NotFoundException);
    expect(writes).toHaveLength(0);
  });

  it('con fila coherente actualiza normalmente', async () => {
    const { controller, writes } = build();
    await controller.upsertAttitudinalAchievement({ teacherAssignmentId: 'ta-a', academicTermId: 't-a', description: 'x' } as any, actorDe(A));
    expect(writes.some((x) => x.op === 'attitudinal.update')).toBe(true);
  });

  it('sin fila previa crea con el institutionId del actor', async () => {
    const { controller, writes } = build();
    await controller.upsertAttitudinalAchievement({ teacherAssignmentId: 'ta-a', academicTermId: 't-a', achievementId: 'ach-a', description: 'x' } as any, actorDe(A));
    const c = writes.find((x) => x.op === 'attitudinal.create');
    expect(c!.args.data.institutionId).toBe(A);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5) reorderEvidences · sin validación individual de orderedIds
// ═══════════════════════════════════════════════════════════════════════════════
describe('A-8b · reorderEvidences', () => {
  it('el where sigue acotado por achievementId: un id ajeno afecta 0 filas', async () => {
    const { controller, writes } = build();
    await controller.reorderEvidences('ach-a', { orderedIds: ['ev-a', 'ev-b'] }, actorDe(A));
    const ups = writes.filter((x) => x.op === 'evidence.updateMany');
    expect(ups).toHaveLength(2);
    // Ambos updateMany llevan achievementId: el de ev-b no casará en la base real.
    for (const u of ups) expect(u.args.where.achievementId).toBe('ach-a');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6) NO-REGRESIÓN de las salvaguardas académicas
// ═══════════════════════════════════════════════════════════════════════════════
describe('las ocho salvaguardas siguen intactas', () => {
  it('historia académica · no se borra un aprendizaje con StudentAchievement (dentro del tenant)', async () => {
    const { controller, prisma, writes } = build();
    prisma.studentAchievement.count.mockResolvedValue(3);
    await expect(controller.deleteAchievement('ach-a', actorDe(A))).rejects.toThrow(ConflictException);
    expect(writes).toHaveLength(0);
  });

  it('guarda F1 · no se borra una evidencia con valoraciones (dentro del tenant)', async () => {
    const { controller, prisma, writes } = build();
    prisma.studentEvidenceValuation.count.mockResolvedValue(2);
    await expect(controller.deleteEvidence('ev-a', coord(A))).rejects.toThrow(ConflictException);
    expect(writes).toHaveLength(0);
  });

  it('período OPEN · no se retira desde un período cerrado (dentro del tenant)', async () => {
    const { controller, prisma, writes } = build();
    prisma.academicTerm.findUnique.mockResolvedValue({ id: 't-a', name: 'Periodo A', status: 'CLOSED', order: 2, academicYearId: 'y-a' });
    await expect(controller.retireEvidence('ev-a', { academicTermId: 't-a' }, coord(A))).rejects.toThrow(ConflictException);
    expect(writes).toHaveLength(0);
  });

  it('coherencia año↔período de A-10 · sigue viva y sin modificar', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, 'achievement.service.ts'), 'utf8');
    expect(src).toMatch(/if \(yearId && term\.academicYearId !== yearId\)/);
    expect(src).toMatch(/no pertenece al año académico de este aprendizaje/);
  });

  it('assertCatalogWritable conserva su regla dentro de la institución', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, 'achievement.service.ts'), 'utf8');
    expect(src).toMatch(/solo los puede editar el administrador o coordinador/);
  });

  it('la guarda D-12/H-19 sigue en el servicio', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, 'achievement.service.ts'), 'utf8');
    expect(src).toMatch(/keepVigentes/);
    expect(src).toMatch(/fue retirado del catálogo y no admite valoraciones/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7) SuperAdmin y roles
// ═══════════════════════════════════════════════════════════════════════════════
describe('SuperAdmin y roles', () => {
  it('SuperAdmin sin InstitutionUser es rechazado y no escribe', async () => {
    const { controller, writes } = build();
    await expect(controller.deleteAchievement('ach-a', superAdmin())).rejects.toThrow();
    expect(writes).toHaveLength(0);
  });

  const reflector = new Reflector();
  const rolesDe = (m: string) => reflector.get<string[]>(ROLES_KEY, (AchievementController.prototype as any)[m]);
  const CUATRO = ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE'];
  const TRES = ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR'];

  it.each([
    ['createAchievement', CUATRO], ['updateAchievement', CUATRO], ['duplicateAchievement', CUATRO],
    ['deleteAchievement', CUATRO], ['createEvidence', CUATRO], ['reorderEvidences', CUATRO],
    ['updateEvidence', CUATRO], ['retireEvidence', TRES], ['reactivateEvidence', TRES],
    ['deleteEvidence', CUATRO], ['upsertAttitudinalAchievement', CUATRO],
  ])('%s conserva sus roles', (m, esperado) => {
    expect(rolesDe(m as string)).toEqual(esperado);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8) Frontera y cierre del módulo
// ═══════════════════════════════════════════════════════════════════════════════
describe('frontera y cierre', () => {
  it('las escrituras de Achievement/AchievementEvidence viven solo en achievement.service.ts', () => {
    const fs = require('fs');
    const path = require('path');
    const raiz = path.join(__dirname, '..', '..');
    const re = /\w+\.(achievement|achievementEvidence|attitudinalAchievement|achievementLevelDescriptor)\s*\.\s*(create|createMany|update|updateMany|upsert|delete|deleteMany)/;
    const fuera: string[] = [];
    const walk = (d: string) => {
      for (const f of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, f.name);
        if (f.isDirectory()) walk(p);
        else if (f.name.endsWith('.ts') && !f.name.endsWith('.spec.ts')) {
          if (re.test(fs.readFileSync(p, 'utf8')) && !p.endsWith('achievement.service.ts')) fuera.push(p);
        }
      }
    };
    walk(raiz);
    expect(fuera).toEqual([]);
  });

  it('ninguna ruta HTTP del módulo queda sin resolver institución (46/46)', () => {
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
        if (!/requireInstitutionId|resolveInstitutionId/.test(body)) {
          abiertas.push(f + ' :: ' + (/@\w+\(\s*'([^']*)'/.exec(body)?.[1] ?? '(raíz)'));
        }
      }
    }
    expect(abiertas).toEqual([]);
  });
});
