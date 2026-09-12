import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
import request = require('supertest');

import { PrismaService } from '../../prisma/prisma.service';
import { JwtStrategy } from '../auth/jwt.strategy';
import { PreventiveCutsController } from './preventive-cuts.controller';
import { PreventiveCutsService } from './preventive-cuts.service';
import {
  preventiveCutsFixture,
  SCHOOL_A,
  SCHOOL_B,
} from '../../../test/fixtures/preventive-cuts.fixture';

type HttpMethod = 'get' | 'post' | 'patch';

type ForeignRoute = {
  name: string;
  method: HttpMethod;
  path: (foreign: 'A' | 'B') => string;
  body?: (foreign: 'A' | 'B') => Record<string, unknown>;
};

const foreignRoutes: ForeignRoute[] = [
  {
    name: 'crear configuración',
    method: 'post',
    path: () => '/preventive-cuts/config',
    body: (foreign) => ({
      institutionId: `school-${foreign}`,
      academicTermId: `term-${foreign}`,
      cutoffDate: '2026-05-20T12:00:00.000Z',
      riskThresholdScore: 3,
    }),
  },
  {
    name: 'consultar configuración',
    method: 'get',
    path: (foreign) => `/preventive-cuts/config?academicTermId=term-${foreign}`,
  },
  {
    name: 'ejecutar corte',
    method: 'post',
    path: () => '/preventive-cuts/execute',
    body: (foreign) => ({
      institutionId: `school-${foreign}`,
      teacherAssignmentId: `assignment-${foreign}`,
      academicTermId: `term-${foreign}`,
      cutoffDate: '2026-05-20T12:00:00.000Z',
    }),
  },
  {
    name: 'listar alertas',
    method: 'get',
    path: (foreign) =>
      `/preventive-cuts/alerts?teacherAssignmentId=assignment-${foreign}` +
      `&academicTermId=term-${foreign}&studentEnrollmentId=enrollment-${foreign}&status=OPEN`,
  },
  {
    name: 'actualizar alerta',
    method: 'patch',
    path: (foreign) => `/preventive-cuts/alerts/alert-${foreign}`,
    body: (foreign) => ({
      institutionId: `school-${foreign}`,
      notes: 'Intento cruzado',
    }),
  },
  {
    name: 'consultar consolidado',
    method: 'get',
    path: (foreign) =>
      `/preventive-cuts/group-view?academicTermId=term-${foreign}&groupId=group-${foreign}`,
  },
  {
    name: 'generar PDF del grupo',
    method: 'get',
    path: (foreign) =>
      `/preventive-cuts/pdf/group?academicTermId=term-${foreign}&groupId=group-${foreign}`,
  },
  {
    name: 'generar PDF del estudiante',
    method: 'get',
    path: (foreign) =>
      `/preventive-cuts/pdf/student?academicTermId=term-${foreign}` +
      `&groupId=group-${foreign}&studentEnrollmentId=enrollment-${foreign}`,
  },
];

