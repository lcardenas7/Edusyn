/**
 * RESET LÓGICO PARA SAAS MULTI-TENANT
 * 
 * Este script elimina todos los datos de prueba pero conserva:
 * - Migraciones
 * - Estructura de la base de datos
 * - Catálogos base (roles, permisos)
 * - Código
 * 
 * Se eliminan:
 * - Estudiantes
 * - Docentes  
 * - Instituciones de prueba
 * - Grados / grupos
 * - Notas
 * - Asistencias
 * - Reportes
 * - Comunicaciones
 * - Observador
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function resetLogical() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('🔄 INICIANDO RESET LÓGICO DE BASE DE DATOS')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // PASO 1: Eliminar datos transaccionales (orden por dependencias)
    // ═══════════════════════════════════════════════════════════════════════
    
    console.log('📊 Eliminando datos transaccionales...')
    
    // Notas y calificaciones
    const deletedGrades = await prisma.studentGrade.deleteMany({})
    console.log(`   ✅ StudentGrade: ${deletedGrades.count} registros eliminados`)

    // Asistencias
    const deletedAttendance = await prisma.attendanceRecord.deleteMany({})
    console.log(`   ✅ AttendanceRecord: ${deletedAttendance.count} registros eliminados`)

    // Observador del estudiante
    const deletedObservations = await prisma.studentObservation.deleteMany({})
    console.log(`   ✅ StudentObservation: ${deletedObservations.count} registros eliminados`)

    // Comunicaciones
    const deletedMessageRecipients = await prisma.messageRecipient.deleteMany({})
    console.log(`   ✅ MessageRecipient: ${deletedMessageRecipients.count} registros eliminados`)
    
    const deletedMessages = await prisma.message.deleteMany({})
    console.log(`   ✅ Message: ${deletedMessages.count} registros eliminados`)

    // Actividades evaluativas
    const deletedActivities = await prisma.evaluativeActivity.deleteMany({})
    console.log(`   ✅ EvaluativeActivity: ${deletedActivities.count} registros eliminados`)

    // Configuración de ventanas de calificación
    const deletedGradingWindows = await prisma.gradingPeriodConfig.deleteMany({})
    console.log(`   ✅ GradingPeriodConfig: ${deletedGradingWindows.count} registros eliminados`)

    const deletedRecoveryWindows = await prisma.recoveryPeriodConfig.deleteMany({})
    console.log(`   ✅ RecoveryPeriodConfig: ${deletedRecoveryWindows.count} registros eliminados`)

    // Notas parciales
    const deletedPartialGrades = await prisma.partialGrade.deleteMany({})
    console.log(`   ✅ PartialGrade: ${deletedPartialGrades.count} registros eliminados`)

    // Notas finales de período
    const deletedPeriodFinalGrades = await prisma.periodFinalGrade.deleteMany({})
    console.log(`   ✅ PeriodFinalGrade: ${deletedPeriodFinalGrades.count} registros eliminados`)

    console.log('')

    // ═══════════════════════════════════════════════════════════════════════
    // PASO 2: Eliminar estructura académica
    // ═══════════════════════════════════════════════════════════════════════
    
    console.log('🏫 Eliminando estructura académica...')

    // Asignaciones de docentes
    const deletedTeacherAssignments = await prisma.teacherAssignment.deleteMany({})
    console.log(`   ✅ TeacherAssignment: ${deletedTeacherAssignments.count} registros eliminados`)

    // Estudiantes matriculados
    const deletedStudentEnrollments = await prisma.studentEnrollment.deleteMany({})
    console.log(`   ✅ StudentEnrollment: ${deletedStudentEnrollments.count} registros eliminados`)

    // Estudiantes
    const deletedStudents = await prisma.student.deleteMany({})
    console.log(`   ✅ Student: ${deletedStudents.count} registros eliminados`)

    // Grupos
    const deletedGroups = await prisma.group.deleteMany({})
    console.log(`   ✅ Group: ${deletedGroups.count} registros eliminados`)

    // Grados
    const deletedGradesAcademic = await prisma.grade.deleteMany({})
    console.log(`   ✅ Grade: ${deletedGradesAcademic.count} registros eliminados`)

    // Asignaturas
    const deletedSubjects = await prisma.subject.deleteMany({})
    console.log(`   ✅ Subject: ${deletedSubjects.count} registros eliminados`)

    // Áreas
    const deletedAreas = await prisma.area.deleteMany({})
    console.log(`   ✅ Area: ${deletedAreas.count} registros eliminados`)

    // Términos académicos
    const deletedTerms = await prisma.academicTerm.deleteMany({})
    console.log(`   ✅ AcademicTerm: ${deletedTerms.count} registros eliminados`)

    // Períodos
    const deletedPeriods = await prisma.period.deleteMany({})
    console.log(`   ✅ Period: ${deletedPeriods.count} registros eliminados`)

    // Años académicos
    const deletedYears = await prisma.academicYear.deleteMany({})
    console.log(`   ✅ AcademicYear: ${deletedYears.count} registros eliminados`)

    // Jornadas
    const deletedShifts = await prisma.shift.deleteMany({})
    console.log(`   ✅ Shift: ${deletedShifts.count} registros eliminados`)

    // Sedes
    const deletedCampuses = await prisma.campus.deleteMany({})
    console.log(`   ✅ Campus: ${deletedCampuses.count} registros eliminados`)

    // Escala de valoración
    const deletedPerformanceScales = await prisma.performanceScale.deleteMany({})
    console.log(`   ✅ PerformanceScale: ${deletedPerformanceScales.count} registros eliminados`)

    // Componentes de evaluación
    const deletedEvalComponents = await prisma.evaluationComponent.deleteMany({})
    console.log(`   ✅ EvaluationComponent: ${deletedEvalComponents.count} registros eliminados`)

    console.log('')

    // ═══════════════════════════════════════════════════════════════════════
    // PASO 3: Eliminar usuarios y relaciones con instituciones
    // ═══════════════════════════════════════════════════════════════════════
    
    console.log('👥 Eliminando usuarios e instituciones...')

    // Roles de usuario (excepto SuperAdmin)
    const deletedUserRoles = await prisma.userRole.deleteMany({
      where: {
        role: {
          name: { not: 'SUPER_ADMIN' }
        }
      }
    })
    console.log(`   ✅ UserRole: ${deletedUserRoles.count} registros eliminados`)

    // Usuarios de institución
    const deletedInstitutionUsers = await prisma.institutionUser.deleteMany({})
    console.log(`   ✅ InstitutionUser: ${deletedInstitutionUsers.count} registros eliminados`)

    // Módulos de institución
    const deletedInstitutionModules = await prisma.institutionModule.deleteMany({})
    console.log(`   ✅ InstitutionModule: ${deletedInstitutionModules.count} registros eliminados`)

    // Instituciones
    const deletedInstitutions = await prisma.institution.deleteMany({})
    console.log(`   ✅ Institution: ${deletedInstitutions.count} registros eliminados`)

    // Usuarios (excepto SuperAdmin)
    const deletedUsers = await prisma.user.deleteMany({
      where: {
        roles: {
          none: {
            role: { name: 'SUPER_ADMIN' }
          }
        }
      }
    })
    console.log(`   ✅ User: ${deletedUsers.count} registros eliminados`)

    console.log('')

    // ═══════════════════════════════════════════════════════════════════════
    // RESUMEN FINAL
    // ═══════════════════════════════════════════════════════════════════════
    
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('✅ RESET LÓGICO COMPLETADO EXITOSAMENTE')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('')
    console.log('📋 SE CONSERVARON:')
    console.log('   • Roles del sistema')
    console.log('   • Catálogo de permisos')
    console.log('   • Usuario SuperAdmin')
    console.log('   • Migraciones de base de datos')
    console.log('   • Estructura de tablas')
    console.log('')
    console.log('🗑️  SE ELIMINARON:')
    console.log('   • Todas las instituciones de prueba')
    console.log('   • Todos los usuarios (excepto SuperAdmin)')
    console.log('   • Estudiantes, docentes, coordinadores')
    console.log('   • Grados, grupos, asignaturas, áreas')
    console.log('   • Notas, asistencias, observaciones')
    console.log('   • Comunicaciones y mensajes')
    console.log('')
    console.log('📌 La base de datos está lista para producción SaaS.')
    console.log('═══════════════════════════════════════════════════════════════')

  } catch (error) {
    console.error('❌ Error durante el reset lógico:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Ejecutar si se llama directamente
resetLogical()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
