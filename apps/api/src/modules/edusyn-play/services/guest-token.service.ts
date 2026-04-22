import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface GuestTokenPayload {
  type: 'guest';
  guestId: string;
  sessionId: string;
  sessionKind: 'QUIZ' | 'LESSON';
  nickname: string;
}

/**
 * Firma/verifica JWTs cortos para invitados (Edusyn Play).
 * El token NO contiene roles ni institutionId. Solo sirve para responder preguntas
 * de la sesión específica a la que pertenece.
 */
@Injectable()
export class GuestTokenService {
  constructor(private readonly jwtService: JwtService) {}

  async sign(payload: GuestTokenPayload, ttlSeconds = 4 * 3600): Promise<string> {
    return this.jwtService.signAsync(payload, { expiresIn: ttlSeconds });
  }

  async verify(token: string): Promise<GuestTokenPayload> {
    try {
      const decoded = await this.jwtService.verifyAsync<GuestTokenPayload>(token);
      if (decoded.type !== 'guest') {
        throw new UnauthorizedException('Token inválido');
      }
      return decoded;
    } catch {
      throw new UnauthorizedException('Token de invitado inválido o expirado');
    }
  }
}
