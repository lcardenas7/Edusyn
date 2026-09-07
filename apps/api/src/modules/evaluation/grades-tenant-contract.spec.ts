import { ExecutionContext, ForbiddenException, NotFoundException, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, GUARDS_METADATA } from '@nestjs/common/constants';

import { ValidateTenantContextGuard } from '../../common/guards/validate-tenant-context.guard';
import { REQUIRE_TENANT_CONTEXT_KEY } from '../auth/decorators/require-tenant-context.decorator';
import { PartialGradesController } from './partial-grades.controller';
import { PeriodFinalGradesController } from './period-final-grades.controller';
import { StudentGradesController } from './student-grades.controller';
import { FinalComponentGradesController } from './final-component-grades.controller';

/**
 * B-4 · Ninguna escritura académica ocurre sin institución efectiva.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El preflight de staging encontró un camino real: un SuperAdmin sin
 * institución asociada podía escribir notas. El interceptor de tenant no abre
 * transacción cuando no hay institución, así que la sesión quedaba SIN
 * `app.current_institution`. Con FORCE sobre la auditoría, su INSERT habría
 * violado el WITH CHECK, y como auditar nunca puede tumbar el guardado, el
 * error se habría absorbido: **la nota se guardaba y su rastro desaparecía sin
 * avisar**. Pérdida silenciosa, que es justo lo que este programa persigue.
 *
 * La corrección reutiliza el contrato B-4 que ya existía —guard + decorador—,
 * sin inventar un segundo mecanismo de tenant ni un bypass.
 *
 * Estas pruebas fijan las dos mitades: que el contrato está declarado donde
 * corresponde, y que el rechazo ocurre ANTES de tocar una nota.
 */
