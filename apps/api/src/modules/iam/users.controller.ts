import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Request, BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

// Lista blanca de roles válidos del sistema
const VALID_ROLES = [
  'ADMIN_INSTITUTIONAL',
  'COORDINADOR',
  'DOCENTE',
  'SECRETARIA',
  'ORIENTADOR',
  'BIBLIOTECARIO',
  'AUXILIAR',
  'ESTUDIANTE',
  'ACUDIENTE',
];

@Controller('iam')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene todos los usuarios de la institución del usuario actual
   */
  @Get('users')
  @Roles('ADMIN_INSTITUTIONAL', 'COORDINADOR', 'SECRETARIA')
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
   * Valida que el usuario pertenezca a la misma institución
   */
  @Get('users/:id')
  @Roles('ADMIN_INSTITUTIONAL', 'COORDINADOR', 'SECRETARIA')
  async getUser(@Request() req: any, @Param('id') id: string) {
    // Validar cross-institution
    const reqInstitution = await this.prisma.institutionUser.findFirst({
      where: { userId: req.user.id },
    });
    if (!reqInstitution) {
      throw new BadRequestException('Usuario no asociado a ninguna institución');
    }

    const targetInstitution = await this.prisma.institutionUser.findFirst({
      where: { userId: id, institutionId: reqInstitution.institutionId },
    });
    if (!targetInstitution) {
      throw new ForbiddenException('No tiene acceso a este usuario');
    }

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
  @Roles('ADMIN_INSTITUTIONAL', 'COORDINADOR')
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

    // Validar que el rol esté en la lista blanca
    if (!VALID_ROLES.includes(body.role)) {
      throw new BadRequestException(
        `Rol inválido: ${body.role}. Roles permitidos: ${VALID_ROLES.join(', ')}`
      );
    }

    // Proteger roles sensibles: solo ADMIN_INSTITUTIONAL puede crear otros ADMIN_INSTITUTIONAL
    if (body.role === 'ADMIN_INSTITUTIONAL') {
      const reqRoles = await this.prisma.userRole.findMany({
        where: { userId: req.user.id },
        include: { role: true },
      });
      const isAdmin = reqRoles.some(r => r.role.name === 'ADMIN_INSTITUTIONAL');
      if (!isAdmin) {
        throw new ForbiddenException('Solo un administrador institucional puede crear otros administradores');
      }
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
   * Actualiza un usuario de staff (datos personales y/o rol)
   */
  @Put('staff/:id')
  @Roles('ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async updateStaff(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: {
      firstName?: string;
      lastName?: string;
      email?: string;
      role?: string;
      documentType?: string;
      documentNumber?: string;
      phone?: string;
    }
  ) {
    // Verificar que pertenece a la misma institución
    const institutionUser = await this.prisma.institutionUser.findFirst({
      where: { userId: req.user.id },
    });
    if (!institutionUser) {
      throw new BadRequestException('Usuario no asociado a ninguna institución');
    }

    const targetUser = await this.prisma.institutionUser.findFirst({
      where: { userId: id, institutionId: institutionUser.institutionId },
    });
    if (!targetUser) {
      throw new BadRequestException('Usuario no encontrado en esta institución');
    }

    // Validar rol si se envía
    if (body.role) {
      if (!VALID_ROLES.includes(body.role)) {
        throw new BadRequestException(
          `Rol inválido: ${body.role}. Roles permitidos: ${VALID_ROLES.join(', ')}`
        );
      }

      // Proteger escalamiento a ADMIN_INSTITUTIONAL
      if (body.role === 'ADMIN_INSTITUTIONAL') {
        const reqRoles = await this.prisma.userRole.findMany({
          where: { userId: req.user.id },
          include: { role: true },
        });
        const isAdmin = reqRoles.some(r => r.role.name === 'ADMIN_INSTITUTIONAL');
        if (!isAdmin) {
          throw new ForbiddenException('Solo un administrador institucional puede asignar el rol de administrador');
        }
      }
    }

    // Validar email único si cambia
    if (body.email) {
      const existing = await this.prisma.user.findFirst({
        where: { email: body.email.toLowerCase(), NOT: { id } },
      });
      if (existing) {
        throw new BadRequestException('El correo ya está registrado por otro usuario');
      }
    }

    // Actualizar datos del usuario
    const updateData: any = {};
    if (body.firstName) updateData.firstName = body.firstName;
    if (body.lastName) updateData.lastName = body.lastName;
    if (body.email) updateData.email = body.email.toLowerCase();
    if (body.documentType) updateData.documentType = body.documentType;
    if (body.documentNumber !== undefined) updateData.documentNumber = body.documentNumber;
    if (body.phone !== undefined) updateData.phone = body.phone;

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateData,
      include: { roles: { include: { role: true } } },
    });

    // Cambiar rol si se especifica y es diferente
    if (body.role) {
      const currentRoles = updatedUser.roles.map(r => r.role.name);
      if (!currentRoles.includes(body.role)) {
        // Eliminar roles actuales de staff (no tocar DOCENTE ni ESTUDIANTE si existen)
        const staffRoles = ['COORDINADOR', 'SECRETARIA', 'ORIENTADOR', 'BIBLIOTECARIO', 'AUXILIAR', 'ADMIN_INSTITUTIONAL'];
        await this.prisma.userRole.deleteMany({
          where: {
            userId: id,
            role: { name: { in: staffRoles } },
          },
        });

        // Asignar nuevo rol
        const newRole = await this.prisma.role.findUnique({ where: { name: body.role } });
        if (newRole) {
          await this.prisma.userRole.create({
            data: { userId: id, roleId: newRole.id },
          });
        }
      }
    }

    // Devolver usuario actualizado
    const result = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });

    return {
      id: result!.id,
      firstName: result!.firstName,
      lastName: result!.lastName,
      email: result!.email,
      roles: result!.roles,
    };
  }

  /**
   * Elimina un usuario de staff
   */
  @Delete('staff/:id')
  @Roles('ADMIN_INSTITUTIONAL')
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

  /**
   * Vincular un usuario existente a la institución actual
   * Útil para reparar docentes creados sin vínculo
   */
  @Post('users/:id/link-institution')
  @Roles('ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async linkUserToInstitution(@Request() req: any, @Param('id') userId: string) {
    // Obtener institución del usuario actual
    const institutionUser = await this.prisma.institutionUser.findFirst({
      where: { userId: req.user.id },
    });

    if (!institutionUser) {
      throw new BadRequestException('Usuario no asociado a ninguna institución');
    }

    // Verificar que el usuario existe
    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      throw new BadRequestException('Usuario no encontrado');
    }

    // Verificar si ya existe el vínculo
    const existingLink = await this.prisma.institutionUser.findFirst({
      where: { userId, institutionId: institutionUser.institutionId }
    });

    if (existingLink) {
      return { message: 'El usuario ya está vinculado a esta institución', alreadyLinked: true };
    }

    // Crear el vínculo
    await this.prisma.institutionUser.create({
      data: {
        userId,
        institutionId: institutionUser.institutionId,
        isAdmin: false,
      }
    });

    return { 
      message: 'Usuario vinculado correctamente a la institución',
      userId,
      institutionId: institutionUser.institutionId
    };
  }

  /**
   * Obtener usuarios sin vínculo a institución (para diagnóstico)
   */
  @Get('users-without-institution')
  @Roles('ADMIN_INSTITUTIONAL')
  async getUsersWithoutInstitution(@Request() req: any) {
    // Solo para admins
    const institutionUser = await this.prisma.institutionUser.findFirst({
      where: { userId: req.user.id },
    });

    if (!institutionUser) {
      throw new BadRequestException('Usuario no asociado a ninguna institución');
    }

    // Buscar usuarios con rol DOCENTE que no tienen InstitutionUser
    const usersWithoutInstitution = await this.prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: { name: 'DOCENTE' }
          }
        },
        institutionUsers: {
          none: {}
        }
      },
      include: {
        roles: { include: { role: true } },
        teacherAssignments: {
          take: 1,
          include: {
            group: {
              include: {
                campus: {
                  include: { institution: true }
                }
              }
            }
          }
        }
      }
    });

    return usersWithoutInstitution.map(u => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      documentNumber: u.documentNumber,
      hasAssignments: u.teacherAssignments.length > 0,
      assignmentInstitution: u.teacherAssignments[0]?.group?.campus?.institution?.name || null
    }));
  }
}
