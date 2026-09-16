/** Guía de lectura de cada archivo del proyecto: una anatomía mínima (qué significa cada
 * parte de una línea típica) y preguntas para que el equipo razone sobre SU código. Es
 * contenido fijo, no un análisis del proyecto: no señala posiciones en el código del
 * estudiante, así que nunca afirma algo que el código real no diga. */
export interface FileGuidePart {
  /** Fragmento del ejemplo, en el orden en que aparece. */
  text: string
  /** Nombre de la parte; ausente en la puntuación que solo une el ejemplo. */
  name?: string
  meaning?: string
}

export interface FileGuide {
  idea: string
  example: FileGuidePart[]
  questions: string[]
}

export const FILE_GUIDES: Record<'html' | 'css' | 'js', FileGuide> = {
  html: {
    idea: 'Cada etiqueta crea una pieza de la página. Lo que va entre la etiqueta de apertura y la de cierre es lo que se ve.',
    example: [
      { text: '<button', name: 'Etiqueta', meaning: 'Qué pieza es: aquí, un botón.' },
      { text: ' ' },
      { text: 'id="agregar"', name: 'Atributo id', meaning: 'Un nombre único para que el CSS o el JavaScript lo encuentren.' },
      { text: '>' },
      { text: 'Agregar tarea', name: 'Contenido', meaning: 'El texto que el usuario lee en pantalla.' },
      { text: '</button>', name: 'Cierre', meaning: 'Dónde termina la pieza.' },
    ],
    questions: [
      '¿Qué etiqueta usaron para el título y cuál para los botones?',
      '¿Qué piezas tienen un id? ¿Quién las busca por ese nombre?',
    ],
  },
  css: {
    idea: 'Cada regla dice a qué piezas afecta y cómo deben verse. Se lee: “a estas piezas, ponles esta propiedad con este valor”.',
    example: [
      { text: 'button', name: 'Selector', meaning: 'A quién se aplica: a todos los botones.' },
      { text: ' { ' },
      { text: 'background-color', name: 'Propiedad', meaning: 'Qué se cambia: el color de fondo.' },
      { text: ': ' },
      { text: '#2563eb', name: 'Valor', meaning: 'Cómo queda: azul.' },
      { text: '; }' },
    ],
    questions: [
      '¿Qué regla le da el color a los botones de su app?',
      '¿Hay reglas dentro de @media? ¿En qué pantalla se activan?',
    ],
  },
  js: {
    idea: 'El JavaScript espera a que pase algo (un clic, un envío) y entonces ejecuta una acción que cambia la página.',
    example: [
      { text: 'formulario', name: 'Elemento', meaning: 'La pieza del HTML que se vigila.' },
      { text: '.addEventListener(' },
      { text: '"submit"', name: 'Evento', meaning: 'Cuándo reaccionar: al enviar el formulario.' },
      { text: ', ' },
      { text: 'function () { … }', name: 'Acción', meaning: 'Qué hacer: por ejemplo, crear la tarjeta de la tarea.' },
      { text: ')' },
    ],
    questions: [
      '¿Qué eventos escucha su app? (busquen addEventListener)',
      '¿Qué cambia en la página cuando ocurre cada uno?',
    ],
  },
}
