import { NotFoundException } from '@nestjs/common';
import { ObserverService } from './observer.service';
import { ObserverController } from './observer.controller';

/**
 * Aislamiento multi-tenant de `observer` (docs/security/RLS-AUDIT-OBSERVER.md).
 *
 * Este módulo guarda el observador del estudiante: faltas, actas, compromisos, citaciones,
 * remisiones y medidas. PII sensible de menores y material con valor probatorio.
 *
 * Dos defectos de fondo, ambos cubiertos aquí:
 *
 *  1. `GET /pending-followups?all=true` — el único filtro (el autor) era opcional y el
 *     cliente lo desactivaba, dejando la consulta sin autor Y sin institución: volcaba el
 *     expediente disciplinario abierto de toda la plataforma a cualquier DOCENTE.
 *
 *  2. Las cinco creaciones derivaban `institutionId` de la matrícula que elegía el cliente.
 *     Las entidades TIENEN la columna y la rellenaban bien — el dato quedaba bien formado y
 *     el aislamiento roto. Es la prueba de que "tiene institutionId" nunca basta.
 */

const INST_A = 'inst-aaa';
const INST_B = 'inst-bbb';
const USER = 'user-a';

const actorDe = (institutionId: string | null, rol = 'COORDINADOR') => ({
  user: { id: USER, institutionId, isSuperAdmin: false, roles: [rol] },
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1) SERVICIO
// ═══════════════════════════════════════════════════════════════════════════════
describe('ObserverService · aislamiento', () => {
  function build() {
    const vacio = () => ({
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    });
    const prisma: any = {
      studentObservation: vacio(),
      observerCommitment: vacio(),
      guardianCitation: vacio(),
      observerReferral: vacio(),
      pedagogicalMeasure: vacio(),
      actaRecord: vacio(),
      studentEnrollment: vacio(),
    };
    return { service: new ObserverService(prisma), prisma };
  }
  /** El recurso pertenece a la institución consultada. */
  const propio = { id: 'x' };

  // ── Tests 1-2, 9-10, 11 · escrituras por identificador ────────────────────
  describe('las 11 escrituras por identificador', () => {
    it.each([
      ['update',            'studentObservation', (s: any, i: string) => s.update('o1', {}, i)],
      ['delete',            'studentObservation', (s: any, i: string) => s.delete('o1', i)],
      ['markParentNotified','studentObservation', (s: any, i: string) => s.markParentNotified('o1', i)],
      ['createActa',        'studentObservation', (s: any, i: string) => s.createActa({ observationId: 'o1' } as any, i)],
      ['updateCommitment',  'observerCommitment', (s: any, i: string) => s.updateCommitment('c1', USER, {} as any, i)],
      ['updateCitation',    'guardianCitation',   (s: any, i: string) => s.updateCitation('t1', {} as any, i)],
      ['updateReferral',    'observerReferral',   (s: any, i: string) => s.updateReferral('r1', USER, {} as any, i)],
      ['updateMeasure',     'pedagogicalMeasure', (s: any, i: string) => s.updateMeasure('m1', {} as any, i)],
    ])('%s sobre un recurso de B → rechazado sin escritura', async (_n, entidad, call) => {
      const { service, prisma } = build();
      await expect(call(service, INST_A)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma[entidad].update).not.toHaveBeenCalled();
      expect(prisma[entidad].delete).not.toHaveBeenCalled();
      expect(prisma[entidad].create).not.toHaveBeenCalled();
    });

    it('updateActa sobre un acta de B → rechazado (deriva de su observación)', async () => {
      const { service, prisma } = build();
      await expect(service.updateActa('a1', {} as any, INST_A)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.actaRecord.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'a1', observation: { institutionId: INST_A } } }),
      );
      expect(prisma.actaRecord.update).not.toHaveBeenCalled();
    });

    it('la comprobación de pertenencia va acotada por id + institución', async () => {
      const { service, prisma } = build();
      await service.delete('o1', INST_A).catch(() => undefined);
      expect(prisma.studentObservation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'o1', institutionId: INST_A } }),
      );
    });

    it('delete sobre observación propia → permitido (no rompe el flujo legítimo)', async () => {
      const { service, prisma } = build();
      prisma.studentObservation.findFirst.mockResolvedValue(propio);
      await expect(service.delete('o1', INST_A)).resolves.toBeDefined();
      expect(prisma.studentObservation.delete).toHaveBeenCalledWith({ where: { id: 'o1' } });
    });
  });

  // ── Tests 3-4 · las cinco creaciones ──────────────────────────────────────
  describe('las cinco creaciones', () => {
    const casos: Array<[string, string, (s: any, i: string) => Promise<any>]> = [
      ['create',           'studentObservation', (s, i) => s.create(USER, { studentEnrollmentId: 'e1', date: '2026-01-01' } as any, i)],
      ['createCommitment', 'observerCommitment', (s, i) => s.createCommitment(USER, { studentEnrollmentId: 'e1' } as any, i)],
      ['createCitation',   'guardianCitation',   (s, i) => s.createCitation(USER, { studentEnrollmentId: 'e1' } as any, i)],
      ['createReferral',   'observerReferral',   (s, i) => s.createReferral(USER, { studentEnrollmentId: 'e1' } as any, i)],
      ['createMeasure',    'pedagogicalMeasure', (s, i) => s.createMeasure(USER, { studentEnrollmentId: 'e1' } as any, i)],
    ];

    it.each(casos)('%s sobre una matrícula de B → rechazado sin escritura', async (_n, entidad, call) => {
      const { service, prisma } = build();          // enrollment.findFirst → null
      await expect(call(service, INST_A)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma[entidad].create).not.toHaveBeenCalled();
    });

    it.each(casos)('%s sobre una matrícula propia → usa la institución del ACTOR', async (_n, entidad, call) => {
      const { service, prisma } = build();
      prisma.studentEnrollment.findFirst.mockResolvedValue(propio);
      await call(service, INST_A);
      expect(prisma[entidad].create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ institutionId: INST_A }) }),
      );
    });

    it('la matrícula se valida contra la institución del actor, no al revés', async () => {
      const { service, prisma } = build();
      prisma.studentEnrollment.findFirst.mockResolvedValue(propio);
      await service.create(USER, { studentEnrollmentId: 'e1', date: '2026-01-01' } as any, INST_A);
      expect(prisma.studentEnrollment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'e1', institutionId: INST_A } }),
      );
    });
  });

  // ── Tests 5-6 · el P0 ─────────────────────────────────────────────────────
  describe('pending-followups', () => {
    it('all=true acota a la institución: nunca a toda la plataforma', async () => {
      const { service, prisma } = build();
      await service.getPendingFollowUps(INST_A, undefined);
      const where = prisma.studentObservation.findMany.mock.calls[0][0].where;
      expect(where.institutionId).toBe(INST_A);
      expect(where.authorId).toBeUndefined();      // "todos", pero de MI institución
    });

    it('all=false conserva la semántica de "mis seguimientos", ya acotada', async () => {
      const { service, prisma } = build();
      await service.getPendingFollowUps(INST_A, USER);
      const where = prisma.studentObservation.findMany.mock.calls[0][0].where;
      expect(where.institutionId).toBe(INST_A);
      expect(where.authorId).toBe(USER);
    });

    it('conserva las condiciones funcionales existentes', async () => {
      const { service, prisma } = build();
      await service.getPendingFollowUps(INST_A);
      const where = prisma.studentObservation.findMany.mock.calls[0][0].where;
      expect(where.requiresFollowUp).toBe(true);
      expect(where.status).toEqual({ not: 'CLOSED' });
    });

    it('la institución NO es opcional: ningún parámetro del cliente puede eliminarla', async () => {
      const { service, prisma } = build();
      for (const author of [undefined, USER]) {
        prisma.studentObservation.findMany.mockClear();
        await service.getPendingFollowUps(INST_A, author);
        expect(prisma.studentObservation.findMany.mock.calls[0][0].where.institutionId).toBe(INST_A);
      }
    });
  });

  // ── Test 12 · las ocho lecturas por identificador ─────────────────────────
  describe('las ocho lecturas por identificador', () => {
    it('getById va acotado por institución', async () => {
      const { service, prisma } = build();
      await expect(service.getById('o1', INST_A)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.studentObservation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'o1', institutionId: INST_A } }),
      );
    });

    it.each([
      ['getByStudent',            'studentObservation', (s: any, i: string) => s.getByStudent('e1', i)],
      ['getCommitmentsByStudent', 'observerCommitment', (s: any, i: string) => s.getCommitmentsByStudent('e1', i)],
      ['getCitationsByStudent',   'guardianCitation',   (s: any, i: string) => s.getCitationsByStudent('e1', i)],
      ['getReferralsByStudent',   'observerReferral',   (s: any, i: string) => s.getReferralsByStudent('e1', i)],
    ])('%s filtra por institución además de por matrícula', async (_n, entidad, call) => {
      const { service, prisma } = build();
      await call(service, INST_A);
      expect(prisma[entidad].findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ institutionId: INST_A, studentEnrollmentId: 'e1' }) }),
      );
    });

    it('getStudentTimeline acota las CINCO consultas', async () => {
      const { service, prisma } = build();
      await service.getStudentTimeline('e1', INST_A);
      for (const e of ['studentObservation', 'observerCommitment', 'guardianCitation', 'observerReferral', 'pedagogicalMeasure']) {
        expect(prisma[e].findMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: expect.objectContaining({ institutionId: INST_A }) }),
        );
      }
    });

    it('getStudentSummary acota sus cuatro consultas', async () => {
      const { service, prisma } = build();
      await service.getStudentSummary('e1', INST_A);
      for (const e of ['studentObservation', 'observerCommitment', 'guardianCitation', 'observerReferral']) {
        expect(prisma[e].findMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: expect.objectContaining({ institutionId: INST_A }) }),
        );
      }
    });

    it('getByGroup filtra por institución además de por grupo', async () => {
      const { service, prisma } = build();
      await service.getByGroup('g1', 'y1', INST_A, {});
      const where = prisma.studentObservation.findMany.mock.calls[0][0].where;
      expect(where.institutionId).toBe(INST_A);
      expect(where.studentEnrollment).toEqual({ groupId: 'g1', academicYearId: 'y1' });
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2) CONTROLADOR
// ═══════════════════════════════════════════════════════════════════════════════
describe('ObserverController · resolución de institución', () => {
  function build() {
    const service: any = {};
    for (const m of ['create', 'update', 'delete', 'getDashboard', 'getConvivencialStats',
      'getPendingFollowUps', 'getByGroup', 'getByStudent', 'getStudentTimeline',
      'getStudentSummary', 'getCommissionData', 'getById', 'markParentNotified',
      'createActa', 'updateActa', 'createCommitment', 'updateCommitment',
      'getCommitmentsByStudent', 'createCitation', 'updateCitation', 'getCitationsByStudent',
      'createReferral', 'updateReferral', 'getReferralsByStudent', 'createMeasure',
      'updateMeasure']) {
      service[m] = jest.fn().mockResolvedValue({});
    }
    const prisma = { institutionUser: { findFirst: jest.fn().mockResolvedValue(null) } };
    return { controller: new ObserverController(service, prisma as any), service };
  }

  it.each([
    ['update',                 (c: any, r: any) => c.update(r, 'o1', {})],
    ['delete',                 (c: any, r: any) => c.delete(r, 'o1')],
    ['getById',                (c: any, r: any) => c.getById(r, 'o1')],
    ['markParentNotified',     (c: any, r: any) => c.markParentNotified(r, 'o1')],
    ['getStudentTimeline',     (c: any, r: any) => c.getStudentTimeline(r, 'e1')],
    ['getStudentSummary',      (c: any, r: any) => c.getStudentSummary(r, 'e1')],
    ['getCommitmentsByStudent',(c: any, r: any) => c.getCommitmentsByStudent(r, 'e1')],
    ['getCitationsByStudent',  (c: any, r: any) => c.getCitationsByStudent(r, 'e1')],
    ['getReferralsByStudent',  (c: any, r: any) => c.getReferralsByStudent(r, 'e1')],
    ['updateActa',             (c: any, r: any) => c.updateActa(r, 'a1', {})],
    ['updateMeasure',          (c: any, r: any) => c.updateMeasure(r, 'm1', {})],
  ])('%s recibe la institución resuelta del contexto', async (name, call) => {
    const { controller, service } = build();
    await call(controller, actorDe(INST_A));
    const args = service[name].mock.calls[0];
    expect(args[args.length - 1]).toBe(INST_A);
  });

  // Tests 7-8 · ESTUDIANTE
  it('un ESTUDIANTE de A consulta con la institución de A, nunca la de B', async () => {
    const { controller, service } = build();
    await controller.getByStudent(actorDe(INST_A, 'ESTUDIANTE'), 'e-de-b');
    expect(service.getByStudent).toHaveBeenCalledWith('e-de-b', INST_A, expect.anything());
  });

  it('un ESTUDIANTE no puede forzar otra institución en el timeline', async () => {
    const { controller, service } = build();
    await controller.getStudentTimeline(actorDe(INST_A, 'ESTUDIANTE'), 'e-de-b');
    expect(service.getStudentTimeline).toHaveBeenCalledWith('e-de-b', INST_A);
  });

  it('pending-followups: all=true conserva la institución del actor', async () => {
    const { controller, service } = build();
    await controller.getPendingFollowUps(actorDe(INST_A, 'DOCENTE'), 'true');
    expect(service.getPendingFollowUps).toHaveBeenCalledWith(INST_A, undefined);
  });

  it('pending-followups: all=false pasa el autor y la institución', async () => {
    const { controller, service } = build();
    await controller.getPendingFollowUps(actorDe(INST_A, 'DOCENTE'), undefined);
    expect(service.getPendingFollowUps).toHaveBeenCalledWith(INST_A, USER);
  });

  it('sin institución resoluble no se ejecuta ninguna escritura', async () => {
    const { controller, service } = build();
    await expect(controller.delete(actorDe(null), 'o1')).rejects.toThrow();
    expect(service.delete).not.toHaveBeenCalled();
  });
});
