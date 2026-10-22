import { describe, expect, it } from 'vitest'
import { getInstitutionAdmin, isInstitutionManager } from './superadmin-users'

describe('identificación de administradores y rectores', () => {
  it('incluye al administrador aunque no tenga roles materializados', () => {
    expect(isInstitutionManager({ isAdmin: true, roles: [] })).toBe(true)
  })

  it('incluye al rector separado y al administrador con rol institucional', () => {
    expect(isInstitutionManager({ isAdmin: false, roles: ['RECTOR'] })).toBe(true)
    expect(isInstitutionManager({ isAdmin: false, roles: ['ADMIN_INSTITUTIONAL'] })).toBe(true)
    expect(isInstitutionManager({ isAdmin: false, roles: ['DOCENTE', 'COORDINADOR'] })).toBe(false)
  })

  it('muestra al administrador vinculado, en vez del creador o datos antiguos', () => {
    const result = getInstitutionAdmin({
      adminName: 'Dato anterior',
      adminEmail: 'anterior@example.invalid',
      users: [
        { isAdmin: false, user: { firstName: 'Docente', lastName: 'Ejemplo', email: 'docente@example.invalid' } },
        { isAdmin: true, user: { firstName: 'Ana', lastName: 'Ruiz', email: 'ana@example.invalid' } },
      ],
    })
    expect(result).toEqual({ adminName: 'Ana Ruiz', adminEmail: 'ana@example.invalid' })
  })

  it('tolera instituciones antiguas sin membresías de administrador', () => {
    expect(getInstitutionAdmin({})).toEqual({ adminName: '', adminEmail: '' })
    expect(getInstitutionAdmin({ adminName: 'Ana', adminEmail: 'ana@example.invalid' }))
      .toEqual({ adminName: 'Ana', adminEmail: 'ana@example.invalid' })
  })
})
