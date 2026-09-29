import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ClassroomDuelStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ClassroomActor, ClassroomTenantAccessService } from './classroom-tenant-access.service';
import { norm } from '../../common/utils/answer-matching.util';
import { randomInt } from 'crypto';
import { arenaBadges, type ArenaStats } from './arena-badges';

type DuelQuestion = { id: string; text: string; options: string[]; correctAnswer: string; explanation: string | null; category: string };
const QUESTION_COUNT = 7;
const sourceTypes = ['QUIZ', 'HOME_QUIZ', 'ICFES_SIMULATOR'] as const;

/**
 * Puntos del ranking. Se ganan POR DUELO, no por pregunta acertada: responder
 * muchas preguntas no acumula posición. Los aciertos solo entran como
 * bonificación de partida perfecta y como desempate.
 *
 *   Ganar 3 · Empatar 1 · Perder 0
 *   +2  partida perfecta (aciertas las siete)
 *   +1  ganarle a quien iba por delante de ti en la tabla
 *
 * Con esto un estudiante que juega pocos duelos pero los gana sube igual que uno
 * que juega muchos, y ganarle a alguien mejor clasificado vale más.
 */
const POINTS = { win: 3, draw: 1, loss: 0, perfect: 2, upset: 1 } as const;
// Tope de duelos leídos por consulta. Evita que un grado con mucho uso haga una
// lectura sin límite; la respuesta avisa cuando se alcanzó (`truncated`).
const RANKING_DUEL_LIMIT = 2000;
const RANKING_ROWS = 50;

type RankingScope = 'group' | 'grade' | 'general';

type RankingRow = {
  enrollmentId: string; name: string; played: number; wins: number; draws: number; losses: number;
  correct: number; answered: number; perfects: number; upsets: number;
  points: number; accuracy: number; rank: number; isMe: boolean;
};

/**
 * Orden del ranking, de mayor a menor: puntos → aciertos → duelos jugados →
 * nombre. El último criterio es alfabético para que dos filas idénticas siempre
 * queden en el mismo orden (desempate previsible, sin azar).
 */
function compareRanking(a: RankingRow, b: RankingRow) {
  return b.points - a.points || b.correct - a.correct || b.played - a.played || a.name.localeCompare(b.name, 'es');
}

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

/**
 * Selección de la ruleta: para cada una de las siete rondas se sortea primero
 * una categoría y después una pregunta de esa categoría. Dos sorteos, como en la
 * rueda que ve el estudiante — no se reparte a partes iguales ni se sigue un
 * orden fijo, y una misma categoría puede repetirse.
 *
 * Cada pregunta sale de la bolsa al usarse, así que las siete son distintas.
 */
