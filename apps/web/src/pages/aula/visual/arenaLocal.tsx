/**
 * Banco de pruebas de la Arena — **solo desarrollo**.
 *
 * Se sirve en `/arena-local.html` con `npm run dev` y no entra al build de
 * producción. Monta el componente `Arena` REAL contra un servidor simulado, con
 * la misma técnica que `aulaLocal.tsx`: se sustituye el adaptador de axios, así
 * que ninguna petición sale de la pestaña.
 *
 * El simulacro respeta las reglas del servicio verdadero, que son justamente las
 * que hay que poder ver:
 *  · siete rondas, las mismas preguntas para ambos;
 *  · en los duelos de ruleta cada ronda trae su propia categoría sorteada;
 *  · la respuesta correcta NO viaja hasta que ambos terminan;
 *  · el 50/50 deja dos opciones y se usa una vez por duelo;
 *  · los puntos del ranking son por duelo (3/1/0) más perfecta (+2) y remontada (+1).
 *
 * El interruptor de rol permite ver la pantalla del docente y la del estudiante.
 */

import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import '../../../index.css'
import api from '../../../lib/api'
import { DialogHost } from '../../../components/ui/confirm'
import Arena from '../Arena'

const rol = (localStorage.getItem('demo:arena-rol') as 'docente' | 'estudiante') || 'estudiante'
localStorage.setItem('token', 'token-de-prueba')

// ─── Banco de preguntas de mentira ───────────────────────────────────────────

const TEMAS = ['Ciencias Naturales', 'Matemáticas', 'Lenguaje', 'Geografía', 'Arte y cultura', 'Deportes']

type Pregunta = { id: string; text: string; options: string[]; correctAnswer: string; explanation: string; category: string }

const BANCO: Pregunta[] = TEMAS.flatMap((category, t) =>
  Array.from({ length: 9 }, (_, index) => ({
    id: `${t}-${index}`,
    text: `${category}: pregunta de ejemplo número ${index + 1} para revisar cómo se ve un enunciado de dos renglones en el celular.`,
    options: ['Primera opción', 'Segunda opción', 'Tercera opción', 'Cuarta opción'],
    correctAnswer: 'Segunda opción',
    explanation: 'Explicación breve que solo aparece cuando los dos participantes terminaron el duelo.',
    category,
  })),
)

const COMPANEROS = [
  { id: 'e2', name: 'Camila M.' }, { id: 'e3', name: 'Santiago R.' }, { id: 'e4', name: 'Valentina L.' },
  { id: 'e5', name: 'Mateo G.' }, { id: 'e6', name: 'Isabella P.' }, { id: 'e7', name: 'Samuel T.' },
  { id: 'e8', name: 'Luciana F.' }, { id: 'e9', name: 'Emiliano C.' },
]

// ─── Estado del simulacro ────────────────────────────────────────────────────

type Duelo = {
  id: string; status: string; category: string; selectionMode: string; isInvitee: boolean
  opponent: string; opponentEnrollmentId: string
  questions: Pregunta[]; mine: boolean[]; theirs: boolean[]
  power: { ordinal: number; options: string[] } | null
  swap: [number, number] | null
  createdAt: string
}

const duelos: Duelo[] = []
let siguiente = 1

const azar = (max: number) => Math.floor(Math.random() * max)

/** Mismo sorteo que `rouletteQuestions` del servicio: categoría y luego pregunta. */
function porRuleta(): Pregunta[] {
  const bolsas = new Map(TEMAS.map((tema) => [tema, BANCO.filter((item) => item.category === tema)]))
  const elegidas: Pregunta[] = []
  while (elegidas.length < 7) {
    const disponibles = [...bolsas].filter(([, lista]) => lista.length)
    const [, lista] = disponibles[azar(disponibles.length)]
    elegidas.push(lista.splice(azar(lista.length), 1)[0])
  }
  return elegidas
}

function porTema(tema: string): Pregunta[] {
  const bolsa = tema === 'Mixta' ? [...BANCO] : BANCO.filter((item) => item.category === tema)
  const elegidas: Pregunta[] = []
  while (elegidas.length < 7 && bolsa.length) elegidas.push(bolsa.splice(azar(bolsa.length), 1)[0])
  return elegidas
}

