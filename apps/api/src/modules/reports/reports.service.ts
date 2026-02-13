import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { EnrollmentStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { StudentGradesService } from '../evaluation/student-grades.service';
import { AttendanceService } from '../attendance/attendance.service';
import { StudentsService } from '../academic/students.service';
import { AcademicYearLifecycleService } from '../academic/academic-year-lifecycle.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService, // Solo para consultas que aún no tienen servicio
    private readonly studentGradesService: StudentGradesService,
    private readonly attendanceService: AttendanceService,
    private readonly studentsService: StudentsService,
    private readonly academicYearService: AcademicYearLifecycleService,
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

  async getReportCardData(studentEnrollmentId: string, academicTermId: string) {
    // Verificar si el período está FINALIZED → leer snapshot congelado
    const termStatus = await this.prisma.academicTerm.findUnique({
      where: { id: academicTermId },
      select: { status: true },
    });

    if (termStatus?.status === 'FINALIZED') {
      const snapshot = await this.getSnapshotForStudent(academicTermId, studentEnrollmentId);
      if (snapshot) return snapshot;
      // Si no hay snapshot (caso raro), fallback a cálculo en vivo
    }

    // OPTIMIZADO: Usa buildGroupReportCards() (~10 queries batch)
    // Obtener groupId del enrollment (1 query ligera)
    const enrollment = await this.prisma.studentEnrollment.findUnique({
      where: { id: studentEnrollmentId },
      select: { groupId: true },
    });

    if (!enrollment) {
      throw new NotFoundException('Student enrollment not found');
    }

    // Batch: ~10 queries para TODO el grupo
    const groupData = await this.buildGroupReportCards(enrollment.groupId, academicTermId);

    // Extraer la card del estudiante solicitado (0 queries — lookup en memoria)
    const card = groupData.cards.find(c => c.enrollmentId === studentEnrollmentId);

    if (!card) {
      throw new NotFoundException('Report card not found for this student in the group batch');
    }

    return {
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
    };
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
    subjectGrades: Array<{ subject: string; grade: number | null; performanceLevel: string | null; teacher: string | null }>;
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
      doc.fontSize(16).font('Helvetica-Bold').text(data.institution.name, { align: 'center' });
      doc.fontSize(10).font('Helvetica').text(`NIT: ${data.institution.nit || 'N/A'}`, { align: 'center' });
      doc.moveDown();

      doc.fontSize(14).font('Helvetica-Bold').text('BOLETÍN DE CALIFICACIONES', { align: 'center' });
      doc.fontSize(12).font('Helvetica').text(`${data.term.name} - Año ${data.academicYear.year}`, { align: 'center' });
      doc.moveDown();

      // Student Info
      doc.fontSize(10).font('Helvetica-Bold').text('INFORMACIÓN DEL ESTUDIANTE');
      doc.font('Helvetica');
      doc.text(`Nombre: ${data.student.firstName} ${data.student.lastName}`);
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

        doc.text(subject.subject, col1, y, { width: 190 });
        doc.text(subject.grade?.toFixed(1) || 'N/A', col2, y);
        doc.text(this.getPerformanceLevelText(subject.performanceLevel), col3, y);
        doc.text(subject.teacher || '', col4, y, { width: 100 });
        y += 20;
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
   * 1 llamada a buildGroupReportCards() (~10 queries) + renderizado en memoria.
   *
   * Antes: N × getReportCardData() = N × ~100+ queries = ~3,300 queries para 30 estudiantes
   * Después: ~10 queries totales + N renderizados PDF en memoria
   */
  async generateBulkReportCards(groupId: string, academicTermId: string, _academicYearId: string) {
    // Verificar si el período está FINALIZED → leer snapshots congelados
    const termStatus = await this.prisma.academicTerm.findUnique({
      where: { id: academicTermId },
      select: { status: true },
    });

    const results: Array<{
      studentId: string;
      studentName: string;
      status: string;
      pdf?: string;
      error?: string;
    }> = [];

    if (termStatus?.status === 'FINALIZED') {
      // Leer snapshots congelados (2 queries: aggregate + findMany)
      const snapshotsMap = await this.getSnapshotsForTerm(academicTermId);

      // Filtrar solo snapshots del grupo solicitado
      for (const [, snapshotData] of snapshotsMap) {
        if (snapshotData?.group?.id !== groupId) continue;
        try {
          const pdf = await this.renderReportCardPdf(snapshotData);
          results.push({
            studentId: snapshotData.student?.id || '',
            studentName: `${snapshotData.student?.lastName || ''} ${snapshotData.student?.firstName || ''}`,
            status: 'success',
            pdf: pdf.toString('base64'),
          });
        } catch (error) {
          results.push({
            studentId: snapshotData.student?.id || '',
            studentName: `${snapshotData.student?.lastName || ''} ${snapshotData.student?.firstName || ''}`,
            status: 'error',
            error: error.message,
          });
        }
      }

      if (results.length > 0) return results;
      // Fallback si no hay snapshots
    }

    // Cálculo en vivo: ~10 queries batch para TODO el grupo
    const groupData = await this.buildGroupReportCards(groupId, academicTermId);

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

    return results;
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
    student: { id: string; firstName: string; lastName: string };
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
        lastName: enrollment.student.lastName,
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
          studentName: `${enrollment.studentLastName} ${enrollment.studentFirstName}`,
          summary: data.summary,
          criticalSubjects,
        });
      } catch (error) {
        results.push({
          studentId: enrollment.studentId,
          studentName: `${enrollment.studentLastName} ${enrollment.studentFirstName}`,
          summary: { totalSubjects: 0, approved: 0, atRisk: 0, impossible: 0, pending: 0 },
          criticalSubjects: [],
        });
      }
    }

    return results;
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
          subject: string;
          subjectCode: string | null;
          teacher: string | null;
          grade: number | null;
          weightPercentage: number;
          performanceLevel: string | null;
          components: { componentId: string; name: string; average: number | null; percentage: number }[];
          achievement: string | null;
          achievementObservation: string | null;
          judgment: string | null;
        }>;
      }>;
      subjectGrades: Array<{
        subject: string;
        subjectCode: string | null;
        teacher: string | null;
        grade: number | null;
        weightPercentage: number;
        performanceLevel: string | null;
        components: { componentId: string; name: string; average: number | null; percentage: number }[];
        achievement: string | null;
        achievementObservation: string | null;
        judgment: string | null;
      }>;
      structureSource: 'snapshot' | 'calculated';
      attendance: { total: number; present: number; absent: number; late: number; excused: number; attendanceRate: number };
      achievements: Array<{ subject: string; orderNumber: number; description: string; performanceLevel: string | null; observation: string | null; judgment: string | null }>;
      observations: Array<{ date: Date; type: string; category: string | null; description: string; author: string }>;
    }>;
    generatedAt: Date;
  }> {
    // ─── QUERY 1: Término académico ───────────────────────────────────────
    const term = await this.academicYearService.getTermById(academicTermId);
    if (!term) throw new NotFoundException('Período académico no encontrado');

    // ─── QUERY 2: Matrículas del grupo con estudiante + grupo + año ──────
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { groupId, status: 'ACTIVE' },
      include: {
        student: true,
        group: { include: { grade: true } },
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

    // Map<enrollmentId, AttendanceSummary>
    const attendanceMap = new Map<string, { total: number; present: number; absent: number; late: number; excused: number; attendanceRate: number }>();
    // Agrupar por enrollmentId
    const attByEnrollment = new Map<string, (typeof allAttendance)>();
    for (const rec of allAttendance) {
      const list = attByEnrollment.get(rec.studentEnrollmentId) || [];
      list.push(rec);
      attByEnrollment.set(rec.studentEnrollmentId, list);
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
        resolvedAreas = Array.from(areaMap.entries()).map(([, data]) => ({
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

          const performanceResult = termGrade.grade
            ? this.studentGradesService.getPerformanceLevelFromScale(scaleArray, termGrade.grade)
            : null;

          return {
            subject: subject.name,
            subjectCode: subject.code,
            teacher: subject.teacher,
            grade: termGrade.grade,
            weightPercentage: subject.weightPercentage,
            performanceLevel: performanceResult?.level || null,
            components: termGrade.components,
            achievement: null as string | null,
            achievementObservation: null as string | null,
            judgment: null as string | null,
          };
        });

        // Calcular promedio del área
        const validGrades = subjectResults.filter(s => s.grade !== null);
        let areaAverage: number | null = null;

        if (validGrades.length > 0) {
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
      const achievements = studentAchievements.map(sa => ({
        subject: sa.achievement.teacherAssignment?.subject?.name || '',
        orderNumber: sa.achievement.orderNumber,
        description: sa.approvedText || sa.suggestedText || sa.achievement.baseDescription,
        performanceLevel: sa.performanceLevel,
        observation: sa.observation || null,
        judgment: sa.approvedJudgment || sa.suggestedJudgment || null,
      }));

      // Map de logros por asignatura para enriquecer subjectGrades
      const achievementBySubject = new Map<string, (typeof achievements)[0]>();
      for (const ach of achievements) {
        if (ach.subject && !achievementBySubject.has(ach.subject)) {
          achievementBySubject.set(ach.subject, ach);
        }
      }

      // Aplanar subject grades y enriquecer con logros
      const subjectGrades = areaGrades.flatMap(a => a.subjects).map(sg => {
        const ach = achievementBySubject.get(sg.subject);
        return {
          ...sg,
          achievement: ach?.description || null,
          achievementObservation: ach?.observation || null,
          judgment: ach?.judgment || null,
        };
      });

      // También enriquecer los subjects dentro de areaGrades
      for (const area of areaGrades) {
        for (const subj of area.subjects) {
          const ach = achievementBySubject.get(subj.subject);
          subj.achievement = ach?.description || null;
          subj.achievementObservation = ach?.observation || null;
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
          firstName: enrollment.student.firstName,
          lastName: enrollment.student.lastName,
          documentType: enrollment.student.documentType,
          documentNumber: enrollment.student.documentNumber,
        },
        group: {
          id: enrollment.group.id,
          name: enrollment.group.name,
          gradeLevel: enrollment.group.grade?.name || '',
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
        headerResolution: data.headerResolution,
        headerMunicipality: data.headerMunicipality,
        headerDepartment: data.headerDepartment,
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
   * OPTIMIZADO: Usa buildGroupReportCards() que hace ~10 queries batch
   * en vez del patrón anterior de ~1,100 queries (N+1 en cascada).
   */
  async getGroupReportCardList(groupId: string, academicTermId: string, academicYearId: string) {
    const groupData = await this.buildGroupReportCards(groupId, academicTermId);

    const results = groupData.cards.map((card) => {
      const allGrades = card.subjectGrades.filter(s => s.grade !== null);
      const generalAvg = allGrades.length > 0
        ? Math.round((allGrades.reduce((sum, s) => sum + s.grade!, 0) / allGrades.length) * 10) / 10
        : null;

      const approved = allGrades.filter(s => (s.grade ?? 0) >= 3.0).length;
      const failed = allGrades.filter(s => (s.grade ?? 0) < 3.0).length;

      return {
        enrollmentId: card.enrollmentId,
        studentId: card.student.id,
        studentName: `${card.student.lastName} ${card.student.firstName}`,
        documentNumber: card.student.documentNumber || '',
        groupName: `${card.group.gradeLevel} ${card.group.name}`,
        average: generalAvg,
        approvedSubjects: approved,
        failedSubjects: failed,
        totalSubjects: allGrades.length,
        attendance: card.attendance,
      };
    });

    // Calcular ranking en memoria
    const sorted = [...results]
      .filter(r => r.average !== null)
      .sort((a, b) => (b.average ?? 0) - (a.average ?? 0));

    return results.map(r => ({
      ...r,
      rank: r.average !== null ? sorted.findIndex(s => s.enrollmentId === r.enrollmentId) + 1 : null,
      totalStudents: sorted.length,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SNAPSHOT LEGAL — FINALIZACIÓN Y REAPERTURA DE PERÍODOS
  // ═══════════════════════════════════════════════════════════════════════════

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

    for (const group of groups) {
      try {
        const groupData = await this.buildGroupReportCards(group.id, termId);

        // Guardar snapshot por cada estudiante
        const snapshotData = groupData.cards.map((card) => ({
          academicTermId: termId,
          studentEnrollmentId: card.enrollmentId,
          version,
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
          },
        }));

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

    // Cambiar estado a CLOSED (permite edición de notas)
    await this.prisma.academicTerm.update({
      where: { id: termId },
      data: {
        status: 'CLOSED',
        finalizedAt: null,
      },
    });

    return {
      success: true,
      termId,
      previousVersion: lastVersion._max.version ?? 0,
      newStatus: 'CLOSED',
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
