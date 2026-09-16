import { Check, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatBogota } from '../../lib/datetime'
import { construyeApi, type ConstruyeTeamBrief, type ConstruyeTeamDetail } from '../../lib/api/construye'
import { buildPhaseState, evidenceByVersion, normalizeBrief, phaseState, type JourneyPhaseState } from './journey'

const PHASE_CHIPS = [
  { key: 'problem', label: 'Problema' },
  { key: 'solution', label: 'Solución' },
  { key: 'plan', label: 'Plan v1' },
  { key: 'build', label: 'Versiones' },
  { key: 'share', label: 'Compartir' },
] as const

/** Avance del equipo en las cuatro fases, compacto para la tarjeta del docente. */
export function PhaseProgress({ brief, versionCount }: { brief: Partial<ConstruyeTeamBrief> | null; versionCount: number }) {
  const normalized = normalizeBrief(brief)
  const states: Record<(typeof PHASE_CHIPS)[number]['key'], JourneyPhaseState> = {
    problem: phaseState('problem', normalized),
    solution: phaseState('solution', normalized),
    plan: phaseState('plan', normalized),
    build: buildPhaseState(versionCount, versionCount > 0),
    share: phaseState('share', normalized),
  }
  return <ol className="mt-2 flex flex-wrap gap-1.5" aria-label="Avance del recorrido">
    {PHASE_CHIPS.map((chip, index) => {
      const state = states[chip.key]
      return <li key={chip.key} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${state === 'done' ? 'bg-emerald-100 text-emerald-800' : state === 'started' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>
        {state === 'done' ? <Check className="h-3 w-3" /> : <span>{index + 1}.</span>} {chip.label}
      </li>
    })}
  </ol>
}

const SECTIONS: { title: string; fields: { key: keyof ConstruyeTeamBrief; label: string }[] }[] = [
  { title: '1. El problema', fields: [{ key: 'problem', label: 'Qué ocurre' }, { key: 'affected', label: 'A quién afecta' }, { key: 'whyItMatters', label: 'Por qué importa' }] },
  { title: '2. La solución', fields: [{ key: 'solution', label: 'Qué hará' }, { key: 'audience', label: 'Quién la usará' }, { key: 'screens', label: 'Cómo se vería' }] },
  { title: '3. Plan de la versión 1', fields: [{ key: 'features', label: 'Qué tendrá' }, { key: 'later', label: 'Para después' }, { key: 'successCheck', label: 'Cómo sabrán que funciona' }] },
]
const SHARE_SECTION = { title: '5. Compartir y reflexionar', fields: [{ key: 'sharePitch', label: 'Presentación' }, { key: 'reflection', label: 'Qué aprendieron' }] } as { title: string; fields: { key: keyof ConstruyeTeamBrief; label: string }[] }

type TimelineItem = { id: string; at: string; kind: 'version' | 'change' | 'teacher' | 'prompt' | 'session'; title: string; lines: string[] }

function timeline(detail: ConstruyeTeamDetail): TimelineItem[] {
  const evidence = evidenceByVersion(detail.journal)
  const items: TimelineItem[] = detail.versions.map(version => {
    const ev = evidence.get(version.id)
    return {
      id: version.id, at: version.createdAt, kind: 'version', title: `Versión ${version.number}: ${ev?.attempted || version.label || 'sin descripción'}`,
      lines: ev ? [
        `Probaron: ${ev.tested}`,
        ...(ev.explained ? [`Saben explicar: ${ev.explained}`] : []),
        ...(ev.peerFeedback ? [`Otro equipo dijo: ${ev.peerFeedback}`] : []),
        ...(ev.learned ? [`Aprendieron: ${ev.learned}`] : []),
      ] : [],
    }
  })
  for (const entry of detail.journal) {
    const info = entry.detail && typeof entry.detail === 'object' ? entry.detail as Record<string, any> : {}
    if (entry.type === 'PROMPT_COPIED' && info.kind === 'CHANGE_REQUEST' && info.request) {
      const request = info.request as Record<string, string>
      items.push({ id: entry.id, at: entry.createdAt, kind: 'change', title: `Pidieron un cambio: ${request.change}`, lines: [
        ...(request.reason ? [`Por qué: ${request.reason}`] : []),
        ...(request.keep ? [`Conservar: ${request.keep}`] : []),
        `Cómo lo comprobarán: ${request.check}`,
      ] })
    } else if (entry.type === 'PROMPT_COPIED') {
      items.push({ id: entry.id, at: entry.createdAt, kind: 'prompt', title: entry.summary, lines: [] })
    } else if (entry.type === 'SESSION_NOTE') {
      items.push({ id: entry.id, at: entry.createdAt, kind: 'session', title: entry.summary, lines: info.kind === 'EXIT' && info.next ? [`Próxima vez: ${info.next}`] : [] })
    } else if (entry.type === 'TEACHER_COMMENT') {
      items.push({ id: entry.id, at: entry.createdAt, kind: 'teacher', title: entry.summary, lines: [] })
    }
  }
  return items.sort((a, b) => b.at.localeCompare(a.at))
}

const KIND_STYLE: Record<TimelineItem['kind'], string> = {
  version: 'bg-emerald-500', change: 'bg-violet-500', teacher: 'bg-slate-700', prompt: 'bg-cyan-500', session: 'bg-amber-400',
}

/** Lo que el docente necesita para acompañar el razonamiento del equipo, no solo la entrega:
 * sus decisiones por fase y, en orden, versiones con evidencia y peticiones de cambio. */
export default function TeamReasoning({ teamId }: { teamId: string }) {
  const [detail, setDetail] = useState<ConstruyeTeamDetail | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    construyeApi.teamDetail(teamId)
      .then(({ data }) => { if (active) setDetail(data) })
      .catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [teamId])

  if (failed) return <p className="mt-3 text-xs text-rose-700">No pudimos cargar el razonamiento del equipo.</p>
  if (!detail) return <p className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando…</p>

  const brief = normalizeBrief(detail.team.brief)
  const items = timeline(detail)

  return <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-white p-3">
    {SECTIONS.map(section => <div key={section.title}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-700">{section.title}</p>
      <dl className="mt-1 space-y-1 text-xs">
        {section.fields.map(field => <div key={field.key}>
          <dt className="inline font-semibold text-slate-600">{field.label}: </dt>
          <dd className="inline text-slate-700">{brief[field.key]?.toString().trim() || <em className="text-slate-400">sin escribir</em>}</dd>
        </div>)}
      </dl>
    </div>)}
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-700">4. Construir y probar</p>
      {items.length === 0
        ? <p className="mt-1 text-xs text-slate-400">Aún no hay versiones ni peticiones registradas.</p>
        : <ol className="mt-1 space-y-2">{items.map(item => <li key={item.id} className="flex gap-2 text-xs">
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${KIND_STYLE[item.kind]}`} />
          <div>
            <p className="font-medium text-slate-700">{item.title} <span className="font-normal text-slate-400">· {formatBogota(item.at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></p>
            {item.lines.map(line => <p key={line} className="text-slate-500">{line}</p>)}
          </div>
        </li>)}</ol>}
    </div>
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-700">{SHARE_SECTION.title}</p>
      <dl className="mt-1 space-y-1 text-xs">
        {SHARE_SECTION.fields.map(field => <div key={field.key}>
          <dt className="inline font-semibold text-slate-600">{field.label}: </dt>
          <dd className="inline whitespace-pre-line text-slate-700">{brief[field.key]?.toString().trim() || <em className="text-slate-400">sin escribir</em>}</dd>
        </div>)}
      </dl>
    </div>
  </div>
}
