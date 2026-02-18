/**
 * REPORTS EXPORT SERVICE
 *
 * Genera exportaciones Excel para reportes académicos.
 * Solo se encarga de formateo — toda la lógica de datos viene de ReportsService
 * (que a su vez pasa por AcademicDataSourceService para snapshot/live).
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

import { ReportsService } from './reports.service';
import { AcademicDataSourceService, type GradeRow } from './academic-data-source.service';

@Injectable()
export class ReportsExportService {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly academicDataSource: AcademicDataSourceService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. SÁBANA ACADÉMICA CONSOLIDADA
  // Todos los estudiantes × todas las asignaturas con notas por período
  // ═══════════════════════════════════════════════════════════════════════════

  async exportConsolidatedGradeSheet(
    institutionId: string,
    academicYearId: string,
    groupId: string,
    termId?: string,
  ): Promise<ExcelJS.Workbook> {
    const { grades } = await this.academicDataSource.getTermGradeData({
      institutionId,
      academicYearId,
      groupId,
      termId,
    });

    // Extraer asignaturas únicas (columnas) y estudiantes únicos (filas)
    const subjectMap = new Map<string, string>(); // subjectId → name
    const studentMap = new Map<string, { name: string; doc: string }>(); // enrollmentId → info
    const termSet = new Map<string, { name: string; order: number }>(); // termId → info

    for (const g of grades) {
      subjectMap.set(g.subjectId, g.subjectName);
      if (!studentMap.has(g.studentEnrollmentId)) {
        studentMap.set(g.studentEnrollmentId, {
          name: `${g.studentLastName} ${g.studentFirstName}`,
          doc: '',
        });
      }
      if (!termSet.has(g.academicTermId)) {
        termSet.set(g.academicTermId, { name: g.termName, order: g.termOrder });
      }
    }

    const subjects = Array.from(subjectMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const students = Array.from(studentMap.entries())
      .map(([id, info]) => ({ id, ...info }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const terms = Array.from(termSet.entries())
      .map(([id, info]) => ({ id, ...info }))
      .sort((a, b) => a.order - b.order);

    // Indexar notas: enrollmentId:subjectId:termId → score
    const gradeIndex = new Map<string, number>();
    for (const g of grades) {
      gradeIndex.set(`${g.studentEnrollmentId}:${g.subjectId}:${g.academicTermId}`, g.finalScore);
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sábana Académica');

    // Header row: # | Estudiante | Subj1-T1 | Subj1-T2 | ... | SubjN-T1 | SubjN-T2 | Promedio
    const headerRow: string[] = ['#', 'Estudiante'];
    for (const subj of subjects) {
      if (terms.length > 1) {
        for (const term of terms) {
          headerRow.push(`${subj.name} (${term.name})`);
        }
      } else {
        headerRow.push(subj.name);
      }
    }
    headerRow.push('Promedio General');

    sheet.addRow(headerRow);
    this.styleHeaderRow(sheet, 1);

    // Data rows
    let rowNum = 1;
    for (const student of students) {
      const row: (string | number)[] = [rowNum++, student.name];
      const allScores: number[] = [];

      for (const subj of subjects) {
        if (terms.length > 1) {
          for (const term of terms) {
            const score = gradeIndex.get(`${student.id}:${subj.id}:${term.id}`);
            row.push(score !== undefined ? Math.round(score * 10) / 10 : '');
            if (score !== undefined) allScores.push(score);
          }
        } else {
          const termId = terms[0]?.id;
          const score = termId ? gradeIndex.get(`${student.id}:${subj.id}:${termId}`) : undefined;
          row.push(score !== undefined ? Math.round(score * 10) / 10 : '');
          if (score !== undefined) allScores.push(score);
        }
      }

      const avg = allScores.length > 0
        ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10
        : '';
      row.push(avg);

      sheet.addRow(row);
    }

    // Auto-width columns
    this.autoFitColumns(sheet);

    return workbook;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. DISTRIBUCIÓN DE DESEMPEÑO
  // ═══════════════════════════════════════════════════════════════════════════

  async exportGradeDistribution(
    institutionId: string,
    academicYearId: string,
    groupId: string,
    subjectId?: string,
    termId?: string,
  ): Promise<ExcelJS.Workbook> {
    const data = await this.reportsService.getGradeDistribution(
      institutionId, academicYearId, groupId, subjectId, termId,
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Distribución');

    sheet.addRow(['Rango', 'Cantidad', 'Porcentaje']);
    this.styleHeaderRow(sheet, 1);

    for (const d of data.distribution) {
      sheet.addRow([d.range, d.count, `${d.percentage}%`]);
    }

    sheet.addRow([]);
    sheet.addRow(['Total notas', data.totalGrades]);

    this.autoFitColumns(sheet);
    return workbook;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. RENDIMIENTO POR DOCENTE
  // ═══════════════════════════════════════════════════════════════════════════

  async exportTeacherPerformance(
    institutionId: string,
    academicYearId: string,
    teacherId?: string,
  ): Promise<ExcelJS.Workbook> {
    const data = await this.reportsService.getTeacherPerformance(
      institutionId, academicYearId, teacherId,
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Rendimiento Docente');

    sheet.addRow(['Docente', 'Asignatura', 'Grupo', 'Promedio', 'Tasa Aprobación', 'Total Estudiantes']);
    this.styleHeaderRow(sheet, 1);

    for (const r of data.results) {
      sheet.addRow([
        r.teacherName,
        r.subjectName,
        r.groupName,
        r.average ?? '',
        r.approvalRate !== null ? `${r.approvalRate}%` : '',
        r.totalStudents,
      ]);
    }

    this.autoFitColumns(sheet);
    return workbook;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. RANKING DE ESTUDIANTES
  // ═══════════════════════════════════════════════════════════════════════════

  async exportStudentRanking(
    institutionId: string,
    academicYearId: string,
    groupId: string,
    termId?: string,
  ): Promise<ExcelJS.Workbook> {
    const data = await this.reportsService.getStudentRanking(
      institutionId, academicYearId, groupId, termId,
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Ranking');

    sheet.addRow(['Posición', 'Estudiante', 'Grupo', 'Promedio', 'Asignaturas', 'Desempeño']);
    this.styleHeaderRow(sheet, 1);

    for (const r of data.results) {
      sheet.addRow([
        r.position,
        r.studentName,
        r.group,
        r.average,
        r.subjectCount,
        r.performance,
      ]);
    }

    this.autoFitColumns(sheet);
    return workbook;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. ASIGNATURAS REPROBADAS
  // ═══════════════════════════════════════════════════════════════════════════

  async exportFailedSubjects(
    institutionId: string,
    academicYearId: string,
    groupId: string,
    termId?: string,
  ): Promise<ExcelJS.Workbook> {
    const data = await this.reportsService.getFailedSubjects(
      institutionId, academicYearId, groupId, termId,
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Reprobados');

    sheet.addRow(['Estudiante', 'Grupo', 'Asignatura', 'Área', 'Nota', 'Período', 'Déficit', 'Recuperable']);
    this.styleHeaderRow(sheet, 1);

    for (const r of data.results) {
      sheet.addRow([
        r.studentName,
        r.group,
        r.subjectName,
        r.areaName,
        r.grade,
        r.termName,
        r.deficit,
        r.recoverable ? 'Sí' : 'No',
      ]);
    }

    // Resumen
    sheet.addRow([]);
    sheet.addRow(['Nota mínima aprobatoria', data.passingGrade]);
    sheet.addRow(['Total reprobaciones', data.totalFailed]);
    sheet.addRow(['Estudiantes afectados', data.uniqueStudents]);
    sheet.addRow(['Asignaturas afectadas', data.uniqueSubjects]);

    this.autoFitColumns(sheet);
    return workbook;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. LISTADO DE RECUPERACIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  async exportRecoveryList(
    institutionId: string,
    academicYearId: string,
    groupId: string,
    termId?: string,
  ): Promise<ExcelJS.Workbook> {
    const data = await this.reportsService.getRecoveryList(
      institutionId, academicYearId, groupId, termId,
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Recuperación');

    sheet.addRow(['Estudiante', 'Grupo', 'Asignatura', 'Nota', 'Período', 'Déficit']);
    this.styleHeaderRow(sheet, 1);

    for (const r of data.results) {
      sheet.addRow([
        r.studentName,
        r.group,
        r.subjectName,
        r.grade,
        r.termName,
        r.deficit,
      ]);
    }

    sheet.addRow([]);
    sheet.addRow(['Nota mínima aprobatoria', data.passingGrade]);
    sheet.addRow(['Rango recuperación', `${data.rangeMin} – ${data.rangeMax}`]);
    sheet.addRow(['Total recuperables', data.totalRecoverable]);

    this.autoFitColumns(sheet);
    return workbook;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. PROYECCIÓN DE PROMOCIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  async exportPromotionProjection(
    institutionId: string,
    academicYearId: string,
    groupId: string,
  ): Promise<ExcelJS.Workbook> {
    const data = await this.reportsService.getPromotionProjection(
      institutionId, academicYearId, groupId,
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Proyección Promoción');

    sheet.addRow(['Estudiante', 'Grupo', 'Total Asignaturas', 'Promueve', 'En Riesgo', 'No Promueve', 'Proyección']);
    this.styleHeaderRow(sheet, 1);

    for (const r of data.results) {
      sheet.addRow([
        r.studentName,
        r.group,
        r.totalSubjects,
        r.projectedApproved,
        r.atRisk,
        r.projectedFailed,
        r.overallProjection === 'PROMUEVE' ? 'Promueve'
          : r.overallProjection === 'EN_RIESGO' ? 'En riesgo' : 'No promueve',
      ]);
    }

    sheet.addRow([]);
    sheet.addRow(['Nota mínima aprobatoria', data.passingGrade]);
    sheet.addRow(['Períodos completados', `${data.completedTerms} de ${data.totalTerms}`]);
    sheet.addRow(['Resumen', `Promueven: ${data.summary.promoted} | Riesgo: ${data.summary.atRisk} | No promueven: ${data.summary.notPromoted}`]);

    this.autoFitColumns(sheet);
    return workbook;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILIDADES DE FORMATO
  // ═══════════════════════════════════════════════════════════════════════════

  private styleHeaderRow(sheet: ExcelJS.Worksheet, rowNumber: number) {
    const row = sheet.getRow(rowNumber);
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' },
    };
    row.alignment = { horizontal: 'center', vertical: 'middle' };
    row.height = 24;
  }

  private autoFitColumns(sheet: ExcelJS.Worksheet) {
    sheet.columns.forEach((col) => {
      let maxLen = 10;
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        const len = cell.value ? String(cell.value).length : 0;
        if (len > maxLen) maxLen = len;
      });
      col.width = Math.min(maxLen + 2, 50);
    });
  }
}
