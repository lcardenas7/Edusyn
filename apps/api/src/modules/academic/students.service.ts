import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStudentDto, UpdateStudentDto, EnrollStudentDto, UpdateEnrollmentStatusDto } from './dto/create-student.dto';

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateStudentDto) {
    return this.prisma.student.create({
      data: {
        institutionId: dto.institutionId,
        documentType: dto.documentType,
        documentNumber: dto.documentNumber,
        firstName: dto.firstName,
        lastName: dto.lastName,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        gender: dto.gender,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
      },
    });
  }

  async list(params: { institutionId?: string; groupId?: string; academicYearId?: string }) {
    const { institutionId, groupId, academicYearId } = params;

    if (groupId || academicYearId) {
      // Get students with enrollments
      return this.prisma.studentEnrollment.findMany({
        where: {
          ...(groupId && { groupId }),
          ...(academicYearId && { academicYearId }),
        },
        include: {
          student: true,
          group: {
            include: {
              grade: true,
            },
          },
        },
        orderBy: {
          student: {
            lastName: 'asc',
          },
        },
      });
    }

    return this.prisma.student.findMany({
      where: {
        ...(institutionId && { institutionId }),
      },
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
            academicYear: {
              year: 'desc',
            },
          },
          take: 1,
        },
      },
      orderBy: {
        lastName: 'asc',
      },
    });
  }

  async findById(id: string) {
    return this.prisma.student.findUnique({
      where: { id },
      include: {
        enrollments: {
          include: {
            group: {
              include: {
                grade: true,
                campus: true,
                shift: true,
              },
            },
            academicYear: true,
          },
          orderBy: {
            academicYear: {
              year: 'desc',
            },
          },
        },
      },
    });
  }

  async update(id: string, dto: UpdateStudentDto) {
    return this.prisma.student.update({
      where: { id },
      data: {
        ...(dto.documentType && { documentType: dto.documentType }),
        ...(dto.documentNumber && { documentNumber: dto.documentNumber }),
        ...(dto.firstName && { firstName: dto.firstName }),
        ...(dto.lastName && { lastName: dto.lastName }),
        ...(dto.birthDate && { birthDate: new Date(dto.birthDate) }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.address !== undefined && { address: dto.address }),
      },
    });
  }

  async delete(id: string) {
    return this.prisma.student.delete({
      where: { id },
    });
  }

  async enroll(dto: EnrollStudentDto) {
    return this.prisma.studentEnrollment.create({
      data: {
        studentId: dto.studentId,
        academicYearId: dto.academicYearId,
        groupId: dto.groupId,
        status: 'ACTIVE',
      },
      include: {
        student: true,
        group: {
          include: {
            grade: true,
          },
        },
      },
    });
  }

  async updateEnrollmentStatus(enrollmentId: string, dto: UpdateEnrollmentStatusDto) {
    return this.prisma.studentEnrollment.update({
      where: { id: enrollmentId },
      data: {
        status: dto.status,
      },
    });
  }

  async getEnrollmentsByStudent(studentId: string) {
    return this.prisma.studentEnrollment.findMany({
      where: { studentId },
      include: {
        group: {
          include: {
            grade: true,
            campus: true,
          },
        },
        academicYear: true,
      },
      orderBy: {
        academicYear: {
          year: 'desc',
        },
      },
    });
  }
}
