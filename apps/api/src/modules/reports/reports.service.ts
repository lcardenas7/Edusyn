import { Injectable, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import PDFDocument from 'pdfkit';

import { PrismaService } from '../../prisma/prisma.service';
import { StudentGradesService } from '../evaluation/student-grades.service';
import { AttendanceService } from '../attendance/attendance.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentGradesService: StudentGradesService,
    private readonly attendanceService: AttendanceService,
  ) {}

  /**
   * Obtiene las asignaturas que aplican a una matrícula específica.
   * Usa el snapshot (EnrollmentSubject) si existe, o calcula desde TeacherAssignment como fallback.
   * Esto protege contra cambios en plantillas que afectarían históricos.
   */
  private async getEnrollmentSubjects(enrollmentId: string, groupId: string, academicYearId: string) {
    // Intentar obtener snapshot de la matrícula
    const enrollmentAreas = await this.prisma.enrollmentArea.findMany({
      where: { enrollmentId },
      include: {
        enrollmentSubjects: {
          include: { subject: true },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    });

    if (enrollmentAreas.length > 0) {
      // Usar snapshot: obtener TeacherAssignments solo para las asignaturas del snapshot
      const subjectIds = enrollmentAreas
        .flatMap(a => a.enrollmentSubjects.map(s => s.subjectId))
        .filter((id): id is string => id !== null);
      
      const teacherAssignments = subjectIds.length > 0 
        ? await this.prisma.teacherAssignment.findMany({
            where: {
              groupId,
              academicYearId,
              subjectId: { in: subjectIds },
            },
            include: {
              subject: true,
              teacher: { select: { firstName: true, lastName: true } },
            },
          })
        : [];

      // Mapear asignaturas del snapshot con sus asignaciones de docente
      return {
        source: 'snapshot' as const,
        areas: enrollmentAreas.map(area => ({
          id: area.id,
          name: area.areaName,
          code: area.areaCode,
          weightPercentage: area.weightPercentage,
          calculationType: area.calculationType,
          subjects: area.enrollmentSubjects.map(es => {
            const assignment = es.subjectId 
              ? teacherAssignments.find(ta => ta.subjectId === es.subjectId)
              : null;
            return {
              id: es.subjectId,
              name: es.subjectName,
              code: es.subjectCode,
              weightPercentage: es.weightPercentage,
              teacherAssignmentId: assignment?.id ?? null,
              // 🔥 Usar nombre del docente del snapshot si existe, sino del assignment actual
              teacher: es.teacherName ?? (assignment ? `${assignment.teacher.firstName} ${assignment.teacher.lastName}` : null),
            };
          }),
        })),
      };
    }

    // Fallback: usar TeacherAssignments actuales (para matrículas sin snapshot)
    const teacherAssignments = await this.prisma.teacherAssignment.findMany({
      where: { groupId, academicYearId },
      include: {
        subject: { include: { area: true } },
        teacher: { select: { firstName: true, lastName: true } },
      },
    });

    // Agrupar por área
    const areaMap = new Map<string, { area: any; subjects: any[] }>();
    for (const ta of teacherAssignments) {
      const areaId = ta.subject.areaId;
      if (!areaMap.has(areaId)) {
        areaMap.set(areaId, {
          area: ta.subject.area,
          subjects: [],
        });
      }
      areaMap.get(areaId)!.subjects.push({
        id: ta.subjectId,
        name: ta.subject.name,
        code: ta.subject.code,
        weightPercentage: 100 / teacherAssignments.filter(t => t.subject.areaId === areaId).length,
        teacherAssignmentId: ta.id,
        teacher: `${ta.teacher.firstName} ${ta.teacher.lastName}`,
      });
    }

    return {
      source: 'calculated' as const,
      areas: Array.from(areaMap.values()).map(({ area, subjects }) => ({
        id: area.id,
        name: area.name,
        code: area.code,
        weightPercentage: 100 / areaMap.size,
        calculationType: 'AVERAGE',
        subjects,
      })),
    };
  }

  async getReportCardData(studentEnrollmentId: string, academicTermId: string) {
    const enrollment = await this.prisma.studentEnrollment.findUnique({
      where: { id: studentEnrollmentId },
      include: {
        student: true,
        group: {
          include: {
            grade: true,
          },
        },
        academicYear: {
          include: {
            institution: true,
          },
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Student enrollment not found');
    }

    const term = await this.prisma.academicTerm.findUnique({
      where: { id: academicTermId },
    });

    if (!term) {
      throw new NotFoundException('Academic term not found');
    }

    // 🔥 Usar snapshot de matrícula para obtener asignaturas
    // Esto protege contra cambios en plantillas después de la matrícula
    const enrollmentStructure = await this.getEnrollmentSubjects(
      studentEnrollmentId,
      enrollment.groupId,
      enrollment.academicYearId,
    );

    // Calcular notas por área y asignatura
    const areaGrades = await Promise.all(
      enrollmentStructure.areas.map(async (area) => {
        const subjectResults = await Promise.all(
          area.subjects.map(async (subject) => {
            let termGrade = { grade: null as number | null, components: [] as any[] };
            
            if (subject.teacherAssignmentId) {
              termGrade = await this.studentGradesService.calculateTermGrade(
                studentEnrollmentId,
                subject.teacherAssignmentId,
                academicTermId,
              );
            }

            const performanceResult = termGrade.grade
              ? await this.studentGradesService.getPerformanceLevel(
                  enrollment.academicYear.institution.id,
                  termGrade.grade,
                )
              : null;

            return {
              subject: subject.name,
              subjectCode: subject.code,
              teacher: subject.teacher,
              grade: termGrade.grade,
              weightPercentage: subject.weightPercentage,
              performanceLevel: performanceResult?.level || null,
              components: termGrade.components,
            };
          }),
        );

        // Calcular promedio del área según tipo de cálculo
        const validGrades = subjectResults.filter(s => s.grade !== null);
        let areaAverage: number | null = null;
        
        if (validGrades.length > 0) {
          if (area.calculationType === 'WEIGHTED') {
            const weightedSum = validGrades.reduce((acc, s) => acc + (s.grade! * s.weightPercentage), 0);
            const totalWeight = validGrades.reduce((acc, s) => acc + s.weightPercentage, 0);
            areaAverage = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : null;
          } else {
            // AVERAGE por defecto
            areaAverage = Math.round((validGrades.reduce((acc, s) => acc + s.grade!, 0) / validGrades.length) * 10) / 10;
          }
        }

        const areaPerformance = areaAverage
          ? await this.studentGradesService.getPerformanceLevel(
              enrollment.academicYear.institution.id,
              areaAverage,
            )
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
      }),
    );

    // Aplanar para compatibilidad con formato anterior
    const subjectGrades = areaGrades.flatMap(a => a.subjects);

    const attendanceSummary = await this.attendanceService.getStudentSummary(
      studentEnrollmentId,
      academicTermId,
    );

    const observations = await this.prisma.studentObservation.findMany({
      where: {
        studentEnrollmentId,
        date: {
          gte: term.startDate ?? undefined,
          lte: term.endDate ?? undefined,
        },
      },
      include: {
        author: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { date: 'desc' },
      take: 10,
    });

    return {
      institution: enrollment.academicYear.institution,
      academicYear: enrollment.academicYear,
      term: {
        id: term.id,
        name: term.name,
        type: term.type,
      },
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
        gradeLevel: enrollment.group.grade.name,
      },
      // 🔥 Estructura por áreas (nuevo formato con snapshot)
      areaGrades,
      // Compatibilidad: lista plana de asignaturas
      subjectGrades,
      // Fuente de datos: 'snapshot' o 'calculated'
      structureSource: enrollmentStructure.source,
      attendance: attendanceSummary,
      observations: observations.map((o) => ({
        date: o.date,
        type: o.type,
        category: o.category,
        description: o.description,
        author: `${o.author.firstName} ${o.author.lastName}`,
      })),
      generatedAt: new Date(),
    };
  }

  async generateReportCardPdf(studentEnrollmentId: string, academicTermId: string): Promise<Buffer> {
    const data = await this.getReportCardData(studentEnrollmentId, academicTermId);

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
        doc.text(subject.teacher, col4, y, { width: 100 });
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

      // Observations
      if (data.observations.length > 0) {
        doc.fontSize(10).font('Helvetica-Bold').text('OBSERVACIONES');
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

  async generateBulkReportCards(groupId: string, academicTermId: string, academicYearId: string) {
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        groupId,
        academicYearId,
        status: 'ACTIVE',
      },
      include: {
        student: true,
      },
      orderBy: {
        student: {
          lastName: 'asc',
        },
      },
    });

    const results: Array<{
      studentId: string;
      studentName: string;
      status: string;
      pdf?: string;
      error?: string;
    }> = [];

    for (const enrollment of enrollments) {
      try {
        const pdf = await this.generateReportCardPdf(enrollment.id, academicTermId);
        results.push({
          studentId: enrollment.student.id,
          studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
          status: 'success',
          pdf: pdf.toString('base64'),
        });
      } catch (error) {
        results.push({
          studentId: enrollment.student.id,
          studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
          status: 'error',
          error: error.message,
        });
      }
    }

    return results;
  }
}
