import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EnrollmentStatus, EnrollmentType, EnrollmentEventType, EnrollmentMovementType, SchoolShift, StudyModality, Prisma } from '@prisma/client';
import { AcademicYearLifecycleService } from './academic-year-lifecycle.service';
import { TemplatesService } from './templates.service';

// DTOs
export interface EnrollStudentDto {
  studentId: string;
  academicYearId: string;
  groupId: string;
  enrollmentType?: EnrollmentType;
  shift?: SchoolShift;
  modality?: StudyModality;
  observations?: string;
  enrolledById: string;
}

export interface WithdrawStudentDto {
  enrollmentId: string;
  reason: string;
  observations?: string;
  performedById: string;
}

export interface TransferStudentDto {
  enrollmentId: string;
  reason: string;
  destinationInstitution?: string;
  observations?: string;
  performedById: string;
}

export interface ChangeGroupDto {
  enrollmentId: string;
  newGroupId: string;
  reason: string;
  movementType: EnrollmentMovementType;
  observations?: string;
  performedById: string;
}

export interface ReactivateStudentDto {
  enrollmentId: string;
  reason: string;
  observations?: string;
  performedById: string;
}

export interface EnrollmentFilters {
  academicYearId?: string;
  gradeId?: string;
  groupId?: string;
  status?: EnrollmentStatus;
  search?: string;
}

// DTO para crear estudiante + matrícula en un solo flujo
export interface CreateStudentAndEnrollDto {
  // Datos del estudiante
  institutionId: string;
  documentType: string;
  documentNumber: string;
  firstName: string;
  secondName?: string;
  lastName: string;
  secondLastName?: string;
  birthDate?: string;
  birthPlace?: string;
  gender?: string;
  email?: string;
  phone?: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  // Información médica
  bloodType?: string;
  eps?: string;
  allergies?: string;
  medicalConditions?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  // Información socioeconómica
  stratum?: number;
  sisbenLevel?: string;
  ethnicity?: string;
  displacement?: boolean;
  disability?: string;
  previousSchool?: string;
  // Datos de matrícula
  academicYearId: string;
  groupId: string;
  enrollmentType?: EnrollmentType;
  shift?: SchoolShift;
  modality?: StudyModality;
  observations?: string;
  enrolledById: string;
}

@Injectable()
export class EnrollmentService {
  constructor(
    private prisma: PrismaService,
    private yearLifecycleService: AcademicYearLifecycleService,
    private templatesService: TemplatesService,
  ) {}

  private transactional = false;

  /** Keep every write in a movement, including its audit and snapshot, on one client. */
  forTransaction(tx: Prisma.TransactionClient): EnrollmentService {
    const service = new EnrollmentService(tx as PrismaService, this.yearLifecycleService, new TemplatesService(tx as PrismaService));
    service.transactional = true;
    return service;
  }

