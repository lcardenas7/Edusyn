import { MathEventsService } from './math-events.service';

describe('Math event access diagnosis', () => {
  const actor = { institutionId: 'school-a', userId: 'teacher', roles: ['DOCENTE'], isSuperAdmin: false };
  let db: any;
  let service: MathEventsService;
  beforeEach(() => {
    db = {
      mathEvent: { findFirst: jest.fn().mockResolvedValue({ status: 'PUBLISHED', startsAt: new Date(Date.now() - 3600000), endsAt: new Date(Date.now() + 3600000), eligibleGrades: [6,7,8,9,10,11] }) },
      student: { findFirst: jest.fn().mockResolvedValue({ id: 'student', firstName: 'Ana María', lastName: 'López Pérez', isActive: true,
        user: { isActive: true, roles: [], institutionUsers: [{ institutionUserRoles: [{ role: { name: 'ESTUDIANTE' } }] }] } }) },
      studentEnrollment: { findMany: jest.fn().mockResolvedValue([{ group: { name: 'B', grade: { name: 'Décimo', number: 10 } } }]) },
    };
    service = new MathEventsService(db, {} as any);
  });
  it('limits every lookup to the requesting institution and excludes secrets', async () => {
    const result = await service.checkStudentAccess(actor, 'event', 'alopez-test');
    expect(result.canSeeEvent).toBe(true);
    expect(result.student?.resolvedGrade).toBe(10);
    expect(db.mathEvent.findFirst.mock.calls[0][0].where).toEqual({ id: 'event', institutionId: 'school-a' });
    expect(db.student.findFirst.mock.calls[0][0].where).toEqual({ institutionId: 'school-a', user: { username: { equals: 'alopez-test', mode: 'insensitive' } } });
    expect(db.studentEnrollment.findMany.mock.calls[0][0].where.institutionId).toBe('school-a');
    expect(JSON.stringify(db.student.findFirst.mock.calls[0][0].select)).not.toMatch(/password|documentNumber|email/);
    expect(result.student?.name).toBe('Ana López');
  });
  it('does not search students when the event belongs to another institution', async () => {
    db.mathEvent.findFirst.mockResolvedValue(null);
    await expect(service.checkStudentAccess(actor, 'other-event', 'alopez-test')).rejects.toThrow('Evento no disponible');
    expect(db.student.findFirst).not.toHaveBeenCalled();
  });
  it('returns no identity when the username has no student in this institution', async () => {
    db.student.findFirst.mockResolvedValue(null);
    const result = await service.checkStudentAccess(actor, 'event', 'unknown');
    expect(result.student).toBeNull();
    expect(result.canSeeEvent).toBe(false);
    expect(db.studentEnrollment.findMany).not.toHaveBeenCalled();
  });
  it('reports a missing active enrollment without granting access', async () => {
    db.studentEnrollment.findMany.mockResolvedValue([]);
    const result = await service.checkStudentAccess(actor, 'event', 'alopez-test');
    expect(result.canSeeEvent).toBe(false);
    expect(result.checks.find(c => c.label.startsWith('Matrícula'))?.ok).toBe(false);
  });
  it('allows an enabled account with current enrollment despite a stale student profile flag', async () => {
    const student = await db.student.findFirst();
    student.isActive = false;
    const result = await service.checkStudentAccess(actor, 'event', 'alopez-test');
    expect(result.canSeeEvent).toBe(true);
    expect(result.profileStatusMismatch).toBe(true);
  });
  it('still rejects disabled accounts and inactive school memberships', async () => {
    const student = await db.student.findFirst();
    student.user.isActive = false;
    expect((await service.checkStudentAccess(actor, 'event', 'alopez-test')).canSeeEvent).toBe(false);
    student.user.isActive = true;
    student.user.institutionUsers = [];
    expect((await service.checkStudentAccess(actor, 'event', 'alopez-test')).canSeeEvent).toBe(false);
  });
  it('uses legacy global roles only when tenant roles are empty', async () => {
    const student = await db.student.findFirst();
    student.user.roles = [{ role: { name: 'ESTUDIANTE' } }];
    student.user.institutionUsers[0].institutionUserRoles = [];
    expect((await service.checkStudentAccess(actor, 'event', 'alopez-test')).canSeeEvent).toBe(true);
    student.user.institutionUsers[0].institutionUserRoles = [{ role: { name: 'DOCENTE' } }];
    expect((await service.checkStudentAccess(actor, 'event', 'alopez-test')).canSeeEvent).toBe(false);
  });
  it('rejects invalid usernames before querying the database', async () => {
    await expect(service.checkStudentAccess(actor, 'event', 'name with spaces')).rejects.toThrow('Escribe el usuario');
    expect(db.mathEvent.findFirst).not.toHaveBeenCalled();
  });
});
