import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CommunicationsService } from './communications.service';
import { CommunicationsController } from './communications.controller';

/**
 * Aislamiento multi-tenant de `communications`
 * (docs/security/RLS-AUDIT-COMMUNICATIONS.md).
 *
 * El hallazgo P0 de este módulo no era una escritura sino una LECTURA pasiva: `getInbox`
 * emparejaba por `recipientType: 'ALL_TEACHERS' | 'ALL_STUDENTS'` sin filtrar por
 * institución ni por rol, así que toda comunicación masiva de toda institución entraba en
 * la bandeja de todos los usuarios — en operación normal, sin atacante, y en cada carga de
 * página, porque el contador de la barra de navegación consume el mismo endpoint.
 *
 * `getAttachmentDownloadUrl` repetía el mismo error de modelo en un predicado de
 * autorización independiente.
 */

const INST_A = 'inst-aaa';
const INST_B = 'inst-bbb';
const USER_A = 'user-a';

const docenteDe = (institutionId: string) => ({
  user: { id: USER_A, institutionId, isSuperAdmin: false, roles: ['DOCENTE'] },
});
const estudianteDe = (institutionId: string) => ({
  user: { id: USER_A, institutionId, isSuperAdmin: false, roles: ['ESTUDIANTE'] },
});
const superAdmin = () => ({
  user: { id: 'sa', institutionId: null, isSuperAdmin: true, roles: ['SUPERADMIN'] },
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1) SERVICIO
// ═══════════════════════════════════════════════════════════════════════════════
describe('CommunicationsService · aislamiento', () => {
  function build() {
    const prisma: any = {
      message: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'm-nuevo' }),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      messageRecipient: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      messageAttachment: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
        aggregate: jest.fn().mockResolvedValue({ _sum: {}, _count: 0 }),
      },
    };
    const storage: any = {
      buckets: { mensajes: 'mensajes' },
      getSignedUrlForBucket: jest.fn().mockResolvedValue('https://firmada'),
    };
    return { service: new CommunicationsService(prisma, storage), prisma };
  }

  const mensajeDe = (id: string, institutionId: string) => ({ id, institutionId, authorId: 'otro' });

  // ── Tests 1-5 · operaciones por id ────────────────────────────────────────
  describe('operaciones por identificador', () => {
    it('getById de un mensaje de B → no encontrado, consulta acotada', async () => {
      const { service, prisma } = build();
      await expect(service.getById('m-de-b', INST_A)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.message.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'm-de-b', institutionId: INST_A } }),
      );
    });

    it('update de un mensaje de B → rechazado sin escritura', async () => {
      const { service, prisma } = build();
      await expect(service.update('m-de-b', {} as any, INST_A)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.message.update).not.toHaveBeenCalled();
    });

    it('send de un borrador de B → rechazado sin escritura', async () => {
      const { service, prisma } = build();
      await expect(service.send('m-de-b', INST_A)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.message.update).not.toHaveBeenCalled();
    });

    it('delete de un mensaje de B → rechazado sin borrado', async () => {
      const { service, prisma } = build();
      await expect(service.delete('m-de-b', INST_A)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.message.delete).not.toHaveBeenCalled();
    });

    it('reply a un mensaje de B → rechazado, sin inyectar en la bandeja ajena', async () => {
      const { service, prisma } = build();
      await expect(
        service.reply('m-de-b', USER_A, 'hola', INST_A),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.message.create).not.toHaveBeenCalled();
    });

    it('getReplies de un hilo de B → rechazado', async () => {
      const { service, prisma } = build();
      await expect(service.getReplies('m-de-b', INST_A)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.message.findMany).not.toHaveBeenCalled();
    });
  });

  // ── Tests 7-14 · inbox ────────────────────────────────────────────────────
  describe('getInbox', () => {
    /** Extrae el `where` con el que se consultó. */
    const whereDe = (prisma: any) => prisma.messageRecipient.findMany.mock.calls[0][0].where;

    it('siempre acota por institución a nivel superior', async () => {
      const { service, prisma } = build();
      await service.getInbox(USER_A, INST_A, ['DOCENTE']);
      expect(whereDe(prisma).message).toEqual({ institutionId: INST_A });
    });

    it('cada rama del OR lleva su propio aislamiento', async () => {
      const { service, prisma } = build();
      await service.getInbox(USER_A, INST_A, ['DOCENTE']);
      for (const rama of whereDe(prisma).OR) {
        expect(rama.message).toEqual({ institutionId: INST_A });
      }
    });

    it('un DOCENTE recibe ALL_TEACHERS pero NO ALL_STUDENTS', async () => {
      const { service, prisma } = build();
      await service.getInbox(USER_A, INST_A, ['DOCENTE']);
      const tipos = whereDe(prisma).OR.map((r: any) => r.recipientType).filter(Boolean);
      expect(tipos).toContain('ALL_TEACHERS');
      expect(tipos).not.toContain('ALL_STUDENTS');
    });

    it('un ESTUDIANTE recibe ALL_STUDENTS pero NO ALL_TEACHERS', async () => {
      const { service, prisma } = build();
      await service.getInbox(USER_A, INST_A, ['ESTUDIANTE']);
      const tipos = whereDe(prisma).OR.map((r: any) => r.recipientType).filter(Boolean);
      expect(tipos).toContain('ALL_STUDENTS');
      expect(tipos).not.toContain('ALL_TEACHERS');
    });

    it('un ACUDIENTE solo recibe sus mensajes individuales', async () => {
      const { service, prisma } = build();
      await service.getInbox(USER_A, INST_A, ['ACUDIENTE']);
      const or = whereDe(prisma).OR;
      expect(or).toHaveLength(1);
      expect(or[0].recipientId).toBe(USER_A);
    });

    it('los mensajes individuales siguen llegando a su destinatario', async () => {
      const { service, prisma } = build();
      await service.getInbox(USER_A, INST_A, ['DOCENTE']);
      expect(whereDe(prisma).OR.some((r: any) => r.recipientId === USER_A)).toBe(true);
    });

    // EL CASO CLAVE: SuperAdmin sin institución
    it('SuperAdmin sin institución recibe bandeja VACÍA, no alcance global', async () => {
      const { service, prisma } = build();
      await expect(service.getInbox('sa', null, ['SUPERADMIN'])).resolves.toEqual([]);
      expect(prisma.messageRecipient.findMany).not.toHaveBeenCalled();
    });

    // Deuda funcional declarada: NO se entregan, y la prueba lo fija.
    it('ALL_PARENTS y GROUP siguen sin entregarse (deuda funcional documentada)', async () => {
      const { service, prisma } = build();
      await service.getInbox(USER_A, INST_A, ['ACUDIENTE', 'DOCENTE', 'ESTUDIANTE']);
      const tipos = whereDe(prisma).OR.map((r: any) => r.recipientType).filter(Boolean);
      expect(tipos).not.toContain('ALL_PARENTS');
      expect(tipos).not.toContain('GROUP');
    });
  });

  // ── Test 6 · adjuntos ─────────────────────────────────────────────────────
  describe('descarga de adjuntos', () => {
    const adjuntoCon = (recipients: any[], authorId = 'otro') => ({
      id: 'a1', storagePath: 'p', fileName: 'f', mimeType: 'application/pdf',
      message: { authorId, recipients },
    });

    it('adjunto de un mensaje de B → no encontrado, consulta acotada', async () => {
      const { service, prisma } = build();
      await expect(
        service.getAttachmentDownloadUrl('a-de-b', USER_A, INST_A, ['DOCENTE']),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.messageAttachment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'a-de-b', message: { institutionId: INST_A } } }),
      );
    });

    // REGRESIÓN del predicado roto: una difusión ya NO basta por sí sola.
    it('ALL_TEACHERS no da acceso a un ESTUDIANTE de la misma institución', async () => {
      const { service, prisma } = build();
      prisma.messageAttachment.findFirst.mockResolvedValue(
        adjuntoCon([{ recipientType: 'ALL_TEACHERS', recipientId: null }]),
      );
      await expect(
        service.getAttachmentDownloadUrl('a1', USER_A, INST_A, ['ESTUDIANTE']),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('ALL_STUDENTS no da acceso a un DOCENTE de la misma institución', async () => {
      const { service, prisma } = build();
      prisma.messageAttachment.findFirst.mockResolvedValue(
        adjuntoCon([{ recipientType: 'ALL_STUDENTS', recipientId: null }]),
      );
      await expect(
        service.getAttachmentDownloadUrl('a1', USER_A, INST_A, ['DOCENTE']),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('ALL_TEACHERS sí da acceso a un DOCENTE de la misma institución', async () => {
      const { service, prisma } = build();
      prisma.messageAttachment.findFirst.mockResolvedValue(
        adjuntoCon([{ recipientType: 'ALL_TEACHERS', recipientId: null }]),
      );
      await expect(
        service.getAttachmentDownloadUrl('a1', USER_A, INST_A, ['DOCENTE']),
      ).resolves.toEqual(expect.objectContaining({ url: 'https://firmada' }));
    });

    it('el destinatario individual conserva el acceso', async () => {
      const { service, prisma } = build();
      prisma.messageAttachment.findFirst.mockResolvedValue(
        adjuntoCon([{ recipientType: 'USER', recipientId: USER_A }]),
      );
      await expect(
        service.getAttachmentDownloadUrl('a1', USER_A, INST_A, ['ACUDIENTE']),
      ).resolves.toBeDefined();
    });

    it('el autor conserva el acceso', async () => {
      const { service, prisma } = build();
      prisma.messageAttachment.findFirst.mockResolvedValue(adjuntoCon([], USER_A));
      await expect(
        service.getAttachmentDownloadUrl('a1', USER_A, INST_A, ['DOCENTE']),
      ).resolves.toBeDefined();
    });

    it('sin institución resoluble no se descarga nada', async () => {
      const { service, prisma } = build();
      await expect(
        service.getAttachmentDownloadUrl('a1', 'sa', null, ['SUPERADMIN']),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.messageAttachment.findFirst).not.toHaveBeenCalled();
    });
  });

  // ── Tests 15-16 · escritura ───────────────────────────────────────────────
  it('create ignora el institutionId del DTO y persiste en la institución resuelta', async () => {
    const { service, prisma } = build();
    await service.create(USER_A, { institutionId: INST_B, recipients: [] } as any, INST_A);
    expect(prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ institutionId: INST_A }) }),
    );
  });

  // ── Regresión: lo que ya estaba bien sigue igual ──────────────────────────
  it('markAsRead sigue acotado al propio destinatario', async () => {
    const { service, prisma } = build();
    await service.markAsRead('m1', USER_A);
    expect(prisma.messageRecipient.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ recipientId: USER_A }) }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2) CONTROLADOR
