import { MathEventsService } from './math-events.service';

describe('Math event teacher live dashboard', () => {
  const teacher = { institutionId: 'school', userId: 'teacher', roles: ['DOCENTE'], isSuperAdmin: false };
  const service = new MathEventsService({
    mathEvent: { findFirst: jest.fn().mockResolvedValue({ id: 'event', title: 'Matemáticas', status: 'PUBLISHED' }) },
    mathEventParticipant: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([{ presenceUntil: new Date(), enrollment: { student: { firstName: 'Ana María', lastName: 'Pérez Soto' }, group: { name: 'B', grade: { name: 'Décimo', number: 10 } } } }]),
    },
    mathEventDuel: {
      count: jest.fn().mockResolvedValue(8),
      findMany: jest.fn().mockResolvedValue([{
        id: 'duel', status: 'ACTIVE', createdAt: new Date(), acceptedAt: new Date(), expiresAt: new Date(Date.now() + 60000),
        answers: [{ enrollmentId: 'a', isCorrect: true, answer: 'reserva confidencial', createdAt: new Date() }],
        inviter: { id: 'a', student: { firstName: 'Ana María', lastName: 'Pérez Soto' }, group: { name: 'B', grade: { name: 'Décimo', number: 10 } } },
        invitee: { id: 'b', student: { firstName: 'Luis Andrés', lastName: 'Díaz Ruiz' }, group: { name: 'C', grade: { name: 'Décimo', number: 10 } } },
      }]),
    },
  } as any, {} as any);

  it('shows online students and duel progress without transmitting response text or questions', async () => {
    jest.spyOn(service as any, 'reconcileDuels').mockResolvedValue(undefined);
    const result = await service.liveReport(teacher, 'event');
    expect(result.summary).toMatchObject({ participantsOnline: 1, duelsInProgress: 1, duelsCompleted: 8, answersInProgress: 1 });
    expect(result.onlineStudents).toEqual([{ firstName: 'Ana', lastName: 'Pérez', course: 'B', grade: 10 }]);
    expect(result.duels[0].players[0]).toMatchObject({ firstName: 'Ana', lastName: 'Pérez', answered: 1, total: 7, correct: 1, points: 10, state: 'PLAYING' });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('reserva confidencial');
    expect(serialized).not.toContain('correctAnswer');
    expect(serialized).not.toContain('explanation');
    expect(serialized).not.toContain('question');
  });
  it('does not return another institution’s event', async () => {
    const db = (service as any).db;
    db.mathEvent.findFirst.mockResolvedValue(null);
    await expect(service.liveReport(teacher, 'foreign')).rejects.toThrow('Evento no disponible');
    expect(db.mathEvent.findFirst.mock.calls.at(-1)[0].where).toEqual({ id: 'foreign', institutionId: 'school' });
  });
});
