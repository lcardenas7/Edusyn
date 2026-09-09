/**
 * Base de conocimiento interna de Valeria.
 *
 * Actúa como filtro previo al LLM: resuelve la intención del docente contra los
 * flujos reales de Edusyn ANTES de llamar al proveedor de IA. Sirve para dos cosas:
 *
 * 1. Fundamentar al LLM (el flujo verificado entra en el prompt como verdad).
 * 2. Responder bien cuando la IA no está disponible o falla, en vez de caer en un
 *    texto genérico de "modo básico".
 *
 * La comparación es insensible a tildes: un docente escribe "observación" y
 * "calificación" con acento, y las claves aquí se normalizan igual que la pregunta.
 */

export interface ValeriaTopic {
  id: string;
  title: string;
  /** Señales que apuntan al tema (valen 1 punto). */
  keywords: string[];
  /** Señales inequívocas del tema (valen 3 puntos; bastan por sí solas). */
  strongKeywords?: string[];
  /** Prefijos de currentPath que refuerzan el tema (2 puntos). */
  paths?: string[];
  /** Respuesta lista para mostrar cuando no hay LLM disponible. */
  answer: string;
  keyPoints: string[];
  nextSteps?: string[];
  /** Matices que el LLM debe respetar aunque redacte con sus propias palabras. */
  notes?: string[];
}

export interface ValeriaTopicMatch {
  topic: ValeriaTopic;
  score: number;
}

/**
 * Minúsculas, sin tildes y sin puntuación. "¿Cómo registro una observación?"
 * queda como "como registro una observacion".
 */
