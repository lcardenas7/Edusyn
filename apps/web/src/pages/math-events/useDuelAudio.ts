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
  const rhythmNotes = useRef(new Set<AudioScheduledSourceNode>());
  const rhythmTimer = useRef<number | null>(null);
  const rhythmStep = useRef(0);
  const effectsRef = useRef(effects);
  effectsRef.current = effects;
  const musicRef = useRef(music);
  musicRef.current = music;
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const unlock = useCallback(() => {
    try {
      context.current ??= new AudioContext();
      if (context.current.state === "suspended") return context.current.resume().catch(() => {});
      return Promise.resolve();
    } catch { /* Gameplay remains available on devices without audio support. */ return Promise.resolve(); }
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
  const noteAt = useCallback((frequency: number, when: number, duration: number, volume: number, type: OscillatorType = 'triangle') => {
    const ctx = context.current;
    if (!ctx || ctx.state !== 'running') return;
    const oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(volume, when + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    oscillator.connect(gain); gain.connect(ctx.destination);
    rhythmNotes.current.add(oscillator);
    oscillator.onended = () => { rhythmNotes.current.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(when); oscillator.stop(when + duration + 0.02);
  }, []);
  const stopRhythm = useCallback(() => {
    if (rhythmTimer.current !== null) window.clearInterval(rhythmTimer.current);
    rhythmTimer.current = null;
    for (const node of rhythmNotes.current) { try { node.stop(); } catch {} }
    rhythmNotes.current.clear();
  }, []);
  const playMusic = useCallback(() => {
    if (!playingRef.current || !musicRef.current || document.hidden || context.current?.state !== 'running' || rhythmTimer.current !== null) return;
    // Original, locally synthesized arcade quiz loop. Two bars in C major at 120 BPM;
    // the student must turn on music, and its mix stays quiet under answer cues.
    const melody = [523.25, 659.25, 783.99, 659.25, 587.33, 659.25, 783.99, 0, 783.99, 880, 1046.5, 880, 783.99, 659.25, 587.33, 659.25];
    const bass = [130.81, 0, 0, 0, 196, 0, 0, 0, 110, 0, 0, 0, 174.61, 0, 0, 0];
    rhythmStep.current = 0;
    const tick = () => {
      if (!playingRef.current || !musicRef.current || document.hidden || context.current?.state !== 'running') { stopRhythm(); return; }
      const ctx = context.current!;
      const step = rhythmStep.current++ % melody.length;
      const at = ctx.currentTime + 0.018;
      if (melody[step]) noteAt(melody[step], at, 0.16, 0.022, 'triangle');
      if (bass[step]) noteAt(bass[step], at, 0.25, 0.018, 'sine');
      if (step === 0 || step === 8) {
        const thump = ctx.createOscillator(), gain = ctx.createGain();
        thump.type = 'sine'; thump.frequency.setValueAtTime(115, at); thump.frequency.exponentialRampToValueAtTime(54, at + 0.11);
        gain.gain.setValueAtTime(0.04, at); gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
        thump.connect(gain); gain.connect(ctx.destination); rhythmNotes.current.add(thump);
        thump.onended = () => { rhythmNotes.current.delete(thump); thump.disconnect(); gain.disconnect(); };
        thump.start(at); thump.stop(at + 0.13);
      }
      if (step === 2 || step === 6 || step === 10 || step === 14) {
        const length = Math.ceil(ctx.sampleRate * 0.045);
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const channel = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) channel[i] = Math.random() * 2 - 1;
        const hat = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
        hat.buffer = buffer; filter.type = 'highpass'; filter.frequency.value = 5200;
        gain.gain.setValueAtTime(0.0001, at); gain.gain.linearRampToValueAtTime(0.007, at + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.04);
        hat.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
        rhythmNotes.current.add(hat);
        hat.onended = () => { rhythmNotes.current.delete(hat); hat.disconnect(); filter.disconnect(); gain.disconnect(); };
        hat.start(at); hat.stop(at + 0.05);
      }
    };
    tick();
    rhythmTimer.current = window.setInterval(tick, 250);
  }, [noteAt, stopRhythm]);
  useEffect(() => {
    const visibility = () => {
      if (document.hidden) { stop(); stopRhythm(); void context.current?.suspend().catch(() => {}); }
      else {
        if (context.current?.state === "suspended") void context.current.resume().then(playMusic).catch(() => {});
        else if (musicRef.current) playMusic();
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => { document.removeEventListener("visibilitychange", visibility); stop(); stopRhythm(); void context.current?.close().catch(() => {}); context.current = null; };
  }, [stop, stopRhythm, playMusic]);
  useEffect(() => {
    if (music && playing) playMusic();
    else stopRhythm();
  }, [music, playing, playMusic, stopRhythm]);
  const toggleEffects = () => {
    unlock(); const next = !effects; setEffects(next); if (!next) stop();
    try { localStorage.setItem("edusyn:duel-effects", String(next)); } catch {}
  };
  const toggleMusic = () => {
    const next = !music;
    musicRef.current = next;
    setMusic(next);
    if (next) void unlock().then(playMusic);
    else stopRhythm();
  };
  return { effects, music, toggleEffects, toggleMusic, unlock, cue };
}
