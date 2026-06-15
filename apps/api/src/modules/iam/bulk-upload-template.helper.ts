import * as ExcelJS from 'exceljs';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS REUTILIZABLES PARA PLANTILLAS EXCEL DE EDUSYN
// ═══════════════════════════════════════════════════════════════════════════
// Genera plantillas con 4 hojas estandarizadas: Inicio, Datos, Catálogos,
// Instrucciones. Aplica branding consistente, validaciones de datos y
// ejemplos visuales.
// ═══════════════════════════════════════════════════════════════════════════

export interface ColumnDef {
  header: string;
  key: string;
  width: number;
  required?: boolean;
  /** Lista de valores válidos. Si se provee, se aplica data validation tipo lista. */
  options?: string[];
  /** Texto auxiliar mostrado en la hoja Catálogos */
  hint?: string;
  /** Formato visible (ej: "YYYY-MM-DD") */
  format?: string;
  /** Comentario de celda en el header */
  comment?: string;
}

export interface TemplateTheme {
  /** Color principal del header (sin '#'). Ej: '4F46E5' */
  primary: string;
  /** Nombre legible: 'Docentes', 'Estudiantes', 'Personal' */
  entityName: string;
  /** Verbo: 'docente', 'estudiante', 'usuario' */
  entitySingular: string;
}

const COLOR = {
  required: 'FFE11D48',     // rose-600
  optional: 'FF64748B',     // slate-500
  exampleBg: 'FFF8FAFC',    // slate-50
  exampleText: 'FF94A3B8',  // slate-400
  white: 'FFFFFFFF',
  black: 'FF0F172A',        // slate-900
  borderLight: 'FFE2E8F0',  // slate-200
  hintBg: 'FFFEF3C7',       // amber-100
  hintText: 'FF92400E',     // amber-800
  successBg: 'FFDCFCE7',    // green-100
  successText: 'FF166534',  // green-800
};

