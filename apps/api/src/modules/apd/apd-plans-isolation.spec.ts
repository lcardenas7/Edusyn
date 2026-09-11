import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ApdService } from './apd.service';

// Applies real equality and relation predicates; removing scope makes foreign
// records visible. Every mutation records its invocation, including rejected ones.
function matches(row: any, where: any = {}): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (value === undefined) return true;
    if (key === 'institutionId_studentId') return matches(row, value);
    return value && typeof value === 'object' ? row[key] && matches(row[key], value) : row[key] === value;
  });
}

describe('APD profiles and plans: scoped records and consistent enrollment flow', () => {
  let rows: Record<string, any[]>;
  let prisma: any;
  let audit: any;
  let service: ApdService;
  beforeEach(() => {
    rows = Object.fromEntries(['institution', 'student', 'studentEnrollment', 'academicTerm', 'achievement', 'supportCategory', 'educationalSupportProfile', 'pedagogicalSupportPlan'].map(m => [m, []]));
    for (const x of ['A', 'B']) {
      const institutionId = 'school-' + x;
      rows.institution.push({ id: institutionId, enableDifferentialSupport: true });
      rows.student.push({ id: 'student-' + x, institutionId, isActive: true });
      rows.studentEnrollment.push({ id: 'enrollment-' + x, institutionId, studentId: 'student-' + x, academicYearId: 'year-' + x, status: 'ACTIVE' });
      rows.academicTerm.push({ id: 'term-' + x, academicYearId: 'year-' + x, academicYear: { institutionId } });
      rows.achievement.push({ id: 'achievement-' + x, institutionId });
      rows.supportCategory.push({ id: 'category-' + x, institutionId });
      rows.educationalSupportProfile.push({ id: 'profile-' + x, institutionId, studentId: 'student-' + x, active: true, parentConsentAccepted: true });
      rows.pedagogicalSupportPlan.push({ id: 'plan-' + x, institutionId, studentEnrollmentId: 'enrollment-' + x, academicTermId: 'term-' + x, status: 'COMPLETED', completedAt: new Date(), completedById: 'actor' });
    }
    prisma = {};
    for (const model of Object.keys(rows)) {
      const read = async ({ where, select }: any) => {
        const row = rows[model].find(r => matches(r, where));
        return !row ? null : select ? Object.fromEntries(Object.keys(select).map(k => [k, row[k]])) : { ...row };
      };
      prisma[model] = {
        findFirst: jest.fn(read), findUnique: jest.fn(read),
        findMany: jest.fn(async ({ where }: any) => rows[model].filter(r => matches(r, where))),
        create: jest.fn(async ({ data }: any) => { const row = { id: 'created', ...data }; rows[model].push(row); return row; }),
        update: jest.fn(async ({ where, data }: any) => {
          const row = rows[model].find(r => matches(r, where));
          if (!row) throw new Error('P2025');
          Object.assign(row, data);
          return { ...row };
        }),
      };
    }
    audit = { log: jest.fn() };
    service = new ApdService(prisma, audit, {} as any);
  });
  const planData = (x = 'A') => ({ institutionId: 'school-' + x, studentEnrollmentId: 'enrollment-' + x, academicTermId: 'term-' + x, supportProfileId: 'profile-' + x, achievementId: 'achievement-' + x, supportStrategy: 'Apoyo pedagógico' });
  function noWrites() {
    for (const model of Object.keys(rows)) {
      expect(prisma[model].create).not.toHaveBeenCalled();
      expect(prisma[model].update).not.toHaveBeenCalled();
    }
    expect(audit.log).not.toHaveBeenCalled();
  }

  describe.each([['A', 'B'], ['B', 'A']])('actor %s, foreign %s', (actor, foreign) => {
    it.each(['getProfile', 'updateProfile', 'getPlan', 'updatePlan'])('%s rejects a foreign record without mutation/audit', async method => {
      const id = (method.includes('Profile') ? 'profile-' : 'plan-') + foreign;
      const args = method.startsWith('update') ? [id, 'school-' + actor, {}, 'actor'] : [id, 'school-' + actor, 'actor'];
      await expect((service[method as keyof ApdService] as any)(...args)).rejects.toBeInstanceOf(NotFoundException);
      for (const model of ['educationalSupportProfile', 'pedagogicalSupportPlan']) {
        expect(prisma[model].findFirst.mock.calls.every(([query]: any[]) => !query.include)).toBe(true);
      }
      noWrites();
    });
    it.each(['studentEnrollmentId', 'academicTermId', 'supportProfileId', 'achievementId'])('createPlan rejects foreign %s before duplicate lookup or writing', async field => {
      const data = { ...planData(actor), [field]: (planData(foreign) as any)[field] };
      await expect(service.createPlan(data, 'actor')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.pedagogicalSupportPlan.findFirst).not.toHaveBeenCalled();
      noWrites();
    });
    it('createProfile rejects foreign student before profile lookup', async () => {
      await expect(service.createProfile({ institutionId: 'school-' + actor, studentId: 'student-' + foreign, supportCategory: 'Apoyo' }, 'actor')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.educationalSupportProfile.findUnique).not.toHaveBeenCalled();
      noWrites();
    });
    it.each(['create', 'update'])('%s profile rejects foreign category', async operation => {
      const data = { supportCategoryId: 'category-' + foreign, supportCategory: 'Apoyo' };
      const call = operation === 'create' ? service.createProfile({ ...data, institutionId: 'school-' + actor, studentId: 'student-' + actor }, 'actor') : service.updateProfile('profile-' + actor, 'school-' + actor, data, 'actor');
      await expect(call).rejects.toBeInstanceOf(NotFoundException);
      noWrites();
    });
    it('creates a coherent plan in the actor institution', async () => {
      const result = await service.createPlan(planData(actor), 'actor');
      expect(result.institutionId).toBe('school-' + actor);
      expect(result.studentEnrollmentId).toBe('enrollment-' + actor);
      expect(prisma.pedagogicalSupportPlan.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ institutionId: 'school-' + actor }) }));
    });
  });

  it('rejects another student profile inside the same institution', async () => {
    rows.educationalSupportProfile[0].studentId = 'another-student-A';
    await expect(service.createPlan(planData(), 'actor')).rejects.toBeInstanceOf(NotFoundException);
    noWrites();
  });
  it('rejects a period from another year inside the same institution', async () => {
    rows.academicTerm[0].academicYearId = 'previous-year-A';
    await expect(service.createPlan(planData(), 'actor')).rejects.toBeInstanceOf(BadRequestException);
    noWrites();
  });
  it.each(['inactive-enrollment', 'inactive-profile', 'no-consent', 'duplicate'])('rejects %s without a partial plan', async reason => {
    if (reason === 'inactive-enrollment') rows.studentEnrollment[0].status = 'WITHDRAWN';
    if (reason === 'inactive-profile') rows.educationalSupportProfile[0].active = false;
    if (reason === 'no-consent') rows.educationalSupportProfile[0].parentConsentAccepted = false;
    if (reason === 'duplicate') rows.pedagogicalSupportPlan[0].status = 'ACTIVE';
    await expect(service.createPlan(planData(), 'actor')).rejects.toBeInstanceOf(BadRequestException);
    noWrites();
  });
  it.each(['institutionId', 'studentEnrollmentId', 'academicTermId'])('rejects omitted %s before querying records', async field => {
    await expect(service.createPlan({ ...planData(), [field]: undefined }, 'actor')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.studentEnrollment.findFirst).not.toHaveBeenCalled();
    noWrites();
  });
  it.each(['getProfile', 'getPlan', 'getProfileByStudent'])('%s rejects an omitted institution', async method => {
    await expect((service[method as keyof ApdService] as any)('id', undefined, 'actor')).rejects.toBeInstanceOf(NotFoundException);
    for (const model of Object.keys(rows)) expect(prisma[model].findFirst).not.toHaveBeenCalled();
    noWrites();
  });
  it('reopening clears obsolete completion metadata and persists cleared date', async () => {
    const plan = await service.updatePlan('plan-A', 'school-A', { status: 'ACTIVE', followUpDate: '' }, 'actor');
    expect(plan).toMatchObject({ status: 'ACTIVE', completedAt: null, completedById: null, followUpDate: null });
    expect(prisma.pedagogicalSupportPlan.update.mock.calls[0][0].where).toEqual({ id: 'plan-A', institutionId: 'school-A' });
    expect(rows.pedagogicalSupportPlan[1].status).toBe('COMPLETED');
  });
  it('updates an inactive profile without activating it and allows clearing category', async () => {
    rows.educationalSupportProfile[0].active = false;
    const profile = await service.updateProfile('profile-A', 'school-A', { supportCategoryId: '', pedagogicalNotes: '' }, 'actor');
    expect(profile).toMatchObject({ active: false, supportCategoryId: null, pedagogicalNotes: '' });
    expect(prisma.educationalSupportProfile.update.mock.calls[0][0].where).toEqual({ id: 'profile-A', institutionId: 'school-A' });
  });
  it('creates a profile pending consent without activating it', async () => {
    rows.educationalSupportProfile = [];
    const result = await service.createProfile({ institutionId: 'school-A', studentId: 'student-A', supportCategory: 'Apoyo', supportCategoryId: 'category-A' }, 'actor');
    expect(result).toMatchObject({ institutionId: 'school-A', active: false, parentConsentAccepted: false });
  });
});
