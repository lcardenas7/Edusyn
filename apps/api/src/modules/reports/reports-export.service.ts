/**
 * REPORTS EXPORT SERVICE
 *
 * Genera exportaciones Excel para reportes académicos.
 * La lógica de datos viene de ReportsService / AcademicDataSourceService; aquí solo se
 * arman columnas + filas y se delega el FORMATO al helper compartido writeReportSheet
 * (título, encabezado, bordes, panel congelado, autofiltro, cebra, resaltado de reprobados).
 *
 * Exportaciones:
 *   1. Sábana académica consolidada (grupo × período)
 *   2. Distribución de desempeño
 *   3. Rendimiento por docente
 *   4. Ranking de estudiantes
 *   5. Asignaturas reprobadas
 *   6. Listado de recuperación
 *   7. Proyección de promoción
 */

import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

import { PrismaService } from '../../prisma/prisma.service';
import { ReportsService } from './reports.service';
import { AcademicDataSourceService, type ReportMode } from './academic-data-source.service';
import { AcademicYearLifecycleService } from '../academic/academic-year-lifecycle.service';
import { writeReportSheet, type ExcelColumn } from './excel-report.helper';

@Injectable()
export class ReportsExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reportsService: ReportsService,
    private readonly academicDataSource: AcademicDataSourceService,
    private readonly academicYearService: AcademicYearLifecycleService,
  ) {}

  private async instName(institutionId: string): Promise<string | undefined> {
    const inst = await this.prisma.institution.findUnique({ where: { id: institutionId }, select: { name: true } });
    return inst?.name ?? undefined;
  }

  /** Umbral aprobatorio del nivel del grupo (para resaltar reprobados). */
  private async passingForGroup(institutionId: string, groupId: string): Promise<number> {
    const grp = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { grade: { select: { stage: true, name: true } } },
    });
    return this.academicYearService.getPassingGrade(institutionId, {
      stage: grp?.grade?.stage,
      gradeName: grp?.grade?.name,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. SÁBANA ACADÉMICA CONSOLIDADA
  // ═══════════════════════════════════════════════════════════════════════════

  async exportConsolidatedGradeSheet(
    institutionId: string,
    academicYearId: string,
    groupId: string,
    termId?: string,
    reportMode?: ReportMode,
  ): Promise<ExcelJS.Workbook> {
    const { grades } = await this.academicDataSource.getTermGradeData({ institutionId, academicYearId, groupId, termId, reportMode });

    const subjectMap = new Map<string, string>();
    const studentMap = new Map<string, { name: string }>();
    const termSet = new Map<string, { name: string; order: number }>();
    for (const g of grades) {
      subjectMap.set(g.subjectId, g.subjectName);
      if (!studentMap.has(g.studentEnrollmentId)) studentMap.set(g.studentEnrollmentId, { name: g.studentFullName || `${g.studentLastName} ${g.studentFirstName}` });
      if (!termSet.has(g.academicTermId)) termSet.set(g.academicTermId, { name: g.termName, order: g.termOrder });
    }

    const subjects = Array.from(subjectMap.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    const students = Array.from(studentMap.entries()).map(([id, info]) => ({ id, ...info })).sort((a, b) => a.name.localeCompare(b.name));
    const terms = Array.from(termSet.entries()).map(([id, info]) => ({ id, ...info })).sort((a, b) => a.order - b.order);

    const gradeIndex = new Map<string, number>();
    for (const g of grades) gradeIndex.set(`${g.studentEnrollmentId}:${g.subjectId}:${g.academicTermId}`, g.finalScore);

    const passingGrade = await this.passingForGroup(institutionId, groupId);

    // Columnas
    const columns: ExcelColumn[] = [
      { header: '#', width: 6, align: 'center' },
      { header: 'Estudiante', width: 32 },
    ];
    const multiTerm = terms.length > 1;
    for (const subj of subjects) {
      if (multiTerm) for (const term of terms) columns.push({ header: `${subj.name} (${term.name})`, width: 12, numFmt: '0.0', isGrade: true });
      else columns.push({ header: subj.name, width: 12, numFmt: '0.0', isGrade: true });
    }
    columns.push({ header: 'Promedio General', width: 14, numFmt: '0.0', isGrade: true });

    // Filas
    const rows: Array<Array<string | number | null>> = [];
    let n = 1;
    for (const student of students) {
      const row: Array<string | number | null> = [n++, student.name];
      const allScores: number[] = [];
      for (const subj of subjects) {
        const termList = multiTerm ? terms : [terms[0]].filter(Boolean);
        for (const term of termList) {
          const score = term ? gradeIndex.get(`${student.id}:${subj.id}:${term.id}`) : undefined;
          row.push(score !== undefined ? Math.round(score * 10) / 10 : null);
          if (score !== undefined) allScores.push(score);
        }
      }
      row.push(allScores.length > 0 ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10 : null);
      rows.push(row);
    }

    const groupName = grades[0]?.groupName ?? '';
    const periodLabel = terms.length === 1 ? terms[0]?.name : 'Todos los períodos';
    const workbook = new ExcelJS.Workbook();
    writeReportSheet(workbook, {
      sheetName: 'Sábana Académica',
      institutionName: await this.instName(institutionId),
      title: 'Sábana Académica Consolidada',
      subtitle: [groupName, periodLabel].filter(Boolean).join(' · '),
      columns,
      rows,
      failBelow: passingGrade,
      summary: [['Nota mínima aprobatoria', passingGrade], ['Estudiantes', students.length], ['Asignaturas', subjects.length]],
    });
    return workbook;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. DISTRIBUCIÓN DE DESEMPEÑO
  // ═══════════════════════════════════════════════════════════════════════════

  async exportGradeDistribution(institutionId: string, academicYearId: string, groupId: string, subjectId?: string, termId?: string): Promise<ExcelJS.Workbook> {
    const data = await this.reportsService.getGradeDistribution(institutionId, academicYearId, groupId, subjectId, termId);
    const workbook = new ExcelJS.Workbook();
    writeReportSheet(workbook, {
      sheetName: 'Distribución',
      institutionName: await this.instName(institutionId),
      title: 'Distribución de Desempeño',
      columns: [
        { header: 'Rango', width: 20 },
        { header: 'Cantidad', width: 12, align: 'center' },
        { header: 'Porcentaje', width: 14, align: 'center' },
      ],
      rows: data.distribution.map((d: any) => [d.range, d.count, `${d.percentage}%`]),
      summary: [['Total notas', data.totalGrades]],
    });
    return workbook;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. RENDIMIENTO POR DOCENTE
  // ═══════════════════════════════════════════════════════════════════════════

  async exportTeacherPerformance(institutionId: string, academicYearId: string, teacherId?: string): Promise<ExcelJS.Workbook> {
    const data = await this.reportsService.getTeacherPerformance(institutionId, academicYearId, teacherId);
    const workbook = new ExcelJS.Workbook();
    writeReportSheet(workbook, {
      sheetName: 'Rendimiento Docente',
      institutionName: await this.instName(institutionId),
      title: 'Rendimiento por Docente',
      columns: [
        { header: 'Docente', width: 28 },
        { header: 'Asignatura', width: 22 },
        { header: 'Grupo', width: 14 },
        { header: 'Promedio', width: 12, numFmt: '0.0', align: 'center' },
        { header: 'Tasa Aprobación', width: 16, align: 'center' },
        { header: 'Total Estudiantes', width: 16, align: 'center' },
      ],
      rows: data.results.map((r: any) => [
        r.teacherName, r.subjectName, r.groupName,
        r.average ?? null,
        r.approvalRate !== null ? `${r.approvalRate}%` : null,
        r.totalStudents,
      ]),
    });
    return workbook;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. RANKING DE ESTUDIANTES
  // ═══════════════════════════════════════════════════════════════════════════

  async exportStudentRanking(institutionId: string, academicYearId: string, groupId: string, termId?: string): Promise<ExcelJS.Workbook> {
    const data = await this.reportsService.getStudentRanking(institutionId, academicYearId, groupId, termId);
    const passingGrade = await this.passingForGroup(institutionId, groupId);
    const workbook = new ExcelJS.Workbook();
    writeReportSheet(workbook, {
      sheetName: 'Ranking',
      institutionName: await this.instName(institutionId),
      title: 'Ranking de Estudiantes',
      subtitle: data.results[0]?.group ?? '',
      columns: [
        { header: 'Posición', width: 10, align: 'center' },
        { header: 'Estudiante', width: 32 },
        { header: 'Grupo', width: 14 },
        { header: 'Promedio', width: 12, numFmt: '0.0', isGrade: true, align: 'center' },
        { header: 'Asignaturas', width: 12, align: 'center' },
        { header: 'Desempeño', width: 16 },
      ],
      rows: data.results.map((r: any) => [r.position, r.studentName, r.group, r.average, r.subjectCount, r.performance]),
      failBelow: passingGrade,
    });
    return workbook;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. ASIGNATURAS REPROBADAS
  // ═══════════════════════════════════════════════════════════════════════════

  async exportFailedSubjects(institutionId: string, academicYearId: string, groupId: string, termId?: string): Promise<ExcelJS.Workbook> {
    const data = await this.reportsService.getFailedSubjects(institutionId, academicYearId, groupId, termId, {});
    const workbook = new ExcelJS.Workbook();
    writeReportSheet(workbook, {
      sheetName: 'Reprobados',
      institutionName: await this.instName(institutionId),
      title: 'Asignaturas Reprobadas',
      subtitle: `Regla: reprueba por ${data.rule?.officialUnit === 'area' ? 'área' : 'asignatura'}`,
      columns: [
        { header: 'Estudiante', width: 32 },
        { header: 'Grupo', width: 14 },
        { header: 'Asignatura', width: 22 },
        { header: 'Área', width: 20 },
        { header: 'Nota', width: 10, numFmt: '0.0', isGrade: true, align: 'center' },
        { header: 'Período', width: 14 },
        { header: 'Déficit', width: 10, numFmt: '0.0', align: 'center' },
        { header: 'Recuperable', width: 12, align: 'center' },
      ],
      rows: data.results.map((r: any) => [r.studentName, r.group, r.subjectName, r.areaName, r.grade, r.termName, r.deficit, r.recoverable ? 'Sí' : 'No']),
      failBelow: data.passingGrade,
      summary: [
        ['Nota mínima aprobatoria', data.passingGrade],
        ['Total reprobaciones', data.totalFailed],
        ['Estudiantes afectados', data.uniqueStudents],
        ['Asignaturas afectadas', data.uniqueSubjects],
      ],
    });
    return workbook;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. LISTADO DE RECUPERACIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  async exportRecoveryList(institutionId: string, academicYearId: string, groupId: string, termId?: string): Promise<ExcelJS.Workbook> {
    const data = await this.reportsService.getRecoveryList(institutionId, academicYearId, groupId, termId);
    const workbook = new ExcelJS.Workbook();
    writeReportSheet(workbook, {
      sheetName: 'Recuperación',
      institutionName: await this.instName(institutionId),
      title: 'Listado de Recuperación',
      columns: [
        { header: 'Estudiante', width: 32 },
        { header: 'Grupo', width: 14 },
        { header: 'Asignatura', width: 22 },
        { header: 'Nota', width: 10, numFmt: '0.0', isGrade: true, align: 'center' },
        { header: 'Período', width: 14 },
        { header: 'Déficit', width: 10, numFmt: '0.0', align: 'center' },
      ],
      rows: data.results.map((r: any) => [r.studentName, r.group, r.subjectName, r.grade, r.termName, r.deficit]),
      failBelow: data.passingGrade,
      summary: [
        ['Nota mínima aprobatoria', data.passingGrade],
        ['Rango recuperación', `${data.rangeMin} – ${data.rangeMax}`],
        ['Total recuperables', data.totalRecoverable],
      ],
    });
    return workbook;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. PROYECCIÓN DE PROMOCIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  async exportPromotionProjection(institutionId: string, academicYearId: string, groupId: string): Promise<ExcelJS.Workbook> {
    const data = await this.reportsService.getPromotionProjection(institutionId, academicYearId, groupId);
    const workbook = new ExcelJS.Workbook();
    writeReportSheet(workbook, {
      sheetName: 'Proyección Promoción',
      institutionName: await this.instName(institutionId),
      title: 'Proyección de Promoción',
      columns: [
        { header: 'Estudiante', width: 32 },
        { header: 'Grupo', width: 14 },
        { header: 'Total Asignaturas', width: 16, align: 'center' },
        { header: 'Promueve', width: 12, align: 'center' },
        { header: 'En Riesgo', width: 12, align: 'center' },
        { header: 'No Promueve', width: 14, align: 'center' },
        { header: 'Proyección', width: 16 },
      ],
      rows: data.results.map((r: any) => [
        r.studentName, r.group, r.totalSubjects, r.projectedApproved, r.atRisk, r.projectedFailed,
        r.overallProjection === 'PROMUEVE' ? 'Promueve' : r.overallProjection === 'EN_RIESGO' ? 'En riesgo' : 'No promueve',
      ]),
      summary: [
        ['Nota mínima aprobatoria', data.passingGrade],
        ['Períodos completados', `${data.completedTerms} de ${data.totalTerms}`],
        ['Resumen', `Promueven: ${data.summary.promoted} | Riesgo: ${data.summary.atRisk} | No promueven: ${data.summary.notPromoted}`],
      ],
    });
    return workbook;
  }
}
