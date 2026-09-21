import { ArrowLeft, ArrowRight, Check, Clipboard, ClipboardPaste, Code2, MessageSquareText, RotateCcw, ShieldCheck, SkipForward } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ConstruyeTeamBrief } from '../../lib/api/construye'
import { toast } from '../../lib/toast'
import { initialPrompt, promptReady } from './journey'
import { missingForPrompt } from './DocumentStep'

/** Petición guiada para una IA externa, armada con lo que el equipo documentó. Es opcional:
 * se puede omitir y empezar a construir con el ejemplo o escribiendo el código a mano. */
export default function PromptStep({ brief, onBack, onGoCode, onSkip, onCopied }: {
  brief: ConstruyeTeamBrief
  onBack: () => void
  onGoCode: () => void
  onSkip: () => void
  onCopied?: () => void
}) {
  const generated = useMemo(() => initialPrompt(brief), [brief])
  const [text, setText] = useState(generated)
  const [edited, setEdited] = useState(false)
  const [copied, setCopied] = useState(false)
  useEffect(() => { if (!edited) setText(generated) }, [generated, edited])
  const ready = promptReady(brief)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      onCopied?.()
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('No se pudo copiar. Selecciona el texto y cópialo a mano.')
    }
  }

  return <section className="min-h-full bg-slate-50 px-4 py-5 sm:px-8 sm:py-7">
    <div className="mx-auto max-w-5xl">
      <p className="text-[11px] font-bold uppercase tracking-[.16em] text-cyan-700">Paso opcional</p>
      <h2 className="mt-1 text-2xl font-bold text-slate-900">Pedirle a una IA la primera versión</h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">La petición ya trae su plan. La IA propone el código; ustedes lo revisan, lo prueban y deciden qué dejar. Si prefieren construir sin IA, pueden omitir este paso.</p>

      {!ready && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        La petición queda mejor con el plan completo. Falta: {missingForPrompt(brief).join(', ')}.
        <button type="button" onClick={onBack} className="ml-2 font-semibold underline">Volver a documentar</button>
      </div>}

      <div className="mt-5 grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <ol className="space-y-3 text-sm">
          {[
            { icon: Clipboard, title: 'Copien la petición', text: 'Revísenla y corrijan lo que no les suene.' },
            { icon: MessageSquareText, title: 'Péguenla en su IA', text: 'ChatGPT, Gemini u otra. Si la IA pregunta algo, respondan con sus decisiones.' },
            { icon: ClipboardPaste, title: 'Traigan el código al taller', text: 'Peguen cada archivo en su pestaña: Contenido (index.html), Diseño (styles.css) y Acciones (app.js).' },
          ].map((step, i) => <li key={step.title} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-cyan-600 text-xs font-bold text-white">{i + 1}</span>
            <span><span className="flex items-center gap-1.5 font-semibold text-slate-800"><step.icon className="h-3.5 w-3.5 text-cyan-700" /> {step.title}</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">{step.text}</span></span>
          </li>)}
          <li className="flex items-start gap-2 px-1 text-xs leading-5 text-slate-500"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> No incluyan nombres, documentos ni datos personales en la petición.</li>
        </ol>

        <div className="rounded-xl bg-[#152534] p-4 text-white">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[.16em] text-cyan-300">Nuestra petición</p>
            {edited && <button type="button" onClick={() => { setEdited(false); setText(generated) }} className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-300 hover:underline"><RotateCcw className="h-3 w-3" /> Volver a la del plan</button>}
          </div>
          <textarea value={text} onChange={event => { setText(event.target.value); setEdited(true) }} rows={16} aria-label="Petición para la IA" className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-[#0d1822] p-3 font-mono text-[12px] leading-5 text-slate-200 outline-none focus:ring-2 focus:ring-cyan-400" />
          <button type="button" onClick={copy} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-200">{copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}{copied ? 'Petición copiada' : 'Copiar petición'}</button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-white"><ArrowLeft className="h-4 w-4" /> Volver a documentar</button>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onSkip} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"><SkipForward className="h-4 w-4" /> Omitir: construir sin IA</button>
          <button type="button" onClick={onGoCode} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"><Code2 className="h-4 w-4" /> Ya tengo el código: ir al taller <ArrowRight className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  </section>
}
