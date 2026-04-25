import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as ExcelJS from 'exceljs';

// ═══════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

interface SubjectColumns {
  subjectName: string;
  cogCol: number;
  procCol: number;
  actCol: number;
  defCol: number;
}

interface SystemStudentMatch {
  studentId: string;
  fullName: string;
  documentNumber: string;
  enrollmentId: string;
}

interface StudentGradeRow {
  rowNumber: number;
  fullName: string;
  documentNumber: string;
  groupCode: string;
  grades: Array<{
    subjectName: string;
    cognitivo: number | null;
    procedimental: number | null;
    actitudinal: number | null;
    definitiva: number | null;
  }>;
}

export interface GradesImportResult {
  success: boolean;
  summary: {
    totalStudents: number;
    studentsCreated: number;
    studentsUpdated: number;
    studentsDeactivated: number;
    gradesImported: number;
    subjectsFound: number;
  };
  errors: Array<{ row: number; message: string; data?: any }>;
  warnings: Array<{ row: number; message: string }>;
  details: {
    created: Array<{ name: string; document: string }>;
    deactivated: Array<{ name: string; document: string }>;
    subjectsNotFound: string[];
  };
}

export interface PreviewResult {
  students: Array<{
    rowNumber: number;
    fullName: string;
    documentNumber: string;
    groupCode: string;
    existsInSystem: boolean;
    enrollmentId?: string;
  }>;
  subjects: Array<{
    name: string;
    foundInSystem: boolean;
    subjectId?: string;
  }>;
  studentsInSystemNotInExcel: Array<{
    name: string;
    documentNumber: string;
    enrollmentId: string;
  }>;
  canProceed: boolean;
  warnings: string[];
}

