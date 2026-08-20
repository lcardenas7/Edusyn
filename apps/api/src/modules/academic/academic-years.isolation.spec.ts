import { NotFoundException } from '@nestjs/common';
import { AcademicYearLifecycleService } from './academic-year-lifecycle.service';
import { AcademicYearLifecycleController } from './academic-year-lifecycle.controller';

/**
 * Aislamiento multi-tenant de `academic-years`
 * (docs/security/RLS-AUDIT-ACADEMIC-YEARS.md).
 *
 * `getYearById` hacía `findUnique({ where: { id } })` sin filtro, y TODAS las mutaciones
 * del ciclo de vida lo invocan primero. Un ADMIN de A que conociera el `yearId` de B podía
 * cerrar su año lectivo: eso dispara el cálculo de promociones y reescribe el estado de
 * matrícula de todos sus estudiantes.
 *
 * El caso peor era `promote-to`: recibe DOS años y solo se acotaba uno, así que podía
 * crearse una `StudentEnrollment` con `institutionId` de A y `academicYearId` de B — una
 * fila incoherente entre tenants, el mismo patrón que el vínculo `StudentGuardian` cruzado
 * y una mina para la futura política RLS.
 */

const INST_A = 'inst-aaa';
const INST_B = 'inst-bbb';

const actorDe = (institutionId: string | null) => ({
  user: { id: 'u1', institutionId, isSuperAdmin: false, roles: ['ADMIN_INSTITUTIONAL'] },
});
const superAdmin = () => ({
  user: { id: 'sa', institutionId: null, isSuperAdmin: true, roles: ['SUPERADMIN'] },
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1) SERVICIO — la consulta va acotada por institución
// ═══════════════════════════════════════════════════════════════════════════════
describe('AcademicYearLifecycleService · aislamiento', () => {
  function build() {
    const prisma: any = {
      academicYear: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'y-nuevo' }),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      academicTerm: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
      studentEnrollment: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'e-nuevo' }),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
      },
      enrollmentEvent: { create: jest.fn().mockResolvedValue({}) },
      grade: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (fn: any) => fn({
        studentEnrollment: { update: jest.fn().mockResolvedValue({}) },
        enrollmentEvent: { create: jest.fn().mockResolvedValue({}) },
        academicYear: { update: jest.fn().mockResolvedValue({}) },
      })),
    };
    const institutionContext = { getContext: jest.fn().mockResolvedValue({}) };
    const service = new AcademicYearLifecycleService(prisma, institutionContext as any, null as any, null as any);
    return { service, prisma };
  }

  const anioDe = (id: string, institutionId: string, status = 'ACTIVE') =>
    ({ id, institutionId, status, year: 2026, terms: [], calendar: null, _count: {} });

  // Tests 1-2
  describe('getYearById · punto único de control', () => {
    it('acota la consulta a la institución del actor', async () => {
      const { service, prisma } = build();
      prisma.academicYear.findFirst.mockResolvedValue(anioDe('y1', INST_A));
      await service.getYearById('y1', INST_A);
      expect(prisma.academicYear.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'y1', institutionId: INST_A } }),
      );
    });

    it('un año de B no existe para un actor de A', async () => {
      const { service, prisma } = build();
      prisma.academicYear.findFirst.mockResolvedValue(null);
      await expect(service.getYearById('y-de-b', INST_A)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // Tests 4-5 · close
  describe('close', () => {
    it('con un año de B → rechazado, SIN ninguna escritura', async () => {
      const { service, prisma } = build();
      prisma.academicYear.findFirst.mockResolvedValue(null);
      await expect(
        service.closeYear({ yearId: 'y-de-b', userId: 'u1', institutionId: INST_A }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.academicYear.update).not.toHaveBeenCalled();
    });

    it('con el año propio conserva la cascada académica completa', async () => {
      const { service, prisma } = build();
      prisma.academicYear.findFirst.mockResolvedValue(anioDe('y-a', INST_A, 'ACTIVE'));
      jest.spyOn(service, 'validateYearForClosure').mockResolvedValue([]);

      const res = await service.closeYear({
        yearId: 'y-a', userId: 'u1', institutionId: INST_A, calculatePromotions: false,
      });

      // La transacción de escritura se ejecuta: la lógica académica NO cambió.
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(res.success).toBe(true);
      expect(res.yearId).toBe('y-a');
    });
  });

  // Tests 7-8 · activate
  describe('activate', () => {
    it('con un año de B → rechazado sin escritura', async () => {
      const { service, prisma } = build();
      prisma.academicYear.findFirst.mockResolvedValue(null);
      await expect(
        service.activateYear({ yearId: 'y-de-b', userId: 'u1', institutionId: INST_A }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.academicYear.update).not.toHaveBeenCalled();
    });
  });

  // Tests 9-12 · promote-to · las cuatro combinaciones
  describe('promote-to · AMBOS años deben ser de la institución resuelta', () => {
    /** getYearById acotado: solo resuelve los años de la institución indicada. */
    function conAnios(prisma: any, mapa: Record<string, string>) {
      prisma.academicYear.findFirst.mockImplementation(({ where }: any) =>
        Promise.resolve(
          mapa[where.id] === where.institutionId
            ? anioDe(where.id, where.institutionId, where.id === 'y-a-from' ? 'CLOSED' : 'DRAFT')
            : null,
        ),
      );
    }

    it('A + fromYear A + toYear A → permitido', async () => {
      const { service, prisma } = build();
      conAnios(prisma, { 'y-a-from': INST_A, 'y-a-to': INST_A });
      await expect(
        service.promoteStudents({ fromYearId: 'y-a-from', toYearId: 'y-a-to', userId: 'u1', institutionId: INST_A }),
      ).resolves.toBeDefined();
    });

    it('A + fromYear B + toYear A → rechazado', async () => {
      const { service, prisma } = build();
      conAnios(prisma, { 'y-b-from': INST_B, 'y-a-to': INST_A });
      await expect(
        service.promoteStudents({ fromYearId: 'y-b-from', toYearId: 'y-a-to', userId: 'u1', institutionId: INST_A }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.studentEnrollment.create).not.toHaveBeenCalled();
    });

    // ── EL VECTOR CLAVE: la fila incoherente entre tenants ──
    it('A + fromYear A + toYear B → rechazado (no se crea matrícula cruzada)', async () => {
      const { service, prisma } = build();
      conAnios(prisma, { 'y-a-from': INST_A, 'y-b-to': INST_B });
      await expect(
        service.promoteStudents({ fromYearId: 'y-a-from', toYearId: 'y-b-to', userId: 'u1', institutionId: INST_A }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.studentEnrollment.create).not.toHaveBeenCalled();
    });

    it('A + fromYear B + toYear B → rechazado', async () => {
      const { service, prisma } = build();
      conAnios(prisma, { 'y-b-from': INST_B, 'y-b-to': INST_B });
      await expect(
        service.promoteStudents({ fromYearId: 'y-b-from', toYearId: 'y-b-to', userId: 'u1', institutionId: INST_A }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.studentEnrollment.create).not.toHaveBeenCalled();
    });
  });

  // Tests 16-19 · update / delete
  describe('update y delete', () => {
    it('update de un año de B → rechazado sin escritura', async () => {
      const { service, prisma } = build();
      prisma.academicYear.findFirst.mockResolvedValue(null);
      await expect(service.updateYear('y-de-b', {}, INST_A)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.academicYear.update).not.toHaveBeenCalled();
    });

    it('delete de un año de B → rechazado sin borrado', async () => {
      const { service, prisma } = build();
      prisma.academicYear.findFirst.mockResolvedValue(null);
      await expect(service.deleteYear('y-de-b', INST_A)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.academicYear.delete).not.toHaveBeenCalled();
    });

    it('delete conserva sus salvaguardas: solo DRAFT y sin matrículas', async () => {
      const { service, prisma } = build();
      prisma.academicYear.findFirst.mockResolvedValue(anioDe('y-a', INST_A, 'ACTIVE'));
      await expect(service.deleteYear('y-a', INST_A)).rejects.toThrow(/DRAFT/);

      prisma.academicYear.findFirst.mockResolvedValue(anioDe('y-a', INST_A, 'DRAFT'));
      prisma.studentEnrollment.count.mockResolvedValue(3);
      await expect(service.deleteYear('y-a', INST_A)).rejects.toThrow(/matrículas/);
      expect(prisma.academicYear.delete).not.toHaveBeenCalled();
    });
  });

  // Tests 13-14 · creación
  it('createYear ignora el institutionId del DTO y usa el resuelto', async () => {
    const { service, prisma } = build();
    prisma.academicYear.findUnique.mockResolvedValue(null);
    await service.createYear({ institutionId: INST_B, year: 2027 } as any, INST_A);
    expect(prisma.academicYear.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ institutionId: INST_A }) }),
    );
  });

  // Test 21 · lecturas
  it('previewPromotions acota la consulta del año', async () => {
    const { service, prisma } = build();
    prisma.academicYear.findFirst.mockResolvedValue(null);
    await service.previewPromotions('y-de-b', INST_A).catch(() => undefined);
    expect(prisma.academicYear.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'y-de-b', institutionId: INST_A } }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2) CONTROLADOR — la institución la resuelve el servidor
// ═══════════════════════════════════════════════════════════════════════════════
describe('AcademicYearLifecycleController · resolución de institución', () => {
  function build() {
    const service: any = {};
    for (const m of ['createYear', 'getYearsByInstitution', 'getCurrentYear', 'getYearById',
      'updateYear', 'deleteYear', 'activateYear', 'closeYear', 'validateYearForActivation',
      'validateYearForClosure', 'previewPromotions', 'promoteStudents',
      'canEditStructure', 'canRecordGrades', 'canEnrollStudents', 'canModify']) {
      service[m] = jest.fn().mockResolvedValue(m === 'validateYearForClosure' ? [] : {});
    }
    const prisma = { institutionUser: { findFirst: jest.fn().mockResolvedValue(null) } };
    return { controller: new AcademicYearLifecycleController(service, prisma as any), service };
  }

  // Tests 25-26 · getByInstitution — 7 consumidores, todos envían su propia institución
  it('getByInstitution: un actor de A pidiendo B recibe A', async () => {
    const { controller, service } = build();
    await controller.getYearsByInstitution(actorDe(INST_A), INST_B);
    expect(service.getYearsByInstitution).toHaveBeenCalledWith(INST_A);
  });

  // Tests 22-23 · getCurrent — alcanzable por ESTUDIANTE
  it('getCurrent: un actor de A pidiendo B recibe A', async () => {
    const { controller, service } = build();
    await controller.getCurrentYear(actorDe(INST_A), INST_B);
    expect(service.getCurrentYear).toHaveBeenCalledWith(INST_A);
  });

  it('getCurrent: un ESTUDIANTE de A solo obtiene el contexto de A', async () => {
    const { controller, service } = build();
    const estudiante = { user: { id: 'e1', institutionId: INST_A, isSuperAdmin: false, roles: ['ESTUDIANTE'] } };
    await controller.getCurrentYear(estudiante, INST_B);
    expect(service.getCurrentYear).toHaveBeenCalledWith(INST_A);
  });

  it('getYears (query): un actor de A pidiendo B recibe A', async () => {
    const { controller, service } = build();
    await controller.getYears(actorDe(INST_A), INST_B);
    expect(service.getYearsByInstitution).toHaveBeenCalledWith(INST_A);
  });

  it('createYear: el institutionId del DTO se ignora', async () => {
    const { controller, service } = build();
    const dto: any = { institutionId: INST_B, year: 2027 };
    await controller.createYear(actorDe(INST_A), dto);
    expect(service.createYear).toHaveBeenCalledWith(dto, INST_A);
  });

  it.each([
    ['activateYear', (c: any, r: any) => c.activateYear('y1', r)],
    ['closeYear', (c: any, r: any) => c.closeYear('y1', {}, r)],
  ])('las mutaciones del ciclo de vida reciben la institución resuelta (%s)', async (name, call) => {
    const { controller, service } = build();
    await call(controller, actorDe(INST_A));
    expect(service[name]).toHaveBeenCalledWith(expect.objectContaining({ institutionId: INST_A }));
  });

  it('promote-to pasa la institución resuelta junto a los dos años', async () => {
    const { controller, service } = build();
    await controller.promoteStudents('y-from', 'y-to', actorDe(INST_A));
    expect(service.promoteStudents).toHaveBeenCalledWith(
      expect.objectContaining({ fromYearId: 'y-from', toYearId: 'y-to', institutionId: INST_A }),
    );
  });

  it('permissions valida el año antes de leer los estados', async () => {
    const { controller, service } = build();
    await controller.getYearPermissions(actorDe(INST_A), 'y1');
    expect(service.getYearById).toHaveBeenCalledWith('y1', INST_A);
  });

  // Tests 3, 6, 15, 24, 27 · SuperAdmin
  it('SuperAdmin conserva su alcance explícito en las rutas de listado', async () => {
    const { controller, service } = build();
    await controller.getYearsByInstitution(superAdmin(), INST_B);
    expect(service.getYearsByInstitution).toHaveBeenCalledWith(INST_B);

    await controller.getCurrentYear(superAdmin(), INST_B);
    expect(service.getCurrentYear).toHaveBeenCalledWith(INST_B);
  });

  it('SuperAdmin conserva su alcance explícito al crear', async () => {
    const { controller, service } = build();
    const dto: any = { institutionId: INST_B, year: 2027 };
    await controller.createYear(superAdmin(), dto);
    expect(service.createYear).toHaveBeenCalledWith(dto, INST_B);
  });

  it('sin institución resoluble no se ejecuta ninguna mutación', async () => {
    const { controller, service } = build();
    await expect(controller.closeYear('y1', {}, actorDe(null))).rejects.toThrow();
    expect(service.closeYear).not.toHaveBeenCalled();
  });
});
