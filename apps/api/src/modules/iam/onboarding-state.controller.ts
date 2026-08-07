import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';
import { OnboardingStateService } from './onboarding-state.service';

/**
 * MÓDULO 8 (Onboarding v2) — Estado Canónico del onboarding (§5, AR10).
 *
 * GET /onboarding/state → OnboardingState. Read-only. El frontend cambia su
 * adaptador de mock a este endpoint sin tocar componentes (E4).
 */
@Controller('onboarding')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OnboardingStateController {
  constructor(
    private readonly onboardingState: OnboardingStateService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('state')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'RECTOR', 'COORDINADOR')
  async getState(@Request() req: any, @Query('institutionId') institutionId?: string) {
    // `institutionId` del query solo lo honra SUPERADMIN (resolveInstitutionId);
    // el admin de una institución siempre resuelve por su JWT (AR6).
    const resolved = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.onboardingState.getState(resolved);
  }
}