/** Forma exacta del payload que devuelve `DuelService.get`. */
/** Orden propio del jugador: el bono de tema solo reordena sus rondas. */
function secuencia(duelo: Duelo) {
  if (!duelo.swap) return duelo.questions
  const orden = [...duelo.questions]
  const [a, b] = duelo.swap
  ;[orden[a], orden[b]] = [orden[b], orden[a]]
  return orden
}

function estado(duelo: Duelo) {
  const preguntas = secuencia(duelo)
  const total = preguntas.length
  const actual = duelo.status === 'ACTIVE' && duelo.mine.length < total ? preguntas[duelo.mine.length] : null
  const opciones = duelo.power?.ordinal === duelo.mine.length ? duelo.power.options : actual?.options
  return {
    id: duelo.id, classroomId: 'aula-1', status: duelo.status, category: duelo.category,
    selectionMode: duelo.selectionMode, isInvitee: duelo.isInvitee,
    opponent: duelo.opponent, opponentEnrollmentId: duelo.opponentEnrollmentId,
    myProgress: duelo.mine.length, opponentProgress: duelo.theirs.length, total,
    powerAvailable: !duelo.power && !duelo.swap,
    powerCategories: duelo.power || duelo.swap || duelo.status !== 'ACTIVE'
      ? []
      : [...new Set(preguntas.slice(duelo.mine.length + 1).map((q) => q.category))].sort((a, b) => a.localeCompare(b, 'es')),
    question: actual
      ? { ordinal: duelo.mine.length, text: actual.text, options: opciones, category: actual.category, powerApplied: duelo.power?.ordinal === duelo.mine.length }
      : null,
    result: duelo.status === 'COMPLETED'
      ? {
          myScore: duelo.mine.filter(Boolean).length,
          opponentScore: duelo.theirs.filter(Boolean).length,
          review: preguntas.map((question, index) => ({
            text: question.text, correctAnswer: question.correctAnswer, explanation: question.explanation, myCorrect: duelo.mine[index] ?? false,
          })),
        }
      : null,
  }
}

function resumen(duelo: Duelo) {
  return {
    id: duelo.id, status: duelo.status, category: duelo.category, selectionMode: duelo.selectionMode,
    opponent: duelo.opponent, isInvitee: duelo.isInvitee,
    myProgress: duelo.mine.length, opponentProgress: duelo.theirs.length, createdAt: duelo.createdAt,
  }
}

// Un duelo ya terminado y uno pendiente, para ver las tres secciones de la lista.
const terminado: Duelo = {
  id: 'd-hecho', status: 'COMPLETED', category: 'Ruleta', selectionMode: 'ROULETTE', isInvitee: false,
  opponent: 'Santiago R.', opponentEnrollmentId: 'e3', questions: porRuleta(),
  mine: [true, true, false, true, true, false, true], theirs: [true, false, false, true, true, false, true],
  power: null, swap: null, createdAt: new Date(Date.now() - 86_400_000).toISOString(),
}
const invitacion: Duelo = {
  id: 'd-invit', status: 'INVITED', category: 'Ruleta', selectionMode: 'ROULETTE', isInvitee: true,
  opponent: 'Valentina L.', opponentEnrollmentId: 'e4', questions: porRuleta(),
  mine: [], theirs: [], power: null, swap: null, createdAt: new Date(Date.now() - 3_600_000).toISOString(),
}
duelos.push(terminado, invitacion)

