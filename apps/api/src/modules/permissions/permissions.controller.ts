import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsService } from './permissions.service';

@Controller('permissions')
@UseGuards(JwtAuthGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  /**
   * Obtiene el catálogo de permisos agrupado por módulo y función
   */
  @Get('catalog')
  async getCatalog() {
    return this.permissionsService.getPermissionsCatalog();
  }

  /**
   * Obtiene los permisos base de un rol
   */
  @Get('roles/:role')
  async getRolePermissions(@Param('role') role: string) {
    const permissions = await this.permissionsService.getRolePermissions(role);
    return { role, permissions };
  }

  /**
   * Verifica si el usuario actual tiene un permiso específico
   */
  @Get('check/:code')
  async checkPermission(@Request() req: any, @Param('code') code: string) {
    const result = await this.permissionsService.userCan(req.user.id, code);
    return result;
  }

  /**
   * Obtiene todos los permisos del usuario actual
   */
  @Get('my-permissions')
  async getMyPermissions(@Request() req: any) {
    return this.permissionsService.getUserPermissions(req.user.id);
  }

  /**
   * Obtiene los permisos de un usuario específico
   */
  @Get('users/:userId')
  async getUserPermissions(@Param('userId') userId: string) {
    return this.permissionsService.getUserPermissions(userId);
  }

  /**
   * Otorga un permiso extra a un usuario
   */
  @Post('grant')
  async grantPermission(
    @Request() req: any,
    @Body() body: {
      userId: string;
      permissionCode: string;
      reason: string;
      validFrom?: string;
      validTo?: string;
    }
  ) {
    const institutionId = req.user.institutionId;
    
    await this.permissionsService.grantPermission(req.user.id, institutionId, {
      userId: body.userId,
      permissionCode: body.permissionCode,
      reason: body.reason,
      validFrom: body.validFrom ? new Date(body.validFrom) : undefined,
      validTo: body.validTo ? new Date(body.validTo) : null,
    });

    return { success: true, message: 'Permiso otorgado correctamente' };
  }

  /**
   * Revoca un permiso extra de un usuario
   */
  @Delete('revoke')
  async revokePermission(
    @Request() req: any,
    @Body() body: {
      userId: string;
      permissionCode: string;
      reason: string;
    }
  ) {
    const institutionId = req.user.institutionId;
    
    await this.permissionsService.revokePermission(req.user.id, institutionId, {
      userId: body.userId,
      permissionCode: body.permissionCode,
      reason: body.reason,
    });

    return { success: true, message: 'Permiso revocado correctamente' };
  }

  /**
   * Obtiene el historial de auditoría de permisos
   */
  @Get('audit')
  async getAuditLog(
    @Request() req: any,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('limit') limit?: string
  ) {
    const institutionId = req.user.institutionId;
    
    return this.permissionsService.getAuditLog(institutionId, {
      userId,
      action: action as any,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }
}
