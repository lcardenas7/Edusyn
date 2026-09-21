import { describe, expect, it } from 'vitest'
import {
  buildPhaseState, changePrompt, changeRequestReady, evidenceReady, EMPTY_CHANGE_REQUEST, firstOpenPhase,
  EMPTY_EVIDENCE, initialPrompt, localGate, normalizeBrief, phaseState, promptReady, todaySessionNotes,
} from './journey'

const complete = normalizeBrief({
  problem: 'En el descanso la fila de la tienda es muy larga',
  affected: 'Estudiantes de primaria',
  whyItMatters: 'Se quedan sin comer',
  solution: 'Una página para pedir antes del descanso',
  audience: 'Estudiantes y la persona de la tienda',
  screens: 'Una lista de productos y un botón para pedir',
  features: 'Ver productos y hacer un pedido',
  later: 'Pagos',
  successCheck: 'Si hago un pedido, aparece en la lista de la tienda',
})

describe('normalizeBrief', () => {
  it('completa un brief anterior al recorrido sin tocar lo que el equipo escribió', () => {
    const legacy = normalizeBrief({ problem: 'Residuos', audience: 'Mi curso', subject: 'Ciencias', grade: '9.º', features: 'Clasificar', style: 'Claro' })
    expect(legacy).toMatchObject({ problem: 'Residuos', features: 'Clasificar', grade: '9.º', affected: '', successCheck: '' })
  })
})

describe('estado de las fases', () => {
  it('distingue pendiente, en curso y lista', () => {
    expect(phaseState('problem', normalizeBrief(null))).toBe('pending')
    expect(phaseState('problem', normalizeBrief({ whyItMatters: 'Porque sí importa' }))).toBe('started')
    expect(phaseState('problem', complete)).toBe('done')
    expect(phaseState('plan', normalizeBrief({ features: 'Una lista' }))).toBe('started')
  })

  it('abre el recorrido en la primera fase sin terminar, o en construir si ya hay versiones', () => {
    expect(firstOpenPhase(normalizeBrief(null), 0)).toBe('problem')
    expect(firstOpenPhase(normalizeBrief({ problem: 'Algo pasa', affected: 'Nosotros' }), 0)).toBe('solution')
    expect(firstOpenPhase(complete, 0)).toBe('build')
    expect(firstOpenPhase(normalizeBrief(null), 2)).toBe('build')
  })

  it('marca construir según versiones y código', () => {
    expect(buildPhaseState(0, false)).toBe('pending')
    expect(buildPhaseState(0, true)).toBe('started')
    expect(buildPhaseState(1, true)).toBe('done')
  })
})

describe('prompt inicial', () => {
  it('no está listo hasta que exista el plan de la versión 1', () => {
    expect(promptReady(normalizeBrief({ problem: 'Algo pasa' }))).toBe(false)
    expect(promptReady(complete)).toBe(true)
  })

  it('usa solo las decisiones del equipo y separa la versión 1 de lo que queda para después', () => {
    const prompt = initialPrompt(complete)
    expect(prompt).toContain('Debe tener SOLO esto: Ver productos y hacer un pedido')
    expect(prompt).toContain('Queda para después (no lo hagas todavía): Pagos')
    expect(prompt).toContain('Así comprobaremos que funciona: Si hago un pedido, aparece en la lista de la tienda')
    expect(prompt).toContain('qué parte del código cumple cada punto del plan')
  })

  it('no depende del grado ni de datos del curso', () => {
    expect(initialPrompt(complete)).toContain('estudiantes de colegio')
    expect(initialPrompt(complete)).not.toContain('8.º')
  })

  it('pide una página web o una app de celular según lo que eligió el docente', () => {
    expect(initialPrompt(complete)).toContain('una página web')
    const app = initialPrompt(complete, 'APP')
    expect(app).toContain('una aplicación para celular')
    expect(app).toContain('menú inferior')
    expect(app).toContain('localStorage')
    expect(app).toContain('index.html, styles.css y app.js')
  })

  it('omite las decisiones opcionales vacías en vez de dejar un marcador', () => {
    const prompt = initialPrompt({ ...complete, whyItMatters: '', screens: '', later: '' })
    expect(prompt).not.toContain('Por qué importa')
    expect(prompt).not.toContain('Queda para después')
    expect(prompt).not.toMatch(/\n\n\n/)
    expect(prompt).toContain('- A quién afecta: Estudiantes de primaria\n\nLa solución que imaginamos')
  })
})

