import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, SmilePlus, X } from "lucide-react";

export const reactionTypes = [
  ["APPLAUSE", "👏", "Aplausos"], ["BRILLIANT", "💡", "Brillante"],
  ["FAIR_PLAY", "🤝", "Juego limpio"], ["KEEP_GOING", "💪", "¡Sigue así!"],
] as const;
export type Recognition = { reactions: Record<string, number>; myReaction: string | null };

function Count({ value }: { value: number }) {
  const reduced = useReducedMotion();
  return <motion.span key={value} initial={reduced ? false : { scale: 0.75, y: 3 }} animate={{ scale: 1, y: 0 }} transition={{ duration: 0.2 }} className="reaction-count">{value}</motion.span>;
}

export function RecognitionSummary({ counts }: { counts?: Record<string, number> }) {
  const total = reactionTypes.reduce((sum, [kind]) => sum + (counts?.[kind] ?? 0), 0);
  return <section className="recognition-summary" aria-label="Tus reconocimientos del evento">
    <div className="recognition-summary-title"><span aria-hidden="true">✨</span><h3>Tus reconocimientos</h3>{counts && <Count value={total} />}</div>
    <p>{!counts ? "Cargando tus reconocimientos…" : total ? `Has recibido ${total} ${total === 1 ? "reconocimiento" : "reconocimientos"} en este evento.` : "Aquí aparecerán los reconocimientos que te envíen tus compañeros."}</p>
    {!!total && <div className="recognition-summary-counts">{reactionTypes.filter(([kind]) => (counts?.[kind] ?? 0) > 0).map(([kind, glyph, label]) => <span key={kind}><span aria-hidden="true">{glyph}</span> <Count value={counts?.[kind] ?? 0} /> {label}</span>)}</div>}
    <small>Son gestos deportivos. No cambian tus puntos.</small>
  </section>;
}

export function Reactions({ counts, selected, disabled, readOnly = false, compact = false, onReact }: {
  counts?: Record<string, number>; selected?: string | null; disabled?: boolean; readOnly?: boolean;
  compact?: boolean;
  onReact: (kind: string | null) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [burst, setBurst] = useState<{ glyph: string; id: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const reduced = useReducedMotion();
  const pickerId = useId();
  const choice = reactionTypes.find(([kind]) => kind === selected);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    root.current?.querySelector<HTMLElement>(".reaction-picker button")?.focus();
    root.current?.querySelector<HTMLElement>(".reaction-picker")?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
    return () => document.removeEventListener("pointerdown", close);
  }, [open, reduced]);
  useEffect(() => { if (disabled || readOnly) setOpen(false); }, [disabled, readOnly]);
  const choose = async (kind: string | null) => {
    if (disabled || readOnly || !counts) return;
    setOpen(false);
    trigger.current?.focus();
    const next = kind === selected ? null : kind;
    const success = await onReact(next);
    const reaction = reactionTypes.find(([value]) => value === next);
    if (success && reaction && !reduced) setBurst({ glyph: reaction[1], id: Date.now() });
  };
  const visible = reactionTypes.filter(([kind]) => (counts?.[kind] ?? 0) > 0 || selected === kind);
  return <div ref={root} className={`duel-reactions${compact ? " duel-reactions--compact" : ""}`} onKeyDown={event => {
    if (event.key === "Escape" && open) { event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
  }}>
    {visible.length > 0 && <div className="reaction-counts" role="group" aria-label="Reconocimientos recibidos">
      {visible.map(([kind, glyph, label]) => <span key={kind} className={`reaction-chip ${selected === kind ? "is-selected" : ""}`} title={label} aria-label={`${label}: ${counts?.[kind] ?? 0}${selected === kind ? ". Tu reacción" : ""}`}><span aria-hidden="true">{glyph}</span><Count value={counts?.[kind] ?? 0} /></span>)}
    </div>}
    {!readOnly && <div className="reaction-selector">
      <button ref={trigger} type="button" disabled={disabled || !counts} aria-label={choice ? `Cambiar reacción: ${choice[2]}` : "Reaccionar"} title={choice ? `Tu reacción: ${choice[2]}` : "Reaccionar"} aria-expanded={open} aria-controls={open ? pickerId : undefined} onClick={() => setOpen(!open)} className={`reaction-trigger${compact ? " reaction-trigger--compact" : ""} ${choice ? "is-selected" : ""}`}>
        {choice ? <span aria-hidden="true">{choice[1]}</span> : <SmilePlus size={compact ? 20 : 18} />}{!compact && <><span>{choice ? choice[2] : "Reaccionar"}</span><ChevronDown size={15} /></>}
      </button>
      <AnimatePresence>{open && <motion.div id={pickerId} className="reaction-picker" role="group" aria-label="Elige un reconocimiento" initial={reduced ? false : { opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.18 }}>
        <div className="reaction-picker-options">{reactionTypes.map(([kind, glyph, label]) => <button key={kind} type="button" aria-pressed={selected === kind} disabled={disabled} onClick={() => void choose(kind)}><span aria-hidden="true">{glyph}</span><span>{label}</span></button>)}</div>
        {selected && <button type="button" className="reaction-remove" disabled={disabled} onClick={() => void choose(null)}><X size={15} /> Retirar mi reacción</button>}
        <small>Una reacción por compañero. Puedes cambiarla.</small>
      </motion.div>}</AnimatePresence>
      <AnimatePresence>{burst && <motion.span key={burst.id} aria-hidden="true" className="reaction-burst" initial={{ opacity: 0, y: 0, scale: 0.6 }} animate={{ opacity: [0, 1, 0], y: [0, -15, -45], scale: [0.6, 1.3, 1] }} exit={{ opacity: 0 }} transition={{ duration: 0.75 }} onAnimationComplete={() => setBurst(null)}>{burst.glyph}</motion.span>}</AnimatePresence>
    </div>}
  </div>;
}
