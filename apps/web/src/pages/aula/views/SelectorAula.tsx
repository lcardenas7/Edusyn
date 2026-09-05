/**
 * La lista de aulas: la puerta de entrada.
 *
 * Qué corrige del aula actual:
 *  - B6  `isActive` existía en el tipo y no se usaba: un aula archivada se veía igual que una
 *        activa. Ahora se marca y se ordena al final.
 *  - E9  El contador caía en `_count.sections` cuando `studentCount` venía en 0, así que
 *        enseñaba el número de SECCIONES con la etiqueta "estudiantes". Si no hay dato, no se
 *        inventa.
 *  - D    Error y vacío se mostraban a la vez, contradiciéndose. `AulaState` los excluye.
 *  - E    El estado vacío del docente no tenía acción; el botón de crear estaba lejos, arriba.
 *
 * Y tres cosas que salieron probando con datos reales, con un docente de once aulas de la
 * MISMA asignatura:
 *
 *  1. **La tarjeta pone grande lo que distingue.** Con once aulas de Informática, poner
 *     "INFORMATICA" en titular y "Octavo C" en letra pequeña deja once tarjetas idénticas. Si
 *     todas comparten asignatura, manda el grupo; si hay varias, manda la asignatura. La
 *     tarjeta se adapta sola.
 *  2. **Agrupadas por grado**, como el aula actual, y en el orden real de la escalera escolar
 *     (`compararGrados`): por nombre, Décimo saldría antes que Sexto.
 *  3. **Se respeta el color que el docente eligió** para cada aula. Cuando todas son de la
 *     misma asignatura, ese color es lo único que las distingue de un vistazo, y la marca de
 *     asignatura por sí sola no aporta nada.
 */

import { useMemo } from 'react'
import type { AulaListada } from '../data/useAula'
import { compararGrados, etiquetaDeGrupo } from '../model/grados'
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

const SIN_GRADO = 'Otras'

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
  // ¿Todas las aulas son de la misma asignatura? Decide qué va en el titular de la tarjeta.
  const unaSolaAsignatura = useMemo(
    () => new Set(aulas.map((a) => (a.asignatura ?? '').trim().toLowerCase())).size <= 1,
    [aulas],
  )

  const grupos = useMemo(() => {
    const activas = aulas.filter((a) => a.activa)
    const archivadas = aulas.filter((a) => !a.activa)

    const porGrado = new Map<string, AulaListada[]>()
    for (const a of activas) {
      const g = a.grado?.trim() || SIN_GRADO
      if (!porGrado.has(g)) porGrado.set(g, [])
      porGrado.get(g)!.push(a)
    }

    const ordenados = [...porGrado.entries()]
      .map(([grado, lista]) => ({
        grado,
        // Dentro del grado, por nombre de grupo: A, B, C…
        aulas: [...lista].sort((x, y) => (x.grupo ?? '').localeCompare(y.grupo ?? '', 'es')),
      }))
      .sort((x, y) => compararGrados(x.grado, y.grado))

    // Las archivadas, todas juntas al final: siguen accesibles pero no compiten.
    if (archivadas.length > 0) {
      ordenados.push({
        grado: 'Archivadas',
        aulas: [...archivadas].sort((x, y) => compararGrados(x.grado, y.grado)),
      })
    }
    return ordenados
  }, [aulas])

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
        isEmpty={aulas.length === 0}
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
        <div className="space-y-7">
          {grupos.map((g) => (
            <section key={g.grado} aria-labelledby={`grado-${g.grado}`}>
              <h2
                id={`grado-${g.grado}`}
                className="mb-3 flex items-center gap-2 text-body-sm font-semibold tracking-wide text-ink-muted uppercase"
              >
                {g.grado}
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-ink-secondary normal-case">
                  {g.aulas.length}
                </span>
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {g.aulas.map((a) => (
                  <TarjetaAula
                    key={a.id}
                    aula={a}
                    role={role}
                    mandaElGrupo={unaSolaAsignatura}
                    onEntrar={onEntrar}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </AulaState>
    </div>
  )
}

function TarjetaAula({
  aula,
  role,
  mandaElGrupo,
  onEntrar,
}: {
  aula: AulaListada
  role: 'docente' | 'estudiante'
  mandaElGrupo: boolean
  onEntrar: (id: string) => void
}) {
  const identidad = subjectIdentity(aula.asignatura)
  // El color que el docente eligió gana: cuando todas las aulas son de la misma asignatura, es
  // lo único que las distingue de un vistazo.
  const color = aula.color?.trim() || identidad.hue.ink
  const hue = { ink: color, wash: `${color}1A`, deep: color }

  const grupoTexto = etiquetaDeGrupo(aula.grado, aula.grupo)
  const asignatura = aula.asignatura ?? aula.titulo

  const titular = mandaElGrupo ? grupoTexto || asignatura : asignatura
  const secundario = mandaElGrupo ? asignatura : grupoTexto

  return (
    <button
      type="button"
      onClick={() => onEntrar(aula.id)}
      className={`group relative overflow-hidden rounded-modal border border-hairline bg-surface-1 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-accent/40 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
        aula.activa ? '' : 'opacity-70'
      }`}
      style={{ ['--skill-accent' as string]: hexARgb(color) }}
    >
      {/* Franja del color del aula: es la señal que el docente ya usa para distinguirlas. */}
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: color }} />
      <SubjectPattern subject={aula.asignatura} hue={hue} opacity={0.05} />

      <div className="relative pt-1.5">
        <div className="flex items-start justify-between gap-2">
          <SubjectMark subject={aula.asignatura} size={44} hue={hue} />
          {!aula.activa && (
            <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink-muted">
              Archivada
            </span>
          )}
        </div>

        <h3 className="mt-3.5 text-h3 leading-tight font-bold text-ink-primary">{titular}</h3>
        {secundario && <p className="mt-0.5 truncate text-body-sm text-ink-secondary">{secundario}</p>}

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
          <div className="h-11 w-11 animate-pulse rounded-2xl bg-surface-3 motion-reduce:animate-none" />
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
  if (Number.isNaN(n)) return '46 107 230'
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}
