import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ClassroomDuelStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ClassroomActor, ClassroomTenantAccessService } from './classroom-tenant-access.service';
import { norm } from '../../common/utils/answer-matching.util';

type DuelQuestion = { id: string; text: string; options: string[]; correctAnswer: string; explanation: string | null };
const QUESTION_COUNT = 7;
const sourceTypes = ['QUIZ', 'HOME_QUIZ', 'ICFES_SIMULATOR'] as const;

function displayName(enrollment: { student: { firstName: string; lastName: string } }) {
  return `${enrollment.student.firstName} ${enrollment.student.lastName.charAt(0)}.`;
}

function isEligible(metadata: unknown) {
  return !!metadata && typeof metadata === 'object' && !Array.isArray(metadata) && (metadata as Record<string, unknown>).duelEligible === true;
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
    const activities = await this.prisma.classroomActivity.findMany({
      where: { classroomId, classroom: { institutionId }, isPublished: true, isVisible: true, isRestrictedToAssigned: false, isRouteScoped: false, type: { in: [...sourceTypes] } },
      select: { metadata: true, questions: { select: { id: true, text: true, options: true, correctAnswer: true, explanation: true, type: true, imageUrl: true, contextId: true } } },
    });
    return activities.filter((activity) => isEligible(activity.metadata)).flatMap((activity) => activity.questions)
      .filter((question) => question.type === 'MULTIPLE_CHOICE' || question.type === 'TRUE_FALSE')
      .filter((question) => !question.imageUrl && !question.contextId && !!question.correctAnswer && question.text.trim().length > 0)
      .map((question) => ({
        id: question.id,
        text: question.text,
        options: Array.isArray(question.options) ? question.options.filter((option): option is string => typeof option === 'string' && option.trim().length > 0) : [],
        correctAnswer: question.correctAnswer!,
        explanation: question.explanation,
      }))
      .filter((question) => question.options.length >= 2 && question.options.some((option) => norm(option) === norm(question.correctAnswer)));
  }

  async dashboard(actor: ClassroomActor, classroomId: string) {
    const { classroom, enrollmentId, isTeacher } = await this.context(actor, classroomId);
    const [questions, activities] = await Promise.all([
      this.pool(classroomId, actor.institutionId),
      isTeacher ? this.prisma.classroomActivity.findMany({
        where: { classroomId, isPublished: true, isVisible: true, isRestrictedToAssigned: false, isRouteScoped: false, type: { in: [...sourceTypes] } },
        select: { id: true, title: true, metadata: true, _count: { select: { questions: true } } },
        orderBy: { createdAt: 'desc' },
      }) : Promise.resolve([]),
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
      role: isTeacher ? 'teacher' : 'student',
      questionCount: questions.length,
      minimumQuestions: QUESTION_COUNT,
      sources: activities.map((activity) => ({ id: activity.id, title: activity.title, questionCount: activity._count.questions, enabled: isEligible(activity.metadata) })),
      peers: peers.map((peer) => ({ id: peer.id, name: displayName(peer) })),
      duels: duels.map((duel) => ({
        id: duel.id, status: this.visibleStatus(duel.status, duel.expiresAt),
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

  async invite(actor: ClassroomActor, classroomId: string, opponentEnrollmentId: string) {
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
    const questions = [...pool].sort(() => Math.random() - 0.5).slice(0, QUESTION_COUNT);
    const pairKey = [enrollmentId, opponentEnrollmentId].sort().join(':');
    const now = new Date();
    await this.prisma.classroomDuel.updateMany({ where: { institutionId: actor.institutionId, classroomId, pairKey, status: { in: ['INVITED', 'ACTIVE'] }, expiresAt: { lt: now } }, data: { status: 'EXPIRED' } });
    const recent = await this.prisma.classroomDuel.count({ where: { institutionId: actor.institutionId, classroomId, inviterEnrollmentId: enrollmentId, createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } } });
    if (recent >= 3) throw new BadRequestException('Ya enviaste 3 retos en las últimas 24 horas');
    try {
      return await this.prisma.classroomDuel.create({ data: {
        institutionId: actor.institutionId, classroomId, inviterEnrollmentId: enrollmentId, inviteeEnrollmentId: opponentEnrollmentId, pairKey,
        questions: questions as unknown as Prisma.InputJsonValue,
        expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
      }, select: { id: true } });
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
    const answers = await this.prisma.classroomDuelAnswer.findMany({ where: { duelId, institutionId: actor.institutionId }, orderBy: { ordinal: 'asc' }, select: { enrollmentId: true, ordinal: true, isCorrect: true } });
    const mine = answers.filter((answer) => answer.enrollmentId === enrollmentId);
    const theirs = answers.filter((answer) => answer.enrollmentId !== enrollmentId);
    const questions = Array.isArray(duel.questions) ? duel.questions as DuelQuestion[] : [];
    const finished = duel.status === 'COMPLETED';
    return {
      id: duel.id, classroomId: duel.classroomId, status: duel.status, isInvitee: duel.inviteeEnrollmentId === enrollmentId,
      myProgress: mine.length, opponentProgress: theirs.length, total: questions.length,
      question: duel.status === 'ACTIVE' && mine.length < questions.length ? { ordinal: mine.length, text: questions[mine.length].text, options: questions[mine.length].options } : null,
      result: finished ? {
        myScore: mine.filter((answer) => answer.isCorrect).length,
        opponentScore: theirs.filter((answer) => answer.isCorrect).length,
        review: questions.map((question, ordinal) => ({ text: question.text, correctAnswer: question.correctAnswer, explanation: question.explanation, myCorrect: mine.find((answer) => answer.ordinal === ordinal)?.isCorrect ?? false })),
      } : null,
    };
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
