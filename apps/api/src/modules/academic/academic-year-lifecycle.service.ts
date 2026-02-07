import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AcademicYearStatus, EnrollmentStatus, EnrollmentEventType } from '@prisma/client';
import {
  AcademicTermForReport,
  PerformanceScaleForReport,
  TeacherAssignmentForReport,
  TeacherAssignmentSimple,
} from './dto/domain-reports.dto';

// DTOs
export interface CreateAcademicYearDto {
  institutionId: string;
  year: number;
  name?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface ActivateYearDto {
  yearId: string;
  userId: string;
}

export interface CloseYearDto {
  yearId: string;
  userId: string;
  calculatePromotions?: boolean;
}

export interface PromoteStudentsDto {
  fromYearId: string;
  toYearId: string;
  userId: string;
}

export interface PromotionPreview {
  studentId: string;
  studentName: string;
  currentGradeId: string;
  currentGradeName: string;
  currentGroupName: string;
  finalAverage: number | null;
  suggestedStatus: EnrollmentStatus;
  nextGradeId: string | null;
  nextGradeName: string | null;
}

export interface CloseYearResult {
  success: boolean;
  yearId: string;
  closedAt: Date;
  promotedCount: number;
  repeatedCount: number;
  withdrawnCount: number;
}

export interface PromotionResult {
  success: boolean;
  enrollmentsCreated: number;
  errors: string[];
}

@Injectable()
export class AcademicYearLifecycleService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // CREAR AÑO LECTIVO (en estado DRAFT)
  // ═══════════════════════════════════════════════════════════════════════════

