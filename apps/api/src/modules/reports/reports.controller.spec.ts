import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException, NotFoundException, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { ReportsController } from './reports.controller';
import { REQUIRE_TENANT_CONTEXT_KEY } from '../auth/decorators/require-tenant-context.decorator';

describe('ReportsController tenant resolution', () => {
  function makeController() {
    const reportsService = {
      getSubjectAverages: jest.fn().mockResolvedValue({ ok: true }),
      assertReportCardScope: jest.fn().mockResolvedValue(undefined),
      getReportCardData: jest.fn().mockResolvedValue({ ok: true }),
      assertTermScope: jest.fn().mockResolvedValue(undefined),
      closeTerm: jest.fn().mockResolvedValue({ ok: true }),
      assertCompletenessScope: jest.fn().mockResolvedValue(undefined),
      getCompletenessStatus: jest.fn().mockResolvedValue({ ok: true }),
    };
    const capabilitiesService = {
      getUserCapabilities: jest.fn().mockResolvedValue({ effectiveRoles: ['SUPERADMIN'] }),
    };
    return {
      reportsService,
      controller: new ReportsController(reportsService as any, {} as any, {} as any, capabilitiesService as any, {} as any),
    };
  }

  it('requires tenant context for the entire Reports controller', () => {
    const reflector = new Reflector();
    expect(reflector.get<boolean>(REQUIRE_TENANT_CONTEXT_KEY, ReportsController)).toBe(true);
  });

  it('passes only the guard-validated SuperAdmin destination to report services', async () => {
    const { controller, reportsService } = makeController();
    const request = {
      user: { isSuperAdmin: true },
      query: { institutionId: 'untrusted-value' },
      resolvedInstitutionId: 'tenant-a',
    };

    await controller.getSubjectAverages(request, 'year-1');

    expect(reportsService.getSubjectAverages).toHaveBeenCalledWith(
      'tenant-a', 'year-1', undefined, undefined, undefined, undefined,
    );
  });

  it('uses the session tenant for a normal user despite a query parameter', async () => {
    const { controller, reportsService } = makeController();
    const request = {
      user: { isSuperAdmin: false, institutionId: 'tenant-a' },
      query: { institutionId: 'tenant-b' },
    };

    await controller.getSubjectAverages(request, 'year-1');

    expect(reportsService.getSubjectAverages).toHaveBeenCalledWith(
      'tenant-a', 'year-1', undefined, undefined, undefined, undefined,
    );
  });

  it('does not call report services without an effective tenant', async () => {
    const { controller, reportsService } = makeController();
    const request = { user: { isSuperAdmin: true }, query: {} };

    await expect(controller.getSubjectAverages(request, 'year-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(reportsService.getSubjectAverages).not.toHaveBeenCalled();
  });

  it('rejects a report-card resource outside the effective institution before reading it', async () => {
    const { controller, reportsService } = makeController();
    const request = { user: { isSuperAdmin: false, institutionId: 'tenant-a' } };
    reportsService.assertReportCardScope.mockRejectedValueOnce(
      new NotFoundException('Matrícula no encontrada.'),
    );

    await expect(controller.getReportCardData(request, 'enrollment-b', 'term-a'))
      .rejects.toBeInstanceOf(NotFoundException);

    expect(reportsService.assertReportCardScope).toHaveBeenCalledWith(
      'tenant-a', 'enrollment-b', 'term-a',
    );
    expect(reportsService.getReportCardData).not.toHaveBeenCalled();
  });

  it('uses the guard-validated SuperAdmin destination for an in-scope report card', async () => {
    const { controller, reportsService } = makeController();
    const request = {
      user: { isSuperAdmin: true, sub: 'superadmin-1' },
      resolvedInstitutionId: 'tenant-a',
    };

    await controller.getReportCardData(request, 'enrollment-a', 'term-a');

    expect(reportsService.assertReportCardScope).toHaveBeenCalledWith(
      'tenant-a', 'enrollment-a', 'term-a',
    );
    expect(reportsService.getReportCardData).toHaveBeenCalledWith('enrollment-a', 'term-a');
  });

  it('rejects a cross-tenant term before a lifecycle action', async () => {
    const { controller, reportsService } = makeController();
    const request = { user: { isSuperAdmin: false, institutionId: 'tenant-a' } };
    reportsService.assertTermScope.mockRejectedValueOnce(
      new NotFoundException('Período académico no encontrado.'),
    );

    await expect(controller.closeTerm(request, 'term-b')).rejects.toBeInstanceOf(NotFoundException);

    expect(reportsService.assertTermScope).toHaveBeenCalledWith('tenant-a', 'term-b');
    expect(reportsService.closeTerm).not.toHaveBeenCalled();
  });

  it('rejects completeness inputs outside the effective institution before reading them', async () => {
    const { controller, reportsService } = makeController();
    const request = { user: { isSuperAdmin: false, institutionId: 'tenant-a' } };
    reportsService.assertCompletenessScope.mockRejectedValueOnce(
      new NotFoundException('Año académico no encontrado.'),
    );

    await expect(controller.getCompletenessStatus(request, 'year-b', 'term-b'))
      .rejects.toBeInstanceOf(NotFoundException);

    expect(reportsService.assertCompletenessScope).toHaveBeenCalledWith('tenant-a', 'year-b', 'term-b');
    expect(reportsService.getCompletenessStatus).not.toHaveBeenCalled();
  });
});

/**
 * Contrato de acceso del rector en Reportes.
 *
 * El rector es la maxima autoridad de SU institucion: consulta todo lo que
 * Reportes expone y gobierna la configuracion de sus boletines, pero no ejecuta
 * generacion masiva ni operaciones sobre el ciclo del periodo. Estas pruebas
 * leen la metadata real de los decoradores y ejercitan el guard autentico.
 *
 * El aislamiento por institucion NO se prueba aqui: no depende de los roles
 * sino del contexto de tenant y de getEffectiveInstitutionId, que este cambio
 * no toca. Su evidencia funcional son las matrices A/B ya ejecutadas.
 */
describe('Reportes · contrato de acceso del rector', () => {
  const LECTURA = 'GET';
  const ESCRITURA = 'escritura';

  interface Ruta { metodo: string; verbo: string; roles: string[] }

  const inventario = (): Ruta[] => {
    const proto = ReportsController.prototype as unknown as Record<string, unknown>;
    return Object.getOwnPropertyNames(proto)
      .filter((n) => n !== 'constructor' && typeof proto[n] === 'function')
      .map((metodo) => {
        const handler = proto[metodo] as (...a: unknown[]) => unknown;
        const verbo = Reflect.getMetadata(METHOD_METADATA, handler);
        if (verbo === undefined) return null;
        return {
          metodo,
          verbo: verbo === RequestMethod.GET ? LECTURA : ESCRITURA,
          roles: (Reflect.getMetadata(ROLES_KEY, handler) as string[]) ?? [],
        };
      })
      .filter((r): r is Ruta => r !== null);
  };

  /** Ejercita el guard real con la sesion indicada sobre un metodo del controlador. */
  const evaluarGuard = (metodo: string, roles: string[]): boolean => {
    const guard = new RolesGuard(new Reflector());
    const handler = (ReportsController.prototype as unknown as Record<string, unknown>)[metodo];
    const context = {
      getHandler: () => handler,
      getClass: () => ReportsController,
      switchToHttp: () => ({ getRequest: () => ({ user: { roles, isSuperAdmin: false } }) }),
    } as unknown as ExecutionContext;
    return guard.canActivate(context);
  };

  const ESCRITURAS_ADMIN_INSTITUCIONAL = [
    'upsertTemplateSelection',
    'deleteTemplateSelection',
    'updateReportCardConfig',
  ];

  const ESCRITURAS_OPERATIVAS = [
    'generateBulkReportCards',
    'closeTerm',
    'finalizeTerm',
    'reopenFinalizedTerm',
    'reSnapshotTerm',
  ];

  const rutas = inventario();
  const lecturas = rutas.filter((r) => r.verbo === LECTURA);
  const escrituras = rutas.filter((r) => r.verbo === ESCRITURA);

  it('el inventario coincide con el contrato acordado: 40 lecturas y 8 escrituras', () => {
    expect(lecturas).toHaveLength(40);
    expect(escrituras).toHaveLength(8);
  });

  it('las 40 rutas de lectura incluyen RECTOR', () => {
    expect(lecturas.filter((r) => !r.roles.includes('RECTOR')).map((r) => r.metodo)).toEqual([]);
  });

  it.each([
    ['agregado institucional', 'getSubjectAverages'],
    ['ranking', 'getInstitutionalRanking'],
    ['boletin individual', 'getReportCardData'],
    ['indice de grupo', 'getGroupReportCardList'],
    ['resolucion de plantilla', 'resolveTemplate'],
    ['exportacion', 'exportConsolidated'],
    ['validacion de periodo, solo lectura', 'validateTermGrades'],
  ])('el guard admite al rector en %s', (_familia, metodo) => {
    expect(evaluarGuard(metodo as string, ['RECTOR'])).toBe(true);
  });

  it('el inventario de escrituras es exactamente el acordado', () => {
    expect(escrituras.map((r) => r.metodo).sort())
      .toEqual([...ESCRITURAS_ADMIN_INSTITUCIONAL, ...ESCRITURAS_OPERATIVAS].sort());
  });

  it.each([...ESCRITURAS_ADMIN_INSTITUCIONAL, ...ESCRITURAS_OPERATIVAS])(
    'el guard admite al rector como autoridad institucional en %s',
    (metodo) => {
    expect(evaluarGuard(metodo, ['RECTOR'])).toBe(true);
    },
  );

  it('toda ruta conserva SUPERADMIN y ADMIN_INSTITUTIONAL', () => {
    expect(rutas
      .filter((r) => !r.roles.includes('SUPERADMIN') || !r.roles.includes('ADMIN_INSTITUTIONAL'))
      .map((r) => r.metodo)).toEqual([]);
  });

  it.each([
    ['docente', 'DOCENTE', 'getReportCardData'],
    // El coordinador NO cierra periodos: eso es de ADMIN_INSTITUTIONAL y
    // SUPERADMIN. Se comprueba sobre una lectura que si tenia antes.
    ['coordinador', 'COORDINADOR', 'getSubjectAverages'],
    ['estudiante', 'ESTUDIANTE', 'getReportCardData'],
  ])('el %s conserva su acceso donde ya lo tenia', (_quien, rol, metodo) => {
    expect(evaluarGuard(metodo, [rol])).toBe(true);
  });

  it('un rol ajeno al contrato sigue rechazado en lectura', () => {
    expect(() => evaluarGuard('getSubjectAverages', ['ACUDIENTE'])).toThrow(ForbiddenException);
  });
});
