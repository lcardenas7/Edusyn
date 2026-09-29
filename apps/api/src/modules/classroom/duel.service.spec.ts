import { DuelService } from './duel.service';

const actor = { userId: 'user-1', institutionId: 'school-1', roles: ['ESTUDIANTE'], isSuperAdmin: false };
const baseDuel = {
  id: 'duel-1', institutionId: 'school-1', classroomId: 'class-1', inviterEnrollmentId: 'enroll-1', inviteeEnrollmentId: 'enroll-2',
  status: 'ACTIVE', expiresAt: new Date(Date.now() + 3600000),
  inviter: { student: { firstName: 'Ana', lastName: 'Gómez' } },
  invitee: { student: { firstName: 'Beto', lastName: 'Ruiz' } },
  questions: [{ id: 'q1', text: '¿Cuánto es 2 + 2?', options: ['3', '4'], correctAnswer: '4', explanation: 'Dos y dos son cuatro.' }],
};

function setup(duel: any = baseDuel, answers: Array<{ enrollmentId: string; ordinal: number; isCorrect: boolean }> = [], powerUse: { ordinal: number; options: unknown } | null = null) {
  const prisma = {
    classroomDuel: { findFirst: jest.fn().mockResolvedValue(duel), findMany: jest.fn(), updateMany: jest.fn(), count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue({ id: 'new-duel', category: 'Fracciones', selectionMode: 'CHOSEN' }) },
    classroomDuelAnswer: { findMany: jest.fn().mockResolvedValue(answers) },
    classroomDuelPowerUse: { findUnique: jest.fn().mockResolvedValue(powerUse) },
    studentEnrollment: { findFirst: jest.fn().mockResolvedValue({ id: 'enroll-2' }), findMany: jest.fn() },
  };
  const access = {
    classroomInScope: jest.fn().mockResolvedValue({ teacherAssignment: { teacherId: 'teacher-1', groupId: 'group-1', academicYearId: 'year-1' } }),
    studentEnrollmentInClassroom: jest.fn().mockResolvedValue('enroll-1'),
  };
  return { service: new DuelService(prisma as any, access as any), prisma, access };
}

