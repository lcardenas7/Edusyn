import type { CapabilityContext, CapabilityTarget, CssCapability } from './capabilities'
import { formatColorValue, formatLengthValue, classifyEditableValue, type EditableCssProperty } from './cssEdits'
import { planCssInsertion } from './cssInsert'
import { describeMediaCondition } from './explanations'
import { prepareHtmlTextForSource } from './htmlEdits'
import type { ModificationIntent, ModificationOperation } from './intent'
import { replaceExactRange } from './sourceEdits'

/**
 * CAPAS C, D y E (Paso 5.2) — plan, validación y ejecución.
 *
 * Aquí es donde la intención deja de ser lenguaje y se convierte en aritmética sobre rangos.
 * Tres invariantes gobiernan el archivo:
 *
 * 1. NADA se ejecuta al interpretarse: primero se construye un plan que el estudiante ve y
 *    confirma.
 * 2. Antes de escribir se revalida TODO otra vez, contra los archivos de ese momento — un plan
 *    es una propuesta, nunca un permiso guardado.
 * 3. O se aplican todas las operaciones o no se aplica ninguna, incluso cuando el plan toca
 *    index.html y styles.css a la vez.
 */

/** Política determinística para "más grande"/"más redondeado" (punto 12). No hay ningún número
 * elegido al vuelo: el paso es proporcional al valor actual, con un mínimo para que un cambio
 * siempre se note, y con topes para que no se dispare. */
const RELATIVE_FACTOR: Record<EditableCssProperty, number> = {
  'font-size': 0.25,
  'border-radius': 0.5,
  'background-color': 0,
  color: 0,
}
const MAX_PX = 200
const MAX_REM = 20

export function applyRelativeChange(amount: number, unit: string, property: EditableCssProperty, direction: 'increase' | 'decrease'): number | null {
  const factor = RELATIVE_FACTOR[property]
  if (!factor) return null
  const esPx = unit === 'px'
  const minimo = esPx ? 1 : 0.25
  const tope = esPx ? MAX_PX : MAX_REM
  const paso = esPx
    ? Math.max(1, Math.round(amount * factor))
    : Math.max(0.25, Math.round(amount * factor * 4) / 4)
  const suelo = property === 'border-radius' ? 0 : minimo
  const siguiente = direction === 'increase' ? amount + paso : amount - paso
  if (siguiente > tope) return null
  return Math.max(suelo, Math.round(siguiente * 100) / 100)
}

export interface PlannedOperation {
  capabilityId: string
  /** Para la ficha: qué se cambia, en lenguaje de estudiante. */
  label: string
  before: string
  after: string
  file: 'html' | 'css'
  affectedElements: number
  mediaNote?: string
  /** Paso 5.3: en qué regla se insertará. Se le muestra al estudiante (su código, no un dato
   * sensible); nunca viaja al manifiesto que vería un intérprete. */
  selector?: string
  /** `true` cuando la operación AÑADE código en vez de sustituirlo. */
  inserts?: boolean
  /** Resueltos por el motor, nunca por la intención. En una inserción es un rango de longitud
   * cero: `replaceExactRange` lo trata igual, comprobando que ahí siga sin haber nada. */
  range: { start: number; end: number }
  expected: string
  /** Texto exacto que se escribirá (ya normalizado y escapado si es texto). */
  replacement: string
  /** Paso 5.3: región que debe seguir intacta para que la inserción siga siendo válida. Cubre
   * de una vez que la regla no cambió, que la propiedad sigue ausente y que el formato sigue
   * siendo el mismo — un rango vacío por sí solo no demuestra nada de eso. */
  guard?: { start: number; end: number; text: string }
}

export interface ModificationPlan {
  contextId: string
  operations: PlannedOperation[]
  /** Lo que no se pudo planificar, en las palabras del estudiante. */
  unsupported: string[]
}