describe('Cortes preventivos · aislamiento HTTP con JWT, roles y servicio reales', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let fixture: ReturnType<typeof preventiveCutsFixture>;
  let pdfBuild: jest.SpyInstance;
  let warn: jest.SpyInstance;

  beforeEach(async () => {
    fixture = preventiveCutsFixture();
    pdfBuild = jest
      .spyOn(fixture.service as any, 'buildPdf')
      .mockResolvedValue(Buffer.from('%PDF-1.4 synthetic'));
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const secret = randomBytes(32).toString('hex');
    jwt = new JwtService({ secret });
    const module = await Test.createTestingModule({
      controllers: [PreventiveCutsController],
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: { getOrThrow: () => secret } },
        { provide: PrismaService, useValue: fixture.prisma },
        { provide: PreventiveCutsService, useValue: fixture.service },
      ],
    }).compile();

    app = module.createNestApplication({ logger: false });
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    warn.mockRestore();
    await app?.close();
  });

  function token(
    institutionId?: string,
    role = 'ADMIN_INSTITUTIONAL',
    isSuperAdmin = false,
  ) {
    return jwt.sign(
      {
        sub: institutionId ? `actor-${institutionId}` : undefined,
        email: 'synthetic@example.invalid',
        institutionId,
        roles: [role],
        isSuperAdmin,
      },
      { expiresIn: '1m' },
    );
  }

  function call(
    method: HttpMethod,
    path: string,
    auth: string,
    body?: Record<string, unknown>,
  ) {
    const separator = path.includes('?') ? '&' : '?';
    const req = (request(app.getHttpServer()) as any)
      [method](path)
      .auth(auth, { type: 'bearer' });
    if (body) req.send(body);
    return {
      req,
      withForgedInstitution: (institutionId: string) => {
        const forged = (request(app.getHttpServer()) as any)
          [method](`${path}${separator}institutionId=${institutionId}`)
          .auth(auth, { type: 'bearer' });
        if (body) forged.send(body);
        return forged;
      },
    };
  }

  function expectNoEffects() {
    expect(fixture.grades.calculateTermGradeAtDate).not.toHaveBeenCalled();
    expect(fixture.writes()).toEqual([]);
    expect(pdfBuild).not.toHaveBeenCalled();
    expect(fixture.storage.resolveFileUrl).not.toHaveBeenCalled();
  }

  describe.each([
    ['A', 'B'],
    ['B', 'A'],
  ] as const)(
    'actor del colegio %s contra recursos del colegio %s',
    (actor, foreign) => {
      it.each(foreignRoutes)(
        '$name responde 404 antes de calcular, escribir o generar PDF',
        async (route) => {
          const auth = token(`school-${actor}`);
          await call(
            route.method,
            route.path(foreign),
            auth,
            route.body?.(foreign),
          )
            .withForgedInstitution(`school-${foreign}`)
            .expect(404);

          expectNoEffects();
        },
      );
    },
  );

  it('sin sesión, la guarda corta el acceso antes de consultar Prisma', async () => {
    await request(app.getHttpServer())
      .get('/preventive-cuts/config?academicTermId=term-A')
      .expect(401);
    expect(fixture.calls).toEqual([]);
    expectNoEffects();
  });

  it('una sesión válida sin contexto institucional tampoco llega al servicio', async () => {
    await request(app.getHttpServer())
      .get('/preventive-cuts/config?academicTermId=term-A')
      .auth(token(undefined, 'DOCENTE'), { type: 'bearer' })
      .expect(500);
    expect(fixture.calls).toEqual([]);
    expectNoEffects();
  });

  it.each(['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE'])(
    '%s puede leer la configuración de su propia institución',
    async (role) => {
      const response = await request(app.getHttpServer())
        .get('/preventive-cuts/config?academicTermId=term-A')
        .auth(token(SCHOOL_A, role, role === 'SUPERADMIN'), { type: 'bearer' })
        .expect(200);
      expect(response.body.id).toBe('config-A');
      expect(fixture.writes()).toEqual([]);
    },
  );

  it.each(['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR'])(
    '%s puede configurar un corte de su propia institución',
    async (role) => {
      await request(app.getHttpServer())
        .post('/preventive-cuts/config')
        .auth(token(SCHOOL_A, role, role === 'SUPERADMIN'), { type: 'bearer' })
        .send({
          academicTermId: 'term-A',
          cutoffDate: '2026-06-01T12:00:00.000Z',
          riskThresholdScore: 3.2,
        })
        .expect(201);
      expect(
        fixture.rows.preventiveCutConfig.find((row) => row.id === 'config-A'),
      ).toMatchObject({ riskThresholdScore: 3.2 });
    },
  );

  it('un docente no puede modificar la configuración', async () => {
    await request(app.getHttpServer())
      .post('/preventive-cuts/config')
      .auth(token(SCHOOL_A, 'DOCENTE'), { type: 'bearer' })
      .send({
        academicTermId: 'term-A',
        cutoffDate: '2026-06-01T12:00:00.000Z',
        riskThresholdScore: 3,
      })
      .expect(403);
    expect(fixture.calls).toEqual([]);
    expectNoEffects();
  });

  it.each(foreignRoutes)('un estudiante no puede $name', async (route) => {
    await call(
      route.method,
      route.path('A'),
      token(SCHOOL_A, 'ESTUDIANTE'),
      route.body?.('A'),
    ).req.expect(403);
    expect(fixture.calls).toEqual([]);
    expectNoEffects();
  });

  it('el cuerpo y query falsificados no sustituyen la institución del actor al configurar', async () => {
    const beforeB = {
      ...fixture.rows.preventiveCutConfig.find((row) => row.id === 'config-B'),
    };
    await request(app.getHttpServer())
      .post(`/preventive-cuts/config?institutionId=${SCHOOL_B}`)
      .auth(token(SCHOOL_A), { type: 'bearer' })
      .send({
        institutionId: SCHOOL_B,
        academicTermId: 'term-A',
        cutoffDate: '2026-06-10T12:00:00.000Z',
        riskThresholdScore: 3.4,
      })
      .expect(201);

    expect(
      fixture.rows.preventiveCutConfig.find((row) => row.id === 'config-A'),
    ).toMatchObject({ riskThresholdScore: 3.4 });
    expect(
      fixture.rows.preventiveCutConfig.find((row) => row.id === 'config-B'),
    ).toEqual(beforeB);
  });

  it('un corte legítimo calcula y persiste solo filas de la institución del actor', async () => {
    const alertBBefore = {
      ...fixture.rows.preventiveAlert.find((row) => row.id === 'alert-B'),
    };
    const response = await request(app.getHttpServer())
      .post(`/preventive-cuts/execute?institutionId=${SCHOOL_B}`)
      .auth(token(SCHOOL_A, 'DOCENTE'), { type: 'bearer' })
      .send({
        institutionId: SCHOOL_B,
        teacherAssignmentId: 'assignment-A',
        academicTermId: 'term-A',
        cutoffDate: '2026-05-20T12:00:00.000Z',
      })
      .expect(201);

    expect(response.body).toMatchObject({ totalStudents: 1, atRisk: 1 });
    expect(fixture.grades.calculateTermGradeAtDate).toHaveBeenCalledWith(
      'enrollment-A',
      'assignment-A',
      'term-A',
      expect.any(Date),
      SCHOOL_A,
    );
    expect(fixture.writes().every((entry) => entry.inTransaction)).toBe(true);
    expect(
      fixture.rows.preventiveAlert.find((row) => row.id === 'alert-B'),
    ).toEqual(alertBBefore);
  });

  it.each([
    [
      'fecha de configuración',
      '/preventive-cuts/config',
      {
        academicTermId: 'term-A',
        cutoffDate: 'fecha-imposible',
        riskThresholdScore: 3,
      },
    ],
    [
      'umbral de configuración',
      '/preventive-cuts/config',
      {
        academicTermId: 'term-A',
        cutoffDate: '2026-05-20T12:00:00.000Z',
        riskThresholdScore: 9,
      },
    ],
    [
      'fecha de ejecución',
      '/preventive-cuts/execute',
      {
        teacherAssignmentId: 'assignment-A',
        academicTermId: 'term-A',
        cutoffDate: 'fecha-imposible',
      },
    ],
  ])('rechaza %s inválida en la frontera HTTP', async (_name, path, body) => {
    await request(app.getHttpServer())
      .post(path as string)
      .auth(token(SCHOOL_A), { type: 'bearer' })
      .send(body)
      .expect(400);
    expect(fixture.calls).toEqual([]);
    expectNoEffects();
  });

  it.each([
    ['fecha', 'cutoffDate=fecha-imposible'],
    ['umbral no numérico', 'threshold=no-es-numero'],
    ['umbral inferior', 'threshold=0'],
    ['umbral superior', 'threshold=5.1'],
  ])(
    'group-view rechaza %s inválida antes de calcular',
    async (_name, invalidQuery) => {
      await request(app.getHttpServer())
        .get(
          `/preventive-cuts/group-view?academicTermId=term-A&groupId=group-A&${invalidQuery}`,
        )
        .auth(token(SCHOOL_A, 'DOCENTE'), { type: 'bearer' })
        .expect(400);
      expectNoEffects();
    },
  );

  it.each(['pdf/group', 'pdf/student'])(
    '%s rechaza el umbral inválido antes de renderizar un PDF',
    async (route) => {
      const student =
        route === 'pdf/student' ? '&studentEnrollmentId=enrollment-A' : '';
      await request(app.getHttpServer())
        .get(
          `/preventive-cuts/${route}?academicTermId=term-A&groupId=group-A` +
            `&threshold=no-es-numero${student}`,
        )
        .auth(token(SCHOOL_A, 'DOCENTE'), { type: 'bearer' })
        .expect(400);
      expectNoEffects();
    },
  );
});
