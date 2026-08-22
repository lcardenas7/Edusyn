import { NotFoundException, ConflictException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AchievementService } from './achievement.service';
import { AchievementController } from './achievement.controller';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';

/**
 * Aislamiento multi-tenant de las valoraciones — hallazgos A-1 / A-2 / A-3
 * (docs/security/RLS-AUDIT-ACHIEVEMENTS.md, docs/security/DISENO-ACHIEVEMENTS-A1-A3.md).
 *
 * Las tres escrituras derivaban el tenant de un FK elegido por el cliente:
 *
 *     const enr = await prisma.studentEnrollment.findUnique({ id: dto.studentEnrollmentId });
 *     create: { institutionId: enr.institutionId, ... }
 *
 * La fila resultante quedaba PERFECTAMENTE etiquetada —su institutionId era el correcto
 * para la matrícula recibida— y por eso la anomalía era invisible en la base de datos.
 * Lo que nunca se comprobaba es que el ACTOR perteneciera a esa institución.
 *
 * A-2 además no tenía tenant en absoluto: `deleteMany` por tres FKs del cliente.
 *
 * Rutas canónicas (verificadas contra schema.prisma):
 *   studentEnrollmentId   -> StudentEnrollment.institutionId
 *   achievementEvidenceId -> achievement.institutionId          (D-5, FK obligatoria)
 *   academicTermId        -> academicYear.institutionId
 *   subjectId             -> area.institutionId
 *
 * La BD falsa de estas pruebas EJECUTA el filtrado relacional real, para demostrar
 * comportamiento y no la forma de los mocks.
 */

const A = 'inst-aaa';
const B = 'inst-bbb';

const actorDe = (institutionId: string | null, roles: string[] = ['DOCENTE']) => ({
  user: { id: 'u1', institutionId, isSuperAdmin: false, roles },
});
const superAdmin = () => ({
  user: { id: 'sa', institutionId: null, isSuperAdmin: true, roles: ['SUPERADMIN'] },
});

