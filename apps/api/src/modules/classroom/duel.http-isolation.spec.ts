import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
import request = require('supertest');
import { PrismaService } from '../../prisma/prisma.service';
import { JwtStrategy } from '../auth/jwt.strategy';
import { ClassroomTenantAccessService } from './classroom-tenant-access.service';
import { DuelController } from './duel.controller';
import { DuelService } from './duel.service';

// Real HTTP/JWT/guards/access/service. Independent synthetic rows evaluate query predicates.
function matches(row: any, where: any): boolean {
  return !!row && Object.entries(where || {}).every(([key, value]: [string, any]) => {
    if (key === 'OR') return value.some((part: any) => matches(row, part));
    if (value instanceof Date) return +row[key] === +value;
    if (value && typeof value === 'object') {
      if ('in' in value) return value.in.includes(row[key]);
      if ('not' in value) return row[key] !== value.not;
      if ('gte' in value) return row[key] >= value.gte;
      if ('gt' in value) return row[key] > value.gt;
      if ('lt' in value) return row[key] < value.lt;
      if (key === 'duelId_enrollmentId') return matches(row, value);
      return matches(row[key], value);
    }
    return row[key] === value;
  });
}
function project(row: any, args: any = {}): any {
  if (!row) return null;
  const selection = args.select || args.include;
  if (!selection) return row;
  const result: any = args.select ? {} : { ...row };
  for (const [key, value] of Object.entries(selection) as [string, any][]) {
    if (key === '_count') {
      result._count = Object.fromEntries(Object.entries(value.select).map(([relation, detail]: [string, any]) => [relation, (row[relation] || []).filter((item: any) => matches(item, detail?.where)).length]));
    } else if (value === true) result[key] = row[key];
    else if (Array.isArray(row[key])) result[key] = row[key].filter((item: any) => matches(item, value.where)).map((item: any) => project(item, value));
    else result[key] = project(row[key], value);
  }
  return result;
}

