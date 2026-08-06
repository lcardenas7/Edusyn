import { Injectable, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInstitutionDto, UpdateInstitutionDto, UpdateInstitutionModulesDto } from './dto/create-institution.dto';
import * as bcrypt from 'bcryptjs';
import { DEFAULT_PERFORMANCE_SCALE } from '../evaluation/performance-scale.util';

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

    // ── Rector: validar solo si es una persona distinta del administrador ──
    const rectorSeparate = dto.rectorSameAsAdmin === false;
    if (rectorSeparate) {
      if (!dto.rectorFirstName || !dto.rectorLastName || !dto.rectorEmail) {
        throw new ConflictException('Datos del rector incompletos (nombre, apellido y email son requeridos).');
      }
      if (dto.rectorEmail.toLowerCase() === dto.adminEmail.toLowerCase()) {
        throw new ConflictException('El email del rector no puede ser igual al del administrador. Si es la misma persona, marca "El rector es el mismo administrador".');
      }
      const existingRectorEmail = await this.prisma.user.findUnique({ where: { email: dto.rectorEmail } });
      if (existingRectorEmail) {
        throw new ConflictException(`El email del rector "${dto.rectorEmail}" ya está registrado`);
      }
    }

    // daneCode es único a nivel BD: validarlo aquí devuelve un 409 con mensaje
    // humano en vez de dejar reventar la transacción con el error crudo de Prisma
    // (mismo patrón que el 409 de slug y email de arriba).
    if (dto.daneCode) {
      const existingDane = await this.prisma.institution.findFirst({
        where: { daneCode: dto.daneCode },
        select: { id: true },
      });
      if (existingDane) {
        throw new ConflictException(`El código DANE "${dto.daneCode}" ya está registrado en otra institución`);
      }
    }

    // Usar contraseña proporcionada o generar una temporal
    const tempPassword = dto.adminPassword || this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Contraseña del rector (solo si es persona distinta y tendrá login propio)
    const rectorWithLogin = rectorSeparate && dto.rectorHasLogin === true;
    const rectorTempPassword = rectorWithLogin ? (dto.rectorPassword || this.generateTempPassword()) : null;
    const rectorPasswordHash = rectorTempPassword
      ? await bcrypt.hash(rectorTempPassword, 10)
      : await bcrypt.hash(this.generateTempPassword(), 10); // hash inutilizable si no tiene login

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

      // 2b. Sembrar la escala de desempeño por defecto (0-5) para que ninguna
      // institución nazca sin escala. El admin la ajusta luego en Niveles/Calificación
      // y syncScaleFromConfig la actualiza. (Consolidación P2)
      await tx.performanceScale.createMany({
        data: DEFAULT_PERFORMANCE_SCALE.map((r) => ({
          institutionId: institution.id,
          level: r.level,
          minScore: r.minScore,
          maxScore: r.maxScore,
          label: r.label,
          order: r.order,
          isApproved: r.isApproved,
        })),
      });

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
          mustChangePassword: true, // Forzar cambio de contraseña en primer login
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
      const adminInstitutionUser = await tx.institutionUser.create({
        data: {
          userId: adminUser.id,
          institutionId: institution.id,
          isAdmin: true,
        },
      });

      // 7. Dual-write: asignar rol por tenant (InstitutionUserRole)
      await tx.institutionUserRole.create({
        data: {
          institutionUserId: adminInstitutionUser.id,
          roleId: adminRole.id,
        },
      });

      // 8. Rector (figura académica) — separado del administrador de plataforma
      let rectorRole = await tx.role.findUnique({ where: { name: 'RECTOR' } });
      if (!rectorRole) {
        rectorRole = await tx.role.create({ data: { name: 'RECTOR' } });
      }

      let rector: any;
      if (!rectorSeparate) {
        // Misma persona: el administrador también obtiene el rol RECTOR (mismas credenciales)
        await tx.userRole.create({ data: { userId: adminUser.id, roleId: rectorRole.id } });
        await tx.institutionUserRole.create({ data: { institutionUserId: adminInstitutionUser.id, roleId: rectorRole.id } });
        rector = {
          sameAsAdmin: true,
          id: adminUser.id,
          email: adminUser.email,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
        };
      } else {
        // Persona distinta: se crea el usuario rector (con o sin login propio)
        const rectorUser = await tx.user.create({
          data: {
            email: dto.rectorEmail!,
            username: dto.rectorUsername || dto.rectorEmail!.split('@')[0],
            firstName: dto.rectorFirstName!,
            lastName: dto.rectorLastName!,
            phone: dto.rectorPhone,
            passwordHash: rectorPasswordHash,
            isActive: rectorWithLogin, // sin login => inactivo (no inicia sesión, solo figura)
            mustChangePassword: rectorWithLogin,
          },
        });
        await tx.userRole.create({ data: { userId: rectorUser.id, roleId: rectorRole.id } });
        const rectorInstitutionUser = await tx.institutionUser.create({
          data: { userId: rectorUser.id, institutionId: institution.id, isAdmin: false },
        });
        await tx.institutionUserRole.create({ data: { institutionUserId: rectorInstitutionUser.id, roleId: rectorRole.id } });
        rector = {
          sameAsAdmin: false,
          id: rectorUser.id,
          email: rectorUser.email,
          firstName: rectorUser.firstName,
          lastName: rectorUser.lastName,
          hasLogin: rectorWithLogin,
          tempPassword: rectorTempPassword, // null si no tiene login
        };
      }

      return {
        institution,
        admin: {
          id: adminUser.id,
          email: adminUser.email,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          tempPassword, // Solo se muestra una vez
        },
        rector,
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
      'ENROLLMENTS': ['ENROLL_'],
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
      'ELECTIONS': ['ELECTIONS_'],
      'FINANCE': ['FINANCE_'],
      'TIMETABLE': ['TIMETABLE_'],
      'DIAGNOSIS': ['DIAGNOSIS_'],
      'PAYMENTS': ['PAYMENTS_'],
      'TEACHER_WORKSPACE': ['TEACHER_WORKSPACE_'],
      'VIRTUAL_CLASSROOM': ['VCLASS_'],
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

  /**
   * Estadísticas de uso de una institución (observabilidad SuperAdmin).
   * Solo lectura: conteos de quiénes y cuánto usan la plataforma.
   */
  async getInstitutionUsage(superAdminId: string, institutionId: string) {
    await this.verifySuperAdmin(superAdminId);

    const [
      students,
      teacherAssignments,
      classrooms,
      partialGrades,
      auditTotal,
      auditDeletes,
      recentAudit,
    ] = await Promise.all([
      this.prisma.student.count({ where: { institutionId } }),
      this.prisma.teacherAssignment.count({ where: { institutionId } }),
      this.prisma.classroom.count({ where: { institutionId } }),
      this.prisma.partialGrade.count({ where: { institutionId } }),
      this.prisma.gradeAuditEvent.count({ where: { institutionId } }),
      this.prisma.gradeAuditEvent.count({ where: { institutionId, action: 'DELETE' } }),
      this.prisma.gradeAuditEvent.findMany({
        where: { institutionId },
        orderBy: { performedAt: 'desc' },
        take: 5,
        select: { id: true, action: true, actorName: true, activityName: true, previousScore: true, newScore: true, performedAt: true },
      }),
    ]);

    // Docentes distintos con carga académica
    const distinctTeachers = await this.prisma.teacherAssignment.findMany({
      where: { institutionId },
      select: { teacherId: true },
      distinct: ['teacherId'],
    });

    return {
      students,
      teachers: distinctTeachers.length,
      teacherAssignments,
      classrooms,
      partialGrades,
      gradeAudit: { total: auditTotal, deletes: auditDeletes, recent: recentAudit },
    };
  }

  /**
   * Registro forense de cambios de notas (visor SuperAdmin).
   * Sin institutionId = vista general (todas las instituciones).
   * Con institutionId = por institución. Filtros opcionales por acción/estudiante/actor.
   */
  async getGradeAuditLog(
    superAdminId: string,
    params: {
      institutionId?: string;
      action?: 'CREATE' | 'UPDATE' | 'DELETE';
      studentEnrollmentId?: string;
      actorUserId?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    await this.verifySuperAdmin(superAdminId);

    const where: any = {};
    if (params.institutionId) where.institutionId = params.institutionId;
    if (params.action) where.action = params.action;
    if (params.studentEnrollmentId) where.studentEnrollmentId = params.studentEnrollmentId;
    if (params.actorUserId) where.actorUserId = params.actorUserId;

    const take = Math.min(Math.max(params.limit || 50, 1), 200);
    const skip = Math.max(params.offset || 0, 0);

    const [events, total] = await Promise.all([
      this.prisma.gradeAuditEvent.findMany({
        where,
        orderBy: { performedAt: 'desc' },
        take,
        skip,
        include: { institution: { select: { id: true, name: true } } },
      }),
      this.prisma.gradeAuditEvent.count({ where }),
    ]);

    // Resolver nombres legibles (estudiante, asignatura, periodo, actor) en lote
    const enrollmentIds = [...new Set(events.map((e) => e.studentEnrollmentId).filter(Boolean) as string[])];
    const taIds = [...new Set(events.map((e) => e.teacherAssignmentId).filter(Boolean) as string[])];
    const termIds = [...new Set(events.map((e) => e.academicTermId).filter(Boolean) as string[])];
    const userIds = [...new Set(events.map((e) => e.actorUserId).filter(Boolean) as string[])];

    const [enrollments, assignments, terms, users] = await Promise.all([
      enrollmentIds.length ? this.prisma.studentEnrollment.findMany({ where: { id: { in: enrollmentIds } }, select: { id: true, student: { select: { firstName: true, lastName: true } } } }) : Promise.resolve([]),
      taIds.length ? this.prisma.teacherAssignment.findMany({ where: { id: { in: taIds } }, select: { id: true, subject: { select: { name: true } }, group: { select: { name: true, grade: { select: { name: true } } } } } }) : Promise.resolve([]),
      termIds.length ? this.prisma.academicTerm.findMany({ where: { id: { in: termIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
      userIds.length ? this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true, email: true } }) : Promise.resolve([]),
    ]);

    const enrollMap = new Map<string, string | null>(enrollments.map((e: any): [string, string | null] => [e.id, e.student ? `${e.student.firstName} ${e.student.lastName}` : null]));
    const taMap = new Map<string, { subject: string | null; group: string | null }>(assignments.map((a: any): [string, { subject: string | null; group: string | null }] => [a.id, { subject: a.subject?.name || null, group: a.group ? `${a.group.grade?.name || ''} ${a.group.name}`.trim() : null }]));
    const termMap = new Map<string, string>(terms.map((t: any): [string, string] => [t.id, t.name]));
    const userMap = new Map<string, { name: string; email: string }>(users.map((u: any): [string, { name: string; email: string }] => [u.id, { name: `${u.firstName} ${u.lastName}`.trim(), email: u.email }]));

    const items = events.map((e) => {
      const ta = e.teacherAssignmentId ? taMap.get(e.teacherAssignmentId) : null;
      const currentActor = e.actorUserId ? userMap.get(e.actorUserId) : null;
      return {
        id: e.id,
        institution: (e as any).institution,
        action: e.action,
        performedAt: e.performedAt,
        actor: {
          userId: e.actorUserId,
          // nombre actual del usuario (si existe) o el snapshot guardado al momento del cambio
          name: currentActor?.name || e.actorName || null,
          email: currentActor?.email || e.actorName || null,
          role: e.actorRole,
        },
        student: e.studentEnrollmentId ? enrollMap.get(e.studentEnrollmentId) || null : null,
        subject: ta?.subject || null,
        group: ta?.group || null,
        term: e.academicTermId ? termMap.get(e.academicTermId) || null : null,
        component: e.componentType,
        activity: e.activityName,
        previousScore: e.previousScore !== null && e.previousScore !== undefined ? Number(e.previousScore) : null,
        newScore: e.newScore !== null && e.newScore !== undefined ? Number(e.newScore) : null,
      };
    });

    return { items, total, limit: take, offset: skip };
  }

  async getInstitutionUsers(superAdminId: string, institutionId: string) {
    await this.verifySuperAdmin(superAdminId);

    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: { id: true, name: true },
    });
    if (!institution) throw new NotFoundException('Institución no encontrada');

    const users: any[] = await this.prisma.institutionUser.findMany({
      where: { institutionId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true,
            documentNumber: true,
            phone: true,
            isActive: true,
            mustChangePassword: true,
            createdAt: true,
          },
        },
        institutionUserRoles: {
          include: { role: { select: { name: true } } },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return {
      institution: institution.name,
      users: users.map((iu) => ({
        id: iu.user.id,
        email: iu.user.email,
        username: iu.user.username,
        firstName: iu.user.firstName,
        lastName: iu.user.lastName,
        documentNumber: iu.user.documentNumber,
        phone: iu.user.phone,
        isActive: iu.user.isActive,
        isAdmin: iu.isAdmin,
        mustChangePassword: iu.user.mustChangePassword,
        roles: (iu.institutionUserRoles || []).map((r: any) => r.role?.name || r.roleId).filter(Boolean),
        createdAt: iu.user.createdAt,
      })),
    };
  }

  async resetUserPassword(
    superAdminId: string,
    userId: string,
    opts?: { newPassword?: string; mustChangePassword?: boolean },
  ) {
    await this.verifySuperAdmin(superAdminId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, email: true, documentNumber: true, firstName: true, lastName: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    let newPassword: string;
    if (opts?.newPassword && opts.newPassword.length >= 6) {
      newPassword = opts.newPassword;
    } else if (user.documentNumber) {
      newPassword = user.documentNumber;
    } else {
      newPassword = `Edu${Math.random().toString(36).substring(2, 8)}`;
    }

    const mustChange = opts?.mustChangePassword !== undefined ? opts.mustChangePassword : true;
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: mustChange },
    });

    return {
      userId: user.id,
      username: user.username,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      newPassword,
      mustChangePassword: mustChange,
    };
  }
}
