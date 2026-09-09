import { NotFoundException } from '@nestjs/common';
import { PedagogicalSupportController } from './pedagogical-support.controller';
import { PedagogicalSupportService } from './pedagogical-support.service';

describe('Pedagogical support tenant boundary', () => {
  const request = { user: { id: 'teacher-a', institutionId: 'tenant-a' } };

  it('does not let an unvalidated body replace the authenticated institution', async () => {
    const service = { createSupportPlan: jest.fn().mockResolvedValue({}) };
    const controller = new PedagogicalSupportController(service as any, {} as any);
    await controller.create(request, {
      institutionId: 'tenant-b', studentEnrollmentId: 'enrollment-b',
      academicTermId: 'term-b', supportStrategy: 'Synthetic strategy',
    } as any);
    expect(service.createSupportPlan.mock.calls[0][0].institutionId).toBe('tenant-a');
  });

  it('supplies the authenticated tenant for student history', async () => {
    const service = { getByStudent: jest.fn().mockResolvedValue([]) };
    const controller = new PedagogicalSupportController(service as any, {} as any);
    await (controller.getByStudent as any)(request, 'enrollment-b', 'term-b');
    expect(service.getByStudent).toHaveBeenCalledWith('enrollment-b', 'tenant-a', 'term-b');
  });

  it('supplies the authenticated tenant for plan details', async () => {
    const service = { getById: jest.fn().mockResolvedValue({}) };
    const controller = new PedagogicalSupportController(service as any, {} as any);
    await (controller.getById as any)(request, 'plan-b');
    expect(service.getById).toHaveBeenCalledWith('plan-b', 'tenant-a');
  });

  it('does not return a plan from another institution', async () => {
    const otherPlan = { id: 'plan-b', institutionId: 'tenant-b' };
    const prisma = { pedagogicalSupportPlan: {
      findUnique: jest.fn().mockResolvedValue(otherPlan),
      findFirst: jest.fn(({ where }) => Promise.resolve(where.institutionId === 'tenant-b' ? otherPlan : null)),
    } };
    const service = new PedagogicalSupportService(prisma as any);
    await expect((service.getById as any)('plan-b', 'tenant-a')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('scopes history at the data query', async () => {
    const prisma = { pedagogicalSupportPlan: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new PedagogicalSupportService(prisma as any);
    await (service.getByStudent as any)('enrollment-a', 'tenant-a', 'term-a');
    expect(prisma.pedagogicalSupportPlan.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { studentEnrollmentId: 'enrollment-a', institutionId: 'tenant-a', academicTermId: 'term-a' },
    }));
  });
});
