import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EnrollmentStatus, EnrollmentType, EnrollmentEventType, EnrollmentMovementType, SchoolShift, StudyModality } from '@prisma/client';
import { AcademicYearLifecycleService } from './academic-year-lifecycle.service';

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

@Injectable()
export class EnrollmentService {
  constructor(
    private prisma: PrismaService,
    private yearLifecycleService: AcademicYearLifecycleService,
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
      include: { grade: true },
    });

    if (!group) {
      throw new NotFoundException('Grupo no encontrado');
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

    return enrollment;
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

    // Verificar que el nuevo grupo exista
    const newGroup = await this.prisma.group.findUnique({
      where: { id: dto.newGroupId },
      include: { grade: true },
    });

    if (!newGroup) {
      throw new NotFoundException('Grupo destino no encontrado');
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
}
