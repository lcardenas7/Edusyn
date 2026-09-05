/**
 * Glosario único del Aula Virtual.
 *
 * Regla del rediseño (docs/REDISENO_AULA_VIRTUAL.md §5.5): **un solo nombre por concepto**.
 * La auditoría encontró tres nombres para el mismo estado ("Devuelto" / "Para revisar" /
 * "Devueltas") y cuatro para el mismo tipo ("En Línea" / "Live Quiz" / "⚡ Live Quiz").
 * Aquí se decide de una vez; nadie más escribe estas etiquetas a mano.
 *
 * También es el ÚNICO lugar donde viven colores en hex: la identidad de tipo de actividad
 * no es un token del DS porque codifica taxonomía del producto, no jerarquía visual.
 * Ver docs/REDISENO_AULA_VIRTUAL.md §5.4.
 */

// ─── Tipos de actividad ──────────────────────────────────────────────────────

/** Familia visual de un tipo: decide glifo, color y orden mental. */
export type ActivityFamily =
  | 'tarea'
  | 'quiz'
  | 'examen'
  | 'quiz-vivo'
  | 'quiz-casa'
  | 'icfes'
  | 'leccion'
  | 'juego'
  | 'autoevaluacion'

export interface ActivityTypeMeta {
  /** Etiqueta única, en español, tal como la ve el usuario. */
  label: string
  family: ActivityFamily
  /** Color de identidad del tipo (trazo/acento del glifo). */
  ink: string
  /** Fondo del glifo. Siempre claro: el texto encima es `ink`. */
  wash: string
  /** Una línea que explica el tipo a un docente que no conoce la jerga. */
  hint: string
}

const TYPE_META: Record<ActivityFamily, ActivityTypeMeta> = {
  tarea: {
    label: 'Tarea',
    family: 'tarea',
    ink: '#2E6BE6',
    wash: '#EAF1FE',
    hint: 'El estudiante entrega un trabajo (texto, archivo o audio).',
  },
  quiz: {
    label: 'Quiz',
    family: 'quiz',
    ink: '#7C5CFF',
    wash: '#F1EEFF',
    hint: 'Preguntas con calificación automática.',
  },
  examen: {
    label: 'Examen',
    family: 'examen',
    ink: '#C2385B',
    wash: '#FCEBF0',
    hint: 'Evaluación formal, normalmente con tiempo límite.',
  },
  'quiz-vivo': {
    label: 'Quiz en vivo',
    family: 'quiz-vivo',
    ink: '#D2691E',
    wash: '#FDF0E4',
    hint: 'Todo el curso responde a la vez, en clase, desde su dispositivo.',
  },
  'quiz-casa': {
    label: 'Quiz en casa',
    family: 'quiz-casa',
    ink: '#B0479B',
    wash: '#FBEBF8',
    hint: 'Mismo formato del quiz en vivo, pero cada quien lo resuelve por su cuenta.',
  },
  icfes: {
    label: 'Simulacro ICFES',
    family: 'icfes',
    ink: '#0E9F8E',
    wash: '#E4F6F3',
    hint: 'Prueba con la estructura del examen de Estado.',
  },
  leccion: {
    label: 'Lección',
    family: 'leccion',
    ink: '#5B4BC4',
    wash: '#EEECFB',
    hint: 'Contenido interactivo con diapositivas, actividades y puntos de control.',
  },
  juego: {
    label: 'Juego',
    family: 'juego',
    ink: '#E08A1E',
    wash: '#FDF3E2',
    hint: 'Actividad autocontenida para practicar: sopa, crucigrama, memory…',
  },
  autoevaluacion: {
    label: 'Autoevaluación',
    family: 'autoevaluacion',
    ink: '#0E8A9F',
    wash: '#E4F4F8',
    hint: 'El estudiante valora su propio desempeño.',
  },
}

