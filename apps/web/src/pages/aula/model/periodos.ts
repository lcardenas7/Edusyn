/**
 * Etiqueta corta de un período. **Lógica pura.**
 *
 * Para qué: en el encabezado del aula el período compite por espacio con el nombre del curso.
 * Con un `<select>` nativo eso se veía roto de verdad — un select **corta** su etiqueta contra
 * el borde, no la termina en "…" —, así que "Primer Período · en curso" quedaba como
 * "Primer Período · e". Texto partido a media palabra: parece un error, y un error a la vista
 * quita confianza en todo lo demás.
 *
 * La solución no es más ancho, es decir lo mismo con menos: "P1". El nombre completo se lee
 * dentro del selector, donde sí hay sitio.
 */

const ORDINALES: [RegExp, number][] = [
  [/\bprimer/, 1],
  [/\bsegund/, 2],
  [/\btercer/, 3],
  [/\bcuart/, 4],
  [/\bquint/, 5],
  [/\bsext/, 6],
]

/**
 * "Primer Período" → "P1". Devuelve `null` cuando no reconoce la forma: quien llama muestra
 * entonces el nombre tal cual, recortado con puntos suspensivos de verdad.
 */
export function periodoCorto(nombre: string): string | null {
  const n = nombre.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim()

  for (const [re, num] of ORDINALES) if (re.test(n)) return `P${num}`

  // "Período 2", "Periodo 2", "P2", "2"
  const m = n.match(/^(?:periodo\s*)?p?\s*([1-9])$/) ?? n.match(/^periodo\s*([1-9])\b/)
  if (m) return `P${m[1]}`

  // "2do periodo", "3er periodo"
  const m2 = n.match(/^([1-9])\s*(?:do|ro|er|to|mo|no|vo|°|º)?\s+periodo/)
  if (m2) return `P${m2[1]}`

  return null
}

/**
 * Los períodos en el orden en que existen, no en orden alfabético.
 *
 * Ordenarlos por nombre daba "Cuarto, Primer, Segundo, Tercer": alfabéticamente correcto y
 * pedagógicamente absurdo. Manda el número que envía el colegio; si no viene, se deduce del
 * nombre; y lo que no se pueda ordenar va al final, por nombre, sin romper nada.
 */
export function ordenarPeriodos<T extends { name: string; orden?: number | null }>(lista: T[]): T[] {
  const clave = (p: T): number | null => {
    if (typeof p.orden === 'number' && Number.isFinite(p.orden)) return p.orden
    const corto = periodoCorto(p.name)
    return corto ? Number(corto.slice(1)) : null
  }

  return [...lista].sort((a, b) => {
    const ka = clave(a)
    const kb = clave(b)
    if (ka != null && kb != null) return ka - kb
    if (ka != null) return -1
    if (kb != null) return 1
    return a.name.localeCompare(b.name, 'es')
  })
}
