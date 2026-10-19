import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createECDH, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

const webPush: any = require('web-push');
const PUSH_HOSTS = [
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'push.services.mozilla.com',
  'web.push.apple.com',
];
const PUSH_HOST_SUFFIXES = ['.notify.windows.com', '.push.windows.com'];

type SubscriptionInput = {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
};

function decodedKey(value: string) {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function validVapidPair(publicKey: string, privateKey: string) {
  try {
    const publicBytes = decodedKey(publicKey);
    const privateBytes = decodedKey(privateKey);
    if (publicBytes.length !== 65 || privateBytes.length !== 32) return false;
    const ecdh = createECDH('prime256v1');
    ecdh.setPrivateKey(privateBytes);
    return timingSafeEqual(
      ecdh.getPublicKey(undefined, 'uncompressed'),
      publicBytes,
    );
  } catch {
    return false;
  }
}

export function isAllowedPushEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > 2000)
    return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.hash &&
      (!url.port || url.port === '443') &&
      (PUSH_HOSTS.includes(host) ||
        PUSH_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix)))
    );
  } catch {
    return false;
  }
}

@Injectable()
export class MathEventPushService {
  private readonly logger = new Logger(MathEventPushService.name);

  constructor(private readonly db: PrismaService) {}

  publicKey() {
    const key = process.env.MATH_EVENT_VAPID_PUBLIC_KEY?.trim();
    const privateKey = process.env.MATH_EVENT_VAPID_PRIVATE_KEY?.trim();
    const subject = process.env.MATH_EVENT_VAPID_SUBJECT?.trim();
    if (!key || !privateKey || !subject) return { publicKey: null };
    try {
      if (
        !validVapidPair(key, privateKey) ||
        !/^(mailto:[^\s@]+@[^\s@]+|https:\/\/[^\s]+)$/.test(subject)
      )
        return { publicKey: null };
      return { publicKey: key };
    } catch {
      return { publicKey: null };
    }
  }

  async saveSubscription(
    institutionId: string,
    eventId: string,
    enrollmentId: string,
    input: SubscriptionInput,
  ) {
    const endpoint = input?.endpoint;
    const p256dh = input?.keys?.p256dh;
    const auth = input?.keys?.auth;
    if (
      !isAllowedPushEndpoint(endpoint) ||
      typeof p256dh !== 'string' ||
      typeof auth !== 'string' ||
      p256dh.length > 256 ||
      auth.length > 128
    ) {
      throw new BadRequestException('Suscripción de notificaciones no válida.');
    }
    try {
      if (decodedKey(p256dh).length !== 65 || decodedKey(auth).length !== 16) {
        throw new Error('Invalid key length');
      }
    } catch {
      throw new BadRequestException(
        'Las claves de notificación no son válidas.',
      );
    }
    await this.db.$transaction(async (tx) => {
      // Conservar el bloqueo transaccional sin devolver una columna void a Prisma.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`math-event-push:${eventId}:${enrollmentId}`}))::text`;
      const pushSubscriptions = (tx as any).mathEventPushSubscription;
      const existing = await pushSubscriptions.findUnique({
        where: { eventId_endpoint: { eventId, endpoint } },
        select: { id: true },
      });
      if (!existing) {
        const count = await pushSubscriptions.count({
          where: { institutionId, eventId, enrollmentId },
        });
        if (count >= 5)
          throw new BadRequestException(
            'Puedes activar avisos en un máximo de cinco dispositivos para este evento.',
          );
      }
      await pushSubscriptions.upsert({
        where: { eventId_endpoint: { eventId, endpoint } },
        create: {
          institutionId,
          eventId,
          enrollmentId,
          endpoint,
          p256dh,
          auth,
        },
        update: { institutionId, eventId, enrollmentId, p256dh, auth },
      });
    });
    return { subscribed: true };
  }

  async removeSubscription(
    institutionId: string,
    eventId: string,
    enrollmentId: string,
    endpoint: unknown,
  ) {
    if (!isAllowedPushEndpoint(endpoint)) return { removed: false };
    const result = await (this.db as any).mathEventPushSubscription.deleteMany({
      where: { institutionId, eventId, enrollmentId, endpoint },
    });
    return { removed: result.count > 0 };
  }

  async notifyIncomingDuel(
    institutionId: string,
    eventId: string,
    enrollmentId: string,
  ) {
    const publicKey = process.env.MATH_EVENT_VAPID_PUBLIC_KEY?.trim();
    const privateKey = process.env.MATH_EVENT_VAPID_PRIVATE_KEY?.trim();
    const subject = process.env.MATH_EVENT_VAPID_SUBJECT?.trim();
    if (!publicKey || !privateKey || !subject) return;
    try {
      if (!validVapidPair(publicKey, privateKey)) return;
      webPush.setVapidDetails(subject, publicKey, privateKey);
    } catch {
      this.logger.error(
        'Web Push no está configurado con claves VAPID válidas.',
      );
      return;
    }

    const subscriptions = await (
      this.db as any
    ).mathEventPushSubscription.findMany({
      where: { institutionId, eventId, enrollmentId },
      select: { endpoint: true, p256dh: true, auth: true },
    });
    const payload = JSON.stringify({
      title: 'Nuevo reto en Edusyn',
      body: 'Tienes una invitación para jugar en el evento de Matemáticas.',
      url: `/eventos/${eventId}`,
      tag: `math-event-${eventId}`,
    });
    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            payload,
            { TTL: 60 * 60, urgency: 'high' },
          );
        } catch (error: any) {
          const statusCode = Number(error?.statusCode);
          if (statusCode === 404 || statusCode === 410) {
            await (this.db as any).mathEventPushSubscription.deleteMany({
              where: { endpoint: subscription.endpoint, institutionId },
            });
          } else {
            this.logger.warn(
              `No se pudo entregar un aviso Push (HTTP ${statusCode || 'sin estado'}).`,
            );
          }
        }
      }),
    );
  }
}
