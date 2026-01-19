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
    // Buscar institución a través de asignaciones del docente
    const assignment = await this.prisma.teacherAssignment.findFirst({
      where: { teacherId: userId },
      include: {
        group: {
          include: {
            campus: {
              include: { institution: true }
            }
          }
        }
      }
    });

    if (assignment?.group?.campus?.institution) {
      return assignment.group.campus.institution;
    }

    // Si no tiene asignaciones, buscar la primera institución disponible
    return this.prisma.institution.findFirst();
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
