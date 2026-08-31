import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Validates the explicit institution chosen by a SuperAdmin after JWT
 * authentication and before the tenant transaction is opened.
 *
 * Normal institutional users do not choose a tenant: their JWT remains the
 * only source of truth. Controllers opt in to this guard; it is not global.
 */
@Injectable()
export class ValidateTenantContextGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    if (request.user?.isSuperAdmin !== true) return true;

    const institutionId = request.query?.institutionId;
    if (typeof institutionId !== 'string' || !institutionId.trim()) {
      throw new ForbiddenException('SuperAdmin debe indicar institutionId para esta operación.');
    }

    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: { id: true },
    });
    if (!institution) throw new NotFoundException('La institución solicitada no existe.');

    request.resolvedInstitutionId = institution.id;
    return true;
  }
}
