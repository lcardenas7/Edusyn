import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PedagogicalSupportService {
  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // CREAR PLAN DE ACOMPAÑAMIENTO
  // ═══════════════════════════════════════════════════════════════════════════

  async createSupportPlan(data: {
    institutionId: string;
    studentEnrollmentId: string;
    achievementId?: string;
    academicTermId: string;
    supportStrategy: string;
    familyCommitment?: string;
    followUpDate?: string;
    observations?: string;
  }) {
    // Validar que la matrícula existe y pertenece a la institución
    const enrollment = await this.prisma.studentEnrollment.findUnique({
      where: { id: data.studentEnrollmentId },
      include: {
        group: { include: { grade: true } },
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Matrícula no encontrada');
    }

    if (enrollment.institutionId !== data.institutionId) {
      throw new BadRequestException('La matrícula no pertenece a esta institución');
    }

    // Validar que el grado usa estructura DIMENSIONS
    if (enrollment.group?.grade?.academicStructure !== 'DIMENSIONS') {
      throw new BadRequestException(
        'El acompañamiento pedagógico solo aplica para estructura DIMENSIONS (preescolar)',
      );
    }

    // Prevenir duplicados: no permitir más de un plan ACTIVO por estudiante+período
    const existingActive = await this.prisma.pedagogicalSupportPlan.findFirst({
      where: {
        studentEnrollmentId: data.studentEnrollmentId,
        academicTermId: data.academicTermId,
        status: 'ACTIVE',
      },
    });

    if (existingActive) {
      throw new BadRequestException(
        'Ya existe un plan de acompañamiento activo para este estudiante en este período. Complete o cancele el existente antes de crear uno nuevo.',
      );
    }

    return this.prisma.pedagogicalSupportPlan.create({
      data: {
        institutionId: data.institutionId,
        studentEnrollmentId: data.studentEnrollmentId,
        achievementId: data.achievementId || null,
        academicTermId: data.academicTermId,
        supportStrategy: data.supportStrategy,
        familyCommitment: data.familyCommitment || null,
        followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
        observations: data.observations || null,
      },
      include: {
        studentEnrollment: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
            group: { include: { grade: true } },
          },
        },
        achievement: { select: { id: true, baseDescription: true, code: true } },
        academicTerm: { select: { id: true, name: true, order: true } },
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTUALIZAR PLAN
  // ═══════════════════════════════════════════════════════════════════════════

  async updateSupportPlan(
    id: string,
    institutionId: string,
    data: {
      supportStrategy?: string;
      familyCommitment?: string;
      followUpDate?: string;
      observations?: string;
      status?: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
    },
  ) {
    const plan = await this.prisma.pedagogicalSupportPlan.findUnique({
      where: { id },
    });

    if (!plan) {
      throw new NotFoundException('Plan de acompañamiento no encontrado');
    }

    if (plan.institutionId !== institutionId) {
      throw new BadRequestException('El plan no pertenece a esta institución');
    }

    return this.prisma.pedagogicalSupportPlan.update({
      where: { id },
      data: {
        ...(data.supportStrategy !== undefined && { supportStrategy: data.supportStrategy }),
        ...(data.familyCommitment !== undefined && { familyCommitment: data.familyCommitment }),
        ...(data.followUpDate !== undefined && {
          followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
        }),
        ...(data.observations !== undefined && { observations: data.observations }),
        ...(data.status !== undefined && { status: data.status }),
      },
      include: {
        studentEnrollment: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
            group: { include: { grade: true } },
          },
        },
        achievement: { select: { id: true, baseDescription: true, code: true } },
        academicTerm: { select: { id: true, name: true, order: true } },
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MARCAR COMO COMPLETADO
  // ═══════════════════════════════════════════════════════════════════════════

  async markCompleted(id: string, institutionId: string, userId: string, observations?: string) {
    const plan = await this.prisma.pedagogicalSupportPlan.findUnique({
      where: { id },
    });

    if (!plan) {
      throw new NotFoundException('Plan de acompañamiento no encontrado');
    }

    if (plan.institutionId !== institutionId) {
      throw new BadRequestException('El plan no pertenece a esta institución');
    }

    return this.prisma.pedagogicalSupportPlan.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        completedById: userId,
        ...(observations && { observations }),
      },
      include: {
        studentEnrollment: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
            group: { include: { grade: true } },
          },
        },
        achievement: { select: { id: true, baseDescription: true, code: true } },
        academicTerm: { select: { id: true, name: true, order: true } },
        completedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OBTENER POR ESTUDIANTE
  // ═══════════════════════════════════════════════════════════════════════════

  async getByStudent(studentEnrollmentId: string, academicTermId?: string) {
    return this.prisma.pedagogicalSupportPlan.findMany({
      where: {
        studentEnrollmentId,
        ...(academicTermId && { academicTermId }),
      },
      include: {
        studentEnrollment: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
            group: { include: { grade: true } },
          },
        },
        achievement: { select: { id: true, baseDescription: true, code: true } },
        academicTerm: { select: { id: true, name: true, order: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OBTENER POR GRUPO (para vista de docente/coordinador)
  // ═══════════════════════════════════════════════════════════════════════════

  async getByGroup(
    groupId: string,
    academicTermId: string,
    institutionId: string,
    status?: string,
  ) {
    // Obtener matrículas del grupo
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        groupId,
        institutionId,
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    const enrollmentIds = enrollments.map((e) => e.id);

    return this.prisma.pedagogicalSupportPlan.findMany({
      where: {
        studentEnrollmentId: { in: enrollmentIds },
        academicTermId,
        ...(status && { status: status as any }),
      },
      include: {
        studentEnrollment: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
            group: { include: { grade: true } },
          },
        },
        achievement: { select: { id: true, baseDescription: true, code: true } },
        academicTerm: { select: { id: true, name: true, order: true } },
      },
      orderBy: [
        { studentEnrollment: { student: { lastName: 'asc' } } },
        { createdAt: 'desc' },
      ],
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OBTENER POR ID
  // ═══════════════════════════════════════════════════════════════════════════

  async getById(id: string) {
    const plan = await this.prisma.pedagogicalSupportPlan.findUnique({
      where: { id },
      include: {
        studentEnrollment: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
            group: { include: { grade: true } },
          },
        },
        achievement: { select: { id: true, baseDescription: true, code: true } },
        academicTerm: { select: { id: true, name: true, order: true } },
      },
    });

    if (!plan) {
      throw new NotFoundException('Plan de acompañamiento no encontrado');
    }

    return plan;
  }
}
