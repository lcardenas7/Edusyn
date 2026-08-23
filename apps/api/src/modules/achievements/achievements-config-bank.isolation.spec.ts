import { NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AchievementService } from './achievement.service';
import { AchievementConfigService } from './achievement-config.service';
import { AchievementController } from './achievement.controller';
import { AchievementBankService } from './achievement-bank.service';
import { AchievementBankController } from './achievement-bank.controller';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';

/**
 * Aislamiento multi-tenant de configuración/catálogo (A-13…A-15) y del banco (A-16).
 *
 * Son DOS modelos de autorización distintos y el bloque los mantiene separados:
 *
 *  A-13…A-15 · `AchievementConfig` está indexado por `institutionId`, así que no
 *    hace falta aserto: basta que la institución deje de venir del cliente. En
 *    `POST /catalog`, `assertCatalogScope` ya cotejaba grade/subject/year/term
 *    entre sí; lo único que cambia es el ancla.
 *
 *  A-16 · el banco se acotaba SOLO por autoría (`createdById`) y, en delete,
 *    por `isAdmin`. La regla nueva es **tenant AND autoría**, nunca tenant OR
 *    autoría: el aserto se AÑADE. `isAdmin` sigue siendo una capacidad dentro de
 *    la institución del actor, no un bypass de tenant.
 */

const A = 'inst-aaa';
const B = 'inst-bbb';

const actorDe = (institutionId: string | null, roles: string[] = ['COORDINADOR']) => ({
  user: { id: 'u-a', sub: 'u-a', institutionId, isSuperAdmin: false, roles },
});
const superAdmin = () => ({
  user: { id: 'sa', sub: 'sa', institutionId: null, isSuperAdmin: true, roles: ['SUPERADMIN'] },
});

// ═══════════════════════════════════════════════════════════════════════════════
// A-13…A-15 · configuración y catálogo
// ═══════════════════════════════════════════════════════════════════════════════
function buildConfigDb() {
  const writes: Array<{ model: string; args: any }> = [];
  const years = [{ id: 'y-a', institutionId: A }, { id: 'y-b', institutionId: B }];
  const terms = [{ id: 't-a', academicYearId: 'y-a', order: 1 }, { id: 't-b', academicYearId: 'y-b', order: 1 }];
  const grades = [{ id: 'gr-a', institutionId: A }, { id: 'gr-b', institutionId: B }];
  const areas = [{ id: 'ar-a', institutionId: A }, { id: 'ar-b', institutionId: B }];
  const subjects = [
    { id: 'sub-a', areaId: 'ar-a', code: 'DIM', subjectType: 'PRESCHOOL_DIMENSION' },
    { id: 'sub-b', areaId: 'ar-b', code: 'DIM', subjectType: 'PRESCHOOL_DIMENSION' },
  ];
  const areaOf = (s: any) => areas.find((a) => a.id === s.areaId);

  const prisma: any = {
    achievementConfig: {
      findUnique: jest.fn(async (args: any) => ({ id: 'cfg-' + args.where.institutionId, institutionId: args.where.institutionId })),
      upsert: jest.fn(async (args: any) => { writes.push({ model: 'achievementConfig', args }); return { id: 'cfg' }; }),
      create: jest.fn(async (args: any) => { writes.push({ model: 'achievementConfig', args }); return { id: 'cfg' }; }),
    },
    valueJudgmentTemplate: { upsert: jest.fn(async (args: any) => { writes.push({ model: 'valueJudgmentTemplate', args }); return {}; }) },
    observationTemplate: { upsert: jest.fn(async (args: any) => { writes.push({ model: 'observationTemplate', args }); return {}; }) },
    grade: { findFirst: jest.fn(async ({ where }: any) => grades.find((g) => g.id === where.id && g.institutionId === where.institutionId) ?? null) },
    subject: { findFirst: jest.fn(async ({ where }: any) => subjects.find((s) => s.id === where.id && areaOf(s)?.institutionId === where.area?.institutionId) ?? null) },
    academicYear: { findFirst: jest.fn(async ({ where }: any) => years.find((y) => y.id === where.id && y.institutionId === where.institutionId) ?? null) },
    academicTerm: { findFirst: jest.fn(async ({ where }: any) => terms.find((t) => t.id === where.id && t.academicYearId === where.academicYearId) ?? null) },
    achievement: {
      findFirst: jest.fn(async () => null),
      create: jest.fn(async (args: any) => { writes.push({ model: 'achievement', args }); return { id: 'ach-new' }; }),
    },
    institutionUser: { findFirst: jest.fn(async () => null) },
  };
  return { prisma, writes };
}

