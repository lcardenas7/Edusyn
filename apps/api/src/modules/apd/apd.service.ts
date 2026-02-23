import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApdAuditService } from './apd-audit.service';
import { ApdProgressService } from './apd-progress.service';

@Injectable()
export class ApdService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: ApdAuditService,
    private readonly progress: ApdProgressService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURACIÓN INSTITUCIONAL
  // ═══════════════════════════════════════════════════════════════════════════

  async checkModuleEnabled(institutionId: string): Promise<void> {
    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: { enableDifferentialSupport: true },
    });
    if (!institution?.enableDifferentialSupport) {
      throw new ForbiddenException(
        'El módulo de Acompañamiento Pedagógico Diferencial no está habilitado para esta institución.',
      );
    }
  }

  async getInstitutionConfig(institutionId: string) {
    return this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: {
        enableDifferentialSupport: true,
        allowTeacherAccess: true,
      },
    });
  }

  async updateInstitutionConfig(
    institutionId: string,
    data: { enableDifferentialSupport?: boolean; allowTeacherAccess?: boolean },
  ) {
    return this.prisma.institution.update({
      where: { id: institutionId },
      data,
      select: {
        enableDifferentialSupport: true,
        allowTeacherAccess: true,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERFILES DE ACOMPAÑAMIENTO EDUCATIVO
  // ═══════════════════════════════════════════════════════════════════════════

  async createProfile(
    data: {
      institutionId: string;
      studentId: string;
      supportCategory: string;
      pedagogicalNotes?: string;
      parentConsentAccepted?: boolean;
      consentDate?: string;
      consentDocumentUrl?: string;
    },
    userId: string,
  ) {
    await this.checkModuleEnabled(data.institutionId);

    // Verificar que el estudiante pertenece a la institución
    const student = await this.prisma.student.findFirst({
      where: { id: data.studentId, institutionId: data.institutionId, isActive: true },
    });
    if (!student) {
      throw new NotFoundException('Estudiante no encontrado en esta institución.');
    }

    // Verificar que no exista ya un perfil
    const existing = await this.prisma.educationalSupportProfile.findUnique({
      where: {
        institutionId_studentId: {
          institutionId: data.institutionId,
          studentId: data.studentId,
        },
      },
    });
    if (existing) {
      throw new BadRequestException(
        'Ya existe un perfil de acompañamiento para este estudiante. Use la actualización.',
      );
    }

    const canActivate = data.parentConsentAccepted === true;

    const profile = await this.prisma.educationalSupportProfile.create({
      data: {
        institutionId: data.institutionId,
        studentId: data.studentId,
        supportCategory: data.supportCategory,
        pedagogicalNotes: data.pedagogicalNotes || null,
        parentConsentAccepted: data.parentConsentAccepted || false,
        consentDate: data.consentDate ? new Date(data.consentDate) : null,
        consentDocumentUrl: data.consentDocumentUrl || null,
        active: canActivate,
      },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, secondLastName: true },
        },
      },
    });

    await this.audit.log({
      institutionId: data.institutionId,
      userId,
      action: 'PROFILE_CREATED',
      entityType: 'EducationalSupportProfile',
      entityId: profile.id,
      details: { supportCategory: data.supportCategory, active: canActivate },
    });

    return profile;
  }

  async updateProfile(
    profileId: string,
    institutionId: string,
    data: {
      supportCategory?: string;
      pedagogicalNotes?: string;
      parentConsentAccepted?: boolean;
      consentDate?: string;
      consentDocumentUrl?: string;
      active?: boolean;
    },
    userId: string,
  ) {
    const profile = await this.prisma.educationalSupportProfile.findUnique({
      where: { id: profileId },
    });
    if (!profile) {
      throw new NotFoundException('Perfil de acompañamiento no encontrado.');
    }
    if (profile.institutionId !== institutionId) {
      throw new ForbiddenException('El perfil no pertenece a esta institución.');
    }

    // No permitir activar sin consentimiento
    const consentAccepted = data.parentConsentAccepted ?? profile.parentConsentAccepted;
    if (data.active === true && !consentAccepted) {
      throw new BadRequestException(
        'No se puede activar el perfil sin consentimiento parental aceptado.',
      );
    }

    const updated = await this.prisma.educationalSupportProfile.update({
      where: { id: profileId },
      data: {
        ...(data.supportCategory !== undefined && { supportCategory: data.supportCategory }),
        ...(data.pedagogicalNotes !== undefined && { pedagogicalNotes: data.pedagogicalNotes }),
        ...(data.parentConsentAccepted !== undefined && { parentConsentAccepted: data.parentConsentAccepted }),
        ...(data.consentDate !== undefined && { consentDate: data.consentDate ? new Date(data.consentDate) : null }),
        ...(data.consentDocumentUrl !== undefined && { consentDocumentUrl: data.consentDocumentUrl }),
        ...(data.active !== undefined && { active: data.active }),
      },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, secondLastName: true },
        },
      },
    });

    const action = data.active === true
      ? 'PROFILE_ACTIVATED'
      : data.active === false
        ? 'PROFILE_DEACTIVATED'
        : 'PROFILE_UPDATED';

    await this.audit.log({
      institutionId,
      userId,
      action,
      entityType: 'EducationalSupportProfile',
      entityId: profileId,
      details: data,
    });

    return updated;
  }

  async getProfile(profileId: string, institutionId: string, userId: string) {
    const profile = await this.prisma.educationalSupportProfile.findUnique({
      where: { id: profileId },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, secondLastName: true, secondName: true },
        },
        supportPlans: {
          include: {
            academicTerm: { select: { id: true, name: true, order: true } },
            activities: true,
            progressLogs: {
              include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Perfil de acompañamiento no encontrado.');
    }
    if (profile.institutionId !== institutionId) {
      throw new ForbiddenException('El perfil no pertenece a esta institución.');
    }

    // Auditar consulta
    await this.audit.log({
      institutionId,
      userId,
      action: 'PROFILE_VIEWED',
      entityType: 'EducationalSupportProfile',
      entityId: profileId,
    });

    return profile;
  }

  async getProfileByStudent(studentId: string, institutionId: string) {
    return this.prisma.educationalSupportProfile.findUnique({
      where: {
        institutionId_studentId: { institutionId, studentId },
      },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, secondLastName: true },
        },
      },
    });
  }

  async getProfilesByInstitution(
    institutionId: string,
    options?: { active?: boolean; search?: string },
  ) {
    return this.prisma.educationalSupportProfile.findMany({
      where: {
        institutionId,
        ...(options?.active !== undefined && { active: options.active }),
        ...(options?.search && {
          student: {
            OR: [
              { firstName: { contains: options.search, mode: 'insensitive' as const } },
              { lastName: { contains: options.search, mode: 'insensitive' as const } },
            ],
          },
        }),
      },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, secondLastName: true, secondName: true },
        },
      },
      orderBy: { student: { lastName: 'asc' } },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PLANES DE ACOMPAÑAMIENTO (extensión del existente)
  // ═══════════════════════════════════════════════════════════════════════════

  async createPlan(
    data: {
      institutionId: string;
      studentEnrollmentId: string;
      academicTermId: string;
      supportProfileId?: string;
      achievementId?: string;
      supportStrategy: string;
      familyCommitment?: string;
      followUpDate?: string;
      observations?: string;
      objectives?: any;
      adaptationStrategies?: any;
      evaluationAdjustments?: any;
    },
    userId: string,
  ) {
    await this.checkModuleEnabled(data.institutionId);

    // Validar matrícula
    const enrollment = await this.prisma.studentEnrollment.findUnique({
      where: { id: data.studentEnrollmentId },
      include: { group: { include: { grade: true } } },
    });
    if (!enrollment) {
      throw new NotFoundException('Matrícula no encontrada.');
    }
    if (enrollment.institutionId !== data.institutionId) {
      throw new ForbiddenException('La matrícula no pertenece a esta institución.');
    }

    // Validar perfil si se proporciona
    if (data.supportProfileId) {
      const profile = await this.prisma.educationalSupportProfile.findUnique({
        where: { id: data.supportProfileId },
      });
      if (!profile || !profile.active) {
        throw new BadRequestException(
          'El perfil de acompañamiento no existe o no está activo.',
        );
      }
    }

    // Prevenir duplicados activos
    const existingActive = await this.prisma.pedagogicalSupportPlan.findFirst({
      where: {
        studentEnrollmentId: data.studentEnrollmentId,
        academicTermId: data.academicTermId,
        status: 'ACTIVE',
      },
    });
    if (existingActive) {
      throw new BadRequestException(
        'Ya existe un plan activo para este estudiante en este período.',
      );
    }

    const plan = await this.prisma.pedagogicalSupportPlan.create({
      data: {
        institutionId: data.institutionId,
        studentEnrollmentId: data.studentEnrollmentId,
        academicTermId: data.academicTermId,
        supportProfileId: data.supportProfileId || null,
        achievementId: data.achievementId || null,
        supportStrategy: data.supportStrategy,
        familyCommitment: data.familyCommitment || null,
        followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
        observations: data.observations || null,
        objectives: data.objectives || undefined,
        adaptationStrategies: data.adaptationStrategies || undefined,
        evaluationAdjustments: data.evaluationAdjustments || undefined,
      },
      include: {
        studentEnrollment: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
            group: { include: { grade: true } },
          },
        },
        academicTerm: { select: { id: true, name: true, order: true } },
        supportProfile: true,
      },
    });

    await this.audit.log({
      institutionId: data.institutionId,
      userId,
      action: 'PLAN_CREATED',
      entityType: 'PedagogicalSupportPlan',
      entityId: plan.id,
    });

    return plan;
  }

  async updatePlan(
    planId: string,
    institutionId: string,
    data: {
      supportStrategy?: string;
      familyCommitment?: string;
      followUpDate?: string;
      observations?: string;
      objectives?: any;
      adaptationStrategies?: any;
      evaluationAdjustments?: any;
      status?: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
    },
    userId: string,
  ) {
    const plan = await this.prisma.pedagogicalSupportPlan.findUnique({
      where: { id: planId },
    });
    if (!plan) {
      throw new NotFoundException('Plan no encontrado.');
    }
    if (plan.institutionId !== institutionId) {
      throw new ForbiddenException('El plan no pertenece a esta institución.');
    }

    const isStatusChange = data.status && data.status !== plan.status;

    const updated = await this.prisma.pedagogicalSupportPlan.update({
      where: { id: planId },
      data: {
        ...(data.supportStrategy !== undefined && { supportStrategy: data.supportStrategy }),
        ...(data.familyCommitment !== undefined && { familyCommitment: data.familyCommitment }),
        ...(data.followUpDate !== undefined && { followUpDate: data.followUpDate ? new Date(data.followUpDate) : null }),
        ...(data.observations !== undefined && { observations: data.observations }),
        ...(data.objectives !== undefined && { objectives: data.objectives }),
        ...(data.adaptationStrategies !== undefined && { adaptationStrategies: data.adaptationStrategies }),
        ...(data.evaluationAdjustments !== undefined && { evaluationAdjustments: data.evaluationAdjustments }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.status === 'COMPLETED' && { completedAt: new Date(), completedById: userId }),
      },
      include: {
        studentEnrollment: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
            group: { include: { grade: true } },
          },
        },
        academicTerm: { select: { id: true, name: true, order: true } },
        activities: true,
        progressLogs: {
          include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' as const },
        },
      },
    });

    await this.audit.log({
      institutionId,
      userId,
      action: isStatusChange ? 'PLAN_STATUS_CHANGED' : 'PLAN_UPDATED',
      entityType: 'PedagogicalSupportPlan',
      entityId: planId,
      details: isStatusChange ? { from: plan.status, to: data.status } : data,
    });

    return updated;
  }

  async getPlan(planId: string, institutionId: string) {
    const plan = await this.prisma.pedagogicalSupportPlan.findUnique({
      where: { id: planId },
      include: {
        studentEnrollment: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true, secondLastName: true } },
            group: { include: { grade: true } },
          },
        },
        achievement: { select: { id: true, baseDescription: true, code: true } },
        academicTerm: { select: { id: true, name: true, order: true } },
        completedBy: { select: { id: true, firstName: true, lastName: true } },
        supportProfile: true,
        activities: { orderBy: { createdAt: 'asc' as const } },
        progressLogs: {
          include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' as const },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException('Plan no encontrado.');
    }
    if (plan.institutionId !== institutionId) {
      throw new ForbiddenException('El plan no pertenece a esta institución.');
    }

    return plan;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIVIDADES DE ACOMPAÑAMIENTO
  // ═══════════════════════════════════════════════════════════════════════════

  async createActivity(
    data: {
      supportPlanId: string;
      topic: string;
      originalActivityDescription?: string;
      teacherFinalActivity?: string;
      adaptationLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
    },
    institutionId: string,
    userId: string,
  ) {
    const plan = await this.prisma.pedagogicalSupportPlan.findUnique({
      where: { id: data.supportPlanId },
    });
    if (!plan) {
      throw new NotFoundException('Plan no encontrado.');
    }
    if (plan.institutionId !== institutionId) {
      throw new ForbiddenException('El plan no pertenece a esta institución.');
    }

    const activity = await this.prisma.supportActivity.create({
      data: {
        supportPlanId: data.supportPlanId,
        topic: data.topic,
        originalActivityDescription: data.originalActivityDescription || null,
        teacherFinalActivity: data.teacherFinalActivity || null,
        adaptationLevel: data.adaptationLevel || 'MEDIUM',
      },
    });

    await this.audit.log({
      institutionId,
      userId,
      action: 'ACTIVITY_CREATED',
      entityType: 'SupportActivity',
      entityId: activity.id,
      details: { supportPlanId: data.supportPlanId, topic: data.topic },
    });

    // Recalcular progreso
    await this.progress.recalculate(data.supportPlanId);

    return activity;
  }

  async updateActivity(
    activityId: string,
    institutionId: string,
    data: {
      topic?: string;
      originalActivityDescription?: string;
      teacherFinalActivity?: string;
      adaptationLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
      completionStatus?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
      teacherFeedback?: string;
      studentPerformanceScore?: number;
    },
    userId: string,
  ) {
    const activity = await this.prisma.supportActivity.findUnique({
      where: { id: activityId },
      include: { supportPlan: { select: { id: true, institutionId: true } } },
    });
    if (!activity) {
      throw new NotFoundException('Actividad no encontrada.');
    }
    if (activity.supportPlan.institutionId !== institutionId) {
      throw new ForbiddenException('La actividad no pertenece a esta institución.');
    }

    // Validar score
    if (data.studentPerformanceScore !== undefined) {
      if (data.studentPerformanceScore < 0 || data.studentPerformanceScore > 100) {
        throw new BadRequestException('El puntaje debe estar entre 0 y 100.');
      }
    }

    const updated = await this.prisma.supportActivity.update({
      where: { id: activityId },
      data: {
        ...(data.topic !== undefined && { topic: data.topic }),
        ...(data.originalActivityDescription !== undefined && { originalActivityDescription: data.originalActivityDescription }),
        ...(data.teacherFinalActivity !== undefined && { teacherFinalActivity: data.teacherFinalActivity }),
        ...(data.adaptationLevel !== undefined && { adaptationLevel: data.adaptationLevel }),
        ...(data.completionStatus !== undefined && { completionStatus: data.completionStatus }),
        ...(data.teacherFeedback !== undefined && { teacherFeedback: data.teacherFeedback }),
        ...(data.studentPerformanceScore !== undefined && { studentPerformanceScore: data.studentPerformanceScore }),
      },
    });

    await this.audit.log({
      institutionId,
      userId,
      action: 'ACTIVITY_UPDATED',
      entityType: 'SupportActivity',
      entityId: activityId,
      details: data,
    });

    // Recalcular progreso
    await this.progress.recalculate(activity.supportPlan.id);

    return updated;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGS DE PROGRESO
  // ═══════════════════════════════════════════════════════════════════════════

  async createProgressLog(
    data: {
      supportPlanId: string;
      progressIndicator: number;
      qualitativeObservation?: string;
    },
    institutionId: string,
    userId: string,
  ) {
    // Validar indicador
    if (data.progressIndicator < 1 || data.progressIndicator > 5) {
      throw new BadRequestException('El indicador de progreso debe estar entre 1 y 5.');
    }

    const plan = await this.prisma.pedagogicalSupportPlan.findUnique({
      where: { id: data.supportPlanId },
    });
    if (!plan) {
      throw new NotFoundException('Plan no encontrado.');
    }
    if (plan.institutionId !== institutionId) {
      throw new ForbiddenException('El plan no pertenece a esta institución.');
    }

    const log = await this.prisma.supportProgressLog.create({
      data: {
        supportPlanId: data.supportPlanId,
        progressIndicator: data.progressIndicator,
        qualitativeObservation: data.qualitativeObservation || null,
        createdById: userId,
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await this.audit.log({
      institutionId,
      userId,
      action: 'PROGRESS_LOG_CREATED',
      entityType: 'SupportProgressLog',
      entityId: log.id,
      details: { supportPlanId: data.supportPlanId, progressIndicator: data.progressIndicator },
    });

    // Recalcular progreso
    const newPercentage = await this.progress.recalculate(data.supportPlanId);

    await this.audit.log({
      institutionId,
      userId,
      action: 'PLAN_PROGRESS_UPDATED',
      entityType: 'PedagogicalSupportPlan',
      entityId: data.supportPlanId,
      details: { progressPercentage: newPercentage },
    });

    return log;
  }
}
