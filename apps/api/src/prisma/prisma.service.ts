import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { tenantContext } from './tenant-context';

/**
 * Properties that should NEVER be delegated to the transaction client.
 * These are lifecycle/system methods that must always run on the raw PrismaClient.
 */
const NON_DELEGATABLE = new Set([
  '$connect',
  '$disconnect',
  '$on',
  '$use',
  '$extends',
  'onModuleInit',
  'onModuleDestroy',
  'onApplicationShutdown',
  '$raw',    // Our escape hatch for raw client access
  'then',    // Prevent Proxy from being treated as a thenable
]);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  /**
   * Access the raw PrismaClient, bypassing tenant context.
   * Used by TenantContextInterceptor to open the outer transaction.
   * DO NOT use in services — always use `this.prisma.*` which respects RLS.
   */
  declare readonly $raw: PrismaClient;

  constructor() {
    super();

    const rawClient = this;

    return new Proxy(this, {
      get(target, prop, receiver) {
        // $raw always returns the unwrapped PrismaClient
        if (prop === '$raw') return rawClient;

        // System properties always go to the raw client
        if (typeof prop === 'symbol' || NON_DELEGATABLE.has(prop as string)) {
          return Reflect.get(target, prop, receiver);
        }

        const store = tenantContext.getStore();
        if (!store?.tx) {
          // No tenant context → use raw PrismaClient (unauthenticated routes, etc.)
          return Reflect.get(target, prop, receiver);
        }

        // $transaction within a tenant context: flatten nested transactions
        if (prop === '$transaction') {
          return async (argOrFn: any, options?: any) => {
            if (typeof argOrFn === 'function') {
              // Interactive transaction: call with existing tx (flatten)
              return argOrFn(store.tx);
            }
            // Batch transaction: operations are already PrismaPromises from tx
            return Promise.all(argOrFn);
          };
        }

        // Delegate model access and $queryRaw/$executeRaw to the tx
        if (prop in store.tx) {
          return (store.tx as any)[prop];
        }

        return Reflect.get(target, prop, receiver);
      },
    }) as PrismaService;
  }

  async onModuleInit() {
    await this.$connect();
  }
}
