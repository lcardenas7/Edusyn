import { BadRequestException, NotFoundException } from '@nestjs/common';
import { bogotaDayKey, computeUsageStats, isValidDeviceId, pingSeconds, SUSPICIOUS_NEW_DEVICES_PER_HOUR } from './app-usage';
import { ConstruyePublicationService, isLive, MAX_DEVICES_PER_APP, publicAppUrl } from './construye-publication.service';

const NOW = new Date('2026-09-22T15:00:00.000Z'); // 10:00 a. m. en Colombia
const at = (daysAgo: number, hour = 15) => new Date(Date.UTC(2026, 8, 22 - daysAgo, hour));
const day = (daysAgo: number) => new Date(`${bogotaDayKey(at(daysAgo))}T00:00:00.000Z`);
const DEVICE = 'dispositivo-aleatorio-0001';
const TOKEN = 'tokenSecretoDeVeinticuatro';

describe('uso anónimo de una app publicada', () => {
  it('usa el día de Colombia, no el del servidor', () => {
    expect(bogotaDayKey(new Date('2026-09-22T03:00:00.000Z'))).toBe('2026-09-21'); // 10 p. m. del 21
    expect(bogotaDayKey(new Date('2026-09-22T05:00:00.000Z'))).toBe('2026-09-22');
  });

  it('solo acepta identificadores de dispositivo aleatorios y acota el tiempo por ping', () => {
    expect(isValidDeviceId(DEVICE)).toBe(true);
    expect(isValidDeviceId('corto')).toBe(false);
    expect(isValidDeviceId('con espacios y más cosas raras')).toBe(false);
    expect(pingSeconds(30)).toBe(30);
    expect(pingSeconds(99999)).toBe(60);
    expect(pingSeconds(-5)).toBe(0);
  });

  it('cuenta personas, instalaciones, activos y retención sin incluir al equipo', () => {
    const devices = [
      { id: 'a', isTeam: false, source: 'qr', firstSeenAt: at(8), lastSeenAt: at(0), installedAt: at(8) },
      { id: 'b', isTeam: false, source: 'link', firstSeenAt: at(2), lastSeenAt: at(2), installedAt: null },
      { id: 'c', isTeam: false, source: null, firstSeenAt: at(0), lastSeenAt: at(0), installedAt: null },
      { id: 'equipo', isTeam: true, source: 'team', firstSeenAt: at(9), lastSeenAt: at(0), installedAt: at(9) },
    ];
    const days = [
      { deviceId: 'a', day: day(8), opens: 2, seconds: 120, standalone: true },
      { deviceId: 'a', day: day(1), opens: 1, seconds: 60, standalone: true },
      { deviceId: 'a', day: day(0), opens: 1, seconds: 60, standalone: true },
      { deviceId: 'b', day: day(2), opens: 1, seconds: 30, standalone: false },
      { deviceId: 'c', day: day(0), opens: 1, seconds: 30, standalone: false },
      { deviceId: 'equipo', day: day(0), opens: 50, seconds: 3000, standalone: true },
    ];
    const stats = computeUsageStats(devices, days, NOW);
    expect(stats.devices).toBe(3);
    expect(stats.teamDevices).toBe(1);
    expect(stats.installs).toBe(1);
    expect(stats.activeToday).toBe(2);
    expect(stats.activeWeek).toBe(3);
    expect(stats.opens).toBe(6);
    expect(stats.minutes).toBe(5);
    // a (hace 8 días) volvió; b (hace 2) no volvió; c es de hoy y aún no cuenta.
    expect(stats.returnedNextDay).toEqual({ eligible: 2, returned: 1 });
    expect(stats.returnedWeek).toEqual({ eligible: 1, returned: 1 });
    expect(stats.sources).toEqual({ qr: 1, link: 1, team: 0, direct: 1 });
    expect(stats.daily).toHaveLength(14);
    expect(stats.daily[13]).toEqual({ day: bogotaDayKey(NOW), active: 2, newDevices: 1 });
    expect(stats.suspicious).toBe(false);
  });

  it('marca para revisión muchos dispositivos nuevos en una hora', () => {
    const burst = Array.from({ length: SUSPICIOUS_NEW_DEVICES_PER_HOUR + 1 }, (_, i) => ({
      id: `d${i}`, isTeam: false, source: 'link', firstSeenAt: new Date(NOW.getTime() - 60_000), lastSeenAt: NOW, installedAt: null,
    }));
    expect(computeUsageStats(burst, [], NOW).suspicious).toBe(true);
  });
});