describe('DuelService privacy', () => {
  it('sends only the current question while the match is active', async () => {
    const { service } = setup();
    const state = await service.get(actor, 'duel-1');
    expect(state.question).toMatchObject({ ordinal: 0, text: '¿Cuánto es 2 + 2?', options: ['3', '4'] });
    expect(state.result).toBeNull();
    expect(JSON.stringify(state)).not.toContain('correctAnswer');
    expect(JSON.stringify(state)).not.toContain('Dos y dos son cuatro');
  });

  it('reveals scores and explanations only after both finish', async () => {
    const { service } = setup({ ...baseDuel, status: 'COMPLETED' }, [
      { enrollmentId: 'enroll-1', ordinal: 0, isCorrect: true },
      { enrollmentId: 'enroll-2', ordinal: 0, isCorrect: false },
    ]);
    const state = await service.get(actor, 'duel-1');
    expect(state.question).toBeNull();
    expect(state.result).toMatchObject({ myScore: 1, opponentScore: 0, review: [{ correctAnswer: '4', myCorrect: true }] });
  });

  it('does not reveal someone else’s duel', async () => {
    const { service } = setup({ ...baseDuel, inviterEnrollmentId: 'enroll-3', inviteeEnrollmentId: 'enroll-2' });
    await expect(service.get(actor, 'duel-1')).rejects.toThrow('Duelo no encontrado');
  });

  it('keeps the same narrowed options after a 50/50 power is used', async () => {
    const duel = { ...baseDuel, questions: [{ ...baseDuel.questions[0], options: ['3', '4', '5', '6'] }] };
    const { service } = setup(duel, [], { ordinal: 0, options: ['4', '6'] });
    const state = await service.get(actor, 'duel-1');
    expect(state.powerAvailable).toBe(false);
    expect(state.question).toMatchObject({ options: ['4', '6'], powerApplied: true });
    expect(JSON.stringify(state)).not.toContain('correctAnswer');
  });

  it('hides the question bank source ids from the student payload', async () => {
    const { service } = setup();
    const state = await service.get(actor, 'duel-1');
    expect(state.question).not.toHaveProperty('id');
  });

  it('names the opponent from the side the viewer is not on', async () => {
    const { service } = setup();
    const state = await service.get(actor, 'duel-1');
    expect(state).toMatchObject({ opponent: 'Beto R.', opponentEnrollmentId: 'enroll-2', isInvitee: false });
  });

  it('freezes seven questions from the category chosen by the student', async () => {
    const { service, prisma } = setup();
    const pool = ['Fracciones', 'Geometría'].flatMap((category) => Array.from({ length: 7 }, (_, index) => ({
      id: `${category}-${index}`, category, text: `Pregunta ${index} de ${category}`, options: ['A', 'B', 'C'], correctAnswer: 'A', explanation: null,
    })));
    jest.spyOn(service as any, 'pool').mockResolvedValue(pool);
    await service.invite(actor, 'class-1', 'enroll-2', { category: 'Fracciones', selectionMode: 'CHOSEN' });
    const data = prisma.classroomDuel.create.mock.calls[0][0].data;
    expect(data.category).toBe('Fracciones');
    expect(data.questions).toHaveLength(7);
    expect(data.questions.every((question: { category: string }) => question.category === 'Fracciones')).toBe(true);
  });

  it('draws a category per round when the wheel decides', async () => {
    const { service, prisma } = setup();
    const pool = ['Fracciones', 'Geometría', 'Medida'].flatMap((category) => Array.from({ length: 7 }, (_, index) => ({
      id: `${category}-${index}`, category, text: `Pregunta ${index} de ${category}`, options: ['A', 'B', 'C'], correctAnswer: 'A', explanation: null,
    })));
    jest.spyOn(service as any, 'pool').mockResolvedValue(pool);
    await service.invite(actor, 'class-1', 'enroll-2', { selectionMode: 'ROULETTE' });
    const data = prisma.classroomDuel.create.mock.calls[0][0].data;
    expect(data.category).toBe('Ruleta');
    expect(data.questions).toHaveLength(7);
    // Las siete preguntas son distintas y cada una conserva su propia categoría.
    expect(new Set(data.questions.map((question: { id: string }) => question.id)).size).toBe(7);
    expect(data.questions.every((question: { category: string }) => ['Fracciones', 'Geometría', 'Medida'].includes(question.category))).toBe(true);
  });

  it('draws a random rival from the classmates with no open duel', async () => {
    const { service, prisma } = setup();
    prisma.studentEnrollment.findMany = jest.fn().mockResolvedValue([{ id: 'enroll-2' }, { id: 'enroll-3' }, { id: 'enroll-4' }]);
    // Ya hay una partida abierta con enroll-3: no puede salir sorteado.
    prisma.classroomDuel.findMany = jest.fn().mockResolvedValue([{ inviterEnrollmentId: 'enroll-1', inviteeEnrollmentId: 'enroll-3' }]);
    const pool = Array.from({ length: 7 }, (_, index) => ({ id: `q${index}`, category: 'Mixta', text: `P${index}`, options: ['A', 'B'], correctAnswer: 'A', explanation: null }));
    jest.spyOn(service as any, 'pool').mockResolvedValue(pool);

    for (let round = 0; round < 12; round++) {
      prisma.studentEnrollment.findFirst = jest.fn().mockImplementation(({ where }: any) => Promise.resolve({ id: where.id }));
      await service.invite(actor, 'class-1', undefined, { rivalMode: 'RANDOM' });
      const chosen = prisma.classroomDuel.create.mock.calls.at(-1)![0].data.inviteeEnrollmentId;
      expect(['enroll-2', 'enroll-4']).toContain(chosen);
    }
  });

  it('refuses a random rival when every classmate already has an open duel', async () => {
    const { service, prisma } = setup();
    prisma.studentEnrollment.findMany = jest.fn().mockResolvedValue([{ id: 'enroll-2' }]);
    prisma.classroomDuel.findMany = jest.fn().mockResolvedValue([{ inviterEnrollmentId: 'enroll-1', inviteeEnrollmentId: 'enroll-2' }]);
    await expect(service.invite(actor, 'class-1', undefined, { rivalMode: 'RANDOM' })).rejects.toThrow('No hay compañeros libres');
  });

  it('offers only the themes still pending as targets for the bonus', async () => {
    const questions = ['Arte', 'Deportes', 'Arte', 'Ciencias', 'Deportes', 'Ciencias', 'Arte']
      .map((category, index) => ({ id: `q${index}`, category, text: `P${index}`, options: ['A', 'B', 'C'], correctAnswer: 'A', explanation: null }));
    const { service } = setup({ ...baseDuel, questions }, [{ enrollmentId: 'enroll-1', ordinal: 0, isCorrect: true }]);
    const state = await service.get(actor, 'duel-1');
    // Va por la ronda 1 (índice 1): se puede adelantar un tema de las rondas 2 a 6,
    // nunca el de la pregunta que ya tiene en pantalla.
    expect(state.powerCategories).toEqual(['Arte', 'Ciencias', 'Deportes']);
  });

  it('reorders only the rounds of the player who spent the theme bonus', async () => {
    const questions = ['Arte', 'Deportes', 'Ciencias'].concat(['Arte', 'Deportes', 'Ciencias', 'Arte'])
      .map((category, index) => ({ id: `q${index}`, category, text: `P${index}`, options: ['A', 'B', 'C'], correctAnswer: 'A', explanation: null }));
    // Gastó el bono en la ronda 0 pidiendo «Ciencias»: la ronda 1 pasa a ser la
    // pregunta 2, que era de Ciencias.
    const { service } = setup(
      { ...baseDuel, questions },
      [{ enrollmentId: 'enroll-1', ordinal: 0, isCorrect: true }],
      { ordinal: 0, options: { kind: 'CATEGORY', category: 'Ciencias', swap: [1, 2] } },
    );
    const state = await service.get(actor, 'duel-1');
    expect(state.question).toMatchObject({ ordinal: 1, category: 'Ciencias', text: 'P2' });
    // Sigue siendo el mismo conjunto de siete preguntas.
    expect(state.total).toBe(7);
  });

  it('keeps the 50/50 bonus working for duels that already used it', async () => {
    const duel = { ...baseDuel, questions: [{ ...baseDuel.questions[0], options: ['3', '4', '5', '6'] }] };
    const { service } = setup(duel, [], { ordinal: 0, options: ['4', '6'] });
    const state = await service.get(actor, 'duel-1');
    expect(state.question).toMatchObject({ options: ['4', '6'], powerApplied: true })
    expect(state.powerCategories).toEqual([]);
  });

  it('falls back to a mixed draw when no category reaches seven questions', async () => {
    const { service, prisma } = setup();
    const pool = ['Ritmo', 'Color'].flatMap((category) => Array.from({ length: 4 }, (_, index) => ({
      id: `${category}-${index}`, category, text: `Pregunta ${index}`, options: ['A', 'B'], correctAnswer: 'A', explanation: null,
    })));
    jest.spyOn(service as any, 'pool').mockResolvedValue(pool);
    await service.invite(actor, 'class-1', 'enroll-2', { selectionMode: 'ROULETTE' });
    const data = prisma.classroomDuel.create.mock.calls[0][0].data;
    expect(data.category).toBe('Mixta');
    expect(data.questions).toHaveLength(7);
    expect(new Set(data.questions.map((question: { id: string }) => question.id)).size).toBe(7);
  });
});

