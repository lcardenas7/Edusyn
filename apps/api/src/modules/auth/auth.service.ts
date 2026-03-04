import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../iam/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
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

    const isSuperAdmin = user.isSuperAdmin === true;

    // Obtener TODAS las instituciones del usuario
    const allInstitutionUsers = await this.prisma.institutionUser.findMany({
      where: { userId: user.id, isActive: true },
      include: {
        institution: { select: { id: true, name: true, slug: true, logo: true, status: true } },
        institutionUserRoles: { include: { role: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });

    // Si se especifica institutionId, validar pertenencia
    if (dto.institutionId) {
      const targetIu = allInstitutionUsers.find(iu => iu.institutionId === dto.institutionId);
      if (!targetIu) {
        throw new UnauthorizedException('No tienes acceso a esta institución. Verifica que estés ingresando a tu institución correcta.');
      }
      return this.signTokenForInstitution(user, targetIu, isSuperAdmin);
    }

    // Sin institutionId especificado
    if (allInstitutionUsers.length === 1) {
      // Solo una institución → login directo
      return this.signTokenForInstitution(user, allInstitutionUsers[0], isSuperAdmin);
    }

    if (allInstitutionUsers.length > 1) {
      // Múltiples instituciones → retornar selector
      return {
        requiresInstitutionSelection: true,
        institutions: allInstitutionUsers.map(iu => ({
          id: iu.institutionId,
          name: iu.institution.name,
          slug: iu.institution.slug,
          logo: iu.institution.logo,
          roles: iu.institutionUserRoles.map(iur => iur.role.name),
        })),
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isSuperAdmin,
        },
      };
    }

    // Sin instituciones — solo SuperAdmin puede proceder sin tenant
    if (isSuperAdmin) {
      return this.signTokenWithoutInstitution(user);
    }

    throw new UnauthorizedException('Tu cuenta no está vinculada a ninguna institución. Contacta al administrador.');
  }

  async switchInstitution(userId: string, institutionId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true, isSuperAdmin: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario no válido');
    }

    const targetIu = await this.prisma.institutionUser.findUnique({
      where: { userId_institutionId: { userId, institutionId } },
      include: {
        institution: { select: { id: true, name: true, slug: true, logo: true, status: true } },
        institutionUserRoles: { include: { role: true } },
      },
    });

    if (!targetIu || !targetIu.isActive) {
      throw new UnauthorizedException('No tienes acceso a esta institución.');
    }

    return this.signTokenForInstitution(user, targetIu, user.isSuperAdmin);
  }

  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    // Obtener institución del usuario a través de sus asignaciones o buscar la primera disponible
    const institution = await this.usersService.findUserInstitution(userId);

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
      institution,
      isSuperAdmin: user.isSuperAdmin === true,
      mustChangePassword: user.mustChangePassword === true,
      signatureImageUrl: user.signatureImageUrl || null,
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

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: Token signing helpers
  // ═══════════════════════════════════════════════════════════════════════════

  // TODO [DEUDA TÉCNICA]: Implementar blacklist de jti para revocación de tokens.
  // Estado actual: switchInstitution genera nuevo jti pero el token anterior
  // sigue vivo hasta su TTL. Mitigación actual: TTL escalonado (2h-24h) +
  // TenantGuard bloquea cross-tenant con token viejo.
  // Para implementar: tabla TokenRevocation(jti, expiresAt) o Redis set,
  // validar en JwtStrategy.validate() que jti no esté revocado.

  private async signTokenForInstitution(
    user: { id: string; email: string; firstName: string; lastName: string },
    iu: {
      id: string;
      institutionId: string;
      institution: { id: string; name: string; slug: string; logo: string | null; status: string };
      institutionUserRoles: Array<{ role: { name: string } }>;
    },
    isSuperAdmin: boolean,
  ) {
    // Roles from InstitutionUserRole (per-tenant)
    const tenantRoles = iu.institutionUserRoles.map(iur => iur.role.name);

    // Fallback: if InstitutionUserRole is empty (pre-migration users), read from global UserRole
    let roles = tenantRoles;
    if (roles.length === 0) {
      const globalRoles = await this.prisma.userRole.findMany({
        where: { userId: user.id },
        include: { role: true },
      });
      roles = globalRoles.map(r => r.role.name);
    }

    // TTL escalonado por nivel de privilegio
    const ttl = this.getTtlForRoles(roles, isSuperAdmin);

    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        roles,
        institutionId: iu.institutionId,
        isSuperAdmin,
        institutionUserId: iu.id,
        jti: crypto.randomUUID(),
      },
      { expiresIn: ttl },
    );

    return {
      access_token: accessToken,
      mustChangePassword: false,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles,
        institution: iu.institution,
        isSuperAdmin,
      },
    };
  }

  private async signTokenWithoutInstitution(
    user: { id: string; email: string; firstName: string; lastName: string; isSuperAdmin: boolean },
  ) {
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        roles: ['SUPERADMIN'],
        institutionId: null,
        isSuperAdmin: true,
        institutionUserId: null,
        jti: crypto.randomUUID(),
      },
      { expiresIn: 7200 },
    );

    return {
      access_token: accessToken,
      mustChangePassword: false,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: ['SUPERADMIN'],
        institution: undefined,
        isSuperAdmin: true,
      },
    };
  }

  private getTtlForRoles(roles: string[], isSuperAdmin: boolean): number {
    if (isSuperAdmin) return 2 * 3600;       // 2h
    if (roles.includes('ADMIN_INSTITUTIONAL')) return 4 * 3600;  // 4h
    if (roles.includes('COORDINADOR') || roles.includes('RECTOR')) return 8 * 3600; // 8h
    if (roles.includes('DOCENTE')) return 8 * 3600;  // 8h
    // ESTUDIANTE, ACUDIENTE, etc.
    return 24 * 3600; // 24h
  }
}
