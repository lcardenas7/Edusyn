import * as fs from 'fs';
import * as path from 'path';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AcademicTermsService } from './academic-terms.service';
import { AcademicTermsController } from './academic-terms.controller';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';

/**
 * Aislamiento multi-tenant de la eliminación de `AcademicTerm` — hallazgo E-1
 * (docs/security/RLS-AUDIT-EVALUATION.md §6, docs/security/DISENO-CIERRE-E1-ACADEMIC-TERMS.md).
 *
 * `AcademicTerm` NO tiene columna `institutionId`. Su única FK saliente es `academicYearId`,
 * así que la ÚNICA ruta al tenant —y por tanto la fuente autoritativa para autorizar— es:
 *
 *     AcademicTerm.academicYearId -> AcademicYear.institutionId -> Institution.id
 *
 * Dos rutas podían borrar períodos ajenos sin comprobar nada:
 *
 *   - `DELETE /academic-terms/:id` (huérfana: sin consumidor en apps/web, pero alcanzable
 *     con cualquier JWT de ADMIN_INSTITUTIONAL).
 *   - `POST /academic-terms/sync`, que SÍ consume el frontend y borra los períodos
 *     sobrantes. Ésta era la vía destructiva realmente ejercitada.
 *
 * Gravedad: 18 entidades cuelgan de `AcademicTerm` con `onDelete: Cascade`, incluidos
 * `PartialGrade`, `PeriodFinalGrade`, `TermReportCardSnapshot` (boletines ya congelados),
 * `PeriodRecovery` y `StudentEvidenceValuation`.
 *
 * Estas pruebas usan una BD falsa que EJECUTA el filtrado relacional real, para demostrar
 * comportamiento y no solo la forma de los mocks.
 */

const INST_A = 'inst-aaa';
const INST_B = 'inst-bbb';

const actorDe = (institutionId: string | null, roles: string[] = ['ADMIN_INSTITUTIONAL']) => ({
  user: { id: 'u1', institutionId, isSuperAdmin: false, roles },
});
const superAdmin = () => ({
  user: { id: 'sa', institutionId: null, isSuperAdmin: true, roles: ['SUPERADMIN'] },
});

// ═══════════════════════════════════════════════════════════════════════════════
// BD falsa: interpreta de verdad `where` y la relación academicYear.institutionId
// ═══════════════════════════════════════════════════════════════════════════════
function buildDb() {
  const years = [
    { id: 'y-a', institutionId: INST_A },
    { id: 'y-b', institutionId: INST_B },
  ];
  const terms = [
    { id: 't-a1', academicYearId: 'y-a', order: 1, type: 'PERIOD', name: 'P1', weightPercentage: 50, startDate: null, endDate: null },
    { id: 't-a2', academicYearId: 'y-a', order: 2, type: 'PERIOD', name: 'P2', weightPercentage: 50, startDate: null, endDate: null },
    { id: 't-b1', academicYearId: 'y-b', order: 1, type: 'PERIOD', name: 'P1', weightPercentage: 100, startDate: null, endDate: null },
  ];

  /** Toda escritura queda registrada, en orden, para probar que el aserto va antes. */
  const writes: Array<{ op: string; args: any }> = [];

  const yearOf = (t: any) => years.find((y) => y.id === t.academicYearId);

  const matchTerm = (t: any, where: any) => {
    if (where.id !== undefined && t.id !== where.id) return false;
    if (where.academicYearId !== undefined && t.academicYearId !== where.academicYearId) return false;
    if (where.academicYear?.institutionId !== undefined) {
      if (yearOf(t)?.institutionId !== where.academicYear.institutionId) return false;
    }
    return true;
  };

  const prisma: any = {
    academicYear: {
      findFirst: jest.fn(async ({ where }: any) =>
        years.find(
          (y) =>
            (where.id === undefined || y.id === where.id) &&
            (where.institutionId === undefined || y.institutionId === where.institutionId),
        ) ?? null,
      ),
      findUnique: jest.fn(async ({ where }: any) => years.find((y) => y.id === where.id) ?? null),
    },
    academicTerm: {
      findFirst: jest.fn(async ({ where }: any) => terms.find((t) => matchTerm(t, where)) ?? null),
      findMany: jest.fn(async ({ where }: any) => terms.filter((t) => matchTerm(t, where ?? {}))),
      create: jest.fn(async (args: any) => {
        writes.push({ op: 'create', args });
        const row = { id: `t-new-${terms.length}`, ...args.data };
        terms.push(row);
        return row;
      }),
      update: jest.fn(async (args: any) => {
        writes.push({ op: 'update', args });
        const row = terms.find((t) => t.id === args.where.id);
        Object.assign(row as any, args.data);
        return row;
      }),
      delete: jest.fn(async (args: any) => {
        writes.push({ op: 'delete', args });
        const i = terms.findIndex((t) => t.id === args.where.id);
        if (i < 0) throw new Error('P2025');
        return terms.splice(i, 1)[0];
      }),
    },
    institutionUser: { findFirst: jest.fn(async () => null) },
  };

  return { prisma, writes, terms, years };
}

