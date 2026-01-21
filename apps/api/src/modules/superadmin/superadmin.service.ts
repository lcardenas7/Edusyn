import { Injectable, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInstitutionDto, UpdateInstitutionDto, UpdateInstitutionModulesDto } from './dto/create-institution.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class SuperadminService {
  constructor(private prisma: PrismaService) {}

  /**
   * Verifica que el usuario sea SuperAdmin
   */
  async verifySuperAdmin(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperAdmin: true },
    });

    if (!user?.isSuperAdmin) {
      throw new ForbiddenException('Acceso denegado. Se requiere rol de SuperAdmin.');
    }
  }

  /**
   * Lista todas las instituciones (solo SuperAdmin)
   */
  async getAllInstitutions(superAdminId: string) {
    await this.verifySuperAdmin(superAdminId);

    return this.prisma.institution.findMany({
      include: {
        modules: true,
        users: {
          where: { isAdmin: true },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        _count: {
          select: {
            students: true,
            campuses: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Obtiene una institución por ID
   */
  async getInstitutionById(superAdminId: string, institutionId: string) {
    await this.verifySuperAdmin(superAdminId);

    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      include: {
        modules: true,
        users: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                isActive: true,
              },
            },
          },
        },
        _count: {
          select: {
            students: true,
            campuses: true,
            areas: true,
          },
        },
      },
    });

    if (!institution) {
      throw new NotFoundException('Institución no encontrada');
    }

    return institution;
  }

  /**
   * Crea una nueva institución con su admin/rector
   */
  async createInstitution(superAdminId: string, dto: CreateInstitutionDto) {
    await this.verifySuperAdmin(superAdminId);

    // Verificar que el slug no exista
    const existingSlug = await this.prisma.institution.findUnique({
      where: { slug: dto.slug },
    });

    if (existingSlug) {
      throw new ConflictException(`El slug "${dto.slug}" ya está en uso`);
    }

    // Verificar que el email del admin no exista
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.adminEmail },
    });

    if (existingEmail) {
      throw new ConflictException(`El email "${dto.adminEmail}" ya está registrado`);
    }

    // Usar contraseña proporcionada o generar una temporal
    const tempPassword = dto.adminPassword || this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Crear institución, admin y módulos en una transacción
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Crear la institución
      const institution = await tx.institution.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          daneCode: dto.daneCode,
          nit: dto.nit,
          logo: dto.logo,
          status: 'TRIAL',
          trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días de prueba
          createdById: superAdminId,
        },
      });

      // 2. Crear los módulos habilitados
      if (dto.modules.length > 0) {
        await tx.institutionModule.createMany({
          data: dto.modules.map((module) => ({
            institutionId: institution.id,
            module,
            isActive: true,
          })),
        });
      }

      // 3. Obtener o crear el rol ADMIN_INSTITUTIONAL
      let adminRole = await tx.role.findUnique({
        where: { name: 'ADMIN_INSTITUTIONAL' },
      });

      if (!adminRole) {
        adminRole = await tx.role.create({
          data: { name: 'ADMIN_INSTITUTIONAL' },
        });
      }

      // 4. Crear el usuario admin/rector
      const adminUser = await tx.user.create({
        data: {
          email: dto.adminEmail,
          username: dto.adminUsername || dto.adminEmail.split('@')[0],
          firstName: dto.adminFirstName,
          lastName: dto.adminLastName,
          phone: dto.adminPhone,
          passwordHash,
          isActive: true,
        },
      });

      // 5. Asignar rol al usuario
      await tx.userRole.create({
        data: {
          userId: adminUser.id,
          roleId: adminRole.id,
        },
      });

      // 6. Vincular usuario a la institución como admin
      await tx.institutionUser.create({
        data: {
          userId: adminUser.id,
          institutionId: institution.id,
          isAdmin: true,
        },
      });

      return {
        institution,
        admin: {
          id: adminUser.id,
          email: adminUser.email,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          tempPassword, // Solo se muestra una vez
        },
      };
    });

    return result;
  }

  /**
   * Actualiza una institución
   */
  async updateInstitution(superAdminId: string, institutionId: string, dto: UpdateInstitutionDto) {
    await this.verifySuperAdmin(superAdminId);

    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
    });

    if (!institution) {
      throw new NotFoundException('Institución no encontrada');
    }

    return this.prisma.institution.update({
      where: { id: institutionId },
      data: dto,
    });
  }

  /**
   * Actualiza los módulos de una institución
   */
  async updateInstitutionModules(
    superAdminId: string,
    institutionId: string,
    dto: UpdateInstitutionModulesDto,
  ) {
    await this.verifySuperAdmin(superAdminId);

    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
    });

    if (!institution) {
      throw new NotFoundException('Institución no encontrada');
    }

    // Mapeo de módulos a prefijos de features
    const moduleFeaturePrefixes: Record<string, string[]> = {
      'DASHBOARD': ['DASHBOARD_'],
      'ACADEMIC': ['ACADEMIC_'],
      'ATTENDANCE': ['ATTENDANCE_'],
      'EVALUATION': ['EVALUATION_'],
      'RECOVERY': ['RECOVERY_'],
      'REPORTS': ['RPT_'],  // Nuevo prefijo para reportes granulares
      'COMMUNICATIONS': ['COMM_'],
      'OBSERVER': ['OBSERVER_'],
      'PERFORMANCE': ['PERF_'],
      'MEN_REPORTS': ['MEN_'],
      'USERS': ['USERS_'],
      'CONFIG': ['CONFIG_'],
    };

    // Eliminar módulos actuales y crear los nuevos con sus features
    await this.prisma.$transaction([
      this.prisma.institutionModule.deleteMany({
        where: { institutionId },
      }),
      this.prisma.institutionModule.createMany({
        data: dto.modules.map((module) => {
          // Filtrar features que pertenecen a este módulo usando el mapeo
          const prefixes = moduleFeaturePrefixes[module] || [module + '_'];
          const moduleFeatures = (dto.features || []).filter(f => 
            prefixes.some(prefix => f.startsWith(prefix))
          );
          return {
            institutionId,
            module,
            isActive: true,
            features: moduleFeatures,
          };
        }),
      }),
    ]);

    return this.prisma.institution.findUnique({
      where: { id: institutionId },
      include: { modules: true },
    });
  }

  /**
   * Cambia el estado de una institución
   */
  async updateInstitutionStatus(
    superAdminId: string,
    institutionId: string,
    status: 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'INACTIVE',
  ) {
    await this.verifySuperAdmin(superAdminId);

    return this.prisma.institution.update({
      where: { id: institutionId },
      data: { status },
    });
  }

  /**
   * Genera una contraseña temporal
   */
  private generateTempPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  /**
   * Elimina una institución (requiere confirmación con el nombre exacto)
   */
  async deleteInstitution(superAdminId: string, institutionId: string, confirmationName: string) {
    await this.verifySuperAdmin(superAdminId);

    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
    });

    if (!institution) {
      throw new NotFoundException('Institución no encontrada');
    }

    // Verificar que el nombre de confirmación coincida
    if (confirmationName !== institution.name) {
      throw new ForbiddenException('El nombre de confirmación no coincide con el nombre de la institución');
    }

    // Eliminar en cascada usando transacción
    await this.prisma.$transaction(async (tx) => {
      // 1. Eliminar registros relacionados con estudiantes
      await tx.attendanceRecord.deleteMany({ where: { studentEnrollment: { student: { institutionId } } } });
      await tx.partialGrade.deleteMany({ where: { studentEnrollment: { student: { institutionId } } } });
      await tx.periodFinalGrade.deleteMany({ where: { studentEnrollment: { student: { institutionId } } } });
      await tx.studentEnrollment.deleteMany({ where: { student: { institutionId } } });
      await tx.student.deleteMany({ where: { institutionId } });

      // 2. Eliminar configuración académica
      await tx.teacherAssignment.deleteMany({ where: { academicYear: { institutionId } } });
      await tx.academicTerm.deleteMany({ where: { academicYear: { institutionId } } });
      await tx.academicYear.deleteMany({ where: { institutionId } });
      await tx.subject.deleteMany({ where: { area: { institutionId } } });
      await tx.area.deleteMany({ where: { institutionId } });

      // 3. Eliminar estructura organizacional
      await tx.group.deleteMany({ where: { campus: { institutionId } } });
      await tx.shift.deleteMany({ where: { campus: { institutionId } } });
      await tx.campus.deleteMany({ where: { institutionId } });

      // 4. Eliminar usuarios de la institución
      const institutionUsers = await tx.institutionUser.findMany({
        where: { institutionId },
        select: { userId: true },
      });
      const userIds = institutionUsers.map(iu => iu.userId);
      
      await tx.institutionUser.deleteMany({ where: { institutionId } });
      await tx.userRole.deleteMany({ where: { userId: { in: userIds } } });
      await tx.user.deleteMany({ where: { id: { in: userIds }, isSuperAdmin: false } });

      // 5. Eliminar módulos y configuración
      await tx.institutionModule.deleteMany({ where: { institutionId } });
      await tx.performanceScale.deleteMany({ where: { institutionId } });

      // 6. Finalmente eliminar la institución
      await tx.institution.delete({ where: { id: institutionId } });
    });

    return { message: 'Institución eliminada correctamente', institutionId };
  }

  /**
   * Obtiene estadísticas globales del sistema
   */
  async getSystemStats(superAdminId: string) {
    await this.verifySuperAdmin(superAdminId);

    const [
      totalInstitutions,
      activeInstitutions,
      trialInstitutions,
      totalUsers,
      totalStudents,
    ] = await Promise.all([
      this.prisma.institution.count(),
      this.prisma.institution.count({ where: { status: 'ACTIVE' } }),
      this.prisma.institution.count({ where: { status: 'TRIAL' } }),
      this.prisma.user.count({ where: { isSuperAdmin: false } }),
      this.prisma.student.count(),
    ]);

    return {
      totalInstitutions,
      activeInstitutions,
      trialInstitutions,
      suspendedInstitutions: totalInstitutions - activeInstitutions - trialInstitutions,
      totalUsers,
      totalStudents,
    };
  }
}
