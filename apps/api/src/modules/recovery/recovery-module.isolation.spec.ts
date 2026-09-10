import { NotFoundException } from '@nestjs/common';
import { FinalRecoveryService } from './final-recovery.service';
import { AcademicActsService } from './academic-acts.service';
import { RecoveryConfigService } from './recovery-config.service';

/**
 * Aislamiento A/B del resto del módulo de Recuperaciones.
 *
 * `period-recovery.isolation.spec.ts` cubre las recuperaciones de período. Aquí van los otros
 * tres servicios del módulo, que tenían el mismo defecto y nadie había mirado: recuperación
 * final, actas académicas y configuración de reglas.
 *
 * El patrón repetido, y por qué era invisible: la institución se tomaba del **recurso que
 * nombraba el cliente** —la matrícula, el plan, la configuración— y no del actor. La fila
 * resultante quedaba coherente, así que auditar los datos no delataba nada.
 *
 * Las afirmaciones son, sobre todo, **sobre lo que NO llegó a ocurrir**: no basta con devolver
 * error, hay que demostrar que no se leyó ni se escribió antes de rechazar.
 */

const A = 'inst-A';
const B = 'inst-B';

/** Doble de Prisma donde cada fila pertenece a `dueno` y los `where` filtran de verdad. */
function prismaCon(dueno: string) {
  const suyo = (w: any) => w?.institutionId === dueno;
  return {
    studentEnrollment: {
      findFirst: jest.fn(async ({ where }: any) => (suyo(where) ? { id: 'enr-1' } : null)),
      findUnique: jest.fn(async () => ({ institutionId: dueno, academicYearId: 'year-1' })),
    },
    finalRecoveryPlan: {
      findFirst: jest.fn(async ({ where }: any) => (suyo(where) ? { id: 'plan-1' } : null)),
      findMany: jest.fn(async ({ where }: any) => (suyo(where) ? [{ id: 'plan-1' }] : [])),
      update: jest.fn(async ({ data }: any) => data),
      create: jest.fn(async ({ data }: any) => data),
      count: jest.fn(async () => 0),
    },
    academicAct: {
      findFirst: jest.fn(async ({ where }: any) => (suyo(where) ? { id: 'acta-1' } : null)),
      findMany: jest.fn(async ({ where }: any) => (suyo(where) ? [{ id: 'acta-1' }] : [])),
      update: jest.fn(async ({ data }: any) => data),
      create: jest.fn(async ({ data }: any) => data),
    },
    recoveryConfig: {
      findFirst: jest.fn(async ({ where }: any) => (suyo(where) ? { id: 'cfg-1' } : null)),
    },
    recoveryRule: {
      findMany: jest.fn(async ({ where }: any) => (suyo(where) ? [{ id: 'regla-1' }] : [])),
      upsert: jest.fn(async ({ create }: any) => create),
      deleteMany: jest.fn(async ({ where }: any) => ({ count: suyo(where) ? 1 : 0 })),
      delete: jest.fn(),
    },
  } as any;
}

const escrituras = (p: any) => [
  ...p.finalRecoveryPlan.update.mock.calls,
  ...p.finalRecoveryPlan.create.mock.calls,
  ...p.academicAct.update.mock.calls,
  ...p.academicAct.create.mock.calls,
  ...p.recoveryRule.upsert.mock.calls,
  ...p.recoveryRule.delete.mock.calls,
];

const motor: any = {
  validateRecoveryCreation: jest.fn(async () => ({ allowed: true })),
  validateAttempt: jest.fn(async () => ({ canAttempt: true, remainingAttempts: 1 })),
  getApplicableRule: jest.fn(async () => ({ maxScore: 3 })),
};

