import { NotFoundException } from '@nestjs/common';
import { PeriodRecoveryService } from './period-recovery.service';
import { RecoverySnapshotService } from './recovery-snapshot.service';

/**
 * Aislamiento institucional de RECUPERACIONES — rechazo cruzado A/B.
 *
 * El defecto que esto cierra no se veía en los datos. La institución se deducía del **recurso que
 * nombraba el cliente** —la matrícula, el período, la recuperación— y nunca del actor. La fila
 * creada quedaba coherente: llevaba la institución correcta del estudiante. Auditar los datos no
 * lo habría detectado jamás; había que leer el código.
 *
 * Aquí se prueba lo contrario de lo habitual: no que el caso legítimo funcione, sino que
 * **el cruzado sea rechazado antes de leer o escribir nada**. Por eso casi todas las
 * afirmaciones son sobre lo que NO se llamó.
 *
 * Convención heredada de Aprendizajes: un recurso ajeno responde `NotFoundException`, no
 * `Forbidden`. Un 403 confirmaría que existe.
 */

const A = 'inst-A';
const B = 'inst-B';

/** Prisma de mentira donde CADA fila sabe de quién es. */
function prismaCon(dueno: string) {
  const fila = (extra: any = {}) => ({
    id: 'rec-1',
    institutionId: dueno,
    academicTermId: 'term-1',
    studentEnrollmentId: 'enr-1',
    status: 'REVIEW_PENDING',
    originalScore: 2,
    finalScore: 3,
    academicTerm: { academicYearId: 'year-1', status: 'CLOSED' },
    studentEnrollment: { institutionId: dueno, academicYearId: 'year-1' },
    ...extra,
  });

  return {
    // Filtran de verdad: solo devuelven si el `where` pide su institución.
    periodRecovery: {
      findFirst: jest.fn(async ({ where }: any) =>
        where?.institutionId === dueno ? fila() : null),
      findMany: jest.fn(async ({ where }: any) =>
        where?.institutionId === dueno ? [fila()] : []),
      findUnique: jest.fn(async () => fila()),
      update: jest.fn(async ({ data }: any) => data),
      create: jest.fn(async ({ data }: any) => data),
      count: jest.fn(async () => 0),
    },
    academicTerm: {
      findFirst: jest.fn(async ({ where }: any) =>
        where?.academicYear?.institutionId === dueno ? { id: 'term-1', academicYearId: 'year-1' } : null),
      findUnique: jest.fn(async () => ({ id: 'term-1', academicYearId: 'year-1', status: 'CLOSED' })),
    },
    studentEnrollment: {
      findFirst: jest.fn(async ({ where }: any) =>
        where?.institutionId === dueno ? { id: 'enr-1' } : null),
      findUnique: jest.fn(async () => ({ institutionId: dueno, academicYearId: 'year-1' })),
    },
    recoveryPeriodConfig: { findUnique: jest.fn(async () => null), update: jest.fn() },
  } as any;
}

function servicio(dueno: string) {
  const prisma = prismaCon(dueno);
  const engine: any = {
    validateRecoveryCreation: jest.fn(async () => ({ allowed: true })),
    getApplicableRule: jest.fn(async () => ({ maxScore: 3 })),
    getRemainingAttempts: jest.fn(async () => 1),
    validateAttempt: jest.fn(async () => ({ canAttempt: true, remainingAttempts: 1 })),
  };
  const config: any = { getOrCreateDefaultConfig: jest.fn(async () => ({})) };
  // Orden real del constructor: prisma, config, engine, finalWriter.
  const svc = new PeriodRecoveryService(prisma, config, engine, null as any);
  return { svc, prisma };
}

function snapshots(dueno: string) {
  const prisma = prismaCon(dueno);
  const svc = new RecoverySnapshotService(prisma, null as any, null as any);
  return { svc, prisma };
}

/** Toda escritura del doble, junta: sirve para afirmar «no se tocó nada». */
const escrituras = (p: any) => [
  ...p.periodRecovery.update.mock.calls,
  ...p.periodRecovery.create.mock.calls,
  ...(p.recoveryPeriodConfig.update.mock?.calls ?? []),
];

