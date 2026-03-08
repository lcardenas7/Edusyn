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
      supportCategoryId?: string;
      pedagogicalNotes?: string;
      learningBarriers?: string;
      strengths?: string;
      supportNeeds?: string;
      learningStyleObservations?: string;
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
        supportCategoryId: data.supportCategoryId || null,
        pedagogicalNotes: data.pedagogicalNotes || null,
        learningBarriers: data.learningBarriers || null,
        strengths: data.strengths || null,
        supportNeeds: data.supportNeeds || null,
        learningStyleObservations: data.learningStyleObservations || null,
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
      supportCategoryId?: string;
      pedagogicalNotes?: string;
      learningBarriers?: string;
      strengths?: string;
      supportNeeds?: string;
      learningStyleObservations?: string;
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
        ...(data.supportCategoryId !== undefined && { supportCategoryId: data.supportCategoryId || null }),
        ...(data.pedagogicalNotes !== undefined && { pedagogicalNotes: data.pedagogicalNotes }),
        ...(data.learningBarriers !== undefined && { learningBarriers: data.learningBarriers }),
        ...(data.strengths !== undefined && { strengths: data.strengths }),
        ...(data.supportNeeds !== undefined && { supportNeeds: data.supportNeeds }),
        ...(data.learningStyleObservations !== undefined && { learningStyleObservations: data.learningStyleObservations }),
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
      planType?: 'APD' | 'PIAR';
      supportStrategy: string;
      familyCommitment?: string;
      followUpDate?: string;
      observations?: string;
      objectives?: any;
      adaptationStrategies?: any;
      evaluationAdjustments?: any;
      planApprovedByFamily?: boolean;
      familyApprovalDate?: string;
      familySignatureUrl?: string;
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
        planType: data.planType || 'APD',
        supportStrategy: data.supportStrategy,
        familyCommitment: data.familyCommitment || null,
        followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
        observations: data.observations || null,
        objectives: data.objectives || undefined,
        adaptationStrategies: data.adaptationStrategies || undefined,
        evaluationAdjustments: data.evaluationAdjustments || undefined,
        planApprovedByFamily: data.planApprovedByFamily || false,
        familyApprovalDate: data.familyApprovalDate ? new Date(data.familyApprovalDate) : null,
        familySignatureUrl: data.familySignatureUrl || null,
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
      planType?: 'APD' | 'PIAR';
      supportStrategy?: string;
      familyCommitment?: string;
      followUpDate?: string;
      observations?: string;
      objectives?: any;
      adaptationStrategies?: any;
      evaluationAdjustments?: any;
      planApprovedByFamily?: boolean;
      familyApprovalDate?: string;
      familySignatureUrl?: string;
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
        ...(data.planType !== undefined && { planType: data.planType }),
        ...(data.supportStrategy !== undefined && { supportStrategy: data.supportStrategy }),
        ...(data.familyCommitment !== undefined && { familyCommitment: data.familyCommitment }),
        ...(data.followUpDate !== undefined && { followUpDate: data.followUpDate ? new Date(data.followUpDate) : null }),
        ...(data.observations !== undefined && { observations: data.observations }),
        ...(data.objectives !== undefined && { objectives: data.objectives }),
        ...(data.adaptationStrategies !== undefined && { adaptationStrategies: data.adaptationStrategies }),
        ...(data.evaluationAdjustments !== undefined && { evaluationAdjustments: data.evaluationAdjustments }),
        ...(data.planApprovedByFamily !== undefined && { planApprovedByFamily: data.planApprovedByFamily }),
        ...(data.familyApprovalDate !== undefined && { familyApprovalDate: data.familyApprovalDate ? new Date(data.familyApprovalDate) : null }),
        ...(data.familySignatureUrl !== undefined && { familySignatureUrl: data.familySignatureUrl }),
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
        participants: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'asc' as const },
        },
        planSubjects: {
          include: {
            subject: { select: { id: true, name: true } },
            teacher: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        documents: {
          include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
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
      adjustmentType?: 'CURRICULAR' | 'METHODOLOGICAL' | 'EVALUATIVE' | 'COMMUNICATION' | 'ENVIRONMENTAL';
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
        adjustmentType: data.adjustmentType || null,
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
      adjustmentType?: 'CURRICULAR' | 'METHODOLOGICAL' | 'EVALUATIVE' | 'COMMUNICATION' | 'ENVIRONMENTAL';
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
        ...(data.adjustmentType !== undefined && { adjustmentType: data.adjustmentType }),
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

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORÍAS DE ACOMPAÑAMIENTO (configurables por institución)
  // ═══════════════════════════════════════════════════════════════════════════

  async getCategories(institutionId: string) {
    return this.prisma.supportCategory.findMany({
      where: { institutionId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createCategory(
    institutionId: string,
    data: { name: string; description?: string; sortOrder?: number },
  ) {
    return this.prisma.supportCategory.create({
      data: {
        institutionId,
        name: data.name,
        description: data.description || null,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async updateCategory(
    categoryId: string,
    institutionId: string,
    data: { name?: string; description?: string; active?: boolean; sortOrder?: number },
  ) {
    const cat = await this.prisma.supportCategory.findUnique({ where: { id: categoryId } });
    if (!cat || cat.institutionId !== institutionId) {
      throw new NotFoundException('Categoría no encontrada.');
    }
    return this.prisma.supportCategory.update({
      where: { id: categoryId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.active !== undefined && { active: data.active }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PARTICIPANTES DEL PLAN (equipo interdisciplinario PIAR)
  // ═══════════════════════════════════════════════════════════════════════════

  async addParticipant(
    data: {
      supportPlanId: string;
      userId?: string;
      role: 'TEACHER' | 'COUNSELOR' | 'COORDINATOR' | 'FAMILY_MEMBER' | 'EXTERNAL_SPECIALIST';
      fullName?: string;
      relationship?: string;
      observations?: string;
    },
    institutionId: string,
    currentUserId: string,
  ) {
    const plan = await this.prisma.pedagogicalSupportPlan.findUnique({
      where: { id: data.supportPlanId },
    });
    if (!plan || plan.institutionId !== institutionId) {
      throw new ForbiddenException('El plan no pertenece a esta institución.');
    }

    const participant = await this.prisma.supportPlanParticipant.create({
      data: {
        supportPlanId: data.supportPlanId,
        userId: data.userId || null,
        role: data.role,
        fullName: data.fullName || null,
        relationship: data.relationship || null,
        observations: data.observations || null,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return participant;
  }

  async removeParticipant(participantId: string, institutionId: string) {
    const participant = await this.prisma.supportPlanParticipant.findUnique({
      where: { id: participantId },
      include: { supportPlan: { select: { institutionId: true } } },
    });
    if (!participant || participant.supportPlan.institutionId !== institutionId) {
      throw new ForbiddenException('El participante no pertenece a esta institución.');
    }
    return this.prisma.supportPlanParticipant.delete({ where: { id: participantId } });
  }

  async signParticipant(
    participantId: string,
    institutionId: string,
    data: { signatureUrl?: string },
  ) {
    const participant = await this.prisma.supportPlanParticipant.findUnique({
      where: { id: participantId },
      include: { supportPlan: { select: { institutionId: true } } },
    });
    if (!participant || participant.supportPlan.institutionId !== institutionId) {
      throw new ForbiddenException('El participante no pertenece a esta institución.');
    }
    return this.prisma.supportPlanParticipant.update({
      where: { id: participantId },
      data: {
        signed: true,
        signedAt: new Date(),
        signatureUrl: data.signatureUrl || null,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ASIGNATURAS VINCULADAS AL PLAN
  // ═══════════════════════════════════════════════════════════════════════════

  async addPlanSubject(
    data: { supportPlanId: string; subjectId: string; teacherId?: string; specificNotes?: string },
    institutionId: string,
  ) {
    const plan = await this.prisma.pedagogicalSupportPlan.findUnique({
      where: { id: data.supportPlanId },
    });
    if (!plan || plan.institutionId !== institutionId) {
      throw new ForbiddenException('El plan no pertenece a esta institución.');
    }

    return this.prisma.supportPlanSubject.create({
      data: {
        supportPlanId: data.supportPlanId,
        subjectId: data.subjectId,
        teacherId: data.teacherId || null,
        specificNotes: data.specificNotes || null,
      },
      include: {
        subject: { select: { id: true, name: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async removePlanSubject(planSubjectId: string, institutionId: string) {
    const ps = await this.prisma.supportPlanSubject.findUnique({
      where: { id: planSubjectId },
      include: { supportPlan: { select: { institutionId: true } } },
    });
    if (!ps || ps.supportPlan.institutionId !== institutionId) {
      throw new ForbiddenException('La asignatura vinculada no pertenece a esta institución.');
    }
    return this.prisma.supportPlanSubject.delete({ where: { id: planSubjectId } });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DOCUMENTOS DE SOPORTE
  // ═══════════════════════════════════════════════════════════════════════════

  async addDocument(
    data: {
      supportPlanId: string;
      type: 'EVIDENCE' | 'FAMILY_DOCUMENT' | 'ASSESSMENT' | 'REPORT';
      fileName: string;
      fileUrl: string;
      description?: string;
    },
    institutionId: string,
    userId: string,
  ) {
    const plan = await this.prisma.pedagogicalSupportPlan.findUnique({
      where: { id: data.supportPlanId },
    });
    if (!plan || plan.institutionId !== institutionId) {
      throw new ForbiddenException('El plan no pertenece a esta institución.');
    }

    return this.prisma.supportDocument.create({
      data: {
        supportPlanId: data.supportPlanId,
        uploadedById: userId,
        type: data.type,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        description: data.description || null,
      },
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async removeDocument(documentId: string, institutionId: string) {
    const doc = await this.prisma.supportDocument.findUnique({
      where: { id: documentId },
      include: { supportPlan: { select: { institutionId: true } } },
    });
    if (!doc || doc.supportPlan.institutionId !== institutionId) {
      throw new ForbiddenException('El documento no pertenece a esta institución.');
    }
    return this.prisma.supportDocument.delete({ where: { id: documentId } });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORTES APD / PIAR
  // ═══════════════════════════════════════════════════════════════════════════

  async getReportByCategory(institutionId: string) {
    const profiles = await this.prisma.educationalSupportProfile.findMany({
      where: { institutionId },
      select: { supportCategory: true, active: true },
    });

    const categoryMap = new Map<string, { total: number; active: number; inactive: number }>();
    for (const p of profiles) {
      const cat = p.supportCategory || 'Sin categoría';
      const entry = categoryMap.get(cat) || { total: 0, active: 0, inactive: 0 };
      entry.total++;
      if (p.active) entry.active++;
      else entry.inactive++;
      categoryMap.set(cat, entry);
    }

    return {
      totalProfiles: profiles.length,
      categories: Array.from(categoryMap.entries())
        .map(([category, counts]) => ({ category, ...counts }))
        .sort((a, b) => b.total - a.total),
    };
  }

  async getReportProgress(institutionId: string) {
    const plans = await this.prisma.pedagogicalSupportPlan.findMany({
      where: { institutionId },
      select: {
        id: true,
        status: true,
        planType: true,
        progressPercentage: true,
        studentEnrollment: {
          select: {
            student: { select: { firstName: true, lastName: true } },
            group: { select: { name: true, grade: { select: { name: true } } } },
          },
        },
      },
    });

    const active = plans.filter(p => p.status === 'ACTIVE');
    const completed = plans.filter(p => p.status === 'COMPLETED');
    const lowProgress = active.filter(
      p => p.progressPercentage !== null && Number(p.progressPercentage) < 40,
    );

    return {
      totalPlans: plans.length,
      active: active.length,
      completed: completed.length,
      cancelled: plans.filter(p => p.status === 'CANCELLED').length,
      piarCount: plans.filter(p => p.planType === 'PIAR').length,
      apdCount: plans.filter(p => p.planType === 'APD').length,
      averageProgress: active.length > 0
        ? active.reduce((sum, p) => sum + Number(p.progressPercentage || 0), 0) / active.length
        : 0,
      lowProgressPlans: lowProgress.map(p => ({
        planId: p.id,
        studentName: `${p.studentEnrollment.student.lastName} ${p.studentEnrollment.student.firstName}`,
        group: p.studentEnrollment.group?.name,
        grade: p.studentEnrollment.group?.grade?.name,
        progress: Number(p.progressPercentage || 0),
      })),
    };
  }

  async getReportByGrade(institutionId: string) {
    const profiles = await this.prisma.educationalSupportProfile.findMany({
      where: { institutionId, active: true },
      include: {
        student: {
          include: {
            enrollments: {
              where: { status: 'ACTIVE' },
              take: 1,
              include: {
                group: { include: { grade: { select: { id: true, name: true } } } },
              },
            },
          },
        },
      },
    });

    const gradeMap = new Map<string, { gradeName: string; count: number }>();
    for (const p of profiles) {
      const enrollment = p.student.enrollments[0];
      const gradeId = enrollment?.group?.grade?.id || 'sin-grado';
      const gradeName = enrollment?.group?.grade?.name || 'Sin grado';
      const entry = gradeMap.get(gradeId) || { gradeName, count: 0 };
      entry.count++;
      gradeMap.set(gradeId, entry);
    }

    return {
      totalActiveProfiles: profiles.length,
      byGrade: Array.from(gradeMap.values()).sort((a, b) => a.gradeName.localeCompare(b.gradeName)),
    };
  }

  async getReportAtRisk(institutionId: string) {
    const now = new Date();

    // Planes con seguimiento vencido
    const overduePlans = await this.prisma.pedagogicalSupportPlan.findMany({
      where: {
        institutionId,
        status: 'ACTIVE',
        followUpDate: { lt: now },
      },
      include: {
        studentEnrollment: {
          include: {
            student: { select: { firstName: true, lastName: true } },
            group: { select: { name: true, grade: { select: { name: true } } } },
          },
        },
      },
    });

    // Planes activos sin actividades
    const plansWithoutActivities = await this.prisma.pedagogicalSupportPlan.findMany({
      where: {
        institutionId,
        status: 'ACTIVE',
        activities: { none: {} },
      },
      include: {
        studentEnrollment: {
          include: {
            student: { select: { firstName: true, lastName: true } },
            group: { select: { name: true, grade: { select: { name: true } } } },
          },
        },
      },
    });

    // Planes con bajo progreso (<40%)
    const lowProgress = await this.prisma.pedagogicalSupportPlan.findMany({
      where: {
        institutionId,
        status: 'ACTIVE',
        progressPercentage: { lt: 40 },
        activities: { some: {} },
      },
      include: {
        studentEnrollment: {
          include: {
            student: { select: { firstName: true, lastName: true } },
            group: { select: { name: true, grade: { select: { name: true } } } },
          },
        },
      },
    });

    const mapPlan = (p: any) => ({
      planId: p.id,
      studentName: `${p.studentEnrollment.student.lastName} ${p.studentEnrollment.student.firstName}`,
      group: p.studentEnrollment.group?.name,
      grade: p.studentEnrollment.group?.grade?.name,
      followUpDate: p.followUpDate,
      progress: p.progressPercentage ? Number(p.progressPercentage) : null,
    });

    return {
      overdueFollowUp: overduePlans.map(mapPlan),
      noActivities: plansWithoutActivities.map(mapPlan),
      lowProgress: lowProgress.map(mapPlan),
      summary: {
        overdueCount: overduePlans.length,
        noActivitiesCount: plansWithoutActivities.length,
        lowProgressCount: lowProgress.length,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ÍNDICE DE INCLUSIÓN INSTITUCIONAL (MEJORADO)
  // ═══════════════════════════════════════════════════════════════════════════

  async getInclusionIndex(institutionId: string) {
    const [
      totalStudents,
      profilesActive,
      profilesTotal,
      plans,
      activities,
      progressLogs,
      participants,
    ] = await Promise.all([
      this.prisma.student.count({ where: { institutionId, isActive: true } }),
      this.prisma.educationalSupportProfile.count({ where: { institutionId, active: true } }),
      this.prisma.educationalSupportProfile.count({ where: { institutionId } }),
      this.prisma.pedagogicalSupportPlan.findMany({
        where: { institutionId },
        select: { id: true, status: true, progressPercentage: true, planApprovedByFamily: true, createdAt: true },
      }),
      this.prisma.supportActivity.count({
        where: { supportPlan: { institutionId } },
      }),
      this.prisma.supportProgressLog.count({
        where: { supportPlan: { institutionId } },
      }),
      this.prisma.supportPlanParticipant.count({
        where: { supportPlan: { institutionId } },
      }),
    ]);

    const activePlans = plans.filter(p => p.status === 'ACTIVE');
    const completedPlans = plans.filter(p => p.status === 'COMPLETED');
    const plansWithFamilyApproval = plans.filter(p => p.planApprovedByFamily);

    // Métricas base
    const avgProgress = activePlans.length > 0
      ? activePlans.reduce((s, p) => s + Number(p.progressPercentage || 0), 0) / activePlans.length
      : 0;

    // Indicadores de calidad (0-100)
    const coverageRate = totalStudents > 0 ? (profilesActive / totalStudents) * 100 : 0;
    const completionRate = plans.length > 0 ? (completedPlans.length / plans.length) * 100 : 0;
    const familyEngagementRate = plans.length > 0 ? (plansWithFamilyApproval.length / plans.length) * 100 : 0;
    const activitiesPerPlan = plans.length > 0 ? activities / plans.length : 0;
    const activityScore = Math.min(100, activitiesPerPlan * 20); // 5 actividades = 100%
    const followUpScore = plans.length > 0 ? Math.min(100, (progressLogs / plans.length) * 25) : 0; // 4 logs = 100%
    const teamScore = plans.length > 0 ? Math.min(100, (participants / plans.length) * 33.33) : 0; // 3 participantes = 100%

    // Índice compuesto ponderado (más completo)
    // - Cobertura (20%): % de estudiantes con perfil activo
    // - Completitud (15%): % de planes completados
    // - Progreso (20%): promedio de progreso de planes activos
    // - Compromiso familiar (15%): % de planes con aprobación familiar
    // - Actividades (15%): promedio de actividades por plan
    // - Seguimiento (10%): frecuencia de registros de progreso
    // - Equipo (5%): participantes por plan
    const index = 
      (coverageRate * 0.20) +
      (completionRate * 0.15) +
      (avgProgress * 0.20) +
      (familyEngagementRate * 0.15) +
      (activityScore * 0.15) +
      (followUpScore * 0.10) +
      (teamScore * 0.05);

    // Tendencia: comparar planes del último mes vs anterior
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const plansLastMonth = plans.filter(p => new Date(p.createdAt) >= oneMonthAgo).length;
    const plansPrevMonth = plans.filter(p => new Date(p.createdAt) >= twoMonthsAgo && new Date(p.createdAt) < oneMonthAgo).length;
    const trend = plansPrevMonth > 0 
      ? ((plansLastMonth - plansPrevMonth) / plansPrevMonth) * 100 
      : plansLastMonth > 0 ? 100 : 0;

    return {
      // Datos básicos
      totalStudents,
      totalProfiles: profilesTotal,
      studentsWithActiveProfile: profilesActive,
      totalPlans: plans.length,
      activePlans: activePlans.length,
      completedPlans: completedPlans.length,
      
      // Métricas detalladas
      metrics: {
        coverageRate: Math.round(coverageRate * 100) / 100,
        completionRate: Math.round(completionRate * 100) / 100,
        averageProgress: Math.round(avgProgress * 100) / 100,
        familyEngagementRate: Math.round(familyEngagementRate * 100) / 100,
        activitiesPerPlan: Math.round(activitiesPerPlan * 100) / 100,
        totalActivities: activities,
        totalProgressLogs: progressLogs,
        totalParticipants: participants,
      },
      
      // Índice final
      index: Math.round(index * 100) / 100,
      inclusionIndex: Math.round(index * 100) / 100, // alias para compatibilidad
      level: index >= 70 ? 'ALTO' : index >= 40 ? 'MEDIO' : 'BAJO',
      
      // Tendencia
      trend: {
        plansLastMonth,
        plansPrevMonth,
        percentChange: Math.round(trend * 100) / 100,
        direction: trend > 5 ? 'UP' : trend < -5 ? 'DOWN' : 'STABLE',
      },
    };
  }
}
