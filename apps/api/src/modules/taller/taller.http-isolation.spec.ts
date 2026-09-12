import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
import request = require('supertest');
import { PrismaService } from '../../prisma/prisma.service';
import { JwtStrategy } from '../auth/jwt.strategy';
import { tallerHttpFixture, TALLER_A, TALLER_B } from '../../../test/fixtures/taller-http.fixture';
import { TallerController } from './taller.controller';
import { TallerService } from './taller.service';

/** HTTP real, JWT y guards reales. Solo Prisma usa datos sintéticos que filtran el `where`. */
describe('Taller · rechazo cruzado por HTTP', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let data: ReturnType<typeof tallerHttpFixture>;

  beforeEach(async () => {
    data = tallerHttpFixture();
    const secret = randomBytes(32).toString('hex');
    jwt = new JwtService({ secret });
    const module = await Test.createTestingModule({
      controllers: [TallerController],
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: { getOrThrow: () => secret } },
        { provide: PrismaService, useValue: data.prisma },
        { provide: TallerService, useValue: data.service },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
  });

  afterEach(async () => { await app?.close(); });

  const token = (suffix: string, institutionId: string, role = 'ESTUDIANTE') =>
    jwt.sign({ sub: 'student-shared', institutionId, roles: [role],
      email: `student-${suffix}@example.invalid` }, { expiresIn: '1m' });

  const actions = [
    { name: 'resolve', method: 'post', path: (x: string) => '/taller/instruments/resolve',
      body: (x: string) => ({ teamId: `team-${x}`, motor: 'BOARD' }), guard: 'abpTeam' },
    { name: 'state', method: 'get', path: (x: string) => `/taller/instruments/inst-${x}`,
      guard: 'tallerInstrument' },
    { name: 'create object', method: 'post', path: (x: string) => `/taller/instruments/inst-${x}/objects`,
      body: () => ({ text: 'Nunca crear' }), guard: 'tallerInstrument' },
    { name: 'update object', method: 'patch', path: (x: string) => `/taller/objects/obj-${x}-1`,
      body: () => ({ text: 'Nunca cambiar' }), guard: 'tallerObject' },
    { name: 'delete object', method: 'delete', path: (x: string) => `/taller/objects/obj-${x}-1`,
      guard: 'tallerObject' },
    { name: 'vote', method: 'post', path: (x: string) => `/taller/objects/obj-${x}-1/vote`,
      guard: 'tallerObject' },
    { name: 'comment', method: 'post', path: (x: string) => `/taller/objects/obj-${x}-1/comments`,
      body: () => ({ text: 'Nunca comentar' }), guard: 'tallerObject' },
    { name: 'connect', method: 'post', path: () => '/taller/relations',
      body: (x: string) => ({ fromId: `obj-${x}-1`, toId: `obj-${x}-2` }), guard: 'tallerObject' },
    { name: 'disconnect', method: 'delete', path: (x: string) => `/taller/relations/rel-${x}`,
      guard: 'tallerRelation' },
    { name: 'timeline', method: 'get', path: (x: string) => `/taller/teams/team-${x}/timeline`,
      guard: 'abpTeam' },
  ] as const;

  describe.each([
    ['A', 'B', TALLER_A, TALLER_B],
    ['B', 'A', TALLER_B, TALLER_A],
  ] as const)('sesión de %s frente a recursos de %s', (actor, foreign, institutionId, foreignInstitutionId) => {
    it.each(actions)('$name → 404 antes de lecturas secundarias o escrituras', async (action) => {
      const http = request(app.getHttpServer()) as any;
      const call = http[action.method](action.path(foreign))
        .auth(token(actor, institutionId), { type: 'bearer' });
      if ('body' in action) call.send(action.body(foreign));
      const response = await call.expect(404);
      expect(response.body.statusCode).toBe(404);
      expect(JSON.stringify(response.body)).not.toContain(foreignInstitutionId);
      expect(data.writes()).toEqual([]);
      expect(data.secondaryReads()).toEqual([]);
      const guard = (data.prisma as any)[action.guard];
      expect(guard.findFirst).toHaveBeenCalledTimes(1);
      expect(guard.findFirst.mock.calls[0][0].where.institutionId).toBe(institutionId);
    });

    it('el mismo usuario compartido ve solo el instrumento propio de la institución activa', async () => {
      const response = await request(app.getHttpServer())
        .get(`/taller/instruments/inst-${actor}`)
        .auth(token(actor, institutionId), { type: 'bearer' })
        .expect(200);
      expect(response.body.instrument.institutionId).toBe(institutionId);
      expect(response.body.objects.map((row: any) => row.id)).toEqual([
        `obj-${actor}-1`, `obj-${actor}-2`,
      ]);
      expect(JSON.stringify(response.body)).not.toContain(foreignInstitutionId);
      expect(data.writes()).toEqual([]);
    });
  });

  it('catálogo es estático pero exige JWT y rol permitido', async () => {
    await request(app.getHttpServer()).get('/taller/catalog').expect(401);
    const response = await request(app.getHttpServer()).get('/taller/catalog')
      .auth(token('A', TALLER_A), { type: 'bearer' }).expect(200);
    expect(response.body.instruments.length).toBeGreaterThan(0);
    expect(data.writes()).toEqual([]);
  });

  it('una petición sin JWT no llega a Prisma y votar exige ESTUDIANTE', async () => {
    await request(app.getHttpServer()).get('/taller/instruments/inst-A').expect(401);
    await request(app.getHttpServer()).post('/taller/objects/obj-A-1/vote')
      .auth(token('A', TALLER_A, 'DOCENTE'), { type: 'bearer' }).expect(403);
    expect(data.prisma.tallerInstrument.findFirst).not.toHaveBeenCalled();
    expect(data.prisma.tallerObject.findFirst).not.toHaveBeenCalled();
    expect(data.writes()).toEqual([]);
  });
});
