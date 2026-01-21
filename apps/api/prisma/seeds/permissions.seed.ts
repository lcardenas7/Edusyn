import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ═══════════════════════════════════════════════════════════════════════════
// CATÁLOGO MAESTRO DE PERMISOS
// ═══════════════════════════════════════════════════════════════════════════

interface PermissionDefinition {
  code: string
  module: string
  function: string
  subFunction: string
  name: string
  description: string
}

const PERMISSIONS: PermissionDefinition[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURACIÓN INSTITUCIONAL
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Información General
  { code: 'CONFIG_INFO_VIEW', module: 'CONFIG_INSTITUTIONAL', function: 'INFO_GENERAL', subFunction: 'VIEW', name: 'Ver información general', description: 'Ver datos básicos de la institución' },
  { code: 'CONFIG_INFO_EDIT', module: 'CONFIG_INSTITUTIONAL', function: 'INFO_GENERAL', subFunction: 'EDIT', name: 'Editar información general', description: 'Modificar datos básicos de la institución' },
  
  // Sistema de Calificación
  { code: 'CONFIG_GRADING_VIEW', module: 'CONFIG_INSTITUTIONAL', function: 'GRADING_SYSTEM', subFunction: 'VIEW', name: 'Ver sistema de calificación', description: 'Ver escala, niveles y ponderaciones' },
  { code: 'CONFIG_GRADING_EDIT_SCALE', module: 'CONFIG_INSTITUTIONAL', function: 'GRADING_SYSTEM', subFunction: 'EDIT_SCALE', name: 'Cambiar escala de notas', description: 'Modificar la escala de calificación (1-5, 1-10, etc.)' },
  { code: 'CONFIG_GRADING_EDIT_LEVELS', module: 'CONFIG_INSTITUTIONAL', function: 'GRADING_SYSTEM', subFunction: 'EDIT_LEVELS', name: 'Cambiar niveles de desempeño', description: 'Modificar niveles (Superior, Alto, Básico, Bajo)' },
  { code: 'CONFIG_GRADING_EDIT_WEIGHTS', module: 'CONFIG_INSTITUTIONAL', function: 'GRADING_SYSTEM', subFunction: 'EDIT_WEIGHTS', name: 'Cambiar ponderaciones', description: 'Modificar porcentajes de períodos y componentes' },
  
  // Períodos Académicos
  { code: 'CONFIG_PERIODS_VIEW', module: 'CONFIG_INSTITUTIONAL', function: 'PERIODS', subFunction: 'VIEW', name: 'Ver períodos académicos', description: 'Ver configuración de períodos' },
  { code: 'CONFIG_PERIODS_EDIT', module: 'CONFIG_INSTITUTIONAL', function: 'PERIODS', subFunction: 'EDIT', name: 'Crear/Editar períodos', description: 'Crear y modificar períodos académicos' },
  { code: 'CONFIG_PERIODS_TOGGLE', module: 'CONFIG_INSTITUTIONAL', function: 'PERIODS', subFunction: 'TOGGLE', name: 'Abrir/Cerrar períodos', description: 'Cambiar estado de períodos (abierto/cerrado)' },
  
  // Ventanas de Calificación
  { code: 'CONFIG_GRADE_WINDOWS_VIEW', module: 'CONFIG_INSTITUTIONAL', function: 'GRADE_WINDOWS', subFunction: 'VIEW', name: 'Ver ventanas de calificación', description: 'Ver fechas de ingreso de notas' },
  { code: 'CONFIG_GRADE_WINDOWS_DATES', module: 'CONFIG_INSTITUTIONAL', function: 'GRADE_WINDOWS', subFunction: 'EDIT_DATES', name: 'Configurar fechas de calificación', description: 'Modificar fechas de apertura y cierre' },
  { code: 'CONFIG_GRADE_WINDOWS_RULES', module: 'CONFIG_INSTITUTIONAL', function: 'GRADE_WINDOWS', subFunction: 'EDIT_RULES', name: 'Configurar reglas de calificación', description: 'Modificar reglas de ingreso de notas' },
  
  // Ventanas de Recuperación
  { code: 'CONFIG_RECOVERY_VIEW', module: 'CONFIG_INSTITUTIONAL', function: 'RECOVERY_WINDOWS', subFunction: 'VIEW', name: 'Ver ventanas de recuperación', description: 'Ver fechas de recuperaciones' },
  { code: 'CONFIG_RECOVERY_DATES', module: 'CONFIG_INSTITUTIONAL', function: 'RECOVERY_WINDOWS', subFunction: 'EDIT_DATES', name: 'Configurar fechas de recuperación', description: 'Modificar fechas de recuperaciones' },
  { code: 'CONFIG_RECOVERY_RULES', module: 'CONFIG_INSTITUTIONAL', function: 'RECOVERY_WINDOWS', subFunction: 'EDIT_RULES', name: 'Configurar reglas de recuperación', description: 'Modificar reglas de recuperaciones' },
  
  // Áreas y Asignaturas
  { code: 'CONFIG_AREAS_VIEW', module: 'CONFIG_INSTITUTIONAL', function: 'AREAS', subFunction: 'VIEW', name: 'Ver áreas y asignaturas', description: 'Ver estructura de áreas y asignaturas' },
  { code: 'CONFIG_AREAS_EDIT', module: 'CONFIG_INSTITUTIONAL', function: 'AREAS', subFunction: 'EDIT', name: 'Crear/Editar áreas', description: 'Crear y modificar áreas y asignaturas' },
  { code: 'CONFIG_AREAS_GLOBAL', module: 'CONFIG_INSTITUTIONAL', function: 'AREAS', subFunction: 'GLOBAL_CONFIG', name: 'Configuración global de áreas', description: 'Modificar reglas globales de cálculo de áreas' },
  
  // Grados y Grupos
  { code: 'CONFIG_GRADES_VIEW', module: 'CONFIG_INSTITUTIONAL', function: 'GRADES_GROUPS', subFunction: 'VIEW', name: 'Ver grados y grupos', description: 'Ver estructura de grados y grupos' },
  { code: 'CONFIG_GRADES_EDIT', module: 'CONFIG_INSTITUTIONAL', function: 'GRADES_GROUPS', subFunction: 'EDIT', name: 'Crear/Editar grados', description: 'Crear y modificar grados y grupos' },

  // ═══════════════════════════════════════════════════════════════════════════
  // GESTIÓN DE PERSONAS
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Usuarios
  { code: 'USERS_LIST_VIEW', module: 'USERS', function: 'USERS', subFunction: 'VIEW', name: 'Ver listado de usuarios', description: 'Ver lista de usuarios de la institución' },
  { code: 'USERS_CREATE', module: 'USERS', function: 'USERS', subFunction: 'CREATE', name: 'Crear usuarios', description: 'Crear nuevos usuarios' },
  { code: 'USERS_EDIT', module: 'USERS', function: 'USERS', subFunction: 'EDIT', name: 'Editar usuarios', description: 'Modificar datos de usuarios' },
  { code: 'USERS_ASSIGN_ROLES', module: 'USERS', function: 'USERS', subFunction: 'ASSIGN_ROLES', name: 'Asignar roles', description: 'Asignar roles a usuarios' },
  { code: 'USERS_ASSIGN_PERMISSIONS', module: 'USERS', function: 'USERS', subFunction: 'ASSIGN_PERMISSIONS', name: 'Asignar permisos extra', description: 'Otorgar permisos adicionales a usuarios' },
  
  // Estudiantes
  { code: 'STUDENTS_LIST_VIEW', module: 'USERS', function: 'STUDENTS', subFunction: 'VIEW', name: 'Ver listado de estudiantes', description: 'Ver lista de estudiantes' },
  { code: 'STUDENTS_VIEW_ALL', module: 'USERS', function: 'STUDENTS', subFunction: 'VIEW_ALL', name: 'Ver todos los estudiantes', description: 'Ver estudiantes de todos los grupos' },
  { code: 'STUDENTS_VIEW_OWN', module: 'USERS', function: 'STUDENTS', subFunction: 'VIEW_OWN', name: 'Ver estudiantes propios', description: 'Ver solo estudiantes de grupos asignados' },
  { code: 'STUDENTS_CREATE', module: 'USERS', function: 'STUDENTS', subFunction: 'CREATE', name: 'Crear estudiantes', description: 'Crear nuevos estudiantes' },
  { code: 'STUDENTS_EDIT', module: 'USERS', function: 'STUDENTS', subFunction: 'EDIT', name: 'Editar estudiantes', description: 'Modificar datos de estudiantes' },
  { code: 'STUDENTS_ENROLL', module: 'USERS', function: 'STUDENTS', subFunction: 'ENROLL', name: 'Matricular estudiantes', description: 'Matricular estudiantes en grupos' },
  
  // Acudientes
  { code: 'GUARDIANS_VIEW', module: 'USERS', function: 'GUARDIANS', subFunction: 'VIEW', name: 'Ver acudientes', description: 'Ver información de acudientes' },
  { code: 'GUARDIANS_EDIT', module: 'USERS', function: 'GUARDIANS', subFunction: 'EDIT', name: 'Editar acudientes', description: 'Modificar datos de acudientes' },

  // ═══════════════════════════════════════════════════════════════════════════
  // GESTIÓN ACADÉMICA
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Carga Académica
  { code: 'ACADEMIC_LOAD_VIEW_ALL', module: 'ACADEMIC', function: 'LOAD', subFunction: 'VIEW_ALL', name: 'Ver toda la carga académica', description: 'Ver asignaciones de todos los docentes' },
  { code: 'ACADEMIC_LOAD_VIEW_OWN', module: 'ACADEMIC', function: 'LOAD', subFunction: 'VIEW_OWN', name: 'Ver carga propia', description: 'Ver solo asignaciones propias' },
  { code: 'ACADEMIC_LOAD_ASSIGN', module: 'ACADEMIC', function: 'LOAD', subFunction: 'ASSIGN', name: 'Asignar carga académica', description: 'Asignar docentes a grupos y asignaturas' },
  
  // Calificaciones
  { code: 'GRADES_VIEW_ALL', module: 'ACADEMIC', function: 'GRADES', subFunction: 'VIEW_ALL', name: 'Ver todas las calificaciones', description: 'Ver notas de todos los grupos' },
  { code: 'GRADES_VIEW_OWN', module: 'ACADEMIC', function: 'GRADES', subFunction: 'VIEW_OWN', name: 'Ver calificaciones propias', description: 'Ver solo notas de grupos asignados' },
  { code: 'GRADES_ENTER', module: 'ACADEMIC', function: 'GRADES', subFunction: 'ENTER', name: 'Ingresar calificaciones', description: 'Ingresar notas de estudiantes' },
  { code: 'GRADES_EDIT_OVERRIDE', module: 'ACADEMIC', function: 'GRADES', subFunction: 'EDIT_OVERRIDE', name: 'Editar notas fuera de ventana', description: 'Modificar notas fuera del período permitido' },
  { code: 'GRADES_APPROVE_ADJUSTMENTS', module: 'ACADEMIC', function: 'GRADES', subFunction: 'APPROVE_ADJUSTMENTS', name: 'Aprobar ajustes de notas', description: 'Aprobar solicitudes de ajuste de notas' },
  
  // Recuperaciones
  { code: 'RECOVERY_VIEW_ALL', module: 'ACADEMIC', function: 'RECOVERY', subFunction: 'VIEW_ALL', name: 'Ver todas las recuperaciones', description: 'Ver recuperaciones de todos los grupos' },
  { code: 'RECOVERY_MANAGE_OWN', module: 'ACADEMIC', function: 'RECOVERY', subFunction: 'MANAGE_OWN', name: 'Gestionar recuperaciones propias', description: 'Gestionar recuperaciones de grupos asignados' },
  { code: 'RECOVERY_APPROVE', module: 'ACADEMIC', function: 'RECOVERY', subFunction: 'APPROVE', name: 'Aprobar recuperaciones', description: 'Aprobar planes de recuperación' },

  // ═══════════════════════════════════════════════════════════════════════════
  // SEGUIMIENTO
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Observador
  { code: 'OBSERVER_VIEW_ALL', module: 'TRACKING', function: 'OBSERVER', subFunction: 'VIEW_ALL', name: 'Ver todo el observador', description: 'Ver observaciones de todos los estudiantes' },
  { code: 'OBSERVER_VIEW_OWN', module: 'TRACKING', function: 'OBSERVER', subFunction: 'VIEW_OWN', name: 'Ver observador propio', description: 'Ver solo observaciones de grupos asignados' },
  { code: 'OBSERVER_CREATE', module: 'TRACKING', function: 'OBSERVER', subFunction: 'CREATE', name: 'Crear observaciones', description: 'Registrar nuevas observaciones' },
  { code: 'OBSERVER_EDIT', module: 'TRACKING', function: 'OBSERVER', subFunction: 'EDIT', name: 'Editar observaciones', description: 'Modificar observaciones existentes' },
  
  // Asistencia
  { code: 'ATTENDANCE_VIEW_ALL', module: 'TRACKING', function: 'ATTENDANCE', subFunction: 'VIEW_ALL', name: 'Ver toda la asistencia', description: 'Ver asistencia de todos los grupos' },
  { code: 'ATTENDANCE_REGISTER', module: 'TRACKING', function: 'ATTENDANCE', subFunction: 'REGISTER', name: 'Registrar asistencia', description: 'Registrar asistencia de estudiantes' },
  { code: 'ATTENDANCE_EDIT_HISTORY', module: 'TRACKING', function: 'ATTENDANCE', subFunction: 'EDIT_HISTORY', name: 'Editar histórico de asistencia', description: 'Modificar registros de asistencia pasados' },

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORTES
  // ═══════════════════════════════════════════════════════════════════════════
  
  { code: 'RPT_ADMIN_VIEW', module: 'REPORTS', function: 'ADMIN', subFunction: 'VIEW', name: 'Ver reportes administrativos', description: 'Acceder a reportes de administración' },
  { code: 'RPT_ACADEMIC_VIEW_ALL', module: 'REPORTS', function: 'ACADEMIC', subFunction: 'VIEW_ALL', name: 'Ver todos los reportes académicos', description: 'Acceder a reportes de todos los grupos' },
  { code: 'RPT_ACADEMIC_VIEW_OWN', module: 'REPORTS', function: 'ACADEMIC', subFunction: 'VIEW_OWN', name: 'Ver reportes académicos propios', description: 'Acceder solo a reportes de grupos asignados' },
  { code: 'RPT_BULLETINS_GENERATE', module: 'REPORTS', function: 'BULLETINS', subFunction: 'GENERATE', name: 'Generar boletines', description: 'Generar boletines de calificaciones' },
  { code: 'RPT_BULLETINS_VIEW', module: 'REPORTS', function: 'BULLETINS', subFunction: 'VIEW', name: 'Ver boletines', description: 'Ver boletines generados' },
  { code: 'RPT_STATS_INSTITUTIONAL', module: 'REPORTS', function: 'STATISTICS', subFunction: 'INSTITUTIONAL', name: 'Ver estadísticas institucionales', description: 'Acceder a estadísticas globales' },
  { code: 'RPT_EXPORT', module: 'REPORTS', function: 'EXPORT', subFunction: 'ALL', name: 'Exportar reportes', description: 'Exportar reportes a Excel/PDF' },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMUNICACIONES
  // ═══════════════════════════════════════════════════════════════════════════
  
  { code: 'COMM_MESSAGES_VIEW', module: 'COMMUNICATIONS', function: 'MESSAGES', subFunction: 'VIEW', name: 'Ver mensajes', description: 'Ver mensajes recibidos' },
  { code: 'COMM_MESSAGES_SEND', module: 'COMMUNICATIONS', function: 'MESSAGES', subFunction: 'SEND', name: 'Enviar mensajes', description: 'Enviar mensajes a usuarios' },
  { code: 'COMM_ANNOUNCEMENTS_VIEW', module: 'COMMUNICATIONS', function: 'ANNOUNCEMENTS', subFunction: 'VIEW', name: 'Ver anuncios', description: 'Ver anuncios publicados' },
  { code: 'COMM_ANNOUNCEMENTS_CREATE', module: 'COMMUNICATIONS', function: 'ANNOUNCEMENTS', subFunction: 'CREATE', name: 'Crear anuncios', description: 'Publicar nuevos anuncios' },
]