/** enum del backend → familia visual. Cualquier cosa desconocida cae en tarea. */
const FAMILY_OF_TYPE: Record<string, ActivityFamily> = {
  TASK: 'tarea',
  QUIZ: 'quiz',
  EXAM: 'examen',
  LIVE_QUIZ: 'quiz-vivo',
  HOME_QUIZ: 'quiz-casa',
  ICFES_SIMULATOR: 'icfes',
  LESSON: 'leccion',
  GAME: 'juego',
  SELF_ASSESSMENT: 'autoevaluacion',
}

export function familyOfType(type: string | undefined | null): ActivityFamily {
  if (!type) return 'tarea'
  return FAMILY_OF_TYPE[type] ?? 'tarea'
}

/**
 * Metadatos de presentación de un tipo. Nunca devuelve el enum crudo: la auditoría
 * encontró que `getMaterialLabel` dejaba escapar "VIDEO_UPLOAD" literal a la pantalla.
 */
export function activityTypeMeta(type: string | undefined | null): ActivityTypeMeta {
  return TYPE_META[familyOfType(type)]
}

/** Igual que `activityTypeMeta`, pero cuando ya se tiene la familia resuelta. */
export function familyMeta(family: ActivityFamily): ActivityTypeMeta {
  return TYPE_META[family]
}

/** Todas las familias, en el orden en que tienen sentido para un docente. */
export const ALL_FAMILIES: ActivityFamily[] = [
  'tarea',
  'quiz',
  'examen',
  'quiz-vivo',
  'quiz-casa',
  'icfes',
  'leccion',
  'juego',
  'autoevaluacion',
]

/** Nombres de los juegos sueltos (se guardan como GAME + metadata.gameType). */
const GAME_LABELS: Record<string, string> = {
  WORDSEARCH: 'Sopa de letras',
  CROSSWORD: 'Crucigrama',
  MEMORY: 'Memory',
  LABEL_IMAGE: 'Etiquetar imagen',
  PUZZLE: 'Rompecabezas',
  FLASHCARDS: 'Flashcards',
}

/**
 * Etiqueta que se muestra al usuario. Para un juego prefiere su nombre concreto
 * ("Crucigrama") sobre la categoría ("Juego"): es más informativo y más apetecible.
 */
export function activityTypeLabel(type: string | undefined | null, metadata?: { gameType?: string } | null): string {
  const gameType = metadata?.gameType
  if (familyOfType(type) === 'juego' && gameType && GAME_LABELS[gameType]) return GAME_LABELS[gameType]
  return activityTypeMeta(type).label
}

// ─── Tipos de material ───────────────────────────────────────────────────────

const MATERIAL_LABELS: Record<string, string> = {
  DOCUMENT: 'Documento',
  VIDEO_YOUTUBE: 'Video',
  VIDEO_UPLOAD: 'Video',
  LINK: 'Enlace',
  TEXT: 'Texto',
  IMAGE: 'Imagen',
}

/** Etiqueta de un material. Nunca deja escapar el enum crudo (hallazgo G2). */
export function materialTypeLabel(type: string | undefined | null): string {
  if (!type) return 'Recurso'
  return MATERIAL_LABELS[type] ?? 'Recurso'
}

// ─── Estados ─────────────────────────────────────────────────────────────────

/** Lo que ve el ESTUDIANTE sobre su propio trabajo. */
export type StudentState =
  | 'bloqueada'
  | 'no-abierta'
  | 'devuelta'
  | 'vencida'
  | 'vence-hoy'
  | 'vence-pronto'
  | 'en-borrador'
  | 'pendiente'
  | 'entregada'
  | 'calificada'

/** Lo que ve el DOCENTE sobre la actividad. */
export type TeacherState =
  | 'por-calificar'
  | 'vence-hoy'
  | 'vencida-sin-entregas'
  | 'borrador'
  | 'programada'
  | 'publicada'

export type StateTone = 'urgente' | 'atencion' | 'progreso' | 'listo' | 'neutro'

export interface StateMeta {
  label: string
  tone: StateTone
  /** Frase corta que explica el estado. Se usa en tooltip y en la leyenda. */
  hint: string
}

