import { QuestionBankService } from './question-bank.service';

const actor = { userId: 'teacher-1', institutionId: 'school-1', roles: ['DOCENTE'], isSuperAdmin: false };
const collection = { title: 'Reto de fracciones', subjectArea: 'Matemáticas', category: 'Fracciones', isPublished: true };
const question = { type: 'MULTIPLE_CHOICE' as const, text: '¿Cuánto es una mitad más una mitad?', options: ['Una unidad', 'Dos unidades', 'Tres unidades'], correctAnswer: 'Una unidad', explanation: 'Dos mitades forman una unidad.' };

function setup() {
  const prisma = {
    group: { findFirst: jest.fn().mockResolvedValue({ grade: { id: 'grade-5', name: 'Quinto' } }) },
    questionBankCollection: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue({ id: 'collection-1', createdById: 'teacher-1' }), create: jest.fn(), update: jest.fn() },
    questionBankItem: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  };
  const access = {
    classroomInScope: jest.fn().mockResolvedValue({ teacherAssignment: { groupId: 'group-1', teacherId: 'teacher-1' } }),
    assertCanManageClassroom: jest.fn(),
  };
  return { service: new QuestionBankService(prisma as any, access as any), prisma };
}

describe('QuestionBankService', () => {
  it('scopes questionnaires to the institution and grade', async () => {
    const { service, prisma } = setup();
    await service.list(actor, 'classroom-1');
    expect(prisma.questionBankCollection.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { institutionId: 'school-1', gradeId: 'grade-5', isActive: true },
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
});
