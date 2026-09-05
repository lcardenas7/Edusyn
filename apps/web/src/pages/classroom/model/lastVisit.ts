/**
 * "Última visita" del estudiante a un aula — el dato con el que se decide qué se marca como
 * NUEVO. Vive en el dispositivo, no en el servidor.
 *
 * Por qué merece un módulo propio (garantía G4 del plan): el aula actual guarda lo mismo en
 * **dos claves redundantes**, escritas desde sitios distintos de `Classroom.tsx`:
 *
 *   edusyn:seenActs:<classroomId>    → milisegundos, como número en texto
 *   classroom_visited_<classroomId>  → fecha ISO
 *
 * Si el aula nueva escribiera solo una clave propia, el estudiante que la estrena vería DE
 * GOLPE todas sus actividades marcadas como nuevas, y al volver al aula actual, otra vez. Eso
 * es perder información del usuario aunque no se borre ninguna fila de la base.
 *
 * Así que aquí se **leen las dos y se escriben las dos**. Cuando se retire el aula actual se
 * podrá dejar de escribir la vieja; nunca antes.
 */

const KEY_NUEVA = (classroomId: string) => `edusyn:seenActs:${classroomId}`
const KEY_VIEJA = (classroomId: string) => `classroom_visited_${classroomId}`

/** Acceso a `localStorage` que nunca lanza: en modo privado o con cookies bloqueadas falla. */
interface Almacen {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function almacenPorDefecto(): Almacen | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

/**
 * Última visita conocida, mirando **ambas** claves y quedándose con la más reciente.
 * `null` = nunca la ha visitado en este dispositivo.
 */
export function leerUltimaVisita(classroomId: string, almacen: Almacen | null = almacenPorDefecto()): Date | null {
  if (!almacen) return null

  const candidatos: number[] = []

  try {
    const ms = Number(almacen.getItem(KEY_NUEVA(classroomId)))
    if (Number.isFinite(ms) && ms > 0) candidatos.push(ms)
  } catch {
    /* clave ilegible: se ignora, no se rompe la vista */
  }

  try {
    const iso = almacen.getItem(KEY_VIEJA(classroomId))
    if (iso) {
      const ms = new Date(iso).getTime()
      if (Number.isFinite(ms)) candidatos.push(ms)
    }
  } catch {
    /* idem */
  }

  if (candidatos.length === 0) return null
  return new Date(Math.max(...candidatos))
}

/**
 * Marca el aula como vista ahora, en los dos formatos, para que el aula actual y la nueva se
 * entiendan mientras convivan.
 */
export function marcarVisitada(
  classroomId: string,
  ahora: Date = new Date(),
  almacen: Almacen | null = almacenPorDefecto(),
): void {
  if (!almacen) return
  try {
    almacen.setItem(KEY_NUEVA(classroomId), String(ahora.getTime()))
  } catch {
    /* sin espacio o sin permiso: no es motivo para romper la navegación */
  }
  try {
    almacen.setItem(KEY_VIEJA(classroomId), ahora.toISOString())
  } catch {
    /* idem */
  }
}

/**
 * ¿Se publicó después de la última visita? Si nunca visitó el aula, se toma la misma regla de
 * reserva del aula actual: se consideran nuevas las de los últimos 7 días, para no marcarle
 * cincuenta actividades como nuevas a quien entra por primera vez.
 */
export function esNueva(
  publishedAt: string | null | undefined,
  ultimaVisita: Date | null,
  ahora: Date = new Date(),
): boolean {
  if (!publishedAt) return false
  const ms = new Date(publishedAt).getTime()
  if (!Number.isFinite(ms)) return false

  const corte = ultimaVisita ? ultimaVisita.getTime() : ahora.getTime() - 7 * 24 * 60 * 60 * 1000
  return ms > corte
}
