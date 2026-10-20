import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
import request = require('supertest');
import { PrismaService } from '../../prisma/prisma.service';
import { JwtStrategy } from '../auth/jwt.strategy';
import { SupabaseStorageService } from '../storage/supabase-storage.service';
import { InstitutionalDocumentsController } from './institutional-documents.controller';
import { InstitutionalDocumentsService } from './institutional-documents.service';

// HTTP, JWT y guards reales; persistencia y objetos exclusivamente sintéticos.
describe('Documentos institucionales · aislamiento HTTP A/B', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let rows: any[];
  let prisma: any;
  let storage: any;
  let writes: string[];

  beforeEach(async () => {
    rows = ['A', 'B']
      .flatMap((institutionId) => [
        {
          id: `public-${institutionId}`,
          institutionId,
          isActive: true,
          visibleToRoles: [],
        },
        {
          id: `private-${institutionId}`,
          institutionId,
          isActive: true,
          visibleToRoles: ['SECRETARIA'],
        },
        {
          id: `inactive-${institutionId}`,
          institutionId,
          isActive: false,
          visibleToRoles: [],
        },
      ])
      .map((row) => ({
        ...row,
        fileUrl: `documentos/institucion/${row.institutionId}/${row.id}.pdf`,
        fileSize: 10,
        title: row.id,
      }));
    writes = [];
    const matches = (row: any, where: any) =>
      Object.entries(where).every(([key, value]) => row[key] === value);
    prisma = {
      institution: {
        findUnique: jest.fn(async ({ where }) =>
          ['A', 'B'].includes(where.id) ? { id: where.id } : null,
        ),
      },
      institutionUser: { findFirst: jest.fn(async () => null) },
      institutionalDocument: {
        findFirst: jest.fn(
          async ({ where }) => rows.find((row) => matches(row, where)) || null,
        ),
        findUnique: jest.fn(
          async ({ where }) => rows.find((row) => matches(row, where)) || null,
        ),
        findMany: jest.fn(async ({ where }) =>
          rows.filter((row) => matches(row, where)),
        ),
        create: jest.fn(async ({ data }) => {
          writes.push('create');
          const row = { id: 'new', ...data };
          rows.push(row);
          return row;
        }),
        update: jest.fn(async ({ where, data }) => {
          const row = rows.find((row) => matches(row, where));
          if (!row) throw new Error('missing');
          writes.push('update');
          Object.assign(
            row,
            Object.fromEntries(
              Object.entries(data).filter(([, value]) => value !== undefined),
            ),
          );
          return row;
        }),
        delete: jest.fn(async ({ where }) => {
          const index = rows.findIndex((row) => matches(row, where));
          if (index < 0) throw new Error('missing');
          writes.push('delete');
          return rows.splice(index, 1)[0];
        }),
      },
      institutionStorageUsage: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async () => ({})),
        upsert: jest.fn(async () => {
          writes.push('usage');
          return {};
        }),
      },
    };
    prisma.$transaction = jest.fn(async (callback) => {
      const before = structuredClone(rows);
      const beforeWrites = [...writes];
      try {
        return await callback(prisma);
      } catch (error) {
        rows = before;
        writes = beforeWrites;
        throw error;
      }
    });
    storage = {
      buckets: { documentos: 'documentos' },
      resolveFileUrl: jest.fn(
        async (key) => `https://signed.example.invalid/${key}`,
      ),
      uploadGenericFile: jest.fn(async (_bucket, path, file) => ({
        url: `documentos/${path}`,
        path,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
      })),
      deleteByKey: jest.fn(async () => undefined),
      listFiles: jest.fn(async () => []),
      deleteFile: jest.fn(async () => undefined),
    };
    const secret = randomBytes(32).toString('hex');
    jwt = new JwtService({ secret });
    const module = await Test.createTestingModule({
      controllers: [InstitutionalDocumentsController],
      providers: [
        JwtStrategy,
        InstitutionalDocumentsService,
        { provide: ConfigService, useValue: { getOrThrow: () => secret } },
        { provide: PrismaService, useValue: prisma },
        { provide: SupabaseStorageService, useValue: storage },
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
    role = 'ADMIN_INSTITUTIONAL',
    isSuperAdmin = false,
  ) =>
    jwt.sign(
      { sub: 'shared-user', institutionId, roles: [role], isSuperAdmin },
      { expiresIn: '1m' },
    );
  const http = (method: string, path = '') =>
    (request(app.getHttpServer()) as any)[method](
      `/institutional-documents${path}`,
    );
  const upload = (
    institutionId: string | null,
    bodyInstitution: string,
    visibility = '[]',
    category = 'MANUAL',
  ) =>
    http('post')
      .auth(token(institutionId), { type: 'bearer' })
      .field('institutionId', bodyInstitution)
      .field('title', 'Manual')
      .field('category', category)
      .field('visibleToRoles', visibility)
      .attach('file', Buffer.from('synthetic PDF'), {
        filename: 'manual.pdf',
        contentType: 'application/pdf',
      });

  describe.each([
    ['A', 'B'],
    ['B', 'A'],
  ])('%s frente a %s', (own, foreign) => {
    it.each(['get', 'put', 'delete'])(
      '%s de un ID ajeno falla antes de storage/escrituras',
      async (method) => {
        const req = http(method, `/public-${foreign}`).auth(token(own), {
          type: 'bearer',
        });
        if (method === 'put')
          req.send({ title: 'alterado', institutionId: own });
        await req.expect(404);
        expect(writes).toEqual([]);
        expect(storage.resolveFileUrl).not.toHaveBeenCalled();
        expect(storage.deleteByKey).not.toHaveBeenCalled();
      },
    );
    it('descarga ajena no firma una URL', async () => {
      await http('get', `/public-${foreign}/download-url`)
        .auth(token(own), { type: 'bearer' })
        .expect(404);
      expect(storage.resolveFileUrl).not.toHaveBeenCalled();
    });
    it('listado ignora el destino ajeno y filtra roles', async () => {
      const response = await http('get', `?institutionId=${foreign}`)
        .auth(token(own, 'DOCENTE'), { type: 'bearer' })
        .expect(200);
      expect(response.body.map((row) => row.id)).toEqual([`public-${own}`]);
    });
    it('creación usa el tenant de sesión aunque el formulario indique el ajeno', async () => {
      const response = await upload(own, foreign).expect(201);
      expect(response.body.institutionId).toBe(own);
      expect(storage.uploadGenericFile.mock.calls[0][1]).toContain(
        `institucion/${own}/`,
      );
      expect(prisma.$transaction).toHaveBeenCalled();
    });
    it('edición permite su documento sin moverlo de institución ni firmar URL', async () => {
      const response = await http('put', `/public-${own}`)
        .auth(token(own), { type: 'bearer' })
        .send({
          title: 'Nuevo',
          institutionId: foreign,
          uploadedById: 'intruso',
        })
        .expect(200);
      expect(response.body).toMatchObject({
        title: 'Nuevo',
        institutionId: own,
      });
      expect(storage.resolveFileUrl).not.toHaveBeenCalled();
    });
    it('eliminación propia retira registro y uso juntos', async () => {
      await http('delete', `/public-${own}`)
        .auth(token(own), { type: 'bearer' })
        .expect(200);
      expect(writes).toEqual(['delete', 'usage']);
      expect(storage.deleteByKey).toHaveBeenCalledWith(
        `documentos/institucion/${own}/public-${own}.pdf`,
      );
    });
    it('cleanup y uso ignoran la institución enviada por otro colegio', async () => {
      await http('post', '/cleanup')
        .auth(token(own), { type: 'bearer' })
        .send({ institutionId: foreign })
        .expect(201);
      expect(storage.listFiles).toHaveBeenCalledWith(
        'documentos',
        `institucion/${own}/institucionales`,
      );
      await http('get', `/storage-usage?institutionId=${foreign}`)
        .auth(token(own), { type: 'bearer' })
        .expect(200);
      expect(
        prisma.institutionStorageUsage.findUnique,
      ).toHaveBeenLastCalledWith({ where: { institutionId: own } });
    });
  });

  it.each([
    '/private-A',
    '/private-A/download-url',
    '/inactive-A',
    '/inactive-A/download-url',
  ])('docente no accede por ID a %s', async (path) => {
    await http('get', path)
      .auth(token('A', 'DOCENTE'), { type: 'bearer' })
      .expect(404);
    expect(storage.resolveFileUrl).not.toHaveBeenCalled();
  });
  it.each(['DOCENTE', 'SECRETARIA', 'RECTOR'])(
    '%s conserva acceso permitido',
    async (role) => {
      await http('get', '/public-A/download-url')
        .auth(token('A', role), { type: 'bearer' })
        .expect(200);
    },
  );
  it('un rol llamado SUPERADMIN no evita la visibilidad', async () => {
    await http('get', '/private-A')
      .auth(token('A', 'SUPERADMIN'), { type: 'bearer' })
      .expect(404);
  });
  it('SuperAdmin requiere destino explícito incluso con tenant en JWT', async () => {
    await http('get', '/public-A')
      .auth(token('A', 'SUPERADMIN', true), { type: 'bearer' })
      .expect(403);
  });
  it('SuperAdmin valida destino y no accede a un ID de otro destino', async () => {
    const auth = token(null, 'SUPERADMIN', true);
    await http('get', '/public-A?institutionId=missing')
      .auth(auth, { type: 'bearer' })
      .expect(404);
    await http('get', '/public-B?institutionId=A')
      .auth(auth, { type: 'bearer' })
      .expect(404);
    await http('get', '/private-A?institutionId=A')
      .auth(auth, { type: 'bearer' })
      .expect(200);
  });
  it('sin contexto institucional falla antes de storage', async () => {
    await http('get', '/public-A')
      .auth(token(null), { type: 'bearer' })
      .expect(400);
    expect(storage.resolveFileUrl).not.toHaveBeenCalled();
  });
  it.each(['get', 'put', 'delete'])('sin JWT: %s rechaza', async (method) => {
    await http(method, '/public-A').expect(401);
  });
  it.each(['put', 'delete', 'post'])('docente no puede %s', async (method) => {
    await http(method, method === 'post' ? '/cleanup' : '/public-A')
      .auth(token('A', 'DOCENTE'), { type: 'bearer' })
      .expect(403);
    expect(writes).toEqual([]);
  });
  it.each(['{', '{}', '[1]'])(
    'visibilidad inválida %s responde 400 sin subir',
    async (visibility) => {
      await upload('A', 'A', visibility).expect(400);
      expect(storage.uploadGenericFile).not.toHaveBeenCalled();
    },
  );
  it('categoría inválida responde 400', async () => {
    await upload('A', 'A', '[]', 'INVALID').expect(400);
    expect(storage.uploadGenericFile).not.toHaveBeenCalled();
  });
  it('fallo del contador revierte creación y compensa el objeto subido', async () => {
    prisma.institutionStorageUsage.upsert.mockRejectedValue(
      new Error('synthetic failure'),
    );
    await upload('A', 'A').expect(500);
    expect(rows.some((row) => row.id === 'new')).toBe(false);
    expect(storage.deleteByKey).toHaveBeenCalledTimes(1);
  });
  it('fallo del contador revierte eliminación y no borra el objeto', async () => {
    prisma.institutionStorageUsage.upsert.mockRejectedValue(
      new Error('synthetic failure'),
    );
    await http('delete', '/public-A')
      .auth(token('A'), { type: 'bearer' })
      .expect(500);
    expect(rows.some((row) => row.id === 'public-A')).toBe(true);
    expect(storage.deleteByKey).not.toHaveBeenCalled();
  });
  it('fallo de firma no entrega una URL persistida como alternativa', async () => {
    storage.resolveFileUrl.mockRejectedValue(
      new Error('synthetic signing failure'),
    );
    const response = await http('get', '/public-A/download-url')
      .auth(token('A'), { type: 'bearer' })
      .expect(400);
    expect(response.body.url).toBeUndefined();
  });
});
