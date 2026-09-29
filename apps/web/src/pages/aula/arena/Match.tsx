/**
 * La partida, a pantalla completa.
 *
 * Cada ronda se cuenta en pasos, y se ven todos — que es justo lo que hace que
 * parezca un juego y no un cuestionario:
 *
 *   1. `ready`     la ruleta quieta, esperando que el ESTUDIANTE la gire;
 *   2. `spin`      la rueda gira, con sus golpecitos;
 *   3. `landed`    frena, el tope rebota y salta el icono del gajo premiado, para
 *                  que se vea DÓNDE paró;
 *   4. `reveal`    anuncio a pantalla completa: mascota en grande y nombre del
 *                  tema que tocó;
 *   5. `reading`   la pregunta sola, sin opciones, para poder leerla con calma;
 *   6. `answering` bajan las opciones y arranca el reloj. Tocar una opción es
 *                  responder: no hay botón de confirmar.
 *
 * En los duelos de tema fijo no hay rueda ni anuncio: se entra directo a leer.
 *
 * El giro lo lanza el estudiante, pero el tema ya lo sorteó el servidor al crear
 * el duelo: el toque pone en marcha la escena, no decide el resultado. Así los
 * dos rivales siguen recibiendo exactamente las mismas siete preguntas.
 *
 * El servidor no dice si acertaste hasta que ambos terminan, así que aquí no se
 * inventa retroalimentación: en vivo solo se ve cuántas preguntas lleva cada quien.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronRight, Clock3, Hourglass, Scissors, Shuffle, Swords, Trophy, Volume2, VolumeX, Wand2, X } from 'lucide-react'
import { Avatar, ProgressDots, type Category, type Duel } from './shared'
import { categoryLook, deepen, wheelSlices } from './categories'
import Wheel from './Wheel'
import { arenaSound, soundEnabled, toggleSound, vibrate } from './sound'

type Props = {
  duel: Duel
  wheel: Category[]
  busy: boolean
  onClose: () => void
  onRespond: (accept: boolean) => void
  onAnswer: (option: string) => void
  onPower: (kind: 'FIFTY' | 'CATEGORY', category?: string) => void
  onRematch: () => void
  /** Nuevo duelo con un rival al azar, directo desde el resultado. */
  onRandom: () => void
  /** Volver al vestíbulo para elegir otro rival. */
  onNewDuel: () => void
  onRanking: () => void
}

type Phase = 'ready' | 'spin' | 'landed' | 'reveal' | 'reading' | 'answering'

type Feedback = {
  ordinal: number; text: string; options: string[]; category: string; chosen: string
  isCorrect: boolean; correctAnswer: string; explanation: string | null
}

const SPIN_MS = 3200      // la rueda girando: arranque rápido y frenada larga
const SETTLE_MS = 380     // pequeño retroceso al final, como una ruleta de verdad
const LAND_MS = 900       // parada en seco: se ve en qué gajo quedó
const REVEAL_MS = 1900    // anuncio del tema
const READ_MS = 4200      // leer la pregunta antes de ver las opciones
const ANSWER_SECONDS = 30 // reloj de la respuesta

/**
 * Tamaño del enunciado. Mientras se lee va solo y puede ir grande; cuando bajan
 * las opciones tiene que compartir el alto con ellas y encoge. En un teléfono
 * real, con la barra del navegador, quedan unos 640 px útiles: el enunciado tiene
 * que caber sin desplazarse junto a cuatro opciones.
 */
function questionSize(text: string, compact: boolean) {
  if (text.length > 190) return compact ? 'text-[15px]' : 'text-lg sm:text-xl'
  if (text.length > 120) return compact ? 'text-base' : 'text-xl sm:text-2xl'
  return compact ? 'text-lg' : 'text-2xl sm:text-3xl'
}

