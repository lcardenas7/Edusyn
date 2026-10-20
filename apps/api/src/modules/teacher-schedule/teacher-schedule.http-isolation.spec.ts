import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
import request = require('supertest');
import { PrismaService } from '../../prisma/prisma.service';
import { JwtStrategy } from '../auth/jwt.strategy';
import {
  A,
  B,
  teacherScheduleFixture,
} from '../../../test/fixtures/teacher-schedule.fixture';
import { TeacherScheduleController } from './teacher-schedule.controller';
import { TeacherScheduleService } from './teacher-schedule.service';

/**
 * Laboratorio HTTP del horario personal docente.
 *
 * Usa HTTP y JWT reales con dos instituciones y dos identidades docentes por institución. Solo la
 * persistencia es sintética: el fixture aplica los filtros y revierte transacciones. No conecta a
 * PostgreSQL, staging ni producción; demuestra el aislamiento de la capa de aplicación.
 */
describe('Horario docente · aislamiento HTTP con sesiones A/B', () => {
  let app: INestApplication;
  let data: ReturnType<typeof teacherScheduleFixture>;
  let jwt: JwtService;

  beforeEach(async () => {
    data = teacherScheduleFixture();
    const secret = randomBytes(32).toString('hex');
    jwt = new JwtService({ secret });
    const module = await Test.createTestingModule({
      controllers: [TeacherScheduleController],
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: { getOrThrow: () => secret } },
        { provide: PrismaService, useValue: data.prisma },
        { provide: TeacherScheduleService, useValue: data.service },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  const token = (
    institutionId: string | null,
    suffix: string,
    role = 'DOCENTE',
  ) =>
    jwt.sign(
      {
        sub: 'teacher-shared',
        email: `docente-compartido+${suffix.toLowerCase()}@example.invalid`,
        institutionId,
        roles: [role],
      },
      { expiresIn: '1m' },
    );

  const body = {
    dayOfWeek: 'WEDNESDAY',
    startTime: '10:00',
    endTime: '10:45',
    type: 'REUNION_AREA',
    title: 'Reunión de ciencias',
    location: 'Biblioteca',
  };

  describe.each([
    [A, B, 'A', 'B'],
    [B, A, 'B', 'A'],
  ])(
    'docente de %s contra %s',
    (institutionId, foreignInstitutionId, ownSuffix, foreignSuffix) => {
      it('GET /teacher-schedule solo devuelve su agenda', async () => {
        const response = await request(app.getHttpServer())
          .get('/teacher-schedule')
          .auth(token(institutionId, ownSuffix), { type: 'bearer' })
          .expect(200);

        expect(response.body.map((row: any) => row.id)).toEqual([
          `block-${ownSuffix}`,
        ]);
        expect(data.writes()).toEqual([]);
      });

      it('POST /teacher-schedule ignora institutionId y teacherId ajenos', async () => {
        const ownBefore = data.count(institutionId, 'teacher-shared');
        const foreignBefore = data.count(foreignInstitutionId);

        const response = await request(app.getHttpServer())
          .post('/teacher-schedule')
          .auth(token(institutionId, ownSuffix), { type: 'bearer' })
          .send({
            ...body,
            institutionId: foreignInstitutionId,
            teacherId: `colleague-${foreignSuffix}`,
          })
          .expect(201);

        expect(response.body).toMatchObject({
          institutionId,
          teacherId: 'teacher-shared',
          title: body.title,
        });
        expect(data.count(institutionId, 'teacher-shared')).toBe(ownBefore + 1);
        expect(data.count(foreignInstitutionId)).toBe(foreignBefore);
      });

      it('PUT /teacher-schedule/:id ajeno responde 404 sin efectos', async () => {
        await request(app.getHttpServer())
          .put(`/teacher-schedule/block-${foreignSuffix}`)
          .auth(token(institutionId, ownSuffix), { type: 'bearer' })
          .send({
            title: 'Intento cruzado',
            institutionId: institutionId,
            teacherId: 'teacher-shared',
          })
          .expect(404);

        expect(data.writes()).toEqual([]);
        expect(
          data.rows.teacherScheduleBlock.find(
            (row) => row.id === `block-${foreignSuffix}`,
          ).title,
        ).toBe(`Matemáticas ${foreignSuffix}`);
      });

      it('DELETE /teacher-schedule/:id ajeno responde 404 sin efectos', async () => {
        const ownBefore = data.count(institutionId);
        const foreignBefore = data.count(foreignInstitutionId);

        await request(app.getHttpServer())
          .delete(`/teacher-schedule/block-${foreignSuffix}`)
          .auth(token(institutionId, ownSuffix), { type: 'bearer' })
          .expect(404);

        expect(data.writes()).toEqual([]);
        expect(data.count(institutionId)).toBe(ownBefore);
        expect(data.count(foreignInstitutionId)).toBe(foreignBefore);
      });
    },
  );

  it.each(['put', 'delete'] as const)(
    '%s no alcanza la agenda de otro DOCENTE del mismo colegio',
    async (method) => {
      const http = (request(app.getHttpServer()) as any)
        [method]('/teacher-schedule/colleague-block-A')
        .auth(token(A, 'A'), { type: 'bearer' });
      if (method === 'put') http.send({ title: 'No es mío' });

      await http.expect(404);
      expect(data.writes()).toEqual([]);
    },
  );

  it('una actualización propia conserva institución y docente aunque el cuerpo los falsifique', async () => {
    const response = await request(app.getHttpServer())
      .put('/teacher-schedule/block-A')
      .auth(token(A, 'A'), { type: 'bearer' })
      .send({ title: 'Álgebra 6A', institutionId: B, teacherId: 'teacher-B' })
      .expect(200);

    expect(response.body).toMatchObject({
      id: 'block-A',
      institutionId: A,
      teacherId: 'teacher-shared',
      title: 'Álgebra 6A',
    });
    expect(
      data.rows.teacherScheduleBlock.find((row) => row.id === 'block-B').title,
    ).toBe('Matemáticas B');
  });

  it('una sesión sin institución ni membresía resoluble responde 400 antes de consultar agendas', async () => {
    const noInstitution = jwt.sign(
      {
        sub: 'teacher-without-membership',
        email: 'sin-institucion@example.invalid',
        institutionId: null,
        roles: ['DOCENTE'],
      },
      { expiresIn: '1m' },
    );

    await request(app.getHttpServer())
      .get('/teacher-schedule')
      .auth(noInstitution, { type: 'bearer' })
      .expect(400);

    expect(data.prisma.teacherScheduleBlock.findMany).not.toHaveBeenCalled();
    expect(data.writes()).toEqual([]);
  });

  it('un estudiante autenticado no puede crear bloques de horario docente', async () => {
    await request(app.getHttpServer())
      .post('/teacher-schedule')
      .auth(token(A, 'A', 'ESTUDIANTE'), { type: 'bearer' })
      .send(body)
      .expect(403);

    expect(data.writes()).toEqual([]);
  });

  it('sin sesión, las cuatro rutas responden 401 y no tocan persistencia', async () => {
    await request(app.getHttpServer()).get('/teacher-schedule').expect(401);
    await request(app.getHttpServer())
      .post('/teacher-schedule')
      .send(body)
      .expect(401);
    await request(app.getHttpServer())
      .put('/teacher-schedule/block-A')
      .send({ title: 'Intento' })
      .expect(401);
    await request(app.getHttpServer())
      .delete('/teacher-schedule/block-A')
      .expect(401);

    expect(data.calls).toEqual([]);
  });
});
