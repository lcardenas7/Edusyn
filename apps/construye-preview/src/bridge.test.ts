import { describe, expect, it } from 'vitest'
import { escapeRawTextClose, isTrustedHighlightCodePositionMessage, isTrustedLoadProjectMessage, isTrustedSetExploreModeMessage } from './bridge'

// Cierra el gate de F0 del lado del runner: demuestra que el iframe sandboxed (origen
// opaco) solo acepta load-project de la ventana padre exacta indicada al arrancar, con el
// origin, protocolo e instanceId correctos, y con un proyecto estrictamente estático.
// Ver docs/EDUSYN_CONSTRUYE_F0_AMENAZAS.md.
describe('isTrustedLoadProjectMessage (bridge preview <- host)', () => {
  const parentWindow = { id: 'edusyn-host-window' }
  const anotherWindow = { id: 'not-the-host' }
  const parentOrigin = 'https://app.edusyn.co'
  const protocol = 1
  const instanceId = 'a'.repeat(24)
  const project = { html: '<main>ok</main>', css: 'main{color:teal}', js: 'console.log(1)' }
  const validMessage = { source: parentWindow, origin: parentOrigin, data: { protocol, instanceId, type: 'load-project' as const, project } }

  it('accepts a message from the exact parent window and origin', () => {
    expect(isTrustedLoadProjectMessage(validMessage, parentWindow, parentOrigin, protocol, instanceId)).toBe(true)
  })

  it('rejects a message whose source is not the parent window (e.g. a sibling frame)', () => {
    expect(isTrustedLoadProjectMessage({ ...validMessage, source: anotherWindow }, parentWindow, parentOrigin, protocol, instanceId)).toBe(false)
  })

  it('rejects a message whose declared origin does not match the expected parent origin', () => {
    expect(isTrustedLoadProjectMessage({ ...validMessage, origin: 'https://evil.test' }, parentWindow, parentOrigin, protocol, instanceId)).toBe(false)
  })

  it('rejects a mismatched protocol version or a stale/foreign instanceId', () => {
    expect(isTrustedLoadProjectMessage({ ...validMessage, data: { ...validMessage.data, protocol: 2 } }, parentWindow, parentOrigin, protocol, instanceId)).toBe(false)
    expect(isTrustedLoadProjectMessage({ ...validMessage, data: { ...validMessage.data, instanceId: 'b'.repeat(24) } }, parentWindow, parentOrigin, protocol, instanceId)).toBe(false)
  })

  it('rejects any message type other than load-project', () => {
    expect(isTrustedLoadProjectMessage({ ...validMessage, data: { ...validMessage.data, type: 'grant-grade' } }, parentWindow, parentOrigin, protocol, instanceId)).toBe(false)
  })

  it('rejects a project payload that is not plain static text (e.g. a function or missing field)', () => {
    expect(isTrustedLoadProjectMessage({ ...validMessage, data: { ...validMessage.data, project: { html: '<main/>', css: '' } } }, parentWindow, parentOrigin, protocol, instanceId)).toBe(false)
    expect(isTrustedLoadProjectMessage({ ...validMessage, data: { ...validMessage.data, project: null } }, parentWindow, parentOrigin, protocol, instanceId)).toBe(false)
  })

  it('never trusts a message before parentOrigin/instanceId are known (pre-handshake state)', () => {
    expect(isTrustedLoadProjectMessage(validMessage, parentWindow, '', protocol, instanceId)).toBe(false)
    expect(isTrustedLoadProjectMessage(validMessage, parentWindow, parentOrigin, protocol, '')).toBe(false)
  })
})

// Un estudiante cuyo código contiene literalmente "</script" o "</style" (p. ej. dentro de
// un string) no debe poder cerrar antes de tiempo el elemento que lo envuelve y corromper
// el documento del preview. No es una fuga del sandbox (el código ya corre con las mismas
// libertades en ese origen aislado): es que el documento deje de reflejar lo que el
// estudiante escribió, sin ningún aviso.
describe('escapeRawTextClose', () => {
  it('leaves ordinary code untouched', () => {
    expect(escapeRawTextClose('console.log(1)', 'script')).toBe('console.log(1)')
    expect(escapeRawTextClose('main{color:teal}', 'style')).toBe('main{color:teal}')
  })

  it('escapes a literal closing tag so it cannot terminate the wrapping element early', () => {
    expect(escapeRawTextClose('const s = "</script>"; alert(1)', 'script')).toBe('const s = "<\\/script>"; alert(1)')
    expect(escapeRawTextClose('body::after{content:"</style>"}', 'style')).toBe('body::after{content:"<\\/style>"}')
  })

  it('matches case-insensitively and repeatedly', () => {
    expect(escapeRawTextClose('a</SCRIPT>b</Script>c', 'script')).toBe('a<\\/SCRIPT>b<\\/Script>c')
  })

  it('does not touch the other tag name', () => {
    expect(escapeRawTextClose('"</style>"', 'script')).toBe('"</style>"')
  })
})

