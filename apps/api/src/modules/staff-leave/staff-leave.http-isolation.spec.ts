import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
import request = require('supertest');

import {
  STAFF_LEAVE_SCHOOL_A,
  STAFF_LEAVE_SCHOOL_B,
  staffLeaveFixture,
} from '../../../test/fixtures/staff-leave.fixture';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtStrategy } from '../auth/jwt.strategy';
import { StaffLeaveController } from './staff-leave.controller';
import { StaffLeaveService } from './staff-leave.service';

type Method = 'get' | 'post' | 'patch';

describe('Permisos del personal · blindaje HTTP con JWT y roles reales', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let fixture: ReturnType<typeof staffLeaveFixture>;
  let warn: jest.SpyInstance;

  beforeEach(async () => {
    fixture = staffLeaveFixture();
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const secret = randomBytes(32).toString('hex');
    jwt = new JwtService({ secret });
    const module = await Test.createTestingModule({
      controllers: [StaffLeaveController],
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: { getOrThrow: () => secret } },
        { provide: PrismaService, useValue: fixture.prisma },
        {
          provide: StaffLeaveService,
          useFactory: (prisma: PrismaService) => new StaffLeaveService(prisma),
          inject: [PrismaService],
        },
      ],
    }).compile();

    app = module.createNestApplication({ logger: false });
    await app.init();
  });

  afterEach(async () => {
    warn.mockRestore();
    await app?.close();
  });

  function token(
    userId: string,
    institutionId: string | undefined,
    role = 'DOCENTE',
    isSuperAdmin = false,
  ) {
    return jwt.sign(
      {
        sub: userId,
        email: `${userId}@example.invalid`,
        institutionId,
        roles: [role],
        isSuperAdmin,
      },
      { expiresIn: '1m' },
    );
  }

  function authFor(
    suffix: 'A' | 'B',
    role = 'DOCENTE',
    user = `requester-${suffix}`,
  ) {
    return token(
      user,
      suffix === 'A' ? STAFF_LEAVE_SCHOOL_A : STAFF_LEAVE_SCHOOL_B,
      role,
      role === 'SUPERADMIN',
    );
  }

  function call(
    method: Method,
    path: string,
    auth: string,
    body?: Record<string, unknown>,
  ) {
    const pending = (request(app.getHttpServer()) as any)
      [method](path)
      .auth(auth, { type: 'bearer' });
    return body ? pending.send(body) : pending;
  }

  function row(id: string) {
    return fixture.rows.staffLeaveRequest.find((item) => item.id === id);
  }

  function expectNoWrites() {
    expect(fixture.writes()).toEqual([]);
  }

  describe.each([
    ['A', 'B', STAFF_LEAVE_SCHOOL_A, STAFF_LEAVE_SCHOOL_B],
    ['B', 'A', STAFF_LEAVE_SCHOOL_B, STAFF_LEAVE_SCHOOL_A],
  ] as const)(
    'sesión del colegio %s frente al colegio %s',
    (actor, foreign, ownInstitution, foreignInstitution) => {
      it('POST ignora institutionId falsificado y crea para la sesión', async () => {
        const foreignCount = fixture.rows.staffLeaveRequest.filter(
          (item) => item.institutionId === foreignInstitution,
        ).length;
        const response = await request(app.getHttpServer())
          .post(`/staff-leave?institutionId=${foreignInstitution}`)
          .auth(authFor(actor), { type: 'bearer' })
          .send({
            institutionId: foreignInstitution,
            type: 'PERMISO_ESPECIAL',
            startDate: '2026-08-15',
            reason: 'Nueva solicitud legítima',
          })
          .expect(201);

        expect(response.body).toMatchObject({
          institutionId: ownInstitution,
          requesterId: `requester-${actor}`,
        });
        expect(
          fixture.rows.staffLeaveRequest.filter(
            (item) => item.institutionId === foreignInstitution,
          ),
        ).toHaveLength(foreignCount);
      });

      it('GET my-requests ignora el tenant falsificado y solo muestra las propias', async () => {
        const response = await request(app.getHttpServer())
          .get(`/staff-leave/my-requests?institutionId=${foreignInstitution}`)
          .auth(authFor(actor), { type: 'bearer' })
          .expect(200);
        expect(response.body.map((item: any) => item.id)).toEqual([
          `leave-${actor}-own`,
          `leave-${actor}-approved`,
        ]);
        expectNoWrites();
      });

      it('GET listado ignora el tenant falsificado y solo muestra el propio', async () => {
        const response = await request(app.getHttpServer())
          .get(`/staff-leave?institutionId=${foreignInstitution}`)
          .auth(authFor(actor, 'ADMIN_INSTITUTIONAL', `admin-${actor}`), {
            type: 'bearer',
          })
          .expect(200);
        expect(response.body).toHaveLength(4);
        expect(
          response.body.every(
            (item: any) => item.institutionId === ownInstitution,
          ),
        ).toBe(true);
        expectNoWrites();
      });

      it('GET detalle ajeno responde 404 sin filtrar PII ni escribir', async () => {
        const response = await request(app.getHttpServer())
          .get(`/staff-leave/leave-${foreign}-own`)
          .auth(authFor(actor, 'ADMIN_INSTITUTIONAL', `admin-${actor}`), {
            type: 'bearer',
          })
          .expect(404);
        expect(JSON.stringify(response.body)).not.toContain(
          `requester-${foreign}`,
        );
        expect(JSON.stringify(response.body)).not.toContain('@example.invalid');
        expectNoWrites();
      });

      it('PATCH review ajeno responde 404 antes de PII y con cero escrituras', async () => {
        const response = await request(app.getHttpServer())
          .patch(`/staff-leave/leave-${foreign}-own/review`)
          .auth(authFor(actor, 'ADMIN_INSTITUTIONAL', `admin-${actor}`), {
            type: 'bearer',
          })
          .send({ status: 'APPROVED', reviewerNote: 'No debe aplicarse' })
          .expect(404);
        expect(response.body).toMatchObject({
          statusCode: 404,
          message: 'Solicitud no encontrada',
        });
        expect(JSON.stringify(response.body)).not.toContain('@example.invalid');
        expectNoWrites();
      });

      it('PATCH cancel ajeno responde 404 y con cero escrituras', async () => {
        await request(app.getHttpServer())
          .patch(`/staff-leave/leave-${foreign}-own/cancel`)
          .auth(authFor(actor), { type: 'bearer' })
          .expect(404);
        expectNoWrites();
      });

      it('GET stats ignora el tenant falsificado y cuenta solo el propio', async () => {
        const response = await request(app.getHttpServer())
          .get(`/staff-leave/stats/summary?institutionId=${foreignInstitution}`)
          .auth(authFor(actor, 'ADMIN_INSTITUTIONAL', `admin-${actor}`), {
            type: 'bearer',
          })
          .expect(200);
        expect(response.body).toEqual({
          total: 4,
          pending: 3,
          approved: 1,
          rejected: 0,
        });
        expectNoWrites();
      });
    },
  );

  it('un usuario normal ve sus solicitudes y recibe 404 por la de un colega', async () => {
    const auth = authFor('A');
    const mine = await request(app.getHttpServer())
      .get('/staff-leave/my-requests')
      .auth(auth, { type: 'bearer' })
      .expect(200);
    expect(mine.body.map((item: any) => item.id)).toEqual([
      'leave-A-own',
      'leave-A-approved',
    ]);
    await request(app.getHttpServer())
      .get('/staff-leave/leave-A-peer')
      .auth(auth, { type: 'bearer' })
      .expect(404);
    expectNoWrites();
  });

  it('un administrador institucional revisa una solicitud propia de su tenant', async () => {
    const response = await request(app.getHttpServer())
      .patch('/staff-leave/leave-A-admin/review')
      .auth(authFor('A', 'ADMIN_INSTITUTIONAL', 'admin-A'), {
        type: 'bearer',
      })
      .send({ status: 'APPROVED', reviewerNote: 'Autorizada' })
      .expect(200);
    expect(response.body).toMatchObject({
      id: 'leave-A-admin',
      status: 'APPROVED',
      reviewedById: 'admin-A',
    });
  });

  it('cancel solo permite la solicitud propia', async () => {
    const auth = authFor('A');
    await request(app.getHttpServer())
      .patch('/staff-leave/leave-A-peer/cancel')
      .auth(auth, { type: 'bearer' })
      .expect(404);
    expectNoWrites();

    const response = await request(app.getHttpServer())
      .patch('/staff-leave/leave-A-own/cancel')
      .auth(auth, { type: 'bearer' })
      .expect(200);
    expect(response.body).toMatchObject({
      id: 'leave-A-own',
      status: 'CANCELLED',
    });
    expect(row('leave-A-peer').status).toBe('PENDING');
  });

  describe('contrato de rutas y roles', () => {
    it.each(['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR'])(
      '%s puede listar, revisar y consultar stats del tenant',
      async (role) => {
        const auth = authFor('A', role, 'admin-A');
        await request(app.getHttpServer())
          .get('/staff-leave')
          .auth(auth, { type: 'bearer' })
          .expect(200);
        await request(app.getHttpServer())
          .get('/staff-leave/stats/summary')
          .auth(auth, { type: 'bearer' })
          .expect(200);
        await request(app.getHttpServer())
          .patch('/staff-leave/leave-A-peer/review')
          .auth(auth, { type: 'bearer' })
          .send({ status: 'APPROVED' })
          .expect(200);
      },
    );

    it.each([
      'SUPERADMIN',
      'ADMIN_INSTITUTIONAL',
      'COORDINADOR',
      'DOCENTE',
      'RECTOR',
      'ORIENTADOR',
      'SECRETARIA',
    ])('%s puede usar las rutas personales', async (role) => {
      const auth = authFor('A', role);
      await request(app.getHttpServer())
        .get('/staff-leave/my-requests')
        .auth(auth, { type: 'bearer' })
        .expect(200);
      await request(app.getHttpServer())
        .get('/staff-leave/leave-A-own')
        .auth(auth, { type: 'bearer' })
        .expect(200);
      await request(app.getHttpServer())
        .post('/staff-leave')
        .auth(auth, { type: 'bearer' })
        .send({
          type: 'AUSENCIA',
          startDate: '2026-09-01',
          reason: 'Solicitud por rol',
        })
        .expect(201);
    });

    it.each([
      ['listar', 'get', '/staff-leave'],
      ['revisar', 'patch', '/staff-leave/leave-A-peer/review'],
      ['consultar stats', 'get', '/staff-leave/stats/summary'],
    ] as const)('DOCENTE no puede %s', async (_name, method, path) => {
      await call(
        method,
        path,
        authFor('A'),
        method === 'patch' ? { status: 'APPROVED' } : undefined,
      ).expect(403);
      expect(fixture.calls).toEqual([]);
      expectNoWrites();
    });

    it.each([
      [
        'crear',
        'post',
        '/staff-leave',
        { type: 'AUSENCIA', startDate: '2026-09-01', reason: 'X' },
      ],
      ['ver propias', 'get', '/staff-leave/my-requests', undefined],
      ['listar', 'get', '/staff-leave', undefined],
      ['ver detalle', 'get', '/staff-leave/leave-A-own', undefined],
      [
        'revisar',
        'patch',
        '/staff-leave/leave-A-own/review',
        { status: 'APPROVED' },
      ],
      ['cancelar', 'patch', '/staff-leave/leave-A-own/cancel', undefined],
      ['ver stats', 'get', '/staff-leave/stats/summary', undefined],
    ] as const)('ESTUDIANTE no puede %s', async (_name, method, path, body) => {
      await call(method, path, authFor('A', 'ESTUDIANTE'), body).expect(403);
      expect(fixture.calls).toEqual([]);
      expectNoWrites();
    });
  });

  describe('fechas en la frontera HTTP', () => {
    it.each([
      ['inicio inválido', { startDate: 'mal' }],
      ['fin inválido', { endDate: 'mal' }],
      ['rango invertido', { startDate: '2026-08-10', endDate: '2026-08-09' }],
    ])('listado rechaza %s sin escribir', async (_name, query) => {
      await request(app.getHttpServer())
        .get('/staff-leave')
        .query(query)
        .auth(authFor('A', 'ADMIN_INSTITUTIONAL', 'admin-A'), {
          type: 'bearer',
        })
        .expect(400);
      expectNoWrites();
    });

    it.each([
      ['inicio inválido', { startDate: 'mal' }],
      ['fin inválido', { endDate: 'mal' }],
      ['rango invertido', { startDate: '2026-08-10', endDate: '2026-08-09' }],
    ])('stats rechaza %s sin escribir', async (_name, query) => {
      await request(app.getHttpServer())
        .get('/staff-leave/stats/summary')
        .query(query)
        .auth(authFor('A', 'ADMIN_INSTITUTIONAL', 'admin-A'), {
          type: 'bearer',
        })
        .expect(400);
      expectNoWrites();
    });

    it.each([
      ['inicio inválido', { startDate: 'mal' }],
      ['fin inválido', { startDate: '2026-08-10', endDate: 'mal' }],
      ['rango invertido', { startDate: '2026-08-10', endDate: '2026-08-09' }],
    ])('create rechaza %s sin escribir', async (_name, dates) => {
      await request(app.getHttpServer())
        .post('/staff-leave')
        .auth(authFor('A'), { type: 'bearer' })
        .send({ type: 'AUSENCIA', reason: 'Fecha inválida', ...dates })
        .expect(400);
      expectNoWrites();
    });

    it('acepta filtros unilaterales y los aplica', async () => {
      const fromJune = await request(app.getHttpServer())
        .get('/staff-leave?startDate=2026-06-01')
        .auth(authFor('A', 'ADMIN_INSTITUTIONAL', 'admin-A'), {
          type: 'bearer',
        })
        .expect(200);
      expect(fromJune.body.map((item: any) => item.id)).toEqual([
        'leave-A-admin',
        'leave-A-peer',
      ]);

      const stats = await request(app.getHttpServer())
        .get('/staff-leave/stats/summary?endDate=2026-05-31')
        .auth(authFor('A', 'ADMIN_INSTITUTIONAL', 'admin-A'), {
          type: 'bearer',
        })
        .expect(200);
      expect(stats.body).toEqual({
        total: 2,
        pending: 1,
        approved: 1,
        rejected: 0,
      });
    });
  });

  it('sin JWT ninguna de las siete rutas consulta Prisma', async () => {
    const routes: Array<[Method, string, Record<string, unknown>?]> = [
      [
        'post',
        '/staff-leave',
        { type: 'AUSENCIA', startDate: '2026-09-01', reason: 'X' },
      ],
      ['get', '/staff-leave/my-requests'],
      ['get', '/staff-leave'],
      ['get', '/staff-leave/leave-A-own'],
      ['patch', '/staff-leave/leave-A-own/review', { status: 'APPROVED' }],
      ['patch', '/staff-leave/leave-A-own/cancel'],
      ['get', '/staff-leave/stats/summary'],
    ];
    for (const [method, path, body] of routes) {
      const pending = (request(app.getHttpServer()) as any)[method](path);
      await (body ? pending.send(body) : pending).expect(401);
    }
    expect(fixture.calls).toEqual([]);
    expectNoWrites();
  });
});
