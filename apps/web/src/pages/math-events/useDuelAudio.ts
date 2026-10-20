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
  const musicAudio = useRef<HTMLAudioElement | null>(null);
  const effectsRef = useRef(effects);
  effectsRef.current = effects;
  const musicRef = useRef(music);
  musicRef.current = music;
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const unlock = useCallback(() => {
    try {
      context.current ??= new AudioContext();
      if (context.current.state === "suspended") void context.current.resume().catch(() => {});
    } catch { /* Gameplay remains available on devices without audio support. */ }
  }, []);
  const tone = useCallback((hz: number, delay: number, length: number, volume: number) => {
    const ctx = context.current;
    if (!ctx || ctx.state !== "running" || document.hidden) return;
    const oscillator = ctx.createOscillator(), gain = ctx.createGain();
    const start = ctx.currentTime + delay;
    oscillator.type = "sine"; oscillator.frequency.value = hz;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + length);
    oscillator.connect(gain); gain.connect(ctx.destination);
    notes.current.add(oscillator);
    oscillator.onended = () => { notes.current.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(start); oscillator.stop(start + length + 0.03);
  }, []);
  const cue = useCallback((kind: Cue) => {
    if (!effectsRef.current) return;
    const sequence = kind === "reaction" ? [659.25, 880] : kind === "correct" ? [523.25, 659.25, 783.99] : kind === "wrong" ? [293.66, 246.94] : kind === "win" ? [523.25, 659.25, 783.99, 1046.5] : kind === "start" ? [392, 523.25, 783.99] : [523.25, 659.25];
    sequence.forEach((hz, i) => tone(hz, i * (kind === "reaction" ? 0.07 : 0.1), kind === "reaction" ? 0.14 : 0.22, kind === "reaction" ? 0.035 : 0.06));
  }, [tone]);
  const stop = useCallback(() => {
    for (const node of notes.current) { try { node.stop(); } catch {} }
    notes.current.clear();
  }, []);
  const getMusicAudio = useCallback(() => {
    if (!musicAudio.current) {
      const audio = new Audio('/audio/city-loop.mp3');
      audio.loop = true;
      audio.preload = 'none';
      audio.volume = 0.16;
      musicAudio.current = audio;
    }
    return musicAudio.current;
  }, []);
  const playMusic = useCallback(() => {
    if (!playingRef.current || document.hidden) return;
    const audio = getMusicAudio();
    if (audio.paused) void audio.play().catch(() => { musicRef.current = false; setMusic(false); });
  }, [getMusicAudio]);
  useEffect(() => {
    const visibility = () => {
      if (document.hidden) { stop(); musicAudio.current?.pause(); void context.current?.suspend().catch(() => {}); }
      else {
        if (context.current?.state === "suspended") void context.current.resume().catch(() => {});
        if (musicRef.current) playMusic();
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => { document.removeEventListener("visibilitychange", visibility); stop(); musicAudio.current?.pause(); musicAudio.current = null; void context.current?.close().catch(() => {}); context.current = null; };
  }, [stop, playMusic]);
  useEffect(() => {
    if (music && playing) playMusic();
    else musicAudio.current?.pause();
  }, [music, playing, playMusic]);
  const toggleEffects = () => {
    unlock(); const next = !effects; setEffects(next); if (!next) stop();
    try { localStorage.setItem("edusyn:duel-effects", String(next)); } catch {}
  };
  const toggleMusic = () => {
    const next = !music;
    musicRef.current = next;
    setMusic(next);
    if (next) playMusic();
    else musicAudio.current?.pause();
  };
  return { effects, music, toggleEffects, toggleMusic, unlock, cue };
}
