import { NotFoundException } from '@nestjs/common';
import { AcademicYearLifecycleService } from './academic-year-lifecycle.service';
import { DEFAULT_RULES_CONTEXT } from '../../engines/InstitutionRulesContext';
import { evaluatePromotion, willPromote } from '../../engines/promotion.engine';

describe('year-end pending promotion', () => {
  const grade = { id: 'grade-9', name: '9', stage: 'BASIC_SECONDARY', number: 9 };
  const students = ['approved', 'pending', 'failed'].map((id) => ({
    id: `enrollment-${id}`, institutionId: 'school-a', studentId: id,
    student: { firstName: id, lastName: 'QA' }, group: { name: 'A', gradeId: grade.id, grade },
  }));
  const prisma = {
    academicYear: { findFirst: jest.fn() },
    grade: { findMany: jest.fn() },
    studentEnrollment: { findMany: jest.fn(), count: jest.fn() },
    finalRecoveryPlan: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const context = { getContext: jest.fn() };
  let service: AcademicYearLifecycleService;

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.academicYear.findFirst.mockResolvedValue({ institutionId: 'school-a' });
    prisma.grade.findMany.mockResolvedValue([grade]);
    prisma.studentEnrollment.findMany.mockResolvedValue(students);
    prisma.studentEnrollment.count.mockResolvedValue(0);
    context.getContext.mockResolvedValue({});
    service = new AcademicYearLifecycleService(prisma as any, context as any, {} as any, {} as any);
    jest.spyOn(service, 'getYearById').mockResolvedValue({ institutionId: 'school-a' } as any);
    jest.spyOn(service as any, 'buildPromotionAssessment').mockImplementation(async (e: any) => ({
      hasAcademicData: true, finalAverage: 3.5,
      result: { status: e.studentId === 'approved' ? 'PROMOTED' : e.studentId === 'pending' ? 'AT_RISK' : 'NOT_PROMOTED', reasons: ['QA'] },
    }));
  });

  it('keeps pending students active instead of graduating or promoting them', async () => {
    const preview = await service.previewPromotions('year-a', 'school-a');
    expect(preview.map((p) => p.suggestedStatus)).toEqual(['GRADUATED', 'ACTIVE', 'REPEATED']);
    expect(preview[1].nextGradeId).toBeNull();
    const result = await (service as any).computePromotions('year-a', 'school-a');
    expect(result.writes.map((w: any) => w.newStatus)).toEqual(['GRADUATED', 'ACTIVE', 'REPEATED']);
    expect(result.reviewPendingCount).toBe(1);
    expect(result.writes[1].reason).toContain('pendiente de decisión');
  });

  it('rejects a preview for another institution before reading enrollments', async () => {
    prisma.academicYear.findFirst.mockResolvedValue(null);
    await expect(service.previewPromotions('year-b', 'school-a')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.studentEnrollment.findMany).not.toHaveBeenCalled();
  });

  it('rejects closure validation for another institution before reading recovery plans', async () => {
    (service.getYearById as jest.Mock).mockRejectedValue(new NotFoundException());
    await expect(service.validateYearForClosure('year-b', 'school-a')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.finalRecoveryPlan.findMany).not.toHaveBeenCalled();
  });

  it('limits recovery plans in closure validation to the selected institution', async () => {
    prisma.finalRecoveryPlan.findMany.mockResolvedValue([]);
    await expect(service.validateYearForClosure('year-a', 'school-a')).resolves.toEqual([]);
    expect(prisma.finalRecoveryPlan.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ academicYearId: 'year-a', institutionId: 'school-a' }) }));
  });

  it('blocks closure before any writes when promotion decisions remain pending', async () => {
    (service.getYearById as jest.Mock).mockResolvedValue({ institutionId: 'school-a', status: 'ACTIVE' });
    jest.spyOn(service, 'validateYearForClosure').mockResolvedValue([]);
    await expect(service.closeYear({ yearId: 'year-a', institutionId: 'school-a', userId: 'admin', calculatePromotions: true }))
      .rejects.toThrow('El año lectivo no puede ser cerrado');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([false, undefined])('blocks closure without promotion calculation when active enrollments remain (%s)', async (calculatePromotions) => {
    (service.getYearById as jest.Mock).mockResolvedValue({ institutionId: 'school-a', status: 'ACTIVE' });
    jest.spyOn(service, 'validateYearForClosure').mockResolvedValue([]);
    prisma.studentEnrollment.count.mockResolvedValue(2);
    await expect(service.closeYear({ yearId: 'year-a', institutionId: 'school-a', userId: 'admin', calculatePromotions }))
      .rejects.toThrow('El año lectivo no puede ser cerrado');
    expect(prisma.studentEnrollment.count).toHaveBeenCalledWith({ where: { academicYearId: 'year-a', institutionId: 'school-a', status: 'ACTIVE' } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('continues closure when all promotion decisions are resolved', async () => {
    (service.getYearById as jest.Mock).mockResolvedValue({ institutionId: 'school-a', status: 'ACTIVE' });
    jest.spyOn(service, 'validateYearForClosure').mockResolvedValue([]);
    jest.spyOn(service as any, 'computePromotions').mockResolvedValue({
      writes: [], promotedCount: 0, repeatedCount: 0, graduatedCount: 0, reviewPendingCount: 0, withdrawnCount: 0,
    });
    const tx = { academicYear: { update: jest.fn() } };
    prisma.$transaction.mockImplementation(async (fn) => fn(tx));
    const result = await service.closeYear({ yearId: 'year-a', institutionId: 'school-a', userId: 'admin', calculatePromotions: true });
    expect(result.success).toBe(true);
    expect(tx.academicYear.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'year-a' }, data: expect.objectContaining({ status: 'CLOSED' }) }));
  });

  it('does not treat two pending subjects as a confirmed promotion', () => {
    const data = { studentId: 'pending', studentName: 'QA', finalAverage: 3.5,
      failedSubjectsCount: 2, failedSubjectNames: ['A', 'B'], attendancePercent: 100 };
    const rules = { ...DEFAULT_RULES_CONTEXT, maxFailedSubjectsForPromotion: 2 };
    expect(evaluatePromotion(data, rules).status).toBe('AT_RISK');
    expect(willPromote(data, rules)).toBe(false);
    expect(evaluatePromotion({ ...data, failedSubjectsCount: 3 }, rules).status).toBe('NOT_PROMOTED');
    expect(willPromote({ ...data, failedSubjectsCount: 0, failedSubjectNames: [] }, rules)).toBe(true);
  });
});