describe('condición antes de la primera versión', () => {
  it('coincide con el criterio del servidor', () => {
    expect(localGate(normalizeBrief(null), 0, false)).toEqual({ canSaveFirstVersion: false, unlockedByTeacher: false, hasVersions: false, missing: ['problem', 'features', 'successCheck'] })
    expect(localGate(complete, 0, false).canSaveFirstVersion).toBe(true)
    expect(localGate(normalizeBrief(null), 1, false).canSaveFirstVersion).toBe(true)
    expect(localGate(normalizeBrief(null), 0, true).canSaveFirstVersion).toBe(true)
  })
})

describe('petición de cambio', () => {
  it('exige qué cambiar y cómo comprobarlo', () => {
    expect(changeRequestReady(EMPTY_CHANGE_REQUEST)).toBe(false)
    expect(changeRequestReady({ ...EMPTY_CHANGE_REQUEST, change: 'Botón para borrar', check: 'La tarea desaparece' })).toBe(true)
  })

  it('incluye qué conservar y el código solo si se entrega', () => {
    const request = { change: 'Botón para borrar tareas', reason: 'Nos equivocamos al escribir', keep: 'El formulario', check: 'Al pulsar Borrar la tarea desaparece' }
    const project = { html: '<main></main>', css: 'main{}', js: 'console.log(1)' }
    const withCode = changePrompt(request, complete, project)
    expect(withCode).toContain('Qué debe seguir igual: El formulario')
    expect(withCode).toContain('--- app.js ---\nconsole.log(1)')
    expect(changePrompt(request, complete, null)).not.toContain('Nuestro código actual')
  })
})

describe('evidencia de versión', () => {
  it('pide qué intentaron, qué probaron y qué parte del código explican; lo demás es opcional', () => {
    const base = { ...EMPTY_EVIDENCE, attempted: 'Agregar tareas', tested: 'Agregué una y apareció' }
    expect(evidenceReady(base)).toBe(false)
    expect(evidenceReady({ ...base, explained: 'El addEventListener del formulario' })).toBe(true)
  })
})

describe('etapa compartir', () => {
  it('queda lista con la presentación y la reflexión', () => {
    expect(phaseState('share', complete)).toBe('pending')
    expect(phaseState('share', { ...complete, sharePitch: 'El problema era…' })).toBe('started')
    expect(phaseState('share', { ...complete, sharePitch: 'El problema era…', reflection: 'Aprendimos a probar' })).toBe('done')
  })

  it('el estilo por defecto no cuenta como empezar el plan', () => {
    expect(phaseState('plan', normalizeBrief(null))).toBe('pending')
  })
})

describe('notas de sesión', () => {
  it('toma solo las notas del día indicado', () => {
    const journal = [
      { type: 'SESSION_NOTE', createdAt: '2026-09-16T20:00:00Z', detail: { kind: 'GOAL' } },
      { type: 'SESSION_NOTE', createdAt: '2026-09-15T20:00:00Z', detail: { kind: 'GOAL' } },
      { type: 'VERSION_CREATED', createdAt: '2026-09-16T21:00:00Z' },
    ]
    expect(todaySessionNotes(journal, '2026-09-16', iso => iso.slice(0, 10))).toHaveLength(1)
  })
})

describe('estudio de Crea: dónde abrir y cuánto falta', () => {
  it('abre donde el equipo va', async () => {
    const { initialStudioMode, documentationProgress, nextDocumentPhase, normalizeBrief } = await import('./journey')
    const empty = normalizeBrief(null)
    const planned = normalizeBrief({ problem: 'Olvidamos tareas', affected: 'El curso', solution: 'Una agenda', audience: 'Estudiantes', features: 'Agregar tareas', successCheck: 'Si agrego, aparece' })
    expect(initialStudioMode(empty, 0, false)).toBe('document')
    expect(initialStudioMode(planned, 0, false)).toBe('prompt')
    expect(initialStudioMode(planned, 0, true)).toBe('code')
    expect(initialStudioMode(empty, 2, false)).toBe('code')
    expect(documentationProgress(empty)).toEqual({ done: 0, total: 3 })
    expect(documentationProgress(planned)).toEqual({ done: 3, total: 3 })
    expect(nextDocumentPhase(normalizeBrief({ problem: 'Olvidamos tareas', affected: 'El curso' }))).toBe('solution')
    expect(nextDocumentPhase(planned)).toBe('plan')
  })
})