const CSS_LABELS: Record<EditableCssProperty, string> = {
  'background-color': 'Color de fondo',
  color: 'Color del texto',
  'font-size': 'Tamaño del texto',
  'border-radius': 'Redondeo de las esquinas',
}

/**
 * Paso 5.3 — valores por defecto al INSERTAR una propiedad que no existía. Cerrado y
 * documentado: ninguna IA ni ningún cálculo elige aquí.
 *
 * Solo `border-radius` tiene default, y solo para "más redondeado": partir de "sin redondeo" y
 * pedir más tiene un destino evidente (12 px, el mismo valor que usa el resto del producto como
 * esquina redondeada). "Menos redondeado" sobre una propiedad ausente no significa nada, así
 * que no se ofrece. Los colores solo se insertan con un color que el estudiante haya nombrado.
 */
const INSERT_DEFAULTS: Partial<Record<EditableCssProperty, string>> = { 'border-radius': '12px' }

function mediaNote(capability: CssCapability): string | undefined {
  if (!capability.mediaText) return undefined
  return capability.mediaActive
    ? `Se aplica ahora, en ${describeMediaCondition(capability.mediaText)}.`
    : `Solo se aplica en ${describeMediaCondition(capability.mediaText)}.`
}

function planCssOperation(context: CapabilityContext, target: CapabilityTarget, operation: Extract<ModificationOperation, { kind: 'SET_CSS_VALUE' }>): PlannedOperation | null {
  const capability = context.manifest.capabilities.find((c) => c.id === operation.capabilityId)
  if (!capability || capability.kind !== 'css' || capability.action !== 'modify' || !target.property) return null
  // Modificar exige un rango y un texto esperado: una capacidad de inserción no los tiene, y
  // por aquí nunca debe colarse.
  if (!target.range || target.expected === undefined || capability.currentValue === undefined) return null
  const actual = classifyEditableValue(target.property, capability.currentValue)
  if (!actual) return null

  let nuevo: string | null = null
  if (operation.value.mode === 'absolute') {
    // Un valor absoluto SOLO puede ser un color: las longitudes se cambian con "más/menos",
    // para que la intención nunca escriba un número arbitrario en la hoja de estilos.
    nuevo = actual.kind === 'color' ? formatColorValue(operation.value.value) : null
  } else if (actual.kind === 'length') {
    const cantidad = applyRelativeChange(actual.amount, actual.unit, target.property, operation.value.direction)
    nuevo = cantidad === null ? null : formatLengthValue(cantidad, actual.unit)
  }
  if (!nuevo || nuevo === capability.currentValue) return null

  return {
    capabilityId: capability.id,
    label: CSS_LABELS[target.property],
    before: capability.currentValue,
    after: nuevo,
    file: 'css',
    affectedElements: capability.affectedElements,
    mediaNote: mediaNote(capability),
    range: target.range,
    expected: target.expected,
    replacement: nuevo,
  }
}

function planTextOperation(context: CapabilityContext, target: CapabilityTarget, operation: Extract<ModificationOperation, { kind: 'SET_TEXT' }>): PlannedOperation | null {
  const capability = context.manifest.capabilities.find((c) => c.id === operation.capabilityId)
  if (!capability || capability.kind !== 'text') return null
  if (!target.range || target.expected === undefined) return null
  // El texto pasa por las MISMAS puertas del Paso 5.1: normalización y escape. La intención no
  // se salta ninguna.
  const seguro = prepareHtmlTextForSource(operation.value)
  if (!seguro || seguro === target.expected) return null
  return {
    capabilityId: capability.id,
    label: 'Texto',
    before: capability.currentValue,
    after: operation.value.trim(),
    file: 'html',
    affectedElements: 1,
    range: target.range,
    expected: target.expected,
    replacement: seguro,
  }
}