describe('ConstruyePublicationService', () => {
  const construye = () => ({
    membership: jest.fn().mockResolvedValue({ team: { id: 'team-1', projectId: 'project-1', name: 'Los Creadores' }, member: { studentEnrollmentId: 'enr-1' } }),
    projectForTeacher: jest.fn().mockResolvedValue({ id: 'project-1' }),
    teamForUser: jest.fn().mockResolvedValue({ team: { id: 'team-1' }, member: null }),
  });
  const prismaWith = (overrides: any = {}) => ({
    construyeVersion: { findFirst: jest.fn().mockResolvedValue({ id: 'v3', number: 3, manifest: { files: [] } }) },
    construyeProject: { findFirst: jest.fn().mockResolvedValue({ title: 'Apps', kind: 'APP' }) },
    construyePublication: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
      upsert: jest.fn(async ({ create }: any) => ({ id: 'pub-1', ...create })),
      update: jest.fn(async ({ data }: any) => ({ id: 'pub-1', projectId: 'project-1', teamId: 'team-1', token: TOKEN, ...data })),
      findMany: jest.fn().mockResolvedValue([]),
    },
    construyeJournalEntry: { create: jest.fn().mockResolvedValue({}) },
    construyeAppDevice: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn(), count: jest.fn().mockResolvedValue(0), upsert: jest.fn(), update: jest.fn() },
    construyeAppDay: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
    ...overrides,
  });

  it('arma el enlace público solo si el servicio de apps está configurado', () => {
    expect(publicAppUrl(TOKEN, 'https://apps.ejemplo.co/')).toBe(`https://apps.ejemplo.co/a/${TOKEN}/`);
    expect(publicAppUrl(TOKEN, '')).toBeNull();
  });

  it('el equipo pide publicar su última versión: queda pendiente con un token nuevo y en la bitácora', async () => {
    const prisma: any = prismaWith();
    const out: any = await new ConstruyePublicationService(prisma, construye() as any).request('team-1', 'inst-1', 'user-1', {});
    const created = prisma.construyePublication.upsert.mock.calls[0][0].create;
    expect(created).toMatchObject({ institutionId: 'inst-1', teamId: 'team-1', status: 'PENDING', pendingVersionNumber: 3, kind: 'APP', title: 'Los Creadores' });
    expect(created.token).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(out.status).toBe('PENDING');
    expect(out.live).toBe(false);
    expect(prisma.construyeJournalEntry.create.mock.calls[0][0].data).toMatchObject({ type: 'PUBLICATION', actorEnrollmentId: 'enr-1' });
  });

  it('no se puede publicar sin una versión guardada', async () => {
    const prisma: any = prismaWith({ construyeVersion: { findFirst: jest.fn().mockResolvedValue(null) } });
    await expect(new ConstruyePublicationService(prisma, construye() as any).request('team-1', 'inst-1', 'user-1', {})).rejects.toThrow(BadRequestException);
  });

  it('al aprobar, la copia pendiente pasa a ser la app en línea', async () => {
    const prisma: any = prismaWith();
    prisma.construyePublication.findFirst.mockResolvedValue({ id: 'pub-1', projectId: 'project-1', teamId: 'team-1', token: TOKEN, status: 'PENDING', manifest: null, pendingManifest: { files: [1] }, pendingVersionNumber: 3, publishedAt: null, expiresAt: null });
    const teacher = construye();
    const out: any = await new ConstruyePublicationService(prisma, teacher as any).approve('pub-1', 'inst-1', 'teacher-1', { expiresAt: '2099-12-31' });
    expect(teacher.projectForTeacher).toHaveBeenCalledWith('project-1', 'inst-1', 'teacher-1');
    const data = prisma.construyePublication.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: 'PUBLISHED', manifest: { files: [1] }, versionNumber: 3, pendingManifest: null, reviewedByUserId: 'teacher-1' });
    expect(data.expiresAt.toISOString()).toBe('2100-01-01T04:59:59.000Z');
    expect(out.live).toBe(true);
  });

  it('rechazar no toca lo que ya estaba publicado', async () => {
    const prisma: any = prismaWith();
    prisma.construyePublication.findFirst.mockResolvedValue({ id: 'pub-1', projectId: 'project-1', teamId: 'team-1', token: TOKEN, status: 'PUBLISHED', manifest: { files: [] }, pendingManifest: { files: [2] } });
    await new ConstruyePublicationService(prisma, construye() as any).reject('pub-1', 'inst-1', 'teacher-1', { note: 'Falta el botón de volver' });
    const data = prisma.construyePublication.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ pendingManifest: null, reviewNote: 'Falta el botón de volver' });
    expect(data.status).toBeUndefined();
  });

  it('el enlace público solo entrega apps aprobadas y vigentes', async () => {
    const prisma: any = prismaWith();
    const service = new ConstruyePublicationService(prisma, construye() as any);
    prisma.construyePublication.findUnique.mockResolvedValue({ status: 'PUBLISHED', manifest: { files: [] }, expiresAt: null, title: 'App', kind: 'APP', versionNumber: 2 });
    await expect(service.publicApp(TOKEN)).resolves.toMatchObject({ title: 'App', versionNumber: 2 });
    prisma.construyePublication.findUnique.mockResolvedValue({ status: 'UNPUBLISHED', manifest: { files: [] }, expiresAt: null });
    await expect(service.publicApp(TOKEN)).rejects.toThrow(NotFoundException);
    expect(isLive({ status: 'PUBLISHED', manifest: {}, expiresAt: new Date('2000-01-01') })).toBe(false);
    await expect(service.publicApp('../../etc')).rejects.toThrow(NotFoundException);
  });

  it('registra una apertura: crea el dispositivo y suma al día de Colombia', async () => {
    const prisma: any = prismaWith();
    prisma.construyePublication.findUnique.mockResolvedValue({ id: 'pub-1', status: 'PUBLISHED', manifest: {}, expiresAt: null });
    prisma.construyeAppDevice.findUnique.mockResolvedValue(null);
    prisma.construyeAppDevice.upsert.mockResolvedValue({ id: 'dev-1', isTeam: false, installedAt: null });
    const out = await new ConstruyePublicationService(prisma, construye() as any).recordEvent(TOKEN, { type: 'open', deviceId: DEVICE, source: 'qr', standalone: true }, NOW);
    expect(out).toEqual({ ok: true });
    expect(prisma.construyeAppDevice.upsert.mock.calls[0][0].create).toMatchObject({ publicationId: 'pub-1', deviceId: DEVICE, source: 'qr', isTeam: false });
    expect(prisma.construyeAppDay.upsert.mock.calls[0][0].create).toMatchObject({ deviceId: 'dev-1', opens: 1, seconds: 0, standalone: true });
    // Abrir ya instalada cuenta como instalación (iPhone no avisa al instalar).
    expect(prisma.construyeAppDevice.update).toHaveBeenLastCalledWith({ where: { id: 'dev-1' }, data: { installedAt: NOW } });
  });

  it('ignora eventos inválidos, de apps retiradas o por encima del tope de dispositivos', async () => {
    const prisma: any = prismaWith();
    const service = new ConstruyePublicationService(prisma, construye() as any);
    expect(await service.recordEvent(TOKEN, { type: 'hack', deviceId: DEVICE })).toEqual({ ok: false });
    expect(await service.recordEvent(TOKEN, { type: 'open', deviceId: 'x' })).toEqual({ ok: false });
    prisma.construyePublication.findUnique.mockResolvedValue({ id: 'pub-1', status: 'UNPUBLISHED', manifest: {}, expiresAt: null });
    expect(await service.recordEvent(TOKEN, { type: 'open', deviceId: DEVICE })).toEqual({ ok: false });
    prisma.construyePublication.findUnique.mockResolvedValue({ id: 'pub-1', status: 'PUBLISHED', manifest: {}, expiresAt: null });
    prisma.construyeAppDevice.findUnique.mockResolvedValue(null);
    prisma.construyeAppDevice.count.mockResolvedValue(MAX_DEVICES_PER_APP);
    expect(await service.recordEvent(TOKEN, { type: 'open', deviceId: DEVICE })).toEqual({ ok: false });
    expect(prisma.construyeAppDevice.upsert).not.toHaveBeenCalled();
  });
});

