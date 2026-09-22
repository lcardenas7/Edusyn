import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Contrato del cromo del aula en móvil.
 *
 * Lo que pasaba: el header de la plataforma decía medir 56 px (`pt-14` en el Layout, `top-14` en
 * el encabezado del aula), pero con `py-3` medía 65 px de verdad. Al hacer scroll, el encabezado
 * del aula se pegaba 9 px POR DEBAJO del header y quedaba recortado, después de haber saltado los
 * 16 px del margen de página del Layout. Encima, el aula se pintaba dentro de ese margen: su
 * encabezado medía 343 px en una pantalla de 375 y no llegaba a los bordes, mientras la barra
 * inferior sí. Todo eso junto es lo que se veía como "se mueve" y "no sale del tamaño correcto".
 *
 * El arreglo no es correr el encabezado otra vez, sino que dentro del aula no haya dos cromos:
 * el header de la plataforma se esconde y manda el del aula, a sangre y pegado arriba.
 *
 * Se lee del fuente, como en `model/rutas.test.ts`: lo que hay que impedir es que alguien
 * reintroduzca el desfase sin darse cuenta, y para eso basta con fijar el contrato. Las medidas
 * reales están comprobadas en el navegador; aquí se fija que las piezas sigan encajando.
 */

const leer = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), 'utf-8')

const layout = leer('../../../components/Layout.tsx')
const shell = leer('./AulaShell.tsx')
const css = leer('../../../index.css')
const html = leer('../../../../index.html')

describe('Layout · el header móvil mide lo que dice medir', () => {
  it('fija el alto en 56 px (`h-14`), que es lo que reserva `pt-14`', () => {
    const header = layout.match(/<header data-app-header[^>]*className="([^"]*)"/)?.[1] ?? ''
    expect(header).toContain('h-14')
  })

  it('no vuelve a `py-3`, que lo estiraba a 65 px', () => {
    const header = layout.match(/<header data-app-header[^>]*className="([^"]*)"/)?.[1] ?? ''
    expect(header).not.toMatch(/\bpy-\d/)
  })

  it('el header y el relleno de página llevan marca para que un módulo a sangre los anule', () => {
    expect(layout).toContain('data-app-header')
    expect(layout).toContain('data-app-content')
  })
})

describe('Aula · dentro manda el aula', () => {
  it('en móvil el header de la plataforma se esconde y su relleno superior se va con él', () => {
    const movil = css.match(/@media \(max-width: 1023px\) \{[\s\S]*?\n\}/g) ?? []
    const bloque = movil.find((b) => b.includes('data-aula-inmersiva') && b.includes('data-app-header'))
    expect(bloque, 'falta la regla que esconde [data-app-header] dentro del aula').toBeTruthy()
    expect(bloque).toContain('display: none')
    expect(bloque).toMatch(/data-app-main[\s\S]*padding-top: 0/)
  })

  it('el aula va de borde a borde: sin el margen de página del Layout', () => {
    expect(css).toMatch(/body\[data-aula-inmersiva\] \[data-app-content\] \{\s*padding: 0;/)
  })

  it('el encabezado del aula se pega arriba del todo, sin compensar un header que ya no está', () => {
    const header = shell.match(/<header\s+className="(sticky[^"]*)"/)?.[1] ?? ''
    expect(header).toContain('top-0')
    expect(header).not.toContain('top-14')
  })

  it('respeta la muesca del teléfono, que en el resto de la aplicación cubre el header', () => {
    expect(shell).toContain("paddingTop: 'env(safe-area-inset-top)'")
  })

  it('la barra inferior se aparta de la barra de gestos', () => {
    expect(shell).toContain('pb-[env(safe-area-inset-bottom)]')
  })

  it('mide el alto con `dvh`: con `vh` la página salta cuando el navegador esconde su barra', () => {
    expect(shell).toContain('min-h-[100dvh]')
    expect(shell).not.toContain('min-h-screen')
  })

  it('la salida no depende del menú de la plataforma, que aquí está escondido', () => {
    expect(shell).toContain('onSalirDelModulo')
    expect(shell).toContain('Volver a mis aulas')
  })
})

describe('index.html · las safe areas existen', () => {
  it('`viewport-fit=cover` — sin él, `env(safe-area-inset-*)` vale 0 y el aula no llega al borde', () => {
    expect(html).toContain('viewport-fit=cover')
  })
})
