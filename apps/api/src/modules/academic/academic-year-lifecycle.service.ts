import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AcademicYearStatus, EnrollmentStatus, EnrollmentEventType, GradeStage, RecoveryStatus } from '@prisma/client';
import { InstitutionContextService } from '../institution-context/institution-context.service';
import { AttendanceService } from '../attendance/attendance.service';
import { StudentGradesService } from '../evaluation/student-grades.service';
import { evaluatePromotion, type StudentPromotionData } from '../../engines/promotion.engine';
import type { InstitutionRulesContext } from '../../engines/InstitutionRulesContext';
import { resolveScaleLevel } from '../evaluation/performance-scale.util';
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

/** Escritura pendiente de promoción/repitencia, calculada en la fase de solo lectura (G-2). */
interface PromotionWrite {
  enrollmentId: string;
  institutionId: string;
  newStatus: EnrollmentStatus;
  eventType: EnrollmentEventType;
  reason: string;
}

export interface PromotionResult {
  success: boolean;
  enrollmentsCreated: number;
  errors: string[];
}

@Injectable()
export class AcademicYearLifecycleService {
  constructor(
    private prisma: PrismaService,
    private institutionContext: InstitutionContextService,
    private attendanceService: AttendanceService,
    private studentGradesService: StudentGradesService,
  ) {}

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
    // Buscar primero ACTIVE, luego DRAFT como fallback
    const year = await this.prisma.academicYear.findFirst({
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

    if (year) return year;

    // Fallback: buscar el año más reciente (DRAFT o cualquier status no-CLOSED)
    return this.prisma.academicYear.findFirst({
      where: {
        institutionId,
        status: { not: 'CLOSED' },
      },
      orderBy: { year: 'desc' },
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

    // Validaciones de configuración mínima (G-1).
    // Bloqueantes: sin esto el año activado sería inoperable (sin dónde matricular,
    // sin cómo clasificar notas). Advertencias: incompleto pero operable — no bloquean
    // para no romper el onboarding real de instituciones que cargan datos en días.
    const { errors: validationErrors, warnings } = await this.validateYearForActivation(dto.yearId);
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

    return { ...updatedYear, warnings };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDAR AÑO PARA ACTIVACIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  async validateYearForActivation(yearId: string): Promise<{ errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const year = await this.getYearById(yearId);

    // BLOQUEANTE — al menos un período académico (ya existía).
    const termsCount = await this.prisma.academicTerm.count({
      where: { academicYearId: yearId },
    });
    if (termsCount === 0) {
      errors.push('Debe configurar al menos un período académico');
    }

    // BLOQUEANTE — escala de desempeño institucional. Sin ella, ninguna nota se puede
    // clasificar (getPerformanceLevel) y los boletines quedan sin desempeño cualitativo.
    const performanceScaleCount = await this.prisma.performanceScale.count({
      where: { institutionId: year.institutionId },
    });
    if (performanceScaleCount === 0) {
      errors.push('Debe configurar la escala de desempeño institucional antes de activar el año');
    }

    // BLOQUEANTE — al menos un grupo en la estructura académica de la institución.
    // Sin grupos no hay dónde matricular estudiantes ni asignar docentes.
    const groupsCount = await this.prisma.group.count({
      where: { grade: { institutionId: year.institutionId } },
    });
    if (groupsCount === 0) {
      errors.push('Debe crear al menos un grupo (grado + grupo) antes de activar el año');
    }

    // ADVERTENCIA (no bloquea) — sin carga docente asignada a este año, no se podrán
    // registrar notas ni asistencia todavía, pero el año puede activarse mientras se
    // completa la asignación (onboarding real toma varios días).
    const assignmentsCount = await this.prisma.teacherAssignment.count({
      where: { academicYearId: yearId },
    });
    if (assignmentsCount === 0) {
      warnings.push('No hay carga académica (docente-grupo-asignatura) asignada para este año. Sin ella no se podrán registrar notas ni asistencia.');
    }

    return { errors, warnings };
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

    // FASE 1 — CÁLCULO (solo lectura, fuera de cualquier transacción).
    // Puede tardar bastante en instituciones grandes (promedio anual por materia y
    // estudiante); no debe retener una transacción abierta ni bloquear filas mientras calcula.
    let promotionWrites: PromotionWrite[] = [];
    let promotedCount = 0;
    let repeatedCount = 0;
    let withdrawnCount = 0;

    if (dto.calculatePromotions) {
      const computed = await this.computePromotions(dto.yearId);
      promotionWrites = computed.writes;
      promotedCount = computed.promotedCount;
      repeatedCount = computed.repeatedCount;
      withdrawnCount = computed.withdrawnCount;
    }

    // FASE 2 — ESCRITURA (todo o nada, en una sola transacción explícita).
    // G-2: si algo falla a mitad de camino (timeout, caída), NINGÚN estudiante queda
    // promovido/repitiendo a medias y el año sigue ACTIVE (reintentable con seguridad).
    // Se abre explícitamente (no se depende solo de la transacción implícita por-request
    // del TenantContextInterceptor) para proteger también las llamadas de SUPERADMIN,
    // que no tienen institutionId en el JWT y por lo tanto no quedan envueltas por esa
    // transacción global.
    await this.prisma.$transaction(async (tx) => {
      for (const w of promotionWrites) {
        await tx.studentEnrollment.update({
          where: { id: w.enrollmentId },
          data: { status: w.newStatus },
        });
        await tx.enrollmentEvent.create({
          data: {
            institutionId: w.institutionId,
            enrollmentId: w.enrollmentId,
            type: w.eventType,
            reason: w.reason,
            performedById: dto.userId,
          },
        });
      }

      await tx.academicYear.update({
        where: { id: dto.yearId },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          closedById: dto.userId,
        },
      });
    }, { timeout: 120000, maxWait: 10000 });

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

    // REGLA: No se puede cerrar el año si hay recuperaciones FINALES sin decidir.
    // Cada plan de apoyo final (FinalRecoveryPlan) debe quedar resuelto:
    //   - APPROVED      → aprobado
    //   - NOT_APPROVED  → reprobado / pérdida de año
    //   - CANCELLED     → anulado (también se considera resuelto)
    // Cualquier otro estado está PENDIENTE y bloquea el cierre del año, porque
    // determina la promoción/repitencia del estudiante.
    const PENDING_FINAL_RECOVERY_STATUSES: RecoveryStatus[] = [
      'PENDING',
      'ASSIGNED',
      'IN_PROGRESS',
      'COMPLETED',
      'REVIEW_PENDING',
    ];

    const pendingPlans = await this.prisma.finalRecoveryPlan.findMany({
      where: {
        academicYearId: yearId,
        status: { in: PENDING_FINAL_RECOVERY_STATUSES },
      },
      include: {
        studentEnrollment: { include: { student: true } },
      },
    });

    if (pendingPlans.length > 0) {
      const names = Array.from(
        new Set(
          pendingPlans.map(
            (p) => `${p.studentEnrollment.student.firstName} ${p.studentEnrollment.student.lastName}`,
          ),
        ),
      );
      const preview = names.slice(0, 5).join(', ');
      const extra = names.length > 5 ? ` y ${names.length - 5} más` : '';
      errors.push(
        `Hay ${pendingPlans.length} recuperación(es) final(es) sin decidir. ` +
          `Cada plan de apoyo final debe quedar Aprobado o Reprobado antes de cerrar el año. ` +
          `Estudiantes con recuperaciones pendientes: ${preview}${extra}.`,
      );
    }

    return errors;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CALCULAR Y APLICAR PROMOCIONES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Calcula (solo lectura) qué escrituras habría que aplicar para promover/repetir
   * a cada estudiante activo del año. NO escribe nada — ver closeYear() para la
   * fase de escritura atómica (G-2).
   */
  private async computePromotions(yearId: string): Promise<{
    writes: PromotionWrite[];
    promotedCount: number;
    repeatedCount: number;
    withdrawnCount: number;
  }> {
    let promotedCount = 0;
    let repeatedCount = 0;

    const year = await this.getYearById(yearId);
    const rulesCtx = await this.institutionContext.getContext(year.institutionId);

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

    const writes: PromotionWrite[] = [];
    for (const enrollment of enrollments) {
      const assessment = await this.buildPromotionAssessment(enrollment, rulesCtx);
      const shouldPromote = assessment.result.status !== 'NOT_PROMOTED';
      const newStatus: EnrollmentStatus = shouldPromote ? 'PROMOTED' : 'REPEATED';

      writes.push({
        enrollmentId: enrollment.id,
        institutionId: enrollment.institutionId,
        newStatus,
        eventType: shouldPromote ? 'PROMOTED' : 'REPEATED',
        reason: shouldPromote
          ? `Cierre de año lectivo: ${assessment.result.reasons.join('; ') || 'Cumple los requisitos de promoción'}`
          : assessment.result.reasons.join('; ') || 'No cumple los requisitos de promoción',
      });

      if (shouldPromote) {
        promotedCount++;
      } else {
        repeatedCount++;
      }
    }

    // Contar los que ya estaban retirados
    const withdrawnCount = await this.prisma.studentEnrollment.count({
      where: {
        academicYearId: yearId,
        status: 'WITHDRAWN',
      },
    });

    return { writes, promotedCount, repeatedCount, withdrawnCount };
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
      finalAverage,
      failedSubjectNames,
      attendance,
      promotionData,
      hasAcademicData: teacherAssignments.length > 0 && validGrades.length > 0,
      result: evaluatePromotion(promotionData, rulesCtx),
    };
  }

  private getGradeOrder(grade: { stage: GradeStage; number: number | null }): number {
    const stageOrder: Record<GradeStage, number> = {
      PREESCOLAR: 0,
      BASICA_PRIMARIA: 100,
      BASICA_SECUNDARIA: 200,
      MEDIA: 300,
    };

    return (stageOrder[grade.stage] ?? 0) + (grade.number || 0);
  }

  private getNextGradeFromSequence(
    currentGrade: { id: string; stage: GradeStage; number: number | null },
    sequence: Array<{ id: string; name: string; stage: GradeStage; number: number | null }>,
  ) {
    const sorted = [...sequence].sort((a, b) => this.getGradeOrder(a) - this.getGradeOrder(b));
    const currentIndex = sorted.findIndex((grade) => grade.id === currentGrade.id);
    if (currentIndex < 0) return null;
    return sorted[currentIndex + 1] ?? null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PREVISUALIZAR PROMOCIONES
  // ═══════════════════════════════════════════════════════════════════════════

  async previewPromotions(yearId: string): Promise<PromotionPreview[]> {
    const yearData = await this.prisma.academicYear.findUnique({ where: { id: yearId }, select: { institutionId: true } });
    const rulesCtx = await this.institutionContext.getContext(yearData?.institutionId || '');
    const gradeSequence = await this.prisma.grade.findMany({
      select: {
        id: true,
        name: true,
        stage: true,
        number: true,
      },
    });

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
      const assessment = await this.buildPromotionAssessment(enrollment, rulesCtx);
      const shouldPromote = assessment.result.status !== 'NOT_PROMOTED';
      const nextGrade = shouldPromote
        ? this.getNextGradeFromSequence(enrollment.group.grade, gradeSequence)
        : null;

      previews.push({
        studentId: enrollment.studentId,
        studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
        currentGradeId: enrollment.group.gradeId,
        currentGradeName: enrollment.group.grade.name,
        currentGroupName: enrollment.group.name,
        finalAverage: assessment.finalAverage,
        suggestedStatus: shouldPromote ? 'PROMOTED' : 'REPEATED',
        nextGradeId: nextGrade?.id ?? null,
        nextGradeName: nextGrade?.name ?? null,
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
    const grades = await this.prisma.grade.findMany({
      select: {
        id: true,
        name: true,
        stage: true,
        number: true,
      },
    });

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
          const nextGrade = this.getNextGradeFromSequence(oldEnrollment.group.grade, grades);
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
            institutionId: oldEnrollment.institutionId,
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

        // Crear evento de auditoría
        await this.prisma.enrollmentEvent.create({
          data: {
            institutionId: oldEnrollment.institutionId,
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
      status: term.status,
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
      status: t.status,
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
      description: s.descriptor ?? null, // Q-1: descriptor pedagógico del nivel
    }));
  }

  /**
   * Obtiene la nota mínima aprobatoria de una institución.
   * Consolidación P2: es el minScore más bajo entre los niveles que APRUEBAN
   * (isApproved, con defaults del enum de Q-1), en vez de asumir "BASICO".
   */
  async getPassingGrade(institutionId: string): Promise<number> {
    const scales = await this.prisma.performanceScale.findMany({
      where: { institutionId },
    });

    if (scales.length > 0) {
      const approvedMins = scales
        .filter((s) => resolveScaleLevel(s).isApproved)
        .map((s) => Number(s.minScore));
      if (approvedMins.length > 0) {
        return Math.min(...approvedMins);
      }
    }

    // Sin escala configurada → default 3.0 (común en Colombia)
    return 3.0;
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
