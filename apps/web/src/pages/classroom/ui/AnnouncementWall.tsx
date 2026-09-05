/**
 * El muro de anuncios, dentro de "Hoy".
 *
 * Decisión D1 del plan: "Anuncios" deja de ser una pestaña. Un anuncio que vive detrás de una
 * pestaña que nadie abre no es un anuncio. Aquí está donde el estudiante ya está mirando.
 *
 * El contenido de los anuncios es HTML del editor enriquecido del docente, así que se limpia
 * a texto plano para la vista previa: insertarlo tal cual sería confiar en que ningún docente
 * pegue nunca nada raro.
 */

import { useState } from 'react'
import { ChevronDown, Megaphone, Pin } from 'lucide-react'
import { agoCopy } from '../model/countdown'
import { ordenarAnuncios, type AnnouncementLike } from '../model/today'
import { Scene } from '../visual/Scene'

/** HTML del editor → texto plano. Sin `dangerouslySetInnerHTML` en una vista previa. */
function aTextoPlano(html: string): string {
  if (typeof document === 'undefined') return html.replace(/<[^>]*>/g, ' ')
  const div = document.createElement('div')
  div.innerHTML = html
  return (div.textContent ?? '').replace(/\s+/g, ' ').trim()
}

export function AnnouncementWall({
  anuncios,
  now = new Date(),
  limite = 3,
}: {
  anuncios: AnnouncementLike[]
  now?: Date
  limite?: number
}) {
  const [verTodos, setVerTodos] = useState(false)
  const ordenados = ordenarAnuncios(anuncios)
  const visibles = verTodos ? ordenados : ordenados.slice(0, limite)

  if (ordenados.length === 0) {
    return (
      <section aria-labelledby="muro">
        <h2 id="muro" className="mb-3 flex items-center gap-2 text-body-base font-semibold text-ink-primary">
          <Megaphone className="h-4 w-4 text-ink-muted" aria-hidden="true" /> Anuncios
        </h2>
        <div className="flex flex-col items-center rounded-card border border-dashed border-hairline bg-surface-1 px-6 py-8 text-center">
          <Scene name="sin-anuncios" width={132} />
          <p className="mt-2 text-body-sm text-ink-secondary">Todavía no hay anuncios en esta aula.</p>
        </div>
      </section>
    )
  }

  return (
    <section aria-labelledby="muro">
      <h2 id="muro" className="mb-3 flex items-center gap-2 text-body-base font-semibold text-ink-primary">
        <Megaphone className="h-4 w-4 text-ink-muted" aria-hidden="true" /> Anuncios
      </h2>

      <div className="space-y-2">
        {visibles.map((a) => {
          const autor = [a.author?.firstName, a.author?.lastName].filter(Boolean).join(' ')
          return (
            <article
              key={a.id}
              className={`rounded-card border bg-surface-1 p-4 ${
                a.isPinned ? 'border-accent/30' : 'border-hairline'
              }`}
            >
              <div className="flex items-start gap-2">
                {a.isPinned && (
                  <span
                    className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent"
                    title="Fijado por el docente"
                  >
                    <Pin className="h-3 w-3" aria-hidden="true" /> Fijado
                  </span>
                )}
                <h3 className="min-w-0 flex-1 text-body-base font-semibold text-ink-primary">{a.title}</h3>
              </div>
              <p className="mt-1.5 line-clamp-3 text-body-sm text-ink-secondary">{aTextoPlano(a.content)}</p>
              <p className="mt-2 text-xs text-ink-muted">
                {autor ? `${autor} · ` : ''}
                {agoCopy(a.createdAt, now)}
              </p>
            </article>
          )
        })}
      </div>

      {ordenados.length > limite && (
        <button
          type="button"
          onClick={() => setVerTodos((v) => !v)}
          className="mt-2 inline-flex min-h-btn items-center gap-1 rounded-lg px-2 text-body-sm font-medium text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        >
          {verTodos ? 'Ver menos' : `Ver los ${ordenados.length} anuncios`}
          <ChevronDown
            className={`h-4 w-4 transition-transform motion-reduce:transition-none ${verTodos ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      )}
    </section>
  )
}
