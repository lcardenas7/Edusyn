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
          student: {
            include: {
              user: { select: { id: true, username: true, email: true, isActive: true, mustChangePassword: true } },
            },
          },
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
        user: { select: { id: true, username: true, email: true, isActive: true, mustChangePassword: true } },
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
        guardians: {
          include: {
            guardian: { select: { id: true, firstName: true, lastName: true, documentNumber: true, phone: true, email: true } },
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
    const updated = await this.prisma.student.update({
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
        // Diagnóstico educativo
        ...(dto.hasDiagnosis !== undefined && { hasDiagnosis: dto.hasDiagnosis }),
        ...(dto.diagnosisType !== undefined && { diagnosisType: dto.diagnosisType }),
        ...(dto.diagnosisDetails !== undefined && { diagnosisDetails: dto.diagnosisDetails }),
        ...(dto.diagnosisSupports !== undefined && { diagnosisSupports: dto.diagnosisSupports }),
        ...(dto.diagnosisDate !== undefined && { diagnosisDate: dto.diagnosisDate ? new Date(dto.diagnosisDate) : null }),
        ...(dto.diagnosisEntity !== undefined && { diagnosisEntity: dto.diagnosisEntity }),
        // Información adicional
        ...(dto.previousSchool !== undefined && { previousSchool: dto.previousSchool }),
        ...(dto.photo !== undefined && { photo: dto.photo }),
        ...(dto.observations !== undefined && { observations: dto.observations }),
      },
    });

    // Sincronizar perfil APD automáticamente si se marcó hasDiagnosis
    if (dto.hasDiagnosis !== undefined) {
      try {
        await this.syncDiagnosisToApdProfile(updated);
      } catch (err) {
        // No bloquear la actualización del estudiante si falla la sincronización APD
        console.warn('APD profile sync failed (non-blocking):', err?.message || err);
      }
    }

    return updated;
  }

  /**
   * Sincroniza el diagnóstico del estudiante con un perfil APD.
   * Se ejecuta automáticamente al actualizar hasDiagnosis.
   * Usa Prisma directamente para evitar dependencia circular con ApdModule.
   */
  private async syncDiagnosisToApdProfile(student: any) {
    if (!student.hasDiagnosis || !student.institutionId) return null;

    // Verificar si el módulo APD está activo para esta institución
    const institution = await this.prisma.institution.findUnique({
      where: { id: student.institutionId },
      select: { enableDifferentialSupport: true },
    });
    // Solo crear perfil si el módulo APD está habilitado
    if (!institution?.enableDifferentialSupport) return null;

    const existingProfile = await this.prisma.educationalSupportProfile.findUnique({
      where: {
        institutionId_studentId: {
          institutionId: student.institutionId,
          studentId: student.id,
        },
      },
    });

    if (existingProfile) {
      // Actualizar categoría si cambió el tipo de diagnóstico
      if (student.diagnosisType && student.diagnosisType !== existingProfile.supportCategory) {
        return this.prisma.educationalSupportProfile.update({
          where: { id: existingProfile.id },
          data: {
            supportCategory: student.diagnosisType,
            pedagogicalNotes: student.diagnosisDetails || existingProfile.pedagogicalNotes,
            active: true,
          },
        });
      }
      return existingProfile;
    }

    // Crear nuevo perfil
    return this.prisma.educationalSupportProfile.create({
      data: {
        institutionId: student.institutionId,
        studentId: student.id,
        supportCategory: student.diagnosisType || 'Otra condición',
        pedagogicalNotes: student.diagnosisDetails || null,
        active: true,
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
    const student = await this.prisma.student.findUnique({ where: { id: dto.studentId }, select: { institutionId: true } });
    return this.prisma.studentEnrollment.create({
      data: {
        institutionId: student!.institutionId,
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
        // 1. Buscar estudiante existente por documento
        let student = await this.prisma.student.findUnique({
          where: {
            institutionId_documentNumber: {
              institutionId: data.institutionId,
              documentNumber: studentData.documentNumber,
            },
          },
        });

        if (student) {
          // Actualizar estudiante existente (solo datos básicos, no documento)
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
              institutionId: student.institutionId,
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
   * Asegura que la contraseña tenga al menos 6 caracteres
   * Si el documento es más corto, agrega ceros al final
   */
  private ensureMinPasswordLength(document: string): string {
    const minLength = 6;
    if (document.length >= minLength) return document;
    return document.padEnd(minLength, '0');
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
    const initialPassword = this.ensureMinPasswordLength(student.documentNumber); // Contraseña = documento (min 6 chars)
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

  /**
   * Resetea la contraseña de un estudiante a su número de documento
   */
  async resetPassword(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { user: true },
    });

    if (!student) {
      throw new BadRequestException('Estudiante no encontrado');
    }

    if (!student.userId) {
      throw new BadRequestException('El estudiante no tiene acceso al sistema');
    }

    const newPassword = this.ensureMinPasswordLength(student.documentNumber);
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: student.userId },
      data: {
        passwordHash,
        mustChangePassword: true,
      },
    });

    return {
      studentId,
      username: student.user?.username,
      newPassword,
      message: 'Contraseña reseteada correctamente',
    };
  }

  /**
   * Resetea contraseñas masivamente para múltiples estudiantes
   */
  async bulkResetPassword(studentIds: string[]) {
    const results = {
      reset: 0,
      errors: [] as { studentId: string; error: string }[],
    };

    for (const studentId of studentIds) {
      try {
        await this.resetPassword(studentId);
        results.reset++;
      } catch (error: any) {
        results.errors.push({
          studentId,
          error: error.message || 'Error desconocido',
        });
      }
    }

    return results;
  }

  /**
   * Regenera credenciales (username + password) de estudiantes sin acceso activo.
   * Solo afecta estudiantes que nunca han iniciado sesión (mustChangePassword=true).
   * Útil cuando se actualizaron documentos pero los usernames quedaron con datos viejos.
   */
  async bulkRegenerateCredentials(studentIds: string[]) {
    const results = {
      regenerated: 0,
      skipped: 0,
      errors: [] as { studentId: string; error: string }[],
    };

    // Obtener estudiantes con su información de usuario
    const students = await this.prisma.student.findMany({
      where: { id: { in: studentIds } },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            mustChangePassword: true,
          },
        },
      },
    });

    for (const student of students) {
      try {
        // Si no tiene usuario, saltar
        if (!student.userId || !student.user) {
          results.errors.push({
            studentId: student.id,
            error: 'El estudiante no tiene usuario creado',
          });
          continue;
        }

        // Si ya tiene acceso activo (ya inició sesión), saltar para no romper su acceso
        if (!student.user.mustChangePassword) {
          results.skipped++;
          continue;
        }

        // Regenerar username y contraseña
        const newUsername = await this.generateStudentUsername(
          student.firstName,
          student.lastName,
          student.documentNumber,
        );
        const newPassword = this.ensureMinPasswordLength(student.documentNumber);
        const passwordHash = await bcrypt.hash(newPassword, 10);

        await this.prisma.user.update({
          where: { id: student.userId },
          data: {
            username: newUsername,
            passwordHash,
            mustChangePassword: true,
          },
        });

        results.regenerated++;
      } catch (error: any) {
        results.errors.push({
          studentId: student.id,
          error: error.message || 'Error desconocido',
        });
      }
    }

    return results;
  }

  /**
   * Obtiene las credenciales de estudiantes de una institución
   * Retorna solo estudiantes que tienen acceso al sistema (userId != null)
   */
  async getCredentials(institutionId: string) {
    const students = await this.prisma.student.findMany({
      where: {
        institutionId,
        isActive: true,
        userId: { not: null },
      },
      include: {
        user: { select: { id: true, username: true, email: true, isActive: true, mustChangePassword: true } },
        enrollments: {
          include: {
            group: { include: { grade: true } },
            academicYear: true,
          },
          orderBy: { academicYear: { year: 'desc' } },
          take: 1,
        },
      },
      orderBy: { lastName: 'asc' },
    });

    return students.map(s => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      documentNumber: s.documentNumber,
      userId: s.userId,
      username: s.user?.username,
      email: s.user?.email,
      userIsActive: s.user?.isActive,
      mustChangePassword: s.user?.mustChangePassword,
      group: s.enrollments?.[0]?.group ? `${s.enrollments[0].group.grade?.name || ''} ${s.enrollments[0].group.name}`.trim() : '',
      initialPassword: s.documentNumber,
    }));
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
  }): Promise<Array<{ id: string; name: string; enrollmentId: string; documentNumber?: string; hasDiagnosis: boolean; diagnosisType?: string; hasSupportProfile: boolean }>> {
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
            secondName: true,
            lastName: true,
            secondLastName: true,
            documentNumber: true,
            hasDiagnosis: true,
            diagnosisType: true,
            educationalSupportProfiles: {
              where: { active: true },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
      orderBy: {
        student: {
          lastName: 'asc',
        },
      },
    });

    // Mapear a formato académico simple (nombre completo: apellido1 apellido2 nombre1 nombre2)
    return enrollments.map((enrollment) => ({
      id: enrollment.student.id,
      name: [
        enrollment.student.lastName,
        enrollment.student.secondLastName,
        enrollment.student.firstName,
        enrollment.student.secondName,
      ].filter(Boolean).join(' '),
      enrollmentId: enrollment.id,
      documentNumber: enrollment.student.documentNumber || undefined,
      hasDiagnosis: enrollment.student.hasDiagnosis || false,
      diagnosisType: enrollment.student.diagnosisType || undefined,
      hasSupportProfile: (enrollment.student as any).educationalSupportProfiles?.length > 0,
    }));
  }

  /**
   * Obtiene estudiantes para múltiples grupos (útil para reportes académicos)
   */
  async getStudentsForMultipleGroups(params: {
    groupIds: string[];
    academicYearId: string;
    institutionId: string;
  }): Promise<Record<string, Array<{ id: string; name: string; enrollmentId: string; documentNumber?: string; hasDiagnosis: boolean; diagnosisType?: string; hasSupportProfile: boolean }>>> {
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
            secondName: true,
            lastName: true,
            secondLastName: true,
            documentNumber: true,
            hasDiagnosis: true,
            diagnosisType: true,
            educationalSupportProfiles: {
              where: { active: true },
              select: { id: true },
              take: 1,
            },
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
    const result: Record<string, Array<{ id: string; name: string; enrollmentId: string; documentNumber?: string; hasDiagnosis: boolean; diagnosisType?: string; hasSupportProfile: boolean }>> = {};
    for (const enrollment of enrollments) {
      if (!result[enrollment.groupId]) {
        result[enrollment.groupId] = [];
      }
      result[enrollment.groupId].push({
        id: enrollment.student.id,
        name: [
          enrollment.student.lastName,
          enrollment.student.secondLastName,
          enrollment.student.firstName,
          enrollment.student.secondName,
        ].filter(Boolean).join(' '),
        enrollmentId: enrollment.id,
        documentNumber: enrollment.student.documentNumber || undefined,
        hasDiagnosis: enrollment.student.hasDiagnosis || false,
        diagnosisType: enrollment.student.diagnosisType || undefined,
        hasSupportProfile: (enrollment.student as any).educationalSupportProfiles?.length > 0,
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
        secondName: enrollment.student.secondName,
        lastName: enrollment.student.lastName,
        secondLastName: enrollment.student.secondLastName,
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
      studentName: [e.student.lastName, e.student.secondLastName, e.student.firstName, e.student.secondName].filter(Boolean).join(' '),
      studentFirstName: e.student.firstName,
      studentSecondName: e.student.secondName || '',
      studentLastName: e.student.lastName,
      studentSecondLastName: e.student.secondLastName || '',
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

  // ═══════════════════════════════════════════════════════════════════════════
  // BULK UPDATE (Actualización Masiva Segura)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Exporta estudiantes con system_id para actualización masiva.
   * El system_id es el id interno inmutable que se usa como ancla.
   * Permite filtrar por grupo y año académico.
   */
  async getStudentsForBulkUpdate(institutionId: string, filters?: { groupId?: string; academicYearId?: string }) {
    // Si hay filtro de grupo, obtener estudiantes por matrícula
    let studentIds: string[] | undefined;
    let enrollmentMap: Map<string, { gradeName: string; groupName: string }> | undefined;

    if (filters?.groupId || filters?.academicYearId) {
      const enrollments = await this.prisma.studentEnrollment.findMany({
        where: {
          ...(filters.groupId && { groupId: filters.groupId }),
          ...(filters.academicYearId && { academicYearId: filters.academicYearId }),
          student: { institutionId, isActive: true },
        },
        select: {
          studentId: true,
          group: {
            select: {
              name: true,
              grade: { select: { name: true } },
            },
          },
        },
      });
      studentIds = enrollments.map(e => e.studentId);
      enrollmentMap = new Map(enrollments.map(e => [
        e.studentId,
        { gradeName: e.group.grade.name, groupName: e.group.name },
      ]));
    }

    const students = await this.prisma.student.findMany({
      where: {
        institutionId,
        isActive: true,
        ...(studentIds && { id: { in: studentIds } }),
      },
      select: {
        id: true,
        documentType: true,
        documentNumber: true,
        firstName: true,
        secondName: true,
        lastName: true,
        secondLastName: true,
        birthDate: true,
        birthPlace: true,
        gender: true,
        email: true,
        phone: true,
        address: true,
        neighborhood: true,
        city: true,
        bloodType: true,
        eps: true,
        stratum: true,
        ethnicity: true,
        disability: true,
        emergencyContact: true,
        emergencyPhone: true,
        enrollments: {
          where: filters?.academicYearId ? { academicYearId: filters.academicYearId } : {},
          select: {
            group: {
              select: {
                name: true,
                grade: { select: { name: true } },
              },
            },
          },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return students.map(s => {
      // Usar enrollmentMap si existe (filtro por grupo), sino usar la matrícula más reciente
      const groupInfo = enrollmentMap?.get(s.id) || (s.enrollments[0]?.group ? {
        gradeName: s.enrollments[0].group.grade.name,
        groupName: s.enrollments[0].group.name,
      } : null);

      // Formato simplificado: mismas columnas que la plantilla de importación + system_id
      return {
        system_id: s.id, // Columna inmutable para identificación (NO MODIFICAR)
        Grupo: groupInfo ? `${groupInfo.gradeName} ${groupInfo.groupName}` : '', // Solo lectura
        'Tipo Documento': s.documentType,
        'Numero Documento': s.documentNumber,
        'Primer Nombre': s.firstName,
        'Segundo Nombre': s.secondName || '',
        'Primer Apellido': s.lastName,
        'Segundo Apellido': s.secondLastName || '',
        'Fecha Nacimiento': s.birthDate ? s.birthDate.toISOString().split('T')[0] : '',
        Genero: s.gender || '',
        Direccion: s.address || '',
        Telefono: s.phone || '',
        Email: s.email || '',
        EPS: s.eps || '',
        'Tipo Sangre': s.bloodType || '',
      };
    });
  }

  /**
   * Valida y ejecuta actualización masiva de estudiantes.
   * Usa system_id (id interno) como identificador inmutable.
   * Permite cambiar cualquier dato incluyendo documento.
   */
  async bulkUpdateStudents(
    institutionId: string,
    rows: Array<{
      system_id: string;
      document_type?: string | number;
      document_number?: string | number;
      first_name?: string;
      second_name?: string;
      last_name?: string;
      second_last_name?: string;
      birth_date?: string;
      birth_place?: string;
      gender?: string;
      email?: string;
      phone?: string | number;
      address?: string;
      neighborhood?: string;
      city?: string;
      blood_type?: string;
      eps?: string;
      stratum?: number | string;
      ethnicity?: string;
      disability?: string;
      emergency_contact?: string;
      emergency_phone?: string | number;
    }>,
    previewOnly: boolean = false,
  ) {
    const errors: Array<{ row: number; field: string; message: string }> = [];
    const updates: Array<{ systemId: string; changes: Record<string, { old: any; new: any }> }> = [];

    // Helper: convertir valor de fecha (puede ser número Excel o string) a string YYYY-MM-DD
    const parseExcelDateToString = (value: any): string | undefined => {
      if (!value) return undefined;
      let date: Date;
      // Si es número, es un serial de Excel (días desde 1900-01-01)
      if (typeof value === 'number') {
        // Excel usa 1900-01-01 como día 1, ajuste para timestamp Unix
        const unixDays = value - 25569;
        date = new Date(unixDays * 86400 * 1000);
      } else {
        date = new Date(value);
      }
      if (isNaN(date.getTime())) return undefined;
      return date.toISOString().split('T')[0];
    };

    // 0. Normalizar datos de Excel (soporta nombres en inglés snake_case y español)
    const normalizedRows = rows.map((row: any) => {
      // Mapear nombres en español a inglés snake_case
      const getValue = (enKey: string, esKey: string) => row[enKey] ?? row[esKey];
      
      return {
        system_id: String(row.system_id || '').trim(),
        document_type: getValue('document_type', 'Tipo Documento') != null ? String(getValue('document_type', 'Tipo Documento')).trim() : undefined,
        document_number: getValue('document_number', 'Numero Documento') != null ? String(getValue('document_number', 'Numero Documento')).trim() : undefined,
        first_name: getValue('first_name', 'Primer Nombre') || undefined,
        second_name: getValue('second_name', 'Segundo Nombre') || undefined,
        last_name: getValue('last_name', 'Primer Apellido') || undefined,
        second_last_name: getValue('second_last_name', 'Segundo Apellido') || undefined,
        birth_date: parseExcelDateToString(getValue('birth_date', 'Fecha Nacimiento')),
        gender: getValue('gender', 'Genero') || undefined,
        address: getValue('address', 'Direccion') || undefined,
        phone: getValue('phone', 'Telefono') != null ? String(getValue('phone', 'Telefono')).trim() : undefined,
        email: getValue('email', 'Email') || undefined,
        blood_type: getValue('blood_type', 'Tipo Sangre') || undefined,
        eps: getValue('eps', 'EPS') || undefined,
        // Campos adicionales (solo inglés, para compatibilidad)
        birth_place: row.birth_place || undefined,
        neighborhood: row.neighborhood || undefined,
        city: row.city || undefined,
        stratum: row.stratum != null ? (typeof row.stratum === 'number' ? row.stratum : parseInt(String(row.stratum), 10) || undefined) : undefined,
        ethnicity: row.ethnicity || undefined,
        disability: row.disability || undefined,
        emergency_contact: row.emergency_contact || undefined,
        emergency_phone: row.emergency_phone != null ? String(row.emergency_phone).trim() : undefined,
      };
    });

    // 1. Extraer todos los system_ids del archivo
    const systemIds = normalizedRows.map(r => r.system_id).filter(Boolean);
    
    // Validar que no haya system_ids duplicados en el archivo
    const duplicateIds = systemIds.filter((id, idx) => systemIds.indexOf(id) !== idx);
    if (duplicateIds.length > 0) {
      errors.push({ row: 0, field: 'system_id', message: `IDs duplicados en archivo: ${[...new Set(duplicateIds)].join(', ')}` });
      return { success: false, errors, updates: [], summary: { total: 0, updated: 0, errors: errors.length } };
    }

    // 2. Obtener estudiantes existentes por system_id (1 query)
    const existingStudents = await this.prisma.student.findMany({
      where: { id: { in: systemIds }, institutionId },
      select: {
        id: true,
        documentType: true,
        documentNumber: true,
        firstName: true,
        secondName: true,
        lastName: true,
        secondLastName: true,
        birthDate: true,
        birthPlace: true,
        gender: true,
        email: true,
        phone: true,
        address: true,
        neighborhood: true,
        city: true,
        bloodType: true,
        eps: true,
        stratum: true,
        ethnicity: true,
        disability: true,
        emergencyContact: true,
        emergencyPhone: true,
        // Para actualización de credenciales
        userId: true,
        user: {
          select: {
            id: true,
            username: true,
            mustChangePassword: true,
          },
        },
      },
    });
    const existingMap = new Map(existingStudents.map(s => [s.id, s]));

    // 3. Validar que todos los system_ids existan
    for (let i = 0; i < normalizedRows.length; i++) {
      const row = normalizedRows[i];
      if (!row.system_id) {
        errors.push({ row: i + 2, field: 'system_id', message: 'system_id es requerido' });
        continue;
      }
      if (!existingMap.has(row.system_id)) {
        errors.push({ row: i + 2, field: 'system_id', message: `Estudiante no encontrado: ${row.system_id}` });
      }
    }

    // 4. Extraer documentos nuevos para validar conflictos
    const newDocNumbers = normalizedRows
      .filter(r => r.document_number && existingMap.has(r.system_id))
      .filter(r => r.document_number !== existingMap.get(r.system_id)?.documentNumber)
      .map(r => String(r.document_number));

    // 5. Verificar conflictos de documentos (1 query)
    if (newDocNumbers.length > 0) {
      const conflicts = await this.prisma.student.findMany({
        where: {
          institutionId,
          documentNumber: { in: newDocNumbers },
          id: { notIn: systemIds },
        },
        select: { id: true, documentNumber: true, firstName: true, lastName: true },
      });

      if (conflicts.length > 0) {
        for (const conflict of conflicts) {
          const rowIdx = normalizedRows.findIndex(r => r.document_number === conflict.documentNumber);
          errors.push({
            row: rowIdx + 2,
            field: 'document_number',
            message: `Documento ${conflict.documentNumber} ya existe para ${conflict.firstName} ${conflict.lastName}`,
          });
        }
      }
    }

    // 6. Calcular cambios (diff)
    for (let i = 0; i < normalizedRows.length; i++) {
      const row = normalizedRows[i];
      const existing = existingMap.get(row.system_id);
      if (!existing) continue;

      const changes: Record<string, { old: any; new: any }> = {};

      const checkField = (field: string, oldVal: any, newVal: any) => {
        const normalizedOld = oldVal ?? '';
        const normalizedNew = newVal ?? '';
        if (String(normalizedOld) !== String(normalizedNew) && normalizedNew !== '') {
          changes[field] = { old: normalizedOld, new: normalizedNew };
        }
      };

      checkField('documentType', existing.documentType, row.document_type);
      checkField('documentNumber', existing.documentNumber, row.document_number);
      checkField('firstName', existing.firstName, row.first_name);
      checkField('secondName', existing.secondName, row.second_name);
      checkField('lastName', existing.lastName, row.last_name);
      checkField('secondLastName', existing.secondLastName, row.second_last_name);
      checkField('birthPlace', existing.birthPlace, row.birth_place);
      checkField('gender', existing.gender, row.gender);
      checkField('email', existing.email, row.email);
      checkField('phone', existing.phone, row.phone);
      checkField('address', existing.address, row.address);
      checkField('neighborhood', existing.neighborhood, row.neighborhood);
      checkField('city', existing.city, row.city);
      checkField('bloodType', existing.bloodType, row.blood_type);
      checkField('eps', existing.eps, row.eps);
      checkField('stratum', existing.stratum, row.stratum);
      checkField('ethnicity', existing.ethnicity, row.ethnicity);
      checkField('disability', existing.disability, row.disability);
      checkField('emergencyContact', existing.emergencyContact, row.emergency_contact);
      checkField('emergencyPhone', existing.emergencyPhone, row.emergency_phone);

      // Fecha de nacimiento (comparar solo fecha)
      const existingBirth = existing.birthDate ? existing.birthDate.toISOString().split('T')[0] : '';
      if (row.birth_date && row.birth_date !== existingBirth) {
        changes['birthDate'] = { old: existingBirth, new: row.birth_date };
      }

      if (Object.keys(changes).length > 0) {
        updates.push({ systemId: row.system_id, changes });
      }
    }

    // Si hay errores, retornar sin ejecutar
    if (errors.length > 0) {
      return {
        success: false,
        errors,
        updates,
        summary: { total: rows.length, updated: 0, errors: errors.length },
      };
    }

    // Si es solo preview, retornar sin ejecutar
    if (previewOnly) {
      return {
        success: true,
        errors: [],
        updates,
        summary: { total: rows.length, toUpdate: updates.length, errors: 0 },
      };
    }

    // 7. Ejecutar actualizaciones en transacción
    let updatedCount = 0;
    let credentialsUpdated = 0;
    
    await this.prisma.$transaction(async (tx) => {
      for (const update of updates) {
        const existing = existingMap.get(update.systemId);
        if (!existing) continue;

        const data: Record<string, any> = {};
        let newDocumentNumber: string | null = null;
        let newFirstName: string | null = null;
        let newLastName: string | null = null;

        for (const [field, change] of Object.entries(update.changes)) {
          if (field === 'birthDate') {
            // birth_date ya viene normalizada como string YYYY-MM-DD
            const date = new Date(change.new);
            if (!isNaN(date.getTime())) {
              data[field] = date;
            }
            // Si no es válida, simplemente no actualizamos ese campo
          } else if (field === 'stratum') {
            data[field] = change.new ? parseInt(String(change.new), 10) : null;
          } else {
            data[field] = change.new || null;
          }

          // Capturar cambios relevantes para credenciales
          if (field === 'documentNumber') newDocumentNumber = change.new;
          if (field === 'firstName') newFirstName = change.new;
          if (field === 'lastName') newLastName = change.new;
        }

        // Actualizar estudiante
        await tx.student.update({
          where: { id: update.systemId },
          data,
        });
        updatedCount++;

        // Si cambió el documento y el estudiante tiene usuario, actualizar credenciales
        if (newDocumentNumber && existing.userId && existing.user) {
          const hasActiveAccess = !existing.user.mustChangePassword; // Ya inició sesión si cambió contraseña
          
          if (hasActiveAccess) {
            // Solo actualizar contraseña (mantener username para no romper acceso)
            const newPassword = this.ensureMinPasswordLength(newDocumentNumber);
            const passwordHash = await bcrypt.hash(newPassword, 10);
            await tx.user.update({
              where: { id: existing.userId },
              data: { 
                passwordHash,
                mustChangePassword: true, // Forzar cambio en próximo login
              },
            });
          } else {
            // Regenerar username y contraseña (nunca ha iniciado sesión)
            const firstName = newFirstName || existing.firstName;
            const lastName = newLastName || existing.lastName;
            const newUsername = await this.generateStudentUsername(firstName, lastName, newDocumentNumber);
            const newPassword = this.ensureMinPasswordLength(newDocumentNumber);
            const passwordHash = await bcrypt.hash(newPassword, 10);
            
            await tx.user.update({
              where: { id: existing.userId },
              data: {
                username: newUsername,
                passwordHash,
                mustChangePassword: true,
              },
            });
          }
          credentialsUpdated++;
        }
      }
    });

    return {
      success: true,
      errors: [],
      updates,
      summary: { 
        total: rows.length, 
        updated: updatedCount, 
        credentialsUpdated,
        errors: 0 
      },
    };
  }
}