const buildConfig = () => {
  const db = buildConfigDb();
  const service = new AchievementService(db.prisma as any);
  const config = new AchievementConfigService(db.prisma as any);
  const controller = new AchievementController(service, config as any, db.prisma as any);
  return { ...db, controller };
};

const CAT = (inst: string, grade: string, sub: string, year: string) => ({
  institutionId: inst, gradeId: grade, subjectId: sub, academicYearId: year,
  baseDescription: 'Reconoce su nombre',
});

describe('A-13 · PUT /achievements/config', () => {
  it('A/A permitido y escribe en la institución del actor', async () => {
    const { controller, writes } = buildConfig();
    await controller.upsertConfig({ institutionId: A } as any, actorDe(A));
    expect(writes[0].args.where).toEqual({ institutionId: A });
  });

  it('institutionId=B enviado por el cliente NO mueve el tenant efectivo', async () => {
    const { controller, writes } = buildConfig();
    await controller.upsertConfig({ institutionId: B } as any, actorDe(A));
    expect(writes[0].args.where).toEqual({ institutionId: A });
  });
});

describe('A-14 · plantillas de juicio y de observación', () => {
  it('templates · institutionId=B no mueve el ámbito', async () => {
    const { controller, prisma } = buildConfig();
    await controller.bulkUpsertTemplates({ institutionId: B, templates: [{ level: 'ALTO', template: 'x' }] } as any, actorDe(A));
    expect(prisma.achievementConfig.findUnique).toHaveBeenCalledWith({ where: { institutionId: A } });
  });

  it('observation-templates · institutionId=B no mueve el ámbito', async () => {
    const { controller, prisma } = buildConfig();
    await controller.bulkUpsertObservationTemplates({ institutionId: B, templates: [{ level: 'ALTO', template: 'x' }] } as any, actorDe(A));
    expect(prisma.achievementConfig.findUnique).toHaveBeenCalledWith({ where: { institutionId: A } });
  });

  it('defaults · un path de otra institución no mueve el ámbito', async () => {
    const { controller, prisma } = buildConfig();
    await controller.createDefaultTemplates(B, actorDe(A));
    expect(prisma.achievementConfig.findUnique).toHaveBeenCalledWith({ where: { institutionId: A } });
  });

  it('observation defaults · idem', async () => {
    const { controller, prisma } = buildConfig();
    await controller.createDefaultObservationTemplates(B, actorDe(A));
    expect(prisma.achievementConfig.findUnique).toHaveBeenCalledWith({ where: { institutionId: A } });
  });
});

