import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Guard que permite acceso a gestión de credenciales si:
 * 1. El usuario tiene rol SUPERADMIN, ADMIN_INSTITUTIONAL o COORDINADOR, O
 * 2. El usuario tiene el permiso delegado canManageCredentials en su InstitutionUser
 */
@Injectable()
export class CredentialsGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return false;

    // 1. Verificar roles tradicionales (desde JWT)
    const roles: string[] = user.roles || [];
    const roleNames = roles.map((r: any) => 
      typeof r === 'string' ? r : r?.role?.name || r?.name || ''
    );

    const hasAdminRole = roleNames.some(name => 
      ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR'].includes(name)
    );

    if (hasAdminRole) return true;

    // 2. Verificar permiso delegado en InstitutionUser
    const userId = user.sub || user.id;
    const institutionId = user.institutionId || request.query?.institutionId || request.body?.institutionId;

    if (!userId || !institutionId) return false;

    const institutionUser = await this.prisma.institutionUser.findUnique({
      where: {
        userId_institutionId: {
          userId,
          institutionId,
        },
      },
      select: {
        canManageCredentials: true,
        isActive: true,
      },
    });

    return institutionUser?.isActive === true && institutionUser?.canManageCredentials === true;
  }
}
