import { UserRound, Users } from 'lucide-react'
import { groupByAspect } from './formativeDraft'

interface PreviewLevel { label: string; description?: string | null }
interface PreviewCriterion { name: string; description?: string | null; levels: PreviewLevel[] }
export interface PreviewDimension { label: string; evaluatorType: string; peersPerStudent?: number | null; criteria: PreviewCriterion[] }

/** Una dimensión tal como la verá el estudiante (sin poder responder). La usan el editor y la
 * lista de evaluaciones, para que el docente revise las preguntas sin adivinar. */
export function DimensionPreview({ dimension }: { dimension: PreviewDimension }) {
  const peer = dimension.evaluatorType === 'PEER'
  return <div className="rounded-xl border border-slate-200 bg-white p-4">
    <p className="font-semibold text-slate-800">{dimension.label}</p>
    <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
      {peer
        ? <><Users className="h-4 w-4 shrink-0 text-teal-700" /> El estudiante responde sobre {dimension.peersPerStudent && dimension.peersPerStudent > 1 ? `cada uno de sus ${dimension.peersPerStudent} compañeros` : 'un compañero'}: «Evalúas a <b className="text-slate-800">[nombre del compañero]</b>».</>
        : <><UserRound className="h-4 w-4 shrink-0 text-teal-700" /> El estudiante responde sobre sí mismo.</>}
    </p>
    <p className="mt-1 text-xs text-slate-500">{dimension.criteria.length} preguntas</p>
    <div className="mt-3 space-y-4">
      {groupByAspect(dimension.criteria).map((group, g) => <section key={g}>
        <p className="text-xs font-bold uppercase tracking-wide text-teal-800">{group.aspect || 'Sin aspecto'}</p>
        <ol className="mt-1.5 space-y-2">
          {group.items.map(({ criterion: c, index }) => <li key={index} className="rounded-lg border border-slate-200 p-3">
            {c.description ? <p className="text-sm text-slate-800"><span className="font-semibold">{index + 1}.</span> {c.description}</p> : <p className="text-xs italic text-amber-700">{index + 1}. Falta la frase que lee el estudiante.</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {c.levels.map((l, k) => <span key={k} title={l.description || undefined} className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-700">{l.label}</span>)}
            </div>
          </li>)}
        </ol>
      </section>)}
    </div>
  </div>
}
