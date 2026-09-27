import { DuelService } from './duel.service';

const actor = { userId: 'user-1', institutionId: 'school-1', roles: ['ESTUDIANTE'], isSuperAdmin: false };
const baseDuel = {
  id: 'duel-1', institutionId: 'school-1', classroomId: 'class-1', inviterEnrollmentId: 'enroll-1', inviteeEnrollmentId: 'enroll-2',
  status: 'ACTIVE', expiresAt: new Date(Date.now() + 3600000),
  questions: [{ id: 'q1', text: '¿Cuánto es 2 + 2?', options: ['3', '4'], correctAnswer: '4', explanation: 'Dos y dos son cuatro.' }],
};

function setup(duel = baseDuel, answers: Array<{ enrollmentId: string; ordinal: number; isCorrect: boolean }> = [], powerUse: { ordinal: number; options: string[] } | null = null) {
  const prisma = {
    classroomDuel: { findFirst: jest.fn().mockResolvedValue(duel), updateMany: jest.fn(), count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue({ id: 'new-duel', category: 'Fracciones', selectionMode: 'CHOSEN' }) },
    classroomDuelAnswer: { findMany: jest.fn().mockResolvedValue(answers) },
    classroomDuelPowerUse: { findUnique: jest.fn().mockResolvedValue(powerUse) },
    studentEnrollment: { findFirst: jest.fn().mockResolvedValue({ id: 'enroll-2' }) },
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
    expect(state.question).toMatchObject({ ordinal: 0, text: '¿Cuánto es 2 + 2?', options: ['3', '4'] });
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

  it('keeps the same narrowed options after a 50/50 power is used', async () => {
    const duel = { ...baseDuel, questions: [{ ...baseDuel.questions[0], options: ['3', '4', '5', '6'] }] };
    const { service } = setup(duel, [], { ordinal: 0, options: ['4', '6'] });
    const state = await service.get(actor, 'duel-1');
    expect(state.powerAvailable).toBe(false);
    expect(state.question).toMatchObject({ options: ['4', '6'], powerApplied: true });
    expect(JSON.stringify(state)).not.toContain('correctAnswer');
  });

  it('freezes seven questions from the category chosen by the student', async () => {
    const { service, prisma } = setup();
    const pool = ['Fracciones', 'Geometría'].flatMap((category) => Array.from({ length: 7 }, (_, index) => ({
      id: `${category}-${index}`, category, text: `Pregunta ${index} de ${category}`, options: ['A', 'B', 'C'], correctAnswer: 'A', explanation: null,
    })));
    jest.spyOn(service as any, 'pool').mockResolvedValue(pool);
    await service.invite(actor, 'class-1', 'enroll-2', { category: 'Fracciones', selectionMode: 'CHOSEN' });
    const data = prisma.classroomDuel.create.mock.calls[0][0].data;
    expect(data.category).toBe('Fracciones');
    expect(data.questions).toHaveLength(7);
    expect(data.questions.every((question: { category: string }) => question.category === 'Fracciones')).toBe(true);
  });
});
