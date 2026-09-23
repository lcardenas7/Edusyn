import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Lo que se ve dentro del aula usa los tokens del sistema, no colores sueltos.
 *
 * El aula nueva reutiliza las herramientas de siempre —actividades, materiales, anuncios,
 * foro— metiéndolas dentro de su propia pantalla. Esas herramientas estaban escritas con la
 * paleta de Tailwind (`slate-500`, `blue-600`…), así que al abrirlas se veía el salto: grises
 * azulados y botones azules en un aula rosada. Casi mil clases.
 *
 * Ahora usan `ink-*`, `surface-*`, `hairline` y `accent`. Lo importante de `accent`: es una
 * variable, y dentro del aula vale el color que el docente eligió para su curso, así que las
 * herramientas se tiñen solas. Fuera del aula vale el azul de siempre y nada cambia.
 *
 * Esta prueba existe para que no vuelvan a entrar: es fácil pegar un `bg-blue-600` sin darse
 * cuenta de que esa pantalla ahora vive dentro del aula.
 */
const LEGADO = /\b(?:[a-z-]+:)*(?:text|bg|border|border-[lrtxy]|ring|divide|from|to|placeholder|decoration)-(?:slate|gray|blue|zinc|neutral|stone)-\d{2,3}\b/g

const raiz = path.resolve(__dirname, '../..')

/** Lo que se pinta dentro del aula, sea del aula nueva o reutilizado por ella. */
const SUPERFICIES = [
  'pages/Classroom.tsx',
  'components/media/SmartMedia.tsx',
  'components/RichTextEditor.tsx',
]

describe('el aula y sus herramientas usan el sistema de diseño', () => {
  it.each(SUPERFICIES)('%s no trae colores sueltos de Tailwind', (relativo) => {
    const fuente = fs.readFileSync(path.join(raiz, relativo), 'utf-8')
    const encontrados = [...new Set(fuente.match(LEGADO) ?? [])]
    expect(encontrados, `usa la paleta cruda: ${encontrados.join(', ')}`).toEqual([])
  })

  it('las vistas propias del aula tampoco', () => {
    const carpeta = path.join(raiz, 'pages/aula')
    const ficheros: string[] = []
    const recorrer = (dir: string) => {
      for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
        const completo = path.join(dir, entrada.name)
        if (entrada.isDirectory()) recorrer(completo)
        else if (/\.tsx$/.test(entrada.name) && !/\.test\.tsx$/.test(entrada.name)) ficheros.push(completo)
      }
    }
    recorrer(carpeta)

    const sucios = ficheros
      .map((f) => ({ f: path.relative(raiz, f), usos: [...new Set(fs.readFileSync(f, 'utf-8').match(LEGADO) ?? [])] }))
      .filter((x) => x.usos.length > 0)

    expect(sucios, sucios.map((s) => `${s.f}: ${s.usos.join(', ')}`).join(' · ')).toEqual([])
  })

  it('el acento es una variable, para que cada aula se pinte con su color', () => {
    const config = fs.readFileSync(path.join(raiz, '../tailwind.config.cjs'), 'utf-8')
    expect(config).toContain("accent: 'rgb(var(--skill-accent) / <alpha-value>)'")
  })
})
