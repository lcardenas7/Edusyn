import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, QuestionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { norm } from '../../common/utils/answer-matching.util';
import { ClassroomActor, ClassroomTenantAccessService } from './classroom-tenant-access.service';

export type BankCollectionInput = { title: string; subjectArea: string; category: string; isPublished: boolean };
export type BankQuestionInput = { type: QuestionType; text: string; options: string[]; correctAnswer: string; explanation?: string | null };

@Injectable()
export class QuestionBankService {
  constructor(private readonly prisma: PrismaService, private readonly access: ClassroomTenantAccessService) {}

  private async gradeContext(actor: ClassroomActor, classroomId: string) {
    const classroom = await this.access.classroomInScope(actor, classroomId);
    this.access.assertCanManageClassroom(actor, classroom);
    const group = await this.prisma.group.findFirst({
      where: { id: classroom.teacherAssignment.groupId, grade: { institutionId: actor.institutionId } },
      select: { grade: { select: { id: true, name: true } } },
    });
    if (!group) throw new NotFoundException('Grado no encontrado');
    return group.grade;
  }

  private validCollection(input: BankCollectionInput) {
    const title = typeof input?.title === 'string' ? input.title.trim() : '';
    const subjectArea = typeof input?.subjectArea === 'string' ? input.subjectArea.trim() : '';
    const category = typeof input?.category === 'string' ? input.category.trim() : '';
    if (title.length < 3 || title.length > 120 || subjectArea.length < 2 || subjectArea.length > 80 || category.length < 2 || category.length > 80) throw new BadRequestException('Revisa el título, la materia y la categoría del cuestionario');
    if (typeof input.isPublished !== 'boolean') throw new BadRequestException('Indica si el cuestionario está publicado');
    return { title, subjectArea, category, isPublished: input.isPublished };
  }

  private validQuestion(input: BankQuestionInput) {
    const text = typeof input?.text === 'string' ? input.text.trim() : '';
    const explanation = typeof input?.explanation === 'string' ? input.explanation.trim() : null;
    if (text.length < 8 || text.length > 2000 || (explanation && explanation.length > 2000)) throw new BadRequestException('Revisa el enunciado y la explicación');
    if (input.type !== 'MULTIPLE_CHOICE' && input.type !== 'TRUE_FALSE') throw new BadRequestException('Por ahora el banco admite opción múltiple y verdadero/falso');
    let options = input.type === 'TRUE_FALSE' ? ['Verdadero', 'Falso'] : input.options;
    if (!Array.isArray(options) || options.length < 2 || options.length > 5 || options.some((item) => typeof item !== 'string' || !item.trim() || item.length > 300)) throw new BadRequestException('Escribe entre 2 y 5 opciones válidas');
    options = options.map((item) => item.trim());
    if (new Set(options.map(norm)).size !== options.length) throw new BadRequestException('Las opciones no pueden repetirse');
    const correctAnswer = typeof input.correctAnswer === 'string' ? input.correctAnswer.trim() : '';
    if (!options.some((option) => norm(option) === norm(correctAnswer))) throw new BadRequestException('La respuesta correcta debe coincidir con una opción');
    return { text, explanation, options, correctAnswer, type: input.type };
  }

  private async editableCollection(actor: ClassroomActor, classroomId: string, collectionId: string) {
    const grade = await this.gradeContext(actor, classroomId);
    const collection = await this.prisma.questionBankCollection.findFirst({
      where: { id: collectionId, institutionId: actor.institutionId, gradeId: grade.id, isActive: true },
      select: { id: true, createdById: true },
    });
    if (!collection) throw new NotFoundException('Cuestionario no encontrado');
    if (collection.createdById !== actor.userId) throw new ForbiddenException('Solo el autor puede editar este cuestionario');
    return collection;
  }

