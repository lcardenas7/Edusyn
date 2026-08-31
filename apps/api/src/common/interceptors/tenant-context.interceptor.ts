import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { tenantContext } from '../../prisma/tenant-context';
import { SKIP_TENANT_CHECK_KEY } from '../../modules/auth/decorators/skip-tenant-check.decorator';
import { REQUIRE_TENANT_CONTEXT_KEY } from '../../modules/auth/decorators/require-tenant-context.decorator';

/**
 * Interceptor global que ejecuta CADA request autenticado dentro de una
 * transacción interactiva de Prisma con SET LOCAL app.current_institution.
 *
 * Patrón: Transaction-scoped RLS context
 * ─────────────────────────────────────────
 * 1. Abre $transaction en el PrismaClient RAW (no el Proxy)
 * 2. Ejecuta SET LOCAL → solo vive dentro de esta transacción
 * 3. Almacena el `tx` en AsyncLocalStorage
 * 4. PrismaService (Proxy) delega todas las operaciones al `tx`
 * 5. Al completar el request, la transacción se commitea
 * 6. Si hay error, la transacción se revierte automáticamente
 *
 * Esto es SEGURO con connection pooling porque SET LOCAL + queries
 * siempre corren en la MISMA conexión (dentro de la transacción).
 *
 * Compatible con FORCE ROW LEVEL SECURITY.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request?.user;
    const skipTransaction = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT_CHECK_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipTransaction) {
      return next.handle();
    }

    const requireTenantContext = this.reflector.getAllAndOverride<boolean>(REQUIRE_TENANT_CONTEXT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Only SuperAdmin may request an explicit destination. A normal user's
    // tenant always comes from the authenticated session, never from input.
    const superAdminTarget = user?.isSuperAdmin === true ? request?.resolvedInstitutionId : undefined;
    if (requireTenantContext && user?.isSuperAdmin === true && !superAdminTarget) {
      throw new ForbiddenException('SuperAdmin debe indicar institutionId para esta operación.');
    }
    const institutionId = user?.isSuperAdmin === true
      ? superAdminTarget || user?.institutionId
      : user?.institutionId;
    if (!institutionId) {
      // No tenant context needed (login, register, public routes, superadmin)
      return next.handle();
    }

    // Access the raw PrismaClient to open the outer transaction
    const rawPrisma: PrismaClient = (this.prisma as any).$raw;

    return new Observable((subscriber) => {
      let responseValue: any;
      let hasValue = false;

      rawPrisma
        .$transaction(
          async (tx) => {
            // SET LOCAL scoped to this transaction — safe with connection pooling
            // Using set_config() with parameterized query to prevent SQL injection
            await tx.$queryRawUnsafe(
              `SELECT set_config('app.current_institution', $1, true)`,
              institutionId,
            );

            // Run the entire request handler within the tenant context
            // AsyncLocalStorage propagates through all async operations
            return new Promise<void>((resolve, reject) => {
              tenantContext.run({ tx, institutionId }, () => {
                next.handle().subscribe({
                  next: (val) => {
                    responseValue = val;
                    hasValue = true;
                  },
                  error: (err) => reject(err),
                  complete: () => resolve(),
                });
              });
            });
          },
          {
            maxWait: 10000,  // 10s max wait for a connection from pool
            timeout: 120000,  // 120s transaction timeout for slower DB-heavy operations
          },
        )
        .then(() => {
          // Transaction committed → emit buffered response to client
          if (hasValue) {
            subscriber.next(responseValue);
          }
          subscriber.complete();
        })
        .catch((err) => {
          // Transaction rolled back → propagate error
          if (!subscriber.closed) {
            subscriber.error(err);
          }
        });
    });
  }
}
