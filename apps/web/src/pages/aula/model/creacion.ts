/**
 * Qué se puede crear en un aula, ordenado por **intención pedagógica** y no por herramienta.
 * **Lógica pura.**
 *
 * Se conserva el planteamiento del aula actual (`INTENTIONS` en Classroom.tsx, documentado en
 * docs/EXPERIENCIAS_Y_MODULO_ACTIVIDADES.md §3.bis) porque es bueno: un docente piensa "quiero
 * evaluar", no "quiero un HOME_QUIZ".
 *
 * Lo que cambia es que **cada mecánica se explica**. La auditoría señaló que "Evaluar" ofrece
 * seis opciones, tres de ellas variantes de quiz, sin decir en qué se diferencian; elegir a
 * ciegas entre "Quiz", "Quiz en vivo" y "Quiz en casa" es exactamente el tipo de decisión que
 * hace que un docente abandone.
 */

export type Intencion = 'aprender' | 'evaluar' | 'practicar' | 'proyecto'

export interface IntencionMeta {
  id: Intencion
  label: string
  /** Lo que el docente quiere conseguir, dicho como lo diría él. */
  hint: string
}

export const INTENCIONES: IntencionMeta[] = [
  { id: 'aprender', label: 'Enseñar algo', hint: 'Explicar un tema con contenido que el estudiante recorre a su ritmo.' },
  { id: 'evaluar', label: 'Evaluar', hint: 'Medir qué aprendieron, con nota.' },
  { id: 'practicar', label: 'Practicar', hint: 'Repasar jugando, sin la presión de una nota.' },
  { id: 'proyecto', label: 'Pedir un trabajo', hint: 'Que entreguen algo hecho por ellos: un texto, un archivo, un audio.' },
]

export interface MecanicaMeta {
  /** El tipo que espera el backend. `BLOCK_*` son juegos: se guardan como GAME. */
  type: string
  label: string
  /** En qué se diferencia de sus vecinas. Es el dato que hoy falta. */
  hint: string
  /** Tras crearla, dónde se sigue trabajando. */
  siguiente: 'editor-leccion' | 'preguntas' | 'listo'
}

const MECANICAS: Record<Intencion, MecanicaMeta[]> = {
  aprender: [
    {
      type: 'LESSON',
      label: 'Lección interactiva',
      hint: 'Diapositivas con explicaciones, preguntas intercaladas y puntos de control. El estudiante avanza solo.',
      siguiente: 'editor-leccion',
    },
  ],
  evaluar: [
    {
      type: 'QUIZ',
      label: 'Quiz',
      hint: 'Preguntas que se califican solas. Cada quien lo resuelve cuando puede, dentro del plazo.',
      siguiente: 'preguntas',
    },
    {
      type: 'EXAM',
      label: 'Examen',
      hint: 'Como el quiz, pero pensado para una evaluación formal: normalmente con tiempo límite y un solo intento.',
      siguiente: 'preguntas',
    },
    {
      type: 'LIVE_QUIZ',
      label: 'Quiz en vivo',
      hint: 'En clase y todos a la vez: tú controlas el ritmo desde el proyector y ellos responden desde el celular.',
      siguiente: 'preguntas',
    },
    {
      type: 'HOME_QUIZ',
      label: 'Quiz en casa',
      hint: 'El mismo formato del quiz en vivo, pero cada estudiante avanza a su ritmo desde donde esté.',
      siguiente: 'preguntas',
    },
    {
      type: 'ICFES_SIMULATOR',
      label: 'Simulacro ICFES',
      hint: 'Prueba con la estructura del examen de Estado, por competencias.',
      siguiente: 'preguntas',
    },
    {
      type: 'SELF_ASSESSMENT',
      label: 'Autoevaluación',
      hint: 'El propio estudiante valora su desempeño con una rúbrica que tú defines.',
      siguiente: 'listo',
    },
  ],
  practicar: [
    { type: 'BLOCK_WORDSEARCH', label: 'Sopa de letras', hint: 'Tú das la lista de palabras y el estudiante las busca en una cuadrícula.', siguiente: 'editor-leccion' },
    { type: 'BLOCK_CROSSWORD', label: 'Crucigrama', hint: 'Tú das las palabras y sus pistas, y el estudiante arma el crucigrama.', siguiente: 'editor-leccion' },
    { type: 'BLOCK_MEMORY', label: 'Memory', hint: 'Tú das los pares y el estudiante los empareja: concepto con definición, palabra con imagen.', siguiente: 'editor-leccion' },
    { type: 'BLOCK_LABEL_IMAGE', label: 'Etiquetar imagen', hint: 'Tú subes una imagen y marcas los puntos; el estudiante les pone nombre.', siguiente: 'editor-leccion' },
    { type: 'BLOCK_PUZZLE', label: 'Rompecabezas', hint: 'Tú subes una imagen y el estudiante la arma pieza por pieza.', siguiente: 'editor-leccion' },
    { type: 'BLOCK_FLASHCARDS', label: 'Flashcards', hint: 'Tarjetas de dos caras para memorizar vocabulario, fechas o fórmulas repasando.', siguiente: 'editor-leccion' },
  ],
  proyecto: [
    {
      type: 'TASK',
      label: 'Tarea o entrega',
      hint: 'El estudiante escribe una respuesta o sube un archivo, y tú la calificas.',
      siguiente: 'listo',
    },
  ],
}

export function mecanicasDe(intencion: Intencion): MecanicaMeta[] {
  return MECANICAS[intencion]
}

export function mecanicaDe(type: string): MecanicaMeta | null {
  for (const lista of Object.values(MECANICAS)) {
    const m = lista.find((x) => x.type === type)
    if (m) return m
  }
  return null
}

// ─── Qué campos tiene sentido pedir para cada tipo ───────────────────────────

export interface CamposDelTipo {
  /** Se entrega algo, así que hay nota y fecha límite. */
  calificable: boolean
  /** Tiene preguntas: intentos, tiempo, mezclar, mostrar resultados. */
  conPreguntas: boolean
  /** Es una tarea: aceptar entregas tarde, respuesta en audio. */
  esTarea: boolean
}

const SIN_PREGUNTAS = new Set(['TASK', 'LESSON', 'SELF_ASSESSMENT'])

export function camposDe(type: string): CamposDelTipo {
  const esJuego = type.startsWith('BLOCK_')
  return {
    // Un juego de práctica no lleva nota: es repaso, y ponerle nota cambia lo que significa.
    calificable: !esJuego,
    conPreguntas: !esJuego && !SIN_PREGUNTAS.has(type),
    esTarea: type === 'TASK',
  }
}

/**
 * Traduce el tipo del formulario a lo que espera el backend. Los juegos se guardan como GAME
 * con `gameType`, igual que hace el aula actual.
 */
export function aPayloadDeTipo(type: string): { type: string; gameType?: string } {
  if (type.startsWith('BLOCK_')) return { type: 'GAME', gameType: type.slice(6) }
  return { type }
}