/**
 * Paso 5.3 — planifica AÑADIR una declaración que no existe. El valor no lo elige la frase:
 * o es un color que el estudiante nombró, o es el default cerrado de la propiedad. Todo lo
 * estructural (dónde y con qué formato) lo calcula `planCssInsertion` a partir del rango del
 * bloque, y si ese cálculo no es seguro aquí no se planifica nada.
 */
function planInsertOperation(context: CapabilityContext, target: CapabilityTarget, operation: Extract<ModificationOperation, { kind: 'INSERT_CSS_DECLARATION' }>): PlannedOperation | null {
  const capability = context.manifest.capabilities.find((c) => c.id === operation.capabilityId)
  if (!capability || capability.kind !== 'css' || capability.action !== 'add' || !target.property || !target.block) return null

  const esColor = target.property === 'background-color' || target.property === 'color'
  let valor: string | null = null
  if (operation.value.mode === 'absolute') {
    valor = esColor ? formatColorValue(operation.value.value) : null
  } else if (operation.value.direction === 'increase') {
    valor = INSERT_DEFAULTS[target.property] ?? null
  }
  if (!valor) return null

  const insercion = planCssInsertion(context.css, target.block, target.property, valor)
  if (!insercion) return null

  return {
    capabilityId: capability.id,
    label: `Agregar ${CSS_LABELS[target.property].toLowerCase()}`,
    before: 'no existía',
    after: valor,
    file: 'css',
    affectedElements: capability.affectedElements,
    mediaNote: mediaNote(capability),
    selector: target.selector,
    inserts: true,
    range: { start: insercion.offset, end: insercion.offset },
    expected: '',
    replacement: insercion.text,
    guard: insercion.guard,
  }
}

/**
 * CAPA C — cruza lo que se pidió con lo que se puede demostrar. Una operación que apunte a una
 * capacidad inexistente, o cuyo valor no sobreviva a la gramática del motor, simplemente no
 * entra en el plan: no se ejecuta ni se avisa a medias.
 */
export function buildPlan(context: CapabilityContext, intent: ModificationIntent): ModificationPlan {
  const operations: PlannedOperation[] = []
  const unsupported = [...intent.unsupported]

  for (const operation of intent.operations) {
    const target = context.targets.find((t) => t.id === operation.capabilityId)
    if (!target) { unsupported.push('una parte del cambio que ya no corresponde a este elemento'); continue }
    const planificada = operation.kind === 'SET_TEXT'
      ? planTextOperation(context, target, operation)
      : operation.kind === 'INSERT_CSS_DECLARATION'
        ? planInsertOperation(context, target, operation)
        : planCssOperation(context, target, operation)
    if (planificada) operations.push(planificada)
    else unsupported.push('una parte del cambio que no se puede hacer de forma segura todavía')
  }

  return { contextId: context.manifest.contextId, operations, unsupported }
}

export type PlanExecutionFailure = 'sin-operaciones' | 'contexto-cambiado' | 'archivo-desincronizado' | 'rangos-superpuestos' | 'codigo-cambiado'

export type PlanExecution =
  | { ok: true; html: string; css: string; files: ('html' | 'css')[] }
  | { ok: false; reason: PlanExecutionFailure }

export interface PlanExecutionInput {
  plan: ModificationPlan
  /** El contexto vigente AHORA: si no es el mismo para el que se hizo el plan, se rechaza. */
  currentContextId: string
  html: string
  css: string
  htmlInSync: boolean
  cssInSync: boolean
}

/**
 * CAPAS D y E — revalida todo y calcula el resultado en memoria. No escribe nada: devuelve el
 * contenido nuevo de ambos archivos para que quien sea dueño del estado los actualice de una
 * sola vez (atomicidad a nivel del editor, punto 16).
 *
 * Estrategia para varios rangos en el mismo archivo (punto 17): se aplican de MAYOR a MENOR
 * offset. Así cada reemplazo solo desplaza texto que ya quedó atrás, y los offsets de las
 * operaciones pendientes siguen siendo válidos sin recalcular nada. Los rangos que se solapen
 * se rechazan antes de tocar nada: dos operaciones sobre el mismo tramo no tienen un resultado
 * único y "casi correcto" no es una opción.
 */
