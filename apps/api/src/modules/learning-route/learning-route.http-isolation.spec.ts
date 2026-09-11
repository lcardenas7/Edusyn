import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import request = require('supertest');
import { JwtStrategy } from '../auth/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { LearningRouteController } from './learning-route.controller';
import { LearningRouteService } from './learning-route.service';
import { CompetencyEvidenceService } from './competency-evidence.service';
import { A, B, fixture, noAi, noWrites } from '../../../test/fixtures/learning-route.fixture';

/**
 * Laboratorio HTTP de Rutas de aprendizaje.
 *
 * HTTP real, verificación de JWT real, `RolesGuard` real, controlador y servicios reales; lo único
 * sustituido es la persistencia (el doble A/B que filtra de verdad) y Valeria. Sin base de datos,
 * sin RLS y sin credenciales ni datos reales: **lo que se demuestra aquí es la guarda de la
 * aplicación**, no el aislamiento de PostgreSQL.
 */
describe('Rutas de aprendizaje · aislamiento HTTP con sesiones firmadas localmente', () => {
  let app: INestApplication;
  let data: ReturnType<typeof fixture>;
  let jwt: JwtService;

  beforeEach(async () => {
    data = fixture();
    const secret = randomBytes(32).toString('hex');
    jwt = new JwtService({ secret });
    const module = await Test.createTestingModule({
      controllers: [LearningRouteController],
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: { getOrThrow: () => secret } },
        { provide: PrismaService, useValue: data.prisma },
        { provide: LearningRouteService, useValue: data.service },
        { provide: CompetencyEvidenceService, useValue: data.evidence },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
  });
  afterEach(async () => { await app?.close(); });

  const token = (institutionId: string, role = 'DOCENTE', sub = 'synthetic-actor') =>
    jwt.sign({ sub, email: 'synthetic@example.invalid', institutionId, roles: [role] }, { expiresIn: '1m' });

  // Las catorce rutas institucionales, con identificadores del OTRO colegio.
  const rutas = [
    ['get', '/learning-routes/classroom/classroom-FOREIGN', undefined],
    ['get', '/learning-routes/route-FOREIGN', undefined],
    ['post', '/learning-routes', { classroomId: 'classroom-FOREIGN', title: 'Intento' }],
    ['post', '/learning-routes/from-plan', { classroomId: 'classroom-FOREIGN', plan: { title: 'Plan', targetLevel: 'A2', targetSkill: 'READING', steps: [] } }],
    ['put', '/learning-routes/route-FOREIGN', { title: 'Pisada' }],
    ['delete', '/learning-routes/route-FOREIGN', undefined],
    ['post', '/learning-routes/route-FOREIGN/steps', { title: 'Paso intruso' }],
    ['post', '/learning-routes/route-FOREIGN/steps/new-activity', { title: 'Actividad intrusa' }],
    ['put', '/learning-routes/route-FOREIGN/steps/reorder', { stepIds: ['step-FOREIGN'] }],
    ['post', '/learning-routes/steps/step-FOREIGN/generate-lesson', { instructions: 'Intento' }],
    ['put', '/learning-routes/steps/step-FOREIGN', { title: 'Pisado' }],
    ['post', '/learning-routes/steps/step-FOREIGN/activity', {}],
    ['delete', '/learning-routes/steps/step-FOREIGN', undefined],
  ] as const;

  describe.each([[A, 'B'], [B, 'A']])('actor de %s contra el colegio %s', (institution, foreign) => {
    it.each(rutas)('%s %s responde 404 sin escribir ni generar', async (method, path, body) => {
      const url = path.replaceAll('FOREIGN', foreign);
      const req = (request(app.getHttpServer()) as any)[method](url).auth(token(institution), { type: 'bearer' });
      if (body) req.send(JSON.parse(JSON.stringify(body).replaceAll('FOREIGN', foreign)));
      await req.expect(404);
      noWrites(data.prisma);
      noAi(data.apdAi);
    });

    it('el progreso de una ruta ajena responde 404 y no cuenta evidencia', async () => {
      const estudiante = institution === A ? 'user-A' : 'user-B';
      await request(app.getHttpServer())
        .get(`/learning-routes/route-${foreign}/progress`)
        .auth(token(institution, 'ESTUDIANTE', estudiante), { type: 'bearer' })
        .expect(404);
      expect(data.prisma.competencyEvidence.count).not.toHaveBeenCalled();
      noWrites(data.prisma);
    });
  });

  // ─── Lo legítimo sigue funcionando ────────────────────────────────────────
  it('el docente lee su ruta', async () => {
    const r = await request(app.getHttpServer())
      .get('/learning-routes/route-A').auth(token(A), { type: 'bearer' }).expect(200);
    expect(r.body.id).toBe('route-A');
    expect(r.body.steps).toHaveLength(1);
  });

  it('el estudiante ve su progreso: matrícula ACTIVA de su institución, año y grupo del aula', async () => {
    const r = await request(app.getHttpServer())
      .get('/learning-routes/route-A/progress')
      .auth(token(A, 'ESTUDIANTE', 'user-A'), { type: 'bearer' })
      .expect(200);
    expect(r.body).toMatchObject({ routeId: 'route-A', totalSteps: 1, completedSteps: 1, targetMastery: 80 });
    expect(data.prisma.studentEnrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ institutionId: A, status: 'ACTIVE', academicYearId: 'year-A', groupId: 'group-A' }),
      }),
    );
  });

  it('un estudiante SIN matrícula compatible recibe 404, no un 500', async () => {
    await request(app.getHttpServer())
      .get('/learning-routes/route-A/progress')
      .auth(token(A, 'ESTUDIANTE', 'user-sin-matricula'), { type: 'bearer' })
      .expect(404);
  });

  it('matrícula de OTRO grupo del mismo colegio no sirve para esta ruta', async () => {
    data.rows.studentEnrollment.push({
      id: 'enr-otro-grupo', institutionId: A, studentId: 'student-otro',
      student: { userId: 'user-otro' }, academicYearId: 'year-A', groupId: 'group-otro', status: 'ACTIVE',
    });
    await request(app.getHttpServer())
      .get('/learning-routes/route-A/progress')
      .auth(token(A, 'ESTUDIANTE', 'user-otro'), { type: 'bearer' })
      .expect(404);
  });

  it('una matrícula RETIRADA tampoco abre el progreso', async () => {
    data.rows.studentEnrollment.push({
      id: 'enr-retirada', institutionId: A, studentId: 'student-retirado',
      student: { userId: 'user-retirado' }, academicYearId: 'year-A', groupId: 'group-A', status: 'WITHDRAWN',
    });
    await request(app.getHttpServer())
      .get('/learning-routes/route-A/progress')
      .auth(token(A, 'ESTUDIANTE', 'user-retirado'), { type: 'bearer' })
      .expect(404);
  });

  it('dos identidades de estudiante bajo el mismo usuario: 409, no se adivina', async () => {
    data.rows.studentEnrollment.push({
      id: 'enr-gemelo', institutionId: A, studentId: 'student-gemelo',
      student: { userId: 'user-A' }, academicYearId: 'year-A', groupId: 'group-A', status: 'ACTIVE',
    });
    const r = await request(app.getHttpServer())
      .get('/learning-routes/route-A/progress')
      .auth(token(A, 'ESTUDIANTE', 'user-A'), { type: 'bearer' })
      .expect(409);
    expect(r.body.message).toContain('más de un estudiante');
    noWrites(data.prisma);
  });

  // ─── El actor manda, no el cuerpo ─────────────────────────────────────────
  it('la institución del cuerpo se ignora: la ruta nace en la del actor', async () => {
    const r = await request(app.getHttpServer())
      .post('/learning-routes').auth(token(A), { type: 'bearer' })
      .send({ classroomId: 'classroom-A', title: 'Nueva', institutionId: B })
      .expect(201);
    expect(r.body.institutionId).toBe(A);
  });

  it('un cuerpo que intenta mudar la ruta a otro colegio no la mueve', async () => {
    await request(app.getHttpServer())
      .put('/learning-routes/route-A').auth(token(A), { type: 'bearer' })
      .send({ title: 'Renombrada', institutionId: B, classroomId: 'classroom-B' })
      .expect(200);
    const ruta = data.rows.learningRoute.find((x: any) => x.id === 'route-A');
    expect(ruta.institutionId).toBe(A);
    expect(ruta.classroomId).toBe('classroom-A');
    expect(ruta.title).toBe('Renombrada');
  });

  // ─── Guards reales ────────────────────────────────────────────────────────
  it('sin sesión no se consulta nada', async () => {
    await request(app.getHttpServer()).get('/learning-routes/route-A').expect(401);
    expect(data.prisma.learningRoute.findFirst).not.toHaveBeenCalled();
  });

  it('un estudiante no crea rutas (rol real)', async () => {
    await request(app.getHttpServer())
      .post('/learning-routes').auth(token(A, 'ESTUDIANTE', 'user-A'), { type: 'bearer' })
      .send({ classroomId: 'classroom-A', title: 'Intento' })
      .expect(403);
    noWrites(data.prisma);
  });

  it('un docente no consulta el progreso: esa ruta es del estudiante', async () => {
    await request(app.getHttpServer())
      .get('/learning-routes/route-A/progress').auth(token(A), { type: 'bearer' })
      .expect(403);
  });

  it('el catálogo de competencias es global y no necesita institución', async () => {
    const r = await request(app.getHttpServer())
      .get('/learning-routes/competencies').auth(token(A), { type: 'bearer' }).expect(200);
    expect(r.body.map((c: any) => c.id)).toEqual(['comp-reading', 'comp-writing']);
    noWrites(data.prisma);
  });
});
