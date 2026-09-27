import { DuelService } from './duel.service';

const actor = { userId: 'user-1', institutionId: 'school-1', roles: ['ESTUDIANTE'], isSuperAdmin: false };
const baseDuel = {
  id: 'duel-1', institutionId: 'school-1', classroomId: 'class-1', inviterEnrollmentId: 'enroll-1', inviteeEnrollmentId: 'enroll-2',
  status: 'ACTIVE', expiresAt: new Date(Date.now() + 3600000),
  questions: [{ id: 'q1', text: '¿Cuánto es 2 + 2?', options: ['3', '4'], correctAnswer: '4', explanation: 'Dos y dos son cuatro.' }],
};

function setup(duel = baseDuel, answers: Array<{ enrollmentId: string; ordinal: number; isCorrect: boolean }> = []) {
  const prisma = {
    classroomDuel: { findFirst: jest.fn().mockResolvedValue(duel), updateMany: jest.fn() },
    classroomDuelAnswer: { findMany: jest.fn().mockResolvedValue(answers) },
  };
  const access = {
    classroomInScope: jest.fn().mockResolvedValue({ teacherAssignment: { teacherId: 'teacher-1', groupId: 'group-1', academicYearId: 'year-1' } }),
    studentEnrollmentInClassroom: jest.fn().mockResolvedValue('enroll-1'),
  };
  return { service: new DuelService(prisma as any, access as any), prisma, access };
}

describe('DuelService privacy', () => {
  it('sends only the current question while the match is active', async () => {
    const { service } = setup();
    const state = await service.get(actor, 'duel-1');
    expect(state.question).toEqual({ ordinal: 0, text: '¿Cuánto es 2 + 2?', options: ['3', '4'] });
    expect(state.result).toBeNull();
    expect(JSON.stringify(state)).not.toContain('correctAnswer');
    expect(JSON.stringify(state)).not.toContain('Dos y dos son cuatro');
  });

  it('reveals scores and explanations only after both finish', async () => {
    const { service } = setup({ ...baseDuel, status: 'COMPLETED' }, [
      { enrollmentId: 'enroll-1', ordinal: 0, isCorrect: true },
      { enrollmentId: 'enroll-2', ordinal: 0, isCorrect: false },
    ]);
    const state = await service.get(actor, 'duel-1');
    expect(state.question).toBeNull();
    expect(state.result).toMatchObject({ myScore: 1, opponentScore: 0, review: [{ correctAnswer: '4', myCorrect: true }] });
  });

  it('does not reveal someone else’s duel', async () => {
    const { service } = setup({ ...baseDuel, inviterEnrollmentId: 'enroll-3', inviteeEnrollmentId: 'enroll-2' });
    await expect(service.get(actor, 'duel-1')).rejects.toThrow('Duelo no encontrado');
  });
});
