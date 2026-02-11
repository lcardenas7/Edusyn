import { AsyncLocalStorage } from 'async_hooks';

/**
 * Stores the Prisma transaction client and institutionId for the current request.
 * Used by PrismaService's Proxy to delegate model operations to the
 * transaction-scoped client, ensuring SET LOCAL app.current_institution
 * applies to all queries within the request.
 */
export interface TenantStore {
  /** Prisma interactive transaction client with SET LOCAL already applied */
  tx: any;
  /** The resolved institutionId for this request */
  institutionId: string;
}

export const tenantContext = new AsyncLocalStorage<TenantStore>();
