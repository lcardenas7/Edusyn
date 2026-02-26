import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import * as bcrypt from 'bcryptjs';
import { DayOfWeek, GradeStage, SchoolShift } from '@prisma/client';

export interface TeachingLoadRow {
  teacherName: string;
  teacherEmail?: string;
  teacherDocument?: string;
  areaName: string;
  subjectName: string;
  gradeName: string;
  groupName: string;
  shiftName?: string;
  campusName?: string;
  weeklyHours: number;
  restrictions?: string;
  directorDeGrupo?: string; // "Director", "Acompañante", or empty
  rowNumber: number;
}

export interface ImportResult {
  success: boolean;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  warnings: string[];
  entitiesCreated: {
    teachers: number;
    areas: number;
    subjects: number;
    grades: number;
    groups: number;
  };
}

const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
};

const DAYS_ORDER: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

// Mapeo de nombres de grado a GradeStage y número
const GRADE_MAPPING: Record<string, { stage: GradeStage; number: number | null; name: string }> = {
  'transición': { stage: 'PREESCOLAR', number: 0, name: 'Transición' },
  'transicion': { stage: 'PREESCOLAR', number: 0, name: 'Transición' },
  'jardín': { stage: 'PREESCOLAR', number: null, name: 'Jardín' },
  'jardin': { stage: 'PREESCOLAR', number: null, name: 'Jardín' },
  'pre-jardín': { stage: 'PREESCOLAR', number: null, name: 'Pre-Jardín' },
  'pre-jardin': { stage: 'PREESCOLAR', number: null, name: 'Pre-Jardín' },
  'preescolar': { stage: 'PREESCOLAR', number: 0, name: 'Preescolar' },
  'primero': { stage: 'BASICA_PRIMARIA', number: 1, name: 'Primero' },
  '1': { stage: 'BASICA_PRIMARIA', number: 1, name: 'Primero' },
  '1°': { stage: 'BASICA_PRIMARIA', number: 1, name: 'Primero' },
  'segundo': { stage: 'BASICA_PRIMARIA', number: 2, name: 'Segundo' },
  '2': { stage: 'BASICA_PRIMARIA', number: 2, name: 'Segundo' },
  '2°': { stage: 'BASICA_PRIMARIA', number: 2, name: 'Segundo' },
  'tercero': { stage: 'BASICA_PRIMARIA', number: 3, name: 'Tercero' },
  '3': { stage: 'BASICA_PRIMARIA', number: 3, name: 'Tercero' },
  '3°': { stage: 'BASICA_PRIMARIA', number: 3, name: 'Tercero' },
  'cuarto': { stage: 'BASICA_PRIMARIA', number: 4, name: 'Cuarto' },
  '4': { stage: 'BASICA_PRIMARIA', number: 4, name: 'Cuarto' },
  '4°': { stage: 'BASICA_PRIMARIA', number: 4, name: 'Cuarto' },
  'quinto': { stage: 'BASICA_PRIMARIA', number: 5, name: 'Quinto' },
  '5': { stage: 'BASICA_PRIMARIA', number: 5, name: 'Quinto' },
  '5°': { stage: 'BASICA_PRIMARIA', number: 5, name: 'Quinto' },
  'sexto': { stage: 'BASICA_SECUNDARIA', number: 6, name: 'Sexto' },
  '6': { stage: 'BASICA_SECUNDARIA', number: 6, name: 'Sexto' },
  '6°': { stage: 'BASICA_SECUNDARIA', number: 6, name: 'Sexto' },
  'séptimo': { stage: 'BASICA_SECUNDARIA', number: 7, name: 'Séptimo' },
  'septimo': { stage: 'BASICA_SECUNDARIA', number: 7, name: 'Séptimo' },
  '7': { stage: 'BASICA_SECUNDARIA', number: 7, name: 'Séptimo' },
  '7°': { stage: 'BASICA_SECUNDARIA', number: 7, name: 'Séptimo' },
  'octavo': { stage: 'BASICA_SECUNDARIA', number: 8, name: 'Octavo' },
  '8': { stage: 'BASICA_SECUNDARIA', number: 8, name: 'Octavo' },
  '8°': { stage: 'BASICA_SECUNDARIA', number: 8, name: 'Octavo' },
  'noveno': { stage: 'BASICA_SECUNDARIA', number: 9, name: 'Noveno' },
  '9': { stage: 'BASICA_SECUNDARIA', number: 9, name: 'Noveno' },
  '9°': { stage: 'BASICA_SECUNDARIA', number: 9, name: 'Noveno' },
  'décimo': { stage: 'MEDIA', number: 10, name: 'Décimo' },
  'decimo': { stage: 'MEDIA', number: 10, name: 'Décimo' },
  '10': { stage: 'MEDIA', number: 10, name: 'Décimo' },
  '10°': { stage: 'MEDIA', number: 10, name: 'Décimo' },
  'once': { stage: 'MEDIA', number: 11, name: 'Undécimo' },
  'undécimo': { stage: 'MEDIA', number: 11, name: 'Undécimo' },
  'undecimo': { stage: 'MEDIA', number: 11, name: 'Undécimo' },
  '11': { stage: 'MEDIA', number: 11, name: 'Undécimo' },
  '11°': { stage: 'MEDIA', number: 11, name: 'Undécimo' },
};

const SHIFT_MAPPING: Record<string, SchoolShift> = {
  'mañana': 'MORNING',
  'manana': 'MORNING',
  'morning': 'MORNING',
  'am': 'MORNING',
  'tarde': 'AFTERNOON',
  'afternoon': 'AFTERNOON',
  'pm': 'AFTERNOON',
  'única': 'SINGLE',
  'unica': 'SINGLE',
  'single': 'SINGLE',
  'completa': 'SINGLE',
  'jornada única': 'SINGLE',
  'jornada unica': 'SINGLE',
  'noche': 'NIGHT',
  'night': 'NIGHT',
  'nocturna': 'NIGHT',
};

@Injectable()
export class TimetableExcelService {
  private readonly logger = new Logger(TimetableExcelService.name);

  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // GENERAR PLANTILLA EXCEL DE CARGA ACADÉMICA (FORMATO COMPLETO)
  // ═══════════════════════════════════════════════════════════════════════════