// ═══════════════════════════════════════════════════════════════════════════
// PERMISOS BASE POR ROL (FIJOS)
// ═══════════════════════════════════════════════════════════════════════════

const ROLE_PERMISSIONS: Record<string, string[]> = {
  // Admin Institucional - Acceso total a la institución
  'ADMIN_INSTITUTIONAL': [
    // Configuración - Total
    'CONFIG_INFO_VIEW', 'CONFIG_INFO_EDIT',
    'CONFIG_GRADING_VIEW', 'CONFIG_GRADING_EDIT_SCALE', 'CONFIG_GRADING_EDIT_LEVELS', 'CONFIG_GRADING_EDIT_WEIGHTS',
    'CONFIG_PERIODS_VIEW', 'CONFIG_PERIODS_EDIT', 'CONFIG_PERIODS_TOGGLE',
    'CONFIG_GRADE_WINDOWS_VIEW', 'CONFIG_GRADE_WINDOWS_DATES', 'CONFIG_GRADE_WINDOWS_RULES',
    'CONFIG_RECOVERY_VIEW', 'CONFIG_RECOVERY_DATES', 'CONFIG_RECOVERY_RULES',
    'CONFIG_AREAS_VIEW', 'CONFIG_AREAS_EDIT', 'CONFIG_AREAS_GLOBAL',
    'CONFIG_GRADES_VIEW', 'CONFIG_GRADES_EDIT',
    // Usuarios - Total
    'USERS_LIST_VIEW', 'USERS_CREATE', 'USERS_EDIT', 'USERS_ASSIGN_ROLES', 'USERS_ASSIGN_PERMISSIONS',
    'STUDENTS_LIST_VIEW', 'STUDENTS_VIEW_ALL', 'STUDENTS_CREATE', 'STUDENTS_EDIT', 'STUDENTS_ENROLL',
    'GUARDIANS_VIEW', 'GUARDIANS_EDIT',
    // Académico - Total
    'ACADEMIC_LOAD_VIEW_ALL', 'ACADEMIC_LOAD_ASSIGN',
    'GRADES_VIEW_ALL', 'GRADES_ENTER', 'GRADES_EDIT_OVERRIDE', 'GRADES_APPROVE_ADJUSTMENTS',
    'RECOVERY_VIEW_ALL', 'RECOVERY_APPROVE',
    // Seguimiento - Total
    'OBSERVER_VIEW_ALL', 'OBSERVER_CREATE', 'OBSERVER_EDIT',
    'ATTENDANCE_VIEW_ALL', 'ATTENDANCE_REGISTER', 'ATTENDANCE_EDIT_HISTORY',
    // Reportes - Total
    'RPT_ADMIN_VIEW', 'RPT_ACADEMIC_VIEW_ALL', 'RPT_BULLETINS_GENERATE', 'RPT_BULLETINS_VIEW', 'RPT_STATS_INSTITUTIONAL', 'RPT_EXPORT',
    // Comunicaciones - Total
    'COMM_MESSAGES_VIEW', 'COMM_MESSAGES_SEND', 'COMM_ANNOUNCEMENTS_VIEW', 'COMM_ANNOUNCEMENTS_CREATE',
  ],

  // Rector - Vista estratégica, aprobaciones
  'RECTOR': [
    // Configuración - Solo ver
    'CONFIG_INFO_VIEW',
    'CONFIG_GRADING_VIEW',
    'CONFIG_PERIODS_VIEW', 'CONFIG_PERIODS_TOGGLE',
    'CONFIG_GRADE_WINDOWS_VIEW',
    'CONFIG_RECOVERY_VIEW',
    'CONFIG_AREAS_VIEW',
    'CONFIG_GRADES_VIEW',
    // Usuarios - Ver
    'USERS_LIST_VIEW',
    'STUDENTS_LIST_VIEW', 'STUDENTS_VIEW_ALL',
    'GUARDIANS_VIEW',
    // Académico - Ver y aprobar
    'ACADEMIC_LOAD_VIEW_ALL',
    'GRADES_VIEW_ALL', 'GRADES_APPROVE_ADJUSTMENTS',
    'RECOVERY_VIEW_ALL', 'RECOVERY_APPROVE',
    // Seguimiento - Ver
    'OBSERVER_VIEW_ALL',
    'ATTENDANCE_VIEW_ALL',
    // Reportes - Estratégicos
    'RPT_ADMIN_VIEW', 'RPT_ACADEMIC_VIEW_ALL', 'RPT_BULLETINS_GENERATE', 'RPT_BULLETINS_VIEW', 'RPT_STATS_INSTITUTIONAL', 'RPT_EXPORT',
    // Comunicaciones
    'COMM_MESSAGES_VIEW', 'COMM_MESSAGES_SEND', 'COMM_ANNOUNCEMENTS_VIEW', 'COMM_ANNOUNCEMENTS_CREATE',
  ],

  // Coordinador - Gestión académica, fechas
  'COORDINADOR': [
    // Configuración - Ver + fechas
    'CONFIG_INFO_VIEW',
    'CONFIG_GRADING_VIEW',
    'CONFIG_PERIODS_VIEW',
    'CONFIG_GRADE_WINDOWS_VIEW', 'CONFIG_GRADE_WINDOWS_DATES',  // ← Puede configurar fechas
    'CONFIG_RECOVERY_VIEW', 'CONFIG_RECOVERY_DATES',            // ← Puede configurar fechas
    'CONFIG_AREAS_VIEW',
    'CONFIG_GRADES_VIEW',
    // Usuarios - Ver y gestionar estudiantes
    'USERS_LIST_VIEW',
    'STUDENTS_LIST_VIEW', 'STUDENTS_VIEW_ALL', 'STUDENTS_EDIT', 'STUDENTS_ENROLL',
    'GUARDIANS_VIEW', 'GUARDIANS_EDIT',
    // Académico - Supervisar
    'ACADEMIC_LOAD_VIEW_ALL', 'ACADEMIC_LOAD_ASSIGN',
    'GRADES_VIEW_ALL', 'GRADES_EDIT_OVERRIDE', 'GRADES_APPROVE_ADJUSTMENTS',
    'RECOVERY_VIEW_ALL', 'RECOVERY_APPROVE',
    // Seguimiento - Total
    'OBSERVER_VIEW_ALL', 'OBSERVER_CREATE', 'OBSERVER_EDIT',
    'ATTENDANCE_VIEW_ALL', 'ATTENDANCE_EDIT_HISTORY',
    // Reportes - Académicos
    'RPT_ACADEMIC_VIEW_ALL', 'RPT_BULLETINS_GENERATE', 'RPT_BULLETINS_VIEW', 'RPT_STATS_INSTITUTIONAL', 'RPT_EXPORT',
    // Comunicaciones
    'COMM_MESSAGES_VIEW', 'COMM_MESSAGES_SEND', 'COMM_ANNOUNCEMENTS_VIEW', 'COMM_ANNOUNCEMENTS_CREATE',
  ],

  // Docente - Operativo, solo sus grupos
  'DOCENTE': [
    // Configuración - Solo ver períodos
    'CONFIG_PERIODS_VIEW',
    'CONFIG_GRADE_WINDOWS_VIEW',
    'CONFIG_RECOVERY_VIEW',
    'CONFIG_GRADES_VIEW',
    // Usuarios - Solo sus estudiantes
    'STUDENTS_LIST_VIEW', 'STUDENTS_VIEW_OWN',
    'GUARDIANS_VIEW',
    // Académico - Solo lo suyo
    'ACADEMIC_LOAD_VIEW_OWN',
    'GRADES_VIEW_OWN', 'GRADES_ENTER',
    'RECOVERY_MANAGE_OWN',
    // Seguimiento - Solo lo suyo
    'OBSERVER_VIEW_OWN', 'OBSERVER_CREATE',
    'ATTENDANCE_REGISTER',
    // Reportes - Solo sus grupos
    'RPT_ACADEMIC_VIEW_OWN', 'RPT_BULLETINS_VIEW', 'RPT_EXPORT',
    // Comunicaciones
    'COMM_MESSAGES_VIEW', 'COMM_MESSAGES_SEND', 'COMM_ANNOUNCEMENTS_VIEW',
  ],

  // Secretaria - Gestión administrativa
  'SECRETARIA': [
    // Configuración - Ver
    'CONFIG_INFO_VIEW',
    'CONFIG_PERIODS_VIEW',
    'CONFIG_GRADES_VIEW',
    // Usuarios - Gestión
    'USERS_LIST_VIEW', 'USERS_CREATE', 'USERS_EDIT',
    'STUDENTS_LIST_VIEW', 'STUDENTS_VIEW_ALL', 'STUDENTS_CREATE', 'STUDENTS_EDIT', 'STUDENTS_ENROLL',
    'GUARDIANS_VIEW', 'GUARDIANS_EDIT',
    // Reportes - Administrativos
    'RPT_ADMIN_VIEW', 'RPT_BULLETINS_VIEW', 'RPT_EXPORT',
    // Comunicaciones
    'COMM_MESSAGES_VIEW', 'COMM_MESSAGES_SEND', 'COMM_ANNOUNCEMENTS_VIEW',
  ],
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIÓN DE SEED
// ═══════════════════════════════════════════════════════════════════════════

export async function seedPermissions() {
  console.log('\n🔐 Iniciando seed de permisos...\n')

  // 1. Crear permisos en el catálogo
  console.log('📋 Creando catálogo de permisos...')
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: {
        module: perm.module,
        function: perm.function,
        subFunction: perm.subFunction,
        name: perm.name,
        description: perm.description,
      },
      create: perm,
    })
  }
  console.log(`   ✅ ${PERMISSIONS.length} permisos creados/actualizados`)

  // 2. Crear permisos base por rol
  console.log('\n👥 Asignando permisos base por rol...')
  
  for (const [role, permissionCodes] of Object.entries(ROLE_PERMISSIONS)) {
    let count = 0
    for (const code of permissionCodes) {
      const permission = await prisma.permission.findUnique({ where: { code } })
      if (!permission) {
        console.warn(`   ⚠️ Permiso no encontrado: ${code}`)
        continue
      }
      
      await prisma.roleBasePermission.upsert({
        where: {
          role_permissionId: { role, permissionId: permission.id }
        },
        update: {},
        create: {
          role,
          permissionId: permission.id,
        },
      })
      count++
    }
    console.log(`   ✅ ${role}: ${count} permisos asignados`)
  }

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('✅ SEED DE PERMISOS COMPLETADO')
  console.log('═══════════════════════════════════════════════════════════\n')
}

// Ejecutar si se llama directamente
if (require.main === module) {
  seedPermissions()
    .then(() => prisma.$disconnect())
    .catch((e) => {
      console.error(e)
      prisma.$disconnect()
      process.exit(1)
    })
}
