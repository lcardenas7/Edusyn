import { SetMetadata } from '@nestjs/common';

export const CAPABILITY_KEY = 'capability';

/**
 * Decorador para requerir una capability específica en un endpoint.
 * Se usa junto con CapabilitiesGuard.
 * 
 * Ejemplo: @RequireCapability('VIEW_OWN_SCHEDULE')
 */
export const RequireCapability = (capability: string) =>
  SetMetadata(CAPABILITY_KEY, capability);
