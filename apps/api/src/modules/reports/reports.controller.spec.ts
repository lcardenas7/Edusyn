import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { REQUIRE_TENANT_CONTEXT_KEY } from '../auth/decorators/require-tenant-context.decorator';

describe('ReportsController tenant resolution', () => {
  function makeController() {
    const reportsService = { getSubjectAverages: jest.fn().mockResolvedValue({ ok: true }) };
    return {
      reportsService,
      controller: new ReportsController(reportsService as any, {} as any, {} as any, {} as any, {} as any),
    };
  }

  it('requires tenant context for the entire Reports controller', () => {
    const reflector = new Reflector();
    expect(reflector.get<boolean>(REQUIRE_TENANT_CONTEXT_KEY, ReportsController)).toBe(true);
  });

  it('passes the explicit SuperAdmin destination to report services', async () => {
    const { controller, reportsService } = makeController();
    const request = { user: { isSuperAdmin: true }, query: { institutionId: 'tenant-a' } };

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
});
