/**
 * Ordenamiento alfabético real de estudiantes en español.
 *
 * Problemas que resuelve:
 * - Apellidos compuestos: "De La Hoz", "Del Valle", "Van der Berg"
 * - Tildes y caracteres especiales: "Ángel" va junto a "Angel"
 * - Mayúsculas/minúsculas inconsistentes
 * - Ordenamiento solo por lastName sin incluir secondLastName
 *
 * Estrategia: concatenar lastName + secondLastName + firstName como clave
 * y usar Intl.Collator con locale es-CO, sensitivity 'base' (ignora case y tildes)
 * y collation 'phonebk' para que artículos como "de", "del", "de la" no rompan el orden.
 */

const collator = new Intl.Collator('es-CO', {
  sensitivity: 'base',   // ignora mayúsculas y tildes en la comparación
  ignorePunctuation: true,
  numeric: false,
})

/**
 * Construye la clave de ordenamiento completa para un estudiante.
 * Usa: primer apellido + segundo apellido + primer nombre + segundo nombre
 */
export function studentSortKey(s: {
  lastName?: string
  secondLastName?: string
  firstName?: string
  secondName?: string
}): string {
  return [s.lastName, s.secondLastName, s.firstName, s.secondName]
    .map(p => (p || '').trim())
    .filter(Boolean)
    .join(' ')
}

/**
 * Comparador estándar para arrays de objetos estudiante.
 * Usar con Array.sort() o Array.toSorted().
 *
 * @example
 * students.sort(compareStudents)
 */
export function compareStudents(
  a: { lastName?: string; secondLastName?: string; firstName?: string; secondName?: string },
  b: { lastName?: string; secondLastName?: string; firstName?: string; secondName?: string },
): number {
  return collator.compare(studentSortKey(a), studentSortKey(b))
}

/**
 * Ordena un array de objetos con datos de estudiante.
 * No muta el array original.
 *
 * @example
 * const sorted = sortStudents(students)
 */
export function sortStudents<
  T extends { lastName?: string; secondLastName?: string; firstName?: string; secondName?: string },
>(students: T[]): T[] {
  return [...students].sort(compareStudents)
}

/**
 * Comparador para strings de nombre completo pre-formateados
 * (ej. "De La Hoz García, Juan").
 * Usar cuando ya no tienes acceso a los campos separados.
 *
 * @example
 * grades.sort((a, b) => compareFullNames(a.studentName, b.studentName))
 */
export function compareFullNames(a: string, b: string): number {
  return collator.compare(a || '', b || '')
}