  async list(actor: ClassroomActor, classroomId: string) {
    const grade = await this.gradeContext(actor, classroomId);
    const [collections, targetActivities] = await Promise.all([this.prisma.questionBankCollection.findMany({
      where: { institutionId: actor.institutionId, gradeId: grade.id, isActive: true, OR: [{ isPublished: true }, { createdById: actor.userId }] },
      select: { id: true, title: true, subjectArea: true, category: true, isPublished: true, createdById: true, updatedAt: true, questions: {
        where: { isActive: true }, select: { id: true, type: true, text: true, options: true, correctAnswer: true, explanation: true }, orderBy: { createdAt: 'asc' },
      } },
      orderBy: { updatedAt: 'desc' },
    }), this.prisma.classroomActivity.findMany({
      where: { classroomId, isPublished: false, type: { in: ['QUIZ', 'HOME_QUIZ', 'ICFES_SIMULATOR'] } },
      select: { id: true, title: true, type: true }, orderBy: { updatedAt: 'desc' },
    })]);
    return { grade, collections: collections.map(({ createdById, ...collection }) => ({ ...collection, canEdit: createdById === actor.userId })), targetActivities };
  }

  async createCollection(actor: ClassroomActor, classroomId: string, input: BankCollectionInput) {
    const grade = await this.gradeContext(actor, classroomId);
    await this.prisma.questionBankCollection.create({ data: { institutionId: actor.institutionId, gradeId: grade.id, createdById: actor.userId, ...this.validCollection(input) } });
    return this.list(actor, classroomId);
  }

  async updateCollection(actor: ClassroomActor, classroomId: string, collectionId: string, input: BankCollectionInput) {
    await this.editableCollection(actor, classroomId, collectionId);
    await this.prisma.questionBankCollection.update({ where: { id: collectionId }, data: this.validCollection(input) });
    return this.list(actor, classroomId);
  }

  async createQuestion(actor: ClassroomActor, classroomId: string, collectionId: string, input: BankQuestionInput) {
    await this.editableCollection(actor, classroomId, collectionId);
    const question = this.validQuestion(input);
    await this.prisma.questionBankItem.create({ data: { institutionId: actor.institutionId, collectionId, ...question, options: question.options as Prisma.InputJsonValue } });
    return this.list(actor, classroomId);
  }

  async updateQuestion(actor: ClassroomActor, classroomId: string, collectionId: string, itemId: string, input: BankQuestionInput) {
    await this.editableCollection(actor, classroomId, collectionId);
    const item = await this.prisma.questionBankItem.findFirst({ where: { id: itemId, institutionId: actor.institutionId, collectionId, isActive: true }, select: { id: true } });
    if (!item) throw new NotFoundException('Pregunta no encontrada');
    const question = this.validQuestion(input);
    await this.prisma.questionBankItem.update({ where: { id: itemId }, data: { ...question, options: question.options as Prisma.InputJsonValue } });
    return this.list(actor, classroomId);
  }

  async copyToActivity(actor: ClassroomActor, classroomId: string, collectionId: string, activityId: string) {
    const grade = await this.gradeContext(actor, classroomId);
    const collection = await this.prisma.questionBankCollection.findFirst({
      where: { id: collectionId, institutionId: actor.institutionId, gradeId: grade.id, isActive: true, OR: [{ isPublished: true }, { createdById: actor.userId }] },
      select: { id: true, subjectArea: true, questions: { where: { isActive: true }, select: { type: true, text: true, options: true, correctAnswer: true, explanation: true }, orderBy: { createdAt: 'asc' } } },
    });
    if (!collection) throw new NotFoundException('Cuestionario no encontrado');
    if (collection.questions.length < 1 || collection.questions.length > 100) throw new BadRequestException('El cuestionario debe tener entre 1 y 100 preguntas');
    const activity = await this.access.activityInScope(actor, activityId);
    if (activity.classroomId !== classroomId || activity.isPublished || !['QUIZ', 'HOME_QUIZ', 'ICFES_SIMULATOR'].includes(activity.type)) throw new BadRequestException('Elige un quiz en borrador de esta aula');
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.classroomActivity.findUnique({ where: { id: activityId }, select: { isPublished: true } });
      if (!current || current.isPublished) throw new BadRequestException('El quiz ya fue publicado');
      const last = await tx.activityQuestion.findFirst({ where: { activityId }, select: { sortOrder: true }, orderBy: { sortOrder: 'desc' } });
      let order = (last?.sortOrder ?? -1) + 1;
      for (const question of collection.questions) {
        await tx.activityQuestion.create({ data: {
          activityId, type: question.type, text: question.text, options: question.options as Prisma.InputJsonValue,
          correctAnswer: question.correctAnswer, explanation: question.explanation, subjectArea: collection.subjectArea, sortOrder: order++,
        } });
      }
    });
    return { copied: collection.questions.length, activityId };
  }
}
