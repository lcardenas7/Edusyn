/**
 * EXCEL REPORT HELPER
 *
 * Formateador compartido para las exportaciones Excel. Aplica un estilo consistente y
 * "presentable": bloque de título (institución, reporte, contexto, fecha), encabezado con
 * relleno + bordes, panel congelado, autofiltro, cebra, formato numérico y resaltado de
 * notas reprobadas. NO contiene lógica de datos — solo formato.
 */
import * as ExcelJS from 'exceljs';

export interface ExcelColumn {
  header: string;
  width?: number;
  numFmt?: string; // p. ej. '0.0'
  align?: 'left' | 'center' | 'right';
  isGrade?: boolean; // resaltar en rojo si el valor < failBelow
}

export interface WriteReportOptions {
  sheetName: string;
  title: string;
  subtitle?: string;
  institutionName?: string;
  columns: ExcelColumn[];
  rows: Array<Array<string | number | null | undefined>>;
  failBelow?: number; // umbral aprobatorio para el resaltado de columnas isGrade
  summary?: Array<[string, string | number]>;
}

// Paleta (coherente con la UI: azul institucional + slate)
const HEADER_FILL = 'FF1E3A8A';
const ZEBRA_FILL = 'FFF1F5F9';
const FAIL_FILL = 'FFFEE2E2';
const FAIL_FONT = 'FFB91C1C';
const BORDER = 'FFCBD5E1';

const THIN = { style: 'thin' as const, color: { argb: BORDER } };
const ALL_BORDERS = { top: THIN, left: THIN, bottom: THIN, right: THIN };

function colLetter(n: number): string {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Escribe una hoja con estilo consistente a partir de columnas + filas.
 * Devuelve la hoja por si se quiere post-procesar.
 */
export function writeReportSheet(workbook: ExcelJS.Workbook, opts: WriteReportOptions): ExcelJS.Worksheet {
  const { sheetName, title, subtitle, institutionName, columns, rows, failBelow, summary } = opts;
  const sheet = workbook.addWorksheet(sheetName);
  const colCount = columns.length;
  const lastCol = colLetter(colCount);

  let r = 1;
  const mergeLine = (value: string, font: Partial<ExcelJS.Font>, align: 'center' | 'right' = 'center', height?: number) => {
    sheet.mergeCells(`A${r}:${lastCol}${r}`);
    const cell = sheet.getCell(`A${r}`);
    cell.value = value;
    cell.font = font;
    cell.alignment = { horizontal: align, vertical: 'middle' };
    if (height) sheet.getRow(r).height = height;
    r++;
  };

  if (institutionName) mergeLine(institutionName, { bold: true, size: 13, color: { argb: 'FF0F172A' } }, 'center', 20);
  mergeLine(title, { bold: true, size: 12, color: { argb: 'FF1E3A8A' } }, 'center', 18);
  if (subtitle) mergeLine(subtitle, { italic: true, size: 10, color: { argb: 'FF475569' } });
  mergeLine(`Generado: ${new Date().toLocaleString('es-CO')}`, { size: 8, color: { argb: 'FF94A3B8' } }, 'right');
  r++; // espaciador

  // Encabezado
  const headerRowIdx = r;
  const headerRow = sheet.getRow(headerRowIdx);
  columns.forEach((col, i) => {
    const c = headerRow.getCell(i + 1);
    c.value = col.header;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = ALL_BORDERS;
  });
  headerRow.height = 24;

  // Filas de datos
  rows.forEach((row, ri) => {
    const excelRow = sheet.getRow(headerRowIdx + 1 + ri);
    columns.forEach((col, ci) => {
      const cell = excelRow.getCell(ci + 1);
      const val = row[ci];
      cell.value = val === undefined || val === '' ? null : val;
      cell.border = ALL_BORDERS;
      cell.alignment = { horizontal: col.align ?? (typeof val === 'number' ? 'center' : 'left'), vertical: 'middle' };
      if (col.numFmt && typeof cell.value === 'number') cell.numFmt = col.numFmt;
      if (ri % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA_FILL } };
      // Resaltado de reprobado (sobreescribe la cebra)
      if (col.isGrade && typeof val === 'number' && failBelow !== undefined && val < failBelow) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FAIL_FILL } };
        cell.font = { color: { argb: FAIL_FONT }, bold: true };
      }
    });
  });

  // Congelar el encabezado y activar autofiltro
  sheet.views = [{ state: 'frozen', ySplit: headerRowIdx }];
  sheet.autoFilter = { from: { row: headerRowIdx, column: 1 }, to: { row: headerRowIdx, column: colCount } };

  // Resumen al pie
  if (summary && summary.length) {
    let sr = headerRowIdx + 1 + rows.length + 1; // espaciador
    for (const [label, value] of summary) {
      const lc = sheet.getCell(`A${sr}`);
      lc.value = label;
      lc.font = { bold: true, color: { argb: 'FF334155' } };
      sheet.getCell(`B${sr}`).value = value as any;
      sr++;
    }
  }

  // Anchos de columna (respeta width explícito; si no, autoajusta)
  columns.forEach((col, i) => {
    const column = sheet.getColumn(i + 1);
    if (col.width) {
      column.width = col.width;
      return;
    }
    let maxLen = col.header.length;
    for (const row of rows) {
      const v = row[i];
      const len = v === null || v === undefined ? 0 : String(v).length;
      if (len > maxLen) maxLen = len;
    }
    column.width = Math.min(Math.max(maxLen + 2, 10), 45);
  });

  return sheet;
}
