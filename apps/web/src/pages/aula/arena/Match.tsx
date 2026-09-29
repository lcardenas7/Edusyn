/**
 * La partida, a pantalla completa.
 *
 * Cada ronda se cuenta en pasos, y se ven todos — que es justo lo que hace que
 * parezca un juego y no un cuestionario:
 *
 *   1. `spin`      la rueda gira, con sus golpecitos;
 *   2. `landed`    frena, el tope rebota y salta el icono del gajo premiado, para
 *                  que se vea DÓNDE paró;
 *   3. `reveal`    anuncio a pantalla completa: mascota en grande y nombre del
 *                  tema que tocó;
 *   4. `reading`   la pregunta sola, sin opciones, para poder leerla con calma;
 *   5. `answering` bajan las opciones y arranca el reloj.
 *
 * En los duelos de tema fijo no hay rueda ni anuncio: se entra directo a leer.
 *
 * El giro es la puesta en escena de un sorteo que YA hizo el servidor; la
 * animación nunca decide nada. Y el servidor no dice si acertaste hasta que
 * ambos terminan, así que aquí no se inventa retroalimentación: en vivo solo se
 * ve cuántas preguntas lleva cada quien.
 */
import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronRight, Clock3, Hourglass, Sparkles, Swords, Trophy, Volume2, VolumeX, Wand2, X } from 'lucide-react'
import { Avatar, ProgressDots, type Category, type Duel } from './shared'
import { categoryLook, deepen, wheelSlices } from './categories'
import Wheel from './Wheel'
import { arenaSound, soundEnabled, toggleSound } from './sound'

type Props = {
  duel: Duel
  wheel: Category[]
  busy: boolean
  onClose: () => void
  onRespond: (accept: boolean) => void
  onAnswer: (option: string) => void
  onPower: (kind: 'FIFTY' | 'CATEGORY', category?: string) => void
  onRematch: () => void
  onRanking: () => void
}

type Phase = 'spin' | 'landed' | 'reveal' | 'reading' | 'answering'

const SPIN_MS = 2800      // la rueda girando
const SETTLE_MS = 380     // pequeño retroceso al final, como una ruleta de verdad
const LAND_MS = 900       // parada en seco: se ve en qué gajo quedó
const REVEAL_MS = 1900    // anuncio del tema
const READ_MS = 4200      // leer la pregunta antes de ver las opciones
const ANSWER_SECONDS = 30 // reloj de la respuesta

/**
 * Tamaño del enunciado. En la fase de lectura ocupa toda la pantalla y puede ir
 * grande; cuando bajan las opciones hay que compartir el alto con ellas, así que
 * encoge un punto. Los enunciados largos bajan otro punto más.
 */
function questionSize(text: string, compact: boolean) {
  if (text.length > 190) return compact ? 'text-base' : 'text-lg sm:text-xl'
  if (text.length > 120) return compact ? 'text-lg' : 'text-xl sm:text-2xl'
  return compact ? 'text-xl' : 'text-2xl sm:text-3xl'
}

