import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PerformanceLevel, PreventiveAlertStatus, type Prisma } from '@prisma/client';
import PDFDocument from 'pdfkit';
import * as http from 'http';
import * as https from 'https';

import { PrismaService } from '../../prisma/prisma.service';
import { ExecutePreventiveCutDto } from './dto/execute-preventive-cut.dto';
import { UpsertPreventiveCutConfigDto } from './dto/upsert-preventive-cut-config.dto';
import { UpdatePreventiveAlertDto } from './dto/update-preventive-alert.dto';
import { StudentGradesService } from './student-grades.service';
import { SupabaseStorageService } from '../storage/supabase-storage.service';

// Resultado por materia de un estudiante en el corte
interface CutSubjectResult {
  subjectName: string;
  grade: number | null;
  isRisk: boolean;
  hasData: boolean;
}

// Consolidado por estudiante
interface CutStudentResult {
  studentEnrollmentId: string;
  name: string;
  subjects: CutSubjectResult[];
  average: number | null;
  atRiskCount: number;
  overallRisk: boolean;
}

export interface GroupCutResult {
  cutoffDate: Date;
  threshold: number;
  institution: { id: string; name: string; logo?: string | null; primaryColor?: string | null };
  group: { id: string; name: string; gradeName: string };
  term: { id: string; name: string };
  subjectNames: string[];
  students: CutStudentResult[];
  totalStudents: number;
  atRiskStudents: number;
}

