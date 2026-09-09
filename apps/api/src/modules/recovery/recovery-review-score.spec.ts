import { PeriodRecoveryService } from './period-recovery.service';

describe('Recovery review result consistency', () => {
  it('persists the original score after rejection and does not change the official grade', async () => {
    const prisma = {
      periodRecovery: {
        findUnique: jest.fn().mockResolvedValue({id:'recovery',institutionId:'institution',academicTermId:'term',status:'REVIEW_PENDING',originalScore:2,finalScore:3}),
        update: jest.fn().mockImplementation(async ({data}) => data),
      },
      academicTerm: {findUnique:jest.fn().mockResolvedValue({academicYearId:'year'})},
    };
    const writer = {fijarValor:jest.fn()};
    const service = new PeriodRecoveryService(prisma as any,{getOrCreateDefaultConfig:jest.fn().mockResolvedValue({minPassingScore:3})} as any,{} as any,writer as any);
    const result = await service.reviewResult('recovery',{approved:false,reviewedById:'coordinator'},'institution');
    expect(result).toMatchObject({status:'NOT_APPROVED',finalScore:2});
    expect(writer.fijarValor).not.toHaveBeenCalled();
  });
});
