import { QuestionBankService } from './question-bank.service';

const actor = { userId: 'teacher-1', institutionId: 'school-1', roles: ['DOCENTE'], isSuperAdmin: false };
const collection = { title: 'Reto de fracciones', subjectArea: 'Matemáticas', category: 'Fracciones', isPublished: true };
const question = { type: 'MULTIPLE_CHOICE' as const, text: '¿Cuánto es una mitad más una mitad?', options: ['Una unidad', 'Dos unidades', 'Tres unidades'], correctAnswer: 'Una unidad', explanation: 'Dos mitades forman una unidad.' };

function setup() {
  const prisma = {
    group: { findFirst: jest.fn().mockResolvedValue({ grade: { id: 'grade-5', name: 'Quinto' } }) },
    questionBankCollection: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue({ id: 'collection-1', createdById: 'teacher-1' }), create: jest.fn(), update: jest.fn() },
    questionBankItem: { findFirst: jest.fn(), create: jest.fn(), createMany: jest.fn(), update: jest.fn() },
    classroomActivity: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(),
  };
  const access = {
    classroomInScope: jest.fn().mockResolvedValue({ teacherAssignment: { groupId: 'group-1', teacherId: 'teacher-1' } }),
    activityInScope: jest.fn().mockResolvedValue({ id: 'activity-1', classroomId: 'classroom-1', isPublished: false, type: 'QUIZ' }),
    assertCanManageClassroom: jest.fn(),
  };
  return { service: new QuestionBankService(prisma as any, access as any), prisma, access };
}

