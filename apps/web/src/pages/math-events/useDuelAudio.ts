import { useCallback, useEffect, useRef, useState } from "react";

type Cue = "correct" | "wrong" | "start" | "win" | "finish" | "reaction";
function preference(key: string, fallback: boolean) {
  try { const stored = localStorage.getItem(key); return stored === null ? fallback : stored === "true"; } catch { return fallback; }
}
export function useDuelAudio(playing: boolean) {
  const [effects, setEffects] = useState(() => preference("edusyn:duel-effects", true));
  const [music, setMusic] = useState(false);
  const context = useRef<AudioContext | null>(null);
  const notes = useRef(new Set<OscillatorNode>());
  const musicNotes = useRef(new Set<OscillatorNode>());
  const effectsRef = useRef(effects);
  effectsRef.current = effects;
  const unlock = useCallback(() => {
    try {
      context.current ??= new AudioContext();
      if (context.current.state === "suspended") void context.current.resume().catch(() => {});
    } catch { /* Gameplay remains available on devices without audio support. */ }
  }, []);
  const tone = useCallback((hz: number, delay: number, length: number, volume: number, accompaniment = false) => {
    const ctx = context.current;
    if (!ctx || ctx.state !== "running" || document.hidden) return;
    const oscillator = ctx.createOscillator(), gain = ctx.createGain();
    const start = ctx.currentTime + delay;
    oscillator.type = "sine"; oscillator.frequency.value = hz;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + length);
    oscillator.connect(gain); gain.connect(ctx.destination);
    const playingNotes = accompaniment ? musicNotes.current : notes.current;
    playingNotes.add(oscillator);
    oscillator.onended = () => { playingNotes.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(start); oscillator.stop(start + length + 0.03);
  }, []);
  const cue = useCallback((kind: Cue) => {
    if (!effectsRef.current) return;
    const sequence = kind === "reaction" ? [659.25, 880] : kind === "correct" ? [523.25, 659.25, 783.99] : kind === "wrong" ? [293.66, 246.94] : kind === "win" ? [523.25, 659.25, 783.99, 1046.5] : kind === "start" ? [392, 523.25, 783.99] : [523.25, 659.25];
    sequence.forEach((hz, i) => tone(hz, i * (kind === "reaction" ? 0.07 : 0.1), kind === "reaction" ? 0.14 : 0.22, kind === "reaction" ? 0.035 : 0.06));
  }, [tone]);
  const stop = useCallback((musicOnly = false) => {
    for (const group of musicOnly ? [musicNotes.current] : [notes.current, musicNotes.current]) {
      for (const node of group) { try { node.stop(); } catch {} }
      group.clear();
    }
  }, []);
  useEffect(() => {
    const visibility = () => {
      if (document.hidden) { stop(); void context.current?.suspend().catch(() => {}); }
      else if (context.current?.state === "suspended") void context.current.resume().catch(() => {});
    };
    document.addEventListener("visibilitychange", visibility);
    return () => { document.removeEventListener("visibilitychange", visibility); stop(); void context.current?.close().catch(() => {}); context.current = null; };
  }, [stop]);
  useEffect(() => {
    if (!music || !playing) return;
    let step = 0;
    // Original quiet pentatonic accompaniment; no external media or downloads.
    const melody = [261.63, 329.63, 392, 440, 392, 329.63, 293.66, 329.63];
    const timer = window.setInterval(() => tone(melody[step++ % melody.length], 0, 0.55, 0.012, true), 700);
    return () => { clearInterval(timer); stop(true); };
  }, [music, playing, tone, stop]);
  const toggleEffects = () => {
    unlock(); const next = !effects; setEffects(next); if (!next) stop();
    try { localStorage.setItem("edusyn:duel-effects", String(next)); } catch {}
  };
  const toggleMusic = () => { unlock(); setMusic(!music); if (music) stop(true); };
  return { effects, music, toggleEffects, toggleMusic, unlock, cue };
}