describe('nombre de la app al volver a pedir publicación', () => {
  it('conserva el nombre elegido si la nueva petición no manda uno', async () => {
    const prisma: any = {
      construyeVersion: { findFirst: jest.fn().mockResolvedValue({ id: 'v4', number: 4, manifest: { files: [] } }) },
      construyeProject: { findFirst: jest.fn().mockResolvedValue({ title: 'Apps', kind: 'APP' }) },
      construyePublication: {
        findFirst: jest.fn().mockResolvedValue({ id: 'pub-1', projectId: 'project-1', teamId: 'team-1', token: 'tokenSecretoDeVeinticuatro', status: 'PUBLISHED', title: 'Estudia Fácil', manifest: { files: [] } }),
        update: jest.fn(async ({ data }: any) => ({ id: 'pub-1', teamId: 'team-1', token: 'tokenSecretoDeVeinticuatro', ...data })),
      },
      construyeJournalEntry: { create: jest.fn().mockResolvedValue({}) },
      construyeAppDevice: { findMany: jest.fn().mockResolvedValue([]) },
      construyeAppDay: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const construye: any = { membership: jest.fn().mockResolvedValue({ team: { id: 'team-1', projectId: 'project-1', name: 'Equipo Estudio' }, member: { studentEnrollmentId: 'enr-1' } }) };
    const out: any = await new ConstruyePublicationService(prisma, construye).request('team-1', 'inst-1', 'user-1', {});
    expect(prisma.construyePublication.update.mock.calls[0][0].data.title).toBe('Estudia Fácil');
    expect(out.title).toBe('Estudia Fácil');
  });
});
