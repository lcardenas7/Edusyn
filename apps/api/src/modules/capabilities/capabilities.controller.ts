import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CapabilitiesService } from './capabilities.service';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';

/**
 * Matriz de capabilities: qué puede ver y hacer cada rol DENTRO de cada institución.
 *
 * ⚠️ AISLAMIENTO MULTI-TENANT — el `:institutionId` de la ruta NO es de fiar.
 * `RolesGuard` comprueba QUÉ ROL tiene el usuario, no SOBRE QUÉ INSTITUCIÓN actúa, y el
 * `TenantGuard` global nunca llega a ejecutarse con `req.user`
 * (docs/security/RLS-AUDIT-FASE0.1.md §3). Antes de este cambio, un ADMIN_INSTITUTIONAL
 * de la institución A podía reescribir —o borrar con `reset`— la matriz de permisos de la
 * institución B: no una fuga de datos, sino una escalada de privilegios cross-tenant, y
 * además silenciosa (sin auditoría y con la matriz cacheada en memoria).
 *
 * Ahora la institución se resuelve con `requireInstitutionId`, que ignora el parámetro de
 * la ruta para usuarios normales y solo lo honra para SuperAdmin. El parámetro se mantiene
 * en la URL para no romper el contrato con el frontend, que ya envía el suyo propio
 * (`user.institution.id` en CapabilitiesConfig.tsx).
 */
@Controller('capabilities')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CapabilitiesController {
  constructor(
    private readonly capabilitiesService: CapabilitiesService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Obtiene la matriz de capabilities para la institución (admin)
   */
  @Get('matrix/:institutionId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getCapabilityMatrix(
    @Request() req: any,
    @Param('institutionId') institutionId: string,
  ) {
    const targetInstitutionId = await requireInstitutionId(
      this.prisma as any,
      req,
      institutionId,
    );
    return this.capabilitiesService.getCapabilityMatrix(targetInstitutionId);
  }

  /**
   * Actualiza la matriz de capabilities (admin)
   */
  @Put('matrix/:institutionId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async updateCapabilityMatrix(
    @Request() req: any,
    @Param('institutionId') institutionId: string,
    @Body()
    body: {
      updates: Array<{
        role: string;
        capabilityKey: string;
        isEnabled: boolean;
      }>;
    },
  ) {
    const targetInstitutionId = await requireInstitutionId(
      this.prisma as any,
      req,
      institutionId,
    );
    await this.capabilitiesService.updateCapabilityMatrix(
      targetInstitutionId,
      body.updates,
    );
    return { success: true, message: 'Capabilities actualizadas' };
  }

  /**
   * Restaurar valores por defecto.
   * Operación DESTRUCTIVA: `resetToDefaults` hace `deleteMany` sobre la matriz completa
   * de la institución. Razón de más para no aceptar el identificador del cliente.
   */
  @Post('matrix/:institutionId/reset')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async resetToDefaults(
    @Request() req: any,
    @Param('institutionId') institutionId: string,
  ) {
    const targetInstitutionId = await requireInstitutionId(
      this.prisma as any,
      req,
      institutionId,
    );
    await this.capabilitiesService.resetToDefaults(targetInstitutionId);
    return { success: true, message: 'Capabilities restauradas a valores por defecto' };
  }

  /**
   * Obtiene las capabilities del usuario actual (para frontend)
   */
  @Get('my-capabilities')
  async getMyCapabilities(@Request() req: any) {
    const userId = req.user.sub || req.user.id;
    const institutionId = req.user.institutionId;

    if (!institutionId) {
      return {
        capabilities: [],
        effectiveRoles: [],
        isTutor: false,
        tutorGroupIds: [],
        teacherAssignmentGroupIds: [],
      };
    }

    return this.capabilitiesService.getUserCapabilities(userId, institutionId);
  }

  /**
   * Verifica si el usuario tiene una capability específica
   */
  @Get('check/:capabilityKey')
  async checkCapability(
    @Request() req: any,
    @Param('capabilityKey') capabilityKey: string,
  ) {
    const userId = req.user.sub || req.user.id;
    const institutionId = req.user.institutionId;

    if (!institutionId) {
      return { hasCapability: false };
    }

    const result = await this.capabilitiesService.userHasCapability(
      userId,
      institutionId,
      capabilityKey,
    );

    return { hasCapability: result };
  }
}
