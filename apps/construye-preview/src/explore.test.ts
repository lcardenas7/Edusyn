// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createExploreController, MAX_CSS_HIGHLIGHTS, type ExploreOutcome, type ExploreRange } from './explore'

type OnPick = (outcome: ExploreOutcome, target: HTMLElement | null, reevaluated: boolean) => void

function setUpDom() {
  document.body.innerHTML = `
    <main data-edusyn-id="3">
      <button id="btn" data-edusyn-id="0">Comenzar</button>
      <p id="texto" data-edusyn-id="1">Hola</p>
      <span id="sin-marca">Creado por JS, sin data-edusyn-id</span>
      <a id="link" href="https://ejemplo.test" data-edusyn-id="2">Ir</a>
    </main>
  `
  return {
    main: document.querySelector('main')!,
    btn: document.getElementById('btn')!,
    texto: document.getElementById('texto')!,
    sinMarca: document.getElementById('sin-marca')!,
    link: document.getElementById('link')! as HTMLAnchorElement,
  }
}

const ranges: ExploreRange[] = [
  { start: 0, end: 30, tagName: 'button' },
  { start: 31, end: 45, tagName: 'p' },
  { start: 46, end: 90, tagName: 'a' },
  { start: 0, end: 200, tagName: 'main' },
]

