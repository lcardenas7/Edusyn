import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GradeAuditService, GradeAuditActor } from './grade-audit.service';

@Injectable()
export class PartialGradesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gradeAudit: GradeAuditService,
  ) {}

  /**
   * Valida que el período NO esté FINALIZED.
   * Lanza ForbiddenException si está congelado.
   */
  private async guardTermNotFinalized(academicTermId: string): Promise<void> {
    const term = await this.prisma.academicTerm.findUnique({
      where: { id: academicTermId },
      select: { status: true },
    });

    if (term?.status === 'FINALIZED') {
      throw new ForbiddenException(
        'El período está finalizado. Debe reabrirse formalmente para modificar notas.',
      );
    }
  }

  async upsert(data: {
    studentEnrollmentId: string;
    teacherAssignmentId: string;
    academicTermId: string;
    componentType: string;
    activityIndex: number;
    activityName: string;
    activityType?: string;
    score: number;
    observations?: string;
    // Concurrencia: string ISO = "creo que la fila tiene este updatedAt"; null = "creo que no existe fila";
    // undefined = no verificar conflicto (comportamiento anterior).
    expectedUpdatedAt?: string | null;
  }, actor?: GradeAuditActor): Promise<any> {
    await this.guardTermNotFinalized(data.academicTermId);
    const ta = await this.prisma.teacherAssignment.findUnique({ where: { id: data.teacherAssignmentId }, select: { institutionId: true } });

    // Estado previo (para auditoría forense: nota anterior vs nueva, y para detectar conflicto)
    const prev = await this.prisma.partialGrade.findUnique({
      where: {
        studentEnrollmentId_teacherAssignmentId_academicTermId_componentType_activityIndex: {
          studentEnrollmentId: data.studentEnrollmentId,
          teacherAssignmentId: data.teacherAssignmentId,
          academicTermId: data.academicTermId,
          componentType: data.componentType,
          activityIndex: data.activityIndex,
        },
      },
      select: { id: true, score: true, updatedAt: true },
    });

    // Concurrencia: si el cliente indicó qué esperaba ver y no coincide con lo que hay
    // ahora en la BD, alguien más cambió esta MISMA celda entre que el cliente cargó
    // y guardó. No se sobreescribe: se reporta el conflicto para que el cliente decida.
    if (data.expectedUpdatedAt !== undefined) {
      const conflict = data.expectedUpdatedAt === null
        ? !!prev
        : (!prev || prev.updatedAt.toISOString() !== data.expectedUpdatedAt);
      if (conflict) {
        return {
          conflict: true,
          studentEnrollmentId: data.studentEnrollmentId,
          componentType: data.componentType,
          activityIndex: data.activityIndex,
          serverScore: prev ? Number(prev.score) : null,
          serverUpdatedAt: prev?.updatedAt ?? null,
        };
      }
    }

    const result = await this.prisma.partialGrade.upsert({
      where: {
        studentEnrollmentId_teacherAssignmentId_academicTermId_componentType_activityIndex: {
          studentEnrollmentId: data.studentEnrollmentId,
          teacherAssignmentId: data.teacherAssignmentId,
          academicTermId: data.academicTermId,
          componentType: data.componentType,
          activityIndex: data.activityIndex,
        },
      },
      update: {
        activityName: data.activityName,
        activityType: data.activityType,
        score: data.score,
        observations: data.observations,
      },
      create: { ...data, institutionId: ta!.institutionId },
    });

    // Auditoría: CREATE si no existía; UPDATE solo si la nota cambió
    const prevScore = prev ? Number(prev.score) : null;
    if (!prev) {
      await this.gradeAudit.record({
        institutionId: ta!.institutionId, action: 'CREATE', partialGradeId: result.id,
        studentEnrollmentId: data.studentEnrollmentId, teacherAssignmentId: data.teacherAssignmentId,
        academicTermId: data.academicTermId, componentType: data.componentType,
        activityIndex: data.activityIndex, activityName: data.activityName,
        previousScore: null, newScore: data.score,
      }, actor);
    } else if (prevScore !== data.score) {
      await this.gradeAudit.record({
        institutionId: ta!.institutionId, action: 'UPDATE', partialGradeId: result.id,
        studentEnrollmentId: data.studentEnrollmentId, teacherAssignmentId: data.teacherAssignmentId,
        academicTermId: data.academicTermId, componentType: data.componentType,
        activityIndex: data.activityIndex, activityName: data.activityName,
        previousScore: prevScore, newScore: data.score,
      }, actor);
    }

    return { conflict: false, ...result };
  }

  async bulkUpsert(grades: Array<{
    studentEnrollmentId: string;
    teacherAssignmentId: string;
    academicTermId: string;
    componentType: string;
    activityIndex: number;
    activityName: string;
    activityType?: string;
    score: number | null; // null/undefined = "sin nota" (borrar la celda); 0 = cero real (C-2)
    observations?: string;
    expectedUpdatedAt?: string | null; // concurrencia: ver upsert()
  }>, actor?: GradeAuditActor) {
    // Validar que ningún período esté FINALIZED
    const termIds = [...new Set(grades.map(g => g.academicTermId))];
    for (const termId of termIds) {
      await this.guardTermNotFinalized(termId);
    }

    // ── MIGRACIÓN: Transferir notas de asignaciones anteriores al docente actual ──
    // Cuando un docente nuevo guarda notas, las notas del docente anterior
    // deben migrar al assignment actual para que el composite key funcione.
    const assignmentIds = [...new Set(grades.map(g => g.teacherAssignmentId))];
    for (const currentAssignmentId of assignmentIds) {
      const currentAssignment = await this.prisma.teacherAssignment.findUnique({
        where: { id: currentAssignmentId },
        select: { academicYearId: true, groupId: true, subjectId: true },
      });
      if (!currentAssignment) continue;

      // Find historical (ended) assignments for the same group+subject+year
      const historicalAssignments = await this.prisma.teacherAssignment.findMany({
        where: {
          academicYearId: currentAssignment.academicYearId,
          groupId: currentAssignment.groupId,
          subjectId: currentAssignment.subjectId,
          id: { not: currentAssignmentId },
        },
        select: { id: true },
      });

      if (historicalAssignments.length > 0) {
        const oldIds = historicalAssignments.map(a => a.id);

        // Get grades from old assignments
        const oldGrades = await this.prisma.partialGrade.findMany({
          where: { teacherAssignmentId: { in: oldIds } },
          select: { id: true, studentEnrollmentId: true, academicTermId: true, componentType: true, activityIndex: true },
        });

        if (oldGrades.length > 0) {
          // Get grades already existing under the current assignment (to detect conflicts)
          const currentGrades = await this.prisma.partialGrade.findMany({
            where: { teacherAssignmentId: currentAssignmentId },
            select: { studentEnrollmentId: true, academicTermId: true, componentType: true, activityIndex: true },
          });

          // Build a set of composite keys for current grades
          const currentKeys = new Set(
            currentGrades.map(g => `${g.studentEnrollmentId}|${g.academicTermId}|${g.componentType}|${g.activityIndex}`)
          );

          // Split old grades into conflicting (current teacher already has a value) and migratable
          const conflictIds: string[] = [];
          const migrateIds: string[] = [];
          for (const og of oldGrades) {
            const key = `${og.studentEnrollmentId}|${og.academicTermId}|${og.componentType}|${og.activityIndex}`;
            if (currentKeys.has(key)) {
              conflictIds.push(og.id);
            } else {
              migrateIds.push(og.id);
            }
          }

          // Delete conflicting old grades (current teacher's value takes precedence).
          // C-3: nunca borrar sin rastro — auditar la nota del docente anterior antes de borrarla.
          if (conflictIds.length > 0) {
            const conflicting = await this.prisma.partialGrade.findMany({
              where: { id: { in: conflictIds } },
              select: {
                id: true, institutionId: true, score: true, studentEnrollmentId: true,
                teacherAssignmentId: true, academicTermId: true, componentType: true,
                activityIndex: true, activityName: true,
              },
            });
            await this.prisma.partialGrade.deleteMany({
              where: { id: { in: conflictIds } },
            });
            if (conflicting.length > 0) {
              await this.gradeAudit.recordMany(conflicting.map((d) => ({
                institutionId: d.institutionId, action: 'DELETE' as const, partialGradeId: d.id,
                studentEnrollmentId: d.studentEnrollmentId, teacherAssignmentId: d.teacherAssignmentId,
                academicTermId: d.academicTermId, componentType: d.componentType,
                activityIndex: d.activityIndex, activityName: d.activityName,
                previousScore: Number(d.score), newScore: null,
                previousValue: { reason: 'Reemplazo por cambio de docente (la nota del docente anterior fue sustituida por la del docente actual)' },
              })), actor);
            }
          }

          // Migrate non-conflicting old grades to the current assignment
          if (migrateIds.length > 0) {
            await this.prisma.partialGrade.updateMany({
              where: { id: { in: migrateIds } },
              data: { teacherAssignmentId: currentAssignmentId },
            });
          }
        }
      }
    }

    const results: any[] = [];
    const conflicts: any[] = [];
    for (const grade of grades) {
      // C-2: null/undefined = borrar la celda; cualquier número (incluido 0) = guardar.
      if (grade.score !== null && grade.score !== undefined) {
        const result = await this.upsert({ ...grade, score: grade.score }, actor);
        if (result.conflict) {
          conflicts.push(result);
        } else {
          results.push({ action: 'upsert', ...result });
        }
      } else {
        try {
          // Capturar lo que se va a borrar para la auditoría forense
          const toDelete = await this.prisma.partialGrade.findMany({
            where: {
              studentEnrollmentId: grade.studentEnrollmentId,
              teacherAssignmentId: grade.teacherAssignmentId,
              academicTermId: grade.academicTermId,
              componentType: grade.componentType,
              activityIndex: grade.activityIndex,
            },
            select: { id: true, institutionId: true, score: true, activityName: true, updatedAt: true },
          });

          // Concurrencia: si el cliente indicó qué esperaba ver y no coincide, alguien más
          // cambió esta celda mientras tanto — no borrar en silencio, reportar conflicto.
          if (grade.expectedUpdatedAt !== undefined) {
            const current = toDelete[0];
            const isConflict = grade.expectedUpdatedAt === null
              ? !!current
              : (!current || current.updatedAt.toISOString() !== grade.expectedUpdatedAt);
            if (isConflict) {
              conflicts.push({
                conflict: true,
                studentEnrollmentId: grade.studentEnrollmentId,
                componentType: grade.componentType,
                activityIndex: grade.activityIndex,
                serverScore: current ? Number(current.score) : null,
                serverUpdatedAt: current?.updatedAt ?? null,
              });
              continue;
            }
          }

          await this.prisma.partialGrade.deleteMany({
            where: {
              studentEnrollmentId: grade.studentEnrollmentId,
              teacherAssignmentId: grade.teacherAssignmentId,
              academicTermId: grade.academicTermId,
              componentType: grade.componentType,
              activityIndex: grade.activityIndex,
            },
          });
          if (toDelete.length > 0) {
            await this.gradeAudit.recordMany(toDelete.map((d) => ({
              institutionId: d.institutionId, action: 'DELETE' as const, partialGradeId: d.id,
              studentEnrollmentId: grade.studentEnrollmentId, teacherAssignmentId: grade.teacherAssignmentId,
              academicTermId: grade.academicTermId, componentType: grade.componentType,
              activityIndex: grade.activityIndex, activityName: d.activityName,
              previousScore: Number(d.score), newScore: null,
            })), actor);
          }
          results.push({ action: 'delete', ...grade });
        } catch (e) {
          // Ignorar si no existe
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // AUTO-RECOMPUTE: PeriodFinalGrade como dato derivado de PartialGrade
    // ═══════════════════════════════════════════════════════════════════════
    const uniqueKeys = new Map<string, { studentEnrollmentId: string; teacherAssignmentId: string; academicTermId: string }>();
    for (const g of grades) {
      const key = `${g.studentEnrollmentId}|${g.teacherAssignmentId}|${g.academicTermId}`;
      if (!uniqueKeys.has(key)) {
        uniqueKeys.set(key, {
          studentEnrollmentId: g.studentEnrollmentId,
          teacherAssignmentId: g.teacherAssignmentId,
          academicTermId: g.academicTermId,
        });
      }
    }

    for (const params of uniqueKeys.values()) {
      try {
        await this.recomputePeriodFinalGrade(params);
      } catch (err) {
        console.error('[PartialGrades] Error recomputing final grade:', err);
      }
    }

    // `conflicts`: celdas que NO se guardaron porque alguien más las cambió mientras
    // tanto (concurrencia — ver upsert()). El cliente debe mostrarlas y no asumir éxito.
    return { results, conflicts };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RECOMPUTE: Recalcular PeriodFinalGrade desde PartialGrades
  // ═══════════════════════════════════════════════════════════════════════

  async recomputePeriodFinalGrade(params: {
    studentEnrollmentId: string;
    teacherAssignmentId: string;
    academicTermId: string;
  }) {
    const { studentEnrollmentId, teacherAssignmentId, academicTermId } = params;

    // 1. Obtener la asignación para saber subjectId y teacherId
    const assignment = await this.prisma.teacherAssignment.findUnique({
      where: { id: teacherAssignmentId },
      select: { subjectId: true, teacherId: true, institutionId: true },
    });
    if (!assignment) return;

    // C-1: si la nota final fue fijada MANUALMENTE, el recálculo automático la respeta
    // (no la sobreescribe ni la borra). Solo un cambio manual explícito puede modificarla.
    const existingFinal = await this.prisma.periodFinalGrade.findUnique({
      where: {
        studentEnrollmentId_academicTermId_subjectId: {
          studentEnrollmentId,
          academicTermId,
          subjectId: assignment.subjectId,
        },
      },
      select: { isManualOverride: true },
    });
    if (existingFinal?.isManualOverride) return;

    // 2. Obtener TODOS los PartialGrades restantes de este estudiante/asignatura/período
    const partials = await this.prisma.partialGrade.findMany({
      where: { studentEnrollmentId, teacherAssignmentId, academicTermId },
    });

    // 3. Si no quedan notas parciales → eliminar PeriodFinalGrade
    if (partials.length === 0) {
      await this.prisma.periodFinalGrade.deleteMany({
        where: {
          studentEnrollmentId,
          academicTermId,
          subjectId: assignment.subjectId,
        },
      });
      return;
    }

    // 4. Obtener pesos de los componentes evaluativos
    // Buscar en la asignación actual primero, luego en históricas (mismo grupo+materia)
    let plan = await this.prisma.evaluationPlan.findUnique({
      where: {
        teacherAssignmentId_academicTermId: { teacherAssignmentId, academicTermId },
      },
      include: {
        components: {
          include: { component: true },
        },
      },
    });

    // Si no hay plan en la asignación actual, buscar en asignaciones históricas
    if (!plan) {
      const assignmentContext = await this.prisma.teacherAssignment.findUnique({
        where: { id: teacherAssignmentId },
        select: { academicYearId: true, groupId: true, subjectId: true },
      });
      if (assignmentContext) {
        const historicalAssignments = await this.prisma.teacherAssignment.findMany({
          where: {
            academicYearId: assignmentContext.academicYearId,
            groupId: assignmentContext.groupId,
            subjectId: assignmentContext.subjectId,
            id: { not: teacherAssignmentId },
          },
          select: { id: true },
        });
        for (const ha of historicalAssignments) {
          plan = await this.prisma.evaluationPlan.findUnique({
            where: {
              teacherAssignmentId_academicTermId: { teacherAssignmentId: ha.id, academicTermId },
            },
            include: {
              components: { include: { component: true } },
            },
          });
          if (plan) break;
        }
      }
    }

    // 5. Calcular nota final ponderada
    let finalScore: number;

    if (plan && plan.components.length > 0) {
      // Con plan de evaluación → promedio ponderado por componentType
      const componentWeights = new Map<string, number>();
      for (const cw of plan.components) {
        componentWeights.set(cw.component.code, cw.percentage);
      }

      // Agrupar notas por componentType y calcular promedio
      const componentScores = new Map<string, number[]>();
      for (const p of partials) {
        const scores = componentScores.get(p.componentType) || [];
        scores.push(Number(p.score));
        componentScores.set(p.componentType, scores);
      }

      let weightedSum = 0;
      let totalWeight = 0;

      for (const [componentType, scores] of componentScores) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const weight = componentWeights.get(componentType) || 0;
        if (weight > 0) {
          weightedSum += avg * weight;
          totalWeight += weight;
        }
      }

      finalScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
    } else {
      // Sin plan de evaluación → promedio simple de todas las notas
      const allScores = partials.map(p => Number(p.score));
      finalScore = allScores.reduce((a, b) => a + b, 0) / allScores.length;
    }

    // 6. Redondear a 1 decimal
    finalScore = Math.round(finalScore * 10) / 10;

    // 7. Upsert PeriodFinalGrade.
    // C-2: la nota final se guarda SIEMPRE que existan parciales, incluido 0 real
    // (un 0 legítimo ya no se interpreta como "borrar"). El caso "sin parciales"
    // ya se resolvió en el paso 3 (delete).
    await this.prisma.periodFinalGrade.upsert({
      where: {
        studentEnrollmentId_academicTermId_subjectId: {
          studentEnrollmentId,
          academicTermId,
          subjectId: assignment.subjectId,
        },
      },
      update: { finalScore, isManualOverride: false },
      create: {
        institutionId: assignment.institutionId,
        studentEnrollmentId,
        academicTermId,
        subjectId: assignment.subjectId,
        finalScore,
        enteredById: assignment.teacherId,
        isManualOverride: false,
      },
    });
  }

  async count(institutionId?: string) {
    const count = await this.prisma.partialGrade.count({
      where: institutionId ? {
        studentEnrollment: {
          academicYear: { institutionId },
        },
      } : undefined,
    });
    return { count };
  }

  async getByAssignment(teacherAssignmentId: string, academicTermId: string) {
    // Find the current assignment to get group+subject+year context
    const currentAssignment = await this.prisma.teacherAssignment.findUnique({
      where: { id: teacherAssignmentId },
      select: { academicYearId: true, groupId: true, subjectId: true },
    });

    if (!currentAssignment) {
      return [];
    }

    // Find ALL assignments (current + historical) for the same group+subject+year
    const allAssignments = await this.prisma.teacherAssignment.findMany({
      where: {
        academicYearId: currentAssignment.academicYearId,
        groupId: currentAssignment.groupId,
        subjectId: currentAssignment.subjectId,
      },
      select: { id: true },
    });

    const assignmentIds = allAssignments.map(a => a.id);

    // Return grades from ALL assignments for this group+subject+year
    return this.prisma.partialGrade.findMany({
      where: {
        teacherAssignmentId: { in: assignmentIds },
        academicTermId,
      },
      include: {
        studentEnrollment: {
          include: {
            student: true,
          },
        },
      },
      orderBy: [
        { componentType: 'asc' },
        { activityIndex: 'asc' },
      ],
    });
  }

  async getByStudent(studentEnrollmentId: string, academicTermId?: string) {
    return this.prisma.partialGrade.findMany({
      where: {
        studentEnrollmentId,
        ...(academicTermId && { academicTermId }),
      },
      orderBy: [
        { componentType: 'asc' },
        { activityIndex: 'asc' },
      ],
    });
  }

  async delete(id: string, actor?: GradeAuditActor) {
    const grade = await this.prisma.partialGrade.findUnique({
      where: { id },
      select: {
        academicTermId: true, institutionId: true, score: true,
        studentEnrollmentId: true, teacherAssignmentId: true, componentType: true,
        activityIndex: true, activityName: true,
      },
    });
    if (grade) {
      await this.guardTermNotFinalized(grade.academicTermId);
    }
    const result = await this.prisma.partialGrade.delete({ where: { id } });
    if (grade) {
      await this.gradeAudit.record({
        institutionId: grade.institutionId, action: 'DELETE', partialGradeId: id,
        studentEnrollmentId: grade.studentEnrollmentId, teacherAssignmentId: grade.teacherAssignmentId,
        academicTermId: grade.academicTermId, componentType: grade.componentType,
        activityIndex: grade.activityIndex, activityName: grade.activityName,
        previousScore: Number(grade.score), newScore: null,
      }, actor);
    }
    return result;
  }

  /**
   * Recuperar notas perdidas: para cada PeriodFinalGrade que no tenga PartialGrades,
   * crear una PartialGrade sintética con la nota final como "Nota recuperada".
   * Esto restaura la visibilidad en la planilla.
   */
  async recoverLostGrades(institutionId: string) {
    // 1. Get all PeriodFinalGrades for this institution
    const finalGrades = await this.prisma.periodFinalGrade.findMany({
      where: { institutionId },
      include: {
        subject: { select: { id: true, name: true } },
        academicTerm: { select: { id: true, name: true } },
        studentEnrollment: {
          select: {
            id: true,
            academicYearId: true,
            student: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    let recovered = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const pfg of finalGrades) {
      try {
        // 2. Find the active TeacherAssignment for this subject+group+year
        // First, find the student's group via their enrollment
        const enrollment = await this.prisma.studentEnrollment.findUnique({
          where: { id: pfg.studentEnrollmentId },
          select: { groupId: true, academicYearId: true },
        });
        if (!enrollment?.groupId) { skipped++; continue; }

        // 3. Find any active assignment for this group+subject (prefer active, fall back to any)
        let assignment = await this.prisma.teacherAssignment.findFirst({
          where: {
            academicYearId: enrollment.academicYearId,
            groupId: enrollment.groupId,
            subjectId: pfg.subjectId,
            endDate: null,
          },
          select: { id: true },
        });

        if (!assignment) {
          // Fall back to any assignment for this group+subject (even ended)
          assignment = await this.prisma.teacherAssignment.findFirst({
            where: {
              academicYearId: enrollment.academicYearId,
              groupId: enrollment.groupId,
              subjectId: pfg.subjectId,
            },
            select: { id: true },
            orderBy: { createdAt: 'desc' },
          });
        }

        if (!assignment) { skipped++; continue; }

        // 4. Check if PartialGrades already exist for this combo
        const existingPartials = await this.prisma.partialGrade.count({
          where: {
            studentEnrollmentId: pfg.studentEnrollmentId,
            teacherAssignmentId: assignment.id,
            academicTermId: pfg.academicTermId,
          },
        });

        if (existingPartials > 0) { skipped++; continue; }

        // 5. Create a synthetic PartialGrade with the final score
        await this.prisma.partialGrade.create({
          data: {
            institutionId,
            studentEnrollmentId: pfg.studentEnrollmentId,
            teacherAssignmentId: assignment.id,
            academicTermId: pfg.academicTermId,
            componentType: 'COGNITIVO',
            activityIndex: 1,
            activityName: 'Nota recuperada (periodo)',
            activityType: 'Recuperación',
            score: pfg.finalScore,
          },
        });
        recovered++;
      } catch (e: any) {
        errors.push(`PFG ${pfg.id}: ${e.message}`);
      }
    }

    return {
      totalFinalGrades: finalGrades.length,
      recovered,
      skipped,
      errors: errors.slice(0, 20),
      message: `Recuperadas ${recovered} notas de ${finalGrades.length} registros de notas finales. ${skipped} ya tenían notas parciales.`,
    };
  }

  async deleteByActivity(
    teacherAssignmentId: string,
    academicTermId: string,
    componentType: string,
    activityIndex: number,
    actor?: GradeAuditActor,
  ) {
    await this.guardTermNotFinalized(academicTermId);
    // Capturar lo que se va a borrar para la auditoría forense
    const toDelete = await this.prisma.partialGrade.findMany({
      where: { teacherAssignmentId, academicTermId, componentType, activityIndex },
      select: { id: true, institutionId: true, score: true, studentEnrollmentId: true, activityName: true },
    });
    const result = await this.prisma.partialGrade.deleteMany({
      where: { teacherAssignmentId, academicTermId, componentType, activityIndex },
    });
    if (toDelete.length > 0) {
      await this.gradeAudit.recordMany(toDelete.map((d) => ({
        institutionId: d.institutionId, action: 'DELETE' as const, partialGradeId: d.id,
        studentEnrollmentId: d.studentEnrollmentId, teacherAssignmentId,
        academicTermId, componentType, activityIndex, activityName: d.activityName,
        previousScore: Number(d.score), newScore: null,
      })), actor);
    }
    return result;
  }
}
