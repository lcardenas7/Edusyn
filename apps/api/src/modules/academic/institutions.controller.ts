import { Controller, Get, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';
import { InstitutionsService } from './institutions.service';

@Controller('institutions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InstitutionsController {
  constructor(
    private readonly institutionsService: InstitutionsService,
    private readonly prisma: PrismaService,
  ) {}

  // NOTA (Onboarding v2 · Módulo 1): el POST /institutions se eliminó. Creaba
  // instituciones ROTAS (sin admin, sin roles, sin escala) y permitía el rol
  // ADMIN_INSTITUTIONAL, lo que dejaba a un admin de institución crear otras
  // instituciones. La creación canónica es POST /superadmin/institutions
  // (superadmin.service.createInstitution). Este controlador solo consulta.

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async list() {
    return this.institutionsService.list();
  }

  /**
   * Estado de configuración inicial: alimenta el wizard /setup y el dashboard administrativo.
   * Accesible para roles administrativos de la institución.
   */
  @Get('setup-status')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR')
  async getSetupStatus(@Req() req: any) {
    const institutionId = await requireInstitutionId(this.prisma, req);
    return this.institutionsService.getSetupStatus(institutionId);
  }
}
