import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SchoolShift } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import type { ImportAnalysis, ApplyResult, Issue, SummaryFact } from '@edusyn/types';

import { PrismaService } from '../../prisma/prisma.service';
import { canonicalGradeName } from '../../common/utils/academic-level.util';
import {
  inferEcosystem,
  InferredEcosystem,
  parseCourse,
} from './student-ecosystem-inference.util';

/**
 * MÓDULO 3 (Onboarding v2) — Importador de estudiantes CANÓNICO.
 *
 * - analyze: lee el Excel, INFIERE el ecosistema y cuadra estudiantes. NO escribe.
 * - apply: crea el ecosistema (sedes/jornadas/grados/grupos) + estudiantes +
 *   matrículas, de forma IDEMPOTENTE (find-or-create + upsert). No borra a nadie.
 *
 * Nota (reportada): el ecosistema se crea aquí de forma propia (idempotente,
 * multi-sede) en vez de reusar grades.service.syncGradesAndGroups, porque ese
 * asume una sola sede y un DTO de sync del frontend. A consolidar más adelante.
 * Nota (reportada): los ACUDIENTES no se crean aún — el modelo Guardian exige
 * documento y el formato de estudiantes no lo trae. Falta una columna de documento
 * del acudiente (o un flujo aparte).
 */

export interface StudentRow {
  rowNumber: number;
  curso: string;
  jornada?: string;
  sede?: string;
  tipoDocumento?: string;
  documento: string;
  primerNombre?: string;
  segundoNombre?: string;
  primerApellido?: string;
  segundoApellido?: string;
  nombreCompleto: string;
  fechaNacimiento?: string;
  genero?: string;
  acudienteNombre?: string;
}

export interface StudentAnalysis {
  ecosystem: InferredEcosystem;
  students: { total: number; validos: number; nuevos: number; existentes: number };
  guardians: number;
  issues: { curso: string; motivo: string; filas: number }[];
}

export interface StudentApplyResult {
  ecosistema: { gradosCreados: number; gruposCreados: number; sedesCreadas: number; jornadasCreadas: number };
  estudiantes: { creados: number; existentes: number };
  matriculas: { creadas: number; existentes: number };
  omitidos: number;
  errores: { fila: number; motivo: string }[];
  advertencias: string[];
}

