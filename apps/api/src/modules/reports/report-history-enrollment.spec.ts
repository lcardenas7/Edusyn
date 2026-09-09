import { ReportsService } from './reports.service';

describe('Historical report enrollment universe', () => {
  function setup() {
    const prisma = { studentEnrollment: { findMany: jest.fn().mockResolvedValue([]) } };
    const years = { getTermById: jest.fn().mockResolvedValue({ id: 'term-2026' }) };
    const service = new ReportsService(prisma as any, {} as any, {} as any, {} as any, years as any, {} as any, {} as any, {} as any);
    return { service, prisma };
  }
  it('limits reused groups to the year of the requested term and includes year-end statuses', async () => {
    const { service, prisma } = setup();
    await expect(service.buildGroupReportCards('group','term-2026')).rejects.toThrow();
    expect(prisma.studentEnrollment.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{
      groupId:'group',academicYear:{terms:{some:{id:'term-2026'}}},
      OR:[{status:{in:['ACTIVE','PROMOTED','REPEATED','GRADUATED']}}],
    }}));
  });
  it('also includes a specifically requested withdrawn or transferred enrollment', async () => {
    const { service, prisma } = setup();
    await expect(service.buildGroupReportCards('group','term-2026','withdrawn-enrollment')).rejects.toThrow();
    expect(prisma.studentEnrollment.findMany.mock.calls[0][0].where.OR).toContainEqual({id:'withdrawn-enrollment'});
  });
});
