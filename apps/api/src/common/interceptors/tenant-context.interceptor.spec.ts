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

  function makeInterceptor() {
    const tx = { $queryRawUnsafe: jest.fn().mockResolvedValue(undefined) };
    const raw = {
      $transaction: jest.fn(async (callback: (transaction: typeof tx) => Promise<void>) => callback(tx)),
    };
    const prisma = { $raw: raw };
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    return { interceptor: new TenantContextInterceptor(prisma as any, reflector as any), raw, tx };
  }

  it('ignores a normal user query destination and uses the session tenant', async () => {
    const { interceptor, tx } = makeInterceptor();
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
    expect(tx.$queryRawUnsafe).toHaveBeenCalledTimes(1);
  });

  it('runs deferred actions only after the database commit', async () => {
    const { interceptor, raw, tx } = makeInterceptor();
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
    const { interceptor } = makeInterceptor();
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
