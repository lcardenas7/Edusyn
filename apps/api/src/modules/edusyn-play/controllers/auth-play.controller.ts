import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SkipTenantCheck } from '../../auth/decorators/skip-tenant-check.decorator';
import { AuthPlayService } from '../services/auth-play.service';
import type { RegisterPlayDto } from '../services/auth-play.service';

@Controller('auth')
export class AuthPlayController {
  constructor(private readonly authPlay: AuthPlayService) {}

  /**
   * Registro público de docente personal (Edusyn Play).
   * No requiere autenticación. Auto-provisiona workspace + login automático.
   */
  @Post('register-play')
  @SkipTenantCheck()
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  async registerPlay(@Body() dto: RegisterPlayDto) {
    return this.authPlay.registerPlay(dto);
  }

  /**
   * Login directo de docente personal (sin selector de institución).
   */
  @Post('login-play')
  @SkipTenantCheck()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async loginPlay(@Body() dto: { email: string; password: string }) {
    return this.authPlay.loginPlay(dto);
  }
}
