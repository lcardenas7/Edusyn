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

    // Obtener la primera hoja (o la hoja activa)
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException('El archivo Excel no contiene hojas');
    }

    // Detectar estructura de columnas
    const { subjectColumns, nameCol, docCol, groupCol } = this.detectColumnStructure(sheet);

    // Leer estudiantes del Excel
    const excelStudents = this.readStudentsFromSheet(sheet, nameCol, docCol, groupCol, subjectColumns);

    // Obtener estudiantes actuales del sistema para este grado
    const systemStudents = await this.getSystemStudents(institutionId, gradeId);

    // Obtener asignaturas del sistema para este grado
    const systemSubjects = await this.getSystemSubjects(institutionId, gradeId);

    // Comparar estudiantes
    const studentsPreview = excelStudents.map(es => {
      const found = systemStudents.find(ss => 
        ss.documentNumber === es.documentNumber ||
        this.normalizeString(ss.fullName) === this.normalizeString(es.fullName)
      );
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
    const excelDocs = new Set(excelStudents.map(e => e.documentNumber));
    const studentsInSystemNotInExcel = systemStudents
      .filter(ss => !excelDocs.has(ss.documentNumber))
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
      warnings.push(`${studentsInSystemNotInExcel.length} estudiantes del sistema no están en el Excel y serán marcados como retirados`);
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

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException('El archivo Excel no contiene hojas');
    }

    const { subjectColumns, nameCol, docCol, groupCol } = this.detectColumnStructure(sheet);
    const excelStudents = this.readStudentsFromSheet(sheet, nameCol, docCol, groupCol, subjectColumns);

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
        let systemStudent = systemStudents.find(ss => 
          ss.documentNumber === excelStudent.documentNumber
        );

        // Si no se encuentra por documento, buscar por nombre
        if (!systemStudent) {
          systemStudent = systemStudents.find(ss => 
            this.normalizeString(ss.fullName) === this.normalizeString(excelStudent.fullName)
          );
        }

        let enrollmentId: string;

        if (!systemStudent) {
          // 2. Buscar en toda la institución (puede estar en otro grado)
          const globalStudent = await this.findStudentInInstitution(
            institutionId,
            excelStudent.documentNumber,
          );

          if (globalStudent) {
            // Estudiante existe en la institución, rematricularlo en el grupo correcto
            const group = await this.prisma.group.findFirst({
              where: {
                gradeId,
                name: { contains: excelStudent.groupCode, mode: 'insensitive' },
              },
            });

            if (group) {
              enrollmentId = await this.reEnrollStudent(
                institutionId,
                globalStudent.studentId,
                academicYear.id,
                group.id,
              );
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

    // Desactivar estudiantes que no están en el Excel
    if (options.deactivateMissingStudents) {
      const excelDocs = new Set(excelStudents.map(e => e.documentNumber));
      const toDeactivate = systemStudents.filter(ss => !excelDocs.has(ss.documentNumber));

      for (const student of toDeactivate) {
        await this.prisma.studentEnrollment.update({
          where: { id: student.enrollmentId },
          data: { status: 'WITHDRAWN' },
        });
        result.summary.studentsDeactivated++;
        result.details.deactivated.push({
          name: student.fullName,
          document: student.documentNumber,
        });
      }
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
  } {
    // Buscar fila de encabezados (puede estar en fila 1, 2 o 3)
    let headerRow: ExcelJS.Row | undefined;
    let headerRowNum = 1;

    for (let i = 1; i <= 5; i++) {
      const row = sheet.getRow(i);
      const values = row.values as any[];
      if (values && values.some(v => 
        typeof v === 'string' && 
        (v.toUpperCase().includes('NOMBRE') || v.toUpperCase().includes('APELLIDO'))
      )) {
        headerRow = row;
        headerRowNum = i;
        break;
      }
    }

    if (!headerRow) {
      throw new BadRequestException('No se encontró la fila de encabezados');
    }

    const headers = headerRow.values as any[];
    let nameCol = -1;
    let docCol = -1;
    let groupCol = -1;
    const subjectColumns: SubjectColumns[] = [];

    // Detectar columnas básicas
    for (let i = 1; i < headers.length; i++) {
      const h = String(headers[i] || '').toUpperCase().trim();
      if (h.includes('NOMBRE') && h.includes('APELLIDO')) {
        nameCol = i;
      } else if (h.includes('DOC') || h.includes('IDENTIDAD') || h.includes('CEDULA')) {
        docCol = i;
      } else if (h.includes('GRUPO') || h.includes('CURSO')) {
        groupCol = i;
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
    const subjectHeaders = subjectRow ? subjectRow.values as any[] : [];

    // También revisar la última fila para nombres de asignaturas (como en tu Excel)
    const lastDataRow = sheet.lastRow;
    const lastRowValues = lastDataRow ? lastDataRow.values as any[] : [];

    for (let i = 1; i < headers.length; i++) {
      const h = String(headers[i] || '').toUpperCase().trim();
      
      // Detectar columnas de notas
      if (h === 'COG' || h.includes('COGNITIVO')) {
        cogCol = i;
        // Buscar nombre de asignatura en fila superior o inferior
        currentSubject = this.findSubjectName(subjectHeaders, lastRowValues, i);
      } else if (h === 'PROC' || h.includes('PROCEDIMENTAL')) {
        procCol = i;
      } else if (h === 'ACT' || h.includes('ACTITUDINAL')) {
        actCol = i;
      } else if (h === 'DEF' || h === 'DEFIN' || h.includes('DEFINITIVA')) {
        defCol = i;
        
        // Al encontrar DEF, guardamos la asignatura completa
        if (currentSubject && cogCol > 0) {
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
      
      for (let i = 1; i < lastRowVals.length; i++) {
        const val = String(lastRowVals[i] || '').trim();
        if (val && !['', 'MATEMATICAS', 'ESTADISTICA', 'LENGUAJE'].includes(val.toUpperCase())) {
          // Es un nombre de asignatura, buscar sus columnas
          const subjectName = val;
          // Buscar COG, PROC, ACT, DEF en las columnas cercanas
          for (let j = i; j < Math.min(i + 10, headers.length); j++) {
            const h = String(headers[j] || '').toUpperCase().trim();
            if (h === 'COG') cogCol = j;
            if (h === 'PROC' || h === 'PROCACT') procCol = j;
            if (h === 'ACT') actCol = j;
            if (h === 'DEF' || h === 'DEFIN') {
              defCol = j;
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

    return { subjectColumns, nameCol, docCol, groupCol };
  }

  private findSubjectName(subjectHeaders: any[], lastRowValues: any[], colIndex: number): string {
    // Buscar en fila de encabezados de asignaturas
    for (let i = colIndex; i >= 1; i--) {
      const val = String(subjectHeaders[i] || '').trim();
      if (val && val.length > 3 && !['COG', 'PROC', 'ACT', 'DEF', 'IHS'].includes(val.toUpperCase())) {
        return val;
      }
    }
    
    // Buscar en última fila
    for (let i = colIndex; i >= 1; i--) {
      const val = String(lastRowValues[i] || '').trim();
      if (val && val.length > 3 && !['COG', 'PROC', 'ACT', 'DEF', 'IHS'].includes(val.toUpperCase())) {
        return val;
      }
    }
    
    return `Asignatura_Col${colIndex}`;
  }

  private readStudentsFromSheet(
    sheet: ExcelJS.Worksheet,
    nameCol: number,
    docCol: number,
    groupCol: number,
    subjectColumns: SubjectColumns[],
  ): StudentGradeRow[] {
    const students: StudentGradeRow[] = [];
    
    // Encontrar fila de inicio de datos (después de encabezados)
    let startRow = 1;
    for (let i = 1; i <= 5; i++) {
      const row = sheet.getRow(i);
      const nameVal = row.getCell(nameCol).value;
      if (nameVal && String(nameVal).toUpperCase().includes('NOMBRE')) {
        startRow = i + 1;
        break;
      }
    }

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
    // Obtener asignaturas asignadas a este grado a través de TeacherAssignment
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

    // También buscar asignaturas del catálogo de la institución
    const catalogSubjects = await this.prisma.subject.findMany({
      where: {
        area: { institutionId },
        isActive: true,
      },
      select: { id: true, name: true },
    });

    // Combinar y deduplicar
    const subjectMap = new Map<string, { id: string; name: string }>();
    for (const a of assignments) {
      if (a.subject) subjectMap.set(a.subject.id, a.subject);
    }
    for (const s of catalogSubjects) {
      if (!subjectMap.has(s.id)) subjectMap.set(s.id, s);
    }

    return Array.from(subjectMap.values());
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
    // Parsear nombre (formato típico: APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2)
    const nameParts = excelStudent.fullName.split(' ').filter(p => p.trim());
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

    // Buscar grupo por código
    const group = await this.prisma.group.findFirst({
      where: {
        gradeId,
        name: { contains: excelStudent.groupCode, mode: 'insensitive' },
      },
    });

    if (!group) {
      throw new BadRequestException(`Grupo no encontrado: ${excelStudent.groupCode}`);
    }

    // Crear el registro de Student
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

    // Crear matrícula
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

  private async findTeacherAssignment(
    institutionId: string,
    academicYearId: string,
    gradeId: string,
    groupCode: string,
    subjectId: string,
  ) {
    // Buscar grupo
    const group = await this.prisma.group.findFirst({
      where: {
        gradeId,
        name: { contains: groupCode, mode: 'insensitive' },
      },
    });

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
      'Cada asignatura usa las columnas IHS, COG, PROC, ACT, DEFIN y DESEMP.',
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
      const endCol = startCol + 5;
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

      const headers = ['IHS', 'COG', 'PROC', 'ACT', 'DEFIN', 'DESEMP.'];
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

      // Fila vacía de ejemplo/entrada inicial
      for (let offset = 0; offset < 6; offset++) {
        sheet.getCell(3, startCol + offset).value = '';
      }

      startCol += 6;
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
  private async findStudentInInstitution(institutionId: string, documentNumber: string) {
    // Buscar en Student (registro maestro)
    const student = await this.prisma.student.findFirst({
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

    if (!student) return null;

    return {
      studentId: student.id,
      fullName: `${student.lastName} ${student.secondLastName || ''} ${student.firstName} ${student.secondName || ''}`.trim(),
      documentNumber: student.documentNumber,
      currentEnrollment: student.enrollments[0] || null,
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
