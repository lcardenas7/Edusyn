import * as bcrypt from 'bcryptjs';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { UsersService } from '../iam/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.usersService.createUser({
      email: dto.email,
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
      roles: dto.roles,
    });

    const roles = user.roles.map((r) => r.role.name);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles,
      },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmailOrUsername(dto.email);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Verificar si el usuario está activo
    if (user.isActive === false) {
      throw new UnauthorizedException('Tu cuenta ha sido desactivada. Contacta al administrador de tu institución.');
    }

    // Obtener institución del usuario
    const userInstitution = await this.usersService.findUserInstitution(user.id);
    
    // Si se especifica institutionId, validar que el usuario pertenezca a esa institución
    if (dto.institutionId) {
      // Si el usuario no tiene institución asignada o no coincide con la solicitada
      if (!userInstitution || userInstitution.id !== dto.institutionId) {
        throw new UnauthorizedException('No tienes acceso a esta institución. Verifica que estés ingresando a tu institución correcta.');
      }
    }

    const roles = user.roles.map((r) => r.role.name);

    // Incluir institutionId en el token JWT
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      roles,
      institutionId: userInstitution?.id || null,
    });

    return {
      access_token: accessToken,
      mustChangePassword: (user as any).mustChangePassword || false,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    // Obtener institución del usuario a través de sus asignaciones o buscar la primera disponible
    const institution = await this.usersService.findUserInstitution(userId);

    // Log para debug - verificar valor de isSuperAdmin
    console.log(`[AUTH] getProfile for user ${user.email}: isSuperAdmin=${user.isSuperAdmin}`);

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
      institution,
      isSuperAdmin: user.isSuperAdmin === true,
      mustChangePassword: user.mustChangePassword === true,
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    // Verificar contraseña actual
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Contraseña actual incorrecta');
    }

    // Hashear nueva contraseña
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Actualizar contraseña y quitar flag de mustChangePassword
    await this.usersService.updatePassword(userId, newPasswordHash);

    return { message: 'Contraseña actualizada correctamente' };
  }
}
