import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTeacherDto, UpdateTeacherDto } from './dto/create-teacher.dto';
import * as bcryptjs from 'bcryptjs';

@Injectable()
export class TeachersService {
  constructor(private prisma: PrismaService) {}

  private async generateUsername(firstName: string, lastName: string): Promise<string> {
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

  async create(dto: CreateTeacherDto) {
    const passwordHash = await bcryptjs.hash(dto.password, 10);
    const username = await this.generateUsername(dto.firstName, dto.lastName);

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
        roles: {
          create: {
            roleId: docenteRole.id,
          },
        },
      },
      include: {
        roles: {
          include: {
            role: true,
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

  async list(params: { isActive?: boolean }) {
    const { isActive } = params;

    // Get users with DOCENTE role
    return this.prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: {
              name: 'DOCENTE',
            },
          },
        },
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
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.firstName && { firstName: dto.firstName }),
        ...(dto.lastName && { lastName: dto.lastName }),
        ...(dto.documentType && { documentType: dto.documentType as any }),
        ...(dto.documentNumber && { documentNumber: dto.documentNumber }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  async delete(id: string) {
    return this.prisma.user.delete({
      where: { id },
    });
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
