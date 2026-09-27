import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ClassroomDuelStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ClassroomActor, ClassroomTenantAccessService } from './classroom-tenant-access.service';
import { norm } from '../../common/utils/answer-matching.util';
import { randomInt } from 'crypto';

type DuelQuestion = { id: string; text: string; options: string[]; correctAnswer: string; explanation: string | null; category: string };
const QUESTION_COUNT = 7;
const sourceTypes = ['QUIZ', 'HOME_QUIZ', 'ICFES_SIMULATOR'] as const;

function displayName(enrollment: { student: { firstName: string; lastName: string } }) {
  return `${enrollment.student.firstName} ${enrollment.student.lastName.charAt(0)}.`;
}

function isEligible(metadata: unknown) {
  return !!metadata && typeof metadata === 'object' && !Array.isArray(metadata) && (metadata as Record<string, unknown>).duelEligible === true;
}

function categoryChoices(questions: DuelQuestion[]) {
  const counts = new Map<string, number>();
  for (const question of questions) counts.set(question.category, (counts.get(question.category) ?? 0) + 1);
  return [...counts].filter(([, count]) => count >= QUESTION_COUNT)
    .map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

function randomQuestions(questions: DuelQuestion[]) {
  const shuffled = [...questions];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = randomInt(index + 1);
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled.slice(0, QUESTION_COUNT);
}

@Injectable()
export class DuelService {
  constructor(private readonly prisma: PrismaService, private readonly access: ClassroomTenantAccessService) {}

  private async context(actor: ClassroomActor, classroomId: string) {
    const classroom = await this.access.classroomInScope(actor, classroomId);
    const enrollmentId = await this.access.studentEnrollmentInClassroom(actor, classroom);
    const isTeacher = classroom.teacherAssignment.teacherId === actor.userId;
    if (!enrollmentId && !isTeacher) throw new NotFoundException('Arena no disponible en esta aula');
    return { classroom, enrollmentId, isTeacher };
  }

  private async pool(classroomId: string, institutionId: string): Promise<DuelQuestion[]> {
    const classroom = await this.prisma.classroom.findFirst({ where: { id: classroomId, institutionId }, select: { teacherAssignment: { select: { group: { select: { gradeId: true } } } } } });
    if (!classroom) return [];
    const [activities, bankItems] = await Promise.all([this.prisma.classroomActivity.findMany({
      where: { classroomId, classroom: { institutionId }, isPublished: true, isVisible: true, isRestrictedToAssigned: false, isRouteScoped: false, type: { in: [...sourceTypes] } },
      select: { title: true, metadata: true, questions: { select: { id: true, text: true, options: true, correctAnswer: true, explanation: true, subjectArea: true, type: true, imageUrl: true, contextId: true } } },
    }), this.prisma.questionBankCollection.findMany({
      where: { institutionId, gradeId: classroom.teacherAssignment.group.gradeId, isPublished: true, isActive: true },
      select: { title: true, category: true, subjectArea: true, questions: { where: { isActive: true, type: { in: ['MULTIPLE_CHOICE', 'TRUE_FALSE'] } }, select: { id: true, text: true, options: true, correctAnswer: true, explanation: true } } },
    })]);
    const activityQuestions = activities.filter((activity) => isEligible(activity.metadata)).flatMap((activity) => activity.questions.map((question) => ({ ...question, category: (question.subjectArea?.trim() || activity.title.trim()).slice(0, 80) })))
      .filter((question) => question.type === 'MULTIPLE_CHOICE' || question.type === 'TRUE_FALSE')
      .filter((question) => !question.imageUrl && !question.contextId && !!question.correctAnswer && question.text.trim().length > 0)
      .map((question) => ({
        id: question.id,
        text: question.text,
        options: Array.isArray(question.options) ? question.options.filter((option): option is string => typeof option === 'string' && option.trim().length > 0) : [],
        correctAnswer: question.correctAnswer!,
        explanation: question.explanation,
        category: question.category,
      }))
      .filter((question) => question.options.length >= 2 && new Set(question.options.map(norm)).size === question.options.length && question.options.some((option) => norm(option) === norm(question.correctAnswer)));
    const bankQuestions = bankItems.flatMap((collection) => collection.questions.map((item) => ({
      id: item.id, text: item.text,
      options: Array.isArray(item.options) ? item.options.filter((option): option is string => typeof option === 'string') : [],
      correctAnswer: item.correctAnswer, explanation: item.explanation,
      category: `${collection.subjectArea} · ${collection.category}`.slice(0, 160),
    }))).filter((question) => question.options.length >= 2 && new Set(question.options.map(norm)).size === question.options.length && question.options.some((option) => norm(option) === norm(question.correctAnswer)));
    return [...activityQuestions, ...bankQuestions];
  }

  async dashboard(actor: ClassroomActor, classroomId: string) {
    const { classroom, enrollmentId, isTeacher } = await this.context(actor, classroomId);
    const [questions, activities, group] = await Promise.all([
      this.pool(classroomId, actor.institutionId),
      isTeacher ? this.prisma.classroomActivity.findMany({
        where: { classroomId, isPublished: true, isVisible: true, isRestrictedToAssigned: false, isRouteScoped: false, type: { in: [...sourceTypes] } },
        select: { id: true, title: true, metadata: true, _count: { select: { questions: true } } },
        orderBy: { createdAt: 'desc' },
      }) : Promise.resolve([]),
      this.prisma.group.findFirst({ where: { id: classroom.teacherAssignment.groupId, grade: { institutionId: actor.institutionId } }, select: { grade: { select: { name: true } } } }),
    ]);
    const peers = enrollmentId ? await this.prisma.studentEnrollment.findMany({
      where: { institutionId: actor.institutionId, academicYearId: classroom.teacherAssignment.academicYearId, groupId: classroom.teacherAssignment.groupId, status: 'ACTIVE', id: { not: enrollmentId }, student: { institutionId: actor.institutionId, isActive: true, userId: { not: null } } },
      select: { id: true, student: { select: { firstName: true, lastName: true } } },
      orderBy: { student: { firstName: 'asc' } },
    }) : [];
    const duels = enrollmentId ? await this.prisma.classroomDuel.findMany({
      where: { institutionId: actor.institutionId, classroomId, OR: [{ inviterEnrollmentId: enrollmentId }, { inviteeEnrollmentId: enrollmentId }] },
      include: { inviter: { select: { student: { select: { firstName: true, lastName: true } } } }, invitee: { select: { student: { select: { firstName: true, lastName: true } } } }, answers: { select: { enrollmentId: true, isCorrect: true } } },
      orderBy: { createdAt: 'desc' }, take: 30,
    }) : [];
    return {
      classroomTitle: classroom.title,
      gradeName: group?.grade.name ?? null,
      role: isTeacher ? 'teacher' : 'student',
      questionCount: questions.length,
      categories: categoryChoices(questions),
      minimumQuestions: QUESTION_COUNT,
      sources: activities.map((activity) => ({ id: activity.id, title: activity.title, questionCount: activity._count.questions, enabled: isEligible(activity.metadata) })),
      peers: peers.map((peer) => ({ id: peer.id, name: displayName(peer) })),
      duels: duels.map((duel) => ({
        id: duel.id, status: this.visibleStatus(duel.status, duel.expiresAt), category: duel.category, selectionMode: duel.selectionMode,
        opponent: displayName(duel.inviterEnrollmentId === enrollmentId ? duel.invitee : duel.inviter),
        isInvitee: duel.inviteeEnrollmentId === enrollmentId,
        myProgress: duel.answers.filter((answer) => answer.enrollmentId === enrollmentId).length,
        opponentProgress: duel.answers.filter((answer) => answer.enrollmentId !== enrollmentId).length,
        createdAt: duel.createdAt,
      })),
    };
  }

  async setSource(actor: ClassroomActor, classroomId: string, activityId: string, enabled: boolean) {
    const { classroom } = await this.context(actor, classroomId);
    this.access.assertCanManageClassroom(actor, classroom);
    if (typeof enabled !== 'boolean') throw new BadRequestException('Se requiere enabled');
    const activity = await this.access.activityInScope(actor, activityId);
    if (activity.classroomId !== classroomId || !activity.isPublished || !activity.isVisible || activity.isRestrictedToAssigned || activity.isRouteScoped || !sourceTypes.includes(activity.type as typeof sourceTypes[number])) throw new NotFoundException('Actividad no compatible con Arena');
    const metadata = activity.metadata && typeof activity.metadata === 'object' && !Array.isArray(activity.metadata) ? activity.metadata as Record<string, unknown> : {};
    await this.prisma.classroomActivity.update({ where: { id: activityId }, data: { metadata: { ...metadata, duelEligible: enabled } as Prisma.InputJsonValue } });
    return this.dashboard(actor, classroomId);
  }

  async invite(actor: ClassroomActor, classroomId: string, opponentEnrollmentId: string, choice: { category?: string; selectionMode?: string } = {}) {
    const { classroom, enrollmentId } = await this.context(actor, classroomId);
    if (!enrollmentId) throw new ForbiddenException('Solo un estudiante puede retar');
    if (!opponentEnrollmentId || opponentEnrollmentId === enrollmentId) throw new BadRequestException('Elige a un compañero');
    const opponent = await this.prisma.studentEnrollment.findFirst({
      where: { id: opponentEnrollmentId, institutionId: actor.institutionId, academicYearId: classroom.teacherAssignment.academicYearId, groupId: classroom.teacherAssignment.groupId, status: 'ACTIVE', student: { institutionId: actor.institutionId, isActive: true, userId: { not: null } } },
      select: { id: true },
    });
    if (!opponent) throw new NotFoundException('Compañero no disponible');
    const pool = await this.pool(classroomId, actor.institutionId);
    if (pool.length < QUESTION_COUNT) throw new BadRequestException('El docente debe habilitar al menos 7 preguntas de opción múltiple o verdadero/falso');
    const categories = categoryChoices(pool);
    const selectionMode = choice.selectionMode === 'ROULETTE' ? 'ROULETTE' : 'CHOSEN';
    let category = 'Mixta';
    if (selectionMode === 'ROULETTE') {
      if (categories.length) category = categories[randomInt(categories.length)].name;
    } else if (choice.category && choice.category !== 'Mixta') {
      if (!categories.some((item) => item.name === choice.category)) throw new BadRequestException('Esta categoría necesita al menos 7 preguntas disponibles');
      category = choice.category;
    }
    const questions = randomQuestions(category === 'Mixta' ? pool : pool.filter((question) => question.category === category));
    const pairKey = [enrollmentId, opponentEnrollmentId].sort().join(':');
    const now = new Date();
    await this.prisma.classroomDuel.updateMany({ where: { institutionId: actor.institutionId, classroomId, pairKey, status: { in: ['INVITED', 'ACTIVE'] }, expiresAt: { lt: now } }, data: { status: 'EXPIRED' } });
    const recent = await this.prisma.classroomDuel.count({ where: { institutionId: actor.institutionId, classroomId, inviterEnrollmentId: enrollmentId, createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } } });
    if (recent >= 3) throw new BadRequestException('Ya enviaste 3 retos en las últimas 24 horas');
    try {
      return await this.prisma.classroomDuel.create({ data: {
        institutionId: actor.institutionId, classroomId, inviterEnrollmentId: enrollmentId, inviteeEnrollmentId: opponentEnrollmentId, pairKey, category, selectionMode,
        questions: questions as unknown as Prisma.InputJsonValue,
        expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
      }, select: { id: true, category: true, selectionMode: true } });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Ya existe un duelo abierto con este compañero');
      throw error;
    }
  }

  private visibleStatus(status: ClassroomDuelStatus, expiresAt: Date) {
    return (status === 'INVITED' || status === 'ACTIVE') && expiresAt < new Date() ? 'EXPIRED' : status;
  }

  private async member(actor: ClassroomActor, duelId: string) {
    const duel = await this.prisma.classroomDuel.findFirst({ where: { id: duelId, institutionId: actor.institutionId } });
    if (!duel) throw new NotFoundException('Duelo no encontrado');
    const { enrollmentId } = await this.context(actor, duel.classroomId);
    if (!enrollmentId || (duel.inviterEnrollmentId !== enrollmentId && duel.inviteeEnrollmentId !== enrollmentId)) throw new NotFoundException('Duelo no encontrado');
    if (this.visibleStatus(duel.status, duel.expiresAt) === 'EXPIRED' && duel.status !== 'EXPIRED') {
      await this.prisma.classroomDuel.updateMany({ where: { id: duelId, status: duel.status }, data: { status: 'EXPIRED' } });
      duel.status = 'EXPIRED';
    }
    return { duel, enrollmentId };
  }

  async respond(actor: ClassroomActor, duelId: string, accept: boolean) {
    const { duel, enrollmentId } = await this.member(actor, duelId);
    if (duel.inviteeEnrollmentId !== enrollmentId || duel.status !== 'INVITED') throw new ConflictException('La invitación ya no está pendiente');
    const changed = await this.prisma.classroomDuel.updateMany({ where: { id: duelId, status: 'INVITED' }, data: { status: accept ? 'ACTIVE' : 'DECLINED', acceptedAt: accept ? new Date() : null, expiresAt: accept ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : duel.expiresAt } });
    if (!changed.count) throw new ConflictException('La invitación ya fue respondida');
    return this.get(actor, duelId);
  }

  async get(actor: ClassroomActor, duelId: string) {
    const { duel, enrollmentId } = await this.member(actor, duelId);
    const [answers, powerUse] = await Promise.all([
      this.prisma.classroomDuelAnswer.findMany({ where: { duelId, institutionId: actor.institutionId }, orderBy: { ordinal: 'asc' }, select: { enrollmentId: true, ordinal: true, isCorrect: true } }),
      this.prisma.classroomDuelPowerUse.findUnique({ where: { duelId_enrollmentId: { duelId, enrollmentId } }, select: { ordinal: true, options: true } }),
    ]);
    const mine = answers.filter((answer) => answer.enrollmentId === enrollmentId);
    const theirs = answers.filter((answer) => answer.enrollmentId !== enrollmentId);
    const questions = Array.isArray(duel.questions) ? duel.questions as DuelQuestion[] : [];
    const finished = duel.status === 'COMPLETED';
    const current = duel.status === 'ACTIVE' && mine.length < questions.length ? questions[mine.length] : null;
    const currentOptions = powerUse?.ordinal === mine.length && Array.isArray(powerUse.options) ? powerUse.options.filter((option): option is string => typeof option === 'string') : current?.options;
    return {
      id: duel.id, classroomId: duel.classroomId, status: duel.status, category: duel.category, selectionMode: duel.selectionMode, isInvitee: duel.inviteeEnrollmentId === enrollmentId,
      myProgress: mine.length, opponentProgress: theirs.length, total: questions.length,
      powerAvailable: !powerUse,
      question: current ? { ordinal: mine.length, text: current.text, options: currentOptions, category: current.category, powerApplied: powerUse?.ordinal === mine.length } : null,
      result: finished ? {
        myScore: mine.filter((answer) => answer.isCorrect).length,
        opponentScore: theirs.filter((answer) => answer.isCorrect).length,
        review: questions.map((question, ordinal) => ({ text: question.text, correctAnswer: question.correctAnswer, explanation: question.explanation, myCorrect: mine.find((answer) => answer.ordinal === ordinal)?.isCorrect ?? false })),
      } : null,
    };
  }

  async usePower(actor: ClassroomActor, duelId: string, ordinal: number) {
    const { duel, enrollmentId } = await this.member(actor, duelId);
    if (duel.status !== 'ACTIVE') throw new ConflictException('El duelo no está activo');
    const questions = Array.isArray(duel.questions) ? duel.questions as DuelQuestion[] : [];
    if (!Number.isInteger(ordinal) || ordinal < 0 || ordinal >= questions.length || questions[ordinal].options.length < 3) throw new BadRequestException('El descarte necesita una pregunta con al menos 3 opciones');
    try {
      await this.prisma.$transaction(async (tx) => {
        const current = await tx.classroomDuel.findUnique({ where: { id: duelId }, select: { status: true } });
        if (current?.status !== 'ACTIVE') throw new ConflictException('El duelo no está activo');
        const answered = await tx.classroomDuelAnswer.count({ where: { duelId, enrollmentId } });
        if (answered !== ordinal) throw new ConflictException('El bono solo sirve en la pregunta actual');
        const used = await tx.classroomDuelPowerUse.findUnique({ where: { duelId_enrollmentId: { duelId, enrollmentId } }, select: { id: true } });
        if (used) throw new ConflictException('Ya usaste tu bono en este duelo');
        const question = questions[ordinal];
        const wrong = question.options.filter((option) => norm(option) !== norm(question.correctAnswer));
        const retainedWrong = wrong[randomInt(wrong.length)];
        const kept = question.options.filter((option) => norm(option) === norm(question.correctAnswer) || option === retainedWrong);
        await tx.classroomDuelPowerUse.create({ data: { institutionId: actor.institutionId, duelId, enrollmentId, ordinal, options: kept } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002' || (error as { code?: string }).code === 'P2034') throw new ConflictException('El bono ya se usó. Actualiza la partida.');
      throw error;
    }
    return this.get(actor, duelId);
  }

  async answer(actor: ClassroomActor, duelId: string, ordinal: number, answer: string) {
    const { duel, enrollmentId } = await this.member(actor, duelId);
    if (duel.status !== 'ACTIVE') throw new ConflictException('El duelo no está activo');
    const questions = Array.isArray(duel.questions) ? duel.questions as DuelQuestion[] : [];
    if (!Number.isInteger(ordinal) || ordinal < 0 || ordinal >= questions.length || typeof answer !== 'string' || answer.length > 500) throw new BadRequestException('Respuesta no válida');
    if (!questions[ordinal].options.some((option) => norm(option) === norm(answer))) throw new BadRequestException('Selecciona una opción válida');
    try {
      await this.prisma.$transaction(async (tx) => {
        const current = await tx.classroomDuel.findUnique({ where: { id: duelId }, select: { status: true } });
        if (current?.status !== 'ACTIVE') throw new ConflictException('El duelo no está activo');
        const answered = await tx.classroomDuelAnswer.count({ where: { duelId, enrollmentId } });
        if (answered !== ordinal) throw new ConflictException('Responde la pregunta actual');
        await tx.classroomDuelAnswer.create({ data: { institutionId: actor.institutionId, duelId, enrollmentId, ordinal, answer, isCorrect: norm(answer) === norm(questions[ordinal].correctAnswer) } });
        const total = await tx.classroomDuelAnswer.count({ where: { duelId } });
        if (total === questions.length * 2) await tx.classroomDuel.update({ where: { id: duelId }, data: { status: 'COMPLETED', completedAt: new Date() } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002' || (error as { code?: string }).code === 'P2034') throw new ConflictException('La respuesta ya se registró. Actualiza la partida.');
      throw error;
    }
    return this.get(actor, duelId);
  }
}
