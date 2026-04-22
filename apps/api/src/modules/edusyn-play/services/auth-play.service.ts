import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';

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
  private googleClient: OAuth2Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly workspace: PlayWorkspaceService,
    private readonly jwtService: JwtService,
  ) {
    this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }

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
  /**
   * Google Sign-In para Edusyn Play.
   * Verifica el id_token de Google, crea usuario si no existe, y devuelve JWT.
   */
  async googleLoginPlay(idToken: string) {
    if (!idToken) {
      throw new BadRequestException('Token de Google requerido');
    }
    if (!process.env.GOOGLE_CLIENT_ID) {
      throw new BadRequestException('Google Sign-In no está configurado en el servidor');
    }

    let payload: any;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Token de Google inválido o expirado');
    }

    if (!payload?.email) {
      throw new UnauthorizedException('No se pudo obtener el email de Google');
    }

    const emailLower = payload.email.toLowerCase();
    const firstName = payload.given_name || payload.name?.split(' ')[0] || 'Usuario';
    const lastName = payload.family_name || payload.name?.split(' ').slice(1).join(' ') || '';

    // Buscar o crear usuario
    let user = await this.prisma.user.findUnique({ where: { email: emailLower } });

    if (!user) {
      // Crear usuario nuevo (sin contraseña, login solo por Google)
      const randomPwd = crypto.randomBytes(32).toString('hex');
      const passwordHash = await bcrypt.hash(randomPwd, 10);

      user = await this.prisma.user.create({
        data: {
          email: emailLower,
          username: emailLower,
          passwordHash,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          accountMode: 'PERSONAL',
          googleId: payload.sub,
          photo: payload.picture || null,
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
    } else {
      // Actualizar googleId y foto si no lo tenía
      if (!user.googleId || !user.photo) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: user.googleId || payload.sub,
            photo: user.photo || payload.picture || undefined,
          },
        });
      }
    }

    // Auto-provisionar workspace
    const ws = await this.workspace.ensureTeacherWorkspace(user.id);

    // Asegurar InstitutionUser
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

    // Generar JWT
    return this.buildPlayToken(user);
  }

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

    return this.buildPlayToken(user);
  }

  /**
   * Genera JWT y respuesta estándar para un usuario Play ya autenticado.
   */
  private async buildPlayToken(user: { id: string; email: string; firstName: string; lastName: string; isSuperAdmin: boolean; accountMode: any; photo?: string | null }) {
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
        photo: user.photo || null,
        roles,
        institution: iu.institution,
        accountMode: user.accountMode,
        isSuperAdmin: false,
      },
    };
  }
}
