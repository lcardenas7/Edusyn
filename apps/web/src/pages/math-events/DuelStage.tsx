import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Check, ChevronRight, LoaderCircle, Maximize, Minimize, Music2, Swords, Volume2, VolumeX, X } from "lucide-react";
import { Reactions, RecognitionSummary } from "./Reactions";
import "./duel-stage.css";

export type DuelQuestion = {
  id: string; text: string; options: string[]; topic?: string | null;
  answered: boolean; correctAnswer?: string; explanation?: string | null; isCorrect?: boolean; timedOut?: boolean;
};
export type DuelState = {
  id: string; status: string; round: number; total: number; finished: boolean;
  allDone: boolean; questions: DuelQuestion[]; myScore: number; opponentScore: number | null;
  showCorrectAnswers?: boolean; showExplanations?: boolean;
  pointsAwarded?: number | null; bonus?: number | null;
  timeLimitSeconds?: number | null; questionDeadlineAt?: string | null; serverNow?: string; expiresAt?: string; finishReason?: string | null;
};
export type AnswerFeedback = {
  duelId: string; ordinal: number; question: DuelQuestion; selected: string;
  isCorrect: boolean; correctAnswer?: string; explanation?: string | null; timedOut?: boolean;
};
type Player = { firstName: string; lastName: string; course: string; grade: number; avatarCode: string };
type Props = {
  waitingMessage?: string;
  title: string; me: Player; opponent: Player; glyphs: Record<string, string>;
  duel: DuelState | null; feedback: AnswerFeedback | null; answering: boolean; busy: boolean;
  onAnswer: (q: DuelQuestion, ordinal: number, value: string) => Promise<boolean>;
  onQuestionStart: (ordinal: number) => Promise<void>; onLeave: () => void;
  onContinue: () => void; onBack: () => void; onCancel?: () => void;
  onRanking: () => void; ranking: any; opponentRanking: any; reacting: boolean; onReact: (kind: string | null) => Promise<boolean>;
  myRecognitions?: Record<string, number>;
  audio: { effects: boolean; music: boolean; toggleEffects: () => void; toggleMusic: () => void };
};

function PlayerBadge({ player, glyphs, small = false }: { player: Player; glyphs: Record<string, string>; small?: boolean }) {
  return <div className={`duel-player ${small ? "duel-player-small" : ""}`}>
    <span className="duel-avatar" aria-hidden="true">{glyphs[player.avatarCode] || "⭐"}</span>
    <strong>{player.firstName} {player.lastName}</strong>
    {!small && <span>{player.grade}.º · {player.course}</span>}
  </div>;
}

