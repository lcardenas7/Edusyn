import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AchievementService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // LOGROS ACADÉMICOS
  // ============================================

  async getAchievementsByAssignment(teacherAssignmentId: string, academicTermId: string) {
    return this.prisma.achievement.findMany({
      where: {
        teacherAssignmentId,
        academicTermId,
        isPromotional: false,
      },
      orderBy: { orderNumber: 'asc' },
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
        attitudinalAchievements: true,
      },
    });
  }

  async getPromotionalAchievements(teacherAssignmentId: string) {
    return this.prisma.achievement.findMany({
      where: {
        teacherAssignmentId,
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
      },
    });
  }

  async updateAchievement(id: string, data: { baseDescription: string }) {
    return this.prisma.achievement.update({
      where: { id },
      data: { baseDescription: data.baseDescription },
    });
  }

  async deleteAchievement(id: string) {
    return this.prisma.achievement.delete({
      where: { id },
    });
  }

  // ============================================
  // LOGROS ACTITUDINALES
  // ============================================

  async getAttitudinalAchievements(teacherAssignmentId: string, academicTermId: string) {
    return this.prisma.attitudinalAchievement.findMany({
      where: {
        teacherAssignmentId,
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
      whereClause.achievement = { academicTermId };
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
    const existing = await this.prisma.studentAchievement.findUnique({
      where: {
        studentEnrollmentId_achievementId: {
          studentEnrollmentId: data.studentEnrollmentId,
          achievementId: data.achievementId,
        },
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

    // Get existing final grades for these students
    const finalGrades = await this.prisma.periodFinalGrade.findMany({
      where: {
        studentEnrollment: { id: { in: studentEnrollmentIds } },
        academicTermId: achievement.academicTermId,
        subjectId: achievement.teacherAssignment.subjectId,
      },
      include: { studentEnrollment: true },
    });

    const gradeMap = new Map<string, number>();
    for (const fg of finalGrades) {
      gradeMap.set(fg.studentEnrollmentId, Number(fg.finalScore));
    }

    const results = await Promise.all(
      studentEnrollmentIds.map(async (enrollmentId) => {
        const grade = gradeMap.get(enrollmentId) || 0;
        const level = this.getPerformanceLevelFromGrade(grade, scales);

        return this.prisma.studentAchievement.upsert({
          where: {
            studentEnrollmentId_achievementId: {
              studentEnrollmentId: enrollmentId,
              achievementId,
            },
          },
          update: {
            performanceLevel: level,
          },
          create: {
            institutionId: (await this.prisma.studentEnrollment.findUnique({ where: { id: enrollmentId }, select: { institutionId: true } }))!.institutionId,
            studentEnrollmentId: enrollmentId,
            achievementId,
            performanceLevel: level,
          },
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
    const achievements = await this.prisma.achievement.findMany({
      where: {
        teacherAssignmentId,
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
    return this.prisma.studentAchievement.findMany({
      where: {
        achievement: {
          teacherAssignmentId,
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
