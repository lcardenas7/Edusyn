import { CapabilitiesController } from './capabilities.controller';

/**
 * Regresión de aislamiento multi-tenant en la matriz de capabilities
 * (docs/security/RLS-AUDIT-FASE0.2.md §2.5 · RLS-AUDIT-FASE0.3.md §6).
 *
 * La matriz decide qué puede ver y hacer cada rol DENTRO de cada institución. Antes de
 * la corrección, el `:institutionId` de la ruta llegaba intacto hasta el `upsert` y el
 * `deleteMany`: un administrador de la institución A podía reescribir o borrar la matriz
 * de permisos de la institución B. Escalada de privilegios cross-tenant, no fuga de datos.
 *
 * Si alguno de estos casos vuelve a fallar, el endpoint acepta de nuevo el identificador
 * del cliente.
 */
describe('CapabilitiesController · aislamiento multi-tenant', () => {
  const INST_A = 'inst-aaa';
  const INST_B = 'inst-bbb';

  function build() {
    const service = {
      getCapabilityMatrix: jest.fn().mockResolvedValue({ matrix: {}, catalog: [], roles: [] }),
      updateCapabilityMatrix: jest.fn().mockResolvedValue(undefined),
      resetToDefaults: jest.fn().mockResolvedValue(undefined),
    };
    // El fallback de requireInstitutionId no debe llegar a usarse en estas pruebas:
    // todos los usuarios traen institutionId en el JWT.
    const prisma = { institutionUser: { findFirst: jest.fn().mockResolvedValue(null) } };
    return { controller: new CapabilitiesController(service as any, prisma as any), service, prisma };
  }

  const adminDe = (institutionId: string) => ({
    user: { id: 'u1', institutionId, isSuperAdmin: false, roles: ['ADMIN_INSTITUTIONAL'] },
  });
  const superAdmin = () => ({
    user: { id: 'sa', institutionId: null, isSuperAdmin: true, roles: ['SUPERADMIN'] },
  });

  describe('un admin de A apuntando a B siempre actúa sobre A', () => {
    it('GET matrix', async () => {
      const { controller, service } = build();
      await controller.getCapabilityMatrix(adminDe(INST_A), INST_B);
      expect(service.getCapabilityMatrix).toHaveBeenCalledWith(INST_A);
    });

    it('PUT matrix (escritura)', async () => {
      const { controller, service } = build();
      const updates = [{ role: 'ESTUDIANTE', capabilityKey: 'VER_TODO', isEnabled: true }];
      await controller.updateCapabilityMatrix(adminDe(INST_A), INST_B, { updates });
      expect(service.updateCapabilityMatrix).toHaveBeenCalledWith(INST_A, updates);
    });

    it('POST reset (destructiva: deleteMany sobre la matriz completa)', async () => {
      const { controller, service } = build();
      await controller.resetToDefaults(adminDe(INST_A), INST_B);
      expect(service.resetToDefaults).toHaveBeenCalledWith(INST_A);
      expect(service.resetToDefaults).not.toHaveBeenCalledWith(INST_B);
    });
  });

  describe('el SuperAdmin sí administra la institución que indique', () => {
    it('GET matrix', async () => {
      const { controller, service } = build();
      await controller.getCapabilityMatrix(superAdmin(), INST_B);
      expect(service.getCapabilityMatrix).toHaveBeenCalledWith(INST_B);
    });

    it('PUT matrix', async () => {
      const { controller, service } = build();
      await controller.updateCapabilityMatrix(superAdmin(), INST_B, { updates: [] });
      expect(service.updateCapabilityMatrix).toHaveBeenCalledWith(INST_B, []);
    });

    it('POST reset', async () => {
      const { controller, service } = build();
      await controller.resetToDefaults(superAdmin(), INST_B);
      expect(service.resetToDefaults).toHaveBeenCalledWith(INST_B);
    });
  });

  it('el caso normal (el admin envía su propia institución) no cambia', async () => {
    const { controller, service } = build();
    await controller.updateCapabilityMatrix(adminDe(INST_A), INST_A, { updates: [] });
    expect(service.updateCapabilityMatrix).toHaveBeenCalledWith(INST_A, []);
  });

  it('sin institución resoluble no se ejecuta ninguna escritura', async () => {
    const { controller, service } = build();
    const sinTenant = { user: { id: 'u9', institutionId: null, isSuperAdmin: false } };

    await expect(controller.resetToDefaults(sinTenant, INST_B)).rejects.toThrow();
    expect(service.resetToDefaults).not.toHaveBeenCalled();
  });
});
