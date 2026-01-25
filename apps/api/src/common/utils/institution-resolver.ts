import { PrismaClient } from '@prisma/client';

/**
 * Resuelve el institutionId de forma SEGURA respetando roles.
 * 
 * REGLA CRÍTICA DE SEGURIDAD:
 * - SUPERADMIN puede usar institutionId del query (para administrar cualquier institución)
 * - Usuarios normales SIEMPRE usan el institutionId del JWT o InstitutionUser
 * - NUNCA se permite que un usuario no privilegiado acceda a datos de otra institución
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

  // 1. SUPERADMIN puede enviar institutionId explícito (para administrar cualquier institución)
  const isSuperAdmin = user.isSuperAdmin === true || 
    user.roles?.some((r: any) => 
      r.role?.name === 'SUPERADMIN' || 
      r.role?.name === 'SUPER_ADMIN' ||
      r.roleName === 'SUPERADMIN' ||
      r.roleName === 'SUPER_ADMIN'
    );

  if (isSuperAdmin && queryInstitutionId) {
    console.log(`[InstitutionResolver] SUPERADMIN usando institutionId del query: ${queryInstitutionId}`);
    return queryInstitutionId;
  }

  // 2. Usuarios normales → SIEMPRE usar JWT (ignorar query param por seguridad)
  if (user.institutionId) {
    if (queryInstitutionId && queryInstitutionId !== user.institutionId) {
      console.warn(`[InstitutionResolver] SEGURIDAD: Usuario ${user.id} intentó acceder a institución ${queryInstitutionId} pero pertenece a ${user.institutionId}`);
    }
    return user.institutionId;
  }

  // 3. Fallback: buscar en InstitutionUser (casos legacy o JWT incompleto)
  if (user.id) {
    const institutionUser = await prisma.institutionUser.findFirst({
      where: { userId: user.id },
      select: { institutionId: true }
    });
    
    if (institutionUser?.institutionId) {
      console.log(`[InstitutionResolver] institutionId obtenido de InstitutionUser: ${institutionUser.institutionId}`);
      return institutionUser.institutionId;
    }
  }

  console.warn(`[InstitutionResolver] No se pudo resolver institutionId para usuario ${user.id}`);
  return undefined;
}

/**
 * Verifica si el usuario es SUPERADMIN
 */
export function isSuperAdmin(user: any): boolean {
  if (!user) return false;
  
  return user.isSuperAdmin === true || 
    user.roles?.some((r: any) => 
      r.role?.name === 'SUPERADMIN' || 
      r.role?.name === 'SUPER_ADMIN' ||
      r.roleName === 'SUPERADMIN' ||
      r.roleName === 'SUPER_ADMIN'
    );
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