export function normalizeQuery(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const VALERIA_TOPICS: ValeriaTopic[] = [
  {
    id: 'aprendizajes-evidencias',
    title: 'Aprendizajes y Evidencias',
    strongKeywords: ['aprendizaje', 'evidencia', 'desempeno', 'indicador'],
    keywords: ['banco de aprendizajes', 'agregar evidencia', 'descriptor', 'competencia'],
    paths: ['/achievements', '/students/achievements'],
    answer: `Para registrar un **aprendizaje** y sus **evidencias**:\n\n1. Abre **Aprendizajes y Evidencias** y selecciona **grupo, asignatura y período**.\n2. Crea o elige el **Aprendizaje** (desempeño): expresa **QUÉ** se espera que el estudiante desarrolle.\n   _Ejemplo: "Comprende y aplica la lógica de algoritmos"._\n3. Dentro de ese aprendizaje usa **"Agregar evidencia"**: expresa **CÓMO** se comprueba.\n   _Ejemplo: "Diseña algoritmos con estructuras condicionales"._\n4. **Guarda** cada cambio. Quedan disponibles para la valoración y, según la configuración, para el boletín.\n\nPuedes reutilizar textos desde el **Banco de Aprendizajes** o duplicarlos hacia otros grupos de la misma asignatura.`,
    keyPoints: [
      'El aprendizaje dice QUÉ se espera; la evidencia dice CÓMO se comprueba',
      'Las evidencias pertenecen al aprendizaje, no se registran como nota aparte',
      'El Banco de Aprendizajes permite reutilizar y duplicar entre grupos',
    ],
    nextSteps: [
      'Si no aparece "Agregar evidencia", pide a coordinación que habilite el modelo Aprendizajes + Evidencias',
    ],
    notes: [
      'La configuración institucional define si se usa solo Aprendizajes o Aprendizajes + Evidencias, qué aparece en el boletín y si la valoración cualitativa ocurre por aprendizaje o por evidencia.',
      'Nunca llames "logro" a un aprendizaje: el módulo se llama Aprendizajes y Evidencias.',
    ],
  },
  {
    id: 'notas',
    title: 'Notas y calificaciones',
    strongKeywords: ['nota', 'calificacion', 'planilla', 'valoracion'],
    keywords: ['promedio', 'componente', 'cognitivo', 'procedimental', 'actitudinal', 'escala', 'recuperacion', 'nivelacion'],
    paths: ['/grades', '/notas'],
    answer: `Para registrar **notas**:\n\n1. Abre **Notas** y selecciona **grupo, asignatura y período**.\n2. Registra la valoración en los **componentes o actividades** disponibles según la configuración de tu institución.\n3. **Guarda**. El sistema calcula los resultados conforme a la escala y los pesos definidos por la institución.\n\nClassroom puede alimentar actividades hacia la planilla, pero **el docente debe revisar** antes de que una calificación quede registrada.`,
    keyPoints: [
      'Siempre se trabaja por grupo, asignatura y período',
      'La escala y los pesos los define la configuración institucional',
      'Lo que llega desde Classroom requiere revisión docente',
    ],
    notes: [
      'Nunca recomiendes alterar una calificación oficial sin revisión humana.',
    ],
  },
  {
    id: 'asistencia',
    title: 'Asistencia',
    strongKeywords: ['asistencia', 'inasistencia'],
    keywords: ['ausente', 'tardanza', 'excusa', 'presente', 'llegada tarde', 'fallas'],
    paths: ['/attendance', '/asistencia'],
    answer: `Para registrar **asistencia**:\n\n1. Abre **Asistencia** y selecciona **grupo y fecha**.\n2. Marca a cada estudiante como **Presente, Ausente, Tardanza o Excusa**.\n3. **Guarda** el registro.\n4. Después puedes consultar **reportes y alertas** por estudiante o por grupo.`,
    keyPoints: [
      'El registro es por grupo y fecha',
      'Los reportes y alertas se consultan después de guardar',
    ],
  },
  {
    id: 'observador',
    title: 'Observador del Estudiante y convivencia',
    strongKeywords: ['observacion', 'observador', 'convivencia'],
    keywords: ['seguimiento', 'comportamiento', 'disciplina', 'compromiso', 'citacion', 'remision', 'acta'],
    paths: ['/observer', '/students/observer'],
    answer: `Para registrar una **observación**:\n\n1. Abre **Observador del Estudiante** y selecciona **grupo y estudiante**.\n2. Crea la observación con **tipo/categoría, descripción** y el **seguimiento** cuando aplique.\n3. **Guarda**. Queda en el historial del estudiante.\n4. Desde ahí puedes consultar el **resumen individual**, notificar a la familia y revisar el **informe convivencial**.`,
    keyPoints: [
      'La observación queda en el historial del estudiante',
      'Se puede notificar a la familia desde el mismo módulo',
    ],
    nextSteps: [
      'Para actas, compromisos, citaciones, remisiones o medidas pedagógicas, coordina con la instancia correspondiente según tus permisos',
    ],
  },
  {
    id: 'boletines',
    title: 'Reportes y boletines',
    strongKeywords: ['boletin', 'informe academico'],
    keywords: ['reporte', 'informe', 'puesto', 'consolidado', 'certificado', 'insight', 'pdf'],
    paths: ['/reports', '/report-cards'],
    answer: `Los **boletines y reportes** se consultan por **período, grupo o estudiante**:\n\n1. Abre **Reportes / Boletines**.\n2. Selecciona **período** y luego **grupo** o **estudiante**.\n3. Genera el informe (individual o masivo).\n\nIntegran, según la configuración y disponibilidad: notas, aprendizajes y evidencias, asistencia y observaciones.`,
    keyPoints: [
      'El boletín refleja lo ya registrado: si falta información, se corrige en su módulo de origen',
      'El formato del boletín depende de la plantilla configurada por la institución',
    ],
    notes: [
      'La información del reporte es apoyo a la decisión, no reemplaza el criterio del rector, coordinador o docente.',
    ],
  },
  {
    id: 'classroom',
    title: 'Classroom y actividades',
    strongKeywords: ['classroom', 'aula virtual', 'quiz', 'leccion'],
    keywords: ['actividad', 'examen', 'cuestionario', 'live quiz', 'quiz en casa', 'guia', 'tarea', 'publicar', 'borrador'],
    paths: ['/classroom'],
    answer: `En **Classroom** el flujo para crear una actividad es:\n\n1. Entra al **aula** y crea la actividad en **borrador**.\n2. Define **instrucciones, fechas y tipo** (tarea, quiz, examen, guía o lección).\n3. Agrega **preguntas o contenido**.\n4. **Revisa** y luego **publica o programa**.\n\nLos quizzes y exámenes pueden usarse como borrador, **Live Quiz** (en tiempo real) o **Quiz en Casa** (a su ritmo, con fecha límite).`,
    keyPoints: [
      'Siempre nace como borrador y se publica cuando está listo',
      'Live Quiz es en tiempo real; Quiz en Casa tiene fecha límite',
    ],
    nextSteps: [
      'Si quieres que yo redacte las preguntas, pídemelo explícitamente: "crea un quiz de N preguntas sobre X"',
    ],
  },
  {
    id: 'rutas',
    title: 'Rutas de aprendizaje',
    strongKeywords: ['ruta de aprendizaje', 'rutas de aprendizaje'],
    keywords: ['ruta', 'pasos', 'itinerario'],
    answer: `Dentro de **Classroom** puedes crear una **ruta de aprendizaje** por competencia:\n\n1. Entra al aula y abre **Rutas de aprendizaje**.\n2. Crea la ruta y define la **competencia** que persigue.\n3. Organiza los **pasos** en orden.\n4. **Vincula** actividades o lecciones a cada paso.\n\nLa ruta muestra el proceso de aprendizaje del estudiante; no reemplaza la revisión docente.`,
    keyPoints: ['La ruta organiza el proceso; la valoración sigue siendo del docente'],
  },
  {
    id: 'expedicion',
    title: 'Expedición ABP',
    strongKeywords: ['expedicion', 'abp', 'aprendizaje basado en proyectos'],
    keywords: ['proyecto', 'equipos', 'mision', 'reto', 'entrega'],
    answer: `En **Expedición (ABP)**, desde el aula:\n\n1. Crea la **expedición** con su **reto**.\n2. Arma los **equipos** y define las **misiones**.\n3. Los equipos organizan tareas, añaden recursos y **entregan evidencias** (enlace o archivo).\n4. Tú **revisas, retroalimentas** y puedes solicitar ajustes antes de aprobar.`,
    keyPoints: ['El avance por fases está condicionado a la validación docente'],
  },
  {
    id: 'inclusion',
    title: 'Inclusión y acompañamiento pedagógico',
    strongKeywords: ['piar', 'apd', 'inclusion'],
    keywords: ['acompanamiento', 'ajuste razonable', 'plan de apoyo', 'necesidad educativa', 'barrera'],
    paths: ['/differential-support', '/pedagogical-support'],
    answer: `Si el módulo está habilitado, el flujo de **inclusión** es:\n\n1. Crea el **perfil de acompañamiento** del estudiante.\n2. Crea el **plan (APD o PIAR)** asociado.\n3. Registra **objetivos, estrategias, ajustes, actividades, participantes y documentos**.\n4. Actualiza el **progreso** periódicamente.`,
    keyPoints: [
      'Primero el perfil del estudiante, después el plan',
      'La decisión pedagógica es del equipo interdisciplinario',
    ],
    notes: [
      'Son datos sensibles: no sugieras conclusiones diagnósticas ni decisiones que correspondan al equipo interdisciplinario.',
    ],
  },
  {
    id: 'comunicaciones',
    title: 'Comunicaciones',
    strongKeywords: ['comunicado', 'comunicacion institucional'],
    keywords: ['circular', 'notificar familia', 'mensaje a padres', 'destinatarios'],
    paths: ['/communications'],
    answer: `En **Comunicaciones**:\n\n1. Redacta el comunicado.\n2. Define los **destinatarios**.\n3. Revisa **audiencia, contenido y fecha**.\n4. Envía.\n\nPuedo ayudarte a redactarlo, pero el envío lo confirmas tú.`,
    keyPoints: ['Revisa siempre la audiencia antes de enviar'],
  },
  {
    id: 'academico',
    title: 'Configuración académica',
    strongKeywords: ['ano lectivo', 'periodo academico', 'plan de estudios', 'carga academica'],
    keywords: ['periodo', 'escala de valoracion', 'area', 'asignatura', 'grado', 'nivel', 'configuracion academica'],
    paths: ['/academic', '/academic-catalog', '/academic-load'],
    answer: `La **configuración académica** se hace una vez por año lectivo, normalmente desde administración o coordinación:\n\n1. Define **año lectivo** y **períodos**.\n2. Define la **escala de valoración**.\n3. Configura **niveles/grados, áreas y asignaturas**.\n4. Arma el **plan de estudios** y la **carga académica** (qué docente dicta qué).\n\nDespués de eso ya se puede matricular estudiantes y registrar información.`,
    keyPoints: [
      'Sin períodos y escala configurados, los demás módulos no pueden registrar valoraciones',
      'La visibilidad de esta configuración depende de tu rol',
    ],
  },
  {
    id: 'matricula',
    title: 'Estudiantes y matrícula',
    // Raíz, no palabras completas: la tolerancia de sufijo cubre «matricula», «matricular»,
    // «matriculo» y «matriculacion» de una vez. Con las formas completas, «¿Cómo matriculo
    // un estudiante?» no encontraba el tema.
    strongKeywords: ['matricul'],
    keywords: ['estudiante', 'alumno', 'traslado', 'retiro', 'cambio de grupo', 'importar estudiantes'],
    paths: ['/enrollments', '/students'],
    answer: `Para **matricular o gestionar estudiantes**:\n\n1. Abre **Estudiantes / Matrículas**.\n2. Crea el estudiante o impórtalo, y asígnale **grado y grupo** del año lectivo activo.\n3. Guarda: desde ahí queda disponible en notas, asistencia, observador y reportes.\n\nPara traslados o cambios de grupo, hazlo desde la ficha del estudiante para que el historial quede consistente.`,
    keyPoints: [
      'El estudiante debe estar matriculado en el año lectivo activo para aparecer en los demás módulos',
      'Los cambios de grupo se hacen desde la ficha, no borrando y recreando',
    ],
  },
  {
    id: 'finanzas',
    title: 'Finanzas',
    strongKeywords: ['cartera', 'factura', 'recibo', 'pago'],
    keywords: ['finanzas', 'cobro', 'pension', 'egreso', 'obligacion', 'tercero'],
    answer: `El flujo de **Finanzas** es:\n\n1. Define **terceros, categorías y conceptos de cobro**.\n2. Crea las **obligaciones**.\n3. Registra **pagos** o **egresos**.\n4. Consulta **cartera, recibos, facturas y reportes**.`,
    keyPoints: ['Cada paso depende del anterior: sin concepto de cobro no hay obligación'],
    notes: [
      'No afirmes que un pago quedó aplicado ni des instrucciones para anularlo sin que el usuario confirme el caso concreto.',
    ],
  },
  {
    id: 'espacio-docente',
    title: 'Mi Espacio Docente',
    strongKeywords: ['espacio docente', 'mi espacio'],
    keywords: ['bitacora', 'calendario', 'recaudo', 'recursos del docente'],
    answer: `**Mi Espacio Docente** te sirve para organizar tu trabajo: espacios de curso, calendario, seguimientos, bitácora, recaudo, roles y recursos.\n\nEs tu espacio de organización personal; para procesos formales de convivencia, el lugar indicado sigue siendo el **Observador del Estudiante**.`,
    keyPoints: ['Es organización del docente, no un registro institucional formal'],
  },
  {
    id: 'plataforma',
    title: 'Qué es Edusyn / qué puedo hacer',
    strongKeywords: ['que es edusyn', 'que puedo hacer', 'funcionalidades', 'que sabes hacer', 'en que me puedes ayudar'],
    keywords: ['edusyn', 'plataforma', 'modulos'],
    answer: `Edusyn es la plataforma donde tu institución gestiona el proceso académico. Desde el menú lateral trabajas:\n\n• **Académico**: año lectivo, períodos, escala, áreas, asignaturas y carga docente\n• **Estudiantes**: matrícula y fichas\n• **Notas**: valoraciones por grupo, asignatura y período\n• **Aprendizajes y Evidencias**: qué se espera del estudiante y cómo se comprueba\n• **Asistencia**: registro diario, reportes y alertas\n• **Classroom**: actividades, quizzes, lecciones y rutas\n• **Observador**: observaciones y convivencia\n• **Reportes y boletines**\n• **Comunicaciones** y **Finanzas**\n\nLo que ves depende de tu rol y de los módulos habilitados por tu institución.`,
    keyPoints: ['El menú cambia según el rol y los módulos habilitados'],
    nextSteps: ['Dime en qué pantalla estás y te doy el flujo exacto de esa ruta'],
  },
  {
    id: 'saludo',
    title: 'Saludo',
    strongKeywords: ['hola', 'buenos dias', 'buenas tardes', 'buenas noches', 'saludos'],
    keywords: [],
    answer: `¡Hola! Soy **Valeria**, tu asistente en Edusyn.\n\nPuedo explicarte los flujos de la plataforma —notas, aprendizajes y evidencias, asistencia, observador, Classroom, boletines— y ayudarte a preparar actividades.\n\n¿Con qué te ayudo?`,
    keyPoints: [],
  },
];

const SUFFIX_TOLERANCE = 3;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Coincidencia por palabra completa, tolerando plurales y flexiones cortas. */
function containsTerm(haystack: string, rawTerm: string): boolean {
  const term = normalizeQuery(rawTerm);
  if (!term) return false;
  const tolerance = term.length >= 4 ? SUFFIX_TOLERANCE : 0;
  const pattern = new RegExp(`(^| )${escapeRegex(term)}[a-z]{0,${tolerance}}( |$)`);
  return pattern.test(haystack);
}

function scoreTopic(topic: ValeriaTopic, haystack: string, path: string): number {
  let score = 0;
  for (const keyword of topic.strongKeywords || []) {
    if (containsTerm(haystack, keyword)) score += 3;
  }
  for (const keyword of topic.keywords) {
    if (containsTerm(haystack, keyword)) score += 1;
  }
  if (path && (topic.paths || []).some((prefix) => path.startsWith(prefix))) {
    score += 2;
  }
  return score;
}

/**
 * Resuelve el tema interno de Edusyn al que apunta la pregunta.
 * Devuelve undefined cuando la consulta no es sobre la plataforma
 * (ahí Valeria debe responder como chat normal).
 */
export function matchValeriaTopic(
  question: string,
  context?: { currentPath?: string; pageName?: string },
): ValeriaTopicMatch | undefined {
  const haystack = normalizeQuery(question);
  if (!haystack) return undefined;

  const path = (context?.currentPath || '').toLowerCase();
  let best: ValeriaTopicMatch | undefined;

  for (const topic of VALERIA_TOPICS) {
    const score = scoreTopic(topic, haystack, path);
    if (score >= 2 && (!best || score > best.score)) {
      best = { topic, score };
    }
  }

  return best;
}

/** Flujo verificado que se inyecta al LLM como verdad de la plataforma. */
export function buildTopicGrounding(topic: ValeriaTopic): string {
  return [
    `FLUJO VERIFICADO DE EDUSYN — ${topic.title}:`,
    topic.answer,
    topic.keyPoints.length ? `Puntos clave: ${topic.keyPoints.join(' | ')}` : '',
    (topic.notes || []).length ? `Restricciones: ${(topic.notes || []).join(' ')}` : '',
    'Responde apoyándote en este flujo. Puedes redactarlo con tus palabras y adaptarlo al contexto del docente, pero no inventes pasos, botones ni menús distintos a los descritos.',
  ]
    .filter(Boolean)
    .join('\n');
}
