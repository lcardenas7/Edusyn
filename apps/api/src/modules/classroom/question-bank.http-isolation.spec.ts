import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
import request = require('supertest');
import { PrismaService } from '../../prisma/prisma.service';
import { JwtStrategy } from '../auth/jwt.strategy';
import { ClassroomTenantAccessService } from './classroom-tenant-access.service';
import { QuestionBankController } from './question-bank.controller';
import { QuestionBankService } from './question-bank.service';

// JWT, guards, controller, tenant access and service are real. Persistence is synthetic.
// The adapter evaluates predicates against independent rows, including inconsistent FKs.
const collectionInput = { title: 'Banco sintético', subjectArea: 'Ciencias', category: 'Prueba', isPublished: true };
const questionInput = { type: 'MULTIPLE_CHOICE', text: '¿Cuál es la respuesta de prueba?', options: ['Uno', 'Dos'], correctAnswer: 'Uno' };
const catalogId = 'edusyn-arte-cultura-grade-6-v1';

function matches(row: any, where: any): boolean {
  return !!row && Object.entries(where || {}).every(([key, value]: [string, any]) => {
    if (key === 'OR') return value.some((part: any) => matches(row, part));
    if (value && typeof value === 'object') {
      if ('in' in value) return value.in.includes(row[key]);
      return matches(row[key], value);
    }
    return row[key] === value;
  });
}

