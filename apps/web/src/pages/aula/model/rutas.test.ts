import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Contrato de rutas del Aula.
 *
 * Son decisiones de producto, no detalles: el Aula Nueva es la experiencia predeterminada, el
 * Aula Clásica se conserva como respaldo operativo, y los enlaces antiguos —los que ya viajaron
 * en correos y circulares— tienen que seguir llevando a alguna parte.
 *
 * Se leen del propio `App.tsx` en vez de montar el router entero: lo que hay que impedir es que
 * alguien cambie el destino de una ruta sin darse cuenta, y para eso basta con fijar el contrato.
 */

const app = fs.readFileSync(
  path.resolve(__dirname, '../../../App.tsx'),
  'utf-8',
)

/** Extrae `<Route path="X" element={...} />` en una sola línea. */
function destinoDe(ruta: string): string | null {
  const re = new RegExp(`<Route path="${ruta.replace(/[/:]/g, (m) => '\\' + m)}" element=\\{([^}]*)\\}`)
  const m = app.match(re)
  return m ? m[1].trim() : null
}

describe('Aula · contrato de rutas', () => {
  it('el Aula Nueva vive en /aula y es la ruta principal', () => {
    expect(destinoDe('/aula')).toContain('AulaVirtual')
  })

  it('el Aula Clásica se conserva como respaldo en /aula-clasica', () => {
    // No se retira: además de respaldo, el Aula Nueva reutiliza cuatro de sus pestañas.
    expect(destinoDe('/aula-clasica')).toContain('Classroom')
  })

  it('los enlaces antiguos REDIRIGEN, no dibujan el aula nueva en la ruta vieja', () => {
    // Si /classroom renderizara el aula nueva, la barra de direcciones diría una cosa y la
    // pantalla otra, y cualquier enlace copiado desde ahí perpetuaría la ruta vieja.
    for (const vieja of ['/classroom', '/my-classes']) {
      const destino = destinoDe(vieja)
      expect(destino, `${vieja} debe redirigir`).toContain('Navigate')
      expect(destino, `${vieja} debe apuntar a /aula`).toContain('"/aula"')
      expect(destino, `${vieja} debe usar replace`).toContain('replace')
    }
  })

  it('las rutas profundas del aula nueva siguen existiendo', () => {
    for (const r of ['/aula/:classroomId', '/aula/:classroomId/:vista']) {
      expect(destinoDe(r), `falta ${r}`).toContain('AulaVirtual')
    }
    expect(app).toContain('/aula/:classroomId/actividades/:activityId')
  })

  it('el Aula Clásica NO desaparece del código', () => {
    // Guarda explícita: retirarla es una decisión aparte y todavía no está tomada.
    // Vale cualquiera de las dos formas de importarla: en staging las páginas se cargan en
    // diferido (`lazy`) y en producción, mientras no se promueva esa mejora, de forma directa.
    const importada =
      app.includes('lazy(() => import(\'./pages/Classroom\'))') ||
      /import Classroom from '\.\/pages\/Classroom'/.test(app)
    expect(importada).toBe(true)
  })
})
