/**
 * El tema del aula para el estudiante. **Lógica pura.**
 *
 * Por qué existe. El color del aula lo elige el docente (o sale de la asignatura), y tiñe todo
 * lo que el estudiante ve. El fundador lo dijo con un caso real: *"sale rosadito y eso es
 * correcto, pero tengo más de la mitad de ese salón hombres y no creo que todos quieran que
 * esté de esa manera"*.
 *
 * La decisión: el color del aula sigue siendo el del docente —es su identidad y la comparte
 * todo el curso— pero **el estudiante puede repintar SU vista**. No cambia nada para nadie más;
 * se queda en su dispositivo. Es una preferencia, no un dato del colegio.
 *
 * Regla que se defiende con pruebas: sobre el acento se pinta texto blanco (botones, chips), así
 * que un tema solo entra al catálogo si ese blanco se lee. Un color bonito e ilegible es un
 * color roto.
 */

export interface Tema {
  id: string
  nombre: string
  color: string
}

/**
 * Ocho opciones. Suficientes para que cada quien encuentre la suya, pocas para elegir de un
 * vistazo. Nombres de color a secas: no hay temas "de niña" ni "de niño", que es justamente el
 * problema que esto resuelve.
 */
export const TEMAS: Tema[] = [
  { id: 'azul', nombre: 'Azul', color: '#2E6BE6' },
  { id: 'turquesa', nombre: 'Turquesa', color: '#0A7A6D' },
  { id: 'verde', nombre: 'Verde', color: '#177A4C' },
  { id: 'oliva', nombre: 'Oliva', color: '#5C7418' },
  { id: 'naranja', nombre: 'Naranja', color: '#B85A28' },
  { id: 'rosado', nombre: 'Rosado', color: '#B84A7D' },
  { id: 'morado', nombre: 'Morado', color: '#6B4BD8' },
  { id: 'grafito', nombre: 'Grafito', color: '#44506A' },
]

/** `null` = sin tema propio: manda el color del aula. Es el estado de fábrica. */
export type TemaElegido = string | null

export function temaPorId(id: TemaElegido): Tema | null {
  if (!id) return null
  return TEMAS.find((t) => t.id === id) ?? null
}

/**
 * El color que de verdad se pinta. El tema del estudiante gana; si no eligió ninguno —o eligió
 * uno que ya no existe— se cae al color del aula.
 */
export function resolverAcento(elegido: TemaElegido, colorAula: string): string {
  return temaPorId(elegido)?.color ?? colorAula
}

// ─── Color ───────────────────────────────────────────────────────────────────

/** "#2E6BE6" → "46 107 230", que es el formato que esperan los tokens del DS. */
export function hexARgb(hex: string): string {
  const [r, g, b] = canal(hex)
  return `${r} ${g} ${b}`
}

function canal(hex: string): [number, number, number] {
  const v = hex.replace('#', '')
  const largo = v.length === 3 ? v.split('').map((c) => c + c).join('') : v
  const n = parseInt(largo, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/**
 * Contraste con el blanco (WCAG). Se usa para no dejar entrar al catálogo un color sobre el que
 * el texto blanco de los botones no se lea.
 */
export function contrasteConBlanco(hex: string): number {
  const lum = canal(hex)
    .map((c) => {
      const s = c / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    .reduce((acc, c, i) => acc + c * [0.2126, 0.7152, 0.0722][i], 0)
  return 1.05 / (lum + 0.05)
}
