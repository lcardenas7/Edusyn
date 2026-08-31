import { Reflector } from '@nestjs/core';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
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
