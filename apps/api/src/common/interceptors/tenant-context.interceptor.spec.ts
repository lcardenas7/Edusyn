import { ForbiddenException } from '@nestjs/common';
import { defer, lastValueFrom, of, throwError } from 'rxjs';
import { TenantContextInterceptor } from './tenant-context.interceptor';
import { tenantContext } from '../../prisma/tenant-context';

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
      user: { id: 'superadmin-1', isSuperAdmin: true },
      query: { institutionId: 'untrusted-value' },
      resolvedInstitutionId: 'tenant-a',
    };

    await expect(lastValueFrom(interceptor.intercept(makeContext(request), { handle: () => of({ ok: true }) }))).resolves.toEqual({ ok: true });
    expect(raw.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith(
      "SELECT set_config('app.current_institution', $1, true)",
      'tenant-a',
    );
    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith(
      "SELECT set_config('app.current_user', $1, true)",
      'superadmin-1',
    );
  });

  it('ignores a normal user query destination and uses the session tenant', async () => {
    const { interceptor, tx } = makeInterceptor(true);
    const request = {
      user: { id: 'user-a1', isSuperAdmin: false, institutionId: 'tenant-a' },
      query: { institutionId: 'tenant-b' },
      resolvedInstitutionId: 'tenant-b',
    };

    await lastValueFrom(interceptor.intercept(makeContext(request), { handle: () => of({ ok: true }) }));
    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith(
      "SELECT set_config('app.current_institution', $1, true)",
      'tenant-a',
    );
    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith(
      "SELECT set_config('app.current_user', $1, true)",
      'user-a1',
    );
  });

  it('does not invent a user context when the authenticated principal has no id', async () => {
    const { interceptor, tx } = makeInterceptor(false);
    const request = { user: { isSuperAdmin: false, institutionId: 'tenant-a' } };

    await lastValueFrom(interceptor.intercept(makeContext(request), { handle: () => of({ ok: true }) }));

    expect(tx.$queryRawUnsafe).toHaveBeenCalledTimes(1);
    expect(tx.$queryRawUnsafe).not.toHaveBeenCalledWith(
      "SELECT set_config('app.current_user', $1, true)",
      expect.anything(),
    );
  });

  it('runs deferred actions only after the database commit', async () => {
    const { interceptor, raw, tx } = makeInterceptor(false);
    const events: string[] = [];
    raw.$transaction.mockImplementation(async (callback: (transaction: typeof tx) => Promise<void>) => {
      await callback(tx);
      events.push('commit');
    });
    const request = { user: { id: 'user-a1', institutionId: 'tenant-a' } };
    const response = await lastValueFrom(interceptor.intercept(makeContext(request), {
      handle: () => defer(() => {
        tenantContext.getStore()?.afterCommit?.push(() => events.push('notice'));
        return of({ ok: true });
      }),
    }));
    expect(response).toEqual({ ok: true });
    expect(events).toEqual(['commit', 'notice']);
  });

  it('discards deferred actions when the request rolls back', async () => {
    const { interceptor } = makeInterceptor(false);
    const notice = jest.fn();
    const request = { user: { id: 'user-a1', institutionId: 'tenant-a' } };
    await expect(lastValueFrom(interceptor.intercept(makeContext(request), {
      handle: () => defer(() => {
        tenantContext.getStore()?.afterCommit?.push(notice);
        return throwError(() => new Error('rollback'));
      }),
    }))).rejects.toThrow('rollback');
    expect(notice).not.toHaveBeenCalled();
  });
});