function tabla(scope: string) {
  const etiquetas: Record<string, { label: string; hint: string }> = {
    group: { label: '6A · Ciencias Naturales', hint: 'Duelos terminados en esta aula.' },
    grade: { label: 'Grado 6.º', hint: 'Duelos terminados del grado, en todas las materias.' },
    general: { label: 'Toda la institución', hint: 'Duelos terminados en el año escolar en curso, en todos los grados.' },
  }
  const base = [
    { name: 'Camila M.', played: 9, wins: 7, draws: 1, losses: 1, perfects: 2, upsets: 1, correct: 51, answered: 63 },
    { name: 'Tú', played: 8, wins: 5, draws: 2, losses: 1, perfects: 1, upsets: 1, correct: 44, answered: 56 },
    { name: 'Santiago R.', played: 7, wins: 4, draws: 1, losses: 2, perfects: 0, upsets: 2, correct: 38, answered: 49 },
    { name: 'Valentina L.', played: 6, wins: 3, draws: 0, losses: 3, perfects: 1, upsets: 0, correct: 30, answered: 42 },
    { name: 'Mateo G.', played: 5, wins: 1, draws: 1, losses: 3, perfects: 0, upsets: 0, correct: 19, answered: 35 },
  ]
  const escala = scope === 'general' ? 3 : scope === 'grade' ? 2 : 1
  const rows = base.map((row, index) => ({
    enrollmentId: `r${index}`, ...row,
    points: row.wins * 3 + row.draws + row.perfects * 2 + row.upsets,
    accuracy: Math.round((row.correct / row.answered) * 100),
    rank: index + 1, isMe: row.name === 'Tú',
  }))
  return {
    scope, scopeLabel: etiquetas[scope].label, scopeHint: etiquetas[scope].hint,
    criteria: { win: 3, draw: 1, loss: 0, perfect: 2, upset: 1 },
    rows, myRank: 2, participants: rows.length * escala, truncated: false,
  }
}

// ─── Adaptador simulado ──────────────────────────────────────────────────────

