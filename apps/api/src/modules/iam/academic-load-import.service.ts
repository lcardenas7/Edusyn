import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import type { ApplyResult, ImportAnalysis, Issue, SummaryFact } from '@edusyn/types';

import { PrismaService } from '../../prisma/prisma.service';
import { parseCourse } from './student-ecosystem-inference.util';
import { backfillCatalogCodes } from '../../common/utils/catalog-code.util';

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
  codigoAsignatura?: string; // clave preferida: amarra la asignatura por código
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
      if (h.includes('curso') || h.includes('grupo') || h.includes('grado')
          || h.includes('nivel') || h.includes('salon')) set('curso');
      // "Código asignatura" ANTES que "Asignatura" (contiene 'asignatura').
      else if (h.includes('codigo') && (h.includes('asignatura') || h.includes('materia'))) set('codigoAsignatura');
      else if (h.includes('area')) set('area');
      else if (h.includes('asignatura') || h.includes('materia')) set('asignatura');
      else if (h.includes('intensidad') || h.includes('horas') || h === 'ih') set('intensidad');
      else if (h.includes('documento') || h.includes('cedula') || h.includes('identificacion')
          || h.includes('identidad') || h.includes('nro') || h.includes('n°')
          || (h.includes('numero') && !h.includes('telefono'))) set('docenteDoc');
      else if (h.includes('correo') || h.includes('email') || h.includes('mail')
          || h.includes('e-mail') || h.includes('electronico')) set('docenteCorreo');
    });
    return map;
  }

  private findHeaderRow(sheet: ExcelJS.Worksheet): { cols: Record<string, number>; headerRowNum: number } {
    for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
      const cols = this.mapColumns(sheet.getRow(r));
      if (cols.curso !== undefined && (cols.asignatura !== undefined || cols.codigoAsignatura !== undefined) && (cols.docenteDoc !== undefined || cols.docenteCorreo !== undefined)) {
        return { cols, headerRowNum: r };
      }
    }
    throw new BadRequestException(
      'El archivo no tiene las columnas mínimas (Curso, Asignatura y Documento o Correo del docente). Descarga la plantilla oficial.',
    );
  }

  private async parse(buffer: Buffer): Promise<LoadRow[]> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const sheet = wb.getWorksheet('PLANTILLA') || wb.getWorksheet('Carga') || wb.worksheets[0];
    if (!sheet) throw new BadRequestException('El archivo no contiene hojas.');

    const { cols, headerRowNum } = this.findHeaderRow(sheet);
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
    for (let i = headerRowNum + 1; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      const curso = cell(row, 'curso');
      const codigoAsignatura = cell(row, 'codigoAsignatura');
      const asignatura = cell(row, 'asignatura');
      const docenteDoc = cell(row, 'docenteDoc');
      const docenteCorreo = cell(row, 'docenteCorreo').toLowerCase();
      if (!curso && !codigoAsignatura && !asignatura && !docenteDoc && !docenteCorreo) continue;
      rows.push({
        rowNumber: i,
        curso,
        codigoAsignatura: codigoAsignatura || undefined,
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

    // Las instituciones pueden haber creado el grado como "TRANSICION" (sin
    // tilde) y los grupos como "TRANSICION A", mientras el parser canónico
    // produce "Transición" + "A". Resolver por nombre normalizado y, para
    // grados ordinarios, también por número evita que una variante visual
    // bloquee la importación.
    const grades = await this.prisma.grade.findMany({
      where: { institutionId, stage: parsed.stage },
      select: { id: true, name: true, number: true },
    });
    const grade = grades.find((candidate) =>
      norm(candidate.name) === norm(parsed.gradeName)
      || (parsed.gradeNumber !== null && candidate.number === parsed.gradeNumber),
    );
    if (!grade) return null;

    // Se admiten grupos guardados como "A" o con el curso completo
    // ("TRANSICION A"), pues ambos formatos ya existen en instituciones.
    const expectedNames = new Set([norm(parsed.groupName), norm(curso)]);
    const groups = await this.prisma.group.findMany({
      where: { gradeId: grade.id },
      select: { id: true, name: true },
    });
    const group = groups.find((candidate) => expectedNames.has(norm(candidate.name)));
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

    // Catálogo existente: por código (clave preferida) y por nombre (respaldo).
    const existingSubjects = await this.prisma.subject.findMany({
      where: { area: { institutionId } }, select: { id: true, name: true, code: true },
    });
    const subjectByNorm = new Map(existingSubjects.map((s) => [norm(s.name), s.id]));
    const subjectByCode = new Map<string, string>();
    for (const s of existingSubjects) if (s.code) subjectByCode.set(String(s.code).trim().toUpperCase(), s.id);

    for (const r of rows) {
      if (!r.asignatura && !r.codigoAsignatura) { invalidas++; issues.push({ severity: 'blocking', code: 'ROW_INVALID', message: 'Falta la asignatura (código o nombre)', location: { row: r.rowNumber } }); continue; }
      const groupId = await this.findGroup(institutionId, r.curso);
      if (!groupId) { invalidas++; issues.push({ severity: 'blocking', code: 'GROUP_NOT_FOUND', message: `Curso/grupo no encontrado: "${r.curso}" (impórtalo con estudiantes primero)`, location: { row: r.rowNumber, field: 'curso' } }); continue; }
      const teacherId = await this.findTeacher(institutionId, r);
      if (!teacherId) { invalidas++; issues.push({ severity: 'blocking', code: 'TEACHER_NOT_FOUND', message: `Docente no encontrado (${r.docenteCorreo || r.docenteDoc}); impórtalo en el paso de docentes`, location: { row: r.rowNumber } }); continue; }

      // Amarre por CÓDIGO si viene; si el código no existe, error. Si no, por nombre.
      const code = r.codigoAsignatura?.trim().toUpperCase();
      let subjectId: string | undefined;
      if (code) {
        subjectId = subjectByCode.get(code);
        if (!subjectId) { invalidas++; issues.push({ severity: 'blocking', code: 'SUBJECT_CODE_NOT_FOUND', message: `Código de asignatura no encontrado: "${r.codigoAsignatura}". Cópialo de la hoja Catálogos.`, location: { row: r.rowNumber } }); continue; }
      } else {
        subjectId = subjectByNorm.get(norm(r.asignatura));
      }
      const key = `${groupId}|${subjectId ?? 'new:' + norm(r.asignatura)}|${teacherId}`;
      if (seen.has(key)) { continue; } // duplicado en archivo
      seen.add(key);

      if (subjectId) {
        const existing = await this.prisma.teacherAssignment.findFirst({
          where: { academicYearId: year.id, groupId, subjectId, teacherId }, select: { id: true },
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

    // Precarga del CATÁLOGO existente indexado por nombre NORMALIZADO (sin tildes
    // ni mayúsculas). El catálogo manda: una asignatura pertenece a UN área.
    const [existingAreas, existingSubjects] = await Promise.all([
      this.prisma.area.findMany({ where: { institutionId }, select: { id: true, name: true } }),
      this.prisma.subject.findMany({ where: { area: { institutionId } }, select: { id: true, name: true, areaId: true, code: true } }),
    ]);
    const areaByNorm = new Map(existingAreas.map((a) => [norm(a.name), a.id]));
    const areaNameById = new Map(existingAreas.map((a) => [a.id, a.name]));
    // CLAVE PREFERIDA: código de asignatura (exacto, inmune a tildes/escritura).
    const subjectByCode = new Map<string, string>();
    for (const s of existingSubjects) if (s.code) subjectByCode.set(String(s.code).trim().toUpperCase(), s.id);
    // Respaldo: asignatura por nombre GLOBAL (no por área): evita duplicar "Inglés"
    // bajo dos áreas distintas y que una asignatura quede como área propia.
    const subjectByNameGlobal = new Map<string, { id: string; areaId: string; areaName: string }>();
    for (const s of existingSubjects) {
      const nk = norm(s.name);
      if (!subjectByNameGlobal.has(nk)) {
        subjectByNameGlobal.set(nk, { id: s.id, areaId: s.areaId, areaName: areaNameById.get(s.areaId) || '' });
      }
    }

    const ensureArea = async (name: string): Promise<string> => {
      const key = norm(name);
      const found = areaByNorm.get(key);
      if (found) return found;
      const area = await this.prisma.area.create({ data: { institutionId, name }, select: { id: true } });
      areaByNorm.set(key, area.id);
      areaNameById.set(area.id, name);
      return area.id;
    };
    /**
     * Resuelve la asignatura respetando el CATÁLOGO:
     *  0) Si viene el CÓDIGO, se amarra exacto por código (sin errores de escritura).
     *     Si el código no existe → error (no se crea nada a ciegas).
     *  1) Si no hay código: si ya existe una asignatura con ese nombre (en cualquier
     *     área), se reusa CON su área — no se crea otra ni se mueve; se avisa si el
     *     área del archivo difiere.
     *  2) Si no existe, se crea bajo el área del archivo (o "General").
     */
    const resolveSubject = async (r: LoadRow): Promise<string> => {
      const code = r.codigoAsignatura?.trim().toUpperCase();
      if (code) {
        const id = subjectByCode.get(code);
        if (id) return id;
        throw new Error(`Código de asignatura no encontrado: "${r.codigoAsignatura}". Cópialo tal cual de la hoja Catálogos.`);
      }
      const subjectName = r.asignatura;
      const nk = norm(subjectName);
      const existing = subjectByNameGlobal.get(nk);
      if (existing) {
        if (r.area?.trim() && norm(r.area) !== norm(existing.areaName)) {
          warnings.push({
            severity: 'warning',
            code: 'SUBJECT_AREA_MISMATCH',
            message: `"${subjectName}" ya existe en el área "${existing.areaName}"; se ignoró el área "${r.area.trim()}" del archivo para no duplicarla.`,
          });
        }
        return existing.id;
      }
      const areaName = r.area?.trim() || 'General';
      const areaId = await ensureArea(areaName);
      const subject = await this.prisma.subject.create({ data: { areaId, name: subjectName }, select: { id: true } });
      subjectByNameGlobal.set(nk, { id: subject.id, areaId, areaName: areaNameById.get(areaId) || areaName });
      return subject.id;
    };

    const seen = new Set<string>();

    for (const r of rows) {
      try {
        if (!r.asignatura && !r.codigoAsignatura) { skipped++; errors.push({ severity: 'blocking', code: 'ROW_INVALID', message: 'Falta la asignatura (código o nombre)', location: { row: r.rowNumber } }); continue; }
        const groupId = await this.findGroup(institutionId, r.curso);
        if (!groupId) { skipped++; errors.push({ severity: 'blocking', code: 'GROUP_NOT_FOUND', message: `Curso/grupo no encontrado: "${r.curso}"`, location: { row: r.rowNumber, field: 'curso' } }); continue; }
        const teacherId = await this.findTeacher(institutionId, r);
        if (!teacherId) { skipped++; errors.push({ severity: 'blocking', code: 'TEACHER_NOT_FOUND', message: `Docente no encontrado (${r.docenteCorreo || r.docenteDoc})`, location: { row: r.rowNumber } }); continue; }

        const subjectId = await resolveSubject(r);

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

    // Asignar código a las áreas/asignaturas nuevas creadas en este import.
    if (created > 0) await backfillCatalogCodes(this.prisma, institutionId);

    const summary: SummaryFact[] = [
      { key: 'creadas', label: 'Asignaciones creadas', value: String(created) },
      { key: 'omitidas', label: 'Omitidas', value: String(skipped) },
    ];

    return { contractVersion: 1, summary, created, updated: 0, skipped, errors, warnings };
  }
}
