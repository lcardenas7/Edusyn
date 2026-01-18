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

    const teacherAssignments = await this.prisma.teacherAssignment.findMany({
      where: {
        groupId: enrollment.groupId,
        academicYearId: enrollment.academicYearId,
      },
      include: {
        subject: true,
        teacher: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    const subjectGrades = await Promise.all(
      teacherAssignments.map(async (assignment) => {
        const termGrade = await this.studentGradesService.calculateTermGrade(
          studentEnrollmentId,
          assignment.id,
          academicTermId,
        );

        const performanceResult = termGrade.grade
          ? await this.studentGradesService.getPerformanceLevel(
              enrollment.academicYear.institution.id,
              termGrade.grade,
            )
          : null;

        return {
          subject: assignment.subject.name,
          teacher: `${assignment.teacher.firstName} ${assignment.teacher.lastName}`,
          grade: termGrade.grade,
          performanceLevel: performanceResult?.level || null,
          components: termGrade.components,
        };
      }),
    );

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
      subjectGrades,
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
