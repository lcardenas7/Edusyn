export const reactionTypes = [
  ["APPLAUSE", "👏", "Aplausos"], ["BRILLIANT", "💡", "Brillante"],
  ["FAIR_PLAY", "🤝", "Juego limpio"], ["KEEP_GOING", "💪", "¡Sigue así!"],
] as const;
export function Reactions({ counts, selected, disabled, onReact }: {
  counts?: Record<string, number>; selected?: string | null; disabled?: boolean; onReact: (kind: string) => void;
}) {
  return <div className="duel-reactions" aria-label="Reconocimientos deportivos">
    {reactionTypes.map(([kind, glyph, label]) => <button key={kind} title={label} aria-label={`${label}: ${counts?.[kind] ?? 0}`} aria-pressed={selected === kind} disabled={disabled} onClick={() => onReact(kind)}>
      <span aria-hidden="true">{glyph}</span> <span>{counts?.[kind] ?? 0}</span>
    </button>)}
  </div>;
}
