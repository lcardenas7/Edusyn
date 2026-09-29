/**
 * Sonidos y vibración de la Arena.
 *
 * Se sintetizan con la Web Audio API en vez de cargar archivos: son avisos
 * cortos (un clic, un trino, un acorde), pesarían más que el código que los
 * genera y así el aula no descarga nada extra con una conexión móvil mala.
 *
 * ── Por qué en la primera prueba en el celular no sonaba nada ──
 * Los navegadores móviles (Safari de iPhone y Chrome de Android) solo dejan
 * sonar audio si el contexto de audio se crea o se reanuda DENTRO de un gesto
 * del usuario. Antes el contexto se creaba con el primer sonido, que salía de un
 * temporizador (el giro automático de la ruleta): nacía bloqueado y se quedaba
 * mudo toda la partida. Además, los volúmenes (3 a 6 %) eran casi inaudibles en
 * el altavoz de un teléfono.
 *
 * Ahora `unlock()` se llama desde cada toque importante (girar, responder,
 * aceptar). Crea el contexto, lo reanuda y reproduce un instante de silencio,
 * que es lo que exige iPhone para dar el audio por desbloqueado. Después, los
 * sonidos que salen de temporizadores (el tope, el anuncio, el reloj) ya suenan.
 *
 * Limitación que no se puede saltar: en iPhone, con el interruptor lateral en
 * silencio, la Web Audio API no suena. Es una decisión del sistema operativo.
 *
 * La preferencia se guarda por dispositivo en `localStorage`; puede venir vacía o
 * fallar (ventana privada, datos bloqueados) y entonces manda el valor por
 * defecto, que es con sonido. Ninguna función de aquí lanza errores hacia arriba:
 * un dispositivo que no puede sonar ni vibrar no debe romper la partida.
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
  if (enabled) play([660, 880], 0.08, 'triangle', 0.15)
  return enabled
}

function create() {
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

/**
 * Desbloquea el audio. Debe llamarse DENTRO del manejador de un toque. Es barato
 * y se puede llamar muchas veces: si ya está en marcha, no hace nada.
 */
function unlock() {
  const ctx = create()
  if (!ctx) return
  try {
    if (ctx.state !== 'running') void ctx.resume()
    // Un instante de silencio: sin reproducir algo dentro del gesto, iPhone no
    // considera desbloqueado el contexto aunque `resume()` no falle.
    const buffer = ctx.createBuffer(1, 1, 22050)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start(0)
  } catch {
    // Sin audio no pasa nada: el juego sigue igual.
  }
}

/** Secuencia de tonos. `step` es la duración de cada uno, en segundos. */
function play(notes: number[], step: number, wave: OscillatorType = 'sine', volume = 0.16, delay = 0) {
  if (!enabled) return
  const ctx = create()
  if (!ctx) return
  try {
    if (ctx.state === 'suspended') void ctx.resume()
    notes.forEach((frequency, index) => {
      const start = ctx.currentTime + delay + index * step
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.type = wave
      oscillator.frequency.setValueAtTime(frequency, start)
      // Ataque y caída suaves: un tono que arranca y corta en seco chasquea.
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.linearRampToValueAtTime(volume, start + Math.min(0.012, step * 0.2))
      gain.gain.exponentialRampToValueAtTime(0.0001, start + step)
      oscillator.connect(gain).connect(ctx.destination)
      oscillator.start(start)
      oscillator.stop(start + step + 0.02)
    })
  } catch {
    // Un dispositivo que no puede sonar no debe romper la partida.
  }
}

/**
 * Vibración corta en Android. Safari de iPhone no tiene esta API y la ignora.
 * Respeta el interruptor de sonido: quien silenció la Arena tampoco quiere que
 * el teléfono le tiemble en la mano.
 */
export function vibrate(ms: number) {
  if (!enabled) return
  try {
    navigator.vibrate?.(ms)
  } catch {
    // Sin vibración no pasa nada.
  }
}

/**
 * Golpecitos de la ruleta. Se programan en el reloj de audio —no con
 * temporizadores de la página, que en un celular se retrasan— y se van
 * espaciando igual que frena la rueda: muy seguidos al arrancar, cada vez más
 * separados al final. La curva imita la del giro (arranque rápido, frenada larga).
 */
function spin(durationMs: number) {
  if (!enabled) return
  const total = durationMs / 1000
  const steps = 34
  // La rueda recorre su camino como 1 − (1 − t)^3,2 (arranque rápido, frenada
  // larga). Se deja caer un golpe cada vez que avanza 1/34 del recorrido, así
  // que el momento del golpe n es la inversa de esa curva en n/34.
  for (let index = 1; index <= steps; index++) {
    const time = (1 - Math.pow(1 - index / steps, 1 / 3.2)) * total * 0.94
    play([1150 - index * 9], 0.028, 'square', 0.07, time)
  }
}

export const arenaSound = {
  unlock,
  spin,
  /** Toque sobre una opción o un botón del juego. */
  tap: () => play([520], 0.06, 'triangle', 0.12),
  /** Envío de la respuesta: no dice si acertaste, porque el servidor tampoco. */
  send: () => play([620, 820], 0.07, 'triangle', 0.16),
  /** La rueda se detuvo contra el tope. */
  land: () => play([330, 660], 0.09, 'triangle', 0.2),
  /** Anuncio del tema que tocó: fanfarria corta. */
  reveal: () => play([523, 659, 784, 1046], 0.11, 'triangle', 0.18),
  /** Las opciones entran en pantalla. */
  options: () => play([440, 587], 0.07, 'sine', 0.12),
  /** Últimos segundos del reloj: un golpe por segundo. */
  tick: () => play([900], 0.05, 'square', 0.08),
  /** Se agotó el tiempo. */
  timeout: () => play([420, 300], 0.16, 'sine', 0.16),
  /** Se gastó el bono. */
  power: () => play([880, 660, 1100], 0.07, 'sine', 0.16),
  /** Acertó: dos notas que suben. */
  correct: () => play([784, 1175], 0.12, 'triangle', 0.2),
  /** Falló: dos notas graves que bajan, sin estridencia. */
  wrong: () => play([311, 233], 0.16, 'sawtooth', 0.09),
  win: () => play([660, 830, 990, 1320], 0.12, 'triangle', 0.2),
  draw: () => play([700, 700], 0.14, 'sine', 0.16),
  lose: () => play([440, 350], 0.18, 'sine', 0.15),
}