@Injectable()
export class GradesBulkImportService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // PREVIEW: Analizar Excel sin aplicar cambios
  // ═══════════════════════════════════════════════════════════════════════════

  async previewImport(
    institutionId: string,
    gradeId: string,
    academicTermId: string,
    buffer: Buffer,
  ): Promise<PreviewResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    // Obtener la hoja de datos real (la plantilla genera INSTRUCCIONES primero)
    const sheet = this.getImportWorksheet(workbook);
    if (!sheet) {
      throw new BadRequestException('El archivo Excel no contiene hojas');
    }

    // Detectar estructura de columnas
    const { subjectColumns, nameCol, docCol, groupCol, headerRowNum } = this.detectColumnStructure(sheet);

    // Leer estudiantes del Excel
    const excelStudents = this.readStudentsFromSheet(sheet, nameCol, docCol, groupCol, subjectColumns, headerRowNum);

    // Obtener estudiantes actuales del sistema para este grado
    const systemStudents = await this.getSystemStudents(institutionId, gradeId);

    // Obtener asignaturas del sistema para este grado
    const systemSubjects = await this.getSystemSubjects(institutionId, gradeId);

    // Comparar estudiantes
    const matchedStudentIds = new Set<string>();
    const studentsPreview = excelStudents.map(es => {
      const found = this.findBestStudentMatch(systemStudents, es.fullName, es.documentNumber);
      if (found) {
        matchedStudentIds.add(found.studentId);
      }
      return {
        rowNumber: es.rowNumber,
        fullName: es.fullName,
        documentNumber: es.documentNumber,
        groupCode: es.groupCode,
        existsInSystem: !!found,
        enrollmentId: found?.enrollmentId,
      };
    });

    // Estudiantes en sistema que no están en Excel
    const studentsInSystemNotInExcel = systemStudents
      .filter(ss => !matchedStudentIds.has(ss.studentId))
      .map(ss => ({
        name: ss.fullName,
        documentNumber: ss.documentNumber,
        enrollmentId: ss.enrollmentId,
      }));

    // Comparar asignaturas
    const subjectsPreview = subjectColumns.map(sc => {
      const found = systemSubjects.find(ss => 
        this.normalizeSubjectName(ss.name) === this.normalizeSubjectName(sc.subjectName)
      );
      return {
        name: sc.subjectName,
        foundInSystem: !!found,
        subjectId: found?.id,
      };
    });

    const warnings: string[] = [];
    if (studentsInSystemNotInExcel.length > 0) {
      warnings.push(`${studentsInSystemNotInExcel.length} estudiantes del sistema no están en el Excel y serán eliminados del sistema`);
    }
    const notFoundSubjects = subjectsPreview.filter(s => !s.foundInSystem);
    if (notFoundSubjects.length > 0) {
      warnings.push(`${notFoundSubjects.length} asignaturas del Excel no se encontraron en el sistema: ${notFoundSubjects.map(s => s.name).join(', ')}`);
    }

    return {
      students: studentsPreview,
      subjects: subjectsPreview,
      studentsInSystemNotInExcel,
      canProceed: subjectsPreview.some(s => s.foundInSystem),
      warnings,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // IMPORT: Aplicar importación de notas
  // ═══════════════════════════════════════════════════════════════════════════

  async importGrades(
    institutionId: string,
    gradeId: string,
    academicTermId: string,
    buffer: Buffer,
    options: {
      createMissingStudents: boolean;
      deactivateMissingStudents: boolean;
      overwriteExistingGrades: boolean;
    },
  ): Promise<GradesImportResult> {
    // Validar que el período no esté finalizado
    await this.guardTermNotFinalized(academicTermId);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const sheet = this.getImportWorksheet(workbook);
    if (!sheet) {
      throw new BadRequestException('El archivo Excel no contiene hojas');
    }

    const { subjectColumns, nameCol, docCol, groupCol, headerRowNum } = this.detectColumnStructure(sheet);
    const excelStudents = this.readStudentsFromSheet(sheet, nameCol, docCol, groupCol, subjectColumns, headerRowNum);

    // Obtener datos del sistema
    const systemStudents = await this.getSystemStudents(institutionId, gradeId);
    const systemSubjects = await this.getSystemSubjects(institutionId, gradeId);
    const academicYear = await this.getActiveAcademicYear(institutionId);

    const result: GradesImportResult = {
      success: true,
      summary: {
        totalStudents: excelStudents.length,
        studentsCreated: 0,
        studentsUpdated: 0,
        studentsDeactivated: 0,
        gradesImported: 0,
        subjectsFound: 0,
      },
      errors: [],
      warnings: [],
      details: {
        created: [],
        deactivated: [],
        subjectsNotFound: [],
      },
    };

    const keptStudentIds = new Set<string>();

    // Mapear asignaturas Excel → Sistema
    const subjectMap = new Map<string, { id: string; name: string }>();
    for (const sc of subjectColumns) {
      const found = systemSubjects.find(ss => 
        this.normalizeSubjectName(ss.name) === this.normalizeSubjectName(sc.subjectName)
      );
      if (found) {
        subjectMap.set(sc.subjectName, { id: found.id, name: found.name });
        result.summary.subjectsFound++;
      } else {
        result.details.subjectsNotFound.push(sc.subjectName);
      }
    }

    // Procesar cada estudiante
    for (const excelStudent of excelStudents) {
      try {
        // 1. Buscar estudiante en el grado actual
        let systemStudent = this.findBestStudentMatch(systemStudents, excelStudent.fullName, excelStudent.documentNumber);

        let enrollmentId: string;

        if (!systemStudent) {
          // 2. Buscar en toda la institución (puede estar en otro grado)
          const globalStudent = await this.findStudentInInstitutionByDocumentOrName(
            institutionId,
            excelStudent.documentNumber,
            excelStudent.fullName,
          );

          if (globalStudent) {
            // Estudiante existe en la institución, rematricularlo en el grupo correcto
            const group = await this.findBestGroupMatch(gradeId, excelStudent.groupCode);

            if (group) {
              await this.syncStudentIdentity(globalStudent.studentId, excelStudent);
              enrollmentId = await this.reEnrollStudent(
                institutionId,
                globalStudent.studentId,
                academicYear.id,
                group.id,
              );
              keptStudentIds.add(globalStudent.studentId);
              result.summary.studentsUpdated++;
            } else {
              result.warnings.push({
                row: excelStudent.rowNumber,
                message: `Grupo no encontrado: ${excelStudent.groupCode}`,
              });
              continue;
            }
          } else if (options.createMissingStudents) {
            // 3. Estudiante no existe en ningún lado, crear nuevo
            const created = await this.createStudentWithEnrollment(
              institutionId,
              gradeId,
              academicYear.id,
              excelStudent,
            );
            enrollmentId = created.enrollmentId;
            keptStudentIds.add(created.studentId);
            result.summary.studentsCreated++;
            result.details.created.push({
              name: excelStudent.fullName,
              document: excelStudent.documentNumber,
            });
          } else {
            result.warnings.push({
              row: excelStudent.rowNumber,
              message: `Estudiante no encontrado: ${excelStudent.fullName} (${excelStudent.documentNumber})`,
            });
            continue;
          }
        } else {
          await this.syncStudentIdentity(systemStudent.studentId, excelStudent);
          keptStudentIds.add(systemStudent.studentId);
          enrollmentId = systemStudent.enrollmentId;
          result.summary.studentsUpdated++;
        }

        // Importar notas del estudiante
        for (const grade of excelStudent.grades) {
          const subjectInfo = subjectMap.get(grade.subjectName);
          if (!subjectInfo) continue;

          // Buscar TeacherAssignment para esta asignatura y grupo
          const assignment = await this.findTeacherAssignment(
            institutionId,
            academicYear.id,
            gradeId,
            excelStudent.groupCode,
            subjectInfo.id,
          );

          if (!assignment) {
            result.warnings.push({
              row: excelStudent.rowNumber,
              message: `No hay docente asignado para ${grade.subjectName} en ${excelStudent.groupCode}`,
            });
            continue;
          }

          // Insertar notas parciales
          await this.upsertPartialGrades(
            institutionId,
            enrollmentId,
            assignment.id,
            academicTermId,
            grade,
            options.overwriteExistingGrades,
          );
          result.summary.gradesImported++;
        }
      } catch (error: any) {
        result.errors.push({
          row: excelStudent.rowNumber,
          message: error.message,
          data: { name: excelStudent.fullName, document: excelStudent.documentNumber },
        });
      }
    }

    // Eliminar estudiantes que no están en el Excel (regla solicitada: eliminación forzada)
    const toDelete = systemStudents.filter(ss => !keptStudentIds.has(ss.studentId));

    for (const student of toDelete) {
      await this.forceDeleteStudent(student.studentId);
      result.summary.studentsDeactivated++;
      result.details.deactivated.push({
        name: student.fullName,
        document: student.documentNumber,
      });
    }

    result.success = result.errors.length === 0;
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS PRIVADOS
  // ═══════════════════════════════════════════════════════════════════════════

  private async guardTermNotFinalized(academicTermId: string): Promise<void> {
    const term = await this.prisma.academicTerm.findUnique({
      where: { id: academicTermId },
      select: { status: true },
    });

    if (term?.status === 'FINALIZED') {
      throw new ForbiddenException(
        'El período está finalizado. Debe reabrirse para importar notas.',
      );
    }
  }

  private detectColumnStructure(sheet: ExcelJS.Worksheet): {
    subjectColumns: SubjectColumns[];
    nameCol: number;
    docCol: number;
    groupCol: number;
    headerRowNum: number;
  } {
    const subjectStartCol = 10; // J

    // Buscar fila de encabezados (puede estar en fila 1, 2 o 3)
    let headerRow: ExcelJS.Row | undefined;
    let headerRowNum = 1;

    for (let i = 1; i <= 5; i++) {
      const row = sheet.getRow(i);
      const values = this.getRowTexts(row);
      const hasNameHeader = values.some(v => /NOMBRES?/i.test(v) || /APELLIDOS?/i.test(v));
      const hasDocumentHeader = values.some(v => /DOC|IDENTIDAD|C[EÉ]DULA/i.test(v));
      const hasGroupHeader = values.some(v => /GRUPO|CURSO/i.test(v));

      // Si la fila tiene al menos dos marcas de encabezado, la tomamos como cabecera
      if ((hasNameHeader && hasDocumentHeader) || (hasNameHeader && hasGroupHeader) || (hasDocumentHeader && hasGroupHeader)) {
        headerRow = row;
        headerRowNum = i;
        break;
      }
    }

    if (!headerRow) {
      // Fallback: buscar la fila que más se parezca al encabezado esperado
      let bestScore = 0;
      for (let i = 1; i <= Math.min(sheet.rowCount, 10); i++) {
        const row = sheet.getRow(i);
        const values = this.getRowTexts(row);
        const score = [
          values.some(v => /NOMBRES?/i.test(v) || /APELLIDOS?/i.test(v)) ? 1 : 0,
          values.some(v => /DOC|IDENTIDAD|C[EÉ]DULA/i.test(v)) ? 1 : 0,
          values.some(v => /GRUPO|CURSO/i.test(v)) ? 1 : 0,
        ].reduce((acc, item) => acc + item, 0);

        if (score > bestScore) {
          bestScore = score;
          headerRow = row;
          headerRowNum = i;
        }
      }

      if (!headerRow || bestScore === 0) {
        throw new BadRequestException('No se encontró la fila de encabezados');
      }
    }

    const headers = this.getRowTexts(headerRow);
    let nameCol = -1;
    let docCol = -1;
    let groupCol = -1;
    const subjectColumns: SubjectColumns[] = [];

    // Detectar columnas básicas
    for (let i = 0; i < headers.length; i++) {
      const h = this.normalizeString(headers[i] || '').toUpperCase().trim();
      if ((h.includes('NOMBRE') || h.includes('NOMBRES')) && (h.includes('APELLIDO') || h.includes('APELLIDOS'))) {
        nameCol = i + 1;
      } else if (h.includes('DOC') || h.includes('IDENTIDAD') || h.includes('CEDULA')) {
        docCol = i + 1;
      } else if (h === 'GRUPO' || h === 'CURSO' || h === 'GRUPO/CURSO') {
        groupCol = i + 1;
      }
    }

    // Fallback suave solo si no se encontró una columna real de grupo
    if (groupCol === -1) {
      for (let i = 0; i < headers.length; i++) {
        const h = this.normalizeString(headers[i] || '').toUpperCase().trim();
        if ((h.includes('GRUPO') || h.includes('CURSO')) && !h.includes('DIRECTOR')) {
          groupCol = i + 1;
          break;
        }
      }
    }

    // Detectar asignaturas por patrón: buscar secuencias de COG, PROC, ACT, DEF
    // El patrón típico es: IHS | COG | PROC | ACT | DEF | DESEMP (o variantes)
    let currentSubject: string | null = null;
    let cogCol = -1;
    let procCol = -1;
    let actCol = -1;
    let defCol = -1;

    // Buscar fila de nombres de asignaturas (puede estar una fila arriba de los encabezados)
    const subjectRow = headerRowNum > 1 ? sheet.getRow(headerRowNum - 1) : null;
    const subjectHeaders = subjectRow ? (subjectRow.values as any[]) : [];

    // También revisar la última fila para nombres de asignaturas (como en tu Excel)
    const lastDataRow = sheet.lastRow;
    const lastRowValues = lastDataRow ? lastDataRow.values as any[] : [];

    for (let i = subjectStartCol - 1; i < headers.length; i++) {
      const h = String(headers[i] || '').toUpperCase().trim();
      
      // Detectar columnas de notas
      if (h === 'COG' || h.includes('COGNITIVO')) {
        cogCol = i + 1;
        // Buscar nombre de asignatura en fila superior o inferior
        currentSubject = this.findSubjectName(subjectHeaders, lastRowValues, i);
      } else if (h === 'PROC' || h.includes('PROCEDIMENTAL')) {
        procCol = i + 1;
      } else if (h === 'ACT' || h.includes('ACTITUDINAL')) {
        actCol = i + 1;
      } else if (h === 'DEF' || h === 'DEFIN' || h.includes('DEFINITIVA')) {
        defCol = i + 1;
        
        // Al encontrar DEF, guardamos la asignatura completa
        if (currentSubject && cogCol > 0 && !currentSubject.startsWith('Asignatura_Col')) {
          subjectColumns.push({
            subjectName: currentSubject,
            cogCol,
            procCol: procCol > 0 ? procCol : cogCol,
            actCol: actCol > 0 ? actCol : cogCol,
            defCol,
          });
        }
        
        // Reset para próxima asignatura
        currentSubject = null;
        cogCol = -1;
        procCol = -1;
        actCol = -1;
        defCol = -1;
      }
    }

    // Si no se detectaron asignaturas, intentar detección alternativa
    if (subjectColumns.length === 0) {
      // Buscar en la última fila (donde están los nombres de asignaturas en tu Excel)
      const lastRow = sheet.getRow(sheet.rowCount);
      const lastRowVals = lastRow.values as any[];
      
      for (let i = subjectStartCol - 1; i < lastRowVals.length; i++) {
        const val = String(lastRowVals[i + 1] || '').trim();
        if (val && !['', 'MATEMATICAS', 'ESTADISTICA', 'LENGUAJE'].includes(val.toUpperCase())) {
          // Es un nombre de asignatura, buscar sus columnas
          const subjectName = val;
          // Buscar COG, PROC, ACT, DEF en las columnas cercanas
          for (let j = i; j < Math.min(i + 10, headers.length); j++) {
            const h = String(headers[j] || '').toUpperCase().trim();
            if (h === 'COG') cogCol = j + 1;
            if (h === 'PROC' || h === 'PROCACT') procCol = j + 1;
            if (h === 'ACT') actCol = j + 1;
            if (h === 'DEF' || h === 'DEFIN') {
              defCol = j + 1;
              if (cogCol > 0) {
                subjectColumns.push({
                  subjectName,
                  cogCol,
                  procCol: procCol > 0 ? procCol : cogCol,
                  actCol: actCol > 0 ? actCol : cogCol,
                  defCol,
                });
              }
              cogCol = -1;
              procCol = -1;
              actCol = -1;
              defCol = -1;
              break;
            }
          }
        }
      }
    }

    if (nameCol === -1) {
      throw new BadRequestException('No se encontró la columna de nombres');
    }
    if (docCol === -1) {
      throw new BadRequestException('No se encontró la columna de documento');
    }

    return { subjectColumns, nameCol, docCol, groupCol, headerRowNum };
  }

  private findSubjectName(subjectHeaders: any[], lastRowValues: any[], colIndex: number): string {
    const subjectStartCol = 9; // J en índice 0-based
    const excelColIndex = colIndex + 1; // ExcelJS row.values es 1-based

    // Buscar en fila de encabezados de asignaturas
    for (let i = excelColIndex; i >= subjectStartCol + 1; i--) {
      const val = String(subjectHeaders[i] || '').trim();
      if (this.isLikelySubjectName(val)) {
        return val;
      }
    }
    
    // Buscar en última fila
    for (let i = excelColIndex; i >= subjectStartCol + 1; i--) {
      const val = String(lastRowValues[i] || '').trim();
      if (this.isLikelySubjectName(val)) {
        return val;
      }
    }
    
    return `Asignatura_Col${colIndex + 1}`;
  }

  private isLikelySubjectName(value: string): boolean {
    const normalized = this.normalizeString(value);
    if (!normalized) return false;

    const upper = normalized.toUpperCase();
    const forbidden = new Set(['COG', 'PROC', 'ACT', 'DEF', 'DEFIN', 'IHS', 'NOMBRE', 'NOMBRES', 'GRUPO', 'CURSO']);
    if (forbidden.has(upper)) return false;

    if (/^(19|20)\d{2}$/.test(normalized)) return false;
    if (/^\d+(?:[.,]\d+)?$/.test(normalized)) return false;
    if (!/[a-záéíóúñ]/i.test(normalized)) return false;

    return normalized.length > 2;
  }

  private readStudentsFromSheet(
    sheet: ExcelJS.Worksheet,
    nameCol: number,
    docCol: number,
    groupCol: number,
    subjectColumns: SubjectColumns[],
    headerRowNum?: number,
  ): StudentGradeRow[] {
    const students: StudentGradeRow[] = [];
    
    // Encontrar fila de inicio de datos (después de encabezados)
    const startRow = (headerRowNum || 1) + 1;

    // Leer datos
    for (let rowNum = startRow; rowNum <= sheet.rowCount; rowNum++) {
      const row = sheet.getRow(rowNum);
      const fullName = String(row.getCell(nameCol).value || '').trim();
      const documentNumber = String(row.getCell(docCol).value || '').trim();
      const groupCode = groupCol > 0 ? String(row.getCell(groupCol).value || '').trim() : '';

      // Saltar filas vacías o de totales
      if (!fullName || fullName.toUpperCase().includes('TOTAL') || !documentNumber) {
        continue;
      }

      // Saltar si el documento no parece válido (menos de 5 caracteres)
      if (documentNumber.length < 5) {
        continue;
      }

      const grades: StudentGradeRow['grades'] = [];

      for (const sc of subjectColumns) {
        const cognitivo = this.parseGrade(row.getCell(sc.cogCol).value);
        const procedimental = this.parseGrade(row.getCell(sc.procCol).value);
        const actitudinal = this.parseGrade(row.getCell(sc.actCol).value);
        const definitiva = this.parseGrade(row.getCell(sc.defCol).value);

        grades.push({
          subjectName: sc.subjectName,
          cognitivo,
          procedimental,
          actitudinal,
          definitiva,
        });
      }

      students.push({
        rowNumber: rowNum,
        fullName,
        documentNumber,
        groupCode,
        grades,
      });
    }

    return students;
  }

  private getRowTexts(row: ExcelJS.Row): string[] {
    const texts: string[] = [];
    row.eachCell({ includeEmpty: true }, cell => {
      texts.push(String(cell.text ?? cell.value ?? '').trim());
    });
    return texts;
  }

  private parseGrade(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const num = parseFloat(String(value).replace(',', '.'));
    return isNaN(num) ? null : Math.round(num * 10) / 10;
  }

  private async getSystemStudents(institutionId: string, gradeId: string) {
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        institutionId,
        group: { gradeId },
        status: 'ACTIVE',
      },
      include: {
        student: true,
        group: true,
      },
    });

    return enrollments.map(e => ({
      enrollmentId: e.id,
      studentId: e.studentId,
      fullName: `${e.student.lastName} ${e.student.secondLastName || ''} ${e.student.firstName} ${e.student.secondName || ''}`.trim(),
      documentNumber: e.student.documentNumber,
      groupCode: e.group.name,
    }));
  }

  private async getSystemSubjects(institutionId: string, gradeId: string) {
    const activeYear = await this.getActiveAcademicYear(institutionId);

    // 1) Intentar obtener las asignaturas desde la plantilla académica del grado
    const gradeTemplate = await this.prisma.gradeTemplate.findUnique({
      where: { gradeId_academicYearId: { gradeId, academicYearId: activeYear.id } },
      include: {
        template: {
          include: {
            templateAreas: {
              include: {
                templateSubjects: {
                  include: { subject: true },
                  orderBy: { order: 'asc' },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    const subjectMap = new Map<string, { id: string; name: string }>();

    if (gradeTemplate?.template) {
      for (const area of gradeTemplate.template.templateAreas) {
        for (const templateSubject of area.templateSubjects) {
          if (templateSubject.subject) {
            subjectMap.set(templateSubject.subject.id, {
              id: templateSubject.subject.id,
              name: templateSubject.subject.name,
            });
          }
        }
      }
    }

    // 2) Fallback: si no hay plantilla, usar las asignaturas activas del grado
    if (subjectMap.size === 0) {
      const assignments = await this.prisma.teacherAssignment.findMany({
        where: {
          institutionId,
          group: { gradeId },
          endDate: null,
        },
        select: {
          subject: { select: { id: true, name: true } },
        },
        distinct: ['subjectId'],
      });

      for (const assignment of assignments) {
        if (assignment.subject) {
          subjectMap.set(assignment.subject.id, assignment.subject);
        }
      }
    }

    return Array.from(subjectMap.values());
  }

  private getImportWorksheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet | undefined {
    const templateSheet = workbook.getWorksheet('PLANTILLA');
    if (templateSheet) {
      return templateSheet;
    }

    for (const sheet of workbook.worksheets) {
      for (let i = 1; i <= Math.min(sheet.rowCount, 5); i++) {
        const values = this.getRowTexts(sheet.getRow(i));
        const hasNameHeader = values.some(v => /NOMBRES?/i.test(v) || /APELLIDOS?/i.test(v));
        const hasDocumentHeader = values.some(v => /DOC|IDENTIDAD|C[EÉ]DULA/i.test(v));
        const hasGroupHeader = values.some(v => /GRUPO|CURSO/i.test(v));

        if ((hasNameHeader && hasDocumentHeader) || (hasNameHeader && hasGroupHeader) || (hasDocumentHeader && hasGroupHeader)) {
          return sheet;
        }
      }
    }

    return workbook.worksheets[0];
  }

  private async getActiveAcademicYear(institutionId: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: {
        institutionId,
        status: 'ACTIVE',
      },
    });

    if (!year) {
      throw new BadRequestException('No hay año académico activo');
    }

    return year;
  }

  private async createStudentWithEnrollment(
    institutionId: string,
    gradeId: string,
    academicYearId: string,
    excelStudent: StudentGradeRow,
  ) {
    const { firstName, secondName, lastName, secondLastName } = this.parseStudentFullName(excelStudent.fullName);

    // Buscar grupo por código
    const group = await this.findBestGroupMatch(gradeId, excelStudent.groupCode);

    if (!group) {
      throw new BadRequestException(`Grupo no encontrado: ${excelStudent.groupCode}`);
    }

    const student = await this.prisma.student.create({
      data: {
        institutionId,
        documentType: 'TI',
        documentNumber: excelStudent.documentNumber,
        firstName,
        secondName: secondName || null,
        lastName,
        secondLastName: secondLastName || null,
      },
    });

    const enrollment = await this.prisma.studentEnrollment.create({
      data: {
        institutionId,
        studentId: student.id,
        academicYearId,
        groupId: group.id,
        status: 'ACTIVE',
        enrollmentType: 'NEW',
      },
    });

    return { studentId: student.id, enrollmentId: enrollment.id };
  }

  private async syncStudentIdentity(studentId: string, excelStudent: StudentGradeRow) {
    await this.prisma.student.update({
      where: { id: studentId },
      data: {
        documentNumber: excelStudent.documentNumber,
      },
    });
  }

  private async forceDeleteStudent(studentId: string) {
    await this.prisma.$transaction(async tx => {
      await tx.educationalSupportProfile.deleteMany({ where: { studentId } });
      await tx.candidate.deleteMany({ where: { studentId } });
      await tx.student.delete({ where: { id: studentId } });
    });
  }

  private parseStudentFullName(fullName: string) {
    const nameParts = fullName.split(' ').filter(p => p.trim());
    let lastName = '';
    let secondLastName = '';
    let firstName = '';
    let secondName = '';

    if (nameParts.length >= 4) {
      lastName = nameParts[0];
      secondLastName = nameParts[1];
      firstName = nameParts[2];
      secondName = nameParts.slice(3).join(' ');
    } else if (nameParts.length === 3) {
      lastName = nameParts[0];
      secondLastName = nameParts[1];
      firstName = nameParts[2];
    } else if (nameParts.length === 2) {
      lastName = nameParts[0];
      firstName = nameParts[1];
    } else {
      firstName = nameParts[0] || 'SIN NOMBRE';
      lastName = 'SIN APELLIDO';
    }

    return { firstName, secondName, lastName, secondLastName };
  }

  private async findTeacherAssignment(
    institutionId: string,
    academicYearId: string,
    gradeId: string,
    groupCode: string,
    subjectId: string,
  ) {
    // Buscar grupo
    const group = await this.findBestGroupMatch(gradeId, groupCode);

    if (!group) return null;

    // Buscar asignación de docente
    const assignment = await this.prisma.teacherAssignment.findFirst({
      where: {
        institutionId,
        academicYearId,
        groupId: group.id,
        subjectId,
        endDate: null, // Solo asignaciones activas
      },
    });

    return assignment;
  }

  private async upsertPartialGrades(
    institutionId: string,
    enrollmentId: string,
    teacherAssignmentId: string,
    academicTermId: string,
    grade: StudentGradeRow['grades'][0],
    overwrite: boolean,
  ) {
    const components = [
      { type: 'COGNITIVO', score: grade.cognitivo },
      { type: 'PROCEDIMENTAL', score: grade.procedimental },
      { type: 'ACTITUDINAL', score: grade.actitudinal },
    ];

    for (const comp of components) {
      if (comp.score === null) continue;

      const existing = await this.prisma.partialGrade.findFirst({
        where: {
          studentEnrollmentId: enrollmentId,
          teacherAssignmentId,
          academicTermId,
          componentType: comp.type,
          activityIndex: 1,
        },
      });

      if (existing && !overwrite) continue;

      await this.prisma.partialGrade.upsert({
        where: {
          studentEnrollmentId_teacherAssignmentId_academicTermId_componentType_activityIndex: {
            studentEnrollmentId: enrollmentId,
            teacherAssignmentId,
            academicTermId,
            componentType: comp.type,
            activityIndex: 1,
          },
        },
        update: {
          score: comp.score,
          activityName: 'Nota importada',
        },
        create: {
          institutionId,
          studentEnrollmentId: enrollmentId,
          teacherAssignmentId,
          academicTermId,
          componentType: comp.type,
          activityIndex: 1,
          activityName: 'Nota importada',
          score: comp.score,
        },
      });
    }

    // Recalcular nota final (PeriodFinalGrade)
    await this.recomputePeriodFinalGrade(enrollmentId, teacherAssignmentId, academicTermId);
  }

  private async recomputePeriodFinalGrade(
    studentEnrollmentId: string,
    teacherAssignmentId: string,
    academicTermId: string,
  ) {
    const assignment = await this.prisma.teacherAssignment.findUnique({
      where: { id: teacherAssignmentId },
      select: { subjectId: true, teacherId: true, institutionId: true },
    });
    if (!assignment) return;

    const partials = await this.prisma.partialGrade.findMany({
      where: { studentEnrollmentId, teacherAssignmentId, academicTermId },
    });

    if (partials.length === 0) return;

    // Promedio simple de todas las notas parciales
    const scores = partials.map(p => Number(p.score));
    const finalScore = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;

    await this.prisma.periodFinalGrade.upsert({
      where: {
        studentEnrollmentId_academicTermId_subjectId: {
          studentEnrollmentId,
          academicTermId,
          subjectId: assignment.subjectId,
        },
      },
      update: { finalScore },
      create: {
        institutionId: assignment.institutionId,
        studentEnrollmentId,
        academicTermId,
        subjectId: assignment.subjectId,
        finalScore,
        enteredById: assignment.teacherId,
      },
    });
  }

  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeStudentSignature(name: string): string {
    return this.normalizeString(name)
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeGroupSignature(value: string): string {
    const text = this.normalizeString(value)
      .replace(/[^a-z0-9]/g, '');

    return text
      .replace(/primero/g, '1')
      .replace(/primero/g, '1')
      .replace(/segundo/g, '2')
      .replace(/tercero/g, '3')
      .replace(/cuarto/g, '4')
      .replace(/quinto/g, '5')
      .replace(/sexto/g, '6')
      .replace(/septimo/g, '7')
      .replace(/septima/g, '7')
      .replace(/septimos/g, '7')
      .replace(/septimas/g, '7')
      .replace(/octavo/g, '8')
      .replace(/octava/g, '8')
      .replace(/noveno/g, '9')
      .replace(/novena/g, '9')
      .replace(/decimo/g, '10')
      .replace(/decima/g, '10')
      .replace(/once/g, '11')
      .replace(/undecimo/g, '11')
      .replace(/undecima/g, '11')
      .replace(/doce/g, '12')
      .replace(/duodecimo/g, '12')
      .replace(/duodecima/g, '12');
  }

  private async findBestGroupMatch(gradeId: string, excelGroupCode: string) {
    const groups = await this.prisma.group.findMany({
      where: { gradeId },
      include: {
        grade: {
          select: { id: true, name: true, number: true },
        },
      },
    });

    const target = this.normalizeGroupSignature(excelGroupCode);
    if (!target) return null;

    const candidates = groups.map(group => {
      const gradeNumber = group.grade?.number != null ? String(group.grade.number) : '';
      const gradeName = group.grade?.name || '';
      const groupName = group.name || '';

      const signatures = [
        this.normalizeGroupSignature(groupName),
        this.normalizeGroupSignature(`${gradeNumber}${groupName}`),
        this.normalizeGroupSignature(`${gradeName}${groupName}`),
        this.normalizeGroupSignature(`${gradeName} ${groupName}`),
        this.normalizeGroupSignature(`grado ${gradeNumber}${groupName}`),
      ].filter(Boolean);

      return {
        group,
        signatures,
      };
    });

    const exactMatch = candidates.find(candidate => candidate.signatures.includes(target));
    if (exactMatch) return exactMatch.group;

    const containsMatch = candidates.find(candidate =>
      candidate.signatures.some(signature => signature.includes(target) || target.includes(signature)),
    );
    if (containsMatch) return containsMatch.group;

    return null;
  }

  private tokenizeStudentName(name: string): string[] {
    return this.normalizeStudentSignature(name)
      .split(' ')
      .filter(Boolean);
  }

  private levenshteinDistance(a: string, b: string): number {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const curr = [i];
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(
          curr[j - 1] + 1,
          prev[j] + 1,
          prev[j - 1] + cost,
        );
      }
      prev.splice(0, prev.length, ...curr);
    }

    return prev[b.length];
  }

  private tokenSimilarity(a: string, b: string): number {
    const normA = this.normalizeStudentSignature(a);
    const normB = this.normalizeStudentSignature(b);
    if (!normA || !normB) return 0;
    if (normA === normB) return 1;

    const distance = this.levenshteinDistance(normA, normB);
    const maxLen = Math.max(normA.length, normB.length);
    return maxLen === 0 ? 0 : 1 - distance / maxLen;
  }

  private areLikelySameStudentName(candidateName: string, excelName: string): boolean {
    const candidateNorm = this.normalizeStudentSignature(candidateName);
    const excelNorm = this.normalizeStudentSignature(excelName);
    if (!candidateNorm || !excelNorm) return false;
    if (candidateNorm === excelNorm) return true;

    const candidateTokens = this.tokenizeStudentName(candidateName);
    const excelTokens = this.tokenizeStudentName(excelName);
    if (candidateTokens.length === 0 || excelTokens.length === 0) return false;

    const minTokens = Math.min(candidateTokens.length, excelTokens.length);
    const maxTokens = Math.max(candidateTokens.length, excelTokens.length);
    if (maxTokens - minTokens > 1) return false;

    let matched = 0;
    let totalScore = 0;

    for (let i = 0; i < minTokens; i++) {
      const score = this.tokenSimilarity(candidateTokens[i], excelTokens[i]);
      totalScore += score;
      if (score >= 0.8) matched++;
    }

    const averageScore = totalScore / minTokens;
    return matched >= Math.max(2, Math.ceil(minTokens * 0.75)) && averageScore >= 0.82;
  }

  private findBestStudentMatch(
    students: SystemStudentMatch[],
    excelFullName: string,
    excelDocumentNumber: string,
  ) {
    const exactDocument = students.find(s => s.documentNumber === excelDocumentNumber);
    if (exactDocument) return exactDocument;

    const exactName = students.find(s => this.normalizeStudentSignature(s.fullName) === this.normalizeStudentSignature(excelFullName));
    if (exactName) return exactName;

    const nameMatches = students.filter(s => this.areLikelySameStudentName(s.fullName, excelFullName));
    if (nameMatches.length === 1) return nameMatches[0];

    if (nameMatches.length > 1) {
      return nameMatches.sort((a, b) => {
        const aScore = this.tokenSimilarity(a.fullName, excelFullName);
        const bScore = this.tokenSimilarity(b.fullName, excelFullName);
        return bScore - aScore;
      })[0];
    }

    return null;
  }

  private normalizeSubjectName(name: string): string {
    return this.normalizeString(name)
      .replace(/[^a-z0-9]/g, '')
      .replace(/matematica/g, 'matematicas')
      .replace(/lenguacastellana/g, 'lenguaje')
      .replace(/castellano/g, 'lenguaje')
      .replace(/espanol/g, 'lenguaje');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OBTENER GRADOS Y PERÍODOS DISPONIBLES
  // ═══════════════════════════════════════════════════════════════════════════

  async getAvailableGrades(institutionId: string) {
    const year = await this.getActiveAcademicYear(institutionId);
    
    // Obtener grados que tienen grupos con matrículas activas en el año actual
    const grades = await this.prisma.grade.findMany({
      where: {
        institutionId,
        groups: {
          some: {
            studentEnrollments: {
              some: { academicYearId: year.id },
            },
          },
        },
      },
      include: {
        groups: {
          where: {
            studentEnrollments: {
              some: { academicYearId: year.id },
            },
          },
          select: { id: true, name: true },
        },
      },
      orderBy: { number: 'asc' },
    });

    return grades.map(g => ({
      id: g.id,
      name: g.name,
      stage: g.stage,
      groups: g.groups,
    }));
  }

  async getAvailableTerms(institutionId: string) {
    const year = await this.getActiveAcademicYear(institutionId);
    
    const terms = await this.prisma.academicTerm.findMany({
      where: {
        academicYearId: year.id,
        status: { in: ['OPEN', 'CLOSED'] },
      },
      orderBy: { startDate: 'asc' },
    });

    return terms.map(t => ({
      id: t.id,
      name: t.name,
      status: t.status,
    }));
  }

  /**
   * Genera una plantilla oficial de importación de notas para un grado.
   * La plantilla está pensada para ser editable por Rectoría y compatible con
   * el parser de importación: fila 1 = nombres de asignaturas, fila 2 = encabezados,
   * fila 3+ = datos de estudiantes.
   */
  async generateImportTemplate(institutionId: string, gradeId: string): Promise<Buffer> {
    const subjects = await this.getSystemSubjects(institutionId, gradeId);
    const orderedSubjects = this.orderTemplateSubjects(subjects);

    if (orderedSubjects.length === 0) {
      throw new BadRequestException('No hay asignaturas disponibles para generar la plantilla');
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Edusyn';
    workbook.created = new Date();
    workbook.modified = new Date();

    // Hoja de instrucciones
    const info = workbook.addWorksheet('INSTRUCCIONES', {
      properties: { tabColor: { argb: 'FF4F46E5' } },
    });
    info.getCell('A1').value = 'PLANTILLA OFICIAL DE IMPORTACIÓN DE NOTAS';
    info.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    info.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    info.mergeCells('A1:F1');
    info.getCell('A3').value = 'Instrucciones';
    info.getCell('A3').font = { bold: true };
    const instructions = [
      'Descargue esta plantilla y complete únicamente la hoja PLANTILLA.',
      'La fila 1 contiene los nombres de las asignaturas y la fila 2 los encabezados.',
      'Cada asignatura muestra solo COG, PROC y ACT; DEFIN y DESEMP están ocultas y se calculan automáticamente.',
      'No elimine columnas ni cambie los nombres de los encabezados.',
      'Si un valor no aplica, deje la celda vacía.',
      'La hoja DESEMPEÑOS solo sirve como referencia del catálogo académico.',
    ];
    instructions.forEach((text, idx) => {
      info.getCell(`A${5 + idx}`).value = `• ${text}`;
    });
    info.getColumn(1).width = 120;

    // Hoja principal para diligenciar
    const sheet = workbook.addWorksheet('PLANTILLA', {
      properties: { tabColor: { argb: 'FF22C55E' } },
      views: [{ state: 'frozen', ySplit: 2, xSplit: 9 }],
    });

    const metadataHeaders = [
      'N°',
      'NOMBRES Y APELLIDOS',
      'DOC. IDENTIDAD',
      'GRUPO',
      'DIRECTOR DE GRUPO',
      'JORNADA',
      'PERIODO',
      'AÑO',
      'PROMEDIO',
    ];

    metadataHeaders.forEach((header, index) => {
      const cell = sheet.getCell(2, index + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    const subjectHeaderStyles = [
      { argb: 'FFDBEAFE' },
      { argb: 'FFE0E7FF' },
      { argb: 'FFE0F2FE' },
      { argb: 'FFDCFCE7' },
      { argb: 'FFFCE7F3' },
      { argb: 'FFFFEDD5' },
    ];

    let startCol = 10;
    orderedSubjects.forEach((subject, subjectIndex) => {
      const endCol = startCol + 4;
      sheet.mergeCells(1, startCol, 1, endCol);
      const titleCell = sheet.getCell(1, startCol);
      titleCell.value = subject.name;
      titleCell.font = { bold: true, color: { argb: 'FF111827' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: subjectHeaderStyles[subjectIndex % subjectHeaderStyles.length] };
      titleCell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };

      const headers = ['COG', 'PROC', 'ACT', 'DEFIN', 'DESEMP.'];
      headers.forEach((header, offset) => {
        const cell = sheet.getCell(2, startCol + offset);
        cell.value = header;
        cell.font = { bold: true, color: { argb: 'FF111827' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });

      // Ocultar columnas automáticas para que el docente solo vea COG, PROC y ACT
      sheet.getColumn(startCol + 3).hidden = true;
      sheet.getColumn(startCol + 4).hidden = true;

      // Fila vacía de ejemplo/entrada inicial
      for (let offset = 0; offset < 5; offset++) {
        sheet.getCell(3, startCol + offset).value = '';
      }

      startCol += 5;
    });

    // Formato general de la plantilla
    sheet.getRow(1).height = 24;
    sheet.getRow(2).height = 28;
    sheet.views = [{ state: 'frozen', ySplit: 2, xSplit: 9 }];

    for (let i = 1; i <= sheet.columnCount; i++) {
      if (i <= 2) sheet.getColumn(i).width = i === 1 ? 8 : 34;
      else if (i <= 8) sheet.getColumn(i).width = 16;
      else if (i === 9) sheet.getColumn(i).width = 12;
      else sheet.getColumn(i).width = 12;
    }

    // Referencia rápida del catálogo
    const catalog = workbook.addWorksheet('DESEMPEÑOS', {
      properties: { tabColor: { argb: 'FFF59E0B' } },
    });
    catalog.getCell('A1').value = 'ASIGNATURA';
    catalog.getCell('B1').value = 'COGNITIVO';
    catalog.getCell('C1').value = 'PROCEDIMENTAL';
    catalog.getCell('D1').value = 'ACTITUDINAL';
    ['A1', 'B1', 'C1', 'D1'].forEach(ref => {
      const cell = catalog.getCell(ref);
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92400E' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });

    // Aquí se deja una referencia simple de nombres; no se requieren descriptores para importar.
    orderedSubjects.forEach((subject, index) => {
      catalog.getCell(index + 2, 1).value = subject.name;
      catalog.getCell(index + 2, 2).value = 'Complete el descriptor cognitivo aquí';
      catalog.getCell(index + 2, 3).value = 'Complete el descriptor procedimental aquí';
      catalog.getCell(index + 2, 4).value = 'Complete el descriptor actitudinal aquí';
    });
    catalog.getColumn(1).width = 28;
    catalog.getColumn(2).width = 60;
    catalog.getColumn(3).width = 60;
    catalog.getColumn(4).width = 60;

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer as ArrayBuffer);
  }

  private orderTemplateSubjects(subjects: Array<{ id: string; name: string }>) {
    const preferredOrder = [
      'MATEMATICAS',
      'ESTADISTICA',
      'LENGUAJE',
      'LECTURA CRÍTICA',
      'LECTURA CRITICA',
      'FUND. LENGUA INGLESA',
      'SPEAKING AND LIFE SKILLS',
      'BIOLOGIA',
      'MEDIO AMBIENTE',
      'C. SOCIALES',
      'HISTORIA',
      'GEOGRAFIA',
      'CATEDRA DE PAZ',
      'ETICA',
      'RELIGION',
      'ARTE',
      'ED. FISICA',
      'INFORMATICA',
      'CONVIVENCIA',
    ];

    const normalized = (value: string) => this.normalizeSubjectName(value);
    const orderIndex = (name: string) => {
      const idx = preferredOrder.findIndex(item => normalized(item) === normalized(name));
      return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
    };

    return [...subjects]
      .sort((a, b) => {
        const diff = orderIndex(a.name) - orderIndex(b.name);
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name);
      })
      .map(subject => ({ id: subject.id, name: subject.name }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONVIVENCIA: Asignatura especial para el tutor del grupo
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Obtiene o crea la asignatura "Convivencia" para la institución.
   * Convivencia es una asignatura especial que solo el tutor del grupo puede calificar.
   */
  async getOrCreateConvivenciaSubject(institutionId: string): Promise<{ id: string; name: string }> {
    // Buscar área "Convivencia" o "Formación" o crear una nueva
    let area = await this.prisma.area.findFirst({
      where: {
        institutionId,
        OR: [
          { name: { contains: 'Convivencia', mode: 'insensitive' } },
          { name: { contains: 'Formación', mode: 'insensitive' } },
          { name: { contains: 'Ética', mode: 'insensitive' } },
        ],
      },
    });

    if (!area) {
      // Crear área "Formación y Convivencia"
      area = await this.prisma.area.create({
        data: {
          institutionId,
          name: 'Formación y Convivencia',
          code: 'CONV',
          description: 'Área de formación integral y convivencia escolar',
          order: 99,
        },
      });
    }

    // Buscar asignatura "Convivencia"
    let subject = await this.prisma.subject.findFirst({
      where: {
        areaId: area.id,
        name: { contains: 'Convivencia', mode: 'insensitive' },
      },
    });

    if (!subject) {
      // Crear asignatura "Convivencia"
      subject = await this.prisma.subject.create({
        data: {
          areaId: area.id,
          name: 'Convivencia',
          code: 'CONV',
          description: 'Evaluación de convivencia escolar - Solo tutor de grupo',
          subjectType: 'MANDATORY',
          order: 1,
        },
      });
    }

    return { id: subject.id, name: subject.name };
  }

  /**
   * Activa/desactiva Convivencia para un grupo y crea la asignación al tutor.
   */
  async toggleConvivencia(
    groupId: string,
    enabled: boolean,
    academicYearId: string,
  ): Promise<{ success: boolean; message: string }> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        grade: true,
        director: true,
      },
    });

    if (!group) {
      throw new BadRequestException('Grupo no encontrado');
    }

    // Obtener institutionId del grupo
    const campus = await this.prisma.campus.findUnique({
      where: { id: group.campusId },
      select: { institutionId: true },
    });

    if (!campus) {
      throw new BadRequestException('Campus no encontrado');
    }

    const institutionId = campus.institutionId;

    if (enabled) {
      // Obtener o crear la asignatura Convivencia
      const convivencia = await this.getOrCreateConvivenciaSubject(institutionId);

      if (!group.directorId) {
        return {
          success: true,
          message: 'Convivencia activada, pero el grupo no tiene tutor asignado. Asigne un tutor para que pueda ingresar notas.',
        };
      }

      // Verificar si ya existe la asignación
      const existingAssignment = await this.prisma.teacherAssignment.findFirst({
        where: {
          institutionId,
          academicYearId,
          groupId,
          subjectId: convivencia.id,
          endDate: null,
        },
      });

      if (!existingAssignment) {
        // Crear asignación del tutor a Convivencia
        await this.prisma.teacherAssignment.create({
          data: {
            institutionId,
            academicYearId,
            teacherId: group.directorId,
            groupId,
            subjectId: convivencia.id,
          },
        });
      }

      // Marcar activación usando una excepción existente del esquema
      await this.prisma.groupSubjectException.upsert({
        where: {
          groupId_subjectId_academicYearId: {
            groupId,
            subjectId: convivencia.id,
            academicYearId,
          },
        },
        update: {
          type: 'INCLUDE',
          reason: 'Convivencia activada por Rector/Coordinador',
        },
        create: {
          groupId,
          subjectId: convivencia.id,
          academicYearId,
          type: 'INCLUDE',
          reason: 'Convivencia activada por Rector/Coordinador',
        },
      });

      return {
        success: true,
        message: `Convivencia activada para ${group.name}. El tutor ${group.director?.firstName} ${group.director?.lastName} puede ingresar notas.`,
      };
    } else {
      const convivencia = await this.getOrCreateConvivenciaSubject(institutionId);

      await this.prisma.groupSubjectException.deleteMany({
        where: {
          groupId,
          subjectId: convivencia.id,
          academicYearId,
        },
      });

      await this.prisma.teacherAssignment.updateMany({
        where: {
          institutionId,
          academicYearId,
          groupId,
          subjectId: convivencia.id,
          endDate: null,
        },
        data: {
          endDate: new Date(),
          endReason: 'Convivencia desactivada por Rector/Coordinador',
        },
      });

      return {
        success: true,
        message: `Convivencia desactivada para ${group.name}.`,
      };
    }
  }

  /**
   * Obtiene el estado de Convivencia para todos los grupos de un grado.
   */
  async getConvivenciaStatus(gradeId: string, academicYearId: string) {
    const groups = await this.prisma.group.findMany({
      where: { gradeId },
      include: {
        director: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { name: 'asc' },
    });

    if (groups.length === 0) {
      return [];
    }

    const convivencia = await this.getOrCreateConvivenciaSubject(
      (await this.prisma.campus.findFirst({
        where: { id: groups[0]?.campusId },
        select: { institutionId: true },
      }))?.institutionId || '',
    );

    const exceptions = await this.prisma.groupSubjectException.findMany({
      where: {
        academicYearId,
        subjectId: convivencia.id,
        groupId: { in: groups.map(g => g.id) },
      },
      select: { groupId: true },
    });
    const activeSet = new Set(exceptions.map(e => e.groupId));

    const activeAssignments = await this.prisma.teacherAssignment.findMany({
      where: {
        academicYearId,
        subjectId: convivencia.id,
        groupId: { in: groups.map(g => g.id) },
        endDate: null,
      },
      select: { groupId: true },
    });
    for (const a of activeAssignments) activeSet.add(a.groupId);

    return groups.map(g => ({
      groupId: g.id,
      groupName: g.name,
      convivenciaEnabled: activeSet.has(g.id),
      hasDirector: !!g.directorId,
      director: g.director ? `${g.director.firstName} ${g.director.lastName}` : null,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BÚSQUEDA GLOBAL DE ESTUDIANTES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Busca un estudiante en toda la institución por documento.
   * Si lo encuentra en otro grado, lo puede rematricular.
   */
  private async findStudentInInstitutionByDocumentOrName(institutionId: string, documentNumber: string, fullName: string) {
    // Buscar en Student (registro maestro)
    const byDocument = await this.prisma.student.findFirst({
      where: {
        institutionId,
        documentNumber,
        isActive: true,
      },
      include: {
        enrollments: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            group: { include: { grade: true } },
          },
        },
      },
    });

    if (byDocument) {
      return {
        studentId: byDocument.id,
        fullName: `${byDocument.lastName} ${byDocument.secondLastName || ''} ${byDocument.firstName} ${byDocument.secondName || ''}`.trim(),
        documentNumber: byDocument.documentNumber,
        currentEnrollment: byDocument.enrollments[0] || null,
      };
    }

    const students = await this.prisma.student.findMany({
      where: {
        institutionId,
        isActive: true,
      },
      include: {
        enrollments: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            group: { include: { grade: true } },
          },
        },
      },
    });

    const matched = students.find(student => {
      const candidateName = `${student.lastName} ${student.secondLastName || ''} ${student.firstName} ${student.secondName || ''}`.trim();
      return this.areLikelySameStudentName(candidateName, fullName);
    });

    if (!matched) return null;

    return {
      studentId: matched.id,
      fullName: `${matched.lastName} ${matched.secondLastName || ''} ${matched.firstName} ${matched.secondName || ''}`.trim(),
      documentNumber: matched.documentNumber,
      currentEnrollment: matched.enrollments[0] || null,
    };
  }

  /**
   * Rematricula un estudiante existente en un nuevo grupo.
   */
  private async reEnrollStudent(
    institutionId: string,
    studentId: string,
    academicYearId: string,
    groupId: string,
  ): Promise<string> {
    // Verificar si ya tiene matrícula activa en este año
    const existingEnrollment = await this.prisma.studentEnrollment.findFirst({
      where: {
        studentId,
        academicYearId,
        status: 'ACTIVE',
      },
    });

    if (existingEnrollment) {
      // Si ya está matriculado en el mismo grupo, retornar
      if (existingEnrollment.groupId === groupId) {
        return existingEnrollment.id;
      }

      // Si está en otro grupo, actualizar el grupo
      await this.prisma.studentEnrollment.update({
        where: { id: existingEnrollment.id },
        data: { groupId },
      });
      return existingEnrollment.id;
    }

    // Crear nueva matrícula
    const enrollment = await this.prisma.studentEnrollment.create({
      data: {
        institutionId,
        studentId,
        academicYearId,
        groupId,
        status: 'ACTIVE',
        enrollmentType: 'RENEWAL',
      },
    });

    return enrollment.id;
  }
}
