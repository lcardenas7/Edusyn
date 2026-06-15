import type { HelpContent } from '../components/HelpDrawer'

// ═══════════════════════════════════════════════════════════════════════════
// CONTENIDO DE AYUDA PARA FLUJOS DE IMPORTACIÓN MASIVA
// ═══════════════════════════════════════════════════════════════════════════
// Estos textos se renderizan en el HelpDrawer y deben mantenerse alineados
// con las hojas de "Instrucciones" de las plantillas Excel correspondientes.
// ═══════════════════════════════════════════════════════════════════════════

export const importStudentsHelp: HelpContent = {
  title: 'Cargar estudiantes masivamente',
  intro: 'Crea decenas o cientos de estudiantes desde un solo archivo Excel y matricúlalos en sus grupos.',
  accent: 'emerald',
  sections: [
    {
      title: '1. Antes de empezar',
      items: [
        'Verifica que tu institución tenga un año académico activo en el módulo Académico.',
        'Crea primero los grupos donde matricularás a los estudiantes.',
        { type: 'tip', text: 'Descarga la plantilla desde este mismo modal: contiene los grupos disponibles ya listados como referencia.' },
      ],
    },
    {
      title: '2. Llenar la plantilla',
      items: [
        'En la hoja "Estudiantes" completa una fila por estudiante.',
        'Las columnas con encabezado rojo son obligatorias: Primer nombre, Primer apellido, Tipo documento y Número documento.',
        'Usa los códigos exactos de la hoja "Catálogos" para tipo de documento, género y código de grupo.',
        { type: 'warning', text: 'Borra las filas de ejemplo (en gris cursiva) antes de subir el archivo.' },
        { type: 'tip', text: 'Si pegas datos desde otro Excel, usa "Pegado especial → Solo valores" para no romper el formato.' },
      ],
    },
    {
      title: '3. Credenciales automáticas',
      items: [
        'El usuario se genera con la fórmula nombre.apellido y se valida que sea único.',
        'La contraseña inicial es el número de documento del estudiante.',
        { type: 'success', text: 'En el primer ingreso, el sistema obliga al estudiante a cambiar la contraseña por una segura.' },
      ],
    },
    {
      title: '4. Después de cargar',
      items: [
        'Edusyn muestra un reporte con las filas creadas y las que tuvieron error.',
        'Si hay errores, corrige solo esas filas en el Excel y vuelve a subir el archivo.',
        'Los duplicados (por número de documento) se rechazan automáticamente, no se sobreescriben.',
      ],
    },
  ],
  commonErrors: [
    { error: 'Estudiante con documento X ya existe', cause: 'Hay un estudiante registrado con ese mismo documento en la institución', fix: 'Verifica si está duplicado o si ya fue cargado antes' },
    { error: 'Código de grupo no encontrado', cause: 'El código no coincide con ningún grupo activo', fix: 'Usa el código exacto que aparece en la hoja "Catálogos" (ej: 6A, 11-1)' },
    { error: 'Fecha de nacimiento inválida', cause: 'El formato no es YYYY-MM-DD', fix: 'Reformatea como 2010-05-15 (año-mes-día)' },
    { error: 'Correo ya registrado', cause: 'Otro usuario tiene ese correo', fix: 'Deja la celda vacía para que el sistema genere uno automático' },
  ],
}

export const importTeachersHelp: HelpContent = {
  title: 'Cargar docentes masivamente',
  intro: 'Crea varios docentes a la vez con sus credenciales generadas automáticamente.',
  accent: 'indigo',
  sections: [
    {
      title: '1. Datos requeridos',
      items: [
        'Cada docente necesita al menos: Nombres, Apellidos y Correo electrónico.',
        'Tipo y número de documento son recomendados (el documento se usa como contraseña inicial).',
        { type: 'tip', text: 'Si no tienes el documento al momento de cargar, igual puedes crearlo: Edusyn pedirá completarlo en el primer ingreso del docente.' },
      ],
    },
    {
      title: '2. Credenciales automáticas',
      items: [
        'Usuario: nombre.apellido (ej: jperez), validado para ser único.',
        'Contraseña inicial: el número de documento del docente.',
        { type: 'success', text: 'En el primer ingreso, el sistema obliga a establecer una contraseña personal segura.' },
        { type: 'warning', text: 'Si un correo ya está registrado en Edusyn, esa fila será rechazada.' },
      ],
    },
    {
      title: '3. Después de cargar',
      items: [
        'Edusyn muestra cuántos docentes se crearon y qué filas tuvieron error.',
        'Para cada error, verifica el correo, el documento y el formato de esa fila.',
        'Una vez creados, asígnalos a las materias en el módulo "Carga académica".',
      ],
    },
  ],
  commonErrors: [
    { error: 'Correo inválido', cause: 'El correo no tiene formato usuario@dominio.com', fix: 'Verifica que tenga @ y un dominio válido' },
    { error: 'El correo X ya está registrado', cause: 'Otro usuario ya usa ese correo', fix: 'Cambia el correo en la fila o consulta al admin para liberar el correo anterior' },
    { error: 'Tipo de documento inválido', cause: 'El valor no está en la lista permitida', fix: 'Usa solo: CC, TI, CE, PASAPORTE, NIT u OTRO' },
  ],
}

export const importStaffHelp: HelpContent = {
  title: 'Cargar otros usuarios',
  intro: 'Coordinadores, secretarias, orientadores y demás personal administrativo.',
  accent: 'violet',
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
        { type: 'success', text: 'En el primer ingreso, el sistema obliga a cambiar la contraseña por una segura.' },
      ],
    },
    {
      title: '3. Después de cargar',
      items: [
        'Revisa el reporte de importación.',
        'Si necesitas un rol más específico, pídelo al administrador del sistema.',
      ],
    },
  ],
  commonErrors: [
    { error: 'Rol inválido', cause: 'El valor en la columna Rol no está en la lista permitida', fix: 'Usa solo: COORDINADOR, SECRETARIA, ORIENTADOR, BIBLIOTECARIO, AUXILIAR' },
    { error: 'Correo ya registrado', cause: 'Otro usuario usa ese correo', fix: 'Verifica si el usuario ya existe o usa otro correo' },
    { error: 'Número de documento requerido', cause: 'No se proporcionó documento', fix: 'Completa el campo — se usa como contraseña inicial' },
  ],
}