describe('A-15 · POST /achievements/catalog', () => {
  it('A/A/A coherente → permitido y anclado al actor', async () => {
    const { controller, writes } = buildConfig();
    await controller.createCatalogAchievement(CAT(A, 'gr-a', 'sub-a', 'y-a') as any, actorDe(A));
    const w = writes.find((x) => x.model === 'achievement');
    expect(w!.args.data.institutionId).toBe(A);
  });

  it('institutionId=B con grado/dimensión/año coherentes de B → RECHAZADO', async () => {
    const { controller, writes } = buildConfig();
    await expect(
      controller.createCatalogAchievement(CAT(B, 'gr-b', 'sub-b', 'y-b') as any, actorDe(A)),
    ).rejects.toThrow(NotFoundException);
    expect(writes.filter((w) => w.model === 'achievement')).toHaveLength(0);
  });

  it('la coherencia de assertCatalogScope NO se debilitó: grado de B con actor A → rechazado', async () => {
    const { controller, writes } = buildConfig();
    await expect(
      controller.createCatalogAchievement(CAT(A, 'gr-b', 'sub-a', 'y-a') as any, actorDe(A)),
    ).rejects.toThrow(NotFoundException);
    expect(writes.filter((w) => w.model === 'achievement')).toHaveLength(0);
  });

  it('dimensión de B con actor A → rechazado', async () => {
    const { controller } = buildConfig();
    await expect(
      controller.createCatalogAchievement(CAT(A, 'gr-a', 'sub-b', 'y-a') as any, actorDe(A)),
    ).rejects.toThrow(NotFoundException);
  });

  it('año de B con actor A → rechazado', async () => {
    const { controller } = buildConfig();
    await expect(
      controller.createCatalogAchievement(CAT(A, 'gr-a', 'sub-a', 'y-b') as any, actorDe(A)),
    ).rejects.toThrow(NotFoundException);
  });

  it('período que no pertenece al año → sigue rechazándose (regla académica intacta)', async () => {
    const { controller } = buildConfig();
    await expect(
      controller.createCatalogAchievement({ ...CAT(A, 'gr-a', 'sub-a', 'y-a'), academicTermId: 't-b' } as any, actorDe(A)),
    ).rejects.toThrow(/período/i);
  });

  it('recurso inexistente → rechazado', async () => {
    const { controller } = buildConfig();
    await expect(
      controller.createCatalogAchievement(CAT(A, 'no-existe', 'sub-a', 'y-a') as any, actorDe(A)),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('A-13…A-15 · SuperAdmin sin InstitutionUser', () => {
  it('no obtiene institución y la operación se rechaza', async () => {
    const { controller, writes } = buildConfig();
    await expect(controller.upsertConfig({ institutionId: A } as any, superAdmin())).rejects.toThrow();
    expect(writes).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// A-16 · achievement-bank — tenant AND autoría
// ═══════════════════════════════════════════════════════════════════════════════
function buildBankDb() {
  const entries = [
    { id: 'bk-a-mine', institutionId: A, createdById: 'u-a' },
    { id: 'bk-a-other', institutionId: A, createdById: 'u-otro' },
    { id: 'bk-b-mine', institutionId: B, createdById: 'u-a' }, // mismo autor, otra institución
    { id: 'bk-b-other', institutionId: B, createdById: 'u-otro' },
  ];
  const writes: Array<{ op: string; args: any }> = [];
  const prisma: any = {
    achievementBank: {
      findFirst: jest.fn(async ({ where }: any) =>
        entries.find((e) => e.id === where.id && (where.institutionId === undefined || e.institutionId === where.institutionId)) ?? null,
      ),
      findUnique: jest.fn(async ({ where }: any) => entries.find((e) => e.id === where.id) ?? null),
      update: jest.fn(async (args: any) => { writes.push({ op: 'update', args }); return { id: args.where.id }; }),
      delete: jest.fn(async (args: any) => { writes.push({ op: 'delete', args }); return {}; }),
    },
    institutionUser: { findFirst: jest.fn(async () => null) },
  };
  const service = new AchievementBankService(prisma as any);
  const controller = new AchievementBankController(service, prisma as any);
  return { prisma, writes, service, controller };
}

const admin = (inst: string) => ({ user: { id: 'u-a', sub: 'u-a', institutionId: inst, isSuperAdmin: false, roles: ['ADMIN_INSTITUTIONAL'] } });
const autor = (inst: string) => ({ user: { id: 'u-a', sub: 'u-a', institutionId: inst, isSuperAdmin: false, roles: ['DOCENTE'] } });

describe('A-16 · update — tenant AND autoría', () => {
  it('autor A → recurso propio de A: permitido (regla actual conservada)', async () => {
    const { controller, writes } = buildBankDb();
    await controller.update(autor(A), 'bk-a-mine', {});
    expect(writes).toHaveLength(1);
  });

  it('autor A → recurso de A que NO es suyo: sigue rechazado (autoría intacta)', async () => {
    const { controller, writes } = buildBankDb();
    expect(await controller.update(autor(A), 'bk-a-other', {})).toBeNull();
    expect(writes).toHaveLength(0);
  });

  it('autor A → recurso de B del que ES autor: RECHAZADO por tenant', async () => {
    const { controller, writes } = buildBankDb();
    expect(await controller.update(autor(A), 'bk-b-mine', {})).toBeNull();
    expect(writes).toHaveLength(0);
  });

  it('recurso inexistente indistinguible de recurso ajeno', async () => {
    const { controller } = buildBankDb();
    expect(await controller.update(autor(A), 'no-existe', {})).toBeNull();
    expect(await controller.update(autor(A), 'bk-b-other', {})).toBeNull();
  });
});

describe('A-16 · delete — isAdmin NO es bypass de tenant', () => {
  it('admin A → recurso de A: permitido (capacidad administrativa conservada)', async () => {
    const { controller, writes } = buildBankDb();
    await controller.remove(admin(A), 'bk-a-other');   // no es su autor, pero es admin
    expect(writes).toHaveLength(1);
    expect(writes[0].op).toBe('delete');
  });

  it('admin A → recurso de B: RECHAZADO. isAdmin no cruza institución', async () => {
    const { controller, writes } = buildBankDb();
    expect(await controller.remove(admin(A), 'bk-b-other')).toBeNull();
    expect(writes).toHaveLength(0);
  });

  it('autor A → recurso propio de A: permitido', async () => {
    const { controller, writes } = buildBankDb();
    await controller.remove(autor(A), 'bk-a-mine');
    expect(writes).toHaveLength(1);
  });

  it('no-autor y no-admin sobre recurso de su propia institución: sigue rechazado', async () => {
    const { controller, writes } = buildBankDb();
    expect(await controller.remove(autor(A), 'bk-a-other')).toBeNull();
    expect(writes).toHaveLength(0);
  });

  it('autor A → recurso de B del que es autor: rechazado por tenant', async () => {
    const { controller, writes } = buildBankDb();
    expect(await controller.remove(autor(A), 'bk-b-mine')).toBeNull();
    expect(writes).toHaveLength(0);
  });
});

describe('A-16 · incrementUsage', () => {
  it('A → recurso de A: permitido', async () => {
    const { controller, writes } = buildBankDb();
    await controller.incrementUsage('bk-a-mine', autor(A));
    expect(writes).toHaveLength(1);
  });

  it('A → recurso de B: RECHAZADO (antes no comprobaba nada)', async () => {
    const { controller, writes } = buildBankDb();
    expect(await controller.incrementUsage('bk-b-other', autor(A))).toBeNull();
    expect(writes).toHaveLength(0);
  });
});

describe('A-16 · la comprobación de tenant NO sustituyó a la de autoría', () => {
  it('el servicio sigue conteniendo la regla createdById', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, 'achievement-bank.service.ts'), 'utf8');
    expect(src).toMatch(/entry\.createdById !== userId/);
    // y en delete la disyunción autor-o-admin se conserva
    expect(src).toMatch(/entry\.createdById !== userId && !isAdmin/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Roles intactos en ambos controladores
// ═══════════════════════════════════════════════════════════════════════════════
describe('los @Roles del bloque no cambian', () => {
  const reflector = new Reflector();
  const CUATRO = ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE'];
  const TRES = ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR'];

  it.each([
    ['upsertConfig', TRES],
    ['bulkUpsertTemplates', TRES],
    ['createDefaultTemplates', TRES],
    ['bulkUpsertObservationTemplates', TRES],
    ['createDefaultObservationTemplates', TRES],
    ['createCatalogAchievement', TRES],
  ])('achievements · %s', (m, esperado) => {
    expect(reflector.get<string[]>(ROLES_KEY, (AchievementController.prototype as any)[m as string])).toEqual(esperado);
  });

  it.each(['update', 'remove', 'incrementUsage'])('achievement-bank · %s conserva sus cuatro roles', (m) => {
    expect(reflector.get<string[]>(ROLES_KEY, (AchievementBankController.prototype as any)[m])).toEqual(CUATRO);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Frontera de escritura de las entidades del bloque
// ═══════════════════════════════════════════════════════════════════════════════
describe('frontera de escritura', () => {
  it('config, plantillas y banco solo se escriben desde sus dos servicios', () => {
    const fs = require('fs');
    const path = require('path');
    const raiz = path.join(__dirname, '..', '..');   // apps/api/src completo
    const re = /\w+\.(achievementConfig|valueJudgmentTemplate|observationTemplate|achievementBank)\s*\.\s*(create|createMany|update|updateMany|upsert|delete|deleteMany)/;
    const permitidos = ['achievement-config.service.ts', 'achievement-bank.service.ts'];
    const fuera: string[] = [];
    const walk = (d: string) => {
      for (const f of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, f.name);
        if (f.isDirectory()) walk(p);
        else if (f.name.endsWith('.ts') && !f.name.endsWith('.spec.ts')) {
          if (re.test(fs.readFileSync(p, 'utf8')) && !permitidos.includes(f.name)) fuera.push(p);
        }
      }
    };
    walk(raiz);
    expect(fuera).toEqual([]);
  });
});
