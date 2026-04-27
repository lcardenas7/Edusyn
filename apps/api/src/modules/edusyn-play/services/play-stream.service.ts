import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { Subject } from 'rxjs';

export type PlayEventType =
  | 'PING'
  | 'GUEST_JOINED'
  | 'GUEST_LEFT'
  | 'SESSION_PAUSED'
  | 'SESSION_RESUMED'
  | 'SESSION_STARTED'
  | 'QUESTION_OPENED'
  | 'QUESTION_CLOSED'
  | 'RANKING_UPDATED'
  | 'SESSION_FINISHED'
  | 'REACTION'
  | 'ANSWER_STATS';

export interface PlayEvent {
  type: PlayEventType;
  data: any;
}

/**
 * Servicio de streaming SSE para Edusyn Play.
 * Mantiene un Subject<PlayEvent> por sessionId.
 * Patrón idéntico al de LiveSessionService institucional.
 *
 * ⚠️  Un Subject por instancia de servidor.
 *     Si Railway escala horizontalmente, usar Redis pub/sub en su lugar.
 */
@Injectable()
export class PlayStreamService implements OnModuleDestroy {
  private readonly logger = new Logger(PlayStreamService.name);
  private readonly streams = new Map<string, Subject<PlayEvent>>();
  private readonly heartbeats = new Map<string, ReturnType<typeof setInterval>>();
  private readonly streamCreatedAt = new Map<string, number>();

  // Limpieza de streams huérfanos cada 5 minutos
  private readonly orphanCleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    this.orphanCleanupInterval = setInterval(() => this.cleanupOrphans(), 5 * 60 * 1000);
  }

  onModuleDestroy() {
    clearInterval(this.orphanCleanupInterval);
    for (const [id, subject] of this.streams) {
      this.destroyStream(id, subject);
    }
  }

  /** Devuelve o crea el Subject de la sesión. */
  getOrCreateStream(sessionId: string): Subject<PlayEvent> {
    if (!this.streams.has(sessionId)) {
      const subject = new Subject<PlayEvent>();
      this.streams.set(sessionId, subject);
      this.streamCreatedAt.set(sessionId, Date.now());

      // Heartbeat cada 25s para mantener la conexión viva en Railway
      const hb = setInterval(() => {
        subject.next({ type: 'PING', data: { ts: Date.now() } });
      }, 25_000);
      this.heartbeats.set(sessionId, hb);

      this.logger.debug(`Stream creado para sesión ${sessionId}`);
    }
    return this.streams.get(sessionId)!;
  }

  /** Emite un evento a todos los suscriptores de la sesión. */
  emit(sessionId: string, event: PlayEvent): void {
    const stream = this.streams.get(sessionId);
    if (stream) {
      stream.next(event);
    }
  }

  /** Finaliza el Subject y borra el stream. Llamar al terminar la sesión. */
  finishStream(sessionId: string): void {
    const subject = this.streams.get(sessionId);
    if (subject) {
      this.destroyStream(sessionId, subject);
      this.logger.debug(`Stream finalizado para sesión ${sessionId}`);
    }
  }

  private destroyStream(sessionId: string, subject: Subject<PlayEvent>): void {
    const hb = this.heartbeats.get(sessionId);
    if (hb) {
      clearInterval(hb);
      this.heartbeats.delete(sessionId);
    }
    subject.complete();
    this.streams.delete(sessionId);
    this.streamCreatedAt.delete(sessionId);
  }

  /** Elimina streams inactivos con más de 2 horas de vida. */
  private cleanupOrphans(): void {
    const TWO_HOURS = 2 * 60 * 60 * 1000;
    const now = Date.now();
    for (const [id, createdAt] of this.streamCreatedAt) {
      if (now - createdAt > TWO_HOURS) {
        const subject = this.streams.get(id);
        if (subject) {
          this.logger.warn(`Limpiando stream huérfano ${id}`);
          this.destroyStream(id, subject);
        }
      }
    }
  }
}
