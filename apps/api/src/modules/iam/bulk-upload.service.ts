import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import * as bcrypt from 'bcryptjs';
import {
  buildInicioSheet,
  buildDataSheet,
  buildCatalogosSheet,
  buildInstruccionesSheet,
  ColumnDef,
  CatalogBlock,
} from './bulk-upload-template.helper';

interface TeacherRow {
  firstName: string;
  lastName: string;
  email: string;
  documentType?: string;
  documentNumber?: string;
  phone?: string;
}

interface StudentRow {
  firstName: string;
  secondName?: string;
  lastName: string;
  secondLastName?: string;
  documentType: string;
  documentNumber: string;
  birthDate?: string;
  gender?: string;
  email?: string;
  phone?: string;
  address?: string;
  groupCode?: string; // Para matricular automáticamente
}

interface StaffRow {
  firstName: string;
  lastName: string;
  email: string;
  role: string; // COORDINADOR, SECRETARIA, ORIENTADOR, etc.
  documentType?: string;
  documentNumber?: string;
  phone?: string;
}

export interface UploadResult {
  success: number;
  errors: Array<{ row: number; message: string; data?: any }>;
  created: Array<{ id: string; name: string; email?: string }>;
}

@Injectable()
export class BulkUploadService {
  constructor(private prisma: PrismaService) {}

  /**
   * Genera plantilla Excel para docentes (4 hojas: Inicio, Docentes, Catálogos, Instrucciones)
   */
  async generateTeacherTemplate(institutionId?: string): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Edusyn';
    workbook.created = new Date();

    const theme = { primary: '4F46E5', entityName: 'Docentes', entitySingular: 'docente' };

    let institutionName: string | undefined;
    if (institutionId) {
      const inst = await this.prisma.institution.findUnique({ where: { id: institutionId }, select: { name: true } });
      institutionName = inst?.name;
    }

    // Hoja 1: Inicio
    buildInicioSheet(workbook, {
      theme,
      institutionName,
      description:
        'Esta plantilla te permite crear varios docentes a la vez. Cada docente recibirá sus credenciales automáticamente: el usuario se genera con su nombre y la contraseña inicial es su número de documento. En el primer ingreso se les pedirá cambiarla.',
      quickSteps: [
        'Ve a la hoja "Docentes" y completa los datos. Las columnas con encabezado rojo son obligatorias.',
        'Usa la hoja "Catálogos" como referencia para tipos de documento y formato de correos.',
        'Borra las filas de ejemplo (en gris cursiva) antes de subir el archivo.',
        'Guarda el archivo en formato .xlsx y súbelo desde Edusyn → Docentes → Importar.',
        'Revisa el reporte de importación: corrige los errores y vuelve a subir solo las filas con problemas.',
      ],
    });

    // Catálogos
    const catalogos = buildCatalogosSheet(workbook, {
      theme,
      blocks: [
        {
          title: 'Tipos de documento',
          headers: ['Código', 'Descripción'],
          rows: [
            ['CC', 'Cédula de Ciudadanía'],
            ['TI', 'Tarjeta de Identidad'],
            ['CE', 'Cédula de Extranjería'],
            ['PASAPORTE', 'Pasaporte'],
            ['NIT', 'NIT (personas jurídicas)'],
            ['OTRO', 'Otro tipo de documento'],
          ],
          rangeKey: 'documentType',
        },
      ],
    });

    // Hoja Datos
    const columns: ColumnDef[] = [
      { header: 'Nombres', key: 'firstName', width: 25, required: true, comment: 'Primer y segundo nombre. Ej: "Juan Carlos"' },
      { header: 'Apellidos', key: 'lastName', width: 25, required: true, comment: 'Primer y segundo apellido. Ej: "Pérez García"' },
      { header: 'Correo electrónico', key: 'email', width: 35, required: true, format: 'usuario@dominio.com', comment: 'Debe ser único en el sistema' },
      { header: 'Tipo documento', key: 'documentType', width: 16, options: ['CC', 'TI', 'CE', 'PASAPORTE', 'NIT', 'OTRO'] },
      { header: 'Número documento', key: 'documentNumber', width: 20, comment: 'Sin puntos ni espacios. Se usa como contraseña inicial.' },
      { header: 'Teléfono', key: 'phone', width: 16 },
    ];

    buildDataSheet(workbook, {
      sheetName: 'Docentes',
      theme,
      columns,
      examples: [
        { firstName: 'Juan Carlos', lastName: 'Pérez García', email: 'jperez@ejemplo.com', documentType: 'CC', documentNumber: '12345678', phone: '3001234567' },
        { firstName: 'María Fernanda', lastName: 'López Rodríguez', email: 'mlopez@ejemplo.com', documentType: 'CC', documentNumber: '87654321', phone: '3009876543' },
      ],
      validationRefs: catalogos.ranges,
    });