export function executePlan({ plan, currentContextId, html, css, htmlInSync, cssInSync }: PlanExecutionInput): PlanExecution {
  if (plan.operations.length === 0) return { ok: false, reason: 'sin-operaciones' }
  if (plan.contextId !== currentContextId) return { ok: false, reason: 'contexto-cambiado' }

  const files = Array.from(new Set(plan.operations.map((operation) => operation.file)))
  if (files.includes('html') && !htmlInSync) return { ok: false, reason: 'archivo-desincronizado' }
  if (files.includes('css') && !cssInSync) return { ok: false, reason: 'archivo-desincronizado' }

  const resultado = { html, css }

  // Paso 5.3: los guards se comprueban ANTES de escribir nada y contra el contenido ORIGINAL.
  // Un guard cubre toda una regla, así que puede solaparse con el rango de otra operación del
  // mismo plan (p. ej. modificar un valor dentro de la misma regla donde se inserta otra
  // propiedad); comprobarlos todos antes de mutar evita que un cambio invalide el guard del
  // siguiente sin que nada haya ido mal en realidad.
  for (const operation of plan.operations) {
    if (!operation.guard) continue
    if (resultado[operation.file].slice(operation.guard.start, operation.guard.end) !== operation.guard.text) {
      return { ok: false, reason: 'codigo-cambiado' }
    }
  }

  for (const file of files) {
    const delArchivo = plan.operations
      .map((operation, indice) => ({ operation, indice }))
      .filter(({ operation }) => operation.file === file)
      // Mayor offset primero. Para dos inserciones en el MISMO punto el desempate es el orden
      // del plan, pero invertido: la que se aplica primero queda detrás en el archivo, así que
      // aplicando de atrás hacia delante el resultado final respeta el orden que el estudiante
      // acaba de leer en la ficha. Nunca depende del orden accidental de los objetos.
      .sort((a, b) => b.operation.range.start - a.operation.range.start || b.indice - a.indice)
      .map(({ operation }) => operation)

    for (let i = 1; i < delArchivo.length; i++) {
      const anterior = delArchivo[i - 1]
      const actual = delArchivo[i]
      // Dos inserciones en el mismo punto conviven (se concatenan); lo que no puede ocurrir es
      // que un reemplazo pise a otro, ni que una inserción caiga dentro de un rango reemplazado.
      const mismoPuntoDeInsercion = actual.range.start === actual.range.end && anterior.range.start === anterior.range.end && actual.range.start === anterior.range.start
      if (!mismoPuntoDeInsercion && actual.range.end > anterior.range.start) return { ok: false, reason: 'rangos-superpuestos' }
    }

    let contenido = resultado[file]
    for (const operation of delArchivo) {
      const paso = replaceExactRange(contenido, operation.range, operation.expected, operation.replacement)
      if (!paso) return { ok: false, reason: 'codigo-cambiado' }
      contenido = paso.content
    }
    resultado[file] = contenido
  }

  return { ok: true, html: resultado.html, css: resultado.css, files }
}

export function describePlanFailure(reason: PlanExecutionFailure): string {
  switch (reason) {
    case 'sin-operaciones': return 'No hay ningún cambio que aplicar.'
    case 'contexto-cambiado': return 'Elegiste otro elemento. Vuelve a preparar los cambios.'
    case 'archivo-desincronizado': return 'Hay cambios sin aplicar en tu código: aplícalos antes de usar esta ayuda.'
    case 'rangos-superpuestos': return 'Esos cambios se pisan entre sí. Inténtalo de a uno.'
    case 'codigo-cambiado': return 'El código cambió desde que preparaste esta modificación. Vuelve a intentarlo.'
  }
}
