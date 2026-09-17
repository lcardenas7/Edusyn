import { UserRound, Users } from 'lucide-react'

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
    <ol className="mt-3 space-y-3">
      {dimension.criteria.map((c, i) => <li key={i} className="rounded-lg border border-slate-200 p-3">
        <p className="text-sm font-semibold text-slate-800">{i + 1}. {c.name || <span className="text-slate-400">Pregunta sin título</span>}</p>
        {c.description ? <p className="text-sm text-slate-600">{c.description}</p> : <p className="text-xs italic text-amber-700">Falta la frase que lee el estudiante.</p>}
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {c.levels.map((l, k) => <div key={k} className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs">
            <b className="text-slate-700">{l.label}</b>
            {l.description && <span className="block text-slate-500">{l.description}</span>}
          </div>)}
        </div>
      </li>)}
    </ol>
  </div>
}
