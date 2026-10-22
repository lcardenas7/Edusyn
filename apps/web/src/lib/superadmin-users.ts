export interface InstitutionAccessUser {
  id: string
  firstName: string
  lastName: string
  email: string
  username?: string | null
  documentNumber?: string | null
  isAdmin: boolean
  mustChangePassword: boolean
  roles: string[]
}

export function isInstitutionManager(user: Pick<InstitutionAccessUser, 'isAdmin' | 'roles'>): boolean {
  return user.isAdmin || user.roles.some(role => role === 'ADMIN_INSTITUTIONAL' || role === 'RECTOR')
}

export function getInstitutionAdmin(institution: {
  users?: { isAdmin: boolean; user?: { firstName: string; lastName: string; email: string } }[]
  adminName?: string
  adminEmail?: string
}): { adminName: string; adminEmail: string } {
  const admin = institution.users?.find(member => member.isAdmin && member.user)?.user
  return {
    adminName: admin ? `${admin.firstName} ${admin.lastName}`.trim() : institution.adminName || '',
    adminEmail: admin?.email || institution.adminEmail || '',
  }
}
