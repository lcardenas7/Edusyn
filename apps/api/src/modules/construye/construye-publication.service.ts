import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ConstruyeService, projectKind } from './construye.service';
import {
  bogotaDay, computeUsageStats, isValidDeviceId, pingSeconds, usageEventType, usageSource,
  type UsageStats,
} from './app-usage';

/** Tope de dispositivos por app: protege la base de datos si alguien intenta inflar el conteo. */
export const MAX_DEVICES_PER_APP = 20_000;

/** Dirección pública de las apps (servicio crea-apps). Sin ella las apps no tienen enlace. */
export function publicAppUrl(token: string, origin = process.env.CREA_APPS_ORIGIN): string | null {
  const base = (origin || '').trim().replace(/\/+$/, '');
  return base ? `${base}/a/${token}/` : null;
}

const newToken = () => randomBytes(18).toString('base64url');

function appTitle(value: unknown, fallback: string): string {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  return (text || fallback).slice(0, 60);
}

/** Fecha de vencimiento opcional ("2026-12-15" o ISO). Debe ser futura. */
function expiryDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value);
  // Una fecha sin hora vence al final de ese día en Colombia (23:59:59 UTC-5).
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T23:59:59.000-05:00`) : new Date(text);
  if (Number.isNaN(date.getTime())) throw new BadRequestException('La fecha de vencimiento no es válida');
  if (date.getTime() <= Date.now()) throw new BadRequestException('La fecha de vencimiento debe ser futura');
  return date;
}

export const isLive = (publication: { status: string; manifest: unknown; expiresAt: Date | null }, now = new Date()) =>
  publication.status === 'PUBLISHED' && !!publication.manifest && (!publication.expiresAt || publication.expiresAt.getTime() > now.getTime());

/**
 * Publicar la app de un equipo: el equipo lo pide sobre una versión guardada, el docente lo
 * aprueba y la app queda en un enlace público (con QR, instalable). La versión aprobada se COPIA
 * en la publicación: el enlace público nunca lee el proyecto ni nada del colegio.
 */
@Injectable()
export class ConstruyePublicationService {
  constructor(private readonly prisma: PrismaService, private readonly construye: ConstruyeService) {}

  private get db() { return this.prisma as any; }

  private view(publication: any, stats?: UsageStats) {
    if (!publication) return null;
    return {
      id: publication.id,
      teamId: publication.teamId,
      status: publication.status,
      live: isLive(publication),
      title: publication.title,
      kind: publication.kind,
      url: publicAppUrl(publication.token),
      versionNumber: publication.versionNumber ?? null,
      pendingVersionNumber: publication.pendingVersionNumber ?? null,
      requestedAt: publication.requestedAt ?? null,
      reviewedAt: publication.reviewedAt ?? null,
      reviewNote: publication.reviewNote ?? null,
      publishedAt: publication.publishedAt ?? null,
      expiresAt: publication.expiresAt ?? null,
      stats: stats ?? null,
    };
  }

  private async stats(publicationId: string): Promise<UsageStats> {
    const [devices, days] = await Promise.all([
      this.db.construyeAppDevice.findMany({ where: { publicationId }, select: { id: true, isTeam: true, source: true, firstSeenAt: true, lastSeenAt: true, installedAt: true } }),
      this.db.construyeAppDay.findMany({ where: { device: { publicationId } }, select: { deviceId: true, day: true, opens: true, seconds: true, standalone: true } }),
    ]);
    return computeUsageStats(devices, days);
  }

  private async forTeacher(publicationId: string, institutionId: string, userId: string) {
    const publication = await this.db.construyePublication.findFirst({ where: { id: publicationId, institutionId } });
    if (!publication) throw new NotFoundException('Publicación no encontrada');
    await this.construye.projectForTeacher(publication.projectId, institutionId, userId);
    return publication;
  }

  private journal(publication: any, institutionId: string, actor: { enrollmentId?: string | null; userId?: string | null }, summary: string, detail: Record<string, unknown>) {
    return this.db.construyeJournalEntry.create({
      data: {
        institutionId, projectId: publication.projectId, teamId: publication.teamId,
        actorEnrollmentId: actor.enrollmentId ?? null, actorUserId: actor.userId ?? null,
        type: 'PUBLICATION', summary, detail,
      },
    });
  }

  /** Estado de la publicación del equipo y su uso (integrantes y docente del aula). */
  async teamPublication(teamId: string, institutionId: string, userId: string) {
    await this.construye.teamForUser(teamId, institutionId, userId);
    const publication = await this.db.construyePublication.findFirst({ where: { teamId, institutionId } });
    if (!publication) return { publication: null, appsConfigured: !!publicAppUrl('x') };
    return { publication: this.view(publication, await this.stats(publication.id)), appsConfigured: !!publicAppUrl('x') };
  }

  /** El equipo pide publicar una versión guardada (por defecto, la última). */
  async request(teamId: string, institutionId: string, userId: string, dto: any) {
    const { team, member } = await this.construye.membership(teamId, institutionId, userId);
    const version = await this.db.construyeVersion.findFirst({
      where: { teamId, institutionId, ...(typeof dto?.versionId === 'string' ? { id: dto.versionId } : {}) },
      orderBy: { number: 'desc' },
    });
    if (!version) throw new BadRequestException('Guarden primero una versión: solo se publica una versión guardada');
    const project = await this.db.construyeProject.findFirst({ where: { id: team.projectId, institutionId }, select: { title: true, kind: true } });
    // upsert (no create) sobre claves únicas: una carrera entre dos integrantes no rompe la petición.
    const existing = await this.db.construyePublication.findFirst({ where: { teamId, institutionId } });
    // Pedir publicar una versión nueva no renombra la app: el nombre solo cambia si lo mandan.
    const title = appTitle(dto?.title, existing?.title || team.name);
    const now = new Date();
    const pending = {
      pendingVersionId: version.id, pendingVersionNumber: version.number, pendingManifest: version.manifest,
      requestedAt: now, requestedByEnrollmentId: member.studentEnrollmentId, title, kind: projectKind(project?.kind),
    };
    const publication = existing
      ? await this.db.construyePublication.update({
        where: { id: existing.id },
        data: { ...pending, reviewNote: null, ...(existing.status === 'REJECTED' && !existing.manifest ? { status: 'PENDING' } : {}) },
      })
      : await this.db.construyePublication.upsert({
        where: { teamId },
        create: { institutionId, projectId: team.projectId, teamId, token: newToken(), status: 'PENDING', ...pending },
        update: pending,
      });
    await this.journal(publication, institutionId, { enrollmentId: member.studentEnrollmentId }, `El equipo pidió publicar la versión ${version.number} como app.`, { kind: 'REQUESTED', versionNumber: version.number });
    return this.view(publication, await this.stats(publication.id));
  }

  /** El docente aprueba lo pendiente (o vuelve a poner en línea lo ya aprobado). */
  async approve(publicationId: string, institutionId: string, userId: string, dto: any) {
    const publication = await this.forTeacher(publicationId, institutionId, userId);
    const expiresAt = dto?.expiresAt !== undefined ? expiryDate(dto.expiresAt) : publication.expiresAt;
    const hasPending = !!publication.pendingManifest;
    if (!hasPending && !publication.manifest) throw new BadRequestException('No hay una versión para publicar');
    const now = new Date();
    const updated = await this.db.construyePublication.update({
      where: { id: publication.id },
      data: {
        status: 'PUBLISHED', expiresAt, reviewedAt: now, reviewedByUserId: userId, reviewNote: null,
        publishedAt: publication.publishedAt ?? now,
        ...(hasPending ? {
          manifest: publication.pendingManifest, versionNumber: publication.pendingVersionNumber,
          pendingManifest: null, pendingVersionId: null, pendingVersionNumber: null,
        } : {}),
      },
    });
    const number = updated.versionNumber;
    await this.journal(updated, institutionId, { userId }, hasPending ? `El docente aprobó publicar la versión ${number}. La app ya está en línea.` : 'El docente volvió a poner la app en línea.', { kind: 'APPROVED', versionNumber: number, expiresAt });
    return this.view(updated, await this.stats(updated.id));
  }

  /** El docente no aprueba lo pendiente; lo ya publicado (si lo hay) sigue igual. */
  async reject(publicationId: string, institutionId: string, userId: string, dto: any) {
    const publication = await this.forTeacher(publicationId, institutionId, userId);
    if (!publication.pendingManifest) throw new BadRequestException('No hay una petición pendiente');
    const note = typeof dto?.note === 'string' ? dto.note.trim().slice(0, 500) : '';
    const updated = await this.db.construyePublication.update({
      where: { id: publication.id },
      data: {
        pendingManifest: null, pendingVersionId: null, pendingVersionNumber: null,
        reviewedAt: new Date(), reviewedByUserId: userId, reviewNote: note || null,
        ...(publication.status === 'PENDING' ? { status: 'REJECTED' } : {}),
      },
    });
    await this.journal(updated, institutionId, { userId }, note ? `El docente no aprobó la publicación: ${note}` : 'El docente no aprobó la publicación todavía.', { kind: 'REJECTED', note });
    return this.view(updated, await this.stats(updated.id));
  }

  /** El docente retira la app del enlace público. Conserva el enlace para volver a publicarla. */
  async unpublish(publicationId: string, institutionId: string, userId: string) {
    const publication = await this.forTeacher(publicationId, institutionId, userId);
    if (publication.status !== 'PUBLISHED') throw new BadRequestException('La app no está publicada');
    const updated = await this.db.construyePublication.update({ where: { id: publication.id }, data: { status: 'UNPUBLISHED', reviewedAt: new Date(), reviewedByUserId: userId } });
    await this.journal(updated, institutionId, { userId }, 'El docente retiró la app del enlace público.', { kind: 'UNPUBLISHED' });
    return this.view(updated, await this.stats(updated.id));
  }

  /** Publicaciones del proyecto con su uso, para el panel del docente. */
  async projectPublications(projectId: string, institutionId: string, userId: string) {
    await this.construye.projectForTeacher(projectId, institutionId, userId);
    const publications = await this.db.construyePublication.findMany({ where: { projectId, institutionId } });
    return Promise.all(publications.map(async (publication: any) => this.view(publication, await this.stats(publication.id))));
  }

  // ─── Público (sin sesión): solo por token, solo lo aprobado ───────────────────────────────

  async publicApp(token: string) {
    const publication = typeof token === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(token)
      ? await this.db.construyePublication.findUnique({ where: { token } })
      : null;
    if (!publication || !isLive(publication)) throw new NotFoundException('Esta app no está disponible');
    return { title: publication.title, kind: publication.kind, versionNumber: publication.versionNumber, manifest: publication.manifest };
  }

  /** Registra uso anónimo. Nunca falla hacia la app: lo inválido se ignora en silencio. */
  async recordEvent(token: string, dto: any, now: Date = new Date()) {
    const type = usageEventType(dto?.type);
    if (!type || !isValidDeviceId(dto?.deviceId)) return { ok: false };
    const publication = typeof token === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(token)
      ? await this.db.construyePublication.findUnique({ where: { token }, select: { id: true, status: true, manifest: true, expiresAt: true } })
      : null;
    if (!publication || !isLive(publication, now)) return { ok: false };

    const key = { publicationId_deviceId: { publicationId: publication.id, deviceId: dto.deviceId } };
    let device = await this.db.construyeAppDevice.findUnique({ where: key });
    const source = usageSource(dto?.source);
    if (!device) {
      if ((await this.db.construyeAppDevice.count({ where: { publicationId: publication.id } })) >= MAX_DEVICES_PER_APP) return { ok: false };
      try {
        device = await this.db.construyeAppDevice.upsert({
          where: key,
          create: { publicationId: publication.id, deviceId: dto.deviceId, source, isTeam: source === 'team', firstSeenAt: now, lastSeenAt: now },
          update: { lastSeenAt: now },
        });
      } catch {
        device = await this.db.construyeAppDevice.findUnique({ where: key });
        if (!device) return { ok: false };
      }
    }
    await this.db.construyeAppDevice.update({
      where: { id: device.id },
      data: {
        lastSeenAt: now,
        ...(source === 'team' && !device.isTeam ? { isTeam: true } : {}),
        ...(type === 'install' && !device.installedAt ? { installedAt: now } : {}),
      },
    });
    const standalone = dto?.standalone === true;
    const opens = type === 'open' ? 1 : 0;
    const seconds = type === 'ping' ? pingSeconds(dto?.seconds) : 0;
    const day = bogotaDay(now);
    try {
      await this.db.construyeAppDay.upsert({
        where: { deviceId_day: { deviceId: device.id, day } },
        create: { deviceId: device.id, day, opens, seconds, standalone },
        update: { opens: { increment: opens }, seconds: { increment: seconds }, ...(standalone ? { standalone: true } : {}) },
      });
    } catch {
      // Dos eventos simultáneos del mismo dispositivo: el segundo se pierde, no importa.
    }
    // Abrir la app ya instalada (modo standalone) también cuenta como instalación: iPhone no
    // avisa cuando se agrega a la pantalla de inicio.
    if (standalone && !device.installedAt && type !== 'install') {
      await this.db.construyeAppDevice.update({ where: { id: device.id }, data: { installedAt: now } });
    }
    return { ok: true };
  }
}
