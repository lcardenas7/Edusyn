import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface GuestTokenPayload {
  type: 'guest';
  guestId: string;
  sessionId: string;
  sessionKind: 'QUIZ' | 'LESSON';
  nickname: string;
}

export interface SseTokenPayload {
  type: 'sse';
  sessionId: string;
  guestId?: string;
  userId?: string;
}

/**
 * Firma/verifica JWTs cortos para invitados (Edusyn Play).
 * El token NO contiene roles ni institutionId. Solo sirve para responder preguntas
 * de la sesión específica a la que pertenece.
 */
@Injectable()
export class GuestTokenService {
  constructor(private readonly jwtService: JwtService) {}

  /** F6.35: denylist de sessionIds finalizadas en memoria (se pierde al reiniciar, pero suficiente para una instancia) */
  private readonly revokedSessions = new Set<string>();

  /** F6.35: Invalida todos los tokens de guests de una sesión finalizada */
  revokeSession(sessionId: string): void {
    this.revokedSessions.add(sessionId);
    // Auto-limpiar después de 6h para no acumular en memoria
    setTimeout(() => this.revokedSessions.delete(sessionId), 6 * 3600 * 1000);
  }

  async sign(payload: GuestTokenPayload, ttlSeconds = 3 * 3600): Promise<string> {
    return this.jwtService.signAsync(payload, { expiresIn: ttlSeconds });
  }

  async verify(token: string): Promise<GuestTokenPayload> {
    try {
      const decoded = await this.jwtService.verifyAsync<GuestTokenPayload>(token);
      if (decoded.type !== 'guest') {
        throw new UnauthorizedException('Token inválido');
      }
      // F6.35: rechazar tokens de sesiones ya finalizadas
      if (this.revokedSessions.has(decoded.sessionId)) {
        throw new UnauthorizedException('La sesión ha finalizado');
      }
      return decoded;
    } catch (err: any) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Token de invitado inválido o expirado');
    }
  }

  /** F6.36: Token efímero de 5 min solo para abrir el stream SSE */
  async signSseToken(payload: SseTokenPayload): Promise<string> {
    return this.jwtService.signAsync(payload, { expiresIn: 5 * 60 });
  }

  async verifySseToken(token: string): Promise<SseTokenPayload> {
    try {
      const decoded = await this.jwtService.verifyAsync<SseTokenPayload>(token);
      if (decoded.type !== 'sse') throw new UnauthorizedException('Token SSE inválido');
      return decoded;
    } catch {
      throw new UnauthorizedException('Token SSE inválido o expirado');
    }
  }
}
