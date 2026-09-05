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
import { ArrowRight } from 'lucide-react'
import type { AulaListada } from '../data/useAula'
import { compararGrados, etiquetaDeGrupo } from '../model/grados'
import { AulaState, EmptyState } from '../ui/EmptyState'
import { subjectIdentity } from '../visual/SubjectMark'
import { SubjectCover } from '../visual/SubjectCover'
import type { AvanceDeAula } from '../data/useProgresoAulas'

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
  /** Avance del estudiante por aula. Llega en segundo plano; puede faltar. */
  avances?: Record<string, AvanceDeAula>
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
  avances = {},
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
                    avance={avances[a.id]}
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
  avance,
  onEntrar,
}: {
  aula: AulaListada
  role: 'docente' | 'estudiante'
  mandaElGrupo: boolean
  avance?: AvanceDeAula
  onEntrar: (id: string) => void
}) {
  const identidad = subjectIdentity(aula.asignatura)
  // El color que el docente eligió gana: cuando todas las aulas son de la misma asignatura, es
  // lo único que las distingue de un vistazo.
  const color = aula.color?.trim() || identidad.hue.ink

  const grupoTexto = etiquetaDeGrupo(aula.grado, aula.grupo)
  const asignatura = aula.asignatura ?? aula.titulo

  const titular = mandaElGrupo ? grupoTexto || asignatura : asignatura
  const secundario = mandaElGrupo ? asignatura : grupoTexto

  const empezado = avance != null && avance.hechas > 0

  return (
    <button
      type="button"
      onClick={() => onEntrar(aula.id)}
      className={`group flex w-full flex-col overflow-hidden rounded-modal border border-hairline bg-surface-1 text-left transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
        aula.activa ? '' : 'opacity-70'
      }`}
      style={{ ['--skill-accent' as string]: hexARgb(color) }}
    >
      {/* La portada: es lo que hace que la lista se vea como un aula y no como una tabla. */}
      <span className="relative block">
        <SubjectCover subject={aula.asignatura} color={color} />
        {!aula.activa && (
          <span className="absolute top-2.5 right-2.5 rounded-full bg-surface-1/90 px-2.5 py-1 text-xs font-medium text-ink-muted backdrop-blur">
            Archivada
          </span>
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col p-4">
        <span className="block text-h3 leading-tight font-bold break-words text-ink-primary">{titular}</span>
        {secundario && <span className="mt-0.5 block truncate text-body-sm text-ink-secondary">{secundario}</span>}

        {/* Avance real, no decorativo: sale de las actividades del aula. Si todavía no ha
            llegado, no se dibuja una barra vacía que parezca un cero. */}
        {role === 'estudiante' && avance && (
          <span className="mt-3 block">
            <span className="flex items-center justify-between text-body-sm">
              <span className="text-ink-secondary">
                {avance.hechas} de {avance.total}
              </span>
              <span className="font-semibold text-ink-primary tabular-nums">{avance.pct}%</span>
            </span>
            <span
              className="mt-1 block h-2 overflow-hidden rounded-full bg-surface-3"
              role="img"
              aria-label={`Avance: ${avance.pct} por ciento`}
            >
              <span
                className="block h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
                style={{ width: `${avance.pct}%`, backgroundColor: color }}
              />
            </span>
          </span>
        )}

        {role === 'docente' && aula.estudiantes != null && (
          <span className="mt-3 block text-body-sm text-ink-muted">
            {aula.estudiantes} {aula.estudiantes === 1 ? 'estudiante' : 'estudiantes'}
          </span>
        )}

        {/* Acción explícita. La tarjeta entera sigue siendo pulsable, pero un botón visible
            dice qué pasa al tocarla — y para el estudiante distingue empezar de continuar. */}
        <span className="mt-4 inline-flex min-h-btn items-center justify-center gap-1.5 rounded-lg px-4 text-body-sm font-semibold text-white transition-opacity group-hover:opacity-90" style={{ backgroundColor: color }}>
          {role === 'estudiante' ? (empezado ? 'Continuar' : 'Empezar') : 'Entrar'}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </span>
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
