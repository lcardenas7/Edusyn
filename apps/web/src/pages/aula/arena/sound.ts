/**
 * Sonidos de la Arena.
 *
 * Se sintetizan con la Web Audio API en vez de cargar archivos: son avisos
 * cortos (un clic, un trino, un acorde), pesarían más que el código que los
 * genera y así el aula no descarga nada extra con una conexión móvil mala.
 *
 * El navegador no deja sonar nada antes de que la persona toque la pantalla, así
 * que el contexto de audio se crea en el primer toque y no antes. Si el
 * dispositivo lo rechaza, todo sigue funcionando en silencio: ninguna función de
 * aquí lanza errores hacia arriba.
 *
 * La preferencia se guarda por dispositivo en `localStorage`; puede venir vacía
 * o fallar (ventana privada, datos bloqueados) y entonces manda el valor por
 * defecto, que es con sonido.
 */

const KEY = 'arena:sonido'

let context: AudioContext | null = null
let enabled = read()

function read() {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

export function soundEnabled() {
  return enabled
}

export function toggleSound() {
  enabled = !enabled
  try {
    localStorage.setItem(KEY, enabled ? 'on' : 'off')
  } catch {
    // Sin almacenamiento la preferencia dura lo que dure la pestaña. No es un error.
  }
  if (enabled) play([660, 880], 0.08, 'triangle')
  return enabled
}

/** Se llama desde el primer toque real; antes de eso el navegador lo bloquearía. */
function audio() {
  if (context) return context
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    context = new Ctor()
  } catch {
    return null
  }
  return context
}

/** Secuencia de tonos. `step` es la duración de cada uno, en segundos. */
function play(notes: number[], step: number, wave: OscillatorType = 'sine', volume = 0.05) {
  if (!enabled) return
  const ctx = audio()
  if (!ctx) return
  try {
    if (ctx.state === 'suspended') void ctx.resume()
    notes.forEach((frequency, index) => {
      const start = ctx.currentTime + index * step
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.type = wave
      oscillator.frequency.setValueAtTime(frequency, start)
      // Ataque y caída suaves: un tono que arranca y corta en seco chasquea.
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(volume, start + step * 0.2)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + step)
      oscillator.connect(gain).connect(ctx.destination)
      oscillator.start(start)
      oscillator.stop(start + step)
    })
  } catch {
    // Un dispositivo que no puede sonar no debe romper la partida.
  }
}

export const arenaSound = {
  /** Toque sobre una opción. */
  tap: () => play([520], 0.06, 'triangle', 0.035),
  /** Envío de la respuesta: no dice si acertaste, porque el servidor tampoco. */
  send: () => play([620, 780], 0.07, 'triangle'),
  /** Golpes de la ruleta mientras frena. */
  spin: () => {
    const ticks = [0, 90, 175, 255, 330, 400, 465, 525, 580, 630, 675, 715, 750, 780, 1010, 1240, 1470]
    ticks.forEach((delay) => window.setTimeout(() => play([1200], 0.025, 'square', 0.025), delay))
  },
  /** La rueda se detuvo en una categoría: golpe seco del tope. */
  land: () => play([740, 990], 0.1, 'triangle', 0.06),
  /** Anuncio del tema que tocó: fanfarria corta de tres notas. */
  reveal: () => play([523, 659, 784, 1046], 0.12, 'triangle', 0.055),
  /** Las opciones entran en pantalla. */
  options: () => play([420, 560], 0.07, 'sine', 0.035),
  /** Últimos segundos del reloj: un golpe por segundo. */
  tick: () => play([880], 0.05, 'square', 0.03),
  /** Se agotó el tiempo de lectura cómoda. */
  timeout: () => play([420, 300], 0.16, 'sine', 0.045),
  /** Se usó el descarte 50/50. */
  power: () => play([880, 660, 1100], 0.06, 'sine', 0.05),
  win: () => play([660, 830, 990, 1320], 0.11, 'triangle', 0.06),
  draw: () => play([700, 700], 0.14, 'sine', 0.05),
  lose: () => play([440, 350], 0.16, 'sine', 0.045),
}
