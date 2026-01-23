import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';

@Injectable()
export class EnrollmentReportsService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORTE PDF: LISTADO DE MATRICULADOS
  // ═══════════════════════════════════════════════════════════════════════════

  async generateEnrollmentListPdf(
    academicYearId: string,
    filters?: { gradeId?: string; groupId?: string; status?: string }
  ): Promise<Buffer> {
    const academicYear = await this.prisma.academicYear.findUnique({
      where: { id: academicYearId },
      include: { institution: true },
    });

    if (!academicYear) {
      throw new NotFoundException('Año lectivo no encontrado');
    }

    const whereClause: any = {
      academicYearId,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.groupId && { groupId: filters.groupId }),
      ...(filters?.gradeId && { group: { gradeId: filters.gradeId } }),
    };

    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: whereClause,
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
      orderBy: [
        { group: { grade: { stage: 'asc' } } },
        { group: { grade: { number: 'asc' } } },
        { group: { name: 'asc' } },
        { student: { lastName: 'asc' } },
      ],
    });

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(16).font('Helvetica-Bold')
        .text(academicYear.institution.name, { align: 'center' });
      doc.fontSize(12).font('Helvetica')
        .text(`Listado de Estudiantes Matriculados - ${academicYear.name}`, { align: 'center' });
      doc.moveDown();
      doc.fontSize(10)
        .text(`Fecha de generación: ${new Date().toLocaleDateString('es-CO')}`, { align: 'right' });
      doc.moveDown(2);

      // Stats
      const totalActive = enrollments.filter(e => e.status === 'ACTIVE').length;
      const totalWithdrawn = enrollments.filter(e => e.status === 'WITHDRAWN').length;
      doc.fontSize(10).font('Helvetica-Bold')
        .text(`Total matriculados: ${enrollments.length} | Activos: ${totalActive} | Retirados: ${totalWithdrawn}`);
      doc.moveDown();

      // Table header
      const tableTop = doc.y;
      const colWidths = [30, 80, 150, 80, 80, 70];
      const headers = ['#', 'Documento', 'Nombre Completo', 'Grado', 'Grupo', 'Estado'];

      doc.font('Helvetica-Bold').fontSize(9);
      let xPos = 50;
      headers.forEach((header, i) => {
        doc.text(header, xPos, tableTop, { width: colWidths[i], align: 'left' });
        xPos += colWidths[i];
      });

      doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

      // Table rows
      doc.font('Helvetica').fontSize(8);
      let yPos = tableTop + 20;
      let rowNum = 1;

      for (const enrollment of enrollments) {
        if (yPos > 700) {
          doc.addPage();
          yPos = 50;
        }

        xPos = 50;
        const rowData = [
          rowNum.toString(),
          enrollment.student.documentNumber,
          `${enrollment.student.lastName} ${enrollment.student.secondLastName || ''}, ${enrollment.student.firstName}`.trim(),
          enrollment.group.grade.name,
          enrollment.group.name,
          this.getStatusText(enrollment.status),
        ];

        rowData.forEach((data, i) => {
          doc.text(data, xPos, yPos, { width: colWidths[i], align: 'left' });
          xPos += colWidths[i];
        });

        yPos += 15;
        rowNum++;
      }

      // Footer
      doc.fontSize(8).text(
        `Página 1 - Generado por Edusyn`,
        50, 750, { align: 'center' }
      );

      doc.end();
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORTE EXCEL: LISTADO COMPLETO
  // ═══════════════════════════════════════════════════════════════════════════

  async generateEnrollmentListExcel(
    academicYearId: string,
    filters?: { gradeId?: string; groupId?: string; status?: string }
  ): Promise<Buffer> {
    const academicYear = await this.prisma.academicYear.findUnique({
      where: { id: academicYearId },
      include: { institution: true },
    });

    if (!academicYear) {
      throw new NotFoundException('Año lectivo no encontrado');
    }

    const whereClause: any = {
      academicYearId,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.groupId && { groupId: filters.groupId }),
      ...(filters?.gradeId && { group: { gradeId: filters.gradeId } }),
    };

    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: whereClause,
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
      orderBy: [
        { group: { grade: { stage: 'asc' } } },
        { group: { grade: { number: 'asc' } } },
        { group: { name: 'asc' } },
        { student: { lastName: 'asc' } },
      ],
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Edusyn';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Matriculados');

    // Header row
    sheet.columns = [
      { header: '#', key: 'num', width: 5 },
      { header: 'Tipo Doc', key: 'docType', width: 10 },
      { header: 'Documento', key: 'docNumber', width: 15 },
      { header: 'Apellidos', key: 'lastName', width: 25 },
      { header: 'Nombres', key: 'firstName', width: 25 },
      { header: 'Grado', key: 'grade', width: 15 },
      { header: 'Grupo', key: 'group', width: 10 },
      { header: 'Jornada', key: 'shift', width: 12 },
      { header: 'Sede', key: 'campus', width: 15 },
      { header: 'Tipo Matrícula', key: 'enrollmentType', width: 15 },
      { header: 'Estado', key: 'status', width: 12 },
      { header: 'Fecha Matrícula', key: 'enrollmentDate', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Teléfono', key: 'phone', width: 15 },
      { header: 'Dirección', key: 'address', width: 30 },
      { header: 'EPS', key: 'eps', width: 15 },
      { header: 'Estrato', key: 'stratum', width: 8 },
    ];

    // Style header
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Add data
    enrollments.forEach((enrollment, index) => {
      sheet.addRow({
        num: index + 1,
        docType: enrollment.student.documentType || '',
        docNumber: enrollment.student.documentNumber,
        lastName: `${enrollment.student.lastName} ${enrollment.student.secondLastName || ''}`.trim(),
        firstName: `${enrollment.student.firstName} ${enrollment.student.secondName || ''}`.trim(),
        grade: enrollment.group.grade.name,
        group: enrollment.group.name,
        shift: enrollment.group.shift.name,
        campus: enrollment.group.campus.name,
        enrollmentType: this.getEnrollmentTypeText(enrollment.enrollmentType),
        status: this.getStatusText(enrollment.status),
        enrollmentDate: enrollment.enrollmentDate?.toLocaleDateString('es-CO') || '',
        email: enrollment.student.email || '',
        phone: enrollment.student.phone || '',
        address: enrollment.student.address || '',
        eps: enrollment.student.eps || '',
        stratum: enrollment.student.stratum || '',
      });
    });

    // Add summary sheet
    const summarySheet = workbook.addWorksheet('Resumen');
    summarySheet.columns = [
      { header: 'Concepto', key: 'concept', width: 30 },
      { header: 'Cantidad', key: 'count', width: 15 },
    ];
    summarySheet.getRow(1).font = { bold: true };

    const stats = this.calculateStats(enrollments);
    summarySheet.addRow({ concept: 'Total Matriculados', count: stats.total });
    summarySheet.addRow({ concept: 'Activos', count: stats.active });
    summarySheet.addRow({ concept: 'Retirados', count: stats.withdrawn });
    summarySheet.addRow({ concept: 'Trasladados', count: stats.transferred });
    summarySheet.addRow({ concept: 'Nuevos', count: stats.new });
    summarySheet.addRow({ concept: 'Antiguos', count: stats.renewal });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORTE PDF: ESTADÍSTICAS POR GRADO
  // ═══════════════════════════════════════════════════════════════════════════

  async generateStatsByGradePdf(academicYearId: string): Promise<Buffer> {
    const academicYear = await this.prisma.academicYear.findUnique({
      where: { id: academicYearId },
      include: { institution: true },
    });

    if (!academicYear) {
      throw new NotFoundException('Año lectivo no encontrado');
    }

    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { academicYearId },
      include: {
        group: {
          include: {
            grade: true,
            _count: {
              select: { studentEnrollments: true },
            },
          },
        },
      },
    });

    // Group by grade
    const byGrade = new Map<string, { grade: any; total: number; active: number; groups: Set<string> }>();
    
    for (const e of enrollments) {
      const gradeId = e.group.gradeId;
      if (!byGrade.has(gradeId)) {
        byGrade.set(gradeId, {
          grade: e.group.grade,
          total: 0,
          active: 0,
          groups: new Set(),
        });
      }
      const data = byGrade.get(gradeId)!;
      data.total++;
      if (e.status === 'ACTIVE') data.active++;
      data.groups.add(e.groupId);
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(16).font('Helvetica-Bold')
        .text(academicYear.institution.name, { align: 'center' });
      doc.fontSize(12).font('Helvetica')
        .text(`Estadísticas de Matrícula por Grado - ${academicYear.name}`, { align: 'center' });
      doc.moveDown(2);

      // Table
      const tableTop = doc.y;
      const colWidths = [150, 80, 80, 80];
      const headers = ['Grado', 'Grupos', 'Matriculados', 'Activos'];

      doc.font('Helvetica-Bold').fontSize(10);
      let xPos = 100;
      headers.forEach((header, i) => {
        doc.text(header, xPos, tableTop, { width: colWidths[i], align: 'center' });
        xPos += colWidths[i];
      });

      doc.moveTo(100, tableTop + 15).lineTo(490, tableTop + 15).stroke();

      doc.font('Helvetica').fontSize(10);
      let yPos = tableTop + 25;
      let totalStudents = 0;
      let totalActive = 0;
      let totalGroups = 0;

      const sortedGrades = Array.from(byGrade.values()).sort((a, b) => {
        if (a.grade.stage !== b.grade.stage) {
          return a.grade.stage.localeCompare(b.grade.stage);
        }
        return (a.grade.number || 0) - (b.grade.number || 0);
      });

      for (const data of sortedGrades) {
        xPos = 100;
        const rowData = [
          data.grade.name,
          data.groups.size.toString(),
          data.total.toString(),
          data.active.toString(),
        ];

        rowData.forEach((text, i) => {
          doc.text(text, xPos, yPos, { width: colWidths[i], align: 'center' });
          xPos += colWidths[i];
        });

        totalStudents += data.total;
        totalActive += data.active;
        totalGroups += data.groups.size;
        yPos += 20;
      }

      // Totals
      doc.moveTo(100, yPos).lineTo(490, yPos).stroke();
      yPos += 10;
      doc.font('Helvetica-Bold');
      xPos = 100;
      const totals = ['TOTAL', totalGroups.toString(), totalStudents.toString(), totalActive.toString()];
      totals.forEach((text, i) => {
        doc.text(text, xPos, yPos, { width: colWidths[i], align: 'center' });
        xPos += colWidths[i];
      });

      doc.end();
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private getStatusText(status: string): string {
    const texts: Record<string, string> = {
      ACTIVE: 'Activo',
      PROMOTED: 'Promovido',
      REPEATED: 'Repitente',
      WITHDRAWN: 'Retirado',
      TRANSFERRED: 'Trasladado',
    };
    return texts[status] || status;
  }

  private getEnrollmentTypeText(type: string): string {
    const texts: Record<string, string> = {
      NEW: 'Nuevo',
      RENEWAL: 'Antiguo',
      REENTRY: 'Reingreso',
      TRANSFER: 'Traslado',
    };
    return texts[type] || type;
  }

  private calculateStats(enrollments: any[]) {
    return {
      total: enrollments.length,
      active: enrollments.filter(e => e.status === 'ACTIVE').length,
      withdrawn: enrollments.filter(e => e.status === 'WITHDRAWN').length,
      transferred: enrollments.filter(e => e.status === 'TRANSFERRED').length,
      new: enrollments.filter(e => e.enrollmentType === 'NEW').length,
      renewal: enrollments.filter(e => e.enrollmentType === 'RENEWAL').length,
    };
  }
}
