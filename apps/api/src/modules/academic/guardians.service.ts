import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { 
  CreateGuardianDto, 
  UpdateGuardianDto, 
  LinkGuardianToStudentDto,
  CreateGuardianWithLinkDto 
} from './dto/guardian.dto';

@Injectable()
export class GuardiansService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateGuardianDto) {
    return this.prisma.guardian.create({
      data: {
        institutionId: dto.institutionId,
        documentType: dto.documentType,
        documentNumber: dto.documentNumber,
        firstName: dto.firstName,
        secondName: dto.secondName,
        lastName: dto.lastName,
        secondLastName: dto.secondLastName,
        phone: dto.phone,
        alternatePhone: dto.alternatePhone,
        email: dto.email,
        address: dto.address,
        neighborhood: dto.neighborhood,
        city: dto.city,
        occupation: dto.occupation,
        workplace: dto.workplace,
        workPhone: dto.workPhone,
        workAddress: dto.workAddress,
      },
    });
  }

  async createWithLink(dto: CreateGuardianWithLinkDto) {
    // Verificar si el acudiente ya existe por documento
    let guardian = await this.prisma.guardian.findUnique({
      where: {
        institutionId_documentNumber: {
          institutionId: dto.institutionId,
          documentNumber: dto.documentNumber,
        },
      },
    });

    if (!guardian) {
      guardian = await this.prisma.guardian.create({
        data: {
          institutionId: dto.institutionId,
          documentType: dto.documentType,
          documentNumber: dto.documentNumber,
          firstName: dto.firstName,
          secondName: dto.secondName,
          lastName: dto.lastName,
          secondLastName: dto.secondLastName,
          phone: dto.phone,
          alternatePhone: dto.alternatePhone,
          email: dto.email,
          address: dto.address,
          neighborhood: dto.neighborhood,
          city: dto.city,
          occupation: dto.occupation,
          workplace: dto.workplace,
          workPhone: dto.workPhone,
          workAddress: dto.workAddress,
        },
      });
    }

    // Si es acudiente principal, quitar el flag de otros acudientes del estudiante
    if (dto.isPrimary) {
      await this.prisma.studentGuardian.updateMany({
        where: { studentId: dto.studentId },
        data: { isPrimary: false },
      });
    }

    // Crear o actualizar la relación
    const link = await this.prisma.studentGuardian.upsert({
      where: {
        studentId_guardianId: {
          studentId: dto.studentId,
          guardianId: guardian.id,
        },
      },
      update: {
        relationship: dto.relationship,
        isPrimary: dto.isPrimary ?? false,
        canPickUp: dto.canPickUp ?? true,
        isEmergencyContact: dto.isEmergencyContact ?? false,
      },
      create: {
        studentId: dto.studentId,
        guardianId: guardian.id,
        relationship: dto.relationship,
        isPrimary: dto.isPrimary ?? false,
        canPickUp: dto.canPickUp ?? true,
        isEmergencyContact: dto.isEmergencyContact ?? false,
      },
      include: {
        guardian: true,
        student: true,
      },
    });

    return link;
  }

  async list(params: { institutionId?: string; search?: string }) {
    const { institutionId, search } = params;

    return this.prisma.guardian.findMany({
      where: {
        ...(institutionId && { institutionId }),
        ...(search && {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { documentNumber: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
          ],
        }),
      },
      include: {
        students: {
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                documentNumber: true,
              },
            },
          },
        },
      },
      orderBy: { lastName: 'asc' },
    });
  }

  async findById(id: string) {
    const guardian = await this.prisma.guardian.findUnique({
      where: { id },
      include: {
        students: {
          include: {
            student: {
              include: {
                enrollments: {
                  include: {
                    group: {
                      include: {
                        grade: true,
                      },
                    },
                    academicYear: true,
                  },
                  orderBy: {
                    academicYear: { year: 'desc' },
                  },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!guardian) {
      throw new NotFoundException('Acudiente no encontrado');
    }

    return guardian;
  }

  async findByStudent(studentId: string) {
    return this.prisma.studentGuardian.findMany({
      where: { studentId },
      include: {
        guardian: true,
      },
      orderBy: [
        { isPrimary: 'desc' },
        { guardian: { lastName: 'asc' } },
      ],
    });
  }

  async update(id: string, dto: UpdateGuardianDto) {
    return this.prisma.guardian.update({
      where: { id },
      data: {
        ...(dto.documentType && { documentType: dto.documentType }),
        ...(dto.documentNumber && { documentNumber: dto.documentNumber }),
        ...(dto.firstName && { firstName: dto.firstName }),
        ...(dto.secondName !== undefined && { secondName: dto.secondName }),
        ...(dto.lastName && { lastName: dto.lastName }),
        ...(dto.secondLastName !== undefined && { secondLastName: dto.secondLastName }),
        ...(dto.phone && { phone: dto.phone }),
        ...(dto.alternatePhone !== undefined && { alternatePhone: dto.alternatePhone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.neighborhood !== undefined && { neighborhood: dto.neighborhood }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.occupation !== undefined && { occupation: dto.occupation }),
        ...(dto.workplace !== undefined && { workplace: dto.workplace }),
        ...(dto.workPhone !== undefined && { workPhone: dto.workPhone }),
        ...(dto.workAddress !== undefined && { workAddress: dto.workAddress }),
      },
    });
  }

  async delete(id: string) {
    return this.prisma.guardian.delete({
      where: { id },
    });
  }

  async linkToStudent(dto: LinkGuardianToStudentDto) {
    // Verificar que existan
    const [student, guardian] = await Promise.all([
      this.prisma.student.findUnique({ where: { id: dto.studentId } }),
      this.prisma.guardian.findUnique({ where: { id: dto.guardianId } }),
    ]);

    if (!student) throw new NotFoundException('Estudiante no encontrado');
    if (!guardian) throw new NotFoundException('Acudiente no encontrado');

    // Si es acudiente principal, quitar el flag de otros
    if (dto.isPrimary) {
      await this.prisma.studentGuardian.updateMany({
        where: { studentId: dto.studentId },
        data: { isPrimary: false },
      });
    }

    return this.prisma.studentGuardian.upsert({
      where: {
        studentId_guardianId: {
          studentId: dto.studentId,
          guardianId: dto.guardianId,
        },
      },
      update: {
        relationship: dto.relationship,
        isPrimary: dto.isPrimary ?? false,
        canPickUp: dto.canPickUp ?? true,
        isEmergencyContact: dto.isEmergencyContact ?? false,
        receivesNotifications: dto.receivesNotifications ?? true,
        receivesGrades: dto.receivesGrades ?? true,
      },
      create: {
        studentId: dto.studentId,
        guardianId: dto.guardianId,
        relationship: dto.relationship,
        isPrimary: dto.isPrimary ?? false,
        canPickUp: dto.canPickUp ?? true,
        isEmergencyContact: dto.isEmergencyContact ?? false,
        receivesNotifications: dto.receivesNotifications ?? true,
        receivesGrades: dto.receivesGrades ?? true,
      },
      include: {
        guardian: true,
        student: true,
      },
    });
  }

  async unlinkFromStudent(studentId: string, guardianId: string) {
    return this.prisma.studentGuardian.delete({
      where: {
        studentId_guardianId: {
          studentId,
          guardianId,
        },
      },
    });
  }

  async updateLink(studentId: string, guardianId: string, data: Partial<LinkGuardianToStudentDto>) {
    // Si se marca como principal, quitar de otros
    if (data.isPrimary) {
      await this.prisma.studentGuardian.updateMany({
        where: { 
          studentId,
          guardianId: { not: guardianId },
        },
        data: { isPrimary: false },
      });
    }

    return this.prisma.studentGuardian.update({
      where: {
        studentId_guardianId: {
          studentId,
          guardianId,
        },
      },
      data: {
        ...(data.relationship && { relationship: data.relationship }),
        ...(data.isPrimary !== undefined && { isPrimary: data.isPrimary }),
        ...(data.canPickUp !== undefined && { canPickUp: data.canPickUp }),
        ...(data.isEmergencyContact !== undefined && { isEmergencyContact: data.isEmergencyContact }),
        ...(data.receivesNotifications !== undefined && { receivesNotifications: data.receivesNotifications }),
        ...(data.receivesGrades !== undefined && { receivesGrades: data.receivesGrades }),
      },
      include: {
        guardian: true,
      },
    });
  }
}
