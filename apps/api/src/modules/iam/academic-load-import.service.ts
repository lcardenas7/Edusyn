import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import type { ApplyResult, ImportAnalysis, Issue, SummaryFact } from '@edusyn/types';

import { PrismaService } from '../../prisma/prisma.service';
import { parseCourse } from './student-ecosystem-inference.util';

/**
 * MÓDULO 5 (Onboarding v2) — Importador de CARGA ACADÉMICA.
 *
 * Excel: Curso · Área · Asignatura · IntensidadHoraria · DocumentoDocente (o Correo).
 * Crea Area/Subject si faltan y TeacherAssignment (año+grupo+asignatura+docente),
 * IDEMPOTENTE por (año, grupo, asignatura, docente). Requiere que el ecosistema
 * (grupos), los docentes y el año ya existan.
 *
 * Dos fases (I1–I6). Devuelve los tipos del contrato @edusyn/types (AR3).
 */

interface LoadRow {
  rowNumber: number;
  curso: string;
  area?: string;
  asignatura: string;
  intensidad?: string;
  docenteDoc?: string;
  docenteCorreo?: string;
}

function norm(s: any): string {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

@Injectable()
export class AcademicLoadImportService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Parseo ──────────────────────────────────────────────────────────────────
  private mapColumns(headerRow: ExcelJS.Row): Record<string, number> {
    const map: Record<string, number> = {};
    headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
      const h = norm(cell.value);
      if (!h) return;
      const set = (k: string) => { if (map[k] === undefined) map[k] = col; };
      if (h.includes('curso') || h.includes('grupo')) set('curso');
      else if (h.includes('area')) set('area');
      else if (h.includes('asignatura') || h.includes('materia')) set('asignatura');
      else if (h.includes('intensidad') || h.includes('horas') || h === 'ih') set('intensidad');
      else if (h.includes('documento') || h.includes('cedula') || h.includes('identificacion')) set('docenteDoc');
      else if (h.includes('correo') || h.includes('email') || h.includes('mail')) set('docenteCorreo');
    });
    return map;
  }

  private async parse(buffer: Buffer): Promise<LoadRow[]> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const sheet = wb.getWorksheet('PLANTILLA') || wb.getWorksheet('Carga') || wb.worksheets[0];
    if (!sheet) throw new BadRequestException('El archivo no contiene hojas.');

    const cols = this.mapColumns(sheet.getRow(1));
    if (cols.curso === undefined || cols.asignatura === undefined || (cols.docenteDoc === undefined && cols.docenteCorreo === undefined)) {
      throw new BadRequestException(
        'El archivo no tiene las columnas mínimas (Curso, Asignatura y Documento o Correo del docente). Descarga la plantilla oficial.',
      );
    }
    const cell = (row: ExcelJS.Row, key: string): string => {
      const c = cols[key];
      if (c === undefined) return '';
      const v = row.getCell(c).value as any;
      if (v && typeof v === 'object') {
        if (v.text) return String(v.text).trim();
        if (v.hyperlink) return String(v.hyperlink).replace(/^mailto:/, '').trim();
        if (v.result !== undefined) return String(v.result).trim();
      }
      return String(v ?? '').trim();
    };

    const rows: LoadRow[] = [];
    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      const curso = cell(row, 'curso');
      const asignatura = cell(row, 'asignatura');
      const docenteDoc = cell(row, 'docenteDoc');
      const docenteCorreo = cell(row, 'docenteCorreo').toLowerCase();
      if (!curso && !asignatura && !docenteDoc && !docenteCorreo) continue;
      rows.push({
        rowNumber: i,
        curso,
        area: cell(row, 'area') || undefined,
        asignatura,
        intensidad: cell(row, 'intensidad') || undefined,
        docenteDoc: docenteDoc || undefined,
        docenteCorreo: docenteCorreo || undefined,
      });
    }
    return rows;
  }

  /** Año destino: DRAFT o ACTIVE más reciente. */
  private async resolveYear(institutionId: string, override?: string): Promise<{ id: string }> {
    if (override) {
      const y = await this.prisma.academicYear.findFirst({ where: { id: override, institutionId }, select: { id: true } });
      if (!y) throw new NotFoundException('Año lectivo no encontrado.');
      return y;
    }
    const y = await this.prisma.academicYear.findFirst({
      where: { institutionId, status: { in: ['DRAFT', 'ACTIVE'] } },
      orderBy: { year: 'desc' }, select: { id: true },
    });
    if (!y) throw new BadRequestException('No hay año lectivo. Crea el año antes de importar la carga académica.');
    return y;
  }

  private async findGroup(institutionId: string, curso: string): Promise<string | null> {
    const parsed = parseCourse(curso);
    if (!parsed) return null;
    const grade = await this.prisma.grade.findFirst({
      where: { institutionId, stage: parsed.stage, name: parsed.gradeName }, select: { id: true },
    });
    if (!grade) return null;
    const group = await this.prisma.group.findFirst({
      where: { gradeId: grade.id, name: parsed.groupName }, select: { id: true },
    });
    return group?.id ?? null;
  }

  private async findTeacher(institutionId: string, r: LoadRow): Promise<string | null> {
    if (r.docenteCorreo) {
      const u = await this.prisma.user.findFirst({
        where: { email: r.docenteCorreo, institutionUsers: { some: { institutionId } } }, select: { id: true },
      });
      if (u) return u.id;
    }
    if (r.docenteDoc) {
      const u = await this.prisma.user.findFirst({
        where: { documentNumber: r.docenteDoc, institutionUsers: { some: { institutionId } } }, select: { id: true },
      });
      if (u) return u.id;
    }
    return null;
  }

  // ── ANALYZE (read-only) ─────────────────────────────────────────────────────
  async analyze(institutionId: string, buffer: Buffer, academicYearId?: string): Promise<ImportAnalysis> {
    const year = await this.resolveYear(institutionId, academicYearId);
    const rows = await this.parse(buffer);
    const issues: Issue[] = [];
    let nuevas = 0;
    let existentes = 0;
    let invalidas = 0;
    const seen = new Set<string>();

    for (const r of rows) {
      if (!r.asignatura) { invalidas++; issues.push({ severity: 'blocking', code: 'ROW_INVALID', message: 'Falta la asignatura', location: { row: r.rowNumber } }); continue; }
      const groupId = await this.findGroup(institutionId, r.curso);
      if (!groupId) { invalidas++; issues.push({ severity: 'blocking', code: 'GROUP_NOT_FOUND', message: `Curso/grupo no encontrado: "${r.curso}" (impórtalo con estudiantes primero)`, location: { row: r.rowNumber, field: 'curso' } }); continue; }
      const teacherId = await this.findTeacher(institutionId, r);
      if (!teacherId) { invalidas++; issues.push({ severity: 'blocking', code: 'TEACHER_NOT_FOUND', message: `Docente no encontrado (${r.docenteCorreo || r.docenteDoc}); impórtalo en el paso de docentes`, location: { row: r.rowNumber } }); continue; }

      // ¿Existe ya la asignatura? Si no, es nueva (se creará en apply).
      const subject = await this.prisma.subject.findFirst({
        where: { name: r.asignatura, area: { institutionId } }, select: { id: true },
      });
      const key = `${groupId}|${subject?.id ?? 'new:' + norm(r.asignatura)}|${teacherId}`;
      if (seen.has(key)) { continue; } // duplicado en archivo
      seen.add(key);

      if (subject) {
        const existing = await this.prisma.teacherAssignment.findFirst({
          where: { academicYearId: year.id, groupId, subjectId: subject.id, teacherId }, select: { id: true },
        });
        if (existing) { existentes++; continue; }
      }
      nuevas++;
    }

    const summary: SummaryFact[] = [
      { key: 'total', label: 'Filas en el archivo', value: String(rows.length) },
      { key: 'nuevas', label: 'Asignaciones nuevas', value: String(nuevas) },
      { key: 'existentes', label: 'Ya asignadas', value: String(existentes) },
    ];
    if (invalidas > 0) summary.push({ key: 'invalidas', label: 'Filas con error', value: String(invalidas) });

    return {
      contractVersion: 1,
      summary,
      issues,
      canApply: nuevas > 0,
      ...(nuevas > 0 ? {} : { blockedReason: 'No hay asignaciones nuevas para crear en este archivo.' }),
    };
  }

  // ── APPLY (escribe — idempotente, no borra) ─────────────────────────────────
  async apply(institutionId: string, buffer: Buffer, academicYearId?: string): Promise<ApplyResult> {
    const year = await this.resolveYear(institutionId, academicYearId);
    const rows = await this.parse(buffer);

    let created = 0;
    let skipped = 0;
    const errors: Issue[] = [];
    const warnings: Issue[] = [];

    const areaCache = new Map<string, string>();
    const subjectCache = new Map<string, string>();

    const ensureArea = async (name: string): Promise<string> => {
      const key = norm(name);
      if (areaCache.has(key)) return areaCache.get(key)!;
      let area = await this.prisma.area.findFirst({ where: { institutionId, name }, select: { id: true } });
      if (!area) area = await this.prisma.area.create({ data: { institutionId, name }, select: { id: true } });
      areaCache.set(key, area.id);
      return area.id;
    };
    const ensureSubject = async (areaId: string, name: string): Promise<string> => {
      const key = `${areaId}|${norm(name)}`;
      if (subjectCache.has(key)) return subjectCache.get(key)!;
      let subject = await this.prisma.subject.findFirst({ where: { areaId, name }, select: { id: true } });
      if (!subject) subject = await this.prisma.subject.create({ data: { areaId, name }, select: { id: true } });
      subjectCache.set(key, subject.id);
      return subject.id;
    };

    const seen = new Set<string>();

    for (const r of rows) {
      try {
        if (!r.asignatura) { skipped++; errors.push({ severity: 'blocking', code: 'ROW_INVALID', message: 'Falta la asignatura', location: { row: r.rowNumber } }); continue; }
        const groupId = await this.findGroup(institutionId, r.curso);
        if (!groupId) { skipped++; errors.push({ severity: 'blocking', code: 'GROUP_NOT_FOUND', message: `Curso/grupo no encontrado: "${r.curso}"`, location: { row: r.rowNumber, field: 'curso' } }); continue; }
        const teacherId = await this.findTeacher(institutionId, r);
        if (!teacherId) { skipped++; errors.push({ severity: 'blocking', code: 'TEACHER_NOT_FOUND', message: `Docente no encontrado (${r.docenteCorreo || r.docenteDoc})`, location: { row: r.rowNumber } }); continue; }

        const areaId = await ensureArea(r.area?.trim() || 'General');
        const subjectId = await ensureSubject(areaId, r.asignatura);

        const key = `${groupId}|${subjectId}|${teacherId}`;
        if (seen.has(key)) { skipped++; continue; } // duplicado en archivo
        seen.add(key);

        const existing = await this.prisma.teacherAssignment.findFirst({
          where: { academicYearId: year.id, groupId, subjectId, teacherId }, select: { id: true },
        });
        if (existing) { skipped++; continue; }

        await this.prisma.teacherAssignment.create({
          data: {
            institutionId,
            academicYearId: year.id,
            groupId,
            subjectId,
            teacherId,
            weeklyHours: Number(r.intensidad) || 0,
          },
        });
        created++;
      } catch (e: any) {
        errors.push({ severity: 'blocking', code: 'ROW_FAILED', message: e?.message || String(e), location: { row: r.rowNumber } });
      }
    }

    const summary: SummaryFact[] = [
      { key: 'creadas', label: 'Asignaciones creadas', value: String(created) },
      { key: 'omitidas', label: 'Omitidas', value: String(skipped) },
    ];

    return { contractVersion: 1, summary, created, updated: 0, skipped, errors, warnings };
  }
}
