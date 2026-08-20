import { NotFoundException, BadRequestException, ExecutionContext } from '@nestjs/common';
import { GuardiansController } from './guardians.controller';
import { GuardiansService } from './guardians.service';
import { StudentsGuard } from '../auth/guards/students.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';

/**
 * Aislamiento multi-tenant de `guardians` (docs/security/RLS-AUDIT-FASE0.3.md).
 *
 * Antes de este endurecimiento, los diez endpoints eran alcanzables por cualquier usuario
 * autenticado y ninguno comprobaba la institución. El peor no era falsificar el
 * `institutionId` sino OMITIRLO: `GET /guardians` sin parámetro devolvía los acudientes
 * —con sus estudiantes— de TODA la plataforma.
 *
 * Cada bloque de abajo corresponde a un vector real. Si alguno vuelve a fallar, la ruta
 * ha recuperado su comportamiento vulnerable.
 */

const INST_A = 'inst-aaa';
const INST_B = 'inst-bbb';

const usuarioDe = (institutionId: string | null, extra: Record<string, any> = {}) => ({
  user: { id: 'u1', institutionId, isSuperAdmin: false, roles: ['COORDINADOR'], ...extra },
});
const superAdmin = () => ({
  user: { id: 'sa', institutionId: null, isSuperAdmin: true, roles: ['SUPERADMIN'] },
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1) CONTROLADOR — la institución la resuelve el servidor, nunca el cliente
// ═══════════════════════════════════════════════════════════════════════════════
describe('GuardiansController · resolución de institución', () => {
  function build() {
    const service = {
      create: jest.fn().mockResolvedValue({}),
      createWithLink: jest.fn().mockResolvedValue({}),
      list: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue({}),
      findByStudent: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      linkToStudent: jest.fn().mockResolvedValue({}),
      unlinkFromStudent: jest.fn().mockResolvedValue({}),
      updateLink: jest.fn().mockResolvedValue({}),
    };
    const prisma = { institutionUser: { findFirst: jest.fn().mockResolvedValue(null) } };
    return { controller: new GuardiansController(service as any, prisma as any), service };
  }

  // Test 1 — el defecto prioritario.
  it('GET /guardians SIN institutionId usa la del usuario, nunca "todas"', async () => {
    const { controller, service } = build();
    await controller.list(usuarioDe(INST_A));
    expect(service.list).toHaveBeenCalledWith({ institutionId: INST_A, search: undefined });
  });

  // Test 2
  it('GET /guardians?institutionId=B devuelve los de A', async () => {
    const { controller, service } = build();
    await controller.list(usuarioDe(INST_A), INST_B, 'perez');
    expect(service.list).toHaveBeenCalledWith({ institutionId: INST_A, search: 'perez' });
  });

  // Test 3
  it('POST /guardians con institutionId=B en el DTO crea en A', async () => {
    const { controller, service } = build();
    const dto: any = { institutionId: INST_B, documentNumber: '123', firstName: 'Ana' };
    await controller.create(usuarioDe(INST_A), dto);
    expect(service.create).toHaveBeenCalledWith(dto, INST_A);
  });

  // Test 4
  it('POST /guardians/with-link con institutionId=B opera dentro de A', async () => {
    const { controller, service } = build();
    const dto: any = { institutionId: INST_B, studentId: 's1', documentNumber: '123' };
    await controller.createWithLink(usuarioDe(INST_A), dto);
    expect(service.createWithLink).toHaveBeenCalledWith(dto, INST_A);
  });

  it.each([
    ['findById', (c: GuardiansController, req: any) => c.findById(req, 'g1', INST_B)],
    ['findByStudent', (c: GuardiansController, req: any) => c.findByStudent(req, 's1', INST_B)],
    ['update', (c: GuardiansController, req: any) => c.update(req, 'g1', {} as any, INST_B)],
    ['unlinkFromStudent', (c: GuardiansController, req: any) => c.unlinkFromStudent(req, 's1', 'g1', INST_B)],
    ['updateLink', (c: GuardiansController, req: any) => c.updateLink(req, 's1', 'g1', {}, INST_B)],
  ])('las rutas por identificador ignoran ?institutionId=B (%s)', async (name, call) => {
    const { controller, service } = build();
    await call(controller, usuarioDe(INST_A));
    const args = (service as any)[name].mock.calls[0];
    expect(args[args.length - 1]).toBe(INST_A);
  });

  it('POST /guardians/link resuelve del JWT y no acepta institución del cuerpo', async () => {
    const { controller, service } = build();
    await controller.linkToStudent(usuarioDe(INST_A), { studentId: 's1', guardianId: 'g1' } as any);
    expect(service.linkToStudent).toHaveBeenCalledWith(expect.anything(), INST_A);
  });

  // Test 16
  it('SuperAdmin conserva su alcance multi-institución explícito', async () => {
    const { controller, service } = build();
    await controller.list(superAdmin(), INST_B);
    expect(service.list).toHaveBeenCalledWith({ institutionId: INST_B, search: undefined });

    await controller.findById(superAdmin(), 'g1', INST_B);
    expect(service.findById).toHaveBeenCalledWith('g1', INST_B);
  });

  it('sin institución resoluble no se llama al servicio', async () => {
    const { controller, service } = build();
    await expect(controller.list(usuarioDe(null))).rejects.toThrow();
    expect(service.list).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2) SERVICIO — comprobación de pertenencia y vínculos cruzados
// ═══════════════════════════════════════════════════════════════════════════════
describe('GuardiansService · pertenencia y vínculos', () => {
  function build() {
    const prisma: any = {
      guardian: {
        findFirst: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'g-nuevo' }),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      student: { findFirst: jest.fn() },
      studentGuardian: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        upsert: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    return { service: new GuardiansService(prisma), prisma };
  }

  /** El recurso pertenece a otra institución → la consulta acotada no lo encuentra. */
  const ajeno = () => null;
  /** El recurso sí pertenece a la institución resuelta. */
  const propio = (id: string) => ({ id });

  // Test 5
  it('GET /:id de un acudiente de B → rechazado', async () => {
    const { service, prisma } = build();
    prisma.guardian.findFirst.mockResolvedValue(ajeno());
    await expect(service.findById('g-de-b', INST_A)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.guardian.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'g-de-b', institutionId: INST_A } }),
    );
  });

  // Test 6
  it('PUT /:id de un acudiente de B → rechazado y sin escritura', async () => {
    const { service, prisma } = build();
    prisma.guardian.findFirst.mockResolvedValue(ajeno());
    await expect(service.update('g-de-b', {} as any, INST_A)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.guardian.update).not.toHaveBeenCalled();
  });

  // Test 7
  it('DELETE /:id de un acudiente de B → rechazado y sin borrado', async () => {
    const { service, prisma } = build();
    prisma.guardian.findFirst.mockResolvedValue(ajeno());
    await expect(service.delete('g-de-b', INST_A)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.guardian.delete).not.toHaveBeenCalled();
  });

  it('GET /student/:id de un estudiante de B → rechazado', async () => {
    const { service, prisma } = build();
    prisma.student.findFirst.mockResolvedValue(ajeno());
    await expect(service.findByStudent('s-de-b', INST_A)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.studentGuardian.findMany).not.toHaveBeenCalled();
  });

  // Test 8 — acudiente de A con estudiante de B
  it('vincular acudiente de A con estudiante de B → rechazado', async () => {
    const { service, prisma } = build();
    prisma.student.findFirst.mockResolvedValue(ajeno());
    prisma.guardian.findFirst.mockResolvedValue(propio('g-a'));
    await expect(
      service.linkToStudent({ studentId: 's-de-b', guardianId: 'g-a' } as any, INST_A),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.studentGuardian.upsert).not.toHaveBeenCalled();
  });

  // Test 9 — acudiente de B con estudiante de A
  it('vincular acudiente de B con estudiante de A → rechazado', async () => {
    const { service, prisma } = build();
    prisma.student.findFirst.mockResolvedValue(propio('s-a'));
    prisma.guardian.findFirst.mockResolvedValue(ajeno());
    await expect(
      service.linkToStudent({ studentId: 's-a', guardianId: 'g-de-b' } as any, INST_A),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.studentGuardian.upsert).not.toHaveBeenCalled();
  });

  // Test 10 — encaminar el boletín de un estudiante ajeno
  it('cambiar receivesGrades de un vínculo de B → rechazado', async () => {
    const { service, prisma } = build();
    prisma.student.findFirst.mockResolvedValue(ajeno());
    prisma.guardian.findFirst.mockResolvedValue(ajeno());
    await expect(
      service.updateLink('s-de-b', 'g-de-b', { receivesGrades: true }, INST_A),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.studentGuardian.update).not.toHaveBeenCalled();
  });

  it('desvincular un par de B → rechazado y sin borrado', async () => {
    const { service, prisma } = build();
    prisma.student.findFirst.mockResolvedValue(ajeno());
    prisma.guardian.findFirst.mockResolvedValue(ajeno());
    await expect(
      service.unlinkFromStudent('s-de-b', 'g-de-b', INST_A),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.studentGuardian.delete).not.toHaveBeenCalled();
  });

  it('with-link sobre un estudiante de B → rechazado antes de crear nada', async () => {
    const { service, prisma } = build();
    prisma.student.findFirst.mockResolvedValue(ajeno());
    await expect(
      service.createWithLink({ studentId: 's-de-b', documentNumber: '1' } as any, INST_A),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.guardian.create).not.toHaveBeenCalled();
    expect(prisma.studentGuardian.upsert).not.toHaveBeenCalled();
  });

  it('list() siempre filtra por institución (nunca un where sin institutionId)', async () => {
    const { service, prisma } = build();
    await service.list({ institutionId: INST_A });
    expect(prisma.guardian.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ institutionId: INST_A }) }),
    );
  });

  it('list() sin institución es un error, no un volcado global', async () => {
    const { service, prisma } = build();
    await expect(service.list({ institutionId: '' } as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.guardian.findMany).not.toHaveBeenCalled();
  });

  it('create() ignora el institutionId del DTO y usa el resuelto', async () => {
    const { service, prisma } = build();
    await service.create({ institutionId: INST_B, documentNumber: '9' } as any, INST_A);
    expect(prisma.guardian.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ institutionId: INST_A }) }),
    );
  });

  // Regresión funcional (tests 17-19): los flujos reales de Students.tsx siguen vivos.
  it('flujo legítimo: leer, editar y crear-con-vínculo dentro de la propia institución', async () => {
    const { service, prisma } = build();

    prisma.student.findFirst.mockResolvedValue(propio('s-a'));
    await expect(service.findByStudent('s-a', INST_A)).resolves.toEqual([]);

    prisma.guardian.findFirst.mockResolvedValue(propio('g-a'));
    await expect(service.update('g-a', { phone: '300' } as any, INST_A)).resolves.toBeDefined();
    expect(prisma.guardian.update).toHaveBeenCalled();

    await expect(
      service.createWithLink({ studentId: 's-a', documentNumber: '1', relationship: 'MADRE' } as any, INST_A),
    ).resolves.toBeDefined();
    expect(prisma.studentGuardian.upsert).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3) AUTORIZACIÓN — quién alcanza el controlador y quién puede destruir
// ═══════════════════════════════════════════════════════════════════════════════
describe('GuardiansController · autorización', () => {
  const ctx = (user: any): ExecutionContext =>
    ({ switchToHttp: () => ({ getRequest: () => ({ user, query: {}, body: {} }) }) } as any);

  function guard(delegated: { canManageStudents: boolean; isActive: boolean } | null) {
    const prisma = { institutionUser: { findUnique: jest.fn().mockResolvedValue(delegated) } };
    return new StudentsGuard(prisma as any);
  }

  // Test 11
  it('un estudiante autenticado no alcanza el módulo', async () => {
    const g = guard(null);
    await expect(
      g.canActivate(ctx({ id: 'e1', institutionId: INST_A, roles: ['ESTUDIANTE'] })),
    ).resolves.toBe(false);
  });

  // Test 12
  it('un docente SIN canManageStudents es rechazado', async () => {
    const g = guard({ canManageStudents: false, isActive: true });
    await expect(
      g.canActivate(ctx({ id: 'd1', institutionId: INST_A, roles: ['DOCENTE'] })),
    ).resolves.toBe(false);
  });

  // Test 13 — el flujo que una lista de @Roles habría roto
  it('un docente CON canManageStudents conserva el acceso', async () => {
    const g = guard({ canManageStudents: true, isActive: true });
    await expect(
      g.canActivate(ctx({ id: 'd2', institutionId: INST_A, roles: ['DOCENTE'] })),
    ).resolves.toBe(true);
  });

  // Tests 14, 15, 16
  it.each([['COORDINADOR'], ['ADMIN_INSTITUTIONAL'], ['SUPERADMIN']])(
    '%s conserva el acceso',
    async (rol) => {
      const g = guard(null);
      await expect(
        g.canActivate(ctx({ id: 'x', institutionId: INST_A, roles: [rol] })),
      ).resolves.toBe(true);
    },
  );

  it('el controlador exige StudentsGuard además de JwtAuthGuard y RolesGuard', () => {
    const guards = Reflect.getMetadata('__guards__', GuardiansController) || [];
    expect(guards.map((g: any) => g.name)).toEqual(
      expect.arrayContaining(['JwtAuthGuard', 'RolesGuard', 'StudentsGuard']),
    );
  });

  it('las rutas destructivas quedan reservadas a perfiles administrativos', () => {
    for (const metodo of ['delete', 'unlinkFromStudent'] as const) {
      const roles = Reflect.getMetadata(ROLES_KEY, GuardiansController.prototype[metodo]);
      expect(roles).toEqual(['SUPERADMIN', 'ADMIN_INSTITUTIONAL']);
    }
  });

  it('las rutas NO destructivas no llevan @Roles: el acceso lo decide StudentsGuard', () => {
    for (const metodo of ['create', 'createWithLink', 'list', 'update', 'updateLink'] as const) {
      const roles = Reflect.getMetadata(ROLES_KEY, GuardiansController.prototype[metodo]);
      expect(roles).toBeUndefined();
    }
  });
});