function rouletteQuestions(pool: DuelQuestion[], categories: string[]) {
  const remaining = new Map(categories.map((name) => [name, pool.filter((question) => question.category === name)]));
  const picked: DuelQuestion[] = [];
  while (picked.length < QUESTION_COUNT) {
    const available = [...remaining].filter(([, questions]) => questions.length > 0);
    if (!available.length) break;
    const [, questions] = available[randomInt(available.length)];
    picked.push(questions.splice(randomInt(questions.length), 1)[0]);
  }
  return picked;
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

  /**
   * Tabla de posiciones calculada en el servidor a partir de los duelos ya
   * terminados. Nunca acepta cifras del cliente y nunca expone respuestas
   * correctas: solo cuenta aciertos ya registrados. Visible para el docente del
   * aula y para los estudiantes matriculados en ella.
   *
   * `scope = 'group'` mira solo esta aula (un grupo, una materia).
   * `scope = 'grade'` mira todas las aulas de los grupos del mismo grado y año.
   */
  async ranking(actor: ClassroomActor, classroomId: string, scope: RankingScope) {
    const { classroom, enrollmentId } = await this.context(actor, classroomId);
    const group = await this.prisma.group.findFirst({
      where: { id: classroom.teacherAssignment.groupId, grade: { institutionId: actor.institutionId } },
      select: { name: true, gradeId: true, grade: { select: { name: true } } },
    });

    // Alcance → aulas que entran en la cuenta. «general» abarca la institución
    // completa en el año en curso; el aislamiento por institución nunca se abre.
    let classroomIds: string[] | null = [classroomId];
    if (scope !== 'group') {
      const peers = await this.prisma.classroom.findMany({
        where: {
          institutionId: actor.institutionId,
          teacherAssignment: {
            institutionId: actor.institutionId,
            academicYearId: classroom.teacherAssignment.academicYearId,
            ...(scope === 'grade' ? { group: { gradeId: group?.gradeId, grade: { institutionId: actor.institutionId } } } : {}),
          },
        },
        select: { id: true },
      });
      classroomIds = peers.map((peer) => peer.id);
      if (!classroomIds.includes(classroomId)) classroomIds.push(classroomId);
    }

    const duels = await this.prisma.classroomDuel.findMany({
      where: { institutionId: actor.institutionId, classroomId: { in: classroomIds }, status: 'COMPLETED' },
      select: {
        inviterEnrollmentId: true, inviteeEnrollmentId: true,
        inviter: { select: { student: { select: { firstName: true, lastName: true } } } },
        invitee: { select: { student: { select: { firstName: true, lastName: true } } } },
        answers: { select: { enrollmentId: true, isCorrect: true } },
      },
      orderBy: { completedAt: 'desc' },
      take: RANKING_DUEL_LIMIT,
    });

    const totals = new Map<string, RankingRow>();
    const entry = (id: string, enrollment: { student: { firstName: string; lastName: string } }) => {
      const existing = totals.get(id);
      if (existing) return existing;
      const fresh: RankingRow = {
        enrollmentId: id, name: displayName(enrollment), played: 0, wins: 0, draws: 0, losses: 0,
        correct: 0, answered: 0, perfects: 0, upsets: 0, points: 0, accuracy: 0, rank: 0, isMe: id === enrollmentId,
      };
      totals.set(id, fresh);
      return fresh;
    };

    // Se recorre del duelo más antiguo al más nuevo: la bonificación por ganarle
    // a quien iba por delante necesita reconstruir la tabla antes de cada partida.
    for (const duel of [...duels].reverse()) {
      const sides = [
        { row: entry(duel.inviterEnrollmentId, duel.inviter), id: duel.inviterEnrollmentId },
        { row: entry(duel.inviteeEnrollmentId, duel.invitee), id: duel.inviteeEnrollmentId },
      ];
      const before = [...totals.values()].sort(compareRanking);
      const beforePosition = (id: string) => before.findIndex((row) => row.enrollmentId === id);
      const answered = sides.map((side) => duel.answers.filter((answer) => answer.enrollmentId === side.id).length);
      const scores = sides.map((side) => duel.answers.filter((answer) => answer.enrollmentId === side.id && answer.isCorrect).length);
      sides.forEach((side, index) => {
        const mine = scores[index];
        const theirs = scores[1 - index];
        side.row.played += 1;
        side.row.correct += mine;
        side.row.answered += answered[index];
        if (mine > theirs) {
          side.row.wins += 1;
          side.row.points += POINTS.win;
          const opponent = sides[1 - index].row;
          const opponentPosition = beforePosition(opponent.enrollmentId);
          const myPosition = beforePosition(side.row.enrollmentId);
          if (opponent.played > 0 && opponentPosition < myPosition) { side.row.upsets += 1; side.row.points += POINTS.upset; }
        } else if (mine === theirs) {
          side.row.draws += 1;
          side.row.points += POINTS.draw;
        } else {
          side.row.losses += 1;
          side.row.points += POINTS.loss;
        }
        if (answered[index] > 0 && mine === answered[index]) { side.row.perfects += 1; side.row.points += POINTS.perfect; }
      });
    }

    const ordered = [...totals.values()]
      .map((row) => ({ ...row, accuracy: row.answered ? Math.round((row.correct / row.answered) * 100) : 0 }))
      .sort(compareRanking)
      .map((row, index) => ({ ...row, rank: index + 1 }));
    const me = ordered.find((row) => row.isMe) ?? null;
    const rows = ordered.slice(0, RANKING_ROWS);
    // Si el estudiante quedó fuera del top visible, se añade al final para que
    // siempre pueda verse a sí mismo sin exponer el resto de la tabla.
    if (me && !rows.some((row) => row.isMe)) rows.push(me);

    const labels: Record<RankingScope, { label: string; hint: string }> = {
      group: { label: `${group?.name ?? 'Mi curso'} · ${classroom.title}`, hint: 'Duelos terminados en esta aula.' },
      grade: { label: `Grado ${group?.grade.name ?? ''}`.trim(), hint: 'Duelos terminados del grado, en todas las materias.' },
      general: { label: 'Toda la institución', hint: 'Duelos terminados en el año escolar en curso, en todos los grados.' },
    };

    return {
      scope,
      scopeLabel: labels[scope].label,
      scopeHint: labels[scope].hint,
      criteria: POINTS,
      rows,
      myRank: me?.rank ?? null,
      participants: ordered.length,
      truncated: duels.length === RANKING_DUEL_LIMIT,
    };
  }

  /**
   * Perfil de Arena del estudiante que consulta: sus propias cifras e insignias,
   * sobre todos sus duelos terminados en la institución (no solo los de esta
   * aula, porque la identidad de jugador es una sola).
   *
   * Solo devuelve datos de quien pregunta. Las categorías salen del JSON
   * congelado de cada duelo, que ya guarda la categoría de cada pregunta.
   */
  async profile(actor: ClassroomActor, classroomId: string) {
    const { enrollmentId } = await this.context(actor, classroomId);
    if (!enrollmentId) throw new ForbiddenException('Solo un estudiante tiene perfil de Arena');

    const duels = await this.prisma.classroomDuel.findMany({
      where: {
        institutionId: actor.institutionId, status: 'COMPLETED',
        OR: [{ inviterEnrollmentId: enrollmentId }, { inviteeEnrollmentId: enrollmentId }],
      },
      select: { questions: true, completedAt: true, answers: { select: { enrollmentId: true, ordinal: true, isCorrect: true } } },
      orderBy: { completedAt: 'asc' },
      take: RANKING_DUEL_LIMIT,
    });

    const stats: ArenaStats = { wins: 0, correct: 0, perfects: 0, upsets: 0, bestStreak: 0, byCategory: new Map() };
    let played = 0; let draws = 0; let losses = 0; let answered = 0; let streak = 0;

    for (const duel of duels) {
      const questions = Array.isArray(duel.questions) ? duel.questions as DuelQuestion[] : [];
      const mine = duel.answers.filter((answer) => answer.enrollmentId === enrollmentId);
      const theirs = duel.answers.filter((answer) => answer.enrollmentId !== enrollmentId);
      const myScore = mine.filter((answer) => answer.isCorrect).length;
      const theirScore = theirs.filter((answer) => answer.isCorrect).length;
      played += 1;
      answered += mine.length;
      stats.correct += myScore;

      for (const answer of mine) {
        const name = questions[answer.ordinal]?.category;
        if (!name) continue;
        const totals = stats.byCategory.get(name) ?? { correct: 0, answered: 0, duels: 0 };
        totals.answered += 1;
        if (answer.isCorrect) totals.correct += 1;
        stats.byCategory.set(name, totals);
      }
      for (const name of new Set(questions.map((question) => question.category).filter(Boolean))) {
        const totals = stats.byCategory.get(name);
        if (totals) totals.duels += 1;
      }

      if (myScore > theirScore) {
        stats.wins += 1; streak += 1;
        stats.bestStreak = Math.max(stats.bestStreak, streak);
      } else if (myScore === theirScore) {
        draws += 1; streak = 0;
      } else {
        losses += 1; streak = 0;
      }
      if (mine.length > 0 && myScore === mine.length) stats.perfects += 1;
    }

    // Los puntos y las insignias de remontada siguen el mismo ranking general
    // del año que ve el estudiante; los demás contadores del perfil son históricos.
    const currentSeason = await this.ranking(actor, classroomId, 'general');
    const currentSeasonMe = currentSeason.rows.find((row) => row.isMe);
    stats.upsets = currentSeasonMe?.upsets ?? 0;

    const badges = arenaBadges(stats);
    return {
      played, wins: stats.wins, draws, losses,
      correct: stats.correct, answered,
      accuracy: answered ? Math.round((stats.correct / answered) * 100) : 0,
      perfects: stats.perfects, currentStreak: streak, bestStreak: stats.bestStreak,
      points: currentSeasonMe?.points ?? 0,
      categories: [...stats.byCategory]
        .map(([name, totals]) => ({ name, ...totals, accuracy: totals.answered ? Math.round((totals.correct / totals.answered) * 100) : 0 }))
        .sort((a, b) => b.correct - a.correct),
      badges,
      earnedCount: badges.filter((badge) => badge.earned).length,
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

  /**
   * Compañeros del mismo grupo con los que NO hay ya un duelo abierto. Es la
   * lista de la que sale un rival al azar: proponer a alguien con quien ya
   * tienes partida solo produciría el error del duelo duplicado.
   */
  private async availableRivals(actor: ClassroomActor, classroom: { teacherAssignment: { academicYearId: string; groupId: string } }, classroomId: string, enrollmentId: string) {
    const [peers, openDuels] = await Promise.all([
      this.prisma.studentEnrollment.findMany({
        where: { institutionId: actor.institutionId, academicYearId: classroom.teacherAssignment.academicYearId, groupId: classroom.teacherAssignment.groupId, status: 'ACTIVE', id: { not: enrollmentId }, student: { institutionId: actor.institutionId, isActive: true, userId: { not: null } } },
        select: { id: true },
      }),
      this.prisma.classroomDuel.findMany({
        where: { institutionId: actor.institutionId, classroomId, status: { in: ['INVITED', 'ACTIVE'] }, expiresAt: { gte: new Date() }, OR: [{ inviterEnrollmentId: enrollmentId }, { inviteeEnrollmentId: enrollmentId }] },
        select: { inviterEnrollmentId: true, inviteeEnrollmentId: true },
      }),
    ]);
    const busy = new Set(openDuels.flatMap((duel) => [duel.inviterEnrollmentId, duel.inviteeEnrollmentId]));
    return peers.filter((peer) => !busy.has(peer.id)).map((peer) => peer.id);
  }

  async invite(actor: ClassroomActor, classroomId: string, opponentEnrollmentId: string | undefined, choice: { category?: string; selectionMode?: string; rivalMode?: string } = {}) {
    const { classroom, enrollmentId } = await this.context(actor, classroomId);
    if (!enrollmentId) throw new ForbiddenException('Solo un estudiante puede retar');

    // Rival al azar: lo sortea el servidor entre los compañeros libres, para que
    // nadie pueda forzar siempre al mismo contrincante desde el cliente.
    if (choice.rivalMode === 'RANDOM') {
      const available = await this.availableRivals(actor, classroom, classroomId, enrollmentId);
      if (!available.length) throw new BadRequestException('No hay compañeros libres ahora mismo. Termina un duelo abierto o vuelve más tarde.');
      opponentEnrollmentId = available[randomInt(available.length)];
    }

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
    let questions: DuelQuestion[] = [];
    if (selectionMode === 'ROULETTE' && categories.length) {
      // La rueda gira una vez por ronda: cada pregunta trae su propia categoría y
      // el cliente la muestra antes de enseñar el enunciado.
      category = 'Ruleta';
      questions = rouletteQuestions(pool, categories.map((item) => item.name));
    } else if (selectionMode === 'CHOSEN' && choice.category && choice.category !== 'Mixta') {
      if (!categories.some((item) => item.name === choice.category)) throw new BadRequestException('Esta categoría necesita al menos 7 preguntas disponibles');
      category = choice.category;
    }
    // Sin categorías jugables la ruleta cae a «Mixta»: se sortea sobre todo el
    // banco habilitado en lugar de dejar al estudiante sin partida.
    if (questions.length < QUESTION_COUNT) {
      if (selectionMode === 'ROULETTE') category = 'Mixta';
      questions = randomQuestions(category === 'Mixta' ? pool : pool.filter((question) => question.category === category));
    }
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

  /**
   * Orden de las preguntas para UN participante.
   *
   * Las siete preguntas son las mismas para ambos y eso no se toca: es lo que
   * hace comparable el marcador. El bono «elegir tema» solo cambia el ORDEN en
   * que las ve quien lo gastó — adelanta una pregunta del tema que pidió y manda
   * la que tocaba al lugar que deja libre. Ninguno de los dos recibe una
   * pregunta que el otro no vaya a responder.
   *
   * Las filas antiguas del 50/50 guardan un array de opciones en `options`; las
   * del bono de tema guardan un objeto con el intercambio. Se distinguen por la
   * forma, así que los duelos que ya estaban en curso siguen funcionando.
   */
  private applySwap(questions: DuelQuestion[], power: { options: unknown } | null) {
    const swap = this.swapOf(power);
    if (!swap) return questions;
    const [from, to] = swap;
    if (from >= questions.length || to >= questions.length) return questions;
    const ordered = [...questions];
    [ordered[from], ordered[to]] = [ordered[to], ordered[from]];
    return ordered;
  }

  private swapOf(power: { options: unknown } | null): [number, number] | null {
    if (!power || Array.isArray(power.options) || !power.options || typeof power.options !== 'object') return null;
    const value = (power.options as { swap?: unknown }).swap;
    if (!Array.isArray(value) || value.length !== 2) return null;
    const [from, to] = value;
    return Number.isInteger(from) && Number.isInteger(to) ? [from as number, to as number] : null;
  }

  /** Opciones recortadas del 50/50, solo cuando el bono se gastó en esa forma. */
  private fiftyOptions(power: { options: unknown } | null) {
    return power && Array.isArray(power.options)
      ? power.options.filter((option): option is string => typeof option === 'string')
      : null;
  }

  private async member(actor: ClassroomActor, duelId: string) {
    const duel = await this.prisma.classroomDuel.findFirst({
      where: { id: duelId, institutionId: actor.institutionId },
      include: {
        inviter: { select: { student: { select: { firstName: true, lastName: true } } } },
        invitee: { select: { student: { select: { firstName: true, lastName: true } } } },
      },
    });
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
    const all = Array.isArray(duel.questions) ? duel.questions as DuelQuestion[] : [];
    // Ambos responden las mismas siete; solo el orden cambia para quien gastó
    // el bono de tema.
    const questions = this.applySwap(all, powerUse);
    const finished = duel.status === 'COMPLETED';
    const current = duel.status === 'ACTIVE' && mine.length < questions.length ? questions[mine.length] : null;
    const fifty = powerUse?.ordinal === mine.length ? this.fiftyOptions(powerUse) : null;
    const currentOptions = fifty ?? current?.options;
    const isInvitee = duel.inviteeEnrollmentId === enrollmentId;
    return {
      id: duel.id, classroomId: duel.classroomId, status: duel.status, category: duel.category, selectionMode: duel.selectionMode, isInvitee,
      // El rival viaja con nombre corto e id de matrícula: el marcador necesita el
      // nombre y el botón de revancha necesita el id, que el estudiante ya podía
      // ver en la lista de compañeros del aula.
      opponent: displayName(isInvitee ? duel.inviter : duel.invitee),
      opponentEnrollmentId: isInvitee ? duel.inviterEnrollmentId : duel.inviteeEnrollmentId,
      myProgress: mine.length, opponentProgress: theirs.length, total: questions.length,
      powerAvailable: !powerUse,
      // Temas que el bono puede adelantar: los de las rondas que aún faltan, sin
      // contar la que ya está en pantalla.
      powerCategories: powerUse || duel.status !== 'ACTIVE'
        ? []
        : [...new Set(questions.slice(mine.length + 1).map((question) => question.category))].sort((a, b) => a.localeCompare(b, 'es')),
      question: current ? { ordinal: mine.length, text: current.text, options: currentOptions, category: current.category, powerApplied: !!fifty } : null,
      result: finished ? {
        myScore: mine.filter((answer) => answer.isCorrect).length,
        opponentScore: theirs.filter((answer) => answer.isCorrect).length,
        review: questions.map((question, ordinal) => ({ text: question.text, correctAnswer: question.correctAnswer, explanation: question.explanation, myCorrect: mine.find((answer) => answer.ordinal === ordinal)?.isCorrect ?? false })),
      } : null,
    };
  }

  /**
   * Un solo bono por duelo, y el estudiante decide en qué gastarlo:
   *  · `FIFTY` — descarta dos opciones incorrectas de la pregunta actual;
   *  · `CATEGORY` — elige el tema de la SIGUIENTE ronda en lugar de dejarlo a la
   *    ruleta. No añade preguntas nuevas: adelanta una de las siete que ya están
   *    congeladas, así que ambos siguen respondiendo exactamente el mismo
   *    conjunto y el marcador sigue siendo comparable.
   *
   * Que el bono sea uno solo es lo que lo convierte en decisión: gastarlo pronto
   * para asegurar una pregunta de tu tema fuerte, o guardarlo para salvar una
   * difícil.
   */
  async usePower(actor: ClassroomActor, duelId: string, ordinal: number, kind: 'FIFTY' | 'CATEGORY' = 'FIFTY', category?: string) {
    const { duel, enrollmentId } = await this.member(actor, duelId);
    if (duel.status !== 'ACTIVE') throw new ConflictException('El duelo no está activo');
    const questions = Array.isArray(duel.questions) ? duel.questions as DuelQuestion[] : [];
    if (!Number.isInteger(ordinal) || ordinal < 0 || ordinal >= questions.length) throw new BadRequestException('Ronda no válida');
    if (kind === 'FIFTY' && questions[ordinal].options.length < 3) throw new BadRequestException('El descarte necesita una pregunta con al menos 3 opciones');
    if (kind === 'CATEGORY' && (typeof category !== 'string' || !category.trim())) throw new BadRequestException('Elige un tema');
    try {
      await this.prisma.$transaction(async (tx) => {
        const current = await tx.classroomDuel.findUnique({ where: { id: duelId }, select: { status: true } });
        if (current?.status !== 'ACTIVE') throw new ConflictException('El duelo no está activo');
        const answered = await tx.classroomDuelAnswer.count({ where: { duelId, enrollmentId } });
        if (answered !== ordinal) throw new ConflictException('El bono solo sirve en la pregunta actual');
        const used = await tx.classroomDuelPowerUse.findUnique({ where: { duelId_enrollmentId: { duelId, enrollmentId } }, select: { id: true } });
        if (used) throw new ConflictException('Ya usaste tu bono en este duelo');

        if (kind === 'CATEGORY') {
          // Se busca solo entre las rondas que faltan: el bono decide el tema de
          // la SIGUIENTE, nunca cambia la pregunta que ya está en pantalla.
          const target = questions.findIndex((question, index) => index > ordinal && question.category === category);
          if (target < 0) throw new BadRequestException('Ese tema ya no queda en las rondas que faltan');
          await tx.classroomDuelPowerUse.create({
            data: {
              institutionId: actor.institutionId, duelId, enrollmentId, ordinal,
              options: { kind: 'CATEGORY', category, swap: [ordinal + 1, target] } as Prisma.InputJsonValue,
            },
          });
          return;
        }

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
    const power = await this.prisma.classroomDuelPowerUse.findUnique({ where: { duelId_enrollmentId: { duelId, enrollmentId } }, select: { options: true } });
    // Se califica contra la secuencia de ESTE jugador: si gastó el bono de tema,
    // su ronda N es otra de las mismas siete preguntas.
    const questions = this.applySwap(Array.isArray(duel.questions) ? duel.questions as DuelQuestion[] : [], power);
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