// ═══════════════════════════════════════════════════════════════════════════
// A · Recuperación FINAL
// ═══════════════════════════════════════════════════════════════════════════
describe('Recuperación final · rechazo cruzado', () => {
  const svc = (dueno: string) => {
    const prisma = prismaCon(dueno);
    // Orden real: prisma, configService, engine.
    return { svc: new FinalRecoveryService(prisma, null as any, motor as any), prisma };
  };

  it('no se abre un plan de refuerzo a un estudiante de otra institución', async () => {
    const { svc: s, prisma } = svc(B);
    await expect(
      s.create({ studentEnrollmentId: 'enr-1', academicYearId: 'year-1', areaId: 'a', originalAreaScore: 2 } as any, A),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(escrituras(prisma)).toHaveLength(0);
  });

  it('updatePlan no reescribe el plan de otra institución', async () => {
    // Era el peor de todos: actualizaba por id sin cargar siquiera el registro.
    const { svc: s, prisma } = svc(B);
    await expect(
      s.updatePlan('plan-1', { objectives: 'intruso' } as any, A),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(escrituras(prisma)).toHaveLength(0);
  });

  it('findByYear acota por año Y por institución', async () => {
    const { svc: s, prisma } = svc(B);
    const filas = await s.findByYear('year-1', undefined, B);
    expect(filas).toHaveLength(1);
    expect(prisma.finalRecoveryPlan.findMany.mock.calls[0][0].where).toMatchObject({
      academicYearId: 'year-1',
      institutionId: B,
    });
  });

  it('findByYear de otra institución devuelve vacío, no los planes ajenos', async () => {
    const { svc: s } = svc(B);
    await expect(s.findByYear('year-1', undefined, A)).resolves.toEqual([]);
  });

  it('findByStudent rechaza la matrícula ajena antes de consultar planes', async () => {
    const { svc: s, prisma } = svc(B);
    await expect(s.findByStudent('enr-1', A)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.finalRecoveryPlan.findMany).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// B · Actas académicas
// ═══════════════════════════════════════════════════════════════════════════
describe('Actas académicas · rechazo cruzado', () => {
  const svc = (dueno: string) => {
    const prisma = prismaCon(dueno);
    return { svc: new AcademicActsService(prisma), prisma };
  };

  it('aprobar un acta ajena es imposible, y no se escribe nada', async () => {
    const { svc: s, prisma } = svc(B);
    await expect(s.approve('acta-1', 'u-A', A)).rejects.toBeInstanceOf(NotFoundException);
    expect(escrituras(prisma)).toHaveLength(0);
  });

  it('el acta propia sí se aprueba, y la comprobación pide id + institución', async () => {
    const { svc: s, prisma } = svc(A);
    await s.approve('acta-1', 'u-A', A);
    expect(prisma.academicAct.findFirst.mock.calls[0][0].where).toMatchObject({
      id: 'acta-1',
      institutionId: A,
    });
    expect(prisma.academicAct.update).toHaveBeenCalled();
  });

  it('no se listan las actas de un estudiante de otra institución', async () => {
    const { svc: s, prisma } = svc(B);
    await expect(s.findByStudent('enr-1', A)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.academicAct.findMany).not.toHaveBeenCalled();
  });

  it('las actas propias se acotan también en la consulta, no solo en la guarda', async () => {
    const { svc: s, prisma } = svc(A);
    await s.findByStudent('enr-1', A);
    expect(prisma.academicAct.findMany.mock.calls[0][0].where).toMatchObject({
      studentEnrollmentId: 'enr-1',
      institutionId: A,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C · Configuración y reglas de recuperación
// ═══════════════════════════════════════════════════════════════════════════
describe('Reglas de recuperación · rechazo cruzado', () => {
  const svc = (dueno: string) => {
    const prisma = prismaCon(dueno);
    return { svc: new RecoveryConfigService(prisma), prisma };
  };

  it('no se listan las reglas de la configuración de otra institución', async () => {
    const { svc: s, prisma } = svc(B);
    await expect(s.listRules('cfg-1', A)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.recoveryRule.findMany).not.toHaveBeenCalled();
  });

  it('no se crea ni modifica una regla sobre la configuración de otra institución', async () => {
    // Esto vale por lo que permitía: cambiarle a otro colegio la nota máxima que puede
    // sacar un estudiante recuperando.
    const { svc: s, prisma } = svc(B);
    await expect(
      s.upsertRule(
        { recoveryConfigId: 'cfg-1', institutionId: B, appliesTo: 'PERIOD', activityType: 'X', maxScore: 5 } as any,
        A,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(escrituras(prisma)).toHaveLength(0);
  });

  it('la regla creada hereda la institución del ACTOR, no la del cuerpo', async () => {
    const { svc: s, prisma } = svc(A);
    await s.upsertRule(
      { recoveryConfigId: 'cfg-1', institutionId: B, appliesTo: 'PERIOD', activityType: 'X', maxScore: 5 } as any,
      A,
    );
    expect(prisma.recoveryRule.upsert.mock.calls[0][0].create.institutionId).toBe(A);
  });

  it('borrar una regla ajena no borra nada y responde como si no existiera', async () => {
    const { svc: s, prisma } = svc(B);
    await expect(s.deleteRule('regla-1', A)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.recoveryRule.deleteMany.mock.calls[0][0].where).toMatchObject({
      id: 'regla-1',
      institutionId: A,
    });
    // `delete` a secas borraría por id sin filtro: se usa `deleteMany` acotado a propósito.
    expect(prisma.recoveryRule.delete).not.toHaveBeenCalled();
  });
});
