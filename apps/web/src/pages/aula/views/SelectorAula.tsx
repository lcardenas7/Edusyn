/**
 * La lista de aulas: la puerta de entrada.
 *
 * Qué corrige:
 *  - B6  `isActive` existía en el tipo y no se usaba: un aula archivada se veía igual que una
 *        activa. Ahora se marca y se ordena al final.
 *  - E9  El contador caía en `_count.sections` cuando `studentCount` venía en 0, así que
 *        enseñaba el número de SECCIONES con la etiqueta "estudiantes". Si no hay dato, no se
 *        inventa.
 *  - D    Error y vacío se mostraban a la vez, contradiciéndose. `AulaState` los excluye.
 *  - E    El estado vacío del docente no tenía acción; el botón de crear estaba lejos, arriba.
 */

import type { AulaListada } from '../data/useAula'
import { AulaState, EmptyState } from '../ui/EmptyState'
import { SubjectMark, SubjectPattern, subjectIdentity } from '../visual/SubjectMark'

export interface SelectorAulaProps {
  nombre: string
  role: 'docente' | 'estudiante'
  aulas: AulaListada[]
  cargando: boolean
  error: string | null
  onReintentar: () => void
  onEntrar: (aulaId: string) => void
  onCrear?: () => void
  /** Vía de vuelta al aula actual. El interruptor tiene que funcionar en los dos sentidos. */
  onVolverAlActual?: () => void
}

export function SelectorAula({
  nombre,
  role,
  aulas,
  cargando,
  error,
  onReintentar,
  onEntrar,
  onCrear,
  onVolverAlActual,
}: SelectorAulaProps) {
  // Las archivadas al final: siguen accesibles, pero no compiten con las del período en curso.
  const ordenadas = [...aulas].sort((a, b) => {
    if (a.activa !== b.activa) return a.activa ? -1 : 1
    return `${a.asignatura ?? a.titulo}`.localeCompare(`${b.asignatura ?? b.titulo}`, 'es')
  })

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h1-lg font-bold text-ink-primary">Hola, {nombre} 👋</h1>
          <p className="mt-1 text-body-base text-ink-secondary">
            {role === 'docente' ? 'Estas son tus aulas. ¿Por dónde empezamos?' : 'Estas son tus clases.'}
          </p>
        </div>
        {onVolverAlActual && (
          <button
            type="button"
            onClick={onVolverAlActual}
            className="min-h-btn rounded-lg border border-hairline bg-surface-1 px-3 text-body-sm font-medium text-ink-secondary transition-colors hover:text-ink-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            Volver al aula de siempre
          </button>
        )}
      </header>

      <p className="mb-5 rounded-card border border-accent/25 bg-accent/[0.06] px-4 py-3 text-body-sm text-ink-secondary">
        Estás probando el <strong className="font-semibold text-ink-primary">aula rediseñada</strong>. Tus
        actividades, entregas y notas son las mismas de siempre: esto solo cambia cómo se ven. Puedes volver
        cuando quieras.
      </p>

      <AulaState
        loading={cargando}
        error={error}
        onRetry={onReintentar}
        isEmpty={ordenadas.length === 0}
        skeleton={<SelectorSkeleton />}
        empty={
          role === 'docente' ? (
            <EmptyState
              scene="sin-aulas"
              title="Todavía no tienes aulas"
              detail="Crea un aula para una de tus asignaturas y empieza a publicar contenido."
              action={onCrear ? { label: 'Crear aula', onClick: onCrear } : undefined}
            />
          ) : (
            <EmptyState
              scene="sin-aulas"
              title="Aún no tienes clases aquí"
              detail="Cuando tus profesores abran el aula de una asignatura, la verás en esta lista."
            />
          )
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ordenadas.map((a) => (
            <TarjetaAula key={a.id} aula={a} role={role} onEntrar={onEntrar} />
          ))}
        </div>
      </AulaState>
    </div>
  )
}

function TarjetaAula({
  aula,
  role,
  onEntrar,
}: {
  aula: AulaListada
  role: 'docente' | 'estudiante'
  onEntrar: (id: string) => void
}) {
  const identidad = subjectIdentity(aula.asignatura)
  const nombre = aula.asignatura ?? aula.titulo
  const grupo = [aula.grado, aula.grupo].filter(Boolean).join(' ')

  return (
    <button
      type="button"
      onClick={() => onEntrar(aula.id)}
      className={`group relative overflow-hidden rounded-modal border border-hairline bg-surface-1 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-accent/40 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
        aula.activa ? '' : 'opacity-70'
      }`}
      style={{ ['--skill-accent' as string]: hexARgb(identidad.hue.ink) }}
    >
      {/* La carátula: el glifo de la asignatura, repetido en muy bajo contraste. */}
      <SubjectPattern subject={aula.asignatura} opacity={0.07} />

      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <SubjectMark subject={aula.asignatura} size={48} />
          {!aula.activa && (
            <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink-muted">
              Archivada
            </span>
          )}
        </div>

        <h2 className="mt-4 text-h3 font-bold text-ink-primary">{nombre}</h2>
        {grupo && <p className="mt-0.5 text-body-sm text-ink-secondary">{grupo}</p>}

        {/* Si no hay dato de estudiantes, no se inventa uno (defecto E9). */}
        {role === 'docente' && aula.estudiantes != null && (
          <p className="mt-3 text-body-sm text-ink-muted">
            {aula.estudiantes} {aula.estudiantes === 1 ? 'estudiante' : 'estudiantes'}
          </p>
        )}
      </div>
    </button>
  )
}

function SelectorSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-modal border border-hairline bg-surface-1 p-5">
          <div className="h-12 w-12 animate-pulse rounded-2xl bg-surface-3 motion-reduce:animate-none" />
          <div className="mt-4 h-5 w-2/3 animate-pulse rounded bg-surface-3 motion-reduce:animate-none" />
          <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
        </div>
      ))}
      <span className="sr-only">Cargando tus aulas…</span>
    </div>
  )
}

/** "#2E6BE6" → "46 107 230", el formato de los tokens del DS. */
function hexARgb(hex: string): string {
  const v = hex.replace('#', '')
  const n = parseInt(v.length === 3 ? v.split('').map((c) => c + c).join('') : v, 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}
