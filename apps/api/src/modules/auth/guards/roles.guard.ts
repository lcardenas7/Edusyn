import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { roles?: string[] | any[] } | undefined;

    // Extraer roles - soportar tanto array de strings como array de objetos
    let roles: string[] = [];
    if (user?.roles) {
      roles = user.roles.map((r: any) => {
        if (typeof r === 'string') return r;
        if (r?.role?.name) return r.role.name;
        if (r?.name) return r.name;
        return '';
      }).filter(Boolean);
    }

    const hasRole = requiredRoles.some((r) => roles.includes(r));
    
    if (!hasRole) {
      console.log(`[RolesGuard] Access denied. User roles: ${JSON.stringify(roles)}, Required: ${JSON.stringify(requiredRoles)}`);
      throw new ForbiddenException(`Acceso denegado. Se requiere uno de estos roles: ${requiredRoles.join(', ')}`);
    }
    
    return true;
  }
}