  private runTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    if (this.transactional) return operation(this.prisma);
    return this.prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 });
  }

  private assertInstitution(institutionId: string) {
    if (!institutionId) throw new NotFoundException('Institución no encontrada');
  }

  private async assertYearInScope(id: string, institutionId: string) {
    this.assertInstitution(institutionId);
    const year = await this.prisma.academicYear.findFirst({ where: { id, institutionId }, select: { id: true, status: true } });
    if (!year) throw new NotFoundException('Año lectivo no encontrado');
    return year;
  }

  private async assertStudentInScope(id: string, institutionId: string) {
    this.assertInstitution(institutionId);
    const student = await this.prisma.student.findFirst({ where: { id, institutionId }, select: { id: true } });
    if (!student) throw new NotFoundException('Estudiante no encontrado');
    return student;
  }

  private async assertGroupInScope(id: string, institutionId: string) {
    this.assertInstitution(institutionId);
    const group = await this.prisma.group.findFirst({ where: { id, campus: { institutionId }, grade: { institutionId } }, select: { id: true, gradeId: true } });
    if (!group) throw new NotFoundException('Grupo no encontrado');
    return group;
  }

  private async assertEnrollmentInScope(id: string, institutionId: string) {
    this.assertInstitution(institutionId);
    const enrollment = await this.prisma.studentEnrollment.findFirst({ where: { id, institutionId }, select: { id: true, groupId: true, academicYearId: true } });
    if (!enrollment) throw new NotFoundException('Matrícula no encontrada');
    return enrollment;
  }

  private async assertFiltersInScope(filters: EnrollmentFilters, institutionId: string) {
    this.assertInstitution(institutionId);
    if (filters.academicYearId) await this.assertYearInScope(filters.academicYearId, institutionId);
    if (filters.groupId) await this.assertGroupInScope(filters.groupId, institutionId);
    if (filters.gradeId && !await this.prisma.grade.findFirst({ where: { id: filters.gradeId, institutionId }, select: { id: true } })) {
      throw new NotFoundException('Grado no encontrado');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MATRICULAR ESTUDIANTE
  // ═══════════════════════════════════════════════════════════════════════════

  async enrollStudent(dto: EnrollStudentDto, institutionId: string) {
    await this.assertStudentInScope(dto.studentId, institutionId);
    await this.assertYearInScope(dto.academicYearId, institutionId);
    await this.assertGroupInScope(dto.groupId, institutionId);
    return this.runTransaction(tx => this.forTransaction(tx).enrollStudentInTransaction(dto, institutionId));
  }

  private async enrollStudentInTransaction(dto: EnrollStudentDto, institutionId: string) {
    await this.assertStudentInScope(dto.studentId, institutionId);
    await this.assertGroupInScope(dto.groupId, institutionId);
    // Validar que el año permita matrículas
    const canEnroll = (await this.assertYearInScope(dto.academicYearId, institutionId)).status === 'ACTIVE';
    if (!canEnroll) {
      throw new ForbiddenException('El año lectivo no permite matrículas en su estado actual');
    }

    // Verificar que el estudiante no esté ya matriculado en este año
    const existingEnrollment = await this.prisma.studentEnrollment.findFirst({
      where: {
        institutionId, studentId: dto.studentId, academicYearId: dto.academicYearId,
      },
    });

    if (existingEnrollment) {
      throw new BadRequestException('El estudiante ya está matriculado en este año lectivo');
    }

    // Verificar que el grupo exista
    const group = await this.prisma.group.findFirst({
      where: { id: dto.groupId, campus: { institutionId }, grade: { institutionId } },
      include: { 
        grade: true,
        _count: {
          select: {
            studentEnrollments: {
              where: {
                institutionId,
                academicYearId: dto.academicYearId,
                status: 'ACTIVE',
              },
            },
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Grupo no encontrado');
    }

    // Validar cupo disponible
    if (group.maxCapacity !== null) {
      const currentEnrollments = group._count.studentEnrollments;
      if (currentEnrollments >= group.maxCapacity) {
        throw new BadRequestException(
          `El grupo ${group.name} ha alcanzado su cupo máximo (${group.maxCapacity} estudiantes)`
        );
      }
    }

    // Obtener institutionId del estudiante
    const student = await this.prisma.student.findFirst({ where: { id: dto.studentId, institutionId }, select: { id: true } });
    if (!student) throw new NotFoundException('Estudiante no encontrado');

    // Crear la matrícula
    const enrollment = await this.prisma.studentEnrollment.create({
      data: {
        institutionId,
        studentId: dto.studentId,
        academicYearId: dto.academicYearId,
        groupId: dto.groupId,
        enrollmentType: dto.enrollmentType || 'NEW',
        status: 'ACTIVE',
        shift: dto.shift,
        modality: dto.modality || 'PRESENTIAL',
        observations: dto.observations,
        enrolledById: dto.enrolledById,
      },
      include: {
        student: true,
        group: {
          include: {
            grade: true,
            campus: true,
          },
        },
        academicYear: true,
      },
    });

    // Crear evento de auditoría
    await this.createEnrollmentEvent({
      enrollmentId: enrollment.id,
      type: 'CREATED',
      newValue: {
        groupId: dto.groupId,
        enrollmentType: dto.enrollmentType || 'NEW',
        shift: dto.shift,
        modality: dto.modality || 'PRESENTIAL',
      },
      reason: 'Matrícula inicial',
      observations: dto.observations,
      performedById: dto.enrolledById,
    }, institutionId);

    // 🔥 SNAPSHOT: Copiar estructura académica al momento de matrícula
    await this.createAcademicSnapshot(enrollment.id, dto.groupId, dto.academicYearId, institutionId);

    return enrollment;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CREAR ESTUDIANTE Y MATRICULAR (FLUJO UNIFICADO)
  // ═══════════════════════════════════════════════════════════════════════════

  async createStudentAndEnroll(dto: CreateStudentAndEnrollDto, institutionId: string) {
    await this.assertYearInScope(dto.academicYearId, institutionId);
    await this.assertGroupInScope(dto.groupId, institutionId);
    return this.runTransaction(tx => this.forTransaction(tx).createStudentAndEnrollInTransaction(dto, institutionId));
  }

  private async createStudentAndEnrollInTransaction(dto: CreateStudentAndEnrollDto, institutionId: string) {
    dto = { ...dto, institutionId };
    await this.assertGroupInScope(dto.groupId, institutionId);
    // Validar que el año permita matrículas
    const canEnroll = (await this.assertYearInScope(dto.academicYearId, institutionId)).status === 'ACTIVE';
    if (!canEnroll) {
      throw new ForbiddenException('El año lectivo no permite matrículas en su estado actual');
    }

    // Verificar si el estudiante ya existe por documento
    const existingStudent = await this.prisma.student.findUnique({
      where: {
        institutionId_documentNumber: {
          institutionId: dto.institutionId,
          documentNumber: dto.documentNumber,
        },
      },
    });

    if (existingStudent) {
      // Verificar si ya está matriculado en este año
      const existingEnrollment = await this.prisma.studentEnrollment.findFirst({
        where: {
          institutionId, studentId: existingStudent.id, academicYearId: dto.academicYearId,
        },
      });

      if (existingEnrollment) {
        throw new BadRequestException(
          `El estudiante con documento ${dto.documentNumber} ya está matriculado en este año lectivo`
        );
      }

      // Matricular estudiante existente
      return this.enrollStudent({
        studentId: existingStudent.id,
        academicYearId: dto.academicYearId,
        groupId: dto.groupId,
        enrollmentType: dto.enrollmentType || 'RENEWAL',
        shift: dto.shift,
        modality: dto.modality,
        observations: dto.observations,
        enrolledById: dto.enrolledById,
      }, institutionId);
    }

    // Verificar cupo del grupo
    const group = await this.prisma.group.findFirst({
      where: { id: dto.groupId, campus: { institutionId }, grade: { institutionId } },
      include: {
        grade: true,
        _count: {
          select: {
            studentEnrollments: {
              where: {
                institutionId,
                academicYearId: dto.academicYearId,
                status: 'ACTIVE',
              },
            },
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Grupo no encontrado');
    }

    if (group.maxCapacity !== null) {
      const currentEnrollments = group._count.studentEnrollments;
      if (currentEnrollments >= group.maxCapacity) {
        throw new BadRequestException(
          `El grupo ${group.name} ha alcanzado su cupo máximo (${group.maxCapacity} estudiantes)`
        );
      }
    }

    // Crear estudiante y matrícula en transacción
    const result = await this.runTransaction(async (tx) => {
      // Crear estudiante
      const student = await tx.student.create({
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
          bloodType: dto.bloodType,
          eps: dto.eps,
          allergies: dto.allergies,
          medicalConditions: dto.medicalConditions,
          emergencyContact: dto.emergencyContact,
          emergencyPhone: dto.emergencyPhone,
          stratum: dto.stratum,
          sisbenLevel: dto.sisbenLevel,
          ethnicity: dto.ethnicity,
          displacement: dto.displacement || false,
          disability: dto.disability,
          previousSchool: dto.previousSchool,
        },
      });

      // Crear matrícula
      const enrollment = await tx.studentEnrollment.create({
        data: {
          institutionId: dto.institutionId,
          studentId: student.id,
          academicYearId: dto.academicYearId,
          groupId: dto.groupId,
          enrollmentType: dto.enrollmentType || 'NEW',
          status: 'ACTIVE',
          shift: dto.shift,
          modality: dto.modality || 'PRESENTIAL',
          observations: dto.observations,
          enrolledById: dto.enrolledById,
        },
        include: {
          student: true,
          group: {
            include: {
              grade: true,
              campus: true,
            },
          },
          academicYear: true,
        },
      });

      // Crear evento de auditoría
      await tx.enrollmentEvent.create({
        data: {
          institutionId: dto.institutionId,
          enrollmentId: enrollment.id,
          type: 'CREATED',
          newValue: {
            groupId: dto.groupId,
            enrollmentType: dto.enrollmentType || 'NEW',
            shift: dto.shift,
            modality: dto.modality || 'PRESENTIAL',
            studentCreated: true,
          },
          reason: 'Matrícula inicial con creación de estudiante',
          observations: dto.observations,
          performedById: dto.enrolledById,
        },
      });

      return enrollment;
    });

    // 🔥 SNAPSHOT: Copiar estructura académica al momento de matrícula
    await this.createAcademicSnapshot(result.id, dto.groupId, dto.academicYearId, institutionId);

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUSCAR ESTUDIANTE POR DOCUMENTO (para verificar si existe antes de matricular)
  // ═══════════════════════════════════════════════════════════════════════════

  async findStudentByDocument(institutionId: string, documentNumber: string) {
    this.assertInstitution(institutionId);
    const student = await this.prisma.student.findUnique({
      where: {
        institutionId_documentNumber: {
          institutionId,
          documentNumber,
        },
      },
      include: {
        enrollments: {
          where: { institutionId },
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
          take: 3,
        },
        guardians: {
          include: {
            guardian: true,
          },
        },
      },
    });

    return student;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RETIRAR ESTUDIANTE
  // ═══════════════════════════════════════════════════════════════════════════

  async withdrawStudent(dto: WithdrawStudentDto, institutionId: string) {
    await this.assertEnrollmentInScope(dto.enrollmentId, institutionId);
    return this.runTransaction(tx => this.forTransaction(tx).withdrawStudentInTransaction(dto, institutionId));
  }

  private async withdrawStudentInTransaction(dto: WithdrawStudentDto, institutionId: string) {
    const enrollment = await this.getEnrollmentById(dto.enrollmentId, institutionId);

    // Validar que el año permita modificaciones
    const canModify = (await this.assertYearInScope(enrollment.academicYearId, institutionId)).status !== 'CLOSED';
    if (!canModify) {
      throw new ForbiddenException('El año lectivo no permite modificaciones');
    }

    // Validar que la matrícula esté activa
    if (enrollment.status !== 'ACTIVE') {
      throw new BadRequestException(`No se puede retirar una matrícula en estado ${enrollment.status}`);
    }

    // Actualizar la matrícula
    const updatedEnrollment = await this.prisma.studentEnrollment.update({
      where: { id: dto.enrollmentId, institutionId },
      data: {
        status: 'WITHDRAWN',
        withdrawalDate: new Date(),
        withdrawalReason: dto.reason,
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

    // Crear evento de auditoría
    await this.createEnrollmentEvent({
      enrollmentId: dto.enrollmentId,
      type: 'WITHDRAWN',
      previousValue: { status: 'ACTIVE' },
      newValue: { status: 'WITHDRAWN', withdrawalDate: new Date() },
      reason: dto.reason,
      observations: dto.observations,
      performedById: dto.performedById,
    }, institutionId);

    return updatedEnrollment;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRASLADAR ESTUDIANTE
  // ═══════════════════════════════════════════════════════════════════════════

  async transferStudent(dto: TransferStudentDto, institutionId: string) {
    await this.assertEnrollmentInScope(dto.enrollmentId, institutionId);
    return this.runTransaction(tx => this.forTransaction(tx).transferStudentInTransaction(dto, institutionId));
  }

  private async transferStudentInTransaction(dto: TransferStudentDto, institutionId: string) {
    const enrollment = await this.getEnrollmentById(dto.enrollmentId, institutionId);

    // Validar que el año permita modificaciones
    const canModify = (await this.assertYearInScope(enrollment.academicYearId, institutionId)).status !== 'CLOSED';
    if (!canModify) {
      throw new ForbiddenException('El año lectivo no permite modificaciones');
    }

    // Validar que la matrícula esté activa
    if (enrollment.status !== 'ACTIVE') {
      throw new BadRequestException(`No se puede trasladar una matrícula en estado ${enrollment.status}`);
    }

    // Actualizar la matrícula
    const updatedEnrollment = await this.prisma.studentEnrollment.update({
      where: { id: dto.enrollmentId, institutionId },
      data: {
        status: 'TRANSFERRED',
        withdrawalDate: new Date(),
        withdrawalReason: dto.reason,
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

    // Crear evento de auditoría
    await this.createEnrollmentEvent({
      enrollmentId: dto.enrollmentId,
      type: 'TRANSFERRED',
      previousValue: { status: 'ACTIVE' },
      newValue: { 
        status: 'TRANSFERRED', 
        withdrawalDate: new Date(),
        destinationInstitution: dto.destinationInstitution,
      },
      reason: dto.reason,
      observations: dto.observations,
      performedById: dto.performedById,
    }, institutionId);

    return updatedEnrollment;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CAMBIAR GRUPO
  // ═══════════════════════════════════════════════════════════════════════════

  async changeGroup(dto: ChangeGroupDto, institutionId: string) {
    await this.assertEnrollmentInScope(dto.enrollmentId, institutionId);
    await this.assertGroupInScope(dto.newGroupId, institutionId);
    return this.runTransaction(tx => this.forTransaction(tx).changeGroupInTransaction(dto, institutionId));
  }

  private async changeGroupInTransaction(dto: ChangeGroupDto, institutionId: string) {
    const enrollment = await this.getEnrollmentById(dto.enrollmentId, institutionId);

    // Validar que el año permita modificaciones
    const canModify = (await this.assertYearInScope(enrollment.academicYearId, institutionId)).status !== 'CLOSED';
    if (!canModify) {
      throw new ForbiddenException('El año lectivo no permite modificaciones');
    }

    // Validar que la matrícula esté activa
    if (enrollment.status !== 'ACTIVE') {
      throw new BadRequestException(`No se puede cambiar el grupo de una matrícula en estado ${enrollment.status}`);
    }

    if (enrollment.groupId === dto.newGroupId) throw new BadRequestException('Seleccione un grupo diferente al actual');

    // Verificar que el nuevo grupo exista y validar cupo
    const newGroup = await this.prisma.group.findFirst({
      where: { id: dto.newGroupId, campus: { institutionId }, grade: { institutionId } },
      include: { 
        grade: true,
        _count: {
          select: {
            studentEnrollments: {
              where: {
                institutionId,
                academicYearId: enrollment.academicYearId,
                status: 'ACTIVE',
              },
            },
          },
        },
      },
    });

    if (!newGroup) {
      throw new NotFoundException('Grupo destino no encontrado');
    }

    // Validar cupo disponible en el nuevo grupo
    if (newGroup.maxCapacity !== null) {
      const currentEnrollments = newGroup._count.studentEnrollments;
      if (currentEnrollments >= newGroup.maxCapacity) {
        throw new BadRequestException(
          `El grupo ${newGroup.name} ha alcanzado su cupo máximo (${newGroup.maxCapacity} estudiantes)`
        );
      }
    }

    const previousGroupId = enrollment.groupId;
    const previousGradeId = enrollment.group.gradeId;
    const isSameGrade = previousGradeId === newGroup.gradeId;
    if (!isSameGrade) throw new BadRequestException('Los cambios de grado deben realizarse mediante el flujo de validación académica.');

    // ═══════════════════════════════════════════════════════════════════════════
    // MIGRACIÓN DE NOTAS (solo si es el mismo grado)
    // ═══════════════════════════════════════════════════════════════════════════
    let gradesMigrationResult: {
      partialGradesMigrated: number;
      studentGradesMigrated: number;
      attendanceMigrated: number;
      tutoringAttendanceMigrated: number;
      subjectsMatched: string[];
      subjectsNotMatched: string[];
    } | null = null;

    if (isSameGrade) {
      gradesMigrationResult = await this.migrateGradesToNewGroup(
        dto.enrollmentId,
        previousGroupId,
        dto.newGroupId,
        enrollment.academicYearId, institutionId,
      );
    }

    // Actualizar la matrícula
    const updatedEnrollment = await this.prisma.studentEnrollment.update({
      where: { id: dto.enrollmentId, institutionId },
      data: {
        groupId: dto.newGroupId,
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
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // REGENERAR SNAPSHOT DE ESTRUCTURA ACADÉMICA
    // El snapshot del nuevo grupo puede tener docentes diferentes
    // ═══════════════════════════════════════════════════════════════════════════
    await this.regenerateAcademicSnapshot(dto.enrollmentId, institutionId);

    // Crear evento de auditoría con información de migración
    await this.createEnrollmentEvent({
      enrollmentId: dto.enrollmentId,
      type: 'GROUP_CHANGED',
      movementType: dto.movementType,
      previousValue: { 
        groupId: previousGroupId,
        groupName: enrollment.group.name,
        gradeId: previousGradeId,
      },
      newValue: { 
        groupId: dto.newGroupId,
        groupName: newGroup.name,
        gradeId: newGroup.gradeId,
        gradesMigration: gradesMigrationResult,
      },
      reason: dto.reason,
      observations: dto.observations,
      performedById: dto.performedById,
    }, institutionId);

    return {
      ...updatedEnrollment,
      gradesMigration: gradesMigrationResult,
      isSameGrade,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MIGRAR NOTAS AL NUEVO GRUPO
  // Solo para cambios entre grupos del MISMO GRADO
  // ═══════════════════════════════════════════════════════════════════════════

  // Público: lo reutiliza GradeChangeService al mover de curso (mismo grado) para
  // que los consolidados sigan al estudiante. docs/AUDITORIA_MOVIMIENTO_NOTAS.md (Fase 3).
  async migrateGradesToNewGroup(
    enrollmentId: string,
    previousGroupId: string,
    newGroupId: string,
    academicYearId: string, institutionId: string,
  ): Promise<{
    partialGradesMigrated: number;
    studentGradesMigrated: number;
    attendanceMigrated: number;
    tutoringAttendanceMigrated: number;
    subjectsMatched: string[];
    subjectsNotMatched: string[];
  }> {
    const enrollment = await this.assertEnrollmentInScope(enrollmentId, institutionId);
    await this.assertYearInScope(academicYearId, institutionId);
    await this.assertGroupInScope(previousGroupId, institutionId);
    await this.assertGroupInScope(newGroupId, institutionId);
    if (enrollment.academicYearId !== academicYearId) throw new NotFoundException("Matrícula no encontrada");
    // 1. Obtener TeacherAssignments del grupo anterior y nuevo
    const [oldAssignments, newAssignments] = await Promise.all([
      this.prisma.teacherAssignment.findMany({
        where: { groupId: previousGroupId, academicYearId, institutionId },
        include: { subject: true },
      }),
      this.prisma.teacherAssignment.findMany({
        where: { groupId: newGroupId, academicYearId, institutionId },
        include: { subject: true },
      }),
    ]);

    // 2. Crear mapeo de subjectId -> newTeacherAssignmentId
    const newAssignmentBySubject = new Map(
      newAssignments.map(ta => [ta.subjectId, ta.id])
    );

    const subjectsMatched: string[] = [];
    const subjectsNotMatched: string[] = [];
    let partialGradesMigrated = 0;
    let studentGradesMigrated = 0;
    let attendanceMigrated = 0;

    // 3. Para cada assignment del grupo anterior, migrar notas al nuevo
    for (const oldTa of oldAssignments) {
      const newTaId = newAssignmentBySubject.get(oldTa.subjectId);

      if (!newTaId) {
        // La asignatura no existe en el nuevo grupo
        subjectsNotMatched.push(oldTa.subject.name);
        continue;
      }

      subjectsMatched.push(oldTa.subject.name);

      // 3a. Migrar PartialGrades
      const partialResult = await this.prisma.partialGrade.updateMany({
        where: {
          institutionId, studentEnrollmentId: enrollmentId,
          teacherAssignmentId: oldTa.id,
        },
        data: {
          teacherAssignmentId: newTaId,
        },
      });
      partialGradesMigrated += partialResult.count;

      // 3b. Migrar StudentGrades (a través de EvaluativeActivity)
      // Primero obtener las actividades del assignment anterior
      const oldActivities = await this.prisma.evaluativeActivity.findMany({
        where: { teacherAssignmentId: oldTa.id, institutionId },
        select: { id: true },
      });

      if (oldActivities.length > 0) {
        // Verificar si hay actividades equivalentes en el nuevo assignment
        // Por ahora, las notas de StudentGrade quedan vinculadas a las actividades originales
        // Esto es correcto porque EvaluativeActivity.id no cambia
        // Solo contamos cuántas hay para el reporte
        const studentGradesCount = await this.prisma.studentGrade.count({
          where: {
            institutionId, studentEnrollmentId: enrollmentId,
            evaluativeActivityId: { in: oldActivities.map(a => a.id) },
          },
        });
        studentGradesMigrated += studentGradesCount;
      }

      // 3c. Migrar AttendanceRecords
      const attendanceResult = await this.prisma.attendanceRecord.updateMany({
        where: {
          institutionId, studentEnrollmentId: enrollmentId,
          teacherAssignmentId: oldTa.id,
        },
        data: {
          teacherAssignmentId: newTaId,
        },
      });
      attendanceMigrated += attendanceResult.count;
    }

    // 4. Migrar TutoringAttendance (asistencia de tutoría/dirección de grupo)
    // Esta tabla tiene groupId directo, no teacherAssignmentId
    const tutoringResult = await this.prisma.tutoringAttendance.updateMany({
      where: {
        institutionId, studentEnrollmentId: enrollmentId,
        groupId: previousGroupId,
      },
      data: {
        groupId: newGroupId,
      },
    });
    const tutoringAttendanceMigrated = tutoringResult.count;

    return {
      partialGradesMigrated,
      studentGradesMigrated,
      attendanceMigrated,
      tutoringAttendanceMigrated,
      subjectsMatched,
      subjectsNotMatched,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REACTIVAR ESTUDIANTE (Reingreso)
  // ═══════════════════════════════════════════════════════════════════════════

  async reactivateStudent(dto: ReactivateStudentDto, institutionId: string) {
    await this.assertEnrollmentInScope(dto.enrollmentId, institutionId);
    return this.runTransaction(tx => this.forTransaction(tx).reactivateStudentInTransaction(dto, institutionId));
  }

  private async reactivateStudentInTransaction(dto: ReactivateStudentDto, institutionId: string) {
    const enrollment = await this.getEnrollmentById(dto.enrollmentId, institutionId);

    // Validar que el año permita matrículas
    const canEnroll = (await this.assertYearInScope(enrollment.academicYearId, institutionId)).status === 'ACTIVE';
    if (!canEnroll) {
      throw new ForbiddenException('El año lectivo no permite matrículas en su estado actual');
    }

    // Validar que la matrícula esté retirada
    if (enrollment.status !== 'WITHDRAWN') {
      throw new BadRequestException(`Solo se pueden reactivar matrículas en estado WITHDRAWN, actual: ${enrollment.status}`);
    }

    const capacity = await this.getGroupCapacity(enrollment.groupId, enrollment.academicYearId, institutionId);
    if (capacity.isFull) throw new BadRequestException('El grupo no tiene cupos disponibles para reactivar la matrícula.');

    // Actualizar la matrícula
    const updatedEnrollment = await this.prisma.studentEnrollment.update({
      where: { id: dto.enrollmentId, institutionId },
      data: {
        status: 'ACTIVE',
        withdrawalDate: null,
        withdrawalReason: null,
        enrollmentType: 'REENTRY',
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
    });

    // Crear evento de auditoría
    await this.createEnrollmentEvent({
      enrollmentId: dto.enrollmentId,
      type: 'REACTIVATED',
      previousValue: { status: 'WITHDRAWN' },
      newValue: { status: 'ACTIVE', enrollmentType: 'REENTRY' },
      reason: dto.reason,
      observations: dto.observations,
      performedById: dto.performedById,
    }, institutionId);

    return updatedEnrollment;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OBTENER MATRÍCULA POR ID
  // ═══════════════════════════════════════════════════════════════════════════

  async getEnrollmentById(enrollmentId: string, institutionId: string) {
    await this.assertEnrollmentInScope(enrollmentId, institutionId);
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: { id: enrollmentId, institutionId },
      include: {
        student: true,
        group: {
          include: {
            grade: true,
            campus: true,
          },
        },
        academicYear: true,
        events: {
          where: { institutionId },
          orderBy: { performedAt: 'desc' },
          take: 10,
          include: {
            performedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Matrícula no encontrada');
    }

    return enrollment;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LISTAR MATRÍCULAS CON FILTROS
  // ═══════════════════════════════════════════════════════════════════════════

  async getEnrollments(filters: EnrollmentFilters, institutionId: string) {
    await this.assertFiltersInScope(filters, institutionId);
    const where: Prisma.StudentEnrollmentWhereInput = { institutionId };

    if (filters.academicYearId) {
      where.academicYearId = filters.academicYearId;
    }

    if (filters.groupId) {
      where.groupId = filters.groupId;
    }

    if (filters.gradeId) {
      where.group = {
        gradeId: filters.gradeId,
      };
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.search) {
      where.student = {
        OR: [
          { firstName: { contains: filters.search, mode: 'insensitive' } },
          { lastName: { contains: filters.search, mode: 'insensitive' } },
          { documentNumber: { contains: filters.search } },
        ],
      };
    }

    return this.prisma.studentEnrollment.findMany({
      where,
      include: {
        student: true,
        group: {
          include: {
            grade: true,
            campus: true,
          },
        },
        academicYear: {
          select: {
            id: true,
            year: true,
            name: true,
            status: true,
          },
        },
      },
      orderBy: [
        { group: { grade: { name: 'asc' } } },
        { group: { name: 'asc' } },
        { student: { lastName: 'asc' } },
      ],
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HISTORIAL DE MATRÍCULA
  // ═══════════════════════════════════════════════════════════════════════════

  async getEnrollmentHistory(enrollmentId: string, institutionId: string) {
    await this.assertEnrollmentInScope(enrollmentId, institutionId);
    return this.prisma.enrollmentEvent.findMany({
      where: { enrollmentId, institutionId },
      include: {
        performedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        academicAct: true,
      },
      orderBy: { performedAt: 'desc' },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HISTORIAL DE MATRÍCULAS DE UN ESTUDIANTE
  // ═══════════════════════════════════════════════════════════════════════════

  async getStudentEnrollmentHistory(studentId: string, institutionId: string) {
    await this.assertStudentInScope(studentId, institutionId);
    return this.prisma.studentEnrollment.findMany({
      where: { studentId, institutionId },
      include: {
        group: {
          include: {
            grade: true,
            campus: true,
          },
        },
        academicYear: {
          select: {
            id: true,
            year: true,
            name: true,
            status: true,
          },
        },
        promotedFrom: {
          select: {
            id: true,
            academicYear: {
              select: { year: true },
            },
          },
        },
      },
      orderBy: { academicYear: { year: 'desc' } },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GESTIÓN DE CUPOS
  // ═══════════════════════════════════════════════════════════════════════════

  async getGroupCapacity(groupId: string, academicYearId: string, institutionId: string) {
    await this.assertGroupInScope(groupId, institutionId);
    await this.assertYearInScope(academicYearId, institutionId);
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, campus: { institutionId }, grade: { institutionId } },
      include: {
        grade: true,
        campus: true,
        shift: true,
        _count: {
          select: {
            studentEnrollments: {
              where: {
                institutionId,
                academicYearId,
                status: 'ACTIVE',
              },
            },
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Grupo no encontrado');
    }

    return {
      groupId: group.id,
      groupName: group.name,
      gradeName: group.grade.name,
      campusName: group.campus.name,
      shiftName: group.shift.name,
      maxCapacity: group.maxCapacity,
      currentEnrollments: group._count.studentEnrollments,
      availableSlots: group.maxCapacity !== null 
        ? Math.max(0, group.maxCapacity - group._count.studentEnrollments)
        : null,
      isFull: group.maxCapacity !== null && group._count.studentEnrollments >= group.maxCapacity,
    };
  }

  async getCapacityByAcademicYear(academicYearId: string, institutionId: string) {
    await this.assertYearInScope(academicYearId, institutionId);
    const groups = await this.prisma.group.findMany({
      where: {
        campus: { institutionId },
      },
      include: {
        grade: true,
        campus: true,
        shift: true,
        _count: {
          select: {
            studentEnrollments: {
              where: {
                institutionId,
                academicYearId,
                status: 'ACTIVE',
              },
            },
          },
        },
      },
      orderBy: [
        { grade: { stage: 'asc' } },
        { grade: { number: 'asc' } },
        { name: 'asc' },
      ],
    });

    return groups.map(group => ({
      groupId: group.id,
      groupName: group.name,
      groupCode: group.code,
      gradeName: group.grade.name,
      campusName: group.campus.name,
      shiftName: group.shift.name,
      maxCapacity: group.maxCapacity,
      currentEnrollments: group._count.studentEnrollments,
      availableSlots: group.maxCapacity !== null 
        ? Math.max(0, group.maxCapacity - group._count.studentEnrollments)
        : null,
      isFull: group.maxCapacity !== null && group._count.studentEnrollments >= group.maxCapacity,
    }));
  }

  async updateGroupCapacity(groupId: string, maxCapacity: number | null, institutionId: string) {
    await this.assertGroupInScope(groupId, institutionId);
    return this.prisma.group.update({
      where: { id: groupId, campus: { institutionId }, grade: { institutionId } },
      data: { maxCapacity },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ESTADÍSTICAS DE MATRÍCULAS
  // ═══════════════════════════════════════════════════════════════════════════

  async getEnrollmentStats(academicYearId: string, institutionId: string) {
    await this.assertYearInScope(academicYearId, institutionId);
    const [total, byStatus, byGrade] = await Promise.all([
      this.prisma.studentEnrollment.count({
        where: { academicYearId, institutionId },
      }),
      this.prisma.studentEnrollment.groupBy({
        by: ['status'],
        where: { academicYearId, institutionId },
        _count: true,
      }),
      this.prisma.studentEnrollment.groupBy({
        by: ['groupId'],
        where: { academicYearId, institutionId },
        _count: true,
      }),
    ]);

    return {
      total,
      byStatus: byStatus.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {} as Record<string, number>),
      byGroup: byGrade,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER: CREAR EVENTO DE AUDITORÍA
  // ═══════════════════════════════════════════════════════════════════════════

  private async createEnrollmentEvent(data: {
    enrollmentId: string;
    type: EnrollmentEventType;
    movementType?: EnrollmentMovementType;
    previousValue?: any;
    newValue?: any;
    reason?: string;
    observations?: string;
    academicActId?: string;
    performedById: string;
  }, institutionId: string) {
    await this.assertEnrollmentInScope(data.enrollmentId, institutionId);
    return this.prisma.enrollmentEvent.create({
      data: {
        institutionId,
        enrollmentId: data.enrollmentId,
        type: data.type,
        movementType: data.movementType,
        previousValue: data.previousValue,
        newValue: data.newValue,
        reason: data.reason,
        observations: data.observations,
        academicActId: data.academicActId,
        performedById: data.performedById,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SNAPSHOT DE ESTRUCTURA ACADÉMICA
  // Copia inmutable de áreas y asignaturas al momento de la matrícula
  // Protege contra cambios posteriores en plantillas que dañarían históricos
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Crea una copia de la estructura académica efectiva del grupo
   * al momento de la matrícula. Esta "foto" es inmutable y se usa
   * para cálculos de notas, evitando que cambios posteriores en
   * plantillas afecten matrículas existentes.
   */
  private async createAcademicSnapshot(
    enrollmentId: string,
    groupId: string,
    academicYearId: string, institutionId: string,
  ): Promise<void> {
    await this.assertEnrollmentInScope(enrollmentId, institutionId);
    await this.assertYearInScope(academicYearId, institutionId);
    await this.assertGroupInScope(groupId, institutionId);
    try {
      // Obtener estructura académica efectiva del grupo
      const structure = await this.templatesService.getEffectiveStructureForGroupInScope(groupId, academicYearId, institutionId);
      
      if (!structure.areas || structure.areas.length === 0) {
        console.warn(`[Enrollment] No academic structure found for group ${groupId} in year ${academicYearId}`);
        return;
      }

      // 🔥 Obtener docentes asignados al grupo para incluir en snapshot
      const teacherAssignments = await this.prisma.teacherAssignment.findMany({
        where: { groupId, academicYearId, institutionId },
        include: {
          teacher: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      
      // Mapear subjectId -> teacher info
      const teacherBySubject = new Map(
        teacherAssignments.map(ta => [
          ta.subjectId,
          { id: ta.teacher.id, name: `${ta.teacher.firstName} ${ta.teacher.lastName}` }
        ])
      );

      // Crear snapshot de áreas y asignaturas en transacción
      const instId = institutionId;

      await this.runTransaction(async (tx) => {
        for (const templateArea of structure.areas) {
          // Crear EnrollmentArea (snapshot del área)
          const enrollmentArea = await tx.enrollmentArea.create({
            data: {
              institutionId: instId,
              enrollmentId,
              areaId: templateArea.areaId,
              areaName: templateArea.area.name,
              areaCode: templateArea.area.code,
              weightPercentage: templateArea.weightPercentage,
              calculationType: templateArea.calculationType,
              approvalRule: templateArea.approvalRule,
              recoveryRule: templateArea.recoveryRule,
              isMandatory: templateArea.isMandatory,
              order: templateArea.order,
            },
          });

          // Crear EnrollmentSubject para cada asignatura del área
          for (const templateSubject of templateArea.templateSubjects) {
            // 🔥 Obtener docente asignado a esta asignatura
            const teacher = teacherBySubject.get(templateSubject.subjectId);
            
            await tx.enrollmentSubject.create({
              data: {
                institutionId: instId,
                enrollmentId,
                enrollmentAreaId: enrollmentArea.id,
                subjectId: templateSubject.subjectId,
                subjectName: templateSubject.subject.name,
                subjectCode: templateSubject.subject.code,
                weeklyHours: templateSubject.weeklyHours,
                weightPercentage: templateSubject.weightPercentage,
                isDominant: templateSubject.isDominant,
                order: templateSubject.order,
                achievementsPerPeriod: structure.template?.achievementsPerPeriod ?? 1,
                useAttitudinalAchievement: structure.template?.useAttitudinalAchievement ?? false,
                // 🔥 Snapshot del docente al momento de matrícula
                teacherId: teacher?.id ?? null,
                teacherName: teacher?.name ?? null,
              },
            });
          }
        }
      });

    } catch (error) {
      // Surface the failure so the complete movement rolls back; never report a partial save as successful.
      throw error;
    }
  }

  /**
   * Obtiene la estructura académica de una matrícula específica
   * Usa el snapshot si existe, o calcula la estructura efectiva como fallback
   */
  async getEnrollmentAcademicStructure(enrollmentId: string, institutionId: string) {
    await this.assertEnrollmentInScope(enrollmentId, institutionId);
    // Intentar obtener snapshot
    const enrollmentAreas = await this.prisma.enrollmentArea.findMany({
      where: { enrollmentId, institutionId },
      include: {
        area: true,
        enrollmentSubjects: {
          where: { institutionId },
          include: { subject: true },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    });

    if (enrollmentAreas.length > 0) {
      return {
        source: 'snapshot' as const,
        areas: enrollmentAreas,
      };
    }

    // Fallback: calcular estructura efectiva (para matrículas antiguas sin snapshot)
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: { id: enrollmentId, institutionId },
      select: { groupId: true, academicYearId: true },
    });

    if (!enrollment) {
      throw new NotFoundException('Matrícula no encontrada');
    }

    const structure = await this.templatesService.getEffectiveStructureForGroupInScope(
      enrollment.groupId,
      enrollment.academicYearId,
      institutionId,
    );

    return {
      source: 'calculated' as const,
      areas: structure.areas,
      warning: 'Esta matrícula no tiene snapshot. Usando estructura actual del grupo.',
    };
  }

  /**
   * Regenera el snapshot académico de una matrícula
   * Útil para matrículas antiguas o si se necesita actualizar manualmente
   */
  async regenerateAcademicSnapshot(enrollmentId: string, institutionId: string) {
    await this.assertEnrollmentInScope(enrollmentId, institutionId);
    return this.runTransaction(tx => this.forTransaction(tx).regenerateSnapshotInTransaction(enrollmentId, institutionId));
  }

  private async regenerateSnapshotInTransaction(enrollmentId: string, institutionId: string) {
    this.assertInstitution(institutionId);
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: { id: enrollmentId, institutionId },
      select: { groupId: true, academicYearId: true },
    });

    if (!enrollment) {
      throw new NotFoundException('Matrícula no encontrada');
    }

    await this.assertYearInScope(enrollment.academicYearId, institutionId);
    await this.assertGroupInScope(enrollment.groupId, institutionId);
    // Do not erase an existing historical structure when destination setup is missing.
    const structure = await this.templatesService.getEffectiveStructureForGroupInScope(enrollment.groupId, enrollment.academicYearId, institutionId);
    if (!structure.areas?.length && await this.prisma.enrollmentArea.count({ where: { enrollmentId, institutionId } })) {
      throw new BadRequestException('El grupo destino no tiene estructura académica configurada. Configure su plantilla antes de mover la matrícula.');
    }
    // Eliminar snapshot existente
    const deleted = await this.prisma.enrollmentArea.deleteMany({
      where: { enrollmentId, institutionId },
    });

    // Crear nuevo snapshot
    await this.createAcademicSnapshot(enrollmentId, enrollment.groupId, enrollment.academicYearId, institutionId);

    // Contar nuevos registros
    const created = await this.prisma.enrollmentArea.count({
      where: { enrollmentId, institutionId },
    });

    return { created, deleted: deleted.count };
  }
}