api.defaults.adapter = async (config) => {
  const url = config.url ?? ''
  const metodo = (config.method ?? 'get').toLowerCase()
  const cuerpo = config.data ? JSON.parse(config.data) : {}
  const ok = (data: unknown) => ({ data, status: 200, statusText: 'OK', headers: {}, config }) as never
  const buscar = (id: string) => duelos.find((item) => item.id === id)!

  if (url.endsWith('/ranking')) return ok(tabla(String(config.params?.scope ?? 'group')))

  if (url.endsWith('/me')) {
    const escalera = (prefix: string, emoji: string, family: string, pasos: [number, string, string][], actual: number) =>
      pasos.map(([target, name, description], index) => ({
        code: `${prefix}_${target}`, name, description, emoji,
        tier: (['BRONCE', 'PLATA', 'ORO'] as const)[Math.min(index, 2)], family,
        target, current: Math.min(actual, target), earned: actual >= target,
      }))
    const badges = [
      ...escalera('WIN', '⚔️', 'victorias', [[1, 'Primera sangre', 'Gana tu primer duelo.'], [10, 'Retador', 'Gana 10 duelos.'], [30, 'Leyenda de la Arena', 'Gana 30 duelos.']], 6),
      ...escalera('HIT', '🎯', 'aciertos', [[25, 'Buen ojo', 'Acierta 25 preguntas.'], [150, 'Puntería fina', 'Acierta 150 preguntas.'], [500, 'Francotirador', 'Acierta 500 preguntas.']], 44),
      ...escalera('PERFECT', '💎', 'gesta', [[1, 'Pleno', 'Termina un duelo con las siete correctas.'], [5, 'Impecable', 'Consigue 5 duelos perfectos.']], 1),
      ...escalera('STREAK', '⚡', 'gesta', [[3, 'En racha', 'Gana 3 duelos seguidos.'], [7, 'Imparable', 'Gana 7 duelos seguidos.']], 3),
      ...TEMAS.slice(0, 3).flatMap((tema) => escalera(`CAT_${tema}`, '📚', 'categoria',
        [[15, `Aprendiz de ${tema}`, `Acierta 15 preguntas de ${tema}.`], [50, `Expert@ en ${tema}`, `Acierta 50 preguntas de ${tema}.`], [120, `Maestr@ de ${tema}`, `Acierta 120 preguntas de ${tema}.`]], 18)),
    ]
    return ok({
      played: 8, wins: 6, draws: 1, losses: 1, correct: 44, answered: 56, accuracy: 79,
      perfects: 1, currentStreak: 3, bestStreak: 3, points: 21,
      categories: TEMAS.slice(0, 4).map((name, index) => ({ name, correct: 18 - index * 3, answered: 21 - index * 2, duels: 4 - index, accuracy: Math.round((18 - index * 3) / (21 - index * 2) * 100) })),
      badges, earnedCount: badges.filter((badge) => badge.earned).length,
    })
  }

  if (metodo === 'get' && url.startsWith('/classroom-duels/classrooms/')) {
    return ok({
      classroomTitle: 'Ciencias Naturales', gradeName: '6.º', role: rol === 'docente' ? 'teacher' : 'student',
      questionCount: BANCO.length, minimumQuestions: 7,
      categories: TEMAS.map((name) => ({ name, count: 9 })),
      sources: [
        { id: 'a1', title: 'Quiz: la planta y sus partes', questionCount: 10, enabled: true },
        { id: 'a2', title: 'Simulacro ICFES · Ciencias', questionCount: 24, enabled: false },
      ],
      peers: COMPANEROS,
      duels: duelos.map(resumen),
    })
  }

  if (metodo === 'post' && url.startsWith('/classroom-duels/classrooms/')) {
    const ruleta = cuerpo.selectionMode === 'ROULETTE'
    const libres = COMPANEROS.filter((item) => !duelos.some((d) => d.opponentEnrollmentId === item.id && (d.status === 'ACTIVE' || d.status === 'INVITED')))
    const rival = cuerpo.rivalMode === 'RANDOM'
      ? libres[azar(libres.length)]
      : COMPANEROS.find((item) => item.id === cuerpo.opponentEnrollmentId)!
    const duelo: Duelo = {
      id: `d-${siguiente++}`, status: 'ACTIVE', category: ruleta ? 'Ruleta' : cuerpo.category,
      selectionMode: ruleta ? 'ROULETTE' : 'CHOSEN', isInvitee: false,
      opponent: rival.name, opponentEnrollmentId: rival.id,
      questions: ruleta ? porRuleta() : porTema(cuerpo.category),
      mine: [], theirs: [], power: null, swap: null, createdAt: new Date().toISOString(),
    }
    duelos.unshift(duelo)
    return ok({ id: duelo.id, category: duelo.category, selectionMode: duelo.selectionMode })
  }

  const id = url.split('/')[2]

  if (metodo === 'get') return ok(estado(buscar(id)))

  if (url.endsWith('/accept')) { const duelo = buscar(id); duelo.status = 'ACTIVE'; return ok(estado(duelo)) }
  if (url.endsWith('/decline')) { const duelo = buscar(id); duelo.status = 'DECLINED'; return ok(estado(duelo)) }

  if (url.endsWith('/power')) {
    const duelo = buscar(id)
    if (cuerpo.kind === 'CATEGORY') {
      const preguntas = secuencia(duelo)
      const destino = preguntas.findIndex((q, index) => index > duelo.mine.length && q.category === cuerpo.category)
      if (destino >= 0) duelo.swap = [duelo.mine.length + 1, destino]
      return ok(estado(duelo))
    }
    const question = secuencia(duelo)[duelo.mine.length]
    const falsas = question.options.filter((option) => option !== question.correctAnswer)
    duelo.power = { ordinal: duelo.mine.length, options: [question.correctAnswer, falsas[azar(falsas.length)]] }
    return ok(estado(duelo))
  }

  if (url.endsWith('/answers')) {
    const duelo = buscar(id)
    duelo.mine.push(cuerpo.answer === secuencia(duelo)[duelo.mine.length].correctAnswer)
    // El rival avanza solo, para ver el marcador moverse por los dos lados.
    if (duelo.theirs.length < duelo.questions.length) duelo.theirs.push(Math.random() > 0.45)
    if (duelo.mine.length === duelo.questions.length && duelo.theirs.length === duelo.questions.length) duelo.status = 'COMPLETED'
    return ok(estado(duelo))
  }

  return ok({})
}

// ─── Montaje ─────────────────────────────────────────────────────────────────

function Banco() {
  return (
    <>
      <MemoryRouter initialEntries={['/aula/aula-1/duelos']}>
        <Routes><Route path="/aula/:classroomId/duelos" element={<Arena />} /><Route path="*" element={<Arena />} /></Routes>
      </MemoryRouter>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem('demo:arena-rol', rol === 'docente' ? 'estudiante' : 'docente')
          location.reload()
        }}
        className="fixed right-3 top-3 z-[200] rounded-full bg-white px-3 py-1.5 text-xs font-bold text-black shadow-lg"
      >
        Ver como {rol === 'docente' ? 'estudiante' : 'docente'}
      </button>
      <DialogHost />
    </>
  )
}

createRoot(document.getElementById('arena')!).render(<Banco />)
