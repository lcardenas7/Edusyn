import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import request = require('supertest');
import { JwtStrategy } from '../auth/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { ApdController } from './apd.controller';
import { ApdService } from './apd.service';
import { ApdAlertsService } from './apd-alerts.service';
import { ApdAcademicService } from './apd-academic.service';
import { ApdAiService } from './ai/apd-ai.service';

function matches(row: any, where: any = {}): boolean {
  return Object.entries(where).every(([key, value]) => value === undefined || (value && typeof value === 'object' ? row[key] && matches(row[key], value) : row[key] === value));
}

describe('Inclusion workspace with real role/JWT guards', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let rows: Record<string, any[]>;
  let prisma: any;
  beforeEach(async () => {
    rows = Object.fromEntries(['institution', 'academicYear', 'academicTerm', 'group', 'studentEnrollment', 'pedagogicalSupportPlan'].map(m => [m, []]));
    for (const x of ['A', 'B']) {
      const institutionId = 'school-' + x;
      rows.institution.push({ id: institutionId, enableDifferentialSupport: true, allowTeacherAccess: true });
      const year = { id: 'year-' + x, institutionId, status: 'ACTIVE', year: 2026, terms: [] };
      rows.academicYear.push(year);
      rows.academicTerm.push({ id: 'term-' + x, academicYear: year });
      rows.group.push({ id: 'group-' + x, name: x, campus: { institutionId }, grade: { institutionId } });
      const enrollment = { id: 'enr-' + x, institutionId, groupId: 'group-' + x, academicYearId: year.id, status: 'ACTIVE', studentId: 'student-' + x, student: { institutionId, firstName: 'Synthetic', lastName: x } };
      rows.studentEnrollment.push(enrollment);
      rows.pedagogicalSupportPlan.push({ id: 'plan-' + x, institutionId, academicTermId: 'term-' + x, studentEnrollment: enrollment });
    }
    prisma = {};
    for (const model of Object.keys(rows)) {
      const find = async ({ where, select }: any) => {
        const row = rows[model].find(r => matches(r, where));
        if (!row) return null;
        return select ? Object.fromEntries(Object.keys(select).map(k => [k, row[k]])) : row;
      };
      prisma[model] = { findFirst: jest.fn(find), findUnique: jest.fn(find), findMany: jest.fn(async ({ where }: any) => rows[model].filter(r => matches(r, where))), update: jest.fn() };
    }
    const secret = randomBytes(32).toString('hex');
    jwt = new JwtService({ secret });
    const module = await Test.createTestingModule({
      controllers: [ApdController],
      providers: [
        JwtStrategy, { provide: ConfigService, useValue: { getOrThrow: () => secret } },
        { provide: PrismaService, useValue: prisma },
        { provide: ApdService, useValue: new ApdService(prisma, {} as any, {} as any) },
        { provide: ApdAlertsService, useValue: {} }, { provide: ApdAcademicService, useValue: {} }, { provide: ApdAiService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
  });
  afterEach(async () => { await app?.close(); });
  const token = (role: string, school = 'A') => jwt.sign({ sub: 'synthetic-actor', roles: [role], institutionId: 'school-' + school }, { expiresIn: '1m' });

  it.each(['DOCENTE', 'PSICOLOGA', 'ADMIN_INSTITUTIONAL'])('%s can read the two access flags but cannot select another school', async role => {
    const response = await request(app.getHttpServer()).get('/apd/config?institutionId=school-B').auth(token(role), { type: 'bearer' }).expect(200);
    expect(response.body).toEqual({ enableDifferentialSupport: true, allowTeacherAccess: true });
    expect(prisma.institution.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'school-A' } }));
  });

  it.each(['DOCENTE', 'PSICOLOGA'])('%s can load years, groups, students and plans inside Inclusion', async role => {
    const header = 'Bearer ' + token(role);
    const context = await request(app.getHttpServer()).get('/apd/workspace').set('Authorization', header).expect(200);
    expect(context.body.groups.map((g: any) => g.id)).toEqual(['group-A']);
    const students = await request(app.getHttpServer()).get('/apd/workspace/students?groupId=group-A&academicYearId=year-A').set('Authorization', header).expect(200);
    expect(students.body).toEqual([{ id: 'student-A', enrollmentId: 'enr-A', name: 'A Synthetic' }]);
    const plans = await request(app.getHttpServer()).get('/apd/plans?groupId=group-A&academicTermId=term-A').set('Authorization', header).expect(200);
    expect(plans.body.map((p: any) => p.id)).toEqual(['plan-A']);
  });

  it.each(['workspace', 'workspace/students?groupId=group-A&academicYearId=year-A', 'plans?groupId=group-A&academicTermId=term-A'])('denies teacher access to %s when disabled, before collections', async path => {
    rows.institution[0].allowTeacherAccess = false;
    await request(app.getHttpServer()).get('/apd/' + path).auth(token('DOCENTE'), { type: 'bearer' }).expect(403);
    for (const model of ['group', 'studentEnrollment', 'pedagogicalSupportPlan']) expect(prisma[model].findMany).not.toHaveBeenCalled();
  });

  it.each(['DOCENTE', 'PSICOLOGA'])('%s cannot change the access flags', async role => {
    await request(app.getHttpServer()).put('/apd/config').auth(token(role), { type: 'bearer' }).send({ allowTeacherAccess: true }).expect(403);
    expect(prisma.institution.update).not.toHaveBeenCalled();
  });

  describe.each([['A', 'B'], ['B', 'A']])('school %s against %s', (actor, foreign) => {
    it.each(['workspace/students?groupId=group-FOREIGN&academicYearId=year-A', 'workspace/students?groupId=group-ACTOR&academicYearId=year-FOREIGN', 'plans?groupId=group-FOREIGN&academicTermId=term-A', 'plans?groupId=group-ACTOR&academicTermId=term-FOREIGN'])('%s rejects before students/plans', async path => {
      await request(app.getHttpServer()).get('/apd/' + path.replaceAll('FOREIGN', foreign).replaceAll('ACTOR', actor)).auth(token('PSICOLOGA', actor), { type: 'bearer' }).expect(404);
      expect(prisma.studentEnrollment.findMany).not.toHaveBeenCalled();
      expect(prisma.pedagogicalSupportPlan.findMany).not.toHaveBeenCalled();
    });
  });
});
