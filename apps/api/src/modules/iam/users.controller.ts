import { Controller, Get, Post, Delete, Param, Body, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Controller('iam')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene todos los usuarios de la institución del usuario actual
   */
  @Get('users')
  async getUsers(@Request() req: any) {
    // Obtener la institución del usuario actual
    const institutionUser = await this.prisma.institutionUser.findFirst({
      where: { userId: req.user.id },
    });

    if (!institutionUser) {
      return [];
    }

    // Obtener usuarios de la misma institución
    const users = await this.prisma.user.findMany({
      where: {
        institutionUsers: {
          some: { institutionId: institutionUser.institutionId }
        },
        isSuperAdmin: false,
      },
      include: {
        roles: { include: { role: true } },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }]
    });

    // Mapear usuarios con sus datos básicos
    return users.map((user) => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      roles: user.roles,
      extraPermissionsCount: 0,
      extraPermissions: []
    }));
  }

  /**
   * Obtiene un usuario específico con sus permisos
   */
  @Get('users/:id')
  async getUser(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: { include: { role: true } },
      }
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      roles: user.roles,
      extraPermissions: []
    };
  }

  /**
   * Crea un nuevo usuario de staff (coordinador, secretaria, etc.)
   */
  @Post('staff')
  async createStaff(
    @Request() req: any,
    @Body() body: {
      firstName: string;
      lastName: string;
      email: string;
      role: string;
      documentType?: string;
      documentNumber?: string;
      phone?: string;
    }
  ) {
    // Obtener institución del usuario actual
    const institutionUser = await this.prisma.institutionUser.findFirst({
      where: { userId: req.user.id },
    });

    if (!institutionUser) {
      throw new BadRequestException('Usuario no asociado a ninguna institución');
    }

    // Validar campos requeridos
    if (!body.firstName || !body.lastName || !body.email || !body.role) {
      throw new BadRequestException('Faltan campos requeridos');
    }

    // Verificar que el email no exista
    const existing = await this.prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });
    if (existing) {
      throw new BadRequestException('El correo ya está registrado');
    }

    // Obtener o crear el rol
    let role = await this.prisma.role.findUnique({
      where: { name: body.role },
    });
    if (!role) {
      role = await this.prisma.role.create({
        data: { name: body.role },
      });
    }

    // Generar username y contraseña (número de documento)
    const username = await this.generateUsername(body.firstName, body.lastName, body.documentNumber, body.role);
    const initialPassword = this.getInitialPassword(body.documentNumber);
    const passwordHash = await bcrypt.hash(initialPassword, 10);

    // Crear usuario
    const user = await this.prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        username,
        firstName: body.firstName,
        lastName: body.lastName,
        passwordHash,
        documentType: body.documentType as any,
        documentNumber: body.documentNumber,
        phone: body.phone,
        isActive: true,
        mustChangePassword: true,
        roles: {
          create: {
            roleId: role.id,
          },
        },
        institutionUsers: {
          create: {
            institutionId: institutionUser.institutionId,
            isAdmin: false,
          },
        },
      } as any,
      include: {
        roles: { include: { role: true } },
      },
    });

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      username,
      roles: (user as any).roles,
      initialPassword, // Solo se muestra una vez (número de documento)
    };
  }

  /**
   * Elimina un usuario de staff
   */
  @Delete('staff/:id')
  async deleteStaff(@Request() req: any, @Param('id') id: string) {
    // Verificar que el usuario pertenece a la misma institución
    const institutionUser = await this.prisma.institutionUser.findFirst({
      where: { userId: req.user.id },
    });

    if (!institutionUser) {
      throw new BadRequestException('Usuario no asociado a ninguna institución');
    }

    const targetUser = await this.prisma.institutionUser.findFirst({
      where: {
        userId: id,
        institutionId: institutionUser.institutionId,
      },
    });

    if (!targetUser) {
      throw new BadRequestException('Usuario no encontrado en esta institución');
    }

    // Eliminar usuario
    await this.prisma.user.delete({
      where: { id },
    });

    return { success: true };
  }

  // Helpers
  // Generar username: primeraLetraNombre + primerApellido + 4últimosDigitos + letraRol
  private async generateUsername(firstName: string, lastName: string, documentNumber?: string, roleName?: string): Promise<string> {
    const firstLetter = firstName.toLowerCase().charAt(0);
    const cleanLastName = lastName.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '');
    const last4Digits = (documentNumber || '0000').slice(-4);
    
    // Determinar letra del rol
    let roleLetter = 'u'; // default user
    if (roleName === 'COORDINADOR') roleLetter = 'c';
    else if (roleName === 'SECRETARIA') roleLetter = 's';
    else if (roleName === 'ORIENTADOR') roleLetter = 'o';
    else if (roleName === 'BIBLIOTECARIO') roleLetter = 'b';
    else if (roleName === 'AUXILIAR') roleLetter = 'x';
    else if (roleName === 'ADMIN_INSTITUTIONAL') roleLetter = 'a';
    
    const baseUsername = `${firstLetter}${cleanLastName}${last4Digits}${roleLetter}`;

    let username = baseUsername;
    let counter = 1;

    while (await this.prisma.user.findUnique({ where: { username } })) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    return username;
  }

  // La contraseña es el número de documento
  private getInitialPassword(documentNumber?: string): string {
    return documentNumber || 'temporal123';
  }
}
