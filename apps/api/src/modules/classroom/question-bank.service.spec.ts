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
    expect(catalogs.map((item) => item.catalogId)).toEqual(['edusyn-arte-cultura-grade-6-v1', 'edusyn-historia-grade-6-v1', 'edusyn-deportes-grade-6-v1', 'edusyn-ciencia-naturaleza-grade-6-v1', 'edusyn-geografia-grade-6-v1', 'edusyn-lengua-literatura-grade-6-v1', 'edusyn-matematicas-logica-grade-6-v1', 'edusyn-tecnologia-grade-6-v1']);
    expect(catalogs.every((item) => item.questionCount === 150 && !item.imported)).toBe(true);
  });

  it('offers official banks from the current grade and the two grades below', async () => {
    const { service, prisma } = setup();
    prisma.group.findFirst.mockResolvedValue({ grade: { id: 'grade-8', name: 'Octavo' } });
    const catalogs = await service.officialCatalog(actor, 'classroom-1');
    expect(catalogs.filter((item) => item.grade === 7)).toHaveLength(6);
    expect(catalogs.filter((item) => item.grade === 6)).toHaveLength(8);
    expect(catalogs.some((item) => item.catalogId === 'edusyn-arte-cultura-grade-7-v1')).toBe(true);
    expect(catalogs.some((item) => item.catalogId === 'edusyn-historia-grade-7-v1')).toBe(true);
    expect(catalogs.some((item) => item.catalogId === 'edusyn-deportes-grade-7-v1')).toBe(true);
    expect(catalogs.some((item) => item.catalogId === 'edusyn-ciencia-naturaleza-grade-7-v1')).toBe(true);
    expect(catalogs.some((item) => item.catalogId === 'edusyn-geografia-grade-7-v1')).toBe(true);
    expect(catalogs.some((item) => item.catalogId === 'edusyn-lengua-literatura-grade-7-v1')).toBe(true);
    expect(catalogs.some((item) => item.catalogId === 'edusyn-historia-grade-8-v1')).toBe(true);
    expect(catalogs.some((item) => item.catalogId === 'edusyn-ciencia-naturaleza-grade-6-v1')).toBe(true);
    expect(catalogs.some((item) => item.catalogId === 'edusyn-lengua-literatura-grade-6-v1')).toBe(true);
    expect(catalogs.some((item) => item.catalogId === 'edusyn-matematicas-logica-grade-6-v1')).toBe(true);
    expect(catalogs.some((item) => item.catalogId === 'edusyn-tecnologia-grade-6-v1')).toBe(true);
  });

  it('imports a lower-grade official bank into the current classroom grade', async () => {
    const { service, prisma } = setup();
    prisma.group.findFirst.mockResolvedValue({ grade: { id: 'grade-8', name: 'Octavo' } });
    prisma.questionBankCollection.findFirst.mockResolvedValue(null);
    const tx = {
      questionBankCollection: { create: jest.fn().mockResolvedValue({ id: 'lower-grade-copy' }) },
      questionBankItem: { createMany: jest.fn() },
    };
    prisma.$transaction.mockImplementation((callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx));
    await service.importOfficial(actor, 'classroom-1', 'edusyn-ciencia-naturaleza-grade-6-v1');
    expect(tx.questionBankCollection.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      institutionId: 'school-1', gradeId: 'grade-8', title: 'Ciencia y naturaleza · 6.º', isPublished: true,
    }) });
    expect(tx.questionBankItem.createMany.mock.calls[0][0].data).toHaveLength(150);
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

  it('imports the official seventh-grade science bank with all audited questions', async () => {
    const { service, prisma } = setup();
    prisma.group.findFirst.mockResolvedValue({ grade: { id: 'grade-7', name: 'Séptimo' } });
    prisma.questionBankCollection.findFirst.mockResolvedValue(null);
    const tx = {
      questionBankCollection: { create: jest.fn().mockResolvedValue({ id: 'science-grade-7-copy' }) },
      questionBankItem: { createMany: jest.fn() },
    };
    prisma.$transaction.mockImplementation((callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx));
    await service.importOfficial(actor, 'classroom-1', 'edusyn-ciencia-naturaleza-grade-7-v1');
    expect(tx.questionBankCollection.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      officialCatalogId: 'edusyn-ciencia-naturaleza-grade-7-v1', gradeId: 'grade-7', title: 'Ciencia y naturaleza · 7.º', isPublished: true,
    }) });
    const imported = tx.questionBankItem.createMany.mock.calls[0][0].data;
    expect(imported).toHaveLength(150);
    expect(imported[0].text).toContain('material genético');
    expect(imported[149].text).toContain('especies nativas');
    expect(imported.every((item: { options: string[]; correctAnswer: string }) => item.options.includes(item.correctAnswer))).toBe(true);
  });

  it('imports the official geography bank with its audited 150 questions', async () => {
    const { service, prisma } = setup();
    prisma.group.findFirst.mockResolvedValue({ grade: { id: 'grade-6', name: 'Sexto' } });
    prisma.questionBankCollection.findFirst.mockResolvedValue(null);
    const tx = {
      questionBankCollection: { create: jest.fn().mockResolvedValue({ id: 'geography-copy' }) },
      questionBankItem: { createMany: jest.fn() },
    };
    prisma.$transaction.mockImplementation((callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx));
    await service.importOfficial(actor, 'classroom-1', 'edusyn-geografia-grade-6-v1');
    expect(tx.questionBankCollection.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      officialCatalogId: 'edusyn-geografia-grade-6-v1', title: 'Geografía · 6.º', isPublished: true,
    }) });
    const imported = tx.questionBankItem.createMany.mock.calls[0][0].data;
    expect(imported).toHaveLength(150);
    expect(imported[0].text).toContain('latitud');
    expect(imported[125].text).toContain('bahía');
    expect(imported[36].text).toContain('cuenca hidrográfica');
    expect(imported[36].correctAnswer).toBe('El área que aporta agua a una salida común');
    expect(imported[36].options).toContain(imported[36].correctAnswer);
    expect(imported[149].text).toContain('imágenes satelitales');
  });

  it('imports the official seventh-grade geography bank with all audited questions', async () => {
    const { service, prisma } = setup();
    prisma.group.findFirst.mockResolvedValue({ grade: { id: 'grade-7', name: 'Séptimo' } });
    prisma.questionBankCollection.findFirst.mockResolvedValue(null);
    const tx = {
      questionBankCollection: { create: jest.fn().mockResolvedValue({ id: 'geography-grade-7-copy' }) },
      questionBankItem: { createMany: jest.fn() },
    };
    prisma.$transaction.mockImplementation((callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx));
    await service.importOfficial(actor, 'classroom-1', 'edusyn-geografia-grade-7-v1');
    expect(tx.questionBankCollection.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      officialCatalogId: 'edusyn-geografia-grade-7-v1', gradeId: 'grade-7', title: 'Geografía · 7.º', isPublished: true,
    }) });
    const imported = tx.questionBankItem.createMany.mock.calls[0][0].data;
    expect(imported).toHaveLength(150);
    expect(imported[0].text).toContain('franja estrecha de tierra');
    expect(imported[149].text).toContain('modelo o mapa del territorio');
    expect(imported.every((item: { options: string[]; correctAnswer: string }) => item.options.includes(item.correctAnswer))).toBe(true);
  });

  it('imports the official seventh-grade language and literature bank with all audited questions', async () => {
    const { service, prisma } = setup();
    prisma.group.findFirst.mockResolvedValue({ grade: { id: 'grade-7', name: 'Séptimo' } });
    prisma.questionBankCollection.findFirst.mockResolvedValue(null);
    const tx = {
      questionBankCollection: { create: jest.fn().mockResolvedValue({ id: 'language-grade-7-copy' }) },
      questionBankItem: { createMany: jest.fn() },
    };
    prisma.$transaction.mockImplementation((callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx));
    await service.importOfficial(actor, 'classroom-1', 'edusyn-lengua-literatura-grade-7-v1');
    expect(tx.questionBankCollection.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      officialCatalogId: 'edusyn-lengua-literatura-grade-7-v1', gradeId: 'grade-7', title: 'Lengua y literatura · 7.º', isPublished: true,
    }) });
    const imported = tx.questionBankItem.createMany.mock.calls[0][0].data;
    expect(imported).toHaveLength(150);
    expect(imported[0].text).toContain('noticia');
    expect(imported[149].text).toContain('traducción literal');
    expect(imported.every((item: { options: string[]; correctAnswer: string }) => item.options.includes(item.correctAnswer))).toBe(true);
  });

  it('imports the official sixth-grade language and literature bank with all audited questions', async () => {
    const { service, prisma } = setup();
    prisma.group.findFirst.mockResolvedValue({ grade: { id: 'grade-6', name: 'Sexto' } });
    prisma.questionBankCollection.findFirst.mockResolvedValue(null);
    const tx = {
      questionBankCollection: { create: jest.fn().mockResolvedValue({ id: 'language-copy' }) },
      questionBankItem: { createMany: jest.fn() },
    };
    prisma.$transaction.mockImplementation((callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx));
    await service.importOfficial(actor, 'classroom-1', 'edusyn-lengua-literatura-grade-6-v1');
    expect(tx.questionBankCollection.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      officialCatalogId: 'edusyn-lengua-literatura-grade-6-v1', title: 'Lengua y literatura · 6.º', isPublished: true,
    }) });
    const imported = tx.questionBankItem.createMany.mock.calls[0][0].data;
    expect(imported).toHaveLength(150);
    expect(imported[132].text).toContain('diccionario bilingüe');
    expect(imported[132].correctAnswer).toBe('El equivalente de una palabra en otra lengua');
    expect(imported[132].options).toContain(imported[132].correctAnswer);
    expect(imported[143].correctAnswer).toBe('Verdadero');
  });

  it('imports the official sixth-grade mathematics and logic bank with all audited questions', async () => {
    const { service, prisma } = setup();
    prisma.group.findFirst.mockResolvedValue({ grade: { id: 'grade-6', name: 'Sexto' } });
    prisma.questionBankCollection.findFirst.mockResolvedValue(null);
    const tx = {
      questionBankCollection: { create: jest.fn().mockResolvedValue({ id: 'mathematics-copy' }) },
      questionBankItem: { createMany: jest.fn() },
    };
    prisma.$transaction.mockImplementation((callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx));
    await service.importOfficial(actor, 'classroom-1', 'edusyn-matematicas-logica-grade-6-v1');
    expect(tx.questionBankCollection.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      officialCatalogId: 'edusyn-matematicas-logica-grade-6-v1', title: 'Matemáticas y lógica · 6.º', isPublished: true,
    }) });
    const imported = tx.questionBankItem.createMany.mock.calls[0][0].data;
    expect(imported).toHaveLength(150);
    expect(imported[136].text).toContain('altura');
    expect(imported[136].correctAnswer).toBe('5 cm');
    expect(imported[145].text).toContain('robot');
    expect(imported[145].correctAnswer).toBe('7');
    expect(imported.every((item: { options: string[]; correctAnswer: string }) => item.options.includes(item.correctAnswer))).toBe(true);
  });

  it('imports the official sixth-grade technology bank with all audited questions', async () => {
    const { service, prisma } = setup();
    prisma.group.findFirst.mockResolvedValue({ grade: { id: 'grade-6', name: 'Sexto' } });
    prisma.questionBankCollection.findFirst.mockResolvedValue(null);
    const tx = {
      questionBankCollection: { create: jest.fn().mockResolvedValue({ id: 'technology-copy' }) },
      questionBankItem: { createMany: jest.fn() },
    };
    prisma.$transaction.mockImplementation((callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx));
    await service.importOfficial(actor, 'classroom-1', 'edusyn-tecnologia-grade-6-v1');
    expect(tx.questionBankCollection.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      officialCatalogId: 'edusyn-tecnologia-grade-6-v1', title: 'Tecnología · 6.º', isPublished: true,
    }) });
    const imported = tx.questionBankItem.createMany.mock.calls[0][0].data;
    expect(imported).toHaveLength(150);
    expect(imported[145].text).toContain('tres casillas');
    expect(imported[145].correctAnswer).toContain('ciclo');
    expect(imported[148].correctAnswer).toBe('Falso');
    expect(imported.every((item: { options: string[]; correctAnswer: string }) => item.options.includes(item.correctAnswer))).toBe(true);
  });

  it('imports the seventh-grade art bank with all audited questions', async () => {
    const { service, prisma } = setup();
    prisma.group.findFirst.mockResolvedValue({ grade: { id: 'grade-8', name: 'Octavo' } });
    prisma.questionBankCollection.findFirst.mockResolvedValue(null);
    const tx = {
      questionBankCollection: { create: jest.fn().mockResolvedValue({ id: 'art7-copy' }) },
      questionBankItem: { createMany: jest.fn() },
    };
    prisma.$transaction.mockImplementation((callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx));
    await service.importOfficial(actor, 'classroom-1', 'edusyn-arte-cultura-grade-7-v1');
    expect(tx.questionBankCollection.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      officialCatalogId: 'edusyn-arte-cultura-grade-7-v1', title: 'Arte y cultura · 7.º', isPublished: true,
    }) });
    const imported = tx.questionBankItem.createMany.mock.calls[0][0].data;
    expect(imported).toHaveLength(150);
    expect(imported[0].text).toContain('contorno');
    expect(imported[149].type).toBe('TRUE_FALSE');
    expect(imported.every((item: { options: string[]; correctAnswer: string }) => item.options.includes(item.correctAnswer))).toBe(true);
  });

  it('imports the seventh-grade history bank with all audited questions', async () => {
    const { service, prisma } = setup();
    prisma.group.findFirst.mockResolvedValue({ grade: { id: 'grade-8', name: 'Octavo' } });
    prisma.questionBankCollection.findFirst.mockResolvedValue(null);
    const tx = {
      questionBankCollection: { create: jest.fn().mockResolvedValue({ id: 'history7-copy' }) },
      questionBankItem: { createMany: jest.fn() },
    };
    prisma.$transaction.mockImplementation((callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx));
    await service.importOfficial(actor, 'classroom-1', 'edusyn-historia-grade-7-v1');
    expect(tx.questionBankCollection.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      officialCatalogId: 'edusyn-historia-grade-7-v1', title: 'Historia · 7.º', isPublished: true,
    }) });
    const imported = tx.questionBankItem.createMany.mock.calls[0][0].data;
    expect(imported).toHaveLength(150);
    expect(imported[0].text).toContain('asentamientos permanentes');
    expect(imported[149].type).toBe('MULTIPLE_CHOICE');
    expect(imported.filter((item: { type: string }) => item.type === 'TRUE_FALSE')).toHaveLength(30);
    expect(imported.every((item: { options: string[]; correctAnswer: string }) => item.options.includes(item.correctAnswer))).toBe(true);
  });

  it('imports the eighth-grade history bank with all audited questions', async () => {
    const { service, prisma } = setup();
    prisma.group.findFirst.mockResolvedValue({ grade: { id: 'grade-8', name: 'Octavo' } });
    prisma.questionBankCollection.findFirst.mockResolvedValue(null);
    const tx = {
      questionBankCollection: { create: jest.fn().mockResolvedValue({ id: 'history8-copy' }) },
      questionBankItem: { createMany: jest.fn() },
    };
    prisma.$transaction.mockImplementation((callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx));
    await service.importOfficial(actor, 'classroom-1', 'edusyn-historia-grade-8-v1');
    expect(tx.questionBankCollection.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      officialCatalogId: 'edusyn-historia-grade-8-v1', title: 'Historia · 8.º', isPublished: true,
    }) });
    const imported = tx.questionBankItem.createMany.mock.calls[0][0].data;
    expect(imported).toHaveLength(150);
    expect(imported[0].text).toContain('fuente de energía');
    expect(imported.filter((item: { type: string }) => item.type === 'TRUE_FALSE')).toHaveLength(30);
    expect(imported.every((item: { options: string[]; correctAnswer: string }) => item.options.includes(item.correctAnswer))).toBe(true);
  });

  it('imports the seventh-grade sports bank with all audited questions', async () => {
    const { service, prisma } = setup();
    prisma.group.findFirst.mockResolvedValue({ grade: { id: 'grade-8', name: 'Octavo' } });
    prisma.questionBankCollection.findFirst.mockResolvedValue(null);
    const tx = {
      questionBankCollection: { create: jest.fn().mockResolvedValue({ id: 'sports7-copy' }) },
      questionBankItem: { createMany: jest.fn() },
    };
    prisma.$transaction.mockImplementation((callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx));
    await service.importOfficial(actor, 'classroom-1', 'edusyn-deportes-grade-7-v1');
    expect(tx.questionBankCollection.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      officialCatalogId: 'edusyn-deportes-grade-7-v1', title: 'Deportes · 7.º', isPublished: true,
    }) });
    const imported = tx.questionBankItem.createMany.mock.calls[0][0].data;
    expect(imported).toHaveLength(150);
    expect(imported[0].text).toContain('fútbol');
    expect(imported.filter((item: { type: string }) => item.type === 'TRUE_FALSE')).toHaveLength(30);
    expect(imported.every((item: { options: string[]; correctAnswer: string }) => item.options.includes(item.correctAnswer))).toBe(true);
  });

  it('does not expose banks more than two grades below the classroom', async () => {
    const { service, prisma } = setup();
    prisma.group.findFirst.mockResolvedValue({ grade: { id: 'grade-9', name: 'Noveno' } });
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
