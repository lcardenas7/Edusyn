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
        secondName: dto.secondName,
        lastName: dto.lastName,
        secondLastName: dto.secondLastName,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        birthPlace: dto.birthPlace,
        gender: dto.gender,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        neighborhood: dto.neighborhood,
        city: dto.city,
        // Información médica
        bloodType: dto.bloodType,
        eps: dto.eps,
        allergies: dto.allergies,
        medicalConditions: dto.medicalConditions,
        medications: dto.medications,
        emergencyContact: dto.emergencyContact,
        emergencyPhone: dto.emergencyPhone,
        // Información socioeconómica
        stratum: dto.stratum,
        sisbenLevel: dto.sisbenLevel,
        ethnicity: dto.ethnicity,
        displacement: dto.displacement,
        disability: dto.disability,
        disabilityType: dto.disabilityType,
        // Información adicional
        previousSchool: dto.previousSchool,
        photo: dto.photo,
        observations: dto.observations,
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
        guardians: {
          include: {
            guardian: true,
          },
          orderBy: [
            { isPrimary: 'desc' },
            { guardian: { lastName: 'asc' } },
          ],
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
        ...(dto.secondName !== undefined && { secondName: dto.secondName }),
        ...(dto.lastName && { lastName: dto.lastName }),
        ...(dto.secondLastName !== undefined && { secondLastName: dto.secondLastName }),
        ...(dto.birthDate && { birthDate: new Date(dto.birthDate) }),
        ...(dto.birthPlace !== undefined && { birthPlace: dto.birthPlace }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.neighborhood !== undefined && { neighborhood: dto.neighborhood }),
        ...(dto.city !== undefined && { city: dto.city }),
        // Información médica
        ...(dto.bloodType !== undefined && { bloodType: dto.bloodType }),
        ...(dto.eps !== undefined && { eps: dto.eps }),
        ...(dto.allergies !== undefined && { allergies: dto.allergies }),
        ...(dto.medicalConditions !== undefined && { medicalConditions: dto.medicalConditions }),
        ...(dto.medications !== undefined && { medications: dto.medications }),
        ...(dto.emergencyContact !== undefined && { emergencyContact: dto.emergencyContact }),
        ...(dto.emergencyPhone !== undefined && { emergencyPhone: dto.emergencyPhone }),
        // Información socioeconómica
        ...(dto.stratum !== undefined && { stratum: dto.stratum }),
        ...(dto.sisbenLevel !== undefined && { sisbenLevel: dto.sisbenLevel }),
        ...(dto.ethnicity !== undefined && { ethnicity: dto.ethnicity }),
        ...(dto.displacement !== undefined && { displacement: dto.displacement }),
        ...(dto.disability !== undefined && { disability: dto.disability }),
        ...(dto.disabilityType !== undefined && { disabilityType: dto.disabilityType }),
        // Información adicional
        ...(dto.previousSchool !== undefined && { previousSchool: dto.previousSchool }),
        ...(dto.photo !== undefined && { photo: dto.photo }),
        ...(dto.observations !== undefined && { observations: dto.observations }),
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

  /**
   * Importación masiva de estudiantes con acudientes
   * Crea estudiante, acudiente (si no existe) y los vincula
   */
  async bulkImport(data: {
    institutionId: string;
    academicYearId: string;
    students: Array<{
      // Datos del estudiante
      documentType: string;
      documentNumber: string;
      firstName: string;
      secondName?: string;
      lastName: string;
      secondLastName?: string;
      birthDate?: string;
      gender?: string;
      address?: string;
      phone?: string;
      email?: string;
      groupId: string;
      // Información médica
      bloodType?: string;
      eps?: string;
      // Datos del acudiente
      guardianName?: string;
      guardianPhone?: string;
      guardianEmail?: string;
      guardianDocumentNumber?: string;
      guardianRelationship?: string;
    }>;
  }) {
    const results = {
      created: 0,
      updated: 0,
      errors: [] as { row: number; error: string }[],
    };

    for (let i = 0; i < data.students.length; i++) {
      const studentData = data.students[i];
      
      try {
        // 1. Crear o actualizar estudiante
        let student = await this.prisma.student.findUnique({
          where: {
            institutionId_documentNumber: {
              institutionId: data.institutionId,
              documentNumber: studentData.documentNumber,
            },
          },
        });

        if (student) {
          // Actualizar estudiante existente
          student = await this.prisma.student.update({
            where: { id: student.id },
            data: {
              firstName: studentData.firstName,
              secondName: studentData.secondName,
              lastName: studentData.lastName,
              secondLastName: studentData.secondLastName,
              birthDate: studentData.birthDate ? new Date(studentData.birthDate) : undefined,
              gender: studentData.gender,
              address: studentData.address,
              phone: studentData.phone,
              email: studentData.email,
              bloodType: studentData.bloodType,
              eps: studentData.eps,
            },
          });
          results.updated++;
        } else {
          // Crear nuevo estudiante
          student = await this.prisma.student.create({
            data: {
              institutionId: data.institutionId,
              documentType: studentData.documentType,
              documentNumber: studentData.documentNumber,
              firstName: studentData.firstName,
              secondName: studentData.secondName,
              lastName: studentData.lastName,
              secondLastName: studentData.secondLastName,
              birthDate: studentData.birthDate ? new Date(studentData.birthDate) : null,
              gender: studentData.gender,
              address: studentData.address,
              phone: studentData.phone,
              email: studentData.email,
              bloodType: studentData.bloodType,
              eps: studentData.eps,
            },
          });
          results.created++;
        }

        // 2. Crear matrícula si no existe
        const existingEnrollment = await this.prisma.studentEnrollment.findUnique({
          where: {
            studentId_academicYearId: {
              studentId: student.id,
              academicYearId: data.academicYearId,
            },
          },
        });

        if (!existingEnrollment) {
          await this.prisma.studentEnrollment.create({
            data: {
              studentId: student.id,
              academicYearId: data.academicYearId,
              groupId: studentData.groupId,
              status: 'ACTIVE',
            },
          });
        }

        // 3. Crear acudiente si se proporcionaron datos
        if (studentData.guardianName && studentData.guardianPhone) {
          // Parsear nombre del acudiente (asumiendo "NOMBRE APELLIDO")
          const nameParts = studentData.guardianName.trim().split(/\s+/);
          const guardianFirstName = nameParts[0] || '';
          const guardianLastName = nameParts.slice(1).join(' ') || nameParts[0] || '';
          
          // Usar teléfono como documento si no se proporciona
          const guardianDocNumber = studentData.guardianDocumentNumber || studentData.guardianPhone;

          // Buscar o crear acudiente
          let guardian = await this.prisma.guardian.findUnique({
            where: {
              institutionId_documentNumber: {
                institutionId: data.institutionId,
                documentNumber: guardianDocNumber,
              },
            },
          });

          if (!guardian) {
            guardian = await this.prisma.guardian.create({
              data: {
                institutionId: data.institutionId,
                documentType: 'CC',
                documentNumber: guardianDocNumber,
                firstName: guardianFirstName,
                lastName: guardianLastName,
                phone: studentData.guardianPhone,
                email: studentData.guardianEmail,
              },
            });
          }

          // 4. Vincular acudiente con estudiante
          const existingLink = await this.prisma.studentGuardian.findUnique({
            where: {
              studentId_guardianId: {
                studentId: student.id,
                guardianId: guardian.id,
              },
            },
          });

          if (!existingLink) {
            await this.prisma.studentGuardian.create({
              data: {
                studentId: student.id,
                guardianId: guardian.id,
                relationship: (studentData.guardianRelationship as any) || 'OTHER',
                isPrimary: true,
                canPickUp: true,
                isEmergencyContact: true,
              },
            });
          }
        }
      } catch (error: any) {
        results.errors.push({
          row: i + 1,
          error: error.message || 'Error desconocido',
        });
      }
    }

    return results;
  }
}
