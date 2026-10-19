import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClassroomActor } from '../classroom/classroom-tenant-access.service';
import { norm } from '../../common/utils/answer-matching.util';
import { randomInt } from 'crypto';
import { OFFICIAL_DUEL_BANKS } from '../classroom/official-duel-banks';
import { MathEventPushService } from './math-event-push.service';

type Q = {
  id: string;
  text: string;
  options: string[];
  correctAnswer: string;
  explanation: string | null;
  topic: string | null;
  conceptKey: string;
  difficulty: string;
};
const ROUNDS = 7;
const AVATARS = new Set([
  'star',
  'fox',
  'rocket',
  'tiger',
  'owl',
  'cat',
  'bear',
  'dolphin',
  'dragon',
  'panda',
  'lion',
  'koala',
]);
const gradeOf = (g: { number: number | null; name: string }) =>
  g.number ??
  (
    {
      sexto: 6,
      séptimo: 7,
      septimo: 7,
      octavo: 8,
      noveno: 9,
      décimo: 10,
      decimo: 10,
      undécimo: 11,
      undecimo: 11,
    } as Record<string, number>
  )[g.name.trim().toLocaleLowerCase('es')] ??
  0;
function colombiaDayStart(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return new Date(`${parts}T00:00:00-05:00`);
}
function shuffle<T>(items: T[]) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

