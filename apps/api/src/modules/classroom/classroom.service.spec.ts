import { ClassroomService } from './classroom.service';

describe('ClassroomService activity duplication', () => {
  function makeService() {
    const prisma = {
      questionContext: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'context-source', title: 'Lectura', text: 'Texto', imageUrl: null, viewPolicy: 'BEFORE', sortOrder: 1 },
        ]),
        create: jest.fn().mockResolvedValue({ id: 'context-target' }),
      },
      activityQuestion: {
        findMany: jest.fn().mockResolvedValue([
          {
            contextId: 'context-source', type: 'SHORT_ANSWER', text: 'Pregunta', imageUrl: null,
            options: [], correctAnswer: 'Respuesta', points: 10, explanation: null,
            wrongExplanations: { wrong: 'Revisa' }, subjectArea: 'AREA', competency: 'COMP',
            sortOrder: 1, timeLimitSeconds: 30,
          },
        ]),
        create: jest.fn().mockResolvedValue({ id: 'question-target' }),
      },
      lesson: {
        findUnique: jest.fn().mockResolvedValue({
          title: 'Lección', description: 'Descripción', coverImage: null, badgeEmoji: '⭐',
          badgeTitle: 'Insignia', badgeColor: '#ffffff', estimatedMinutes: 15, playMode: 'SEQUENTIAL',
          slides: [{ type: 'TEXT', sortOrder: 1, title: 'Slide', body: 'Contenido', imageUrl: null, videoUrl: null, audioUrl: null, layout: 'DEFAULT', activityData: null, blocks: null, badgeEmoji: null, badgeTitle: null }],
        }),
        create: jest.fn().mockResolvedValue({ id: 'lesson-target' }),
      },
    };
    return { prisma, service: new ClassroomService(prisma as any, {} as any, {} as any, {} as any) };
  }

  it('copies contexts, relinks questions and copies lesson slides without progress', async () => {
    const { prisma, service } = makeService();

    const result = await (service as any).cloneActivityContent('activity-source', 'activity-target');

    expect(prisma.questionContext.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ activityId: 'activity-target', title: 'Lectura' }),
    }));
    expect(prisma.activityQuestion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ activityId: 'activity-target', contextId: 'context-target', competency: 'COMP' }),
    }));
    expect(prisma.lesson.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ activityId: 'activity-target', slides: expect.any(Object) }),
    }));
    expect(result).toEqual({ contextsCopied: 1, questionsCopied: 1, lessonCopied: true });
  });

  it('copies activities without a lesson without trying to create one', async () => {
    const { prisma, service } = makeService();
    prisma.lesson.findUnique.mockResolvedValue(null);

    const result = await (service as any).cloneActivityContent('activity-source', 'activity-target');

    expect(prisma.lesson.create).not.toHaveBeenCalled();
    expect(result.lessonCopied).toBe(false);
  });
});