export default function Match({ duel, wheel, busy, onClose, onRespond, onAnswer, onPower, onRematch, onRanking }: Props) {
  const [selected, setSelected] = useState('')
  const [justSent, setJustSent] = useState(false)
  const [rotation, setRotation] = useState(0)
  /** Duración del tramo de giro en curso: largo al lanzar, corto al asentarse. */
  const [spinMs, setSpinMs] = useState(SPIN_MS)
  const [phase, setPhase] = useState<Phase>('reading')
  const [seconds, setSeconds] = useState(ANSWER_SECONDS)
  const [sound, setSound] = useState(soundEnabled)
  const [pickTheme, setPickTheme] = useState(false)
  const lastOrdinal = useRef<number | null>(null)
  /** Ángulo que la rueda ya tiene pintado; de ahí arranca el giro siguiente. */
  const applied = useRef(0)
  const byWheel = duel.category === 'Ruleta'
  const ordinal = duel.question?.ordinal ?? null
  const look = categoryLook(duel.question?.category ?? duel.category)
  const Mascota = look.mascot
  const slices = wheelSlices(wheel.map((item) => item.name))

  // La partida se relee cada diez segundos, así que `duel.question` y `wheel`
  // llegan como objetos nuevos aunque el contenido sea el mismo. Si el efecto
  // dependiera de ellos, cada relectura lo volvería a ejecutar: su limpieza
  // cancelaría los temporizadores de la secuencia y la ronda se quedaría
  // congelada en un paso. Por eso solo depende de la ronda, y lo demás se lee
  // de una referencia siempre al día.
  const latest = useRef({ question: duel.question, slices })
  latest.current = { question: duel.question, slices }

  useEffect(() => {
    if (ordinal === null || ordinal === lastOrdinal.current) return
    const isFirst = lastOrdinal.current === null
    lastOrdinal.current = ordinal
    setSelected('')
    setPickTheme(false)
    setSeconds(ANSWER_SECONDS)
    const timers: number[] = []
    const at = (delay: number, run: () => void) => timers.push(window.setTimeout(run, delay))

    if (!isFirst) {
      setJustSent(true)
      at(1400, () => setJustSent(false))
    }

    const { question, slices: list } = latest.current
    if (!byWheel || !question) {
      setPhase('reading')
      at(READ_MS, () => { setPhase('answering'); arenaSound.options() })
      return () => timers.forEach((timer) => window.clearTimeout(timer))
    }

    const index = Math.max(0, list.findIndex((item) => item.name === question.category))
    setPhase('spin')
    arenaSound.spin()
    // La rueda solo existe en pantalla durante el giro, así que cada ronda la
    // monta de nuevo. Si se montara ya con el ángulo final, la transición de CSS
    // no tendría de dónde partir y no se vería girar nunca: aparecería quieta en
    // el resultado. Por eso nace en el ángulo anterior y el nuevo se aplica en
    // el fotograma siguiente, cuando el navegador ya la pintó en su sitio.
    // Una ruleta real no se detiene clavada: pasa un poco de largo y retrocede
    // al asentarse contra el tope. Se hace en dos tramos — el giro largo va algo
    // más allá del objetivo y un segundo tramo corto lo devuelve — porque una
    // sola transición hasta el ángulo exacto se ve mecánica.
    const slice = 360 / Math.max(list.length, 1)
    const exact = (Math.floor(applied.current / 360) + 6) * 360 - ((index + 0.5) * slice)
    const overshoot = exact - Math.min(slice * 0.28, 16)
    setRotation(applied.current)
    setSpinMs(SPIN_MS)
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setRotation(overshoot))
    })
    at(SPIN_MS, () => { setSpinMs(SETTLE_MS); setRotation(exact); applied.current = exact })
    at(SPIN_MS + SETTLE_MS, () => { setPhase('landed'); arenaSound.land() })
    at(SPIN_MS + SETTLE_MS + LAND_MS, () => { setPhase('reveal'); arenaSound.reveal() })
    at(SPIN_MS + SETTLE_MS + LAND_MS + REVEAL_MS, () => setPhase('reading'))
    at(SPIN_MS + SETTLE_MS + LAND_MS + REVEAL_MS + READ_MS, () => { setPhase('answering'); arenaSound.options() })
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [ordinal, byWheel])

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
    setPhase('answering')
    arenaSound.options()
  }

  const shell = 'fixed inset-0 z-[110] flex flex-col bg-[#16183D] text-white'
  const tint = {
    background: `radial-gradient(120% 70% at 50% 0%, ${look.color}4D, transparent 62%), radial-gradient(90% 50% at 100% 100%, ${look.color}26, transparent 60%)`,
  }

  const header = (
    <header className="relative flex shrink-0 items-center gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <button
        type="button" onClick={onClose}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 hover:bg-white/10"
        aria-label="Volver a la Arena"
      >
        <X size={19} />
      </button>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-300">
        {byWheel ? 'Duelo de ruleta' : duel.category}
      </span>
      <button
        type="button" onClick={() => setSound(toggleSound())}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 text-slate-300 hover:bg-white/10"
        aria-label={sound ? 'Silenciar la Arena' : 'Activar el sonido de la Arena'} aria-pressed={sound}
      >
        {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
      </button>
    </header>
  )

  /** Marcador: avatares y cuántas preguntas lleva cada quien. El resultado no. */
  const scoreboard = (
    <div className="relative flex shrink-0 items-center justify-between gap-3 px-4 pt-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar name="Tú" size={40} ring="rgba(255,201,74,.5)" />
        <span className="min-w-0">
          <span className="block text-xs font-bold text-amber-200">Tú</span>
          <strong key={`me-${duel.myProgress}`} className="arena-salto block origin-left text-xl font-black leading-none tabular-nums">
            {duel.myProgress}<span className="text-sm font-bold text-white/40">/{duel.total}</span>
          </strong>
        </span>
      </div>
      <span className="shrink-0 text-xs font-bold uppercase tracking-widest text-white/35">vs</span>
      <div className="flex min-w-0 flex-row-reverse items-center gap-2.5">
        <Avatar name={duel.opponent} size={40} />
        <span className="min-w-0 text-right">
          <span className="block truncate text-xs font-bold text-slate-300">{duel.opponent}</span>
          <strong key={`rival-${duel.opponentProgress}`} className="arena-salto block origin-right text-xl font-black leading-none tabular-nums">
            {duel.opponentProgress}<span className="text-sm font-bold text-white/40">/{duel.total}</span>
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
              ? `Siete rondas${byWheel ? ' con la ruleta decidiendo el tema de cada una' : ` de ${duel.category}`}, las mismas preguntas para los dos. Cada quien responde cuando pueda.`
              : 'Le llegará el reto al entrar a esta aula. Mientras tanto puedes abrir otro duelo.'}
          </p>
        </div>
        {duel.isInvitee && (
          <div className="relative flex shrink-0 gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button type="button" disabled={busy} onClick={() => onRespond(false)} className="min-h-14 flex-1 rounded-2xl border border-white/20 font-bold text-slate-200 disabled:opacity-50">
              Ahora no
            </button>
            <button type="button" disabled={busy} onClick={() => { arenaSound.send(); onRespond(true) }} className="min-h-14 flex-[2] rounded-2xl bg-amber-300 font-black text-[#1A1633] shadow-[0_5px_0_#C99A2E] active:translate-y-[3px] active:shadow-[0_2px_0_#C99A2E] disabled:opacity-50">
              ¡Aceptar reto!
            </button>
          </div>
        )}
      </div>
    )
  }

  if (duel.status === 'ACTIVE' && duel.question) {
    const question = duel.question
    const reading = phase === 'reading'

    // ── Pasos 1 a 3: rueda girando, parada y anuncio ──────────────────────
    if (phase === 'spin' || phase === 'landed' || phase === 'reveal') {
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

      return (
        <div className={shell}>
          {header}
          {scoreboard}
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
            <p className="text-sm font-bold uppercase tracking-[.2em] text-slate-400">Ronda {question.ordinal + 1} de {duel.total}</p>
            <div className="flex flex-col items-center">
              <span
                className={`z-10 -mb-2 h-0 w-0 border-x-[11px] border-t-[18px] border-x-transparent border-t-white ${phase === 'landed' ? 'arena-tope' : ''}`}
                aria-hidden="true"
              />
              <Wheel
                slices={slices}
                rotation={rotation}
                // Arranque rápido y frenada muy larga mientras gira; al
                // asentarse, una curva suave y corta para el retroceso.
                transition={`transform ${spinMs}ms ${spinMs === SETTLE_MS ? 'cubic-bezier(.34,1.3,.64,1)' : 'cubic-bezier(.08,.72,.06,1)'}`}
                winner={phase === 'landed' ? question.category : null}
                hub={phase === 'landed' ? '¡YA!' : 'GIRA'}
                size={264}
              />
            </div>
            <p className="text-lg font-black text-white/70" aria-live="polite">
              {phase === 'landed' ? '¡Ahí paró!' : 'Girando la ruleta…'}
            </p>
          </div>
        </div>
      )
    }

    // ── Pasos 4 y 5: leer la pregunta y responder ─────────────────────────
    // La pantalla entera se tiñe del tema en juego, y encima van una tarjeta
    // clara con la pregunta y las opciones como piezas sueltas. El color del
    // fondo se oscurece hacia el azul de la Arena para que el texto blanco se
    // lea igual de bien sobre el amarillo de Economía que sobre el azul de
    // Matemáticas.
    return (
      <div
        className={shell}
        style={{ background: `linear-gradient(175deg, ${deepen(look.color, 0.24)} 0%, ${deepen(look.color, 0.62)} 68%, #12142F 100%)` }}
      >
        {header}
        {scoreboard}

        <div className="relative mt-3 flex shrink-0 items-center gap-2 px-4">
          <ProgressDots total={duel.total} done={duel.myProgress} tone="bg-white" />
          <span className="shrink-0 text-xs font-bold tabular-nums text-white/70">Ronda {question.ordinal + 1}/{duel.total}</span>
        </div>

        {/* La pregunta nace centrada, para leerla sin nada más alrededor, y sube
            sola cuando llegan las opciones. El margen superior se anima porque
            un cambio de `justify-content` no se puede transicionar. */}
        <div
          key={question.ordinal}
          className="arena-pregunta relative flex flex-1 flex-col items-center overflow-y-auto px-4 pb-2 pt-4"
          style={{ marginTop: reading ? '12vh' : 0, transition: 'margin-top .6s cubic-bezier(.2,.8,.2,1)' }}
        >
          <span
            className="inline-flex w-fit items-center gap-2 rounded-full bg-white/95 py-1.5 pl-2 pr-4 text-xs font-black shadow-lg"
            style={{ color: deepen(look.color, 0.35) }}
          >
            <span className="grid h-6 w-6 place-items-center" style={{ color: look.color }}><Mascota size={24} /></span>
            {question.category}
          </span>

          {justSent && (
            <p className="mt-3 inline-flex w-fit items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-sm font-bold text-white" aria-live="polite">
              <Check size={15} /> Respuesta registrada
            </p>
          )}

          {/* Tarjeta de la pregunta: papel claro sobre el color del tema.
              El desplazamiento vive DENTRO de la tarjeta, no fuera: si el texto
              no cabe, se desplaza y la tarjeta conserva sus esquinas redondas.
              Antes lo recortaba el borde del área exterior y el enunciado
              quedaba partido a media letra. */}
          <div
            className="mt-4 w-full shrink-0 overflow-y-auto rounded-3xl bg-white px-5 text-center shadow-[0_14px_36px_rgba(0,0,0,.28)] transition-all duration-500"
            style={{ maxHeight: reading ? 'none' : '34vh', paddingBlock: reading ? '1.6rem' : '1.1rem' }}
          >
            <h1 className={`text-balance font-black leading-snug text-[#16183D] ${questionSize(question.text, !reading)}`}>{question.text}</h1>
          </div>

          {question.powerApplied && (
            <p className="mt-4 w-fit rounded-full bg-white/20 px-4 py-1.5 text-sm font-bold text-white">Quedan dos opciones</p>
          )}
        </div>

        {/* Los bonos viven fuera del área que se desplaza: dentro, con un
            enunciado largo, el borde del scroll los cortaba por la mitad. */}
        {!reading && duel.powerAvailable && (
          <div className="relative shrink-0 px-4 pb-2">
            <div className="flex flex-wrap gap-2">
              {question.options.length >= 3 && (
                <button
                  type="button" disabled={busy} onClick={() => { arenaSound.power(); onPower('FIFTY') }}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/45 bg-white/15 px-3.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  <Sparkles size={15} /> Descartar dos
                </button>
              )}
              {duel.powerCategories.length > 0 && (
                <button
                  type="button" disabled={busy} onClick={() => setPickTheme((open) => !open)} aria-expanded={pickTheme}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/45 bg-white/15 px-3.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  <Wand2 size={15} /> Elegir tema
                </button>
              )}
              <span className="self-center text-[11px] text-white/60">Un bono por duelo</span>
            </div>
            {pickTheme && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {duel.powerCategories.map((name) => {
                  const item = categoryLook(name)
                  const Mini = item.mascot
                  return (
                    <button
                      key={name} type="button" disabled={busy}
                      onClick={() => { setPickTheme(false); arenaSound.power(); onPower('CATEGORY', name) }}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full py-1 pl-1.5 pr-4 text-sm font-bold text-white disabled:opacity-50"
                      style={{ backgroundColor: item.color }}
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-white/25"><Mini size={20} tone="flat" /></span>
                      {name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <div className="relative shrink-0 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {reading ? (
            <>
              <p className="pb-3 text-center text-sm text-white/70" aria-live="polite">Lee con calma. Las opciones aparecen en un momento…</p>
              <button
                type="button" onClick={skipReading}
                className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-white/45 font-bold text-white"
              >
                <ChevronDown size={18} /> Ver las opciones ya
              </button>
            </>
          ) : (
            <>
              {/* Reloj de la ronda. Marca el ritmo; hoy no penaliza, porque el
                  servidor todavía no registra cuándo se entregó la pregunta. */}
              <div className="mb-3 flex items-center gap-2.5">
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-black/25">
                  <span
                    key={question.ordinal}
                    className={`arena-reloj block h-full rounded-full ${seconds <= 5 ? 'bg-rose-300' : 'bg-white'}`}
                    style={{ ['--t' as string]: `${ANSWER_SECONDS}s` }}
                  />
                </span>
                <span className={`w-9 shrink-0 text-right text-sm font-black tabular-nums ${seconds <= 5 ? 'text-rose-200' : 'text-white/85'}`} aria-live="off">
                  {seconds}s
                </span>
              </div>

              <div className="space-y-2.5">
                {question.options.map((option, position) => {
                  const active = selected === option
                  return (
                    // Píldoras claras, como fichas sueltas sobre el color del
                    // tema. La elegida se llena con el color de la categoría:
                    // marca la selección, NO si es correcta — eso no se sabe
                    // hasta que ambos terminan.
                    <button
                      key={`${question.ordinal}-${position}-${option}`} type="button" aria-pressed={active}
                      onClick={() => { setSelected(option); arenaSound.tap() }}
                      style={{
                        '--i': position,
                        backgroundColor: active ? look.color : '#FFFFFF',
                        color: active ? '#FFFFFF' : '#16183D',
                        boxShadow: active ? `0 0 0 3px rgba(255,255,255,.65)` : '0 3px 10px rgba(0,0,0,.18)',
                      } as React.CSSProperties}
                      className="arena-opcion flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-center font-bold transition-[transform,background-color,color] duration-150 active:scale-[.985]"
                    >
                      {active && <Check size={17} className="shrink-0" />}
                      <span className="text-pretty">{option}</span>
                    </button>
                  )
                })}
              </div>
              <button
                type="button" disabled={!selected || busy} onClick={() => { arenaSound.send(); onAnswer(selected) }}
                className="mt-3 min-h-14 w-full rounded-2xl bg-[#FFC94A] text-lg font-black text-[#1A1633] shadow-[0_5px_0_rgba(0,0,0,.35)] transition-all active:translate-y-[3px] active:shadow-[0_2px_0_rgba(0,0,0,.35)] disabled:bg-white/15 disabled:text-white/50 disabled:shadow-none"
              >
                {selected ? 'Confirmar' : seconds === 0 ? 'Se acabó el tiempo · responde igual' : 'Elige una opción'}
              </button>
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
        <div className="flex shrink-0 gap-2.5 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
          <button type="button" onClick={onRanking} className="min-h-14 flex-1 rounded-2xl border border-white/20 font-bold text-slate-200">Ranking</button>
          <button type="button" disabled={busy} onClick={onRematch} className="min-h-14 flex-[1.4] rounded-2xl bg-amber-300 font-black text-[#1A1633] shadow-[0_5px_0_#C99A2E] active:translate-y-[3px] active:shadow-[0_2px_0_#C99A2E] disabled:opacity-50">
            Revancha <ChevronRight size={17} className="ml-0.5 inline" />
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