describe('QuestionBankService', () => {
  it('offers only official banks matching the classroom grade', async () => {
    const { service, prisma } = setup();
    prisma.group.findFirst.mockResolvedValue({ grade: { id: 'grade-6', name: 'Sexto' } });
    const catalogs = await service.officialCatalog(actor, 'classroom-1');
    expect(catalogs.map((item) => item.catalogId)).toEqual(['edusyn-arte-cultura-grade-6-v1', 'edusyn-historia-grade-6-v1', 'edusyn-deportes-grade-6-v1', 'edusyn-ciencia-naturaleza-grade-6-v1']);
    expect(catalogs.every((item) => item.questionCount === 150 && !item.imported)).toBe(true);
  });

  it('imports an official bank into the institution grade and publishes it for Arena', async () => {
    const { service, prisma } = setup();
    prisma.group.findFirst.mockResolvedValue({ grade: { id: 'grade-6', name: 'Sexto' } });
    prisma.questionBankCollection.findFirst.mockResolvedValue(null);
    const tx = {
      questionBankCollection: { create: jest.fn().mockResolvedValue({ id: 'official-copy' }) },
      questionBankItem: { createMany: jest.fn() },
    };
    prisma.$transaction.mockImplementation((callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx));
    await service.importOfficial(actor, 'classroom-1', 'edusyn-deportes-grade-6-v1');
    expect(tx.questionBankCollection.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      institutionId: 'school-1', gradeId: 'grade-6', createdById: 'teacher-1', isPublished: true,
      officialCatalogId: 'edusyn-deportes-grade-6-v1', title: 'Deportes · 6.º',
    }) });
    expect(tx.questionBankItem.createMany).toHaveBeenCalledWith({ data: expect.arrayContaining([expect.objectContaining({ collectionId: 'official-copy' })]) });
    expect(tx.questionBankItem.createMany.mock.calls[0][0].data).toHaveLength(150);
  });


  it('imports the official science bank with all 150 questions', async () => {
    const { service, prisma } = setup();
    prisma.group.findFirst.mockResolvedValue({ grade: { id: 'grade-6', name: 'Sexto' } });
    prisma.questionBankCollection.findFirst.mockResolvedValue(null);
    const tx = {
      questionBankCollection: { create: jest.fn().mockResolvedValue({ id: 'science-copy' }) },
      questionBankItem: { createMany: jest.fn() },
    };
    prisma.$transaction.mockImplementation((callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx));
    await service.importOfficial(actor, 'classroom-1', 'edusyn-ciencia-naturaleza-grade-6-v1');
    expect(tx.questionBankCollection.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      officialCatalogId: 'edusyn-ciencia-naturaleza-grade-6-v1', title: 'Ciencia y naturaleza · 6.º', isPublished: true,
    }) });
    const imported = tx.questionBankItem.createMany.mock.calls[0][0].data;
    expect(imported).toHaveLength(150);
    expect(imported[0].text).toContain('unidad básica');
    expect(imported[149].text).toContain('linterna');
  });

  it('does not expose official grade-six banks to other grades', async () => {
    const { service, prisma } = setup();
    prisma.group.findFirst.mockResolvedValue({ grade: { id: 'grade-7', name: 'Séptimo' } });
    await expect(service.importOfficial(actor, 'classroom-1', 'edusyn-arte-cultura-grade-6-v1')).rejects.toThrow('no disponible para este grado');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('scopes questionnaires to the institution and grade', async () => {
    const { service, prisma } = setup();
    await service.list(actor, 'classroom-1');
    expect(prisma.questionBankCollection.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { institutionId: 'school-1', gradeId: 'grade-5', isActive: true, OR: [{ isPublished: true }, { createdById: 'teacher-1' }] },
    }));
  });

  it('creates a questionnaire independent of a classroom activity', async () => {
    const { service, prisma } = setup();
    await service.createCollection(actor, 'classroom-1', collection);
    expect(prisma.questionBankCollection.create).toHaveBeenCalledWith({ data: expect.objectContaining({ gradeId: 'grade-5', createdById: 'teacher-1', title: 'Reto de fracciones' }) });
  });

  it('rejects a correct answer that is not among the options', async () => {
    const { service, prisma } = setup();
    await expect(service.createQuestion(actor, 'classroom-1', 'collection-1', { ...question, correctAnswer: 'Cuatro unidades' })).rejects.toThrow('La respuesta correcta');
    expect(prisma.questionBankItem.create).not.toHaveBeenCalled();
  });

  it('lets only the questionnaire author add questions', async () => {
    const { service, prisma } = setup();
    prisma.questionBankCollection.findFirst.mockResolvedValue({ id: 'collection-1', createdById: 'teacher-2' });
    await expect(service.createQuestion(actor, 'classroom-1', 'collection-1', question)).rejects.toThrow('Solo el autor');
    expect(prisma.questionBankItem.create).not.toHaveBeenCalled();
  });

  it('copies a grade questionnaire into a draft classroom quiz', async () => {
    const { service, prisma, access } = setup();
    prisma.questionBankCollection.findFirst.mockResolvedValue({ id: 'collection-1', subjectArea: 'Matemáticas', questions: [question] });
    const tx = {
      classroomActivity: { findUnique: jest.fn().mockResolvedValue({ isPublished: false }) },
      activityQuestion: { findFirst: jest.fn().mockResolvedValue({ sortOrder: 2 }), createMany: jest.fn() },
    };
    prisma.$transaction.mockImplementation((callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx));
    await expect(service.copyToActivity(actor, 'classroom-1', 'collection-1', 'activity-1')).resolves.toEqual({ copied: 1, activityId: 'activity-1' });
    expect(access.activityInScope).toHaveBeenCalledWith(actor, 'activity-1');
    expect(tx.activityQuestion.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ activityId: 'activity-1', subjectArea: 'Matemáticas', sortOrder: 3, text: question.text })] });
  });

  it('accepts a 150-question collection for a draft quiz', async () => {
    const { service, prisma } = setup();
    prisma.questionBankCollection.findFirst.mockResolvedValue({ id: 'collection-1', subjectArea: 'Matemáticas', questions: Array(150).fill(question) });
    const tx = {
      classroomActivity: { findUnique: jest.fn().mockResolvedValue({ isPublished: false }) },
      activityQuestion: { findFirst: jest.fn().mockResolvedValue(null), createMany: jest.fn() },
    };
    prisma.$transaction.mockImplementation((callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx));
    await expect(service.copyToActivity(actor, 'classroom-1', 'collection-1', 'activity-1')).resolves.toEqual({ copied: 150, activityId: 'activity-1' });
    const data = tx.activityQuestion.createMany.mock.calls[0][0].data;
    expect(data).toHaveLength(150);
    expect(data[149].sortOrder).toBe(149);
  });

  it('refuses to copy into a published quiz', async () => {
    const { service, prisma, access } = setup();
    prisma.questionBankCollection.findFirst.mockResolvedValue({ id: 'collection-1', subjectArea: 'Matemáticas', questions: [question] });
    access.activityInScope.mockResolvedValue({ id: 'activity-1', classroomId: 'classroom-1', isPublished: true, type: 'QUIZ' });
    await expect(service.copyToActivity(actor, 'classroom-1', 'collection-1', 'activity-1')).rejects.toThrow('borrador');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
