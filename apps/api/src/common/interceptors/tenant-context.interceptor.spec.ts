import { ForbiddenException } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { TenantContextInterceptor } from './tenant-context.interceptor';

describe('TenantContextInterceptor', () => {
  const handler = () => undefined;
  const controller = class ReportsController {};

  function makeContext(request: any) {
    return {
      getHandler: () => handler,
      getClass: () => controller,
      switchToHttp: () => ({ getRequest: () => request }),
    } as any;
  }

  function makeInterceptor(requireTenantContext: boolean) {
    const tx = { $queryRawUnsafe: jest.fn().mockResolvedValue(undefined) };
    const raw = {
      $transaction: jest.fn(async (callback: (transaction: typeof tx) => Promise<void>) => callback(tx)),
    };
    const prisma = { $raw: raw };
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(requireTenantContext),
    };
    return { interceptor: new TenantContextInterceptor(prisma as any, reflector as any), raw, tx };
  }

  it('rejects SuperAdmin report requests without an explicit institutionId', () => {
    const { interceptor, raw } = makeInterceptor(true);
    const request = { user: { isSuperAdmin: true }, query: {} };

    expect(() => interceptor.intercept(makeContext(request), { handle: () => of({ ok: true }) })).toThrow(ForbiddenException);
    expect(raw.$transaction).not.toHaveBeenCalled();
  });

  it('sets the guard-validated SuperAdmin tenant inside the transaction', async () => {
    const { interceptor, raw, tx } = makeInterceptor(true);
    const request = {
      user: { isSuperAdmin: true },
      query: { institutionId: 'untrusted-value' },
      resolvedInstitutionId: 'tenant-a',
    };

    await expect(lastValueFrom(interceptor.intercept(makeContext(request), { handle: () => of({ ok: true }) }))).resolves.toEqual({ ok: true });
    expect(raw.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith(
      "SELECT set_config('app.current_institution', $1, true)",
      'tenant-a',
    );
  });

  it('ignores a normal user query destination and uses the session tenant', async () => {
    const { interceptor, tx } = makeInterceptor(true);
    const request = {
      user: { isSuperAdmin: false, institutionId: 'tenant-a' },
      query: { institutionId: 'tenant-b' },
      resolvedInstitutionId: 'tenant-b',
    };

    await lastValueFrom(interceptor.intercept(makeContext(request), { handle: () => of({ ok: true }) }));
    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith(
      "SELECT set_config('app.current_institution', $1, true)",
      'tenant-a',
    );
  });
});
