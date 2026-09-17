import { blankLevels, evenWeights, type DraftCriterion, type EvaluatorType } from './formativeDraft'

/** Catálogo de aspectos para armar el cuestionario. Cada aspecto trae preguntas de ejemplo en las
 * dos voces: en la autoevaluación el estudiante habla de sí mismo; en la coevaluación habla del
 * compañero que está evaluando. El docente puede editarlas o escribir aspectos propios. */
export interface AspectDef { id: string; name: string; hint: string; self: string[]; peer: string[] }

export const ASPECTS: AspectDef[] = [
  { id: 'responsabilidad', name: 'Responsabilidad', hint: 'Cumple lo que le corresponde', self: [
    'Cumplí con las tareas que me correspondían.',
    'Entregué mi parte a tiempo.',
    'Traje los materiales que necesitaba.',
    'Asumí las consecuencias de mis errores y los corregí.',
  ], peer: [
    'Mi compañero cumplió con las tareas que le correspondían.',
    'Mi compañero entregó su parte a tiempo.',
    'Mi compañero trajo los materiales que necesitaba.',
    'Mi compañero reconoció sus errores y los corrigió.',
  ] },
  { id: 'colaboracion', name: 'Trabajo en equipo', hint: 'Aporta y coopera con el grupo', self: [
    'Aporté ideas al trabajo del grupo.',
    'Ayudé a mis compañeros cuando lo necesitaron.',
    'Acepté las decisiones del grupo aunque no fueran las mías.',
    'Compartí la información y los materiales con el equipo.',
  ], peer: [
    'Mi compañero aportó ideas al trabajo del grupo.',
    'Mi compañero ayudó a los demás cuando lo necesitaron.',
    'Mi compañero aceptó las decisiones del grupo.',
    'Mi compañero compartió la información y los materiales con el equipo.',
  ] },
  { id: 'comunicacion', name: 'Comunicación', hint: 'Expresa y escucha con claridad', self: [
    'Expresé mis ideas con claridad.',
    'Escuché con atención a mis compañeros sin interrumpir.',
    'Pregunté cuando no entendía algo.',
  ], peer: [
    'Mi compañero expresó sus ideas con claridad.',
    'Mi compañero escuchó a los demás sin interrumpir.',
    'Mi compañero preguntó cuando no entendía algo.',
  ] },
  { id: 'respeto', name: 'Respeto y convivencia', hint: 'Trato amable y respetuoso', self: [
    'Traté a mis compañeros con respeto.',
    'Respeté las opiniones diferentes a la mía.',
    'Resolví los desacuerdos dialogando.',
  ], peer: [
    'Mi compañero trató a los demás con respeto.',
    'Mi compañero respetó las opiniones diferentes a la suya.',
    'Mi compañero resolvió los desacuerdos dialogando.',
  ] },
  { id: 'participacion', name: 'Participación', hint: 'Se involucra en las actividades', self: [
    'Participé activamente en las actividades.',
    'Me mantuve concentrado en el trabajo.',
    'Propuse soluciones cuando surgieron problemas.',
  ], peer: [
    'Mi compañero participó activamente en las actividades.',
    'Mi compañero se mantuvo concentrado en el trabajo.',
    'Mi compañero propuso soluciones cuando surgieron problemas.',
  ] },
  { id: 'organizacion', name: 'Organización y manejo del tiempo', hint: 'Planea y aprovecha el tiempo', self: [
    'Organicé mi trabajo antes de empezar.',
    'Aproveché bien el tiempo de clase.',
    'Mantuve mis materiales y apuntes en orden.',
  ], peer: [
    'Mi compañero organizó su trabajo antes de empezar.',
    'Mi compañero aprovechó bien el tiempo de clase.',
    'Mi compañero mantuvo sus materiales en orden.',
  ] },
  { id: 'autonomia', name: 'Autonomía', hint: 'Trabaja por iniciativa propia', self: [
    'Trabajé sin necesidad de que me lo recordaran.',
    'Busqué información por mi cuenta cuando la necesité.',
    'Tomé la iniciativa para avanzar en el trabajo.',
  ], peer: [
    'Mi compañero trabajó sin necesidad de que se lo recordaran.',
    'Mi compañero buscó información por su cuenta cuando la necesitó.',
    'Mi compañero tomó la iniciativa para avanzar en el trabajo.',
  ] },
  { id: 'compromiso', name: 'Compromiso con el aprendizaje', hint: 'Interés por aprender y mejorar', self: [
    'Me esforcé por aprender los temas de la clase.',
    'Corregí mi trabajo a partir de las sugerencias recibidas.',
    'Relacioné lo aprendido con otras situaciones.',
  ], peer: [
    'Mi compañero se esforzó por aprender los temas de la clase.',
    'Mi compañero mejoró su trabajo a partir de las sugerencias.',
    'Mi compañero relacionó lo aprendido con otras situaciones.',
  ] },
  { id: 'calidad', name: 'Calidad del trabajo', hint: 'Cuida lo que entrega', self: [
    'Mi trabajo fue completo y ordenado.',
    'Revisé mi trabajo antes de entregarlo.',
    'Seguí las instrucciones dadas.',
  ], peer: [
    'El trabajo de mi compañero fue completo y ordenado.',
    'Mi compañero revisó su trabajo antes de entregarlo.',
    'Mi compañero siguió las instrucciones dadas.',
  ] },
  { id: 'creatividad', name: 'Creatividad', hint: 'Propone ideas nuevas', self: [
    'Propuse ideas nuevas u originales.',
    'Busqué formas distintas de resolver las tareas.',
  ], peer: [
    'Mi compañero propuso ideas nuevas u originales.',
    'Mi compañero buscó formas distintas de resolver las tareas.',
  ] },
  { id: 'pensamiento', name: 'Pensamiento crítico', hint: 'Analiza y argumenta', self: [
    'Justifiqué mis respuestas con argumentos.',
    'Analicé la información antes de sacar conclusiones.',
  ], peer: [
    'Mi compañero justificó sus respuestas con argumentos.',
    'Mi compañero analizó la información antes de sacar conclusiones.',
  ] },
  { id: 'liderazgo', name: 'Liderazgo', hint: 'Orienta y motiva al grupo', self: [
    'Ayudé a organizar al grupo para cumplir la meta.',
    'Animé a mis compañeros a participar.',
  ], peer: [
    'Mi compañero ayudó a organizar al grupo para cumplir la meta.',
    'Mi compañero animó a los demás a participar.',
  ] },
  { id: 'honestidad', name: 'Honestidad', hint: 'Actúa con transparencia', self: [
    'Presenté un trabajo hecho por mí, sin copiar.',
    'Reconocí con sinceridad lo que no hice.',
  ], peer: [
    'Mi compañero presentó un trabajo propio, sin copiar.',
    'Mi compañero reconoció con sinceridad lo que no hizo.',
  ] },
]