// ─────────────────────────────────────────────────────────────────────────
// HOJA 1: "Inicio" — portada con branding y resumen
// ─────────────────────────────────────────────────────────────────────────
export function buildInicioSheet(
  workbook: ExcelJS.Workbook,
  opts: {
    theme: TemplateTheme;
    institutionName?: string;
    description: string;
    quickSteps: string[];
  },
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet('Inicio', {
    properties: { tabColor: { argb: 'FF' + opts.theme.primary } },
    views: [{ showGridLines: false }],
  });

  sheet.columns = [
    { width: 4 },
    { width: 80 },
    { width: 4 },
  ];

  const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + opts.theme.primary } };

  // Fila 1 — banda superior
  sheet.getRow(1).height = 18;
  sheet.mergeCells('A1:C1');
  sheet.getCell('A1').fill = headerFill;

  // Fila 2 — título principal
  sheet.getRow(2).height = 36;
  sheet.mergeCells('A2:C2');
  const titleCell = sheet.getCell('A2');
  titleCell.value = `Plantilla de Carga · ${opts.theme.entityName}`;
  titleCell.font = { name: 'Calibri', size: 22, bold: true, color: { argb: COLOR.white } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = headerFill;

  // Fila 3 — subtítulo
  sheet.getRow(3).height = 22;
  sheet.mergeCells('A3:C3');
  const subCell = sheet.getCell('A3');
  subCell.value = opts.institutionName ? `${opts.institutionName} · Edusyn` : 'Edusyn — Plataforma de Gestión Escolar';
  subCell.font = { name: 'Calibri', size: 11, italic: true, color: { argb: COLOR.white } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  subCell.fill = headerFill;

  // Fila 4 — banda inferior del header
  sheet.getRow(4).height = 12;
  sheet.mergeCells('A4:C4');
  sheet.getCell('A4').fill = headerFill;

  // Descripción
  sheet.getRow(6).height = 8;
  const descCell = sheet.getCell('B7');
  descCell.value = opts.description;
  descCell.font = { name: 'Calibri', size: 12, color: { argb: COLOR.black } };
  descCell.alignment = { wrapText: true, vertical: 'top' };
  sheet.getRow(7).height = 60;

  // Pasos rápidos
  let row = 9;
  sheet.getCell(`B${row}`).value = '🚀  Pasos rápidos';
  sheet.getCell(`B${row}`).font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF' + opts.theme.primary } };
  row++;
  sheet.getRow(row).height = 6;
  row++;

  opts.quickSteps.forEach((step, idx) => {
    const cell = sheet.getCell(`B${row}`);
    cell.value = `${idx + 1}. ${step}`;
    cell.font = { name: 'Calibri', size: 11, color: { argb: COLOR.black } };
    cell.alignment = { wrapText: true, vertical: 'top', indent: 1 };
    sheet.getRow(row).height = 22;
    row++;
  });

  // Tarjeta inferior con leyenda de colores
  row += 2;
  sheet.getCell(`B${row}`).value = '🎨  Leyenda de colores';
  sheet.getCell(`B${row}`).font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF' + opts.theme.primary } };
  row += 2;

  const legendItems = [
    { label: '🔴  Encabezado en rojo', desc: 'Campo obligatorio — debe completarse' },
    { label: '⚪  Encabezado en gris', desc: 'Campo opcional — puede dejarse vacío' },
    { label: '📋  Listas desplegables', desc: 'Pasa el cursor sobre la celda y verás las opciones válidas' },
    { label: '📝  Filas en cursiva gris', desc: 'Son ejemplos — bórralas antes de subir el archivo' },
  ];
  for (const item of legendItems) {
    sheet.getCell(`B${row}`).value = `${item.label}    —    ${item.desc}`;
    sheet.getCell(`B${row}`).font = { name: 'Calibri', size: 11, color: { argb: COLOR.black } };
    sheet.getCell(`B${row}`).alignment = { indent: 1 };
    row++;
  }

  // Footer
  row += 2;
  sheet.mergeCells(`A${row}:C${row}`);
  const footer = sheet.getCell(`A${row}`);
  footer.value = `Generada por Edusyn · ${new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}`;
  footer.font = { name: 'Calibri', size: 9, italic: true, color: { argb: COLOR.optional } };
  footer.alignment = { horizontal: 'center' };

  return sheet;
}

// ─────────────────────────────────────────────────────────────────────────
// HOJA 2: "Datos" — header estilizado + ejemplos + validaciones
// ─────────────────────────────────────────────────────────────────────────
export function buildDataSheet(
  workbook: ExcelJS.Workbook,
  opts: {
    sheetName: string;
    theme: TemplateTheme;
    columns: ColumnDef[];
    examples: Array<Record<string, any>>;
    /** Hojas de catálogos referenciadas por validations (nombre y rango) */
    validationRefs?: Record<string, { sheet: string; range: string }>;
  },
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(opts.sheetName, {
    properties: { tabColor: { argb: 'FF' + opts.theme.primary } },
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  // Definir columnas
  sheet.columns = opts.columns.map(c => ({
    header: c.header + (c.required ? '  *' : ''),
    key: c.key,
    width: c.width,
  }));

  // Estilizar header
  const headerRow = sheet.getRow(1);
  headerRow.height = 32;
  opts.columns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLOR.white } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: col.required ? COLOR.required : 'FF' + opts.theme.primary },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: COLOR.white } },
      left: { style: 'thin', color: { argb: COLOR.white } },
      bottom: { style: 'medium', color: { argb: COLOR.black } },
      right: { style: 'thin', color: { argb: COLOR.white } },
    };

    // Comentario flotante con info adicional
    const commentLines: string[] = [];
    if (col.required) commentLines.push('⚠ Campo obligatorio');
    if (col.options) commentLines.push(`Valores válidos: ${col.options.join(', ')}`);
    if (col.format) commentLines.push(`Formato: ${col.format}`);
    if (col.hint) commentLines.push(col.hint);
    if (col.comment) commentLines.push(col.comment);
    if (commentLines.length > 0) {
      cell.note = commentLines.join('\n');
    }
  });

  // Filas de ejemplo en gris itálico
  for (const ex of opts.examples) {
    const exRow = sheet.addRow(ex);
    exRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: COLOR.exampleText } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLOR.exampleBg },
      };
      cell.border = {
        top: { style: 'thin', color: { argb: COLOR.borderLight } },
        left: { style: 'thin', color: { argb: COLOR.borderLight } },
        bottom: { style: 'thin', color: { argb: COLOR.borderLight } },
        right: { style: 'thin', color: { argb: COLOR.borderLight } },
      };
    });
  }

  // Aviso debajo de los ejemplos
  const noticeRow = sheet.addRow([]);
  const noticeCell = noticeRow.getCell(1);
  sheet.mergeCells(noticeRow.number, 1, noticeRow.number, opts.columns.length);
  noticeCell.value = '⚠  Las filas de arriba son ejemplos. Bórralas o reemplázalas antes de subir el archivo.';
  noticeCell.font = { name: 'Calibri', size: 10, italic: true, bold: true, color: { argb: COLOR.hintText } };
  noticeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.hintBg } };
  noticeCell.alignment = { horizontal: 'center', vertical: 'middle' };
  noticeRow.height = 22;

  // Aplicar autofiltro
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: opts.columns.length },
  };

  // Aplicar data validation para columnas con options o validationRefs
  // Nota: la API `dataValidations` existe en runtime pero los tipos de ExcelJS no la exponen.
  const sheetAny = sheet as any;
  const validationRanges = 1000;
  const dataStartRow = 2;
  opts.columns.forEach((col, idx) => {
    const colLetter = sheet.getColumn(idx + 1).letter;
    const range = `${colLetter}${dataStartRow}:${colLetter}${dataStartRow + validationRanges}`;

    if (col.options && col.options.length > 0) {
      const formula = '"' + col.options.map(o => o.replace(/"/g, '""')).join(',') + '"';
      try {
        sheetAny.dataValidations.add(range, {
          type: 'list',
          allowBlank: !col.required,
          formulae: [formula],
          showErrorMessage: true,
          errorTitle: 'Valor inválido',
          error: `Solo se permiten estos valores: ${col.options.join(', ')}`,
        });
      } catch { /* ignorar */ }
    } else if (opts.validationRefs && opts.validationRefs[col.key]) {
      const ref = opts.validationRefs[col.key];
      try {
        sheetAny.dataValidations.add(range, {
          type: 'list',
          allowBlank: !col.required,
          formulae: [`'${ref.sheet}'!${ref.range}`],
          showErrorMessage: true,
          errorTitle: 'Valor inválido',
          error: `Selecciona un valor de la hoja "${ref.sheet}"`,
        });
      } catch { /* ignorar */ }
    }
  });

  return sheet;
}

// ─────────────────────────────────────────────────────────────────────────
// HOJA 3: "Catálogos" — listas de referencia
// ─────────────────────────────────────────────────────────────────────────
export interface CatalogBlock {
  title: string;
  headers: string[];
  rows: Array<Array<string | number>>;
  /** Si se provee, esta clave servirá como rango con nombre para data validation */
  rangeKey?: string;
}

export function buildCatalogosSheet(
  workbook: ExcelJS.Workbook,
  opts: {
    theme: TemplateTheme;
    blocks: CatalogBlock[];
  },
): { sheet: ExcelJS.Worksheet; ranges: Record<string, { sheet: string; range: string }> } {
  const sheet = workbook.addWorksheet('Catálogos', {
    properties: { tabColor: { argb: 'FFCBD5E1' } },
    views: [{ showGridLines: false }],
  });

  sheet.columns = [
    { width: 4 },
    { width: 30 },
    { width: 40 },
    { width: 30 },
  ];

  const ranges: Record<string, { sheet: string; range: string }> = {};
  let row = 2;

  for (const block of opts.blocks) {
    // Título del bloque
    sheet.mergeCells(`B${row}:D${row}`);
    const titleCell = sheet.getCell(`B${row}`);
    titleCell.value = block.title;
    titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: COLOR.white } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + opts.theme.primary } };
    titleCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    sheet.getRow(row).height = 24;
    row++;

    // Headers
    block.headers.forEach((h, i) => {
      const cell = sheet.getCell(row, 2 + i);
      cell.value = h;
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLOR.black } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.exampleBg } };
      cell.border = { bottom: { style: 'thin', color: { argb: COLOR.borderLight } } };
    });
    row++;

    // Filas de datos
    const dataStart = row;
    for (const r of block.rows) {
      r.forEach((v, i) => {
        const cell = sheet.getCell(row, 2 + i);
        cell.value = v;
        cell.font = { name: 'Calibri', size: 10, color: { argb: COLOR.black } };
        cell.alignment = { vertical: 'middle' };
      });
      row++;
    }
    const dataEnd = row - 1;

    if (block.rangeKey && dataEnd >= dataStart) {
      const colLetter = sheet.getColumn(2).letter; // primera columna del bloque
      ranges[block.rangeKey] = { sheet: 'Catálogos', range: `$${colLetter}$${dataStart}:$${colLetter}$${dataEnd}` };
    }

    row += 2; // espacio entre bloques
  }

  return { sheet, ranges };
}

