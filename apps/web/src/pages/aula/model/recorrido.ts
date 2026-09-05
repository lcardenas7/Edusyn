/**
 * El recorrido de una unidad: sus recursos y sus actividades como **un solo camino ordenado**.
 * **Lógica pura.**
 *
 * Idea del fundador: *"que en una unidad el docente coloque recursos, videos, fotos, foro,
 * actividades, y que se vea como una línea de tiempo, y el estudiante vaya paso a paso"*.
 *
 * Por qué es mejor que dos listas separadas ("Para estudiar" / "Para hacer"):
 *  - El **orden del docente pasa a significar algo**: primero mira el video, luego lee la guía,
 *    luego resuelve el taller. Hoy ese orden existe en la base (`sortOrder`) y la interfaz lo
 *    ignora.
 *  - El estudiante ve **dónde está** sin leer cada tarjeta.
 *  - Y ve **qué sigue**, que es la pregunta que de verdad se hace al abrir una unidad.
 *
 * Sobre marcar un recurso como visto: el backend no guarda si un estudiante abrió un video o
 * un PDF, así que se recuerda **en su dispositivo**. Es honesto —no se inventa un dato que el
 * servidor no tiene— y suficiente para que el camino avance. Las actividades sí usan su estado
 * real.
 */

import type { DecoratedActivity, Role } from './list'
import type { MaterialLike, Unidad } from './units'

export type EstadoPaso = 'hecho' | 'actual' | 'pendiente' | 'bloqueado'

export interface Paso {
  /** `mat:<id>` o `act:<id>`: único dentro del recorrido. */
  clave: string
  numero: number
  estado: EstadoPaso
  material?: MaterialLike
  actividad?: DecoratedActivity
}

/** Estados en los que el estudiante ya no tiene nada que hacer con esa actividad. */
const CERRADOS = new Set(['entregada', 'calificada'])
/** Estados en los que no puede actuar aunque quiera. */
const FUERA_DE_SU_MANO = new Set(['bloqueada', 'no-abierta'])

export function claveDeMaterial(id: string): string {
  return `mat:${id}`
}

export interface RecorridoInput {
  unidad: Unidad
  role: Role
  /** Claves de recurso que este dispositivo ya marcó como vistas. */
  vistos: Set<string>
}

/**
 * Los pasos en el orden del docente: primero los recursos (lo que hay que mirar), luego las
 * actividades (lo que hay que hacer). Dentro de cada bloque manda `sortOrder`, que es donde el
 * docente dejó su intención.
 */
export function construirRecorrido({ unidad, role, vistos }: RecorridoInput): Paso[] {
  const porOrden = (a: { sortOrder?: number }, b: { sortOrder?: number }) =>
    (a.sortOrder ?? 0) - (b.sortOrder ?? 0)

  const materiales = [...unidad.materiales].sort(porOrden)
  const actividades = [...unidad.actividades].sort((x, y) => porOrden(x.activity, y.activity))

  const pasos: Paso[] = []
  let n = 0

  for (const m of materiales) {
    n += 1
    pasos.push({
      clave: claveDeMaterial(m.id),
      numero: n,
      // El docente no "hace" los recursos: para él son piezas del camino, no deberes.
      estado: role === 'estudiante' && vistos.has(claveDeMaterial(m.id)) ? 'hecho' : 'pendiente',
      material: m,
    })
  }

  for (const d of actividades) {
    n += 1
    const estadoAlumno = d.student?.state
    let estado: EstadoPaso = 'pendiente'
    if (role === 'estudiante' && estadoAlumno) {
      if (CERRADOS.has(estadoAlumno)) estado = 'hecho'
      else if (FUERA_DE_SU_MANO.has(estadoAlumno)) estado = 'bloqueado'
    }
    pasos.push({ clave: `act:${d.activity.id}`, numero: n, estado, actividad: d })
  }

  // "Actual" es el primer paso que el estudiante puede y debe hacer. Es lo que convierte una
  // lista en un camino: dice DÓNDE VAS, no solo qué hay.
  if (role === 'estudiante') {
    const siguiente = pasos.find((p) => p.estado === 'pendiente')
    if (siguiente) siguiente.estado = 'actual'
  }

  return pasos
}

/** Cuánto lleva recorrido, para la cabecera de la unidad. */
export function avanceDelRecorrido(pasos: Paso[]): { hechos: number; total: number; pct: number } {
  // Lo bloqueado no cuenta en el denominador: no depende del estudiante.
  const cuentan = pasos.filter((p) => p.estado !== 'bloqueado')
  const hechos = cuentan.filter((p) => p.estado === 'hecho').length
  return {
    hechos,
    total: cuentan.length,
    pct: cuentan.length === 0 ? 0 : Math.round((hechos / cuentan.length) * 100),
  }
}