  async generateTemplate(institutionId: string, academicYearId: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Edusyn';

    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' },
      },
    };

    // ── Hoja 1: Carga Académica ──
    const loadSheet = workbook.addWorksheet('Carga Académica');

    loadSheet.columns = [
      { header: 'Nombre Docente *', key: 'teacherName', width: 30 },
      { header: 'Email Docente', key: 'teacherEmail', width: 30 },
      { header: 'Documento Docente', key: 'teacherDocument', width: 18 },
      { header: 'Área Académica *', key: 'areaName', width: 22 },
      { header: 'Asignatura *', key: 'subjectName', width: 22 },
      { header: 'Grado *', key: 'gradeName', width: 15 },
      { header: 'Grupo *', key: 'groupName', width: 12 },
      { header: 'Jornada', key: 'shiftName', width: 14 },
      { header: 'Sede', key: 'campusName', width: 18 },
      { header: 'Horas Semanales *', key: 'weeklyHours', width: 16 },
      { header: 'Restricciones', key: 'restrictions', width: 30 },
      { header: 'Director de Grupo', key: 'directorDeGrupo', width: 20 },
    ];

    loadSheet.getRow(1).eachCell(cell => { cell.style = headerStyle; });
    loadSheet.getRow(1).height = 35;

    // Pre-llenar con datos existentes
    const existingAssignments = await this.prisma.teacherAssignment.findMany({
      where: { academicYearId, group: { shift: { campus: { institutionId } } } },
      include: {
        teacher: { select: { email: true, firstName: true, lastName: true, documentNumber: true } },
        subject: { select: { name: true, area: { select: { name: true } } } },
        group: {
          select: {
            name: true,
            grade: { select: { name: true } },
            shift: { select: { name: true } },
            campus: { select: { name: true } },
          },
        },
      },
      orderBy: [{ teacher: { firstName: 'asc' } }, { group: { name: 'asc' } }],
    });

    if (existingAssignments.length > 0) {
      for (const a of existingAssignments) {
        loadSheet.addRow({
          teacherName: `${a.teacher.firstName || ''} ${a.teacher.lastName || ''}`.trim(),
          teacherEmail: a.teacher.email,
          teacherDocument: a.teacher.documentNumber || '',
          areaName: a.subject.area?.name || '',
          subjectName: a.subject.name,
          gradeName: a.group.grade?.name || '',
          groupName: a.group.name,
          shiftName: a.group.shift?.name || '',
          campusName: a.group.campus?.name || '',
          weeklyHours: a.weeklyHours || 0,
          restrictions: '',
        });
      }
    }

    // Estilos a datos
    for (let i = 2; i <= loadSheet.rowCount; i++) {
      loadSheet.getRow(i).eachCell(cell => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
    }

    // Validación horas
    for (let i = 2; i <= 1000; i++) {
      loadSheet.getCell(`J${i}`).dataValidation = {
        type: 'whole', operator: 'between', formulae: [1, 20],
        showErrorMessage: true, errorTitle: 'Error', error: 'Las horas semanales deben ser entre 1 y 20',
      };
    }

    // ── Hoja 2: Referencia ──
    const refSheet = workbook.addWorksheet('Referencia');

    const [teachers, subjects, groups, campuses, areas] = await Promise.all([
      this.prisma.institutionUser.findMany({
        where: { institutionId, isActive: true },
        include: { user: { select: { email: true, firstName: true, lastName: true, documentNumber: true } } },
      }),
      this.prisma.subject.findMany({
        where: { area: { institutionId } },
        orderBy: { name: 'asc' },
        select: { name: true, area: { select: { name: true } } },
      }),
      this.prisma.group.findMany({
        where: { shift: { campus: { institutionId } } },
        orderBy: [{ grade: { stage: 'asc' } }, { grade: { number: 'asc' } }, { name: 'asc' }],
        select: { name: true, grade: { select: { name: true } }, shift: { select: { name: true } }, campus: { select: { name: true } } },
      }),
      this.prisma.campus.findMany({
        where: { institutionId },
        select: { name: true, shifts: { select: { name: true, type: true } } },
      }),
      this.prisma.area.findMany({
        where: { institutionId, isActive: true },
        orderBy: { name: 'asc' },
        select: { name: true },
      }),
    ]);

    // Sub-tablas en hoja de referencia
    refSheet.getCell('A1').value = 'Docentes';
    refSheet.getCell('A1').style = headerStyle;
    refSheet.getCell('B1').value = 'Email';
    refSheet.getCell('B1').style = headerStyle;
    refSheet.getCell('D1').value = 'Áreas';
    refSheet.getCell('D1').style = headerStyle;
    refSheet.getCell('F1').value = 'Asignaturas';
    refSheet.getCell('F1').style = headerStyle;
    refSheet.getCell('G1').value = 'Área';
    refSheet.getCell('G1').style = headerStyle;
    refSheet.getCell('I1').value = 'Grupos';
    refSheet.getCell('I1').style = headerStyle;
    refSheet.getCell('J1').value = 'Grado';
    refSheet.getCell('J1').style = headerStyle;
    refSheet.getCell('K1').value = 'Jornada';
    refSheet.getCell('K1').style = headerStyle;
    refSheet.getCell('L1').value = 'Sede';
    refSheet.getCell('L1').style = headerStyle;
    refSheet.getCell('N1').value = 'Sedes';
    refSheet.getCell('N1').style = headerStyle;
    refSheet.getCell('O1').value = 'Jornadas';
    refSheet.getCell('O1').style = headerStyle;

    refSheet.getColumn('A').width = 28;
    refSheet.getColumn('B').width = 28;
    refSheet.getColumn('C').width = 3;
    refSheet.getColumn('D').width = 20;
    refSheet.getColumn('E').width = 3;
    refSheet.getColumn('F').width = 22;
    refSheet.getColumn('G').width = 18;
    refSheet.getColumn('H').width = 3;
    refSheet.getColumn('I').width = 12;
    refSheet.getColumn('J').width = 15;
    refSheet.getColumn('K').width = 14;
    refSheet.getColumn('L').width = 18;
    refSheet.getColumn('M').width = 3;
    refSheet.getColumn('N').width = 18;
    refSheet.getColumn('O').width = 22;

    const maxLen = Math.max(teachers.length, subjects.length, groups.length, campuses.length, areas.length, 1);
    for (let i = 0; i < maxLen; i++) {
      const r = i + 2;
      if (i < teachers.length) {
        const t = teachers[i];
        refSheet.getCell(`A${r}`).value = `${t.user.firstName || ''} ${t.user.lastName || ''}`.trim();
        refSheet.getCell(`B${r}`).value = t.user.email;
      }
      if (i < areas.length) refSheet.getCell(`D${r}`).value = areas[i].name;
      if (i < subjects.length) {
        refSheet.getCell(`F${r}`).value = subjects[i].name;
        refSheet.getCell(`G${r}`).value = subjects[i].area?.name || '';
      }
      if (i < groups.length) {
        refSheet.getCell(`I${r}`).value = groups[i].name;
        refSheet.getCell(`J${r}`).value = groups[i].grade?.name || '';
        refSheet.getCell(`K${r}`).value = groups[i].shift?.name || '';
        refSheet.getCell(`L${r}`).value = groups[i].campus?.name || '';
      }
      if (i < campuses.length) {
        refSheet.getCell(`N${r}`).value = campuses[i].name;
        refSheet.getCell(`O${r}`).value = campuses[i].shifts.map(s => s.name).join(', ');
      }
    }

    // ── Hoja 3: Instrucciones ──
    const instrSheet = workbook.addWorksheet('Instrucciones');
    instrSheet.mergeCells('A1:F1');
    instrSheet.getCell('A1').value = 'INSTRUCCIONES PARA LA CARGA ACADÉMICA';
    instrSheet.getCell('A1').style = { font: { bold: true, size: 16, color: { argb: 'FF2563EB' } }, alignment: { horizontal: 'center' } };

    const instructions = [
      '',
      'COLUMNAS OBLIGATORIAS (marcadas con *):', '',
      '  • Nombre Docente: Nombre completo del docente.',
      '  • Email Docente (opcional): Correo electrónico. Si se omite, se busca por nombre o se genera automáticamente.',
      '  • Área Académica: Nombre del área (ej: Matemáticas, Lenguaje). Se crea si no existe.',
      '  • Asignatura: Nombre de la materia (ej: Álgebra, Español). Se crea si no existe.',
      '  • Grado: Nombre o número del grado (ej: Séptimo, 7°, 7). Se crea si no existe.',
      '  • Grupo: Código del grupo (ej: 7A, 7B, 701). Se crea si no existe.',
      '  • Horas Semanales: Número de horas por semana (1-20).', '',
      'COLUMNAS OPCIONALES:', '',
      '  • Documento Docente: Número de documento (se usa como contraseña inicial si se crea el usuario).',
      '  • Jornada: Mañana, Tarde, Única, Noche. Si se omite, se usa la primera jornada disponible.',
      '  • Sede: Nombre de la sede. Si se omite, se usa la primera sede disponible.',
      '  • Restricciones: Texto libre con restricciones del docente para esta asignación.',
      '  • Director de Grupo: Escriba "Director" si el docente es director de ese grupo, o "Acompañante" si es acompañante. Déjelo vacío si no aplica.', '',
      'CREACIÓN AUTOMÁTICA:', '',
      '  El sistema creará automáticamente las entidades que no existan:',
      '  - Docentes (con contraseña = número de documento o "temporal123")',
      '  - Áreas y asignaturas',
      '  - Grados y grupos',
      '  - Salones por grupo (ej: "Salón 6A")',
      '  - Bloques de tiempo por defecto (si no existen)', '',
      'DESPUÉS DE IMPORTAR:',
      '  1. Revise los datos creados en la vista previa.',
      '  2. Configure bloques horarios (periodos, recesos, tutorías).',
      '  3. Configure restricciones adicionales (disponibilidad, consecutividad).',
      '  4. Use "Generar Horario" para crear el horario automáticamente.',
      '  5. Ajuste manualmente si es necesario.',
    ];

    instructions.forEach((text, i) => {
      instrSheet.getCell(`A${i + 3}`).value = text;
      instrSheet.getCell(`A${i + 3}`).font = { size: 11 };
    });
    instrSheet.getColumn('A').width = 85;

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // IMPORTAR CARGA ACADÉMICA DESDE EXCEL
  // ═══════════════════════════════════════════════════════════════════════════

  async importTeachingLoad(
    institutionId: string,
    academicYearId: string,
    fileBuffer: Buffer,
  ): Promise<ImportResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as any);

    const sheet = workbook.getWorksheet('Carga Académica') || workbook.getWorksheet(1);
    if (!sheet) {
      throw new BadRequestException('No se encontró la hoja "Carga Académica" en el archivo');
    }

    // ── LIMPIEZA: Borrar carga previa para reemplazarla con la nueva ──
    this.logger.log('Eliminando carga académica previa antes de importar...');
    await this.prisma.scheduleEntry.deleteMany({
      where: { institutionId, academicYearId },
    });
    // Use institutionId directly (not nested relation) to guarantee ALL assignments are deleted
    const prevDeleted = await this.prisma.teacherAssignment.deleteMany({
      where: { academicYearId, institutionId },
    });
    if (prevDeleted.count > 0) {
      this.logger.log(`Eliminadas ${prevDeleted.count} asignaciones previas`);
    }

    // Parsear filas con nuevas columnas
    const rows: TeachingLoadRow[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const teacherName = row.getCell(1).value?.toString()?.trim() || '';
      const teacherEmail = row.getCell(2).value?.toString()?.trim() || '';
      const teacherDocument = row.getCell(3).value?.toString()?.trim() || '';
      const areaName = row.getCell(4).value?.toString()?.trim() || '';
      const subjectName = row.getCell(5).value?.toString()?.trim() || '';
      const gradeName = row.getCell(6).value?.toString()?.trim() || '';
      const groupName = row.getCell(7).value?.toString()?.trim() || '';
      const shiftName = row.getCell(8).value?.toString()?.trim() || '';
      const campusName = row.getCell(9).value?.toString()?.trim() || '';
      const weeklyHoursRaw = row.getCell(10).value;
      const restrictions = row.getCell(11).value?.toString()?.trim() || '';
      const directorDeGrupo = row.getCell(12).value?.toString()?.trim() || '';

      // Ignorar filas vacías
      if (!teacherName && !teacherEmail && !subjectName && !groupName) return;

      if (!teacherName) {
        errors.push(`Fila ${rowNumber}: Nombre del docente es obligatorio`);
        return;
      }
      if (!areaName) {
        errors.push(`Fila ${rowNumber}: Área académica es obligatoria`);
        return;
      }
      if (!subjectName) {
        errors.push(`Fila ${rowNumber}: Nombre de asignatura es obligatorio`);
        return;
      }
      if (!gradeName) {
        errors.push(`Fila ${rowNumber}: Nombre de grado es obligatorio`);
        return;
      }
      if (!groupName) {
        errors.push(`Fila ${rowNumber}: Nombre de grupo es obligatorio`);
        return;
      }

      const weeklyHours = typeof weeklyHoursRaw === 'number'
        ? weeklyHoursRaw
        : parseInt(weeklyHoursRaw?.toString() || '0', 10);

      if (!weeklyHours || weeklyHours < 1 || weeklyHours > 20) {
        errors.push(`Fila ${rowNumber}: Horas semanales inválidas (${weeklyHoursRaw}). Debe ser 1-20`);
        return;
      }

      rows.push({
        teacherName, teacherEmail: teacherEmail ? teacherEmail.toLowerCase() : undefined, teacherDocument,
        areaName, subjectName, gradeName, groupName,
        shiftName, campusName, weeklyHours, restrictions, directorDeGrupo, rowNumber,
      });
    });

    if (rows.length === 0) {
      throw new BadRequestException('El archivo no contiene filas de datos válidas');
    }

    // ── VALIDACIÓN: Detectar posibles errores grado-grupo ──
    const gradeGroupPairs = new Map<string, Set<string>>();
    for (const row of rows) {
      const gn = row.groupName.toLowerCase();
      if (!gradeGroupPairs.has(gn)) gradeGroupPairs.set(gn, new Set());
      gradeGroupPairs.get(gn)!.add(row.gradeName);
    }
    for (const [groupName, grades] of gradeGroupPairs) {
      if (grades.size > 1) {
        warnings.push(`⚠️ El grupo "${groupName.toUpperCase()}" aparece en ${grades.size} grados distintos: ${Array.from(grades).join(', ')}. Verifique que no sea un error de digitación.`);
      }
    }

    // ── FASE 1: Resolver o crear Campus y Shift ──
    const defaultCampus = await this.prisma.campus.findFirst({ where: { institutionId } });
    const campusCache = new Map<string, string>();
    const shiftCache = new Map<string, string>(); // key: "campusId|shiftType"
    const entitiesCreated = { teachers: 0, areas: 0, subjects: 0, grades: 0, groups: 0 };

    for (const row of rows) {
      const campusKey = (row.campusName || '').toLowerCase() || '__default__';

      if (!campusCache.has(campusKey)) {
        let campus: { id: string } | null = null;
        if (row.campusName) {
          campus = await this.prisma.campus.findFirst({
            where: { institutionId, name: { equals: row.campusName, mode: 'insensitive' } },
          });
          if (!campus) {
            campus = await this.prisma.campus.create({
              data: { institutionId, name: row.campusName },
            });
            warnings.push(`Sede "${row.campusName}" creada automáticamente`);
          }
        } else {
          campus = defaultCampus;
        }
        if (campus) campusCache.set(campusKey, campus.id);
      }

      const campusId = campusCache.get(campusKey);
      if (!campusId) {
        errors.push(`Fila ${row.rowNumber}: No se pudo resolver la sede. Cree al menos una sede.`);
        continue;
      }

      const shiftType = row.shiftName ? (SHIFT_MAPPING[row.shiftName.toLowerCase()] || 'MORNING') : 'MORNING';
      const shiftKey = `${campusId}|${shiftType}`;

      if (!shiftCache.has(shiftKey)) {
        let shift = await this.prisma.shift.findFirst({
          where: { campusId, type: shiftType },
        });
        if (!shift) {
          const shiftNames: Record<string, string> = {
            MORNING: 'Mañana', AFTERNOON: 'Tarde', SINGLE: 'Jornada Única', NIGHT: 'Noche',
          };
          shift = await this.prisma.shift.create({
            data: { campusId, type: shiftType, name: shiftNames[shiftType] || shiftType },
          });
          warnings.push(`Jornada "${shiftNames[shiftType]}" creada en sede`);
        }
        shiftCache.set(shiftKey, shift.id);
      }
    }

    // ── FASE 2: Resolver o crear Grades ──
    const gradeCache = new Map<string, string>();
    for (const row of rows) {
      const gradeKey = row.gradeName.toLowerCase();
      if (gradeCache.has(gradeKey)) continue;

      let grade = await this.prisma.grade.findFirst({
        where: { name: { equals: row.gradeName, mode: 'insensitive' } },
      });

      if (!grade) {
        const mapped = GRADE_MAPPING[gradeKey];
        if (mapped) {
          grade = await this.prisma.grade.findFirst({
            where: { stage: mapped.stage, name: { equals: mapped.name, mode: 'insensitive' } },
          });
          if (!grade) {
            grade = await this.prisma.grade.create({
              data: { stage: mapped.stage, number: mapped.number, name: mapped.name },
            });
            entitiesCreated.grades++;
            warnings.push(`Grado "${mapped.name}" creado automáticamente`);
          }
        } else {
          // Intentar parsear número
          const numMatch = row.gradeName.match(/(\d+)/);
          if (numMatch) {
            const num = parseInt(numMatch[1], 10);
            const stage: GradeStage = num <= 0 ? 'PREESCOLAR' : num <= 5 ? 'BASICA_PRIMARIA' : num <= 9 ? 'BASICA_SECUNDARIA' : 'MEDIA';
            grade = await this.prisma.grade.create({
              data: { stage, number: num, name: row.gradeName },
            });
            entitiesCreated.grades++;
            warnings.push(`Grado "${row.gradeName}" creado como ${stage}`);
          } else {
            errors.push(`Fila ${row.rowNumber}: No se pudo interpretar el grado "${row.gradeName}"`);
            continue;
          }
        }
      }
      if (grade) gradeCache.set(gradeKey, grade.id);
    }

    // ── FASE 3: Resolver o crear Groups ──
    const groupCache = new Map<string, string>();
    for (const row of rows) {
      const gradeId = gradeCache.get(row.gradeName.toLowerCase());
      if (!gradeId) continue;

      const campusKey = (row.campusName || '').toLowerCase() || '__default__';
      const campusId = campusCache.get(campusKey);
      if (!campusId) continue;

      const shiftType = row.shiftName ? (SHIFT_MAPPING[row.shiftName.toLowerCase()] || 'MORNING') : 'MORNING';
      const shiftId = shiftCache.get(`${campusId}|${shiftType}`);
      if (!shiftId) continue;

      const groupKey = `${row.groupName.toLowerCase()}|${gradeId}|${shiftId}|${campusId}`;
      if (groupCache.has(groupKey)) continue;

      let group = await this.prisma.group.findFirst({
        where: {
          name: { equals: row.groupName, mode: 'insensitive' },
          gradeId,
          shiftId,
          campusId,
        },
      });

      if (!group) {
        group = await this.prisma.group.create({
          data: { name: row.groupName, gradeId, shiftId, campusId },
        });
        entitiesCreated.groups++;
        warnings.push(`Grupo "${row.groupName}" creado automáticamente`);
      }
      groupCache.set(groupKey, group.id);
    }

    // ── FASE 3.5: Auto-crear Rooms por grupo si no existen ──
    const roomCache = new Map<string, string>();
    for (const row of rows) {
      const gradeId = gradeCache.get(row.gradeName.toLowerCase());
      if (!gradeId) continue;
      const campusKey = (row.campusName || '').toLowerCase() || '__default__';
      const campusId = campusCache.get(campusKey);
      if (!campusId) continue;
      const shiftType = row.shiftName ? (SHIFT_MAPPING[row.shiftName.toLowerCase()] || 'MORNING') : 'MORNING';
      const shiftId = shiftCache.get(`${campusId}|${shiftType}`);
      if (!shiftId) continue;

      const groupKey = `${row.groupName.toLowerCase()}|${gradeId}|${shiftId}|${campusId}`;
      const groupId = groupCache.get(groupKey);
      if (!groupId || roomCache.has(groupKey)) continue;

      const roomName = `Salón ${row.groupName}`;
      // Buscar primero con nombre exacto, luego sin grado para retrocompatibilidad
      let room = await this.prisma.room.findFirst({
        where: { institutionId, name: { equals: roomName, mode: 'insensitive' } },
      });
      if (!room) {
        room = await this.prisma.room.create({
          data: { institutionId, name: roomName, capacity: 40, isActive: true },
        });
        warnings.push(`Salón "${roomName}" creado automáticamente`);
      }
      roomCache.set(groupKey, room.id);
    }

    // ── FASE 3.9: Auto-crear bloques de tiempo por defecto si no existen ──
    for (const [shiftKey, shiftId] of shiftCache.entries()) {
      const existingBlocks = await this.prisma.timeBlock.findMany({
        where: { institutionId, shiftId },
      });
      if (existingBlocks.length === 0) {
        // Crear bloques por defecto: 7 clases de 55min, 2 recesos de 15min, 1 almuerzo de 30min
        const defaultBlocks = [
          { order: 1, type: 'CLASS' as const, startTime: '06:30', endTime: '07:25', label: '1° Hora' },
          { order: 2, type: 'CLASS' as const, startTime: '07:25', endTime: '08:20', label: '2° Hora' },
          { order: 3, type: 'BREAK' as const, startTime: '08:20', endTime: '08:35', label: 'Receso' },
          { order: 4, type: 'CLASS' as const, startTime: '08:35', endTime: '09:30', label: '3° Hora' },
          { order: 5, type: 'CLASS' as const, startTime: '09:30', endTime: '10:25', label: '4° Hora' },
          { order: 6, type: 'BREAK' as const, startTime: '10:25', endTime: '10:40', label: 'Receso' },
          { order: 7, type: 'CLASS' as const, startTime: '10:40', endTime: '11:35', label: '5° Hora' },
          { order: 8, type: 'CLASS' as const, startTime: '11:35', endTime: '12:30', label: '6° Hora' },
          { order: 9, type: 'LUNCH' as const, startTime: '12:30', endTime: '13:00', label: 'Almuerzo' },
          { order: 10, type: 'CLASS' as const, startTime: '13:00', endTime: '13:55', label: '7° Hora' },
        ];

        for (const block of defaultBlocks) {
          await this.prisma.timeBlock.create({
            data: { institutionId, shiftId, ...block },
          });
        }
        warnings.push(`Bloques de tiempo por defecto creados (7 horas clase, 2 recesos, almuerzo). Puede editarlos en la pestaña "Bloques de tiempo".`);
      }
    }

    // ── FASE 4: Resolver o crear Areas y Subjects ──
    const areaCache = new Map<string, string>();
    const subjectCache = new Map<string, string>();

    for (const row of rows) {
      const areaKey = row.areaName.toLowerCase();
      if (!areaCache.has(areaKey)) {
        let area = await this.prisma.area.findFirst({
          where: { institutionId, name: { equals: row.areaName, mode: 'insensitive' } },
        });
        if (!area) {
          area = await this.prisma.area.create({
            data: { institutionId, name: row.areaName, isActive: true },
          });
          entitiesCreated.areas++;
          warnings.push(`Área "${row.areaName}" creada automáticamente`);
        }
        areaCache.set(areaKey, area.id);
      }

      const areaId = areaCache.get(areaKey)!;
      const subjectKey = `${row.subjectName.toLowerCase()}|${areaId}`;
      if (!subjectCache.has(subjectKey)) {
        let subject = await this.prisma.subject.findFirst({
          where: { areaId, name: { equals: row.subjectName, mode: 'insensitive' } },
        });
        if (!subject) {
          subject = await this.prisma.subject.create({
            data: { areaId, name: row.subjectName, isActive: true },
          });
          entitiesCreated.subjects++;
          warnings.push(`Asignatura "${row.subjectName}" creada en área "${row.areaName}"`);
        }
        subjectCache.set(subjectKey, subject.id);
      }
    }

    // ── FASE 5: Resolver o crear Teachers (Users) ──
    const teacherCache = new Map<string, string>(); // key: normalizedName or email

    let docenteRole = await this.prisma.role.findUnique({ where: { name: 'DOCENTE' } });
    if (!docenteRole) {
      docenteRole = await this.prisma.role.create({ data: { name: 'DOCENTE' } });
    }

    // Helper: normalizar nombre para cache key
    const normalizeNameKey = (name: string) => name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

    for (const row of rows) {
      const cacheKey = row.teacherEmail || normalizeNameKey(row.teacherName);
      if (teacherCache.has(cacheKey)) continue;

      let user: { id: string } | null = null;
      let matchMethod = '';

      // 1) Buscar por email si lo tiene
      if (row.teacherEmail) {
        user = await this.prisma.user.findUnique({
          where: { email: row.teacherEmail },
          select: { id: true },
        });
        if (user) matchMethod = 'email';
      }

      // 2) Buscar por número de documento si lo tiene
      if (!user && row.teacherDocument) {
        const byDoc = await this.prisma.user.findFirst({
          where: { documentNumber: row.teacherDocument, isActive: true },
          select: { id: true },
        });
        if (byDoc) {
          user = byDoc;
          matchMethod = 'documento';
        }
      }

      // 3) Buscar por nombre dentro de la institución
      if (!user) {
        const nameParts = row.teacherName.split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const institutionUsers = await this.prisma.institutionUser.findMany({
          where: {
            institutionId,
            isActive: true,
            user: {
              firstName: { equals: firstName, mode: 'insensitive' },
              lastName: { equals: lastName, mode: 'insensitive' },
            },
          },
          select: { user: { select: { id: true } } },
          take: 1,
        });
        if (institutionUsers.length > 0) {
          user = institutionUsers[0].user;
          matchMethod = 'nombre';
        }
      }

      // 4) Si no existe, crear usuario nuevo
      if (!user) {
        const nameParts = row.teacherName.split(/\s+/);
        const firstName = nameParts[0] || 'Docente';
        const lastName = nameParts.slice(1).join(' ') || 'Sin Apellido';
        // Contraseña = número de documento, o nombre+apellido normalizado si no tiene
        let initialPassword: string;
        if (row.teacherDocument) {
          initialPassword = row.teacherDocument;
        } else {
          // Sin documento: usar PrimerNombre + PrimerApellido (sin tildes, sin espacios)
          initialPassword = `${firstName}${lastName.split(/\s+/)[0] || ''}`
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        }
        const passwordHash = await bcrypt.hash(initialPassword, 10);

        // Generar email si no se proveyó
        const autoEmail = row.teacherEmail || `${firstName.charAt(0).toLowerCase()}${lastName.replace(/\s+/g, '').toLowerCase()}.${Date.now().toString(36)}@edusyn.temp`.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        // Generar username simple
        const baseUsername = `${firstName.charAt(0)}${lastName.replace(/\s+/g, '')}`.toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '').substring(0, 20);
        const existingUsernames = await this.prisma.user.findMany({
          where: { username: { startsWith: baseUsername } },
          select: { username: true },
        });
        const username = existingUsernames.length === 0
          ? baseUsername
          : `${baseUsername}${existingUsernames.length}`;

        try {
          user = await this.prisma.user.create({
            data: {
              email: autoEmail,
              username,
              firstName,
              lastName,
              passwordHash,
              documentNumber: row.teacherDocument || null,
              isActive: true,
              mustChangePassword: true,
              roles: { create: { roleId: docenteRole.id } },
              institutionUsers: { create: { institutionId, isAdmin: false } },
            } as any,
          });
          entitiesCreated.teachers++;
          const emailNote = row.teacherEmail ? row.teacherEmail : `email auto: ${autoEmail}`;
          const passwordNote = row.teacherDocument
            ? `contraseña = N° documento (${row.teacherDocument})`
            : `contraseña = "${initialPassword}" (nombre+apellido, sin tildes)`;
          warnings.push(`➕ Docente NUEVO "${row.teacherName}" — usuario: ${username}, ${emailNote}, ${passwordNote}. Debe cambiar contraseña al ingresar.`);
        } catch (e: any) {
          errors.push(`Fila ${row.rowNumber}: Error al crear docente "${row.teacherName}" — ${e.message}`);
          continue;
        }
      } else {
        // Asegurar que está vinculado a la institución
        const instUser = await this.prisma.institutionUser.findUnique({
          where: { userId_institutionId: { userId: user.id, institutionId } },
        });
        if (!instUser) {
          await this.prisma.institutionUser.create({
            data: { userId: user.id, institutionId, isAdmin: false },
          });
        }
      }

      if (matchMethod) {
        warnings.push(`✅ Docente "${row.teacherName}" encontrado por ${matchMethod} (reutilizado, no duplicado)`);
      }
      teacherCache.set(cacheKey, user.id);
    }

    // ── FASE 5.5: Asignar Director/Acompañante de grupo ──
    for (const row of rows) {
      if (!row.directorDeGrupo) continue;
      const role = row.directorDeGrupo.toLowerCase();
      if (role !== 'director' && role !== 'acompañante' && role !== 'acompanante') continue;

      const teacherCacheKey = row.teacherEmail || normalizeNameKey(row.teacherName);
      const teacherId = teacherCache.get(teacherCacheKey);
      if (!teacherId) continue;

      const gradeId = gradeCache.get(row.gradeName.toLowerCase());
      if (!gradeId) continue;
      const campusKey = (row.campusName || '').toLowerCase() || '__default__';
      const campusId = campusCache.get(campusKey);
      if (!campusId) continue;
      const shiftType = row.shiftName ? (SHIFT_MAPPING[row.shiftName.toLowerCase()] || 'MORNING') : 'MORNING';
      const shiftId = shiftCache.get(`${campusId}|${shiftType}`);
      if (!shiftId) continue;

      const groupKey = `${row.groupName.toLowerCase()}|${gradeId}|${shiftId}|${campusId}`;
      const groupId = groupCache.get(groupKey);
      if (!groupId) continue;

      try {
        if (role === 'director') {
          await this.prisma.group.update({ where: { id: groupId }, data: { directorId: teacherId } });
          warnings.push(`"${row.teacherName}" asignado como Director de grupo "${row.groupName}"`);
        } else {
          await this.prisma.group.update({ where: { id: groupId }, data: { companionId: teacherId } });
          warnings.push(`"${row.teacherName}" asignado como Acompañante de grupo "${row.groupName}"`);
        }
      } catch (e: any) {
        errors.push(`Fila ${row.rowNumber}: Error al asignar director/acompañante — ${e.message}`);
      }
    }

    // ── FASE 6: Crear/Actualizar TeacherAssignments ──
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      const teacherCacheKey = row.teacherEmail || normalizeNameKey(row.teacherName);
      const teacherId = teacherCache.get(teacherCacheKey);
      if (!teacherId) { skipped++; continue; }

      const areaId = areaCache.get(row.areaName.toLowerCase());
      if (!areaId) { skipped++; continue; }

      const subjectId = subjectCache.get(`${row.subjectName.toLowerCase()}|${areaId}`);
      if (!subjectId) { skipped++; continue; }

      const gradeId = gradeCache.get(row.gradeName.toLowerCase());
      if (!gradeId) { skipped++; continue; }

      const campusKey = (row.campusName || '').toLowerCase() || '__default__';
      const campusId = campusCache.get(campusKey);
      if (!campusId) { skipped++; continue; }

      const shiftType = row.shiftName ? (SHIFT_MAPPING[row.shiftName.toLowerCase()] || 'MORNING') : 'MORNING';
      const shiftId = shiftCache.get(`${campusId}|${shiftType}`);
      if (!shiftId) { skipped++; continue; }

      const groupKey = `${row.groupName.toLowerCase()}|${gradeId}|${shiftId}|${campusId}`;
      const groupId = groupCache.get(groupKey);
      if (!groupId) { skipped++; continue; }

      try {
        const existing = await this.prisma.teacherAssignment.findFirst({
          where: { academicYearId, groupId, subjectId, teacherId },
        });

        if (existing) {
          if (existing.weeklyHours !== row.weeklyHours) {
            await this.prisma.teacherAssignment.update({
              where: { id: existing.id },
              data: { weeklyHours: row.weeklyHours },
            });
            updated++;
          } else {
            skipped++;
          }
        } else {
          await this.prisma.teacherAssignment.create({
            data: { institutionId, academicYearId, groupId, subjectId, teacherId, weeklyHours: row.weeklyHours },
          });
          created++;
        }
      } catch (e: any) {
        errors.push(`Fila ${row.rowNumber}: Error al guardar asignación — ${e.message}`);
        skipped++;
      }
    }

    // Agregar nota de protección de datos al final de warnings
    warnings.push(`ℹ️ Resumen de entidades: ${entitiesCreated.teachers} docentes nuevos, ${entitiesCreated.areas} áreas nuevas, ${entitiesCreated.subjects} asignaturas nuevas, ${entitiesCreated.grades} grados nuevos, ${entitiesCreated.groups} grupos nuevos.`);
    warnings.push(`🔒 Los docentes, áreas, asignaturas y grupos existentes NO fueron modificados ni eliminados. Solo se reemplazó la carga académica (asignaciones docente↔materia↔grupo).`);

    return {
      success: errors.length === 0,
      totalRows: rows.length,
      created,
      updated,
      skipped,
      errors,
      warnings,
      entitiesCreated,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORTAR HORARIO GENERADO A EXCEL
  // ═══════════════════════════════════════════════════════════════════════════

  async exportSchedule(
    institutionId: string,
    academicYearId: string,
    viewType: 'by-group' | 'by-teacher' = 'by-group',
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Edusyn';

    // Obtener todos los datos necesarios
    const [entries, institution] = await Promise.all([
      this.prisma.scheduleEntry.findMany({
        where: { institutionId, academicYearId },
        include: {
          group: { select: { id: true, name: true } },
          timeBlock: { select: { id: true, startTime: true, endTime: true, order: true, label: true, type: true } },
          teacherAssignment: {
            include: {
              teacher: { select: { id: true, firstName: true, lastName: true } },
              subject: { select: { id: true, name: true, code: true } },
            },
          },
          room: { select: { name: true } },
        },
        orderBy: [{ timeBlock: { order: 'asc' } }, { dayOfWeek: 'asc' }],
      }),
      this.prisma.institution.findUnique({
        where: { id: institutionId },
        select: { name: true },
      }),
    ]);

    if (viewType === 'by-group') {
      await this.exportByGroup(workbook, entries, institution?.name || 'Institución');
    } else {
      await this.exportByTeacher(workbook, entries, institution?.name || 'Institución');
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private async exportByGroup(workbook: ExcelJS.Workbook, entries: any[], institutionName: string) {
    // Agrupar por grupo
    const groupMap = new Map<string, { name: string; entries: any[] }>();
    for (const entry of entries) {
      const key = entry.groupId;
      if (!groupMap.has(key)) {
        groupMap.set(key, { name: entry.group.name, entries: [] });
      }
      groupMap.get(key)!.entries.push(entry);
    }

    // Obtener bloques de tiempo únicos ordenados
    const allBlocks = new Map<string, any>();
    for (const entry of entries) {
      if (!allBlocks.has(entry.timeBlockId)) {
        allBlocks.set(entry.timeBlockId, entry.timeBlock);
      }
    }
    const sortedBlocks = Array.from(allBlocks.values()).sort((a, b) => a.order - b.order);

    // Crear una hoja por grupo
    for (const [groupId, groupData] of groupMap) {
      const sheet = workbook.addWorksheet(groupData.name);

      // Título
      sheet.mergeCells('A1:G1');
      sheet.getCell('A1').value = `${institutionName} — Horario ${groupData.name}`;
      sheet.getCell('A1').style = {
        font: { bold: true, size: 14, color: { argb: 'FF1E3A5F' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
      };
      sheet.getRow(1).height = 35;

      // Encabezados: Hora | Lun | Mar | Mié | Jue | Vie | Sáb
      const daysToShow = this.getDaysWithEntries(groupData.entries);
      const headers = ['Hora', ...daysToShow.map(d => DAY_LABELS[d])];

      const headerRow = sheet.addRow(headers);
      headerRow.eachCell(cell => {
        cell.style = {
          font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } },
          alignment: { horizontal: 'center', vertical: 'middle' },
          border: {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          },
        };
      });

      // Columnas
      sheet.getColumn(1).width = 18;
      for (let i = 2; i <= headers.length; i++) {
        sheet.getColumn(i).width = 22;
      }

      // Filas: un bloque por fila
      for (const block of sortedBlocks) {
        const rowData: string[] = [];

        // Columna Hora
        const blockLabel = block.label || `${block.startTime}-${block.endTime}`;
        const timeLabel = `${blockLabel}\n${block.startTime}-${block.endTime}`;
        rowData.push(timeLabel);

        // Columnas por día
        for (const day of daysToShow) {
          const entry = groupData.entries.find(
            e => e.timeBlockId === block.id && e.dayOfWeek === day,
          );

          if (block.type === 'BREAK') {
            rowData.push('RECESO');
          } else if (block.type === 'LUNCH') {
            rowData.push('ALMUERZO');
          } else if (block.type === 'TUTORING') {
            rowData.push(entry ? this.formatCellContent(entry) : 'TUTORÍA');
          } else if (entry) {
            rowData.push(this.formatCellContent(entry));
          } else {
            rowData.push('');
          }
        }

        const dataRow = sheet.addRow(rowData);
        dataRow.height = 40;
        dataRow.eachCell((cell, colNumber) => {
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };

          // Colores según tipo de bloque
          if (block.type === 'BREAK' || block.type === 'LUNCH') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
            cell.font = { italic: true, color: { argb: 'FF6B7280' } };
          } else if (block.type === 'TUTORING') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
          }
        });
      }
    }
  }

  private async exportByTeacher(workbook: ExcelJS.Workbook, entries: any[], institutionName: string) {
    // Agrupar por docente
    const teacherMap = new Map<string, { name: string; entries: any[] }>();
    for (const entry of entries) {
      if (!entry.teacherAssignment?.teacher) continue;
      const teacher = entry.teacherAssignment.teacher;
      const key = teacher.id;
      if (!teacherMap.has(key)) {
        const name = `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim() || 'Docente';
        teacherMap.set(key, { name: name.trim(), entries: [] });
      }
      teacherMap.get(key)!.entries.push(entry);
    }

    const allBlocks = new Map<string, any>();
    for (const entry of entries) {
      if (!allBlocks.has(entry.timeBlockId)) {
        allBlocks.set(entry.timeBlockId, entry.timeBlock);
      }
    }
    const sortedBlocks = Array.from(allBlocks.values()).sort((a, b) => a.order - b.order);

    for (const [teacherId, teacherData] of teacherMap) {
      // Limitar nombre de hoja a 31 chars (límite Excel)
      const sheetName = teacherData.name.substring(0, 31);
      const sheet = workbook.addWorksheet(sheetName);

      sheet.mergeCells('A1:G1');
      sheet.getCell('A1').value = `${institutionName} — ${teacherData.name}`;
      sheet.getCell('A1').style = {
        font: { bold: true, size: 14, color: { argb: 'FF1E3A5F' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
      };
      sheet.getRow(1).height = 35;

      const daysToShow = this.getDaysWithEntries(teacherData.entries);
      const headers = ['Hora', ...daysToShow.map(d => DAY_LABELS[d])];

      const headerRow = sheet.addRow(headers);
      headerRow.eachCell(cell => {
        cell.style = {
          font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } },
          alignment: { horizontal: 'center', vertical: 'middle' },
          border: {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          },
        };
      });

      sheet.getColumn(1).width = 18;
      for (let i = 2; i <= headers.length; i++) {
        sheet.getColumn(i).width = 22;
      }

      for (const block of sortedBlocks) {
        const rowData: string[] = [];
        const blockLabel = block.label || `${block.startTime}-${block.endTime}`;
        rowData.push(`${blockLabel}\n${block.startTime}-${block.endTime}`);

        for (const day of daysToShow) {
          const entry = teacherData.entries.find(
            e => e.timeBlockId === block.id && e.dayOfWeek === day,
          );

          if (block.type === 'BREAK') {
            rowData.push('RECESO');
          } else if (block.type === 'LUNCH') {
            rowData.push('ALMUERZO');
          } else if (entry) {
            // Para vista de docente: mostrar materia + grupo
            const subject = entry.teacherAssignment?.subject?.name || entry.projectName || '';
            const group = entry.group?.name || '';
            rowData.push(`${subject}\n${group}`);
          } else {
            rowData.push('');
          }
        }

        const dataRow = sheet.addRow(rowData);
        dataRow.height = 40;
        dataRow.eachCell(cell => {
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };

          if (block.type === 'BREAK' || block.type === 'LUNCH') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
            cell.font = { italic: true, color: { argb: 'FF6B7280' } };
          }
        });
      }
    }
  }

  private formatCellContent(entry: any): string {
    const subject = entry.teacherAssignment?.subject?.name || entry.projectName || '';
    const teacher = entry.teacherAssignment?.teacher;
    const teacherName = teacher?.firstName
      ? `${teacher.firstName} ${(teacher.lastName || '').charAt(0)}.`
      : '';
    const room = entry.room?.name || '';

    let content = subject;
    if (teacherName) content += `\n${teacherName}`;
    if (room) content += `\n${room}`;
    return content;
  }

  private getDaysWithEntries(entries: any[]): DayOfWeek[] {
    const daysSet = new Set(entries.map(e => e.dayOfWeek));
    return DAYS_ORDER.filter(d => daysSet.has(d) || d !== 'SATURDAY');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORTAR HORARIO A PDF
  // ═══════════════════════════════════════════════════════════════════════════

  async exportSchedulePdf(
    institutionId: string,
    academicYearId: string,
    viewType: 'by-group' | 'by-teacher' = 'by-group',
  ): Promise<Buffer> {
    const PDFDocument = (await import('pdfkit')).default;

    const [entries, institution] = await Promise.all([
      this.prisma.scheduleEntry.findMany({
        where: { institutionId, academicYearId },
        include: {
          group: {
            select: {
              id: true, name: true,
              grade: { select: { name: true } },
              shift: { select: { name: true } },
              campus: { select: { name: true } },
              director: { select: { id: true, firstName: true, lastName: true } },
              companion: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          timeBlock: { select: { id: true, startTime: true, endTime: true, order: true, label: true, type: true } },
          teacherAssignment: {
            include: {
              teacher: { select: { id: true, firstName: true, lastName: true } },
              subject: { select: { id: true, name: true } },
            },
          },
          room: { select: { name: true } },
        },
        orderBy: [{ timeBlock: { order: 'asc' } }, { dayOfWeek: 'asc' }],
      }),
      this.prisma.institution.findUnique({
        where: { id: institutionId },
        select: { name: true },
      }),
    ]);

    const instName = institution?.name || 'Institución';

    // Agrupar según viewType
    const groupedData = new Map<string, { title: string; subtitle: string; entries: any[] }>();

    // Build teacher-to-directed-groups map for by-teacher view
    const teacherDirectsMap = new Map<string, string[]>();
    const teacherCompanionMap = new Map<string, string[]>();
    for (const e of entries) {
      const dir = e.group?.director;
      const comp = e.group?.companion;
      const gName = e.group?.name || '';
      if (dir) {
        if (!teacherDirectsMap.has(dir.id)) teacherDirectsMap.set(dir.id, []);
        const arr = teacherDirectsMap.get(dir.id)!;
        if (!arr.includes(gName)) arr.push(gName);
      }
      if (comp) {
        if (!teacherCompanionMap.has(comp.id)) teacherCompanionMap.set(comp.id, []);
        const arr = teacherCompanionMap.get(comp.id)!;
        if (!arr.includes(gName)) arr.push(gName);
      }
    }

    if (viewType === 'by-group') {
      for (const e of entries) {
        const key = e.groupId;
        if (!groupedData.has(key)) {
          const gradeName = e.group?.grade?.name || '';
          const shiftName = e.group?.shift?.name || '';
          const dir = e.group?.director;
          const comp = e.group?.companion;
          let subtitle = `${gradeName} — ${shiftName}`;
          if (dir) subtitle += ` · Director: ${dir.firstName} ${dir.lastName}`;
          if (comp) subtitle += ` · Acompañante: ${comp.firstName} ${comp.lastName}`;
          groupedData.set(key, {
            title: `Horario ${e.group?.name || 'Grupo'}`,
            subtitle,
            entries: [],
          });
        }
        groupedData.get(key)!.entries.push(e);
      }
    } else {
      for (const e of entries) {
        if (!e.teacherAssignment?.teacher) continue;
        const t = e.teacherAssignment.teacher;
        const key = t.id;
        if (!groupedData.has(key)) {
          const name = `${t.firstName || ''} ${t.lastName || ''}`.trim();
          const dirGroups = teacherDirectsMap.get(t.id);
          const compGroups = teacherCompanionMap.get(t.id);
          let subtitle = 'Docente';
          if (dirGroups?.length) subtitle += ` · Director de grupo: ${dirGroups.join(', ')}`;
          if (compGroups?.length) subtitle += ` · Acompañante: ${compGroups.join(', ')}`;
          groupedData.set(key, { title: name, subtitle, entries: [] });
        }
        groupedData.get(key)!.entries.push(e);
      }
    }

    // Crear PDF
    const doc = new PDFDocument({ size: 'LETTER', layout: 'landscape', margin: 30 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    let isFirstPage = true;

    for (const [, data] of groupedData) {
      if (!isFirstPage) doc.addPage();
      isFirstPage = false;

      // Obtener bloques y días
      const blocksMap = new Map<string, any>();
      const daysSet = new Set<DayOfWeek>();
      for (const e of data.entries) {
        if (e.timeBlock && !blocksMap.has(e.timeBlock.id)) blocksMap.set(e.timeBlock.id, e.timeBlock);
        if (e.dayOfWeek) daysSet.add(e.dayOfWeek);
      }
      const sortedBlocks = Array.from(blocksMap.values()).sort((a, b) => a.order - b.order);
      const activeDays = DAYS_ORDER.filter(d => daysSet.has(d) || d !== 'SATURDAY');

      // Lookup
      const lookup = new Map<string, any>();
      for (const e of data.entries) {
        const key = `${e.timeBlock?.id}|${e.dayOfWeek}`;
        lookup.set(key, e);
      }

      // Header
      doc.fontSize(8).fillColor('#6B7280').text(instName, 30, 30, { align: 'left' });
      doc.fontSize(16).fillColor('#1E3A5F').text(data.title, 30, 45, { align: 'center', width: 712 });
      doc.fontSize(10).fillColor('#6B7280').text(data.subtitle, 30, 65, { align: 'center', width: 712 });

      // Table dimensions
      const tableTop = 85;
      const colWidth0 = 75; // hora column
      const colWidthDay = (712 - colWidth0) / activeDays.length;
      const rowHeight = sortedBlocks.length > 8 ? 38 : 45;

      // Header row
      doc.rect(30, tableTop, colWidth0, 22).fill('#2563EB');
      doc.fontSize(8).fillColor('#FFFFFF').text('HORA', 30, tableTop + 7, { width: colWidth0, align: 'center' });

      activeDays.forEach((day, i) => {
        const x = 30 + colWidth0 + i * colWidthDay;
        doc.rect(x, tableTop, colWidthDay, 22).fill('#2563EB');
        doc.fontSize(8).fillColor('#FFFFFF').text(DAY_LABELS[day] || day, x, tableTop + 7, { width: colWidthDay, align: 'center' });
      });

      // Data rows
      let y = tableTop + 22;
      for (const block of sortedBlocks) {
        if (y + rowHeight > 580) break; // prevent overflow

        const isBreak = block.type === 'BREAK' || block.type === 'LUNCH';
        const bgColor = isBreak ? '#F3F4F6' : '#FFFFFF';

        // Hora cell
        doc.rect(30, y, colWidth0, rowHeight).fill(bgColor).stroke('#D1D5DB');
        doc.fontSize(7).fillColor('#374151')
          .text(block.label || `Bloque ${block.order}`, 32, y + 4, { width: colWidth0 - 4, align: 'center' });
        doc.fontSize(6).fillColor('#9CA3AF')
          .text(`${block.startTime}-${block.endTime}`, 32, y + 14, { width: colWidth0 - 4, align: 'center' });

        // Day cells
        activeDays.forEach((day, i) => {
          const x = 30 + colWidth0 + i * colWidthDay;
          doc.rect(x, y, colWidthDay, rowHeight).fill(bgColor).stroke('#D1D5DB');

          if (isBreak) {
            doc.fontSize(7).fillColor('#9CA3AF')
              .text(block.type === 'LUNCH' ? 'ALMUERZO' : 'RECESO', x + 2, y + rowHeight / 2 - 5, { width: colWidthDay - 4, align: 'center' });
            return;
          }

          const entry = lookup.get(`${block.id}|${day}`);
          if (!entry) return;

          const subjectName = entry.teacherAssignment?.subject?.name || entry.projectName || '';
          const teacher = entry.teacherAssignment?.teacher;
          const teacherShort = teacher ? `${teacher.firstName || ''} ${(teacher.lastName || '').charAt(0)}.`.trim() : '';
          const roomName = entry.room?.name || '';
          const groupName = viewType === 'by-teacher' ? (entry.group?.name || '') : '';

          // Subject
          doc.fontSize(7).fillColor('#1E40AF')
            .text(subjectName, x + 2, y + 3, { width: colWidthDay - 4, align: 'center' });

          // Teacher or group
          if (viewType === 'by-group' && teacherShort) {
            doc.fontSize(6).fillColor('#374151')
              .text(teacherShort, x + 2, y + 14, { width: colWidthDay - 4, align: 'center' });
          } else if (groupName) {
            doc.fontSize(6).fillColor('#374151')
              .text(groupName, x + 2, y + 14, { width: colWidthDay - 4, align: 'center' });
          }

          // Room
          if (roomName) {
            doc.fontSize(5).fillColor('#9CA3AF')
              .text(roomName, x + 2, y + 24, { width: colWidthDay - 4, align: 'center' });
          }
        });

        y += rowHeight;
      }

      // Footer
      doc.fontSize(6).fillColor('#9CA3AF')
        .text(`Generado por Edusyn — ${new Date().toLocaleDateString('es-CO')}`, 30, 575, { align: 'center', width: 712 });
    }

    return new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    });
  }
}