describe('Question bank · HTTP isolation and assignment A/B', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let prisma: any;
  let classrooms: any[];
  let collections: any[];
  let items: any[];
  let writes: any[];
  let failImport: boolean;

  beforeEach(async () => {
    writes = [];
    failImport = false;
    const groups = ['A', 'B'].map(institutionId => ({ id: `group-${institutionId}`, campus: { institutionId }, grade: { id: `grade-${institutionId}`, name: 'Sexto', institutionId } }));
    classrooms = ['A', 'B'].map(institutionId => ({
      id: `class-${institutionId}`, institutionId, isPersonal: false,
      teacherAssignment: { id: `assignment-${institutionId}`, institutionId, teacherId: 'shared-teacher',
        groupId: `group-${institutionId}`, academicYearId: `year-${institutionId}`,
        academicYear: { institutionId }, group: groups.find(g => g.id === `group-${institutionId}`),
        subject: { area: { institutionId } } },
    }));
    classrooms.push({ ...structuredClone(classrooms[0]), id: 'other-teacher-A', teacherAssignment: { ...structuredClone(classrooms[0].teacherAssignment), teacherId: 'other-teacher' } });
    classrooms.push({ ...structuredClone(classrooms[0]), id: 'personal-A', isPersonal: true });
    const broken = structuredClone(classrooms[0]);
    broken.id = 'broken-A';
    broken.teacherAssignment.group.campus.institutionId = 'B';
    classrooms.push(broken);
    collections = ['A', 'B'].flatMap(institutionId => [
      { id: `own-${institutionId}`, createdById: 'shared-teacher', isPublished: false },
      { id: `public-${institutionId}`, createdById: 'other-teacher', isPublished: true },
      { id: `private-${institutionId}`, createdById: 'other-teacher', isPublished: false },
      { id: `inactive-${institutionId}`, createdById: 'shared-teacher', isPublished: false, isActive: false },
      { id: `wrong-grade-${institutionId}`, createdById: 'shared-teacher', isPublished: true, gradeId: `other-grade-${institutionId}` },
    ].map(row => ({ ...collectionInput, institutionId, gradeId: `grade-${institutionId}`, isActive: true, ...row })));
    items = ['A', 'B'].flatMap(institutionId => [
      { id: `item-${institutionId}`, collectionId: `own-${institutionId}`, institutionId, isActive: true, ...questionInput },
      { id: `other-item-${institutionId}`, collectionId: `public-${institutionId}`, institutionId, isActive: true, ...questionInput },
      { id: `inactive-item-${institutionId}`, collectionId: `own-${institutionId}`, institutionId, isActive: false, ...questionInput },
      // Deliberately inconsistent relation; removing the nested tenant filter must leak this row.
      { id: `cross-item-${institutionId}`, collectionId: `own-${institutionId}`, institutionId: institutionId === 'A' ? 'B' : 'A', isActive: true, ...questionInput },
    ]);
    const projectCollection = (row: any, select: any) => {
      if (!row) return null;
      return Object.fromEntries(Object.entries(select || row).map(([key, selection]: [string, any]) => [key,
        key === 'questions' ? items.filter(item => item.collectionId === row.id && matches(item, selection.where)) : row[key],
      ]));
    };
    prisma = {
      institution: { findUnique: jest.fn(async ({ where }) => ['A', 'B'].includes(where.id) ? { id: where.id } : null) },
      institutionUser: { findFirst: jest.fn(async () => null) },
      classroom: { findFirst: jest.fn(async ({ where }) => classrooms.find(row => matches(row, where)) || null) },
      group: { findFirst: jest.fn(async ({ where }) => groups.find(row => matches(row, where)) || null) },
      classroomActivity: { findMany: jest.fn(async ({ where }) => ['A', 'B'].map(institutionId => ({ id: `draft-${institutionId}`, classroomId: `class-${institutionId}`, isPublished: false, type: 'QUIZ' })).filter(row => matches(row, where))) },
      questionBankCollection: {
        findMany: jest.fn(async ({ where, select }) => collections.filter(row => matches(row, where)).map(row => projectCollection(row, select))),
        findFirst: jest.fn(async ({ where, select }) => projectCollection(collections.find(row => matches(row, where)), select)),
        create: jest.fn(async ({ data }) => { const row = { id: `new-${collections.length}`, isActive: true, ...data }; collections.push(row); writes.push(data); return row; }),
        update: jest.fn(async ({ where, data }) => { const row = collections.find(row => matches(row, where)); if (!row) throw new Error('missing'); Object.assign(row, data); writes.push(data); return row; }),
      },
      questionBankItem: {
        findFirst: jest.fn(async ({ where }) => items.find(row => matches(row, where)) || null),
        create: jest.fn(async ({ data }) => { const row = { id: `new-item-${items.length}`, isActive: true, ...data }; items.push(row); writes.push(data); return row; }),
        createMany: jest.fn(async ({ data }) => { if (failImport) throw new Error('synthetic import failure'); items.push(...data.map((row: any, i: number) => ({ id: `import-${i}`, isActive: true, ...row }))); writes.push(...data); return { count: data.length }; }),
        update: jest.fn(async ({ where, data }) => { const row = items.find(row => matches(row, where)); if (!row) throw new Error('missing'); Object.assign(row, data); writes.push(data); return row; }),
      },
    };
    prisma.$transaction = jest.fn(async callback => {
      const snapshot = structuredClone({ collections, items, writes });
      try { return await callback(prisma); }
      catch (error) { ({ collections, items, writes } = snapshot); throw error; }
    });
    const secret = randomBytes(32).toString('hex');
    jwt = new JwtService({ secret });
    const module = await Test.createTestingModule({ controllers: [QuestionBankController], providers: [
      JwtStrategy, QuestionBankService, ClassroomTenantAccessService,
      { provide: PrismaService, useValue: prisma },
      { provide: ConfigService, useValue: { getOrThrow: () => secret } },
    ] }).compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
  });

  afterEach(async () => { await app?.close(); });
  const token = (institutionId: string | null, role = 'DOCENTE', userId = 'shared-teacher', isSuperAdmin = false) => jwt.sign({ sub: userId, institutionId, roles: [role], isSuperAdmin }, { expiresIn: '1m' });
  const endpoints = (classroomId: string, collectionId: string, itemId: string) => [
    ['get', `/classrooms/${classroomId}`, undefined],
    ['get', `/classrooms/${classroomId}/official`, undefined],
    ['post', `/classrooms/${classroomId}/official/${catalogId}/import`, {}],
    ['post', `/classrooms/${classroomId}/collections`, collectionInput],
    ['put', `/classrooms/${classroomId}/collections/${collectionId}`, collectionInput],
    ['post', `/classrooms/${classroomId}/collections/${collectionId}/questions`, questionInput],
    ['put', `/classrooms/${classroomId}/collections/${collectionId}/questions/${itemId}`, questionInput],
  ] as const;
  const send = (endpoint: readonly any[], bearer?: string, query = '') => {
    const [method, path, body] = endpoint;
    let result = (request(app.getHttpServer()) as any)[method](`/question-bank${path}${query}`);
    if (bearer) result = result.auth(bearer, { type: 'bearer' });
    return body ? result.send(body) : result;
  };

  describe.each([['A', 'B'], ['B', 'A']])('%s → %s', (own, foreign) => {
    it.each([0, 1, 2, 3, 4, 5, 6])('rejects foreign classroom on route %i before secondary access or writes', async index => {
      await send(endpoints(`class-${foreign}`, `own-${foreign}`, `item-${foreign}`)[index], token(own)).expect(404);
      expect(prisma.questionBankCollection.findMany).not.toHaveBeenCalled();
      expect(prisma.questionBankCollection.findFirst).not.toHaveBeenCalled();
      expect(prisma.group.findFirst).not.toHaveBeenCalled();
      expect(writes).toEqual([]);
    });
    it('lists only visible own-grade banks and coherent active question rows', async () => {
      const response = await send(endpoints(`class-${own}`, '', '')[0], token(own), `?institutionId=${foreign}`).expect(200);
      expect(response.body.collections.map((row: any) => row.id)).toEqual([`own-${own}`, `public-${own}`]);
      expect(response.body.collections[0].questions.map((row: any) => row.id)).toEqual([`item-${own}`]);
      expect(response.body.collections.map((row: any) => row.canEdit)).toEqual([true, false]);
      expect(response.body.targetActivities.map((row: any) => row.id)).toEqual([`draft-${own}`]);
    });
    it.each([4, 5, 6])('rejects a foreign collection on route %i', async index => {
      await send(endpoints(`class-${own}`, `own-${foreign}`, `item-${foreign}`)[index], token(own)).expect(404);
      expect(writes).toEqual([]);
    });
    it.each(['public', 'private'])('cannot edit another author’s %s collection', async prefix => {
      for (const index of [4, 5, 6]) await send(endpoints(`class-${own}`, `${prefix}-${own}`, `other-item-${own}`)[index], token(own)).expect(403);
      expect(writes).toEqual([]);
    });
    it.each(['wrong-grade', 'inactive'])('rejects an own-institution %s collection', async prefix => {
      await send(endpoints(`class-${own}`, `${prefix}-${own}`, `item-${own}`)[5], token(own)).expect(404);
      expect(writes).toEqual([]);
    });
    it.each(['item', 'cross-item', 'other-item', 'inactive-item'])('rejects incoherent item %s', async prefix => {
      const itemId = prefix === 'item' ? `item-${foreign}` : `${prefix}-${own}`;
      await send(endpoints(`class-${own}`, `own-${own}`, itemId)[6], token(own)).expect(404);
      expect(writes).toEqual([]);
    });
    it('ignores tenant, author and collection fields injected in creation bodies', async () => {
      await send(['post', `/classrooms/class-${own}/collections`, { ...collectionInput, institutionId: foreign, gradeId: `grade-${foreign}`, createdById: 'attacker' }], token(own)).expect(201);
      expect(writes[0]).toMatchObject({ institutionId: own, gradeId: `grade-${own}`, createdById: 'shared-teacher' });
      await send(['post', `/classrooms/class-${own}/collections/own-${own}/questions`, { ...questionInput, institutionId: foreign, collectionId: `own-${foreign}` }], token(own)).expect(201);
      expect(writes[1]).toMatchObject({ institutionId: own, collectionId: `own-${own}` });
    });
    it('updates own collection and item without reparenting them from injected fields', async () => {
      await send(['put', `/classrooms/class-${own}/collections/own-${own}`, { ...collectionInput, institutionId: foreign, createdById: 'attacker', gradeId: `grade-${foreign}` }], token(own)).expect(200);
      await send(['put', `/classrooms/class-${own}/collections/own-${own}/questions/item-${own}`, { ...questionInput, collectionId: `own-${foreign}`, institutionId: foreign }], token(own)).expect(200);
      expect(collections.find(row => row.id === `own-${own}`)).toMatchObject({ institutionId: own, gradeId: `grade-${own}`, createdById: 'shared-teacher' });
      expect(items.find(row => row.id === `item-${own}`)).toMatchObject({ institutionId: own, collectionId: `own-${own}` });
      expect(writes).toHaveLength(2);
    });
    it('official catalog hides questions and import writes only into the session institution', async () => {
      const response = await send(endpoints(`class-${own}`, '', '')[1], token(own)).expect(200);
      expect(response.body).toHaveLength(8);
      expect(response.body.every((row: any) => row.questions === undefined && row.questionCount === 150)).toBe(true);
      await send(endpoints(`class-${own}`, '', '')[2], token(own), `?institutionId=${foreign}`).expect(201);
      expect(writes).toHaveLength(151);
      expect(writes.every(row => row.institutionId === own)).toBe(true);
      expect(writes[0]).toMatchObject({ gradeId: `grade-${own}`, createdById: 'shared-teacher' });
      await send(endpoints(`class-${own}`, '', '')[2], token(own)).expect(201);
      expect(writes).toHaveLength(151);
    });
  });

  it.each([0, 1, 2, 3, 4, 5, 6])('requires a real JWT on route %i', async index => {
    await send(endpoints('class-A', 'own-A', 'item-A')[index]).expect(401);
    await send(endpoints('class-A', 'own-A', 'item-A')[index], 'invalid-token').expect(401);
    expect(prisma.classroom.findFirst).not.toHaveBeenCalled();
  });
  it.each(['ESTUDIANTE', 'ACUDIENTE', 'SECRETARIA', 'COORDINADOR', 'RECTOR', 'ADMIN_INSTITUTIONAL', 'SUPERADMIN'])('does not grant teacher access to tenant role %s', async role => {
    for (const endpoint of endpoints('class-A', 'own-A', 'item-A')) await send(endpoint, token('A', role)).expect(403);
    expect(prisma.classroom.findFirst).not.toHaveBeenCalled();
  });
  it.each([0, 1, 2, 3, 4, 5, 6])('rejects an unassigned teacher on route %i', async index => {
    await send(endpoints('other-teacher-A', 'own-A', 'item-A')[index], token('A')).expect(403);
    expect(prisma.group.findFirst).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
  });
  it.each(['personal-A', 'broken-A', 'missing'])('hides personal, inconsistent or missing classroom %s', async id => {
    for (const endpoint of endpoints(id, 'own-A', 'item-A')) await send(endpoint, token('A')).expect(404);
    expect(writes).toEqual([]);
  });
  it('fails closed without institution and preserves the deterministic active-membership fallback', async () => {
    await send(endpoints('class-A', '', '')[0], token(null)).expect(400);
    expect(prisma.classroom.findFirst).not.toHaveBeenCalled();
    prisma.institutionUser.findFirst.mockResolvedValue({ institutionId: 'A' });
    await send(endpoints('class-A', '', '')[0], token(null)).expect(200);
    expect(prisma.institutionUser.findFirst).toHaveBeenLastCalledWith({ where: { userId: 'shared-teacher', isActive: true }, orderBy: { joinedAt: 'asc' }, select: { institutionId: true } });
  });
  it('real SuperAdmin requires a valid explicit target and cannot bypass teacher ownership', async () => {
    const bearer = token(null, 'SUPERADMIN', 'shared-teacher', true);
    await send(endpoints('class-A', '', '')[0], bearer).expect(403);
    await send(endpoints('class-A', '', '')[0], bearer, '?institutionId=missing').expect(404);
    await send(endpoints('class-A', '', '')[0], bearer, '?institutionId=A&institutionId=B').expect(403);
    await send(endpoints('class-A', '', '')[0], bearer, '?institutionId=B').expect(404);
    await send(endpoints('class-A', '', '')[0], bearer, '?institutionId=A').expect(200);
    await send(endpoints('other-teacher-A', '', '')[0], bearer, '?institutionId=A').expect(403);
    expect(writes).toEqual([]);
  });
  it('does not leave a partial official import when persistence fails (synthetic rollback)', async () => {
    const snapshot = structuredClone({ collections, items });
    failImport = true;
    await send(endpoints('class-A', '', '')[2], token('A')).expect(500);
    expect({ collections, items }).toEqual(snapshot);
    expect(writes).toEqual([]);
  });

  it('rejects an expired JWT before any classroom read', async () => {
    const expired = jwt.sign({ sub: 'shared-teacher', institutionId: 'A', roles: ['DOCENTE'] }, { expiresIn: -1 });
    await send(endpoints('class-A', '', '')[0], expired).expect(401);
    expect(prisma.classroom.findFirst).not.toHaveBeenCalled();
  });

  it.each([
    ['teacherAssignment', 'institutionId'],
    ['teacherAssignment', 'academicYear', 'institutionId'],
    ['teacherAssignment', 'group', 'grade', 'institutionId'],
    ['teacherAssignment', 'subject', 'area', 'institutionId'],
  ])('rejects a crossed classroom chain at %j', async (...path: string[]) => {
    let relation = classrooms[0];
    for (const key of path.slice(0, -1)) relation = relation[key];
    relation[path[path.length - 1]] = 'B';
    await send(endpoints('class-A', '', '')[0], token('A')).expect(404);
    expect(prisma.group.findFirst).not.toHaveBeenCalled();
  });

  it('service copy also excludes a question whose institution disagrees with its collection', async () => {
    const activity = { id: 'activity-A', classroomId: 'class-A', isPublished: false, type: 'QUIZ', classroom: classrooms[0] };
    prisma.classroomActivity.findFirst = jest.fn(async ({ where }) => matches(activity, where) ? activity : null);
    prisma.classroomActivity.findUnique = jest.fn(async () => ({ isPublished: false }));
    prisma.activityQuestion = { findFirst: jest.fn(async () => null), createMany: jest.fn(async ({ data }) => { writes.push(...data); return { count: data.length }; }) };
    // Different texts make exclusion observable without checking the query implementation.
    items.find(row => row.id === 'cross-item-A').text = 'Pregunta ajena que nunca debe copiarse';
    const result = await app.get(QuestionBankService).copyToActivity({ userId: 'shared-teacher', institutionId: 'A', roles: ['DOCENTE'], isSuperAdmin: false }, 'class-A', 'own-A', 'activity-A');
    expect(result).toEqual({ copied: 1, activityId: 'activity-A' });
    expect(writes).toHaveLength(1);
    expect(writes[0].text).toBe(questionInput.text);
  });
});