export default function Match({ duel, wheel, busy, onClose, onRespond, onAnswer, onPower, onRematch, onRandom, onNewDuel, onRanking }: Props) {
  const [selected, setSelected] = useState('')
  const [rotation, setRotation] = useState(0)
  /** Duración del tramo de giro en curso: largo al lanzar, corto al asentarse. */
  const [spinMs, setSpinMs] = useState(SPIN_MS)
  const [phase, setPhase] = useState<Phase>('reading')
  const [seconds, setSeconds] = useState(ANSWER_SECONDS)
  const [sound, setSound] = useState(soundEnabled)
  const [pickTheme, setPickTheme] = useState(false)
  /** Resultado de la pregunta recién respondida, mientras el estudiante lo mira. */
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  /** La pregunta que se acaba de enviar, hasta que el servidor diga si acertó. */
  const awaiting = useRef<Omit<Feedback, 'isCorrect' | 'correctAnswer' | 'explanation'> | null>(null)
  const lastOrdinal = useRef<number | null>(null)
  /** Ángulo que la rueda ya tiene pintado; de ahí arranca el giro siguiente. */
  const applied = useRef(0)
  /** Temporizadores y fotogramas de la secuencia en curso, para poder cortarla. */
  const timers = useRef<number[]>([])
  const frames = useRef<number[]>([])
  /** Evita mandar dos respuestas si el dedo toca dos veces antes de que llegue la siguiente ronda. */
  const sending = useRef(false)
  const byWheel = duel.category === 'Ruleta'
  const ordinal = duel.question?.ordinal ?? null
  const look = categoryLook(duel.question?.category ?? duel.category)
  const Mascota = look.mascot
  const slices = wheelSlices(wheel.map((item) => item.name))

  // La partida se relee cada diez segundos, así que `duel.question` y `wheel`
  // llegan como objetos nuevos aunque el contenido sea el mismo. Todo lo que
  // arranca la secuencia depende solo de la ronda, y los valores se leen de esta
  // referencia siempre al día; si dependiera de los objetos, cada relectura
  // cortaría la secuencia a medias.
  const latest = useRef({ question: duel.question, slices })
  latest.current = { question: duel.question, slices }

  const clearSequence = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer))
    frames.current.forEach((frame) => cancelAnimationFrame(frame))
    timers.current = []
    frames.current = []
  }, [])

  const at = useCallback((delay: number, run: () => void) => {
    timers.current.push(window.setTimeout(run, delay))
  }, [])

  // Ronda nueva: se limpia lo de la anterior y se espera a que el estudiante gire.
  useEffect(() => {
    if (ordinal === null || ordinal === lastOrdinal.current) return
    lastOrdinal.current = ordinal
    clearSequence()
    sending.current = false
    setSelected('')
    setPickTheme(false)
    setSeconds(ANSWER_SECONDS)
    if (byWheel) {
      setPhase('ready')
      setSpinMs(SPIN_MS)
      setRotation(applied.current)
    } else {
      setPhase('reading')
      at(READ_MS, () => { setPhase('answering'); arenaSound.options() })
    }
  }, [ordinal, byWheel, at, clearSequence])

  // Al salir de la partida no puede quedar ningún temporizador vivo.
  useEffect(() => clearSequence, [clearSequence])

  // Si la respuesta falla en el servidor, la ronda no cambia: hay que soltar el
  // candado para que el estudiante pueda volver a tocar.
  useEffect(() => {
    if (busy) return
    sending.current = false
    // Si la respuesta falló, el servidor no devolvió resultado de esa ronda:
    // se suelta la selección para que el estudiante pueda volver a tocar.
    if (awaiting.current && duel.lastResult?.ordinal !== awaiting.current.ordinal) {
      awaiting.current = null
      setSelected('')
    }
  }, [busy, duel.lastResult?.ordinal])

  // Llegó el resultado de la pregunta enviada: se muestra al instante.
  useEffect(() => {
    const sent = awaiting.current
    const result = duel.lastResult
    if (!sent || !result || result.ordinal !== sent.ordinal) return
    awaiting.current = null
    setFeedback({ ...sent, isCorrect: result.isCorrect, correctAnswer: result.correctAnswer, explanation: result.explanation })
    if (result.isCorrect) { arenaSound.correct(); vibrate(25) } else { arenaSound.wrong(); vibrate(60) }
  }, [duel.lastResult])

  /**
   * El estudiante gira la ruleta. Este toque es además el que desbloquea el audio
   * en el celular: los navegadores solo dejan sonar algo después de un gesto del
   * usuario, y antes el primer sonido salía de un temporizador, así que se
   * quedaba mudo.
   */
  function spin() {
    if (phase !== 'ready') return
    const question = latest.current.question
    const list = latest.current.slices
    if (!question) return
    arenaSound.unlock()
    arenaSound.spin(SPIN_MS)
    vibrate(20)
    const index = Math.max(0, list.findIndex((item) => item.name === question.category))
    // Una ruleta real no se detiene clavada: pasa un poco de largo y retrocede al
    // asentarse contra el tope. Dos tramos: el giro largo va algo más allá del
    // objetivo y uno corto lo devuelve.
    const slice = 360 / Math.max(list.length, 1)
    const exact = (Math.floor(applied.current / 360) + 7) * 360 - ((index + 0.5) * slice)
    const overshoot = exact - Math.min(slice * 0.28, 16)
    setPhase('spin')
    setSpinMs(SPIN_MS)
    // La rueda ya está pintada en su ángulo anterior (fase `ready`), así que la
    // transición tiene de dónde partir. Se aplica en el fotograma siguiente para
    // que el navegador registre el punto de partida.
    frames.current.push(requestAnimationFrame(() => setRotation(overshoot)))
    at(SPIN_MS, () => { setSpinMs(SETTLE_MS); setRotation(exact); applied.current = exact })
    at(SPIN_MS + SETTLE_MS, () => { setPhase('landed'); arenaSound.land(); vibrate(35) })
    at(SPIN_MS + SETTLE_MS + LAND_MS, () => { setPhase('reveal'); arenaSound.reveal() })
    at(SPIN_MS + SETTLE_MS + LAND_MS + REVEAL_MS, () => setPhase('reading'))
    at(SPIN_MS + SETTLE_MS + LAND_MS + REVEAL_MS + READ_MS, () => { setPhase((now) => (now === 'reading' ? 'answering' : now)); arenaSound.options() })
  }

  // Reloj de la respuesta. Corre solo mientras se puede contestar.
  useEffect(() => {
    if (phase !== 'answering') return
    const timer = window.setInterval(() => {
      setSeconds((left) => {
        if (left <= 0) return 0
        const next = left - 1
        if (next === 0) arenaSound.timeout()
        else if (next <= 5) arenaSound.tick()
        return next
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [phase])

  /** Salta la espera de lectura: quien ya leyó no tiene por qué esperar. */
  function skipReading() {
    arenaSound.unlock()
    setPhase('answering')
    arenaSound.options()
  }

  /** Tocar una opción es responder. La opción se marca al instante y se envía. */
  function choose(option: string) {
    const question = duel.question
    if (sending.current || busy || !question) return
    sending.current = true
    awaiting.current = { ordinal: question.ordinal, text: question.text, options: question.options, category: question.category, chosen: option }
    setSelected(option)
    arenaSound.unlock()
    arenaSound.send()
    vibrate(15)
    onAnswer(option)
  }

  const shell = 'fixed inset-0 z-[110] flex flex-col bg-[#16183D] text-white'
  const tint = {
    background: `radial-gradient(120% 70% at 50% 0%, ${look.color}4D, transparent 62%), radial-gradient(90% 50% at 100% 100%, ${look.color}26, transparent 60%)`,
  }

  const soundButton = (
    <button
      type="button" onClick={() => { arenaSound.unlock(); setSound(toggleSound()) }}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
      aria-label={sound ? 'Silenciar la Arena' : 'Activar el sonido de la Arena'} aria-pressed={sound}
    >
      {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
    </button>
  )

  const closeButton = (
    <button
      type="button" onClick={onClose}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 hover:bg-white/10"
      aria-label="Volver a la Arena"
    >
      <X size={18} />
    </button>
  )

  const header = (
    <header className="relative flex shrink-0 items-center gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      {closeButton}
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-300">
        {byWheel ? 'Duelo de ruleta' : duel.category}
      </span>
      {soundButton}
    </header>
  )

  /**
   * Barra superior de la partida: cerrar, marcador y sonido en UNA fila. Antes
   * eran dos (cabecera y marcador) y, con la barra del navegador del celular, le
   * quitaban a la pregunta el alto que necesitaba.
   */
  const matchBar = (
    <div className="relative flex shrink-0 items-center gap-2 px-3 pt-[max(0.6rem,env(safe-area-inset-top))]">
      {closeButton}
      <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
        <Avatar name="Tú" size={30} ring="rgba(255,201,74,.5)" />
        <strong key={`me-${duel.myScore}`} className="arena-salto text-lg font-black tabular-nums" title={`${duel.myScore} aciertos de ${duel.myProgress}`}>
          {duel.myScore}<span className="text-xs font-bold text-white/45">/{duel.myProgress}</span>
        </strong>
        <span className="px-1 text-[10px] font-bold uppercase tracking-widest text-white/40">vs</span>
        <strong key={`rival-${duel.opponentScore}`} className="arena-salto text-lg font-black tabular-nums" title={`${duel.opponentScore} aciertos de ${duel.opponentProgress}`}>
          {duel.opponentScore}<span className="text-xs font-bold text-white/45">/{duel.opponentProgress}</span>
        </strong>
        <Avatar name={duel.opponent} size={30} />
      </div>
      {soundButton}
    </div>
  )

  /** Marcador amplio, para las pantallas donde sobra el espacio. */
  const scoreboard = (
    <div className="relative flex shrink-0 items-center justify-between gap-3 px-4 pt-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar name="Tú" size={40} ring="rgba(255,201,74,.5)" />
        <span className="min-w-0">
          <span className="block text-xs font-bold text-amber-200">Tú</span>
          <strong key={`me-${duel.myScore}`} className="arena-salto block origin-left text-xl font-black leading-none tabular-nums">
            {duel.myScore}<span className="text-sm font-bold text-white/40"> aciertos</span>
          </strong>
        </span>
      </div>
      <span className="shrink-0 text-xs font-bold uppercase tracking-widest text-white/35">vs</span>
      <div className="flex min-w-0 flex-row-reverse items-center gap-2.5">
        <Avatar name={duel.opponent} size={40} />
        <span className="min-w-0 text-right">
          <span className="block truncate text-xs font-bold text-slate-300">{duel.opponent}</span>
          <strong key={`rival-${duel.opponentScore}`} className="arena-salto block origin-right text-xl font-black leading-none tabular-nums">
            {duel.opponentScore}<span className="text-sm font-bold text-white/40"> aciertos</span>
          </strong>
        </span>
      </div>
    </div>
  )

  if (duel.status === 'INVITED') {
    return (
      <div className={shell}>
        <div className="pointer-events-none absolute inset-0" style={tint} />
        {header}
        <div className="relative flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
          <div className="flex items-center gap-4">
            <Avatar name="Tú" size={62} ring="rgba(255,201,74,.45)" />
            <Swords className="text-amber-300" size={30} />
            <Avatar name={duel.opponent} size={62} />
          </div>
          <h1 className="text-3xl font-black leading-tight">
            {duel.isInvitee ? `${duel.opponent} te retó` : `Esperando a ${duel.opponent}`}
          </h1>
          <p className="max-w-sm text-sm leading-6 text-slate-300">
            {duel.isInvitee
              ? `Siete rondas${byWheel ? ': en cada una giras la ruleta y ella decide el tema' : ` de ${duel.category}`}. Las mismas preguntas para los dos, y cada quien responde cuando pueda.`
              : 'Le aparecerá el reto al entrar a su aula. Mientras tanto puedes abrir otro duelo.'}
          </p>
        </div>
        {duel.isInvitee && (
          <div className="relative flex shrink-0 gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button type="button" disabled={busy} onClick={() => onRespond(false)} className="min-h-14 flex-1 rounded-2xl border border-white/20 font-bold text-slate-200 disabled:opacity-50">
              Ahora no
            </button>
            <button type="button" disabled={busy} onClick={() => { arenaSound.unlock(); arenaSound.send(); vibrate(20); onRespond(true) }} className="min-h-14 flex-[2] rounded-2xl bg-amber-300 font-black text-[#1A1633] shadow-[0_5px_0_#C99A2E] active:translate-y-[3px] active:shadow-[0_2px_0_#C99A2E] disabled:opacity-50">
              ¡Aceptar reto!
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── Resultado inmediato de la pregunta recién respondida ──────────────────
  // Va por delante de la ronda siguiente y también de «esperando al rival» o
  // «terminado»: la séptima respuesta merece su resultado igual que las demás.
  // La opción correcta se pinta de verde y la elegida, si falló, de rojo.
  if (feedback) {
    const fbLook = categoryLook(feedback.category)
    const FbMascota = fbLook.mascot
    const more = duel.status === 'ACTIVE' && !!duel.question
    return (
      <div
        className={shell}
        style={{ background: `linear-gradient(175deg, ${deepen(fbLook.color, 0.24)} 0%, ${deepen(fbLook.color, 0.62)} 68%, #12142F 100%)` }}
      >
        {matchBar}
        <div className="relative flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 pt-3">
          <div
            className={`arena-anuncio flex w-full shrink-0 items-center justify-center gap-2 rounded-2xl py-2.5 text-lg font-black ${feedback.isCorrect ? 'bg-[#1F9254]' : 'bg-[#C8412E]'}`}
            role="status" aria-live="assertive"
          >
            {feedback.isCorrect ? <Check size={22} /> : <X size={22} />}
            {feedback.isCorrect ? '¡Correcto!' : 'Incorrecto'}
          </div>
          <span className="mt-3 inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full bg-white/95 py-1 pl-1.5 pr-3 text-[11px] font-black" style={{ color: deepen(fbLook.color, 0.35) }}>
            <span className="grid h-5 w-5 place-items-center" style={{ color: fbLook.color }}><FbMascota size={20} /></span>
            {feedback.category}
          </span>
          <div className="mt-3 w-full shrink-0 rounded-3xl bg-white px-4 py-3.5 text-center shadow-[0_14px_36px_rgba(0,0,0,.28)]">
            <h1 className={`text-balance font-black leading-snug text-[#16183D] ${questionSize(feedback.text, true)}`}>{feedback.text}</h1>
          </div>
          <div className="mt-3 w-full shrink-0 space-y-2">
            {feedback.options.map((option) => {
              const isAnswer = option.trim().toLowerCase() === feedback.correctAnswer.trim().toLowerCase()
              const isChosen = option === feedback.chosen
              const tone = isAnswer ? 'bg-[#1F9254] text-white' : isChosen ? 'bg-[#C8412E] text-white' : 'bg-white/85 text-[#16183D] opacity-70'
              return (
                <div key={option} className={`flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 py-2 text-center text-[15px] font-bold ${tone}`}>
                  {isAnswer && <Check size={17} className="shrink-0" />}
                  {!isAnswer && isChosen && <X size={17} className="shrink-0" />}
                  <span>{option}</span>
                </div>
              )
            })}
          </div>
          {feedback.explanation && (
            <p className="mt-3 w-full shrink-0 rounded-2xl bg-black/25 p-3 text-sm leading-6 text-white/90">{feedback.explanation}</p>
          )}
        </div>
        <div className="relative shrink-0 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <button
            type="button" onClick={() => { arenaSound.unlock(); setFeedback(null) }}
            className="min-h-14 w-full rounded-2xl bg-[#FFC94A] text-lg font-black text-[#1A1633] shadow-[0_5px_0_rgba(0,0,0,.35)] active:translate-y-[3px] active:shadow-[0_2px_0_rgba(0,0,0,.35)]"
          >
            {more ? 'Siguiente ronda →' : duel.status === 'COMPLETED' ? 'Ver cómo quedó →' : 'Continuar →'}
          </button>
        </div>
      </div>
    )
  }

  if (duel.status === 'ACTIVE' && duel.question) {
    const question = duel.question
    const reading = phase === 'reading'

    // ── Pasos 1 a 3: ruleta esperando, girando y parada ────────────────────
    if (phase === 'ready' || phase === 'spin' || phase === 'landed') {
      return (
        <div className={shell}>
          {header}
          {scoreboard}
          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6">
            <p className="text-sm font-bold uppercase tracking-[.2em] text-slate-400">Ronda {question.ordinal + 1} de {duel.total}</p>
            <button
              type="button" onClick={spin} disabled={phase !== 'ready'}
              aria-label="Girar la ruleta"
              className="flex flex-col items-center rounded-full focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-amber-300 disabled:cursor-default"
            >
              <span
                className={`z-10 -mb-2 h-0 w-0 border-x-[11px] border-t-[18px] border-x-transparent border-t-white ${phase === 'landed' ? 'arena-tope' : ''}`}
                aria-hidden="true"
              />
              <Wheel
                slices={slices}
                rotation={rotation}
                // Arranque rápido y frenada muy larga mientras gira; al asentarse,
                // una curva suave y corta para el retroceso.
                transition={`transform ${spinMs}ms ${spinMs === SETTLE_MS ? 'cubic-bezier(.34,1.3,.64,1)' : 'cubic-bezier(.08,.72,.06,1)'}`}
                winner={phase === 'landed' ? question.category : null}
                hub={phase === 'ready' ? '¡GIRA!' : phase === 'landed' ? '¡YA!' : '…'}
                size={264}
              />
            </button>
            {phase === 'ready' ? (
              <button
                type="button" onClick={spin}
                className="arena-pulso min-h-14 w-full max-w-xs rounded-2xl bg-amber-300 text-lg font-black text-[#1A1633] shadow-[0_5px_0_#C99A2E] active:translate-y-[3px] active:shadow-[0_2px_0_#C99A2E]"
              >
                ¡Gira la ruleta!
              </button>
            ) : (
              <p className="min-h-14 text-lg font-black text-white/75" aria-live="polite">
                {phase === 'landed' ? '¡Ahí paró!' : 'Girando…'}
              </p>
            )}
          </div>
        </div>
      )
    }

    // ── Paso 4: anuncio del tema ───────────────────────────────────────────
    if (phase === 'reveal') {
      return (
        <div className={shell}>
          {/* El color de la categoría inunda la pantalla desde el centro. */}
          <div className="arena-inunda pointer-events-none absolute inset-0" style={{ backgroundColor: look.color }} />
          {header}
          {scoreboard}
          <div className="relative flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
            <span className="relative grid h-44 w-44 place-items-center">
              {/* Aro que se expande y se desvanece, como una onda. */}
              <span className="arena-aro absolute inset-0 rounded-full border-4 border-white/70" />
              <span className="arena-mascota grid h-40 w-40 place-items-center rounded-full bg-white shadow-[0_14px_40px_rgba(0,0,0,.3)]">
                <span style={{ color: look.color }}><Mascota size={104} /></span>
              </span>
            </span>
            <div>
              <p className="arena-sube-1 text-sm font-bold uppercase tracking-[.22em] text-white/75">Te tocó</p>
              <h1 className="arena-sube-2 mt-2 text-balance text-4xl font-black leading-tight">{question.category}</h1>
            </div>
          </div>
          <p className="relative pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-sm font-bold text-white/65" aria-live="polite">
            Ronda {question.ordinal + 1} de {duel.total}
          </p>
        </div>
      )
    }

    // ── Pasos 5 y 6: leer la pregunta y responder ─────────────────────────
    // La pantalla se tiñe del tema en juego; encima van la tarjeta clara con la
    // pregunta y las opciones como piezas sueltas. El color se oscurece hacia el
    // azul de la Arena para que el blanco se lea sobre cualquier categoría.
    const canFifty = duel.powerAvailable && question.options.length >= 3
    const canTheme = duel.powerAvailable && duel.powerCategories.length > 0
    return (
      <div
        className={shell}
        style={{ background: `linear-gradient(175deg, ${deepen(look.color, 0.24)} 0%, ${deepen(look.color, 0.62)} 68%, #12142F 100%)` }}
      >
        {matchBar}

        <div className="relative mt-2 flex shrink-0 items-center gap-2 px-4">
          <ProgressDots total={duel.total} done={duel.myProgress} tone="bg-white" />
          <span className="shrink-0 text-[11px] font-bold tabular-nums text-white/70">Ronda {question.ordinal + 1}/{duel.total}</span>
        </div>

        {/* La pregunta nace centrada, para leerla sin nada más alrededor, y sube
            sola cuando llegan las opciones. Se anima el margen superior porque un
            cambio de `justify-content` no se puede transicionar. `min-h-0` deja
            que esta zona ceda alto a las opciones en vez de empujarlas fuera. */}
        <div
          key={question.ordinal}
          className="arena-pregunta relative flex min-h-0 flex-1 flex-col items-center px-4 pt-3"
          style={{ marginTop: reading ? '11vh' : 0, transition: 'margin-top .6s cubic-bezier(.2,.8,.2,1)' }}
        >
          <span
            className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full bg-white/95 py-1 pl-1.5 pr-3 text-[11px] font-black shadow-lg"
            style={{ color: deepen(look.color, 0.35) }}
          >
            <span className="grid h-5 w-5 place-items-center" style={{ color: look.color }}><Mascota size={20} /></span>
            {question.category}
          </span>

          {/* Tarjeta de la pregunta. Si el texto no cabe, se desplaza DENTRO de
              la tarjeta y conserva sus esquinas: recortarla desde fuera dejaba el
              enunciado partido a media letra. */}
          <div
            className={`mt-3 w-full min-h-0 overflow-y-auto rounded-3xl bg-white px-4 text-center shadow-[0_14px_36px_rgba(0,0,0,.28)] transition-[padding] duration-500 ${reading ? 'py-6' : 'py-3.5'}`}
          >
            <h1 className={`text-balance font-black leading-snug text-[#16183D] ${questionSize(question.text, !reading)}`}>{question.text}</h1>
          </div>

          {question.powerApplied && (
            <p className="mt-2 w-fit shrink-0 rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white">Quedan dos opciones</p>
          )}
        </div>

        <div className="relative shrink-0 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
          {reading ? (
            <>
              <p className="pb-3 text-center text-sm text-white/75" aria-live="polite">Lee con calma. Las opciones aparecen en un momento…</p>
              <button
                type="button" onClick={skipReading}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-white/45 font-bold text-white"
              >
                <ChevronDown size={18} /> Ver las opciones ya
              </button>
            </>
          ) : (
            <>
              {/* Reloj y bonos en una sola fila. Los bonos eran una fila entera de
                  botones grandes que empujaba las opciones; ahora son dos fichas
                  pequeñas al lado del reloj. El reloj marca el ritmo y hoy no
                  penaliza: el servidor todavía no registra cuándo entregó la
                  pregunta. */}
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-black/25">
                  <span
                    key={question.ordinal}
                    className={`arena-reloj block h-full rounded-full ${seconds <= 5 ? 'bg-rose-300' : 'bg-white'}`}
                    style={{ ['--t' as string]: `${ANSWER_SECONDS}s` }}
                  />
                </span>
                <span className={`w-8 shrink-0 text-right text-xs font-black tabular-nums ${seconds <= 5 ? 'text-rose-200' : 'text-white/85'}`} aria-live="off">
                  {seconds}s
                </span>
                {canFifty && (
                  <button
                    type="button" disabled={busy} onClick={() => { arenaSound.unlock(); arenaSound.power(); vibrate(20); onPower('FIFTY') }}
                    aria-label="Bono: descartar dos opciones incorrectas"
                    className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-white/20 px-2.5 text-[11px] font-black text-white ring-1 ring-white/40 disabled:opacity-50"
                  >
                    <Scissors size={13} /> 50/50
                  </button>
                )}
                {canTheme && (
                  <button
                    type="button" disabled={busy} onClick={() => { arenaSound.unlock(); setPickTheme((open) => !open) }}
                    aria-expanded={pickTheme} aria-label="Bono: elegir el tema de la ronda siguiente"
                    className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-[11px] font-black ring-1 disabled:opacity-50 ${pickTheme ? 'bg-white text-[#16183D] ring-white' : 'bg-white/20 text-white ring-white/40'}`}
                  >
                    <Wand2 size={13} /> Tema
                  </button>
                )}
              </div>

              {pickTheme ? (
                // El selector de tema ocupa el sitio de las opciones mientras está
                // abierto, en vez de montarse encima de la pregunta.
                <div className="rounded-2xl bg-black/25 p-3">
                  <p className="text-xs font-bold text-white/80">Bono: elige el tema de la próxima ronda. Solo tienes uno por duelo.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {duel.powerCategories.map((name) => {
                      const item = categoryLook(name)
                      const Mini = item.mascot
                      return (
                        <button
                          key={name} type="button" disabled={busy}
                          onClick={() => { setPickTheme(false); arenaSound.power(); vibrate(20); onPower('CATEGORY', name) }}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-sm font-bold text-white disabled:opacity-50"
                          style={{ backgroundColor: item.color }}
                        >
                          <span className="grid h-8 w-8 place-items-center rounded-full bg-white"><span style={{ color: item.color }}><Mini size={22} /></span></span>
                          {name}
                        </button>
                      )
                    })}
                  </div>
                  <button type="button" onClick={() => setPickTheme(false)} className="mt-2 min-h-10 w-full text-sm font-bold text-white/80">
                    Mejor no, volver a las opciones
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {question.options.map((option, position) => {
                    const active = selected === option
                    return (
                      // Tocar es responder. La elegida se llena con el color de la
                      // categoría: marca la SELECCIÓN, no el acierto, que no se sabe
                      // hasta que ambos terminan.
                      <button
                        key={`${question.ordinal}-${position}-${option}`} type="button" aria-pressed={active}
                        disabled={busy || (!!selected && !active)}
                        onClick={() => choose(option)}
                        style={{
                          '--i': position,
                          backgroundColor: active ? look.color : '#FFFFFF',
                          color: active ? '#FFFFFF' : '#16183D',
                          boxShadow: active ? '0 0 0 3px rgba(255,255,255,.7)' : '0 3px 10px rgba(0,0,0,.18)',
                        } as React.CSSProperties}
                        className="arena-opcion flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-center text-[15px] font-bold leading-snug transition-[transform,background-color,color,opacity] duration-150 active:scale-[.98] disabled:opacity-60"
                      >
                        {active && <Check size={17} className="shrink-0" />}
                        <span className="text-pretty">{option}</span>
                      </button>
                    )
                  })}
                </div>
              )}
              {seconds === 0 && !selected && (
                <p className="mt-2 text-center text-xs font-bold text-rose-100">Se acabó el tiempo: todavía puedes responder.</p>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  if (duel.status === 'ACTIVE') {
    return (
      <div className={shell}>
        {header}
        {scoreboard}
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <Hourglass className="text-teal-300" size={46} />
          <h1 className="text-3xl font-black">Terminaste tus 7</h1>
          <p className="max-w-sm text-sm leading-6 text-slate-300">
            {duel.opponent} lleva {duel.opponentProgress} de {duel.total}. El marcador y las respuestas se abren cuando termine.
          </p>
        </div>
        <div className="shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={onClose} className="min-h-14 w-full rounded-2xl bg-white/10 font-bold">Abrir otro duelo</button>
        </div>
      </div>
    )
  }

  if (duel.status === 'COMPLETED' && duel.result) {
    const { myScore, opponentScore, review } = duel.result
    const outcome = myScore === opponentScore ? 'draw' : myScore > opponentScore ? 'win' : 'loss'
    const headline = { win: '¡Ganaste!', draw: '¡Empate!', loss: 'Ganó tu rival' }[outcome]
    const tone = { win: 'text-amber-300', draw: 'text-teal-300', loss: 'text-slate-300' }[outcome]
    const perfect = myScore === duel.total
    return (
      <div className={shell}>
        {header}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="flex flex-col items-center pt-4 text-center">
            <Trophy className={`arena-trofeo ${tone}`} size={50} />
            <h1 className={`mt-3 text-4xl font-black ${tone}`}>{headline}</h1>
            <p className="mt-2 text-sm text-slate-400">
              {outcome === 'win' ? `+${perfect ? 5 : 3} puntos` : outcome === 'draw' ? '+1 punto' : 'Sin puntos esta vez'}
              {perfect && ' · partida perfecta'}
            </p>
            <div className="mt-6 flex w-full max-w-sm items-center justify-center gap-5">
              <div className="flex flex-col items-center gap-2">
                <Avatar name="Tú" size={58} ring={outcome === 'win' ? 'rgba(255,201,74,.5)' : undefined} />
                <span className="text-xs font-bold text-amber-200">Tú</span>
              </div>
              <p className="tabular-nums text-5xl font-black">
                <span className={outcome === 'win' ? 'text-amber-300' : ''}>{myScore}</span>
                <span className="mx-2 text-white/25">–</span>
                <span className={outcome === 'loss' ? 'text-amber-300' : ''}>{opponentScore}</span>
              </p>
              <div className="flex flex-col items-center gap-2">
                <Avatar name={duel.opponent} size={58} ring={outcome === 'loss' ? 'rgba(255,201,74,.5)' : undefined} />
                <span className="max-w-[5rem] truncate text-xs font-bold text-slate-300">{duel.opponent}</span>
              </div>
            </div>
          </div>

          <h2 className="mt-8 text-sm font-bold uppercase tracking-wider text-slate-400">Repaso de las 7</h2>
          <ol className="mt-3 space-y-2">
            {review.map((item, position) => (
              <li key={position} className={`rounded-2xl border p-3.5 ${item.myCorrect ? 'border-teal-400/25 bg-teal-400/[.07]' : 'border-rose-400/25 bg-rose-400/[.07]'}`}>
                <div className="flex gap-2.5">
                  <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${item.myCorrect ? 'bg-teal-400/20 text-teal-300' : 'bg-rose-400/20 text-rose-300'}`}>
                    {item.myCorrect ? <Check size={14} /> : <X size={14} />}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold leading-snug">{item.text}</p>
                    <p className="mt-1 text-sm text-slate-300">Respuesta: <strong className="text-white">{item.correctAnswer}</strong></p>
                    {item.explanation && <p className="mt-1 text-sm leading-6 text-slate-400">{item.explanation}</p>}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
        {/* Qué hacer después. La revancha era la única salida al juego; ahora
            también se puede seguir con otro rival, elegido o al azar, sin volver
            a pasar por el vestíbulo. */}
        <div className="grid shrink-0 grid-cols-2 gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
          <button type="button" disabled={busy} onClick={onRematch} className="col-span-2 min-h-14 rounded-2xl bg-amber-300 text-lg font-black text-[#1A1633] shadow-[0_5px_0_#C99A2E] active:translate-y-[3px] active:shadow-[0_2px_0_#C99A2E] disabled:opacity-50">
            Revancha con {duel.opponent} <ChevronRight size={17} className="ml-0.5 inline" />
          </button>
          <button type="button" disabled={busy} onClick={onRandom} className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-2xl bg-white/10 text-sm font-bold text-white disabled:opacity-50">
            <Shuffle size={15} /> Rival al azar
          </button>
          <button type="button" onClick={onNewDuel} className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-2xl bg-white/10 text-sm font-bold text-white">
            <Swords size={15} /> Elegir rival
          </button>
          <button type="button" onClick={onRanking} className="col-span-2 min-h-11 rounded-2xl border border-white/20 text-sm font-bold text-slate-200">
            Ver el ranking
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={shell}>
      {header}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <Clock3 className="text-slate-400" size={44} />
        <h1 className="text-3xl font-black">{duel.status === 'EXPIRED' ? 'El reto venció' : 'Reto rechazado'}</h1>
        <p className="max-w-sm text-sm leading-6 text-slate-300">Puedes abrir otro duelo cuando quieras.</p>
      </div>
      <div className="shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button type="button" onClick={onClose} className="min-h-14 w-full rounded-2xl bg-amber-300 font-black text-[#1A1633]">Volver a la Arena</button>
      </div>
    </div>
  )
}
