import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { SkipTenantCheck } from '../../auth/decorators/skip-tenant-check.decorator';
import { GuestGuard } from '../guards/guest.guard';
import { GuestService } from '../services/guest.service';

/**
 * Endpoints públicos de Edusyn Play.
 * No requieren JWT. Invitados entran con código de 6 dígitos.
 */
@Controller('public')
@SkipTenantCheck()
export class GuestPublicController {
  constructor(private readonly guestService: GuestService) {}

  /** Valida un código y devuelve info mínima de la sesión. */
  @Get('join/:code')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  async lookup(@Param('code') code: string) {
    return this.guestService.lookupByCode(code);
  }

  /** Invitado se une: crea guest + devuelve guestToken. */
  @Post('join/:code')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async join(
    @Param('code') code: string,
    @Body() body: { nickname: string; avatarEmoji?: string; fingerprint?: string },
    @Req() req: Request,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.guestService.joinSession({
      code,
      nickname: body.nickname,
      avatarEmoji: body.avatarEmoji,
      ip,
      userAgent,
      fingerprint: body.fingerprint,
    });
  }

  /** Ranking público en vivo. */
  @Get('session/:sessionId/ranking')
  @Throttle({ default: { ttl: 60000, limit: 120 } })
  async ranking(@Param('sessionId') sessionId: string) {
    return this.guestService.ranking(sessionId);
  }

  /** Invitado envía respuesta (requiere guestToken). */
  @Post('session/:sessionId/answer')
  @UseGuards(GuestGuard)
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  async answer(
    @Param('sessionId') _sessionId: string,
    @Body() body: {
      questionId?: string;
      slideId?: string;
      selectedOption?: string;
      answerText?: string;
      timeTakenMs?: number;
    },
    @Req() req: any,
  ) {
    return this.guestService.submitAnswer({
      guestId: req.guest.guestId,
      questionId: body.questionId,
      slideId: body.slideId,
      selectedOption: body.selectedOption,
      answerText: body.answerText,
      timeTakenMs: body.timeTakenMs,
    });
  }

  /** Invitado envía reacción (💡 🤔 ❤ 👏). */
  @Post('session/:sessionId/reaction')
  @UseGuards(GuestGuard)
  @Throttle({ default: { ttl: 10000, limit: 20 } })
  async reaction(
    @Param('sessionId') sessionId: string,
    @Body() body: { emoji: string; slideIndex?: number },
    @Req() req: any,
  ) {
    return this.guestService.submitReaction(req.guest.guestId, sessionId, body.emoji, body.slideIndex);
  }
}