@Injectable()
export class MathEventsService {
  constructor(
    private readonly db: PrismaService,
    private readonly push: MathEventPushService,
  ) {}
  private async student(actor: ClassroomActor) {
    const rows = await this.db.studentEnrollment.findMany({
      where: {
        institutionId: actor.institutionId,
        status: 'ACTIVE',
        student: {
          institutionId: actor.institutionId,
          userId: actor.userId,
          isActive: true,
        },
        academicYear: { institutionId: actor.institutionId, status: 'ACTIVE' },
        group: { grade: { institutionId: actor.institutionId } },
      },
      select: {
        id: true,
        groupId: true,
        group: {
          select: {
            name: true,
            grade: { select: { number: true, name: true } },
          },
        },
        student: { select: { firstName: true, lastName: true } },
      },
      take: 3,
    });
    const e = rows.find(
      (x) => gradeOf(x.group.grade) >= 6 && gradeOf(x.group.grade) <= 11,
    );
    if (!e)
      throw new ForbiddenException(
        'Este evento está disponible para estudiantes de sexto a undécimo con matrícula activa.',
      );
    return { ...e, gradeNumber: gradeOf(e.group.grade) };
  }
  private async event(
    eventId: string,
    institutionId: string,
    allowDraft = false,
  ) {
    const e = await this.db.mathEvent.findFirst({
      where: { id: eventId, institutionId },
      include: { questions: true },
    });
    if (!e || (!allowDraft && e.status !== 'PUBLISHED'))
      throw new NotFoundException('Evento no disponible');
    return e;
  }
  private eligible(e: any, grade: number) {
    return Array.isArray(e.eligibleGrades) && e.eligibleGrades.includes(grade);
  }
  private async participant(
    eventId: string,
    enrollmentId: string,
    institutionId: string,
    avatarCode?: string,
  ) {
    return this.db.mathEventParticipant.upsert({
      where: { eventId_enrollmentId: { eventId, enrollmentId } },
      create: {
        institutionId,
        eventId,
        enrollmentId,
        avatarCode: AVATARS.has(avatarCode || '') ? avatarCode! : 'star',
      },
      update: avatarCode && AVATARS.has(avatarCode) ? { avatarCode } : {},
    });
  }
  async active(actor: ClassroomActor) {
    const student = await this.student(actor);
    const now = new Date();
    const list = await this.db.mathEvent.findMany({
      where: {
        institutionId: actor.institutionId,
        status: 'PUBLISHED',
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      orderBy: { endsAt: 'asc' },
      take: 10,
    });
    const eligible = list.filter((e) => this.eligible(e, student.gradeNumber));
    return Promise.all(
      eligible.map(async (e) => {
        const p = await this.participant(e.id, student.id, actor.institutionId);
        return {
          id: e.id,
          title: e.title,
          description: e.description,
          startsAt: e.startsAt,
          endsAt: e.endsAt,
          avatarCode: p.avatarCode,
          dailyMatchLimit: e.dailyMatchLimit,
        };
      }),
    );
  }
  async join(actor: ClassroomActor, eventId: string, avatarCode?: string) {
    const [s, e] = await Promise.all([
      this.student(actor),
      this.event(eventId, actor.institutionId),
    ]);
    const now = new Date();
    if (!this.eligible(e, s.gradeNumber) || now < e.startsAt || now > e.endsAt)
      throw new ForbiddenException(
        'No puedes participar en este evento ahora.',
      );
    const p = await this.participant(
      e.id,
      s.id,
      actor.institutionId,
      avatarCode,
    );
    return { eventId: e.id, avatarCode: p.avatarCode, participantId: p.id };
  }
  async dashboard(actor: ClassroomActor, eventId: string) {
    const s = await this.student(actor);
    const e = await this.event(eventId, actor.institutionId);
    if (!this.eligible(e, s.gradeNumber))
      throw new NotFoundException('Evento no disponible para este grado');
    const p = await this.participant(e.id, s.id, actor.institutionId);
    const now = new Date();
    const day = colombiaDayStart(now);
    await this.db.mathEventDuel.updateMany({
      where: {
        eventId: e.id,
        institutionId: actor.institutionId,
        status: { in: ['INVITED', 'ACTIVE'] },
        expiresAt: { lt: now },
      },
      data: { status: 'EXPIRED' },
    });
    const [roster, duels, used, open] = await Promise.all([
      this.db.mathEventParticipant.findMany({
        where: {
          eventId: e.id,
          institutionId: actor.institutionId,
          enrollment: {
            status: 'ACTIVE',
            academicYear: { status: 'ACTIVE' },
            student: { isActive: true },
            group: { grade: { institutionId: actor.institutionId } },
          },
        },
        include: {
          enrollment: {
            select: {
              student: { select: { firstName: true, lastName: true } },
              group: {
                select: {
                  name: true,
                  grade: { select: { number: true, name: true } },
                },
              },
            },
          },
        },
        take: 2000,
      }),
      this.db.mathEventDuel.findMany({
        where: {
          eventId: e.id,
          institutionId: actor.institutionId,
          OR: [{ inviterEnrollmentId: s.id }, { inviteeEnrollmentId: s.id }],
          status: { in: ['INVITED', 'ACTIVE'] },
        },
        include: {
          inviter: {
            select: {
              student: { select: { firstName: true, lastName: true } },
              group: {
                select: {
                  name: true,
                  grade: { select: { number: true, name: true } },
                },
              },
            },
          },
          invitee: {
            select: {
              student: { select: { firstName: true, lastName: true } },
              group: {
                select: {
                  name: true,
                  grade: { select: { number: true, name: true } },
                },
              },
            },
          },
          answers: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.db.mathEventDuel.count({
        where: {
          eventId: e.id,
          institutionId: actor.institutionId,
          status: { in: ['ACTIVE', 'COMPLETED'] },
          acceptedAt: { gte: day },
          OR: [{ inviterEnrollmentId: s.id }, { inviteeEnrollmentId: s.id }],
        },
      }),
      this.db.mathEventDuel.findMany({
        where: {
          eventId: e.id,
          institutionId: actor.institutionId,
          status: { in: ['INVITED', 'ACTIVE'] },
          expiresAt: { gt: now },
        },
        select: { inviterEnrollmentId: true, inviteeEnrollmentId: true },
      }),
    ]);
    const busy = new Set(
      open.flatMap((d) => [d.inviterEnrollmentId, d.inviteeEnrollmentId]),
    );
    const publicPerson = (x: any) => ({
      id: x.enrollmentId,
      firstName: x.enrollment.student.firstName.trim().split(/\s+/)[0],
      lastName: x.enrollment.student.lastName.trim().split(/\s+/)[0],
      course: x.enrollment.group.name,
      grade: gradeOf(x.enrollment.group.grade),
      avatarCode: x.avatarCode,
      available:
        x.available &&
        !!x.presenceUntil &&
        x.presenceUntil > now &&
        !busy.has(x.enrollmentId),
      inMatch: busy.has(x.enrollmentId),
    });
    return {
      event: {
        id: e.id,
        title: e.title,
        description: e.description,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        gradeNumbers: e.eligibleGrades,
        dailyMatchLimit: e.dailyMatchLimit,
      },
      me: {
        enrollmentId: s.id,
        avatarCode: p.avatarCode,
        firstName: s.student.firstName.trim().split(/\s+/)[0],
        lastName: s.student.lastName.trim().split(/\s+/)[0],
        course: s.group.name,
        grade: s.gradeNumber,
        matchesUsedToday: used,
        matchesRemaining: Math.max(0, e.dailyMatchLimit - used),
      },
      roster: roster
        .filter(
          (x) =>
            x.enrollmentId !== s.id &&
            this.eligible(e, gradeOf(x.enrollment.group.grade)),
        )
        .map(publicPerson),
      duels: duels.map((d) => ({
        id: d.id,
        status: d.status,
        expiresAt: d.expiresAt,
        invitedByMe: d.inviterEnrollmentId === s.id,
        opponent: publicPerson({
          enrollmentId:
            d.inviterEnrollmentId === s.id
              ? d.inviteeEnrollmentId
              : d.inviterEnrollmentId,
          enrollment: d.inviterEnrollmentId === s.id ? d.invitee : d.inviter,
          avatarCode: 'star',
          available: false,
        }),
      })),
    };
  }
  async presence(actor: ClassroomActor, eventId: string, available: boolean) {
    const s = await this.student(actor);
    const e = await this.event(eventId, actor.institutionId);
    if (!this.eligible(e, s.gradeNumber)) throw new ForbiddenException();
    await this.participant(e.id, s.id, actor.institutionId);
    return this.db.mathEventParticipant
      .update({
        where: { eventId_enrollmentId: { eventId: e.id, enrollmentId: s.id } },
        data: {
          available: available === true,
          presenceUntil: available ? new Date(Date.now() + 45000) : null,
        },
      })
      .then((x) => ({
        available: x.available,
        presenceUntil: x.presenceUntil,
      }));
  }
  async avatar(actor: ClassroomActor, eventId: string, avatarCode: string) {
    if (!AVATARS.has(avatarCode))
      throw new BadRequestException('Avatar no disponible');
    const s = await this.student(actor);
    const e = await this.event(eventId, actor.institutionId);
    if (!this.eligible(e, s.gradeNumber)) throw new ForbiddenException();
    return this.participant(e.id, s.id, actor.institutionId, avatarCode).then(
      (p) => ({ avatarCode: p.avatarCode }),
    );
  }
  async pushConfig(actor: ClassroomActor, eventId: string) {
    const [s, e] = await Promise.all([
      this.student(actor),
      this.event(eventId, actor.institutionId),
    ]);
    if (!this.eligible(e, s.gradeNumber)) throw new ForbiddenException();
    return this.push.publicKey();
  }
  async savePushSubscription(
    actor: ClassroomActor,
    eventId: string,
    input: any,
  ) {
    const [s, e] = await Promise.all([
      this.student(actor),
      this.event(eventId, actor.institutionId),
    ]);
    if (!this.eligible(e, s.gradeNumber)) throw new ForbiddenException();
    return this.push.saveSubscription(actor.institutionId, e.id, s.id, input);
  }
  async removePushSubscription(
    actor: ClassroomActor,
    eventId: string,
    endpoint: unknown,
  ) {
    const [s, e] = await Promise.all([
      this.student(actor),
      this.event(eventId, actor.institutionId),
    ]);
    if (!this.eligible(e, s.gradeNumber)) throw new ForbiddenException();
    return this.push.removeSubscription(
      actor.institutionId,
      e.id,
      s.id,
      endpoint,
    );
  }
  private async makeQuestions(e: any, enrollmentIds: string[]) {
    const history = await this.db.mathEventQuestionSeen.findMany({
      where: { eventId: e.id, enrollmentId: { in: enrollmentIds } },
      select: {
        enrollmentId: true,
        questionId: true,
        conceptKey: true,
        lastSeenAt: true,
      },
    });
    const usedIds = new Map<string, Set<string>>(),
      usedConcepts = new Map<string, Set<string>>();
    for (const h of history) {
      if (!usedIds.has(h.enrollmentId)) usedIds.set(h.enrollmentId, new Set());
      usedIds.get(h.enrollmentId)!.add(h.questionId);
      if (!usedConcepts.has(h.enrollmentId))
        usedConcepts.set(h.enrollmentId, new Set());
      usedConcepts.get(h.enrollmentId)!.add(h.conceptKey);
    }
    const qs = e.questions as Q[];
    if (qs.length < ROUNDS)
      throw new BadRequestException(
        'El evento necesita al menos siete preguntas activas.',
      );
    const unseenForBoth = qs.filter((q) =>
      enrollmentIds.every(
        (id) =>
          !usedIds.get(id)?.has(q.id) &&
          !usedConcepts.get(id)?.has(q.conceptKey),
      ),
    );
    const unseenQuestionsForBoth = qs.filter((q) =>
      enrollmentIds.every((id) => !usedIds.get(id)?.has(q.id)),
    );
    const candidates =
      unseenForBoth.length >= ROUNDS
        ? unseenForBoth
        : unseenQuestionsForBoth.length >= ROUNDS
          ? unseenQuestionsForBoth
          : qs;
    // Los dos jugadores reciben exactamente las mismas preguntas y en el mismo orden.
    const sharedQuestions = shuffle(candidates).slice(0, ROUNDS);
    return {
      version: 1,
      inviter: sharedQuestions,
      invitee: sharedQuestions,
    };
  }
  async challenge(
    actor: ClassroomActor,
    eventId: string,
    opponentId: string,
    mode: 'DIRECT' | 'MATCH' = 'DIRECT',
  ) {
    const s = await this.student(actor);
    const e = await this.event(eventId, actor.institutionId);
    const now = new Date();
    if (!this.eligible(e, s.gradeNumber) || now < e.startsAt || now > e.endsAt)
      throw new ForbiddenException('Evento cerrado o no disponible.');
    if (opponentId === s.id)
      throw new BadRequestException('Elige a otro estudiante.');
    const opponent = await this.db.studentEnrollment.findFirst({
      where: {
        id: opponentId,
        institutionId: actor.institutionId,
        status: 'ACTIVE',
        academicYear: { institutionId: actor.institutionId, status: 'ACTIVE' },
        student: {
          institutionId: actor.institutionId,
          isActive: true,
          userId: { not: null },
        },
        group: { grade: { institutionId: actor.institutionId } },
      },
      select: {
        id: true,
        group: { select: { grade: { select: { number: true, name: true } } } },
      },
    });
    if (!opponent || !this.eligible(e, gradeOf(opponent.group.grade)))
      throw new NotFoundException('Participante no disponible.');
    const ids = [s.id, opponent.id].sort();
    const pairKey = ids.join(':');
    await this.db.mathEventDuel.updateMany({
      where: {
        eventId: e.id,
        institutionId: actor.institutionId,
        status: { in: ['INVITED', 'ACTIVE'] },
        expiresAt: { lt: now },
      },
      data: { status: 'EXPIRED' },
    });
    const activeCount = await this.db.mathEventDuel.count({
      where: {
        eventId: e.id,
        institutionId: actor.institutionId,
        status: 'ACTIVE',
        OR: [{ inviterEnrollmentId: s.id }, { inviteeEnrollmentId: s.id }],
      },
    });
    if (activeCount)
      throw new BadRequestException(
        'Termina primero el duelo que ya tienes en curso.',
      );
    const pendingCount = await this.db.mathEventDuel.count({
      where: {
        eventId: e.id,
        institutionId: actor.institutionId,
        inviterEnrollmentId: s.id,
        status: 'INVITED',
        expiresAt: { gt: now },
      },
    });
    if (pendingCount >= 3)
      throw new BadRequestException(
        'Tienes tres retos esperando respuesta. Espera o cancela uno antes de crear otro.',
      );
    const counts = await this.db.mathEventDuel.count({
      where: {
        eventId: e.id,
        institutionId: actor.institutionId,
        status: { in: ['ACTIVE', 'COMPLETED'] },
        acceptedAt: { gte: colombiaDayStart(now) },
        OR: [{ inviterEnrollmentId: s.id }, { inviteeEnrollmentId: s.id }],
      },
    });
    if (counts >= e.dailyMatchLimit)
      throw new BadRequestException(
        'Alcanzaste tus partidas puntuables de hoy.',
      );
    const opponentActive = await this.db.mathEventDuel.count({
      where: {
        eventId: e.id,
        institutionId: actor.institutionId,
        status: 'ACTIVE',
        OR: [
          { inviterEnrollmentId: opponent.id },
          { inviteeEnrollmentId: opponent.id },
        ],
      },
    });
    if (opponentActive)
      throw new BadRequestException(
        'Ese estudiante está en otra partida ahora.',
      );
    const already = await this.db.mathEventDuel.count({
      where: {
        eventId: e.id,
        institutionId: actor.institutionId,
        pairKey,
        status: 'COMPLETED',
        completedAt: { gte: colombiaDayStart(now) },
      },
    });
    if (already)
      throw new BadRequestException(
        'Ya jugaron una partida puntuable entre ustedes hoy; mañana podrán volver a sumar puntos.',
      );
    const existing = await this.db.mathEventDuel.findFirst({
      where: {
        eventId: e.id,
        institutionId: actor.institutionId,
        pairKey,
        status: { in: ['INVITED', 'ACTIVE'] },
        expiresAt: { gt: now },
      },
    });
    if (existing) throw new BadRequestException('Ya tienen un reto abierto.');
    const pair = await this.makeQuestions(e, [s.id, opponent.id]);
    try {
      const created = await this.db.$transaction(
        async (tx) => {
          for (const id of [s.id, opponent.id].sort())
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`math-event:${e.id}:${id}`}))`;
          const day = colombiaDayStart(now);
          const [
            senderUsed,
            senderActive,
            senderPending,
            opponentActive,
            already,
            existing,
          ] = await Promise.all([
            tx.mathEventDuel.count({
              where: {
                eventId: e.id,
                institutionId: actor.institutionId,
                status: { in: ['ACTIVE', 'COMPLETED'] },
                acceptedAt: { gte: day },
                OR: [
                  { inviterEnrollmentId: s.id },
                  { inviteeEnrollmentId: s.id },
                ],
              },
            }),
            tx.mathEventDuel.count({
              where: {
                eventId: e.id,
                institutionId: actor.institutionId,
                status: 'ACTIVE',
                OR: [
                  { inviterEnrollmentId: s.id },
                  { inviteeEnrollmentId: s.id },
                ],
              },
            }),
            tx.mathEventDuel.count({
              where: {
                eventId: e.id,
                institutionId: actor.institutionId,
                inviterEnrollmentId: s.id,
                status: 'INVITED',
                expiresAt: { gt: now },
              },
            }),
            tx.mathEventDuel.count({
              where: {
                eventId: e.id,
                institutionId: actor.institutionId,
                status: 'ACTIVE',
                OR: [
                  { inviterEnrollmentId: opponent.id },
                  { inviteeEnrollmentId: opponent.id },
                ],
              },
            }),
            tx.mathEventDuel.count({
              where: {
                eventId: e.id,
                institutionId: actor.institutionId,
                pairKey,
                status: 'COMPLETED',
                completedAt: { gte: day },
              },
            }),
            tx.mathEventDuel.count({
              where: {
                eventId: e.id,
                institutionId: actor.institutionId,
                pairKey,
                status: { in: ['INVITED', 'ACTIVE'] },
                expiresAt: { gt: now },
              },
            }),
          ]);
          if (senderUsed >= e.dailyMatchLimit)
            throw new BadRequestException(
              'Alcanzaste tus partidas puntuables de hoy.',
            );
          if (senderActive)
            throw new BadRequestException(
              'Termina primero el duelo que ya tienes en curso.',
            );
          if (senderPending >= 3)
            throw new BadRequestException(
              'Tienes tres retos esperando respuesta. Espera o cancela uno antes de crear otro.',
            );
          if (opponentActive)
            throw new BadRequestException(
              'Ese estudiante está en otra partida ahora.',
            );
          if (already)
            throw new BadRequestException(
              'Ya jugaron una partida puntuable entre ustedes hoy; mañana podrán volver a sumar puntos.',
            );
          if (existing)
            throw new BadRequestException('Ya tienen un reto abierto.');
          const duel = await tx.mathEventDuel.create({
            data: {
              institutionId: actor.institutionId,
              eventId: e.id,
              inviterEnrollmentId: s.id,
              inviteeEnrollmentId: opponent.id,
              pairKey,
              mode,
              status: 'INVITED',
              questions: pair as any,
              expiresAt: new Date(
                now.getTime() + (mode === 'MATCH' ? 60 : 24 * 60 * 60) * 1000,
              ),
            },
          });
          for (const [enrollmentId, seq] of [
            [s.id, pair.inviter],
            [opponent.id, pair.invitee],
          ] as const)
            for (const q of seq)
              await tx.mathEventQuestionSeen.upsert({
                where: {
                  eventId_enrollmentId_questionId: {
                    eventId: e.id,
                    enrollmentId,
                    questionId: q.id,
                  },
                },
                create: {
                  institutionId: actor.institutionId,
                  eventId: e.id,
                  enrollmentId,
                  questionId: q.id,
                  conceptKey: q.conceptKey,
                  lastSeenAt: now,
                },
                update: { conceptKey: q.conceptKey, lastSeenAt: now },
              });
          return duel;
        },
        { isolationLevel: 'Serializable' },
      );
      await this.push
        .notifyIncomingDuel(actor.institutionId, e.id, opponent.id)
        .catch(() => undefined);
      return created;
    } catch (err: any) {
      if (err?.code === 'P2002' || err?.code === 'P2034')
        throw new BadRequestException(
          'El reto no pudo reservarse porque hubo otra solicitud al mismo tiempo. Actualiza e inténtalo otra vez.',
        );
      throw err;
    }
  }
  private async member(actor: ClassroomActor, duelId: string) {
    const s = await this.student(actor);
    const d = await this.db.mathEventDuel.findFirst({
      where: { id: duelId, institutionId: actor.institutionId },
      include: { event: true, answers: true },
    });
    if (!d || ![d.inviterEnrollmentId, d.inviteeEnrollmentId].includes(s.id))
      throw new NotFoundException('Reto no encontrado.');
    return { s, d, enrollmentId: s.id };
  }
  async respond(actor: ClassroomActor, duelId: string, accept: boolean) {
    const { s, d } = await this.member(actor, duelId);
    if (d.status !== 'INVITED' || d.inviteeEnrollmentId !== s.id)
      throw new BadRequestException('Este reto ya no espera respuesta.');
    if (d.expiresAt < new Date()) {
      await this.db.mathEventDuel.update({
        where: { id: d.id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('El reto venció.');
    }
    try {
      return await this.db.$transaction(
        async (tx) => {
          for (const id of [
            d.inviterEnrollmentId,
            d.inviteeEnrollmentId,
          ].sort())
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`math-event:${d.eventId}:${id}`}))`;
          if (accept) {
            for (const id of [d.inviterEnrollmentId, d.inviteeEnrollmentId]) {
              const count = await tx.mathEventDuel.count({
                where: {
                  eventId: d.eventId,
                  institutionId: actor.institutionId,
                  status: { in: ['ACTIVE', 'COMPLETED'] },
                  acceptedAt: { gte: colombiaDayStart() },
                  OR: [
                    { inviterEnrollmentId: id },
                    { inviteeEnrollmentId: id },
                  ],
                },
              });
              if (count >= d.event.dailyMatchLimit)
                throw new BadRequestException(
                  'Uno de los participantes alcanzó sus partidas puntuables de hoy.',
                );
              const active = await tx.mathEventDuel.count({
                where: {
                  eventId: d.eventId,
                  institutionId: actor.institutionId,
                  status: 'ACTIVE',
                  OR: [
                    { inviterEnrollmentId: id },
                    { inviteeEnrollmentId: id },
                  ],
                },
              });
              if (active)
                throw new BadRequestException(
                  'Uno de los participantes ya está en otra partida.',
                );
            }
          }
          const updated = await tx.mathEventDuel.updateMany({
            where: { id: d.id, status: 'INVITED', inviteeEnrollmentId: s.id },
            data: {
              status: accept ? 'ACTIVE' : 'DECLINED',
              acceptedAt: accept ? new Date() : null,
              expiresAt: accept
                ? new Date(Date.now() + 48 * 60 * 60 * 1000)
                : d.expiresAt,
            },
          });
          if (!updated.count)
            throw new BadRequestException('Este reto ya fue respondido.');
          return { id: d.id, status: accept ? 'ACTIVE' : 'DECLINED' };
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (err: any) {
      if (err?.code === 'P2034')
        throw new BadRequestException(
          'Otra partida se confirmó al mismo tiempo. Actualiza y vuelve a intentar.',
        );
      throw err;
    }
  }
  async cancelChallenge(actor: ClassroomActor, duelId: string) {
    const { s, d } = await this.member(actor, duelId);
    if (d.status !== 'INVITED' || d.inviterEnrollmentId !== s.id)
      throw new BadRequestException(
        'Solo quien envió el reto puede cancelarlo mientras espera respuesta.',
      );
    const updated = await this.db.mathEventDuel.updateMany({
      where: {
        id: d.id,
        institutionId: actor.institutionId,
        status: 'INVITED',
        inviterEnrollmentId: s.id,
      },
      data: { status: 'DECLINED' },
    });
    if (!updated.count)
      throw new BadRequestException('El reto ya fue respondido.');
    return { id: d.id, status: 'DECLINED' };
  }
  async getDuel(actor: ClassroomActor, duelId: string) {
    const { s, d } = await this.member(actor, duelId);
    if (d.status !== 'ACTIVE' && d.status !== 'COMPLETED')
      throw new BadRequestException(
        'Acepta el reto para ver las preguntas de la partida.',
      );
    const both = d.questions as any;
    const mine = d.inviterEnrollmentId === s.id ? both.inviter : both.invitee;
    const answers = d.answers.filter((a) => a.enrollmentId === s.id);
    const next = answers.length;
    const finished = answers.length >= ROUNDS;
    const allDone = d.answers.length >= ROUNDS * 2;
    return {
      id: d.id,
      status: d.status,
      round: Math.min(next + 1, ROUNDS),
      total: ROUNDS,
      finished,
      allDone,
      questions: mine.map((q: any, i: number) => ({
        id: q.id,
        text: q.text,
        options: q.options,
        topic: q.topic,
        answered: answers.some((a) => a.ordinal === i),
        ...(answers.some((a) => a.ordinal === i)
          ? {
              correctAnswer: q.correctAnswer,
              explanation: q.explanation,
              isCorrect: answers.find((a) => a.ordinal === i)?.isCorrect,
            }
          : {}),
      })),
      myScore: answers.filter((a) => a.isCorrect).length,
      opponentScore: allDone
        ? d.answers
            .filter((a) => a.enrollmentId !== s.id)
            .filter((a) => a.isCorrect).length
        : null,
    };
  }
  async answer(
    actor: ClassroomActor,
    duelId: string,
    ordinal: number,
    answer: string,
  ) {
    const { s, d } = await this.member(actor, duelId);
    if (d.status !== 'ACTIVE' || d.expiresAt < new Date())
      throw new BadRequestException('Este duelo no está activo.');
    if (
      !Number.isInteger(ordinal) ||
      ordinal < 0 ||
      ordinal >= ROUNDS ||
      typeof answer !== 'string' ||
      answer.length > 300
    )
      throw new BadRequestException('Respuesta no válida.');
    const questions = d.questions as any;
    const mine =
      d.inviterEnrollmentId === s.id ? questions.inviter : questions.invitee;
    const q = mine[ordinal] as Q;
    if (!q) throw new BadRequestException('Pregunta no encontrada.');
    const prev = await this.db.mathEventDuelAnswer.findFirst({
      where: { duelId: d.id, enrollmentId: s.id, ordinal },
    });
    if (prev) return { accepted: true, isCorrect: prev.isCorrect };
    const isCorrect = norm(answer) === norm(q.correctAnswer);
    await this.db.$transaction(async (tx) => {
      await tx.mathEventDuelAnswer.create({
        data: {
          institutionId: actor.institutionId,
          duelId: d.id,
          enrollmentId: s.id,
          ordinal,
          answer,
          isCorrect,
        },
      });
      await tx.mathEventQuestionSeen.upsert({
        where: {
          eventId_enrollmentId_questionId: {
            eventId: d.eventId,
            enrollmentId: s.id,
            questionId: q.id,
          },
        },
        create: {
          institutionId: actor.institutionId,
          eventId: d.eventId,
          enrollmentId: s.id,
          questionId: q.id,
          conceptKey: q.conceptKey,
          lastSeenAt: new Date(),
        },
        update: { conceptKey: q.conceptKey, lastSeenAt: new Date() },
      });
      const total = await tx.mathEventDuelAnswer.count({
        where: { duelId: d.id },
      });
      if (total >= ROUNDS * 2)
        await tx.mathEventDuel.updateMany({
          where: { id: d.id, status: 'ACTIVE' },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
    });
    return {
      accepted: true,
      isCorrect,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
    };
  }
  async ranking(
    actor: ClassroomActor,
    eventId: string,
    scope: 'general' | 'grade' | 'course',
  ) {
    const s = await this.student(actor);
    const e = await this.event(eventId, actor.institutionId);
    const duels = await this.db.mathEventDuel.findMany({
      where: {
        eventId: e.id,
        institutionId: actor.institutionId,
        status: 'COMPLETED',
      },
      include: {
        answers: true,
        inviter: {
          select: {
            id: true,
            student: { select: { firstName: true, lastName: true } },
            group: {
              select: {
                name: true,
                grade: { select: { number: true, name: true } },
              },
            },
          },
        },
        invitee: {
          select: {
            id: true,
            student: { select: { firstName: true, lastName: true } },
            group: {
              select: {
                name: true,
                grade: { select: { number: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { completedAt: 'asc' },
      take: 10000,
    });
    const rows = new Map<string, any>();
    for (const d of duels) {
      const sides = [d.inviter, d.invitee].map((en: any) => {
        const a = d.answers.filter((x) => x.enrollmentId === en.id);
        const score = a.filter((x) => x.isCorrect).length;
        return { en, score, answers: a.length };
      });
      for (let i = 0; i < 2; i++) {
        const { en, score, answers } = sides[i],
          opp = sides[1 - i];
        let r = rows.get(en.id);
        if (!r)
          r = {
            id: en.id,
            firstName: en.student.firstName.trim().split(/\s+/)[0],
            lastName: en.student.lastName.trim().split(/\s+/)[0],
            course: en.group.name,
            grade: gradeOf(en.group.grade),
            points: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            correct: 0,
            played: 0,
          };
        if (answers < ROUNDS) continue;
        r.played++;
        r.correct += score;
        r.points += score * 10;
        if (score > opp.score) {
          r.points += 5;
          r.wins++;
        } else if (score === opp.score) {
          r.points += 2;
          r.draws++;
        } else r.losses++;
        rows.set(en.id, r);
      }
    }
    let result = [...rows.values()];
    if (scope === 'grade')
      result = result.filter((x) => x.grade === s.gradeNumber);
    if (scope === 'course')
      result = result.filter(
        (x) => x.course === s.group.name && x.grade === s.gradeNumber,
      );
    result.sort(
      (a, b) =>
        b.points - a.points ||
        b.correct - a.correct ||
        a.firstName.localeCompare(b.firstName, 'es'),
    );
    const mine = result.find((x) => x.id === s.id);
    return {
      scope,
      rows: result
        .slice(0, 100)
        .map((x, i) => ({ ...x, rank: i + 1, isMe: x.id === s.id })),
      myRank: mine ? result.indexOf(mine) + 1 : null,
      total: result.length,
    };
  }
  async createEvent(actor: ClassroomActor, input: any) {
    const title = typeof input?.title === 'string' ? input.title.trim() : '';
    const startsAt = new Date(input?.startsAt);
    const endsAt = new Date(input?.endsAt);
    const eligible = Array.isArray(input?.eligibleGrades)
      ? [
          ...new Set(
            input.eligibleGrades.filter(
              (x: any) => Number.isInteger(x) && x >= 6 && x <= 11,
            ),
          ),
        ].sort((a: number, b: number) => a - b)
      : [6, 7, 8, 9, 10, 11];
    if (
      title.length < 4 ||
      title.length > 100 ||
      !Number.isFinite(startsAt.getTime()) ||
      !Number.isFinite(endsAt.getTime()) ||
      startsAt >= endsAt ||
      !eligible.length
    )
      throw new BadRequestException(
        'Revisa el nombre, fechas y grados participantes.',
      );
    const limit = Number.isInteger(input.dailyMatchLimit)
      ? Math.max(1, Math.min(25, input.dailyMatchLimit))
      : 25;
    return this.db.mathEvent.create({
      data: {
        institutionId: actor.institutionId,
        title,
        description:
          typeof input.description === 'string'
            ? input.description.trim().slice(0, 1000)
            : null,
        startsAt,
        endsAt,
        eligibleGrades: eligible as any,
        dailyMatchLimit: limit,
        createdById: actor.userId,
      },
    });
  }
  async listMathBanks(actor: ClassroomActor) {
    const rows = await this.db.questionBankCollection.findMany({
      where: {
        institutionId: actor.institutionId,
        isActive: true,
        isPublished: true,
        grade: {
          institutionId: actor.institutionId,
          number: { gte: 6, lte: 11 },
        },
      },
      include: {
        grade: { select: { name: true, number: true } },
        _count: { select: { questions: true } },
      },
      orderBy: [{ grade: { number: 'asc' } }, { title: 'asc' }],
    });
    return rows
      .filter((x) =>
        /matem[aá]ticas|l[oó]gica/i.test(
          `${x.category} ${x.subjectArea} ${x.title}`,
        ),
      )
      .map((x) => ({
        id: x.id,
        title: x.title,
        category: x.category,
        grade: x.grade.number || x.grade.name,
        questionCount: x._count.questions,
      }));
  }
  async importBanks(
    actor: ClassroomActor,
    eventId: string,
    collectionIds: unknown,
  ) {
    const e = await this.event(eventId, actor.institutionId, true);
    if (e.status !== 'DRAFT')
      throw new BadRequestException(
        'El banco se edita mientras el evento es borrador.',
      );
    if (
      !Array.isArray(collectionIds) ||
      collectionIds.length < 1 ||
      collectionIds.length > 20 ||
      collectionIds.some((x) => typeof x !== 'string')
    )
      throw new BadRequestException(
        'Selecciona entre uno y veinte bancos de Matemáticas.',
      );
    const ids = collectionIds as string[];
    const collections = await this.db.questionBankCollection.findMany({
      where: {
        id: { in: ids },
        institutionId: actor.institutionId,
        isActive: true,
        isPublished: true,
        grade: {
          institutionId: actor.institutionId,
          number: { gte: 6, lte: 11 },
        },
      },
      include: {
        grade: { select: { number: true } },
        questions: {
          where: {
            isActive: true,
            type: { in: ['MULTIPLE_CHOICE', 'TRUE_FALSE'] },
          },
          select: {
            id: true,
            type: true,
            text: true,
            options: true,
            correctAnswer: true,
            explanation: true,
          },
        },
      },
    });
    if (
      collections.length !== new Set(collectionIds).size ||
      collections.some(
        (c) =>
          !/matem[aá]ticas|l[oó]gica/i.test(
            `${c.category} ${c.subjectArea} ${c.title}`,
          ),
      )
    )
      throw new ForbiddenException(
        'Uno de los bancos no es un banco institucional publicado de Matemáticas.',
      );
    const catalogById = new Map(
      OFFICIAL_DUEL_BANKS.map((c) => [c.catalogId, c]),
    );
    const existingTexts = new Set(
      (
        await this.db.mathEventQuestion.findMany({
          where: { eventId: e.id },
          select: { text: true },
        })
      ).map((x) => norm(x.text)),
    );
    const data: any[] = [];
    for (const collection of collections) {
      const catalog = collection.officialCatalogId
        ? catalogById.get(collection.officialCatalogId)
        : null;
      const byText = new Map(
        (catalog?.questions || []).map((q) => [norm(q.text), q]),
      );
      for (const item of collection.questions) {
        const opts = Array.isArray(item.options)
          ? item.options.filter(
              (x): x is string => typeof x === 'string' && Boolean(x.trim()),
            )
          : [];
        const correct = opts.find((x) => norm(x) === norm(item.correctAnswer));
        if (opts.length < 2 || !correct || !item.text.trim()) continue;
        const fingerprint = norm(item.text);
        if (existingTexts.has(fingerprint)) continue;
        existingTexts.add(fingerprint);
        const source = byText.get(fingerprint);
        const conceptKey = String(
          source?.concept ||
            fingerprint.replace(/[^a-z0-9]+/g, '_').slice(0, 100),
        );
        data.push({
          institutionId: actor.institutionId,
          eventId: e.id,
          sourceItemId: item.id,
          code: source
            ? `${collection.officialCatalogId}:${source.id}`
            : item.id,
          type: item.type,
          text: item.text.trim(),
          options: opts,
          correctAnswer: correct,
          explanation: item.explanation,
          topic: source?.topic || collection.category,
          conceptKey,
          difficulty: source?.difficulty || 'INTERMEDIATE',
        });
      }
    }
    if (data.length)
      await this.db.mathEventQuestion.createMany({
        data,
        skipDuplicates: true,
      });
    return {
      added: data.length,
      questionCount: await this.db.mathEventQuestion.count({
        where: { eventId: e.id, institutionId: actor.institutionId },
      }),
    };
  }
  async publish(actor: ClassroomActor, eventId: string) {
    const e = await this.event(eventId, actor.institutionId, true);
    const count = await this.db.mathEventQuestion.count({
      where: { eventId: e.id, institutionId: actor.institutionId },
    });
    if (e.status !== 'DRAFT' || count < ROUNDS || e.endsAt <= new Date())
      throw new BadRequestException(
        'Para publicar, el evento debe ser borrador, futuro y contar con al menos siete preguntas.',
      );
    return this.db.mathEvent.update({
      where: { id: e.id },
      data: { status: 'PUBLISHED' },
    });
  }
  async matchmake(actor: ClassroomActor, eventId: string) {
    const d = await this.dashboard(actor, eventId);
    const rival = d.roster.filter((x) => x.available);
    if (!rival.length)
      throw new BadRequestException(
        'No hay estudiantes esperando ahora. Puedes dejar un reto para después.',
      );
    const pick = rival[randomInt(rival.length)];
    return this.challenge(actor, eventId, pick.id, 'MATCH');
  }
}