// ═══════════════════════════════════════════════════════════════════════════════
describe('CommunicationsController · resolución de institución', () => {
  function build() {
    const service: any = {};
    for (const m of ['create', 'update', 'send', 'delete', 'getByInstitution', 'getById',
      'reply', 'getReplies', 'markAsRead', 'getInbox', 'getAvailableRecipients',
      'getAllowedCategories', 'getStorageUsage', 'uploadAttachment', 'removeAttachment',
      'getAttachmentDownloadUrl']) {
      service[m] = jest.fn().mockResolvedValue({});
    }
    const prisma = { institutionUser: { findFirst: jest.fn().mockResolvedValue(null) } };
    return { controller: new CommunicationsController(service, prisma as any), service };
  }

  it('create: el institutionId del DTO se ignora', async () => {
    const { controller, service } = build();
    const dto: any = { institutionId: INST_B, recipients: [] };
    await controller.create(docenteDe(INST_A), dto);
    expect(service.create).toHaveBeenCalledWith(USER_A, dto, INST_A);
  });

  it.each([
    ['update', (c: any, r: any) => c.update(r, 'm1', {})],
    ['send', (c: any, r: any) => c.send(r, 'm1')],
    ['delete', (c: any, r: any) => c.delete(r, 'm1')],
    ['getById', (c: any, r: any) => c.getById(r, 'm1')],
    ['getReplies', (c: any, r: any) => c.getReplies(r, 'm1')],
  ])('las rutas por id reciben la institución resuelta (%s)', async (name, call) => {
    const { controller, service } = build();
    await call(controller, docenteDe(INST_A));
    const args = service[name].mock.calls[0];
    expect(args[args.length - 1]).toBe(INST_A);
  });

  it('reply recibe la institución resuelta', async () => {
    const { controller, service } = build();
    await controller.reply('m1', docenteDe(INST_A), { content: 'hola' });
    expect(service.reply).toHaveBeenCalledWith('m1', USER_A, 'hola', INST_A);
  });

  it('inbox recibe institución y roles', async () => {
    const { controller, service } = build();
    await controller.getInbox(estudianteDe(INST_A));
    expect(service.getInbox).toHaveBeenCalledWith(USER_A, INST_A, ['ESTUDIANTE']);
  });

  it('inbox de SuperAdmin pasa institución nula (bandeja vacía en el servicio)', async () => {
    const { controller, service } = build();
    await controller.getInbox(superAdmin());
    expect(service.getInbox).toHaveBeenCalledWith('sa', null, ['SUPERADMIN']);
  });

  it('la descarga recibe institución y roles', async () => {
    const { controller, service } = build();
    await controller.getAttachmentDownloadUrl('a1', docenteDe(INST_A));
    expect(service.getAttachmentDownloadUrl).toHaveBeenCalledWith('a1', USER_A, INST_A, ['DOCENTE']);
  });

  it('sin institución resoluble no se ejecuta ninguna escritura', async () => {
    const { controller, service } = build();
    const sinTenant = { user: { id: 'u9', institutionId: null, isSuperAdmin: false, roles: ['DOCENTE'] } };
    await expect(controller.delete(sinTenant, 'm1')).rejects.toThrow();
    expect(service.delete).not.toHaveBeenCalled();
  });

  // Regresión: ESTUDIANTE y ACUDIENTE conservan sus flujos legítimos
  it.each([['ESTUDIANTE'], ['ACUDIENTE'], ['DOCENTE']])(
    '%s conserva el flujo legítimo de creación dentro de su institución',
    async (rol) => {
      const { controller, service } = build();
      const req = { user: { id: USER_A, institutionId: INST_A, isSuperAdmin: false, roles: [rol] } };
      await controller.create(req, { institutionId: INST_A, recipients: [] } as any);
      expect(service.create).toHaveBeenCalledWith(USER_A, expect.anything(), INST_A);
    },
  );
});
