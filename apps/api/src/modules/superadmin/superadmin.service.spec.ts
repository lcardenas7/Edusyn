import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { SuperadminService } from './superadmin.service';

/**
 * Módulo 1 (Onboarding v2) — caracterización de las validaciones de creación de
 * institución. Congela el contrato de errores (403/409) ANTES de abrir la
 * transacción, para que los módulos siguientes no rompan este comportamiento.
 *
 * Nota de alcance: el camino feliz (crear institución + admin + rector) toca
 * >12 operaciones dentro de $transaction; se cubre con prueba de integración
 * contra BD, no aquí. El mock hace fallar la transacción a propósito para
 * garantizar que estos casos SIEMPRE se bloquean en validación, sin escribir.
 */
describe('SuperadminService.createInstitution — validaciones (Módulo 1)', () => {
  function makeService(opts: {
    isSuperAdmin?: boolean;
    slugTaken?: boolean;
    daneTaken?: boolean;
    takenEmails?: string[];
  } = {}) {
    const prisma: any = {
      user: {
        findUnique: jest.fn(({ where }: any) => {
          if (where?.id) return Promise.resolve({ isSuperAdmin: opts.isSuperAdmin ?? true });
          if (where?.email) {
            return Promise.resolve((opts.takenEmails ?? []).includes(where.email) ? { id: 'u' } : null);
          }
          return Promise.resolve(null);
        }),
      },
      institution: {
        findUnique: jest.fn(() => Promise.resolve(opts.slugTaken ? { id: 's' } : null)), // slug
        findFirst: jest.fn(() => Promise.resolve(opts.daneTaken ? { id: 'd' } : null)),  // daneCode
      },
      // Si la validación falla en dejar pasar algo, la transacción reventaría el test.
      $transaction: jest.fn(async () => {
        throw new Error('La transacción no debería alcanzarse: la validación debió bloquear.');
      }),
    };
    return new SuperadminService(prisma as any);
  }

  const baseDto = (over: any = {}): any => ({
    name: 'Colegio de Prueba',
    slug: 'colegio-prueba',
    modules: [],
    adminFirstName: 'Ana',
    adminLastName: 'Ruiz',
    adminEmail: 'admin@colegio.co',
    rectorSameAsAdmin: true,
    ...over,
  });

  it('rechaza a un usuario que NO es SuperAdmin (403)', async () => {
    const svc = makeService({ isSuperAdmin: false });
    await expect(svc.createInstitution('user-1', baseDto())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('exige decidir expresamente si rector y administrador son la misma persona (400)', async () => {
    const svc = makeService();
    await expect(
      svc.createInstitution('sa', baseDto({ rectorSameAsAdmin: undefined })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza slug duplicado (409)', async () => {
    const svc = makeService({ slugTaken: true });
    await expect(svc.createInstitution('sa', baseDto())).rejects.toBeInstanceOf(ConflictException);
  });

  it('rechaza email de administrador ya registrado (409)', async () => {
    const svc = makeService({ takenEmails: ['admin@colegio.co'] });
    await expect(svc.createInstitution('sa', baseDto())).rejects.toBeInstanceOf(ConflictException);
  });

  it('rechaza código DANE ya registrado (409) — guard nuevo del Módulo 1', async () => {
    const svc = makeService({ daneTaken: true });
    await expect(
      svc.createInstitution('sa', baseDto({ daneCode: '108001000123' })),
    ).rejects.toThrow(/DANE/i);
  });

  it('rechaza rector separado con datos incompletos (409)', async () => {
    const svc = makeService();
    await expect(
      svc.createInstitution('sa', baseDto({ rectorSameAsAdmin: false, rectorFirstName: 'Luis' })),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rechaza rector con el mismo email que el administrador (409)', async () => {
    const svc = makeService();
    await expect(
      svc.createInstitution('sa', baseDto({
        rectorSameAsAdmin: false,
        rectorFirstName: 'Luis',
        rectorLastName: 'Pérez',
        rectorEmail: 'admin@colegio.co', // igual al admin
      })),
    ).rejects.toThrow(/no puede ser igual/i);
  });

  it('no toca la BD (no abre transacción) cuando la validación falla', async () => {
    const svc = makeService({ slugTaken: true });
    await expect(svc.createInstitution('sa', baseDto())).rejects.toBeInstanceOf(ConflictException);
    // $transaction nunca debió llamarse (se garantiza porque lanzaría otro error).
  });
});
