import { describe, expect, it } from 'vitest'
import { buildHighlightCodePositionMessage, buildLoadProjectMessage, buildSetExploreModeMessage, clampCssRuleRange, clampElementPickRange, CONSTRUYE_PROTOCOL_VERSION, fileTracksAppliedProject, fitsPreviewMessageLimit, isPreviewEvent, isTrustedPreviewMessage, type PreviewEvent } from './protocol'

describe('preview protocol', () => {
  const valid = { protocol: CONSTRUYE_PROTOCOL_VERSION, instanceId: 'a'.repeat(24), type: 'ready' }
  it('accepts a bounded valid event', () => {
    expect(isPreviewEvent(valid)).toBe(true)
    expect(fitsPreviewMessageLimit(valid)).toBe(true)
  })
  it('rejects unknown messages and oversized payloads', () => {
    expect(isPreviewEvent({ ...valid, type: 'grant-grade' })).toBe(false)
    expect(isPreviewEvent({ ...valid, instanceId: 'short' })).toBe(false)
    expect(fitsPreviewMessageLimit({ ...valid, message: 'x'.repeat(9_000) })).toBe(false)
  })
})

// Cierra el gate de F0: demuestra que el host solo confía en el iframe activo y en el
// instanceId vigente, y que nunca envía datos de sesión al preview aislado.
// Ver docs/EDUSYN_CONSTRUYE_F0_AMENAZAS.md y docs/PROMPT_ARRANQUE_EDUSYN_CONSTRUYE.md.
describe('isTrustedPreviewMessage (bridge host <- preview)', () => {
  const previewWindow = { id: 'preview-iframe-window' }
  const attackerWindow = { id: 'another-frame-or-tab' }
  const instanceId = 'a'.repeat(24)
  const readyEvent = { protocol: CONSTRUYE_PROTOCOL_VERSION, instanceId, type: 'ready' as const }

  it('accepts a message whose source is exactly the active preview iframe', () => {
    expect(isTrustedPreviewMessage({ source: previewWindow, data: readyEvent }, previewWindow, instanceId)).toBe(true)
  })

  it('rejects a message from any window that is not the active iframe (spoofed source)', () => {
    expect(isTrustedPreviewMessage({ source: attackerWindow, data: readyEvent }, previewWindow, instanceId)).toBe(false)
  })

  it('rejects a message with no source (e.g. posted from a detached/top window)', () => {
    expect(isTrustedPreviewMessage({ source: null, data: readyEvent }, previewWindow, instanceId)).toBe(false)
  })

  it('rejects a stale instanceId from a previous preview after restart/reload', () => {
    const staleEvent = { ...readyEvent, instanceId: 'b'.repeat(24) }
    expect(isTrustedPreviewMessage({ source: previewWindow, data: staleEvent }, previewWindow, instanceId)).toBe(false)
  })

  it('rejects malformed or oversized payloads even from the right source and instance', () => {
    expect(isTrustedPreviewMessage({ source: previewWindow, data: { ...readyEvent, type: 'grant-grade' } }, previewWindow, instanceId)).toBe(false)
    expect(isTrustedPreviewMessage({ source: previewWindow, data: { ...readyEvent, message: 'x'.repeat(9_000) } }, previewWindow, instanceId)).toBe(false)
  })
})

describe('buildLoadProjectMessage (bridge host -> preview)', () => {
  const project = { html: '<main>ok</main>', css: 'main{color:teal}', js: 'console.log(1)' }

  it('never carries session, user or institution data — only the static project', () => {
    const message = buildLoadProjectMessage('a'.repeat(24), project)
    expect(Object.keys(message).sort()).toEqual(['instanceId', 'project', 'protocol', 'type'])
    expect(message.project).toEqual(project)
    expect(JSON.stringify(message)).not.toMatch(/token|jwt|cookie|session|authorization/i)
  })

  it('tags the message with the current protocol version and instance', () => {
    const message = buildLoadProjectMessage('c'.repeat(24), project)
    expect(message).toMatchObject({ protocol: CONSTRUYE_PROTOCOL_VERSION, instanceId: 'c'.repeat(24), type: 'load-project' })
  })
})