function student(firstName: string, lastName: string) {
  return { student: { firstName, lastName } };
}

/**
 * Duelo terminado: `mine`/`theirs` son los aciertos de cada lado sobre 7.
 * Se generan las 7 respuestas de cada participante para que el porcentaje de
 * acierto se calcule sobre respuestas reales, como en producción.
 */
function completed(inviterId: string, inviteeId: string, inviter: object, invitee: object, mine: number, theirs: number) {
  const answers = [
    ...Array.from({ length: 7 }, (_, index) => ({ enrollmentId: inviterId, isCorrect: index < mine })),
    ...Array.from({ length: 7 }, (_, index) => ({ enrollmentId: inviteeId, isCorrect: index < theirs })),
  ];
  return { inviterEnrollmentId: inviterId, inviteeEnrollmentId: inviteeId, inviter, invitee, answers };
}

/** Los duelos se pasan del más antiguo al más nuevo; el servicio los pide al revés. */
function rankingSetup(duelsOldestFirst: object[]) {
  const duels = [...duelsOldestFirst].reverse();
  const prisma = {
    classroomDuel: { findMany: jest.fn().mockResolvedValue(duels) },
    classroom: { findMany: jest.fn().mockResolvedValue([{ id: 'class-1' }, { id: 'class-2' }]) },
    group: { findFirst: jest.fn().mockResolvedValue({ name: '6A', gradeId: 'grade-6', grade: { name: '6.º' } }) },
  };
  const access = {
    classroomInScope: jest.fn().mockResolvedValue({ title: 'Artes', teacherAssignment: { teacherId: 'teacher-1', groupId: 'group-1', academicYearId: 'year-1' } }),
    studentEnrollmentInClassroom: jest.fn().mockResolvedValue('enroll-1'),
  };
  return { service: new DuelService(prisma as any, access as any), prisma };
}

