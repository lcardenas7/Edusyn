import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTeacherDto, UpdateTeacherDto } from './dto/create-teacher.dto';
import * as bcryptjs from 'bcryptjs';

@Injectable()
export class TeachersService {
  constructor(private prisma: PrismaService) {}

  // Generar username: primeraLetraNombre + primerApellido + 4últimosDigitos + d (docente)
  private async generateUsername(firstName: string, lastName: string, documentNumber: string): Promise<string> {
    const firstLetter = firstName.toLowerCase().charAt(0);
    const cleanLastName = lastName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '');
    const last4Digits = documentNumber.slice(-4);
    const baseUsername = `${firstLetter}${cleanLastName}${last4Digits}d`;
    
    let username = baseUsername;
    let counter = 1;
    
    // Si ya existe, agregar contador
    while (await this.prisma.user.findUnique({ where: { username } })) {
      username = `${baseUsername}${counter}`;
      counter++;
    }
    
    return username;
  }

  async create(dto: CreateTeacherDto, institutionId?: string) {
    // La contraseña es el número de documento si no se proporciona
    const password = dto.password || dto.documentNumber || 'temporal123';
    const passwordHash = await bcryptjs.hash(password, 10);
    const username = await this.generateUsername(dto.firstName, dto.lastName, dto.documentNumber || '');

    // Find or create DOCENTE role
    let docenteRole = await this.prisma.role.findUnique({
      where: { name: 'DOCENTE' },
    });

    if (!docenteRole) {
      docenteRole = await this.prisma.role.create({
        data: { name: 'DOCENTE' },
      });
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        documentType: dto.documentType as any,
        documentNumber: dto.documentNumber,
        phone: dto.phone,
        mustChangePassword: true, // El docente debe cambiar su contraseña al primer inicio de sesión
        roles: {
          create: {
            roleId: docenteRole.id,
          },
        },
        // Asociar con la institución si se proporciona
        ...(institutionId && {
          institutionUsers: {
            create: {
              institutionId,
              isAdmin: false,
            },
          },
        }),
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        institutionUsers: {
          include: {
            institution: true,
          },
        },
      },
    });

    return {
      ...user,
      username,
      message: `Usuario creado: ${username}`,
    };
  }

  async list(params: { institutionId?: string; isActive?: boolean }) {
    const { institutionId, isActive } = params;

    console.log(`[TeachersService.list] institutionId=${institutionId}, isActive=${isActive}`);

    // Primero verificar cuántos docentes hay en total con rol DOCENTE
    const totalDocentes = await this.prisma.user.count({
      where: {
        roles: { some: { role: { name: 'DOCENTE' } } },
      },
    });
    console.log(`[TeachersService.list] Total docentes con rol DOCENTE: ${totalDocentes}`);

    // Verificar cuántos usuarios hay en la institución (sin filtrar por rol)
    if (institutionId) {
      const usuariosEnInstitucion = await this.prisma.institutionUser.count({
        where: { institutionId },
      });
      console.log(`[TeachersService.list] Total usuarios en institución: ${usuariosEnInstitucion}`);

      const docentesEnInstitucion = await this.prisma.user.count({
        where: {
          roles: { some: { role: { name: 'DOCENTE' } } },
          institutionUsers: { some: { institutionId } },
        },
      });
      console.log(`[TeachersService.list] Docentes en institución ${institutionId}: ${docentesEnInstitucion}`);

      // Listar todos los roles existentes
      const roles = await this.prisma.role.findMany();
      console.log(`[TeachersService.list] Roles en sistema: ${roles.map(r => r.name).join(', ')}`);
    }

    // Get users with DOCENTE role, filtered by institution
    return this.prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: {
              name: 'DOCENTE',
            },
          },
        },
        // Filtrar por institución si se proporciona
        ...(institutionId && {
          institutionUsers: {
            some: {
              institutionId,
            },
          },
        }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        teacherAssignments: {
          include: {
            subject: {
              include: {
                area: true,
              },
            },
            group: {
              include: {
                grade: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 5,
        },
      },
      orderBy: {
        lastName: 'asc',
      },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        teacherAssignments: {
          include: {
            subject: {
              include: {
                area: true,
              },
            },
            group: {
              include: {
                grade: true,
                campus: true,
              },
            },
            academicYear: true,
          },
        },
      },
    });
  }

  async update(id: string, dto: UpdateTeacherDto) {
    // Si cambia el documento, actualizar también contraseña y username
    let updateData: any = {
      ...(dto.firstName && { firstName: dto.firstName }),
      ...(dto.lastName && { lastName: dto.lastName }),
      ...(dto.documentType && { documentType: dto.documentType as any }),
      ...(dto.documentNumber && { documentNumber: dto.documentNumber }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    };

    // Si cambia el documento, actualizar contraseña y username
    if (dto.documentNumber) {
      const currentUser = await this.prisma.user.findUnique({ where: { id } });
      if (currentUser) {
        // Nueva contraseña = nuevo documento
        const newPasswordHash = await bcryptjs.hash(dto.documentNumber, 10);
        updateData.passwordHash = newPasswordHash;
        updateData.mustChangePassword = true; // Forzar cambio de contraseña
        
        // Regenerar username con el nuevo documento
        const firstName = dto.firstName || currentUser.firstName;
        const lastName = dto.lastName || currentUser.lastName;
        const newUsername = await this.generateUsername(firstName, lastName, dto.documentNumber);
        updateData.username = newUsername;
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  /**
   * Elimina un docente.
   * - Si tiene historial académico (calificaciones, observaciones): soft delete
   * - Si no tiene relaciones: borrado físico
   */
  async delete(id: string) {
    // Verificar si tiene historial académico
    const teacher = await this.prisma.user.findUnique({
      where: { id },
      include: {
        teacherAssignments: { take: 1 },
        studentObservations: { take: 1 },
        periodFinalGrades: { take: 1 },
      },
    });

    if (!teacher) {
      throw new Error('Docente no encontrado');
    }

    // Verificar si tiene historial
    const hasHistory = 
      teacher.teacherAssignments.length > 0 ||
      teacher.studentObservations.length > 0 ||
      teacher.periodFinalGrades.length > 0;

    if (hasHistory) {
      // Soft delete: marcar como inactivo
      return this.prisma.user.update({
        where: { id },
        data: { isActive: false },
      });
    } else {
      // Borrado físico: no tiene historial
      // Primero eliminar relaciones
      await this.prisma.userRole.deleteMany({ where: { userId: id } });
      await this.prisma.institutionUser.deleteMany({ where: { userId: id } });
      
      return this.prisma.user.delete({
        where: { id },
      });
    }
  }

  async getAssignments(teacherId: string, academicYearId?: string) {
    return this.prisma.teacherAssignment.findMany({
      where: {
        teacherId,
        ...(academicYearId && { academicYearId }),
      },
      include: {
        subject: {
          include: {
            area: true,
          },
        },
        group: {
          include: {
            grade: true,
            campus: true,
          },
        },
        academicYear: true,
      },
    });
  }
}
