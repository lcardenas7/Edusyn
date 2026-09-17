import { LiveSessionService } from './live-session.service';

/**
 * Quiz en casa: al cerrar la sesión del docente, quien no terminó queda cerrado y calificado con
 * lo que alcanzó a responder; y dos entradas simultáneas no crean dos sesiones.
 */
describe('LiveSessionService · quiz en casa', () => {
  function build(prisma: any) {
    const service = new LiveSessionService(prisma);
    jest.spyOn(service as any, 'broadcast').mockImplementation(() => undefined);
    jest.spyOn(service as any, 'cleanupStream').mockImplementation(() => undefined);
    jest.spyOn(service as any, 'getRanking').mockResolvedValue([]);
    return service;
  }

  afterEach(() => jest.useRealTimers());

  it('cerrar la sesión del docente cierra y califica a cada estudiante que no terminó', async () => {
    jest.useFakeTimers();
    const prisma: any = {
      liveSession: {
        update: jest.fn().mockResolvedValue({ id: 'parent', status: 'FINISHED' }),
        findMany: jest.fn().mockResolvedValue([
          { id: 'ana-1', activityId: 'act', studentEnrollmentId: 'ana', _count: { answers: 0 } },
          { id: 'ana-2', activityId: 'act', studentEnrollmentId: 'ana', _count: { answers: 2 } },
          { id: 'leo-1', activityId: 'act', studentEnrollmentId: 'leo', _count: { answers: 1 } },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = build(prisma);
    jest.spyOn(service as any, 'validateTeacherSession').mockResolvedValue({ id: 'parent', deliveryMode: 'ASYNC_HOME', parentSessionId: null, activityId: 'act' });
    const grade = jest.spyOn(service as any, 'autoGradeAsyncHomeChildSession').mockResolvedValue(undefined);
    const gradeAll = jest.spyOn(service as any, 'autoGradeFromLiveQuiz').mockResolvedValue(undefined);

    await service.finishSession('parent', 'teacher');

    expect(prisma.liveSession.findMany.mock.calls[0][0].where).toEqual({ parentSessionId: 'parent', status: { not: 'FINISHED' } });
    expect(prisma.liveSession.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['ana-1', 'ana-2'] }, status: { not: 'FINISHED' } }, data: expect.objectContaining({ status: 'FINISHED' }) });
    // Con dos sesiones del mismo estudiante se califica la que tiene respuestas.
    expect(grade.mock.calls).toEqual([['ana-2', 'act', 'ana'], ['leo-1', 'act', 'leo']]);
    expect(gradeAll).not.toHaveBeenCalled();
  });

  it('dos entradas del mismo estudiante devuelven la misma sesión', async () => {
    const created: string[] = [];
    const tx: any = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      liveSession: {
        findFirst: jest.fn(async () => (created[0] ? { id: created[0] } : null)),
        create: jest.fn(async () => { created.push(`child-${created.length + 1}`); return { id: created[created.length - 1] }; }),
      },
    };
    const prisma: any = {
      liveSession: {
        findUnique: jest.fn().mockResolvedValue({ id: 'parent', classroomId: 'room', activityId: 'act', teacherId: 't', status: 'ACTIVE', config: {}, deliveryMode: 'ASYNC_HOME' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      classroom: { findUnique: jest.fn().mockResolvedValue({ teacherAssignment: { groupId: 'g', academicYearId: 'y' } }) },
      studentEnrollment: { findFirst: jest.fn().mockResolvedValue({ id: 'ana' }) },
      $transaction: jest.fn((fn: any) => fn(tx)),
    };
    const service = build(prisma);
    const start = jest.spyOn(service, 'startSession').mockResolvedValue({} as any);
    jest.spyOn(service, 'nextQuestion').mockResolvedValue({} as any);
    jest.spyOn(service, 'getSession').mockImplementation(async (id: string) => ({ id }) as any);

    const first = await service.joinAsyncHomeSession('parent', 'user');
    const second = await service.joinAsyncHomeSession('parent', 'user');

    expect([first.id, second.id]).toEqual(['child-1', 'child-1']);
    expect(tx.liveSession.create).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
  });
});