// PASO 2 (Preview → Código): "Explorar". isPreviewEvent debe aceptar element-picked solo con
// forma válida, y nunca inventar una relación (regla: exacto / no determinable, nunca adivinar).
describe('isPreviewEvent — element-picked', () => {
  const base = { protocol: CONSTRUYE_PROTOCOL_VERSION, instanceId: 'a'.repeat(24), type: 'element-picked' as const }

  it('accepts an exact pick with a well-formed range and tag name', () => {
    expect(isPreviewEvent({ ...base, status: 'exact', start: 10, end: 40, tagName: 'button' })).toBe(true)
  })

  it('accepts a "none" pick without needing range fields', () => {
    expect(isPreviewEvent({ ...base, status: 'none' })).toBe(true)
  })

  it('rejects an exact pick missing start/end/tagName', () => {
    expect(isPreviewEvent({ ...base, status: 'exact' })).toBe(false)
    expect(isPreviewEvent({ ...base, status: 'exact', start: 10, end: 40 })).toBe(false)
  })

  it('rejects a status outside exact/none — no invented confidence levels', () => {
    expect(isPreviewEvent({ ...base, status: 'probable', start: 10, end: 40, tagName: 'button' })).toBe(false)
  })

  it('rejects an inverted or negative range', () => {
    expect(isPreviewEvent({ ...base, status: 'exact', start: 40, end: 10, tagName: 'button' })).toBe(false)
    expect(isPreviewEvent({ ...base, status: 'exact', start: -1, end: 10, tagName: 'button' })).toBe(false)
  })

  it('rejects a tagName that is not a plausible tag identifier', () => {
    expect(isPreviewEvent({ ...base, status: 'exact', start: 0, end: 10, tagName: '<script>' })).toBe(false)
    expect(isPreviewEvent({ ...base, status: 'exact', start: 0, end: 10, tagName: 'x'.repeat(50) })).toBe(false)
  })

  // PASO 5.1: el texto editable llega dentro del mismo mensaje y se valida igual de duro.
  const conTexto = (text: unknown) => ({ ...base, status: 'exact', start: 0, end: 30, tagName: 'h1', text })

  it('acepta un texto editable bien formado', () => {
    expect(isPreviewEvent(conTexto({ start: 4, end: 13, value: 'Mi tienda', source: 'Mi tienda' }))).toBe(true)
  })

  it('text es opcional — un elemento sin texto simple sigue siendo un pick válido', () => {
    expect(isPreviewEvent({ ...base, status: 'exact', start: 0, end: 30, tagName: 'h1' })).toBe(true)
  })

  it('rechaza un texto cuyo rango no concuerda con lo que dice contener', () => {
    // source debe medir exactamente end - start: si no, el rango y el texto vienen de sitios
    // distintos y no se puede revalidar nada con ellos.
    expect(isPreviewEvent(conTexto({ start: 4, end: 13, value: 'Mi tienda', source: 'otro' }))).toBe(false)
  })

  it('rechaza rangos de texto inválidos y campos ausentes o de otro tipo', () => {
    expect(isPreviewEvent(conTexto({ start: 20, end: 10, value: 'x', source: 'x' }))).toBe(false)
    expect(isPreviewEvent(conTexto({ start: -1, end: 4, value: 'Mi t', source: 'Mi t' }))).toBe(false)
    expect(isPreviewEvent(conTexto({ start: 1.5, end: 4, value: 'Mi', source: 'Mi' }))).toBe(false)
    expect(isPreviewEvent(conTexto({ start: 4, end: 13, value: 'Mi tienda' }))).toBe(false) // sin source
    expect(isPreviewEvent(conTexto({ start: 4, end: 13, source: 'Mi tienda' }))).toBe(false) // sin value
    expect(isPreviewEvent(conTexto('Mi tienda'))).toBe(false)
  })

  it('rechaza un texto desmedido', () => {
    expect(isPreviewEvent(conTexto({ start: 0, end: 5_000, value: 'x'.repeat(5_000), source: 'x'.repeat(5_000) }))).toBe(false)
  })
})

describe('buildSetExploreModeMessage', () => {
  it('builds a well-formed enable/disable message for the current instance', () => {
    expect(buildSetExploreModeMessage('a'.repeat(24), true)).toEqual({ protocol: CONSTRUYE_PROTOCOL_VERSION, instanceId: 'a'.repeat(24), type: 'set-explore-mode', enabled: true })
    expect(buildSetExploreModeMessage('a'.repeat(24), false)).toMatchObject({ enabled: false })
  })
})