describe('DuelService ranking', () => {
  it('awards points per duel, not per correct answer', async () => {
    const { service } = rankingSetup([
      completed('enroll-1', 'enroll-2', student('Ana', 'Gómez'), student('Beto', 'Ruiz'), 5, 3),
      completed('enroll-1', 'enroll-3', student('Ana', 'Gómez'), student('Caro', 'Díaz'), 4, 4),
    ]);
    const table = await service.ranking(actor, 'class-1', 'group');
    // Ana acertó 9 preguntas y suma 4 puntos: una victoria (3) y un empate (1).
    expect(table.rows.find((row) => row.name === 'Ana G.')).toMatchObject({ played: 2, wins: 1, draws: 1, correct: 9, points: 4 });
    expect(table.rows.find((row) => row.name === 'Beto R.')).toMatchObject({ played: 1, losses: 1, correct: 3, points: 0 });
    expect(table.rows.find((row) => row.name === 'Caro D.')).toMatchObject({ played: 1, draws: 1, points: 1 });
  });

  it('adds 2 points for a perfect duel', async () => {
    const { service } = rankingSetup([completed('enroll-1', 'enroll-2', student('Ana', 'Gómez'), student('Beto', 'Ruiz'), 7, 3)]);
    const table = await service.ranking(actor, 'class-1', 'group');
    expect(table.rows.find((row) => row.name === 'Ana G.')).toMatchObject({ wins: 1, perfects: 1, points: 5 });
  });

  it('adds 1 point for beating someone ahead in the table', async () => {
    const { service } = rankingSetup([
      // Ana se pone en cabeza con 3 puntos…
      completed('enroll-1', 'enroll-3', student('Ana', 'Gómez'), student('Caro', 'Díaz'), 5, 2),
      // …y Beto, que venía de cero, le gana: 3 de victoria + 1 por remontar.
      completed('enroll-2', 'enroll-1', student('Beto', 'Ruiz'), student('Ana', 'Gómez'), 4, 1),
    ]);
    const table = await service.ranking(actor, 'class-1', 'group');
    expect(table.rows.find((row) => row.name === 'Beto R.')).toMatchObject({ wins: 1, upsets: 1, points: 4 });
    // Ana no recibe bonificación por su victoria: Caro no iba por delante.
    expect(table.rows.find((row) => row.name === 'Ana G.')).toMatchObject({ wins: 1, upsets: 0, points: 3 });
  });

  it('awards the upset when the opponent leads on a tie-break, not only on points', async () => {
    const { service } = rankingSetup([
      completed('enroll-1', 'enroll-3', student('Ana', 'Gómez'), student('Dani', 'Peña'), 6, 0),
      completed('enroll-2', 'enroll-4', student('Beto', 'Ruiz'), student('Eva', 'Lara'), 4, 0),
      // Both begin the third duel with 3 points; Ana is ahead on correct answers.
      completed('enroll-2', 'enroll-1', student('Beto', 'Ruiz'), student('Ana', 'Gómez'), 5, 2),
    ]);
    const table = await service.ranking(actor, 'class-1', 'group');
    expect(table.rows.find((row) => row.name === 'Beto R.')).toMatchObject({ points: 7, upsets: 1 });
  });

  it('breaks ties by correct answers, then matches played, then name', async () => {
    const { service } = rankingSetup([
      // Ana y Beto ganan uno cada uno: 3 puntos. Ana acierta más → va primero.
      completed('enroll-1', 'enroll-4', student('Ana', 'Gómez'), student('Dani', 'Peña'), 7, 1),
      completed('enroll-2', 'enroll-5', student('Beto', 'Ruiz'), student('Eva', 'Lara'), 5, 2),
    ]);
    const table = await service.ranking(actor, 'class-1', 'group');
    expect(table.rows.slice(0, 2).map((row) => row.name)).toEqual(['Ana G.', 'Beto R.']);
    expect(table.rows[0].rank).toBe(1);
    expect(table.rows[1].rank).toBe(2);
  });

  it('marks the viewer and reports their position', async () => {
    const { service } = rankingSetup([
      completed('enroll-2', 'enroll-3', student('Beto', 'Ruiz'), student('Caro', 'Díaz'), 7, 0),
      completed('enroll-1', 'enroll-3', student('Ana', 'Gómez'), student('Caro', 'Díaz'), 3, 5),
    ]);
    const table = await service.ranking(actor, 'class-1', 'group');
    const me = table.rows.find((row) => row.isMe);
    expect(me?.name).toBe('Ana G.');
    expect(table.myRank).toBe(me?.rank);
  });

  it('computes accuracy from stored answers only', async () => {
    const { service } = rankingSetup([completed('enroll-1', 'enroll-2', student('Ana', 'Gómez'), student('Beto', 'Ruiz'), 7, 0)]);
    const table = await service.ranking(actor, 'class-1', 'group');
    expect(table.rows.find((row) => row.isMe)).toMatchObject({ correct: 7, answered: 7, accuracy: 100 });
    expect(table.rows.find((row) => row.name === 'Beto R.')).toMatchObject({ correct: 0, answered: 7, accuracy: 0 });
  });

  it('never leaks question text or correct answers', async () => {
    const { service } = rankingSetup([completed('enroll-1', 'enroll-2', student('Ana', 'Gómez'), student('Beto', 'Ruiz'), 4, 3)]);
    const payload = JSON.stringify(await service.ranking(actor, 'class-1', 'group'));
    expect(payload).not.toContain('correctAnswer');
    expect(payload).not.toContain('explanation');
  });

  it('widens the reach with each scope and never leaves the institution', async () => {
    const { service, prisma } = rankingSetup([]);

    await service.ranking(actor, 'class-1', 'group');
    expect(prisma.classroomDuel.findMany.mock.calls[0][0].where.classroomId).toEqual({ in: ['class-1'] });
    expect(prisma.classroom.findMany).not.toHaveBeenCalled();

    await service.ranking(actor, 'class-1', 'grade');
    expect(prisma.classroomDuel.findMany.mock.calls[1][0].where.classroomId).toEqual({ in: ['class-1', 'class-2'] });
    expect(prisma.classroom.findMany.mock.calls[0][0].where.teacherAssignment.group.gradeId).toBe('grade-6');

    await service.ranking(actor, 'class-1', 'general');
    // Sin filtro de grado, pero siempre dentro de la institución y del año en curso.
    const general = prisma.classroom.findMany.mock.calls[1][0].where;
    expect(general.teacherAssignment.group).toBeUndefined();
    expect(general.institutionId).toBe('school-1');
    expect(general.teacherAssignment.academicYearId).toBe('year-1');
    expect(prisma.classroomDuel.findMany.mock.calls.every((call: any[]) => call[0].where.institutionId === 'school-1')).toBe(true);
  });

  it('counts only completed duels', async () => {
    const { service, prisma } = rankingSetup([]);
    await service.ranking(actor, 'class-1', 'group');
    expect(prisma.classroomDuel.findMany.mock.calls[0][0].where.status).toBe('COMPLETED');
  });
});

