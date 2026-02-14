/**
 * ATTENDANCE SCHEDULING ENGINE
 * 
 * Motor de cálculo de clases esperadas/programadas.
 * Fuente de verdad para determinar cuántas clases debería haber registrado un docente.
 * 
 * PRINCIPIO CLAVE:
 * "Las clases programadas dependen de la carga académica del docente,
 *  no del número de días hábiles del año ni del número de estudiantes."
 * 
 * Fórmula:
 *   classesExpected = sessionsPerWeek × weeksInRange
 * 
 * Donde:
 *   sessionsPerWeek = ScheduleEntry count (si hay horario) || weeklyHours (fallback)
 *   weeksInRange    = semanas hábiles reales entre startDate y endDate
 */

// ============================================================================
// TIPOS
// ============================================================================

export interface ScheduleEntryInfo {
  teacherAssignmentId: string
  dayOfWeek: string // MONDAY, TUESDAY, ...
}

export interface TeacherAssignmentInfo {
  id: string
  teacherId: string
  groupId: string
  subjectId: string
  weeklyHours: number
}

export interface DateRange {
  start: Date
  end: Date
}

export interface ExpectedClassesResult {
  assignmentId: string
  sessionsPerWeek: number
  weeksInRange: number
  expectedClasses: number
  source: 'SCHEDULE' | 'WEEKLY_HOURS'
}

// Mapeo DayOfWeek enum → JS getDay()
const DAY_OF_WEEK_MAP: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
}

// ============================================================================
// FUNCIONES PURAS
// ============================================================================

/**
 * Calcula las semanas reales (hábiles) dentro de un rango de fechas.
 * Cuenta semanas parciales proporcionalmente.
 */
export function calculateWeeksInRange(range: DateRange): number {
  const start = new Date(range.start)
  const end = new Date(range.end)
  
  if (end <= start) return 0

  const msPerDay = 24 * 60 * 60 * 1000
  const totalDays = Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1
  
  // Contar días hábiles (lun-vie)
  let weekdays = 0
  const cursor = new Date(start)
  while (cursor <= end) {
    const dow = cursor.getDay()
    if (dow !== 0 && dow !== 6) weekdays++
    cursor.setDate(cursor.getDate() + 1)
  }

  // Semanas = días hábiles / 5 (días hábiles por semana)
  return weekdays / 5
}

/**
 * Cuenta cuántas veces cae un día específico de la semana dentro de un rango de fechas.
 * Útil para cálculo preciso: si un docente da clase solo los martes y jueves,
 * se cuenta exactamente cuántos martes y jueves hay en el rango.
 */
export function countDayOccurrences(range: DateRange, dayOfWeek: number): number {
  const start = new Date(range.start)
  const end = new Date(range.end)
  
  if (end < start) return 0
  
  let count = 0
  const cursor = new Date(start)
  while (cursor <= end) {
    if (cursor.getDay() === dayOfWeek) count++
    cursor.setDate(cursor.getDate() + 1)
  }
  return count
}

/**
 * Calcula clases esperadas para UNA asignación usando el horario real (ScheduleEntry).
 * 
 * Estrategia: cuenta cuántas veces cada día de clase ocurre en el rango.
 * Ejemplo: Si da clase Martes y Jueves, y en el rango hay 15 martes y 14 jueves → 29 clases.
 */
export function calculateExpectedFromSchedule(
  assignmentId: string,
  scheduleEntries: ScheduleEntryInfo[],
  range: DateRange,
): ExpectedClassesResult {
  // Filtrar entradas de este assignment
  const entries = scheduleEntries.filter(e => e.teacherAssignmentId === assignmentId)
  
  if (entries.length === 0) {
    return {
      assignmentId,
      sessionsPerWeek: 0,
      weeksInRange: calculateWeeksInRange(range),
      expectedClasses: 0,
      source: 'SCHEDULE',
    }
  }

  // Contar ocurrencias reales de cada día de clase en el rango
  let totalExpected = 0
  for (const entry of entries) {
    const jsDow = DAY_OF_WEEK_MAP[entry.dayOfWeek]
    if (jsDow !== undefined) {
      totalExpected += countDayOccurrences(range, jsDow)
    }
  }

  return {
    assignmentId,
    sessionsPerWeek: entries.length,
    weeksInRange: calculateWeeksInRange(range),
    expectedClasses: Math.max(1, totalExpected),
    source: 'SCHEDULE',
  }
}

/**
 * Calcula clases esperadas para UNA asignación usando weeklyHours (fallback).
 * 
 * Fórmula: weeklyHours × weeksInRange
 * 
 * Nota: weeklyHours se interpreta como "sesiones de clase por semana",
 * no como "horas reloj". Cada sesión = 1 registro de asistencia esperado.
 */
export function calculateExpectedFromWeeklyHours(
  assignment: TeacherAssignmentInfo,
  range: DateRange,
): ExpectedClassesResult {
  const weeks = calculateWeeksInRange(range)
  const sessionsPerWeek = Math.max(1, assignment.weeklyHours)
  const expected = Math.round(sessionsPerWeek * weeks)

  return {
    assignmentId: assignment.id,
    sessionsPerWeek,
    weeksInRange: weeks,
    expectedClasses: Math.max(1, expected),
    source: 'WEEKLY_HOURS',
  }
}

/**
 * Calcula clases esperadas para MÚLTIPLES asignaciones.
 * Usa horario real si está disponible, fallback a weeklyHours.
 * 
 * @param assignments - Las asignaciones del docente
 * @param scheduleEntries - Entradas de horario (puede estar vacío)
 * @param range - Rango de fechas para el cálculo
 * @returns Map<assignmentId, ExpectedClassesResult>
 */
export function calculateExpectedClassesBatch(
  assignments: TeacherAssignmentInfo[],
  scheduleEntries: ScheduleEntryInfo[],
  range: DateRange,
): Map<string, ExpectedClassesResult> {
  const results = new Map<string, ExpectedClassesResult>()

  for (const assignment of assignments) {
    // Verificar si hay entradas de horario para esta asignación
    const hasSchedule = scheduleEntries.some(e => e.teacherAssignmentId === assignment.id)

    if (hasSchedule) {
      results.set(
        assignment.id,
        calculateExpectedFromSchedule(assignment.id, scheduleEntries, range),
      )
    } else {
      results.set(
        assignment.id,
        calculateExpectedFromWeeklyHours(assignment, range),
      )
    }
  }

  return results
}

/**
 * Calcula el total de clases esperadas para un docente (suma de todas sus asignaciones).
 */
export function calculateTotalExpectedForTeacher(
  teacherAssignments: TeacherAssignmentInfo[],
  scheduleEntries: ScheduleEntryInfo[],
  range: DateRange,
): { total: number; details: ExpectedClassesResult[] } {
  const batch = calculateExpectedClassesBatch(teacherAssignments, scheduleEntries, range)
  const details = Array.from(batch.values())
  const total = details.reduce((sum, r) => sum + r.expectedClasses, 0)
  return { total, details }
}
