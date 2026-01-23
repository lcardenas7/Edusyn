import * as bcrypt from 'bcryptjs';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } },
    });
  }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
      include: { roles: { include: { role: true } } },
    });
  }

  async findByEmailOrUsername(identifier: string) {
    return this.prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { username: identifier },
        ],
      },
      include: { roles: { include: { role: true } } },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });
  }

  async updatePassword(userId: string, newPasswordHash: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        mustChangePassword: false,
      },
    });
  }

  async generateUsername(firstName: string, lastName: string): Promise<string> {
    const baseUsername = `${firstName.toLowerCase().charAt(0)}${lastName.toLowerCase().replace(/\s+/g, '')}`;
    const cleanUsername = baseUsername.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    
    let username = cleanUsername;
    let counter = 1;
    
    while (await this.prisma.user.findUnique({ where: { username } })) {
      username = `${cleanUsername}${counter}`;
      counter++;
    }
    
    return username;
  }

  async findUserInstitution(userId: string) {
    console.log(`[findUserInstitution] Buscando institución para usuario: ${userId}`);
    
    // Buscar institución a través de InstitutionUser primero
    const institutionUser = await this.prisma.institutionUser.findFirst({
      where: { userId },
      include: {
        institution: {
          include: {
            modules: true, // Incluir módulos habilitados
          }
        }
      }
    });

    if (institutionUser?.institution) {
      console.log(`[findUserInstitution] Encontrado via InstitutionUser: ${institutionUser.institution.name}`);
      return institutionUser.institution;
    }

    // Buscar institución a través de asignaciones del docente
    const assignment = await this.prisma.teacherAssignment.findFirst({
      where: { teacherId: userId },
      include: {
        group: {
          include: {
            campus: {
              include: { 
                institution: {
                  include: {
                    modules: true, // Incluir módulos habilitados
                  }
                }
              }
            }
          }
        }
      }
    });

    if (assignment?.group?.campus?.institution) {
      console.log(`[findUserInstitution] Encontrado via TeacherAssignment: ${assignment.group.campus.institution.name}`);
      return assignment.group.campus.institution;
    }

    console.log(`[findUserInstitution] NO se encontró institución para usuario: ${userId}`);
    // Si no tiene asignaciones, NO asignar ninguna institución
    // Esto previene que usuarios accedan a instituciones a las que no pertenecen
    return null;
  }

  // Vincular usuario a institución (para reparar usuarios sin vínculo)
  async linkUserToInstitution(userId: string, institutionId: string) {
    // Verificar si ya existe el vínculo
    const existing = await this.prisma.institutionUser.findFirst({
      where: { userId, institutionId }
    });

    if (existing) {
      return existing;
    }

    // Crear el vínculo
    return this.prisma.institutionUser.create({
      data: {
        userId,
        institutionId,
        isAdmin: false,
      },
      include: {
        institution: true,
        user: true,
      }
    });
  }

  async createUser(params: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    roles: string[];
    username?: string;
    documentType?: string;
    documentNumber?: string;
    phone?: string;
  }) {
    const passwordHash = await bcrypt.hash(params.password, 10);
    const username = params.username || await this.generateUsername(params.firstName, params.lastName);

    return this.prisma.user.create({
      data: {
        email: params.email,
        username,
        passwordHash,
        firstName: params.firstName,
        lastName: params.lastName,
        documentType: params.documentType as any,
        documentNumber: params.documentNumber,
        phone: params.phone,
        roles: {
          create: params.roles.map((roleName) => ({
            role: {
              connectOrCreate: {
                where: { name: roleName },
                create: { name: roleName },
              },
            },
          })),
        },
      },
      include: { roles: { include: { role: true } } },
    });
  }
}
