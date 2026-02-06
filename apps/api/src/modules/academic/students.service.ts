import { Injectable, BadRequestException } from '@nestjs/common';
import { EnrollmentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStudentDto, UpdateStudentDto, EnrollStudentDto, UpdateEnrollmentStatusDto } from './dto/create-student.dto';
import {
  EnrollmentForReport,
  EnrollmentForGroupList,
  EnrollmentForMenReport,
  EnrollmentAreaSnapshot,
  StudentObservationForReport,
} from './dto/domain-reports.dto';
import * as bcrypt from 'bcryptjs';

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

  async list(params: { institutionId?: string; groupId?: string; academicYearId?: string; includeInactive?: boolean }) {
    const { institutionId, groupId, academicYearId, includeInactive } = params;

    if (groupId || academicYearId) {
      // Get students with enrollments
      return this.prisma.studentEnrollment.findMany({
        where: {
          ...(groupId && { groupId }),
          ...(academicYearId && { academicYearId }),
          // Filtrar estudiantes inactivos por defecto
          ...(!includeInactive && { student: { isActive: true } }),
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
        // Filtrar estudiantes inactivos por defecto
        ...(!includeInactive && { isActive: true }),
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

  /**
   * Elimina un estudiante.
   * - Si tiene historial académico (notas, asistencias, observaciones): soft delete
   * - Si no tiene relaciones: borrado físico
   */
  async delete(id: string, reason?: string) {
    // Verificar si tiene historial académico
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        enrollments: {
          include: {
            grades: { take: 1 },
            attendanceRecords: { take: 1 },
            studentObservations: { take: 1 },
          },
        },
      },
    });

    if (!student) {
      throw new BadRequestException('Estudiante no encontrado');
    }

    // Verificar si tiene historial académico
    const hasAcademicHistory = student.enrollments.some(
      (e) => e.grades.length > 0 || e.attendanceRecords.length > 0 || e.studentObservations.length > 0
    );

    if (hasAcademicHistory) {
      // Soft delete: marcar como inactivo
      return this.prisma.student.update({
        where: { id },
        data: {
          isActive: false,
          deletedAt: new Date(),
          deletedReason: reason || 'Eliminado por administrador',
        },
      });
    } else {
      // Borrado físico: no tiene historial
      // Primero eliminar relaciones sin historial
      await this.prisma.studentGuardian.deleteMany({ where: { studentId: id } });
      await this.prisma.studentDocument.deleteMany({ where: { studentId: id } });
      await this.prisma.studentEnrollment.deleteMany({ where: { studentId: id } });
      
      return this.prisma.student.delete({
        where: { id },
      });
    }
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

  /**
   * Activa acceso al sistema para un estudiante
   * Crea un User asociado con rol ESTUDIANTE
   */
  async activateAccess(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { user: true },
    });

    if (!student) {
      throw new BadRequestException('Estudiante no encontrado');
    }

    if (student.userId) {
      throw new BadRequestException('El estudiante ya tiene acceso al sistema');
    }

    // Obtener o crear rol ESTUDIANTE
    let estudianteRole = await this.prisma.role.findUnique({
      where: { name: 'ESTUDIANTE' },
    });
    if (!estudianteRole) {
      estudianteRole = await this.prisma.role.create({
        data: { name: 'ESTUDIANTE' },
      });
    }

    // Generar username y contraseña
    const username = await this.generateStudentUsername(student.firstName, student.lastName, student.documentNumber);
    const initialPassword = student.documentNumber; // Contraseña = documento
    const passwordHash = await bcrypt.hash(initialPassword, 10);

    // Generar email si no tiene
    const email = student.email || `${username}@estudiante.local`;

    // Crear usuario
    const user = await this.prisma.user.create({
      data: {
        email,
        username,
        firstName: student.firstName,
        lastName: student.lastName,
        passwordHash,
        documentType: student.documentType as any,
        documentNumber: student.documentNumber,
        phone: student.phone,
        isActive: true,
        mustChangePassword: true,
        roles: {
          create: {
            roleId: estudianteRole.id,
          },
        },
        institutionUsers: {
          create: {
            institutionId: student.institutionId,
            isAdmin: false,
          },
        },
      },
    });

    // Vincular usuario con estudiante
    await this.prisma.student.update({
      where: { id: studentId },
      data: { userId: user.id },
    });

    return {
      studentId,
      userId: user.id,
      username,
      initialPassword,
      message: 'Acceso activado correctamente',
    };
  }

  /**
   * Desactiva acceso al sistema para un estudiante
   */
  async deactivateAccess(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      throw new BadRequestException('Estudiante no encontrado');
    }

    if (!student.userId) {
      throw new BadRequestException('El estudiante no tiene acceso al sistema');
    }

    // Desvincular y eliminar usuario
    await this.prisma.student.update({
      where: { id: studentId },
      data: { userId: null },
    });

    await this.prisma.user.delete({
      where: { id: student.userId },
    });

    return { success: true, message: 'Acceso desactivado' };
  }

  /**
   * Activa acceso masivo para múltiples estudiantes
   */
  async bulkActivateAccess(studentIds: string[]) {
    const results = {
      activated: 0,
      errors: [] as { studentId: string; error: string }[],
    };

    for (const studentId of studentIds) {
      try {
        await this.activateAccess(studentId);
        results.activated++;
      } catch (error: any) {
        results.errors.push({
          studentId,
          error: error.message || 'Error desconocido',
        });
      }
    }

    return results;
  }

  // Generar username para estudiante: primeraLetra + apellido + 4digitos + e
  private async generateStudentUsername(firstName: string, lastName: string, documentNumber: string): Promise<string> {
    const firstLetter = firstName.toLowerCase().charAt(0);
    const cleanLastName = lastName.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '');
    const last4Digits = documentNumber.slice(-4);
    const baseUsername = `${firstLetter}${cleanLastName}${last4Digits}e`;

    let username = baseUsername;
    let counter = 1;

    while (await this.prisma.user.findUnique({ where: { username } })) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    return username;
  }

  /**
   * Elimina estudiantes sin registros académicos (notas, asistencias, observaciones)
   * Solo elimina estudiantes que NO tienen historial
   */
  async bulkDeleteWithoutRecords(institutionId: string) {
    // Obtener todos los estudiantes de la institución
    const students = await this.prisma.student.findMany({
      where: { institutionId },
      include: {
        enrollments: {
          include: {
            grades: { take: 1 },
            attendanceRecords: { take: 1 },
            studentObservations: { take: 1 },
          },
        },
      },
    });

    const studentsToDelete: string[] = [];
    const studentsWithRecords: string[] = [];

    for (const student of students) {
      const hasRecords = student.enrollments.some(
        (e) => e.grades.length > 0 || e.attendanceRecords.length > 0 || e.studentObservations.length > 0
      );

      if (hasRecords) {
        studentsWithRecords.push(student.id);
      } else {
        studentsToDelete.push(student.id);
      }
    }

    console.log(`[bulkDeleteWithoutRecords] Total: ${students.length}, Con registros: ${studentsWithRecords.length}, Sin registros: ${studentsToDelete.length}`);

    if (studentsToDelete.length === 0) {
      return { deleted: 0, skipped: studentsWithRecords.length, message: 'No hay estudiantes sin registros para eliminar' };
    }

    // Eliminar relaciones primero
    await this.prisma.studentEnrollment.deleteMany({
      where: { studentId: { in: studentsToDelete } },
    });
    await this.prisma.studentGuardian.deleteMany({
      where: { studentId: { in: studentsToDelete } },
    });
    await this.prisma.studentDocument.deleteMany({
      where: { studentId: { in: studentsToDelete } },
    });

    // Eliminar estudiantes
    const result = await this.prisma.student.deleteMany({
      where: { id: { in: studentsToDelete } },
    });

    return {
      deleted: result.count,
      skipped: studentsWithRecords.length,
      message: `Eliminados ${result.count} estudiantes sin registros`,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MÉTODOS PARA DOMINIO ACADÉMICO
  // ═══════════════════════════════════════════════════════════════════════════
  // Estos métodos son usados por el módulo académico para obtener estudiantes
  // sin conocer los detalles de implementación de gestión estudiantil.

  /**
   * Obtiene estudiantes para un grupo en un año académico.
   * Retorna solo los datos necesarios para el contexto académico.
   * 
   * Este método es la interfaz que el dominio académico usa para obtener estudiantes.
   * Si cambia la lógica de matrículas, filtros, etc., solo se modifica aquí.
   */
  async getStudentsForAcademicContext(params: {
    groupId: string;
    academicYearId: string;
    institutionId: string;
  }): Promise<Array<{ id: string; name: string; enrollmentId: string; documentNumber?: string }>> {
    const { groupId, academicYearId, institutionId } = params;

    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        groupId,
        academicYearId,
        status: 'ACTIVE',
        student: {
          institutionId,
          isActive: true,
        },
      },
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
      orderBy: {
        student: {
          lastName: 'asc',
        },
      },
    });

    // Mapear a formato académico simple
    return enrollments.map((enrollment) => ({
      id: enrollment.student.id,
      name: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
      enrollmentId: enrollment.id,
      documentNumber: enrollment.student.documentNumber || undefined,
    }));
  }

  /**
   * Obtiene estudiantes para múltiples grupos (útil para reportes académicos)
   */
  async getStudentsForMultipleGroups(params: {
    groupIds: string[];
    academicYearId: string;
    institutionId: string;
  }): Promise<Record<string, Array<{ id: string; name: string; enrollmentId: string; documentNumber?: string }>>> {
    const { groupIds, academicYearId, institutionId } = params;

    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        groupId: { in: groupIds },
        academicYearId,
        status: 'ACTIVE',
        student: {
          institutionId,
          isActive: true,
        },
      },
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
      orderBy: {
        student: {
          lastName: 'asc',
        },
      },
    });

    // Agrupar por groupId
    const result: Record<string, Array<{ id: string; name: string; enrollmentId: string; documentNumber?: string }>> = {};
    for (const enrollment of enrollments) {
      if (!result[enrollment.groupId]) {
        result[enrollment.groupId] = [];
      }
      result[enrollment.groupId].push({
        id: enrollment.student.id,
        name: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
        enrollmentId: enrollment.id,
        documentNumber: enrollment.student.documentNumber || undefined,
      });
    }

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MÉTODOS PARA DOMINIO DE REPORTES
  // ═══════════════════════════════════════════════════════════════════════════
  // Estos métodos son usados por el módulo de Reportes para obtener datos
  // sin conocer los detalles de implementación de gestión estudiantil.

  /**
   * Obtiene una matrícula con todos los detalles necesarios para reportes.
   * Retorna DTO de dominio, NO modelo Prisma.
   */
  async getEnrollmentForReport(enrollmentId: string): Promise<EnrollmentForReport | null> {
    const enrollment = await this.prisma.studentEnrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        student: true,
        group: {
          include: {
            grade: true,
            campus: true,
          },
        },
        academicYear: {
          include: {
            institution: true,
          },
        },
      },
    });

    if (!enrollment) return null;

    // Mapear a DTO de dominio
    return {
      id: enrollment.id,
      status: enrollment.status,
      enrollmentType: enrollment.enrollmentType,
      student: {
        id: enrollment.student.id,
        firstName: enrollment.student.firstName,
        lastName: enrollment.student.lastName,
        documentType: enrollment.student.documentType,
        documentNumber: enrollment.student.documentNumber,
        birthDate: enrollment.student.birthDate,
        gender: enrollment.student.gender,
      },
      group: {
        id: enrollment.group.id,
        name: enrollment.group.name,
        gradeName: enrollment.group.grade.name,
        gradeId: enrollment.group.gradeId,
        campusName: enrollment.group.campus?.name ?? null,
        campusId: enrollment.group.campusId,
      },
      academicYear: {
        id: enrollment.academicYear.id,
        year: enrollment.academicYear.year,
        name: enrollment.academicYear.name,
        institutionId: enrollment.academicYear.institutionId,
        institutionName: enrollment.academicYear.institution.name,
        institutionNit: enrollment.academicYear.institution.nit,
      },
    };
  }

  /**
   * Obtiene matrículas de un grupo para reportes masivos.
   * Retorna DTO de dominio, NO modelo Prisma.
   */
  async getEnrollmentsForGroupReport(params: {
    groupId: string;
    academicYearId: string;
    status?: EnrollmentStatus;
  }): Promise<EnrollmentForGroupList[]> {
    const { groupId, academicYearId, status = EnrollmentStatus.ACTIVE } = params;

    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        groupId,
        academicYearId,
        status,
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

    // Mapear a DTOs de dominio
    return enrollments.map(e => ({
      id: e.id,
      studentId: e.student.id,
      studentName: `${e.student.firstName} ${e.student.lastName}`,
      studentFirstName: e.student.firstName,
      studentLastName: e.student.lastName,
      documentNumber: e.student.documentNumber,
      status: e.status,
      groupId: e.group.id,
      groupName: e.group.name,
      gradeName: e.group.grade.name,
    }));
  }

  /**
   * Obtiene matrículas para reportes MEN (SIMAT, estadísticas).
   * Retorna DTO de dominio, NO modelo Prisma.
   */
  async getEnrollmentsForMenReport(params: {
    academicYearId: string;
    gradeId?: string;
    campusId?: string;
    status?: EnrollmentStatus;
  }): Promise<EnrollmentForMenReport[]> {
    const { academicYearId, gradeId, campusId, status } = params;

    // Construir filtro de grupo dinámicamente
    const groupFilter: { gradeId?: string; campusId?: string } = {};
    if (gradeId) groupFilter.gradeId = gradeId;
    if (campusId) groupFilter.campusId = campusId;

    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        academicYearId,
        ...(Object.keys(groupFilter).length > 0 && { group: groupFilter }),
        ...(status && { status }),
      },
      include: {
        student: true,
        group: {
          include: {
            grade: true,
            campus: true,
          },
        },
      },
      orderBy: {
        student: {
          lastName: 'asc',
        },
      },
    });

    // Mapear a DTOs de dominio
    return enrollments.map(e => ({
      id: e.id,
      status: e.status,
      studentId: e.student.id,
      student: {
        firstName: e.student.firstName,
        lastName: e.student.lastName,
        documentType: e.student.documentType,
        documentNumber: e.student.documentNumber,
        birthDate: e.student.birthDate,
        gender: e.student.gender,
      },
      group: {
        id: e.group.id,
        name: e.group.name,
        gradeName: e.group.grade.name,
        campusName: e.group.campus?.name ?? null,
      },
    }));
  }

  /**
   * Obtiene el snapshot de estructura académica de una matrícula.
   * Retorna DTO de dominio, NO modelo Prisma.
   */
  async getEnrollmentAcademicStructure(enrollmentId: string): Promise<EnrollmentAreaSnapshot[]> {
    const areas = await this.prisma.enrollmentArea.findMany({
      where: { enrollmentId },
      include: {
        enrollmentSubjects: {
          include: { subject: true },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    });

    // Mapear a DTOs de dominio
    return areas.map(area => ({
      id: area.id,
      areaName: area.areaName,
      areaCode: area.areaCode,
      weightPercentage: area.weightPercentage,
      calculationType: area.calculationType,
      subjects: area.enrollmentSubjects.map(es => ({
        id: es.id,
        subjectId: es.subjectId,
        subjectName: es.subjectName,
        subjectCode: es.subjectCode,
        weightPercentage: es.weightPercentage,
        teacherName: es.teacherName,
      })),
    }));
  }

  /**
   * Obtiene observaciones de un estudiante en un rango de fechas.
   * Retorna DTO de dominio, NO modelo Prisma.
   */
  async getStudentObservationsForReport(params: {
    studentEnrollmentId: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<StudentObservationForReport[]> {
    const { studentEnrollmentId, startDate, endDate, limit = 10 } = params;

    const observations = await this.prisma.studentObservation.findMany({
      where: {
        studentEnrollmentId,
        ...(startDate || endDate ? {
          date: {
            ...(startDate && { gte: startDate }),
            ...(endDate && { lte: endDate }),
          },
        } : {}),
      },
      include: {
        author: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { date: 'desc' },
      take: limit,
    });

    // Mapear a DTOs de dominio
    return observations.map(o => ({
      id: o.id,
      date: o.date,
      type: o.type,
      category: o.category,
      description: o.description,
      authorName: `${o.author.firstName} ${o.author.lastName}`,
    }));
  }
}
