import { BrainCircuit, Check, CheckCircle2, Clipboard, ExternalLink, Image, Loader2, MessageSquareText, Save, Sparkles } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import type { ConstruyeTeamBrief } from '../../lib/api/construye'

const defaultBrief: ConstruyeTeamBrief = {
  problem: '', audience: 'Estudiantes de mi curso', subject: '', grade: '8.º', features: '', style: 'Claro, accesible y juvenil',
}

const fieldClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100'

function promptFor(brief: ConstruyeTeamBrief) {
  return `Actúa como una guía de programación para estudiantes de ${brief.grade}. Necesitamos construir una aplicación web educativa sencilla.

Contexto del proyecto
- Problema que queremos resolver: ${brief.problem || '[explicar el problema]'}
- Usuarios: ${brief.audience || '[definir usuarios]'}
- Área o asignatura: ${brief.subject || '[definir asignatura]'}
- Funciones que esperamos: ${brief.features || '[enumerar 3 a 5 funciones]'}
- Estilo visual: ${brief.style || '[definir estilo]'}

Entrega únicamente tres archivos completos y separados: index.html, styles.css y app.js. No uses React, npm, paquetes, enlaces externos, llamadas a internet, cuentas, anuncios, APIs, iframes ni datos privados. Explica brevemente qué hace cada archivo y cómo probarlo.

La app se va a ver principalmente en la pantalla de un celular, en un espacio angosto de unos 360 a 420 píxeles de ancho. Usa un tamaño de letra base de 16px, títulos moderados (18-22px, nunca el tamaño gigante que pone el navegador por defecto en h1/h2), y texto de 14-16px con relleno corto en los botones. No diseñes pensando en una pantalla de computador: nada de anchos fijos grandes, columnas lado a lado ni fuentes que ocupen media pantalla.

Para los íconos o ilustraciones, crea SVG pequeños dentro de index.html o indícame el SVG exacto que debo pegar. No uses imágenes con licencia desconocida ni URLs externas. Antes de escribir código, hazme máximo tres preguntas cortas si falta una decisión importante.`
}

export interface BriefBuilderProps {
  initialBrief?: ConstruyeTeamBrief | null
  onSave?: (brief: ConstruyeTeamBrief) => Promise<boolean>
  onPromptCopied?: () => void
}

export default function BriefBuilder({ initialBrief, onSave, onPromptCopied }: BriefBuilderProps = {}) {
  const startingBrief = initialBrief ?? defaultBrief
  const [brief, setBrief] = useState<ConstruyeTeamBrief>(() => startingBrief)
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(startingBrief))
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const prompt = useMemo(() => promptFor(brief), [brief])
  const hasChanges = JSON.stringify(brief) !== savedSnapshot
  const set = <K extends keyof ConstruyeTeamBrief>(key: K, value: ConstruyeTeamBrief[K]) => setBrief(current => ({ ...current, [key]: value }))

  async function saveBrief() {
    if (!onSave || !hasChanges || saving) return
    setSaving(true)
    try {
      const saved = await onSave(brief)
      if (saved) setSavedSnapshot(JSON.stringify(brief))
    } finally {
      setSaving(false)
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      onPromptCopied?.()
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return <section className="mt-6 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-orange-50 via-white to-cyan-50 px-5 py-5 sm:px-6">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-orange-200 text-orange-950"><BrainCircuit className="h-5 w-5" /></span>
        <div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-orange-700">Etapa 1 · Imaginen</p><h2 className="mt-0.5 text-lg font-bold text-slate-900">Preparen una buena conversación con la IA</h2><p className="mt-1 max-w-2xl text-sm text-slate-600">Antes de pedir código, pónganse de acuerdo sobre el problema, las personas y las funciones de su proyecto.</p></div>
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-white px-3 py-1.5 text-xs font-semibold text-orange-800"><MessageSquareText className="h-3.5 w-3.5" /> La IA propone · el equipo decide</span>
    </header>
    <div className="grid gap-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,.95fr)]">
    <div className="p-5 sm:p-6">
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Label text="¿Qué problema resolverá la app?" wide><textarea value={brief.problem} onChange={event => set('problem', event.target.value)} className={`${fieldClass} min-h-24`} placeholder="Ej.: ayudar a separar residuos en el colegio" /></Label>
        <Label text="¿Para quién es?" ><input value={brief.audience} onChange={event => set('audience', event.target.value)} className={fieldClass} /></Label>
        <Label text="Asignatura o tema"><input value={brief.subject} onChange={event => set('subject', event.target.value)} className={fieldClass} placeholder="Ej.: Ciencias naturales" /></Label>
        <Label text="Grado"><select value={brief.grade} onChange={event => set('grade', event.target.value as ConstruyeTeamBrief['grade'])} className={fieldClass}>{['8.º', '9.º', '10.º', '11.º'].map(grade => <option key={grade}>{grade}</option>)}</select></Label>
        <Label text="Funciones que debe tener" wide><textarea value={brief.features} onChange={event => set('features', event.target.value)} className={`${fieldClass} min-h-20`} placeholder="Ej.: un selector de residuos, consejos y un reto de preguntas" /></Label>
        <Label text="Estilo visual" wide><input value={brief.style} onChange={event => set('style', event.target.value)} className={fieldClass} /></Label>
      </div>
      <div className="mt-4 flex gap-3 rounded-2xl border border-sky-100 bg-sky-50 p-3 text-sm text-sky-900"><Image className="h-5 w-5 shrink-0" /><p><strong>Consejo visual:</strong> para la primera versión, pídanle a la IA ilustraciones SVG sencillas. Así podrán probarlas de forma segura.</p></div>
      {onSave && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          {hasChanges ? <><span className="h-2 w-2 rounded-full bg-amber-500" /><span>Hay decisiones nuevas por guardar en la bitácora.</span></> : <><CheckCircle2 className="h-4 w-4 text-emerald-600" /><span>{initialBrief ? 'La idea del equipo está guardada.' : 'Sin cambios pendientes.'}</span></>}
        </div>
        <button type="button" disabled={!hasChanges || saving} onClick={saveBrief} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Guardando…' : 'Guardar idea del equipo'}
        </button>
      </div>}
    </div>
    <aside className="border-t border-slate-200 bg-[#152534] p-5 text-white lg:border-l lg:border-t-0 sm:p-6">
      <div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-cyan-300">Petición preparada</p><h2 className="mt-1 font-bold">Prompt listo para revisar</h2></div><Sparkles className="h-5 w-5 text-amber-300" /></div>
      <p className="mt-1 text-sm text-slate-300">Edusyn no lo envía automáticamente. El equipo puede leerlo y corregirlo primero.</p>
      <pre className="mt-4 max-h-[340px] overflow-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-[#0d1822] p-4 text-xs leading-5 text-slate-200 shadow-inner">{prompt}</pre>
      <button type="button" onClick={copyPrompt} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-950/30 hover:bg-cyan-200">{copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}{copied ? 'Prompt copiado' : 'Copiar para la IA externa'}</button>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400"><ExternalLink className="h-3.5 w-3.5" /> Abran su IA en otra pestaña y peguen este texto.</p>
    </aside>
    </div>
  </section>
}

function Label({ text, children, wide = false }: { text: string; children: ReactNode; wide?: boolean }) {
  return <label className={wide ? 'sm:col-span-2' : ''}><span className="mb-1.5 block text-sm font-medium text-slate-700">{text}</span>{children}</label>
}