const buildService = () => {
  const db = buildDb();
  return { ...db, service: new AcademicTermsService(db.prisma as any) };
};
const buildController = () => {
  const db = buildDb();
  const service = new AcademicTermsService(db.prisma as any);
  return { ...db, service, controller: new AcademicTermsController(service, db.prisma as any) };
};

const PERIODOS = [
  { name: 'P1', weight: 50 },
  { name: 'P2', weight: 50 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 1) DELETE — matriz A/A, A/B, B/A
// ═══════════════════════════════════════════════════════════════════════════════
describe('DELETE /academic-terms/:id · aislamiento', () => {
  it('A/A: actor de A borra un período de A → permitido', async () => {
    const { controller, terms, prisma } = buildController();
    await controller.delete('t-a1', actorDe(INST_A));

    expect(prisma.academicTerm.delete).toHaveBeenCalledTimes(1);
    expect(terms.find((t) => t.id === 't-a1')).toBeUndefined();
  });

  it('A/B: actor de A NO puede borrar un período de B', async () => {
    const { controller, terms } = buildController();
    await expect(controller.delete('t-b1', actorDe(INST_A))).rejects.toThrow(NotFoundException);
    expect(terms.find((t) => t.id === 't-b1')).toBeDefined();
  });

  it('B/A: actor de B NO puede borrar un período de A', async () => {
    const { controller, terms } = buildController();
    await expect(controller.delete('t-a1', actorDe(INST_B))).rejects.toThrow(NotFoundException);
    expect(terms.find((t) => t.id === 't-a1')).toBeDefined();
  });

  it('el aserto corre ANTES de cualquier escritura: delete nunca se invoca', async () => {
    const { controller, prisma, writes } = buildController();
    await expect(controller.delete('t-b1', actorDe(INST_A))).rejects.toThrow();
    expect(prisma.academicTerm.delete).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });

  it('un período inexistente y uno ajeno son indistinguibles (no se filtra existencia)', async () => {
    const { controller } = buildController();
    const ajeno = await controller.delete('t-b1', actorDe(INST_A)).catch((e) => e);
    const inexistente = await controller.delete('no-existe', actorDe(INST_A)).catch((e) => e);
    expect(ajeno.message).toBe(inexistente.message);
  });

  it('la eliminación legítima conserva EXACTAMENTE la misma llamada: where { id } y nada más', async () => {
    const { controller, prisma } = buildController();
    await controller.delete('t-a1', actorDe(INST_A));

    // Si se hubiese añadido un filtro extra al delete, la semántica de cascada
    // dejaría de ser la del baseline. Debe ser idéntica.
    expect(prisma.academicTerm.delete).toHaveBeenCalledWith({ where: { id: 't-a1' } });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2) SYNC — matriz A/A, A/B, B/A (la ruta viva)
// ═══════════════════════════════════════════════════════════════════════════════
describe('POST /academic-terms/sync · aislamiento', () => {
  it('A/A: actor de A sincroniza su propio año → permitido', async () => {
    const { controller } = buildController();
    const res = await controller.syncPeriods(
      { academicYearId: 'y-a', periods: PERIODOS },
      actorDe(INST_A),
    );
    expect(res.synced).toBe(2);
  });

  it('A/B: actor de A NO puede sincronizar el año de B', async () => {
    const { controller } = buildController();
    await expect(
      controller.syncPeriods({ academicYearId: 'y-b', periods: PERIODOS }, actorDe(INST_A)),
    ).rejects.toThrow(BadRequestException);
  });

  it('B/A: actor de B NO puede sincronizar el año de A', async () => {
    const { controller } = buildController();
    await expect(
      controller.syncPeriods({ academicYearId: 'y-a', periods: PERIODOS }, actorDe(INST_B)),
    ).rejects.toThrow(BadRequestException);
  });

  it('el aserto corre ANTES de cualquier create/update/delete', async () => {
    const { controller, writes } = buildController();
    await expect(
      controller.syncPeriods({ academicYearId: 'y-b', periods: PERIODOS }, actorDe(INST_A)),
    ).rejects.toThrow();
    expect(writes).toHaveLength(0);
  });

  it('no toca los períodos del tenant ajeno', async () => {
    const { controller, terms } = buildController();
    const antes = terms.filter((t) => t.academicYearId === 'y-b').map((t) => ({ ...t }));
    await expect(
      controller.syncPeriods({ academicYearId: 'y-b', periods: [{ name: 'X', weight: 100 }] }, actorDe(INST_A)),
    ).rejects.toThrow();
    expect(terms.filter((t) => t.academicYearId === 'y-b')).toEqual(antes);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3) NO-REGRESIÓN — la lógica académica de syncPeriods es la misma
// ═══════════════════════════════════════════════════════════════════════════════
describe('syncPeriods · la lógica de sincronización NO cambia', () => {
  it('actualiza los períodos existentes y no crea duplicados', async () => {
    const { service, writes } = buildService();
    await service.syncPeriods('y-a', PERIODOS, INST_A);

    // y-a ya tenía order 1 y 2 → dos updates, ningún create, ningún delete.
    expect(writes.map((w) => w.op)).toEqual(['update', 'update']);
    expect(writes[0].args.where).toEqual({ id: 't-a1' });
    expect(writes[1].args.where).toEqual({ id: 't-a2' });
  });

  it('crea los períodos que faltan, respetando `order`', async () => {
    const { service, writes } = buildService();
    await service.syncPeriods('y-a', [...PERIODOS, { name: 'P3', weight: 0 }], INST_A);

    const creates = writes.filter((w) => w.op === 'create');
    expect(creates).toHaveLength(1);
    expect(creates[0].args.data).toMatchObject({ academicYearId: 'y-a', type: 'PERIOD', name: 'P3', order: 3 });
  });

  it('elimina los períodos sobrantes de tipo PERIOD cuando se reduce el número', async () => {
    const { service, writes, terms } = buildService();
    await service.syncPeriods('y-a', [{ name: 'Único', weight: 100 }], INST_A);

    const deletes = writes.filter((w) => w.op === 'delete');
    expect(deletes).toHaveLength(1);
    expect(deletes[0].args).toEqual({ where: { id: 't-a2' } });
    expect(terms.find((t) => t.id === 't-a2')).toBeUndefined();
  });

  it('el orden de operaciones se conserva: primero upserts, después los borrados', async () => {
    const { service, writes } = buildService();
    await service.syncPeriods('y-a', [{ name: 'Único', weight: 100 }], INST_A);

    const ops = writes.map((w) => w.op);
    expect(ops.indexOf('delete')).toBe(ops.length - 1);
  });

  it('un año inexistente sigue produciendo BadRequestException, no 404 (contrato intacto)', async () => {
    const { service } = buildService();
    await expect(service.syncPeriods('no-existe', PERIODOS, INST_A)).rejects.toThrow(BadRequestException);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4) El institutionId del cliente NO cambia el tenant efectivo
// ═══════════════════════════════════════════════════════════════════════════════
describe('institutionId enviado por el cliente', () => {
  it('DELETE: un usuario normal no puede apuntar a otro tenant por query', async () => {
    const { controller, terms } = buildController();
    // Pide explícitamente INST_B; el resolver debe imponer el del JWT (INST_A).
    await expect(controller.delete('t-b1', actorDe(INST_A), INST_B)).rejects.toThrow(NotFoundException);
    expect(terms.find((t) => t.id === 't-b1')).toBeDefined();
  });

  it('SYNC: un usuario normal no puede apuntar a otro tenant por body', async () => {
    const { controller, writes } = buildController();
    await expect(
      controller.syncPeriods(
        { academicYearId: 'y-b', periods: PERIODOS, institutionId: INST_B },
        actorDe(INST_A),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(writes).toHaveLength(0);
  });

  it('el campo institutionId sigue aceptándose en el contrato (no rompe al cliente)', async () => {
    const { controller } = buildController();
    const res = await controller.syncPeriods(
      { academicYearId: 'y-a', periods: PERIODOS, institutionId: INST_A },
      actorDe(INST_A),
    );
    expect(res.synced).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5) SuperAdmin
// ═══════════════════════════════════════════════════════════════════════════════
describe('SuperAdmin', () => {
  it('con institución explícita opera sobre ese tenant (comportamiento del resolver)', async () => {
    const { controller, terms } = buildController();
    await controller.delete('t-b1', superAdmin(), INST_B);
    expect(terms.find((t) => t.id === 't-b1')).toBeUndefined();
  });

  it('con la institución equivocada NO alcanza el recurso', async () => {
    const { controller, terms } = buildController();
    await expect(controller.delete('t-b1', superAdmin(), INST_A)).rejects.toThrow(NotFoundException);
    expect(terms.find((t) => t.id === 't-b1')).toBeDefined();
  });

  it('SIN institución no obtiene acceso accidental: la operación se rechaza', async () => {
    const { controller, prisma } = buildController();
    // Sin query, sin institutionId en el JWT y sin fila InstitutionUser.
    await expect(controller.delete('t-b1', superAdmin())).rejects.toThrow();
    expect(prisma.academicTerm.delete).not.toHaveBeenCalled();
  });

  it('la vía global legítima de SuperAdmin es otra y no pasa por aquí', () => {
    // DELETE /superadmin/institutions/:id → verifySuperAdmin + confirmación por nombre.
    // Esta suite documenta que NO se creó un bypass dentro de AcademicTermsService.
    const src = fs.readFileSync(path.join(__dirname, 'academic-terms.service.ts'), 'utf8');
    expect(src).not.toMatch(/isSuperAdmin/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6) Roles: la vulnerabilidad era de tenant, NO de autorización por rol
// ═══════════════════════════════════════════════════════════════════════════════
describe('los @Roles existentes no cambian', () => {
  const reflector = new Reflector();
  const rolesDe = (m: string) =>
    reflector.get<string[]>(ROLES_KEY, (AcademicTermsController.prototype as any)[m]);

  it('DELETE conserva SUPERADMIN y ADMIN_INSTITUTIONAL', () => {
    expect(rolesDe('delete')).toEqual(['SUPERADMIN', 'ADMIN_INSTITUTIONAL']);
  });

  it('COORDINADOR NO gana acceso a DELETE', () => {
    expect(rolesDe('delete')).not.toContain('COORDINADOR');
  });

  it('SYNC conserva COORDINADOR entre sus roles', () => {
    expect(rolesDe('syncPeriods')).toEqual(['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR']);
  });

  it('un COORDINADOR conserva el sync legítimo de su propia institución', async () => {
    const { controller } = buildController();
    const res = await controller.syncPeriods(
      { academicYearId: 'y-a', periods: PERIODOS },
      actorDe(INST_A, ['COORDINADOR']),
    );
    expect(res.synced).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7) Cascada: el radio de la eliminación NO se modificó
// ═══════════════════════════════════════════════════════════════════════════════
describe('semántica de cascada de AcademicTerm (schema.prisma sin cambios)', () => {
  const schema = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'prisma', 'schema.prisma'),
    'utf8',
  );

  /** Devuelve la línea de relación `academicTerm` declarada dentro de un modelo. */
  const relacionDe = (modelo: string) => {
    const m = new RegExp(`^model ${modelo} \\{[\\s\\S]*?^\\}`, 'm').exec(schema);
    if (!m) throw new Error(`modelo ${modelo} no encontrado`);
    return /academicTerm\s+AcademicTerm.*@relation\([^)]*\)/.exec(m[0])?.[0] ?? '';
  };

  it.each([
    'TermReportCardSnapshot',
    'TermReopeningRecord',
    'PeriodFinalGrade',
    'PartialGrade',
    'PeriodRecovery',
    'StudentEvidenceValuation',
    'PerformanceManualEdit',
    'EvaluativeActivity',
    'EvaluationPlan',
    'PreventiveAlert',
  ])('%s mantiene onDelete: Cascade', (modelo) => {
    expect(relacionDe(modelo)).toContain('onDelete: Cascade');
  });

  it('ClassroomSection mantiene onDelete: SetNull (sobrevive, se desvincula)', () => {
    expect(relacionDe('ClassroomSection')).toContain('onDelete: SetNull');
  });

  it('ClassroomActivity mantiene onDelete: SetNull', () => {
    const m = /^model ClassroomActivity \{[\s\S]*?^\}/m.exec(schema)![0];
    expect(/academicTerm\s+AcademicTerm.*onDelete: SetNull/.test(m)).toBe(true);
  });

  it('PedagogicalSupportPlan permanece SIN onDelete → Restrict (único freno existente)', () => {
    const rel = relacionDe('PedagogicalSupportPlan');
    expect(rel).not.toContain('onDelete');
  });
});
