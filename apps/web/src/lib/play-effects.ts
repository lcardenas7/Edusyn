import confetti from 'canvas-confetti'

// ═══════════════════════════════════════════════════════════════
// SONIDOS — Web Audio API (sin archivos externos)
// ═══════════════════════════════════════════════════════════════
export function playSound(type: 'correct' | 'incorrect' | 'tick' | 'winner' | 'countdown') {
  try {
    const ctx = new AudioContext()
    const gain = ctx.createGain()
    gain.connect(ctx.destination)

    const note = (freq: number, start: number, duration: number, vol = 0.25) => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.connect(g)
      g.connect(ctx.destination)
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
      g.gain.setValueAtTime(vol, ctx.currentTime + start)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + duration)
    }

    switch (type) {
      case 'correct':
        note(523, 0, 0.12)
        note(659, 0.1, 0.12)
        note(784, 0.2, 0.25)
        break
      case 'incorrect':
        note(300, 0, 0.08)
        note(200, 0.07, 0.2, 0.2)
        break
      case 'tick':
        note(880, 0, 0.05, 0.12)
        break
      case 'winner':
        note(523, 0, 0.1)
        note(659, 0.1, 0.1)
        note(784, 0.2, 0.1)
        note(1047, 0.3, 0.4)
        break
      case 'countdown':
        note(440, 0, 0.08, 0.15)
        break
    }
  } catch {
    // AudioContext no disponible (headless / test)
  }
}

// ═══════════════════════════════════════════════════════════════
// CONFETTI — canvas-confetti
// ═══════════════════════════════════════════════════════════════
export function fireConfetti(type: 'correct' | 'winner' | 'celebration') {
  switch (type) {
    case 'correct':
      confetti({
        particleCount: 70,
        spread: 80,
        startVelocity: 32,
        origin: { y: 0.55 },
        colors: ['#a78bfa', '#34d399', '#60a5fa', '#fbbf24'],
      })
      break
    case 'winner':
      confetti({ particleCount: 120, spread: 120, startVelocity: 45, origin: { x: 0.3, y: 0.5 }, colors: ['#facc15', '#fde047', '#fef08a'] })
      confetti({ particleCount: 120, spread: 120, startVelocity: 45, origin: { x: 0.7, y: 0.5 }, colors: ['#facc15', '#fde047', '#fef08a'] })
      break
    case 'celebration': {
      const end = Date.now() + 2500
      const frame = () => {
        if (Date.now() > end) return
        confetti({ particleCount: 30, spread: 360, startVelocity: 28, ticks: 50, origin: { x: Math.random(), y: Math.random() - 0.1 } })
        requestAnimationFrame(frame)
      }
      frame()
      break
    }
  }
}