// ═══════════════════════════════════════════════════════════════════════════
// A · Lecturas — un actor de A no ve nada de B
// ═══════════════════════════════════════════════════════════════════════════
describe('Recuperaciones · lecturas cruzadas', () => {
  it('findByTerm: el período de B no existe para un actor de A', async () => {
    const { svc, prisma } = servicio(B);
    await expect(svc.findByTerm('term-1', undefined, A)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.periodRecovery.findMany).not.toHaveBeenCalled();
  });

  it('findByTerm: el actor de B sí ve lo suyo, y la consulta lleva su institución', async () => {
    const { svc, prisma } = servicio(B);
    const filas = await svc.findByTerm('term-1', undefined, B);

    expect(filas).toHaveLength(1);
    expect(prisma.periodRecovery.findMany.mock.calls[0][0].where.institutionId).toBe(B);
  });

  it('findByStudent: la matrícula de B no existe para un actor de A', async () => {
    const { svc, prisma } = servicio(B);
    await expect(svc.findByStudent('enr-1', A)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.periodRecovery.findMany).not.toHaveBeenCalled();
  });

  it('findByStudent: acota por matrícula Y por institución, no solo por matrícula', async () => {
    const { svc, prisma } = servicio(B);
    await svc.findByStudent('enr-1', B);

    expect(prisma.periodRecovery.findMany.mock.calls[0][0].where).toMatchObject({
      studentEnrollmentId: 'enr-1',
      institutionId: B,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// B · Escrituras — lo que de verdad importa
// ═══════════════════════════════════════════════════════════════════════════
describe('Recuperaciones · escrituras cruzadas', () => {
  it('create: no se puede abrir una recuperación a un estudiante de otra institución', async () => {
    const { svc, prisma } = servicio(B);
    await expect(
      svc.create(
        {
          studentEnrollmentId: 'enr-1',
          academicTermId: 'term-1',
          subjectId: 'sub-1',
          originalScore: 2,
          assignedById: 'u-A',
        } as any,
        A,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(escrituras(prisma)).toHaveLength(0);
  });

  it('create: la institución de la fila es la del ACTOR, no la que trae la matrícula', async () => {
    // Éste es el corazón del defecto: la fila salía coherente con el estudiante y por eso
    // ninguna auditoría de datos podía detectar el cruce.
    const { svc, prisma } = servicio(A);
    await svc.create(
      {
        studentEnrollmentId: 'enr-1',
        academicTermId: 'term-1',
        subjectId: 'sub-1',
        originalScore: 2,
        assignedById: 'u-A',
      } as any,
      A,
    );

    // La matrícula se busca acotada al actor…
    expect(prisma.studentEnrollment.findFirst.mock.calls[0][0].where.institutionId).toBe(A);
    // …y el período también.
    expect(prisma.academicTerm.findFirst.mock.calls[0][0].where.academicYear.institutionId).toBe(A);
    // La fila nace con la institución del actor.
    expect(prisma.periodRecovery.create.mock.calls[0][0].data.institutionId).toBe(A);
  });

  it('updateActivity: no se puede modificar la actividad de refuerzo de otra institución', async () => {
    const { svc, prisma } = servicio(B);
    await expect(
      svc.updateActivity('rec-1', { observations: 'intruso' }, A),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(escrituras(prisma)).toHaveLength(0);
  });

  it('registerResult: no se puede registrar el resultado de otra institución', async () => {
    const { svc, prisma } = servicio(B);
    await expect(
      svc.registerResult('rec-1', { recoveryScore: 5, evaluatedById: 'u-A' } as any, A),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(escrituras(prisma)).toHaveLength(0);
  });

  it('reviewResult: no se puede aprobar ni rechazar una recuperación de otra institución', async () => {
    const { svc, prisma } = servicio(B);
    await expect(
      svc.reviewResult('rec-1', { approved: true, reviewedById: 'u-A' } as any, A),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(escrituras(prisma)).toHaveLength(0);
  });

  it('la carga acotada pide SIEMPRE id + institución, nunca solo el id', async () => {
    const { svc, prisma } = servicio(A);
    await svc.reviewResult('rec-1', { approved: true, reviewedById: 'u-A' } as any, A).catch(() => {});

    expect(prisma.periodRecovery.findFirst).toHaveBeenCalled();
    expect(prisma.periodRecovery.findFirst.mock.calls[0][0].where).toMatchObject({
      id: 'rec-1',
      institutionId: A,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C · El período entero — las cuatro operaciones que más daño harían
// ═══════════════════════════════════════════════════════════════════════════
describe('Recuperaciones · operaciones sobre el período completo', () => {
  it('getRecoveryStatus rechaza el período de otra institución', async () => {
    const { svc } = snapshots(B);
    await expect(svc.getRecoveryStatus('term-1', A)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('getRecoveryWorkflow rechaza el período de otra institución', async () => {
    const { svc } = snapshots(B);
    await expect(svc.getRecoveryWorkflow('term-1', A)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('closeRecoveryWindow no cierra la ventana de otra institución', async () => {
    const { svc, prisma } = snapshots(B);
    await expect(
      svc.closeRecoveryWindow('term-1', 'u-A', false, A),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.recoveryPeriodConfig.findUnique).not.toHaveBeenCalled();
    expect(escrituras(prisma)).toHaveLength(0);
  });

  it('createPostRecoverySnapshots no regenera boletines de otra institución', async () => {
    const { svc, prisma } = snapshots(B);
    await expect(
      svc.createPostRecoverySnapshots('term-1', 'u-A', A),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.recoveryPeriodConfig.findUnique).not.toHaveBeenCalled();
  });

  it('finalizeRecoveryProcess no finaliza el período de otra institución', async () => {
    const { svc, prisma } = snapshots(B);
    await expect(
      svc.finalizeRecoveryProcess('term-1', A),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(escrituras(prisma)).toHaveLength(0);
  });

  it('compareSnapshots no compara boletines de otra institución', async () => {
    const { svc } = snapshots(B);
    await expect(
      svc.compareSnapshots('term-1', 'enr-1', A),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('el período propio sí pasa la guarda', async () => {
    const { svc, prisma } = snapshots(A);
    await svc.getRecoveryStatus('term-1', A).catch(() => {});

    expect(prisma.academicTerm.findFirst.mock.calls[0][0].where).toMatchObject({
      id: 'term-1',
      academicYear: { institutionId: A },
    });
  });
});
