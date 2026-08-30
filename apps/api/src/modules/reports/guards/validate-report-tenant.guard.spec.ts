import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ValidateReportTenantGuard } from './validate-report-tenant.guard';

describe('ValidateReportTenantGuard', () => {
  const makeContext = (request: any) => ({
    switchToHttp: () => ({ getRequest: () => request }),
  }) as any;

  function makeGuard() {
    const prisma = { institution: { findUnique: jest.fn() } };
    return { guard: new ValidateReportTenantGuard(prisma as any), prisma };
  }

  it('does not query Institution for a normal user', async () => {
    const { guard, prisma } = makeGuard();
    const request = { user: { isSuperAdmin: false }, query: { institutionId: 'tenant-b' } };

    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(prisma.institution.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a SuperAdmin without a destination before querying', async () => {
    const { guard, prisma } = makeGuard();
    const request = { user: { isSuperAdmin: true }, query: {} };

    await expect(guard.canActivate(makeContext(request))).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.institution.findUnique).not.toHaveBeenCalled();
  });

  it('rejects an unknown SuperAdmin destination', async () => {
    const { guard, prisma } = makeGuard();
    prisma.institution.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(makeContext({ user: { isSuperAdmin: true }, query: { institutionId: 'unknown' } })))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('stores a verified SuperAdmin destination', async () => {
    const { guard, prisma } = makeGuard();
    prisma.institution.findUnique.mockResolvedValue({ id: 'tenant-a' });
    const request = { user: { isSuperAdmin: true }, query: { institutionId: 'tenant-a' } };

    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(prisma.institution.findUnique).toHaveBeenCalledWith({
      where: { id: 'tenant-a' },
      select: { id: true },
    });
    expect(request.resolvedInstitutionId).toBe('tenant-a');
  });
});
