import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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

/**
 * Construye la URL de conexión asegurando un connection_limit/pool_timeout sanos.
 *
 * Sin esto, Prisma usa el default `num_cpus * 2 + 1`, que en los contenedores de
 * Railway (≈5 CPUs) da un pool de SOLO 11 conexiones. Como cada request autenticado
 * abre una transacción interactiva (TenantContextInterceptor) que retiene 1 conexión
 * durante todo el request, cuando un curso entero responde un "Quiz en Casa" al mismo
 * tiempo, el request #12 espera por una conexión libre y falla con P2024 → "solo 11
 * podían responder". Aquí elevamos el pool (configurable) para soportar cursos completos.
 */
function buildDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    // Si la URL no es parseable, devolvemos la original sin tocar
    return raw;
  }

  const connectionLimit = process.env.DB_CONNECTION_LIMIT || '20';
  const poolTimeout = process.env.DB_POOL_TIMEOUT || '20';

  if (!url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', connectionLimit);
  }
  if (!url.searchParams.has('pool_timeout')) {
    url.searchParams.set('pool_timeout', poolTimeout);
  }

  return url.toString();
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private static readonly logger = new Logger(PrismaService.name);

  /**
   * Access the raw PrismaClient, bypassing tenant context.
   * Used by TenantContextInterceptor to open the outer transaction.
   * DO NOT use in services — always use `this.prisma.*` which respects RLS.
   */
  declare readonly $raw: PrismaClient;

  constructor() {
    const datasourceUrl = buildDatabaseUrl();
    super(datasourceUrl ? { datasourceUrl } : undefined);

    if (datasourceUrl) {
      try {
        const parsed = new URL(datasourceUrl);
        PrismaService.logger.log(
          `Prisma pool configurado: connection_limit=${parsed.searchParams.get('connection_limit') ?? 'default'}, pool_timeout=${parsed.searchParams.get('pool_timeout') ?? 'default'}`,
        );
      } catch {
        /* noop */
      }
    }

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
