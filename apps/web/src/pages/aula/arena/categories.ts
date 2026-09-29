/**
 * Identidad visual de las categorías de la Arena.
 *
 * En Preguntados cada categoría tiene su color y su símbolo, y eso es la mitad
 * del juego: el gajo de la ruleta se reconoce sin leerlo. Aquí las categorías no
 * son fijas — salen del nombre que el docente le puso a su cuestionario o del
 * área de la pregunta— así que el símbolo se deduce del nombre.
 *
 * El emparejamiento es por palabra clave sobre el nombre normalizado (sin
 * tildes, en minúscula), de la regla más específica a la más general. Una
 * categoría que no reconoce ninguna regla recibe un color estable derivado de su
 * propio nombre y la mascota comodín: nunca se queda sin identidad.
 *
 * Personalizar esto por institución (que el docente elija color y mascota) exige
 * guardar esos dos campos junto a la colección; hoy no existen en la base.
 */
import { MASCOTS, type Mascot, type MascotKey } from './mascots'

export type CategoryLook = { mascot: Mascot; color: string; key: MascotKey }

/** Minúsculas y sin tildes: «Matemáticas» y «matematicas» son la misma cosa. */
export function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// El orden importa: gana la primera regla que coincida. Las más específicas van
// arriba («ciencias sociales» antes que «ciencias»).
const RULES: { match: string[]; look: { mascot: MascotKey; color: string } }[] = [
  { match: ['ciencias sociales', 'sociales'], look: { mascot: 'historia', color: '#C2703D' } },
  { match: ['ciencias naturales', 'naturales', 'biologia', 'quimica', 'ciencia'], look: { mascot: 'ciencias', color: '#2E9E63' } },
  { match: ['fisica'], look: { mascot: 'ciencias', color: '#2E6BE6' } },
  { match: ['matematica', 'estadistica', 'geometria', 'aritmetica', 'calculo'], look: { mascot: 'matematicas', color: '#2E6BE6' } },
  { match: ['lengua castellana', 'castellano', 'lenguaje', 'espanol', 'literatura', 'lectura'], look: { mascot: 'lenguaje', color: '#D9437A' } },
  { match: ['ingles', 'idioma', 'bilingue', 'frances'], look: { mascot: 'idiomas', color: '#7C5CFF' } },
  { match: ['geografia'], look: { mascot: 'geografia', color: '#1C9E8F' } },
  { match: ['historia'], look: { mascot: 'historia', color: '#C2703D' } },
  { match: ['arte', 'cultura', 'plastica', 'dibujo'], look: { mascot: 'arte', color: '#E0761E' } },
  { match: ['musica'], look: { mascot: 'musica', color: '#B85CD6' } },
  { match: ['deporte', 'educacion fisica', 'recreacion'], look: { mascot: 'deportes', color: '#3C9A4B' } },
  { match: ['tecnologia', 'informatica', 'computacion', 'programacion'], look: { mascot: 'tecnologia', color: '#4A6FA5' } },
  { match: ['etica', 'valores', 'convivencia'], look: { mascot: 'etica', color: '#D1537E' } },
  { match: ['religion'], look: { mascot: 'etica', color: '#8A7BC8' } },
  { match: ['filosofia', 'pensamiento'], look: { mascot: 'filosofia', color: '#6B5BC4' } },
  { match: ['economia', 'politica', 'contabilidad', 'finanza'], look: { mascot: 'economia', color: '#0E9F8E' } },
  { match: ['emprendimiento', 'proyecto'], look: { mascot: 'economia', color: '#E0A81E' } },
  { match: ['democracia', 'catedra de paz', 'paz'], look: { mascot: 'historia', color: '#C2703D' } },
]

const FALLBACK_COLORS = ['#2E6BE6', '#0E9F8E', '#7C5CFF', '#E08A1E', '#D9437A', '#3C9A4B', '#B85CD6', '#4A6FA5']

/** Color estable para una categoría sin regla: el mismo nombre da el mismo color. */
function fallbackColor(name: string) {
  let hash = 0
  for (let index = 0; index < name.length; index++) hash = (hash * 31 + name.charCodeAt(index)) % 9973
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length]
}

