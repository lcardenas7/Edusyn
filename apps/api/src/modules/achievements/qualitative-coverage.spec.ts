import { buildQualitativeCoverage } from './qualitative-coverage';

describe('shared qualitative coverage', () => {
  it('separates catalogs for different grades sharing a dimension', async () => {
    const prisma: any = {
      achievementConfig: { findUnique: jest.fn().mockResolvedValue({ valuationScope: 'PURPOSE' }) },
      achievement: { findMany: jest.fn().mockResolvedValue([
        { id: 'purpose-a', gradeId: 'grade-a', subjectId: 'dimension', academicTermId: null, evidences: [] },
        { id: 'purpose-b', gradeId: 'grade-b', subjectId: 'dimension', academicTermId: null, evidences: [] },
      ]) },
      studentAchievement: { findMany: jest.fn().mockResolvedValue([
        { studentEnrollmentId: 'enr-a', achievementId: 'purpose-a', academicTermId: 'p1' },
      ]) },
    };
    const result = await buildQualitativeCoverage(prisma, { institutionId: 'i', academicYearId: 'y',
      terms: [{ id: 'p1', order: 1 }], teacherAssignmentIds: [], groups: [
        { id: 'a', gradeId: 'grade-a', subjectIds: ['dimension'], enrollmentIds: ['enr-a'] },
        { id: 'b', gradeId: 'grade-b', subjectIds: ['dimension'], enrollmentIds: ['enr-b'] },
      ] });
    expect([...result.expectedByCell.get('a|dimension|p1')!]).toEqual(['purpose-a']);
    expect(result.index.get('a|dimension|p1')?.has('enr-a')).toBe(true);
    expect(result.index.get('b|dimension|p1')?.has('enr-b')).toBe(false);
  });
});
