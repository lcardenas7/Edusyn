import { resolveInstitutionId, isSuperAdmin, requireInstitutionId } from './institution-resolver';

/**
 * Pruebas de aislamiento multi-tenant del resolutor de institución.
 *
 * Este helper es hoy la única barrera efectiva contra el acceso cross-tenant
 * (el TenantGuard global nunca ve `req.user`; ver docs/security/RLS-AUDIT-FASE0.1.md §3).
 * Cada caso de abajo corresponde a un defecto real detectado en la auditoría: si alguno
 * vuelve a fallar, la barrera está rota.
 */

const INST_A = 'inst-aaa';
const INST_B = 'inst-bbb';

function prismaMock(rows: Array<{ institutionId: string }> = []) {
  const findFirst = jest.fn().mockResolvedValue(rows[0] ?? null);
  return { prisma: { institutionUser: { findFirst } } as any, findFirst };
}

describe('resolveInstitutionId', () => {
  it('sin usuario autenticado devuelve undefined', async () => {
    const { prisma } = prismaMock();
    await expect(resolveInstitutionId(prisma, {}, INST_B)).resolves.toBeUndefined();
  });

  it('usuario normal: ignora el institutionId del request y usa el del JWT', async () => {
    const { prisma } = prismaMock();
    const req = { user: { id: 'u1', institutionId: INST_A, isSuperAdmin: false } };
    await expect(resolveInstitutionId(prisma, req, INST_B)).resolves.toBe(INST_A);
  });

  it('superadmin real (isSuperAdmin=true) sí puede indicar otra institución', async () => {
    const { prisma } = prismaMock();
    const req = { user: { id: 'u1', institutionId: INST_A, isSuperAdmin: true } };
    await expect(resolveInstitutionId(prisma, req, INST_B)).resolves.toBe(INST_B);
  });

  // REGRESIÓN · defecto 1 de la auditoría (escalada por nombre de rol).
  // Role.name es único GLOBAL: un admin de tenant que lograra asignar un rol llamado
  // 'SUPERADMIN' dentro de su institución NO debe obtener acceso cross-tenant.
  it('rol "SUPERADMIN" en el JWT sin isSuperAdmin=true NO concede acceso cross-tenant', async () => {
    const { prisma } = prismaMock();
    const req = {
      user: { id: 'u1', institutionId: INST_A, isSuperAdmin: false, roles: ['SUPERADMIN'] },
    };
    await expect(resolveInstitutionId(prisma, req, INST_B)).resolves.toBe(INST_A);
  });

  it.each([
    [['SUPER_ADMIN']],
    [[{ role: { name: 'SUPERADMIN' } }]],
    [[{ roleName: 'SUPER_ADMIN' }]],
  ])('tampoco con la forma de rol %j', async (roles) => {
    const { prisma } = prismaMock();
    const req = { user: { id: 'u1', institutionId: INST_A, isSuperAdmin: false, roles } };
    await expect(resolveInstitutionId(prisma, req, INST_B)).resolves.toBe(INST_A);
  });

  // REGRESIÓN · defecto 2 (fallback no determinista).
  // El login (auth.service.ts) ordena por joinedAt asc y filtra isActive: el fallback
  // debe usar exactamente el mismo criterio o el usuario resolvería a instituciones
  // distintas según la ruta invocada.
  it('fallback: consulta InstitutionUser con isActive y orden determinista', async () => {
    const { prisma, findFirst } = prismaMock([{ institutionId: INST_A }]);
    const req = { user: { id: 'u1', institutionId: null, isSuperAdmin: false } };

    await expect(resolveInstitutionId(prisma, req)).resolves.toBe(INST_A);

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1', isActive: true },
        orderBy: { joinedAt: 'asc' },
      }),
    );
  });

  // REGRESIÓN · defecto 3 (vínculos inactivos).
  it('fallback: si no hay vínculo activo devuelve undefined', async () => {
    const { prisma } = prismaMock([]);
    const req = { user: { id: 'u1', institutionId: null, isSuperAdmin: false } };
    await expect(resolveInstitutionId(prisma, req)).resolves.toBeUndefined();
  });

  // REGRESIÓN · el paso 0 leía req.resolvedInstitutionId, que TenantGuard nunca asigna.
  // Si alguien reintroduce esa vía sin decidirlo explícitamente, un atacante que pudiera
  // sembrar esa propiedad saltaría toda la validación.
  it('ignora req.resolvedInstitutionId como fuente de verdad', async () => {
    const { prisma } = prismaMock();
    const req = {
      user: { id: 'u1', institutionId: INST_A, isSuperAdmin: false },
      resolvedInstitutionId: INST_B,
    };
    await expect(resolveInstitutionId(prisma, req)).resolves.toBe(INST_A);
  });
});

describe('isSuperAdmin', () => {
  it('true solo con el claim booleano', () => {
    expect(isSuperAdmin({ isSuperAdmin: true })).toBe(true);
  });

  it('false con el rol textual (regresión del defecto 1)', () => {
    expect(isSuperAdmin({ isSuperAdmin: false, roles: ['SUPERADMIN'] })).toBe(false);
    expect(isSuperAdmin({ roles: [{ role: { name: 'SUPER_ADMIN' } }] })).toBe(false);
  });

  it('false sin usuario', () => {
    expect(isSuperAdmin(null)).toBe(false);
    expect(isSuperAdmin(undefined)).toBe(false);
  });
});

describe('requireInstitutionId', () => {
  it('lanza cuando no se puede resolver', async () => {
    const { prisma } = prismaMock([]);
    const req = { user: { id: 'u1', institutionId: null, isSuperAdmin: false } };
    await expect(requireInstitutionId(prisma, req)).rejects.toThrow(/No se pudo determinar la institución/);
  });

  it('devuelve la institución del JWT para un usuario normal', async () => {
    const { prisma } = prismaMock();
    const req = { user: { id: 'u1', institutionId: INST_A, isSuperAdmin: false } };
    await expect(requireInstitutionId(prisma, req, INST_B)).resolves.toBe(INST_A);
  });
});
