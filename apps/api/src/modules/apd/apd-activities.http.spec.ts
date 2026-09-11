import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
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
import { apdActivitiesFixture } from '../../../test/fixtures/apd-activities.fixture';

describe('APD activity HTTP isolation: real JWT, roles and service', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let f: ReturnType<typeof apdActivitiesFixture>;
  beforeEach(async () => {
    f = apdActivitiesFixture();
    const secret = randomBytes(32).toString('hex');
    jwt = new JwtService({ secret });
    const module = await Test.createTestingModule({
      controllers: [ApdController],
      providers: [
        JwtStrategy, { provide: ConfigService, useValue: { getOrThrow: () => secret } },
        { provide: PrismaService, useValue: f.prisma }, { provide: ApdService, useValue: f.service },
        { provide: ApdAlertsService, useValue: {} }, { provide: ApdAcademicService, useValue: {} }, { provide: ApdAiService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });
  afterEach(async () => { await app?.close(); });
  function call(operation: string, actor: string, target: string, role = 'DOCENTE') {
    const auth = jwt.sign({ sub: 'actor-' + actor, institutionId: 'school-' + actor, roles: [role] }, { expiresIn: '1m' });
    const body = { institutionId: 'school-' + target, supportPlanId: 'plan-' + target, topic: 'Synthetic', progressIndicator: 4, completionStatus: 'COMPLETED' };
    const http = request(app.getHttpServer());
    const action = operation === 'create' ? http.post('/apd/activities') : operation === 'update' ? http.put('/apd/activities/activity-' + target) : http.post('/apd/progress-logs');
    return action.auth(auth, { type: 'bearer' }).send(body);
  }
  describe.each(['DOCENTE', 'PSICOLOGA', 'ADMIN_INSTITUTIONAL'])('role %s', role => {
    describe.each([['A', 'B'], ['B', 'A']])('actor %s and resource %s', (actor, target) => {
      it.each(['create', 'update', 'log'])('%s rejects before transaction, collections and writing', async operation => {
        await call(operation, actor, target, role).expect(404);
        expect(f.prisma.$transaction).not.toHaveBeenCalled();
        expect(f.writes()).toEqual([]);
        expect(f.calls.filter(c => c.method === 'findMany')).toEqual([]);
      });
    });
    it.each(['create', 'update', 'log'])('%s succeeds within the actor institution', async operation => {
      await call(operation, 'A', 'A', role).expect(operation === 'update' ? 200 : 201);
      expect(f.writes().every(c => c.inTransaction)).toBe(true);
      expect(f.rows.apdAuditLog.every(r => r.institutionId === 'school-A' && r.userId === 'actor-A')).toBe(true);
    });
  });
  it.each(['create', 'update', 'log'])('%s denies teachers when the institution disables access', async operation => {
    f.rows.institution[0].allowTeacherAccess = false;
    await call(operation, 'A', 'A').expect(403);
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
    expect(f.writes()).toEqual([]);
    expect(f.prisma.pedagogicalSupportPlan.findFirst).not.toHaveBeenCalled();
  });
  it('a forged body cannot change the institution of an owned plan', async () => {
    const token = jwt.sign({ sub: 'actor-A', institutionId: 'school-A', roles: ['DOCENTE'] }, { expiresIn: '1m' });
    await request(app.getHttpServer()).post('/apd/progress-logs').auth(token, { type: 'bearer' })
      .send({ institutionId: 'school-B', supportPlanId: 'plan-A', progressIndicator: 5 }).expect(201);
    expect(f.rows.apdAuditLog.every(r => r.institutionId === 'school-A')).toBe(true);
    expect(f.rows.pedagogicalSupportPlan[1].progressPercentage).toBe(0);
  });
  it('a missing indicator is rejected at HTTP without a partial log', async () => {
    const token = jwt.sign({ sub: 'actor-A', institutionId: 'school-A', roles: ['DOCENTE'] }, { expiresIn: '1m' });
    await request(app.getHttpServer()).post('/apd/progress-logs').auth(token, { type: 'bearer' }).send({ supportPlanId: 'plan-A' }).expect(400);
    expect(f.writes()).toEqual([]);
  });
});