function norm(s: any): string {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Jornada humana → enum SchoolShift. */
function shiftTypeFromJornada(j?: string): SchoolShift {
  const n = norm(j);
  if (n.includes('mañana') || n.includes('manana') || n === 'am') return 'MORNING';
  if (n.includes('tarde') || n === 'pm') return 'AFTERNOON';
  if (n.includes('noche') || n.includes('nocturn')) return 'NIGHT';
  return 'SINGLE'; // Única / desconocida
}

@Injectable()
export class StudentImportService {
  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // PARSEO (detección de columnas por encabezado)
  // ═══════════════════════════════════════════════════════════════════════════

  private mapColumns(headerRow: ExcelJS.Row): Record<string, number> {
    const map: Record<string, number> = {};
    headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
      const h = norm(cell.value);
      if (!h) return;
      const set = (k: string) => { if (map[k] === undefined) map[k] = col; };

      // Curso/grado/grupo — columna de ubicación académica
      if (h.includes('curso') || h.includes('grupo') || h.includes('grado')
          || h.includes('nivel') || h.includes('salon') || h.includes('aula')) set('curso');
      else if (h.includes('jornada')) set('jornada');
      else if (h.includes('sede')) set('sede');
      else if (h.includes('tipo') && h.includes('doc')) set('tipoDocumento');
      // Documento — detección amplia para formatos colombianos
      else if (h.includes('documento') || h.includes('identidad') || h.includes('cedula')
          || h.includes('identificacion') || h.includes('nro') || h.includes('n°')
          || (h.includes('numero') && !h.includes('telefono') && !h.includes('celular'))
          || h === 'id' || h === 'doc' || h === 'ti' || h === 'cc') set('documento');
      else if (h.includes('nacimiento') || h.includes('fecha nac')) set('fechaNacimiento');
      else if (h.includes('genero') || h.includes('sexo')) set('genero');
      else if (h.includes('acudiente') || h.includes('responsable') || h.includes('tutor')) set('acudienteNombre');
      else if (h.includes('primer') && h.includes('nombre')) set('primerNombre');
      else if (h.includes('segundo') && h.includes('nombre')) set('segundoNombre');
      else if (h.includes('primer') && h.includes('apellido')) set('primerApellido');
      else if (h.includes('segundo') && h.includes('apellido')) set('segundoApellido');
      else if (h.includes('nombre') && h.includes('apellido')) set('nombreCompleto');
      else if (h.includes('apellido')) set('apellidos');
      else if (h.includes('nombre') || h.includes('estudiante') || h.includes('alumno')) set('nombres');
    });
    return map;
  }

  private findHeaderRow(sheet: ExcelJS.Worksheet): { cols: Record<string, number>; headerRowNum: number } {
    for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
      const cols = this.mapColumns(sheet.getRow(r));
      if (cols.curso !== undefined && cols.documento !== undefined) return { cols, headerRowNum: r };
    }
    const headers: string[] = [];
    for (let r = 1; r <= Math.min(5, sheet.rowCount); r++) {
      sheet.getRow(r).eachCell({ includeEmpty: false }, (cell) => {
        const v = String(cell.value ?? '').trim();
        if (v) headers.push(v);
      });
    }
    const cols = this.mapColumns(sheet.getRow(1));
    const falta = [
      cols.curso === undefined ? 'Curso/Grado' : null,
      cols.documento === undefined ? 'Documento' : null,
    ].filter(Boolean).join(' y ');
    throw new BadRequestException(
      `No se encontró la columna: ${falta}. ` +
      `Columnas detectadas: [${headers.join(', ')}]. ` +
      `Acepta: Curso/Grado/Grupo/Nivel para ubicación; Documento/Identificación/Cédula/Nro para documento.`,
    );
  }

  private rowsFromSheet(sheet: ExcelJS.Worksheet): StudentRow[] {
    const { cols, headerRowNum } = this.findHeaderRow(sheet);
    const cell = (row: ExcelJS.Row, key: string): string => {
      const c = cols[key];
      return c === undefined ? '' : String(row.getCell(c).value ?? '').trim();
    };
    const rows: StudentRow[] = [];
    for (let i = headerRowNum + 1; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      const curso = cell(row, 'curso');
      const documento = cell(row, 'documento');
      const primerNombre = cell(row, 'primerNombre') || undefined;
      const segundoNombre = cell(row, 'segundoNombre') || undefined;
      const primerApellido = cell(row, 'primerApellido') || undefined;
      const segundoApellido = cell(row, 'segundoApellido') || undefined;
      const nombreCompleto = cols.nombreCompleto !== undefined
        ? cell(row, 'nombreCompleto')
        : [primerNombre, segundoNombre, primerApellido, segundoApellido].filter(Boolean).join(' ').trim()
          || `${cell(row, 'nombres')} ${cell(row, 'apellidos')}`.trim();
      if (!curso && !documento && !nombreCompleto) continue;
      rows.push({
        rowNumber: i, curso, documento, nombreCompleto,
        primerNombre, segundoNombre, primerApellido, segundoApellido,
        jornada: cell(row, 'jornada') || undefined,
        sede: cell(row, 'sede') || undefined,
        tipoDocumento: cell(row, 'tipoDocumento') || undefined,
        fechaNacimiento: cell(row, 'fechaNacimiento') || undefined,
        genero: cell(row, 'genero') || undefined,
        acudienteNombre: cell(row, 'acudienteNombre') || undefined,
      });
    }
    return rows;
  }

  private parse(buffer: Buffer): Promise<StudentRow[]> {
    return (async () => {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);
      if (wb.worksheets.length === 0) throw new BadRequestException('El archivo no contiene hojas.');
      const named = wb.getWorksheet('PLANTILLA') || wb.getWorksheet('Estudiantes');
      if (named) return this.rowsFromSheet(named);
      for (const ws of wb.worksheets) {
        try { return this.rowsFromSheet(ws); } catch { /* try next sheet */ }
      }
      return this.rowsFromSheet(wb.worksheets[0]);
    })();
  }

  /** Separa un nombre completo (fallback cuando no vienen columnas separadas). */
  private splitName(full: string): { firstName: string; secondName?: string; lastName: string; secondLastName?: string } {
    const p = (full || '').trim().split(/\s+/).filter(Boolean);
    if (p.length >= 4) return { firstName: p[0], secondName: p[1], lastName: p[2], secondLastName: p.slice(3).join(' ') };
    if (p.length === 3) return { firstName: p[0], secondName: p[1], lastName: p[2] };
    if (p.length === 2) return { firstName: p[0], lastName: p[1] };
    return { firstName: p[0] || 'SIN NOMBRE', lastName: 'SIN APELLIDO' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ANALIZAR (read-only)
  // ═══════════════════════════════════════════════════════════════════════════

  async analyze(institutionId: string, buffer: Buffer): Promise<ImportAnalysis> {
    const raw = await this.analyzeRows(institutionId, await this.parse(buffer));
    const eco = raw.ecosystem;

    const summary: SummaryFact[] = [
      { key: 'total', label: 'Filas en el archivo', value: String(raw.students.total) },
      { key: 'nuevos', label: 'Estudiantes nuevos', value: String(raw.students.nuevos) },
      { key: 'existentes', label: 'Ya registrados', value: String(raw.students.existentes) },
      { key: 'niveles', label: 'Niveles', value: String(eco.niveles.length) },
      { key: 'grados', label: 'Grados', value: String(eco.grados.length) },
      { key: 'grupos', label: 'Grupos', value: String(eco.totalGrupos) },
    ];
    if (raw.students.total - raw.students.validos > 0) {
      summary.push({ key: 'sinDoc', label: 'Sin documento (se omitirán)', value: String(raw.students.total - raw.students.validos) });
    }

    const issues: Issue[] = raw.issues.map((iss) => ({
      severity: 'warning' as const,
      code: 'COURSE_NOT_RECOGNIZED',
      message: `Curso "${iss.curso}": ${iss.motivo} (${iss.filas} fila${iss.filas > 1 ? 's' : ''})`,
      howToFix: 'Revisa el valor del curso en el Excel y corrige el formato (ej. "6A", "TA", "Transición A").',
    }));

    const canApply = raw.students.nuevos > 0;
    return {
      contractVersion: 1,
      summary,
      issues,
      canApply,
      ...(canApply ? {} : { blockedReason: 'No hay estudiantes nuevos para importar en este archivo.' }),
    };
  }

  async analyzeRows(institutionId: string, rows: StudentRow[]): Promise<StudentAnalysis> {
    const ecosystem = inferEcosystem(rows.map((r) => ({ curso: r.curso, jornada: r.jornada, sede: r.sede })));
    const validRows = rows.filter((r) => r.documento && r.documento.length >= 3);
    const sinDocumento = rows.length - validRows.length;

    const docs = [...new Set(validRows.map((r) => r.documento))];
    const existing = docs.length
      ? await this.prisma.student.findMany({ where: { institutionId, documentNumber: { in: docs } }, select: { documentNumber: true } })
      : [];
    const existingDocs = new Set(existing.map((e) => e.documentNumber));
    const nuevos = validRows.filter((r) => !existingDocs.has(r.documento)).length;

    const issues = [...ecosystem.issues];
    if (sinDocumento > 0) {
      issues.push({ curso: '—', motivo: `${sinDocumento} fila(s) sin documento válido — se omitirán al importar`, filas: sinDocumento });
    }
    return {
      ecosystem,
      students: { total: rows.length, validos: validRows.length, nuevos, existentes: validRows.length - nuevos },
      guardians: rows.filter((r) => r.acudienteNombre?.trim()).length,
      issues,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // APLICAR (escribe — idempotente, no borra a nadie)
  // ═══════════════════════════════════════════════════════════════════════════

  async apply(institutionId: string, academicYearId: string, buffer: Buffer): Promise<ApplyResult> {
    const year = await this.prisma.academicYear.findUnique({
      where: { id: academicYearId },
      select: { id: true, institutionId: true, status: true },
    });
    if (!year) throw new NotFoundException('Año lectivo no encontrado. Crea el año (DRAFT) antes de importar estudiantes.');
    if (year.institutionId !== institutionId) throw new ForbiddenException('El año lectivo pertenece a otra institución.');
    if (year.status === 'CLOSED') throw new BadRequestException('No se puede importar a un año lectivo cerrado.');

    const rows = await this.parse(buffer);

    const _r = {
      ecosistema: { gradosCreados: 0, gruposCreados: 0, sedesCreadas: 0, jornadasCreadas: 0 },
      estudiantes: { creados: 0, existentes: 0 },
      matriculas: { creadas: 0, existentes: 0 },
      omitidos: 0,
    };
    const errors: Issue[] = [];
    const warnings: Issue[] = [];
    if (rows.some((r) => r.acudienteNombre?.trim())) {
      warnings.push({
        severity: 'warning', code: 'GUARDIANS_NOT_IMPORTED',
        message: 'Los acudientes NO se importaron: el formato no incluye documento del acudiente.',
        howToFix: 'Agrega una columna de documento del acudiente o usa un flujo aparte.',
      });
    }

    // Caches idempotentes (find-or-create).
    const campusCache = new Map<string, string>();
    const shiftCache = new Map<string, string>();
    const gradeCache = new Map<number, string>();
    const groupCache = new Map<string, string>();

    const ensureCampus = async (name: string): Promise<string> => {
      const key = norm(name);
      if (campusCache.has(key)) return campusCache.get(key)!;
      let campus = await this.prisma.campus.findFirst({ where: { institutionId, name }, select: { id: true } });
      if (!campus) { campus = await this.prisma.campus.create({ data: { institutionId, name, address: '' }, select: { id: true } }); _r.ecosistema.sedesCreadas++; }
      campusCache.set(key, campus.id);
      return campus.id;
    };
    const ensureShift = async (campusId: string, jornada: string | undefined): Promise<string> => {
      const type = shiftTypeFromJornada(jornada);
      const key = `${campusId}|${type}`;
      if (shiftCache.has(key)) return shiftCache.get(key)!;
      let shift = await this.prisma.shift.findFirst({ where: { campusId, type }, select: { id: true } });
      if (!shift) {
        const name = { MORNING: 'Jornada Mañana', AFTERNOON: 'Jornada Tarde', SINGLE: 'Jornada Única', NIGHT: 'Jornada Noche' }[type];
        shift = await this.prisma.shift.create({ data: { campusId, name, type }, select: { id: true } }); _r.ecosistema.jornadasCreadas++;
      }
      shiftCache.set(key, shift.id);
      return shift.id;
    };
    const ensureGrade = async (number: number, name: string, stage: any): Promise<string> => {
      if (gradeCache.has(number)) return gradeCache.get(number)!;
      const canonName = canonicalGradeName(name);
      // Reusar por número+etapa (clave canónica): no duplicar por variantes de
      // nombre ("6°" vs "6º" vs "Sexto"). Fallback por nombre canónico.
      let grade = await this.prisma.grade.findFirst({ where: { institutionId, stage, number }, select: { id: true } });
      if (!grade) grade = await this.prisma.grade.findFirst({ where: { institutionId, stage, name: canonName }, select: { id: true } });
      if (!grade) {
        const academicStructure = stage === 'PREESCOLAR' ? 'DIMENSIONS' : 'AREAS_SUBJECTS';
        grade = await this.prisma.grade.create({ data: { institutionId, stage, number, name: canonName, academicStructure }, select: { id: true } }); _r.ecosistema.gradosCreados++;
      }
      gradeCache.set(number, grade.id);
      return grade.id;
    };
    const ensureGroup = async (gradeId: string, campusId: string, shiftId: string, name: string, gradeName: string): Promise<string> => {
      const key = `${gradeId}|${campusId}|${norm(name)}`;
      if (groupCache.has(key)) return groupCache.get(key)!;
      let group = await this.prisma.group.findFirst({ where: { gradeId, campusId, name }, select: { id: true } });
      if (!group) {
        group = await this.prisma.group.create({
          data: { gradeId, campusId, shiftId, name, code: `${gradeName}-${name}`, maxCapacity: 40 },
          select: { id: true },
        }); _r.ecosistema.gruposCreados++;
      }
      groupCache.set(key, group.id);
      return group.id;
    };

    for (const row of rows) {
      try {
        if (!row.documento || row.documento.length < 3) { _r.omitidos++; continue; }
        const parsed = parseCourse(row.curso);
        if (!parsed) { _r.omitidos++; errors.push({ severity: 'blocking', code: 'COURSE_NOT_RECOGNIZED', message: `Curso no reconocido: "${row.curso}"`, location: { row: row.rowNumber, field: 'curso' } }); continue; }

        // Ecosistema (idempotente)
        const campusId = await ensureCampus(row.sede?.trim() || 'Sede Principal');
        const shiftId = await ensureShift(campusId, row.jornada);
        const gradeId = await ensureGrade(parsed.gradeNumber, parsed.gradeName, parsed.stage);
        const groupId = await ensureGroup(gradeId, campusId, shiftId, parsed.groupName, parsed.gradeName);

        // Estudiante (idempotente por documento)
        let student = await this.prisma.student.findFirst({ where: { institutionId, documentNumber: row.documento }, select: { id: true } });
        if (!student) {
          const name = (row.primerApellido || row.primerNombre)
            ? { firstName: row.primerNombre || 'SIN NOMBRE', secondName: row.segundoNombre || null, lastName: row.primerApellido || 'SIN APELLIDO', secondLastName: row.segundoApellido || null }
            : (() => { const s = this.splitName(row.nombreCompleto); return { firstName: s.firstName, secondName: s.secondName || null, lastName: s.lastName, secondLastName: s.secondLastName || null }; })();
          student = await this.prisma.student.create({
            data: { institutionId, documentType: row.tipoDocumento || 'TI', documentNumber: row.documento, ...name },
            select: { id: true },
          });
          _r.estudiantes.creados++;
        } else {
          _r.estudiantes.existentes++;
        }

        // Matrícula (idempotente por studentId+academicYearId)
        const existingEnr = await this.prisma.studentEnrollment.findFirst({
          where: { studentId: student.id, academicYearId }, select: { id: true },
        });
        if (existingEnr) {
          _r.matriculas.existentes++;
        } else {
          await this.prisma.studentEnrollment.create({
            data: { institutionId, studentId: student.id, academicYearId, groupId, status: 'ACTIVE', enrollmentType: 'NEW' },
          });
          _r.matriculas.creadas++;
        }
      } catch (e: any) {
        errors.push({ severity: 'blocking', code: 'ROW_FAILED', message: e?.message || String(e), location: { row: row.rowNumber } });
      }
    }

    const summary: SummaryFact[] = [
      { key: 'creados', label: 'Estudiantes creados', value: String(_r.estudiantes.creados) },
      { key: 'existentes', label: 'Ya registrados', value: String(_r.estudiantes.existentes) },
      { key: 'matriculas', label: 'Matrículas creadas', value: String(_r.matriculas.creadas) },
      { key: 'ecosistema', label: 'Grados/Grupos creados', value: `${_r.ecosistema.gradosCreados}/${_r.ecosistema.gruposCreados}` },
    ];

    return {
      contractVersion: 1,
      summary,
      created: _r.estudiantes.creados,
      updated: 0,
      skipped: _r.omitidos + _r.estudiantes.existentes,
      errors,
      warnings,
    };
  }
}