export const DEFAULT_ASPECTS = ['responsabilidad', 'colaboracion', 'comunicacion', 'respeto']

/** Preguntas de ejemplo para los aspectos elegidos. Un aspecto propio (sin banco) trae preguntas
 * en blanco para que el docente las escriba. */
export function questionsFromAspects(aspects: Array<{ name: string; id?: string }>, type: EvaluatorType, perAspect: number, min = 1, max = 5): DraftCriterion[] {
  const rows: Array<{ name: string; description: string }> = []
  for (const aspect of aspects) {
    const bank = ASPECTS.find(a => a.id === aspect.id)
    const statements = bank ? (type === 'PEER' ? bank.peer : bank.self) : []
    for (let i = 0; i < perAspect; i++) rows.push({ name: aspect.name, description: statements[i] ?? '' })
  }
  const weights = evenWeights(rows.length)
  return rows.map((r, i) => ({ ...r, weight: weights[i], levels: blankLevels(min, max) }))
}

/** Pistas de que una pregunta de coevaluación quedó escrita para el mismo estudiante. */
// `\b` no reconoce letras con tilde, por eso los límites se escriben a mano.
const END = String.raw`(?=[\s.,;:!?]|$)`
const FIRST_PERSON = new RegExp(String.raw`(^|\s)(yo|me|conmigo|mí)${END}|(^|\s)mis?\s+(?!compañer)`, 'i')
const FIRST_PERSON_VERB = new RegExp(String.raw`^\s*(cumplí|entregué|participé|aporté|ayudé|respeté|trabajé|escuché|organicé|expresé|propuse|traje|hice|asumí)${END}`, 'i')
export function looksFirstPerson(statement: string): boolean {
  const s = statement.trim()
  if (!s || /compañer|(^|\s)(su|sus|él|ella)(?=[\s.,;:!?]|$)/i.test(s)) return false
  return FIRST_PERSON.test(s) || FIRST_PERSON_VERB.test(s)
}

/** La misma pregunta del catálogo en la otra voz (autoevaluación ↔ coevaluación), si existe. */
export function mirrorStatement(statement: string, to: EvaluatorType): string {
  const s = statement.trim()
  for (const a of ASPECTS) {
    const from = to === 'PEER' ? a.self : a.peer
    const target = to === 'PEER' ? a.peer : a.self
    const i = from.indexOf(s)
    if (i >= 0) return target[i]
  }
  return ''
}
