/**
 * Galería visual del Aula — **solo desarrollo**.
 *
 * Vive fuera del enrutador de la app: se sirve en `/galeria-aula.html` con `npm run dev` y no
 * entra al build de producción (Vite solo empaqueta `index.html` como entrada).
 *
 * Para qué sirve: revisar la capa de ilustración de un vistazo, en claro y con los tokens
 * reales, sin tener que navegar el aula entera. Cuando cambies un glifo, míralo aquí primero.
 */

import { createRoot } from 'react-dom/client'
import '../../../index.css'
import { SubjectMark, SubjectPattern, subjectIdentity } from './SubjectMark'
import { ActivityGlyph } from './ActivityGlyph'
import { ProgressRing, Stamp } from './Progress'
import { Scene, type SceneName } from './Scene'
import { ALL_FAMILIES, familyMeta } from '../model/labels'

const ASIGNATURAS = [
  'Matemáticas',
  'Lengua Castellana',
  'Ciencias Naturales',
  'Ciencias Sociales',
  'Inglés',
  'Educación Física',
  'Educación Artística',
  'Tecnología e Informática',
  'Ética y Valores',
  'Filosofía',
  'Música',
  'Emprendimiento',
]

const ESCENAS: SceneName[] = [
  'sin-actividades',
  'todo-al-dia',
  'sin-resultados',
  'sin-unidades',
  'sin-anuncios',
  'sin-aulas',
]

function Bloque({ titulo, nota, children }: { titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="text-h3 font-semibold text-ink-primary">{titulo}</h2>
      {nota && <p className="mt-1 max-w-2xl text-body-sm text-ink-muted">{nota}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Galeria() {
  return (
    <div className="min-h-screen bg-canvas px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10">
          <p className="text-body-sm font-medium tracking-wide text-accent uppercase">Solo desarrollo</p>
          <h1 className="mt-1 text-h1-lg font-bold text-ink-primary">Galería visual del Aula</h1>
          <p className="mt-2 max-w-2xl text-body-base text-ink-secondary">
            La capa de ilustración del aula rediseñada. Todo es SVG en línea: nada que descargar y
            escala sin pixelarse. El dibujo aporta <strong>identidad</strong>; el estado siempre se
            dice además con texto.
          </p>
        </header>

        <Bloque
          titulo="Glifos en detalle"
          nota="A tamaño grande, para revisar el trazo. En la app se usan entre 40 y 56 px."
        >
          <div className="flex flex-wrap gap-4 rounded-card border border-hairline bg-surface-1 p-5">
            {ASIGNATURAS.map((s) => (
              <SubjectMark key={s} subject={s} size={96} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 rounded-card border border-hairline bg-surface-1 p-5">
            {ALL_FAMILIES.map((f) => (
              <ActivityGlyph key={f} family={f} size={96} />
            ))}
          </div>
        </Bloque>

        <Bloque
          titulo="Marca de asignatura"
          nota="Cada asignatura tiene glifo y color propios, deducidos de su nombre. Se repite en la tarjeta del aula, la carátula de unidad y el encabezado."
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {ASIGNATURAS.map((s) => {
              const id = subjectIdentity(s)
              return (
                <div
                  key={s}
                  className="flex items-center gap-3 rounded-card border border-hairline bg-surface-1 p-3"
                >
                  <SubjectMark subject={s} size={44} />
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-medium text-ink-primary">{s}</p>
                    <p className="text-xs text-ink-muted">{id.key}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </Bloque>

        <Bloque
          titulo="Carátula de unidad"
          nota="El mismo glifo, repetido en muy bajo contraste, convierte una tarjeta blanca en la portada de la asignatura sin gritar."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {['Matemáticas', 'Ciencias Naturales'].map((s) => {
              const hue = subjectIdentity(s).hue
              return (
                <div
                  key={s}
                  className="relative overflow-hidden rounded-modal border border-hairline bg-surface-1 p-5"
                >
                  <SubjectPattern subject={s} />
                  <div className="relative flex items-start gap-4">
                    <SubjectMark subject={s} size={52} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold tracking-wide uppercase" style={{ color: hue.deep }}>
                        Unidad 3
                      </p>
                      <h3 className="mt-0.5 text-h3 font-bold text-ink-primary">Álgebra básica</h3>
                      <p className="mt-1 text-body-sm text-ink-muted">6 actividades · 2 recursos</p>
                    </div>
                    <ProgressRing value={62} size={52} color={hue.ink} />
                  </div>
                </div>
              )
            })}
          </div>
        </Bloque>

        <Bloque
          titulo="Tipos de actividad"
          nota="Cada familia tiene silueta propia, no un icono genérico teñido: un examen y un quiz se distinguen de reojo."
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {ALL_FAMILIES.map((f) => {
              const meta = familyMeta(f)
              return (
                <div key={f} className="flex items-start gap-3 rounded-card border border-hairline bg-surface-1 p-3">
                  <ActivityGlyph family={f} size={44} />
                  <div className="min-w-0">
                    <p className="text-body-sm font-medium text-ink-primary">{meta.label}</p>
                    <p className="mt-0.5 text-xs leading-snug text-ink-muted">{meta.hint}</p>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            Comprobación del mapeo enum → familia, tal como llega del backend:
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {['TASK', 'QUIZ', 'EXAM', 'LIVE_QUIZ', 'HOME_QUIZ', 'ICFES_SIMULATOR', 'LESSON', 'GAME', 'SELF_ASSESSMENT', 'DESCONOCIDO'].map(
              (t) => (
                <div key={t} className="flex items-center gap-2 rounded-card border border-hairline bg-surface-1 px-2.5 py-1.5">
                  <ActivityGlyph type={t} size={30} />
                  <span className="text-xs text-ink-muted">{t}</span>
                </div>
              ),
            )}
          </div>
        </Bloque>

        <Bloque titulo="Avance y cierre" nota="El anillo se lee de reojo; el sello da el cierre que una barra al 100% no da.">
          <div className="flex flex-wrap items-center gap-6 rounded-card border border-hairline bg-surface-1 p-5">
            {[0, 25, 60, 100].map((v) => (
              <ProgressRing key={v} value={v} size={64} />
            ))}
            <div className="flex items-center gap-4">
              <Stamp kind="entregada" size={88} color="#2E6BE6" />
              <Stamp kind="calificada" size={88} />
              <Stamp kind="al-dia" size={88} color="#6B4BD8" />
            </div>
          </div>
        </Bloque>

        <Bloque
          titulo="Estados vacíos"
          nota="Un vacío es una conversación: o falta algo por hacer, o el estudiante hizo todo y merece saberlo."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ESCENAS.map((n) => (
              <div
                key={n}
                className="flex flex-col items-center rounded-card border border-hairline bg-surface-1 p-5 text-center"
              >
                <Scene name={n} width={168} />
                <p className="mt-2 text-body-sm font-medium text-ink-primary">{n}</p>
              </div>
            ))}
          </div>
        </Bloque>
      </div>
    </div>
  )
}

createRoot(document.getElementById('galeria')!).render(<Galeria />)
