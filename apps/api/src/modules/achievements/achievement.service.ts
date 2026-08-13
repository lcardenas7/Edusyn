import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AchievementService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // LOGROS ACADÉMICOS
  // ============================================

  /**
   * Helper: Obtener IDs de todas las asignaciones (actual + históricas) para el mismo grupo+materia+año.
   */
  private async getAllAssignmentIds(teacherAssignmentId: string): Promise<string[]> {
    const current = await this.prisma.teacherAssignment.findUnique({
      where: { id: teacherAssignmentId },
      select: { academicYearId: true, groupId: true, subjectId: true },
    });
    if (!current) return [teacherAssignmentId];
    const all = await this.prisma.teacherAssignment.findMany({
      where: {
        academicYearId: current.academicYearId,
        groupId: current.groupId,
        subjectId: current.subjectId,
      },
      select: { id: true },
    });
    return all.map(a => a.id);
  }

  async getAchievementsByAssignment(teacherAssignmentId: string, academicTermId: string) {
    const assignmentIds = await this.getAllAssignmentIds(teacherAssignmentId);
    const assignment = await this.prisma.teacherAssignment.findUnique({
      where: { id: teacherAssignmentId },
      select: {
        academicYearId: true,
        subjectId: true,
        group: { select: { gradeId: true } },
      },
    });
    if (!assignment) throw new NotFoundException('Asignación docente no encontrada');

    return this.prisma.achievement.findMany({
      where: {
        isPromotional: false,
        OR: [
          // Flujo tradicional: aprendizajes creados para la asignación y período.
          { teacherAssignmentId: { in: assignmentIds }, academicTermId },
          // Catálogo compartido: los propósitos anuales o del período aplican a
          // todos los grupos del mismo grado y dimensión.
          {
            teacherAssignmentId: null,
            gradeId: assignment.group.gradeId,
            subjectId: assignment.subjectId,
            academicYearId: assignment.academicYearId,
            OR: [{ academicTermId }, { academicTermId: null }],
          },
        ],
      },
      orderBy: { orderNumber: 'asc' },
      include: {
        studentAchievements: {
          where: { academicTermId },
          include: {
            studentEnrollment: {
              include: {
                student: true,
              },
            },
          },
        },
        attitudinalAchievements: true,
        levelDescriptors: true,
        evidences: { orderBy: { orderNumber: 'asc' } },
      },
    });
  }

  // ============================================
  // CATÁLOGO COMPARTIDO DE TRANSICIÓN (admin)
  // ============================================

  private async assertCatalogScope(data: {
    institutionId: string;
    gradeId: string;
    subjectId: string;
    academicYearId: string;
    academicTermId?: string | null;
  }) {
    const [grade, subject, academicYear, term] = await Promise.all([
      this.prisma.grade.findFirst({ where: { id: data.gradeId, institutionId: data.institutionId }, select: { id: true } }),
      this.prisma.subject.findFirst({ where: { id: data.subjectId, area: { institutionId: data.institutionId } }, select: { id: true, code: true, subjectType: true } }),
      this.prisma.academicYear.findFirst({ where: { id: data.academicYearId, institutionId: data.institutionId }, select: { id: true } }),
      data.academicTermId
        ? this.prisma.academicTerm.findFirst({ where: { id: data.academicTermId, academicYearId: data.academicYearId }, select: { id: true, order: true } })
        : Promise.resolve(null),
    ]);

    if (!grade || !subject || !academicYear) {
      throw new NotFoundException('El grado, dimensión o año académico no pertenece a la institución');
    }
    if (subject.subjectType !== 'PRESCHOOL_DIMENSION') {
      throw new BadRequestException('El catálogo compartido solo admite dimensiones de preescolar');
    }
    if (data.academicTermId && !term) {
      throw new BadRequestException('El período no pertenece al año académico seleccionado');
    }
    return { subject, term };
  }

  async getCatalogAchievements(data: {
    institutionId: string;
    gradeId: string;
    subjectId: string;
    academicYearId: string;
    academicTermId?: string;
  }) {
    await this.assertCatalogScope(data);
    return this.prisma.achievement.findMany({
      where: {
        institutionId: data.institutionId,
        gradeId: data.gradeId,
        subjectId: data.subjectId,
        academicYearId: data.academicYearId,
        academicTermId: data.academicTermId ?? null,
        teacherAssignmentId: null,
        isPromotional: false,
      },
      orderBy: { orderNumber: 'asc' },
      include: { evidences: { orderBy: { orderNumber: 'asc' } }, levelDescriptors: true },
    });
  }

  async createCatalogAchievement(data: {
    institutionId: string;
    gradeId: string;
    subjectId: string;
    academicYearId: string;
    academicTermId?: string;
    baseDescription: string;
    evidences?: Array<{ text: string }>;
    levelDescriptors?: Array<{ levelCode: string; text: string }>;
  }) {
    const description = data.baseDescription?.trim();
    if (!description) throw new BadRequestException('El propósito es obligatorio');
    const { subject, term } = await this.assertCatalogScope(data);
    const scope = {
      gradeId: data.gradeId,
      subjectId: data.subjectId,
      academicYearId: data.academicYearId,
      academicTermId: data.academicTermId ?? null,
      teacherAssignmentId: null,
      isPromotional: false,
    };
    const last = await this.prisma.achievement.findFirst({
      where: scope,
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });
    const orderNumber = (last?.orderNumber ?? 0) + 1;
    const subjectCode = (subject.code || 'DIM').slice(0, 8).toUpperCase();
    const periodCode = term ? `P${term.order}` : 'ANUAL';
    const evidences = (data.evidences ?? []).filter((e) => e.text?.trim());
    const descriptors = (data.levelDescriptors ?? []).filter((d) => d.levelCode && d.text?.trim());

    return this.prisma.achievement.create({
      data: {
        institutionId: data.institutionId,
        code: `PROP-${subjectCode}-${periodCode}-${String(orderNumber).padStart(2, '0')}`,
        ...scope,
        orderNumber,
        achievementType: 'ACADEMIC',
        baseDescription: description,
        ...(evidences.length ? { evidences: { create: evidences.map((e, index) => ({ text: e.text.trim(), orderNumber: index + 1 })) } } : {}),
        ...(descriptors.length ? { levelDescriptors: { create: descriptors.map((d) => ({ levelCode: d.levelCode, text: d.text.trim() })) } } : {}),
      },
      include: { evidences: { orderBy: { orderNumber: 'asc' } }, levelDescriptors: true },
    });
  }

  private async assertCatalogWritable(achievementId: string, canManageCatalog: boolean) {
    if (canManageCatalog) return;
    const achievement = await this.prisma.achievement.findUnique({
      where: { id: achievementId },
      select: { gradeId: true, teacherAssignmentId: true },
    });
    if (!achievement) throw new NotFoundException('Propósito no encontrado');
    if (achievement.gradeId && !achievement.teacherAssignmentId) {
      throw new ForbiddenException('Los propósitos del catálogo de Transición solo los puede editar el administrador o coordinador');
    }
  }

  async getPromotionalAchievements(teacherAssignmentId: string) {
    const assignmentIds = await this.getAllAssignmentIds(teacherAssignmentId);
    return this.prisma.achievement.findMany({
      where: {
        teacherAssignmentId: { in: assignmentIds },
        isPromotional: true,
      },
      include: {
        studentAchievements: {
          include: {
            studentEnrollment: {
              include: {
                student: true,
              },
            },
          },
        },
      },
    });
  }

  async createAchievement(data: {
    teacherAssignmentId: string;
    academicTermId: string;
    orderNumber: number;
    baseDescription: string;
    isPromotional?: boolean;
    achievementType?: 'ACADEMIC' | 'ATTITUDINAL' | 'PROMOTIONAL';
    levelDescriptors?: Array<{ levelCode: string; text: string }>;
    evidences?: Array<{ text: string }>;
  }) {
    // Generate code automatically
    const assignment = await this.prisma.teacherAssignment.findUnique({
      where: { id: data.teacherAssignmentId },
      include: {
        subject: true,
        academicYear: true,
      },
    });

    const term = await this.prisma.academicTerm.findUnique({
      where: { id: data.academicTermId },
    });

    // Generate code: LOG-[SUBJECT_CODE]-P[PERIOD]-[ORDER]
    const subjectCode = assignment?.subject?.name?.substring(0, 3).toUpperCase() || 'XXX';
    const periodOrder = term?.order || 1;
    const typePrefix = data.isPromotional ? 'PROM' : (data.achievementType === 'ATTITUDINAL' ? 'ACT' : 'LOG');
    const code = `${typePrefix}-${subjectCode}-P${periodOrder}-${String(data.orderNumber).padStart(2, '0')}`;

    const ta = await this.prisma.teacherAssignment.findUnique({ where: { id: data.teacherAssignmentId }, select: { institutionId: true } });
    const descriptors = (data.levelDescriptors ?? []).filter((d) => d.levelCode && d.text?.trim());
    const evidences = (data.evidences ?? []).filter((e) => e.text?.trim());
    return this.prisma.achievement.create({
      data: {
        institutionId: ta!.institutionId,
        code,
        teacherAssignmentId: data.teacherAssignmentId,
        academicTermId: data.academicTermId,
        orderNumber: data.orderNumber,
        achievementType: data.achievementType ?? 'ACADEMIC',
        baseDescription: data.baseDescription,
        isPromotional: data.isPromotional ?? false,
        ...(descriptors.length > 0
          ? { levelDescriptors: { create: descriptors.map((d) => ({ levelCode: d.levelCode, text: d.text.trim() })) } }
          : {}),
        ...(evidences.length > 0
          ? { evidences: { create: evidences.map((e, i) => ({ text: e.text.trim(), orderNumber: i + 1 })) } }
          : {}),
      },
      include: { levelDescriptors: true, evidences: { orderBy: { orderNumber: 'asc' } } },
    });
  }

  async updateAchievement(id: string, data: { baseDescription: string; levelDescriptors?: Array<{ levelCode: string; text: string }>; evidences?: Array<{ text: string }> }, canManageCatalog = true) {
    await this.assertCatalogWritable(id, canManageCatalog);
    // Reemplazo total de descriptores solo si el cliente los envía (undefined = no tocar).
    if (data.levelDescriptors !== undefined) {
      const descriptors = data.levelDescriptors.filter((d) => d.levelCode && d.text?.trim());
      await this.prisma.achievementLevelDescriptor.deleteMany({ where: { achievementId: id } });
      if (descriptors.length > 0) {
        await this.prisma.achievementLevelDescriptor.createMany({
          data: descriptors.map((d) => ({ achievementId: id, levelCode: d.levelCode, text: d.text.trim() })),
          skipDuplicates: true,
        });
      }
    }
    // Reemplazo total de evidencias solo si el cliente las envía (undefined = no tocar).
    if (data.evidences !== undefined) {
      const evidences = data.evidences.filter((e) => e.text?.trim());
      await this.prisma.achievementEvidence.deleteMany({ where: { achievementId: id } });
      if (evidences.length > 0) {
        await this.prisma.achievementEvidence.createMany({
          data: evidences.map((e, i) => ({ achievementId: id, text: e.text.trim(), orderNumber: i + 1 })),
        });
      }
    }
    return this.prisma.achievement.update({
      where: { id },
      data: { baseDescription: data.baseDescription },
      include: { levelDescriptors: true, evidences: { orderBy: { orderNumber: 'asc' } } },
    });
  }

  async deleteAchievement(id: string, canManageCatalog = true) {
    await this.assertCatalogWritable(id, canManageCatalog);
    return this.prisma.achievement.delete({
      where: { id },
    });
  }

  // ============================================
  // EVIDENCIAS DE APRENDIZAJE
  // ============================================

  async createEvidence(achievementId: string, text: string, canManageCatalog = true) {
    await this.assertCatalogWritable(achievementId, canManageCatalog);
    const clean = text?.trim();
    if (!clean) throw new BadRequestException('El texto de la evidencia es obligatorio');
    const last = await this.prisma.achievementEvidence.findFirst({
      where: { achievementId },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });
    return this.prisma.achievementEvidence.create({
      data: { achievementId, text: clean, orderNumber: (last?.orderNumber ?? 0) + 1 },
    });
  }

  async updateEvidence(id: string, data: { text?: string; isActive?: boolean }, canManageCatalog = true) {
    const evidence = await this.prisma.achievementEvidence.findUnique({ where: { id }, select: { achievementId: true } });
    if (!evidence) throw new NotFoundException('Imprescindible no encontrado');
    await this.assertCatalogWritable(evidence.achievementId, canManageCatalog);
    const updateData: any = {};
    if (data.text !== undefined) {
      const clean = data.text.trim();
      if (!clean) throw new BadRequestException('El texto de la evidencia es obligatorio');
      updateData.text = clean;
    }
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    return this.prisma.achievementEvidence.update({ where: { id }, data: updateData });
  }

  async deleteEvidence(id: string, canManageCatalog = true) {
    const evidence = await this.prisma.achievementEvidence.findUnique({ where: { id }, select: { achievementId: true } });
    if (!evidence) throw new NotFoundException('Imprescindible no encontrado');
    await this.assertCatalogWritable(evidence.achievementId, canManageCatalog);
    return this.prisma.achievementEvidence.delete({ where: { id } });
  }

  /** Reordena las evidencias de un aprendizaje según el arreglo de IDs recibido. */
  async reorderEvidences(achievementId: string, orderedIds: string[], canManageCatalog = true) {
    await this.assertCatalogWritable(achievementId, canManageCatalog);
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.achievementEvidence.updateMany({
          where: { id, achievementId },
          data: { orderNumber: index + 1 },
        }),
      ),
    );
    return this.prisma.achievementEvidence.findMany({
      where: { achievementId },
      orderBy: { orderNumber: 'asc' },
    });
  }

  /** Duplica un aprendizaje con sus evidencias y descriptores de nivel (sin las valoraciones de estudiantes). */
  async duplicateAchievement(id: string) {
    const source = await this.prisma.achievement.findUnique({
      where: { id },
      include: { levelDescriptors: true, evidences: { orderBy: { orderNumber: 'asc' } } },
    });
    if (!source) throw new NotFoundException('Aprendizaje no encontrado');

    // Siguiente orderNumber disponible para la misma asignación/período/tipo promocional.
    const last = await this.prisma.achievement.findFirst({
      where: {
        teacherAssignmentId: source.teacherAssignmentId,
        academicTermId: source.academicTermId,
        isPromotional: source.isPromotional,
      },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });
    const nextOrder = (last?.orderNumber ?? 0) + 1;
    const code = `${source.code}-COPIA-${nextOrder}`;

    return this.prisma.achievement.create({
      data: {
        institutionId: source.institutionId,
        code,
        teacherAssignmentId: source.teacherAssignmentId,
        academicTermId: source.academicTermId,
        orderNumber: nextOrder,
        achievementType: source.achievementType,
        baseDescription: source.baseDescription,
        isPromotional: source.isPromotional,
        ...(source.levelDescriptors.length > 0
          ? { levelDescriptors: { create: source.levelDescriptors.map((d) => ({ levelCode: d.levelCode, text: d.text })) } }
          : {}),
        ...(source.evidences.length > 0
          ? { evidences: { create: source.evidences.map((e) => ({ text: e.text, orderNumber: e.orderNumber, isActive: e.isActive })) } }
          : {}),
      },
      include: { levelDescriptors: true, evidences: { orderBy: { orderNumber: 'asc' } } },
    });
  }

  // ============================================
  // LOGROS ACTITUDINALES
  // ============================================

  async getAttitudinalAchievements(teacherAssignmentId: string, academicTermId: string) {
    const assignmentIds = await this.getAllAssignmentIds(teacherAssignmentId);
    return this.prisma.attitudinalAchievement.findMany({
      where: {
        teacherAssignmentId: { in: assignmentIds },
        academicTermId,
      },
      include: {
        achievement: true,
      },
    });
  }

  async upsertAttitudinalAchievement(data: {
    teacherAssignmentId: string;
    academicTermId: string;
    achievementId?: string; // null = general per period
    description: string;
  }) {
    // Check if exists
    const existing = await this.prisma.attitudinalAchievement.findFirst({
      where: {
        teacherAssignmentId: data.teacherAssignmentId,
        academicTermId: data.academicTermId,
        achievementId: data.achievementId ?? null,
      },
    });

    if (existing) {
      return this.prisma.attitudinalAchievement.update({
        where: { id: existing.id },
        data: { description: data.description },
      });
    }

    const ta2 = await this.prisma.teacherAssignment.findUnique({ where: { id: data.teacherAssignmentId }, select: { institutionId: true } });
    return this.prisma.attitudinalAchievement.create({
      data: {
        institutionId: ta2!.institutionId,
        teacherAssignmentId: data.teacherAssignmentId,
        academicTermId: data.academicTermId,
        achievementId: data.achievementId,
        description: data.description,
      },
    });
  }

  // ============================================
  // LOGROS DE ESTUDIANTES
  // ============================================

  async getStudentAchievements(achievementId: string) {
    return this.prisma.studentAchievement.findMany({
      where: { achievementId },
      include: {
        studentEnrollment: {
          include: {
            student: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async getStudentAchievementsByEnrollment(studentEnrollmentId: string, academicTermId?: string) {
    const whereClause: any = { studentEnrollmentId };
    
    if (academicTermId) {
      whereClause.academicTermId = academicTermId;
    }

    return this.prisma.studentAchievement.findMany({
      where: whereClause,
      include: {
        achievement: {
          include: {
            teacherAssignment: {
              include: {
                subject: true,
              },
            },
          },
        },
      },
    });
  }

  async generateStudentAchievementSuggestion(
    achievementId: string,
    studentEnrollmentId: string,
    performanceLevel: 'BAJO' | 'BASICO' | 'ALTO' | 'SUPERIOR',
    institutionId: string,
  ) {
    // Get the base achievement
    const achievement = await this.prisma.achievement.findUnique({
      where: { id: achievementId },
    });

    if (!achievement) {
      throw new NotFoundException('Logro no encontrado');
    }

    // Get value judgment template
    const config = await this.prisma.achievementConfig.findUnique({
      where: { institutionId },
      include: {
        valueJudgmentTemplates: {
          where: { level: performanceLevel, isActive: true },
        },
      },
    });

    // Generate suggested text based on performance level
    const baseText = achievement.baseDescription;
    let suggestedText = baseText;

    // Modify text based on performance level
    switch (performanceLevel) {
      case 'BAJO':
        suggestedText = `Presenta dificultades en: ${baseText.toLowerCase()}`;
        break;
      case 'BASICO':
        suggestedText = `Desarrolla parcialmente: ${baseText.toLowerCase()}`;
        break;
      case 'ALTO':
      case 'SUPERIOR':
        suggestedText = baseText; // Keep original for high performers
        break;
    }

    // Get judgment template
    const judgmentTemplate = config?.valueJudgmentTemplates?.[0]?.template || '';

    return {
      suggestedText,
      suggestedJudgment: judgmentTemplate,
    };
  }

  async updateStudentObservation(id: string, observation: string) {
    return this.prisma.studentAchievement.update({
      where: { id },
      data: { observation },
    });
  }

  async upsertStudentAchievement(data: {
    studentEnrollmentId: string;
    achievementId: string;
    academicTermId?: string; // período de la valoración (para aprendizajes anuales/compartidos)
    performanceLevel: 'BAJO' | 'BASICO' | 'ALTO' | 'SUPERIOR';
    suggestedText?: string;
    approvedText?: string;
    isTextApproved?: boolean;
    suggestedJudgment?: string;
    approvedJudgment?: string;
    isJudgmentApproved?: boolean;
    attitudinalText?: string;
    observation?: string;
    approvedById?: string;
  }) {
    // Resolver el período de la valoración: explícito, o el del aprendizaje (por-período).
    let academicTermId = data.academicTermId ?? null;
    if (!academicTermId) {
      const ach = await this.prisma.achievement.findUnique({
        where: { id: data.achievementId },
        select: { academicTermId: true },
      });
      academicTermId = ach?.academicTermId ?? null;
    }
    if (!academicTermId) {
      throw new BadRequestException('El período de la valoración es obligatorio para aprendizajes anuales o compartidos');
    }

    const existing = await this.prisma.studentAchievement.findFirst({
      where: {
        studentEnrollmentId: data.studentEnrollmentId,
        achievementId: data.achievementId,
        academicTermId,
      },
    });

    const updateData: any = {
      performanceLevel: data.performanceLevel,
    };

    if (data.suggestedText !== undefined) updateData.suggestedText = data.suggestedText;
    if (data.approvedText !== undefined) updateData.approvedText = data.approvedText;
    if (data.isTextApproved !== undefined) updateData.isTextApproved = data.isTextApproved;
    if (data.suggestedJudgment !== undefined) updateData.suggestedJudgment = data.suggestedJudgment;
    if (data.approvedJudgment !== undefined) updateData.approvedJudgment = data.approvedJudgment;
    if (data.isJudgmentApproved !== undefined) updateData.isJudgmentApproved = data.isJudgmentApproved;
    if (data.attitudinalText !== undefined) updateData.attitudinalText = data.attitudinalText;
    if (data.observation !== undefined) updateData.observation = data.observation;

    // If approving, set approval metadata
    if (data.isTextApproved && data.isJudgmentApproved && data.approvedById) {
      updateData.approvedAt = new Date();
      updateData.approvedById = data.approvedById;
    }

    if (existing) {
      return this.prisma.studentAchievement.update({
        where: { id: existing.id },
        data: updateData,
      });
    }

    const enr = await this.prisma.studentEnrollment.findUnique({ where: { id: data.studentEnrollmentId }, select: { institutionId: true } });
    return this.prisma.studentAchievement.create({
      data: {
        institutionId: enr!.institutionId,
        studentEnrollmentId: data.studentEnrollmentId,
        achievementId: data.achievementId,
        academicTermId,
        performanceLevel: data.performanceLevel,
        suggestedText: data.suggestedText,
        approvedText: data.approvedText,
        isTextApproved: data.isTextApproved ?? false,
        suggestedJudgment: data.suggestedJudgment,
        approvedJudgment: data.approvedJudgment,
        isJudgmentApproved: data.isJudgmentApproved ?? false,
        attitudinalText: data.attitudinalText,
      },
    });
  }

  async approveStudentAchievement(
    id: string,
    approvedById: string,
    data: {
      approvedText: string;
      approvedJudgment?: string;
    },
  ) {
    return this.prisma.studentAchievement.update({
      where: { id },
      data: {
        approvedText: data.approvedText,
        isTextApproved: true,
        approvedJudgment: data.approvedJudgment,
        isJudgmentApproved: !!data.approvedJudgment,
        approvedAt: new Date(),
        approvedById,
      },
    });
  }

  // ============================================
  // BULK OPERATIONS
  // ============================================

  async bulkGenerateSuggestions(
    achievementId: string,
    institutionId: string,
    studentGrades: Array<{
      studentEnrollmentId: string;
      finalGrade: number;
    }>,
    academicTermId?: string,
  ) {
    // Get performance scale
    const scales = await this.prisma.performanceScale.findMany({
      where: { institutionId },
      orderBy: { minScore: 'asc' },
    });

    const results = await Promise.all(
      studentGrades.map(async (sg) => {
        // Determine performance level from grade
        const level = this.getPerformanceLevelFromGrade(sg.finalGrade, scales);
        
        // Generate suggestion
        const suggestion = await this.generateStudentAchievementSuggestion(
          achievementId,
          sg.studentEnrollmentId,
          level,
          institutionId,
        );

        // Save to database
        return this.upsertStudentAchievement({
          studentEnrollmentId: sg.studentEnrollmentId,
          achievementId,
          academicTermId,
          performanceLevel: level,
          suggestedText: suggestion.suggestedText,
          suggestedJudgment: suggestion.suggestedJudgment,
        });
      }),
    );

    return results;
  }

  private getPerformanceLevelFromGrade(
    grade: number,
    scales: Array<{ level: string; minScore: any; maxScore: any }>,
  ): 'BAJO' | 'BASICO' | 'ALTO' | 'SUPERIOR' {
    for (const scale of scales) {
      const min = Number(scale.minScore);
      const max = Number(scale.maxScore);
      if (grade >= min && grade <= max) {
        return scale.level as 'BAJO' | 'BASICO' | 'ALTO' | 'SUPERIOR';
      }
    }
    // Default to BAJO if no match
    return 'BAJO';
  }

  // ============================================
  // BULK ASSIGN & AUTO-FILL OBSERVATION
  // ============================================

  async bulkAssignAchievement(
    achievementId: string,
    studentEnrollmentIds: string[],
    institutionId: string,
    academicTermId?: string,
  ) {
    // Get performance scales for the institution
    const scales = await this.prisma.performanceScale.findMany({
      where: { institutionId },
      orderBy: { minScore: 'asc' },
    });

    // Get the achievement to know its assignment/term for fetching grades
    const achievement = await this.prisma.achievement.findUnique({
      where: { id: achievementId },
      include: { teacherAssignment: true },
    });

    if (!achievement) {
      throw new NotFoundException('Logro no encontrado');
    }
    const valuationTermId = academicTermId ?? achievement.academicTermId;
    if (!valuationTermId) {
      throw new BadRequestException('El período de la valoración es obligatorio para aprendizajes anuales o compartidos');
    }

    // Get existing final grades for these students (solo aplica a aprendizajes por-período
    // ligados a una asignación/asignatura; los aprendizajes anuales/compartidos no usan nota).
    const subjectId = achievement.teacherAssignment?.subjectId ?? achievement.subjectId ?? null;
    const gradeMap = new Map<string, number>();
    if (achievement.academicTermId && subjectId) {
      const finalGrades = await this.prisma.periodFinalGrade.findMany({
        where: {
          studentEnrollment: { id: { in: studentEnrollmentIds } },
          academicTermId: achievement.academicTermId,
          subjectId,
        },
        include: { studentEnrollment: true },
      });
      for (const fg of finalGrades) {
        gradeMap.set(fg.studentEnrollmentId, Number(fg.finalScore));
      }
    }

    const results = await Promise.all(
      studentEnrollmentIds.map(async (enrollmentId) => {
        const grade = gradeMap.get(enrollmentId) || 0;
        const level = this.getPerformanceLevelFromGrade(grade, scales);

        return this.upsertStudentAchievement({
          studentEnrollmentId: enrollmentId,
          achievementId,
          academicTermId: valuationTermId,
          performanceLevel: level as any,
        });
      }),
    );

    return results;
  }

  async autoFillObservations(
    achievementId: string,
    institutionId: string,
  ) {
    // Get observation templates for this institution
    const config = await this.prisma.achievementConfig.findUnique({
      where: { institutionId },
      include: {
        observationTemplates: {
          where: { isActive: true },
        },
      },
    });

    const templateMap = new Map<string, string>();
    for (const t of config?.observationTemplates || []) {
      templateMap.set(t.level, t.template);
    }

    // Get all student achievements for this achievement
    const studentAchievements = await this.prisma.studentAchievement.findMany({
      where: { achievementId },
    });

    const results = await Promise.all(
      studentAchievements.map(async (sa) => {
        const template = templateMap.get(sa.performanceLevel);
        if (template) {
          return this.prisma.studentAchievement.update({
            where: { id: sa.id },
            data: { observation: template },
          });
        }
        return sa;
      }),
    );

    return results;
  }

  // ============================================
  // VALIDATION
  // ============================================

  async validatePeriodAchievements(
    teacherAssignmentId: string,
    academicTermId: string,
    requiredCount: number,
  ) {
    const assignmentIds = await this.getAllAssignmentIds(teacherAssignmentId);
    const achievements = await this.prisma.achievement.findMany({
      where: {
        teacherAssignmentId: { in: assignmentIds },
        academicTermId,
        isPromotional: false,
      },
    });

    const missingCount = requiredCount - achievements.length;
    
    return {
      isComplete: missingCount <= 0,
      currentCount: achievements.length,
      requiredCount,
      missingCount: Math.max(0, missingCount),
    };
  }

  async getUnapprovedStudentAchievements(teacherAssignmentId: string, academicTermId: string) {
    const assignmentIds = await this.getAllAssignmentIds(teacherAssignmentId);
    return this.prisma.studentAchievement.findMany({
      where: {
        achievement: {
          teacherAssignmentId: { in: assignmentIds },
          academicTermId,
        },
        OR: [
          { isTextApproved: false },
          { isJudgmentApproved: false },
        ],
      },
      include: {
        studentEnrollment: {
          include: {
            student: true,
          },
        },
        achievement: true,
      },
    });
  }
}