/** Duelo del perfil: `mine` marca ronda a ronda si el jugador acertó. */
function jugado(categorias: string[], mine: boolean[], theirScore: number) {
  return {
    questions: categorias.map((category, index) => ({ id: `q${index}`, category, text: '', options: [], correctAnswer: '', explanation: null })),
    answers: [
      ...mine.map((isCorrect, ordinal) => ({ enrollmentId: 'enroll-1', ordinal, isCorrect })),
      ...mine.map((_, ordinal) => ({ enrollmentId: 'enroll-9', ordinal, isCorrect: ordinal < theirScore })),
    ],
  };
}

function perfilSetup(duels: object[]) {
  const prisma = {
    classroomDuel: { findMany: jest.fn().mockImplementation(({ select }: any) => Promise.resolve(select?.questions ? duels : [])) },
    classroom: { findMany: jest.fn().mockResolvedValue([{ id: 'class-1' }]) },
    group: { findFirst: jest.fn().mockResolvedValue({ name: '6A', gradeId: 'grade-6', grade: { name: '6.º' } }) },
  };
  const access = {
    classroomInScope: jest.fn().mockResolvedValue({ title: 'Artes', teacherAssignment: { teacherId: 'teacher-1', groupId: 'group-1', academicYearId: 'year-1' } }),
    studentEnrollmentInClassroom: jest.fn().mockResolvedValue('enroll-1'),
  };
  return { service: new DuelService(prisma as any, access as any), prisma };
}

