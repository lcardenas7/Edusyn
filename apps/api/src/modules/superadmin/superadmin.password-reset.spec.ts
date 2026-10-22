import { ForbiddenException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { validate } from 'class-validator';
import { SuperadminService } from './superadmin.service';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';

describe('SuperadminService — restablecimiento de acceso institucional', () => {
  function setup(options: { superAdmin?: boolean; missingUser?: boolean; membership?: any } = {}) {
    const prisma: any = {
      user: {
        findUnique: jest.fn(({ where }: any) => Promise.resolve(where.id === 'superadmin'
          ? { isSuperAdmin: options.superAdmin ?? true }
          : options.missingUser ? null : {
            id: 'admin', username: 'rectora', email: 'rectora@example.invalid',
            firstName: 'Ana', lastName: 'Ruiz', documentNumber: '12345678',
          })),
        update: jest.fn().mockResolvedValue({ id: 'admin' }),
      },
      institutionUser: {
        findUnique: jest.fn().mockResolvedValue(options.membership === undefined
          ? { isAdmin: true, institutionUserRoles: [] } : options.membership),
      },
    };
    return { service: new SuperadminService(prisma), prisma };
  }

  it('impide que un usuario institucional restablezca contraseñas', async () => {
    const { service, prisma } = setup({ superAdmin: false });
    await expect(service.resetUserPassword('superadmin', 'admin', { institutionId: 'school' }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.institutionUser.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rechaza un usuario ajeno a la institución seleccionada', async () => {
    const { service, prisma } = setup({ membership: null });
    await expect(service.resetUserPassword('superadmin', 'admin', { institutionId: 'school' }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.institutionUser.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_institutionId: { userId: 'admin', institutionId: 'school' } },
    }));
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('impide restablecer la clave de docentes desde este flujo', async () => {
    const { service, prisma } = setup({ membership: {
      isAdmin: false, institutionUserRoles: [{ role: { name: 'DOCENTE' } }],
    } });
    await expect(service.resetUserPassword('superadmin', 'admin', { institutionId: 'school' }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rechaza un usuario inexistente', async () => {
    const { service, prisma } = setup({ missingUser: true });
    await expect(service.resetUserPassword('superadmin', 'missing', { institutionId: 'school' }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('genera una contraseña aleatoria distinta del documento, guarda el hash y fuerza cambio al admin', async () => {
    const { service, prisma } = setup();
    const result = await service.resetUserPassword('superadmin', 'admin', { institutionId: 'school' });
    expect(result.username).toBe('rectora');
    expect(result.newPassword).not.toBe('12345678');
    expect(result.newPassword.length).toBeGreaterThanOrEqual(20);
    expect(result.mustChangePassword).toBe(true);
    const { data } = prisma.user.update.mock.calls[0][0];
    expect(data.passwordHash).not.toBe(result.newPassword);
    expect(await bcrypt.compare(result.newPassword, data.passwordHash)).toBe(true);
    expect(data.mustChangePassword).toBe(true);
  });

  it('también fuerza cambio al rector separado del administrador', async () => {
    const { service } = setup({ membership: {
      isAdmin: false, institutionUserRoles: [{ role: { name: 'RECTOR' } }],
    } });
    const result = await service.resetUserPassword('superadmin', 'admin', { institutionId: 'school' });
    expect(result.mustChangePassword).toBe(true);
    expect(result.newPassword).not.toBe('12345678');
  });

  it('valida el cuerpo HTTP y rechaza tipos de datos incorrectos', async () => {
    const dto = Object.assign(new ResetUserPasswordDto(), { institutionId: '' });
    const errors = await validate(dto);
    expect(errors.map(error => error.property)).toEqual(['institutionId']);
  });
})
