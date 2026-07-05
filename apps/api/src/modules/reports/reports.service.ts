import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject, forwardRef, ConflictException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { EnrollmentStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { StudentGradesService } from '../evaluation/student-grades.service';
import { AttendanceService } from '../attendance/attendance.service';
import { StudentsService } from '../academic/students.service';
import { AcademicYearLifecycleService } from '../academic/academic-year-lifecycle.service';
import { InstitutionContextService } from '../institution-context/institution-context.service';
import { getPerformanceLevel, isFailing, getGradeDistributionRanges } from '../../engines/academic-rules.engine';
import { getReportCardMode, getDisplayConfig } from '../../engines/report-card.engine';
import type { AcademicStructureType } from '../../engines/AcademicStructure';
import { SupabaseStorageService } from '../storage/supabase-storage.service';
import { AcademicDataSourceService, ReportMode } from './academic-data-source.service';

/** Fila común de nota para el reporte de reprobadas (parcial o final). grade=null = sin datos. */
interface FailedRow {
  studentEnrollmentId: string;
  studentName: string;
  group: string;
  subjectId: string;
  subjectName: string;
  areaId: string | null;
  areaName: string;
  termName: string;
  grade: number | null;
  hasData: boolean;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService, // Solo para consultas que aún no tienen servicio
    private readonly studentGradesService: StudentGradesService,
    private readonly attendanceService: AttendanceService,
    private readonly studentsService: StudentsService,
    private readonly academicYearService: AcademicYearLifecycleService,
    private readonly institutionContext: InstitutionContextService,
    private readonly storageService: SupabaseStorageService,
    private readonly academicDataSource: AcademicDataSourceService,
  ) {}

  /**
   * Obtiene las asignaturas que aplican a una matrícula específica.
   * Usa el snapshot (EnrollmentSubject) si existe, o calcula desde TeacherAssignment como fallback.
   * Esto protege contra cambios en plantillas que afectarían históricos.
   */
  private async getEnrollmentSubjects(enrollmentId: string, groupId: string, academicYearId: string) {
    // Intentar obtener snapshot de la matrícula - delegar a StudentsService
    const enrollmentAreas = await this.studentsService.getEnrollmentAcademicStructure(enrollmentId);

    if (enrollmentAreas.length > 0) {
      // Usar snapshot: obtener TeacherAssignments solo para las asignaturas del snapshot
      const subjectIds = enrollmentAreas
        .flatMap(a => a.subjects.map(s => s.subjectId))
        .filter((id): id is string => id !== null);
      
      // Delegar a AcademicYearService - retorna DTOs
      const teacherAssignments = await this.academicYearService.getTeacherAssignmentsForSubjects(
        groupId,
        academicYearId,
        subjectIds,
      );

      // Mapear asignaturas del snapshot con sus asignaciones de docente
      return {
        source: 'snapshot' as const,
        areas: enrollmentAreas.map(area => ({
          id: area.id,
          name: area.areaName,
          code: area.areaCode,
          weightPercentage: area.weightPercentage,
          calculationType: area.calculationType,
          subjects: area.subjects.map(es => {
            const assignment = es.subjectId 
              ? teacherAssignments.find(ta => ta.subjectId === es.subjectId)
              : null;
            return {
              id: es.subjectId,
              name: es.subjectName,
              code: es.subjectCode,
              weightPercentage: es.weightPercentage,
              teacherAssignmentId: assignment?.id ?? null,
              // Usar nombre del docente del snapshot si existe, sino del DTO de assignment
              teacher: es.teacherName ?? (assignment?.teacherName ?? null),
            };
          }),
        })),
      };
    }

    // Fallback: usar TeacherAssignments actuales (para matrículas sin snapshot)
    // Delegar a AcademicYearService - retorna DTOs
    const teacherAssignments = await this.academicYearService.getTeacherAssignmentsForGroup(groupId, academicYearId);

    // Agrupar por área usando DTOs
    const areaMap = new Map<string, { areaId: string; areaName: string; areaCode: string | null; subjects: any[] }>();
    for (const ta of teacherAssignments) {
      if (!areaMap.has(ta.areaId)) {
        areaMap.set(ta.areaId, {
          areaId: ta.areaId,
          areaName: ta.areaName,
          areaCode: ta.areaCode,
          subjects: [],
        });
      }
      areaMap.get(ta.areaId)!.subjects.push({
        id: ta.subjectId,
        name: ta.subjectName,
        code: ta.subjectCode,
        weightPercentage: 100 / teacherAssignments.filter(t => t.areaId === ta.areaId).length,
        teacherAssignmentId: ta.id,
        teacher: ta.teacherName,
      });
    }

    return {
      source: 'calculated' as const,
      areas: Array.from(areaMap.values()).map(({ areaId, areaName, areaCode, subjects }) => ({
        id: areaId,
        name: areaName,
        code: areaCode,
        weightPercentage: 100 / areaMap.size,
        calculationType: 'AVERAGE',
        subjects,
      })),
    };
  }

  private async getExpectedSubjectIdsByEnrollment(
    enrollments: Array<{ id: string; groupId: string }>,
    academicYearId: string,
  ): Promise<Map<string, string[]>> {
    const cacheByGroup = new Map<string, string[]>();
    const result = new Map<string, string[]>();

    for (const enrollment of enrollments) {
      if (!cacheByGroup.has(enrollment.groupId)) {
        const structure = await this.getEnrollmentSubjects(enrollment.id, enrollment.groupId, academicYearId);
        const subjectIds = structure.areas
          .flatMap(area => area.subjects.map(subject => subject.id))
          .filter((id): id is string => Boolean(id));
        cacheByGroup.set(enrollment.groupId, subjectIds);
      }

      result.set(enrollment.id, cacheByGroup.get(enrollment.groupId) || []);
    }

    return result;
  }

  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((acc, value) => acc + value, 0) / values.length;
  }

  async getReportCardData(studentEnrollmentId: string, academicTermId: string) {
    // Delegar al motor centralizado — resuelve snapshot vs live automáticamente
    const result = await this.academicDataSource.getStudentReportCardData(
      studentEnrollmentId,
      academicTermId,
      // Callback para datos live: batch del grupo + extracción del estudiante
      async (enrollmentId, termId) => {
        const enrollment = await this.prisma.studentEnrollment.findUnique({
          where: { id: enrollmentId },
          select: { groupId: true },
        });
        if (!enrollment) throw new NotFoundException('Student enrollment not found');

        const groupData = await this.buildGroupReportCards(enrollment.groupId, termId);
        const card = groupData.cards.find(c => c.enrollmentId === enrollmentId);
        if (!card) throw new NotFoundException('Report card not found for this student in the group batch');

        return {
          institution: groupData.institution,
          academicYear: groupData.academicYear,
          term: groupData.term,
          academicStructure: groupData.academicStructure,
          displayConfig: groupData.displayConfig,
          student: card.student,
          group: card.group,
          areaGrades: card.areaGrades,
          subjectGrades: card.subjectGrades,
          structureSource: card.structureSource,
          attendance: card.attendance,
          achievements: card.achievements,
          observations: card.observations,
          generatedAt: groupData.generatedAt,
        };
      },
    );

    // Retornar data directamente (meta disponible en result.meta para endpoints que lo necesiten)
    return result.data;
  }

  /**
   * Versión con meta — para endpoints que necesitan saber la fuente de datos.
   */
  async getReportCardDataWithMeta(studentEnrollmentId: string, academicTermId: string) {
    const result = await this.academicDataSource.getStudentReportCardData(
      studentEnrollmentId,
      academicTermId,
      async (enrollmentId, termId) => {
        const enrollment = await this.prisma.studentEnrollment.findUnique({
          where: { id: enrollmentId },
          select: { groupId: true },
        });
        if (!enrollment) throw new NotFoundException('Student enrollment not found');

        const groupData = await this.buildGroupReportCards(enrollment.groupId, termId);
        const card = groupData.cards.find(c => c.enrollmentId === enrollmentId);
        if (!card) throw new NotFoundException('Report card not found for this student in the group batch');

        return {
          institution: groupData.institution,
          academicYear: groupData.academicYear,
          term: groupData.term,
          academicStructure: groupData.academicStructure,
          displayConfig: groupData.displayConfig,
          student: card.student,
          group: card.group,
          areaGrades: card.areaGrades,
          subjectGrades: card.subjectGrades,
          structureSource: card.structureSource,
          attendance: card.attendance,
          achievements: card.achievements,
          observations: card.observations,
          generatedAt: groupData.generatedAt,
        };
      },
    );

    return result;
  }

  async generateReportCardPdf(studentEnrollmentId: string, academicTermId: string): Promise<Buffer> {
    const data = await this.getReportCardData(studentEnrollmentId, academicTermId);
    return this.renderReportCardPdf(data);
  }

  /**
   * Renderiza un PDF de boletín a partir de datos precargados.
   * 0 queries a la DB — toda la lógica opera en memoria.
   * Usado por generateReportCardPdf() y generateBulkReportCards().
   */
  private renderReportCardPdf(data: {
    institution: { name: string; nit: string | null };
    academicYear: { year: number };
    term: { name: string };
    student: { firstName: string; lastName: string; documentType: string; documentNumber: string };
    group: { name: string; gradeLevel: string };
    subjectGrades: Array<{
      subject: string;
      grade: number | null;
      originalGrade: number | null;
      recoveryGrade: number | null;
      hasRecovery: boolean;
      recoveryStatus: string | null;
      performanceLevel: string | null;
      teacher: string | null;
    }>;
    attendance: { total: number; present: number; absent: number; late: number; excused: number; attendanceRate: number };
    achievements: Array<{ subject: string; orderNumber: number; description: string; observation: string | null; judgment: string | null }>;
    observations: Array<{ date: Date; type: string; description: string }>;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(18).font('Helvetica-Bold').text(data.institution.name, { align: 'center' });
      doc.fontSize(11).font('Helvetica').text(`NIT: ${data.institution.nit || 'N/A'}`, { align: 'center' });
      doc.moveDown();

      doc.fontSize(16).font('Helvetica-Bold').text('BOLETÍN DE CALIFICACIONES', { align: 'center' });
      doc.fontSize(13).font('Helvetica').text(`${data.term.name} - Año ${data.academicYear.year}`, { align: 'center' });
      doc.moveDown();

      // Student Info
      doc.fontSize(10).font('Helvetica-Bold').text('INFORMACIÓN DEL ESTUDIANTE');
      doc.font('Helvetica');
      doc.text(`Nombre: ${data.student.lastName} ${data.student.firstName}`);
      doc.text(`Documento: ${data.student.documentType} ${data.student.documentNumber}`);
      doc.text(`Grado: ${data.group.gradeLevel} - Grupo: ${data.group.name}`);
      doc.moveDown();

      // Grades Table
      doc.font('Helvetica-Bold').text('CALIFICACIONES POR ASIGNATURA');
      doc.moveDown(0.5);

      const tableTop = doc.y;
      const col1 = 50;
      const col2 = 250;
      const col3 = 350;
      const col4 = 450;

      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Asignatura', col1, tableTop);
      doc.text('Nota', col2, tableTop);
      doc.text('Desempeño', col3, tableTop);
      doc.text('Docente', col4, tableTop);

      doc.moveTo(col1, tableTop + 15).lineTo(550, tableTop + 15).stroke();

      let y = tableTop + 20;
      doc.font('Helvetica').fontSize(8);

      for (const subject of data.subjectGrades) {
        if (y > 700) {
          doc.addPage();
          y = 50;
        }

        const recovered = subject.hasRecovery
          && subject.originalGrade !== null
          && subject.grade !== null
          && subject.grade > subject.originalGrade;
        const originalRecoveredGrade = recovered ? subject.originalGrade : null;
        const finalRecoveredGrade = recovered ? subject.grade : null;
        const recoveryLine = recovered
          ? `Recuperada: perdió con ${originalRecoveredGrade!.toFixed(1)}${subject.recoveryGrade !== null ? `, recuperación ${subject.recoveryGrade.toFixed(1)}` : ''}, definitiva ${finalRecoveredGrade!.toFixed(1)}`
          : '';
        const rowHeight = recovered ? 30 : 20;
        const subjectLabel = recovered ? `${subject.subject}\n${recoveryLine}` : subject.subject;

        doc.text(subjectLabel, col1, y, { width: 190 });
        doc.text(subject.grade?.toFixed(1) || 'N/A', col2, y);
        doc.text(this.getPerformanceLevelText(subject.performanceLevel), col3, y);
        doc.text(subject.teacher || '', col4, y, { width: 100 });
        y += rowHeight;
      }

      doc.moveDown(2);

      // Attendance Summary
      doc.y = y + 20;
      doc.fontSize(10).font('Helvetica-Bold').text('ASISTENCIA');
      doc.font('Helvetica').fontSize(9);
      doc.text(`Total clases: ${data.attendance.total}`);
      doc.text(`Presente: ${data.attendance.present} | Ausente: ${data.attendance.absent} | Tardanzas: ${data.attendance.late} | Excusas: ${data.attendance.excused}`);
      doc.text(`Porcentaje de asistencia: ${data.attendance.attendanceRate}%`);
      doc.moveDown();

      // Achievements
      if (data.achievements && data.achievements.length > 0) {
        doc.fontSize(10).font('Helvetica-Bold').text('LOGROS');
        doc.font('Helvetica').fontSize(8);

        for (const ach of data.achievements) {
          doc.font('Helvetica-Bold').text(`${ach.subject} - Logro ${ach.orderNumber}:`, { continued: true });
          doc.font('Helvetica').text(` ${ach.description}`);
          if (ach.observation) {
            doc.text(`  Observación: ${ach.observation}`);
          }
          if (ach.judgment) {
            doc.font('Helvetica-Oblique').text(`  ${ach.judgment}`);
            doc.font('Helvetica');
          }
        }
        doc.moveDown();
      }

      // Observations
      if (data.observations.length > 0) {
        doc.fontSize(10).font('Helvetica-Bold').text('OBSERVACIONES DEL PERÍODO');
        doc.font('Helvetica').fontSize(8);

        for (const obs of data.observations.slice(0, 5)) {
          const dateStr = new Date(obs.date).toLocaleDateString('es-CO');
          doc.text(`[${dateStr}] ${obs.type}: ${obs.description}`);
        }
      }

      // Footer
      doc.fontSize(8).text(`Generado el: ${new Date().toLocaleString('es-CO')}`, 50, 750);

      doc.end();
    });
  }

  private getPerformanceLevelText(level: string | null): string {
    const levels: Record<string, string> = {
      SUPERIOR: 'Superior',
      ALTO: 'Alto',
      BASICO: 'Básico',
      BAJO: 'Bajo',
    };
    return level ? levels[level] || level : 'N/A';
  }

  /**
   * OPTIMIZADO: Genera boletines PDF para todo un grupo en batch.
   * Usa AcademicDataSourceService para resolver snapshot vs live automáticamente.
   *
   * FINALIZED → snapshots congelados (sin fallback)
   * OPEN/CLOSED → buildGroupReportCards (~10 queries batch)
   */
  async generateBulkReportCards(groupId: string, academicTermId: string, _academicYearId: string) {
    // Motor centralizado resuelve la fuente de datos
    const { meta, data: groupData } = await this.academicDataSource.getGroupReportCardData(
      groupId,
      academicTermId,
      (gId, tId) => this.buildGroupReportCards(gId, tId),
    );

    const results: Array<{
      studentId: string;
      studentName: string;
      status: string;
      pdf?: string;
      error?: string;
    }> = [];

    for (const card of groupData.cards) {
      try {
        const pdfData = {
          institution: groupData.institution,
          academicYear: groupData.academicYear,
          term: groupData.term,
          student: card.student,
          group: card.group,
          subjectGrades: card.subjectGrades,
          attendance: card.attendance,
          achievements: card.achievements,
          observations: card.observations,
        };

        const pdf = await this.renderReportCardPdf(pdfData);

        results.push({
          studentId: card.student.id,
          studentName: `${card.student.lastName} ${card.student.firstName}`,
          status: 'success',
          pdf: pdf.toString('base64'),
        });
      } catch (error) {
        results.push({
          studentId: card.student.id,
          studentName: `${card.student.lastName} ${card.student.firstName}`,
          status: 'error',
          error: error.message,
        });
      }
    }

    return { meta, results };
  }

  /**
   * Calcula la nota mínima requerida para aprobar cada asignatura.
   * Considera: períodos con sus pesos, notas ya obtenidas, y nota mínima aprobatoria.
   * 
   * Fórmula: Si ya tengo notas en algunos períodos, ¿qué nota necesito en los restantes?
   * notaMinima = (notaAprobatoria * 100 - Σ(notaObtenida * pesoPeríodo)) / Σ(pesoPeríodosRestantes)
   */
  async calculateMinimumGradeRequired(
    studentEnrollmentId: string,
    academicYearId: string,
  ): Promise<{
    student: { id: string; firstName: string; secondName: string | null; lastName: string; secondLastName: string | null };
    group: { id: string; name: string; gradeName: string };
    passingGrade: number;
    subjects: Array<{
      subjectId: string;
      subjectName: string;
      areaName: string;
      currentAnnualGrade: number | null;
      termGrades: Array<{
        termId: string;
        termName: string;
        weight: number;
        grade: number | null;
        status: 'obtained' | 'pending';
      }>;
      minimumRequired: number | null;
      status: 'approved' | 'at_risk' | 'impossible' | 'pending';
      message: string;
    }>;
    summary: {
      totalSubjects: number;
      approved: number;
      atRisk: number;
      impossible: number;
      pending: number;
    };
  }> {
    // 1. Obtener datos del estudiante y matrícula
    // 1. Delegar a StudentsService para obtener matrícula
    const enrollment = await this.studentsService.getEnrollmentForReport(studentEnrollmentId);

    if (!enrollment) {
      throw new NotFoundException('Matrícula no encontrada');
    }

    // 2. Delegar a AcademicYearService para obtener nota mínima aprobatoria
    const passingGrade = await this.academicYearService.getPassingGrade(enrollment.academicYear.institutionId);

    // 3. Delegar a AcademicYearService para obtener períodos
    const terms = await this.academicYearService.getTermsByAcademicYear(academicYearId);

    // 3b. Obtener componentes finales (pruebas semestrales, etc.)
    const finalComponents = await this.prisma.finalComponent.findMany({
      where: { academicYearId },
      orderBy: { order: 'asc' },
    });

    // 4. Obtener estructura de asignaturas del estudiante
    const enrollmentStructure = await this.getEnrollmentSubjects(
      studentEnrollmentId,
      enrollment.group.id,
      academicYearId,
    );

    // 5. Calcular nota mínima para cada asignatura
    const subjectResults: Array<{
      subjectId: string;
      subjectName: string;
      areaName: string;
      currentAnnualGrade: number | null;
      termGrades: Array<{
        termId: string;
        termName: string;
        weight: number;
        grade: number | null;
        status: 'obtained' | 'pending';
      }>;
      minimumRequired: number | null;
      status: 'approved' | 'at_risk' | 'impossible' | 'pending';
      message: string;
    }> = [];
    let approved = 0, atRisk = 0, impossible = 0, pending = 0;

    for (const area of enrollmentStructure.areas) {
      for (const subject of area.subjects) {
        if (!subject.teacherAssignmentId) {
          subjectResults.push({
            subjectId: subject.id || '',
            subjectName: subject.name,
            areaName: area.name,
            currentAnnualGrade: null,
            termGrades: terms.map(t => ({
              termId: t.id,
              termName: t.name,
              weight: t.weightPercentage,
              grade: null,
              status: 'pending' as const,
            })),
            minimumRequired: null,
            status: 'pending' as const,
            message: 'Sin docente asignado',
          });
          pending++;
          continue;
        }

        // Fuente 1: Notas por período
        const termGrades = await Promise.all(
          terms.map(async (term) => {
            const result = await this.studentGradesService.calculateTermGrade(
              studentEnrollmentId,
              subject.teacherAssignmentId!,
              term.id,
            );
            return {
              termId: term.id,
              termName: term.name,
              weight: term.weightPercentage,
              grade: result.grade,
              status: (result.grade !== null ? 'obtained' : 'pending') as 'obtained' | 'pending',
            };
          }),
        );

        // Fuente 2: Notas de componentes finales (pruebas semestrales, etc.)
        const fcGrades = await Promise.all(
          finalComponents.map(async (fc) => {
            const gradeRecord = await this.prisma.finalComponentGrade.findUnique({
              where: {
                studentEnrollmentId_teacherAssignmentId_finalComponentId: {
                  studentEnrollmentId,
                  teacherAssignmentId: subject.teacherAssignmentId!,
                  finalComponentId: fc.id,
                },
              },
            });
            return {
              id: fc.id,
              name: fc.name,
              weight: fc.weightPercentage,
              grade: gradeRecord ? Number(gradeRecord.grade) : null,
              status: (gradeRecord ? 'obtained' : 'pending') as 'obtained' | 'pending',
            };
          }),
        );

        // Unificar todas las fuentes de nota (períodos + componentes finales)
        const allSources = [
          ...termGrades.map(t => ({ weight: t.weight, grade: t.grade })),
          ...fcGrades.map(fc => ({ weight: fc.weight, grade: fc.grade })),
        ];

        const obtainedSources = allSources.filter(s => s.grade !== null);
        const pendingSources = allSources.filter(s => s.grade === null);
        
        // Nota anual actual (promedio ponderado de fuentes obtenidas)
        let currentAnnualGrade: number | null = null;
        if (obtainedSources.length > 0) {
          const weightedSum = obtainedSources.reduce((acc, s) => acc + (s.grade! * s.weight), 0);
          const totalObtainedWeight = obtainedSources.reduce((acc, s) => acc + s.weight, 0);
          currentAnnualGrade = Math.round((weightedSum / totalObtainedWeight) * 10) / 10;
        }

        // Calcular nota mínima requerida en fuentes pendientes
        let minimumRequired: number | null = null;
        let status: 'approved' | 'at_risk' | 'impossible' | 'pending';
        let message: string;

        const totalPendingWeight = pendingSources.reduce((acc, s) => acc + s.weight, 0);
        const obtainedWeightedSum = obtainedSources.reduce((acc, s) => acc + (s.grade! * s.weight), 0);

        if (pendingSources.length === 0) {
          // Todas las fuentes calificadas
          if (currentAnnualGrade !== null && currentAnnualGrade >= passingGrade) {
            status = 'approved';
            message = `✅ Aprobado con ${currentAnnualGrade.toFixed(1)}`;
            approved++;
          } else {
            status = 'impossible';
            message = `❌ Reprobado con ${currentAnnualGrade?.toFixed(1) || 'N/A'}`;
            impossible++;
          }
        } else if (obtainedSources.length === 0) {
          // Sin notas aún
          minimumRequired = passingGrade;
          status = 'pending';
          message = `📝 Necesita mínimo ${passingGrade.toFixed(1)} en todas las fuentes de nota`;
          pending++;
        } else {
          // Algunas fuentes calificadas, otras pendientes
          // Fórmula universal: notaRequerida = (notaAprobatoria * 100 - sumaObtenida) / pesoPendiente
          const requiredWeightedSum = passingGrade * 100 - obtainedWeightedSum;
          minimumRequired = Math.round((requiredWeightedSum / totalPendingWeight) * 10) / 10;

          if (minimumRequired <= 1.0) {
            status = 'approved';
            message = `✅ Ya tiene asegurada la aprobación (actual: ${currentAnnualGrade?.toFixed(1)})`;
            minimumRequired = 1.0;
            approved++;
          } else if (minimumRequired > 5.0) {
            status = 'impossible';
            message = `❌ Matemáticamente imposible aprobar (necesitaría ${minimumRequired.toFixed(1)})`;
            impossible++;
          } else {
            const pendingCount = pendingSources.length;
            status = 'at_risk';
            message = `⚠️ Necesita mínimo ${minimumRequired.toFixed(1)} en ${pendingCount === 1 ? 'la fuente restante' : `las ${pendingCount} fuentes restantes`}`;
            atRisk++;
          }
        }

        subjectResults.push({
          subjectId: subject.id || '',
          subjectName: subject.name,
          areaName: area.name,
          currentAnnualGrade,
          termGrades,
          minimumRequired,
          status,
          message,
        });
      }
    }

    return {
      student: {
        id: enrollment.student.id,
        firstName: enrollment.student.firstName,
        secondName: enrollment.student.secondName,
        lastName: enrollment.student.lastName,
        secondLastName: enrollment.student.secondLastName,
      },
      group: {
        id: enrollment.group.id,
        name: enrollment.group.name,
        gradeName: enrollment.group.gradeName,
      },
      passingGrade,
      subjects: subjectResults,
      summary: {
        totalSubjects: subjectResults.length,
        approved,
        atRisk,
        impossible,
        pending,
      },
    };
  }

  /**
   * Calcula la nota mínima requerida para todos los estudiantes de un grupo.
   */
  async calculateMinimumGradeForGroup(
    groupId: string,
    academicYearId: string,
  ): Promise<Array<{
    studentId: string;
    studentName: string;
    summary: {
      totalSubjects: number;
      approved: number;
      atRisk: number;
      impossible: number;
      pending: number;
    };
    criticalSubjects: Array<{
      subjectName: string;
      status: string;
      minimumRequired: number | null;
    }>;
  }>> {
    // Delegar a StudentsService para obtener matrículas del grupo
    const enrollments = await this.studentsService.getEnrollmentsForGroupReport({
      groupId,
      academicYearId,
      status: EnrollmentStatus.ACTIVE,
    });

    const results: Array<{
      studentId: string;
      studentName: string;
      summary: {
        totalSubjects: number;
        approved: number;
        atRisk: number;
        impossible: number;
        pending: number;
      };
      criticalSubjects: Array<{
        subjectName: string;
        status: string;
        minimumRequired: number | null;
      }>;
    }> = [];

    for (const enrollment of enrollments) {
      try {
        const data = await this.calculateMinimumGradeRequired(enrollment.id, academicYearId);
        
        // Filtrar solo asignaturas críticas (at_risk o impossible)
        const criticalSubjects = data.subjects
          .filter(s => s.status === 'at_risk' || s.status === 'impossible')
          .map(s => ({
            subjectName: s.subjectName,
            status: s.status,
            minimumRequired: s.minimumRequired,
          }));

        // Usar propiedades del DTO EnrollmentForGroupList
        results.push({
          studentId: enrollment.studentId,
          studentName: enrollment.studentName || `${enrollment.studentLastName} ${enrollment.studentFirstName}`,
          summary: data.summary,
          criticalSubjects,
        });
      } catch (error) {
        results.push({
          studentId: enrollment.studentId,
          studentName: enrollment.studentName || `${enrollment.studentLastName} ${enrollment.studentFirstName}`,
          summary: { totalSubjects: 0, approved: 0, atRisk: 0, impossible: 0, pending: 0 },
          criticalSubjects: [],
        });
      }
    }

    return results;
  }

  /**
   * Reporte 15: Consolidado nota mínima requerida (vista matricial)
   * 1 fila por estudiante, columnas = asignaturas agrupadas por área.
   * Cada celda: notas por período + nota necesaria en períodos restantes.
   * Umbrales de color dinámicos: usa maxGrade y minPassingGrade del contexto institucional.
   */
  async getMinGradeConsolidated(
    institutionId: string,
    groupId: string,
    academicYearId: string,
  ) {
    // ── Contexto institucional dinámico ──
    const rulesCtx = await this.institutionContext.getContext(institutionId);
    const passingGrade = rulesCtx.minPassingGrade;
    const maxGrade = rulesCtx.maxGradeValue;
    const minGrade = rulesCtx.minGradeValue;

    // ── Períodos y componentes finales ──
    const terms = await this.academicYearService.getTermsByAcademicYear(academicYearId);
    const finalComponents = await this.prisma.finalComponent.findMany({
      where: { academicYearId },
      orderBy: { order: 'asc' },
    });

    // ── Estudiantes del grupo ──
    const enrollments = await this.studentsService.getEnrollmentsForGroupReport({
      groupId,
      academicYearId,
      status: EnrollmentStatus.ACTIVE,
    });

    // ── Estructura de asignaturas (usar primer estudiante como referencia) ──
    // Todos los estudiantes del mismo grupo comparten la misma estructura
    let subjectColumns: Array<{
      subjectId: string;
      subjectName: string;
      areaId: string;
      areaName: string;
    }> = [];
    let areaGroups: Array<{
      areaId: string;
      areaName: string;
      subjectCount: number;
    }> = [];

    if (enrollments.length > 0) {
      const structure = await this.getEnrollmentSubjects(enrollments[0].id, groupId, academicYearId);
      for (const area of structure.areas) {
        const areaId = area.id || area.name;
        areaGroups.push({ areaId, areaName: area.name, subjectCount: area.subjects.length });
        for (const subj of area.subjects) {
          subjectColumns.push({
            subjectId: subj.id || subj.name,
            subjectName: subj.name,
            areaId,
            areaName: area.name,
          });
        }
      }
    }

    // ── Calcular matriz para cada estudiante ──
    const students: Array<{
      studentId: string;
      enrollmentId: string;
      studentName: string;
      subjects: Array<{
        subjectId: string;
        termGrades: Array<{ termId: string; grade: number | null }>;
        currentAnnualGrade: number | null;
        minimumRequired: number | null;
        status: 'approved' | 'at_risk' | 'impossible' | 'pending';
      }>;
      generalAverage: number | null;
      totalFailed: number;
    }> = [];

    for (const enrollment of enrollments) {
      try {
        const data = await this.calculateMinimumGradeRequired(enrollment.id, academicYearId);

        // Mapear cada asignatura en el orden de subjectColumns
        const subjectMap = new Map<string, typeof data.subjects[0]>();
        for (const s of data.subjects) {
          subjectMap.set(s.subjectId, s);
        }

        const subjectsRow = subjectColumns.map(col => {
          const s = subjectMap.get(col.subjectId);
          if (!s) {
            return {
              subjectId: col.subjectId,
              termGrades: terms.map(t => ({ termId: t.id, grade: null as number | null })),
              currentAnnualGrade: null,
              minimumRequired: null,
              status: 'pending' as const,
            };
          }
          return {
            subjectId: s.subjectId,
            termGrades: s.termGrades.map(tg => ({ termId: tg.termId, grade: tg.grade })),
            currentAnnualGrade: s.currentAnnualGrade,
            minimumRequired: s.minimumRequired,
            status: s.status,
          };
        });

        // Promedio general y total reprobadas
        const gradedSubjects = data.subjects.filter(s => s.currentAnnualGrade !== null);
        const generalAverage = gradedSubjects.length > 0
          ? Math.round((gradedSubjects.reduce((acc, s) => acc + s.currentAnnualGrade!, 0) / gradedSubjects.length) * 10) / 10
          : null;
        const totalFailed = data.subjects.filter(s => s.status === 'impossible' || s.status === 'at_risk').length;

        students.push({
          studentId: enrollment.studentId,
          enrollmentId: enrollment.id,
          studentName: enrollment.studentName || `${enrollment.studentLastName} ${enrollment.studentFirstName}`,
          subjects: subjectsRow,
          generalAverage,
          totalFailed,
        });
      } catch {
        students.push({
          studentId: enrollment.studentId,
          enrollmentId: enrollment.id,
          studentName: enrollment.studentName || `${enrollment.studentLastName} ${enrollment.studentFirstName}`,
          subjects: subjectColumns.map(col => ({
            subjectId: col.subjectId,
            termGrades: terms.map(t => ({ termId: t.id, grade: null as number | null })),
            currentAnnualGrade: null,
            minimumRequired: null,
            status: 'pending' as const,
          })),
          generalAverage: null,
          totalFailed: 0,
        });
      }
    }

    // Ordenar por apellido
    students.sort((a, b) => a.studentName.localeCompare(b.studentName));

    return {
      // Escala dinámica para umbrales de color en el frontend
      scale: { minGrade, maxGrade, passingGrade },
      terms: terms.map(t => ({ id: t.id, name: t.name, weight: t.weightPercentage })),
      finalComponents: finalComponents.map(fc => ({ id: fc.id, name: fc.name, weight: fc.weightPercentage })),
      areaGroups,
      subjectColumns,
      students,
      summary: {
        totalStudents: students.length,
        studentsAtRisk: students.filter(s => s.totalFailed > 0).length,
        studentsClean: students.filter(s => s.totalFailed === 0).length,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MOTOR DE CONSULTA ACADÉMICA — Base para reportes institucionales
  // Usa PeriodFinalGrade como fuente única con diferentes agregaciones.
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * @deprecated Reemplazado por AcademicDataSourceService.getTermGradeData().
   * Se mantiene temporalmente por si algún método externo lo referencia.
   * TODO: Eliminar cuando se confirme que no hay consumidores.
   */
  private async getBaseGradeData(params: {
    institutionId: string;
    academicYearId: string;
    groupId?: string;
    termId?: string;
    subjectId?: string;
    stage?: string; // GradeStage: PREESCOLAR, BASICA_PRIMARIA, BASICA_SECUNDARIA, MEDIA
  }) {
    return this.prisma.periodFinalGrade.findMany({
      where: {
        institutionId: params.institutionId,
        academicTerm: {
          academicYearId: params.academicYearId,
          ...(params.termId && { id: params.termId }),
        },
        studentEnrollment: {
          status: 'ACTIVE',
          ...(params.groupId && { groupId: params.groupId }),
          ...(params.stage && { group: { grade: { stage: params.stage as any } } }),
        },
        ...(params.subjectId && { subjectId: params.subjectId }),
      },
      include: {
        studentEnrollment: {
          include: {
            student: { select: { id: true, firstName: true, secondName: true, lastName: true, secondLastName: true } },
            group: { include: { grade: true } },
          },
        },
        academicTerm: { select: { id: true, name: true, weightPercentage: true, order: true } },
        subject: { include: { area: { select: { id: true, name: true } } } },
      },
      orderBy: { studentEnrollment: { student: { lastName: 'asc' } } },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // BLOQUE 1 — RENDIMIENTO ACADÉMICO
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Reporte 2: Promedio por asignatura
   * ¿Qué asignatura tiene mejor o peor rendimiento?
   */
  async getSubjectAverages(institutionId: string, academicYearId: string, groupId?: string, termId?: string, stage?: string, reportMode?: ReportMode) {
    const passingGrade = await this.academicYearService.getPassingGrade(institutionId);
    const { meta, grades } = await this.academicDataSource.getTermGradeData({ institutionId, academicYearId, groupId, termId, stage, reportMode });

    // Agrupar por asignatura
    const subjectMap = new Map<string, { name: string; areaName: string; scores: number[] }>();
    for (const g of grades) {
      const key = g.subjectId;
      if (!subjectMap.has(key)) {
        subjectMap.set(key, {
          name: g.subjectName,
          areaName: g.areaName || '',
          scores: [],
        });
      }
      subjectMap.get(key)!.scores.push(g.finalScore);
    }

    const results = Array.from(subjectMap.entries()).map(([subjectId, data]) => {
      const { scores } = data;
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const approved = scores.filter(s => s >= passingGrade).length;
      return {
        subjectId,
        subjectName: data.name,
        areaName: data.areaName,
        average: Math.round(avg * 10) / 10,
        approvalRate: Math.round((approved / scores.length) * 1000) / 10,
        failRate: Math.round(((scores.length - approved) / scores.length) * 1000) / 10,
        bestGrade: Math.max(...scores),
        worstGrade: Math.min(...scores),
        totalStudents: scores.length,
      };
    });

    return { meta, passingGrade, results: results.sort((a, b) => a.subjectName.localeCompare(b.subjectName)) };
  }

  /**
   * Reporte 2b: Promedio por áreas
   * Agrupa asignaturas por área y calcula promedios, aprobación y detalle por asignatura.
   */
  async getAreaAverages(institutionId: string, academicYearId: string, groupId?: string, termId?: string, stage?: string, reportMode?: ReportMode) {
    const passingGrade = await this.academicYearService.getPassingGrade(institutionId);
    const { meta, grades } = await this.academicDataSource.getTermGradeData({ institutionId, academicYearId, groupId, termId, stage, reportMode });

    // Agrupar por área → asignatura → notas
    const areaMap = new Map<string, {
      areaName: string;
      subjects: Map<string, { subjectName: string; scores: number[] }>;
      allScores: number[];
    }>();

    for (const g of grades) {
      const areaKey = g.areaId || 'sin-area';
      const areaName = g.areaName || 'Sin área';
      if (!areaMap.has(areaKey)) {
        areaMap.set(areaKey, { areaName, subjects: new Map(), allScores: [] });
      }
      const area = areaMap.get(areaKey)!;
      area.allScores.push(g.finalScore);

      if (!area.subjects.has(g.subjectId)) {
        area.subjects.set(g.subjectId, { subjectName: g.subjectName, scores: [] });
      }
      area.subjects.get(g.subjectId)!.scores.push(g.finalScore);
    }

    const results = Array.from(areaMap.entries()).map(([areaId, data]) => {
      const { allScores } = data;
      const avg = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;
      const approved = allScores.filter(s => s >= passingGrade).length;

      const subjects = Array.from(data.subjects.entries()).map(([subjectId, sData]) => {
        const sAvg = sData.scores.reduce((a, b) => a + b, 0) / sData.scores.length;
        const sApproved = sData.scores.filter(s => s >= passingGrade).length;
        return {
          subjectId,
          subjectName: sData.subjectName,
          average: Math.round(sAvg * 10) / 10,
          approvalRate: Math.round((sApproved / sData.scores.length) * 1000) / 10,
          totalStudents: sData.scores.length,
        };
      }).sort((a, b) => a.subjectName.localeCompare(b.subjectName));

      return {
        areaId,
        areaName: data.areaName,
        average: Math.round(avg * 10) / 10,
        approvalRate: allScores.length > 0 ? Math.round((approved / allScores.length) * 1000) / 10 : 0,
        failRate: allScores.length > 0 ? Math.round(((allScores.length - approved) / allScores.length) * 1000) / 10 : 0,
        bestGrade: allScores.length > 0 ? Math.max(...allScores) : 0,
        worstGrade: allScores.length > 0 ? Math.min(...allScores) : 0,
        totalGrades: allScores.length,
        subjectCount: subjects.length,
        subjects,
      };
    }).sort((a, b) => a.areaName.localeCompare(b.areaName));

    return { meta, passingGrade, results };
  }

  /**
   * Reporte 2c: Consolidado por áreas (vista matricial)
   * 1 fila por estudiante, columnas = áreas con promedio de sus asignaturas.
   * Requiere grupo obligatorio.
   */
  async getAreaConsolidated(institutionId: string, academicYearId: string, groupId: string, termId?: string, reportMode?: ReportMode) {
    const passingGrade = await this.academicYearService.getPassingGrade(institutionId);
    const { meta, grades } = await this.academicDataSource.getTermGradeData({ institutionId, academicYearId, groupId, termId, reportMode });

    // Recopilar todas las áreas únicas (columnas)
    const areaSet = new Map<string, string>(); // areaId → areaName
    for (const g of grades) {
      const areaId = g.areaId || 'sin-area';
      if (!areaSet.has(areaId)) areaSet.set(areaId, g.areaName || 'Sin área');
    }
    const areaCols = Array.from(areaSet.entries())
      .map(([id, name]) => ({ areaId: id, areaName: name }))
      .sort((a, b) => a.areaName.localeCompare(b.areaName));

    // Agrupar: estudiante → área → notas de asignaturas
    const studentMap = new Map<string, {
      enrollmentId: string;
      name: string;
      areas: Map<string, number[]>; // areaId → scores[]
    }>();

    for (const g of grades) {
      const key = g.studentEnrollmentId;
      if (!studentMap.has(key)) {
        studentMap.set(key, {
          enrollmentId: key,
          name: g.studentFullName || `${g.studentLastName} ${g.studentFirstName}`,
          areas: new Map(),
        });
      }
      const student = studentMap.get(key)!;
      const areaId = g.areaId || 'sin-area';
      if (!student.areas.has(areaId)) student.areas.set(areaId, []);
      student.areas.get(areaId)!.push(g.finalScore);
    }

    // Construir filas
    const students = Array.from(studentMap.values())
      .map(st => {
        const areaGrades = areaCols.map(col => {
          const scores = st.areas.get(col.areaId);
          if (!scores || scores.length === 0) return { areaId: col.areaId, average: null as number | null, subjectCount: 0 };
          const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
          return { areaId: col.areaId, average: avg, subjectCount: scores.length };
        });
        const allAvgs = areaGrades.filter(a => a.average !== null).map(a => a.average!);
        const generalAvg = allAvgs.length > 0 ? Math.round((allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length) * 10) / 10 : null;
        const failedAreas = areaGrades.filter(a => a.average !== null && a.average < passingGrade).length;
        return {
          enrollmentId: st.enrollmentId,
          studentName: st.name,
          areaGrades,
          generalAverage: generalAvg,
          failedAreas,
        };
      })
      .sort((a, b) => a.studentName.localeCompare(b.studentName));

    // Promedios por área (fila resumen)
    const areaSummary = areaCols.map(col => {
      const allScores = students.map(s => s.areaGrades.find(a => a.areaId === col.areaId)?.average).filter((v): v is number => v !== null);
      const avg = allScores.length > 0 ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10 : null;
      return { areaId: col.areaId, average: avg };
    });

    return {
      meta,
      passingGrade,
      areaCols,
      areaSummary,
      students,
      summary: {
        totalStudents: students.length,
        studentsWithFailedAreas: students.filter(s => s.failedAreas > 0).length,
      },
    };
  }

  /**
   * Reporte 3: Ranking de estudiantes
   * ¿Quiénes son los mejores / peores del grupo?
   */
  async getStudentRanking(institutionId: string, academicYearId: string, groupId: string, termId?: string, reportMode?: ReportMode) {
    const rulesCtx = await this.institutionContext.getContext(institutionId);
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        institutionId,
        academicYearId,
        groupId,
        status: EnrollmentStatus.ACTIVE,
      },
      include: {
        student: { select: { firstName: true, lastName: true } },
        group: { select: { id: true, name: true, grade: { select: { name: true } } } },
      },
    });

    const { meta, grades } = await this.academicDataSource.getTermGradeData({ institutionId, academicYearId, groupId, termId, reportMode });

    const expectedSubjectsByEnrollment = await this.getExpectedSubjectIdsByEnrollment(
      enrollments.map(enrollment => ({ id: enrollment.id, groupId: enrollment.groupId })),
      academicYearId,
    );

    const scoresByStudentSubject = new Map<string, Map<string, number[]>>();
    for (const g of grades) {
      const studentMap = scoresByStudentSubject.get(g.studentEnrollmentId) || new Map<string, number[]>();
      const subjectScores = studentMap.get(g.subjectId) || [];
      subjectScores.push(g.finalScore);
      studentMap.set(g.subjectId, subjectScores);
      scoresByStudentSubject.set(g.studentEnrollmentId, studentMap);
    }

    const results = enrollments
      .map(enrollment => {
        const expectedSubjectIds = expectedSubjectsByEnrollment.get(enrollment.id) || [];
        const subjectScores = expectedSubjectIds.map(subjectId => {
          const gradesForSubject = scoresByStudentSubject.get(enrollment.id)?.get(subjectId) || [];
          return this.average(gradesForSubject);
        });

        const avg = expectedSubjectIds.length > 0
          ? this.average(subjectScores)
          : 0;

        return {
          studentName: `${enrollment.student.lastName} ${enrollment.student.firstName}`,
          group: `${enrollment.group.grade.name} ${enrollment.group.name}`,
          average: Math.round(avg * 10) / 10,
          subjectCount: expectedSubjectIds.length,
          performance: getPerformanceLevel(avg, rulesCtx).label,
        };
      })
      .sort((a, b) => b.average - a.average)
      .map((r, idx) => ({ position: idx + 1, ...r }));

    return { meta, results };
  }

  /**
   * Reporte 3B: Ranking institucional de estudiantes
   * Soporta filtros flexibles: toda la institución, por grado, por nivel educativo, o por grupo
   */
  async getInstitutionalRanking(
    institutionId: string,
    academicYearId: string,
    termId?: string,
    filters?: { groupId?: string; gradeId?: string; stage?: string },
  ) {
    const rulesCtx = await this.institutionContext.getContext(institutionId);

    // Construir where clause para matrículas
    const enrollmentWhere: any = {
      institutionId,
      academicYearId,
      status: EnrollmentStatus.ACTIVE,
    };

    if (filters?.groupId) {
      enrollmentWhere.groupId = filters.groupId;
    } else if (filters?.gradeId) {
      enrollmentWhere.group = { gradeId: filters.gradeId };
    } else if (filters?.stage) {
      enrollmentWhere.group = { grade: { stage: filters.stage } };
    }

    // Obtener todas las matrículas que cumplen el filtro
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: enrollmentWhere,
      include: {
        student: { select: { firstName: true, lastName: true } },
        group: { select: { id: true, name: true, grade: { select: { name: true, stage: true } } } },
      },
    });

    if (enrollments.length === 0) {
      return { meta: { totalStudents: 0, scope: this.getRankingScope(filters) }, results: [] };
    }

    const enrollmentIds = enrollments.map(e => e.id);
    const expectedSubjectsByEnrollment = await this.getExpectedSubjectIdsByEnrollment(
      enrollments.map(enrollment => ({ id: enrollment.id, groupId: enrollment.groupId })),
      academicYearId,
    );

    // Obtener notas finales de período para estas matrículas
    const termWhere: any = { studentEnrollmentId: { in: enrollmentIds } };
    if (termId) {
      termWhere.academicTermId = termId;
    }

    const periodGrades = await this.prisma.periodFinalGrade.findMany({
      where: termWhere,
      select: {
        studentEnrollmentId: true,
        subjectId: true,
        finalScore: true,
      },
    });

    // Agrupar por estudiante
    const studentMap = new Map<string, { name: string; group: string; grade: string; stage: string; subjectIds: string[]; scoresBySubject: Map<string, number[]> }>();
    
    for (const enrollment of enrollments) {
      const key = enrollment.id;
      studentMap.set(key, {
        name: `${enrollment.student.lastName} ${enrollment.student.firstName}`,
        group: `${enrollment.group.grade.name} ${enrollment.group.name}`,
        grade: enrollment.group.grade.name,
        stage: enrollment.group.grade.stage,
        subjectIds: expectedSubjectsByEnrollment.get(enrollment.id) || [],
        scoresBySubject: new Map<string, number[]>(),
      });
    }

    for (const pg of periodGrades) {
      const student = studentMap.get(pg.studentEnrollmentId);
      if (student && pg.finalScore !== null) {
        const list = student.scoresBySubject.get(pg.subjectId) || [];
        list.push(Number(pg.finalScore));
        student.scoresBySubject.set(pg.subjectId, list);
      }
    }

    // Calcular promedios y ordenar
    const results = Array.from(studentMap.entries())
      .filter(([_, data]) => data.subjectIds.length > 0)
      .map(([_, data]) => {
        const subjectAverages = data.subjectIds.map(subjectId => this.average(data.scoresBySubject.get(subjectId) || []));
        const avg = data.subjectIds.length > 0 ? this.average(subjectAverages) : 0;
        return {
          studentName: data.name,
          group: data.group,
          grade: data.grade,
          stage: data.stage,
          average: Math.round(avg * 100) / 100,
          subjectCount: data.subjectIds.length,
          performance: getPerformanceLevel(avg, rulesCtx).label,
        };
      })
      .sort((a, b) => b.average - a.average)
      .map((r, idx) => ({ position: idx + 1, ...r }));

    return {
      meta: {
        totalStudents: results.length,
        scope: this.getRankingScope(filters),
        termId,
      },
      results,
    };
  }

  private getRankingScope(filters?: { groupId?: string; gradeId?: string; stage?: string }): string {
    if (filters?.groupId) return 'group';
    if (filters?.gradeId) return 'grade';
    if (filters?.stage) return 'stage';
    return 'institution';
  }

  /**
   * Reporte 4: Distribución de notas
   * ¿Cómo se distribuyen las notas?
   */
  async getGradeDistribution(institutionId: string, academicYearId: string, groupId: string, subjectId?: string, termId?: string, reportMode?: ReportMode) {
    const rulesCtx = await this.institutionContext.getContext(institutionId);
    const { meta, grades } = await this.academicDataSource.getTermGradeData({ institutionId, academicYearId, groupId, termId, subjectId, reportMode });
    const scores = grades.map(g => g.finalScore);

    // Rangos dinámicos basados en escala institucional + niveles de desempeño
    const perfLevels = rulesCtx.performanceLevels;
    let ranges: { label: string; min: number; max: number }[];

    if (perfLevels && perfLevels.length > 0) {
      // Usar niveles de desempeño configurados (Bajo, Básico, Alto, Superior, etc.)
      ranges = perfLevels
        .sort((a, b) => a.minScore - b.minScore)
        .map((pl) => ({
          label: `${pl.minScore} – ${pl.maxScore} (${pl.name})`,
          min: pl.minScore,
          max: pl.maxScore,
        }));
    } else {
      // Fallback: rangos proporcionales dinámicos
      ranges = getGradeDistributionRanges(rulesCtx, 4);
    }

    const distribution = ranges.map(r => {
      const count = scores.filter(s => s >= r.min && s <= r.max).length;
      return {
        range: r.label,
        count,
        percentage: scores.length > 0 ? Math.round((count / scores.length) * 1000) / 10 : 0,
      };
    });

    return { meta, totalGrades: scores.length, distribution, scale: { min: rulesCtx.minGradeValue, max: rulesCtx.maxGradeValue, passing: rulesCtx.minPassingGrade } };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // BLOQUE 2 — RIESGO ACADÉMICO
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Reporte 6: Asignaturas reprobadas
   * ¿Qué materias perdió cada estudiante?
   *
   * scope 'final'   → nota derivada del período (para después del cierre; comportamiento clásico).
   * scope 'partial' → "corte" a una fecha: calcula la nota parcial con el mismo motor del
   *                   Corte Preventivo (calculateTermGradeAtDate), distinguiendo "sin datos"
   *                   de "en riesgo". Sirve a mitad de período.
   *
   * Respeta la regla de aprobación institucional (areaApprovalRule + areaFailIfAnyFails) y
   * devuelve DOS vistas: por asignatura (results) y por área (areaResults). `officialUnit`
   * indica cuál cuenta como reprobación oficial en este colegio (otras calculan distinto).
   */
  async getFailedSubjects(
    institutionId: string,
    academicYearId: string,
    groupId: string,
    termId?: string,
    opts?: {
      reportMode?: ReportMode;
      scope?: 'partial' | 'final';
      cutoffDate?: Date;
      areaId?: string;
      subjectId?: string;
    },
  ) {
    const scope = opts?.scope ?? 'final';
    // C-3: umbral aprobatorio del nivel educativo del grupo (no el global de la institución)
    const grp = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { grade: { select: { stage: true, name: true } } },
    });
    const passingGrade = await this.academicYearService.getPassingGrade(institutionId, {
      stage: grp?.grade?.stage, gradeName: grp?.grade?.name,
    });

    // Regla de aprobación del colegio (unas reprueban por área, otras por asignatura)
    const inst = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: { areaApprovalRule: true, areaFailIfAnyFails: true },
    });
    const approvalRule = (inst?.areaApprovalRule as string) || 'AREA_AVERAGE';
    const failIfAnyFails = inst?.areaFailIfAnyFails ?? false;
    // AREA_AVERAGE → la unidad oficial es el ÁREA (promedio). El resto → la ASIGNATURA.
    const officialUnit: 'area' | 'subject' =
      approvalRule === 'AREA_AVERAGE' && !failIfAnyFails ? 'area' : 'subject';

    // 1. Obtener filas de nota (parcial o final) en una forma común
    let rows: FailedRow[];
    let meta: any;
    let cutoffDate: Date | null = null;

    if (scope === 'partial') {
      if (!termId) throw new BadRequestException('El corte parcial requiere un período (termId).');
      cutoffDate = opts?.cutoffDate ?? new Date();
      rows = await this.loadPartialFailedRows(academicYearId, groupId, termId, cutoffDate);
      meta = { source: 'live', scope: 'partial', cutoffDate: cutoffDate.toISOString() };
    } else {
      const res = await this.academicDataSource.getTermGradeData({ institutionId, academicYearId, groupId, termId, reportMode: opts?.reportMode });
      meta = { ...res.meta, scope: 'final' };
      rows = res.grades.map(g => ({
        studentEnrollmentId: g.studentEnrollmentId,
        studentName: g.studentFullName || `${g.studentLastName} ${g.studentFirstName}`,
        group: g.groupName,
        subjectId: g.subjectId,
        subjectName: g.subjectName,
        areaId: g.areaId,
        areaName: g.areaName || '',
        termName: g.termName,
        grade: g.finalScore,
        hasData: true,
      }));
    }

    // 2. Filtros (C-4): por área y/o asignatura
    if (opts?.areaId) rows = rows.filter(r => r.areaId === opts.areaId);
    if (opts?.subjectId) rows = rows.filter(r => r.subjectId === opts.subjectId);

    // 3. Vista POR ASIGNATURA (solo las que tienen nota y están por debajo)
    const failed = rows
      .filter(r => r.hasData && r.grade !== null && (r.grade as number) < passingGrade)
      .map(r => ({
        studentName: r.studentName,
        group: r.group,
        subjectName: r.subjectName,
        areaName: r.areaName,
        grade: r.grade as number,
        termName: r.termName,
        deficit: Math.round((passingGrade - (r.grade as number)) * 10) / 10,
        recoverable: (r.grade as number) >= (passingGrade - 1.0),
      }))
      .sort((a, b) => a.studentName.localeCompare(b.studentName) || a.subjectName.localeCompare(b.subjectName));

    // 4. Vista POR ÁREA (promedio de área según la regla institucional)
    const areaResults = this.buildFailedAreas(rows, passingGrade, approvalRule, failIfAnyFails);

    // Resumen
    const uniqueStudents = new Set(failed.map(f => f.studentName)).size;
    const uniqueSubjects = new Set(failed.map(f => f.subjectName)).size;
    const studentsWithFailedAreas = new Set(areaResults.filter(a => a.failed).map(a => a.studentName)).size;
    const gradedRows = rows.filter(r => r.hasData).length;
    const failRate = gradedRows > 0 ? Math.round((failed.length / gradedRows) * 1000) / 10 : 0;

    return {
      meta,
      scope,
      cutoffDate: cutoffDate ? cutoffDate.toISOString() : null,
      passingGrade,
      rule: { approvalRule, failIfAnyFails, officialUnit },
      totalFailed: failed.length,
      uniqueStudents,
      uniqueSubjects,
      totalFailedAreas: areaResults.filter(a => a.failed).length,
      studentsWithFailedAreas,
      summary: { totalFailed: failed.length, studentsAffected: uniqueStudents, failRate },
      results: failed,
      areaResults,
    };
  }

  /**
   * Corte parcial: calcula la nota de cada estudiante × asignatura del grupo a una fecha,
   * con el mismo motor del Corte Preventivo. grade === null = "sin datos aún" (no reprobado).
   */
  private async loadPartialFailedRows(
    academicYearId: string,
    groupId: string,
    termId: string,
    cutoffDate: Date,
  ): Promise<FailedRow[]> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { name: true, grade: { select: { name: true } } },
    });
    const groupName = `${group?.grade?.name ?? ''} ${group?.name ?? ''}`.trim();

    const assignments = await this.prisma.teacherAssignment.findMany({
      where: { academicYearId, groupId },
      include: { subject: { include: { area: { select: { id: true, name: true } } } } },
    });

    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { academicYearId, groupId, status: 'ACTIVE' },
      include: { student: { select: { firstName: true, secondName: true, lastName: true, secondLastName: true } } },
      orderBy: { student: { lastName: 'asc' } },
    });

    const rows: FailedRow[] = [];
    for (const enr of enrollments) {
      const studentName = [enr.student.lastName, enr.student.secondLastName, enr.student.firstName, enr.student.secondName]
        .filter(Boolean).join(' ');
      for (const a of assignments) {
        const res = await this.studentGradesService.calculateTermGradeAtDate(enr.id, a.id, termId, cutoffDate);
        rows.push({
          studentEnrollmentId: enr.id,
          studentName,
          group: groupName,
          subjectId: a.subjectId,
          subjectName: a.subject?.name ?? 'Asignatura',
          areaId: a.subject?.area?.id ?? null,
          areaName: a.subject?.area?.name ?? '',
          termName: '',
          grade: res.grade,
          hasData: res.grade !== null,
        });
      }
    }
    return rows;
  }

  /**
   * Agrega las filas por estudiante → área y decide si el área está reprobada según la regla:
   *   AREA_AVERAGE      → promedio del área < aprobatoria
   *   ALL_SUBJECTS_PASS → alguna asignatura del área por debajo
   *   DOMINANT_*        → (sin marca de dominante en este contexto) se usa el promedio del área
   *   areaFailIfAnyFails=true → además reprueba si cualquier asignatura reprueba
   */
  private buildFailedAreas(
    rows: FailedRow[],
    passingGrade: number,
    approvalRule: string,
    failIfAnyFails: boolean,
  ) {
    // studentEnrollmentId → areaId → { areaName, scores[], failedSubjects[] }
    const map = new Map<string, { studentName: string; areas: Map<string, { areaName: string; scores: number[]; failedSubjects: string[] }> }>();
    for (const r of rows) {
      if (!r.hasData || r.grade === null) continue;
      const areaKey = r.areaId ?? `name:${r.areaName || 'sin-area'}`;
      if (!map.has(r.studentEnrollmentId)) map.set(r.studentEnrollmentId, { studentName: r.studentName, areas: new Map() });
      const st = map.get(r.studentEnrollmentId)!;
      if (!st.areas.has(areaKey)) st.areas.set(areaKey, { areaName: r.areaName || 'Sin área', scores: [], failedSubjects: [] });
      const ar = st.areas.get(areaKey)!;
      ar.scores.push(r.grade as number);
      if ((r.grade as number) < passingGrade) ar.failedSubjects.push(r.subjectName);
    }

    const out: Array<{ studentName: string; areaName: string; areaAverage: number; failedSubjects: string[]; failed: boolean }> = [];
    for (const st of map.values()) {
      for (const ar of st.areas.values()) {
        if (ar.scores.length === 0) continue;
        const avg = Math.round((ar.scores.reduce((a, b) => a + b, 0) / ar.scores.length) * 10) / 10;
        const anySubjectFails = ar.failedSubjects.length > 0;
        let failed: boolean;
        if (approvalRule === 'ALL_SUBJECTS_PASS') failed = anySubjectFails;
        else failed = avg < passingGrade; // AREA_AVERAGE y DOMINANT (fallback)
        if (failIfAnyFails && anySubjectFails) failed = true;
        out.push({ studentName: st.studentName, areaName: ar.areaName, areaAverage: avg, failedSubjects: ar.failedSubjects, failed });
      }
    }
    return out
      .filter(a => a.failed)
      .sort((a, b) => a.studentName.localeCompare(b.studentName) || a.areaName.localeCompare(b.areaName));
  }

  /**
   * Reporte 7: Listado de recuperación
   * ¿Quién puede recuperar? Filtra por rango configurable.
   */
  async getRecoveryList(institutionId: string, academicYearId: string, groupId: string, termId?: string, minScore?: number, maxScore?: number, reportMode?: ReportMode) {
    const passingGrade = await this.academicYearService.getPassingGrade(institutionId);
    const effectiveMin = minScore ?? (passingGrade - 1.0);
    const effectiveMax = maxScore ?? (passingGrade - 0.1);

    // Obtener recuperaciones directamente de PeriodRecovery (datos en vivo)
    const where: any = {
      institutionId,
      academicYearId,
      groupId,
      status: { in: ['PENDING', 'IN_PROGRESS', 'APPROVED', 'NOT_APPROVED', 'COMPLETED'] },
    };
    if (termId) where.academicTermId = termId;

    const recoveries = await this.prisma.periodRecovery.findMany({
      where,
      include: {
        studentEnrollment: {
          select: {
            student: { select: { firstName: true, lastName: true, secondLastName: true } },
            group: { select: { name: true } },
          },
        },
        subject: { select: { name: true } },
        academicTerm: { select: { name: true } },
      },
    });

    // Filtrar por rango de notas (usar originalScore para determinar quiénes necesitan recuperación)
    const recoverable = recoveries
      .filter(r => {
        const originalScore = Number(r.originalScore);
        return originalScore >= effectiveMin && originalScore < passingGrade && originalScore <= effectiveMax;
      })
      .map(r => ({
        studentName: [r.studentEnrollment.student.lastName, r.studentEnrollment.student.secondLastName, r.studentEnrollment.student.firstName].filter(Boolean).join(' '),
        group: r.studentEnrollment.group.name,
        subjectName: r.subject.name,
        grade: r.finalScore !== null ? Number(r.finalScore) : Number(r.originalScore), // Mostrar final si existe, sino original
        termName: r.academicTerm.name,
        deficit: Math.round((passingGrade - Number(r.originalScore)) * 10) / 10,
        status: r.status,
        recoveryScore: r.recoveryScore !== null ? Number(r.recoveryScore) : null,
      }))
      .sort((a, b) => a.studentName.localeCompare(b.studentName));

    // Meta para compatibilidad con otros reportes
    const meta = { 
      source: 'live', 
      reportMode: reportMode ?? 'FINAL',
      totalStudents: new Set(recoverable.map(r => r.studentName)).size,
      scope: 'group',
    };

    return { meta, passingGrade, rangeMin: effectiveMin, rangeMax: effectiveMax, totalRecoverable: recoverable.length, results: recoverable };
  }

  /**
   * Reporte 8: Proyección de promoción
   * Si mantiene tendencia, ¿aprueba el año?
   * Reutiliza calculateMinimumGradeForGroup para datos, agrega proyección.
   */
  async getPromotionProjection(institutionId: string, academicYearId: string, groupId: string, reportMode?: ReportMode) {
    const rulesCtx = await this.institutionContext.getContext(institutionId);
    const passingGrade = rulesCtx.minPassingGrade;
    const terms = await this.academicYearService.getTermsByAcademicYear(academicYearId);
    const { meta, grades } = await this.academicDataSource.getTermGradeData({ institutionId, academicYearId, groupId, reportMode });

    // Agrupar por estudiante → por asignatura → por período
    const studentMap = new Map<string, {
      name: string;
      group: string;
      subjects: Map<string, { name: string; termGrades: Map<string, number> }>;
    }>();

    for (const g of grades) {
      const sKey = g.studentEnrollmentId;
      if (!studentMap.has(sKey)) {
        studentMap.set(sKey, {
          name: g.studentFullName || `${g.studentLastName} ${g.studentFirstName}`,
          group: g.groupName,
          subjects: new Map(),
        });
      }
      const student = studentMap.get(sKey)!;
      if (!student.subjects.has(g.subjectId)) {
        student.subjects.set(g.subjectId, { name: g.subjectName, termGrades: new Map() });
      }
      student.subjects.get(g.subjectId)!.termGrades.set(g.academicTermId, g.finalScore);
    }

    const completedTermIds = new Set<string>();
    const termWeights = new Map<string, number>();
    for (const t of terms) {
      termWeights.set(t.id, t.weightPercentage);
    }

    // Determinar períodos completados (tienen al menos una nota)
    for (const g of grades) {
      completedTermIds.add(g.academicTermId);
    }

    const pendingTerms = terms.filter(t => !completedTermIds.has(t.id));
    const totalPendingWeight = pendingTerms.reduce((acc, t) => acc + t.weightPercentage, 0);

    const results = Array.from(studentMap.entries()).map(([, data]) => {
      let totalSubjects = 0;
      let projectedApproved = 0;
      let atRisk = 0;
      let projectedFailed = 0;

      const subjectDetails: Array<{
        subjectName: string;
        currentWeightedAvg: number | null;
        projectedAnnual: number | null;
        status: string;
      }> = [];

      for (const [, subj] of data.subjects) {
        totalSubjects++;
        // Calcular promedio ponderado actual
        let weightedSum = 0;
        let totalWeight = 0;
        for (const [termId, grade] of subj.termGrades) {
          const weight = termWeights.get(termId) || 0;
          weightedSum += grade * weight;
          totalWeight += weight;
        }
        const currentAvg = totalWeight > 0 ? weightedSum / totalWeight : null;

        // Proyectar: si mantiene promedio actual en períodos restantes
        let projectedAnnual: number | null = null;
        if (currentAvg !== null && totalPendingWeight > 0) {
          projectedAnnual = Math.round(((weightedSum + currentAvg * totalPendingWeight) / 100) * 10) / 10;
        } else if (currentAvg !== null) {
          projectedAnnual = Math.round((weightedSum / 100) * 10) / 10;
        }

        let status = 'SIN_DATOS';
        if (projectedAnnual !== null) {
          if (projectedAnnual >= passingGrade) {
            status = 'PROMUEVE';
            projectedApproved++;
          } else if (currentAvg !== null && currentAvg >= passingGrade - 0.5) {
            status = 'EN_RIESGO';
            atRisk++;
          } else {
            status = 'NO_PROMUEVE';
            projectedFailed++;
          }
        }

        subjectDetails.push({
          subjectName: subj.name,
          currentWeightedAvg: currentAvg !== null ? Math.round(currentAvg * 10) / 10 : null,
          projectedAnnual,
          status,
        });
      }

      return {
        studentName: data.name,
        group: data.group,
        totalSubjects,
        projectedApproved,
        atRisk,
        projectedFailed,
        overallProjection: projectedFailed > 0 ? 'NO_PROMUEVE' : atRisk > 0 ? 'EN_RIESGO' : 'PROMUEVE',
        subjects: subjectDetails,
      };
    });

    const sortedResults = results.sort((a, b) => a.studentName.localeCompare(b.studentName));

    return {
      meta,
      passingGrade,
      completedTerms: completedTermIds.size,
      totalTerms: terms.length,
      pendingTerms: pendingTerms.length,
      summary: {
        total: sortedResults.length,
        promoted: sortedResults.filter(r => r.overallProjection === 'PROMUEVE').length,
        atRisk: sortedResults.filter(r => r.overallProjection === 'EN_RIESGO').length,
        notPromoted: sortedResults.filter(r => r.overallProjection === 'NO_PROMUEVE').length,
      },
      results: sortedResults,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // BLOQUE 3 — HISTÓRICO
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Reporte 9: Comparativo de períodos
   * Evolución del rendimiento entre períodos.
   */
  async getPeriodComparison(institutionId: string, academicYearId: string, groupId?: string, studentEnrollmentId?: string, reportMode?: ReportMode) {
    const { meta, grades } = await this.academicDataSource.getTermGradeData({ institutionId, academicYearId, groupId, reportMode });
    const terms = await this.academicYearService.getTermsByAcademicYear(academicYearId);
    const termOrder = terms.sort((a, b) => a.order - b.order);

    // Si es un estudiante específico, mostrar por asignatura × período
    if (studentEnrollmentId) {
      const studentGrades = grades.filter(g => g.studentEnrollmentId === studentEnrollmentId);
      const subjectMap = new Map<string, { name: string; termGrades: Map<string, number> }>();

      for (const g of studentGrades) {
        if (!subjectMap.has(g.subjectId)) {
          subjectMap.set(g.subjectId, { name: g.subjectName, termGrades: new Map() });
        }
        subjectMap.get(g.subjectId)!.termGrades.set(g.academicTermId, g.finalScore);
      }

      const results = Array.from(subjectMap.values()).map(data => {
        const termValues = termOrder.map(t => data.termGrades.get(t.id) ?? null);
        const obtained = termValues.filter((v): v is number => v !== null);
        const first = obtained[0] ?? null;
        const last = obtained.length > 1 ? obtained[obtained.length - 1] : null;
        const variation = first !== null && last !== null ? Math.round((last - first) * 10) / 10 : null;

        return {
          subjectName: data.name,
          termGrades: termOrder.map(t => ({
            termId: t.id,
            termName: t.name,
            grade: data.termGrades.get(t.id) ?? null,
          })),
          variation,
          trend: variation !== null ? (variation > 0 ? 'Mejora' : variation < 0 ? 'Baja' : 'Estable') : null,
        };
      });

      return { meta, type: 'student', terms: termOrder.map(t => ({ id: t.id, name: t.name })), results };
    }

    // Vista grupal: promedio del grupo por período
    const termAverages = termOrder.map(term => {
      const termGrades = grades.filter(g => g.academicTermId === term.id);
      const scores = termGrades.map(g => g.finalScore);
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      return {
        termId: term.id,
        termName: term.name,
        average: avg !== null ? Math.round(avg * 10) / 10 : null,
        totalGrades: scores.length,
      };
    });

    // Por estudiante
    const studentMap = new Map<string, { name: string; termAvgs: Map<string, number[]> }>();
    for (const g of grades) {
      const key = g.studentEnrollmentId;
      if (!studentMap.has(key)) {
        studentMap.set(key, { name: g.studentFullName || `${g.studentLastName} ${g.studentFirstName}`, termAvgs: new Map() });
      }
      const data = studentMap.get(key)!;
      if (!data.termAvgs.has(g.academicTermId)) data.termAvgs.set(g.academicTermId, []);
      data.termAvgs.get(g.academicTermId)!.push(g.finalScore);
    }

    const studentResults = Array.from(studentMap.values()).map(data => {
      const termValues = termOrder.map(t => {
        const scores = data.termAvgs.get(t.id);
        return scores ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;
      });
      const obtained = termValues.filter((v): v is number => v !== null);
      const first = obtained[0] ?? null;
      const last = obtained.length > 1 ? obtained[obtained.length - 1] : null;
      const variation = first !== null && last !== null ? Math.round((last - first) * 10) / 10 : null;

      return {
        studentName: data.name,
        termAverages: termOrder.map((t, i) => ({
          termId: t.id,
          termName: t.name,
          average: termValues[i],
        })),
        variation,
        trend: variation !== null ? (variation > 0 ? 'Mejora' : variation < 0 ? 'Baja' : 'Estable') : null,
      };
    }).sort((a, b) => a.studentName.localeCompare(b.studentName));

    return {
      meta,
      type: 'group',
      terms: termOrder.map(t => ({ id: t.id, name: t.name })),
      groupAverages: termAverages,
      results: studentResults,
    };
  }

  /**
   * Reporte 10: Historial académico
   * Trayectoria de un estudiante a lo largo de los años.
   */
  async getStudentHistory(studentId: string) {
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { studentId },
      include: {
        academicYear: true,
        group: { include: { grade: true } },
        periodFinalGrades: {
          include: {
            subject: { include: { area: { select: { name: true } } } },
            academicTerm: { select: { name: true, order: true, weightPercentage: true } },
          },
        },
      },
      orderBy: { academicYear: { year: 'asc' } },
    });

    return enrollments.map(enrollment => {
      const gradesBySubject = new Map<string, { name: string; area: string; grades: number[] }>();
      for (const pfg of enrollment.periodFinalGrades) {
        if (!gradesBySubject.has(pfg.subjectId)) {
          gradesBySubject.set(pfg.subjectId, {
            name: pfg.subject.name,
            area: pfg.subject.area?.name || '',
            grades: [],
          });
        }
        gradesBySubject.get(pfg.subjectId)!.grades.push(Number(pfg.finalScore));
      }

      const subjects = Array.from(gradesBySubject.values()).map(s => ({
        subjectName: s.name,
        areaName: s.area,
        average: s.grades.length > 0 ? Math.round((s.grades.reduce((a, b) => a + b, 0) / s.grades.length) * 10) / 10 : null,
      }));

      const allGrades = enrollment.periodFinalGrades.map(g => Number(g.finalScore));
      const yearAvg = allGrades.length > 0 ? Math.round((allGrades.reduce((a, b) => a + b, 0) / allGrades.length) * 10) / 10 : null;

      return {
        yearId: enrollment.academicYearId,
        year: enrollment.academicYear.year,
        yearName: enrollment.academicYear.name || `${enrollment.academicYear.year}`,
        group: `${enrollment.group.grade?.name || ''} ${enrollment.group.name}`,
        status: enrollment.status,
        average: yearAvg,
        subjects,
      };
    });
  }

  /**
   * Reporte 11: Análisis por asignatura
   * ¿Cómo se comporta una asignatura a lo largo del tiempo?
   */
  async getSubjectAnalysis(institutionId: string, academicYearId: string, subjectId: string, groupId?: string, reportMode?: ReportMode) {
    const passingGrade = await this.academicYearService.getPassingGrade(institutionId);
    const terms = await this.academicYearService.getTermsByAcademicYear(academicYearId);
    const { meta, grades } = await this.academicDataSource.getTermGradeData({ institutionId, academicYearId, subjectId, groupId, reportMode });

    // Agrupar por grupo
    const groupMap = new Map<string, { name: string; termData: Map<string, number[]> }>();
    for (const g of grades) {
      const gKey = g.groupId;
      if (!groupMap.has(gKey)) {
        groupMap.set(gKey, {
          name: g.groupName,
          termData: new Map(),
        });
      }
      const group = groupMap.get(gKey)!;
      if (!group.termData.has(g.academicTermId)) group.termData.set(g.academicTermId, []);
      group.termData.get(g.academicTermId)!.push(g.finalScore);
    }

    const termOrder = terms.sort((a, b) => a.order - b.order);

    const results = Array.from(groupMap.entries()).map(([, data]) => {
      const termResults = termOrder.map(t => {
        const scores = data.termData.get(t.id) || [];
        const avg = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;
        const approved = scores.filter(s => s >= passingGrade).length;
        return {
          termName: t.name,
          average: avg,
          approvalRate: scores.length > 0 ? Math.round((approved / scores.length) * 1000) / 10 : null,
          totalStudents: scores.length,
        };
      });

      return { groupName: data.name, terms: termResults };
    });

    return { meta, passingGrade, subject: grades[0]?.subjectName || '', results };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // BLOQUE 4 — GESTIÓN DOCENTE
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Reporte 12: Rendimiento por docente
   * ¿Cómo rinden los grupos con cada docente?
   */
  async getTeacherPerformance(institutionId: string, academicYearId: string, teacherId?: string, reportMode?: ReportMode) {
    const passingGrade = await this.academicYearService.getPassingGrade(institutionId);

    // Obtener asignaciones de docentes
    const assignments = await this.prisma.teacherAssignment.findMany({
      where: {
        institutionId,
        academicYearId,
        ...(teacherId && { teacherId }),
      },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true } },
        subject: { select: { id: true, name: true } },
        group: { include: { grade: true } },
      },
    });

    // Para cada asignación, obtener notas
    const results: Array<{
      teacherName: string;
      subjectName: string;
      groupName: string;
      average: number | null;
      approvalRate: number | null;
      totalStudents: number;
    }> = [];

    // Obtener todas las notas del año de una vez (via motor centralizado)
    const { meta, grades: allGrades } = await this.academicDataSource.getTermGradeData({ institutionId, academicYearId, reportMode });

    // Indexar notas por grupo+asignatura
    const gradeIndex = new Map<string, number[]>();
    for (const g of allGrades) {
      const key = `${g.groupId}:${g.subjectId}`;
      if (!gradeIndex.has(key)) gradeIndex.set(key, []);
      gradeIndex.get(key)!.push(g.finalScore);
    }

    for (const a of assignments) {
      const key = `${a.groupId}:${a.subjectId}`;
      const scores = gradeIndex.get(key) || [];
      const avg = scores.length > 0 ? Math.round((scores.reduce((x, y) => x + y, 0) / scores.length) * 10) / 10 : null;
      const approved = scores.filter(s => s >= passingGrade).length;

      results.push({
        teacherName: `${a.teacher.lastName} ${a.teacher.firstName}`,
        subjectName: a.subject.name,
        groupName: `${a.group.grade?.name || ''} ${a.group.name}`,
        average: avg,
        approvalRate: scores.length > 0 ? Math.round((approved / scores.length) * 1000) / 10 : null,
        totalStudents: scores.length,
      });
    }

    return {
      meta,
      passingGrade,
      results: results.sort((a, b) => a.teacherName.localeCompare(b.teacherName) || a.subjectName.localeCompare(b.subjectName)),
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // BLOQUE 4b — IMPACTO DE RECUPERACIONES
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Reporte de impacto de recuperación.
   * Compara datos INITIAL vs FINAL para cuantificar el efecto real de las recuperaciones.
   * Usa datos de PeriodRecovery (ya tiene originalScore, recoveryScore, finalScore).
   */
  async getRecoveryImpact(institutionId: string, academicTermId: string, groupId?: string) {
    const passingGrade = await this.academicYearService.getPassingGrade(institutionId);

    // Obtener todas las recuperaciones del período
    const where: any = {
      institutionId,
      academicTermId,
      status: { in: ['APPROVED', 'NOT_APPROVED', 'COMPLETED'] },
    };

    const recoveries = await this.prisma.periodRecovery.findMany({
      where,
      include: {
        studentEnrollment: {
          select: {
            id: true,
            groupId: true,
            student: { select: { firstName: true, lastName: true, secondLastName: true } },
            group: { include: { grade: { select: { name: true } } } },
          },
        },
        subject: { select: { id: true, name: true } },
      },
    });

    // Filtrar por grupo si se especifica
    const filtered = groupId
      ? recoveries.filter(r => r.studentEnrollment.groupId === groupId)
      : recoveries;

    // Calcular estadísticas
    const initialFailures = filtered.length; // Todos entraron por tener nota < aprobatoria
    const recovered = filtered.filter(r => r.status === 'APPROVED' && r.finalScore !== null && Number(r.finalScore) >= passingGrade);
    const notRecovered = filtered.filter(r => r.status !== 'APPROVED' || (r.finalScore !== null && Number(r.finalScore) < passingGrade));
    const recoveryRate = initialFailures > 0 ? Math.round((recovered.length / initialFailures) * 1000) / 10 : 0;

    // Detalle por asignatura
    const subjectMap = new Map<string, { name: string; initial: number; recovered: number; remaining: number }>();
    for (const r of filtered) {
      const key = r.subjectId;
      if (!subjectMap.has(key)) {
        subjectMap.set(key, { name: r.subject.name, initial: 0, recovered: 0, remaining: 0 });
      }
      const entry = subjectMap.get(key)!;
      entry.initial++;
      if (r.status === 'APPROVED' && r.finalScore !== null && Number(r.finalScore) >= passingGrade) {
        entry.recovered++;
      } else {
        entry.remaining++;
      }
    }

    // Detalle por estudiante
    const studentMap = new Map<string, {
      name: string; group: string;
      subjects: Array<{ name: string; originalScore: number; recoveryScore: number | null; finalScore: number | null; status: string }>;
    }>();
    for (const r of filtered) {
      const key = r.studentEnrollmentId;
      if (!studentMap.has(key)) {
        const s = r.studentEnrollment.student;
        studentMap.set(key, {
          name: [s.lastName, s.secondLastName, s.firstName].filter(Boolean).join(' '),
          group: `${r.studentEnrollment.group.grade.name} ${r.studentEnrollment.group.name}`,
          subjects: [],
        });
      }
      studentMap.get(key)!.subjects.push({
        name: r.subject.name,
        originalScore: Number(r.originalScore),
        recoveryScore: r.recoveryScore !== null ? Number(r.recoveryScore) : null,
        finalScore: r.finalScore !== null ? Number(r.finalScore) : null,
        status: r.status,
      });
    }

    return {
      academicTermId,
      passingGrade,
      summary: {
        initialFailures,
        recoveredStudents: recovered.length,
        remainingFailures: notRecovered.length,
        recoveryRate,
      },
      bySubject: Array.from(subjectMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
      byStudent: Array.from(studentMap.values())
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(s => ({
          ...s,
          totalRecoveries: s.subjects.length,
          recoveredCount: s.subjects.filter(sub => sub.finalScore !== null && sub.finalScore >= passingGrade).length,
        })),
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // BLOQUE 5 — REPORTES INSTITUCIONALES
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Reporte 13: Consolidado estadístico institucional
   * Agrega estadísticas de TODOS los grupos por nivel educativo (stage).
   * Retorna: promedio por nivel, tasa aprobación, distribución, ranking de grupos.
   */
  async getInstitutionalStatistics(institutionId: string, academicYearId: string, termId?: string, reportMode?: ReportMode) {
    const passingGrade = await this.academicYearService.getPassingGrade(institutionId);
    const { meta, grades } = await this.academicDataSource.getTermGradeData({ institutionId, academicYearId, termId, reportMode });

    // Obtener todos los grupos del año con su stage (via enrollments activos)
    const groups = await this.prisma.group.findMany({
      where: {
        studentEnrollments: { some: { academicYearId, status: 'ACTIVE' } },
      },
      include: { grade: { select: { id: true, name: true, stage: true } } },
    });
    const groupStageMap = new Map<string, string>();
    const groupNameMap = new Map<string, string>();
    for (const g of groups) {
      groupStageMap.set(g.id, g.grade?.stage || 'SIN_NIVEL');
      groupNameMap.set(g.id, `${g.grade?.name || ''} ${g.name}`.trim());
    }

    const STAGE_LABELS: Record<string, string> = {
      PREESCOLAR: 'Preescolar',
      BASICA_PRIMARIA: 'Básica Primaria',
      BASICA_SECUNDARIA: 'Básica Secundaria',
      MEDIA: 'Media',
      SIN_NIVEL: 'Sin nivel',
    };

    // ── Agrupar por stage ──
    const stageMap = new Map<string, { scores: number[]; groupScores: Map<string, number[]> }>();
    for (const g of grades) {
      const stage = groupStageMap.get(g.groupId) || 'SIN_NIVEL';
      if (!stageMap.has(stage)) stageMap.set(stage, { scores: [], groupScores: new Map() });
      const entry = stageMap.get(stage)!;
      entry.scores.push(g.finalScore);
      if (!entry.groupScores.has(g.groupId)) entry.groupScores.set(g.groupId, []);
      entry.groupScores.get(g.groupId)!.push(g.finalScore);
    }

    // ── Estadísticas por nivel ──
    const stageResults = Array.from(stageMap.entries()).map(([stage, data]) => {
      const { scores } = data;
      const avg = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;
      const approved = scores.filter(s => s >= passingGrade).length;
      const approvalRate = scores.length > 0 ? Math.round((approved / scores.length) * 1000) / 10 : 0;

      // Ranking de grupos dentro del nivel
      const groupRanking = Array.from(data.groupScores.entries()).map(([gId, gScores]) => {
        const gAvg = gScores.length > 0 ? Math.round((gScores.reduce((a, b) => a + b, 0) / gScores.length) * 10) / 10 : 0;
        const gApproved = gScores.filter(s => s >= passingGrade).length;
        return {
          groupId: gId,
          groupName: groupNameMap.get(gId) || gId,
          average: gAvg,
          approvalRate: gScores.length > 0 ? Math.round((gApproved / gScores.length) * 1000) / 10 : 0,
          totalStudents: new Set(grades.filter(gr => gr.groupId === gId).map(gr => gr.studentEnrollmentId)).size,
          totalGrades: gScores.length,
        };
      }).sort((a, b) => b.average - a.average);

      return {
        stage,
        stageLabel: STAGE_LABELS[stage] || stage,
        average: avg,
        approvalRate,
        failRate: Math.round((100 - approvalRate) * 10) / 10,
        totalGrades: scores.length,
        totalStudents: new Set(grades.filter(g => (groupStageMap.get(g.groupId) || 'SIN_NIVEL') === stage).map(g => g.studentEnrollmentId)).size,
        totalGroups: data.groupScores.size,
        bestGroup: groupRanking[0] || null,
        worstGroup: groupRanking[groupRanking.length - 1] || null,
        groupRanking,
      };
    });

    // ── Resumen institucional global ──
    const allScores = grades.map(g => g.finalScore);
    const institutionalAvg = allScores.length > 0 ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10 : 0;
    const totalApproved = allScores.filter(s => s >= passingGrade).length;
    const institutionalApprovalRate = allScores.length > 0 ? Math.round((totalApproved / allScores.length) * 1000) / 10 : 0;
    const uniqueStudents = new Set(grades.map(g => g.studentEnrollmentId)).size;

    return {
      meta,
      passingGrade,
      institutional: {
        average: institutionalAvg,
        approvalRate: institutionalApprovalRate,
        failRate: Math.round((100 - institutionalApprovalRate) * 10) / 10,
        totalStudents: uniqueStudents,
        totalGroups: groups.length,
        totalGrades: allScores.length,
      },
      stages: stageResults.sort((a, b) => {
        const order = ['PREESCOLAR', 'BASICA_PRIMARIA', 'BASICA_SECUNDARIA', 'MEDIA'];
        return (order.indexOf(a.stage) ?? 99) - (order.indexOf(b.stage) ?? 99);
      }),
    };
  }

  /**
   * Reporte 14: Comparativo institucional anual
   * Compara métricas clave entre 2+ años académicos.
   * Retorna: promedio, tasa aprobación, total estudiantes por año.
   */
  async getAnnualComparison(institutionId: string, academicYearIds: string[]) {
    if (academicYearIds.length < 1) return { results: [] };

    const passingGrade = await this.academicYearService.getPassingGrade(institutionId);

    const yearResults: Array<{
      academicYearId: string;
      yearName: string;
      year: number;
      average: number;
      approvalRate: number;
      failRate: number;
      totalStudents: number;
      totalGroups: number;
      totalGrades: number;
      stageBreakdown: Array<{
        stage: string;
        stageLabel: string;
        average: number;
        approvalRate: number;
        totalStudents: number;
      }>;
    }> = [];

    for (const yearId of academicYearIds) {
      const academicYear = await this.prisma.academicYear.findUnique({
        where: { id: yearId },
        select: { id: true, year: true, name: true },
      });
      if (!academicYear) continue;

      const groups = await this.prisma.group.findMany({
        where: {
          studentEnrollments: { some: { academicYearId: yearId, status: 'ACTIVE' } },
        },
        include: { grade: { select: { stage: true } } },
      });
      const groupStageMap = new Map<string, string>();
      for (const g of groups) groupStageMap.set(g.id, g.grade?.stage || 'SIN_NIVEL');

      // Obtener notas del año (via motor centralizado)
      const { grades } = await this.academicDataSource.getTermGradeData({ institutionId, academicYearId: yearId });

      const allScores = grades.map(g => g.finalScore);
      const avg = allScores.length > 0 ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10 : 0;
      const approved = allScores.filter(s => s >= passingGrade).length;
      const approvalRate = allScores.length > 0 ? Math.round((approved / allScores.length) * 1000) / 10 : 0;
      const uniqueStudents = new Set(grades.map(g => g.studentEnrollmentId)).size;

      // Breakdown por stage
      const STAGE_LABELS: Record<string, string> = {
        PREESCOLAR: 'Preescolar', BASICA_PRIMARIA: 'Básica Primaria',
        BASICA_SECUNDARIA: 'Básica Secundaria', MEDIA: 'Media', SIN_NIVEL: 'Sin nivel',
      };
      const stageScores = new Map<string, { scores: number[]; students: Set<string> }>();
      for (const g of grades) {
        const stage = groupStageMap.get(g.groupId) || 'SIN_NIVEL';
        if (!stageScores.has(stage)) stageScores.set(stage, { scores: [], students: new Set() });
        const entry = stageScores.get(stage)!;
        entry.scores.push(g.finalScore);
        entry.students.add(g.studentEnrollmentId);
      }

      const stageBreakdown = Array.from(stageScores.entries()).map(([stage, data]) => {
        const sAvg = data.scores.length > 0 ? Math.round((data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 10) / 10 : 0;
        const sApproved = data.scores.filter(s => s >= passingGrade).length;
        return {
          stage,
          stageLabel: STAGE_LABELS[stage] || stage,
          average: sAvg,
          approvalRate: data.scores.length > 0 ? Math.round((sApproved / data.scores.length) * 1000) / 10 : 0,
          totalStudents: data.students.size,
        };
      }).sort((a, b) => {
        const order = ['PREESCOLAR', 'BASICA_PRIMARIA', 'BASICA_SECUNDARIA', 'MEDIA'];
        return (order.indexOf(a.stage) ?? 99) - (order.indexOf(b.stage) ?? 99);
      });

      yearResults.push({
        academicYearId: yearId,
        yearName: academicYear.name || `${academicYear.year}`,
        year: academicYear.year,
        average: avg,
        approvalRate,
        failRate: Math.round((100 - approvalRate) * 10) / 10,
        totalStudents: uniqueStudents,
        totalGroups: groups.length,
        totalGrades: allScores.length,
        stageBreakdown,
      });
    }

    // Calcular variaciones entre años consecutivos
    const sortedResults = yearResults.sort((a, b) => a.year - b.year);
    const variations = sortedResults.map((yr, i) => {
      if (i === 0) return { ...yr, avgVariation: null, approvalVariation: null, studentVariation: null };
      const prev = sortedResults[i - 1];
      return {
        ...yr,
        avgVariation: Math.round((yr.average - prev.average) * 10) / 10,
        approvalVariation: Math.round((yr.approvalRate - prev.approvalRate) * 10) / 10,
        studentVariation: yr.totalStudents - prev.totalStudents,
      };
    });

    return { passingGrade, results: variations };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BOLETINES BATCH — buildGroupReportCards()
  // Reduce ~1,100 queries por grupo a ~8 queries usando precarga en batch.
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Construye TODOS los boletines de un grupo en batch.
   * ~8 queries totales + procesamiento en memoria.
   *
   * Reemplaza el patrón anterior de N+1:
   *   for each student → getReportCardData() → múltiples queries internas
   *
   * Retorna la misma estructura que getReportCardData() pero para todos los estudiantes.
   */
  async buildGroupReportCards(
    groupId: string,
    academicTermId: string,
  ): Promise<{
    institution: { id: string; name: string; nit: string | null };
    academicYear: { id: string; year: number; name: string | null };
    term: { id: string; name: string; type: string };
    academicStructure: AcademicStructureType;
    displayConfig: ReturnType<typeof getDisplayConfig>;
    cards: Array<{
      enrollmentId: string;
      student: { id: string; firstName: string; lastName: string; documentType: string; documentNumber: string };
      group: { id: string; name: string; gradeLevel: string };
      areaGrades: Array<{
        area: string;
        areaCode: string | null;
        weightPercentage: number;
        calculationType: string;
        areaAverage: number | null;
        areaPerformanceLevel: string | null;
        subjects: Array<{
          subjectId: string | null;
          subject: string;
          subjectCode: string | null;
          teacher: string | null;
          grade: number | null;
          weightPercentage: number;
          performanceLevel: string | null;
          components: { componentId: string; name: string; average: number | null; percentage: number }[];
          achievement: string | null;
          achievementObservation: string | null;
          qualitativeObservation: string | null;
          judgment: string | null;
        }>;
      }>;
      subjectGrades: Array<{
        subjectId: string | null;
        subject: string;
        subjectCode: string | null;
        teacher: string | null;
        grade: number | null;
        originalGrade: number | null;
        recoveryGrade: number | null;
        hasRecovery: boolean;
        recoveryStatus: string | null;
        weightPercentage: number;
        performanceLevel: string | null;
        components: { componentId: string; name: string; average: number | null; percentage: number }[];
        achievement: string | null;
        achievementObservation: string | null;
        qualitativeObservation: string | null;
        judgment: string | null;
      }>;
      structureSource: 'snapshot' | 'calculated';
      attendance: { total: number; present: number; absent: number; late: number; excused: number; attendanceRate: number };
      achievements: Array<{ subjectId: string | null; subject: string; orderNumber: number; description: string; performanceLevel: string | null; observation: string | null; judgment: string | null }>;
      observations: Array<{ date: Date; type: string; category: string | null; description: string; author: string }>;
    }>;
    generatedAt: Date;
  }> {
    // ─── QUERY 1: Término académico ───────────────────────────────────────
    const term = await this.academicYearService.getTermById(academicTermId);
    if (!term) throw new NotFoundException('Período académico no encontrado');

    // ─── QUERY 2: Matrículas del grupo con estudiante + grupo + año + director ──
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { groupId, status: 'ACTIVE' },
      include: {
        student: true,
        group: { include: { grade: true, director: { select: { id: true, firstName: true, lastName: true, signatureImageUrl: true } } } },
        academicYear: { include: { institution: true } },
      },
      orderBy: { student: { lastName: 'asc' } },
    });

    if (enrollments.length === 0) {
      throw new NotFoundException('No hay estudiantes activos en este grupo');
    }

    const firstEnrollment = enrollments[0];
    const institutionId = firstEnrollment.academicYear.institutionId;
    const academicYearId = firstEnrollment.academicYearId;
    const enrollmentIds = enrollments.map(e => e.id);

    // ─── Resolver estructura académica del grado → displayConfig ────────
    const gradeStructure = (firstEnrollment.group.grade as any)?.academicStructure as AcademicStructureType || 'AREAS_SUBJECTS';
    const displayConfig = getDisplayConfig(gradeStructure);

    // ─── QUERY 3: Snapshot de estructura académica (EnrollmentArea + EnrollmentSubject) ──
    const enrollmentAreas = await this.prisma.enrollmentArea.findMany({
      where: { enrollmentId: { in: enrollmentIds } },
      include: {
        enrollmentSubjects: {
          include: { subject: true },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    });

    // Map<enrollmentId, EnrollmentArea[]>
    const enrollmentAreasMap = new Map<string, typeof enrollmentAreas>();
    for (const area of enrollmentAreas) {
      const list = enrollmentAreasMap.get(area.enrollmentId) || [];
      list.push(area);
      enrollmentAreasMap.set(area.enrollmentId, list);
    }

    // ─── QUERY 4: TeacherAssignments del grupo ───────────────────────────
    const teacherAssignments = await this.prisma.teacherAssignment.findMany({
      where: { groupId, academicYearId },
      include: {
        subject: { include: { area: true } },
        teacher: { select: { firstName: true, lastName: true } },
      },
    });

    // Map<subjectId, TeacherAssignment>
    const taBySubjectId = new Map<string, (typeof teacherAssignments)[0]>();
    for (const ta of teacherAssignments) {
      taBySubjectId.set(ta.subjectId, ta);
    }
    const teacherAssignmentIds = teacherAssignments.map(ta => ta.id);

    // ─── QUERY 5: EvaluationPlans con componentes (batch) ────────────────
    const evaluationPlans = await this.prisma.evaluationPlan.findMany({
      where: {
        teacherAssignmentId: { in: teacherAssignmentIds },
        academicTermId,
      },
      include: {
        components: {
          include: { component: true },
        },
      },
    });

    // Map<teacherAssignmentId_termId, { components: [...] }>
    const plansMap = new Map<string, { components: { componentId: string; code: string; name: string; percentage: number }[] }>();
    for (const plan of evaluationPlans) {
      const key = `${plan.teacherAssignmentId}_${plan.academicTermId}`;
      plansMap.set(key, {
        components: plan.components.map(cw => ({
          componentId: cw.componentId,
          code: cw.component.code,
          name: cw.component.name,
          percentage: cw.percentage,
        })),
      });
    }

    // ─── QUERY 6: PartialGrades de todos los estudiantes (batch) ─────────
    const allPartialGrades = await this.prisma.partialGrade.findMany({
      where: {
        studentEnrollmentId: { in: enrollmentIds },
        academicTermId,
      },
    });

    // Map<enrollmentId, PartialGrade[]>
    const partialsMap = new Map<string, { teacherAssignmentId: string; academicTermId: string; componentType: string; score: number }[]>();
    for (const pg of allPartialGrades) {
      const list = partialsMap.get(pg.studentEnrollmentId) || [];
      list.push({
        teacherAssignmentId: pg.teacherAssignmentId,
        academicTermId: pg.academicTermId,
        componentType: pg.componentType,
        score: Number(pg.score),
      });
      partialsMap.set(pg.studentEnrollmentId, list);
    }

    // ─── QUERY 6.5: PeriodFinalGrade — Override para recuperaciones ────────
    // Si existe una nota final (especialmente de recuperación), usarla en lugar de recalcular
    const allFinalGrades = await this.prisma.periodFinalGrade.findMany({
      where: {
        studentEnrollmentId: { in: enrollmentIds },
        academicTermId,
      },
      select: {
        studentEnrollmentId: true,
        subjectId: true,
        finalScore: true,
      },
    });

    // Map<enrollmentId_subjectId, finalScore> — Para override de notas de recuperación
    const finalGradesMap = new Map<string, number>();
    for (const fg of allFinalGrades) {
      const key = `${fg.studentEnrollmentId}_${fg.subjectId}`;
      finalGradesMap.set(key, Number(fg.finalScore));
    }

    // ─── QUERY 6.6: PeriodRecovery — Para mostrar notas de recuperación ────────
    const allRecoveries = await this.prisma.periodRecovery.findMany({
      where: {
        studentEnrollmentId: { in: enrollmentIds },
        academicTermId,
        status: { in: ['APPROVED', 'COMPLETED'] },
        finalScore: { not: null },
      },
      select: {
        studentEnrollmentId: true,
        subjectId: true,
        originalScore: true,
        recoveryScore: true,
        finalScore: true,
        status: true,
      },
    });

    // Map<enrollmentId_subjectId, recovery data> — Para mostrar historial de recuperación
    const recoveryMap = new Map<string, { originalScore: number; recoveryScore: number | null; finalScore: number; status: string }>();
    for (const rec of allRecoveries) {
      const key = `${rec.studentEnrollmentId}_${rec.subjectId}`;
      recoveryMap.set(key, {
        originalScore: Number(rec.originalScore),
        recoveryScore: rec.recoveryScore ? Number(rec.recoveryScore) : null,
        finalScore: Number(rec.finalScore),
        status: rec.status,
      });
    }

    // ─── QUERY 7: PerformanceScale (1 sola vez por institución) ──────────
    const performanceScales = await this.prisma.performanceScale.findMany({
      where: { institutionId },
      orderBy: { minScore: 'asc' },
    });
    const scaleArray = performanceScales.map(s => ({
      level: s.level,
      minScore: Number(s.minScore),
      maxScore: Number(s.maxScore),
    }));

    // ─── QUERY 8: AttendanceRecords de todos los estudiantes (batch) ─────
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (term.startDate) dateFilter.gte = term.startDate;
    if (term.endDate) dateFilter.lte = term.endDate;

    const allAttendance = await this.prisma.attendanceRecord.findMany({
      where: {
        studentEnrollmentId: { in: enrollmentIds },
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
      },
    });

    // Map<enrollmentId, AttendanceSummary> — totales por estudiante
    const attendanceMap = new Map<string, { total: number; present: number; absent: number; late: number; excused: number; attendanceRate: number }>();
    // Map<enrollmentId_teacherAssignmentId, absences> — fallas por asignatura
    const subjectAbsencesMap = new Map<string, number>();

    // Agrupar por enrollmentId
    const attByEnrollment = new Map<string, (typeof allAttendance)>();
    for (const rec of allAttendance) {
      const list = attByEnrollment.get(rec.studentEnrollmentId) || [];
      list.push(rec);
      attByEnrollment.set(rec.studentEnrollmentId, list);

      // Contar fallas por asignatura (teacherAssignmentId)
      if (rec.status === 'ABSENT') {
        const key = `${rec.studentEnrollmentId}_${rec.teacherAssignmentId}`;
        subjectAbsencesMap.set(key, (subjectAbsencesMap.get(key) || 0) + 1);
      }
    }
    for (const enrollmentId of enrollmentIds) {
      const records = attByEnrollment.get(enrollmentId) || [];
      const total = records.length;
      const present = records.filter(r => r.status === 'PRESENT').length;
      const absent = records.filter(r => r.status === 'ABSENT').length;
      const late = records.filter(r => r.status === 'LATE').length;
      const excused = records.filter(r => r.status === 'EXCUSED').length;
      const attendanceRate = total > 0 ? Math.round(((present + late + excused) / total) * 100) : 0;
      attendanceMap.set(enrollmentId, { total, present, absent, late, excused, attendanceRate });
    }

    // ─── QUERY 9: StudentAchievements de todos los estudiantes (batch) ───
    const allAchievements = await this.prisma.studentAchievement.findMany({
      where: {
        studentEnrollmentId: { in: enrollmentIds },
        achievement: { academicTermId },
      },
      include: {
        achievement: {
          include: {
            teacherAssignment: {
              include: { subject: true },
            },
          },
        },
      },
      orderBy: { achievement: { orderNumber: 'asc' } },
    });

    // Map<enrollmentId, Achievement[]>
    const achievementsMap = new Map<string, typeof allAchievements>();
    for (const sa of allAchievements) {
      const list = achievementsMap.get(sa.studentEnrollmentId) || [];
      list.push(sa);
      achievementsMap.set(sa.studentEnrollmentId, list);
    }

    // ─── QUERY 10: StudentObservations de todos los estudiantes (batch) ──
    const obsWhere: any = {
      studentEnrollmentId: { in: enrollmentIds },
    };
    if (term.startDate || term.endDate) {
      obsWhere.date = {};
      if (term.startDate) obsWhere.date.gte = term.startDate;
      if (term.endDate) obsWhere.date.lte = term.endDate;
    }
    const allObservations = await this.prisma.studentObservation.findMany({
      where: obsWhere,
      include: {
        author: { select: { firstName: true, lastName: true } },
      },
      orderBy: { date: 'desc' },
    });

    // Map<enrollmentId, Observation[]>
    const observationsMap = new Map<string, typeof allObservations>();
    for (const obs of allObservations) {
      const list = observationsMap.get(obs.studentEnrollmentId) || [];
      list.push(obs);
      observationsMap.set(obs.studentEnrollmentId, list);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PROCESAMIENTO EN MEMORIA — 0 queries adicionales
    // ═══════════════════════════════════════════════════════════════════════

    const cards = enrollments.map((enrollment) => {
      const enrollmentId = enrollment.id;

      // ─── Resolver estructura académica ─────────────────────────────────
      const areas = enrollmentAreasMap.get(enrollmentId);
      let structureSource: 'snapshot' | 'calculated' = 'calculated';
      let resolvedAreas: Array<{
        areaId: string | null;
        name: string;
        code: string | null;
        weightPercentage: number;
        calculationType: string;
        subjects: Array<{
          id: string | null;
          name: string;
          code: string | null;
          weightPercentage: number;
          teacherAssignmentId: string | null;
          teacher: string | null;
        }>;
      }>;

      if (areas && areas.length > 0) {
        // Usar snapshot
        structureSource = 'snapshot';
        resolvedAreas = areas.map(area => ({
          areaId: area.id,
          name: area.areaName,
          code: area.areaCode,
          weightPercentage: area.weightPercentage,
          calculationType: area.calculationType,
          subjects: area.enrollmentSubjects.map(es => {
            const ta = es.subjectId ? taBySubjectId.get(es.subjectId) : null;
            return {
              id: es.subjectId,
              name: es.subjectName,
              code: es.subjectCode,
              weightPercentage: es.weightPercentage,
              teacherAssignmentId: ta?.id ?? null,
              teacher: es.teacherName ?? (ta ? `${ta.teacher.firstName} ${ta.teacher.lastName}` : null),
            };
          }),
        }));
      } else {
        // Fallback: construir desde TeacherAssignments
        structureSource = 'calculated';
        const areaMap = new Map<string, { name: string; code: string | null; subjects: typeof resolvedAreas[0]['subjects'] }>();
        for (const ta of teacherAssignments) {
          const areaId = ta.subject.areaId;
          if (!areaMap.has(areaId)) {
            areaMap.set(areaId, {
              name: ta.subject.area.name,
              code: ta.subject.area.code,
              subjects: [],
            });
          }
          areaMap.get(areaId)!.subjects.push({
            id: ta.subjectId,
            name: ta.subject.name,
            code: ta.subject.code,
            weightPercentage: 0, // Se calcula después
            teacherAssignmentId: ta.id,
            teacher: `${ta.teacher.firstName} ${ta.teacher.lastName}`,
          });
        }
        resolvedAreas = Array.from(areaMap.entries()).map(([areaId, data]) => ({
          areaId,
          name: data.name,
          code: data.code,
          weightPercentage: 100 / areaMap.size,
          calculationType: 'AVERAGE',
          subjects: data.subjects.map(s => ({
            ...s,
            weightPercentage: 100 / data.subjects.length,
          })),
        }));
      }

      // ─── Calcular notas por área y asignatura (en memoria) ─────────────
      const areaGrades = resolvedAreas.map((area) => {
        const subjectResults = area.subjects.map((subject) => {
          let termGrade: { grade: number | null; components: { componentId: string; name: string; average: number | null; percentage: number }[] } = { grade: null, components: [] };

          if (subject.teacherAssignmentId) {
            termGrade = this.studentGradesService.calculateTermGradeFromPreloaded(
              enrollmentId,
              subject.teacherAssignmentId,
              academicTermId,
              plansMap,
              partialsMap,
            );
          }

          // ─── Override con PeriodFinalGrade si existe (para recuperaciones) ───
          // Si hay una nota final guardada (ej: de recuperación), usarla en lugar de la calculada
          if (subject.id) {
            const finalGradeKey = `${enrollmentId}_${subject.id}`;
            const finalGradeOverride = finalGradesMap.get(finalGradeKey);
            if (finalGradeOverride !== undefined) {
              termGrade = { ...termGrade, grade: finalGradeOverride };
            }
          }

          const performanceResult = termGrade.grade
            ? this.studentGradesService.getPerformanceLevelFromScale(scaleArray, termGrade.grade)
            : null;

          // Lookup absences for this subject
          const absencesKey = subject.teacherAssignmentId ? `${enrollmentId}_${subject.teacherAssignmentId}` : null;
          const absences = absencesKey ? (subjectAbsencesMap.get(absencesKey) || 0) : 0;

          // ─── Obtener información de recuperación si existe ──────────────────
          const recoveryKey = subject.id ? `${enrollmentId}_${subject.id}` : null;
          const recovery = recoveryKey ? recoveryMap.get(recoveryKey) : null;
          const hasRecovery = !!recovery;
          
          // Calcular nota original (sin recuperación)
          let originalGrade: number | null = null;
          if (hasRecovery && recovery) {
            originalGrade = recovery.originalScore;
          } else if (termGrade.grade !== null) {
            // Si no hay recuperación, la nota original es la calculada
            originalGrade = termGrade.grade;
          }

          return {
            subjectId: subject.id,
            subject: subject.name,
            subjectCode: subject.code,
            teacher: subject.teacher,
            grade: termGrade.grade,
            originalGrade: originalGrade,
            recoveryGrade: recovery?.recoveryScore ?? null,
            hasRecovery,
            recoveryStatus: recovery?.status ?? null,
            weightPercentage: subject.weightPercentage,
            performanceLevel: performanceResult?.level || null,
            components: termGrade.components,
            absences,
            achievement: null as string | null,
            achievementObservation: null as string | null,
            qualitativeObservation: null as string | null,
            judgment: null as string | null,
          };
        });

        // Calcular promedio del área
        const validGrades = subjectResults.filter(s => s.grade !== null);
        let areaAverage: number | null = null;

        if (area.calculationType === 'INFORMATIVE') {
          areaAverage = null;
        } else if (validGrades.length > 0) {
          if (area.calculationType === 'WEIGHTED') {
            const weightedSum = validGrades.reduce((acc, s) => acc + (s.grade! * s.weightPercentage), 0);
            const totalWeight = validGrades.reduce((acc, s) => acc + s.weightPercentage, 0);
            areaAverage = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : null;
          } else {
            areaAverage = Math.round((validGrades.reduce((acc, s) => acc + s.grade!, 0) / validGrades.length) * 10) / 10;
          }
        }

        const areaPerformance = areaAverage
          ? this.studentGradesService.getPerformanceLevelFromScale(scaleArray, areaAverage)
          : null;

        return {
          areaId: area.areaId,
          area: area.name,
          areaCode: area.code,
          weightPercentage: area.weightPercentage,
          calculationType: area.calculationType,
          areaAverage,
          areaPerformanceLevel: areaPerformance?.level || null,
          subjects: subjectResults,
        };
      });

      // ─── Enriquecer con logros (en memoria) ───────────────────────────
      const studentAchievements = achievementsMap.get(enrollmentId) || [];
      const normalizePerformanceLevel = (value: string | null | undefined) => {
        const normalized = (value || '').trim().toUpperCase();
        return normalized || null;
      };

      const achievements = studentAchievements.map(sa => ({
        subjectId: sa.achievement.teacherAssignment?.subject?.id || null,
        subject: sa.achievement.teacherAssignment?.subject?.name || '',
        orderNumber: sa.achievement.orderNumber,
        description: sa.approvedText || sa.suggestedText || sa.achievement.baseDescription,
        performanceLevel: normalizePerformanceLevel(sa.performanceLevel),
        observation: sa.observation || null,
        judgment: sa.approvedJudgment || sa.suggestedJudgment || null,
      }));

      // Map de logros por asignatura para enriquecer subjectGrades
      const achievementBySubjectId = new Map<string, typeof achievements>();
      const achievementBySubjectName = new Map<string, typeof achievements>();
      for (const ach of achievements) {
        if (ach.subjectId) {
          const list = achievementBySubjectId.get(ach.subjectId) || [];
          list.push(ach);
          achievementBySubjectId.set(ach.subjectId, list);
        }
        if (ach.subject) {
          const list = achievementBySubjectName.get(ach.subject) || [];
          list.push(ach);
          achievementBySubjectName.set(ach.subject, list);
        }
      }

      const resolveSubjectAchievements = (subjectId: string | null, subjectName: string) => {
        return (subjectId && achievementBySubjectId.get(subjectId)) || achievementBySubjectName.get(subjectName) || [];
      };

      const resolveDominantPerformanceLevel = (subjectId: string | null, subjectName: string) => {
        const subjectAchievements = resolveSubjectAchievements(subjectId, subjectName);
        if (subjectAchievements.length === 0) return null;

        const counts = new Map<string, { count: number; firstIndex: number }>();
        subjectAchievements.forEach((ach, idx) => {
          const level = normalizePerformanceLevel(ach.performanceLevel);
          if (!level) return;
          const current = counts.get(level);
          if (current) {
            current.count += 1;
          } else {
            counts.set(level, { count: 1, firstIndex: idx });
          }
        });

        let winner: { level: string; count: number; firstIndex: number } | null = null;
        for (const [level, meta] of counts.entries()) {
          if (!winner || meta.count > winner.count || (meta.count === winner.count && meta.firstIndex < winner.firstIndex)) {
            winner = { level, count: meta.count, firstIndex: meta.firstIndex };
          }
        }

        return winner?.level || null;
      };

      const resolveAchievement = (subjectId: string | null, subjectName: string, performanceLevel: string | null) => {
        const subjectAchievements = resolveSubjectAchievements(subjectId, subjectName);
        if (subjectAchievements.length === 0) return null;

        const normalizedLevel = normalizePerformanceLevel(performanceLevel) || resolveDominantPerformanceLevel(subjectId, subjectName);
        if (normalizedLevel) {
          const exactMatch = subjectAchievements.find(ach => normalizePerformanceLevel(ach.performanceLevel) === normalizedLevel);
          if (exactMatch) return exactMatch;
        }

        return subjectAchievements[0] || null;
      };

      // Aplanar subject grades y enriquecer con logros
      const subjectGrades = areaGrades.flatMap(a => a.subjects).map(sg => {
        const ach = resolveAchievement(sg.subjectId, sg.subject, sg.performanceLevel);
        return {
          ...sg,
          achievement: ach?.description || null,
          achievementObservation: ach?.observation || null,
          qualitativeObservation: ach?.observation || null,
          judgment: ach?.judgment || null,
        };
      });

      // También enriquecer los subjects dentro de areaGrades
      for (const area of areaGrades) {
        for (const subj of area.subjects) {
          const ach = resolveAchievement(subj.subjectId, subj.subject, subj.performanceLevel);
          subj.achievement = ach?.description || null;
          subj.achievementObservation = ach?.observation || null;
          subj.qualitativeObservation = ach?.observation || null;
          subj.judgment = ach?.judgment || null;
        }
      }

      // ─── Asistencia (en memoria) ──────────────────────────────────────
      const attendance = attendanceMap.get(enrollmentId) || {
        total: 0, present: 0, absent: 0, late: 0, excused: 0, attendanceRate: 0,
      };

      // ─── Observaciones (en memoria, limitadas a 10) ───────────────────
      const studentObs = (observationsMap.get(enrollmentId) || []).slice(0, 10);
      const observations = studentObs.map(o => ({
        date: o.date,
        type: o.type,
        category: o.category,
        description: o.description,
        author: `${o.author.firstName} ${o.author.lastName}`,
      }));

      return {
        enrollmentId,
        student: {
          id: enrollment.student.id,
          firstName: [enrollment.student.firstName, (enrollment.student as any).secondName].filter(Boolean).join(' '),
          lastName: [enrollment.student.lastName, (enrollment.student as any).secondLastName].filter(Boolean).join(' '),
          documentType: enrollment.student.documentType,
          documentNumber: enrollment.student.documentNumber,
        },
        group: {
          id: enrollment.group.id,
          name: enrollment.group.name,
          gradeLevel: enrollment.group.grade?.name || '',
          director: (enrollment.group as any).director ? {
            firstName: (enrollment.group as any).director.firstName,
            lastName: (enrollment.group as any).director.lastName,
            signatureImageUrl: (enrollment.group as any).director.signatureImageUrl,
          } : null,
        },
        areaGrades,
        subjectGrades,
        structureSource,
        attendance,
        achievements,
        observations,
      };
    });

    return {
      institution: {
        id: institutionId,
        name: firstEnrollment.academicYear.institution.name,
        nit: firstEnrollment.academicYear.institution.nit,
      },
      academicYear: {
        id: academicYearId,
        year: firstEnrollment.academicYear.year,
        name: firstEnrollment.academicYear.name,
      },
      term: {
        id: term.id,
        name: term.name,
        type: term.type,
      },
      academicStructure: gradeStructure,
      displayConfig,
      cards,
      generatedAt: new Date(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURACIÓN DE BOLETINES
  // ═══════════════════════════════════════════════════════════════════════════

  async getReportCardConfig(institutionId: string) {
    let config = await this.prisma.reportCardConfig.findUnique({
      where: { institutionId },
    });

    if (!config) {
      // Crear configuración por defecto
      const institution = await this.prisma.institution.findUnique({
        where: { id: institutionId },
        select: { name: true, address: true, phone: true, email: true, nit: true, daneCode: true },
      });

      config = await this.prisma.reportCardConfig.create({
        data: {
          institutionId,
          headerResolution: '',
          headerMunicipality: '',
          headerDepartment: '',
          signatureConfig: [
            { role: 'RECTOR', label: 'Rector(a)', name: '', enabled: true },
            { role: 'COORDINATOR', label: 'Coordinador(a)', name: '', enabled: true },
            { role: 'TEACHER', label: 'Director(a) de Grupo', name: '', enabled: true },
          ],
        },
      });
    }

    // Resolver logoUrl a URL firmada si es una key de R2
    if (config.logoUrl) {
      try {
        const resolvedUrl = await this.storageService.resolveFileUrl(config.logoUrl, 3600);
        config = { ...config, logoUrl: resolvedUrl };
      } catch (err) {
        console.error('Error resolving logoUrl:', config.logoUrl, err);
        // mantener valor original
      }
    }

    return config;
  }

  async updateReportCardConfig(institutionId: string, data: any) {
    // Verificar que existe o crear
    await this.getReportCardConfig(institutionId);

    return this.prisma.reportCardConfig.update({
      where: { institutionId },
      data: {
        showLogo: data.showLogo,
        showShield: data.showShield,
        logoUrl: data.logoUrl,
        headerResolution: data.headerResolution,
        headerMunicipality: data.headerMunicipality,
        headerDepartment: data.headerDepartment,
        primaryColor: data.primaryColor,
        evaluationType: data.evaluationType,
        showNumericGrade: data.showNumericGrade,
        showPerformanceLevel: data.showPerformanceLevel,
        showAchievements: data.showAchievements,
        showRecommendations: data.showRecommendations,
        showMotivationalMsg: data.showMotivationalMsg,
        motivationalMsgType: data.motivationalMsgType,
        customMotivationalTpl: data.customMotivationalTpl,
        showAttendance: data.showAttendance,
        showRanking: data.showRanking,
        showObservations: data.showObservations,
        showAreaAverages: data.showAreaAverages,
        showGeneralAverage: data.showGeneralAverage,
        showScale: data.showScale,
        showRecoveryGrades: data.showRecoveryGrades,
        showComponents: data.showComponents,
        signatureConfig: data.signatureConfig,
      },
    });
  }

  /**
   * Lista de estudiantes de un grupo con resumen de notas para la tabla de boletines.
   *
   * Usa AcademicDataSourceService para resolver snapshot vs live automáticamente.
   * FINALIZED → datos congelados del snapshot (ranking incluido si fue enriquecido).
   * OPEN/CLOSED → buildGroupReportCards (~10 queries batch) + ranking en memoria.
   */
  async getGroupReportCardList(groupId: string, academicTermId: string, academicYearId: string) {
    const year = await this.prisma.academicYear.findUnique({ where: { id: academicYearId }, select: { institutionId: true } });
    const rulesCtx = await this.institutionContext.getContext(year?.institutionId || '');

    // Motor centralizado resuelve la fuente de datos
    const { meta, data: groupData } = await this.academicDataSource.getGroupReportCardData(
      groupId,
      academicTermId,
      (gId, tId) => this.buildGroupReportCards(gId, tId),
    );

    const results = groupData.cards.map((card: any) => {
      // Si el snapshot ya tiene rank/generalAverage (Fase 0.2), usarlos directamente
      if (meta.source === 'snapshot' && card.rank != null && card.generalAverage != null) {
        return {
          enrollmentId: card.enrollmentId,
          studentId: card.student.id,
          studentName: `${card.student.lastName} ${card.student.firstName}`.trim(),
          documentNumber: card.student.documentNumber || '',
          groupName: `${card.group.gradeLevel} ${card.group.name}`,
          average: card.generalAverage,
          approvedSubjects: card.approvedSubjectsCount ?? null,
          failedSubjects: card.failedSubjectsCount ?? null,
          totalSubjects: card.subjectGrades?.length ?? 0,
          attendance: card.attendance,
          rank: card.rank,
          totalStudents: card.totalStudentsRanked ?? groupData.cards.length,
          promotionStatus: card.promotionStatus ?? null,
        };
      }

      // Live calculation
      const allGrades = card.areaGrades
        .filter((area: any) => area.calculationType !== 'INFORMATIVE')
        .flatMap((area: any) => area.subjects)
        .filter((s: any) => s.grade !== null);
      const generalAvg = allGrades.length > 0
        ? Math.round((allGrades.reduce((sum: number, s: any) => sum + s.grade!, 0) / allGrades.length) * 10) / 10
        : null;

      // rankingAvg: usa originalGrade si hubo recuperación (penaliza al que perdió y recuperó)
      // Esto evita que alguien que recuperó supere a quien siempre aprobó con la misma nota final
      const rankingAvg = allGrades.length > 0
        ? Math.round((allGrades.reduce((sum: number, s: any) => {
            const scoreForRanking = s.hasRecovery && s.originalGrade !== null ? s.originalGrade : s.grade!;
            return sum + scoreForRanking;
          }, 0) / allGrades.length) * 10) / 10
        : null;

      const approved = allGrades.filter((s: any) => !isFailing(s.grade ?? 0, rulesCtx)).length;
      const failed = allGrades.filter((s: any) => isFailing(s.grade ?? 0, rulesCtx)).length;

      return {
        enrollmentId: card.enrollmentId,
        studentId: card.student.id,
        studentName: `${card.student.lastName} ${card.student.firstName}`.trim(),
        documentNumber: card.student.documentNumber || '',
        groupName: `${card.group.gradeLevel} ${card.group.name}`,
        average: generalAvg,
        rankingAvg,
        approvedSubjects: approved,
        failedSubjects: failed,
        totalSubjects: allGrades.length,
        attendance: card.attendance,
      };
    });

    // Calcular ranking en memoria (solo si no vino del snapshot)
    if (meta.source !== 'snapshot' || !results[0]?.rank) {
      // Ordenar por rankingAvg (penaliza recuperaciones) para asignar posición justa
      const sorted = [...results]
        .filter((r: any) => r.average !== null)
        .sort((a: any, b: any) => (b.rankingAvg ?? b.average ?? 0) - (a.rankingAvg ?? a.average ?? 0));

      const rankedResults = results.map((r: any) => ({
        ...r,
        rank: r.average !== null ? sorted.findIndex((s: any) => s.enrollmentId === r.enrollmentId) + 1 : null,
        totalStudents: sorted.length,
      }));

      return { meta, data: rankedResults };
    }

    return { meta, data: results };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SNAPSHOT LEGAL — CIERRE, FINALIZACIÓN Y REAPERTURA DE PERÍODOS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Valida notas faltantes de un período sin cambiar estado.
   * Retorna detalle de estudiantes/asignaturas sin nota final.
   */
  async validateTermGrades(termId: string) {
    const term = await this.prisma.academicTerm.findUnique({
      where: { id: termId },
      include: { academicYear: { select: { id: true, institutionId: true } } },
    });
    if (!term) throw new NotFoundException('Período académico no encontrado');

    // Grupos con estudiantes activos en este año
    const groups = await this.prisma.group.findMany({
      where: {
        studentEnrollments: {
          some: { academicYearId: term.academicYearId, status: 'ACTIVE' },
        },
      },
      select: { id: true, name: true },
    });

    const missing: Array<{
      group: string;
      student: string;
      subject: string;
    }> = [];
    let totalExpected = 0;
    let totalFound = 0;

    for (const group of groups) {
      // Asignaturas asignadas a este grupo en este año
      const assignments = await this.prisma.teacherAssignment.findMany({
        where: { groupId: group.id, academicYearId: term.academicYearId },
        select: { subjectId: true, subject: { select: { name: true } } },
      });
      const subjectIds = [...new Set(assignments.map(a => a.subjectId))];
      const subjectNames = new Map(assignments.map(a => [a.subjectId, a.subject.name]));

      // Estudiantes activos en este grupo
      const enrollments = await this.prisma.studentEnrollment.findMany({
        where: { groupId: group.id, academicYearId: term.academicYearId, status: 'ACTIVE' },
        select: { id: true, student: { select: { firstName: true, secondName: true, lastName: true, secondLastName: true } } },
      });

      if (enrollments.length === 0 || subjectIds.length === 0) continue;

      // Notas finales existentes para este grupo/período
      const existingGrades = await this.prisma.periodFinalGrade.findMany({
        where: {
          academicTermId: termId,
          studentEnrollmentId: { in: enrollments.map(e => e.id) },
          subjectId: { in: subjectIds },
        },
        select: { studentEnrollmentId: true, subjectId: true },
      });

      const gradeSet = new Set(
        existingGrades.map(g => `${g.studentEnrollmentId}|${g.subjectId}`),
      );

      for (const enrollment of enrollments) {
        for (const subjectId of subjectIds) {
          totalExpected++;
          const key = `${enrollment.id}|${subjectId}`;
          if (gradeSet.has(key)) {
            totalFound++;
          } else {
            missing.push({
              group: group.name,
              student: [enrollment.student.lastName, (enrollment.student as any).secondLastName, enrollment.student.firstName, (enrollment.student as any).secondName].filter(Boolean).join(' '),
              subject: subjectNames.get(subjectId) || subjectId,
            });
          }
        }
      }
    }

    return {
      termId,
      totalExpected,
      totalFound,
      totalMissing: missing.length,
      completionPercent: totalExpected > 0 ? Math.round((totalFound / totalExpected) * 100) : 100,
      isComplete: missing.length === 0,
      missing: missing.slice(0, 100), // Limitar a 100 para no saturar
      hasMore: missing.length > 100,
    };
  }

  /**
   * Cierra un período académico (OPEN → CLOSED):
   * 1) Valida que esté en OPEN
   * 2) Verifica notas faltantes — si hay, retorna error con detalle
   * 3) Cambia status a CLOSED
   */
  async closeTerm(termId: string) {
    const term = await this.prisma.academicTerm.findUnique({
      where: { id: termId },
      include: { academicYear: { select: { id: true, institutionId: true } } },
    });
    if (!term) throw new NotFoundException('Período académico no encontrado');

    if (term.status !== 'OPEN') {
      throw new BadRequestException(
        `El período debe estar en estado OPEN para cerrar. Estado actual: ${term.status}`,
      );
    }

    // Validar notas faltantes
    const validation = await this.validateTermGrades(termId);

    if (!validation.isComplete) {
      throw new BadRequestException({
        message: `Faltan ${validation.totalMissing} notas por registrar (${validation.completionPercent}% completado)`,
        validation,
      });
    }

    // Cambiar estado a CLOSED
    await this.prisma.academicTerm.update({
      where: { id: termId },
      data: { status: 'CLOSED' },
    });

    return {
      success: true,
      termId,
      newStatus: 'CLOSED',
      validation,
    };
  }

  /**
   * Finaliza un período académico:
   * 1) Valida que esté en CLOSED
   * 2) Genera boletines para todos los grupos del período
   * 3) Guarda snapshots congelados (JSON) por estudiante
   * 4) Cambia status a FINALIZED
   *
   * Si se reabre y vuelve a finalizar → genera nueva versión.
   */
  async finalizeTerm(termId: string, userId: string) {
    // 1. Obtener término con su año académico
    const term = await this.prisma.academicTerm.findUnique({
      where: { id: termId },
      include: {
        academicYear: { select: { id: true, institutionId: true } },
      },
    });

    if (!term) throw new NotFoundException('Período académico no encontrado');

    if (term.status !== 'CLOSED') {
      throw new BadRequestException(
        `El período debe estar en estado CLOSED para finalizar. Estado actual: ${term.status}`,
      );
    }

    // 2. Obtener todos los grupos que tienen estudiantes en este año
    const groups = await this.prisma.group.findMany({
      where: {
        studentEnrollments: {
          some: {
            academicYearId: term.academicYearId,
            status: 'ACTIVE',
          },
        },
      },
      select: { id: true },
    });

    if (groups.length === 0) {
      throw new BadRequestException('No hay grupos con estudiantes activos para este período');
    }

    // 3. Calcular versión
    const lastVersion = await this.prisma.termReportCardSnapshot.aggregate({
      where: { academicTermId: termId },
      _max: { version: true },
    });
    const version = (lastVersion._max.version ?? 0) + 1;

    // 4. Generar snapshots por grupo
    let totalSnapshots = 0;

    // Cargar reglas institucionales para calcular aprobación/reprobación
    const rulesCtx = await this.institutionContext.getContext(term.academicYear.institutionId);

    for (const group of groups) {
      try {
        const groupData = await this.buildGroupReportCards(group.id, termId);

        // ── Calcular datos derivados por grupo (ranking, promedios, promoción) ──
        const cardStats = groupData.cards.map((card) => {
          const countableGrades = card.areaGrades
            .filter((area: any) => area.calculationType !== 'INFORMATIVE')
            .flatMap((area: any) => area.subjects)
            .filter((s: any) => s.grade !== null);
          const generalAverage = countableGrades.length > 0
            ? Math.round((countableGrades.reduce((sum: number, s: any) => sum + s.grade!, 0) / countableGrades.length) * 10) / 10
            : null;
          const failedCount = countableGrades.filter((s: any) => isFailing(s.grade ?? 0, rulesCtx)).length;
          const approvedCount = countableGrades.length - failedCount;
          const promotionStatus = countableGrades.length === 0
            ? 'PENDIENTE'
            : failedCount === 0 ? 'APRUEBA' : 'NO_APRUEBA';
          return { enrollmentId: card.enrollmentId, generalAverage, failedCount, approvedCount, promotionStatus };
        });

        // Ranking: ordenar por promedio descendente
        const ranked = [...cardStats]
          .filter(s => s.generalAverage !== null)
          .sort((a, b) => (b.generalAverage ?? 0) - (a.generalAverage ?? 0));
        const totalStudentsRanked = ranked.length;

        const rankMap = new Map<string, number>();
        for (let i = 0; i < ranked.length; i++) {
          rankMap.set(ranked[i].enrollmentId, i + 1);
        }

        // Guardar snapshot por cada estudiante — ENRIQUECIDO con datos derivados
        const snapshotData = groupData.cards.map((card) => {
          const stats = cardStats.find(s => s.enrollmentId === card.enrollmentId)!;
          return {
            academicTermId: termId,
            studentEnrollmentId: card.enrollmentId,
            version,
            snapshotType: 'INITIAL_CLOSE' as const,
            generatedById: userId,
            data: {
              institution: groupData.institution,
              academicYear: groupData.academicYear,
              term: groupData.term,
              student: card.student,
              group: card.group,
              areaGrades: card.areaGrades,
              subjectGrades: card.subjectGrades,
              structureSource: card.structureSource,
              attendance: card.attendance,
              achievements: card.achievements,
              observations: card.observations,
              generatedAt: groupData.generatedAt,
              // ── Campos enriquecidos (Fase 0.2) ──
              rank: rankMap.get(card.enrollmentId) ?? null,
              totalStudentsRanked,
              generalAverage: stats.generalAverage,
              approvedSubjectsCount: stats.approvedCount,
              failedSubjectsCount: stats.failedCount,
              promotionStatus: stats.promotionStatus,
            },
          };
        });

        // Bulk insert snapshots
        for (const snap of snapshotData) {
          await this.prisma.termReportCardSnapshot.create({ data: snap });
          totalSnapshots++;
        }
      } catch (error) {
        console.error(`[finalizeTerm] Error procesando grupo ${group.id}:`, error.message);
      }
    }

    // 5. Actualizar estado del término
    await this.prisma.academicTerm.update({
      where: { id: termId },
      data: {
        status: 'FINALIZED',
        finalizedAt: new Date(),
      },
    });

    return {
      success: true,
      termId,
      version,
      totalSnapshots,
      finalizedAt: new Date(),
    };
  }

  /**
   * Reabre un período finalizado para permitir correcciones.
   * Crea un registro de auditoría (TermReopeningRecord).
   * NO elimina snapshots anteriores.
   * Cuando se vuelva a finalizar → se genera nueva versión.
   */
  async reopenFinalizedTerm(termId: string, reason: string, userId: string) {
    const term = await this.prisma.academicTerm.findUnique({
      where: { id: termId },
    });

    if (!term) throw new NotFoundException('Período académico no encontrado');

    if (term.status !== 'FINALIZED') {
      throw new BadRequestException(
        `El período debe estar en estado FINALIZED para reabrir. Estado actual: ${term.status}`,
      );
    }

    if (!reason || reason.trim().length < 10) {
      throw new BadRequestException('Debe proporcionar un motivo de reapertura (mínimo 10 caracteres)');
    }

    // Obtener versión actual del snapshot
    const lastVersion = await this.prisma.termReportCardSnapshot.aggregate({
      where: { academicTermId: termId },
      _max: { version: true },
    });

    // Crear registro de auditoría
    await this.prisma.termReopeningRecord.create({
      data: {
        academicTermId: termId,
        reopenedById: userId,
        reason: reason.trim(),
        previousVersion: lastVersion._max.version ?? 0,
      },
    });

    // Cambiar estado a OPEN (permite edición de notas)
    await this.prisma.academicTerm.update({
      where: { id: termId },
      data: {
        status: 'OPEN',
        finalizedAt: null,
      },
    });

    return {
      success: true,
      termId,
      previousVersion: lastVersion._max.version ?? 0,
      newStatus: 'OPEN',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RE-SNAPSHOT — Regenerar snapshots para un período finalizado
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Regenera snapshots para un período finalizado sin cambiar el estado del término.
   * Crea una nueva versión de snapshots usando buildGroupReportCards actualizado.
   * Útil cuando se corrigen bugs en la generación de snapshots.
   */
  async reSnapshotTerm(termId: string, userId: string) {
    const term = await this.prisma.academicTerm.findUnique({
      where: { id: termId },
      include: {
        academicYear: { select: { id: true, institutionId: true } },
      },
    });

    if (!term) throw new NotFoundException('Período académico no encontrado');

    if (term.status !== 'FINALIZED') {
      throw new BadRequestException(
        `El período debe estar FINALIZED para regenerar snapshots. Estado actual: ${term.status}`,
      );
    }

    // Obtener todos los grupos con estudiantes activos en este año
    const groups = await this.prisma.group.findMany({
      where: {
        studentEnrollments: {
          some: {
            academicYearId: term.academicYearId,
            status: 'ACTIVE',
          },
        },
      },
      select: { id: true, name: true, grade: { select: { name: true } } },
    });

    if (groups.length === 0) {
      throw new BadRequestException('No hay grupos con estudiantes activos');
    }

    // Calcular nueva versión
    const lastVersion = await this.prisma.termReportCardSnapshot.aggregate({
      where: { academicTermId: termId },
      _max: { version: true },
    });
    const version = (lastVersion._max.version ?? 0) + 1;

    // Cargar reglas institucionales
    const rulesCtx = await this.institutionContext.getContext(term.academicYear.institutionId);

    let totalSnapshots = 0;
    const groupResults: { groupId: string; groupName: string; students: number; error?: string }[] = [];

    // Temporalmente reabrir el término para que buildGroupReportCards funcione con datos live
    await this.prisma.academicTerm.update({
      where: { id: termId },
      data: { status: 'OPEN' },
    });

    try {
      for (const group of groups) {
        const groupName = group.grade ? `${group.grade.name} ${group.name}` : group.name;
        try {
          const groupData = await this.buildGroupReportCards(group.id, termId);

          // Calcular datos derivados (misma lógica que finalizeTerm)
          const cardStats = groupData.cards.map((card) => {
            const allGrades = card.areaGrades
              .filter((area: any) => area.calculationType !== 'INFORMATIVE')
              .flatMap((area: any) => area.subjects)
              .filter((s: any) => s.grade !== null);
            const generalAverage = allGrades.length > 0
              ? Math.round((allGrades.reduce((sum: number, s: any) => sum + s.grade!, 0) / allGrades.length) * 10) / 10
              : null;
            const failedCount = allGrades.filter((s: any) => isFailing(s.grade ?? 0, rulesCtx)).length;
            const approvedCount = allGrades.length - failedCount;
            const promotionStatus = allGrades.length === 0
              ? 'PENDIENTE'
              : failedCount === 0 ? 'APRUEBA' : 'NO_APRUEBA';
            return { enrollmentId: card.enrollmentId, generalAverage, failedCount, approvedCount, promotionStatus };
          });

          // Ranking
          const ranked = [...cardStats]
            .filter(s => s.generalAverage !== null)
            .sort((a, b) => (b.generalAverage ?? 0) - (a.generalAverage ?? 0));
          const totalStudentsRanked = ranked.length;
          const rankMap = new Map<string, number>();
          for (let i = 0; i < ranked.length; i++) {
            rankMap.set(ranked[i].enrollmentId, i + 1);
          }

          // Guardar snapshots
          const snapshotData = groupData.cards.map((card) => {
            const stats = cardStats.find(s => s.enrollmentId === card.enrollmentId)!;
            return {
              academicTermId: termId,
              studentEnrollmentId: card.enrollmentId,
              version,
              snapshotType: 'INITIAL_CLOSE' as const,
              generatedById: userId,
              data: {
                institution: groupData.institution,
                academicYear: groupData.academicYear,
                term: groupData.term,
                student: card.student,
                group: card.group,
                areaGrades: card.areaGrades,
                subjectGrades: card.subjectGrades,
                structureSource: card.structureSource,
                attendance: card.attendance,
                achievements: card.achievements,
                observations: card.observations,
                generatedAt: groupData.generatedAt,
                rank: rankMap.get(card.enrollmentId) ?? null,
                totalStudentsRanked,
                generalAverage: stats.generalAverage,
                approvedSubjectsCount: stats.approvedCount,
                failedSubjectsCount: stats.failedCount,
                promotionStatus: stats.promotionStatus,
              },
            };
          });

          for (const snap of snapshotData) {
            await this.prisma.termReportCardSnapshot.create({ data: snap });
            totalSnapshots++;
          }

          groupResults.push({ groupId: group.id, groupName, students: snapshotData.length });
        } catch (error) {
          console.error(`[reSnapshotTerm] Error procesando grupo ${group.id}:`, error.message);
          groupResults.push({ groupId: group.id, groupName, students: 0, error: error.message });
        }
      }
    } finally {
      // Restaurar estado FINALIZED
      await this.prisma.academicTerm.update({
        where: { id: termId },
        data: { status: 'FINALIZED' },
      });
    }

    return {
      success: true,
      termId,
      version,
      totalSnapshots,
      totalGroups: groups.length,
      groupResults,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ESTADO DE COMPLETITUD ACADÉMICA
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Reporte de completitud: qué grupos/asignaturas tienen notas y logros completos.
   * Identifica faltantes sin necesidad de revisar estudiante por estudiante.
   */
  async getCompletenessStatus(institutionId: string, academicYearId: string, termId?: string) {
    // 1. Obtener todos los términos (o el específico)
    const terms = await this.prisma.academicTerm.findMany({
      where: {
        academicYearId,
        ...(termId && { id: termId }),
      },
      select: { id: true, name: true, status: true, order: true },
      orderBy: { order: 'asc' },
    });

    if (terms.length === 0) {
      throw new NotFoundException('No se encontraron períodos académicos');
    }

    const termIds = terms.map(t => t.id);

    // 2. Obtener todos los grupos con matrículas activas
    const groups = await this.prisma.group.findMany({
      where: {
        studentEnrollments: {
          some: { academicYearId, status: 'ACTIVE' },
        },
      },
      include: {
        grade: { select: { name: true, stage: true } },
        _count: {
          select: {
            studentEnrollments: {
              where: { academicYearId, status: 'ACTIVE' },
            },
          },
        },
      },
      orderBy: [{ grade: { name: 'asc' } }, { name: 'asc' }],
    });

    if (groups.length === 0) return { terms, groups: [], summary: { totalGroups: 0, totalStudents: 0, totalSubjects: 0, overallGradeCompleteness: 0, overallAchievementCompleteness: 0 } };

    const groupIds = groups.map(g => g.id);

    // 3. Obtener todas las asignaciones docente → grupo (define qué asignaturas debe tener cada grupo)
    const teacherAssignments = await this.prisma.teacherAssignment.findMany({
      where: {
        groupId: { in: groupIds },
        academicYearId,
      },
      select: {
        id: true,
        groupId: true,
        subjectId: true,
        subject: { select: { name: true } },
        teacher: { select: { firstName: true, lastName: true } },
      },
    });

    // Map: groupId → TeacherAssignment[]
    const taByGroup = new Map<string, typeof teacherAssignments>();
    for (const ta of teacherAssignments) {
      const list = taByGroup.get(ta.groupId) || [];
      list.push(ta);
      taByGroup.set(ta.groupId, list);
    }

    // 4. Obtener PeriodFinalGrade existentes (notas finales)
    const finalGrades = await this.prisma.periodFinalGrade.findMany({
      where: {
        institutionId,
        academicTermId: { in: termIds },
        studentEnrollment: {
          status: 'ACTIVE',
          groupId: { in: groupIds },
        },
      },
      select: {
        studentEnrollmentId: true,
        subjectId: true,
        academicTermId: true,
        studentEnrollment: { select: { groupId: true } },
      },
    });

    // Índice: "groupId|subjectId|termId" → Set<enrollmentId>
    const gradeIndex = new Map<string, Set<string>>();
    for (const fg of finalGrades) {
      const key = `${fg.studentEnrollment.groupId}|${fg.subjectId}|${fg.academicTermId}`;
      if (!gradeIndex.has(key)) gradeIndex.set(key, new Set());
      gradeIndex.get(key)!.add(fg.studentEnrollmentId);
    }

    // 5. Obtener logros (StudentAchievement) existentes
    const achievements = await this.prisma.studentAchievement.findMany({
      where: {
        achievement: {
          academicTermId: { in: termIds },
          teacherAssignment: {
            groupId: { in: groupIds },
            academicYearId,
          },
        },
        studentEnrollment: { status: 'ACTIVE' },
      },
      select: {
        studentEnrollmentId: true,
        achievement: {
          select: {
            teacherAssignment: { select: { groupId: true, subjectId: true } },
            academicTermId: true,
          },
        },
      },
    });

    // Índice: "groupId|subjectId|termId" → Set<enrollmentId>
    const achievementIndex = new Map<string, Set<string>>();
    for (const sa of achievements) {
      const ta = sa.achievement.teacherAssignment;
      if (!ta) continue;
      const key = `${ta.groupId}|${ta.subjectId}|${sa.achievement.academicTermId}`;
      if (!achievementIndex.has(key)) achievementIndex.set(key, new Set());
      achievementIndex.get(key)!.add(sa.studentEnrollmentId);
    }

    // 6. Obtener matrículas activas por grupo
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        academicYearId,
        status: 'ACTIVE',
        groupId: { in: groupIds },
      },
      select: {
        id: true,
        groupId: true,
        student: { select: { id: true, firstName: true, secondName: true, lastName: true, secondLastName: true } },
      },
      orderBy: { student: { lastName: 'asc' } },
    });

    const enrollmentsByGroup = new Map<string, typeof enrollments>();
    for (const e of enrollments) {
      const list = enrollmentsByGroup.get(e.groupId) || [];
      list.push(e);
      enrollmentsByGroup.set(e.groupId, list);
    }

    // 7. Construir resultado por grupo
    let totalGradeCells = 0;
    let filledGradeCells = 0;
    let totalAchievementCells = 0;
    let filledAchievementCells = 0;

    const groupResults = groups.map(group => {
      const groupTAs = taByGroup.get(group.id) || [];
      const groupEnrollments = enrollmentsByGroup.get(group.id) || [];
      const studentCount = groupEnrollments.length;

      const subjects = groupTAs.map(ta => {
        const termResults = terms.map(term => {
          const gradeKey = `${group.id}|${ta.subjectId}|${term.id}`;
          const achievementKey = `${group.id}|${ta.subjectId}|${term.id}`;
          const studentsWithGrade = gradeIndex.get(gradeKey)?.size ?? 0;
          const studentsWithAchievement = achievementIndex.get(achievementKey)?.size ?? 0;

          totalGradeCells += studentCount;
          filledGradeCells += studentsWithGrade;
          totalAchievementCells += studentCount;
          filledAchievementCells += studentsWithAchievement;

          // Estudiantes faltantes de nota
          const missingGradeStudents = groupEnrollments
            .filter(e => !gradeIndex.get(gradeKey)?.has(e.id))
            .map(e => ({ enrollmentId: e.id, name: [e.student.lastName, (e.student as any).secondLastName, e.student.firstName, (e.student as any).secondName].filter(Boolean).join(' ') }));

          // Estudiantes faltantes de logro
          const missingAchievementStudents = groupEnrollments
            .filter(e => !achievementIndex.get(achievementKey)?.has(e.id))
            .map(e => ({ enrollmentId: e.id, name: [e.student.lastName, (e.student as any).secondLastName, e.student.firstName, (e.student as any).secondName].filter(Boolean).join(' ') }));

          return {
            termId: term.id,
            termName: term.name,
            studentsWithGrade,
            studentsWithAchievement,
            missingGradeCount: studentCount - studentsWithGrade,
            missingAchievementCount: studentCount - studentsWithAchievement,
            gradeCompleteness: studentCount > 0 ? Math.round((studentsWithGrade / studentCount) * 100) : 0,
            achievementCompleteness: studentCount > 0 ? Math.round((studentsWithAchievement / studentCount) * 100) : 0,
            missingGradeStudents,
            missingAchievementStudents,
          };
        });

        // Totales por asignatura (todos los términos)
        const totalGrades = termResults.reduce((s, t) => s + t.studentsWithGrade, 0);
        const totalExpected = studentCount * terms.length;
        const totalAch = termResults.reduce((s, t) => s + t.studentsWithAchievement, 0);

        return {
          subjectId: ta.subjectId,
          subjectName: ta.subject.name,
          teacherName: `${ta.teacher.firstName} ${ta.teacher.lastName}`,
          teacherAssignmentId: ta.id,
          gradeCompleteness: totalExpected > 0 ? Math.round((totalGrades / totalExpected) * 100) : 0,
          achievementCompleteness: totalExpected > 0 ? Math.round((totalAch / totalExpected) * 100) : 0,
          terms: termResults,
        };
      });

      // Totales del grupo
      const groupGradeTotal = subjects.reduce((s, sub) => s + sub.terms.reduce((t, tr) => t + tr.studentsWithGrade, 0), 0);
      const groupGradeExpected = subjects.length * studentCount * terms.length;
      const groupAchTotal = subjects.reduce((s, sub) => s + sub.terms.reduce((t, tr) => t + tr.studentsWithAchievement, 0), 0);

      return {
        groupId: group.id,
        groupName: group.grade ? `${group.grade.name} ${group.name}` : group.name,
        stage: group.grade?.stage || null,
        studentCount,
        subjectCount: groupTAs.length,
        gradeCompleteness: groupGradeExpected > 0 ? Math.round((groupGradeTotal / groupGradeExpected) * 100) : 0,
        achievementCompleteness: groupGradeExpected > 0 ? Math.round((groupAchTotal / groupGradeExpected) * 100) : 0,
        subjects,
      };
    });

    return {
      terms: terms.map(t => ({ id: t.id, name: t.name, status: t.status })),
      groups: groupResults,
      summary: {
        totalGroups: groups.length,
        totalStudents: enrollments.length,
        totalSubjects: teacherAssignments.length,
        overallGradeCompleteness: totalGradeCells > 0 ? Math.round((filledGradeCells / totalGradeCells) * 100) : 0,
        overallAchievementCompleteness: totalAchievementCells > 0 ? Math.round((filledAchievementCells / totalAchievementCells) * 100) : 0,
      },
    };
  }

  /**
   * Reporte: Distribución de estudiantes por nivel de desempeño, desglosado por asignatura.
   * Para cada asignatura retorna cuántos estudiantes hay en cada nivel (Bajo/Básico/Alto/Superior).
   * Soporta filtros por grupo, grado, nivel educativo y período.
   */
  async getSubjectLevelDistribution(
    institutionId: string,
    academicYearId: string,
    groupId?: string,
    gradeId?: string,
    termId?: string,
    stage?: string,
    subjectIds?: string[],
  ) {
    const rulesCtx = await this.institutionContext.getContext(institutionId);

    // Construir filtro de matrícula anidado
    const enrollmentFilter: any = {
      institutionId,
      academicYearId,
      status: EnrollmentStatus.ACTIVE,
    };
    if (groupId) {
      enrollmentFilter.groupId = groupId;
    } else if (gradeId) {
      enrollmentFilter.group = { gradeId };
    } else if (stage) {
      enrollmentFilter.group = { grade: { stage } };
    }

    // Obtener notas finales con filtro de matrícula
    const pfgWhere: any = { studentEnrollment: enrollmentFilter };
    if (termId) pfgWhere.academicTermId = termId;
    if (subjectIds && subjectIds.length > 0) pfgWhere.subjectId = { in: subjectIds };

    const pfgData = await this.prisma.periodFinalGrade.findMany({
      where: pfgWhere,
      select: {
        subjectId: true,
        finalScore: true,
        subject: {
          select: {
            name: true,
            area: { select: { name: true } },
          },
        },
      },
    });

    // Construir orden de niveles de desempeño
    const perfLevelOrder: string[] =
      rulesCtx.performanceLevels.length > 0
        ? [...rulesCtx.performanceLevels].sort((a, b) => a.order - b.order).map(l => l.name)
        : ['Bajo', 'Básico', 'Alto', 'Superior'];

    // Agrupar notas por asignatura
    const subjectMap = new Map<string, { name: string; areaName: string; scores: number[] }>();
    for (const g of pfgData) {
      if (g.finalScore === null) continue;
      if (!subjectMap.has(g.subjectId)) {
        subjectMap.set(g.subjectId, {
          name: g.subject.name,
          areaName: g.subject.area?.name || '',
          scores: [],
        });
      }
      subjectMap.get(g.subjectId)!.scores.push(Number(g.finalScore));
    }

    // Calcular distribución por nivel para cada asignatura
    const results = Array.from(subjectMap.entries()).map(([subjectId, data]) => {
      const { scores } = data;
      const total = scores.length;

      // Clasificar cada nota usando el engine
      const labelCounts = new Map<string, number>(perfLevelOrder.map(l => [l, 0]));
      for (const score of scores) {
        const label = getPerformanceLevel(score, rulesCtx).label;
        labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
      }

      const avg = total > 0 ? scores.reduce((a, b) => a + b, 0) / total : 0;
      const passingCount = scores.filter(s => !isFailing(s, rulesCtx)).length;

      return {
        subjectId,
        subjectName: data.name,
        areaName: data.areaName,
        totalStudents: total,
        average: Math.round(avg * 10) / 10,
        approvalRate: total > 0 ? Math.round((passingCount / total) * 1000) / 10 : 0,
        levels: perfLevelOrder.map(label => {
          const count = labelCounts.get(label) ?? 0;
          return {
            label,
            count,
            percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
          };
        }),
      };
    });

    return {
      performanceLevelLabels: perfLevelOrder,
      results: results.sort((a, b) => a.subjectName.localeCompare(b.subjectName)),
    };
  }

  /**
   * Lee el snapshot más reciente de un estudiante para un período.
   * Retorna null si no existe snapshot.
   */
  private async getSnapshotForStudent(
    academicTermId: string,
    studentEnrollmentId: string,
  ): Promise<any | null> {
    const snapshot = await this.prisma.termReportCardSnapshot.findFirst({
      where: { academicTermId, studentEnrollmentId },
      orderBy: { version: 'desc' },
    });

    return snapshot?.data ?? null;
  }

  /**
   * Lee todos los snapshots más recientes de un período.
   * Retorna Map<enrollmentId, snapshotData>.
   */
  private async getSnapshotsForTerm(
    academicTermId: string,
  ): Promise<Map<string, any>> {
    // Obtener la versión más reciente
    const lastVersion = await this.prisma.termReportCardSnapshot.aggregate({
      where: { academicTermId },
      _max: { version: true },
    });

    if (!lastVersion._max.version) return new Map();

    const snapshots = await this.prisma.termReportCardSnapshot.findMany({
      where: {
        academicTermId,
        version: lastVersion._max.version,
      },
    });

    const map = new Map<string, any>();
    for (const snap of snapshots) {
      map.set(snap.studentEnrollmentId, snap.data);
    }
    return map;
  }
}
