import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from '../decorators/roles.decorator';
import { InstitutionsController } from '../../academic/institutions.controller';
import { RolesGuard } from './roles.guard';

describe('RolesGuard · autoridad institucional del Rector', () => {
  const evaluate = (requiredRoles: string[], assignedRoles: string[]) => {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => key === ROLES_KEY ? requiredRoles : undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = {
      getHandler: () => function handler() {},
      getClass: () => class Controller {},
      switchToHttp: () => ({
        getRequest: () => ({ user: { roles: assignedRoles, isSuperAdmin: false } }),
      }),
    } as unknown as ExecutionContext;

    return guard.canActivate(context);
  };

  it('admite a un Rector puro donde se exige ADMIN_INSTITUTIONAL', () => {
    expect(evaluate(['ADMIN_INSTITUTIONAL'], ['RECTOR'])).toBe(true);
  });

  it('no admite a un Rector puro donde se exige SUPERADMIN', () => {
    expect(() => evaluate(['SUPERADMIN'], ['RECTOR'])).toThrow(ForbiddenException);
  });

  it('conserva el comportamiento de los demás roles', () => {
    expect(evaluate(['DOCENTE'], ['DOCENTE'])).toBe(true);
    expect(() => evaluate(['ADMIN_INSTITUTIONAL'], ['DOCENTE'])).toThrow(ForbiddenException);
  });

  it('mantiene el catálogo global de instituciones reservado a SuperAdmin', () => {
    const requiredRoles = Reflect.getMetadata(
      ROLES_KEY,
      InstitutionsController.prototype.list,
    );
    expect(requiredRoles).toEqual(['SUPERADMIN']);
    expect(() => evaluate(requiredRoles, ['RECTOR'])).toThrow(ForbiddenException);
  });
});