// ─────────────────────────────────────────────────────────────────────────
// HOJA 4: "Instrucciones" — paso a paso + errores comunes
// ─────────────────────────────────────────────────────────────────────────
export interface InstructionSection {
  title: string;
  /** Cada item puede ser un string (paso normal) o un objeto con tip/warning */
  items: Array<string | { type: 'tip' | 'warning' | 'success'; text: string }>;
}

export function buildInstruccionesSheet(
  workbook: ExcelJS.Workbook,
  opts: {
    theme: TemplateTheme;
    sections: InstructionSection[];
    commonErrors?: Array<{ error: string; cause: string; fix: string }>;
  },
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet('Instrucciones', {
    properties: { tabColor: { argb: 'FF94A3B8' } },
    views: [{ showGridLines: false }],
  });

  sheet.columns = [
    { width: 4 },
    { width: 90 },
  ];

  let row = 2;

  // Título principal
  sheet.mergeCells(`A${row}:B${row}`);
  const mainTitle = sheet.getCell(`A${row}`);
  mainTitle.value = `📖  Cómo cargar ${opts.theme.entitySingular}s en Edusyn`;
  mainTitle.font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FF' + opts.theme.primary } };
  mainTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(row).height = 36;
  row += 2;

  // Secciones
  for (const section of opts.sections) {
    sheet.getCell(`B${row}`).value = section.title;
    sheet.getCell(`B${row}`).font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF' + opts.theme.primary } };
    sheet.getRow(row).height = 22;
    row++;

    for (const item of section.items) {
      const cell = sheet.getCell(`B${row}`);
      if (typeof item === 'string') {
        cell.value = item;
        cell.font = { name: 'Calibri', size: 11, color: { argb: COLOR.black } };
      } else {
        const prefix = item.type === 'tip' ? '💡  ' : item.type === 'warning' ? '⚠  ' : '✅  ';
        cell.value = prefix + item.text;
        cell.font = { name: 'Calibri', size: 11, color: { argb: COLOR.black }, italic: item.type === 'tip' };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: item.type === 'warning' ? COLOR.hintBg : item.type === 'success' ? COLOR.successBg : COLOR.exampleBg },
        };
      }
      cell.alignment = { wrapText: true, vertical: 'top', indent: 1 };
      sheet.getRow(row).height = 22;
      row++;
    }
    row++;
  }

  // Errores comunes
  if (opts.commonErrors && opts.commonErrors.length > 0) {
    sheet.getCell(`B${row}`).value = '🛟  Errores comunes y cómo solucionarlos';
    sheet.getCell(`B${row}`).font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF' + opts.theme.primary } };
    sheet.getRow(row).height = 22;
    row += 2;

    for (const err of opts.commonErrors) {
      // Caja de error
      sheet.getCell(`B${row}`).value = `❌  ${err.error}`;
      sheet.getCell(`B${row}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLOR.required } };
      row++;
      sheet.getCell(`B${row}`).value = `   Causa: ${err.cause}`;
      sheet.getCell(`B${row}`).font = { name: 'Calibri', size: 10, color: { argb: COLOR.optional } };
      sheet.getCell(`B${row}`).alignment = { wrapText: true };
      sheet.getRow(row).height = 18;
      row++;
      sheet.getCell(`B${row}`).value = `   Solución: ${err.fix}`;
      sheet.getCell(`B${row}`).font = { name: 'Calibri', size: 10, color: { argb: COLOR.successText } };
      sheet.getCell(`B${row}`).alignment = { wrapText: true };
      sheet.getRow(row).height = 18;
      row += 2;
    }
  }

  return sheet;
}