@Injectable()
export class PreventiveCutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentGradesService: StudentGradesService,
    private readonly storageService: SupabaseStorageService,
  ) {}

  private async termInScope(
    institutionId: string,
    academicTermId: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const term = await db.academicTerm.findFirst({
      where: { id: academicTermId, academicYear: { institutionId } },
      include: { academicYear: { include: { institution: true } } },
    });
    if (!term) throw new NotFoundException('Período académico no encontrado');
    return term;
  }

  private async groupInScope(
    institutionId: string,
    groupId: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const group = await db.group.findFirst({
      where: {
        id: groupId,
        campus: { institutionId },
        grade: { institutionId },
      },
      include: { grade: true },
    });
    if (!group) throw new NotFoundException('Grupo no encontrado');
    return group;
  }

  private async assignmentInScope(
    institutionId: string,
    teacherAssignmentId: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const assignment = await db.teacherAssignment.findFirst({
      where: {
        id: teacherAssignmentId,
        institutionId,
        academicYear: { institutionId },
        group: { campus: { institutionId }, grade: { institutionId } },
        subject: { area: { institutionId } },
      },
      include: { academicYear: true },
    });
    if (!assignment) throw new NotFoundException('Asignación docente no encontrada');
    return assignment;
  }

  private async enrollmentInScope(
    institutionId: string,
    studentEnrollmentId: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const enrollment = await db.studentEnrollment.findFirst({
      where: {
        id: studentEnrollmentId,
        institutionId,
        academicYear: { institutionId },
        group: { campus: { institutionId }, grade: { institutionId } },
        student: { institutionId },
      },
      select: { id: true, academicYearId: true, groupId: true },
    });
    if (!enrollment) throw new NotFoundException('Matrícula no encontrada');
    return enrollment;
  }

  private validDate(value: Date | undefined, label: string): Date | undefined {
    if (value === undefined) return undefined;
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      throw new BadRequestException(`${label} inválida`);
    }
    return value;
  }

  private validThreshold(value: number | undefined): number | undefined {
    if (value === undefined) return undefined;
    if (!Number.isFinite(value) || value < 1 || value > 5) {
      throw new BadRequestException('El umbral debe estar entre 1.0 y 5.0');
    }
    return value;
  }

  async upsertConfig(institutionId: string, dto: UpsertPreventiveCutConfigDto) {
    await this.termInScope(institutionId, dto.academicTermId);
    const cutoffDate = this.validDate(dto.cutoffDate, 'Fecha de corte')!;
    const riskThresholdScore = this.validThreshold(dto.riskThresholdScore)!;
    return this.prisma.preventiveCutConfig.upsert({
      where: { academicTermId: dto.academicTermId },
      update: {
        cutoffDate,
        riskThresholdScore,
      },
      create: {
        academicTermId: dto.academicTermId,
        cutoffDate,
        riskThresholdScore,
      },
    });
  }

  async getConfig(institutionId: string, academicTermId: string) {
    await this.termInScope(institutionId, academicTermId);
    return this.prisma.preventiveCutConfig.findFirst({
      where: { academicTermId, academicTerm: { academicYear: { institutionId } } },
    });
  }

  async listAlerts(institutionId: string, params: {
    teacherAssignmentId?: string;
    academicTermId?: string;
    studentEnrollmentId?: string;
    status?: PreventiveAlertStatus;
  }) {
    if (params.status && !Object.values(PreventiveAlertStatus).includes(params.status)) {
      throw new BadRequestException('Estado de alerta inválido');
    }
    await Promise.all([
      params.teacherAssignmentId
        ? this.assignmentInScope(institutionId, params.teacherAssignmentId)
        : Promise.resolve(),
      params.academicTermId ? this.termInScope(institutionId, params.academicTermId) : Promise.resolve(),
      params.studentEnrollmentId
        ? this.enrollmentInScope(institutionId, params.studentEnrollmentId)
        : Promise.resolve(),
    ]);
    return this.prisma.preventiveAlert.findMany({
      where: {
        institutionId,
        teacherAssignmentId: params.teacherAssignmentId,
        academicTermId: params.academicTermId,
        studentEnrollmentId: params.studentEnrollmentId,
        status: params.status,
        teacherAssignment: { institutionId, academicYear: { institutionId } },
        studentEnrollment: { institutionId, academicYear: { institutionId }, student: { institutionId } },
        academicTerm: { academicYear: { institutionId } },
      },
      include: {
        studentEnrollment: {
          include: {
            student: true,
          },
        },
        teacherAssignment: {
          include: {
            subject: true,
            group: true,
          },
        },
        academicTerm: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateAlert(institutionId: string, id: string, dto: UpdatePreventiveAlertDto) {
    return this.prisma.$transaction(async (tx) => {
      const alert = await tx.preventiveAlert.findFirst({
        where: {
          id,
          institutionId,
          teacherAssignment: { institutionId, academicYear: { institutionId } },
          studentEnrollment: { institutionId, academicYear: { institutionId }, student: { institutionId } },
          academicTerm: { academicYear: { institutionId } },
        },
        select: { id: true },
      });
      if (!alert) throw new NotFoundException('Alerta preventiva no encontrada');
      const updated = await tx.preventiveAlert.updateMany({
        where: { id, institutionId },
        data: {
          status: dto.status as any,
          recoveryPlan: dto.recoveryPlan,
          meetingAt: dto.meetingAt,
          notes: dto.notes,
        },
      });
      if (updated.count === 0) throw new NotFoundException('Alerta preventiva no encontrada');
      return tx.preventiveAlert.findFirst({ where: { id, institutionId } });
    });
  }

  async execute(institutionId: string, dto: ExecutePreventiveCutDto) {
    const teacherAssignment = await this.assignmentInScope(institutionId, dto.teacherAssignmentId);
    const term = await this.termInScope(institutionId, dto.academicTermId);
    if (term.academicYearId !== teacherAssignment.academicYearId) {
      throw new NotFoundException('Período académico no encontrado');
    }

    const config = await this.prisma.preventiveCutConfig.findFirst({
      where: { academicTermId: dto.academicTermId, academicTerm: { academicYear: { institutionId } } },
    });

    if (!config && !dto.cutoffDate) {
      throw new BadRequestException(
        'No hay configuración de corte preventivo para el academicTermId y no se envió cutoffDate',
      );
    }

    const cutoffDate = this.validDate(dto.cutoffDate ?? config!.cutoffDate, 'Fecha de corte')!;
    const threshold = this.validThreshold(Number(config?.riskThresholdScore ?? 3.0))!;

    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        institutionId,
        academicYearId: teacherAssignment.academicYearId,
        groupId: teacherAssignment.groupId,
        status: 'ACTIVE',
        academicYear: { institutionId },
        group: { campus: { institutionId }, grade: { institutionId } },
        student: { institutionId },
      },
      include: {
        student: true,
      },
      orderBy: {
        student: { lastName: 'asc' },
      },
    });

    const computed = await Promise.all(
      enrollments.map(async (enrollment) => {
        const termGrade = await this.studentGradesService.calculateTermGradeAtDate(
          enrollment.id,
          teacherAssignment.id,
          dto.academicTermId,
          cutoffDate,
          institutionId,
        );

        const computedGrade = termGrade.grade;
        const isRisk = computedGrade === null || computedGrade < threshold;

        let performanceLevel: PerformanceLevel | null = null;
        if (computedGrade !== null) {
          const scale = await this.prisma.performanceScale.findFirst({
            where: {
              institutionId,
              minScore: { lte: computedGrade },
              maxScore: { gte: computedGrade },
            },
          });
          performanceLevel = scale?.level ?? null;
        }

        const nextStatus: PreventiveAlertStatus = isRisk
          ? PreventiveAlertStatus.OPEN
          : PreventiveAlertStatus.RESOLVED;

        return { enrollment, computedGrade, performanceLevel, nextStatus };
      }),
    );

    // El lote se confirma completo o no se confirma: un fallo en un estudiante no deja un corte
    // parcialmente actualizado. Las coordenadas se revalidan dentro de la misma transacción.
    const alerts = await this.prisma.$transaction(async (tx) => {
      const [scopedAssignment, scopedTerm] = await Promise.all([
        this.assignmentInScope(institutionId, teacherAssignment.id, tx),
        this.termInScope(institutionId, dto.academicTermId, tx),
      ]);
      if (scopedTerm.academicYearId !== scopedAssignment.academicYearId) {
        throw new NotFoundException('Período académico no encontrado');
      }

      const persisted: any[] = [];
      for (const item of computed) {
        const scopedEnrollment = await this.enrollmentInScope(institutionId, item.enrollment.id, tx);
        if (
          scopedEnrollment.academicYearId !== scopedAssignment.academicYearId ||
          scopedEnrollment.groupId !== scopedAssignment.groupId
        ) {
          throw new NotFoundException('Matrícula no encontrada');
        }
          const existing = await tx.preventiveAlert.findFirst({
            where: {
              institutionId,
              teacherAssignmentId: teacherAssignment.id,
              studentEnrollmentId: item.enrollment.id,
              academicTermId: dto.academicTermId,
            },
          });
          const statusToPersist = existing?.status === PreventiveAlertStatus.IN_RECOVERY
            ? existing.status
            : item.nextStatus;
          const data = {
            cutoffDate,
            computedGrade: item.computedGrade === null ? null : item.computedGrade,
            performanceLevel: item.performanceLevel,
            status: statusToPersist,
          };
          if (existing) {
            const updated = await tx.preventiveAlert.updateMany({
              where: { id: existing.id, institutionId },
              data,
            });
            if (updated.count === 0) throw new NotFoundException('Alerta preventiva no encontrada');
            persisted.push({ ...existing, ...data });
            continue;
          }
          persisted.push(await tx.preventiveAlert.create({
            data: {
              institutionId,
              teacherAssignmentId: teacherAssignment.id,
              studentEnrollmentId: item.enrollment.id,
              academicTermId: dto.academicTermId,
              ...data,
            },
          }));
      }
      return persisted;
    });

    const inRisk = alerts.filter((a) => a.status !== PreventiveAlertStatus.RESOLVED);

    return {
      cutoffDate,
      threshold,
      totalStudents: alerts.length,
      atRisk: inRisk.length,
      alerts,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CORTE PREVENTIVO CONSOLIDADO POR GRUPO (solo lectura, no persiste)
  // Calcula la nota parcial de cada estudiante en TODAS las materias del grupo
  // a una fecha de corte. Pensado para revisar "cómo va" el grupo antes de
  // cerrar el período y poder entregar/descargar un PDF.
  // ═══════════════════════════════════════════════════════════════════════════

  async executeGroupView(institutionId: string, params: {
    academicTermId: string;
    groupId: string;
    cutoffDate?: Date;
    threshold?: number;
  }): Promise<GroupCutResult> {
    const term = await this.termInScope(institutionId, params.academicTermId);
    const group = await this.groupInScope(institutionId, params.groupId);

    const config = await this.prisma.preventiveCutConfig.findFirst({
      where: {
        academicTermId: params.academicTermId,
        academicTerm: { academicYear: { institutionId } },
      },
    });

    const cutoffDate = this.validDate(params.cutoffDate ?? config?.cutoffDate ?? new Date(), 'Fecha de corte')!;
    const threshold = this.validThreshold(Number(params.threshold ?? config?.riskThresholdScore ?? 3.0))!;

    const assignments = await this.prisma.teacherAssignment.findMany({
      where: {
        institutionId,
        academicYearId: term.academicYearId,
        groupId: params.groupId,
        academicYear: { institutionId },
        group: { campus: { institutionId }, grade: { institutionId } },
        subject: { area: { institutionId } },
      },
      include: { subject: true },
    });

    // Orden estable de materias por nombre
    assignments.sort((a, b) =>
      (a.subject?.name ?? '').localeCompare(b.subject?.name ?? ''),
    );

    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        institutionId,
        academicYearId: term.academicYearId,
        groupId: params.groupId,
        status: 'ACTIVE',
        academicYear: { institutionId },
        group: { campus: { institutionId }, grade: { institutionId } },
        student: { institutionId },
      },
      include: { student: true },
      orderBy: { student: { lastName: 'asc' } },
    });

    const students: CutStudentResult[] = await Promise.all(
      enrollments.map(async (enr) => {
        const subjects: CutSubjectResult[] = await Promise.all(
          assignments.map(async (a) => {
            const res = await this.studentGradesService.calculateTermGradeAtDate(
              enr.id,
              a.id,
              params.academicTermId,
              cutoffDate,
              institutionId,
            );
            const grade = res.grade;
            // Una materia sin actividades calificadas aún NO es "en riesgo":
            // es "sin datos". Evita falsas alarmas al inicio del período.
            const hasData = grade !== null;
            return {
              subjectName: a.subject?.name ?? 'Asignatura',
              grade,
              hasData,
              isRisk: hasData && (grade as number) < threshold,
            };
          }),
        );

        const graded = subjects.filter((s) => s.hasData);
        const average =
          graded.length > 0
            ? Math.round(
                (graded.reduce((acc, s) => acc + (s.grade as number), 0) /
                  graded.length) *
                  10,
              ) / 10
            : null;
        const atRiskCount = subjects.filter((s) => s.isRisk).length;

        const s = enr.student;
        const name = [s?.lastName, s?.secondLastName, s?.firstName, s?.secondName]
          .filter(Boolean)
          .join(' ')
          .toUpperCase();

        return {
          studentEnrollmentId: enr.id,
          name: name || 'Estudiante',
          subjects,
          average,
          atRiskCount,
          overallRisk: atRiskCount > 0,
        };
      }),
    );

    return {
      cutoffDate,
      threshold,
      institution: {
        id: term.academicYear.institution.id,
        name: term.academicYear.institution.name,
        logo: (term.academicYear.institution as any).logo ?? null,
        primaryColor: (term.academicYear.institution as any).primaryColor ?? null,
      },
      group: { id: group.id, name: group.name, gradeName: group.grade?.name ?? '' },
      term: { id: term.id, name: term.name },
      subjectNames: assignments.map((a) => a.subject?.name ?? 'Asignatura'),
      students,
      totalStudents: students.length,
      atRiskStudents: students.filter((s) => s.overallRisk).length,
    };
  }

  // ── PDF: consolidado del grupo ──────────────────────────────────────────────
  async generateGroupPdf(institutionId: string, params: {
    academicTermId: string;
    groupId: string;
    cutoffDate?: Date;
    threshold?: number;
    showGrades?: boolean; // false = "sin notas" (marca X en materias en riesgo)
  }): Promise<Buffer> {
    const data = await this.executeGroupView(institutionId, params);
    const showGrades = params.showGrades !== false;
    const brand = this.brandColor(data.institution.primaryColor);
    const logo = await this.resolveLogoBuffer(data.institution.logo);

    return this.buildPdf((doc, m, w) => {
      this.renderHeader(
        doc,
        m,
        w,
        data.institution.name,
        'CORTE PREVENTIVO — INFORME DE GRUPO',
        brand,
        logo,
      );
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#444')
        .text(
          `Grupo: ${data.group.gradeName} ${data.group.name}   |   Período: ${data.term.name}   |   ` +
            `Fecha de corte: ${this.fmtDate(data.cutoffDate)}   |   Umbral de riesgo: ${data.threshold.toFixed(1)}`,
          m,
          doc.y,
          { width: w },
        );
      doc.moveDown(0.4);
      doc
        .fontSize(9)
        .fillColor('#b91c1c')
        .text(
          `Estudiantes en riesgo: ${data.atRiskStudents} de ${data.totalStudents}`,
          m,
          doc.y,
          { width: w },
        );
      doc.moveDown(0.6);
      doc.fillColor('#000');

      const nameW = w * 0.34;
      const avgW = w * 0.12;
      const riskW = w * 0.18;
      const subjW = w * 0.36;

      const renderRowHeader = () => {
        const y = doc.y;
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#000');
        doc.text('#', m, y, { width: 22 });
        doc.text('Estudiante', m + 22, y, { width: nameW });
        doc.text(showGrades ? 'Prom. parcial' : 'Riesgo', m + 22 + nameW, y, { width: avgW, align: 'center' });
        doc.text('Materias en riesgo', m + 22 + nameW + avgW, y, { width: riskW, align: 'center' });
        doc.text('Detalle', m + 22 + nameW + avgW + riskW, y, { width: subjW });
        doc.moveDown(0.3);
        doc.moveTo(m, doc.y).lineTo(m + w, doc.y).strokeColor('#ccc').stroke();
        doc.moveDown(0.2);
      };

      renderRowHeader();

      data.students.forEach((st, i) => {
        if (doc.y > 740) {
          doc.addPage();
          renderRowHeader();
        }
        const y = doc.y;
        const riskSubjects = st.subjects.filter((s) => s.isRisk);
        const detail =
          riskSubjects.length > 0
            ? riskSubjects
                .map((s) => (showGrades ? `${s.subjectName} (${s.grade?.toFixed(1)})` : s.subjectName))
                .join(', ')
            : '—';

        doc.fontSize(7.5).font('Helvetica').fillColor(st.overallRisk ? '#b91c1c' : '#000');
        doc.text(String(i + 1), m, y, { width: 22 });
        doc.text(st.name, m + 22, y, { width: nameW });
        doc.text(showGrades ? (st.average !== null ? st.average.toFixed(1) : 's/d') : (st.overallRisk ? 'X' : '—'), m + 22 + nameW, y, { width: avgW, align: 'center' });
        doc.text(String(st.atRiskCount), m + 22 + nameW + avgW, y, { width: riskW, align: 'center' });
        doc.fontSize(6.8).fillColor('#555');
        doc.text(detail, m + 22 + nameW + avgW + riskW, y, { width: subjW });
        doc.fillColor('#000');
        doc.moveDown(0.5);
      });
    });
  }

  // ── PDF: detalle de un estudiante (para entregar al acudiente) ──────────────
  async generateStudentPdf(institutionId: string, params: {
    academicTermId: string;
    groupId: string;
    studentEnrollmentId: string;
    cutoffDate?: Date;
    threshold?: number;
    showGrades?: boolean; // false = "sin notas" (marca X en materias en riesgo)
  }): Promise<Buffer> {
    await this.enrollmentInScope(institutionId, params.studentEnrollmentId);
    const data = await this.executeGroupView(institutionId, params);
    const student = data.students.find(
      (s) => s.studentEnrollmentId === params.studentEnrollmentId,
    );
    if (!student) throw new NotFoundException('Estudiante no encontrado en el grupo');
    const showGrades = params.showGrades !== false;
    const brand = this.brandColor(data.institution.primaryColor);
    const logo = await this.resolveLogoBuffer(data.institution.logo);

    return this.buildPdf((doc, m, w) => {
      this.renderHeader(
        doc,
        m,
        w,
        data.institution.name,
        'CORTE PREVENTIVO — INFORME DEL ESTUDIANTE',
        brand,
        logo,
      );
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#000').text(student.name, m, doc.y, { width: w });
      doc.moveDown(0.2);
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#444')
        .text(
          `${data.group.gradeName} ${data.group.name}   |   Período: ${data.term.name}   |   Corte: ${this.fmtDate(data.cutoffDate)}`,
          m,
          doc.y,
          { width: w },
        );
      doc.moveDown(0.8);
      doc.fillColor('#000');

      // Tabla de materias
      const subjW = w * 0.62;
      const gradeW = w * 0.18;
      const statW = w * 0.20;

      const header = () => {
        const y = doc.y;
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('Asignatura', m, y, { width: subjW });
        doc.text(showGrades ? 'Nota parcial' : 'Riesgo', m + subjW, y, { width: gradeW, align: 'center' });
        doc.text('Estado', m + subjW + gradeW, y, { width: statW, align: 'center' });
        doc.moveDown(0.3);
        doc.moveTo(m, doc.y).lineTo(m + w, doc.y).strokeColor('#ccc').stroke();
        doc.moveDown(0.25);
      };
      header();

      student.subjects.forEach((s) => {
        if (doc.y > 740) { doc.addPage(); header(); }
        const y = doc.y;
        const status = !s.hasData ? 'Sin datos' : s.isRisk ? 'En riesgo' : 'Al día';
        const color = !s.hasData ? '#888' : s.isRisk ? '#b91c1c' : '#15803d';
        const notaCell = showGrades
          ? (s.hasData ? (s.grade as number).toFixed(1) : 's/d')
          : (!s.hasData ? 's/d' : s.isRisk ? 'X' : '—');
        doc.fontSize(9).font('Helvetica').fillColor(showGrades ? '#000' : color);
        doc.text(s.subjectName, m, y, { width: subjW });
        doc.text(notaCell, m + subjW, y, { width: gradeW, align: 'center' });
        doc.fillColor(color).font('Helvetica-Bold');
        doc.text(status, m + subjW + gradeW, y, { width: statW, align: 'center' });
        doc.fillColor('#000');
        doc.moveDown(0.5);
      });

      doc.moveDown(0.8);
      doc.moveTo(m, doc.y).lineTo(m + w, doc.y).strokeColor('#ccc').stroke();
      doc.moveDown(0.4);
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#000');
      doc.text(
        (showGrades
          ? `Promedio parcial: ${student.average !== null ? student.average.toFixed(1) : 'sin datos'}   |   `
          : '') + `Materias en riesgo: ${student.atRiskCount}`,
        m,
        doc.y,
        { width: w },
      );
      doc.moveDown(1.2);
      doc.fontSize(7.5).font('Helvetica-Oblique').fillColor('#777');
      doc.text(
        'Este es un corte preventivo informativo generado antes del cierre del período. ' +
          'Las notas son parciales y pueden variar hasta el cierre oficial.',
        m,
        doc.y,
        { width: w },
      );
    });
  }

  // ── Helpers de PDF (self-contained, mismo estilo que AcademicPdfService) ────
  private fmtDate(d: Date): string {
    return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  private buildPdf(render: (doc: PDFKit.PDFDocument, margin: number, width: number) => void): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        const chunks: Buffer[] = [];
        doc.on('data', (c) => chunks.push(c as Buffer));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        const margin = 40;
        const width = doc.page.width - margin * 2;
        render(doc, margin, width);
        doc.end();
      } catch (e) {
        reject(e);
      }
    });
  }

  private renderHeader(
    doc: PDFKit.PDFDocument,
    m: number,
    w: number,
    institutionName: string,
    title: string,
    brand: string = '#4338ca',
    logo: Buffer | null = null,
  ) {
    const startY = doc.y;
    let textX = m;
    let textW = w;
    const align: 'left' | 'center' = logo ? 'left' : 'center';
    if (logo) {
      try {
        doc.image(logo, m, startY, { fit: [46, 46] });
        textX = m + 56;
        textW = w - 56;
      } catch {
        // logo inválido → seguir sin él
      }
    }
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#1e293b').text(institutionName, textX, startY, { width: textW, align });
    doc.moveDown(0.2);
    doc.fontSize(11).font('Helvetica-Bold').fillColor(brand).text(title, textX, doc.y, { width: textW, align });
    const lineY = Math.max(doc.y + 4, logo ? startY + 50 : doc.y + 4);
    doc.moveTo(m, lineY).lineTo(m + w, lineY).strokeColor(brand).lineWidth(1).stroke();
    doc.y = lineY;
    doc.moveDown(0.6);
    doc.fillColor('#000').lineWidth(1);
  }

  // ── Branding institucional (fuente única: perfil de la institución) ─────────
  private brandColor(hex?: string | null): string {
    return hex && /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#4338ca';
  }

  private async resolveLogoBuffer(logo?: string | null): Promise<Buffer | null> {
    if (!logo) return null;
    let url = logo;
    if (!/^https?:\/\//i.test(logo)) {
      try {
        url = await this.storageService.resolveFileUrl(logo, 600);
      } catch {
        return null;
      }
    }
    return this.fetchImage(url);
  }

  private fetchImage(url: string): Promise<Buffer | null> {
    return new Promise((resolve) => {
      try {
        const client = url.startsWith('https') ? https : http;
        client
          .get(url, (res) => {
            if (res.statusCode !== 200) {
              resolve(null);
              return;
            }
            const chunks: Buffer[] = [];
            res.on('data', (c) => chunks.push(c as Buffer));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', () => resolve(null));
          })
          .on('error', () => resolve(null));
      } catch {
        resolve(null);
      }
    });
  }
}
