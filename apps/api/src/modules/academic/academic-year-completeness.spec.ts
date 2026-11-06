import { AcademicYearLifecycleService } from './academic-year-lifecycle.service';
import { DEFAULT_RULES_CONTEXT } from '../../engines/InstitutionRulesContext';

describe('year-end academic completeness', () => {
  const enrollment = {
    id: 'e1', institutionId: 'i1', academicYearId: 'y1', groupId: 'g1', studentId: 's1',
    student: { firstName: 'QA', lastName: 'Student' },
    group: { gradeId: 'grade1', name: 'A', grade: { id: 'grade1', name: '9', stage: 'BASICA_SECUNDARIA', number: 9 } },
  };
  const prisma = {
    teacherAssignment: { findMany: jest.fn() },
    academicYear: { findFirst: jest.fn().mockResolvedValue({ institutionId: 'i1' }) },
    grade: { findMany: jest.fn().mockResolvedValue([enrollment.group.grade]) },
    studentEnrollment: { findMany: jest.fn().mockResolvedValue([enrollment]), count: jest.fn().mockResolvedValue(0) },
  };
  const grades = { calculateAnnualGrade: jest.fn() };
  const attendance = { getStudentSummary: jest.fn().mockResolvedValue({ total: 10, attendanceRate: 100 }) };
  const context = { getContext: jest.fn().mockResolvedValue(DEFAULT_RULES_CONTEXT) };
  let service: AcademicYearLifecycleService;

  beforeEach(() => {
    jest.clearAllMocks();
    attendance.getStudentSummary.mockResolvedValue({ total: 10, attendanceRate: 100 });
    service = new AcademicYearLifecycleService(prisma as any, context as any, attendance as any, grades as any);
    jest.spyOn(service, 'getYearById').mockResolvedValue({ institutionId: 'i1' } as any);
  });

  it('holds a student for review when an annual average omits a weighted period', async () => {
    prisma.teacherAssignment.findMany.mockResolvedValue([{ id: 'a1', subjectId: 'm', subject: { name: 'Matemáticas' } }]);
    grades.calculateAnnualGrade.mockResolvedValue({ annualGrade: 4, sources: [
      { name: 'Período 1', weight: 25, grade: 4 }, { name: 'Período 2', weight: 25, grade: null },
      { name: 'Opcional', weight: 0, grade: null },
    ] });
    const preview = await service.previewPromotions('y1', 'i1');
    expect(preview[0].suggestedStatus).toBe('ACTIVE');
    expect(preview[0].reviewReasons).toEqual(['Matemáticas: faltan notas en Período 2']);
    const result = await (service as any).computePromotions('y1', 'i1');
    expect(result.reviewPendingCount).toBe(1);
    expect(result.writes[0].reason).toContain('Período 2');
  });

  it('holds duplicate subject assignments for review instead of counting them twice', async () => {
    prisma.teacherAssignment.findMany.mockResolvedValue([
      { id: 'old', subjectId: 'm', subject: { name: 'Matemáticas' } },
      { id: 'new', subjectId: 'm', subject: { name: 'Matemáticas' } },
    ]);
    grades.calculateAnnualGrade.mockResolvedValue({ annualGrade: 4, sources: [{ name: 'P1', weight: 100, grade: 4 }] });
    const preview = await service.previewPromotions('y1', 'i1');
    expect(preview[0].suggestedStatus).toBe('ACTIVE');
    expect(preview[0].reviewReasons?.[0]).toContain('Matemáticas');
    const result = await (service as any).computePromotions('y1', 'i1');
    expect(result.reviewPendingCount).toBe(1);
  });

  it('allows a complete single assignment to produce a promotion decision', async () => {
    prisma.teacherAssignment.findMany.mockResolvedValue([{ id: 'a1', subjectId: 'm', subject: { name: 'Matemáticas' } }]);
    grades.calculateAnnualGrade.mockResolvedValue({ annualGrade: 4, sources: [{ name: 'P1', weight: 100, grade: 4 }] });
    const preview = await service.previewPromotions('y1', 'i1');
    expect(preview[0].suggestedStatus).toBe('GRADUATED');
  });

  it('does not treat missing attendance as a zero attendance rate and fail the student', async () => {
    prisma.teacherAssignment.findMany.mockResolvedValue([{ id: 'a1', subjectId: 'm', subject: { name: 'Matemáticas' } }]);
    grades.calculateAnnualGrade.mockResolvedValue({ annualGrade: 4, sources: [{ name: 'P1', weight: 100, grade: 4 }] });
    attendance.getStudentSummary.mockResolvedValue({ total: 0, attendanceRate: 0 });
    const preview = await service.previewPromotions('y1', 'i1');
    expect(preview[0].suggestedStatus).toBe('ACTIVE');
    expect(preview[0].reviewReasons).toContain('No hay registros de asistencia para evaluar el año');
    const result = await (service as any).computePromotions('y1', 'i1');
    expect(result.reviewPendingCount).toBe(1);
    expect(result.repeatedCount).toBe(0);
  });
});
