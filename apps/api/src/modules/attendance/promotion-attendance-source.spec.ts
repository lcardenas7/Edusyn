import { AttendanceService } from './attendance.service';

describe('promotion attendance source', () => {
  const prisma = {
    institution: { findUnique: jest.fn() },
    studentEnrollment: { findFirst: jest.fn() },
    tutoringAttendance: { findMany: jest.fn() },
  };
  const service = new AttendanceService(prisma as any, null as any);
  beforeEach(() => jest.resetAllMocks());
  it('counts daily tutoring without adding subject sessions', async () => {
    prisma.institution.findUnique.mockResolvedValue({ gradingConfig: { promotionAttendanceSource: 'TUTORING' } });
    prisma.studentEnrollment.findFirst.mockResolvedValue({ id: 'e' });
    prisma.tutoringAttendance.findMany.mockResolvedValue([{ status: 'PRESENT' }, { status: 'ABSENT' }]);
    expect(await service.getStudentPromotionSummary('e', 'i')).toMatchObject({ total: 2, attendanceRate: 50, source: 'TUTORING' });
    expect(prisma.tutoringAttendance.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { studentEnrollmentId: 'e', institutionId: 'i' } }));
  });
  it('rejects a foreign enrollment before reading tutoring records', async () => {
    prisma.institution.findUnique.mockResolvedValue({ gradingConfig: { promotionAttendanceSource: 'TUTORING' } });
    prisma.studentEnrollment.findFirst.mockResolvedValue(null);
    await expect(service.getStudentPromotionSummary('foreign', 'i')).rejects.toThrow('Matrícula no encontrada');
    expect(prisma.tutoringAttendance.findMany).not.toHaveBeenCalled();
  });
  it('rejects an invalid configured source', async () => {
    prisma.institution.findUnique.mockResolvedValue({ gradingConfig: { promotionAttendanceSource: 'MIXED' } });
    await expect(service.getStudentPromotionSummary('e', 'i')).rejects.toThrow('Fuente de asistencia');
  });
});
