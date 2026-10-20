import { MathEventsService } from './math-events.service';

describe('Math event lifecycle and server clock', () => {
  const actor = { institutionId: 'school', userId: 'user', roles: ['ESTUDIANTE'], isSuperAdmin: false };
  let service: MathEventsService;
  let duel: any;
  let tx: any;
  const questions = Array.from({ length: 7 }, (_, i) => ({ id: `q${i}`, text: `Pregunta ${i}`, options: ['2', '3'], correctAnswer: '2', explanation: 'Explicación' }));
  beforeEach(() => {
    duel = { id: 'duel', institutionId: 'school', eventId: 'event', inviterEnrollmentId: 'a', inviteeEnrollmentId: 'b', status: 'ACTIVE',
      acceptedAt: new Date(), expiresAt: new Date(Date.now() + 480000), answers: [],
      event: { status: 'PUBLISHED', startsAt: new Date(Date.now() - 60000), endsAt: new Date(Date.now() + 3600000), showCorrectAnswers: false, showExplanations: false },
      questions: { version: 2, inviter: questions, invitee: questions, clocks: {} } };
    tx = { mathEventDuel: { update: jest.fn().mockImplementation(async ({ data }) => { Object.assign(duel, data); return duel; }), updateMany: jest.fn().mockResolvedValue({ count: 1 }), findMany: jest.fn() },
      mathEventDuelAnswer: { create: jest.fn().mockImplementation(async ({ data }) => { duel.answers.push(data); return data; }), count: jest.fn().mockImplementation(async () => duel.answers.length), createMany: jest.fn().mockImplementation(async ({ data }) => { duel.answers.push(...data); return { count: data.length }; }) } };
    service = new MathEventsService({} as any, {} as any);
    jest.spyOn(service as any, 'member').mockImplementation(async () => ({ s: { id: 'a' }, d: duel }));
    jest.spyOn(service as any, 'lockedDuel').mockImplementation(async (_school: any, _id: any, action: any) => action(tx, duel));
  });
  it('does not block a player who finished all seven while their rival is unfinished', async () => {
    tx.mathEventDuel.findMany.mockResolvedValue([{ _count: { answers: 7 } }, { _count: { answers: 3 } }]);
    expect(await (service as any).unfinishedActiveCount(tx, 'event', 'school', 'a')).toBe(1);
    expect(tx.mathEventDuel.findMany.mock.calls[0][0].select._count.select.answers.where).toEqual({ enrollmentId: 'a' });
  });
  it('starts a 30 second clock once and preserves it on reload and for the other player', async () => {
    await (service as any).startClock('school', 'duel', 'a', 0);
    const first = duel.questions.clocks.inviter;
    expect(new Date(first.deadlineAt).getTime() - new Date(first.startedAt).getTime()).toBe(30000);
    await (service as any).startClock('school', 'duel', 'a', 0);
    expect(tx.mathEventDuel.update).toHaveBeenCalledTimes(1);
    await (service as any).startClock('school', 'duel', 'b', 0);
    expect(duel.questions.clocks.inviter).toEqual(first);
    expect(duel.questions.clocks.invitee.ordinal).toBe(0);
  });
  it('does not reveal future questions or hidden solutions', async () => {
    let result = await service.getDuel(actor, 'duel', true);
    expect(result.questions.every(q => q.text === '' && q.options.length === 0)).toBe(true);
    await (service as any).startClock('school', 'duel', 'a', 0);
    result = await service.getDuel(actor, 'duel', true);
    expect(result.questions[0].text).toBe('Pregunta 0');
    expect(result.questions[1].text).toBe('');
    expect(result.questions[0]).not.toHaveProperty('correctAnswer');
  });
  it('rejects skipped questions and a timeout submitted before the deadline', async () => {
    await expect((service as any).startClock('school', 'duel', 'a', 1)).rejects.toThrow('en orden');
    await (service as any).startClock('school', 'duel', 'a', 0);
    await expect(service.answer(actor, 'duel', 0, '')).rejects.toThrow('Elige una');
    expect(tx.mathEventDuelAnswer.create).not.toHaveBeenCalled();
  });
  it('records a late correct response as unanswered and is idempotent on retry', async () => {
    duel.questions.clocks.inviter = { ordinal: 0, deadlineAt: new Date(Date.now() - 1000).toISOString() };
    expect(await service.answer(actor, 'duel', 0, '2')).toEqual({ accepted: true, isCorrect: false, timedOut: true });
    expect(duel.answers[0].answer).toBe('');
    await service.answer(actor, 'duel', 0, '2');
    expect(tx.mathEventDuelAnswer.create).toHaveBeenCalledTimes(1);
  });
  it('keeps existing untimed snapshots playable and closes the final answer atomically', async () => {
    duel.questions.version = 1;
    duel.answers = Array.from({ length: 13 }, (_, i) => ({ enrollmentId: i < 6 ? 'a' : 'b', ordinal: i < 6 ? i : i - 6, answer: '2', isCorrect: true }));
    const result = await service.answer(actor, 'duel', 6, '2');
    expect(result.isCorrect).toBe(true);
    expect(tx.mathEventDuel.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) }));
    expect((await service.getDuel(actor, 'duel', true)).timeLimitSeconds).toBeNull();
  });
  it('leaving preserves earned answers and fills only that player’s unanswered questions', async () => {
    const earned = { enrollmentId: 'a', ordinal: 0, answer: '2', isCorrect: true };
    duel.answers.push(earned);
    await service.leaveDuel(actor, 'duel');
    expect(duel.answers[0]).toEqual(earned);
    expect(duel.answers).toHaveLength(7);
    expect(duel.answers.every((a: any) => a.enrollmentId === 'a')).toBe(true);
    expect(duel.questions.left).toEqual(['a']);
    expect(tx.mathEventDuel.updateMany).not.toHaveBeenCalled();
  });
  it('reconciles abandoned games without overwriting answers and leaves recent games alone', async () => {
    const createdAt = new Date(Date.now() - 11 * 60000);
    duel.acceptedAt = createdAt;
    duel.answers.push({ enrollmentId: 'a', ordinal: 0, answer: '2', isCorrect: true, createdAt });
    const db = { mathEventDuel: { findMany: jest.fn().mockImplementation(async () => [{ ...duel }]) } };
    (service as any).db = db;
    await (service as any).reconcileDuels('school', { eventId: 'event' });
    expect(duel.answers).toHaveLength(14);
    expect(duel.answers[0].isCorrect).toBe(true);
    expect(duel.questions.closureReason).toBe('INACTIVITY');
    expect(tx.mathEventDuel.updateMany).toHaveBeenCalled();
    duel.answers = []; duel.acceptedAt = new Date();
    tx.mathEventDuel.updateMany.mockClear();
    await (service as any).reconcileDuels('school', { eventId: 'event' });
    expect(tx.mathEventDuel.updateMany).not.toHaveBeenCalled();
  });
  it.each([0, 1, 2])('enforces two accepted games per pair and Colombia day under the acceptance lock (used=%s)', async used => {
    duel.status = 'INVITED'; duel.pairKey = 'a:b';
    (service as any).member.mockResolvedValue({ s: { id: 'b' }, d: duel });
    jest.spyOn(service as any, 'reconcileDuels').mockResolvedValue(undefined);
    tx.$queryRaw = jest.fn();
    tx.mathEventDuel.count = jest.fn().mockResolvedValue(used);
    tx.mathEventDuel.findMany.mockResolvedValue([]);
    (service as any).db = { $transaction: async (action: any) => action(tx) };
    const request = service.respond(actor, 'duel', true);
    if (used >= 2) await expect(request).rejects.toThrow('dos partidas');
    else await expect(request).resolves.toEqual({ id: 'duel', status: 'ACTIVE' });
    const pairWhere = tx.mathEventDuel.count.mock.calls[0][0].where;
    expect(pairWhere.pairKey).toBe('a:b');
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    expect(pairWhere.acceptedAt.gte).toEqual(new Date(`${day}T00:00:00-05:00`));
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
  });
});
