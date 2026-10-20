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
import { gunzipSync } from 'zlib';
import { OFFICIAL_DUEL_BANKS } from '../classroom/official-duel-banks';
import { MathEventPushService } from './math-event-push.service';
import { EDITORIAL_QUESTION_CATALOG_GZIP_BASE64 } from './editorial-question-catalog';

type Q = {
  id: string;
  text: string;
  options: string[];
  correctAnswer: string;
  explanation: string | null;
  topic: string | null;
  conceptKey: string;
  difficulty: string;
  grade?: number | null;
};
type EditorialQuestion = Omit<Q, 'id'> & {
  code: string;
  grade: number;
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE';
  timeLimitSeconds: number;
};
const EDITORIAL_CATALOG = JSON.parse(
  gunzipSync(Buffer.from(EDITORIAL_QUESTION_CATALOG_GZIP_BASE64, 'base64')).toString('utf8'),
) as { questions: EditorialQuestion[]; questionCount: number };
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
  private canCoordinateEvent(actor: ClassroomActor) {
    return actor.isSuperAdmin || actor.roles.some(role => ['COORDINADOR', 'RECTOR', 'ADMIN_INSTITUTIONAL'].includes(role));
  }
  private async assertEventManager(actor: ClassroomActor, eventId: string) {
    const event = await this.db.mathEvent.findFirst({
      where: { id: eventId, institutionId: actor.institutionId },
      select: { id: true, createdById: true },
    });
    if (!event) throw new NotFoundException('Evento no disponible.');
    if (!this.canCoordinateEvent(actor) && event.createdById !== actor.userId)
      throw new ForbiddenException('Solo quien organizó este evento o coordinación puede modificarlo.');
    return event;
  }
  private async student(actor: ClassroomActor) {
    const rows = await this.db.studentEnrollment.findMany({
      where: {
        institutionId: actor.institutionId,
        status: 'ACTIVE',
        student: {
          institutionId: actor.institutionId,
          userId: actor.userId,
          user: { isActive: true, institutionUsers: { some: { institutionId: actor.institutionId, isActive: true } } },
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
    allowClosed = false,
  ) {
    const e = await this.db.mathEvent.findFirst({
      where: { id: eventId, institutionId },
      include: { questions: true },
    });
    if (!e || (!allowDraft && e.status !== 'PUBLISHED' && !(allowClosed && e.status === 'CLOSED')))
      throw new NotFoundException('Evento no disponible');
    return e;
  }
  private eligible(e: any, grade: number) {
    return Array.isArray(e.eligibleGrades) && e.eligibleGrades.includes(grade);
  }
  private async unfinishedActiveCount(db: any, eventId: string, institutionId: string, enrollmentId: string) {
    const duels = await db.mathEventDuel.findMany({
      where: { eventId, institutionId, status: 'ACTIVE', expiresAt: { gt: new Date() },
        OR: [{ inviterEnrollmentId: enrollmentId }, { inviteeEnrollmentId: enrollmentId }] },
      select: { _count: { select: { answers: { where: { enrollmentId } } } } },
    });
    return duels.filter((d: any) => d._count.answers < ROUNDS).length;
  }
  private async lockedDuel<T>(institutionId: string, duelId: string, action: (tx: any, duel: any) => Promise<T>): Promise<T> {
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "MathEventDuel" WHERE id = ${duelId} AND "institutionId" = ${institutionId} FOR UPDATE`;
      const duel = await tx.mathEventDuel.findFirst({ where: { id: duelId, institutionId }, include: { event: true, answers: true } });
      if (!duel) throw new NotFoundException('Reto no encontrado.');
      return action(tx, duel);
    }, { timeout: 15000 });
  }
  private async fillUnanswered(tx: any, duel: any, enrollmentIds: string[]) {
    const rows = enrollmentIds.flatMap(enrollmentId => Array.from({ length: ROUNDS }, (_, ordinal) => ({
      institutionId: duel.institutionId, duelId: duel.id, enrollmentId, ordinal, answer: '', isCorrect: false,
    })).filter(row => !duel.answers.some((a: any) => a.enrollmentId === enrollmentId && a.ordinal === row.ordinal)));
    if (rows.length) await tx.mathEventDuelAnswer.createMany({ data: rows, skipDuplicates: true });
    const total = await tx.mathEventDuelAnswer.count({ where: { duelId: duel.id } });
    if (total >= ROUNDS * 2) await tx.mathEventDuel.updateMany({ where: { id: duel.id, institutionId: duel.institutionId, status: 'ACTIVE' }, data: { status: 'COMPLETED', completedAt: new Date() } });
  }
  private async reconcileDuels(institutionId: string, filter: { eventId?: string; enrollmentIds?: string[]; duelId?: string }) {
    const now = new Date();
    const rows = await this.db.mathEventDuel.findMany({
      where: { institutionId, status: 'ACTIVE', ...(filter.eventId ? { eventId: filter.eventId } : {}),
        ...(filter.duelId ? { id: filter.duelId } : {}),
        ...(filter.enrollmentIds ? { OR: filter.enrollmentIds.flatMap(id => [{ inviterEnrollmentId: id }, { inviteeEnrollmentId: id }]) } : {}),
      },
      select: { id: true, acceptedAt: true, expiresAt: true, answers: { select: { createdAt: true } } },
      orderBy: { expiresAt: 'asc' }, take: 200,
    });
    for (const row of rows) {
      const lastActivity = Math.max(row.acceptedAt?.getTime() ?? now.getTime(), ...row.answers.map(a => a.createdAt.getTime()));
      if (row.answers.length < ROUNDS * 2 && row.expiresAt > now && now.getTime() - lastActivity < 10 * 60 * 1000) continue;
      await this.lockedDuel(institutionId, row.id, async (tx, duel) => {
        if (duel.status !== 'ACTIVE') return;
        const last = Math.max(duel.acceptedAt?.getTime() ?? now.getTime(), ...duel.answers.map((a: any) => a.createdAt.getTime()));
        const complete = duel.answers.length >= ROUNDS * 2;
        const stale = duel.expiresAt <= now || now.getTime() - last >= 10 * 60 * 1000;
        if (!complete && (!stale || duel.event.endsAt < now || duel.event.status === 'CLOSED')) return;
        if (!complete) await tx.mathEventDuel.update({ where: { id: duel.id }, data: { questions: { ...(duel.questions as any), closureReason: 'INACTIVITY' } } });
        await this.fillUnanswered(tx, duel, [duel.inviterEnrollmentId, duel.inviteeEnrollmentId]);
      });
    }
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
  async history(actor: ClassroomActor) {
    const student = await this.student(actor);
    const rows = await this.db.mathEvent.findMany({
      where: {
        institutionId: actor.institutionId,
        status: { in: ['PUBLISHED', 'CLOSED'] },
        endsAt: { lt: new Date() },
      },
      select: { id: true, title: true, description: true, startsAt: true, endsAt: true, eligibleGrades: true },
      orderBy: { endsAt: 'desc' },
      take: 30,
    });
    return rows.filter((event) => this.eligible(event, student.gradeNumber));
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
    const e = await this.event(eventId, actor.institutionId, false, true);
    if (!this.eligible(e, s.gradeNumber))
      throw new NotFoundException('Evento no disponible para este grado');
    const now = new Date();
    await this.reconcileDuels(actor.institutionId, { eventId: e.id, enrollmentIds: [s.id] });
    const p = e.endsAt < now || e.status === 'CLOSED'
      ? await this.db.mathEventParticipant.findUnique({ where: { eventId_enrollmentId: { eventId: e.id, enrollmentId: s.id } } })
      : await this.participant(e.id, s.id, actor.institutionId);
    const day = colombiaDayStart(now);
    await this.db.mathEventDuel.updateMany({
      where: {
        eventId: e.id,
        institutionId: actor.institutionId,
        status: 'INVITED',
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
            student: { institutionId: actor.institutionId, user: { isActive: true, institutionUsers: { some: { institutionId: actor.institutionId, isActive: true } } } },
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
          status: { in: ['INVITED', 'ACTIVE', 'COMPLETED'] },
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
        select: { inviterEnrollmentId: true, inviteeEnrollmentId: true, status: true, answers: { select: { enrollmentId: true } } },
      }),
    ]);
    const busy = new Set(
      open.filter(d => d.status === 'ACTIVE').flatMap(d => [d.inviterEnrollmentId, d.inviteeEnrollmentId].filter(id => d.answers.filter(a => a.enrollmentId === id).length < ROUNDS)),
    );
    const pending = new Set(open.filter(d => d.status === 'INVITED').flatMap(d => [d.inviterEnrollmentId, d.inviteeEnrollmentId]));
    const dailyPairs = await this.db.mathEventDuel.groupBy({ by: ['pairKey'], where: {
      institutionId: actor.institutionId, eventId: e.id, status: { in: ['ACTIVE', 'COMPLETED'] }, acceptedAt: { gte: day },
      OR: [{ inviterEnrollmentId: s.id }, { inviteeEnrollmentId: s.id }],
    }, _count: { _all: true } });
    const pairCounts = new Map(dailyPairs.map(row => [row.pairKey, row._count._all]));
    const publicPerson = (x: any) => ({
      id: x.enrollmentId,
      firstName: x.enrollment.student.firstName.trim().split(/\s+/)[0],
      lastName: x.enrollment.student.lastName.trim().split(/\s+/)[0],
      course: x.enrollment.group.name,
      grade: gradeOf(x.enrollment.group.grade),
      avatarCode: x.avatarCode,
      online: !!x.presenceUntil && x.presenceUntil > now,
      available:
        x.available &&
        !!x.presenceUntil &&
        x.presenceUntil > now &&
        !busy.has(x.enrollmentId),
      inMatch: busy.has(x.enrollmentId),
      hasPendingInvite: pending.has(x.enrollmentId),
      hasOpenDuelWithMe: open.some(d => [d.inviterEnrollmentId, d.inviteeEnrollmentId].includes(s.id) && [d.inviterEnrollmentId, d.inviteeEnrollmentId].includes(x.enrollmentId)),
      matchesWithMeToday: pairCounts.get([s.id, x.enrollmentId].sort().join(':')) ?? 0,
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
        showCorrectAnswers: e.showCorrectAnswers,
        showExplanations: e.showExplanations,
      },
      me: {
        enrollmentId: s.id,
        avatarCode: p?.avatarCode || 'star',
        firstName: s.student.firstName.trim().split(/\s+/)[0],
        lastName: s.student.lastName.trim().split(/\s+/)[0],
        course: s.group.name,
        grade: s.gradeNumber,
        matchesUsedToday: used,
        matchesRemaining: Math.max(0, e.dailyMatchLimit - used),
        hasUnfinishedDuel: busy.has(s.id),
      },
      roster: roster
        .filter(
          (x) =>
            x.enrollmentId !== s.id &&
            this.eligible(e, gradeOf(x.enrollment.group.grade)),
        )
        .map(publicPerson),
      duels: duels.map((d) => {
        const opponentId = d.inviterEnrollmentId === s.id ? d.inviteeEnrollmentId : d.inviterEnrollmentId;
        const myBusy = busy.has(s.id), opponentBusy = busy.has(opponentId);
        const inWindow = e.startsAt <= now && e.endsAt >= now && d.expiresAt > now;
        return {
        id: d.id,
        status: d.status,
        myFinished: d.answers.filter(a => a.enrollmentId === s.id).length >= ROUNDS,
        expiresAt: d.expiresAt,
        invitedByMe: d.inviterEnrollmentId === s.id,
        canAccept: d.status === 'INVITED' && d.inviteeEnrollmentId === s.id && !myBusy && !opponentBusy && inWindow,
        waitingReason: !inWindow ? 'CLOSED' : myBusy ? 'YOU_PLAYING' : opponentBusy ? 'OPPONENT_PLAYING' : null,
        invitationMessage: !inWindow
          ? 'Este reto ya no se puede aceptar: revisa la fecha del evento o su vencimiento.'
          : myBusy ? 'Tienes otro duelo en curso. Este reto sigue pendiente y podrá comenzar cuando ese duelo termine.'
          : opponentBusy ? 'Tu compañero está jugando otro duelo. El reto sigue pendiente; espera a que termine.'
          : d.inviteeEnrollmentId === s.id ? 'Ambos están libres. Puedes aceptar este reto.'
          : 'Esperando a que tu compañero acepte. El reto sigue pendiente.',
        opponent: publicPerson({
          enrollmentId:
            d.inviterEnrollmentId === s.id
              ? d.inviteeEnrollmentId
              : d.inviterEnrollmentId,
          enrollment: d.inviterEnrollmentId === s.id ? d.invitee : d.inviter,
          avatarCode: 'star',
          available: false,
        }),
      }; }),
    };
  }
  async presence(actor: ClassroomActor, eventId: string, available: boolean, online = true) {
    const s = await this.student(actor);
    const e = await this.event(eventId, actor.institutionId);
    if (!this.eligible(e, s.gradeNumber)) throw new ForbiddenException();
    await this.participant(e.id, s.id, actor.institutionId);
    return this.db.mathEventParticipant
      .update({
        where: { eventId_enrollmentId: { eventId: e.id, enrollmentId: s.id } },
        data: {
          available: available === true && online,
          presenceUntil: online ? new Date(Date.now() + 45000) : null,
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
  private async makeQuestions(e: any, enrollmentIds: string[], gradeLimit: number) {
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
    // A cross-grade duel uses content suitable for the younger participant.
    // Legacy questions without grade metadata remain eligible.
    const qs = (e.questions as Q[]).filter(
      (q) => q.grade == null || q.grade <= gradeLimit,
    );
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
      version: 2,
      timeLimitSeconds: 30,
      clocks: {},
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
          userId: { not: null },
          user: { isActive: true, institutionUsers: { some: { institutionId: actor.institutionId, isActive: true } } },
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
    await this.reconcileDuels(actor.institutionId, { eventId: e.id, enrollmentIds: ids });
    await this.db.mathEventDuel.updateMany({
      where: {
        eventId: e.id,
        institutionId: actor.institutionId,
        status: 'INVITED',
        expiresAt: { lt: now },
      },
      data: { status: 'EXPIRED' },
    });
    const activeCount = await this.unfinishedActiveCount(this.db, e.id, actor.institutionId, s.id);
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
    const opponentActive = await this.unfinishedActiveCount(this.db, e.id, actor.institutionId, opponent.id);
    if (opponentActive)
      throw new BadRequestException(
        'Ese estudiante está en otra partida ahora.',
      );
    const already = await this.db.mathEventDuel.count({
      where: {
        eventId: e.id,
        institutionId: actor.institutionId,
        pairKey,
        status: { in: ['ACTIVE', 'COMPLETED'] },
        acceptedAt: { gte: colombiaDayStart(now) },
      },
    });
    if (already >= 2)
      throw new BadRequestException(
        'Ya jugaron sus dos partidas puntuables entre ustedes hoy; mañana podrán volver a enfrentarse.',
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
    const opponentGrade = gradeOf(opponent.group.grade);
    const pair = await this.makeQuestions(
      e,
      [s.id, opponent.id],
      Math.min(s.gradeNumber, opponentGrade),
    );
    try {
      const created = await this.db.$transaction(
        async (tx) => {
          // El bloqueo devuelve void; convertir a texto permite que Prisma lo lea.
          for (const id of [s.id, opponent.id].sort())
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`math-event:${e.id}:${id}`}))::text`;
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
            this.unfinishedActiveCount(tx, e.id, actor.institutionId, s.id),
            tx.mathEventDuel.count({
              where: {
                eventId: e.id,
                institutionId: actor.institutionId,
                inviterEnrollmentId: s.id,
                status: 'INVITED',
                expiresAt: { gt: now },
              },
            }),
            this.unfinishedActiveCount(tx, e.id, actor.institutionId, opponent.id),
            tx.mathEventDuel.count({
              where: {
                eventId: e.id,
                institutionId: actor.institutionId,
                pairKey,
                status: { in: ['ACTIVE', 'COMPLETED'] },
                acceptedAt: { gte: day },
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
          if (already >= 2)
            throw new BadRequestException(
              'Ya jugaron sus dos partidas puntuables entre ustedes hoy; mañana podrán volver a enfrentarse.',
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
      // Never serialize the stored question snapshot (it contains answer keys).
      return { id: created.id, status: created.status, expiresAt: created.expiresAt };
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
    await this.reconcileDuels(actor.institutionId, { duelId, enrollmentIds: [s.id] });
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
    if (accept) await this.reconcileDuels(actor.institutionId, { eventId: d.eventId, enrollmentIds: [d.inviterEnrollmentId, d.inviteeEnrollmentId] });
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
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`math-event:${d.eventId}:${id}`}))::text`;
          if (accept) {
            const now = new Date();
            if (d.event.status !== 'PUBLISHED' || now < d.event.startsAt || now > d.event.endsAt || d.expiresAt <= now)
              throw new BadRequestException('El reto o el evento ya venció. Elige un evento disponible.');
            const pairUsed = await tx.mathEventDuel.count({ where: { institutionId: actor.institutionId, eventId: d.eventId,
              pairKey: d.pairKey, status: { in: ['ACTIVE', 'COMPLETED'] }, acceptedAt: { gte: colombiaDayStart(now) } } });
            if (pairUsed >= 2) throw new BadRequestException('Ya jugaron sus dos partidas puntuables entre ustedes hoy.');
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
              const active = await this.unfinishedActiveCount(tx, d.eventId, actor.institutionId, id);
              if (active)
                throw new BadRequestException(
                  id === s.id
                    ? 'Tienes otro duelo en curso. La invitación sigue pendiente; podrás aceptarla cuando ese duelo termine.'
                    : 'Tu compañero está jugando otro duelo. La invitación sigue pendiente; espera a que termine y vuelve a aceptar.',
                );
            }
          }
          const updated = await tx.mathEventDuel.updateMany({
            where: { id: d.id, status: 'INVITED', inviteeEnrollmentId: s.id },
            data: {
              status: accept ? 'ACTIVE' : 'DECLINED',
              acceptedAt: accept ? new Date() : null,
              expiresAt: accept
                ? new Date(Math.min(d.event.endsAt.getTime(), Date.now() + ((d.questions as any)?.version >= 2 ? 8 * 60 : 48 * 60 * 60) * 1000))
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
          'La disponibilidad cambió mientras aceptabas. Revisa el estado del reto; si quedó en espera, podrás aceptarlo cuando ambos estén libres.',
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
  private async startClock(institutionId: string, duelId: string, enrollmentId: string, ordinal: number) {
    if (!Number.isInteger(ordinal) || ordinal < 0 || ordinal >= ROUNDS) throw new BadRequestException('Pregunta no válida.');
    await this.lockedDuel(institutionId, duelId, async (tx, d) => {
      if (![d.inviterEnrollmentId, d.inviteeEnrollmentId].includes(enrollmentId)) throw new NotFoundException('Reto no encontrado.');
      if (d.status !== 'ACTIVE' || d.expiresAt <= new Date() || d.event.status !== 'PUBLISHED' || d.event.endsAt <= new Date()) throw new BadRequestException('Este duelo no está activo.');
      const snapshot = d.questions as any;
      if (snapshot.version < 2 || !snapshot.version) return;
      const answers = d.answers.filter((a: any) => a.enrollmentId === enrollmentId);
      if (answers.some((a: any) => a.ordinal === ordinal)) return;
      if (answers.length !== ordinal) throw new BadRequestException('Responde las preguntas en orden.');
      const side = d.inviterEnrollmentId === enrollmentId ? 'inviter' : 'invitee';
      if (snapshot.clocks?.[side]?.ordinal === ordinal) return;
      const startedAt = new Date();
      const deadlineAt = new Date(Math.min(startedAt.getTime() + 30000, d.expiresAt.getTime(), d.event.endsAt.getTime()));
      await tx.mathEventDuel.update({ where: { id: d.id }, data: { questions: { ...snapshot,
        clocks: { ...(snapshot.clocks || {}), [side]: { ordinal, startedAt: startedAt.toISOString(), deadlineAt: deadlineAt.toISOString() } },
      } } });
    });
  }
  async startQuestion(actor: ClassroomActor, duelId: string, ordinal: number) {
    const { s } = await this.member(actor, duelId);
    await this.startClock(actor.institutionId, duelId, s.id, ordinal);
    return this.getDuel(actor, duelId, true);
  }
  async leaveDuel(actor: ClassroomActor, duelId: string) {
    const { s } = await this.member(actor, duelId);
    await this.lockedDuel(actor.institutionId, duelId, async (tx, d) => {
      if (![d.inviterEnrollmentId, d.inviteeEnrollmentId].includes(s.id)) throw new NotFoundException('Reto no encontrado.');
      if (d.status !== 'ACTIVE' || d.event.endsAt < new Date() || d.event.status === 'CLOSED') throw new BadRequestException('Este duelo ya no está activo.');
      const snapshot = d.questions as any;
      await tx.mathEventDuel.update({ where: { id: d.id }, data: { questions: { ...snapshot, left: [...new Set([...(snapshot.left || []), s.id])] } } });
      await this.fillUnanswered(tx, d, [s.id]);
    });
    return { saved: true };
  }
  async getDuel(actor: ClassroomActor, duelId: string, deferClock = false) {
    const member = await this.member(actor, duelId);
    const s = member.s;
    let d = member.d;
    if (d.status !== 'COMPLETED' && (d.event.endsAt < new Date() || d.event.status === 'CLOSED'))
      throw new BadRequestException('Este evento terminó. Consulta el ranking final.');
    if (d.status !== 'ACTIVE' && d.status !== 'COMPLETED')
      throw new BadRequestException('Acepta el reto para ver las preguntas de la partida.');
    let both = d.questions as any;
    let answers = d.answers.filter(a => a.enrollmentId === s.id);
    if (!deferClock && both.version >= 2 && d.status === 'ACTIVE' && answers.length < ROUNDS) {
      await this.startClock(actor.institutionId, duelId, s.id, answers.length);
      const fresh = await this.db.mathEventDuel.findFirst({ where: { id: duelId, institutionId: actor.institutionId }, include: { event: true, answers: true } });
      if (!fresh) throw new NotFoundException('Reto no encontrado.');
      d = fresh; both = d.questions as any; answers = d.answers.filter(a => a.enrollmentId === s.id);
    }
    const side = d.inviterEnrollmentId === s.id ? 'inviter' : 'invitee';
    const mine = both[side];
    const next = answers.length;
    const finished = next >= ROUNDS;
    const allDone = d.answers.length >= ROUNDS * 2;
    const myScore = answers.filter(a => a.isCorrect).length;
    const opponentScore = allDone ? d.answers.filter(a => a.enrollmentId !== s.id && a.isCorrect).length : null;
    const bonus = allDone ? myScore > opponentScore! ? 5 : myScore === opponentScore ? 2 : 0 : null;
    const clock = both.clocks?.[side]?.ordinal === next ? both.clocks[side] : null;
    return {
      id: d.id, status: d.status, round: Math.min(next + 1, ROUNDS), total: ROUNDS, finished, allDone,
      timeLimitSeconds: both.version >= 2 ? 30 : null,
      questionDeadlineAt: !finished ? clock?.deadlineAt ?? null : null,
      serverNow: new Date().toISOString(), expiresAt: d.expiresAt,
      finishReason: both.left?.includes(s.id) ? 'LEFT' : both.closureReason ?? null,
      questions: mine.map((q: any, i: number) => {
        const answer = answers.find(a => a.ordinal === i);
        const revealed = both.version < 2 || !both.version || !!answer || (i === next && !!clock);
        return { id: q.id, text: revealed ? q.text : '', options: revealed ? q.options : [], topic: revealed ? q.topic : null,
          answered: !!answer,
          ...(answer ? {
            ...(d.event.showCorrectAnswers ? { correctAnswer: q.correctAnswer } : {}),
            ...(d.event.showExplanations ? { explanation: q.explanation } : {}),
            isCorrect: answer.isCorrect, timedOut: answer.answer === '',
          } : {}),
        };
      }),
      pointsAwarded: allDone ? myScore * 10 + bonus! : null, bonus,
      showCorrectAnswers: d.event.showCorrectAnswers, showExplanations: d.event.showExplanations,
      myScore, opponentScore,
    };
  }
  async answer(actor: ClassroomActor, duelId: string, ordinal: number, answer: string) {
    const { s } = await this.member(actor, duelId);
    if (!Number.isInteger(ordinal) || ordinal < 0 || ordinal >= ROUNDS || typeof answer !== 'string' || answer.length > 300)
      throw new BadRequestException('Respuesta no válida.');
    return this.lockedDuel(actor.institutionId, duelId, async (tx, d) => {
      if (![d.inviterEnrollmentId, d.inviteeEnrollmentId].includes(s.id)) throw new NotFoundException('Reto no encontrado.');
      const snapshot = d.questions as any;
      const side = d.inviterEnrollmentId === s.id ? 'inviter' : 'invitee';
      const q = snapshot[side]?.[ordinal] as Q;
      if (!q) throw new BadRequestException('Pregunta no encontrada.');
      const feedback = (isCorrect: boolean, timedOut: boolean) => ({ accepted: true, isCorrect, timedOut,
        ...(d.event.showCorrectAnswers ? { correctAnswer: q.correctAnswer } : {}),
        ...(d.event.showExplanations ? { explanation: q.explanation } : {}),
      });
      const mine = d.answers.filter((a: any) => a.enrollmentId === s.id);
      const prev = mine.find((a: any) => a.ordinal === ordinal);
      if (prev) return feedback(prev.isCorrect, prev.answer === '');
      const now = new Date();
      if (d.event.endsAt < now || d.event.status !== 'PUBLISHED') throw new BadRequestException('Este evento terminó. Ya no se reciben respuestas.');
      if (d.status !== 'ACTIVE' || d.expiresAt <= now) throw new BadRequestException('Este duelo no está activo.');
      if (mine.length !== ordinal) throw new BadRequestException('Responde las preguntas en orden.');
      let timedOut = false;
      if (snapshot.version >= 2) {
        const clock = snapshot.clocks?.[side];
        if (clock?.ordinal !== ordinal || !clock.deadlineAt) throw new BadRequestException('Abre la pregunta para comenzar sus 30 segundos.');
        timedOut = now.getTime() >= new Date(clock.deadlineAt).getTime();
      }
      if (!timedOut && !q.options.includes(answer)) throw new BadRequestException('Elige una de las opciones de la pregunta.');
      const isCorrect = !timedOut && norm(answer) === norm(q.correctAnswer);
      await tx.mathEventDuelAnswer.create({ data: { institutionId: actor.institutionId, duelId, enrollmentId: s.id, ordinal, answer: timedOut ? '' : answer, isCorrect } });
      const total = await tx.mathEventDuelAnswer.count({ where: { duelId } });
      if (total >= ROUNDS * 2) await tx.mathEventDuel.updateMany({ where: { id: duelId, institutionId: actor.institutionId, status: 'ACTIVE' }, data: { status: 'COMPLETED', completedAt: now } });
      return feedback(isCorrect, timedOut);
    });
  }
  async ranking(
    actor: ClassroomActor,
    eventId: string,
    scope: 'general' | 'grade' | 'course',
  ) {
    const s = await this.student(actor);
    const e = await this.event(eventId, actor.institutionId, false, true);
    await this.reconcileDuels(actor.institutionId, { eventId: e.id });
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
    const summaries = await this.recognitionSummaries(actor.institutionId, e.id, [...result.slice(0, 100).map(x => x.id), s.id], s.id);
    for (const row of result.slice(0, 100)) Object.assign(row, summaries[row.id]);
    const mine = result.find((x) => x.id === s.id);
    return {
      scope,
      rows: result
        .slice(0, 100)
        .map((x, i) => ({ ...x, rank: i + 1, isMe: x.id === s.id })),
      myRank: mine ? result.indexOf(mine) + 1 : null,
      myRecognitions: summaries[s.id].reactions,
      total: result.length,
    };
  }
  async eventSettings(actor: ClassroomActor, eventId: string) {
    await this.assertEventManager(actor, eventId);
    const e = await this.event(eventId, actor.institutionId, true);
    return { id: e.id, title: e.title, showCorrectAnswers: e.showCorrectAnswers, showExplanations: e.showExplanations };
  }
  async manageEvents(actor: ClassroomActor) {
    const rows = await this.db.mathEvent.findMany({ where: { institutionId: actor.institutionId },
      select: { id: true, title: true, status: true, startsAt: true, endsAt: true, showCorrectAnswers: true, showExplanations: true,
        createdById: true },
      orderBy: { createdAt: 'desc' }, take: 100 });
    const creators = await this.db.user.findMany({ where: { id: { in: [...new Set(rows.map(row => row.createdById))] },
      institutionUsers: { some: { institutionId: actor.institutionId, isActive: true } } },
      select: { id: true, firstName: true, lastName: true } });
    const names = new Map(creators.map(user => [user.id, `${user.firstName} ${user.lastName}`.trim()]));
    return rows.map(({ createdById, ...event }) => ({ ...event,
      organizerName: names.get(createdById) || 'Organizador',
      canManage: this.canCoordinateEvent(actor) || createdById === actor.userId,
    }));
  }
  async checkStudentAccess(actor: ClassroomActor, eventId: string, input: unknown) {
    if (typeof input !== 'string' || !/^[a-zA-Z0-9._@-]{2,100}$/.test(input.trim()))
      throw new BadRequestException('Escribe el usuario del estudiante, sin contraseña.');
    const username = input.trim();
    const event = await this.db.mathEvent.findFirst({
      where: { id: eventId, institutionId: actor.institutionId },
      select: { status: true, startsAt: true, endsAt: true, eligibleGrades: true },
    });
    if (!event) throw new NotFoundException('Evento no disponible.');
    const student = await this.db.student.findFirst({
      where: { institutionId: actor.institutionId, user: { username: { equals: username, mode: 'insensitive' } } },
      select: {
        id: true, firstName: true, lastName: true, isActive: true,
        user: { select: { isActive: true, roles: { select: { role: { select: { name: true } } } }, institutionUsers: {
          where: { institutionId: actor.institutionId, isActive: true },
          select: { institutionUserRoles: { select: { role: { select: { name: true } } } } },
        } } },
      },
    });
    if (!student) return { username, canSeeEvent: false, checks: [{ label: 'Estudiante vinculado a este colegio', ok: false }], student: null };
    const enrollments = await this.db.studentEnrollment.findMany({
      where: { institutionId: actor.institutionId, studentId: student.id, status: 'ACTIVE',
        academicYear: { institutionId: actor.institutionId, status: 'ACTIVE' },
        group: { grade: { institutionId: actor.institutionId } },
      },
      select: { group: { select: { name: true, grade: { select: { name: true, number: true } } } } },
      take: 3,
    });
    const selected = enrollments.find(e => gradeOf(e.group.grade) >= 6 && gradeOf(e.group.grade) <= 11);
    const enrollment = selected || enrollments[0];
    const grade = enrollment ? gradeOf(enrollment.group.grade) : null;
    const now = new Date();
    const membership = student.user?.institutionUsers[0];
    const tenantRoles = membership?.institutionUserRoles ?? [];
    const roles = tenantRoles.length ? tenantRoles : student.user?.roles ?? [];
    const checks = [
      { label: 'Participación activa según matrícula vigente', ok: enrollments.length > 0 && student.user?.isActive === true },
      { label: 'Cuenta de acceso activa', ok: student.user?.isActive === true },
      { label: 'Vinculación activa de la cuenta al colegio', ok: !!membership },
      { label: 'Rol ESTUDIANTE en este colegio', ok: !!membership && roles.some(r => r.role.name === 'ESTUDIANTE') },
      { label: 'Matrícula activa en el año académico activo', ok: enrollments.length > 0 },
      { label: 'Grado reconocido y habilitado para el evento', ok: !!selected && this.eligible(event, grade!) },
      { label: 'Evento publicado', ok: event.status === 'PUBLISHED' },
      { label: 'Evento dentro de sus fechas', ok: event.startsAt <= now && event.endsAt >= now },
    ];
    return { username, canSeeEvent: checks.every(c => c.ok), checks, profileStatusMismatch: !student.isActive,
      student: { name: `${student.firstName.trim().split(/\s+/)[0]} ${student.lastName.trim().split(/\s+/)[0]}`,
        course: enrollment?.group.name ?? null, gradeName: enrollment?.group.grade.name ?? null,
        storedGradeNumber: enrollment?.group.grade.number ?? null, resolvedGrade: grade },
    };
  }
  async eventReport(actor: ClassroomActor, eventId: string) {
    const event = await this.event(eventId, actor.institutionId, true);
    const [questions, participants, duels] = await Promise.all([
      this.db.mathEventQuestion.findMany({
        where: { eventId, institutionId: actor.institutionId },
        select: { id: true, code: true, text: true, type: true, topic: true, difficulty: true },
        orderBy: { code: 'asc' },
      }),
      this.db.mathEventParticipant.count({ where: { eventId, institutionId: actor.institutionId } }),
      this.db.mathEventDuel.findMany({
        where: { eventId, institutionId: actor.institutionId, status: 'COMPLETED' },
        select: {
          questions: true,
          answers: { select: { enrollmentId: true, ordinal: true, isCorrect: true } },
          inviter: { select: { id: true, student: { select: { firstName: true, lastName: true } }, group: { select: { name: true, grade: { select: { number: true, name: true } } } } } },
          invitee: { select: { id: true, student: { select: { firstName: true, lastName: true } }, group: { select: { name: true, grade: { select: { number: true, name: true } } } } } },
        },
      }),
    ]);
    const questionStats = new Map(questions.map((q) => [q.id, { ...q, appearances: 0, answers: 0, correct: 0 }]));
    const players = new Map<string, { id: string; firstName: string; lastName: string; course: string; grade: number; points: number; played: number; correct: number; wins: number; draws: number; losses: number }>();
    let answered = 0;
    let correct = 0;
    for (const duel of duels) {
      const snapshot = duel.questions as { inviter?: Array<{ id: string }>; invitee?: Array<{ id: string }> };
      const sides = [
        { enrollment: duel.inviter, sequence: snapshot.inviter || [] },
        { enrollment: duel.invitee, sequence: snapshot.invitee || [] },
      ];
      const scores = sides.map(({ enrollment, sequence }) => {
        const answers = duel.answers.filter((a) => a.enrollmentId === enrollment.id);
        for (const q of sequence) {
          const stat = questionStats.get(q.id);
          if (stat) stat.appearances++;
        }
        for (const answer of answers) {
          const stat = questionStats.get(sequence[answer.ordinal]?.id);
          if (stat) {
            stat.answers++;
            if (answer.isCorrect) stat.correct++;
          }
          answered++;
          if (answer.isCorrect) correct++;
        }
        return { enrollment, score: answers.filter((a) => a.isCorrect).length, count: answers.length };
      });
      for (let i = 0; i < scores.length; i++) {
        const { enrollment, score, count } = scores[i];
        if (count < ROUNDS) continue;
        let row = players.get(enrollment.id);
        if (!row) {
          row = {
            id: enrollment.id,
            firstName: enrollment.student.firstName.trim().split(/\s+/)[0],
            lastName: enrollment.student.lastName.trim().split(/\s+/)[0],
            course: enrollment.group.name,
            grade: gradeOf(enrollment.group.grade),
            points: 0, played: 0, correct: 0, wins: 0, draws: 0, losses: 0,
          };
          players.set(enrollment.id, row);
        }
        row.played++;
        row.correct += score;
        row.points += score * 10;
        const rivalScore = scores[1 - i].score;
        if (score > rivalScore) { row.wins++; row.points += 5; }
        else if (score === rivalScore) { row.draws++; row.points += 2; }
        else row.losses++;
      }
    }
    const ranking = [...players.values()].sort((a, b) => b.points - a.points || b.correct - a.correct || a.firstName.localeCompare(b.firstName, 'es'));
    return {
      event: { id: event.id, title: event.title, startsAt: event.startsAt, endsAt: event.endsAt, status: event.status },
      totals: { participants, played: ranking.length, duels: duels.length, answered, correct, questionCount: questions.length },
      ranking: ranking.map((row, index) => ({ ...row, rank: index + 1 })),
      questions: [...questionStats.values()].map((q) => ({ ...q, accuracy: q.answers ? Math.round(100 * q.correct / q.answers) : null })),
    };
  }
  async liveReport(actor: ClassroomActor, eventId: string) {
    const event = await this.db.mathEvent.findFirst({
      where: { id: eventId, institutionId: actor.institutionId },
      select: { id: true, title: true, status: true },
    });
    if (!event) throw new NotFoundException('Evento no disponible.');
    await this.reconcileDuels(actor.institutionId, { eventId });
    const now = new Date();
    const [participantsOnline, onlineRows, completed, duels] = await Promise.all([
      this.db.mathEventParticipant.count({ where: { eventId, institutionId: actor.institutionId, presenceUntil: { gt: now } } }),
      this.db.mathEventParticipant.findMany({
        where: { eventId, institutionId: actor.institutionId, presenceUntil: { gt: now }, enrollment: {
          institutionId: actor.institutionId, status: 'ACTIVE', academicYear: { institutionId: actor.institutionId, status: 'ACTIVE' },
        } },
        select: { presenceUntil: true, enrollment: { select: {
          student: { select: { firstName: true, lastName: true } },
          group: { select: { name: true, grade: { select: { number: true, name: true } } } },
        } } },
        orderBy: { presenceUntil: 'desc' }, take: 200,
      }),
      this.db.mathEventDuel.count({ where: { eventId, institutionId: actor.institutionId, status: 'COMPLETED' } }),
      this.db.mathEventDuel.findMany({
        where: { eventId, institutionId: actor.institutionId, status: { in: ['INVITED', 'ACTIVE'] }, expiresAt: { gt: now } },
        select: {
          id: true, status: true, createdAt: true, acceptedAt: true, expiresAt: true,
          answers: { select: { enrollmentId: true, isCorrect: true, createdAt: true } },
          inviter: { select: { id: true, student: { select: { firstName: true, lastName: true } }, group: { select: { name: true, grade: { select: { number: true, name: true } } } } } },
          invitee: { select: { id: true, student: { select: { firstName: true, lastName: true } }, group: { select: { name: true, grade: { select: { number: true, name: true } } } } } },
        }, orderBy: { createdAt: 'desc' }, take: 100,
      }),
    ]);
    const liveDuels = duels.map(duel => {
      const players = [duel.inviter, duel.invitee].map(enrollment => {
        const own = duel.answers.filter(answer => answer.enrollmentId === enrollment.id);
        const answered = own.length;
        return {
          firstName: enrollment.student.firstName.trim().split(/\s+/)[0],
          lastName: enrollment.student.lastName.trim().split(/\s+/)[0],
          course: enrollment.group.name, grade: gradeOf(enrollment.group.grade),
          answered, total: ROUNDS, correct: own.filter(answer => answer.isCorrect).length,
          points: own.filter(answer => answer.isCorrect).length * 10,
          state: duel.status === 'INVITED' ? 'INVITED' : answered >= ROUNDS ? 'FINISHED_WAITING' : 'PLAYING',
        };
      });
      return { id: duel.id, status: duel.status, createdAt: duel.createdAt, acceptedAt: duel.acceptedAt,
        expiresAt: duel.expiresAt, players,
        lastActivityAt: duel.answers.reduce<Date | null>((latest, answer) => !latest || answer.createdAt > latest ? answer.createdAt : latest, duel.acceptedAt),
      };
    });
    const onlineStudents = onlineRows.map(row => ({
      firstName: row.enrollment.student.firstName.trim().split(/\s+/)[0],
      lastName: row.enrollment.student.lastName.trim().split(/\s+/)[0],
      course: row.enrollment.group.name, grade: gradeOf(row.enrollment.group.grade),
    }));
    return { event, updatedAt: now, onlineStudents, summary: {
      participantsOnline,
      invitationsPending: liveDuels.filter(duel => duel.status === 'INVITED').length,
      duelsInProgress: liveDuels.filter(duel => duel.status === 'ACTIVE').length,
      duelsCompleted: completed,
      answersInProgress: liveDuels.reduce((total, duel) => total + duel.players.reduce((subtotal, player) => subtotal + player.answered, 0), 0),
    }, duels: liveDuels };
  }
  async updateSettings(actor: ClassroomActor, eventId: string, input: any) {
    await this.assertEventManager(actor, eventId);
    const e = await this.event(eventId, actor.institutionId, true);
    if (typeof input?.showCorrectAnswers !== 'boolean' || typeof input?.showExplanations !== 'boolean')
      throw new BadRequestException('Selecciona las opciones de respuestas y explicaciones.');
    const hasDates = input?.startsAt !== undefined || input?.endsAt !== undefined;
    if (hasDates && e.status !== 'DRAFT')
      throw new BadRequestException('Las fechas solo se pueden cambiar mientras el evento es borrador.');
    const startsAt = input?.startsAt === undefined ? e.startsAt : new Date(input.startsAt);
    const endsAt = input?.endsAt === undefined ? e.endsAt : new Date(input.endsAt);
    if (hasDates && (
      !Number.isFinite(startsAt.getTime()) ||
      !Number.isFinite(endsAt.getTime()) ||
      startsAt >= endsAt ||
      endsAt <= new Date()
    ))
      throw new BadRequestException('El evento debe cerrar en una fecha futura y comenzar antes de terminar.');
    return this.db.mathEvent.update({ where: { id: e.id }, data: {
      showCorrectAnswers: input.showCorrectAnswers, showExplanations: input.showExplanations,
      ...(hasDates ? { startsAt, endsAt } : {}),
    }, select: { id: true, startsAt: true, endsAt: true, showCorrectAnswers: true, showExplanations: true } });
  }
  async duelState(actor: ClassroomActor, duelId: string) {
    const s = await this.student(actor);
    await this.reconcileDuels(actor.institutionId, { duelId, enrollmentIds: [s.id] });
    const d = await this.db.mathEventDuel.findFirst({ where: {
      id: duelId, institutionId: actor.institutionId,
      OR: [{ inviterEnrollmentId: s.id }, { inviteeEnrollmentId: s.id }],
    }, select: { id: true, status: true, expiresAt: true } });
    if (!d) throw new NotFoundException('Reto no encontrado.');
    return { id: d.id, status: d.expiresAt < new Date() && d.status !== 'COMPLETED' ? 'EXPIRED' : d.status };
  }
  private async recognitionSummaries(institutionId: string, eventId: string, ids: string[], senderEnrollmentId: string) {
    const recipients = [...new Set(ids)];
    const where = { institutionId, eventId, recipientEnrollmentId: { in: recipients } };
    const [counts, mine] = await Promise.all([
      this.db.mathEventReaction.groupBy({ by: ['recipientEnrollmentId', 'kind'], where, _count: { _all: true } }),
      this.db.mathEventReaction.findMany({ where: { ...where, senderEnrollmentId }, select: { recipientEnrollmentId: true, kind: true } }),
    ]);
    return Object.fromEntries(recipients.map(id => [id, {
      reactions: Object.fromEntries(['APPLAUSE','BRILLIANT','FAIR_PLAY','KEEP_GOING'].map(kind =>
        [kind, counts.find(row => row.recipientEnrollmentId === id && row.kind === kind)?._count._all ?? 0])),
      myReaction: mine.find(row => row.recipientEnrollmentId === id)?.kind ?? null,
    }]));
  }
  async recognitions(actor: ClassroomActor, eventId: string, recipientIds?: string) {
    const s = await this.student(actor);
    const e = await this.db.mathEvent.findFirst({ where: { id: eventId, institutionId: actor.institutionId, status: { in: ['PUBLISHED', 'CLOSED'] } }, select: { id: true, eligibleGrades: true } });
    if (!e || !this.eligible(e, s.gradeNumber)) throw new NotFoundException('Evento no disponible.');
    if (recipientIds !== undefined && (typeof recipientIds !== 'string' || recipientIds.length > 9000)) throw new BadRequestException('Lista de participantes no válida.');
    const ids = recipientIds ? recipientIds.split(',') : [];
    if (ids.length > 102 || ids.some(id => !/^[a-zA-Z0-9-]{1,80}$/.test(id))) throw new BadRequestException('Lista de participantes no válida.');
    return { summaries: await this.recognitionSummaries(actor.institutionId, e.id, [...ids, s.id], s.id) };
  }
  async react(actor: ClassroomActor, eventId: string, recipientEnrollmentId: string, kind: string | null) {
    const s = await this.student(actor);
    const e = await this.event(eventId, actor.institutionId);
    if (!this.eligible(e, s.gradeNumber) || typeof recipientEnrollmentId !== 'string' || recipientEnrollmentId === s.id ||
        (kind !== null && !['APPLAUSE','BRILLIANT','FAIR_PLAY','KEEP_GOING'].includes(kind)))
      throw new BadRequestException('Reacción no válida.');
    const played = await Promise.all([s.id, recipientEnrollmentId].map(id => this.db.mathEventDuel.findFirst({ where: {
      eventId: e.id, institutionId: actor.institutionId, status: 'COMPLETED',
      OR: [{ inviterEnrollmentId: id }, { inviteeEnrollmentId: id }],
    }, select: { id: true } })));
    if (played.some(row => !row)) throw new ForbiddenException('Las reacciones son para participantes que ya jugaron.');
    if (kind === null) {
      await this.db.mathEventReaction.deleteMany({ where: { institutionId: actor.institutionId, eventId: e.id, senderEnrollmentId: s.id, recipientEnrollmentId } });
    } else await this.db.mathEventReaction.upsert({
      where: { eventId_senderEnrollmentId_recipientEnrollmentId: { eventId: e.id, senderEnrollmentId: s.id, recipientEnrollmentId } },
      create: { institutionId: actor.institutionId, eventId: e.id, senderEnrollmentId: s.id, recipientEnrollmentId, kind },
      update: { kind },
    });
    const summaries = await this.recognitionSummaries(actor.institutionId, e.id, [recipientEnrollmentId], s.id);
    return { saved: kind !== null, kind, ...summaries[recipientEnrollmentId] };
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
        showCorrectAnswers: input.showCorrectAnswers !== false,
        showExplanations: input.showExplanations !== false,
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
    await this.assertEventManager(actor, eventId);
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
          grade: collection.grade.number,
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
  async importEditorialCatalog(actor: ClassroomActor, eventId: string) {
    await this.assertEventManager(actor, eventId);
    const e = await this.event(eventId, actor.institutionId, true);
    if (e.status !== 'DRAFT')
      throw new BadRequestException('El catálogo solo se carga en un borrador.');

    const existing = await this.db.mathEventQuestion.findMany({
      where: { eventId: e.id, institutionId: actor.institutionId },
      select: { code: true, text: true },
    });
    const codes = new Set(existing.map((q) => q.code).filter(Boolean));
    const texts = new Set(existing.map((q) => norm(q.text)));
    const rows: any[] = [];
    let skipped = 0;
    for (const q of EDITORIAL_CATALOG.questions) {
      const options = Array.isArray(q.options)
        ? q.options.filter((x) => typeof x === 'string' && x.trim())
        : [];
      const fingerprint = norm(q.text);
      if (
        !q.code ||
        !Number.isInteger(q.grade) || q.grade < 6 || q.grade > 11 ||
        !q.text?.trim() || !q.conceptKey?.trim() || !q.topic?.trim() ||
        !['MULTIPLE_CHOICE', 'TRUE_FALSE'].includes(q.type) ||
        options.length < 2 ||
        !options.some((option) => norm(option) === norm(q.correctAnswer))
      )
        throw new BadRequestException(`Pregunta editorial inválida: ${q.code || 'sin código'}.`);
      if (codes.has(q.code) || texts.has(fingerprint)) {
        skipped++;
        continue;
      }
      codes.add(q.code);
      texts.add(fingerprint);
      rows.push({
        institutionId: actor.institutionId,
        eventId: e.id,
        code: q.code,
        grade: q.grade,
        type: q.type,
        text: q.text.trim(),
        options,
        correctAnswer: options.find((option) => norm(option) === norm(q.correctAnswer))!,
        explanation: q.explanation,
        topic: q.topic,
        conceptKey: q.conceptKey,
        difficulty: q.difficulty,
      });
    }
    const result = rows.length
      ? await this.db.mathEventQuestion.createMany({ data: rows, skipDuplicates: true })
      : { count: 0 };
    return {
      added: result.count,
      skipped: skipped + rows.length - result.count,
      questionCount: await this.db.mathEventQuestion.count({
        where: { eventId: e.id, institutionId: actor.institutionId },
      }),
      catalogQuestionCount: EDITORIAL_CATALOG.questionCount,
    };
  }
  async publish(actor: ClassroomActor, eventId: string) {
    await this.assertEventManager(actor, eventId);
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
    const rival = d.roster.filter((x) => x.available && !x.hasOpenDuelWithMe && x.matchesWithMeToday < 2);
    if (!rival.length)
      throw new BadRequestException(
        'No hay estudiantes esperando ahora. Puedes dejar un reto para después.',
      );
    const pick = rival[randomInt(rival.length)];
    return this.challenge(actor, eventId, pick.id, 'MATCH');
  }
}
