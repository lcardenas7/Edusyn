import { NotFoundException } from '@nestjs/common';
import { ReportsService } from './reports.service';

describe('ReportsService resource scope assertions', () => {
  function makeService() {
    const prisma = {
      studentEnrollment: { findFirst: jest.fn() },
      academicTerm: { findFirst: jest.fn() },
      academicYear: { findFirst: jest.fn() },
    };
    return {
      prisma,
      service: new ReportsService(prisma as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any),
    };
  }

  it('does not inspect a term when the enrollment is outside the institution', async () => {
    const { prisma, service } = makeService();
    prisma.studentEnrollment.findFirst.mockResolvedValue(null);

    await expect(service.assertReportCardScope('tenant-a', 'enrollment-b', 'term-a'))
      .rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.studentEnrollment.findFirst).toHaveBeenCalledWith({
      where: { id: 'enrollment-b', institutionId: 'tenant-a' },
      select: { id: true, academicYearId: true },
    });
    expect(prisma.academicTerm.findFirst).not.toHaveBeenCalled();
  });

  it('rejects a term from a different academic year', async () => {
    const { prisma, service } = makeService();
    prisma.studentEnrollment.findFirst.mockResolvedValue({ id: 'enrollment-a', academicYearId: 'year-a' });
    prisma.academicTerm.findFirst.mockResolvedValue({ id: 'term-b', academicYearId: 'year-b' });

    await expect(service.assertReportCardScope('tenant-a', 'enrollment-a', 'term-b'))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('requires the optional completeness term to belong to the supplied year and institution', async () => {
    const { prisma, service } = makeService();
    prisma.academicYear.findFirst.mockResolvedValue({ id: 'year-a' });
    prisma.academicTerm.findFirst.mockResolvedValue(null);

    await expect(service.assertCompletenessScope('tenant-a', 'year-a', 'term-b'))
      .rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.academicTerm.findFirst).toHaveBeenCalledWith({
      where: { id: 'term-b', academicYearId: 'year-a', academicYear: { institutionId: 'tenant-a' } },
      select: { id: true },
    });
  });
});