// PASO 4.1 (CSS → Preview): el conteo de elementos afectados llega por mensaje, así que se
// valida su forma igual que todo lo demás.
describe('isPreviewEvent — css-position-status', () => {
  const base = { protocol: CONSTRUYE_PROTOCOL_VERSION, instanceId: 'a'.repeat(24), type: 'css-position-status' as const }

  it('acepta un resultado exacto con conteo y datos de media', () => {
    expect(isPreviewEvent({ ...base, status: 'exact', matchedCount: 4, selector: '.card', mediaText: '(max-width: 500px)', mediaActive: false })).toBe(true)
  })

  it('acepta cero coincidencias (es un resultado válido, no un error)', () => {
    expect(isPreviewEvent({ ...base, status: 'exact', matchedCount: 0 })).toBe(true)
  })

  it('acepta "none" (no determinable)', () => {
    expect(isPreviewEvent({ ...base, status: 'none', matchedCount: 0 })).toBe(true)
  })

  it('rechaza un conteo ausente, negativo o no entero', () => {
    expect(isPreviewEvent({ ...base, status: 'exact' })).toBe(false)
    expect(isPreviewEvent({ ...base, status: 'exact', matchedCount: -1 })).toBe(false)
    expect(isPreviewEvent({ ...base, status: 'exact', matchedCount: 1.5 })).toBe(false)
  })

  it('rechaza mediaActive no booleano y textos desmedidos', () => {
    expect(isPreviewEvent({ ...base, status: 'exact', matchedCount: 1, mediaActive: 'si' })).toBe(false)
    expect(isPreviewEvent({ ...base, status: 'exact', matchedCount: 1, selector: 'x'.repeat(600) })).toBe(false)
  })

  // PASO 4.3: el valor exacto de la declaración bajo el cursor, cuando lo hay.
  it('acepta value cuando el cursor está dentro de una declaración concreta', () => {
    expect(isPreviewEvent({ ...base, status: 'exact', matchedCount: 1, property: 'border-radius', value: '12PX' })).toBe(true)
  })

  it('value es opcional — cursor dentro de la regla pero fuera de una declaración', () => {
    expect(isPreviewEvent({ ...base, status: 'exact', matchedCount: 1 })).toBe(true)
  })

  it('rechaza un value que no sea texto o que sea desmedido', () => {
    expect(isPreviewEvent({ ...base, status: 'exact', matchedCount: 1, value: 123 })).toBe(false)
    expect(isPreviewEvent({ ...base, status: 'exact', matchedCount: 1, value: 'x'.repeat(600) })).toBe(false)
  })

  // PASO 5.0: el rango del valor habilita la edición, así que se valida con la misma dureza
  // que todo lo demás — nunca se "arregla" un rango a medias.
  it('acepta el rango exacto del valor cuando viene completo y coherente', () => {
    expect(isPreviewEvent({ ...base, status: 'exact', matchedCount: 1, property: 'color', value: '#fff', valueStart: 10, valueEnd: 14 })).toBe(true)
  })

  it('rechaza un rango a medias (solo inicio o solo fin)', () => {
    expect(isPreviewEvent({ ...base, status: 'exact', matchedCount: 1, valueStart: 10 })).toBe(false)
    expect(isPreviewEvent({ ...base, status: 'exact', matchedCount: 1, valueEnd: 14 })).toBe(false)
  })

  it('rechaza un rango invertido, negativo o no entero', () => {
    expect(isPreviewEvent({ ...base, status: 'exact', matchedCount: 1, valueStart: 20, valueEnd: 10 })).toBe(false)
    expect(isPreviewEvent({ ...base, status: 'exact', matchedCount: 1, valueStart: -1, valueEnd: 10 })).toBe(false)
    expect(isPreviewEvent({ ...base, status: 'exact', matchedCount: 1, valueStart: 1.5, valueEnd: 10 })).toBe(false)
  })
})

describe('clampElementPickRange — nunca confía ciegamente en un número que llegó por mensaje', () => {
  const exact = (start: number, end: number): PreviewEvent => ({ protocol: CONSTRUYE_PROTOCOL_VERSION, instanceId: 'a'.repeat(24), type: 'element-picked', status: 'exact', start, end, tagName: 'button' })

  it('returns the range when it fits inside the current index.html', () => {
    expect(clampElementPickRange(exact(5, 20), 100)).toEqual({ start: 5, end: 20 })
  })

  it('returns null for a "none" pick — nothing to select', () => {
    expect(clampElementPickRange({ protocol: CONSTRUYE_PROTOCOL_VERSION, instanceId: 'a'.repeat(24), type: 'element-picked', status: 'none' }, 100)).toBeNull()
  })

  it('returns null when the range no longer fits the current file (e.g. edited since the preview last rendered)', () => {
    expect(clampElementPickRange(exact(90, 120), 100)).toBeNull()
  })

  it('never clamps/truncates a bad range into a fake-valid one — all or nothing', () => {
    const clamped = clampElementPickRange(exact(-5, 20), 100)
    expect(clamped).toBeNull()
  })
})

