import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

import { PrismaService } from '../../prisma/prisma.service';
import { inferEcosystem, InferredEcosystem } from './student-ecosystem-inference.util';

/**
 * MÓDULO 3 (Onboarding v2) — Importador de estudiantes CANÓNICO.
 *
 * Fase "analizar": lee el Excel, INFIERE el ecosistema (grados/grupos/sedes/jornadas)
 * y cuadra estudiantes vs los ya existentes. NO escribe nada. La fase "aplicar"
 * (crear ecosistema + estudiantes + matrículas) irá en la pieza 3/3.
 */

export interface StudentRow {
  rowNumber: number;
  curso: string;
  jornada?: string;
  sede?: string;
  tipoDocumento?: string;
  documento: string;
  nombreCompleto: string;
  fechaNacimiento?: string;
  genero?: string;
  acudienteNombre?: string;
  parentesco?: string;
  telAcudiente?: string;
  correoAcudiente?: string;
}

export interface StudentAnalysis {
  ecosystem: InferredEcosystem;
  students: { total: number; validos: number; nuevos: number; existentes: number };
  guardians: number;
  issues: { curso: string; motivo: string; filas: number }[];
}

function norm(s: any): string {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

@Injectable()
export class StudentImportService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Detección de columnas por encabezado (robusta a orden/posición) ─────────
  private mapColumns(headerRow: ExcelJS.Row): Record<string, number> {
    const map: Record<string, number> = {};
    headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
      const h = norm(cell.value);
      if (!h) return;
      const set = (k: string) => { if (map[k] === undefined) map[k] = col; };
      if (h.includes('curso') || h.includes('grupo')) set('curso');
      else if (h.includes('jornada')) set('jornada');
      else if (h.includes('sede')) set('sede');
      else if (h.includes('tipo') && h.includes('doc')) set('tipoDocumento');
      else if (h.includes('documento') || h.includes('identidad') || h.includes('cedula') || h.includes('identificacion')) set('documento');
      else if (h.includes('nacimiento')) set('fechaNacimiento');
      else if (h.includes('genero') || h.includes('sexo')) set('genero');
      else if (h.includes('acudiente') && (h.includes('correo') || h.includes('email'))) set('correoAcudiente');
      else if (h.includes('acudiente') && (h.includes('tel') || h.includes('cel'))) set('telAcudiente');
      else if (h.includes('parentesco')) set('parentesco');
      else if (h.includes('acudiente')) set('acudienteNombre');
      else if (h.includes('nombre') && h.includes('apellido')) set('nombreCompleto');
      else if (h.includes('apellido')) set('apellidos');
      else if (h.includes('nombre')) set('nombres');
    });
    return map;
  }

  private rowsFromSheet(sheet: ExcelJS.Worksheet): StudentRow[] {
    const cols = this.mapColumns(sheet.getRow(1));
    if (cols.curso === undefined || cols.documento === undefined) {
      throw new BadRequestException(
        'El archivo no tiene las columnas mínimas (Curso y Documento). Descarga la plantilla oficial.',
      );
    }
    const cell = (row: ExcelJS.Row, key: string): string => {
      const c = cols[key];
      return c === undefined ? '' : String(row.getCell(c).value ?? '').trim();
    };
    const rows: StudentRow[] = [];
    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      const curso = cell(row, 'curso');
      const documento = cell(row, 'documento');
      // Nombre: columna combinada, o nombres+apellidos separados.
      const nombreCompleto = cols.nombreCompleto !== undefined
        ? cell(row, 'nombreCompleto')
        : `${cell(row, 'nombres')} ${cell(row, 'apellidos')}`.trim();
      if (!curso && !documento && !nombreCompleto) continue; // fila vacía
      rows.push({
        rowNumber: i,
        curso,
        documento,
        nombreCompleto,
        jornada: cell(row, 'jornada') || undefined,
        sede: cell(row, 'sede') || undefined,
        tipoDocumento: cell(row, 'tipoDocumento') || undefined,
        fechaNacimiento: cell(row, 'fechaNacimiento') || undefined,
        genero: cell(row, 'genero') || undefined,
        acudienteNombre: cell(row, 'acudienteNombre') || undefined,
        parentesco: cell(row, 'parentesco') || undefined,
        telAcudiente: cell(row, 'telAcudiente') || undefined,
        correoAcudiente: cell(row, 'correoAcudiente') || undefined,
      });
    }
    return rows;
  }

  /** Fase ANALIZAR — no escribe nada. */
  async analyze(institutionId: string, buffer: Buffer): Promise<StudentAnalysis> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const sheet = wb.getWorksheet('PLANTILLA') || wb.worksheets[0];
    if (!sheet) throw new BadRequestException('El archivo no contiene hojas.');
    const rows = this.rowsFromSheet(sheet);
    return this.analyzeRows(institutionId, rows);
  }

  /**
   * Núcleo testeable: dada la lista de filas, infiere el ecosistema y cuadra
   * estudiantes vs los existentes (por documento, dentro de la institución).
   */
  async analyzeRows(institutionId: string, rows: StudentRow[]): Promise<StudentAnalysis> {
    const ecosystem = inferEcosystem(
      rows.map((r) => ({ curso: r.curso, jornada: r.jornada, sede: r.sede })),
    );

    const validRows = rows.filter((r) => r.documento && r.documento.length >= 3);
    const sinDocumento = rows.length - validRows.length;

    const docs = [...new Set(validRows.map((r) => r.documento))];
    const existing = docs.length
      ? await this.prisma.student.findMany({
          where: { institutionId, documentNumber: { in: docs } },
          select: { documentNumber: true },
        })
      : [];
    const existingDocs = new Set(existing.map((e) => e.documentNumber));
    const nuevos = validRows.filter((r) => !existingDocs.has(r.documento)).length;

    const guardians = rows.filter((r) => r.acudienteNombre?.trim()).length;

    const issues = [...ecosystem.issues];
    if (sinDocumento > 0) {
      issues.push({
        curso: '—',
        motivo: `${sinDocumento} fila(s) sin documento válido — se omitirán al importar`,
        filas: sinDocumento,
      });
    }

    return {
      ecosystem,
      students: {
        total: rows.length,
        validos: validRows.length,
        nuevos,
        existentes: validRows.length - nuevos,
      },
      guardians,
      issues,
    };
  }
}
