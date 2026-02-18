/**
 * ACADEMIC PDF SERVICE
 *
 * Genera PDFs formales para reportes académicos institucionales.
 * Solo se encarga de formateo — toda la lógica de datos viene de ReportsService
 * (que a su vez pasa por AcademicDataSourceService para snapshot/live).
 *
 * PDFs:
 *   1. Certificado de recuperación (listado de estudiantes en rango recuperable)
 *   2. Acta de no promovidos (estudiantes que no promueven con detalle)
 *   3. Consolidado estadístico (resumen institucional por grupo/asignatura)
 *   4. Certificado histórico del estudiante (trayectoria académica)
 */

import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

import { PrismaService } from '../../prisma/prisma.service';
import { ReportsService } from './reports.service';

@Injectable()
export class AcademicPdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reportsService: ReportsService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. CERTIFICADO DE RECUPERACIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  async generateRecoveryCertificate(
    institutionId: string,
    academicYearId: string,
    groupId: string,
    termId?: string,
  ): Promise<Buffer> {
    const [data, institution] = await Promise.all([
      this.reportsService.getRecoveryList(institutionId, academicYearId, groupId, termId),
      this.getInstitutionInfo(institutionId),
    ]);

    return this.buildPdf((doc, m, w) => {
      this.renderHeader(doc, m, w, institution, 'LISTADO DE ESTUDIANTES EN RECUPERACIÓN');
      this.renderSubtitle(doc, m, `Nota mínima aprobatoria: ${data.passingGrade}  |  Rango: ${data.rangeMin} – ${data.rangeMax}  |  Total: ${data.totalRecoverable}`);

      // Tabla
      const cols = [
        { header: '#', x: m, width: 25 },
        { header: 'Estudiante', x: m + 25, width: w * 0.30 },
        { header: 'Grupo', x: m + 25 + w * 0.30, width: w * 0.12 },
        { header: 'Asignatura', x: m + 25 + w * 0.42, width: w * 0.22 },
        { header: 'Nota', x: m + 25 + w * 0.64, width: w * 0.10 },
        { header: 'Período', x: m + 25 + w * 0.74, width: w * 0.13 },
        { header: 'Déficit', x: m + 25 + w * 0.87, width: w * 0.10 },
      ];

      this.renderTableHeader(doc, cols);

      data.results.forEach((r, i) => {
        if (doc.y > 700) { doc.addPage(); this.renderTableHeader(doc, cols); }
        const y = doc.y;
        doc.fontSize(7).font('Helvetica');
        doc.text(String(i + 1), cols[0].x, y, { width: cols[0].width });
        doc.text(r.studentName, cols[1].x, y, { width: cols[1].width });
        doc.text(r.group, cols[2].x, y, { width: cols[2].width });
        doc.text(r.subjectName, cols[3].x, y, { width: cols[3].width });
        doc.text(r.grade.toFixed(1), cols[4].x, y, { width: cols[4].width, align: 'center' });
        doc.text(r.termName, cols[5].x, y, { width: cols[5].width });
        doc.text(r.deficit.toFixed(1), cols[6].x, y, { width: cols[6].width, align: 'center' });
        doc.y = y + 14;
      });

      this.renderSignatureBlock(doc, m, w);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. ACTA DE NO PROMOVIDOS
  // ═══════════════════════════════════════════════════════════════════════════

  async generateNonPromotedReport(
    institutionId: string,
    academicYearId: string,
    groupId: string,
  ): Promise<Buffer> {
    const [data, institution] = await Promise.all([
      this.reportsService.getPromotionProjection(institutionId, academicYearId, groupId),
      this.getInstitutionInfo(institutionId),
    ]);

    const nonPromoted = data.results.filter(r => r.overallProjection === 'NO_PROMUEVE');

    return this.buildPdf((doc, m, w) => {
      this.renderHeader(doc, m, w, institution, 'ACTA DE ESTUDIANTES NO PROMOVIDOS');
      this.renderSubtitle(doc, m,
        `Nota mínima: ${data.passingGrade}  |  Períodos: ${data.completedTerms}/${data.totalTerms}  |  ` +
        `Promueven: ${data.summary.promoted}  |  En riesgo: ${data.summary.atRisk}  |  No promueven: ${data.summary.notPromoted}`
      );

      if (nonPromoted.length === 0) {
        doc.moveDown(2);
        doc.fontSize(11).font('Helvetica').text('No hay estudiantes en estado de no promoción para este grupo.', m, doc.y, { align: 'center' });
      } else {
        // Tabla resumen
        const cols = [
          { header: '#', x: m, width: 25 },
          { header: 'Estudiante', x: m + 25, width: w * 0.28 },
          { header: 'Grupo', x: m + 25 + w * 0.28, width: w * 0.12 },
          { header: 'Total Asig.', x: m + 25 + w * 0.40, width: w * 0.12 },
          { header: 'Aprueba', x: m + 25 + w * 0.52, width: w * 0.12 },
          { header: 'En Riesgo', x: m + 25 + w * 0.64, width: w * 0.12 },
          { header: 'No Aprueba', x: m + 25 + w * 0.76, width: w * 0.12 },
        ];

        this.renderTableHeader(doc, cols);

        nonPromoted.forEach((r, i) => {
          if (doc.y > 680) { doc.addPage(); this.renderTableHeader(doc, cols); }
          const y = doc.y;
          doc.fontSize(7).font('Helvetica');
          doc.text(String(i + 1), cols[0].x, y, { width: cols[0].width });
          doc.text(r.studentName, cols[1].x, y, { width: cols[1].width });
          doc.text(r.group, cols[2].x, y, { width: cols[2].width });
          doc.text(String(r.totalSubjects), cols[3].x, y, { width: cols[3].width, align: 'center' });
          doc.text(String(r.projectedApproved), cols[4].x, y, { width: cols[4].width, align: 'center' });
          doc.text(String(r.atRisk), cols[5].x, y, { width: cols[5].width, align: 'center' });
          doc.text(String(r.projectedFailed), cols[6].x, y, { width: cols[6].width, align: 'center' });
          doc.y = y + 14;

          // Detalle de asignaturas reprobadas
          const failedSubjects = r.subjects.filter(s => s.status === 'NO_PROMUEVE');
          if (failedSubjects.length > 0) {
            doc.fontSize(6).font('Helvetica-Oblique').fillColor('#666666');
            const detail = failedSubjects.map(s => `${s.subjectName} (${s.projectedAnnual?.toFixed(1) ?? 'N/A'})`).join(', ');
            doc.text(`   Asignaturas: ${detail}`, cols[1].x, doc.y, { width: w - 25 });
            doc.fillColor('#000000');
            doc.y += 10;
          }
        });
      }

      this.renderSignatureBlock(doc, m, w);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. CONSOLIDADO ESTADÍSTICO
  // ═══════════════════════════════════════════════════════════════════════════

  async generateStatisticalSummary(
    institutionId: string,
    academicYearId: string,
    groupId: string,
    termId?: string,
  ): Promise<Buffer> {
    const [averages, distribution, failed, institution] = await Promise.all([
      this.reportsService.getSubjectAverages(institutionId, academicYearId, groupId, termId),
      this.reportsService.getGradeDistribution(institutionId, academicYearId, groupId, undefined, termId),
      this.reportsService.getFailedSubjects(institutionId, academicYearId, groupId, termId),
      this.getInstitutionInfo(institutionId),
    ]);

    return this.buildPdf((doc, m, w) => {
      this.renderHeader(doc, m, w, institution, 'CONSOLIDADO ESTADÍSTICO ACADÉMICO');

      // ── Sección 1: Promedios por asignatura ──
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica-Bold').text('1. PROMEDIOS POR ASIGNATURA', m);
      doc.moveDown(0.3);

      const avgCols = [
        { header: 'Asignatura', x: m, width: w * 0.40 },
        { header: 'Promedio', x: m + w * 0.40, width: w * 0.15 },
        { header: 'Mínima', x: m + w * 0.55, width: w * 0.15 },
        { header: 'Máxima', x: m + w * 0.70, width: w * 0.15 },
        { header: 'Estudiantes', x: m + w * 0.85, width: w * 0.15 },
      ];
      this.renderTableHeader(doc, avgCols);

      for (const r of averages.results) {
        if (doc.y > 700) { doc.addPage(); this.renderTableHeader(doc, avgCols); }
        const y = doc.y;
        doc.fontSize(7).font('Helvetica');
        doc.text(r.subjectName, avgCols[0].x, y, { width: avgCols[0].width });
        doc.text(r.average.toFixed(1), avgCols[1].x, y, { width: avgCols[1].width, align: 'center' });
        doc.text(r.worstGrade.toFixed(1), avgCols[2].x, y, { width: avgCols[2].width, align: 'center' });
        doc.text(r.bestGrade.toFixed(1), avgCols[3].x, y, { width: avgCols[3].width, align: 'center' });
        doc.text(String(r.totalStudents), avgCols[4].x, y, { width: avgCols[4].width, align: 'center' });
        doc.y = y + 14;
      }

      // ── Sección 2: Distribución de desempeño ──
      doc.moveDown(1);
      if (doc.y > 650) doc.addPage();
      doc.fontSize(10).font('Helvetica-Bold').text('2. DISTRIBUCIÓN DE DESEMPEÑO', m);
      doc.moveDown(0.3);

      const distCols = [
        { header: 'Rango', x: m, width: w * 0.40 },
        { header: 'Cantidad', x: m + w * 0.40, width: w * 0.20 },
        { header: 'Porcentaje', x: m + w * 0.60, width: w * 0.20 },
      ];
      this.renderTableHeader(doc, distCols);

      for (const d of distribution.distribution) {
        const y = doc.y;
        doc.fontSize(7).font('Helvetica');
        doc.text(d.range, distCols[0].x, y, { width: distCols[0].width });
        doc.text(String(d.count), distCols[1].x, y, { width: distCols[1].width, align: 'center' });
        doc.text(`${d.percentage}%`, distCols[2].x, y, { width: distCols[2].width, align: 'center' });
        doc.y = y + 14;
      }

      // ── Sección 3: Resumen de reprobación ──
      doc.moveDown(1);
      if (doc.y > 650) doc.addPage();
      doc.fontSize(10).font('Helvetica-Bold').text('3. RESUMEN DE REPROBACIÓN', m);
      doc.moveDown(0.3);
      doc.fontSize(8).font('Helvetica');
      doc.text(`Nota mínima aprobatoria: ${failed.passingGrade}`);
      doc.text(`Total reprobaciones: ${failed.totalFailed}`);
      doc.text(`Estudiantes afectados: ${failed.uniqueStudents}`);
      doc.text(`Asignaturas afectadas: ${failed.uniqueSubjects}`);

      // Top asignaturas con más reprobación
      if (failed.results.length > 0) {
        doc.moveDown(0.5);
        doc.fontSize(8).font('Helvetica-Bold').text('Asignaturas con mayor reprobación:');
        doc.font('Helvetica');
        const subjectCount = new Map<string, number>();
        for (const f of failed.results) {
          subjectCount.set(f.subjectName, (subjectCount.get(f.subjectName) || 0) + 1);
        }
        const sorted = Array.from(subjectCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
        for (const [name, count] of sorted) {
          doc.text(`  • ${name}: ${count} reprobaciones`);
        }
      }

      this.renderSignatureBlock(doc, m, w);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. CERTIFICADO HISTÓRICO DEL ESTUDIANTE
  // ═══════════════════════════════════════════════════════════════════════════

  async generateStudentHistoryCertificate(
    studentId: string,
  ): Promise<Buffer> {
    const [history, student] = await Promise.all([
      this.reportsService.getStudentHistory(studentId),
      this.prisma.student.findUnique({
        where: { id: studentId },
        include: {
          enrollments: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            include: { academicYear: { include: { institution: true } } },
          },
        },
      }),
    ]);

    const institution = student?.enrollments[0]?.academicYear?.institution;
    const instInfo = {
      name: institution?.name || 'Institución Educativa',
      nit: (institution as any)?.nit || '',
      address: (institution as any)?.address || '',
    };

    return this.buildPdf((doc, m, w) => {
      this.renderHeader(doc, m, w, instInfo, 'CERTIFICADO HISTÓRICO ACADÉMICO');

      // Datos del estudiante
      doc.moveDown(0.5);
      doc.fontSize(9).font('Helvetica-Bold').text('DATOS DEL ESTUDIANTE', m);
      doc.font('Helvetica').fontSize(8);
      doc.text(`Nombre: ${student?.firstName || ''} ${student?.lastName || ''}`);
      doc.text(`Documento: ${student?.documentType || 'CC'} ${student?.documentNumber || ''}`);
      doc.moveDown(0.5);

      if (history.length === 0) {
        doc.fontSize(10).text('No se encontraron registros académicos para este estudiante.', m);
      }

      for (const year of history) {
        if (doc.y > 620) doc.addPage();

        // Año académico header
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e40af');
        doc.text(`${year.yearName} — ${year.group}`, m);
        doc.fillColor('#000000');

        if (year.average !== null) {
          doc.fontSize(7).font('Helvetica').text(`Promedio general: ${year.average}  |  Estado: ${year.status}`);
        }
        doc.moveDown(0.3);

        // Tabla de asignaturas
        const cols = [
          { header: 'Asignatura', x: m + 10, width: w * 0.45 },
          { header: 'Área', x: m + 10 + w * 0.45, width: w * 0.30 },
          { header: 'Promedio', x: m + 10 + w * 0.75, width: w * 0.20 },
        ];
        this.renderTableHeader(doc, cols);

        for (const subj of year.subjects) {
          if (doc.y > 720) { doc.addPage(); this.renderTableHeader(doc, cols); }
          const y = doc.y;
          doc.fontSize(7).font('Helvetica');
          doc.text(subj.subjectName, cols[0].x, y, { width: cols[0].width });
          doc.text(subj.areaName, cols[1].x, y, { width: cols[1].width });
          doc.text(subj.average !== null ? subj.average.toFixed(1) : 'N/A', cols[2].x, y, { width: cols[2].width, align: 'center' });
          doc.y = y + 12;
        }

        doc.moveDown(0.5);
      }

      this.renderSignatureBlock(doc, m, w);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILIDADES COMPARTIDAS
  // ═══════════════════════════════════════════════════════════════════════════

  private async getInstitutionInfo(institutionId: string) {
    const inst = await this.prisma.institution.findUnique({ where: { id: institutionId } });
    return {
      name: inst?.name || 'Institución Educativa',
      nit: (inst as any)?.nit || '',
      address: (inst as any)?.address || '',
    };
  }

  private buildPdf(render: (doc: PDFKit.PDFDocument, margin: number, contentWidth: number) => void): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const margin = 50;
      const contentWidth = 612 - margin * 2; // LETTER width

      render(doc, margin, contentWidth);

      doc.end();
    });
  }

  private renderHeader(
    doc: PDFKit.PDFDocument,
    m: number,
    w: number,
    institution: { name: string; nit: string; address: string },
    title: string,
  ) {
    // Franja superior
    doc.rect(0, 0, 612, 6).fill('#1e40af');
    doc.fillColor('#000000');

    doc.fontSize(14).font('Helvetica-Bold').text(institution.name, m, 20, { align: 'center', width: w });
    if (institution.nit) {
      doc.fontSize(8).font('Helvetica').text(`NIT: ${institution.nit}`, { align: 'center', width: w });
    }
    if (institution.address) {
      doc.fontSize(8).font('Helvetica').text(institution.address, { align: 'center', width: w });
    }
    doc.moveDown(0.5);

    // Línea separadora
    doc.moveTo(m, doc.y).lineTo(m + w, doc.y).lineWidth(1).strokeColor('#1e40af').stroke();
    doc.moveDown(0.3);

    // Título del documento
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e40af').text(title, m, doc.y, { align: 'center', width: w });
    doc.fillColor('#000000');

    // Fecha de generación
    const now = new Date();
    doc.fontSize(7).font('Helvetica').text(
      `Generado: ${now.toLocaleDateString('es-CO')} ${now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`,
      m, doc.y + 4, { align: 'right', width: w },
    );
    doc.moveDown(0.8);
  }

  private renderSubtitle(doc: PDFKit.PDFDocument, m: number, text: string) {
    doc.fontSize(8).font('Helvetica').text(text, m);
    doc.moveDown(0.5);
  }

  private renderTableHeader(
    doc: PDFKit.PDFDocument,
    cols: Array<{ header: string; x: number; width: number }>,
  ) {
    const y = doc.y;
    // Header background
    const totalWidth = cols[cols.length - 1].x + cols[cols.length - 1].width - cols[0].x;
    doc.rect(cols[0].x, y - 2, totalWidth, 14).fill('#e2e8f0');
    doc.fillColor('#000000');

    doc.fontSize(7).font('Helvetica-Bold');
    for (const col of cols) {
      doc.text(col.header, col.x, y, { width: col.width });
    }
    doc.y = y + 16;
  }

  private renderSignatureBlock(doc: PDFKit.PDFDocument, m: number, w: number) {
    // Ensure enough space
    if (doc.y > 660) doc.addPage();
    doc.moveDown(3);

    const lineY = doc.y;
    const lineWidth = 180;

    // Left signature
    doc.moveTo(m + 20, lineY).lineTo(m + 20 + lineWidth, lineY).lineWidth(0.5).strokeColor('#000000').stroke();
    doc.fontSize(7).font('Helvetica').text('Rector(a) / Coordinador(a)', m + 20, lineY + 4, { width: lineWidth, align: 'center' });

    // Right signature
    const rightX = m + w - 20 - lineWidth;
    doc.moveTo(rightX, lineY).lineTo(rightX + lineWidth, lineY).stroke();
    doc.text('Secretario(a) Académico(a)', rightX, lineY + 4, { width: lineWidth, align: 'center' });

    doc.moveDown(2);
    doc.fontSize(6).font('Helvetica').fillColor('#999999').text(
      'Documento generado automáticamente por Edusyn. Este documento es válido sin firma cuando se verifica digitalmente.',
      m, doc.y, { align: 'center', width: w },
    );
    doc.fillColor('#000000');
  }
}
