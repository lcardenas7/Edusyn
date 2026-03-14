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
  'AUXILIAR_CONTABLE',
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
      username: user.username,
      documentType: user.documentType,
      documentNumber: user.documentNumber,
      phone: user.phone,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
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
        const staffRoles = ['COORDINADOR', 'SECRETARIA', 'ORIENTADOR', 'BIBLIOTECARIO', 'AUXILIAR', 'AUXILIAR_CONTABLE', 'ADMIN_INSTITUTIONAL'];

        await this.prisma.$transaction(async (tx) => {
          // Eliminar roles actuales de staff (no tocar DOCENTE ni ESTUDIANTE si existen)
          await tx.userRole.deleteMany({
            where: {
              userId: id,
              role: { name: { in: staffRoles } },
            },
          });

          // Asignar nuevo rol
          const newRole = await tx.role.findUnique({ where: { name: body.role } });
          if (newRole) {
            await tx.userRole.create({
              data: { userId: id, roleId: newRole.id },
            });

            // Dual-write: actualizar InstitutionUserRole por tenant
            const oldStaffRoleRecords = await tx.role.findMany({ where: { name: { in: staffRoles } } });
            const oldStaffRoleIds = oldStaffRoleRecords.map(r => r.id);
            const userInstitutionUsers = await tx.institutionUser.findMany({ where: { userId: id } });
            for (const iu of userInstitutionUsers) {
              await tx.institutionUserRole.deleteMany({
                where: { institutionUserId: iu.id, roleId: { in: oldStaffRoleIds } },
              });
              await tx.institutionUserRole.upsert({
                where: { institutionUserId_roleId: { institutionUserId: iu.id, roleId: newRole.id } },
                create: { institutionUserId: iu.id, roleId: newRole.id },
                update: {},
              });
            }
          }
        });
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
  // Generar username: inicialNombre + apellido (ej: lcardenas)
  private async generateUsername(firstName: string, lastName: string, _documentNumber?: string, _roleName?: string): Promise<string> {
    const firstLetter = firstName.toLowerCase().charAt(0);
    const cleanLastName = lastName.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '')
      .replace(/[^a-z]/g, '');
    
    const baseUsername = `${firstLetter}${cleanLastName}`;

    let username = baseUsername;
    let counter = 1;

    while (await this.prisma.user.findUnique({ where: { username } })) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    return username;
  }

  // La contraseña es el número de documento, o temporal aleatoria si no tiene
  private getInitialPassword(documentNumber?: string): string {
    if (documentNumber) return documentNumber;
    return `Edu${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Resetear contraseñas masivamente (todos los docentes de la institución)
   * IMPORTANTE: Esta ruta debe ir ANTES de users/:id/reset-password
   */
  @Post('users/bulk-reset-password')
  @Roles('ADMIN_INSTITUTIONAL')
  async bulkResetPasswords(@Request() req: any, @Body() body: { userIds?: string[] }) {
    const institutionUser = await this.prisma.institutionUser.findFirst({
      where: { userId: req.user.id },
    });
    if (!institutionUser) {
      throw new BadRequestException('Usuario no asociado a ninguna institución');
    }

    // Si no se envían IDs, resetear todos los docentes de la institución
    let userIds = body.userIds;
    if (!userIds || userIds.length === 0) {
      const allTeachers = await this.prisma.institutionUser.findMany({
        where: {
          institutionId: institutionUser.institutionId,
          user: { roles: { some: { role: { name: 'DOCENTE' } } } },
        },
        select: { userId: true },
      });
      userIds = allTeachers.map(t => t.userId);
    }

    const results: { userId: string; name: string; newPassword: string }[] = [];
    const errors: string[] = [];

    for (const uid of userIds) {
      try {
        const res = await this.resetUserPassword(req, uid);
        results.push({ userId: uid, name: `${res.firstName} ${res.lastName}`, newPassword: res.newPassword });
      } catch (e: any) {
        errors.push(`${uid}: ${e.message}`);
      }
    }

    return { total: results.length, results, errors };
  }

  /**
   * Actualizar username de un usuario
   */
  @Post('users/:id/update-username')
  @Roles('ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async updateUsername(
    @Request() req: any,
    @Param('id') userId: string,
    @Body() body: { username: string },
  ) {
    const institutionUser = await this.prisma.institutionUser.findFirst({
      where: { userId: req.user.id },
    });
    if (!institutionUser) {
      throw new BadRequestException('Usuario no asociado a ninguna institución');
    }

    const targetInst = await this.prisma.institutionUser.findFirst({
      where: { userId, institutionId: institutionUser.institutionId },
    });
    if (!targetInst) {
      throw new ForbiddenException('No tiene acceso a este usuario');
    }

    const newUsername = (body.username || '').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

    if (!newUsername || newUsername.length < 3) {
      throw new BadRequestException('El nombre de usuario debe tener al menos 3 caracteres');
    }

    const existing = await this.prisma.user.findUnique({ where: { username: newUsername } });
    if (existing && existing.id !== userId) {
      throw new BadRequestException(`El nombre de usuario "${newUsername}" ya está en uso`);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { username: newUsername },
    });

    return { userId, username: newUsername, message: 'Nombre de usuario actualizado correctamente' };
  }

  /**
   * Resetear contraseña de un usuario (docente, coordinador, etc.)
   * Si tiene número de documento, la contraseña se pone como el documento.
   * Si no tiene, se genera una contraseña temporal aleatoria.
   */
  @Post('users/:id/reset-password')
  @Roles('ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async resetUserPassword(@Request() req: any, @Param('id') userId: string, @Body() body?: { newPassword?: string; mustChangePassword?: boolean }) {
    const institutionUser = await this.prisma.institutionUser.findFirst({
      where: { userId: req.user.id },
    });
    if (!institutionUser) {
      throw new BadRequestException('Usuario no asociado a ninguna institución');
    }

    const targetInst = await this.prisma.institutionUser.findFirst({
      where: { userId, institutionId: institutionUser.institutionId },
    });
    if (!targetInst) {
      throw new ForbiddenException('No tiene acceso a este usuario');
    }

    const targetUser = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      throw new BadRequestException('Usuario no encontrado');
    }

    // Si el admin envía una contraseña personalizada, usarla
    // Si no, usar número de documento o temporal aleatoria
    let newPassword: string;
    if (body?.newPassword && body.newPassword.length >= 6) {
      newPassword = body.newPassword;
    } else if (targetUser.documentNumber) {
      newPassword = targetUser.documentNumber;
    } else {
      newPassword = `Edu${Math.random().toString(36).substring(2, 8)}`;
    }

    const shouldMustChange = body?.mustChangePassword !== undefined ? body.mustChangePassword : true;

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: shouldMustChange },
    });

    return {
      userId,
      username: targetUser.username,
      email: targetUser.email,
      firstName: targetUser.firstName,
      lastName: targetUser.lastName,
      newPassword,
      mustChangePassword: shouldMustChange,
      message: `Contraseña reseteada correctamente. Nueva contraseña: ${newPassword}`,
    };
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

    // Crear el vínculo + dual-write en transacción
    const newIu = await this.prisma.$transaction(async (tx) => {
      const createdIu = await tx.institutionUser.create({
        data: {
          userId,
          institutionId: institutionUser.institutionId,
          isAdmin: false,
        }
      });

      // Dual-write: copiar roles globales del usuario a InstitutionUserRole
      const userRoles = await tx.userRole.findMany({
        where: { userId },
      });
      for (const ur of userRoles) {
        await tx.institutionUserRole.upsert({
          where: { institutionUserId_roleId: { institutionUserId: createdIu.id, roleId: ur.roleId } },
          create: { institutionUserId: createdIu.id, roleId: ur.roleId },
          update: {},
        });
      }
      return createdIu;
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

  /**
   * Toggle: permitir/bloquear cambio de contraseña para estudiantes
   */
  @Put('institution/allow-student-password-change')
  @Roles('ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async toggleStudentPasswordChange(
    @Request() req: any,
    @Body() body: { allow: boolean },
  ) {
    const institutionUser = await this.prisma.institutionUser.findFirst({
      where: { userId: req.user.id },
    });
    if (!institutionUser) {
      throw new BadRequestException('Usuario no asociado a ninguna institución');
    }

    await this.prisma.institution.update({
      where: { id: institutionUser.institutionId },
      data: { allowStudentPasswordChange: body.allow },
    });

    return {
      allowStudentPasswordChange: body.allow,
      message: body.allow
        ? 'Los estudiantes ahora pueden cambiar su contraseña'
        : 'Se ha bloqueado el cambio de contraseña para estudiantes',
    };
  }

  /**
   * Obtener configuración de contraseñas de la institución
   */
  @Get('institution/password-settings')
  @Roles('ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getPasswordSettings(@Request() req: any) {
    const institutionUser = await this.prisma.institutionUser.findFirst({
      where: { userId: req.user.id },
      include: {
        institution: {
          select: { allowStudentPasswordChange: true },
        },
      },
    });
    if (!institutionUser) {
      throw new BadRequestException('Usuario no asociado a ninguna institución');
    }

    return {
      allowStudentPasswordChange: institutionUser.institution.allowStudentPasswordChange,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERMISOS DELEGADOS — Gestión de credenciales
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Verifica si el usuario actual tiene permiso para gestionar credenciales.
   * Retorna true si es Admin, Coordinador, o tiene canManageCredentials.
   */
  @Get('delegated-permissions/credentials/check')
  async checkCredentialsPermission(@Request() req: any) {
    const userId = req.user.sub || req.user.id;
    const institutionId = req.user.institutionId;

    // Verificar roles tradicionales
    const roles: string[] = req.user.roles || [];
    const roleNames = roles.map((r: any) => 
      typeof r === 'string' ? r : r?.role?.name || r?.name || ''
    );

    const hasAdminRole = roleNames.some(name => 
      ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR'].includes(name)
    );

    if (hasAdminRole) {
      return { canManageCredentials: true, source: 'role' };
    }

    // Verificar permiso delegado
    if (!institutionId) {
      return { canManageCredentials: false, source: 'no_institution' };
    }

    const institutionUser = await this.prisma.institutionUser.findUnique({
      where: {
        userId_institutionId: { userId, institutionId },
      },
      select: { canManageCredentials: true, isActive: true },
    });

    const hasPermission = institutionUser?.isActive === true && institutionUser?.canManageCredentials === true;
    return { canManageCredentials: hasPermission, source: hasPermission ? 'delegated' : 'none' };
  }

  /**
   * Asigna o revoca el permiso de gestión de credenciales a un usuario.
   * Solo Admin o Coordinador pueden asignar este permiso.
   */
  @Post('delegated-permissions/credentials')
  @Roles('ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async toggleCredentialsPermission(
    @Request() req: any,
    @Body() body: { userId: string; allow: boolean },
  ) {
    const adminUserId = req.user.sub || req.user.id;
    const institutionId = req.user.institutionId;

    if (!institutionId) {
      throw new BadRequestException('No se pudo determinar la institución');
    }

    // Verificar que el usuario destino pertenezca a la misma institución
    const targetInstitutionUser = await this.prisma.institutionUser.findUnique({
      where: {
        userId_institutionId: {
          userId: body.userId,
          institutionId,
        },
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });

    if (!targetInstitutionUser) {
      throw new BadRequestException('El usuario no pertenece a esta institución');
    }

    // Actualizar permiso
    await this.prisma.institutionUser.update({
      where: { id: targetInstitutionUser.id },
      data: {
        canManageCredentials: body.allow,
        credentialsPermissionById: body.allow ? adminUserId : null,
        credentialsPermissionAt: body.allow ? new Date() : null,
      },
    });

    const userName = `${targetInstitutionUser.user.firstName} ${targetInstitutionUser.user.lastName}`;
    return {
      success: true,
      userId: body.userId,
      canManageCredentials: body.allow,
      message: body.allow
        ? `${userName} ahora puede gestionar credenciales de estudiantes`
        : `Se ha revocado el permiso de gestión de credenciales a ${userName}`,
    };
  }

  /**
   * Lista usuarios con permiso de gestión de credenciales en la institución.
   */
  @Get('delegated-permissions/credentials')
  @Roles('ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async listCredentialsPermissions(@Request() req: any) {
    const institutionId = req.user.institutionId;

    if (!institutionId) {
      throw new BadRequestException('No se pudo determinar la institución');
    }

    const usersWithPermission = await this.prisma.institutionUser.findMany({
      where: {
        institutionId,
        canManageCredentials: true,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return usersWithPermission.map(iu => ({
      userId: iu.userId,
      firstName: iu.user.firstName,
      lastName: iu.user.lastName,
      email: iu.user.email,
      assignedAt: iu.credentialsPermissionAt,
    }));
  }

  /**
   * Lista docentes de la institución para asignarles permisos.
   * Retorna docentes que NO tienen el permiso actualmente.
   */
  @Get('delegated-permissions/available-teachers')
  @Roles('ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async listAvailableTeachersForPermission(@Request() req: any) {
    const institutionId = req.user.institutionId;

    if (!institutionId) {
      throw new BadRequestException('No se pudo determinar la institución');
    }

    // Buscar rol DOCENTE
    const docenteRole = await this.prisma.role.findFirst({
      where: { name: 'DOCENTE' },
    });

    if (!docenteRole) {
      return [];
    }

    // Buscar docentes de la institución que NO tienen el permiso
    const teachers = await this.prisma.institutionUser.findMany({
      where: {
        institutionId,
        isActive: true,
        canManageCredentials: false,
        institutionUserRoles: {
          some: { roleId: docenteRole.id },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return teachers.map(iu => ({
      userId: iu.userId,
      firstName: iu.user.firstName,
      lastName: iu.user.lastName,
      email: iu.user.email,
    }));
  }
}
