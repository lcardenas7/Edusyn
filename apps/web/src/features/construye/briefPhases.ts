import type { BriefField, BriefPhaseKey } from './journey'

export interface PhaseField { field: BriefField; label: string; hint: string; optional?: boolean; rows?: number }
export interface PhaseConfig {
  key: BriefPhaseKey
  title: string
  question: string
  intro: string
  fields: PhaseField[]
  example: { title: string; lines: string[] }
}

/** Preguntas y ejemplos de cada fase. El ejemplo es de OTRO equipo y de otro tema, para
 * inspirar la forma de pensar sin darles la respuesta. */
export const PHASES: PhaseConfig[] = [
  {
    key: 'problem',
    title: 'El problema',
    question: '¿Qué está pasando?',
    intro: 'Antes de pensar en la app, entiendan bien la situación. Escríbanla con sus propias palabras.',
    fields: [
      { field: 'problem', label: '¿Qué ocurre?', hint: 'Cuéntenlo como se lo explicarían a un compañero nuevo: ¿qué pasa, dónde y cuándo?', rows: 3 },
      { field: 'affected', label: '¿A quién afecta?', hint: 'Piensen en personas concretas. ¿Quiénes lo viven? ¿Cómo se sienten?' },
      { field: 'whyItMatters', label: '¿Por qué vale la pena resolverlo?', hint: '¿Qué mejoraría si esto dejara de pasar?', optional: true },
    ],
    example: {
      title: 'Así lo escribió un equipo que trabajó sobre la tienda escolar',
      lines: [
        'Qué ocurre: en el descanso la fila de la tienda es tan larga que muchos no alcanzan a comprar antes de volver a clase.',
        'A quién afecta: sobre todo a los de primaria, que salen últimos, y a la señora de la tienda, que no da abasto.',
        'Por qué importa: hay estudiantes que pasan la mañana sin comer y eso les quita energía en clase.',
      ],
    },
  },
  {
    key: 'solution',
    title: 'La solución que imaginamos',
    question: '¿Qué vamos a crear?',
    intro: 'Imaginen cómo una página o app podría ayudar. No hace falta saber programar: descríbanla como la contarían.',
    fields: [
      { field: 'solution', label: '¿Qué hará su página o app y cómo ayuda con el problema?', hint: 'Una o dos frases: qué hace y por qué eso ayuda.', rows: 3 },
      { field: 'audience', label: '¿Quién la usará?', hint: '¿Las mismas personas afectadas? ¿Alguien más?' },
      { field: 'screens', label: '¿Cómo se vería?', hint: 'Antes de escribir, dibujen las pantallas en papel. Luego descríbanlas: "una pantalla con…", "un botón para…", "cuando alguien toca…".', optional: true, rows: 3 },
      { field: 'subject', label: 'Asignatura o tema', hint: 'Si el proyecto se relaciona con una materia, cuál.', optional: true, rows: 1 },
    ],
    example: {
      title: 'Ejemplo del equipo de la tienda escolar',
      lines: [
        'Qué hará: una página para pedir antes del descanso, así la tienda prepara los pedidos y la fila avanza más rápido.',
        'Quién la usará: los estudiantes para pedir y la señora de la tienda para ver los pedidos.',
        'Cómo se vería: una lista de productos con su precio, un botón "Pedir" y una pantalla con los pedidos del día.',
      ],
    },
  },
  {
    key: 'plan',
    title: 'Plan de la versión 1',
    question: '¿Qué hacemos primero?',
    intro: 'Una buena primera versión es pequeña: lo mínimo para que alguien la pruebe hoy. Lo demás puede esperar.',
    fields: [
      { field: 'features', label: '¿Qué tendrá la versión 1?', hint: 'Solo lo indispensable. Si la lista es larga, pasen algo a "después".', rows: 3 },
      { field: 'later', label: '¿Qué dejamos para después?', hint: 'Ideas buenas que no caben en la primera versión.', optional: true },
      { field: 'successCheck', label: '¿Cómo sabremos que funciona?', hint: 'Escríbanla como "si… entonces…": "si escribo una tarea y pulso Agregar, entonces aparece en la lista".' },
      { field: 'style', label: 'Estilo visual', hint: 'Cómo quieren que se vea: colores, sensación, a quién debe gustarle.', optional: true, rows: 1 },
    ],
    example: {
      title: 'Ejemplo del equipo de la tienda escolar',
      lines: [
        'Versión 1: ver la lista de productos y agregar un pedido con el nombre del producto.',
        'Para después: pagos, fotos de los productos y avisos cuando el pedido esté listo.',
        'Cómo sabremos que funciona: si escribo "empanada" y pulso Pedir, entonces el pedido aparece en la lista.',
      ],
    },
  },
  {
    key: 'share',
    title: 'Compartir y reflexionar',
    question: '¿Cómo contamos lo que hicimos?',
    intro: 'Preparen una presentación de 2 minutos y piensen en lo que aprendieron. Cuenten el proceso, no solo la app.',
    fields: [
      { field: 'sharePitch', label: 'Nuestra presentación de 2 minutos', hint: 'En este orden: el problema → la solución y por qué la eligieron → qué probaron → qué mejorarían en la siguiente versión.', rows: 5 },
      { field: 'reflection', label: '¿Qué aprendimos?', hint: 'De programar, de trabajar con IA y qué harían diferente si empezaran de nuevo.', rows: 3 },
    ],
    example: {
      title: 'Así lo contó el equipo de la tienda escolar',
      lines: [
        'El problema: en el descanso muchos no alcanzaban a comprar.',
        'La solución: una página para pedir antes; elegimos esta idea porque la tienda puede preparar los pedidos.',
        'Probamos: hicimos 5 pedidos y todos aparecieron; otro equipo nos dijo que el botón no se veía bien.',
        'Mejoraríamos: avisar cuando el pedido esté listo.',
        'Aprendimos: pedirle a la IA una cosa a la vez y revisar el código antes de pegarlo.',
      ],
    },
  },
]

export const phaseConfig = (key: BriefPhaseKey): PhaseConfig => PHASES.find(phase => phase.key === key)!
