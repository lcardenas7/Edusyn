import { describe, expect, it } from 'vitest'
import { getRoleName, withEffectiveInstitutionalRoles } from './roleHierarchy'

describe('jerarquía efectiva de roles institucionales', () => {
  it('da al Rector la autoridad efectiva de administrador sin añadir SuperAdmin', () => {
    const roles = withEffectiveInstitutionalRoles(['RECTOR'])
    expect(roles.map(getRoleName)).toEqual(['RECTOR', 'ADMIN_INSTITUTIONAL'])
    expect(roles.map(getRoleName)).not.toContain('SUPERADMIN')
  })

  it('preserva la forma anidada de /auth/me', () => {
    const roles = withEffectiveInstitutionalRoles([{ role: { name: 'RECTOR' } }])
    expect(roles).toEqual([
      { role: { name: 'RECTOR' } },
      { role: { name: 'ADMIN_INSTITUTIONAL' } },
    ])
  })

  it('no duplica el rol de administrador ya asignado ni cambia otros roles', () => {
    const assigned = ['RECTOR', 'ADMIN_INSTITUTIONAL']
    expect(withEffectiveInstitutionalRoles(assigned)).toBe(assigned)
    expect(withEffectiveInstitutionalRoles(['DOCENTE'])).toEqual(['DOCENTE'])
  })
})