export function DuelStage({ title, me, opponent, glyphs, duel, feedback, answering, busy, onAnswer, onQuestionStart, onLeave, onContinue, onBack, onCancel, onRanking, ranking, opponentRanking, reacting, onReact, audio, waitingMessage, myRecognitions }: Props) {
  const reduceMotion = useReducedMotion();
  const stageRef = useRef<HTMLElement>(null);
  const [explain, setExplain] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [intro, setIntro] = useState(!!duel && !duel.finished && !duel.questions.some(q => q.answered));
  const [clock, setClock] = useState<{ key: string; seconds: number } | null>(null);
  const secondsLeft = clock?.key === duel?.questionDeadlineAt ? clock?.seconds ?? null : null;
  const [clockError, setClockError] = useState(false);
  const [clockRetry, setClockRetry] = useState(0);
  const [timeoutRetry, setTimeoutRetry] = useState(0);
  const clockRequest = useRef<string | null>(null);
  const timeoutSent = useRef<string | null>(null);
  const timeoutTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timeoutTimer.current), []);
  const startRef = useRef(onQuestionStart); startRef.current = onQuestionStart;
  const answerRef = useRef(onAnswer); answerRef.current = onAnswer;
  useEffect(() => {
    // Each new question starts at the top, even after scrolling an explanation.
    if (!feedback) stageRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [duel?.round, feedback]);
  useEffect(() => {
    if (!intro) return;
    const timer = window.setTimeout(() => setIntro(false), reduceMotion ? 0 : 1500);
    return () => clearTimeout(timer);
  }, [intro, reduceMotion]);
  useEffect(() => { setExplain(false); }, [feedback]);
  useEffect(() => {
    const update = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  useEffect(() => {
    // Freeze only the background page; the stage itself remains scrollable on short screens.
    const previous = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = "hidden";
    stageRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen?.();
    } catch { /* Immersive layout also works when the browser declines fullscreen. */ }
  };
  const question = feedback?.question ?? duel?.questions.find(q => !q.answered);
  const ordinal = feedback?.ordinal ?? (duel ? duel.questions.findIndex(q => !q.answered) : 0);
  const waiting = !duel;
  const completedSummary = !!duel?.allDone && !feedback && !answering;
  const finishedSummary = !!duel?.finished && !feedback && !answering;
  const timed = duel?.timeLimitSeconds === 30;
  const clockReady = !timed || !!duel?.questionDeadlineAt;
  useEffect(() => {
    if (!duel || !timed || intro || feedback || duel.finished || duel.questionDeadlineAt || ordinal < 0) return;
    const key = `${duel.id}:${ordinal}`;
    if (clockRequest.current === key) return;
    clockRequest.current = key;
    setClockError(false);
    void startRef.current(ordinal).catch(() => setClockError(true)).finally(() => { if (clockRequest.current === key) clockRequest.current = null; });
  }, [duel?.id, timed, intro, !!feedback, duel?.finished, duel?.questionDeadlineAt, ordinal, clockRetry]);
  useEffect(() => {
    if (!timed || intro || feedback || duel?.finished) return;
    if (!duel?.questionDeadlineAt || !duel.serverNow) { setClock(null); return; }
    const key = duel.questionDeadlineAt;
    const duration = Math.max(0, new Date(duel.questionDeadlineAt).getTime() - new Date(duel.serverNow).getTime());
    const receivedAt = performance.now();
    const tick = () => setClock({ key, seconds: Math.max(0, Math.ceil((duration - (performance.now() - receivedAt)) / 1000)) });
    tick();
    const timer = window.setInterval(tick, 200);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [timed, intro, !!feedback, duel?.finished, duel?.questionDeadlineAt, duel?.serverNow]);
  useEffect(() => {
    if (!duel || !question || !timed || !clockReady || intro || feedback || answering || duel.finished || secondsLeft !== 0) return;
    const key = `${duel.id}:${ordinal}`;
    if (timeoutSent.current === key) return;
    timeoutSent.current = key;
    void answerRef.current(question, ordinal, '').then(saved => {
      if (!saved) timeoutTimer.current = window.setTimeout(() => { if (timeoutSent.current === key) timeoutSent.current = null; setTimeoutRetry(v => v + 1); }, 3000);
    });
  }, [duel?.id, question?.id, ordinal, timed, clockReady, intro, !!feedback, answering, duel?.finished, secondsLeft, timeoutRetry]);
  const transition = { duration: reduceMotion ? 0 : 0.24 };
  return <section ref={stageRef} tabIndex={-1} role="dialog" aria-modal="true" className="duel-stage" aria-label="Partida de matemáticas" onKeyDown={event => {
    if (event.key === "Escape") { onBack(); return; }
    if (event.key !== "Tab") return;
    const controls = Array.from(stageRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), summary, [tabindex="0"]') ?? []);
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === stageRef.current)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}>
    <div className="duel-stage-inner">
      <header className="duel-stage-heading">
        <button onClick={onBack} className="duel-icon-button" aria-label="Volver al evento; la partida continúa"><ArrowLeft size={22} /></button>
        <h1>{title}</h1>
        {document.fullscreenEnabled ? <button onClick={toggleFullscreen} className="duel-icon-button" aria-label={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}>{fullscreen ? <Minimize size={20} /> : <Maximize size={20} />}</button> : <Swords size={22} aria-hidden="true" />}
      </header>
      <div className="duel-audio-controls">
        <button onClick={audio.toggleEffects} aria-pressed={audio.effects}>{audio.effects ? <Volume2 size={16} /> : <VolumeX size={16} />} Efectos {audio.effects ? "sí" : "no"}</button>
        <button onClick={audio.toggleMusic} aria-pressed={audio.music}><Music2 size={16} /> Música {audio.music ? "sí" : "no"}</button>
        {duel && !duel.finished && <button disabled={busy || answering} onClick={onLeave}>Salir de partida</button>}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {waiting || intro ? <motion.div key="versus" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition} className="duel-versus-screen">
          <div className="duel-versus-players">
            <PlayerBadge player={me} glyphs={glyphs} />
            <span className="duel-versus-mark" aria-label="contra">VS</span>
            <PlayerBadge player={opponent} glyphs={glyphs} />
          </div>
          <div className="duel-rules"><span>❔ <strong>{duel?.total ?? 7}</strong> preguntas</span><span>⏱ <strong>{duel && !timed ? 'Sin reloj' : '30 s'}</strong>{!duel || timed ? ' por pregunta' : ''}</span><span>🏆 <strong>10 pts</strong> por acierto</span></div>
          <div className="duel-wait-card" role="status">
            <span className="duel-hourglass" aria-hidden="true">{waiting ? "⏳" : "⚡"}</span>
            <h2>{waiting ? "Esperando a que tu rival acepte…" : "¡El reto comienza!"}</h2>
            <p>{waiting ? waitingMessage || "Te avisaremos aquí cuando acepte. Puedes volver al evento mientras tanto." : "Piensa, elige y demuestra lo que sabes."}</p>
          </div>
          {waiting && onCancel && <button disabled={busy} onClick={onCancel} className="duel-cancel"><X size={18} /> Cancelar reto</button>}
          <p className="duel-tip">💡 Cada acierto cuenta. ¡Tómate un momento para pensar!</p>
        </motion.div> : <motion.div key="game" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={transition}>
          <div className="duel-scoreboard">
            <div><PlayerBadge player={me} glyphs={glyphs} small /><strong className="duel-score">{(duel?.myScore ?? 0) * 10} <small>pts</small></strong></div>
            {timed && question ? <span className={`duel-clock ${secondsLeft !== null && secondsLeft <= 5 && !feedback ? 'is-urgent' : ''}`} role="timer" aria-label={feedback ? 'Respuesta guardada' : `${secondsLeft ?? 30} segundos restantes`}><strong>{feedback ? '✓' : secondsLeft ?? '…'}</strong><small>{feedback ? 'Listo' : 'seg'}</small></span> : <span className="duel-score-vs">VS</span>}
            <div><PlayerBadge player={opponent} glyphs={glyphs} small /><strong className="duel-score">{duel?.opponentScore == null ? "…" : duel.opponentScore * 10} <small>{duel?.opponentScore == null ? "en juego" : "pts"}</small></strong></div>
          </div>
          <div className="duel-progress-label"><span>{question ? `Pregunta ${ordinal + 1} de ${duel?.total}` : "Tus respuestas están guardadas"}</span><span>{duel?.myScore ?? 0} aciertos</span></div>
          <div className="duel-progress" aria-label="Progreso de preguntas">{duel?.questions.map((q, i) => <span key={q.id} className={q.answered ? q.isCorrect ? "is-correct" : "is-wrong" : i === ordinal ? "is-current" : ""} />)}</div>
          {question ? <AnimatePresence mode="wait" initial={false}>
            <motion.div key={question.id} initial={{ opacity: 0, y: reduceMotion ? 0 : 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduceMotion ? 0 : -12 }} transition={transition}>
              <div className="duel-question-stack"><article className="duel-question-card">
                <div className="duel-question-meta"><span>▦</span><p>{question.topic || "Desafío matemático"}</p><strong>+10 pts</strong></div>
                <h2>{question.text || 'Preparando pregunta…'}</h2>
              </article></div>
              <div className="duel-options" aria-label="Opciones de respuesta" aria-busy={answering}>
                {question.options.map((option, i) => {
                  const correct = !!feedback && duel?.showCorrectAnswers !== false && (option === feedback.correctAnswer || (feedback.isCorrect && option === feedback.selected));
                  const wrong = !!feedback && option === feedback.selected && !feedback.isCorrect;
                  return <button key={`${i}-${option}`} disabled={answering || !!feedback || !clockReady || (timed && secondsLeft === 0)} onClick={() => void onAnswer(question, ordinal, option)} className={`duel-option ${correct ? "is-correct" : wrong ? "is-wrong" : feedback ? "is-muted" : ""}`}>
                    <span className="duel-option-letter" aria-hidden="true">{String.fromCharCode(65 + i)}</span><span>{option}</span>{correct ? <Check size={24} aria-label="Respuesta correcta" /> : wrong ? <X size={24} aria-label="Respuesta incorrecta" /> : null}
                  </button>;
                })}
              </div>
              {timed && !clockReady && !feedback && <p className="duel-tip" role="status">{clockError ? 'No pudimos iniciar la pregunta.' : 'Preparando tus 30 segundos…'}{clockError && <button className="duel-return" onClick={() => setClockRetry(v => v + 1)}>Reintentar pregunta</button>}</p>}
              {timed && secondsLeft === 0 && !feedback && <p className="duel-tip" role="status">Tiempo agotado. Guardando la pregunta sin respuesta…</p>}
              {answering && <p className="duel-saving" role="status"><LoaderCircle size={16} className="animate-spin" /> Guardando tu respuesta…</p>}
              {feedback && <motion.div initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={transition} className={`duel-feedback ${feedback.isCorrect ? "is-correct" : "is-wrong"}`}>
                {feedback.isCorrect && !reduceMotion && <div className="duel-confetti" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ left: `${8 + i * 7}%`, animationDelay: `${i % 4 * 0.06}s`, background: ["#ffdf58", "#58dbb2", "#9893ff", "#ff8eb2"][i % 4] }} />)}</div>}
                <div className="duel-feedback-heading" role="status"><strong>{feedback.timedOut ? "⏱ Tiempo agotado · Sin puntos en esta pregunta" : feedback.isCorrect ? "✓ ¡Correcto! +10 puntos" : "Sigamos, ¡tú puedes!"}</strong>{duel?.showExplanations !== false && feedback.explanation && <button onClick={() => setExplain(!explain)} aria-expanded={explain}>Ver explicación</button>}</div>
                {!feedback.isCorrect && duel?.showCorrectAnswers !== false && feedback.correctAnswer && <p>Respuesta: {feedback.correctAnswer}</p>}
                {explain && duel?.showExplanations !== false && <p>{feedback.explanation}</p>}
              </motion.div>}
              {!feedback && <p className="duel-tip">Toca una opción para responder.</p>}
            </motion.div>
          </AnimatePresence> : <div className="duel-result" role="status">
            <span className="duel-result-icon" aria-hidden="true">{duel?.allDone ? "🏆" : "⏳"}</span>
            <h2>{duel?.allDone ? duel.myScore > (duel.opponentScore ?? 0) ? "¡Ganaste el duelo!" : duel.myScore === duel.opponentScore ? "¡Un gran empate!" : "Esta vez ganó tu rival" : "¡Terminaste tu parte!"}</h2>
            <p>Contra {opponent.firstName} {opponent.lastName}</p>
            <p>{duel?.myScore} aciertos de {duel?.total} · {(duel?.myScore ?? 0) * 10} puntos por aciertos</p>
            <p>{duel?.allDone ? `${duel.pointsAwarded ?? duel.myScore * 10} puntos al ranking · Bono: +${duel.bonus ?? 0}` : "Ya puedes jugar con otro rival. El resultado se actualizará cuando tu compañero termine o se cierre por inactividad."}</p>
            {duel?.finishReason === 'INACTIVITY' && <p>Duelo cerrado por inactividad. Las preguntas pendientes quedaron sin acierto; tus respuestas guardadas se conservaron.</p>}
            {duel?.finishReason === 'LEFT' && <p>Dejaste esta partida conservando tus aciertos. Las preguntas pendientes quedaron sin respuesta.</p>}
            {duel?.allDone && <>
              <div className="duel-final-score"><strong>Tú<br />{duel.myScore * 10} pts</strong><span>VS</span><strong>{opponent.firstName}<br />{(duel.opponentScore ?? 0) * 10} pts</strong></div>
              <RecognitionSummary counts={myRecognitions} />
              <h3 className="duel-section-title">Reconoce a tu rival</h3>
              <Reactions counts={opponentRanking?.reactions} selected={opponentRanking?.myReaction} disabled={reacting} onReact={onReact} />
              <div className="duel-ranking-preview"><h3>🏆 Ranking {ranking?.scope === "course" ? "de mi curso" : ranking?.scope === "grade" ? "de mi grado" : "general"}</h3>
                {ranking ? <><p>Tu puesto: {ranking.myRank ?? "—"}</p>{ranking.rows?.slice(0, 3).map((r: any) => <div key={r.id}><span>{r.rank}. {r.firstName} {r.lastName}</span><strong>{r.points} pts</strong></div>)}</> : <p>Actualizando clasificación…</p>}
              </div>
            </>}
            {duel?.allDone && (duel.showCorrectAnswers !== false || duel.showExplanations !== false) && <details className="duel-review"><summary>Revisar mis respuestas</summary>{duel.questions.map((q, i) => <div key={q.id}><strong>{i + 1}. {q.text}</strong><p>{q.isCorrect ? "✓ Acierto" : "· Sin acierto"}{duel.showCorrectAnswers !== false && q.correctAnswer ? ` · ${q.correctAnswer}` : ""}</p>{duel.showExplanations !== false && q.explanation && <p>{q.explanation}</p>}</div>)}</details>}
            {!duel?.allDone && <button onClick={onBack} className="duel-primary">Volver al evento <ChevronRight size={20} /></button>}
            {duel?.allDone && <button onClick={onBack} className="duel-return">Elegir otro rival</button>}
          </div>}
        </motion.div>}
      </AnimatePresence>
    </div>
    {feedback?.isCorrect && !reduceMotion && <motion.div key={`${feedback.duelId}-${feedback.ordinal}`} aria-hidden="true" className="duel-point-burst" initial={{ opacity: 0, y: 20, scale: 0.8 }} animate={{ opacity: [0, 1, 1, 0], y: [20, 0, 0, -30], scale: [0.8, 1.1, 1, 1] }} transition={{ duration: 1.3 }}>⭐ +10 pts</motion.div>}
    {(feedback || answering || finishedSummary) && !intro && <div className="duel-next-dock">
      <div role="status">{completedSummary ? `${duel?.pointsAwarded ?? 0} puntos sumados al ranking` : finishedSummary ? 'Tus respuestas están guardadas; puedes seguir jugando' : !feedback ? "Comprobando tu respuesta…" : feedback.timedOut ? 'Tiempo agotado · Continúa con la siguiente' : feedback.isCorrect ? "✓ ¡Correcto! +10 pts" : "Respuesta guardada · ¡Sigue adelante!"}</div>
      <button disabled={!finishedSummary && (answering || !feedback)} onClick={completedSummary ? onRanking : finishedSummary ? onBack : onContinue} className="duel-primary">{completedSummary ? "Ver ranking completo" : finishedSummary ? 'Elegir otro rival' : answering ? "Guardando…" : ((feedback?.ordinal ?? 0) + 1 === duel?.total ? "Ver mi resultado" : "Siguiente pregunta")}<ChevronRight size={20} /></button>
    </div>}
  </section>;
}