// PASO 3 (Código → Preview): comparte la misma forma exacto/no-determinable que element-picked
// (mismo runner, misma regla), bajo un tipo de mensaje distinto para que el host nunca lo
// confunda con un clic real del estudiante en el preview.
describe('isPreviewEvent — code-position-status', () => {
  const base = { protocol: CONSTRUYE_PROTOCOL_VERSION, instanceId: 'a'.repeat(24), type: 'code-position-status' as const }

  it('accepts an exact match with a well-formed range and tag name', () => {
    expect(isPreviewEvent({ ...base, status: 'exact', start: 10, end: 40, tagName: 'h1' })).toBe(true)
  })

  it('accepts a "none" result (cursor sin correspondencia determinable)', () => {
    expect(isPreviewEvent({ ...base, status: 'none' })).toBe(true)
  })

  it('rejects an exact status missing start/end/tagName, same as element-picked', () => {
    expect(isPreviewEvent({ ...base, status: 'exact' })).toBe(false)
  })

  it('rejects an invented confidence level outside exact/none', () => {
    expect(isPreviewEvent({ ...base, status: 'probable', start: 10, end: 40, tagName: 'h1' })).toBe(false)
  })
})

describe('buildHighlightCodePositionMessage', () => {
  it('builds a well-formed message carrying the range and whether the action was explicit', () => {
    expect(buildHighlightCodePositionMessage('a'.repeat(24), { start: 5, end: 20, explicit: true })).toEqual({
      protocol: CONSTRUYE_PROTOCOL_VERSION,
      instanceId: 'a'.repeat(24),
      type: 'highlight-code-position',
      range: { start: 5, end: 20, explicit: true },
      file: 'html',
    })
  })

  it('indica el archivo para elegir la ruta del runner (html por defecto)', () => {
    expect(buildHighlightCodePositionMessage('a'.repeat(24), { start: 0, end: 0, explicit: false }, 'css')).toMatchObject({ file: 'css' })
    expect(buildHighlightCodePositionMessage('a'.repeat(24), null)).toMatchObject({ file: 'html', range: null })
  })

  it('carries range:null as the explicit instruction to stop highlighting', () => {
    expect(buildHighlightCodePositionMessage('a'.repeat(24), null)).toMatchObject({ range: null })
  })
})

// PASO 4.2 (Preview → CSS): element-picked puede llevar, además de status/tagName, las reglas
// CSS demostrablemente relacionadas con el elemento — nunca se confía en su forma solo porque
// vino adentro de un mensaje ya validado por otra parte.
describe('isPreviewEvent — element-picked con cssRelated', () => {
  const base = { protocol: CONSTRUYE_PROTOCOL_VERSION, instanceId: 'a'.repeat(24), type: 'element-picked' as const, status: 'exact' as const, start: 0, end: 10, tagName: 'div' }
  const regla = { selector: '.card', start: 5, end: 40 }

  it('acepta una lista bien formada de reglas relacionadas, con y sin datos de media', () => {
    expect(isPreviewEvent({ ...base, cssRelated: [regla], cssRelatedTotal: 1 })).toBe(true)
    expect(isPreviewEvent({ ...base, cssRelated: [{ ...regla, mediaText: '(max-width: 500px)', mediaActive: false }], cssRelatedTotal: 1 })).toBe(true)
  })

  it('acepta una lista vacía (elemento sin estilos relacionados)', () => {
    expect(isPreviewEvent({ ...base, cssRelated: [], cssRelatedTotal: 0 })).toBe(true)
  })

  it('cssRelated es opcional — un element-picked sin él (HTML puro) sigue siendo válido', () => {
    expect(isPreviewEvent(base)).toBe(true)
  })

  it('rechaza una entrada con selector, start o end de forma inválida', () => {
    expect(isPreviewEvent({ ...base, cssRelated: [{ selector: 123, start: 0, end: 10 }] })).toBe(false)
    expect(isPreviewEvent({ ...base, cssRelated: [{ selector: '.card', start: -1, end: 10 }] })).toBe(false)
    expect(isPreviewEvent({ ...base, cssRelated: [{ selector: '.card', start: 20, end: 10 }] })).toBe(false)
  })

  it('rechaza mediaActive no booleano dentro de una entrada', () => {
    expect(isPreviewEvent({ ...base, cssRelated: [{ ...regla, mediaActive: 'si' }] })).toBe(false)
  })

  it('rechaza cssRelated que no sea un arreglo, y cssRelatedTotal negativo o fraccionario', () => {
    expect(isPreviewEvent({ ...base, cssRelated: 'nope' })).toBe(false)
    expect(isPreviewEvent({ ...base, cssRelated: [regla], cssRelatedTotal: -1 })).toBe(false)
    expect(isPreviewEvent({ ...base, cssRelated: [regla], cssRelatedTotal: 1.5 })).toBe(false)
  })
})

