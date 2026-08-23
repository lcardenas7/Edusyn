import { NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AchievementService } from './achievement.service';
import { AchievementController } from './achievement.controller';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';

/**
 * Aislamiento multi-tenant de `StudentAchievement` — hallazgos A-4 / A-5
 * (docs/security/RLS-AUDIT-ACHIEVEMENTS.md).
 *
 * Seis rutas de escritura sin anclaje al actor:
 *
 *   · Tres masivas que recibian `institutionId` DIRECTAMENTE DEL CUERPO:
 *       POST /students/generate-suggestions · /bulk-assign · /auto-fill-observations
 *   · Tres por id, sin ninguna referencia a institucion:
 *       PUT /students/:id · PUT /students/:id/observation · POST /students/:id/approve
 *
 * `upsertStudentAchievement` ademas derivaba el tenant del FK del cliente
 * (`institutionId: enr!.institutionId`), el mismo patron de A-1/A-3.
 *
 * Las cinco escrituras de studentAchievement viven en achievement.service.ts y no hay
 * escritores externos: la frontera de ESCRITURA esta cerrada. Las LECTURAS no lo estan
 * (achievement.service + reports.service) y quedan fuera de este bloque.
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
  const enrollments = [
    { id: 'enr-a1', institutionId: A },
    { id: 'enr-a2', institutionId: A },
    // Escenario E: matrícula de A cuya valoración histórica quedó etiquetada como B
    // (p. ej. tras un traslado de institución). La terna es de A; la fila, de B.
    { id: 'enr-a3', institutionId: A },
    { id: 'enr-b', institutionId: B },
  ];
  const achievements = [
    { id: 'ach-a', institutionId: A, academicTermId: 't-a', baseDescription: 'Comprende textos', subjectId: null, teacherAssignment: null },
    { id: 'ach-b', institutionId: B, academicTermId: 't-b', baseDescription: 'Otro', subjectId: null, teacherAssignment: null },
  ];
  const years = [{ id: 'y-a', institutionId: A }, { id: 'y-b', institutionId: B }];
  const terms = [
    { id: 't-a', academicYearId: 'y-a' },
    { id: 't-b', academicYearId: 'y-b' },
  ];
  const studentAchievements = [
    { id: 'sa-a', institutionId: A, studentEnrollmentId: 'enr-a1', achievementId: 'ach-a', academicTermId: 't-a' },
    { id: 'sa-b', institutionId: B, studentEnrollmentId: 'enr-b', achievementId: 'ach-b', academicTermId: 't-b' },
    // Fila INCOHERENTE: terna de A, institutionId de B.
    { id: 'sa-incoh', institutionId: B, studentEnrollmentId: 'enr-a3', achievementId: 'ach-a', academicTermId: 't-a' },
  ];

  const writes: Array<{ op: string; args: any }> = [];
  const yearOf = (t: any) => years.find((y) => y.id === t.academicYearId);

  const prisma: any = {
    studentEnrollment: {
      findFirst: jest.fn(async ({ where }: any) =>
        enrollments.find((e) => e.id === where.id && (where.institutionId === undefined || e.institutionId === where.institutionId)) ?? null,
      ),
      findMany: jest.fn(async ({ where }: any) =>
        enrollments.filter(
          (e) => (where.id?.in ?? []).includes(e.id) && (where.institutionId === undefined || e.institutionId === where.institutionId),
        ).map((e) => ({ id: e.id })),
      ),
    },
    achievement: {
      findFirst: jest.fn(async ({ where }: any) =>
        achievements.find((a) => a.id === where.id && (where.institutionId === undefined || a.institutionId === where.institutionId)) ?? null,
      ),
      findUnique: jest.fn(async ({ where }: any) => achievements.find((a) => a.id === where.id) ?? null),
    },
    studentAchievement: {
      findFirst: jest.fn(async ({ where }: any) =>
        studentAchievements.find(
          (s) =>
            (where.id === undefined || s.id === where.id) &&
            (where.institutionId === undefined || s.institutionId === where.institutionId) &&
            (where.studentEnrollmentId === undefined || s.studentEnrollmentId === where.studentEnrollmentId) &&
            (where.achievementId === undefined || s.achievementId === where.achievementId),
        ) ?? null,
      ),
      findMany: jest.fn(async () => []),
      create: jest.fn(async (args: any) => { writes.push({ op: 'create', args }); return { id: 'sa-new' }; }),
      update: jest.fn(async (args: any) => { writes.push({ op: 'update', args }); return { id: args.where.id }; }),
    },
    academicTerm: {
      findFirst: jest.fn(async ({ where }: any) =>
        terms.find(
          (t) => t.id === where.id &&
            (where.academicYear?.institutionId === undefined || yearOf(t)?.institutionId === where.academicYear.institutionId),
        ) ?? null,
      ),
    },
    achievementEvidence: { findFirst: jest.fn(async () => null) },
    subject: { findFirst: jest.fn(async () => null) },
    performanceScale: { findMany: jest.fn(async () => []) },
    achievementConfig: { findUnique: jest.fn(async () => null) },
    periodFinalGrade: { findMany: jest.fn(async () => []) },
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

const UPSERT = (enr: string, ach: string, term?: string) => ({
  studentEnrollmentId: enr,
  achievementId: ach,
  ...(term ? { academicTermId: term } : {}),
  performanceLevel: 'ALTO' as const,
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1) A-5 · PUT /students/:id  (upsert)
// ═══════════════════════════════════════════════════════════════════════════════
describe('A-5 · upsert de valoración de aprendizaje', () => {
  it('A/A: actor de A escribe sobre recursos de A → permitido', async () => {
    const { controller, writes } = build();
    await controller.upsertStudentAchievement('sa-a', UPSERT('enr-a1', 'ach-a', 't-a') as any, actorDe(A));
    expect(writes).toHaveLength(1);
  });

  it('A/B: actor de A no puede escribir sobre recursos de B', async () => {
    const { controller, writes } = build();
    await expect(
      controller.upsertStudentAchievement('sa-b', UPSERT('enr-b', 'ach-b', 't-b') as any, actorDe(A)),
    ).rejects.toThrow(NotFoundException);
    expect(writes).toHaveLength(0);
  });

  it('B/A: actor de B no puede escribir sobre recursos de A', async () => {
    const { controller, writes } = build();
    await expect(
      controller.upsertStudentAchievement('sa-a', UPSERT('enr-a1', 'ach-a', 't-a') as any, actorDe(B)),
    ).rejects.toThrow(NotFoundException);
    expect(writes).toHaveLength(0);
  });

  it('escribe el institutionId DEL ACTOR, no el derivado de la matrícula', async () => {
    const { controller, writes } = build();
    await controller.upsertStudentAchievement('sa-a', UPSERT('enr-a2', 'ach-a', 't-a') as any, actorDe(A));
    expect(writes[0].args.data.institutionId).toBe(A);
  });

  // ── Escenario E ────────────────────────────────────────────────────────────
  // La terna pertenece a A y el actor es de A, pero la fila que la ocupa lleva
  // institutionId = B. Sin la comprobación explícita se actualizaría en silencio
  // una fila de otra institución.
  it('E · NO actualiza una fila existente cuyo institutionId es incoherente', async () => {
    const { controller, writes, prisma } = build();
    await expect(
      controller.upsertStudentAchievement('x', UPSERT('enr-a3', 'ach-a', 't-a') as any, actorDe(A)),
    ).rejects.toThrow(NotFoundException);
    expect(writes).toHaveLength(0);
    expect(prisma.studentAchievement.update).not.toHaveBeenCalled();
  });

  it('E · el rechazo es indistinguible de «no encontrado»', async () => {
    const { controller } = build();
    const incoh = await controller.upsertStudentAchievement('x', UPSERT('enr-a3', 'ach-a', 't-a') as any, actorDe(A)).catch((e) => e);
    const ajeno = await controller.upsertStudentAchievement('x', UPSERT('enr-b', 'ach-a', 't-a') as any, actorDe(A)).catch((e) => e);
    expect(incoh).toBeInstanceOf(NotFoundException);
    expect(ajeno).toBeInstanceOf(NotFoundException);
  });

  // ── Escenario F ────────────────────────────────────────────────────────────
  it('F · sin fila previa, crea con el institutionId del actor (comportamiento legítimo intacto)', async () => {
    const { controller, writes } = build();
    await controller.upsertStudentAchievement('x', UPSERT('enr-a2', 'ach-a', 't-a') as any, actorDe(A));
    expect(writes).toHaveLength(1);
    expect(writes[0].op).toBe('create');
    expect(writes[0].args.data.institutionId).toBe(A);
  });

  // ── Escenario A ────────────────────────────────────────────────────────────
  it('A · con fila previa coherente, actualiza normalmente', async () => {
    const { controller, writes } = build();
    await controller.upsertStudentAchievement('x', UPSERT('enr-a1', 'ach-a', 't-a') as any, actorDe(A));
    expect(writes).toHaveLength(1);
    expect(writes[0].op).toBe('update');
    expect(writes[0].args.where).toEqual({ id: 'sa-a' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2) Coherencia multi-FK
// ═══════════════════════════════════════════════════════════════════════════════
describe('coherencia entre TODAS las FKs (actor A)', () => {
  const casos: Array<[string, string, string, string, boolean]> = [
    ['A/A/A', 'enr-a1', 'ach-a', 't-a', true],
    ['A/A/B', 'enr-a1', 'ach-a', 't-b', false],
    ['A/B/A', 'enr-a1', 'ach-b', 't-a', false],
    ['B/A/A', 'enr-b', 'ach-a', 't-a', false],
    ['B/B/B', 'enr-b', 'ach-b', 't-b', false],
  ];

  it.each(casos)('%s → %s', async (_n, enr, ach, term, permitido) => {
    const { controller, writes } = build();
    const call = controller.upsertStudentAchievement('sa-a', UPSERT(enr, ach, term) as any, actorDe(A));
    if (permitido) {
      await call;
      expect(writes).toHaveLength(1);
    } else {
      await expect(call).rejects.toThrow(NotFoundException);
      expect(writes).toHaveLength(0);
    }
  });

  it('identificador inexistente → NotFoundException', async () => {
    const { controller } = build();
    await expect(
      controller.upsertStudentAchievement('sa-a', UPSERT('no-existe', 'ach-a', 't-a') as any, actorDe(A)),
    ).rejects.toThrow(NotFoundException);
  });

  it('recurso ajeno e inexistente producen el MISMO mensaje', async () => {
    const { controller } = build();
    const ajeno = await controller.upsertStudentAchievement('x', UPSERT('enr-b', 'ach-a', 't-a') as any, actorDe(A)).catch((e) => e);
    const inex = await controller.upsertStudentAchievement('x', UPSERT('no-existe', 'ach-a', 't-a') as any, actorDe(A)).catch((e) => e);
    expect(ajeno.message).toBe(inex.message);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3) A-5 · operaciones por id
// ═══════════════════════════════════════════════════════════════════════════════
describe('A-5 · operar por id de StudentAchievement', () => {
  it('observation · A/A permitido, A/B rechazado', async () => {
    const ok = build();
    await ok.controller.updateStudentObservation('sa-a', { observation: 'bien' }, actorDe(A));
    expect(ok.writes).toHaveLength(1);

    const ko = build();
    await expect(
      ko.controller.updateStudentObservation('sa-b', { observation: 'x' }, actorDe(A)),
    ).rejects.toThrow(NotFoundException);
    expect(ko.writes).toHaveLength(0);
  });

  it('approve · A/A permitido, A/B rechazado', async () => {
    const ok = build();
    await ok.controller.approveStudentAchievement('sa-a', { approvedText: 'ok' }, actorDe(A));
    expect(ok.writes).toHaveLength(1);

    const ko = build();
    await expect(
      ko.controller.approveStudentAchievement('sa-b', { approvedText: 'x' }, actorDe(A)),
    ).rejects.toThrow(NotFoundException);
    expect(ko.writes).toHaveLength(0);
  });

  it('B/A: actor de B no puede aprobar la valoración de A', async () => {
    const { controller, writes } = build();
    await expect(
      controller.approveStudentAchievement('sa-a', { approvedText: 'x' }, actorDe(B)),
    ).rejects.toThrow(NotFoundException);
    expect(writes).toHaveLength(0);
  });

  it('el aserto corre ANTES de la escritura', async () => {
    const { controller, prisma } = build();
    await expect(
      controller.updateStudentObservation('sa-b', { observation: 'x' }, actorDe(A)),
    ).rejects.toThrow();
    expect(prisma.studentAchievement.update).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4) A-4 · operaciones por lote
// ═══════════════════════════════════════════════════════════════════════════════
describe('A-4 · bulk-assign', () => {
  it('todas las matrículas de A → éxito', async () => {
    const { controller, writes } = build();
    await controller.bulkAssignAchievement(
      { achievementId: 'ach-a', studentEnrollmentIds: ['enr-a1', 'enr-a2'], institutionId: A },
      actorDe(A),
    );
    expect(writes).toHaveLength(2);
  });

  it('UNA matrícula de B → se rechaza el LOTE COMPLETO, sin escritura parcial', async () => {
    const { controller, writes, prisma } = build();
    await expect(
      controller.bulkAssignAchievement(
        { achievementId: 'ach-a', studentEnrollmentIds: ['enr-a1', 'enr-b', 'enr-a2'], institutionId: A },
        actorDe(A),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(writes).toHaveLength(0);
    expect(prisma.studentAchievement.create).not.toHaveBeenCalled();
    expect(prisma.studentAchievement.update).not.toHaveBeenCalled();
  });

  it('una matrícula inexistente → lote rechazado, sin escritura parcial', async () => {
    const { controller, writes } = build();
    await expect(
      controller.bulkAssignAchievement(
        { achievementId: 'ach-a', studentEnrollmentIds: ['enr-a1', 'no-existe'], institutionId: A },
        actorDe(A),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(writes).toHaveLength(0);
  });

  it('el aprendizaje ajeno basta para rechazar el lote', async () => {
    const { controller, writes } = build();
    await expect(
      controller.bulkAssignAchievement(
        { achievementId: 'ach-b', studentEnrollmentIds: ['enr-a1'], institutionId: A },
        actorDe(A),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(writes).toHaveLength(0);
  });

  it('el lote se valida en UNA sola consulta, no una por estudiante', async () => {
    const { controller, prisma } = build();
    await controller.bulkAssignAchievement(
      { achievementId: 'ach-a', studentEnrollmentIds: ['enr-a1', 'enr-a2'], institutionId: A },
      actorDe(A),
    );
    expect(prisma.studentEnrollment.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.studentEnrollment.findFirst).not.toHaveBeenCalled();
  });
});

describe('A-4 · generate-suggestions y auto-fill-observations', () => {
  it('generate-suggestions: A/A permitido', async () => {
    const { controller, writes } = build();
    await controller.bulkGenerateSuggestions(
      { achievementId: 'ach-a', institutionId: A, studentGrades: [{ studentEnrollmentId: 'enr-a1', finalGrade: 4 }] },
      actorDe(A),
    );
    expect(writes).toHaveLength(1);
  });

  it('generate-suggestions: una matrícula de B rechaza el lote', async () => {
    const { controller, writes } = build();
    await expect(
      controller.bulkGenerateSuggestions(
        { achievementId: 'ach-a', institutionId: A, studentGrades: [{ studentEnrollmentId: 'enr-b', finalGrade: 4 }] },
        actorDe(A),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(writes).toHaveLength(0);
  });

  it('auto-fill-observations: aprendizaje ajeno rechazado', async () => {
    const { controller } = build();
    await expect(
      controller.autoFillObservations({ achievementId: 'ach-b', institutionId: A }, actorDe(A)),
    ).rejects.toThrow(NotFoundException);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5) El institutionId del cliente NO autoriza
// ═══════════════════════════════════════════════════════════════════════════════
describe('el institutionId del cuerpo no cambia el tenant efectivo', () => {
  it('bulk-assign: enviar institutionId=B no da acceso a B', async () => {
    const { controller, writes } = build();
    await expect(
      controller.bulkAssignAchievement(
        { achievementId: 'ach-b', studentEnrollmentIds: ['enr-b'], institutionId: B },
        actorDe(A),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(writes).toHaveLength(0);
  });

  it('auto-fill: enviar institutionId=B no da acceso a B', async () => {
    const { controller } = build();
    await expect(
      controller.autoFillObservations({ achievementId: 'ach-b', institutionId: B }, actorDe(A)),
    ).rejects.toThrow(NotFoundException);
  });

  it('el campo sigue aceptándose en el contrato (no rompe al cliente)', async () => {
    const { controller, writes } = build();
    await controller.bulkAssignAchievement(
      { achievementId: 'ach-a', studentEnrollmentIds: ['enr-a1'], institutionId: A },
      actorDe(A),
    );
    expect(writes).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6) SuperAdmin — misma política que A-1/A-2/A-3, sin bypass
// ═══════════════════════════════════════════════════════════════════════════════
describe('SuperAdmin', () => {
  it('sin institución resoluble la operación se rechaza', async () => {
    const { controller, writes } = build();
    await expect(
      controller.upsertStudentAchievement('sa-a', UPSERT('enr-a1', 'ach-a', 't-a') as any, superAdmin()),
    ).rejects.toThrow();
    expect(writes).toHaveLength(0);
  });

  it('no se introdujo un bypass de SuperAdmin en el helper', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, 'achievement.service.ts'), 'utf8');
    const helper = src.slice(src.indexOf('private async assertOwnership'), src.indexOf('VIGENCIA DE EVIDENCIAS'));
    expect(helper).not.toMatch(/isSuperAdmin/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7) Roles intactos
// ═══════════════════════════════════════════════════════════════════════════════
describe('los @Roles de las seis rutas no cambian', () => {
  const reflector = new Reflector();
  const rolesDe = (m: string) => reflector.get<string[]>(ROLES_KEY, (AchievementController.prototype as any)[m]);
  const ESPERADO = ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE'];

  it.each([
    'bulkGenerateSuggestions',
    'bulkAssignAchievement',
    'autoFillObservations',
    'updateStudentObservation',
    'upsertStudentAchievement',
    'approveStudentAchievement',
  ])('%s conserva sus cuatro roles', (m) => {
    expect(rolesDe(m)).toEqual(ESPERADO);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8) Frontera de escritura: sigue cerrada
// ═══════════════════════════════════════════════════════════════════════════════
describe('frontera de escritura de StudentAchievement', () => {
  it('todas las escrituras siguen viviendo en achievement.service.ts', () => {
    const fs = require('fs');
    const path = require('path');
    // Alcance = apps/api/src COMPLETO (common/, engines/, modules/, prisma/), no solo
    // modules/: de otro modo la prueba afirmaría más de lo que comprueba.
    // Excluido a propósito: apps/api/scripts/, que no es alcanzable por HTTP y se
    // ejecuta manualmente (mismo criterio aplicado a reset-logical.ts en E-1).
    const raiz = path.join(__dirname, '..', '..');
    const re = /\w+\.studentAchievement\.(create|createMany|update|updateMany|upsert|delete|deleteMany)/;
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
    // Si aparece un escritor externo, este bloque deja de ser un cierre completo.
    expect(fuera).toEqual([]);
  });
});