// PASO 2 (Preview → Código): valida el mensaje que enciende/apaga "Explorar". Mismo patrón
// de confianza que load-project — cualquier ventana que no sea exactamente el host, con el
// origin/protocolo/instanceId correctos, queda rechazada.
describe('isTrustedSetExploreModeMessage', () => {
  const parentWindow = { id: 'edusyn-host-window' }
  const anotherWindow = { id: 'not-the-host' }
  const parentOrigin = 'https://app.edusyn.co'
  const protocol = 1
  const instanceId = 'a'.repeat(24)
  const validOn = { source: parentWindow, origin: parentOrigin, data: { protocol, instanceId, type: 'set-explore-mode' as const, enabled: true } }

  it('accepts enable/disable from the exact parent window and origin', () => {
    expect(isTrustedSetExploreModeMessage(validOn, parentWindow, parentOrigin, protocol, instanceId)).toBe(true)
    expect(isTrustedSetExploreModeMessage({ ...validOn, data: { ...validOn.data, enabled: false } }, parentWindow, parentOrigin, protocol, instanceId)).toBe(true)
  })

  it('rejects a message whose source is not the parent window', () => {
    expect(isTrustedSetExploreModeMessage({ ...validOn, source: anotherWindow }, parentWindow, parentOrigin, protocol, instanceId)).toBe(false)
  })

  it('rejects a mismatched origin, protocol version or instanceId', () => {
    expect(isTrustedSetExploreModeMessage({ ...validOn, origin: 'https://evil.test' }, parentWindow, parentOrigin, protocol, instanceId)).toBe(false)
    expect(isTrustedSetExploreModeMessage({ ...validOn, data: { ...validOn.data, protocol: 2 } }, parentWindow, parentOrigin, protocol, instanceId)).toBe(false)
    expect(isTrustedSetExploreModeMessage({ ...validOn, data: { ...validOn.data, instanceId: 'b'.repeat(24) } }, parentWindow, parentOrigin, protocol, instanceId)).toBe(false)
  })

  it('rejects a non-boolean enabled value instead of coercing it', () => {
    expect(isTrustedSetExploreModeMessage({ ...validOn, data: { ...validOn.data, enabled: 'true' } }, parentWindow, parentOrigin, protocol, instanceId)).toBe(false)
    expect(isTrustedSetExploreModeMessage({ ...validOn, data: { ...validOn.data, enabled: 1 } }, parentWindow, parentOrigin, protocol, instanceId)).toBe(false)
  })

  it('rejects any other message type, including load-project', () => {
    expect(isTrustedSetExploreModeMessage({ ...validOn, data: { ...validOn.data, type: 'load-project' } }, parentWindow, parentOrigin, protocol, instanceId)).toBe(false)
  })

  it('never trusts a message before parentOrigin/instanceId are known (pre-handshake state)', () => {
    expect(isTrustedSetExploreModeMessage(validOn, parentWindow, '', protocol, instanceId)).toBe(false)
    expect(isTrustedSetExploreModeMessage(validOn, parentWindow, parentOrigin, protocol, '')).toBe(false)
  })
})

