export type RoleLike = string | { name?: string; role?: { name?: string } }

export function getRoleName(role: RoleLike): string {
  if (typeof role === 'string') return role
  return role.role?.name || role.name || ''
}

/**
 * Materializa la autoridad institucional del Rector sin convertirlo en
 * SuperAdmin. Conserva la forma de roles que entregó el backend para no romper
 * consumidores existentes que reciben strings u objetos anidados.
 */
export function withEffectiveInstitutionalRoles(assignedRoles: RoleLike[] = []): RoleLike[] {
  const names = assignedRoles.map(getRoleName).filter(Boolean)
  if (!names.includes('RECTOR') || names.includes('ADMIN_INSTITUTIONAL')) {
    return assignedRoles
  }

  const effectiveAdmin: RoleLike = assignedRoles.some((role) => typeof role !== 'string')
    ? { role: { name: 'ADMIN_INSTITUTIONAL' } }
    : 'ADMIN_INSTITUTIONAL'

  return [...assignedRoles, effectiveAdmin]
}
