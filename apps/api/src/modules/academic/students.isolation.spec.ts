import { NotFoundException, BadRequestException } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

/**
 * Aislamiento multi-tenant de `students`
 * (docs/security/RLS-CENSO-CROSS-TENANT.md · RLS-VALIDACION-CENSO.md).
 *
 * Este módulo demostró que el aislamiento NO se agota comprobando `institutionId`: recibe
 * del cliente `academicYearId`, `groupId`, `studentId` y `enrollmentId`, y un identificador
 * válido de otra institución sigue siendo un ataque cross-tenant. También es la puerta
 * lateral por la que se alcanzaban `Guardian` y `StudentGuardian` sin pasar por el
 * controlador de acudientes ya endurecido.
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
// 1) CONTROLADOR — la institución la resuelve el servidor
// ═══════════════════════════════════════════════════════════════════════════════
describe('StudentsController · resolución de institución', () => {
  function build() {
    const service: any = {};
    for (const m of ['create', 'list', 'enroll', 'bulkImport', 'bulkActivateAccess',
      'bulkResetPassword', 'bulkSetPasswordToUsername', 'bulkRegenerateCredentials',
      'bulkDeleteWithoutRecords', 'updateEnrollmentStatus', 'findById', 'update', 'delete',
      'getEnrollmentsByStudent', 'activateAccess', 'deactivateAccess', 'resetPassword',
      'getCredentials', 'getStudentsForBulkUpdate', 'bulkUpdateStudents']) {
      service[m] = jest.fn().mockResolvedValue({});
    }
    const prisma = { institutionUser: { findFirst: jest.fn().mockResolvedValue(null) } };
    return { controller: new StudentsController(service, prisma as any), service };
  }

  // Test 2 y 5 — el institutionId del cuerpo nunca es autoridad
  it('bulk-delete: un ADMIN de A que envía institutionId=B opera sobre A', async () => {
    const { controller, service } = build();
    await controller.bulkDeleteWithoutRecords(actorDe(INST_A), { institutionId: INST_B });
    expect(service.bulkDeleteWithoutRecords).toHaveBeenCalledWith(INST_A);
  });

  it('bulk-import: un ADMIN de A que envía institutionId=B importa en A', async () => {
    const { controller, service } = build();
    const data: any = { institutionId: INST_B, academicYearId: 'y1', students: [] };
    await controller.bulkImport(actorDe(INST_A), data);
    expect(service.bulkImport).toHaveBeenCalledWith(data, INST_A);
  });

  it('POST /students: el institutionId del DTO se ignora', async () => {
    const { controller, service } = build();
    const dto: any = { institutionId: INST_B, documentNumber: '1', firstName: 'Ana' };
    await controller.create(actorDe(INST_A), dto);
    expect(service.create).toHaveBeenCalledWith(dto, INST_A);
  });

  it('GET /students sin institutionId usa la del actor, nunca "todas"', async () => {
    const { controller, service } = build();
    await controller.list(actorDe(INST_A));
    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining({ institutionId: INST_A }),
    );
  });

  it.each([
    ['findById', (c: any, r: any) => c.findById(r, 's1')],
    ['update', (c: any, r: any) => c.update(r, 's1', {})],
    ['delete', (c: any, r: any) => c.delete(r, 's1')],
    ['activateAccess', (c: any, r: any) => c.activateAccess(r, 's1')],
    ['deactivateAccess', (c: any, r: any) => c.deactivateAccess(r, 's1')],
    ['resetPassword', (c: any, r: any) => c.resetPassword(r, 's1')],
    ['getEnrollmentsByStudent', (c: any, r: any) => c.getEnrollments(r, 's1')],
  ])('las rutas por id reciben la institución resuelta (%s)', async (name, call) => {
    const { controller, service } = build();
    await call(controller, actorDe(INST_A));
    const args = service[name].mock.calls[0];
    expect(args[args.length - 1]).toBe(INST_A);
  });

  it.each([
    ['bulkActivateAccess', 'bulkActivateAccess'],
    ['bulkResetPassword', 'bulkResetPassword'],
    ['bulkPasswordEqualsUsername', 'bulkSetPasswordToUsername'],
    ['bulkRegenerateCredentials', 'bulkRegenerateCredentials'],
  ])('las operaciones masivas de credenciales reciben la institución (%s)', async (ctrlM, svcM) => {
    const { controller, service } = build();
    await (controller as any)[ctrlM](actorDe(INST_A), { studentIds: ['s1', 's2'] });
    expect(service[svcM]).toHaveBeenCalledWith(['s1', 's2'], INST_A);
  });

  // Test 16 del bloque guardians: el SuperAdmin conserva su alcance
  it('SuperAdmin conserva su alcance explícito', async () => {
    const { controller, service } = build();
    await controller.bulkDeleteWithoutRecords(superAdmin(), { institutionId: INST_B });
    expect(service.bulkDeleteWithoutRecords).toHaveBeenCalledWith(INST_B);
  });

  it('sin institución resoluble no se ejecuta ninguna escritura', async () => {
    const { controller, service } = build();
    await expect(
      controller.bulkDeleteWithoutRecords(actorDe(null), { institutionId: INST_B }),
    ).rejects.toThrow();
    expect(service.bulkDeleteWithoutRecords).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2) SERVICIO — pertenencia de TODAS las dimensiones del tenant
// ═══════════════════════════════════════════════════════════════════════════════
describe('StudentsService · pertenencia multi-dimensional', () => {
  function build() {
    const prisma: any = {
      student: {
        findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 's-nuevo', institutionId: INST_A }),
        update: jest.fn().mockResolvedValue({}), delete: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      academicYear: { findFirst: jest.fn() },
      group: { findFirst: jest.fn() },
      studentEnrollment: {
        findFirst: jest.fn(), findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({}), update: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      guardian: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'g1' }) },
      studentGuardian: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      studentDocument: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      user: { update: jest.fn(), delete: jest.fn(), create: jest.fn() },
    };
    return { service: new StudentsService(prisma), prisma };
  }
  const ajeno = () => null;
  const propio = (id: string) => ({ id, institutionId: INST_A });

  // Test 3 y 17
  it('update de un estudiante de B → rechazado sin escritura', async () => {
    const { service, prisma } = build();
    prisma.student.findFirst.mockResolvedValue(ajeno());
    await expect(service.update('s-de-b', {} as any, INST_A)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.student.update).not.toHaveBeenCalled();
  });

  it('delete de un estudiante de B → rechazado sin borrado', async () => {
    const { service, prisma } = build();
    prisma.student.findFirst.mockResolvedValue(ajeno());
    await expect(service.delete('s-de-b', INST_A)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.student.delete).not.toHaveBeenCalled();
    expect(prisma.studentGuardian.deleteMany).not.toHaveBeenCalled();
  });

  it('findById de un estudiante de B → consulta acotada', async () => {
    const { service, prisma } = build();
    await service.findById('s-de-b', INST_A);
    expect(prisma.student.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's-de-b', institutionId: INST_A } }),
    );
  });

  // Credenciales: el vector más grave descubierto durante la implementación
  it.each([
    ['bulkResetPassword'], ['bulkActivateAccess'],
    ['bulkSetPasswordToUsername'], ['bulkRegenerateCredentials'],
  ])('%s con un estudiante de B → rechazado en bloque', async (metodo) => {
    const { service, prisma } = build();
    prisma.student.findMany.mockResolvedValue([{ id: 's-a' }]); // falta el de B
    await expect(
      (service as any)[metodo](['s-a', 's-de-b'], INST_A),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('resetPassword individual sobre un estudiante de B → rechazado', async () => {
    const { service, prisma } = build();
    prisma.student.findFirst.mockResolvedValue(ajeno());
    await expect(service.resetPassword('s-de-b', INST_A)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  // Tests 6, 7, 15, 16 — las otras dimensiones del tenant
  it('enroll con año lectivo de B → rechazado', async () => {
    const { service, prisma } = build();
    prisma.student.findFirst.mockResolvedValue(propio('s-a'));
    prisma.academicYear.findFirst.mockResolvedValue(ajeno());
    prisma.group.findFirst.mockResolvedValue({ id: 'g-a' });
    await expect(
      service.enroll({ studentId: 's-a', academicYearId: 'y-de-b', groupId: 'g-a' } as any, INST_A),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.studentEnrollment.create).not.toHaveBeenCalled();
  });

  it('enroll con grupo de B → rechazado', async () => {
    const { service, prisma } = build();
    prisma.student.findFirst.mockResolvedValue(propio('s-a'));
    prisma.academicYear.findFirst.mockResolvedValue({ id: 'y-a' });
    prisma.group.findFirst.mockResolvedValue(ajeno());
    await expect(
      service.enroll({ studentId: 's-a', academicYearId: 'y-a', groupId: 'g-de-b' } as any, INST_A),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.studentEnrollment.create).not.toHaveBeenCalled();
  });

  it('enroll con las tres dimensiones propias → funciona y usa la institución resuelta', async () => {
    const { service, prisma } = build();
    prisma.student.findFirst.mockResolvedValue(propio('s-a'));
    prisma.academicYear.findFirst.mockResolvedValue({ id: 'y-a' });
    prisma.group.findFirst.mockResolvedValue({ id: 'g-a' });
    await service.enroll({ studentId: 's-a', academicYearId: 'y-a', groupId: 'g-a' } as any, INST_A);
    expect(prisma.studentEnrollment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ institutionId: INST_A }) }),
    );
  });

  it('el grupo se valida por su sede, porque Group no tiene institutionId', async () => {
    const { service, prisma } = build();
    prisma.student.findFirst.mockResolvedValue(propio('s-a'));
    prisma.academicYear.findFirst.mockResolvedValue({ id: 'y-a' });
    prisma.group.findFirst.mockResolvedValue({ id: 'g-a' });
    await service.enroll({ studentId: 's-a', academicYearId: 'y-a', groupId: 'g-a' } as any, INST_A);
    expect(prisma.group.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'g-a', campus: { institutionId: INST_A } } }),
    );
  });

  it('updateEnrollmentStatus sobre una matrícula de B → rechazado', async () => {
    const { service, prisma } = build();
    prisma.studentEnrollment.findFirst.mockResolvedValue(ajeno());
    await expect(
      service.updateEnrollmentStatus('e-de-b', { status: 'WITHDRAWN' } as any, INST_A),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.studentEnrollment.update).not.toHaveBeenCalled();
  });

  // Tests 6 y 7 aplicados a bulk-import
  it('bulk-import con año lectivo de B → rechazado antes de escribir nada', async () => {
    const { service, prisma } = build();
    prisma.academicYear.findFirst.mockResolvedValue(ajeno());
    await expect(
      service.bulkImport({ institutionId: INST_B, academicYearId: 'y-de-b', students: [] } as any, INST_A),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.student.create).not.toHaveBeenCalled();
    expect(prisma.guardian.create).not.toHaveBeenCalled();
  });

  it('bulk-import con grupo de B → rechazado antes de escribir nada', async () => {
    const { service, prisma } = build();
    prisma.academicYear.findFirst.mockResolvedValue({ id: 'y-a' });
    prisma.group.findFirst.mockResolvedValue(ajeno());
    await expect(
      service.bulkImport(
        { institutionId: INST_A, academicYearId: 'y-a', students: [{ groupId: 'g-de-b', documentNumber: '1' }] } as any,
        INST_A,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.student.create).not.toHaveBeenCalled();
    expect(prisma.guardian.create).not.toHaveBeenCalled();
  });

  // Tests 9 y 10 — la puerta lateral hacia Guardian
  it('bulk-import crea el Guardian en la institución resuelta, no en la del cuerpo', async () => {
    const { service, prisma } = build();
    prisma.academicYear.findFirst.mockResolvedValue({ id: 'y-a' });
    prisma.group.findFirst.mockResolvedValue({ id: 'g-a' });
    await service.bulkImport({
      institutionId: INST_B,          // ← el atacante pide B
      academicYearId: 'y-a',
      students: [{
        documentNumber: '123', documentType: 'TI', firstName: 'Ana', lastName: 'Ruiz',
        groupId: 'g-a', guardianName: 'Luz Ruiz', guardianPhone: '3001112233',
      }],
    } as any, INST_A);                // ← el servidor resolvió A

    expect(prisma.student.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ institutionId: INST_A }) }),
    );
    expect(prisma.guardian.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ institutionId: INST_A }) }),
    );
  });

  // Test 4 — la salvaguarda de bulk-delete NO debe perderse
  it('bulk-delete conserva la salvaguarda: no borra estudiantes con historial', async () => {
    const { service, prisma } = build();
    prisma.student.findMany.mockResolvedValue([
      { id: 'con-notas', enrollments: [{ grades: [{ id: 'g' }], attendanceRecords: [], studentObservations: [] }] },
      { id: 'sin-nada', enrollments: [{ grades: [], attendanceRecords: [], studentObservations: [] }] },
    ]);
    prisma.student.deleteMany.mockResolvedValue({ count: 1 });

    const res = await service.bulkDeleteWithoutRecords(INST_A);

    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { institutionId: INST_A } }),
    );
    expect(prisma.student.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['sin-nada'] } } });
    expect(res.skipped).toBe(1);
  });

  // Test 1 y 14 — el flujo legítimo sigue vivo
  it('flujo legítimo: crear estudiante en la propia institución', async () => {
    const { service, prisma } = build();
    await service.create({ institutionId: INST_B, documentNumber: '9' } as any, INST_A);
    expect(prisma.student.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ institutionId: INST_A }) }),
    );
  });

  it('list exige institución: omitirla es un error, no un volcado global', async () => {
    const { service, prisma } = build();
    await expect(service.list({ institutionId: '' } as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.student.findMany).not.toHaveBeenCalled();
  });

  it('list por grupo también filtra por institución', async () => {
    const { service, prisma } = build();
    await service.list({ institutionId: INST_A, groupId: 'g-a' });
    expect(prisma.studentEnrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ institutionId: INST_A }) }),
    );
  });
});