describe('createExploreController', () => {
  let onPick: ReturnType<typeof vi.fn<OnPick>>

  beforeEach(() => {
    onPick = vi.fn()
  })

  it('en hover, resalta el elemento marcado sin tocar el layout (usa outline, no border)', () => {
    const { btn } = setUpDom()
    const controller = createExploreController(document, () => ranges, onPick)
    controller.enable()

    btn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    expect(btn.style.outline).not.toBe('')
    expect(btn.style.border).toBe('') // nunca tocamos border/layout

    controller.disable()
  })

  it('1. h1/botón: clic exacto reporta el rango correcto', () => {
    const { btn } = setUpDom()
    const controller = createExploreController(document, () => ranges, onPick)
    controller.enable()

    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(onPick).toHaveBeenCalledWith({ status: 'exact', start: 0, end: 30, tagName: 'button' }, btn, false)

    controller.disable()
  })

  it('9. elemento creado por JS sin data-edusyn-id: reporta "none", nunca un rango inventado — ni siquiera el de un ancestro real', () => {
    // Regresión: descubierto en un navegador real, no en este test. `sinMarca` está anidado
    // dentro de <main data-edusyn-id="3">, que SÍ tiene una marca real y válida. Antes del
    // fix, findTarget subía con closest() y encontraba <main> — reportando "exact" con el
    // rango del <main> del proyecto, un rango real pero que NO corresponde a lo clickeado.
    // Eso es precisamente la invención que la regla del usuario prohíbe.
    const { sinMarca, main } = setUpDom()
    const controller = createExploreController(document, () => ranges, onPick)
    controller.enable()

    sinMarca.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(onPick).toHaveBeenCalledWith({ status: 'none' }, sinMarca, false)
    expect(onPick).not.toHaveBeenCalledWith(expect.objectContaining({ tagName: 'main' }), expect.anything(), expect.anything())
    expect(main.style.outline).toBe('') // tampoco se resalta el ancestro como si fuera lo elegido

    controller.disable()
  })

  it('19. el elemento crudo llega al callback aunque no tenga HTML determinable, para poder relacionarlo con CSS (Paso 4.2)', () => {
    const { sinMarca } = setUpDom()
    const controller = createExploreController(document, () => ranges, onPick)
    controller.enable()

    sinMarca.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    // El HTML es 'none' (sin marca), pero el segundo argumento SIGUE siendo el elemento real:
    // Preview → HTML y Preview → CSS son dos preguntas independientes sobre el mismo clic.
    expect(onPick).toHaveBeenCalledWith({ status: 'none' }, sinMarca, false)

    controller.disable()
  })

  it('no ejecuta la acción normal del elemento (ej. seguir un enlace) mientras se explora', () => {
    const { link } = setUpDom()
    const controller = createExploreController(document, () => ranges, onPick)
    controller.enable()

    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    link.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(onPick).toHaveBeenCalledWith({ status: 'exact', start: 46, end: 90, tagName: 'a' }, link, false)

    controller.disable()
  })

  it('11/12. activar y desactivar varias veces: al desactivar, el DOM vuelve exactamente a como estaba', () => {
    const { btn } = setUpDom()
    const controller = createExploreController(document, () => ranges, onPick)

    controller.enable()
    btn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    expect(btn.style.outline).not.toBe('')
    controller.disable()
    expect(btn.style.outline).toBe('')
    expect(btn.getAttribute('style')).toBeFalsy() // ni un atributo style residual

    // Segunda vuelta: activar/desactivar de nuevo no dejó listeners duplicados ni se rompe.
    controller.enable()
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(onPick).toHaveBeenCalledTimes(1)
    controller.disable()
  })

  it('12. tras salir de Explorar, un clic ya NO se intercepta (comportamiento normal restaurado)', () => {
    const { link } = setUpDom()
    const controller = createExploreController(document, () => ranges, onPick)

    controller.enable()
    controller.disable()

    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    link.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(onPick).not.toHaveBeenCalled()
  })

  it('el resaltado de selección persiste al mover el mouse a otro elemento marcado, y se limpia al desactivar', () => {
    const { btn, texto } = setUpDom()
    const controller = createExploreController(document, () => ranges, onPick)
    controller.enable()

    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(btn.style.outline).not.toBe('')

    texto.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    expect(btn.style.outline).not.toBe('') // el seleccionado no se borra por un hover distinto
    expect(texto.style.outline).not.toBe('')

    controller.disable()
    expect(btn.style.outline).toBe('')
    expect(texto.style.outline).toBe('')
  })

  it('enable()/disable() son idempotentes (llamarlos dos veces seguidas no falla ni duplica listeners)', () => {
    const { btn } = setUpDom()
    const controller = createExploreController(document, () => ranges, onPick)

    controller.enable()
    controller.enable()
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(onPick).toHaveBeenCalledTimes(1) // no se disparó dos veces por un doble listener

    controller.disable()
    controller.disable()
    expect(controller.isEnabled()).toBe(false)
  })

  // Código → Preview (Paso 3). `ranges` incluye un <main> [0,200] que envuelve por completo
  // al <button> [0,30]: el cursor cae dentro de AMBOS, y el caso 12 (anidados) exige que se
  // elija el más específico (el <button>), no el contenedor.
  describe('showCodePosition / hideCodePosition (Código → Preview)', () => {
    beforeEach(() => {
      // jsdom no implementa scrollIntoView; lo simulamos como no-op para poder verificar que
      // SÍ se llama (acción explícita) o que NO se llama (cursor pasivo).
      Element.prototype.scrollIntoView = vi.fn()
    })

    it('1/12. cursor dentro de un elemento anidado: resalta el más interno (botón), no el contenedor (main)', () => {
      const { btn, main } = setUpDom()
      const controller = createExploreController(document, () => ranges, onPick)
      controller.enable()

      const outcome = controller.showCodePosition(5, 10, false)
      expect(outcome).toEqual({ status: 'exact', start: 0, end: 30, tagName: 'button' })
      expect(btn.style.outline).not.toBe('')
      expect(main.style.outline).toBe('') // el contenedor no se resalta como si fuera lo elegido

      controller.disable()
    })

    it('cursor pasivo (no explícito) no hace scroll ni reemplaza la selección existente', () => {
      const { btn, texto } = setUpDom()
      const controller = createExploreController(document, () => ranges, onPick)
      controller.enable()

      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })) // selecciona btn
      controller.showCodePosition(31, 40, false) // cursor pasivo cae en <p id="texto">

      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
      expect(btn.style.outline).not.toBe('') // la selección por clic sigue intacta
      expect(texto.style.outline).not.toBe('') // y el nuevo hover de código también se ve

      controller.disable()
    })

    it('acción explícita en código SÍ resalta + centra, y reemplaza la selección anterior', () => {
      const { btn, texto } = setUpDom()
      const controller = createExploreController(document, () => ranges, onPick)
      controller.enable()

      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      const outcome = controller.showCodePosition(31, 45, true) // selección explícita = <p>

      expect(outcome).toEqual({ status: 'exact', start: 31, end: 45, tagName: 'p' })
      expect(texto.style.outline).not.toBe('')
      expect(btn.style.outline).toBe('') // la selección anterior se reemplaza, no se acumula
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1)

      controller.disable()
    })

    it('4/5. Preview → Código → Preview conserva la misma correspondencia (sin inventar una nueva)', () => {
      const { btn } = setUpDom()
      const controller = createExploreController(document, () => ranges, onPick)
      controller.enable()

      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      expect(onPick).toHaveBeenCalledWith({ status: 'exact', start: 0, end: 30, tagName: 'button' }, btn, false)

      // El editor selecciona exactamente ese rango devuelto; el código pide resaltarlo de vuelta.
      const outcome = controller.showCodePosition(0, 30, true)
      expect(outcome).toEqual({ status: 'exact', start: 0, end: 30, tagName: 'button' })

      controller.disable()
    })

    it('7. posición sin ningún rango que la contenga: "none", nunca un rango inventado', () => {
      const { main } = setUpDom()
      const controller = createExploreController(document, () => ranges, onPick)
      controller.enable()

      const outcome = controller.showCodePosition(500, 510, true)
      expect(outcome).toEqual({ status: 'none' })
      expect(main.style.outline).toBe('')

      controller.disable()
    })

    it('hideCodePosition limpia solo el resaltado de código, sin tocar hover/selección del mouse', () => {
      const { btn, texto } = setUpDom()
      const controller = createExploreController(document, () => ranges, onPick)
      controller.enable()

      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      controller.showCodePosition(31, 40, false)
      expect(texto.style.outline).not.toBe('')

      controller.hideCodePosition()
      expect(texto.style.outline).toBe('')
      expect(btn.style.outline).not.toBe('') // la selección por clic no se ve afectada

      controller.disable()
    })

    it('14. atributos largos/multilínea: la posición se resuelve igual, es aritmética pura sobre offsets', () => {
      // Un atributo multilínea solo hace que el rango del elemento sea más largo en offsets —
      // no cambia el algoritmo: sigue siendo "¿este rango contiene [start,end]?".
      const longAttrRanges: ExploreRange[] = [{ start: 0, end: 500, tagName: 'button' }]
      document.body.innerHTML = '<button data-edusyn-id="0">x</button>'
      const btn = document.querySelector('button')!
      const controller = createExploreController(document, () => longAttrRanges, onPick)
      controller.enable()

      const outcome = controller.showCodePosition(420, 430, true) // cursor dentro del atributo largo
      expect(outcome).toEqual({ status: 'exact', start: 0, end: 500, tagName: 'button' })
      expect(btn.style.outline).not.toBe('')

      controller.disable()
    })

    it('CSS: resalta todos los elementos que coinciden y los limpia al cambiar de regla', () => {
      document.body.innerHTML = '<div class="card" data-edusyn-id="0">1</div><div class="card" data-edusyn-id="1">2</div><p data-edusyn-id="2">otro</p>'
      const tarjetas = Array.from(document.querySelectorAll('.card')) as HTMLElement[]
      const parrafo = document.querySelector('p') as HTMLElement
      const controller = createExploreController(document, () => ranges, onPick)
      controller.enable()

      expect(controller.showCssMatches(tarjetas)).toBe(2)
      expect(tarjetas.every((el) => el.style.outline !== '')).toBe(true)

      // Cambiar de regla limpia lo anterior: nunca quedan resaltados fantasma.
      controller.showCssMatches([parrafo])
      expect(tarjetas.every((el) => el.style.outline === '')).toBe(true)
      expect(parrafo.style.outline).not.toBe('')

      controller.hideCssMatches()
      expect(parrafo.style.outline).toBe('')
      controller.disable()
    })

    it('CSS: al desactivar Explorar no queda ningún resaltado de CSS', () => {
      document.body.innerHTML = '<div class="card" data-edusyn-id="0">1</div>'
      const card = document.querySelector('.card') as HTMLElement
      const controller = createExploreController(document, () => ranges, onPick)
      controller.enable()
      controller.showCssMatches([card])
      controller.disable()
      expect(card.style.outline).toBe('')
      expect(card.getAttribute('style')).toBeFalsy()
    })

    it('CSS: con Explorar apagado no resalta nada', () => {
      document.body.innerHTML = '<div class="card" data-edusyn-id="0">1</div>'
      const card = document.querySelector('.card') as HTMLElement
      const controller = createExploreController(document, () => ranges, onPick)
      expect(controller.showCssMatches([card])).toBe(0)
      expect(card.style.outline).toBe('')
    })

    it('CSS: aplica un tope visual sin alterar el conteo real que se informa', () => {
      document.body.innerHTML = Array.from({ length: 60 }, (_, i) => '<div class="card" data-edusyn-id="' + i + '">' + i + '</div>').join('')
      const todas = Array.from(document.querySelectorAll('.card')) as HTMLElement[]
      const controller = createExploreController(document, () => ranges, onPick)
      controller.enable()
      expect(todas).toHaveLength(60)
      expect(controller.showCssMatches(todas)).toBe(MAX_CSS_HIGHLIGHTS) // solo el resaltado se limita
      controller.disable()
    })

    it('8. con Explorar desactivado, showCodePosition no hace nada (ni resalta ni reporta)', () => {
      const { btn } = setUpDom()
      const controller = createExploreController(document, () => ranges, onPick)
      // Nunca se llama a enable().

      const outcome = controller.showCodePosition(0, 30, true)
      expect(outcome).toEqual({ status: 'none' })
      expect(btn.style.outline).toBe('')
      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
    })
  })

  // Paso 4.4 (contexto reactivo al viewport, Preview → CSS): sin ninguna interacción nueva del
  // estudiante, repetir el mismo resultado para la selección VIGENTE — nunca una selección
  // nueva, nunca reinstrumentar.
  describe('reevaluateSelection (Paso 4.4)', () => {
    it('con una selección vigente, repite el mismo resultado marcado como reevaluated=true', () => {
      const { btn } = setUpDom()
      const controller = createExploreController(document, () => ranges, onPick)
      controller.enable()

      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      expect(onPick).toHaveBeenCalledWith({ status: 'exact', start: 0, end: 30, tagName: 'button' }, btn, false)

      controller.reevaluateSelection()
      expect(onPick).toHaveBeenLastCalledWith({ status: 'exact', start: 0, end: 30, tagName: 'button' }, btn, true)
      expect(onPick).toHaveBeenCalledTimes(2)

      controller.disable()
    })

    it('misma identidad de elemento en cada reevaluación — nunca se reconstruye la selección', () => {
      const { btn } = setUpDom()
      const controller = createExploreController(document, () => ranges, onPick)
      controller.enable()
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

      controller.reevaluateSelection()
      controller.reevaluateSelection()
      const targets = onPick.mock.calls.map((call) => call[1])
      expect(targets.every((t) => t === btn)).toBe(true) // misma referencia de objeto, siempre

      controller.disable()
    })

    it('sin ninguna selección vigente, no hace nada (nada que reevaluar)', () => {
      const controller = createExploreController(document, () => ranges, onPick)
      controller.enable()

      controller.reevaluateSelection()
      expect(onPick).not.toHaveBeenCalled()

      controller.disable()
    })

    it('tras un pick "none" (sin data-edusyn-id), no queda selección que reevaluar', () => {
      const { sinMarca } = setUpDom()
      const controller = createExploreController(document, () => ranges, onPick)
      controller.enable()
      sinMarca.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      onPick.mockClear()

      controller.reevaluateSelection()
      expect(onPick).not.toHaveBeenCalled()

      controller.disable()
    })

    it('con Explorar desactivado, no hace nada aunque hubiera una selección previa', () => {
      const { btn } = setUpDom()
      const controller = createExploreController(document, () => ranges, onPick)
      controller.enable()
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      controller.disable() // limpia la selección, como hace siempre disable()
      onPick.mockClear()

      controller.reevaluateSelection()
      expect(onPick).not.toHaveBeenCalled()
    })
  })
})
