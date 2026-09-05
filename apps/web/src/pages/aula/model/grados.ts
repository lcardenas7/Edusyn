/**
 * Orden de los grados escolares colombianos. **Lógica pura.**
 *
 * Hace falta porque ordenar alfabéticamente pone **Décimo antes que Sexto**, y un docente con
 * once aulas necesita encontrarlas en el orden en que existen en su cabeza: Transición,
 * Primero, … Once.
 *
 * Se aceptan las dos formas en que el nombre puede venir de la base: el ordinal en palabra
 * ("Octavo") y el número ("8", "8°", "11º").
 */

const ORDINALES: Record<string, number> = {
  prejardin: -3,
  'pre-jardin': -3,
  jardin: -2,
  parvulos: -4,
  transicion: -1,
  preescolar: -1,
  cero: 0,
  primero: 1,
  segundo: 2,
  tercero: 3,
  cuarto: 4,
  quinto: 5,
  sexto: 6,
  septimo: 7,
  octavo: 8,
  noveno: 9,
  decimo: 10,
  undecimo: 11,
  once: 11,
  onceavo: 11,
  duodecimo: 12,
  doce: 12,
}

/** Sin tildes, en minúsculas y sin adornos, para poder comparar. */
function limpiar(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[°º]/g, '')
    .trim()
}

/**
 * Posición del grado en la escalera escolar. Lo desconocido va al final (999) pero conserva su
 * nombre para poder desempatar alfabéticamente, en vez de barajarse.
 */
export function ordenDeGrado(nombre: string | null | undefined): number {
  if (!nombre) return 999
  const n = limpiar(nombre)

  // "8", "8 A", "grado 8"
  const numero = n.match(/(?:^|\s)(\d{1,2})(?:\s|$)/)
  if (numero) {
    const v = Number(numero[1])
    if (v >= 0 && v <= 13) return v
  }

  // "octavo", "grado octavo"
  for (const [palabra, valor] of Object.entries(ORDINALES)) {
    if (new RegExp(`(?:^|\\s)${palabra}(?:\\s|$)`).test(n)) return valor
  }

  return 999
}

/** Compara dos grados por su lugar real en la escalera; desempata por nombre. */
export function compararGrados(a: string | null | undefined, b: string | null | undefined): number {
  const oa = ordenDeGrado(a)
  const ob = ordenDeGrado(b)
  if (oa !== ob) return oa - ob
  return (a ?? '').localeCompare(b ?? '', 'es')
}

/** Neutraliza los caracteres con significado en una expresión regular. */
function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Grado y grupo, sin repetirse. En Edusyn el grupo puede llamarse "8-A" con su grado "8" —y
 * juntarlos a lo bruto produce "8 8-A"— o llamarse "C" con su grado "Octavo", donde sí hacen
 * falta los dos. Salió probando con datos reales las dos formas.
 */
export function etiquetaDeGrupo(grado: string | null | undefined, grupo: string | null | undefined): string {
  const g = (grado ?? '').trim()
  const gr = (grupo ?? '').trim()
  if (!gr) return g
  if (!g) return gr
  // "8-A", "8A", "8 A" ya llevan el grado dentro. El `(?!\d)` evita que el grado "1" se dé
  // por contenido en el grupo "11-2", que es de otro grado.
  if (new RegExp(`^${escaparRegex(g)}(?!\\d)`, 'i').test(gr)) return gr
  return `${g} ${gr}`
}
