import { SetMetadata } from '@nestjs/common';

export const REQUIRE_TENANT_CONTEXT_KEY = 'requireTenantContext';

/** Requires a validated effective institution before the handler can run. */
export const RequireTenantContext = () => SetMetadata(REQUIRE_TENANT_CONTEXT_KEY, true);
