import * as ExcelJS from 'exceljs';
import { writeReportSheet } from './excel-report.helper';

describe('writeReportSheet', () => {
  function build() {
    const wb = new ExcelJS.Workbook();
    const sheet = writeReportSheet(wb, {
      sheetName: 'Test',
      institutionName: 'Colegio X',
      title: 'Reporte de Prueba',
      subtitle: 'Grupo 5A · P1',
      columns: [
        { header: 'Estudiante', width: 20 },
        { header: 'Nota', numFmt: '0.0', isGrade: true, align: 'center' },
      ],
      rows: [
        ['PEREZ JUAN', 2.0], // reprobado
        ['GOMEZ ANA', 4.5],  // aprobado
      ],
      failBelow: 3.0,
      summary: [['Total', 2]],
    });
    return { wb, sheet };
  }

  it('coloca el encabezado tras el bloque de título y congela el panel ahí', () => {
    const { sheet } = build();
    // Título(1) + subtítulo(1) + institución(1) + fecha(1) + espaciador(1) = fila 6 encabezado
    const headerRow = 6;
    expect(sheet.getCell(`A${headerRow}`).value).toBe('Estudiante');
    expect(sheet.getCell(`B${headerRow}`).value).toBe('Nota');
    expect((sheet.views[0] as any).ySplit).toBe(headerRow);
    expect(sheet.autoFilter).toBeTruthy();
  });

  it('resalta en rojo la nota reprobada (< failBelow) y no la aprobada', () => {
    const { sheet } = build();
    const failCell = sheet.getCell('B7'); // PEREZ 2.0
    const okCell = sheet.getCell('B8');   // GOMEZ 4.5
    expect((failCell.fill as any)?.fgColor?.argb).toBe('FFFEE2E2');
    expect((failCell.font as any)?.color?.argb).toBe('FFB91C1C');
    expect((okCell.fill as any)?.fgColor?.argb).not.toBe('FFFEE2E2');
  });

  it('aplica formato numérico a la columna de nota', () => {
    const { sheet } = build();
    expect(sheet.getCell('B7').numFmt).toBe('0.0');
  });

  it('escribe el resumen al pie', () => {
    const { sheet } = build();
    // header 6, datos 7-8, espaciador 9, resumen 10
    expect(sheet.getCell('A10').value).toBe('Total');
    expect(sheet.getCell('B10').value).toBe(2);
  });
});