// PASO 3 (Código → Preview): valida el mensaje que lleva la posición del cursor/selección del
// editor. Mismo modelo de confianza que los anteriores, más una validación de forma extra
// para `range` (nunca se confía en offsets con la forma correcta solo porque el mensaje ya
// pasó el resto de los chequeos).
describe('isTrustedHighlightCodePositionMessage', () => {
  const parentWindow = { id: 'edusyn-host-window' }
  const anotherWindow = { id: 'not-the-host' }
  const parentOrigin = 'https://app.edusyn.co'
  const protocol = 1
  const instanceId = 'a'.repeat(24)
  const range = { start: 10, end: 40, explicit: true }
  const validMessage = { source: parentWindow, origin: parentOrigin, data: { protocol, instanceId, type: 'highlight-code-position' as const, range } }

  it('accepts a well-formed range from the exact parent window and origin', () => {
    expect(isTrustedHighlightCodePositionMessage(validMessage, parentWindow, parentOrigin, protocol, instanceId)).toBe(true)
  })

  it('accepts range:null (instrucción de "dejar de resaltar")', () => {
    expect(isTrustedHighlightCodePositionMessage({ ...validMessage, data: { ...validMessage.data, range: null } }, parentWindow, parentOrigin, protocol, instanceId)).toBe(true)
  })

  it('rejects a message whose source is not the parent window', () => {
    expect(isTrustedHighlightCodePositionMessage({ ...validMessage, source: anotherWindow }, parentWindow, parentOrigin, protocol, instanceId)).toBe(false)
  })

  it('rejects a mismatched origin, protocol version or instanceId', () => {
    expect(isTrustedHighlightCodePositionMessage({ ...validMessage, origin: 'https://evil.test' }, parentWindow, parentOrigin, protocol, instanceId)).toBe(false)
    expect(isTrustedHighlightCodePositionMessage({ ...validMessage, data: { ...validMessage.data, protocol: 2 } }, parentWindow, parentOrigin, protocol, instanceId)).toBe(false)
    expect(isTrustedHighlightCodePositionMessage({ ...validMessage, data: { ...validMessage.data, instanceId: 'b'.repeat(24) } }, parentWindow, parentOrigin, protocol, instanceId)).toBe(false)
  })

  it('rejects a negative start, an inverted range, or a non-integer offset', () => {
    expect(isTrustedHighlightCodePositionMessage({ ...validMessage, data: { ...validMessage.data, range: { start: -1, end: 10, explicit: true } } }, parentWindow, parentOrigin, protocol, instanceId)).toBe(false)
    expect(isTrustedHighlightCodePositionMessage({ ...validMessage, data: { ...validMessage.data, range: { start: 40, end: 10, explicit: true } } }, parentWindow, parentOrigin, protocol, instanceId)).toBe(false)
    expect(isTrustedHighlightCodePositionMessage({ ...validMessage, data: { ...validMessage.data, range: { start: 1.5, end: 10, explicit: true } } }, parentWindow, parentOrigin, protocol, instanceId)).toBe(false)
  })

  it('rejects a non-boolean explicit value or a malformed range object', () => {
    expect(isTrustedHighlightCodePositionMessage({ ...validMessage, data: { ...validMessage.data, range: { start: 1, end: 10, explicit: 'yes' } } }, parentWindow, parentOrigin, protocol, instanceId)).toBe(false)
    expect(isTrustedHighlightCodePositionMessage({ ...validMessage, data: { ...validMessage.data, range: { start: 1 } } }, parentWindow, parentOrigin, protocol, instanceId)).toBe(false)
    expect(isTrustedHighlightCodePositionMessage({ ...validMessage, data: { ...validMessage.data, range: 'nope' } }, parentWindow, parentOrigin, protocol, instanceId)).toBe(false)
  })

  it('rejects any other message type, including set-explore-mode', () => {
    expect(isTrustedHighlightCodePositionMessage({ ...validMessage, data: { ...validMessage.data, type: 'set-explore-mode' } }, parentWindow, parentOrigin, protocol, instanceId)).toBe(false)
  })

  // PASO 4.1: el mensaje indica qué archivo se está editando para elegir la ruta (html/css).
  it('accepts file: html | css, and treats its absence as html', () => {
    expect(isTrustedHighlightCodePositionMessage({ ...validMessage, data: { ...validMessage.data, file: 'css' } }, parentWindow, parentOrigin, protocol, instanceId)).toBe(true)
    expect(isTrustedHighlightCodePositionMessage({ ...validMessage, data: { ...validMessage.data, file: 'html' } }, parentWindow, parentOrigin, protocol, instanceId)).toBe(true)
    expect(isTrustedHighlightCodePositionMessage(validMessage, parentWindow, parentOrigin, protocol, instanceId)).toBe(true)
  })

  it('rejects an unknown file instead of falling back silently', () => {
    expect(isTrustedHighlightCodePositionMessage({ ...validMessage, data: { ...validMessage.data, file: 'js' } }, parentWindow, parentOrigin, protocol, instanceId)).toBe(false)
    expect(isTrustedHighlightCodePositionMessage({ ...validMessage, data: { ...validMessage.data, file: 2 } }, parentWindow, parentOrigin, protocol, instanceId)).toBe(false)
  })

  it('never trusts a message before parentOrigin/instanceId are known (pre-handshake state)', () => {
    expect(isTrustedHighlightCodePositionMessage(validMessage, parentWindow, '', protocol, instanceId)).toBe(false)
    expect(isTrustedHighlightCodePositionMessage(validMessage, parentWindow, parentOrigin, protocol, '')).toBe(false)
  })
})