export function categoryLook(name: string): CategoryLook {
  const plain = normalize(name)
  const rule = RULES.find((item) => item.match.some((word) => plain.includes(word)))
  if (rule) return { mascot: MASCOTS[rule.look.mascot], color: rule.look.color, key: rule.look.mascot }
  return { mascot: MASCOTS.comodin, color: fallbackColor(name), key: 'comodin' }
}

/** Tono (0-360) de un color hexadecimal, para comparar si dos se parecen. */
function hue(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === min) return 0
  const d = max - min
  const value = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return value * 60
}

/**
 * Corrección óptica por mascota.
 *
 * Todas se dibujan en el mismo lienzo de 24×24, pero no lo llenan igual: la de
 * Tecnología saca antenas por arriba, la de Música saca las orejeras por los
 * lados y la estrella del comodín deja mucho aire en las esquinas. Puestas en
 * fila al mismo tamaño, unas se ven grandes y otras pequeñas aunque midan lo
 * mismo. Este factor iguala lo que el ojo percibe, no lo que mide la caja.
 *
 * Solo hace falta donde se ven juntas: los gajos de la ruleta y las píldoras.
 */
const OPTICAL: Partial<Record<MascotKey, number>> = {
  tecnologia: 0.86, // antenas y patas fuera del cuerpo
  matematicas: 0.9, // antena superior
  musica: 0.88,     // orejeras a lado y lado
  deportes: 0.93,   // cinta que sobresale
  filosofia: 0.92,  // orejas del búho
  comodin: 1.08,    // la estrella deja las esquinas vacías
  etica: 1.04,      // el corazón se estrecha abajo
  idiomas: 1.02,    // el globo no llega a los bordes
}

export function opticalScale(key: MascotKey) {
  return OPTICAL[key] ?? 1
}

const ARENA_DARK = [0x16, 0x18, 0x3d] as const

/**
 * Mezcla un color con el azul profundo de la Arena.
 *
 * La pantalla de la pregunta se pinta del color de la categoría, pero los
 * colores del catálogo van del amarillo claro al azul oscuro: sobre el amarillo
 * puro, el texto blanco no se lee. Oscurecerlos todos hacia el mismo azul
 * garantiza contraste suficiente con blanco sea cual sea la categoría, y de paso
 * mantiene la pantalla dentro del mundo visual de la Arena.
 *
 * `amount` es cuánto se acerca al azul: 0 deja el color tal cual, 1 lo sustituye.
 */
export function deepen(hex: string, amount: number) {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16))
  const mixed = channels.map((value, index) => Math.round(value + (ARENA_DARK[index] - value) * amount))
  return `#${mixed.map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

/**
 * Tamaño del símbolo dentro de un gajo. Depende del diámetro de la rueda y de
 * cuántas categorías haya: con muchos gajos, el arco es más estrecho y el
 * símbolo tiene que encoger o se sale.
 */
export function sliceIconSize(diameter: number, count: number) {
  const base = diameter * 0.12
  const crowding = count > 6 ? Math.sqrt(6 / count) : 1
  return Math.round(Math.max(16, Math.min(34, base * crowding)))
}

export type WheelSlice = { name: string; color: string; mascot: Mascot; key: MascotKey }

/**
 * Orden de los gajos de la ruleta.
 *
 * Cada categoría conserva SU color: el icono de Deportes tiene que estar sobre
 * el verde de Deportes, no sobre un color prestado. Lo que se reordena es la
 * vuelta: se ordenan por tono y luego se reparten alternando mitades, de modo
 * que dos tonos parecidos (los dos verdes de Ciencias y Deportes) queden en
 * lados opuestos de la rueda y ningún par contiguo se lea como un solo gajo.
 *
 * El orden es estable para un mismo conjunto de categorías, así que la rueda no
 * se baraja entre rondas: el estudiante aprende dónde está cada tema.
 */
export function wheelSlices(names: string[]): WheelSlice[] {
  const slices = names.map((name) => {
    const look = categoryLook(name)
    return { name, color: look.color, mascot: look.mascot, key: look.key }
  })
  if (slices.length < 3) return slices

  const byHue = [...slices].sort((a, b) => hue(a.color) - hue(b.color) || a.name.localeCompare(b.name, 'es'))
  const half = Math.ceil(byHue.length / 2)
  const spread: WheelSlice[] = []
  for (let index = 0; index < half; index++) {
    spread.push(byHue[index])
    if (index + half < byHue.length) spread.push(byHue[index + half])
  }
  return spread
}
