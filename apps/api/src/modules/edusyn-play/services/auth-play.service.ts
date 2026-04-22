import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../../../prisma/prisma.service';
import { PlayWorkspaceService } from './play-workspace.service';

export interface RegisterPlayDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

/**
 * Registro de docente personal en Edusyn Play.
 *
 * Flujo:
 * 1. Valida que el email no exista
 * 2. Crea User con accountMode=PERSONAL
 * 3. Asigna rol DOCENTE (global)
 * 4. Auto-provisiona el workspace: institución compartida + TeacherAssignment + Classroom
 * 5. Crea InstitutionUser + InstitutionUserRole DOCENTE
 * 6. Emite JWT con institutionId = edusyn-personal
 */
@Injectable()
export class AuthPlayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspace: PlayWorkspaceService,
    private readonly jwtService: JwtService,
  ) {}

  async registerPlay(dto: RegisterPlayDto) {
    // Validaciones básicas
    if (!dto.email || !dto.password || !dto.firstName) {
      throw new BadRequestException('Faltan datos obligatorios');
    }
    if (dto.password.length < 6) {
      throw new BadRequestException('La contraseña debe tener al menos 6 caracteres');
    }

    const emailLower = dto.email.trim().toLowerCase();

    // Verificar email único
    const existing = await this.prisma.user.findUnique({ where: { email: emailLower } });
    if (existing) {
      throw new ConflictException('Ya existe una cuenta con ese email');
    }

    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Crear usuario
    const user = await this.prisma.user.create({
      data: {
        email: emailLower,
        username: emailLower, // username = email para docentes personales
        passwordHash,
        firstName: dto.firstName.trim(),
        lastName: (dto.lastName || '').trim(),
        accountMode: 'PERSONAL',
        roles: {
          create: [
            {
              role: {
                connectOrCreate: {
                  where: { name: 'DOCENTE' },
                  create: { name: 'DOCENTE' },
                },
              },
            },
          ],
        },
      },
    });

    // Auto-provisionar workspace (idempotente)
    const ws = await this.workspace.ensureTeacherWorkspace(user.id);

    // Crear InstitutionUser + rol DOCENTE en edusyn-personal
    const existingIu = await this.prisma.institutionUser.findUnique({
      where: { userId_institutionId: { userId: user.id, institutionId: ws.institutionId } },
    });
    if (!existingIu) {
      const docenteRole = await this.prisma.role.findUnique({ where: { name: 'DOCENTE' } });
      await this.prisma.institutionUser.create({
        data: {
          userId: user.id,
          institutionId: ws.institutionId,
          isActive: true,
          institutionUserRoles: docenteRole
            ? { create: [{ roleId: docenteRole.id }] }
            : undefined,
        },
      });
    }

    // Login automático: generar token
    return this.loginPlay({ email: emailLower, password: dto.password });
  }

  /**
   * Login simplificado para docentes personales.
   * Permite iniciar sesión sin especificar institución (se asume edusyn-personal).
   */
  async loginPlay(dto: { email: string; password: string }) {
    const emailLower = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: emailLower } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Buscar InstitutionUser en edusyn-personal
    const institution = await this.workspace.getOrCreateInstitution();
    const iu = await this.prisma.institutionUser.findUnique({
      where: { userId_institutionId: { userId: user.id, institutionId: institution.id } },
      include: {
        institutionUserRoles: { include: { role: true } },
        institution: { select: { id: true, name: true, slug: true, logo: true, status: true } },
      },
    });

    if (!iu) {
      throw new UnauthorizedException('Esta cuenta no tiene acceso a Edusyn Play');
    }

    const roles = iu.institutionUserRoles.map(r => r.role.name);

    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        roles,
        institutionId: iu.institutionId,
        isSuperAdmin: user.isSuperAdmin === true,
        institutionUserId: iu.id,
        accountMode: user.accountMode,
        jti: crypto.randomUUID(),
      },
      { expiresIn: 8 * 3600 },
    );

    return {
      access_token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles,
        institution: iu.institution,
        accountMode: user.accountMode,
        isSuperAdmin: false,
      },
    };
  }
}
