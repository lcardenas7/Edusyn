import { Injectable, BadRequestException, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GradeStage, EnrollmentMovementType } from '@prisma/client';
import { ChangeGradeDto, ValidateGradeChangeDto, GradeChangeType } from './dto/grade-change.dto';

@Injectable()
export class GradeChangeService {
  constructor(private readonly prisma: PrismaService) {}

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

    // Validaciones según el tipo de cambio
    const validation = await this.validateGradeChangeRules(
      enrollment,
      newGroup,
      gradeChangeType
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
      type: 'GRADE_CHANGED',
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
    gradeChangeType: GradeChangeType
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
      // Verificar si ya hay tiempo suficiente en el año académico
      const academicYear = enrollment.academicYear;
      const now = new Date();
      const yearProgress = this.calculateYearProgress(now, academicYear);

      if (yearProgress < 0.5) {
        warnings.push(
          'Promoción anticipada antes de mitad de año lectivo. Se recomienda esperar.'
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
    const hasGrades = await this.checkStudentGrades(enrollment.id);
    if (hasGrades && gradeChangeType === GradeChangeType.PROMOTION) {
      const average = await this.calculateStudentAverage(enrollment.id);
      if (average < 4.0) {
        restrictions.push(
          'Promedio académico insuficiente para promoción anticipada'
        );
      }
    }

    return {
      allowed: restrictions.length === 0,
      warnings,
      requirements,
      restrictions,
    };
  }

  /**
   * Calcula el progreso del año lectivo (0 a 1)
   */
  private calculateYearProgress(currentDate: Date, academicYear: any): number {
    if (!academicYear.startDate || !academicYear.endDate) {
      return 0.5; // Sin fechas, asumir mitad de año
    }

    const start = new Date(academicYear.startDate);
    const end = new Date(academicYear.endDate);
    const total = end.getTime() - start.getTime();
    const elapsed = currentDate.getTime() - start.getTime();

    return Math.max(0, Math.min(1, elapsed / total));
  }

  /**
   * Verifica si el estudiante tiene notas registradas
   */
  private async checkStudentGrades(enrollmentId: string): Promise<boolean> {
    const gradeCount = await this.prisma.studentGrade.count({
      where: { studentEnrollmentId: enrollmentId },
    });

    return gradeCount > 0;
  }

  /**
   * Calcula el promedio del estudiante
   */
  private async calculateStudentAverage(enrollmentId: string): Promise<number> {
    const grades = await this.prisma.studentGrade.findMany({
      where: { studentEnrollmentId: enrollmentId },
      select: { score: true },
    });

    if (grades.length === 0) return 0;

    const sum = grades.reduce((acc, grade) => acc + Number(grade.score), 0);
    return sum / grades.length;
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
  }) {
    await this.prisma.enrollmentEvent.create({
      data: {
        enrollmentId: data.enrollmentId,
        type: data.type as any,
        previousValue: data.previousValue,
        newValue: data.newValue,
        reason: data.reason,
        observations: data.observations,
        movementType: data.movementType,
        academicActId: data.academicActId,
        performedById: 'system', // Esto debería venir del usuario autenticado
        performedAt: new Date(),
      },
    });
  }
}
