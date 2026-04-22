import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { GuestTokenService } from '../services/guest-token.service';

/**
 * Extrae X-Guest-Token del header, lo verifica y lo inyecta en request.guest.
 * Usarlo en endpoints públicos que requieren identificar al invitado.
 */
@Injectable()
export class GuestGuard implements CanActivate {
  constructor(private readonly guestTokenService: GuestTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header = req.headers['x-guest-token'] || req.headers['X-Guest-Token'];
    const token = Array.isArray(header) ? header[0] : header;
    if (!token) {
      throw new UnauthorizedException('Falta X-Guest-Token');
    }
    const payload = await this.guestTokenService.verify(token);
    req.guest = payload;
    return true;
  }
}
