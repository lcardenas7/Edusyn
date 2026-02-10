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

@Controller('capabilities')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CapabilitiesController {
  constructor(private readonly capabilitiesService: CapabilitiesService) {}

  /**
   * Obtiene la matriz de capabilities para la institución (admin)
   */
  @Get('matrix/:institutionId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getCapabilityMatrix(@Param('institutionId') institutionId: string) {
    return this.capabilitiesService.getCapabilityMatrix(institutionId);
  }

  /**
   * Actualiza la matriz de capabilities (admin)
   */
  @Put('matrix/:institutionId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async updateCapabilityMatrix(
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
    await this.capabilitiesService.updateCapabilityMatrix(
      institutionId,
      body.updates,
    );
    return { success: true, message: 'Capabilities actualizadas' };
  }

  /**
   * Restaurar valores por defecto
   */
  @Post('matrix/:institutionId/reset')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async resetToDefaults(@Param('institutionId') institutionId: string) {
    await this.capabilitiesService.resetToDefaults(institutionId);
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
