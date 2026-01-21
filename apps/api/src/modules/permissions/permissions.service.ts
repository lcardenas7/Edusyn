import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PermissionAuditAction } from '@prisma/client';

export interface PermissionCheck {
  hasPermission: boolean;
  source: 'SUPERADMIN' | 'ROLE' | 'EXTRA' | 'DENIED';
  expiresAt?: Date | null;
}

interface GrantPermissionDto {
  userId: string;
  permissionCode: string;
  reason: string;
  validFrom?: Date;
  validTo?: Date | null;
}

interface RevokePermissionDto {
  userId: string;
  permissionCode: string;
  reason: string;
}

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Verifica si un usuario tiene un permiso específico
   */
  async userCan(userId: string, permissionCode: string): Promise<PermissionCheck> {
    // 1. Obtener usuario con roles
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: { role: true }
        },
        institutionUsers: {
          include: {
            institution: {
              include: { modules: true }
            }
          }
        },
        extraPermissions: {
          where: { isActive: true },
          include: { permission: true }
        }
      }
    });

    if (!user) {
      return { hasPermission: false, source: 'DENIED' };
    }

    // 2. SuperAdmin tiene acceso total
    if (user.isSuperAdmin) {
      return { hasPermission: true, source: 'SUPERADMIN' };
    }

    // 3. Obtener el permiso del catálogo
    const permission = await this.prisma.permission.findUnique({
      where: { code: permissionCode }
    });

    if (!permission) {
      return { hasPermission: false, source: 'DENIED' };
    }

    // 4. Verificar si la institución tiene el módulo activo
    const institution = user.institutionUsers[0]?.institution;
    if (institution) {
      const moduleActive = institution.modules.some(
        m => m.isActive && this.moduleMatchesPermission(m.module, permission.module)
      );
      if (!moduleActive) {
        return { hasPermission: false, source: 'DENIED' };
      }
    }

    // 5. Verificar permisos base del rol (herencia de todos los roles)
    const userRoles = user.roles.map(r => r.role.name);
    
    for (const roleName of userRoles) {
      const rolePermission = await this.prisma.roleBasePermission.findFirst({
        where: {
          role: roleName,
          permission: { code: permissionCode }
        }
      });
      
      if (rolePermission) {
        return { hasPermission: true, source: 'ROLE' };
      }
    }

    // 6. Verificar permisos extra del usuario
    const extraPermission = user.extraPermissions.find(ep => {
      if (ep.permission.code !== permissionCode) return false;
      if (!ep.isActive) return false;
      
      const now = new Date();
      if (ep.validFrom && now < ep.validFrom) return false;
      if (ep.validTo && now > ep.validTo) return false;
      
      return true;
    });

    if (extraPermission) {
      return {
        hasPermission: true,
        source: 'EXTRA',
        expiresAt: extraPermission.validTo
      };
    }

    return { hasPermission: false, source: 'DENIED' };
  }

  /**
   * Obtiene todos los permisos efectivos de un usuario
   */
  async getUserPermissions(userId: string): Promise<{
    rolePermissions: string[];
    extraPermissions: Array<{
      code: string;
      expiresAt: Date | null;
      reason: string;
    }>;
    allPermissions: string[];
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
        extraPermissions: {
          where: { isActive: true },
          include: { permission: true }
        }
      }
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Permisos de roles
    const userRoles = user.roles.map(r => r.role.name);
    const rolePermissions = await this.prisma.roleBasePermission.findMany({
      where: { role: { in: userRoles } },
      include: { permission: true }
    });

    const rolePermissionCodes = [...new Set(rolePermissions.map(rp => rp.permission.code))];

    // Permisos extra vigentes
    const now = new Date();
    const validExtraPermissions = user.extraPermissions.filter(ep => {
      if (ep.validFrom && now < ep.validFrom) return false;
      if (ep.validTo && now > ep.validTo) return false;
      return true;
    });

    const extraPermissionData = validExtraPermissions.map(ep => ({
      code: ep.permission.code,
      expiresAt: ep.validTo,
      reason: ep.reason
    }));

    const extraPermissionCodes = extraPermissionData.map(ep => ep.code);

    // Todos los permisos (sin duplicados)
    const allPermissions = [...new Set([...rolePermissionCodes, ...extraPermissionCodes])];

    return {
      rolePermissions: rolePermissionCodes,
      extraPermissions: extraPermissionData,
      allPermissions
    };
  }

  /**
   * Otorga un permiso extra a un usuario
   */
  async grantPermission(
    grantedById: string,
    institutionId: string,
    dto: GrantPermissionDto
  ): Promise<void> {
    // Verificar que quien otorga tiene permiso para hacerlo
    const canGrant = await this.userCan(grantedById, 'USERS_ASSIGN_PERMISSIONS');
    if (!canGrant.hasPermission) {
      throw new ForbiddenException('No tienes permiso para otorgar permisos');
    }

    // Obtener el permiso
    const permission = await this.prisma.permission.findUnique({
      where: { code: dto.permissionCode }
    });

    if (!permission) {
      throw new NotFoundException(`Permiso no encontrado: ${dto.permissionCode}`);
    }

    // Verificar que el usuario existe
    const targetUser = await this.prisma.user.findUnique({
      where: { id: dto.userId }
    });

    if (!targetUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Crear o actualizar el permiso extra
    await this.prisma.userExtraPermission.upsert({
      where: {
        userId_permissionId: {
          userId: dto.userId,
          permissionId: permission.id
        }
      },
      update: {
        isActive: true,
        grantedById,
        grantedAt: new Date(),
        validFrom: dto.validFrom || new Date(),
        validTo: dto.validTo || null,
        reason: dto.reason,
        revokedAt: null,
        revokedById: null,
        revokeReason: null
      },
      create: {
        userId: dto.userId,
        permissionId: permission.id,
        grantedById,
        validFrom: dto.validFrom || new Date(),
        validTo: dto.validTo || null,
        reason: dto.reason
      }
    });

    // Registrar en auditoría
    await this.logAudit({
      institutionId,
      action: PermissionAuditAction.GRANT,
      targetUserId: dto.userId,
      permissionId: permission.id,
      performedById: grantedById,
      reason: dto.reason,
      metadata: {
        validFrom: dto.validFrom,
        validTo: dto.validTo
      }
    });
  }

  /**
   * Revoca un permiso extra de un usuario
   */
  async revokePermission(
    revokedById: string,
    institutionId: string,
    dto: RevokePermissionDto
  ): Promise<void> {
    // Verificar que quien revoca tiene permiso para hacerlo
    const canRevoke = await this.userCan(revokedById, 'USERS_ASSIGN_PERMISSIONS');
    if (!canRevoke.hasPermission) {
      throw new ForbiddenException('No tienes permiso para revocar permisos');
    }

    // Obtener el permiso
    const permission = await this.prisma.permission.findUnique({
      where: { code: dto.permissionCode }
    });

    if (!permission) {
      throw new NotFoundException(`Permiso no encontrado: ${dto.permissionCode}`);
    }

    // Buscar el permiso extra
    const extraPermission = await this.prisma.userExtraPermission.findUnique({
      where: {
        userId_permissionId: {
          userId: dto.userId,
          permissionId: permission.id
        }
      }
    });

    if (!extraPermission) {
      throw new NotFoundException('El usuario no tiene este permiso extra');
    }

    // Revocar el permiso
    await this.prisma.userExtraPermission.update({
      where: { id: extraPermission.id },
      data: {
        isActive: false,
        revokedAt: new Date(),
        revokedById,
        revokeReason: dto.reason
      }
    });

    // Registrar en auditoría
    await this.logAudit({
      institutionId,
      action: PermissionAuditAction.REVOKE,
      targetUserId: dto.userId,
      permissionId: permission.id,
      performedById: revokedById,
      reason: dto.reason
    });
  }

  /**
   * Obtiene el catálogo de permisos agrupado por módulo y función
   */
  async getPermissionsCatalog(): Promise<any> {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { function: 'asc' }, { subFunction: 'asc' }]
    });

    // Agrupar por módulo y función
    const catalog: Record<string, Record<string, any[]>> = {};

    for (const perm of permissions) {
      if (!catalog[perm.module]) {
        catalog[perm.module] = {};
      }
      if (!catalog[perm.module][perm.function]) {
        catalog[perm.module][perm.function] = [];
      }
      catalog[perm.module][perm.function].push({
        code: perm.code,
        name: perm.name,
        description: perm.description,
        subFunction: perm.subFunction
      });
    }

    return catalog;
  }

  /**
   * Obtiene los permisos base de un rol
   */
  async getRolePermissions(role: string): Promise<string[]> {
    const rolePermissions = await this.prisma.roleBasePermission.findMany({
      where: { role },
      include: { permission: true }
    });

    return rolePermissions.map(rp => rp.permission.code);
  }

  /**
   * Obtiene el historial de auditoría de permisos
   */
  async getAuditLog(
    institutionId: string,
    options?: {
      userId?: string;
      action?: PermissionAuditAction;
      fromDate?: Date;
      toDate?: Date;
      limit?: number;
    }
  ): Promise<any[]> {
    const where: any = { institutionId };

    if (options?.userId) {
      where.targetUserId = options.userId;
    }
    if (options?.action) {
      where.action = options.action;
    }
    if (options?.fromDate || options?.toDate) {
      where.performedAt = {};
      if (options.fromDate) where.performedAt.gte = options.fromDate;
      if (options.toDate) where.performedAt.lte = options.toDate;
    }

    const logs = await this.prisma.permissionAuditLog.findMany({
      where,
      include: {
        targetUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        performedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        permission: { select: { code: true, name: true } }
      },
      orderBy: { performedAt: 'desc' },
      take: options?.limit || 100
    });

    return logs;
  }

  /**
   * Expira permisos vencidos (para ejecutar con cron)
   */
  async expirePermissions(): Promise<number> {
    const now = new Date();

    // Buscar permisos vencidos
    const expiredPermissions = await this.prisma.userExtraPermission.findMany({
      where: {
        isActive: true,
        validTo: { lt: now }
      },
      include: {
        user: { include: { institutionUsers: true } },
        permission: true
      }
    });

    // Marcar como expirados y registrar auditoría
    for (const ep of expiredPermissions) {
      await this.prisma.userExtraPermission.update({
        where: { id: ep.id },
        data: { isActive: false }
      });

      const institutionId = ep.user.institutionUsers[0]?.institutionId;
      if (institutionId) {
        await this.logAudit({
          institutionId,
          action: PermissionAuditAction.EXPIRE,
          targetUserId: ep.userId,
          permissionId: ep.permissionId,
          performedById: ep.userId, // Sistema
          reason: 'Expiración automática por fecha límite'
        });
      }
    }

    return expiredPermissions.length;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS PRIVADOS
  // ═══════════════════════════════════════════════════════════════════════════

  private moduleMatchesPermission(systemModule: string, permissionModule: string): boolean {
    const moduleMapping: Record<string, string[]> = {
      'ACADEMIC': ['ACADEMIC', 'CONFIG_INSTITUTIONAL'],
      'CONFIG': ['CONFIG_INSTITUTIONAL'],
      'USERS': ['USERS'],
      'REPORTS': ['REPORTS'],
      'ATTENDANCE': ['TRACKING'],
      'OBSERVER': ['TRACKING'],
      'COMMUNICATIONS': ['COMMUNICATIONS'],
      'EVALUATION': ['ACADEMIC'],
      'RECOVERY': ['ACADEMIC'],
    };

    const allowedModules = moduleMapping[systemModule] || [systemModule];
    return allowedModules.includes(permissionModule);
  }

  private async logAudit(data: {
    institutionId: string;
    action: PermissionAuditAction;
    targetUserId: string;
    permissionId?: string;
    performedById: string;
    reason?: string;
    metadata?: any;
    oldRole?: string;
    newRole?: string;
  }): Promise<void> {
    await this.prisma.permissionAuditLog.create({
      data: {
        institutionId: data.institutionId,
        action: data.action,
        targetUserId: data.targetUserId,
        permissionId: data.permissionId,
        performedById: data.performedById,
        reason: data.reason,
        metadata: data.metadata,
        oldRole: data.oldRole,
        newRole: data.newRole
      }
    });
  }
}