  async createYear(dto: CreateAcademicYearDto) {
    // Verificar que no exista un año con el mismo número para esta institución
    const existingYear = await this.prisma.academicYear.findUnique({
      where: {
        institutionId_year: {
          institutionId: dto.institutionId,
          year: dto.year,
        },
      },
    });

    if (existingYear) {
      throw new BadRequestException(`Ya existe un año lectivo ${dto.year} para esta institución`);
    }

    // Crear el año en estado DRAFT
    const academicYear = await this.prisma.academicYear.create({
      data: {
        institutionId: dto.institutionId,
        year: dto.year,
        name: dto.name || `Año Lectivo ${dto.year}`,
        startDate: dto.startDate,
        endDate: dto.endDate,
        status: 'DRAFT',
      },
    });

    return academicYear;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OBTENER AÑO ACTUAL (ACTIVE) DE UNA INSTITUCIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  async getCurrentYear(institutionId: string) {
    return this.prisma.academicYear.findFirst({
      where: {
        institutionId,
        status: 'ACTIVE',
      },
      include: {
        calendar: true,
        terms: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: {
            studentEnrollments: true,
            teacherAssignments: true,
          },
        },
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OBTENER TODOS LOS AÑOS DE UNA INSTITUCIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  async getYearsByInstitution(institutionId: string) {
    return this.prisma.academicYear.findMany({
      where: { institutionId },
      include: {
        calendar: true,
        terms: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: {
            studentEnrollments: true,
            teacherAssignments: true,
          },
        },
      },
      orderBy: { year: 'desc' },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OBTENER UN AÑO POR ID
  // ═══════════════════════════════════════════════════════════════════════════

  async getYearById(yearId: string) {
    const year = await this.prisma.academicYear.findUnique({
      where: { id: yearId },
      include: {
        calendar: true,
        terms: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: {
            studentEnrollments: true,
            teacherAssignments: true,
          },
        },
      },
    });

    if (!year) {
      throw new NotFoundException('Año lectivo no encontrado');
    }

    return year;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIVAR AÑO LECTIVO (DRAFT → ACTIVE)
  // ═══════════════════════════════════════════════════════════════════════════

  async activateYear(dto: ActivateYearDto) {
    const year = await this.getYearById(dto.yearId);

    // Validar que el año esté en DRAFT
    if (year.status !== 'DRAFT') {
      throw new BadRequestException(
        `El año lectivo no puede ser activado porque está en estado ${year.status}`
      );
    }

    // Validar que no haya otro año ACTIVE en la misma institución
    const activeYear = await this.prisma.academicYear.findFirst({
      where: {
        institutionId: year.institutionId,
        status: 'ACTIVE',
      },
    });

    if (activeYear) {
      throw new BadRequestException(
        `Ya existe un año lectivo activo (${activeYear.year}). Debe cerrarlo antes de activar otro.`
      );
    }

    // Validaciones de configuración mínima
    const validationErrors = await this.validateYearForActivation(dto.yearId);
    if (validationErrors.length > 0) {
      throw new BadRequestException({
        message: 'El año lectivo no cumple con los requisitos mínimos para ser activado',
        errors: validationErrors,
      });
    }

    // Activar el año
    const updatedYear = await this.prisma.academicYear.update({
      where: { id: dto.yearId },
      data: {
        status: 'ACTIVE',
        activatedAt: new Date(),
        activatedById: dto.userId,
      },
    });

    return updatedYear;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDAR AÑO PARA ACTIVACIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  async validateYearForActivation(yearId: string): Promise<string[]> {
    const errors: string[] = [];

    // Verificar que tenga al menos un período académico
    const termsCount = await this.prisma.academicTerm.count({
      where: { academicYearId: yearId },
    });
    if (termsCount === 0) {
      errors.push('Debe configurar al menos un período académico');
    }

    // Verificar que tenga grupos configurados (a través de asignaciones de docentes)
    // Esto es opcional, pero recomendado
    // const assignmentsCount = await this.prisma.teacherAssignment.count({
    //   where: { academicYearId: yearId },
    // });
    // if (assignmentsCount === 0) {
    //   errors.push('Se recomienda tener al menos una asignación de docente');
    // }

    return errors;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CERRAR AÑO LECTIVO (ACTIVE → CLOSED)
  // ═══════════════════════════════════════════════════════════════════════════

  async closeYear(dto: CloseYearDto): Promise<CloseYearResult> {
    const year = await this.getYearById(dto.yearId);

    // Validar que el año esté en ACTIVE
    if (year.status !== 'ACTIVE') {
      throw new BadRequestException(
        `El año lectivo no puede ser cerrado porque está en estado ${year.status}`
      );
    }

    // Validaciones antes de cerrar
    const validationErrors = await this.validateYearForClosure(dto.yearId);
    if (validationErrors.length > 0) {
      throw new BadRequestException({
        message: 'El año lectivo no puede ser cerrado',
        errors: validationErrors,
      });
    }

    // Calcular promociones si se solicita
    let promotedCount = 0;
    let repeatedCount = 0;
    let withdrawnCount = 0;

    if (dto.calculatePromotions) {
      const result = await this.calculateAndApplyPromotions(dto.yearId, dto.userId);
      promotedCount = result.promotedCount;
      repeatedCount = result.repeatedCount;
      withdrawnCount = result.withdrawnCount;
    }

    // Cerrar el año
    await this.prisma.academicYear.update({
      where: { id: dto.yearId },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closedById: dto.userId,
      },
    });

    return {
      success: true,
      yearId: dto.yearId,
      closedAt: new Date(),
      promotedCount,
      repeatedCount,
      withdrawnCount,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDAR AÑO PARA CIERRE
  // ═══════════════════════════════════════════════════════════════════════════

  async validateYearForClosure(yearId: string): Promise<string[]> {
    const errors: string[] = [];

    // Verificar que no haya matrículas sin resolver (ACTIVE sin notas)
    // Esto es una validación opcional que puede ser más estricta según necesidades

    return errors;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CALCULAR Y APLICAR PROMOCIONES
  // ═══════════════════════════════════════════════════════════════════════════

  private async calculateAndApplyPromotions(yearId: string, userId: string) {
    let promotedCount = 0;
    let repeatedCount = 0;
    let withdrawnCount = 0;

    // Obtener todas las matrículas activas del año
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        academicYearId: yearId,
        status: 'ACTIVE',
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

    // Por ahora, marcar todos como PROMOTED (la lógica real debería calcular notas)
    // TODO: Implementar cálculo real de promoción basado en notas
    for (const enrollment of enrollments) {
      // Aquí iría la lógica de cálculo de notas finales
      // Por ahora, asumimos que todos aprueban
      const shouldPromote = true; // TODO: Calcular basado en notas

      const newStatus: EnrollmentStatus = shouldPromote ? 'PROMOTED' : 'REPEATED';

      await this.prisma.studentEnrollment.update({
        where: { id: enrollment.id },
        data: { status: newStatus },
      });

      // Crear evento de auditoría
      await this.prisma.enrollmentEvent.create({
        data: {
          enrollmentId: enrollment.id,
          type: shouldPromote ? 'PROMOTED' : 'REPEATED',
          reason: 'Cierre de año lectivo',
          performedById: userId,
        },
      });

      if (shouldPromote) {
        promotedCount++;
      } else {
        repeatedCount++;
      }
    }

    // Contar los que ya estaban retirados
    withdrawnCount = await this.prisma.studentEnrollment.count({
      where: {
        academicYearId: yearId,
        status: 'WITHDRAWN',
      },
    });

    return { promotedCount, repeatedCount, withdrawnCount };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PREVISUALIZAR PROMOCIONES
  // ═══════════════════════════════════════════════════════════════════════════

  async previewPromotions(yearId: string): Promise<PromotionPreview[]> {
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        academicYearId: yearId,
        status: 'ACTIVE',
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

    const previews: PromotionPreview[] = [];

    for (const enrollment of enrollments) {
      // TODO: Calcular promedio final real
      const finalAverage = null; // Placeholder

      // TODO: Determinar siguiente grado basado en orden
      const nextGrade = null; // Placeholder

      previews.push({
        studentId: enrollment.studentId,
        studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
        currentGradeId: enrollment.group.gradeId,
        currentGradeName: enrollment.group.grade.name,
        currentGroupName: enrollment.group.name,
        finalAverage,
        suggestedStatus: finalAverage && finalAverage >= 3.0 ? 'PROMOTED' : 'REPEATED',
        nextGradeId: nextGrade,
        nextGradeName: nextGrade,
      });
    }

    return previews;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROMOVER ESTUDIANTES AL SIGUIENTE AÑO
  // ═══════════════════════════════════════════════════════════════════════════

  async promoteStudents(dto: PromoteStudentsDto): Promise<PromotionResult> {
    const fromYear = await this.getYearById(dto.fromYearId);
    const toYear = await this.getYearById(dto.toYearId);

    // Validar que el año origen esté cerrado
    if (fromYear.status !== 'CLOSED') {
      throw new BadRequestException('El año de origen debe estar cerrado para promover estudiantes');
    }

    // Validar que el año destino esté en DRAFT o ACTIVE
    if (toYear.status === 'CLOSED') {
      throw new BadRequestException('No se pueden promover estudiantes a un año cerrado');
    }

    const errors: string[] = [];
    let enrollmentsCreated = 0;

    // Obtener matrículas del año anterior que fueron promovidas o repitieron
    const enrollmentsToPromote = await this.prisma.studentEnrollment.findMany({
      where: {
        academicYearId: dto.fromYearId,
        status: { in: ['PROMOTED', 'REPEATED'] },
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

    for (const oldEnrollment of enrollmentsToPromote) {
      try {
        // Verificar si ya existe matrícula en el año destino
        const existingEnrollment = await this.prisma.studentEnrollment.findUnique({
          where: {
            studentId_academicYearId: {
              studentId: oldEnrollment.studentId,
              academicYearId: dto.toYearId,
            },
          },
        });

        if (existingEnrollment) {
          continue; // Ya está matriculado
        }

        // Determinar el grado destino
        let targetGradeId: string;
        if (oldEnrollment.status === 'PROMOTED') {
          // Buscar el siguiente grado basado en number y stage
          const currentGrade = oldEnrollment.group.grade;
          const nextNumber = (currentGrade.number || 0) + 1;
          
          const nextGrade = await this.prisma.grade.findFirst({
            where: {
              stage: currentGrade.stage,
              number: nextNumber,
            },
          });
          targetGradeId = nextGrade?.id || oldEnrollment.group.gradeId;
        } else {
          // Repite el mismo grado
          targetGradeId = oldEnrollment.group.gradeId;
        }

        // Buscar un grupo disponible en el grado destino
        const targetGroup = await this.prisma.group.findFirst({
          where: {
            gradeId: targetGradeId,
          },
        });

        if (!targetGroup) {
          errors.push(`No hay grupo disponible para ${oldEnrollment.student.firstName} ${oldEnrollment.student.lastName}`);
          continue;
        }

        // Crear nueva matrícula
        const newEnrollment = await this.prisma.studentEnrollment.create({
          data: {
            studentId: oldEnrollment.studentId,
            academicYearId: dto.toYearId,
            groupId: targetGroup.id,
            enrollmentType: 'RENEWAL',
            status: 'ACTIVE',
            shift: oldEnrollment.shift,
            modality: oldEnrollment.modality,
            promotedFromId: oldEnrollment.id,
            enrolledById: dto.userId,
          },
        });

        // Actualizar la matrícula anterior con la referencia
        await this.prisma.studentEnrollment.update({
          where: { id: oldEnrollment.id },
          data: { promotedFromId: newEnrollment.id }, // Nota: esto debería ser promotedToId pero no existe en el schema actual
        });

        // Crear evento de auditoría
        await this.prisma.enrollmentEvent.create({
          data: {
            enrollmentId: newEnrollment.id,
            type: 'CREATED',
            reason: `Promoción desde año ${fromYear.year}`,
            previousValue: { fromEnrollmentId: oldEnrollment.id },
            performedById: dto.userId,
          },
        });

        enrollmentsCreated++;
      } catch (error) {
        errors.push(`Error al promover ${oldEnrollment.student.firstName}: ${error.message}`);
      }
    }

    return {
      success: errors.length === 0,
      enrollmentsCreated,
      errors,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDACIONES DE PERMISOS POR ESTADO
  // ═══════════════════════════════════════════════════════════════════════════

  async canEditStructure(yearId: string): Promise<boolean> {
    const year = await this.prisma.academicYear.findUnique({
      where: { id: yearId },
      select: { status: true },
    });
    return year?.status === 'DRAFT';
  }

  async canRecordGrades(yearId: string): Promise<boolean> {
    const year = await this.prisma.academicYear.findUnique({
      where: { id: yearId },
      select: { status: true },
    });
    return year?.status === 'ACTIVE';
  }

  async canEnrollStudents(yearId: string): Promise<boolean> {
    const year = await this.prisma.academicYear.findUnique({
      where: { id: yearId },
      select: { status: true },
    });
    return year?.status === 'ACTIVE';
  }

  async canModify(yearId: string): Promise<boolean> {
    const year = await this.prisma.academicYear.findUnique({
      where: { id: yearId },
      select: { status: true },
    });
    return year?.status !== 'CLOSED';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTUALIZAR AÑO (solo en DRAFT)
  // ═══════════════════════════════════════════════════════════════════════════

  async updateYear(yearId: string, data: Partial<CreateAcademicYearDto>) {
    const year = await this.getYearById(yearId);

    if (year.status !== 'DRAFT') {
      throw new ForbiddenException('Solo se pueden editar años en estado DRAFT');
    }

    return this.prisma.academicYear.update({
      where: { id: yearId },
      data: {
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ELIMINAR AÑO (solo en DRAFT sin datos)
  // ═══════════════════════════════════════════════════════════════════════════

  async deleteYear(yearId: string) {
    const year = await this.getYearById(yearId);

    if (year.status !== 'DRAFT') {
      throw new ForbiddenException('Solo se pueden eliminar años en estado DRAFT');
    }

    // Verificar que no tenga datos asociados
    const hasEnrollments = await this.prisma.studentEnrollment.count({
      where: { academicYearId: yearId },
    });

    if (hasEnrollments > 0) {
      throw new BadRequestException('No se puede eliminar un año con matrículas registradas');
    }

    return this.prisma.academicYear.delete({
      where: { id: yearId },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MÉTODOS PARA DOMINIO DE REPORTES
  // ═══════════════════════════════════════════════════════════════════════════
  // Estos métodos son usados por el módulo de Reportes para obtener datos
  // sin conocer los detalles de implementación académica.

  /**
   * Obtiene un término académico por ID.
   * Retorna DTO de dominio, NO modelo Prisma.
   */
  async getTermById(termId: string): Promise<AcademicTermForReport | null> {
    const term = await this.prisma.academicTerm.findUnique({
      where: { id: termId },
    });

    if (!term) return null;

    return {
      id: term.id,
      name: term.name,
      type: term.type,
      order: term.order,
      weightPercentage: term.weightPercentage,
      startDate: term.startDate,
      endDate: term.endDate,
    };
  }

  /**
   * Obtiene todos los términos de un año académico.
   * Retorna DTOs de dominio, NO modelos Prisma.
   */
  async getTermsByAcademicYear(academicYearId: string): Promise<AcademicTermForReport[]> {
    const terms = await this.prisma.academicTerm.findMany({
      where: { academicYearId },
      orderBy: { order: 'asc' },
    });

    return terms.map(t => ({
      id: t.id,
      name: t.name,
      type: t.type,
      order: t.order,
      weightPercentage: t.weightPercentage,
      startDate: t.startDate,
      endDate: t.endDate,
    }));
  }

  /**
   * Obtiene la escala de desempeño de una institución.
   * Retorna DTOs de dominio, NO modelos Prisma.
   */
  async getPerformanceScale(institutionId: string): Promise<PerformanceScaleForReport[]> {
    const scales = await this.prisma.performanceScale.findMany({
      where: { institutionId },
      orderBy: { minScore: 'asc' },
    });

    return scales.map(s => ({
      id: s.id,
      level: s.level,
      minScore: Number(s.minScore),
      maxScore: Number(s.maxScore),
      description: null, // PerformanceScale no tiene description en el schema actual
    }));
  }

  /**
   * Obtiene la nota mínima aprobatoria de una institución.
   * Busca el nivel BASICO que es el mínimo aprobatorio.
   */
  async getPassingGrade(institutionId: string): Promise<number> {
    const passingScale = await this.prisma.performanceScale.findFirst({
      where: {
        institutionId,
        level: 'BASICO',
      },
      orderBy: { minScore: 'asc' },
    });

    // Si no encuentra escala, usar 3.0 como default (común en Colombia)
    return passingScale ? Number(passingScale.minScore) : 3.0;
  }

  /**
   * Obtiene asignaciones de docentes para un grupo y año.
   * Retorna DTOs de dominio, NO modelos Prisma.
   */
  async getTeacherAssignmentsForGroup(groupId: string, academicYearId: string): Promise<TeacherAssignmentForReport[]> {
    const assignments = await this.prisma.teacherAssignment.findMany({
      where: { groupId, academicYearId },
      include: {
        subject: { include: { area: true } },
        teacher: { select: { firstName: true, lastName: true } },
      },
    });

    return assignments.map(a => ({
      id: a.id,
      subjectId: a.subjectId,
      subjectName: a.subject.name,
      subjectCode: a.subject.code,
      areaId: a.subject.areaId,
      areaName: a.subject.area.name,
      areaCode: a.subject.area.code,
      teacherName: `${a.teacher.firstName} ${a.teacher.lastName}`,
    }));
  }

  /**
   * Obtiene asignaciones de docentes para asignaturas específicas.
   * Retorna DTOs de dominio, NO modelos Prisma.
   */
  async getTeacherAssignmentsForSubjects(
    groupId: string,
    academicYearId: string,
    subjectIds: string[],
  ): Promise<TeacherAssignmentSimple[]> {
    if (subjectIds.length === 0) return [];

    const assignments = await this.prisma.teacherAssignment.findMany({
      where: {
        groupId,
        academicYearId,
        subjectId: { in: subjectIds },
      },
      include: {
        subject: true,
        teacher: { select: { firstName: true, lastName: true } },
      },
    });

    return assignments.map(a => ({
      id: a.id,
      subjectId: a.subjectId,
      subjectName: a.subject.name,
      subjectCode: a.subject.code,
      teacherName: `${a.teacher.firstName} ${a.teacher.lastName}`,
    }));
  }
}