// ═══════════════════════════════════════════════════════════════════════════════
// BD falsa: resuelve de verdad `where`, incluidas las relaciones de 1 salto
// ═══════════════════════════════════════════════════════════════════════════════
function buildDb() {
  const enrollments = [
    { id: 'enr-a', institutionId: A },
    { id: 'enr-b', institutionId: B },
  ];
  const achievements = [
    { id: 'ach-a', institutionId: A },
    { id: 'ach-b', institutionId: B },
  ];
  const evidences = [
    { id: 'ev-a', achievementId: 'ach-a', text: 'Imprescindible A', retiredFromTermId: null },
    { id: 'ev-b', achievementId: 'ach-b', text: 'Imprescindible B', retiredFromTermId: null },
    // Evidencia de A retirada desde el período t-a (para las pruebas D-12/H-19)
    { id: 'ev-a-ret', achievementId: 'ach-a', text: 'Retirada A', retiredFromTermId: 't-a' },
    // Evidencia AJENA y retirada: sirve para probar el ORDEN del aserto
    { id: 'ev-b-ret', achievementId: 'ach-b', text: 'Retirada B', retiredFromTermId: 't-b' },
  ];
  const years = [
    { id: 'y-a', institutionId: A },
    { id: 'y-b', institutionId: B },
  ];
  const terms = [
    { id: 't-a', academicYearId: 'y-a', order: 2 },
    { id: 't-a-prev', academicYearId: 'y-a', order: 1 },
    { id: 't-b', academicYearId: 'y-b', order: 2 },
  ];
  const areas = [
    { id: 'area-a', institutionId: A },
    { id: 'area-b', institutionId: B },
  ];
  const subjects = [
    { id: 'sub-a', areaId: 'area-a' },
    { id: 'sub-b', areaId: 'area-b' },
  ];

  /** Toda escritura queda registrada en orden: prueba que el aserto va antes. */
  const writes: Array<{ op: string; args: any }> = [];

  const yearOf = (t: any) => years.find((y) => y.id === t.academicYearId);
  const achOf = (e: any) => achievements.find((a) => a.id === e.achievementId);
  const areaOf = (s: any) => areas.find((ar) => ar.id === s.areaId);

  const prisma: any = {
    studentEnrollment: {
      findFirst: jest.fn(async ({ where }: any) =>
        enrollments.find(
          (e) => e.id === where.id && (where.institutionId === undefined || e.institutionId === where.institutionId),
        ) ?? null,
      ),
    },
    achievementEvidence: {
      findFirst: jest.fn(async ({ where }: any) =>
        evidences.find(
          (e) =>
            e.id === where.id &&
            (where.achievement?.institutionId === undefined ||
              achOf(e)?.institutionId === where.achievement.institutionId),
        ) ?? null,
      ),
      findUnique: jest.fn(async ({ where }: any) => evidences.find((e) => e.id === where.id) ?? null),
      findMany: jest.fn(async () => []),
    },
    academicTerm: {
      findFirst: jest.fn(async ({ where }: any) =>
        terms.find(
          (t) =>
            t.id === where.id &&
            (where.academicYear?.institutionId === undefined ||
              yearOf(t)?.institutionId === where.academicYear.institutionId),
        ) ?? null,
      ),
      findUnique: jest.fn(async ({ where }: any) => terms.find((t) => t.id === where.id) ?? null),
      // `keepVigentes` consulta los órdenes de los períodos del año
      findMany: jest.fn(async () => terms.map((t) => ({ id: t.id, order: t.order }))),
    },
    subject: {
      findFirst: jest.fn(async ({ where }: any) =>
        subjects.find(
          (s) =>
            s.id === where.id &&
            (where.area?.institutionId === undefined || areaOf(s)?.institutionId === where.area.institutionId),
        ) ?? null,
      ),
    },
    achievement: { findUnique: jest.fn(async ({ where }: any) => achievements.find((a) => a.id === where.id) ?? null) },
    studentEvidenceValuation: {
      upsert: jest.fn(async (args: any) => { writes.push({ op: 'upsert', args }); return { id: 'sev-1' }; }),
      deleteMany: jest.fn(async (args: any) => { writes.push({ op: 'deleteMany', args }); return { count: 1 }; }),
      count: jest.fn(async () => 0),
    },
    convivenciaEntry: {
      upsert: jest.fn(async (args: any) => { writes.push({ op: 'upsert', args }); return { id: 'cv-1' }; }),
    },
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

const VAL = (enr: string, ev: string, term: string) => ({
  studentEnrollmentId: enr,
  achievementEvidenceId: ev,
  academicTermId: term,
  performanceLevel: 'ALTO' as any,
});
const CONV = (enr: string, term: string, sub: string) => ({
  studentEnrollmentId: enr,
  academicTermId: term,
  subjectId: sub,
  text: 'Convive bien',
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1) A-1 · PUT /achievements/evidence-valuations
// ═══════════════════════════════════════════════════════════════════════════════
describe('A-1 · upsert de valoración · aislamiento', () => {
  it('A/A: actor de A valora recursos de A → permitido', async () => {
    const { controller, prisma } = build();
    await controller.upsertEvidenceValuation(actorDe(A), VAL('enr-a', 'ev-a', 't-a-prev'));
    expect(prisma.studentEvidenceValuation.upsert).toHaveBeenCalledTimes(1);
  });

  it('A/B: actor de A no puede valorar recursos de B', async () => {
    const { controller, writes } = build();
    await expect(
      controller.upsertEvidenceValuation(actorDe(A), VAL('enr-b', 'ev-b', 't-b')),
    ).rejects.toThrow(NotFoundException);
    expect(writes).toHaveLength(0);
  });

  it('B/A: actor de B no puede valorar recursos de A', async () => {
    const { controller, writes } = build();
    await expect(
      controller.upsertEvidenceValuation(actorDe(B), VAL('enr-a', 'ev-a', 't-a-prev')),
    ).rejects.toThrow(NotFoundException);
    expect(writes).toHaveLength(0);
  });

  it('escribe el institutionId DEL ACTOR, no el derivado del FK del cliente', async () => {
    const { controller, writes } = build();
    await controller.upsertEvidenceValuation(actorDe(A), VAL('enr-a', 'ev-a', 't-a-prev'));
    expect(writes[0].args.create.institutionId).toBe(A);
  });

  it('el aserto corre ANTES de cualquier escritura', async () => {
    const { controller, prisma } = build();
    await expect(controller.upsertEvidenceValuation(actorDe(A), VAL('enr-b', 'ev-a', 't-a'))).rejects.toThrow();
    expect(prisma.studentEvidenceValuation.upsert).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2) A-1/A-2 · coherencia multi-FK — no basta validar uno solo
// ═══════════════════════════════════════════════════════════════════════════════
describe('coherencia entre TODAS las FKs', () => {
  // enrollment / evidence / term  con actor A
  const casos: Array<[string, string, string, string, boolean]> = [
    ['A/A/A', 'enr-a', 'ev-a', 't-a-prev', true],
    ['A/A/B', 'enr-a', 'ev-a', 't-b', false],
    ['A/B/A', 'enr-a', 'ev-b', 't-a-prev', false],
    ['B/A/A', 'enr-b', 'ev-a', 't-a-prev', false],
    ['B/B/B', 'enr-b', 'ev-b', 't-b', false],
  ];

  it.each(casos)('%s con actor A → %s', async (_n, enr, ev, term, permitido) => {
    const { controller, writes } = build();
    const call = controller.upsertEvidenceValuation(actorDe(A), VAL(enr, ev, term));
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
      controller.upsertEvidenceValuation(actorDe(A), VAL('enr-a', 'no-existe', 't-a-prev')),
    ).rejects.toThrow(NotFoundException);
  });

  it('un recurso ajeno y uno inexistente son indistinguibles', async () => {
    const { controller } = build();
    const ajeno = await controller.upsertEvidenceValuation(actorDe(A), VAL('enr-a', 'ev-b', 't-a-prev')).catch((e) => e);
    const inexistente = await controller.upsertEvidenceValuation(actorDe(A), VAL('enr-a', 'no-existe', 't-a-prev')).catch((e) => e);
    expect(ajeno.message).toBe(inexistente.message);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3) A-2 · DELETE /achievements/evidence-valuations
// ═══════════════════════════════════════════════════════════════════════════════
describe('A-2 · borrado de valoración · aislamiento', () => {
  it('A/A: actor de A borra su propia valoración → permitido', async () => {
    const { controller, prisma } = build();
    await controller.deleteEvidenceValuation(actorDe(A), 'enr-a', 'ev-a', 't-a-prev');
    expect(prisma.studentEvidenceValuation.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('A/B: actor de A no puede borrar la valoración de B', async () => {
    const { controller, prisma } = build();
    await expect(
      controller.deleteEvidenceValuation(actorDe(A), 'enr-b', 'ev-b', 't-b'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.studentEvidenceValuation.deleteMany).not.toHaveBeenCalled();
  });

  it('B/A: actor de B no puede borrar la valoración de A', async () => {
    const { controller, prisma } = build();
    await expect(
      controller.deleteEvidenceValuation(actorDe(B), 'enr-a', 'ev-a', 't-a-prev'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.studentEvidenceValuation.deleteMany).not.toHaveBeenCalled();
  });

  it('basta UN identificador ajeno para que se rechace', async () => {
    const { controller, prisma } = build();
    await expect(
      controller.deleteEvidenceValuation(actorDe(A), 'enr-a', 'ev-b', 't-a-prev'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.studentEvidenceValuation.deleteMany).not.toHaveBeenCalled();
  });

  it('el where del borrado legítimo NO cambia: sigue acotado por los tres FKs', async () => {
    const { controller, writes } = build();
    await controller.deleteEvidenceValuation(actorDe(A), 'enr-a', 'ev-a', 't-a-prev');
    expect(writes[0].args).toEqual({
      where: { studentEnrollmentId: 'enr-a', achievementEvidenceId: 'ev-a', academicTermId: 't-a-prev' },
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4) A-3 · PUT /achievements/convivencia
// ═══════════════════════════════════════════════════════════════════════════════
describe('A-3 · convivencia · aislamiento', () => {
  it('A/A: actor de A escribe convivencia de A → permitido', async () => {
    const { controller, prisma } = build();
    await controller.upsertConvivencia(actorDe(A), CONV('enr-a', 't-a', 'sub-a'));
    expect(prisma.convivenciaEntry.upsert).toHaveBeenCalledTimes(1);
  });

  it('A/B: actor de A no puede escribir convivencia de B', async () => {
    const { controller, writes } = build();
    await expect(
      controller.upsertConvivencia(actorDe(A), CONV('enr-b', 't-b', 'sub-b')),
    ).rejects.toThrow(NotFoundException);
    expect(writes).toHaveLength(0);
  });

  it('B/A: actor de B no puede escribir convivencia de A', async () => {
    const { controller, writes } = build();
    await expect(
      controller.upsertConvivencia(actorDe(B), CONV('enr-a', 't-a', 'sub-a')),
    ).rejects.toThrow(NotFoundException);
    expect(writes).toHaveLength(0);
  });

  it('la asignatura AJENA basta para rechazar (ruta subject -> area -> institution)', async () => {
    const { controller, writes } = build();
    await expect(
      controller.upsertConvivencia(actorDe(A), CONV('enr-a', 't-a', 'sub-b')),
    ).rejects.toThrow(NotFoundException);
    expect(writes).toHaveLength(0);
  });

  it('escribe el institutionId del actor', async () => {
    const { controller, writes } = build();
    await controller.upsertConvivencia(actorDe(A), CONV('enr-a', 't-a', 'sub-a'));
    expect(writes[0].args.create.institutionId).toBe(A);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5) NO-REGRESIÓN ACADÉMICA — las salvaguardas siguen intactas
// ═══════════════════════════════════════════════════════════════════════════════
describe('regresión: las reglas académicas no cambian', () => {
  it('D-12/H-19 · sigue rechazando la valoración sobre evidencia retirada DENTRO del tenant', async () => {
    const { controller, writes } = build();
    // ev-a-ret está retirada desde t-a (order 2); valorar EN t-a debe fallar.
    await expect(
      controller.upsertEvidenceValuation(actorDe(A), VAL('enr-a', 'ev-a-ret', 't-a')),
    ).rejects.toThrow(ConflictException);
    expect(writes).toHaveLength(0);
  });

  it('D-12/H-19 · SIGUE permitiendo editar un período anterior al retiro', async () => {
    const { controller, writes } = build();
    // t-a-prev tiene order 1 < 2 → la evidencia allí sigue vigente.
    await controller.upsertEvidenceValuation(actorDe(A), VAL('enr-a', 'ev-a-ret', 't-a-prev'));
    expect(writes).toHaveLength(1);
  });

  it('ORDEN · una evidencia AJENA y retirada devuelve NotFound, nunca el Conflict de D-12', async () => {
    const { controller } = build();
    const err = await controller
      .upsertEvidenceValuation(actorDe(A), VAL('enr-a', 'ev-b-ret', 't-a-prev'))
      .catch((e) => e);
    // Si el aserto corriera DESPUÉS de la guarda académica, esto sería ConflictException
    // y revelaría que la evidencia de B existe y está retirada.
    expect(err).toBeInstanceOf(NotFoundException);
    expect(err).not.toBeInstanceOf(ConflictException);
  });

  it('A-3 · la normalización de items y niveles se conserva', async () => {
    const { controller, writes } = build();
    await controller.upsertConvivencia(actorDe(A), {
      ...CONV('enr-a', 't-a', 'sub-a'),
      items: [
        { text: '  Respeta a sus compañeros  ', level: 'alto' },
        { text: 'Nivel inválido', level: 'INVENTADO' },
        { text: '   ' },
      ],
    } as any);

    const items = writes[0].args.create.items;
    expect(items).toHaveLength(2);                       // el vacío se descarta
    expect(items[0]).toEqual({ text: 'Respeta a sus compañeros', level: 'ALTO' });
    expect(items[1].level).toBeNull();                   // nivel inválido → null
    // El campo legado `text` sigue derivándose de los items.
    expect(writes[0].args.create.text).toBe('Respeta a sus compañeros\nNivel inválido');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6) SuperAdmin
// ═══════════════════════════════════════════════════════════════════════════════
describe('SuperAdmin', () => {
  it('sin institución resoluble, la operación se rechaza (no hay acceso accidental)', async () => {
    const { controller, writes } = build();
    await expect(
      controller.upsertEvidenceValuation(superAdmin(), VAL('enr-a', 'ev-a', 't-a-prev')),
    ).rejects.toThrow();
    expect(writes).toHaveLength(0);
  });

  it('no se introdujo ningún bypass de SuperAdmin en el servicio', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, 'achievement.service.ts'), 'utf8');
    const helper = src.slice(src.indexOf('private async assertOwnership'), src.indexOf('VIGENCIA DE EVIDENCIAS'));
    expect(helper).not.toMatch(/isSuperAdmin/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7) Roles: la vulnerabilidad era de tenant, NO de autorización
// ═══════════════════════════════════════════════════════════════════════════════
describe('los @Roles existentes no cambian', () => {
  const reflector = new Reflector();
  const rolesDe = (m: string) =>
    reflector.get<string[]>(ROLES_KEY, (AchievementController.prototype as any)[m]);
  const ESPERADO = ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE'];

  it.each(['upsertEvidenceValuation', 'deleteEvidenceValuation', 'upsertConvivencia'])(
    '%s conserva sus cuatro roles',
    (metodo) => {
      expect(rolesDe(metodo)).toEqual(ESPERADO);
    },
  );

  it('un DOCENTE legítimo conserva su operación', async () => {
    const { controller, writes } = build();
    await controller.upsertEvidenceValuation(actorDe(A, ['DOCENTE']), VAL('enr-a', 'ev-a', 't-a-prev'));
    expect(writes).toHaveLength(1);
  });
});
