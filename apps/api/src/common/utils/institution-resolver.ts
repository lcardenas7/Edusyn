import { PrismaClient } from '@prisma/client';

/**
 * Resuelve el institutionId de forma SEGURA respetando roles.
 *
 * REGLA CRÍTICA DE SEGURIDAD:
 * - SuperAdmin (User.isSuperAdmin) puede indicar institutionId explícito.
 * - Usuarios normales SIEMPRE usan el institutionId del JWT. El valor que llegue por
 *   query/body/params se IGNORA.
 * - El fallback a InstitutionUser es determinista y coherente con el login.
 *
 * ⚠️ Este helper es hoy la ÚNICA barrera efectiva de aislamiento multi-tenant: el
 *    TenantGuard global se ejecuta antes que JwtAuthGuard y nunca ve `req.user`
 *    (docs/security/RLS-AUDIT-FASE0.1.md §3). No relajar sin leer esa auditoría.
 */
export async function resolveInstitutionId(
  prisma: PrismaClient,
  req: any,
  queryInstitutionId?: string
): Promise<string | undefined> {
  const user = req.user;

  if (!user) {
    return undefined;
  }

  // 1. SuperAdmin puede indicar institutionId explícito.
  //    Solo se acepta el claim booleano `isSuperAdmin`, que proviene de User.isSuperAdmin.
  //    NO se infiere del array `roles`: esos roles vienen de InstitutionUserRole y un
  //    administrador de tenant que pudiera asignar un rol llamado 'SUPERADMIN' dentro de
  //    su institución obtendría acceso cross-tenant.
  if (user.isSuperAdmin === true && queryInstitutionId) {
    return queryInstitutionId;
  }

  // 2. Usuarios normales → SIEMPRE usar JWT (ignorar query param por seguridad)
  if (user.institutionId) {
    if (queryInstitutionId && queryInstitutionId !== user.institutionId) {
      console.warn(
        `[InstitutionResolver] CROSS-TENANT BLOQUEADO: usuario ${user.id} ` +
        `(institución ${user.institutionId}) solicitó ${queryInstitutionId}. Se usa la del JWT.`,
      );
    }
    return user.institutionId;
  }

  // 3. Fallback: buscar en InstitutionUser (casos legacy o JWT incompleto).
  //    Determinista y coherente con auth.service.login(), que ordena por joinedAt asc y
  //    filtra por isActive. Sin esto, un usuario multi-institución podía resolver a una
  //    institución distinta según la ruta invocada.
  if (user.id) {
    const institutionUser = await prisma.institutionUser.findFirst({
      where: { userId: user.id, isActive: true },
      orderBy: { joinedAt: 'asc' },
      select: { institutionId: true },
    });

    if (institutionUser?.institutionId) {
      return institutionUser.institutionId;
    }
  }

  return undefined;
}

/**
 * Verifica si el usuario es SUPERADMIN.
 * Solo el claim booleano, por el mismo motivo que en resolveInstitutionId().
 */
export function isSuperAdmin(user: any): boolean {
  if (!user) return false;

  return user.isSuperAdmin === true;
}

/**
 * Lanza error si no se puede resolver institutionId (para endpoints que lo requieren obligatoriamente)
 */
export async function requireInstitutionId(
  prisma: PrismaClient,
  req: any,
  queryInstitutionId?: string
): Promise<string> {
  const institutionId = await resolveInstitutionId(prisma, req, queryInstitutionId);
  
  if (!institutionId) {
    throw new Error('No se pudo determinar la institución. Por favor, cierre sesión y vuelva a iniciar.');
  }
  
  return institutionId;
}