const SIETE = (tema: string) => Array.from({ length: 7 }, () => tema);

describe('DuelService arena profile', () => {
  it('shows current-season points and unlocks upset badges from the general ranking', async () => {
    const { service } = perfilSetup([]);
    jest.spyOn(service, 'ranking').mockResolvedValue({ rows: [{ isMe: true, upsets: 2, points: 8 }] } as any);
    const profile = await service.profile(actor, 'class-1');
    expect(profile.points).toBe(8);
    expect(profile.badges.find((badge) => badge.code === 'UPSET_1')).toMatchObject({ current: 1, earned: true });
    expect(profile.badges.find((badge) => badge.code === 'UPSET_10')).toMatchObject({ current: 2, earned: false });
  });

  it('counts wins, accuracy and the best streak', async () => {
    const { service } = perfilSetup([
      jugado(SIETE('Ciencias'), [true, true, true, true, true, false, false], 3),
      jugado(SIETE('Ciencias'), [true, true, true, true, false, false, false], 2),
      jugado(SIETE('Ciencias'), [false, false, true, false, false, false, false], 6),
    ]);
    const me = await service.profile(actor, 'class-1');
    expect(me).toMatchObject({ played: 3, wins: 2, losses: 1, correct: 10, answered: 21, bestStreak: 2, currentStreak: 0 });
    expect(me.accuracy).toBe(48);
  });

  it('breaks correct answers down by category', async () => {
    const { service } = perfilSetup([
      jugado(['Arte', 'Arte', 'Deportes', 'Deportes', 'Arte', 'Deportes', 'Arte'], [true, true, false, true, true, false, true], 2),
    ]);
    const me = await service.profile(actor, 'class-1');
    expect(me.categories).toEqual([
      { name: 'Arte', correct: 4, answered: 4, duels: 1, accuracy: 100 },
      { name: 'Deportes', correct: 1, answered: 3, duels: 1, accuracy: 33 },
    ]);
  });

  it('awards the first-win and perfect-duel badges, and keeps the rest locked with progress', async () => {
    const { service } = perfilSetup([jugado(SIETE('Ciencias'), [true, true, true, true, true, true, true], 4)]);
    const me = await service.profile(actor, 'class-1');
    const find = (code: string) => me.badges.find((badge) => badge.code === code);
    expect(find('WIN_1')).toMatchObject({ earned: true, current: 1, target: 1 });
    expect(find('PERFECT_1')).toMatchObject({ earned: true });
    expect(find('WIN_10')).toMatchObject({ earned: false, current: 1, target: 10 });
    expect(find('HIT_25')).toMatchObject({ earned: false, current: 7, target: 25 });
    expect(me.earnedCount).toBe(me.badges.filter((badge) => badge.earned).length);
  });

  it('creates a badge ladder for each category actually played', async () => {
    const { service } = perfilSetup([jugado(SIETE('Geografía'), [true, true, true, true, true, true, true], 1)]);
    const me = await service.profile(actor, 'class-1');
    expect(me.badges.find((badge) => badge.code === 'CAT_Geografía_15')).toMatchObject({ family: 'categoria', current: 7, target: 15, earned: false });
    expect(me.badges.some((badge) => badge.family === 'categoria' && badge.name.includes('Geografía'))).toBe(true);
  });

  it('reads only the duels the viewer played', async () => {
    const { service, prisma } = perfilSetup([]);
    await service.profile(actor, 'class-1');
    const where = prisma.classroomDuel.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('COMPLETED');
    expect(where.institutionId).toBe('school-1');
    expect(where.OR).toEqual([{ inviterEnrollmentId: 'enroll-1' }, { inviteeEnrollmentId: 'enroll-1' }]);
  });
});