const STUDENT_STATE: Record<StudentState, StateMeta> = {
  bloqueada: { label: 'Bloqueada', tone: 'neutro', hint: 'Se abre cuando cumplas lo que pide.' },
  'no-abierta': { label: 'Aún no abre', tone: 'neutro', hint: 'Podrás entrar en la fecha de apertura.' },
  devuelta: { label: 'Devuelta', tone: 'atencion', hint: 'Tu profe te pidió corregir y volver a entregar.' },
  vencida: { label: 'Vencida', tone: 'urgente', hint: 'Pasó la fecha de entrega.' },
  'vence-hoy': { label: 'Vence hoy', tone: 'urgente', hint: 'Se cierra hoy.' },
  'vence-pronto': { label: 'Vence pronto', tone: 'atencion', hint: 'Quedan menos de dos días.' },
  'en-borrador': { label: 'Sin enviar', tone: 'atencion', hint: 'La empezaste pero no la has enviado.' },
  pendiente: { label: 'Pendiente', tone: 'progreso', hint: 'Todavía no la has hecho.' },
  entregada: { label: 'Entregada', tone: 'listo', hint: 'Ya la enviaste; falta que la califiquen.' },
  calificada: { label: 'Calificada', tone: 'listo', hint: 'Ya tiene nota.' },
}

const TEACHER_STATE: Record<TeacherState, StateMeta> = {
  'por-calificar': { label: 'Por calificar', tone: 'urgente', hint: 'Hay entregas esperando tu nota.' },
  'vence-hoy': { label: 'Vence hoy', tone: 'atencion', hint: 'Se cierra hoy para los estudiantes.' },
  'vencida-sin-entregas': { label: 'Sin entregas', tone: 'atencion', hint: 'Venció y nadie entregó.' },
  borrador: { label: 'Borrador', tone: 'neutro', hint: 'Los estudiantes todavía no la ven.' },
  programada: { label: 'Programada', tone: 'progreso', hint: 'Se publicará sola en la fecha fijada.' },
  publicada: { label: 'Publicada', tone: 'listo', hint: 'Visible para los estudiantes.' },
}

export function studentStateMeta(s: StudentState): StateMeta {
  return STUDENT_STATE[s]
}

export function teacherStateMeta(s: TeacherState): StateMeta {
  return TEACHER_STATE[s]
}

/**
 * Estado de una ENTREGA concreta (lo usa el docente al revisar).
 * Mismo criterio de nombres: femenino, porque el sujeto es "la entrega".
 */
const SUBMISSION_STATE: Record<string, StateMeta> = {
  DRAFT: { label: 'Sin enviar', tone: 'neutro', hint: 'El estudiante la empezó pero no la envió.' },
  SUBMITTED: { label: 'Entregada', tone: 'progreso', hint: 'Esperando calificación.' },
  LATE: { label: 'Entregada tarde', tone: 'atencion', hint: 'Llegó después de la fecha límite.' },
  GRADED: { label: 'Calificada', tone: 'listo', hint: 'Ya tiene nota.' },
  AUTO_GRADED: { label: 'Calificada', tone: 'listo', hint: 'La calificó el sistema automáticamente.' },
  RETURNED: { label: 'Devuelta', tone: 'atencion', hint: 'Se le pidió corregir y volver a entregar.' },
}

export function submissionStateMeta(status: string | undefined | null): StateMeta {
  if (!status) return { label: 'Sin entregar', tone: 'neutro', hint: 'Todavía no hay entrega.' }
  return SUBMISSION_STATE[status] ?? { label: 'Sin entregar', tone: 'neutro', hint: 'Todavía no hay entrega.' }
}

/** Clases Tailwind del chip según el tono. Un solo lugar → un solo aspecto. */
export const TONE_CLASSES: Record<StateTone, string> = {
  urgente: 'bg-danger-50 text-danger-700 border-danger-100',
  atencion: 'bg-warning-50 text-warning-700 border-warning-100',
  progreso: 'bg-accent/10 text-accent border-accent/20',
  listo: 'bg-success-50 text-success-700 border-success-100',
  neutro: 'bg-surface-2 text-ink-secondary border-hairline',
}