// PASO 4.4 (contexto reactivo al viewport): `reevaluated` distingue una elección real de una
// repetición automática de la MISMA selección tras un cambio de viewport — se valida su forma
// igual que cualquier otro dato que llega desde el runner.
describe('isPreviewEvent — element-picked con reevaluated (Paso 4.4)', () => {
  const base = { protocol: CONSTRUYE_PROTOCOL_VERSION, instanceId: 'a'.repeat(24), type: 'element-picked' as const, status: 'exact' as const, start: 0, end: 10, tagName: 'div' }

  it('acepta reevaluated: true o false', () => {
    expect(isPreviewEvent({ ...base, reevaluated: true })).toBe(true)
    expect(isPreviewEvent({ ...base, reevaluated: false })).toBe(true)
  })

  it('reevaluated es opcional — un element-picked de un clic real no lo necesita', () => {
    expect(isPreviewEvent(base)).toBe(true)
  })

  it('rechaza un reevaluated que no sea booleano', () => {
    expect(isPreviewEvent({ ...base, reevaluated: 'true' })).toBe(false)
    expect(isPreviewEvent({ ...base, reevaluated: 1 })).toBe(false)
  })
})

describe('clampCssRuleRange — nunca navega a una posición que ya no corresponde al CSS aplicado', () => {
  it('devuelve el rango cuando cabe en el archivo actual', () => {
    expect(clampCssRuleRange({ start: 5, end: 40 }, 100)).toEqual({ start: 5, end: 40 })
  })

  it('devuelve null cuando el rango ya no cabe (el estudiante aplicó otra versión del CSS)', () => {
    expect(clampCssRuleRange({ start: 90, end: 120 }, 100)).toBeNull()
  })

  it('nunca recorta un rango inválido a uno "casi correcto" — todo o nada', () => {
    expect(clampCssRuleRange({ start: -5, end: 20 }, 100)).toBeNull()
    expect(clampCssRuleRange({ start: 40, end: 10 }, 100)).toBeNull()
  })
})

// PASO 4.4 (punto 14 del gate): cierra la prueba de protección de borrador que 4.3 dejó
// heredada de cssInSync sin un test dedicado. Mientras el archivo abierto no coincida con lo
// APLICADO, `fileTracksAppliedProject` es la única señal que decide si CodeWorkspace envía
// alguna posición al runner — si devuelve `false`, no se envía nada, así que no queda ningún
// `lastCssRange` vigente que un cambio de viewport pudiera reevaluar como si el draft ya
// estuviera aplicado (ver el comentario en main.ts del runner).
describe('fileTracksAppliedProject — protección de borrador (Paso 4.2/4.4)', () => {
  it('css: confía en la posición solo cuando el CSS del editor coincide con el aplicado', () => {
    expect(fileTracksAppliedProject('css', true, true)).toBe(true)
    expect(fileTracksAppliedProject('css', true, false)).toBe(false) // draft de CSS sin aplicar
  })

  it('html: confía en la posición solo cuando el HTML del editor coincide con el aplicado', () => {
    expect(fileTracksAppliedProject('html', true, true)).toBe(true)
    expect(fileTracksAppliedProject('html', false, true)).toBe(false) // draft de HTML sin aplicar
  })

  it('cada archivo se evalúa contra su propio estado de sincronía, no el del otro', () => {
    // CSS desincronizado no debe importar si se pregunta por 'html', y viceversa.
    expect(fileTracksAppliedProject('html', true, false)).toBe(true)
    expect(fileTracksAppliedProject('css', false, true)).toBe(true)
  })
})