    // Reordenar para que Inicio quede primero, luego Docentes, etc.
    const order = ['Inicio', 'Docentes', 'Catálogos'];
    workbook.worksheets.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));

    // Instrucciones
    buildInstruccionesSheet(workbook, {
      theme,
      sections: [
        {
          title: '1. Antes de empezar',
          items: [
            'Verifica que cada docente tenga al menos: nombres, apellidos y correo electrónico.',
            { type: 'tip', text: 'Si no conoces el documento del docente, igual puedes cargarlo: el sistema le pedirá completarlo en el primer ingreso.' },
            { type: 'warning', text: 'Si un correo ya está registrado en el sistema, esa fila será rechazada.' },
          ],
        },
        {
          title: '2. Generación automática de credenciales',
          items: [
            'Usuario: se genera con la fórmula nombre.apellido (ej: jperez) y se valida que sea único.',
            'Contraseña inicial: el número de documento del docente.',
            { type: 'success', text: 'En el primer ingreso, Edusyn obliga al docente a establecer una contraseña personal segura.' },
          ],
        },
        {
          title: '3. Después de cargar',
          items: [
            'Edusyn te muestra un reporte: cuántos docentes se crearon y cuáles filas tuvieron error.',
            'Para cada error verifica el correo, el documento y el formato de la fila correspondiente.',
            'Una vez creados, asigna a los docentes a las materias en el módulo "Carga académica".',
          ],
        },
      ],
      commonErrors: [
        { error: 'Correo inválido', cause: 'El correo no tiene formato usuario@dominio.com', fix: 'Verifica que tenga @ y un dominio válido' },
        { error: 'El correo X ya está registrado', cause: 'Otro usuario ya usa ese correo', fix: 'Cambia el correo o elimina la cuenta antigua antes de re-importar' },
        { error: 'Número de documento requerido', cause: 'La fila no tiene documento', fix: 'Completa la columna "Número documento" para esa fila' },
        { error: 'Tipo de documento inválido', cause: 'El valor no está en la lista permitida', fix: 'Usa solo CC, TI, CE, PASAPORTE, NIT u OTRO' },
      ],
    });

    return workbook;
  }

  /**
   * Genera plantilla Excel para estudiantes (4 hojas: Inicio, Estudiantes, Catálogos, Instrucciones)
   */
  async generateStudentTemplate(institutionId: string): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Edusyn';
    workbook.created = new Date();

    const theme = { primary: '059669', entityName: 'Estudiantes', entitySingular: 'estudiante' };

    const inst = await this.prisma.institution.findUnique({ where: { id: institutionId }, select: { name: true } });
    const institutionName = inst?.name;

    // Cargar grupos para catálogo de referencia
    const groups = await this.prisma.group.findMany({
      where: { campus: { institutionId } },
      include: { grade: true },
      orderBy: [{ grade: { stage: 'asc' } }, { grade: { number: 'asc' } }, { name: 'asc' }],
    });

    // Hoja Inicio
    buildInicioSheet(workbook, {
      theme,
      institutionName,
      description:
        'Esta plantilla te permite registrar varios estudiantes a la vez y matricularlos en sus grupos. Cada estudiante tendrá acceso a Edusyn con un usuario y contraseña iniciales (su documento) que deberá cambiar al primer ingreso.',
      quickSteps: [
        'Verifica primero que tu institución tenga creados los grupos del año lectivo (módulo Académico).',
        'Ve a la hoja "Estudiantes" y completa los datos. Los campos con encabezado rojo son obligatorios.',
        'En "Código Grupo" usa exactamente el código que aparece en la hoja "Catálogos" (ej: 6A, 11-1).',
        'Borra las filas de ejemplo (en gris cursiva) antes de subir el archivo.',
        'Sube el archivo desde Edusyn → Estudiantes → Importar y revisa el reporte de resultados.',
      ],
    });

    // Catálogos
    const catalogos = buildCatalogosSheet(workbook, {
      theme,
      blocks: [
        {
          title: 'Tipos de documento',
          headers: ['Código', 'Descripción'],
          rows: [
            ['TI', 'Tarjeta de Identidad'],
            ['RC', 'Registro Civil'],
            ['CC', 'Cédula de Ciudadanía'],
            ['CE', 'Cédula de Extranjería'],
            ['PASAPORTE', 'Pasaporte'],
          ],
          rangeKey: 'documentType',
        },
        {
          title: 'Género',
          headers: ['Código', 'Descripción'],
          rows: [
            ['M', 'Masculino'],
            ['F', 'Femenino'],
            ['O', 'Otro'],
          ],
          rangeKey: 'gender',
        },
        {
          title: 'Grupos disponibles en tu institución',
          headers: ['Código', 'Nombre', 'Grado'],
          rows: groups.length > 0
            ? groups.map(g => [g.code || g.name, g.name, g.grade.name])
            : [['(sin grupos)', 'Crea los grupos primero en Módulo Académico', '—']],
          rangeKey: 'groupCode',
        },
      ],
    });

    const columns: ColumnDef[] = [
      { header: 'Primer nombre', key: 'firstName', width: 18, required: true },
      { header: 'Segundo nombre', key: 'secondName', width: 18 },
      { header: 'Primer apellido', key: 'lastName', width: 18, required: true },
      { header: 'Segundo apellido', key: 'secondLastName', width: 18 },
      { header: 'Tipo documento', key: 'documentType', width: 15, required: true, options: ['TI', 'RC', 'CC', 'CE', 'PASAPORTE'] },
      { header: 'Número documento', key: 'documentNumber', width: 20, required: true, comment: 'Se usa como contraseña inicial.' },
      { header: 'Fecha nacimiento', key: 'birthDate', width: 16, format: 'YYYY-MM-DD', comment: 'Ej: 2010-05-15' },
      { header: 'Género', key: 'gender', width: 10, options: ['M', 'F', 'O'] },
      { header: 'Correo', key: 'email', width: 28 },
      { header: 'Teléfono', key: 'phone', width: 14 },
      { header: 'Dirección', key: 'address', width: 32 },
      { header: 'Código grupo', key: 'groupCode', width: 14, hint: 'Ver hoja Catálogos' },
    ];

    buildDataSheet(workbook, {
      sheetName: 'Estudiantes',
      theme,
      columns,
      examples: [
        { firstName: 'Pedro', secondName: 'Andrés', lastName: 'Martínez', secondLastName: 'Silva', documentType: 'TI', documentNumber: '1234567890', birthDate: '2010-05-15', gender: 'M', email: 'pmartinez@ejemplo.com', phone: '3001112233', address: 'Calle 123 # 45-67', groupCode: groups[0]?.code || groups[0]?.name || '6A' },
        { firstName: 'Ana', secondName: 'María', lastName: 'González', secondLastName: 'Ruiz', documentType: 'TI', documentNumber: '0987654321', birthDate: '2011-08-22', gender: 'F', email: '', phone: '', address: 'Carrera 89 # 12-34', groupCode: groups[0]?.code || groups[0]?.name || '6A' },
      ],
      validationRefs: catalogos.ranges,
    });

    const order = ['Inicio', 'Estudiantes', 'Catálogos'];
    workbook.worksheets.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));

    buildInstruccionesSheet(workbook, {
      theme,
      sections: [
        {
          title: '1. Requisitos previos',
          items: [
            'La institución debe tener un año académico activo (Módulo Académico → Años).',
            'Los grupos donde matricularás a los estudiantes deben existir antes de cargar.',
            { type: 'tip', text: 'Si no defines "Código grupo" el estudiante se crea pero queda sin matricular. Podás asignarlo después manualmente.' },
          ],
        },
        {
          title: '2. Identidad y credenciales',
          items: [
            'El número de documento es la contraseña inicial del estudiante.',
            'Si el estudiante no tiene correo, Edusyn genera uno automáticamente (formato usuario@estudiante.local).',
            { type: 'warning', text: 'No se puede crear dos estudiantes con el mismo documento en la misma institución.' },
          ],
        },
        {
          title: '3. Formato de las celdas',
          items: [
            'Fecha de nacimiento: usa formato YYYY-MM-DD. Ej: 2010-05-15.',
            'No agregues puntos ni espacios al número de documento.',
            'Teléfonos: solo números, sin guiones ni espacios.',
          ],
        },
      ],
      commonErrors: [
        { error: 'Estudiante con documento X ya existe', cause: 'Ya hay un estudiante con ese documento en la institución', fix: 'Verifica si está duplicado o usa otro documento' },
        { error: 'Código de grupo no encontrado', cause: 'El código no coincide con ningún grupo activo', fix: 'Revisa la hoja "Catálogos" y copia el código exacto' },
        { error: 'Fecha de nacimiento inválida', cause: 'El formato no es YYYY-MM-DD', fix: 'Reformatea como 2010-05-15 (año-mes-día)' },
        { error: 'Correo ya registrado', cause: 'Otro usuario tiene ese correo', fix: 'Deja la celda vacía para auto-generar uno o usa otro correo' },
      ],
    });

    return workbook;
  }

  /**
   * Genera plantilla Excel para otros usuarios / staff (4 hojas)
   */
  async generateStaffTemplate(institutionId?: string): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Edusyn';
    workbook.created = new Date();

    const theme = { primary: '7C3AED', entityName: 'Personal administrativo', entitySingular: 'usuario' };

    let institutionName: string | undefined;
    if (institutionId) {
      const inst = await this.prisma.institution.findUnique({ where: { id: institutionId }, select: { name: true } });
      institutionName = inst?.name;
    }

    buildInicioSheet(workbook, {
      theme,
      institutionName,
      description:
        'Usa esta plantilla para crear coordinadores, secretarias, orientadores y otro personal administrativo. Cada usuario recibe credenciales automáticas (usuario y contraseña basada en su documento) y deberá cambiarlas en su primer ingreso.',
      quickSteps: [
        'Completa la hoja "Personal" con los datos del personal administrativo.',
        'En la columna "Rol" usa solo los valores listados (COORDINADOR, SECRETARIA, ORIENTADOR, etc.).',
        'Borra las filas de ejemplo antes de subir el archivo.',
        'Sube desde Edusyn → Otros Usuarios → Importar masivamente.',
        'Revisa el reporte: corrige y vuelve a subir solo las filas con error si las hay.',
      ],
    });

    const catalogos = buildCatalogosSheet(workbook, {
      theme,
      blocks: [
        {
          title: 'Roles válidos',
          headers: ['Código', 'Función principal'],
          rows: [
            ['COORDINADOR', 'Coordinación académica o de convivencia'],
            ['SECRETARIA', 'Secretaría académica'],
            ['ORIENTADOR', 'Orientación / Psicología escolar'],
            ['BIBLIOTECARIO', 'Biblioteca'],
            ['AUXILIAR', 'Auxiliar administrativo'],
          ],
          rangeKey: 'role',
        },
        {
          title: 'Tipos de documento',
          headers: ['Código', 'Descripción'],
          rows: [
            ['CC', 'Cédula de Ciudadanía'],
            ['TI', 'Tarjeta de Identidad'],
            ['CE', 'Cédula de Extranjería'],
            ['PASAPORTE', 'Pasaporte'],
            ['NIT', 'NIT'],
            ['OTRO', 'Otro'],
          ],
          rangeKey: 'documentType',
        },
      ],
    });

    const columns: ColumnDef[] = [
      { header: 'Nombres', key: 'firstName', width: 25, required: true },
      { header: 'Apellidos', key: 'lastName', width: 25, required: true },
      { header: 'Correo electrónico', key: 'email', width: 32, required: true, format: 'usuario@dominio.com' },
      { header: 'Rol', key: 'role', width: 20, required: true, options: ['COORDINADOR', 'SECRETARIA', 'ORIENTADOR', 'BIBLIOTECARIO', 'AUXILIAR'] },
      { header: 'Tipo documento', key: 'documentType', width: 16, options: ['CC', 'TI', 'CE', 'PASAPORTE', 'NIT', 'OTRO'] },
      { header: 'Número documento', key: 'documentNumber', width: 20, comment: 'Se usa como contraseña inicial.' },
      { header: 'Teléfono', key: 'phone', width: 16 },
    ];

    buildDataSheet(workbook, {
      sheetName: 'Personal',
      theme,
      columns,
      examples: [
        { firstName: 'Laura', lastName: 'Sánchez Mora', email: 'lsanchez@ejemplo.com', role: 'COORDINADOR', documentType: 'CC', documentNumber: '11223344', phone: '3005556677' },
        { firstName: 'Carmen', lastName: 'Díaz Torres', email: 'cdiaz@ejemplo.com', role: 'SECRETARIA', documentType: 'CC', documentNumber: '55667788', phone: '3008889900' },
      ],
      validationRefs: catalogos.ranges,
    });

    const order = ['Inicio', 'Personal', 'Catálogos'];
    workbook.worksheets.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));

    buildInstruccionesSheet(workbook, {
      theme,
      sections: [
        {
          title: '1. Roles disponibles',
          items: [
            'Coordinador: gestiona académicos, asistencia, observaciones y reportes.',
            'Secretaria: gestiona matrículas, certificados y datos básicos.',
            'Orientador: maneja seguimiento socioemocional y observador del estudiante.',
            'Bibliotecario y Auxiliar: roles operativos según necesidad de la institución.',
            { type: 'tip', text: 'Cada rol da acceso solo a los módulos y acciones que corresponden a su función.' },
          ],
        },
        {
          title: '2. Credenciales automáticas',
          items: [
            'Usuario: nombre.apellido (validado para que sea único).',
            'Contraseña inicial: el número de documento.',
            { type: 'success', text: 'En el primer ingreso el sistema obliga a cambiar la contraseña por una segura.' },
          ],
        },
      ],
      commonErrors: [
        { error: 'Rol inválido', cause: 'El valor en la columna Rol no está en la lista permitida', fix: 'Usa solo los códigos de la hoja "Catálogos"' },
        { error: 'Correo ya registrado', cause: 'Otro usuario usa ese correo', fix: 'Verifica si el usuario ya existe o usa otro correo' },
        { error: 'Número de documento requerido', cause: 'No se proporcionó documento', fix: 'Completa el campo — se usa como contraseña inicial' },
      ],
    });

    return workbook;
  }

  /**
   * Genera plantilla Excel para carga académica (4 hojas: Inicio, Carga, Catálogos, Instrucciones)
   */
  async generateAcademicLoadTemplate(institutionId: string): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Edusyn';
    workbook.created = new Date();

    const theme = { primary: '0891B2', entityName: 'Carga Académica', entitySingular: 'asignación' };

    const inst = await this.prisma.institution.findUnique({ where: { id: institutionId }, select: { name: true } });
    const institutionName = inst?.name;

    const groups = await this.prisma.group.findMany({
      where: { grade: { institutionId } },
      include: { grade: { select: { name: true, number: true } } },
      orderBy: [{ grade: { number: 'asc' } }, { name: 'asc' }],
    });
    const groupCodes = groups.map(g => `${g.grade.name}-${g.name}`);

    const teachers = await this.prisma.user.findMany({
      where: { institutionUsers: { some: { institutionId } }, roles: { some: { role: { name: 'DOCENTE' } } } },
      select: { email: true, documentNumber: true, firstName: true, lastName: true },
      orderBy: { lastName: 'asc' },
    });

    // Catálogo de áreas y asignaturas ya existentes: para que el usuario reutilice
    // los nombres EXACTOS y no genere duplicados ("Inglés" vs "ingles").
    const areas = await this.prisma.area.findMany({
      where: { institutionId },
      select: { name: true, subjects: { select: { name: true }, orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    });
    const areaSubjectRows: (string | number)[][] = [];
    for (const a of areas) {
      if (a.subjects.length === 0) { areaSubjectRows.push([a.name, '(sin asignaturas)']); continue; }
      for (const s of a.subjects) areaSubjectRows.push([a.name, s.name]);
    }

    buildInicioSheet(workbook, {
      theme,
      institutionName,
      description:
        'Esta plantilla te permite asignar docentes a las asignaturas y grupos del año lectivo. Cada fila representa una asignación: qué docente dicta qué materia en qué grupo. Las áreas y asignaturas que no existan se crearán automáticamente.',
      quickSteps: [
        'Ve a la hoja "Carga" y completa una fila por cada asignación (docente + asignatura + grupo).',
        'Usa la hoja "Catálogos" para ver grupos, docentes y las áreas/asignaturas ya existentes.',
        'Si la asignatura ya existe, cópiala TAL CUAL del catálogo (mismas tildes y mayúsculas) para no duplicarla.',
        'Borra las filas de ejemplo (en gris cursiva) antes de subir el archivo.',
        'Guarda como .xlsx y sube desde Configuración Inicial → Carga Académica.',
        'Revisa el reporte: las asignaciones duplicadas se omiten automáticamente.',
      ],
    });

    const catalogBlocks: CatalogBlock[] = [
      {
        title: 'Grupos disponibles',
        headers: ['Código del grupo', 'Grado'],
        rows: groups.map(g => [`${g.grade.name}-${g.name}`, g.grade.name]),
        rangeKey: 'curso',
      },
    ];
    if (teachers.length > 0) {
      catalogBlocks.push({
        title: 'Docentes registrados',
        headers: ['Correo', 'Documento', 'Nombre'],
        rows: teachers.map(t => [t.email, t.documentNumber || '', `${t.firstName} ${t.lastName}`]),
      });
    }
    if (areaSubjectRows.length > 0) {
      catalogBlocks.push({
        title: 'Áreas y asignaturas existentes (reutiliza estos nombres exactos)',
        headers: ['Área', 'Asignatura'],
        rows: areaSubjectRows,
      });
    }
    const catalogos = buildCatalogosSheet(workbook, { theme, blocks: catalogBlocks });

    const columns: ColumnDef[] = [
      { header: 'Curso', key: 'curso', width: 18, required: true, comment: 'Código del grupo (ej: "6°-A", "TA"). Usa los valores de la hoja Catálogos.' },
      { header: 'Área', key: 'area', width: 22, comment: 'Nombre del área. Reutiliza los del catálogo si ya existen. Si se omite, se usa "General".' },
      { header: 'Asignatura', key: 'asignatura', width: 25, required: true, comment: 'Nombre de la asignatura. Si ya existe, cópiala igual del catálogo (tildes/mayúsculas) para no duplicar.' },
      { header: 'Intensidad horaria', key: 'intensidad', width: 18, comment: 'Horas semanales (número). Ej: 4' },
      { header: 'Documento docente', key: 'docenteDoc', width: 20, comment: 'Número de documento del docente.' },
      { header: 'Correo docente', key: 'docenteCorreo', width: 30, comment: 'Correo del docente. Se requiere documento O correo.' },
    ];

    const exCurso = groupCodes[0] || 'TA';
    const exCorreo = teachers[0]?.email || 'jperez@ejemplo.com';
    const exDoc = teachers[0]?.documentNumber || '12345678';

    buildDataSheet(workbook, {
      sheetName: 'Carga',
      theme,
      columns,
      examples: [
        { curso: exCurso, area: 'Matemáticas', asignatura: 'Aritmética', intensidad: 5, docenteDoc: exDoc, docenteCorreo: exCorreo },
        { curso: exCurso, area: 'Lenguaje', asignatura: 'Español', intensidad: 4, docenteDoc: '', docenteCorreo: exCorreo },
        { curso: exCurso, area: 'Ciencias Naturales', asignatura: 'Biología', intensidad: 3, docenteDoc: exDoc, docenteCorreo: '' },
      ],
      validationRefs: catalogos.ranges,
    });

    const order = ['Inicio', 'Carga', 'Catálogos'];
    workbook.worksheets.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));

    buildInstruccionesSheet(workbook, {
      theme,
      sections: [
        {
          title: '1. Requisitos previos',
          items: [
            'La institución debe tener un año académico activo (Módulo Académico → Años).',
            'Los grupos deben existir (se crean al importar estudiantes).',
            'Los docentes deben estar registrados (importados en el paso anterior).',
            { type: 'warning', text: 'Si un docente no está registrado, la fila será rechazada. Impórtalo primero.' },
          ],
        },
        {
          title: '2. Cómo funciona',
          items: [
            'Cada fila es una asignación: docente X dicta materia Y en grupo Z.',
            'Si el área o asignatura no existen, se crean automáticamente.',
            'Si la asignación ya existe (mismo docente + materia + grupo), se omite.',
            { type: 'tip', text: 'Puedes identificar al docente por documento O correo — no necesitas ambos.' },
            { type: 'success', text: 'La operación es idempotente: puedes subir el mismo archivo varias veces sin duplicar datos.' },
          ],
        },
        {
          title: '3. Después de cargar',
          items: [
            'Revisa el reporte de importación: asignaciones creadas, omitidas y errores.',
            'En el módulo "Carga Académica" puedes ver y ajustar las asignaciones.',
          ],
        },
      ],
      commonErrors: [
        { error: 'Curso/grupo no encontrado', cause: 'El código del grupo no coincide con ninguno registrado', fix: 'Verifica el código en la hoja "Catálogos" o importa estudiantes primero' },
        { error: 'Docente no encontrado', cause: 'El correo o documento no coincide con ningún docente registrado', fix: 'Importa al docente en el paso anterior y luego reintenta' },
        { error: 'Falta la asignatura', cause: 'La columna Asignatura está vacía', fix: 'Completa el nombre de la asignatura para esa fila' },
      ],
    });

    return workbook;
  }

  /**
   * Procesa archivo Excel de docentes
   */
  async processTeacherUpload(
    institutionId: string,
    buffer: Buffer,
  ): Promise<UploadResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const sheet = workbook.getWorksheet(1);
    if (!sheet) {
      throw new BadRequestException('El archivo no contiene hojas de cálculo');
    }

    const result: UploadResult = { success: 0, errors: [], created: [] };
    const rows: TeacherRow[] = [];

    // Mapear encabezados dinámicamente
    const headerRow = sheet.getRow(1);
    const columnMap: Record<string, number> = {};
    
    headerRow.eachCell((cell, colNumber) => {
      const header = cell.value?.toString()?.toLowerCase()?.trim() || '';
      // Mapear diferentes nombres posibles de columnas
      if (header.includes('nombre') && !header.includes('segundo') && !header.includes('apellido')) {
        columnMap.firstName = colNumber;
      } else if (header.includes('segundo nombre')) {
        columnMap.secondName = colNumber;
      } else if (header.includes('primer apellido') || (header.includes('apellido') && !header.includes('segundo'))) {
        columnMap.lastName = colNumber;
      } else if (header.includes('segundo apellido')) {
        columnMap.secondLastName = colNumber;
      } else if (header.includes('email') || header.includes('correo')) {
        if (!columnMap.email) columnMap.email = colNumber; // Tomar el primero (email personal)
      } else if (header.includes('tipo') && header.includes('doc')) {
        columnMap.documentType = colNumber;
      } else if (header.includes('documento') || header.includes('número doc') || header.includes('numero doc')) {
        columnMap.documentNumber = colNumber;
      } else if (header.includes('teléfono') || header.includes('telefono') || header.includes('celular') || header.includes('móvil') || header.includes('movil')) {
        if (!columnMap.phone) columnMap.phone = colNumber;
      }
    });

    // Fallback a posiciones fijas si no se encontraron encabezados
    if (!columnMap.firstName) columnMap.firstName = 1;
    if (!columnMap.lastName) columnMap.lastName = 2;
    if (!columnMap.email) columnMap.email = 3;

    // Leer filas (saltando encabezado)
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const firstName = this.extractCellValue(row.getCell(columnMap.firstName || 1));
      const secondName = columnMap.secondName ? this.extractCellValue(row.getCell(columnMap.secondName)) : '';
      const lastName = this.extractCellValue(row.getCell(columnMap.lastName || 2));
      const rawEmail = this.extractCellValue(row.getCell(columnMap.email || 3)).toLowerCase();

      // Ignorar filas vacías o de notas
      if (!firstName || firstName.startsWith('*') || firstName.startsWith('Tipos')) return;

      // Combinar nombre si hay segundo nombre
      const fullFirstName = secondName ? `${firstName} ${secondName}` : firstName;

      // Extraer y normalizar tipo de documento
      const rawDocType = columnMap.documentType ? this.extractCellValue(row.getCell(columnMap.documentType)) : undefined;
      const normalizedDocType = this.normalizeDocumentType(rawDocType);

      // Extraer número de documento (preservar como string para no perder ceros)
      const docNumber = columnMap.documentNumber ? this.extractCellValue(row.getCell(columnMap.documentNumber)) : undefined;

      rows.push({
        firstName: fullFirstName || '',
        lastName: lastName || '',
        email: rawEmail || '',
        documentType: normalizedDocType,
        documentNumber: docNumber,
        phone: columnMap.phone ? this.extractCellValue(row.getCell(columnMap.phone)) : undefined,
      });
    });

    // Obtener rol DOCENTE
    let docenteRole = await this.prisma.role.findUnique({
      where: { name: 'DOCENTE' },
    });
    if (!docenteRole) {
      docenteRole = await this.prisma.role.create({
        data: { name: 'DOCENTE' },
      });
    }

    // Procesar cada fila
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 porque empezamos en fila 2 (después del header)

      try {
        // Validaciones
        if (!row.firstName) {
          result.errors.push({ row: rowNum, message: 'Nombre es obligatorio', data: row });
          continue;
        }
        if (!row.lastName) {
          result.errors.push({ row: rowNum, message: 'Apellido es obligatorio', data: row });
          continue;
        }
        if (!row.email) {
          result.errors.push({ row: rowNum, message: 'Correo es obligatorio', data: row });
          continue;
        }
        if (!this.isValidEmail(row.email)) {
          result.errors.push({ row: rowNum, message: `Correo inválido: "${row.email}" - Debe tener formato usuario@dominio.com`, data: row });
          continue;
        }

        // Validar tipo de documento si se proporciona
        const validDocTypes = ['CC', 'TI', 'CE', 'PASAPORTE', 'RC', 'NIP', 'NUIP'];
        if (row.documentType && !validDocTypes.includes(row.documentType)) {
          result.errors.push({ 
            row: rowNum, 
            message: `Tipo de documento inválido: "${row.documentType}". Valores válidos: ${validDocTypes.join(', ')}`,
            data: row 
          });
          continue;
        }

        // Verificar si ya existe
        const existing = await this.prisma.user.findUnique({
          where: { email: row.email },
        });
        if (existing) {
          result.errors.push({ row: rowNum, message: `El correo ${row.email} ya está registrado` });
          continue;
        }

        // El documento es la contraseña inicial (onboarding) y el usuario debe
        // cambiarla en el primer ingreso. Si no hay documento, no creamos una
        // cuenta con contraseña compartida/débil: se rechaza la fila.
        if (!row.documentNumber) {
          result.errors.push({ row: rowNum, message: 'Número de documento requerido para generar credenciales', data: row });
          continue;
        }
        const username = await this.generateUsernameWithRole(row.firstName, row.lastName, row.documentNumber, 'DOCENTE');
        const passwordHash = await bcrypt.hash(row.documentNumber, 10);

        // Crear usuario + dual-write en transacción
        const user = await this.prisma.$transaction(async (tx) => {
          const created = await tx.user.create({
            data: {
              email: row.email,
              username,
              firstName: row.firstName,
              lastName: row.lastName,
              passwordHash,
              documentType: row.documentType as any,
              documentNumber: row.documentNumber,
              phone: row.phone,
              isActive: true,
              mustChangePassword: true,
              roles: {
                create: {
                  roleId: docenteRole.id,
                },
              },
              institutionUsers: {
                create: {
                  institutionId,
                  isAdmin: false,
                },
              },
            } as any,
          });

          // Dual-write: InstitutionUserRole
          const iu = await tx.institutionUser.findUnique({
            where: { userId_institutionId: { userId: created.id, institutionId } },
          });
          if (iu) {
            await tx.institutionUserRole.upsert({
              where: { institutionUserId_roleId: { institutionUserId: iu.id, roleId: docenteRole.id } },
              create: { institutionUserId: iu.id, roleId: docenteRole.id },
              update: {},
            });
          }
          return created;
        });

        result.success++;
        result.created.push({
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
        });
      } catch (error: any) {
        result.errors.push({
          row: rowNum,
          message: error.message || 'Error desconocido',
          data: row,
        });
      }
    }

    return result;
  }

  /**
   * Procesa archivo Excel de estudiantes
   */
  async processStudentUpload(
    institutionId: string,
    buffer: Buffer,
    academicYearId?: string,
  ): Promise<UploadResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const sheet = workbook.getWorksheet(1);
    if (!sheet) {
      throw new BadRequestException('El archivo no contiene hojas de cálculo');
    }

    const result: UploadResult = { success: 0, errors: [], created: [] };
    const rows: StudentRow[] = [];

    // Leer filas — soportar 4 columnas de nombre (nombre1, nombre2, apellido1, apellido2)
    // También soportar el formato viejo de 2 columnas (Nombres, Apellidos) detectando el encabezado
    const headerRow = sheet.getRow(1);
    const h1 = headerRow.getCell(1).value?.toString()?.trim()?.toLowerCase() || '';
    const h3 = headerRow.getCell(3).value?.toString()?.trim()?.toLowerCase() || '';
    
    // Detectar si es formato de 4 columnas (nombre1, nombre2, apellido1, apellido2)
    // o formato de 2 columnas (nombres, apellidos)
    const isFourNameColumns = h3.includes('apellido') || h3.includes('primer apellido');

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      let firstName: string | undefined;
      let secondName: string | undefined;
      let lastName: string | undefined;
      let secondLastName: string | undefined;
      let docTypeCol: number;
      let docNumCol: number;
      let birthCol: number;
      let genderCol: number;
      let emailCol: number;
      let phoneCol: number;
      let addressCol: number;
      let groupCol: number;

      if (isFourNameColumns) {
        // Formato 4 columnas: nombre1 | nombre2 | apellido1 | apellido2 | tipodoc | numdoc | ...
        firstName = row.getCell(1).value?.toString()?.trim();
        secondName = row.getCell(2).value?.toString()?.trim() || undefined;
        lastName = row.getCell(3).value?.toString()?.trim();
        secondLastName = row.getCell(4).value?.toString()?.trim() || undefined;
        docTypeCol = 5; docNumCol = 6; birthCol = 7; genderCol = 8;
        emailCol = 9; phoneCol = 10; addressCol = 11; groupCol = 12;
      } else {
        // Formato 2 columnas: nombres | apellidos | tipodoc | numdoc | ...
        const rawFirstName = row.getCell(1).value?.toString()?.trim() || '';
        const rawLastName = row.getCell(2).value?.toString()?.trim() || '';
        // Intentar separar nombres compuestos
        const nameParts = rawFirstName.split(/\s+/);
        firstName = nameParts[0];
        secondName = nameParts.slice(1).join(' ') || undefined;
        const lastParts = rawLastName.split(/\s+/);
        lastName = lastParts[0];
        secondLastName = lastParts.slice(1).join(' ') || undefined;
        docTypeCol = 3; docNumCol = 4; birthCol = 5; genderCol = 6;
        emailCol = 7; phoneCol = 8; addressCol = 9; groupCol = 10;
      }

      if (!firstName || firstName.startsWith('*') || firstName.startsWith('Tipos')) return;

      const documentType = row.getCell(docTypeCol).value?.toString()?.trim();
      const documentNumber = row.getCell(docNumCol).value?.toString()?.trim();

      rows.push({
        firstName,
        secondName,
        lastName: lastName || '',
        secondLastName,
        documentType: documentType || 'TI',
        documentNumber: documentNumber || '',
        birthDate: row.getCell(birthCol).value?.toString()?.trim(),
        gender: row.getCell(genderCol).value?.toString()?.trim()?.toUpperCase(),
        email: row.getCell(emailCol).value?.toString()?.trim()?.toLowerCase(),
        phone: row.getCell(phoneCol).value?.toString()?.trim(),
        address: row.getCell(addressCol).value?.toString()?.trim(),
        groupCode: row.getCell(groupCol).value?.toString()?.trim(),
      });
    });

    // Obtener año académico actual si no se especifica
    if (!academicYearId) {
      const currentYear = await this.prisma.academicYear.findFirst({
        where: { institutionId },
        orderBy: { year: 'desc' },
      });
      academicYearId = currentYear?.id;
    }

    // Cargar grupos para mapeo
    const groups = await this.prisma.group.findMany({
      where: { campus: { institutionId } },
    });
    const groupMap = new Map(groups.map((g) => [g.code || g.name, g.id]));

    // Obtener o crear rol ESTUDIANTE
    let estudianteRole = await this.prisma.role.findUnique({
      where: { name: 'ESTUDIANTE' },
    });
    if (!estudianteRole) {
      estudianteRole = await this.prisma.role.create({
        data: { name: 'ESTUDIANTE' },
      });
    }

    // Procesar cada fila
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        // Validaciones
        if (!row.firstName) {
          result.errors.push({ row: rowNum, message: 'Nombre es obligatorio' });
          continue;
        }
        if (!row.lastName) {
          result.errors.push({ row: rowNum, message: 'Apellido es obligatorio' });
          continue;
        }
        if (!row.documentNumber) {
          result.errors.push({ row: rowNum, message: 'Número de documento es obligatorio' });
          continue;
        }

        // Verificar si ya existe estudiante
        const existingStudent = await this.prisma.student.findUnique({
          where: {
            institutionId_documentNumber: {
              institutionId,
              documentNumber: row.documentNumber,
            },
          },
        });
        if (existingStudent) {
          result.errors.push({
            row: rowNum,
            message: `Estudiante con documento ${row.documentNumber} ya existe`,
          });
          continue;
        }

        // Parsear fecha de nacimiento
        let birthDate: Date | undefined;
        if (row.birthDate) {
          birthDate = new Date(row.birthDate);
          if (isNaN(birthDate.getTime())) {
            birthDate = undefined;
          }
        }

        // El documento es la contraseña inicial (onboarding) y el usuario debe
        // cambiarla en el primer ingreso. Si no hay documento, se rechaza la fila.
        if (!row.documentNumber) {
          result.errors.push({ row: rowNum, message: 'Número de documento requerido para generar credenciales', data: row });
          continue;
        }
        const username = await this.generateUsernameWithRole(row.firstName, row.lastName, row.documentNumber, 'ESTUDIANTE');
        const passwordHash = await bcrypt.hash(row.documentNumber, 10);
        
        // Generar email si no tiene (requerido para User)
        const email = row.email || `${username}@estudiante.local`;

        // Verificar que el email no exista
        const existingUser = await this.prisma.user.findUnique({
          where: { email },
        });
        if (existingUser) {
          result.errors.push({
            row: rowNum,
            message: `El correo ${email} ya está registrado`,
          });
          continue;
        }

        // Crear usuario — combinar nombres para User (que solo tiene firstName/lastName)
        const userFirstName = [row.firstName, row.secondName].filter(Boolean).join(' ');
        const userLastName = [row.lastName, row.secondLastName].filter(Boolean).join(' ');

        // Crear usuario primero
        const user = await this.prisma.user.create({
          data: {
            email,
            username,
            firstName: userFirstName,
            lastName: userLastName,
            passwordHash,
            documentType: row.documentType as any,
            documentNumber: row.documentNumber,
            phone: row.phone,
            isActive: true,
            mustChangePassword: true,
            roles: {
              create: {
                roleId: estudianteRole.id,
              },
            },
            institutionUsers: {
              create: {
                institutionId,
                isAdmin: false,
              },
            },
          } as any,
        });

        // Crear estudiante vinculado al usuario (guarda los 4 campos de nombre)
        const student = await this.prisma.student.create({
          data: {
            institutionId,
            userId: user.id,
            firstName: row.firstName,
            secondName: row.secondName || undefined,
            lastName: row.lastName,
            secondLastName: row.secondLastName || undefined,
            documentType: row.documentType,
            documentNumber: row.documentNumber,
            birthDate,
            gender: row.gender,
            email: row.email || undefined,
            phone: row.phone,
            address: row.address,
          },
        });

        // Matricular si se especificó grupo y hay año académico
        if (row.groupCode && academicYearId) {
          const groupId = groupMap.get(row.groupCode);
          if (groupId) {
            await this.prisma.studentEnrollment.create({
              data: {
                institutionId,
                studentId: student.id,
                academicYearId,
                groupId,
                status: 'ACTIVE',
              },
            });
          }
        }

        result.success++;
        result.created.push({
          id: student.id,
          name: [student.firstName, student.secondName, student.lastName, student.secondLastName].filter(Boolean).join(' '),
          email: user.email,
        });
      } catch (error: any) {
        result.errors.push({
          row: rowNum,
          message: error.message || 'Error desconocido',
          data: row,
        });
      }
    }

    return result;
  }

  /**
   * Procesa archivo Excel de personal (staff)
   */
  async processStaffUpload(
    institutionId: string,
    buffer: Buffer,
  ): Promise<UploadResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const sheet = workbook.getWorksheet(1);
    if (!sheet) {
      throw new BadRequestException('El archivo no contiene hojas de cálculo');
    }

    const result: UploadResult = { success: 0, errors: [], created: [] };
    const rows: StaffRow[] = [];

    // Roles válidos para staff
    const validRoles = ['COORDINADOR', 'SECRETARIA', 'ORIENTADOR', 'BIBLIOTECARIO', 'AUXILIAR', 'AUXILIAR_CONTABLE'];

    // Leer filas
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const firstName = row.getCell(1).value?.toString()?.trim();
      const lastName = row.getCell(2).value?.toString()?.trim();
      const email = row.getCell(3).value?.toString()?.trim()?.toLowerCase();
      const role = row.getCell(4).value?.toString()?.trim()?.toUpperCase();

      if (!firstName || firstName.startsWith('*') || firstName.startsWith('Roles')) return;

      rows.push({
        firstName,
        lastName: lastName || '',
        email: email || '',
        role: role || '',
        documentType: row.getCell(5).value?.toString()?.trim(),
        documentNumber: row.getCell(6).value?.toString()?.trim(),
        phone: row.getCell(7).value?.toString()?.trim(),
      });
    });

    // Procesar cada fila
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        // Validaciones
        if (!row.firstName) {
          result.errors.push({ row: rowNum, message: 'Nombre es obligatorio' });
          continue;
        }
        if (!row.lastName) {
          result.errors.push({ row: rowNum, message: 'Apellido es obligatorio' });
          continue;
        }
        if (!row.email) {
          result.errors.push({ row: rowNum, message: 'Correo es obligatorio' });
          continue;
        }
        if (!this.isValidEmail(row.email)) {
          result.errors.push({ row: rowNum, message: `Correo inválido: ${row.email}` });
          continue;
        }
        if (!row.role || !validRoles.includes(row.role)) {
          result.errors.push({
            row: rowNum,
            message: `Rol inválido: ${row.role}. Válidos: ${validRoles.join(', ')}`,
          });
          continue;
        }

        // Verificar si ya existe
        const existing = await this.prisma.user.findUnique({
          where: { email: row.email },
        });
        if (existing) {
          result.errors.push({ row: rowNum, message: `El correo ${row.email} ya está registrado` });
          continue;
        }

        // Obtener o crear rol
        let role = await this.prisma.role.findUnique({
          where: { name: row.role },
        });
        if (!role) {
          role = await this.prisma.role.create({
            data: { name: row.role },
          });
        }

        // El documento es la contraseña inicial (onboarding) y el usuario debe
        // cambiarla en el primer ingreso. Si no hay documento, no creamos una
        // cuenta con contraseña compartida/débil: se rechaza la fila.
        if (!row.documentNumber) {
          result.errors.push({ row: rowNum, message: 'Número de documento requerido para generar credenciales', data: row });
          continue;
        }
        const username = await this.generateUsernameWithRole(row.firstName, row.lastName, row.documentNumber, row.role);
        const passwordHash = await bcrypt.hash(row.documentNumber, 10);

        // Crear usuario + dual-write en transacción
        const user = await this.prisma.$transaction(async (tx) => {
          const created = await tx.user.create({
            data: {
              email: row.email,
              username,
              firstName: row.firstName,
              lastName: row.lastName,
              passwordHash,
              documentType: row.documentType as any,
              documentNumber: row.documentNumber,
              phone: row.phone,
              isActive: true,
              mustChangePassword: true,
              roles: {
                create: {
                  roleId: role.id,
                },
              },
              institutionUsers: {
                create: {
                  institutionId,
                  isAdmin: false,
                },
              },
            } as any,
          });

          // Dual-write: InstitutionUserRole
          const iuStaff = await tx.institutionUser.findUnique({
            where: { userId_institutionId: { userId: created.id, institutionId } },
          });
          if (iuStaff) {
            await tx.institutionUserRole.upsert({
              where: { institutionUserId_roleId: { institutionUserId: iuStaff.id, roleId: role.id } },
              create: { institutionUserId: iuStaff.id, roleId: role.id },
              update: {},
            });
          }
          return created;
        });

        result.success++;
        result.created.push({
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
        });
      } catch (error: any) {
        result.errors.push({
          row: rowNum,
          message: error.message || 'Error desconocido',
          data: row,
        });
      }
    }

    return result;
  }

  // Helpers
  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * Extrae el valor de una celda Excel, manejando casos especiales como hipervínculos
   */
  private extractCellValue(cell: any): string {
    if (!cell || cell.value === null || cell.value === undefined) return '';
    
    const value = cell.value;
    
    // Si es un objeto con hipervínculo (común en emails)
    if (typeof value === 'object') {
      if (value.text) return String(value.text).trim();
      if (value.hyperlink) {
        // Extraer email de mailto:
        const mailto = String(value.hyperlink);
        if (mailto.startsWith('mailto:')) {
          return mailto.replace('mailto:', '').trim();
        }
        return mailto.trim();
      }
      if (value.result !== undefined) return String(value.result).trim();
      if (value.richText) {
        return value.richText.map((rt: any) => rt.text || '').join('').trim();
      }
    }
    
    // Si es número, convertir a string preservando formato
    if (typeof value === 'number') {
      return String(value);
    }
    
    // Si es fecha
    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }
    
    return String(value).trim();
  }

  /**
   * Normaliza el tipo de documento a valores válidos del enum
   */
  private normalizeDocumentType(docType: string | undefined): string | undefined {
    if (!docType) return undefined;
    
    const normalized = docType.toUpperCase()
      .replace(/\./g, '')      // Quitar puntos (C.C. -> CC)
      .replace(/\s+/g, '')     // Quitar espacios
      .replace(/É/g, 'E')      // Normalizar acentos
      .trim();
    
    // Mapear variantes comunes
    const mapping: Record<string, string> = {
      'CC': 'CC',
      'CEDULA': 'CC',
      'CEDULADECIUDADANIA': 'CC',
      'TI': 'TI',
      'TARJETADEIDENTIDAD': 'TI',
      'CE': 'CE',
      'CEDULADEEXTRANJERIA': 'CE',
      'PASAPORTE': 'PASAPORTE',
      'RC': 'RC',
      'REGISTROCIVIL': 'RC',
      'NIP': 'NIP',
      'NUIP': 'NUIP',
    };
    
    return mapping[normalized] || normalized;
  }

  private generateTempPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  private async generateUsername(firstName: string, lastName: string): Promise<string> {
    const baseUsername = `${firstName.toLowerCase().charAt(0)}${lastName.toLowerCase().replace(/\s+/g, '')}`;
    const cleanUsername = baseUsername
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

    let username = cleanUsername;
    let counter = 1;

    while (await this.prisma.user.findUnique({ where: { username } })) {
      username = `${cleanUsername}${counter}`;
      counter++;
    }

    return username;
  }

  // Generar username: inicialNombre + apellido (ej: lcardenas)
  private async generateUsernameWithRole(firstName: string, lastName: string, _documentNumber?: string, _roleName?: string): Promise<string> {
    const firstLetter = firstName.toLowerCase().charAt(0);
    const cleanLastName = lastName.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '')
      .replace(/[^a-z]/g, '');
    
    const baseUsername = `${firstLetter}${cleanLastName}`;

    let username = baseUsername;
    let counter = 1;

    while (await this.prisma.user.findUnique({ where: { username } })) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    return username;
  }
}
