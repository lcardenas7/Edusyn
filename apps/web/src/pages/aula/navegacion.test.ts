import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Contrato de navegación del aula: el período elegido no se pierde.
 *
 * Lo que pasaba, contado por un docente: «estoy en una pestaña de tercer período, le doy volver
 * y sale en el primero». Eran dos fallos sumados. Este arregla el de la interfaz: abrir una
 * actividad navegaba a `/aula/<id>/actividades/<actividad>` a secas, sin el `?periodo=`, así que
 * al volver la lista ya no sabía qué período mirabas y se recalculaba sola. El otro fallo —qué
 * período se considera vigente— vive en `periodo-vigente.util.ts`, en la API.
 *
 * Se lee del fuente, como en `model/rutas.test.ts`: lo que hay que impedir es que alguien
 * vuelva a construir esas URLs a mano sin arrastrar lo que el usuario eligió.
 */
const fuente = fs.readFileSync(path.resolve(__dirname, './index.tsx'), 'utf-8')

/** El cuerpo de una función declarada con `const nombre = useCallback(` … `)`. */
function cuerpoDe(nombre: string): string {
  const inicio = fuente.indexOf(`const ${nombre} = useCallback(`)
  expect(inicio, `no encuentro ${nombre}`).toBeGreaterThan(-1)
  return fuente.slice(inicio, fuente.indexOf('\n  )', inicio))
}

describe('el período elegido sobrevive a la navegación', () => {
  it('abrir una actividad se lleva el período puesto', () => {
    const cuerpo = cuerpoDe('abrirActividad')
    expect(cuerpo).toContain("params.get('periodo')")
    expect(cuerpo).toMatch(/q\.set\('periodo'/)
  })

  it('abrir una actividad también conserva el filtro de estado', () => {
    expect(cuerpoDe('abrirActividad')).toContain("params.get('estado')")
  })

  it('volver a la lista respeta lo que el usuario eligió, incluido "todos"', () => {
    const cuerpo = cuerpoDe('verActividades')
    expect(cuerpo).toContain("params.get('periodo')")
    // Con `periodo !== PERIOD_ALL` se borraba la elección de "Todos" y la vista volvía sola al
    // período vigente: parecía que el selector no funcionaba.
    expect(cuerpo).not.toMatch(/periodo\s*!==\s*PERIOD_ALL/)
  })

  it('cambiar de destino arrastra el período', () => {
    expect(cuerpoDe('irA')).toContain("params.get('periodo')")
  })

  it('sin parámetro se arranca en el período vigente, no en el primero', () => {
    expect(fuente).toContain("params.get('periodo') ?? aula?.periodoActual?.id")
  })
})
