import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ElectionsReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Genera el Acta de Escrutinio para un proceso electoral
   */
  async generateActaEscrutinio(processId: string): Promise<Buffer> {
    const process = await this.prisma.electionProcess.findUnique({
      where: { id: processId },
      include: {
        institution: true,
        academicYear: true,
        createdBy: { select: { firstName: true, lastName: true } },
        elections: {
          include: {
            grade: true,
            group: { include: { grade: true } },
            results: {
              include: {
                candidate: {
                  include: { student: true },
                },
              },
              orderBy: { position: 'asc' },
            },
            _count: { select: { votes: true } },
          },
        },
      },
    });

    if (!process) {
      throw new NotFoundException('Proceso electoral no encontrado');
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      this.drawHeader(doc, process.institution, 'ACTA DE ESCRUTINIO');
      
      // Información del proceso
      doc.fontSize(12).font('Helvetica-Bold')
        .text('PROCESO ELECTORAL:', 50, doc.y + 20);
      doc.font('Helvetica')
        .text(process.name, 200, doc.y - 12);
      
      doc.font('Helvetica-Bold')
        .text('AÑO ACADÉMICO:', 50, doc.y + 5);
      doc.font('Helvetica')
        .text(process.academicYear.year.toString(), 200, doc.y - 12);
      
      doc.font('Helvetica-Bold')
        .text('FECHA DE CIERRE:', 50, doc.y + 5);
      doc.font('Helvetica')
        .text(new Date().toLocaleDateString('es-CO', { 
          year: 'numeric', month: 'long', day: 'numeric' 
        }), 200, doc.y - 12);

      doc.moveDown(2);

      // Resultados por tipo de elección
      const electionsByType = this.groupElectionsByType(process.elections);
      
      for (const [type, elections] of Object.entries(electionsByType)) {
        this.drawElectionTypeResults(doc, type, elections as any[]);
      }

      // Firmas
      this.drawSignatures(doc);

      doc.end();
    });
  }

  /**
   * Genera reporte de resultados por elección específica
   */
  async generateElectionResults(electionId: string): Promise<Buffer> {
    const election = await this.prisma.election.findUnique({
      where: { id: electionId },
      include: {
        electionProcess: {
          include: {
            institution: true,
            academicYear: true,
          },
        },
        grade: true,
        group: { include: { grade: true } },
        candidates: {
          include: { student: true },
        },
        results: {
          include: {
            candidate: { include: { student: true } },
          },
          orderBy: { position: 'asc' },
        },
        _count: { select: { votes: true } },
      },
    });

    if (!election) {
      throw new NotFoundException('Elección no encontrada');
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const institution = election.electionProcess.institution;
      const title = this.getElectionTitle(election);

      // Header
      this.drawHeader(doc, institution, `RESULTADOS - ${title.toUpperCase()}`);

      // Información
      doc.fontSize(11).font('Helvetica')
        .text(`Proceso: ${election.electionProcess.name}`, 50, doc.y + 20)
        .text(`Año Académico: ${election.electionProcess.academicYear.year}`)
        .text(`Total de votos: ${election._count.votes}`)
        .text(`Candidatos inscritos: ${election.candidates.length}`);

      doc.moveDown(2);

      // Tabla de resultados
      this.drawResultsTable(doc, election.results, election._count.votes);

      // Gráfico de barras simple
      doc.moveDown(2);
      this.drawBarChart(doc, election.results);

      // Firmas
      this.drawSignatures(doc);

      doc.end();
    });
  }

  /**
   * Genera reporte de participación
   */
  async generateParticipationReport(processId: string): Promise<Buffer> {
    const process = await this.prisma.electionProcess.findUnique({
      where: { id: processId },
      include: {
        institution: true,
        academicYear: true,
        elections: {
          include: {
            grade: true,
            group: { include: { grade: true, campus: true } },
            _count: { select: { votes: true } },
          },
        },
      },
    });

    if (!process) {
      throw new NotFoundException('Proceso electoral no encontrado');
    }

    // Obtener estadísticas de participación
    const totalStudents = await this.prisma.studentEnrollment.count({
      where: {
        status: 'ACTIVE',
        group: { campus: { institutionId: process.institutionId } },
      },
    });

    const uniqueVoters = await this.prisma.vote.groupBy({
      by: ['voterId'],
      where: {
        election: { electionProcessId: processId },
      },
    });

    // Participación por grado
    const participationByGrade = await this.getParticipationByGrade(processId, process.institutionId);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      this.drawHeader(doc, process.institution, 'INFORME DE PARTICIPACIÓN');

      // Resumen general
      doc.fontSize(14).font('Helvetica-Bold')
        .text('RESUMEN GENERAL', 50, doc.y + 20);
      
      doc.moveDown();
      
      const participationRate = totalStudents > 0 
        ? ((uniqueVoters.length / totalStudents) * 100).toFixed(2) 
        : '0.00';

      doc.fontSize(11).font('Helvetica')
        .text(`Proceso Electoral: ${process.name}`)
        .text(`Año Académico: ${process.academicYear.year}`)
        .text(`Estudiantes Habilitados: ${totalStudents}`)
        .text(`Estudiantes que Votaron: ${uniqueVoters.length}`)
        .text(`Porcentaje de Participación: ${participationRate}%`);

      doc.moveDown(2);

      // Tabla de participación por grado
      doc.fontSize(14).font('Helvetica-Bold')
        .text('PARTICIPACIÓN POR GRADO', 50, doc.y);
      
      doc.moveDown();
      
      this.drawParticipationTable(doc, participationByGrade);

      // Firmas
      this.drawSignatures(doc);

      doc.end();
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private drawHeader(doc: PDFKit.PDFDocument, institution: any, title: string) {
    // Logo placeholder
    doc.rect(50, 50, 60, 60).stroke();
    doc.fontSize(8).text('LOGO', 65, 75);

    // Nombre de la institución
    doc.fontSize(14).font('Helvetica-Bold')
      .text(institution.name.toUpperCase(), 120, 55, { width: 400, align: 'center' });
    
    doc.fontSize(10).font('Helvetica')
      .text(institution.address || '', 120, 72, { width: 400, align: 'center' })
      .text(`NIT: ${institution.nit || 'N/A'}`, 120, 85, { width: 400, align: 'center' });

    // Título del documento
    doc.moveDown(2);
    doc.fontSize(16).font('Helvetica-Bold')
      .text(title, 50, 130, { width: 512, align: 'center' });
    
    doc.moveTo(50, 155).lineTo(562, 155).stroke();
    doc.y = 170;
  }

  private groupElectionsByType(elections: any[]) {
    return elections.reduce((acc, election) => {
      const type = election.type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(election);
      return acc;
    }, {} as Record<string, any[]>);
  }

  private getElectionTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      PERSONERO: 'Personero Estudiantil',
      CONTRALOR: 'Contralor Estudiantil',
      REPRESENTANTE_GRADO: 'Representante de Grado',
      REPRESENTANTE_CURSO: 'Representante de Curso',
    };
    return labels[type] || type;
  }

  private getElectionTitle(election: any): string {
    const baseTitle = this.getElectionTypeLabel(election.type);
    if (election.type === 'REPRESENTANTE_GRADO' && election.grade) {
      return `${baseTitle} - ${election.grade.name}`;
    }
    if (election.type === 'REPRESENTANTE_CURSO' && election.group) {
      return `${baseTitle} - ${election.group.grade.name} ${election.group.name}`;
    }
    return baseTitle;
  }

  private drawElectionTypeResults(doc: PDFKit.PDFDocument, type: string, elections: any[]) {
    // Verificar si necesitamos nueva página
    if (doc.y > 650) {
      doc.addPage();
    }

    doc.fontSize(13).font('Helvetica-Bold')
      .text(this.getElectionTypeLabel(type).toUpperCase(), 50, doc.y + 10);
    
    doc.moveTo(50, doc.y + 5).lineTo(300, doc.y + 5).stroke();
    doc.moveDown();

    for (const election of elections) {
      if (doc.y > 680) {
        doc.addPage();
      }

      const title = this.getElectionTitle(election);
      
      if (type !== 'PERSONERO' && type !== 'CONTRALOR') {
        doc.fontSize(11).font('Helvetica-Bold')
          .text(title, 50, doc.y + 5);
      }

      doc.fontSize(10).font('Helvetica')
        .text(`Total votos: ${election._count?.votes || 0}`, 50, doc.y + 3);

      // Mostrar top 3 resultados
      const results = election.results?.slice(0, 3) || [];
      for (const result of results) {
        const name = result.candidate 
          ? `${result.candidate.student.firstName} ${result.candidate.student.lastName}`
          : 'Voto en Blanco';
        const winner = result.isWinner ? ' ★ GANADOR' : '';
        
        doc.fontSize(10)
          .font(result.isWinner ? 'Helvetica-Bold' : 'Helvetica')
          .text(`  ${result.position}° ${name}: ${result.votes} votos (${result.percentage.toFixed(1)}%)${winner}`, 60, doc.y + 2);
      }

      doc.moveDown();
    }

    doc.moveDown();
  }

  private drawResultsTable(doc: PDFKit.PDFDocument, results: any[], totalVotes: number) {
    const tableTop = doc.y;
    const col1 = 50;
    const col2 = 80;
    const col3 = 350;
    const col4 = 420;
    const col5 = 490;

    // Header
    doc.fontSize(10).font('Helvetica-Bold')
      .text('Pos.', col1, tableTop)
      .text('Candidato', col2, tableTop)
      .text('Votos', col3, tableTop)
      .text('%', col4, tableTop)
      .text('Estado', col5, tableTop);

    doc.moveTo(50, tableTop + 15).lineTo(562, tableTop + 15).stroke();

    let y = tableTop + 25;
    for (const result of results) {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      const name = result.candidate 
        ? `${result.candidate.student.firstName} ${result.candidate.student.lastName}`
        : 'Voto en Blanco';

      doc.fontSize(10)
        .font(result.isWinner ? 'Helvetica-Bold' : 'Helvetica')
        .text(result.position.toString(), col1, y)
        .text(name, col2, y)
        .text(result.votes.toString(), col3, y)
        .text(`${result.percentage.toFixed(1)}%`, col4, y)
        .text(result.isWinner ? 'GANADOR' : '', col5, y);

      y += 18;
    }

    doc.y = y + 10;
  }

  private drawBarChart(doc: PDFKit.PDFDocument, results: any[]) {
    if (doc.y > 550) {
      doc.addPage();
    }

    doc.fontSize(12).font('Helvetica-Bold')
      .text('DISTRIBUCIÓN DE VOTOS', 50, doc.y);

    doc.moveDown();

    const chartTop = doc.y;
    const barHeight = 20;
    const maxWidth = 300;
    const maxPercentage = Math.max(...results.map(r => r.percentage), 1);

    results.slice(0, 5).forEach((result, index) => {
      const y = chartTop + (index * (barHeight + 10));
      const barWidth = (result.percentage / maxPercentage) * maxWidth;

      // Nombre
      const name = result.candidate 
        ? `${result.candidate.student.firstName.charAt(0)}. ${result.candidate.student.lastName}`
        : 'Blanco';
      
      doc.fontSize(9).font('Helvetica')
        .text(name, 50, y + 5, { width: 100 });

      // Barra
      doc.rect(160, y, barWidth, barHeight)
        .fill(result.isWinner ? '#22c55e' : '#3b82f6');

      // Porcentaje
      doc.fontSize(9).font('Helvetica').fillColor('black')
        .text(`${result.percentage.toFixed(1)}%`, 470, y + 5);
    });

    doc.y = chartTop + (results.slice(0, 5).length * (barHeight + 10)) + 20;
  }

  private drawParticipationTable(doc: PDFKit.PDFDocument, data: any[]) {
    const tableTop = doc.y;
    const col1 = 50;
    const col2 = 200;
    const col3 = 300;
    const col4 = 400;

    // Header
    doc.fontSize(10).font('Helvetica-Bold')
      .text('Grado', col1, tableTop)
      .text('Habilitados', col2, tableTop)
      .text('Votaron', col3, tableTop)
      .text('Participación', col4, tableTop);

    doc.moveTo(50, tableTop + 15).lineTo(500, tableTop + 15).stroke();

    let y = tableTop + 25;
    for (const row of data) {
      doc.fontSize(10).font('Helvetica')
        .text(row.grade, col1, y)
        .text(row.total.toString(), col2, y)
        .text(row.voted.toString(), col3, y)
        .text(`${row.percentage.toFixed(1)}%`, col4, y);

      y += 18;
    }

    doc.y = y + 10;
  }

  private async getParticipationByGrade(processId: string, institutionId: string): Promise<Array<{ grade: string; total: number; voted: number; percentage: number }>> {
    const grades = await this.prisma.grade.findMany({
      orderBy: [{ stage: 'asc' }, { number: 'asc' }],
    });

    const result: Array<{ grade: string; total: number; voted: number; percentage: number }> = [];

    for (const grade of grades) {
      // Estudiantes habilitados en este grado
      const totalStudents = await this.prisma.studentEnrollment.count({
        where: {
          status: 'ACTIVE',
          group: {
            gradeId: grade.id,
            campus: { institutionId },
          },
        },
      });

      if (totalStudents === 0) continue;

      // Estudiantes que votaron
      const voters = await this.prisma.vote.findMany({
        where: {
          election: { electionProcessId: processId },
          voter: {
            enrollments: {
              some: {
                status: 'ACTIVE',
                group: { gradeId: grade.id },
              },
            },
          },
        },
        select: { voterId: true },
        distinct: ['voterId'],
      });

      result.push({
        grade: grade.name,
        total: totalStudents,
        voted: voters.length,
        percentage: totalStudents > 0 ? (voters.length / totalStudents) * 100 : 0,
      });
    }

    return result;
  }

  private drawSignatures(doc: PDFKit.PDFDocument) {
    if (doc.y > 650) {
      doc.addPage();
    }

    doc.moveDown(3);

    const y = doc.y + 30;
    
    // Líneas de firma
    doc.moveTo(80, y).lineTo(250, y).stroke();
    doc.moveTo(320, y).lineTo(490, y).stroke();

    doc.fontSize(10).font('Helvetica')
      .text('Coordinador(a)', 120, y + 5)
      .text('Rector(a)', 380, y + 5);

    doc.moveDown(3);

    // Pie de página
    doc.fontSize(8).font('Helvetica')
      .text(
        `Documento generado el ${new Date().toLocaleDateString('es-CO', { 
          year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
        })}`,
        50, 750, { width: 512, align: 'center' }
      );
  }
}
