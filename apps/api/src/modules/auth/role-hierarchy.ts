export const INSTITUTIONAL_ADMIN_ROLE = 'ADMIN_INSTITUTIONAL';
export const RECTOR_ROLE = 'RECTOR';

/**
 * Roles efectivos para autorización dentro de una institución.
 *
 * El Rector hereda la autoridad del administrador institucional, pero no la
 * identidad ni las capacidades de SUPERADMIN. El institutionId de la sesión
 * no se modifica: la frontera sigue siendo siempre la institución del JWT.
 */
export function expandEffectiveRoles(assignedRoles: readonly string[] = []): string[] {
  const roles = [...new Set(assignedRoles.filter(Boolean))];
  if (roles.includes(RECTOR_ROLE) && !roles.includes(INSTITUTIONAL_ADMIN_ROLE)) {
    roles.push(INSTITUTIONAL_ADMIN_ROLE);
  }
  return roles;
}

export function hasInstitutionalAdminAuthority(assignedRoles: readonly string[] = []): boolean {
  return expandEffectiveRoles(assignedRoles).includes(INSTITUTIONAL_ADMIN_ROLE);
}
