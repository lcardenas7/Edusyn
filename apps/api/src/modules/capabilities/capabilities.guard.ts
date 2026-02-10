import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CAPABILITY_KEY } from './capabilities.decorator';
import { CapabilitiesService } from './capabilities.service';

/**
 * Guard que verifica si el usuario tiene una capability específica.
 * Se usa junto con @RequireCapability('CAPABILITY_KEY').
 * 
 * Si no se especifica capability (decorador ausente), permite el acceso.
 * SuperAdmin y Admin Institucional pasan automáticamente.
 */
@Injectable()
export class CapabilitiesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly capabilitiesService: CapabilitiesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredCapability = this.reflector.getAllAndOverride<string>(
      CAPABILITY_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si no hay capability requerida, permitir acceso
    if (!requiredCapability) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    const userId = user.sub || user.id;
    const institutionId = user.institutionId;

    if (!institutionId) {
      throw new ForbiddenException('No se encontró la institución del usuario');
    }

    const hasCapability = await this.capabilitiesService.userHasCapability(
      userId,
      institutionId,
      requiredCapability,
    );

    if (!hasCapability) {
      throw new ForbiddenException(
        `Acceso denegado. No tienes la capacidad: ${requiredCapability}`,
      );
    }

    return true;
  }
}
