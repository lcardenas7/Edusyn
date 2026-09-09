import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApdService } from './apd.service';

describe('Inclusion profile lifecycle and isolation', () => {
  function setup(profile: any = null) {
    const prisma = {
      institution: { findUnique: jest.fn().mockResolvedValue({ enableDifferentialSupport: true }) },
      student: { findFirst: jest.fn().mockResolvedValue({ id: 'student-a' }) },
      educationalSupportProfile: {
        findUnique: jest.fn().mockResolvedValue(profile),
        create: jest.fn(({ data }) => Promise.resolve({ id: 'profile-a', ...data })),
        update: jest.fn(({ data }) => Promise.resolve({ ...profile, ...data })),
      },
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    return { service: new ApdService(prisma as any, audit as any, {} as any), prisma, audit };
  }
  it('creates an inactive profile without consent', async () => {
    const { service } = setup();
    const result = await service.createProfile({institutionId:'a', studentId:'student-a', supportCategory:'Synthetic'}, 'actor-a');
    expect(result.active).toBe(false);
  });
  it('rejects a student outside the institution before creating the profile', async () => {
    const { service, prisma } = setup();
    prisma.student.findFirst.mockResolvedValue(null as any);
    await expect(service.createProfile({institutionId:'a', studentId:'student-b', supportCategory:'Synthetic'}, 'actor-a')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.educationalSupportProfile.create).not.toHaveBeenCalled();
  });
  it('rejects updates to another institution without writing or auditing its data', async () => {
    const { service, prisma, audit } = setup({id:'profile-b',institutionId:'b'});
    await expect(service.updateProfile('profile-b','a',{pedagogicalNotes:'Synthetic'},'actor-a')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.educationalSupportProfile.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });
  it('cannot explicitly activate a profile without consent', async () => {
    const { service } = setup({id:'profile-a',institutionId:'a',active:false,parentConsentAccepted:false});
    await expect(service.updateProfile('profile-a','a',{active:true},'actor-a')).rejects.toBeInstanceOf(BadRequestException);
  });
  it('revoking consent also deactivates the existing profile', async () => {
    const { service } = setup({id:'profile-a',institutionId:'a',active:true,parentConsentAccepted:true});
    const result = await service.updateProfile('profile-a','a',{parentConsentAccepted:false},'actor-a');
    expect(result.active).toBe(false);
    expect(result.parentConsentAccepted).toBe(false);
  });
});
