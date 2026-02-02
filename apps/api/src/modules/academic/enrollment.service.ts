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

  // ═══════════════════════════════════════════════════════════════════════════
  // MATRICULAR ESTUDIANTE
  // ═══════════════════════════════════════════════════════════════════════════

  async enrollStudent(dto: EnrollStudentDto) {
    // Validar que el año permita matrículas
    const canEnroll = await this.yearLifecycleService.canEnrollStudents(dto.academicYearId);
    if (!canEnroll) {
      throw new ForbiddenException('El año lectivo no permite matrículas en su estado actual');
    }

    // Verificar que el estudiante no esté ya matriculado en este año
    const existingEnrollment = await this.prisma.studentEnrollment.findUnique({
      where: {
        studentId_academicYearId: {
          studentId: dto.studentId,
          academicYearId: dto.academicYearId,
        },
      },
    });

    if (existingEnrollment) {
      throw new BadRequestException('El estudiante ya está matriculado en este año lectivo');
    }

    // Verificar que el grupo exista
    const group = await this.prisma.group.findUnique({
      where: { id: dto.groupId },
      include: { 
        grade: true,
        _count: {
          select: {
            studentEnrollments: {
              where: {
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

    // Crear la matrícula
    const enrollment = await this.prisma.studentEnrollment.create({
      data: {
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
    });

    // 🔥 SNAPSHOT: Copiar estructura académica al momento de matrícula
    await this.createAcademicSnapshot(enrollment.id, dto.groupId, dto.academicYearId);

    return enrollment;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CREAR ESTUDIANTE Y MATRICULAR (FLUJO UNIFICADO)
  // ═══════════════════════════════════════════════════════════════════════════

  async createStudentAndEnroll(dto: CreateStudentAndEnrollDto) {
    // Validar que el año permita matrículas
    const canEnroll = await this.yearLifecycleService.canEnrollStudents(dto.academicYearId);
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
      const existingEnrollment = await this.prisma.studentEnrollment.findUnique({
        where: {
          studentId_academicYearId: {
            studentId: existingStudent.id,
            academicYearId: dto.academicYearId,
          },
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
      });
    }

    // Verificar cupo del grupo
    const group = await this.prisma.group.findUnique({
      where: { id: dto.groupId },
      include: {
        grade: true,
        _count: {
          select: {
            studentEnrollments: {
              where: {
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
    const result = await this.prisma.$transaction(async (tx) => {
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
    await this.createAcademicSnapshot(result.id, dto.groupId, dto.academicYearId);

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUSCAR ESTUDIANTE POR DOCUMENTO (para verificar si existe antes de matricular)
  // ═══════════════════════════════════════════════════════════════════════════

  async findStudentByDocument(institutionId: string, documentNumber: string) {
    const student = await this.prisma.student.findUnique({
      where: {
        institutionId_documentNumber: {
          institutionId,
          documentNumber,
        },
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

  async withdrawStudent(dto: WithdrawStudentDto) {
    const enrollment = await this.getEnrollmentById(dto.enrollmentId);

    // Validar que el año permita modificaciones
    const canModify = await this.yearLifecycleService.canModify(enrollment.academicYearId);
    if (!canModify) {
      throw new ForbiddenException('El año lectivo no permite modificaciones');
    }

    // Validar que la matrícula esté activa
    if (enrollment.status !== 'ACTIVE') {
      throw new BadRequestException(`No se puede retirar una matrícula en estado ${enrollment.status}`);
    }

    // Actualizar la matrícula
    const updatedEnrollment = await this.prisma.studentEnrollment.update({
      where: { id: dto.enrollmentId },
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
    });

    return updatedEnrollment;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRASLADAR ESTUDIANTE
  // ═══════════════════════════════════════════════════════════════════════════

  async transferStudent(dto: TransferStudentDto) {
    const enrollment = await this.getEnrollmentById(dto.enrollmentId);

    // Validar que el año permita modificaciones
    const canModify = await this.yearLifecycleService.canModify(enrollment.academicYearId);
    if (!canModify) {
      throw new ForbiddenException('El año lectivo no permite modificaciones');
    }

    // Validar que la matrícula esté activa
    if (enrollment.status !== 'ACTIVE') {
      throw new BadRequestException(`No se puede trasladar una matrícula en estado ${enrollment.status}`);
    }

    // Actualizar la matrícula
    const updatedEnrollment = await this.prisma.studentEnrollment.update({
      where: { id: dto.enrollmentId },
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
    });

    return updatedEnrollment;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CAMBIAR GRUPO
  // ═══════════════════════════════════════════════════════════════════════════

  async changeGroup(dto: ChangeGroupDto) {
    const enrollment = await this.getEnrollmentById(dto.enrollmentId);

    // Validar que el año permita modificaciones
    const canModify = await this.yearLifecycleService.canModify(enrollment.academicYearId);
    if (!canModify) {
      throw new ForbiddenException('El año lectivo no permite modificaciones');
    }

    // Validar que la matrícula esté activa
    if (enrollment.status !== 'ACTIVE') {
      throw new BadRequestException(`No se puede cambiar el grupo de una matrícula en estado ${enrollment.status}`);
    }

    // Verificar que el nuevo grupo exista y validar cupo
    const newGroup = await this.prisma.group.findUnique({
      where: { id: dto.newGroupId },
      include: { 
        grade: true,
        _count: {
          select: {
            studentEnrollments: {
              where: {
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

    // Actualizar la matrícula
    const updatedEnrollment = await this.prisma.studentEnrollment.update({
      where: { id: dto.enrollmentId },
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

    // Crear evento de auditoría
    await this.createEnrollmentEvent({
      enrollmentId: dto.enrollmentId,
      type: 'GROUP_CHANGED',
      movementType: dto.movementType,
      previousValue: { groupId: previousGroupId },
      newValue: { groupId: dto.newGroupId },
      reason: dto.reason,
      observations: dto.observations,
      performedById: dto.performedById,
    });

    return updatedEnrollment;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REACTIVAR ESTUDIANTE (Reingreso)
  // ═══════════════════════════════════════════════════════════════════════════

  async reactivateStudent(dto: ReactivateStudentDto) {
    const enrollment = await this.getEnrollmentById(dto.enrollmentId);

    // Validar que el año permita matrículas
    const canEnroll = await this.yearLifecycleService.canEnrollStudents(enrollment.academicYearId);
    if (!canEnroll) {
      throw new ForbiddenException('El año lectivo no permite matrículas en su estado actual');
    }

    // Validar que la matrícula esté retirada
    if (enrollment.status !== 'WITHDRAWN') {
      throw new BadRequestException(`Solo se pueden reactivar matrículas en estado WITHDRAWN, actual: ${enrollment.status}`);
    }

    // Actualizar la matrícula
    const updatedEnrollment = await this.prisma.studentEnrollment.update({
      where: { id: dto.enrollmentId },
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
    });

    return updatedEnrollment;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OBTENER MATRÍCULA POR ID
  // ═══════════════════════════════════════════════════════════════════════════

  async getEnrollmentById(enrollmentId: string) {
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
        academicYear: true,
        events: {
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

  async getEnrollments(filters: EnrollmentFilters) {
    const where: any = {};

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

  async getEnrollmentHistory(enrollmentId: string) {
    return this.prisma.enrollmentEvent.findMany({
      where: { enrollmentId },
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

  async getStudentEnrollmentHistory(studentId: string) {
    return this.prisma.studentEnrollment.findMany({
      where: { studentId },
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

  async getGroupCapacity(groupId: string, academicYearId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        grade: true,
        campus: true,
        shift: true,
        _count: {
          select: {
            studentEnrollments: {
              where: {
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

  async updateGroupCapacity(groupId: string, maxCapacity: number | null) {
    return this.prisma.group.update({
      where: { id: groupId },
      data: { maxCapacity },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ESTADÍSTICAS DE MATRÍCULAS
  // ═══════════════════════════════════════════════════════════════════════════

  async getEnrollmentStats(academicYearId: string) {
    const [total, byStatus, byGrade] = await Promise.all([
      this.prisma.studentEnrollment.count({
        where: { academicYearId },
      }),
      this.prisma.studentEnrollment.groupBy({
        by: ['status'],
        where: { academicYearId },
        _count: true,
      }),
      this.prisma.studentEnrollment.groupBy({
        by: ['groupId'],
        where: { academicYearId },
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
  }) {
    return this.prisma.enrollmentEvent.create({
      data: {
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
    academicYearId: string,
  ): Promise<void> {
    try {
      // Obtener estructura académica efectiva del grupo
      const structure = await this.templatesService.getEffectiveStructureForGroup(groupId, academicYearId);
      
      if (!structure.areas || structure.areas.length === 0) {
        console.warn(`[Enrollment] No academic structure found for group ${groupId} in year ${academicYearId}`);
        return;
      }

      // 🔥 Obtener docentes asignados al grupo para incluir en snapshot
      const teacherAssignments = await this.prisma.teacherAssignment.findMany({
        where: { groupId, academicYearId },
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
      await this.prisma.$transaction(async (tx) => {
        for (const templateArea of structure.areas) {
          // Crear EnrollmentArea (snapshot del área)
          const enrollmentArea = await tx.enrollmentArea.create({
            data: {
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

      console.log(`[Enrollment] Academic snapshot created for enrollment ${enrollmentId}`);
    } catch (error) {
      // No fallar la matrícula si el snapshot falla, solo loguear
      console.error(`[Enrollment] Error creating academic snapshot for enrollment ${enrollmentId}:`, error);
    }
  }

  /**
   * Obtiene la estructura académica de una matrícula específica
   * Usa el snapshot si existe, o calcula la estructura efectiva como fallback
   */
  async getEnrollmentAcademicStructure(enrollmentId: string) {
    // Intentar obtener snapshot
    const enrollmentAreas = await this.prisma.enrollmentArea.findMany({
      where: { enrollmentId },
      include: {
        area: true,
        enrollmentSubjects: {
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
    const enrollment = await this.prisma.studentEnrollment.findUnique({
      where: { id: enrollmentId },
      select: { groupId: true, academicYearId: true },
    });

    if (!enrollment) {
      throw new NotFoundException('Matrícula no encontrada');
    }

    const structure = await this.templatesService.getEffectiveStructureForGroup(
      enrollment.groupId,
      enrollment.academicYearId,
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
  async regenerateAcademicSnapshot(enrollmentId: string): Promise<{ created: number; deleted: number }> {
    const enrollment = await this.prisma.studentEnrollment.findUnique({
      where: { id: enrollmentId },
      select: { groupId: true, academicYearId: true },
    });

    if (!enrollment) {
      throw new NotFoundException('Matrícula no encontrada');
    }

    // Eliminar snapshot existente
    const deleted = await this.prisma.enrollmentArea.deleteMany({
      where: { enrollmentId },
    });

    // Crear nuevo snapshot
    await this.createAcademicSnapshot(enrollmentId, enrollment.groupId, enrollment.academicYearId);

    // Contar nuevos registros
    const created = await this.prisma.enrollmentArea.count({
      where: { enrollmentId },
    });

    return { created, deleted: deleted.count };
  }
}
