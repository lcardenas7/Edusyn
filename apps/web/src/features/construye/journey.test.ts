import { describe, expect, it } from 'vitest'
import {
  buildPhaseState, changePrompt, changeRequestReady, evidenceReady, EMPTY_CHANGE_REQUEST, firstOpenPhase,
  EMPTY_EVIDENCE, initialPrompt, initialStudioMode, localGate, normalizeBrief, phaseState, promptReady, todaySessionNotes,
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

  it('le dice a la IA dónde va a correr: sin internet, datos en el teléfono y sin cuentas', () => {
    const prompt = initialPrompt(complete, 'APP')
    expect(prompt).toContain('Debe funcionar SIN internet')
    expect(prompt).toContain('localStorage')
    expect(prompt).toContain('código QR')
    expect(prompt).toContain('No hay cuentas ni contraseñas')
    expect(prompt).toContain('No pidas ni guardes datos personales')
  })

  it('pide un acabado concreto para que no se vea improvisada', () => {
    const prompt = initialPrompt(complete)
    expect(prompt).toContain('Cómo debe verse')
    expect(prompt).toContain('44px')
    expect(prompt).toContain('mensaje amable')
    expect(prompt).toContain('contraste')
    expect(prompt).toContain('system-ui')
  })

  it('exige código ejecutable y no impone reglas de juego a una app de pedidos', () => {
    const prompt = initialPrompt(complete)
    expect(prompt).toContain('nada de TODO, pseudocódigo, funciones vacías ni botones sin acción')
    expect(prompt).toContain('recorre mentalmente el criterio de prueba del equipo')
    expect(prompt).not.toContain('Si esto es un juego')
  })

  it('pide controles, gráficos y una partida completa cuando el equipo propone juegos', () => {
    const prompt = initialPrompt({ ...complete, solution: 'Crear juegos de carreras', features: 'Jugar una carrera y ganar puntos' }, 'APP')
    expect(prompt).toContain('controles de teclado y táctiles')
    expect(prompt).toContain('Canvas, CSS o SVG')
    expect(prompt).toContain('partida completa en celular')
    expect(prompt).toContain('Si hay movimiento')
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

  it('conserva el contrato de versión jugable al pedir cambios en un juego', () => {
    const prompt = changePrompt({ change: 'Agregar reinicio al juego', reason: '', keep: 'La puntuación', check: 'Se puede iniciar otra partida' }, complete, null)
    expect(prompt).toContain('nada de TODO, pseudocódigo, funciones vacías ni botones sin acción')
    expect(prompt).toContain('condición de ganar o perder')
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

describe('petición de cambio a la IA', () => {
  const brief = normalizeBrief({ problem: 'Olvidamos las tareas', solution: 'Una agenda del curso' })
  const request = { change: 'Agregar un botón para borrar una tarea', reason: 'Se llena de tareas viejas', keep: 'La lista y los colores', check: 'Si toco borrar, la tarea desaparece' }

  it('dice si es página web o app y conserva las reglas del taller y del acabado', () => {
    const web = changePrompt(request, brief, null)
    expect(web).toContain('una página web')
    expect(web).toContain('debe funcionar sin internet')
    expect(web).toContain('Cómo debe verse')

    const app = changePrompt(request, brief, null, 'APP')
    expect(app).toContain('una aplicación para celular')
    expect(app).toContain('Agregar un botón para borrar una tarea')
    expect(app).toContain('Si toco borrar, la tarea desaparece')
  })

  it('adjunta el código solo cuando se lo pasan', () => {
    const conCodigo = changePrompt(request, brief, { html: '<h1>Hola</h1>', css: 'h1{}', js: 'console.log(1)' }, 'APP')
    expect(conCodigo).toContain('--- index.html ---')
    expect(conCodigo).toContain('<h1>Hola</h1>')
    expect(changePrompt(request, brief, null)).not.toContain('--- index.html ---')
  })
})

describe('cuando el docente no permite usar IA', () => {
  const plan = normalizeBrief({ problem: 'Olvidamos las tareas', affected: '9.º', solution: 'Una agenda', audience: 'El curso', features: 'Agregar y ver tareas', successCheck: 'Si agrego una, aparece en la lista' })

  it('el taller abre en el código en vez de en la petición a la IA', () => {
    expect(initialStudioMode(plan, 0, false, true)).toBe('prompt')
    expect(initialStudioMode(plan, 0, false, false)).toBe('code')
  })

  it('si aún falta documentar, sigue documentando', () => {
    const aMedias = normalizeBrief({ problem: 'Algo pasa' })
    expect(initialStudioMode(aMedias, 0, false, false)).toBe('document')
  })

  it('quien ya tiene versiones vuelve al taller igual', () => {
    expect(initialStudioMode(plan, 2, false, false)).toBe('code')
  })
})