describe('Duelos · HTTP isolation, participants and institutional relations', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let prisma: any;
  let classrooms: any[];
  let enrollments: any[];
  let students: any[];
  let activities: any[];
  let duels: any[];
  let answers: any[];
  let powers: any[];
  let banks: any[];
  let writes: any[];

  beforeEach(async () => {
    answers = []; powers = []; writes = [];
    const groups = ['A', 'B'].map(institutionId => ({ id: `group-${institutionId}`, gradeId: `grade-${institutionId}`, name: 'Grupo', campus: { institutionId }, grade: { id: `grade-${institutionId}`, name: 'Sexto', institutionId } }));
    classrooms = ['A', 'B'].map(institutionId => ({ id: `class-${institutionId}`, title: `Aula ${institutionId}`, institutionId, isPersonal: false,
      teacherAssignment: { id: `assignment-${institutionId}`, institutionId, teacherId: 'shared-teacher', groupId: `group-${institutionId}`, academicYearId: `year-${institutionId}`, academicYear: { institutionId }, group: groups.find(g => g.id === `group-${institutionId}`), subject: { area: { institutionId } } },
    }));
    classrooms.push({ ...structuredClone(classrooms[0]), id: 'personal-A', isPersonal: true });
    const broken = structuredClone(classrooms[0]); broken.id = 'broken-A'; broken.teacherAssignment.group.campus.institutionId = 'B'; classrooms.push(broken);
    students = ['A', 'B'].flatMap(institutionId => ['self', 'peer', 'third'].map(side => ({ id: `student-${side}-${institutionId}`, userId: side === 'self' ? 'shared-student' : `${side}-user`, institutionId, isActive: true, firstName: `${side}-${institutionId}`, lastName: `Apellido-${institutionId}` })));
    enrollments = students.map(student => ({ id: `${student.id.replace('student-', '')}`, studentId: student.id, institutionId: student.institutionId, student,
      status: 'ACTIVE', groupId: `group-${student.institutionId}`, academicYearId: `year-${student.institutionId}`, academicYear: { institutionId: student.institutionId }, group: groups.find(g => g.id === `group-${student.institutionId}`),
    }));
    const questions = (suffix: string) => Array.from({ length: 7 }, (_, ordinal) => ({ id: `q-${suffix}-${ordinal}`, text: `Pregunta ${suffix} ${ordinal}`, options: ['Correcta', 'Dos', 'Tres', 'Cuatro'], correctAnswer: 'Correcta', explanation: `Explicación ${suffix} ${ordinal}`, category: 'Prueba' }));
    duels = ['A', 'B'].flatMap(institutionId => ['active', 'invited', 'completed'].map(kind => ({ id: `${kind}-${institutionId}`, institutionId, classroomId: `class-${institutionId}`, inviterEnrollmentId: `self-${institutionId}`, inviteeEnrollmentId: `peer-${institutionId}`,
      status: kind.toUpperCase(), category: 'Prueba', selectionMode: 'CHOSEN', questions: { version: 2, inviter: questions(`self-${institutionId}`), invitee: questions(`peer-${institutionId}`) },
      expiresAt: new Date(Date.now() + 86400000), createdAt: new Date(Date.now() - (kind === 'completed' ? 3 : 0) * 86400000), completedAt: kind === 'completed' ? new Date() : null,
    })));
    // Broken FKs deliberately retain institutionId A. A plain tenant column is insufficient.
    duels.push({ ...structuredClone(duels.find(d => d.id === 'completed-A')), id: 'foreign-player-A', inviteeEnrollmentId: 'peer-B' });
    duels.push({ ...structuredClone(duels.find(d => d.id === 'completed-A')), id: 'foreign-class-A', classroomId: 'class-B' });
    duels.push({ ...structuredClone(duels.find(d => d.id === 'completed-A')), id: 'broken-class-A', classroomId: 'broken-A' });
    activities = ['A', 'B'].map(institutionId => ({ id: `activity-${institutionId}`, classroomId: `class-${institutionId}`, classroom: classrooms.find(c => c.id === `class-${institutionId}`), title: 'Fuente', isPublished: true, isVisible: true, isRestrictedToAssigned: false, isRouteScoped: false, type: 'QUIZ', metadata: { duelEligible: true }, questions: [] }));
    banks = ['A', 'B'].map(institutionId => ({ id: `bank-${institutionId}`, institutionId, gradeId: `grade-${institutionId}`, title: 'Banco', category: 'Prueba', subjectArea: 'Ciencias', isPublished: true, isActive: true,
      questions: [...questions(institutionId).map(q => ({ ...q, institutionId, isActive: true, type: 'MULTIPLE_CHOICE' })), { ...questions('foreign')[0], institutionId: institutionId === 'A' ? 'B' : 'A', isActive: true, type: 'MULTIPLE_CHOICE' }],
    }));
    const hydrated = () => duels.map(row => ({ ...row, classroom: classrooms.find(c => c.id === row.classroomId), inviter: enrollments.find(e => e.id === row.inviterEnrollmentId), invitee: enrollments.find(e => e.id === row.inviteeEnrollmentId), answers: answers.filter(a => a.duelId === row.id), powerUses: powers.filter(p => p.duelId === row.id) }));
    const read = (rows: () => any[]) => ({
      findFirst: jest.fn(async (args: any) => project(rows().find(row => matches(row, args.where)), args)),
      findUnique: jest.fn(async (args: any) => project(rows().find(row => matches(row, args.where)), args)),
      findMany: jest.fn(async (args: any) => rows().filter(row => matches(row, args.where)).slice(0, args.take).map(row => project(row, args))),
      count: jest.fn(async ({ where }: any) => rows().filter(row => matches(row, where)).length),
    });
    prisma = {
      institution: { findUnique: jest.fn(async ({ where }) => ['A', 'B'].includes(where.id) ? { id: where.id } : null) },
      institutionUser: { findFirst: jest.fn(async () => null) },
      classroom: read(() => classrooms), group: read(() => groups), student: read(() => students), studentEnrollment: read(() => enrollments),
      classroomActivity: { ...read(() => activities), update: jest.fn(async ({ where, data }) => { const row = activities.find(a => matches(a, where)); if (!row) throw new Error('not found'); Object.assign(row, data); writes.push({ model: 'activity', ...data }); return row; }) },
      questionBankCollection: read(() => banks),
      questionBankItem: read(() => banks.flatMap(bank => bank.questions.map((q: any) => ({ ...q, collection: bank })))),
      classroomDuel: { ...read(hydrated),
        create: jest.fn(async ({ data, select }) => { const row = { id: 'new-duel', status: 'INVITED', createdAt: new Date(), ...data }; duels.push(row); writes.push({ model: 'duel', ...data }); return project(row, { select }); }),
        updateMany: jest.fn(async ({ where, data }) => { const selected = hydrated().filter(row => matches(row, where)); selected.forEach(row => { Object.assign(duels.find(d => d.id === row.id), data); writes.push({ model: 'duel-update', ...data }); }); return { count: selected.length }; }),
        update: jest.fn(async ({ where, data }) => { const row = hydrated().find(d => matches(d, where)); if (!row) throw new Error('not found'); Object.assign(duels.find(d => d.id === row.id), data); writes.push({ model: 'duel-update', ...data }); return row; }),
      },
      classroomDuelAnswer: { ...read(() => answers), create: jest.fn(async ({ data }) => { answers.push({ id: `answer-${answers.length}`, ...data }); writes.push({ model: 'answer', ...data }); return data; }) },
      classroomDuelPowerUse: { ...read(() => powers), create: jest.fn(async ({ data }) => { powers.push({ id: `power-${powers.length}`, ...data }); writes.push({ model: 'power', ...data }); return data; }) },
    };
    prisma.$transaction = jest.fn(async callback => {
      const snapshot = structuredClone({ duels, answers, powers, writes });
      try { return await callback(prisma); } catch (error) { ({ duels, answers, powers, writes } = snapshot); throw error; }
    });
    const secret = randomBytes(32).toString('hex'); jwt = new JwtService({ secret });
    const module = await Test.createTestingModule({ controllers: [DuelController], providers: [JwtStrategy, DuelService, ClassroomTenantAccessService,
      { provide: PrismaService, useValue: prisma }, { provide: ConfigService, useValue: { getOrThrow: () => secret } },
    ] }).compile();
    app = module.createNestApplication({ logger: false }); await app.init();
  });
  afterEach(async () => { await app?.close(); });
  const token = (institutionId: string | null, role = 'ESTUDIANTE', userId = 'shared-student', isSuperAdmin = false) => jwt.sign({ sub: userId, institutionId, roles: [role], isSuperAdmin }, { expiresIn: '1m' });
  const endpoints = (school: string, duelId = `active-${school}`) => [
    ['get', `/classrooms/class-${school}`, undefined], ['get', `/classrooms/class-${school}/status`, undefined],
    ['get', `/classrooms/class-${school}/ranking`, undefined], ['get', `/classrooms/class-${school}/me`, undefined],
    ['put', `/classrooms/class-${school}/sources/activity-${school}`, { enabled: true }],
    ['post', `/classrooms/class-${school}`, { opponentEnrollmentId: `peer-${school}` }],
    ['get', `/${duelId}`, undefined], ['post', `/${duelId}/accept`, {}], ['post', `/${duelId}/decline`, {}],
    ['post', `/${duelId}/answers`, { ordinal: 0, answer: 'Correcta' }], ['post', `/${duelId}/power`, { ordinal: 0 }],
  ] as const;
  const send = (endpoint: readonly any[], bearer?: string, query = '') => {
    const [method, path, body] = endpoint; let result = (request(app.getHttpServer()) as any)[method](`/classroom-duels${path}${query}`);
    if (bearer) result = result.auth(bearer, { type: 'bearer' }); return body ? result.send(body) : result;
  };
  const auth = (school: string, index: number) => index === 4 ? token(school, 'DOCENTE', 'shared-teacher') : token(school);

  describe.each([['A', 'B'], ['B', 'A']])('%s → %s', (own, foreign) => {
    it.each([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])('route %i rejects another institution before secondary queries/writes', async index => {
      await send(endpoints(foreign)[index], auth(own, index)).expect(404);
      expect(writes).toEqual([]);
      expect(prisma.classroomDuelAnswer.findMany).not.toHaveBeenCalled();
      expect(prisma.classroomDuelPowerUse.findUnique).not.toHaveBeenCalled();
    });
    it('dashboard hides inconsistent participants/classes and excludes foreign bank questions', async () => {
      const response = await send(endpoints(own)[0], token(own), `?institutionId=${foreign}`).expect(200);
      expect(response.body.questionCount).toBe(7);
      expect(response.body.duels.map((row: any) => row.id)).toEqual([`active-${own}`, `invited-${own}`, `completed-${own}`]);
      expect(response.body.peers.every((row: any) => row.id.endsWith(`-${own}`))).toBe(true);
    });
    it('get exposes only the current question, no future answer keys or explanations', async () => {
      const response = await send(endpoints(own)[6], token(own)).expect(200);
      expect(response.body.question.text).toBe(`Pregunta self-${own} 0`);
      expect(response.body.question).not.toHaveProperty('correctAnswer');
      expect(response.body.question).not.toHaveProperty('id');
      expect(JSON.stringify(response.body)).not.toContain('Explicación');
      expect(JSON.stringify(response.body)).not.toContain(`Pregunta self-${own} 1`);
      expect(response.body.result).toBeNull();
    });
    it('answer ignores injected participant, institution and score fields', async () => {
      const response = await send(['post', `/active-${own}/answers`, { ordinal: 0, answer: 'Dos', institutionId: foreign, enrollmentId: `peer-${foreign}`, isCorrect: true }], token(own)).expect(201);
      expect(writes).toEqual([expect.objectContaining({ model: 'answer', institutionId: own, enrollmentId: `self-${own}`, isCorrect: false })]);
      expect(response.body.myProgress).toBe(1);
      expect(response.body.lastResult).toMatchObject({ ordinal: 0, isCorrect: false });
      expect(response.body.question.ordinal).toBe(1);
      expect(response.body.question).not.toHaveProperty('correctAnswer');
      expect(JSON.stringify(response.body)).not.toContain(`Pregunta self-${own} 2`);
      expect(JSON.stringify(response.body)).not.toContain(`Explicación self-${own} 1`);
    });
    it('only the invited participant can accept, and a replay cannot change the decision', async () => {
      const route = endpoints(own, `invited-${own}`)[7];
      await send(route, token(own)).expect(409); expect(writes).toEqual([]);
      const response = await send(route, token(own, 'ESTUDIANTE', 'peer-user')).expect(201);
      expect(response.body.status).toBe('ACTIVE');
      await send(route, token(own, 'ESTUDIANTE', 'peer-user')).expect(409);
    });
    it('power belongs to the authenticated enrollment and discloses no answer key', async () => {
      const response = await send(endpoints(own)[10], token(own)).expect(201);
      expect(writes).toEqual([expect.objectContaining({ model: 'power', institutionId: own, enrollmentId: `self-${own}` })]);
      expect(response.body.question.options).toHaveLength(2);
      expect(response.body.question).not.toHaveProperty('correctAnswer');
      await send(endpoints(own)[10], token(own)).expect(409);
    });
    it('invitation rejects a foreign enrollment and freezes only in-scope questions', async () => {
      await send(['post', `/classrooms/class-${own}`, { opponentEnrollmentId: `peer-${foreign}` }], token(own)).expect(404);
      expect(writes).toEqual([]);
      await send(endpoints(own)[5], token(own)).expect(201);
      const created = writes.find(row => row.model === 'duel');
      expect(created).toMatchObject({ institutionId: own, inviterEnrollmentId: `self-${own}`, inviteeEnrollmentId: `peer-${own}` });
      expect(created.questions.inviter).toHaveLength(7);
      expect(JSON.stringify(created.questions)).not.toContain('foreign');
    });
    it('status counts only the current participant’s in-scope pending and active matches', async () => {
      const response = await send(endpoints(own)[1], token(own, 'ESTUDIANTE', 'peer-user')).expect(200);
      expect(response.body).toEqual({ role: 'student', ready: true, pendingInvites: 1, myTurn: 1 });
    });
  });

  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])('requires a valid JWT on route %i', async index => {
    await send(endpoints('A')[index]).expect(401); await send(endpoints('A')[index], 'invalid').expect(401);
    expect(prisma.classroom.findFirst).not.toHaveBeenCalled(); expect(writes).toEqual([]);
  });
  it.each(['ACUDIENTE', 'SECRETARIA', 'SUPERADMIN', 'ADMIN_INSTITUTIONAL'])('tenant role %s cannot bypass route permissions', async role => {
    for (const route of endpoints('A')) await send(route, token('A', role)).expect(403);
    expect(writes).toEqual([]);
  });
  it.each([6, 7, 8, 9, 10])('non-participant cannot access match route %i', async index => {
    await send(endpoints('A')[index], token('A', 'ESTUDIANTE', 'third-user')).expect(404);
    expect(writes).toEqual([]); expect(prisma.classroomDuelAnswer.findMany).not.toHaveBeenCalled();
  });
  it.each(['foreign-player-A', 'foreign-class-A', 'broken-class-A'])('all match actions hide inconsistent row %s', async id => {
    for (const index of [6, 7, 8, 9, 10]) await send(endpoints('A', id)[index], token('A')).expect(404);
    expect(writes).toEqual([]); expect(prisma.student.findFirst).not.toHaveBeenCalled();
  });
  it.each(['institutionId', 'student', 'academicYear', 'group'])('hides a participant with incoherent %s', async relation => {
    const peer = enrollments.find(e => e.id === 'peer-A');
    if (relation === 'institutionId') peer.institutionId = 'B';
    if (relation === 'student') peer.student = { ...peer.student, institutionId: 'B' };
    if (relation === 'academicYear') peer.academicYear = { institutionId: 'B' };
    if (relation === 'group') peer.group = { ...peer.group, campus: { institutionId: 'B' } };
    await send(endpoints('A')[6], token('A')).expect(404); expect(writes).toEqual([]);
  });
  it.each(['personal-A', 'broken-A', 'missing'])('classroom views hide %s', async id => {
    for (const tail of ['', '/status', '/ranking', '/me']) await send(['get', `/classrooms/${id}${tail}`], token('A')).expect(404);
  });
  it('requires active compatible enrollment and rejects an unassigned teacher', async () => {
    enrollments.find(e => e.id === 'self-A').status = 'RETIRED';
    await send(endpoints('A')[0], token('A')).expect(404);
    await send(endpoints('A')[0], token('A', 'DOCENTE', 'unassigned-teacher')).expect(404);
  });
  it('teacher can enable only a compatible source in their own classroom', async () => {
    const teacher = token('A', 'DOCENTE', 'shared-teacher');
    await send(['put', '/classrooms/class-A/sources/activity-B', { enabled: true }], teacher).expect(404);
    await send(endpoints('A')[4], token('A')).expect(403); expect(writes).toEqual([]);
    await send(endpoints('A')[4], teacher).expect(200);
    expect(writes).toEqual([{ model: 'activity', metadata: { duelEligible: true } }]);
  });
  it('foreign or third-party answers/powers cannot alter the visible opponent progress', async () => {
    answers.push({ duelId: 'active-A', institutionId: 'B', enrollmentId: 'peer-A', ordinal: 0, isCorrect: true }, { duelId: 'active-A', institutionId: 'A', enrollmentId: 'third-A', ordinal: 0, isCorrect: true });
    powers.push({ duelId: 'active-A', institutionId: 'B', enrollmentId: 'self-A', ordinal: 0, options: ['Dos'] });
    const response = await send(endpoints('A')[6], token('A')).expect(200);
    expect(response.body.opponentProgress).toBe(0); expect(response.body.opponentScore).toBe(0);
    expect(response.body.powerAvailable).toBe(true); expect(response.body.question.options).toHaveLength(4);
  });
  it('ranking and profile exclude matches with crossed institution relations', async () => {
    const rank = await send(endpoints('A')[2], token('A'), '?scope=general').expect(200);
    expect(rank.body.rows.map((r: any) => r.enrollmentId).sort()).toEqual(['peer-A', 'self-A']);
    const profile = await send(endpoints('A')[3], token('A')).expect(200);
    expect(profile.body.played).toBe(1);
    expect(JSON.stringify(profile.body)).not.toContain('peer-B');
    expect(prisma.classroomDuel.findMany.mock.calls.at(-1)[0].where.institutionId).toBe('A');
  });
  it('transaction rechecks tenant relations if a participant changes after the outer guard', async () => {
    prisma.$transaction.mockImplementation(async callback => {
      duels.find(d => d.id === 'active-A').inviteeEnrollmentId = 'peer-B'; return callback(prisma);
    });
    await send(endpoints('A')[9], token('A')).expect(409); expect(writes).toEqual([]);
    expect(prisma.classroomDuelAnswer.create).not.toHaveBeenCalled();
  });
  it('SuperAdmin requires a valid explicit tenant and still must be a participant', async () => {
    const bearer = token(null, 'SUPERADMIN', 'shared-student', true);
    await send(endpoints('A')[6], bearer).expect(403);
    await send(endpoints('A')[6], bearer, '?institutionId=missing').expect(404);
    await send(endpoints('A')[6], bearer, '?institutionId=B').expect(404);
    await send(endpoints('A')[6], bearer, '?institutionId=A').expect(200);
    await send(endpoints('A')[6], token(null, 'SUPERADMIN', 'third-user', true), '?institutionId=A').expect(404);
  });
  it('fails closed without an institution and accepts the deterministic active-membership fallback', async () => {
    await send(endpoints('A')[0], token(null)).expect(400);
    prisma.institutionUser.findFirst.mockResolvedValue({ institutionId: 'A' });
    await send(endpoints('A')[0], token(null)).expect(200);
  });
  it('rejects an expired JWT before reading a match', async () => {
    const expired = jwt.sign({ sub: 'shared-student', institutionId: 'A', roles: ['ESTUDIANTE'] }, { expiresIn: -1 });
    await send(endpoints('A')[6], expired).expect(401);
    expect(prisma.classroomDuel.findFirst).not.toHaveBeenCalled();
  });
  it('foreign answer rows cannot hide the current turn in the lightweight status', async () => {
    answers.push(...Array.from({ length: 7 }, (_, ordinal) => ({ duelId: 'active-A', institutionId: 'B', enrollmentId: 'self-A', ordinal, isCorrect: true })));
    const response = await send(endpoints('A')[1], token('A')).expect(200);
    expect(response.body.myTurn).toBe(1);
  });
  it('invited participant can decline without modifying another match', async () => {
    const response = await send(endpoints('A', 'invited-A')[8], token('A', 'ESTUDIANTE', 'peer-user')).expect(201);
    expect(response.body.status).toBe('DECLINED');
    expect(duels.find(d => d.id === 'invited-B').status).toBe('INVITED');
    expect(writes).toHaveLength(1);
  });
  it('an expired in-scope match expires without exposing questions or accepting answers', async () => {
    duels.find(d => d.id === 'active-A').expiresAt = new Date(Date.now() - 1000);
    const response = await send(endpoints('A')[6], token('A')).expect(200);
    expect(response.body.status).toBe('EXPIRED'); expect(response.body.question).toBeNull();
    await send(endpoints('A')[9], token('A')).expect(409);
    expect(prisma.classroomDuelAnswer.create).not.toHaveBeenCalled();
  });
});
