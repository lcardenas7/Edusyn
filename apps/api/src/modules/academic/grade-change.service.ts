import { Injectable, BadRequestException, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GradeStage, EnrollmentMovementType } from '@prisma/client';
import { ChangeGradeDto, ValidateGradeChangeDto, GradeChangeType } from './dto/grade-change.dto';
import { AttendanceService } from '../attendance/attendance.service';
import { StudentGradesService } from '../evaluation/student-grades.service';
import { InstitutionContextService } from '../institution-context/institution-context.service';
import { evaluatePromotion, type StudentPromotionData } from '../../engines/promotion.engine';
import type { InstitutionRulesContext } from '../../engines/InstitutionRulesContext';

@Injectable()
export class GradeChangeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceService: AttendanceService,
    private readonly studentGradesService: StudentGradesService,
    private readonly institutionContext: InstitutionContextService,
  ) {}

  /**
   * Valida si un cambio de grado es permitido
   */
  async validateGradeChange(dto: ValidateGradeChangeDto) {
    const enrollment = await this.prisma.studentEnrollment.findUnique({
      where: { id: dto.enrollmentId },
      include: {
        student: true,
        group: {
          include: {
            grade: true,
          },
        },
        academicYear: true,
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Matrícula no encontrada');
    }

    if (enrollment.status !== 'ACTIVE') {
      throw new BadRequestException(`No se puede modificar una matrícula en estado ${enrollment.status}`);
    }

    const rulesCtx = await this.institutionContext.getContext(enrollment.institutionId);

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

    // Validar cupo
    if (newGroup.maxCapacity !== null) {
      const currentEnrollments = newGroup._count.studentEnrollments;
      if (currentEnrollments >= newGroup.maxCapacity) {
        throw new ConflictException(
          `El grupo ${newGroup.name} ha alcanzado su cupo máximo (${newGroup.maxCapacity} estudiantes)`
        );
      }
    }

    // Determinar tipo de cambio
    const gradeChangeType = this.determineGradeChangeType(
      enrollment.group.grade,
      newGroup.grade
    );

    const promotionAssessment = gradeChangeType === GradeChangeType.PROMOTION
      ? await this.buildPromotionAssessment(enrollment, rulesCtx)
      : null;

    // Validaciones según el tipo de cambio
    const validation = await this.validateGradeChangeRules(
      enrollment,
      newGroup,
      gradeChangeType,
      rulesCtx,
      promotionAssessment,
    );

    return {
      canChange: validation.allowed,
      gradeChangeType,
      currentGrade: enrollment.group.grade,
      newGrade: newGroup.grade,
      warnings: validation.warnings,
      requirements: validation.requirements,
      restrictions: validation.restrictions,
    };
  }

  /**
   * Ejecuta el cambio de grado/grupo con todas las validaciones
   */
  async changeGrade(dto: ChangeGradeDto) {
    // Primero validar
    const validation = await this.validateGradeChange({
      enrollmentId: dto.enrollmentId,
      newGroupId: dto.newGroupId,
    });

    if (!validation.canChange) {
      throw new BadRequestException(
        `Cambio no permitido: ${validation.restrictions.join(', ')}`
      );
    }

    const enrollment = await this.prisma.studentEnrollment.findUnique({
      where: { id: dto.enrollmentId },
      include: {
        group: { include: { grade: true } },
        student: true,
      },
    });

    const newGroup = await this.prisma.group.findUnique({
      where: { id: dto.newGroupId },
      include: { grade: true },
    });

    // Para promociones/demociones, verificar acta si es requerida
    if (dto.gradeChangeType !== GradeChangeType.SAME_GRADE && !dto.academicActId) {
      throw new BadRequestException(
        'Para cambios de grado se requiere el ID de un acta académica que respalde la decisión'
      );
    }

    // Verificar que el acta exista y esté aprobada
    if (dto.academicActId) {
      const act = await this.prisma.academicAct.findUnique({
        where: { id: dto.academicActId },
      });

      if (!act || act.approvalDate === null) {
        throw new BadRequestException('El acta académica no existe o no está aprobada');
      }
    }

    // Ejecutar el cambio
    const previousGroupId = enrollment!.groupId;
    const previousGradeId = enrollment!.group.gradeId;

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
            shift: true,
          },
        },
      },
    });

    // Crear evento de auditoría
    await this.createGradeChangeEvent({
      enrollmentId: dto.enrollmentId,
      type: 'GROUP_CHANGED',
      previousValue: {
        groupId: previousGroupId,
        gradeId: previousGradeId,
        groupName: enrollment!.group.name,
        gradeName: enrollment!.group.grade.name,
      },
      newValue: {
        groupId: dto.newGroupId,
        gradeId: newGroup!.gradeId,
        groupName: newGroup!.name,
        gradeName: newGroup!.grade.name,
      },
      reason: dto.reason,
      observations: dto.observations,
      movementType: dto.movementType,
      academicActId: dto.academicActId,
      performedById: dto.performedById,
    });

    return updatedEnrollment;
  }

  /**
   * Determina el tipo de cambio de grado
   */
  private determineGradeChangeType(currentGrade: any, newGrade: any): GradeChangeType {
    // Mismo grado
    if (currentGrade.id === newGrade.id) {
      return GradeChangeType.SAME_GRADE;
    }

    // Obtener orden numérico para comparar
    const currentOrder = this.getGradeOrder(currentGrade);
    const newOrder = this.getGradeOrder(newGrade);

    if (newOrder > currentOrder) {
      return GradeChangeType.PROMOTION;
    } else if (newOrder < currentOrder) {
      return GradeChangeType.DEMOTION;
    }

    return GradeChangeType.SAME_GRADE;
  }

  /**
   * Obtiene un valor numérico para ordenar los grados
   */
  private getGradeOrder(grade: any): number {
    const stageOrder = {
      [GradeStage.PREESCOLAR]: 0,
      [GradeStage.BASICA_PRIMARIA]: 100,
      [GradeStage.BASICA_SECUNDARIA]: 200,
      [GradeStage.MEDIA]: 300,
    };

    const baseOrder = stageOrder[grade.stage] || 0;
    return baseOrder + (grade.number || 0);
  }

  /**
   * Valida las reglas para el cambio de grado
   */
  private async validateGradeChangeRules(
    enrollment: any,
    newGroup: any,
    gradeChangeType: GradeChangeType,
    rulesCtx: InstitutionRulesContext,
    promotionAssessment: Awaited<ReturnType<GradeChangeService['buildPromotionAssessment']>> | null = null,
  ) {
    const warnings: string[] = [];
    const requirements: string[] = [];
    const restrictions: string[] = [];

    // Regla 1: No se permite cambiar a grados inferiores sin justificación muy fuerte
    if (gradeChangeType === GradeChangeType.DEMOTION) {
      restrictions.push(
        'No se permite rebajar de grado sin autorización del consejo académico y acta firmada'
      );
      requirements.push(
        'Requiere acta de consejo académico aprobada',
        'Requiere autorización del rector y coordinador académico',
        'Requiere consentimiento firmado de acudientes'
      );
    }

    // Regla 2: Promociones anticipadas requieren evaluación especial
    if (gradeChangeType === GradeChangeType.PROMOTION) {
      if (!promotionAssessment) {
        restrictions.push('No fue posible calcular la promoción con el contexto académico actual');
      } else if (!promotionAssessment.hasAcademicData && rulesCtx.academicStructure !== 'DIMENSIONS') {
        restrictions.push('No hay suficientes notas académicas para evaluar la promoción');
      } else if (promotionAssessment.result.status === 'NOT_PROMOTED') {
        restrictions.push(...promotionAssessment.result.reasons);
      } else if (promotionAssessment.result.status === 'AT_RISK') {
        warnings.push(
          ...promotionAssessment.result.reasons,
        );
        requirements.push(
          'Requiere evaluación psicoacadémica',
          'Requiere autorización del consejo académico',
          'Requiere consentimiento de acudientes'
        );
      } else {
        requirements.push(
          'Requiere evaluación de desempeño superior',
          'Requiere autorización del coordinador académico'
        );
      }
    }

    // Regla 3: Cambios entre etapas educativas requieren validación adicional
    const currentStage = enrollment.group.grade.stage;
    const newStage = newGroup.grade.stage;

    if (currentStage !== newStage) {
      requirements.push(
        'Requiere validación de competencias mínimas de la nueva etapa',
        'Requiere autorización del rector'
      );

      // Transición especial: Preescolar a Primaria
      if (currentStage === GradeStage.PREESCOLAR && newStage === GradeStage.BASICA_PRIMARIA) {
        requirements.push('Requiere certificado de desarrollo infantil');
      }

      // Transición especial: Secundaria a Media
      if (currentStage === GradeStage.BASICA_SECUNDARIA && newStage === GradeStage.MEDIA) {
        requirements.push('Requiere evaluación de vocación y aptitudes');
      }
    }

    // Regla 4: Validar rendimiento académico si hay datos disponibles
    if (gradeChangeType === GradeChangeType.PROMOTION && promotionAssessment && promotionAssessment.result.status !== 'PROMOTED') {
      // La evaluación ya marcó las restricciones/warnings arriba.
      // Aquí solo evitamos que la validación pase silenciosamente si no hay datos.
      if (!promotionAssessment.hasAcademicData && rulesCtx.academicStructure !== 'DIMENSIONS') {
        restrictions.push('Promoción bloqueada por falta de datos académicos');
      }
    }

    return {
      allowed: restrictions.length === 0,
      warnings,
      requirements,
      restrictions,
    };
  }

  private async buildPromotionAssessment(enrollment: any, rulesCtx: InstitutionRulesContext) {
    const teacherAssignments = await this.prisma.teacherAssignment.findMany({
      where: {
        groupId: enrollment.groupId,
        academicYearId: enrollment.academicYearId,
      },
      include: {
        subject: true,
      },
    });

    const annualGrades = await Promise.all(
      teacherAssignments.map(async (assignment) => {
        const result = await this.studentGradesService.calculateAnnualGrade(
          enrollment.id,
          assignment.id,
          enrollment.academicYearId,
        );

        return {
          teacherAssignmentId: assignment.id,
          subjectName: assignment.subject?.name || 'Sin asignatura',
          annualGrade: result.annualGrade,
        };
      }),
    );

    const validGrades = annualGrades.filter((entry) => entry.annualGrade !== null);
    const finalAverage = validGrades.length > 0
      ? Math.round((validGrades.reduce((sum, entry) => sum + entry.annualGrade!, 0) / validGrades.length) * 10) / 10
      : 0;

    const failedSubjectNames = annualGrades
      .filter((entry) => entry.annualGrade === null || entry.annualGrade < rulesCtx.minPassingGrade)
      .map((entry) => entry.subjectName);

    const attendance = await this.attendanceService.getStudentSummary(enrollment.id);

    const promotionData: StudentPromotionData = {
      studentId: enrollment.studentId,
      studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
      finalAverage,
      failedSubjectsCount: failedSubjectNames.length,
      failedSubjectNames,
      attendancePercent: attendance.attendanceRate,
    };

    return {
      annualGrades,
      hasAcademicData: annualGrades.length > 0 && validGrades.length > 0,
      finalAverage,
      failedSubjectNames,
      attendance,
      promotionData,
      result: evaluatePromotion(promotionData, rulesCtx),
    };
  }

  /**
   * Crea un evento de auditoría para el cambio de grado
   */
  private async createGradeChangeEvent(data: {
    enrollmentId: string;
    type: string;
    previousValue: any;
    newValue: any;
    reason: string;
    observations?: string;
    movementType: EnrollmentMovementType;
    academicActId?: string;
    performedById?: string;
  }) {
    if (!data.performedById) {
      throw new BadRequestException('No se pudo determinar el usuario que realiza el cambio de grado');
    }
    const enr = await this.prisma.studentEnrollment.findUnique({ where: { id: data.enrollmentId }, select: { institutionId: true } });
    await this.prisma.enrollmentEvent.create({
      data: {
        institutionId: enr!.institutionId,
        enrollmentId: data.enrollmentId,
        type: data.type as any,
        previousValue: data.previousValue,
        newValue: data.newValue,
        reason: data.reason,
        observations: data.observations,
        movementType: data.movementType,
        academicActId: data.academicActId,
        performedById: data.performedById, // usuario autenticado (FK a User)
        performedAt: new Date(),
      },
    });
  }
}
