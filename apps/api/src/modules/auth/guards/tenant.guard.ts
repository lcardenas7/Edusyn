import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SKIP_TENANT_CHECK_KEY } from '../decorators/skip-tenant-check.decorator';

/**
 * TenantGuard — Opción D (Híbrido)
 * 
 * Ejecutar DESPUÉS de JwtAuthGuard (requiere req.user).
 * 
 * Comportamiento:
 * 1. Si @SkipTenantCheck() → pasa sin validación
 * 2. Si no hay req.user (endpoint público sin JwtAuthGuard) → pasa
 * 3. Si isSuperAdmin y tiene institutionId → inyecta req.resolvedInstitutionId
 * 4. Si isSuperAdmin SIN institutionId → inyecta null (solo endpoints de gestión)
 * 5. Si usuario normal SIN institutionId → 403
 * 6. Si usuario normal CON institutionId → inyecta req.resolvedInstitutionId
 * 7. Si hay institutionId en query/body/param Y no coincide con JWT → 403
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check @SkipTenantCheck() at handler or class level
    const skipCheck = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT_CHECK_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipCheck) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // No user = endpoint público sin JwtAuthGuard → no bloquear
    if (!user) return true;

    const jwtInstitutionId: string | null = user.institutionId || null;
    const isSuperAdmin: boolean = user.isSuperAdmin === true;

    // SuperAdmin: puede operar sin tenant (solo para endpoints de gestión global)
    // o con tenant (operando en una institución específica)
    if (isSuperAdmin) {
      // Si SuperAdmin especifica institutionId en query, usar ese
      const queryInstitutionId = request.query?.institutionId;
      request.resolvedInstitutionId = queryInstitutionId || jwtInstitutionId || null;
      return true;
    }

    // Usuario normal: DEBE tener institutionId
    if (!jwtInstitutionId) {
      throw new ForbiddenException(
        'Tu sesión no tiene una institución activa. Por favor, inicia sesión nuevamente.',
      );
    }

    // Cross-tenant check: si el request trae institutionId, debe coincidir
    const requestInstitutionId =
      request.query?.institutionId ||
      request.body?.institutionId ||
      request.params?.institutionId;

    if (requestInstitutionId && requestInstitutionId !== jwtInstitutionId) {
      console.warn(
        `[TenantGuard] BLOCKED: User ${user.id} (inst=${jwtInstitutionId}) attempted cross-tenant access to ${requestInstitutionId}`,
      );
      throw new ForbiddenException(
        'No tienes acceso a esta institución.',
      );
    }

    // Inyectar institutionId resuelto para uso downstream
    request.resolvedInstitutionId = jwtInstitutionId;
    return true;
  }
}
