import { reportAssignmentsBySubject } from './report-assignment.util';
import { AcademicYearLifecycleService } from './academic-year-lifecycle.service';

describe('report curriculum after teacher replacement', () => {
  const old = { id: 'old', subjectId: 'math', startDate: new Date('2026-01-01'), endDate: new Date('2026-10-01') };
  const current = { id: 'new', subjectId: 'math', startDate: new Date('2026-10-01'), endDate: null };

  it('counts the replaced subject once regardless of database row order', () => {
    for (const rows of [[old, current], [current, old]]) {
      expect(reportAssignmentsBySubject(rows)).toEqual([current]);
      expect(rows).toHaveLength(2);
    }
  });

  it('retains a subject when its assignments have all ended', () => {
    const ended = { ...current, endDate: new Date('2026-11-01') };
    expect(reportAssignmentsBySubject([ended, old])).toEqual([ended]);
  });

  it('does not merge distinct subjects with identical labels', () => {
    expect(reportAssignmentsBySubject([current, { ...current, id: 'other', subjectId: 'other-math' }])).toHaveLength(2);
  });

  it('uses the replacement teacher in both report-domain lookups', async () => {
    const subject = { id: 'math', name: 'Matemáticas', code: 'MAT', areaId: 'a', area: { name: 'Matemáticas', code: 'M' } };
    const prisma = { teacherAssignment: { findMany: jest.fn().mockResolvedValue([
      { ...current, subject, teacher: { firstName: 'Nueva', lastName: 'Docente' } },
      { ...old, subject, teacher: { firstName: 'Anterior', lastName: 'Docente' } },
    ]) } };
    const service = new AcademicYearLifecycleService(prisma as any, null as any, null as any, null as any);
    for (const result of [
      await service.getTeacherAssignmentsForGroup('g', 'y'),
      await service.getTeacherAssignmentsForSubjects('g', 'y', ['math']),
    ]) {
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 'new', subjectId: 'math', teacherName: 'Nueva Docente' });
    }
  });
});
