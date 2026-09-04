import { expandEffectiveRoles, hasInstitutionalAdminAuthority } from './role-hierarchy';

describe('jerarquía efectiva de roles institucionales', () => {
  it('hace que un Rector satisfaga la autoridad de administrador institucional', () => {
    expect(expandEffectiveRoles(['RECTOR'])).toEqual(['RECTOR', 'ADMIN_INSTITUTIONAL']);
    expect(hasInstitutionalAdminAuthority(['RECTOR'])).toBe(true);
  });

  it('no convierte al Rector en SuperAdmin ni altera otros roles', () => {
    expect(expandEffectiveRoles(['RECTOR'])).not.toContain('SUPERADMIN');
    expect(expandEffectiveRoles(['DOCENTE'])).toEqual(['DOCENTE']);
  });

  it('no duplica roles ya asignados', () => {
    expect(expandEffectiveRoles(['RECTOR', 'ADMIN_INSTITUTIONAL', 'RECTOR']))
      .toEqual(['RECTOR', 'ADMIN_INSTITUTIONAL']);
  });
});