describe('B-4 · contrato de tenant en las escrituras académicas', () => {
  const CONTROLADORES = [
    ['notas parciales', PartialGradesController],
    ['notas finales de período', PeriodFinalGradesController],
    ['notas de estudiante', StudentGradesController],
    ['notas por componente final', FinalComponentGradesController],
  ] as const;

  interface Ruta { controlador: string; metodo: string; escribe: boolean; exigeContexto: boolean; tieneGuard: boolean }

  const inventario = (): Ruta[] => {
    const out: Ruta[] = [];
    for (const [nombre, ctrl] of CONTROLADORES) {
      const proto = ctrl.prototype as unknown as Record<string, unknown>;
      for (const metodo of Object.getOwnPropertyNames(proto)) {
        if (metodo === 'constructor' || typeof proto[metodo] !== 'function') continue;
        const handler = proto[metodo] as (...a: unknown[]) => unknown;
        const verbo = Reflect.getMetadata(METHOD_METADATA, handler);
        if (verbo === undefined) continue;
        const guards = (Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[]) ?? [];
        out.push({
          controlador: nombre,
          metodo,
          escribe: verbo !== RequestMethod.GET,
          exigeContexto: Reflect.getMetadata(REQUIRE_TENANT_CONTEXT_KEY, handler) === true,
          tieneGuard: guards.includes(ValidateTenantContextGuard as unknown),
        });
      }
    }
    return out;
  };

  const rutas = inventario();
  const escrituras = rutas.filter((r) => r.escribe);
  const lecturas = rutas.filter((r) => !r.escribe);

  // ═══════════════════════════════════════════════════════════════════════
  // 1. El contrato está declarado exactamente donde toca
  // ═══════════════════════════════════════════════════════════════════════

  it('el inventario son los cuatro controladores con trece escrituras', () => {
    expect(new Set(escrituras.map((r) => r.controlador)).size).toBe(4);
    expect(escrituras).toHaveLength(13);
  });

  it('TODA escritura académica exige institución efectiva', () => {
    expect(escrituras.filter((r) => !r.exigeContexto).map((r) => r.controlador + '.' + r.metodo)).toEqual([]);
  });

  it('TODA escritura académica pasa por el guard que resuelve el destino', () => {
    expect(escrituras.filter((r) => !r.tieneGuard).map((r) => r.controlador + '.' + r.metodo)).toEqual([]);
  });

  it('ninguna lectura cambia de comportamiento: el alcance se limitó a las escrituras', () => {
    expect(lecturas.filter((r) => r.exigeContexto || r.tieneGuard).map((r) => r.controlador + '.' + r.metodo))
      .toEqual([]);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 2. El guard real, con las tres situaciones del contrato
  // ═══════════════════════════════════════════════════════════════════════

  describe('el guard vigente decide antes de que corra el manejador', () => {
    const contexto = (request: Record<string, unknown>) => ({
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

    const guardCon = (institucionesExistentes: string[]) =>
      new ValidateTenantContextGuard({
        institution: {
          findUnique: jest.fn(({ where }: any) =>
            Promise.resolve(institucionesExistentes.includes(where.id) ? { id: where.id } : null),
          ),
        },
      } as any);

    it('un usuario institucional pasa sin tocar nada: su sesión sigue siendo la única fuente', async () => {
      const prisma = { institution: { findUnique: jest.fn() } };
      const guard = new ValidateTenantContextGuard(prisma as any);
      const req: any = { user: { isSuperAdmin: false, institutionId: 'inst-A' }, query: {} };

      await expect(guard.canActivate(contexto(req))).resolves.toBe(true);
      expect(prisma.institution.findUnique).not.toHaveBeenCalled();
      expect(req.resolvedInstitutionId).toBeUndefined();
    });

    it('un docente no tiene que volver a elegir su institución', async () => {
      const guard = guardCon(['inst-A']);
      const req: any = { user: { isSuperAdmin: false, institutionId: 'inst-A', roles: ['DOCENTE'] }, query: {} };
      await expect(guard.canActivate(contexto(req))).resolves.toBe(true);
    });

    it('SuperAdmin SIN institución explícita es rechazado', async () => {
      const guard = guardCon(['inst-A']);
      const req: any = { user: { isSuperAdmin: true }, query: {} };
      await expect(guard.canActivate(contexto(req))).rejects.toBeInstanceOf(ForbiddenException);
    });

    it.each([[''], ['   '], [undefined], [null], [42], [{}]])(
      'SuperAdmin con institución inservible (%p) es rechazado, no se inventa contexto',
      async (valor) => {
        const guard = guardCon(['inst-A']);
        const req: any = { user: { isSuperAdmin: true }, query: { institutionId: valor } };
        await expect(guard.canActivate(contexto(req))).rejects.toBeInstanceOf(ForbiddenException);
        expect(req.resolvedInstitutionId).toBeUndefined();
      },
    );

    it('SuperAdmin con una institución inexistente no cae en la primera disponible', async () => {
      const guard = guardCon(['inst-A', 'inst-B']);
      const req: any = { user: { isSuperAdmin: true }, query: { institutionId: 'inst-Z' } };
      await expect(guard.canActivate(contexto(req))).rejects.toBeInstanceOf(NotFoundException);
      expect(req.resolvedInstitutionId).toBeUndefined();
    });

    it('SuperAdmin con institución A resuelve A, y con B resuelve B', async () => {
      const guard = guardCon(['inst-A', 'inst-B']);

      const reqA: any = { user: { isSuperAdmin: true }, query: { institutionId: 'inst-A' } };
      await expect(guard.canActivate(contexto(reqA))).resolves.toBe(true);
      expect(reqA.resolvedInstitutionId).toBe('inst-A');

      const reqB: any = { user: { isSuperAdmin: true }, query: { institutionId: 'inst-B' } };
      await expect(guard.canActivate(contexto(reqB))).resolves.toBe(true);
      expect(reqB.resolvedInstitutionId).toBe('inst-B');

      // A jamás queda apuntando a B.
      expect(reqA.resolvedInstitutionId).not.toBe(reqB.resolvedInstitutionId);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 3. El rechazo ocurre ANTES de la mutación académica
  // ═══════════════════════════════════════════════════════════════════════

  describe('sin institución efectiva no se llega a tocar la nota', () => {
    it('el guard corta antes del manejador: el servicio nunca se invoca', async () => {
      const guard = new ValidateTenantContextGuard({ institution: { findUnique: jest.fn() } } as any);
      const servicio = { upsert: jest.fn() };
      const req: any = { user: { isSuperAdmin: true }, query: {} };
      const ctx = { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;

      let permitido = false;
      try { permitido = await guard.canActivate(ctx); } catch { /* rechazo esperado */ }

      // El manejador solo correría si el guard hubiese autorizado.
      if (permitido) await servicio.upsert();
      expect(servicio.upsert).not.toHaveBeenCalled();
    });

    it('la institución efectiva de un SuperAdmin es la que eligió, no una heredada', async () => {
      const guard = new ValidateTenantContextGuard({
        institution: { findUnique: jest.fn().mockResolvedValue({ id: 'inst-B' }) },
      } as any);
      const req: any = {
        user: { isSuperAdmin: true, institutionId: 'inst-A' },
        query: { institutionId: 'inst-B' },
      };
      await guard.canActivate({ switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext);

      // El interceptor prefiere el destino resuelto sobre cualquier institución
      // que arrastre la sesión: la nota y su auditoría caen en el mismo tenant.
      const institucionEfectiva = req.user.isSuperAdmin === true
        ? req.resolvedInstitutionId || req.user.institutionId
        : req.user.institutionId;
      expect(institucionEfectiva).toBe('inst-B');
    });
  });
});
