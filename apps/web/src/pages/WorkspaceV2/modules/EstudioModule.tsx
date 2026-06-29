import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Loader2, ArrowLeft, Trash2, Save, Pencil, FileText, Clock, Target, ListChecks, ClipboardCheck, Accessibility, Plus } from 'lucide-react'
import { pedagogicalDesignApi } from '../../../lib/api'
import { toast } from '../../../lib/toast'

interface DesignListItem {
  id: string
  title: string
  summary?: string | null
  experienceType: string
  status: string
  updatedAt: string
}

interface DesignContent {
  identification?: { area?: string; subject?: string; grade?: string; sessions?: number; totalMinutes?: number }
  framework?: { competencies?: string[]; dba?: string[]; standards?: string[] }
  learning?: { objectives?: string[]; outcomes?: string[]; bloomLevels?: string[] }
  moments?: { phase?: string; minutes?: number; description?: string; activities?: string[] }[]
  activities?: { title?: string; description?: string; type?: string; minutes?: number; product?: string }[]
  evaluation?: { type?: string; criteria?: string[]; evidences?: string[] }
  rubric?: { criteria?: { name?: string; levels?: { label?: string; descriptor?: string; score?: number }[] }[] }
  dua?: { barriers?: string[]; adjustments?: string[] }
  resources?: { name?: string; url?: string }[]
  _placeholder?: boolean
}

interface FullDesign extends DesignListItem {
  content: DesignContent
  dna?: any
  aiProviderUsed?: string | null
}

const EXPERIENCE_TYPES: { key: string; label: string }[] = [
  { key: 'LESSON_PLAN', label: 'Plan de clase' },
  { key: 'SEQUENCE', label: 'Secuencia' },
  { key: 'PBL', label: 'Proyecto ABP' },
  { key: 'STEAM', label: 'STEAM' },
  { key: 'FLIPPED', label: 'Clase invertida' },
  { key: 'CHALLENGE', label: 'Reto' },
  { key: 'WORKSHOP', label: 'Taller' },
  { key: 'LAB', label: 'Laboratorio' },
  { key: 'UNIT', label: 'Unidad' },
]
const TYPE_LABEL: Record<string, string> = Object.fromEntries(EXPERIENCE_TYPES.map((t) => [t.key, t.label]))

export function EstudioModule({ boardId }: { boardId: string }) {
  const [list, setList] = useState<DesignListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<FullDesign | null>(null)
  const [prompt, setPrompt] = useState('')
  const [expType, setExpType] = useState('LESSON_PLAN')
  const [generating, setGenerating] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    pedagogicalDesignApi.list(boardId)
      .then((r) => setList(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [boardId])
  useEffect(() => { load() }, [load])

  const generate = async () => {
    if (!prompt.trim()) return
    setGenerating(true)
    try {
      const r = await pedagogicalDesignApi.generate({ prompt: prompt.trim(), experienceType: expType, boardId })
      setOpen(r.data)
      setPrompt('')
      load()
      if (r.data?.content?._placeholder) {
        toast.info('Diseño base creado', 'La IA no estaba disponible; generé una plantilla editable.')
      } else {
        toast.success('Diseño creado por Valeria', 'Revísalo y ajústalo a tu grupo.')
      }
    } catch (e: any) {
      toast.error(e)
    } finally {
      setGenerating(false)
    }
  }

  const openDesign = async (id: string) => {
    try { const r = await pedagogicalDesignApi.get(id); setOpen(r.data) } catch (e: any) { toast.error(e) }
  }

  const remove = async (id: string) => {
    try { await pedagogicalDesignApi.delete(id); setList((p) => p.filter((d) => d.id !== id)); toast.success('Diseño eliminado') }
    catch (e: any) { toast.error(e) }
  }

  if (open) {
    return <DesignDetail design={open} onBack={() => { setOpen(null); load() }} onDeleted={() => { setOpen(null); load() }} />
  }

  return (
    <div>
      {/* Generador */}
      <div className="rounded-2xl bg-gradient-to-br from-fuchsia-50 to-violet-50 border border-fuchsia-100 p-4 mb-5">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-fuchsia-600" />
          <p className="text-sm font-bold text-slate-800">Diseña con Valeria</p>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          placeholder='Ej: Plan de clase sobre Pensamiento Computacional, 2 sesiones'
          className="w-full text-sm rounded-xl border border-slate-200 p-3 resize-none focus:outline-none focus:border-fuchsia-400 bg-white"
        />
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {EXPERIENCE_TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => setExpType(t.key)}
              className={`text-xs px-2.5 py-1 rounded-full border transition ${expType === t.key ? 'bg-fuchsia-600 text-white border-fuchsia-600' : 'bg-white text-slate-600 border-slate-200 hover:border-fuchsia-300'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex justify-end mt-3">
          <button
            onClick={generate}
            disabled={generating || !prompt.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Diseñando…</> : <><Sparkles className="w-4 h-4" /> Diseñar</>}
          </button>
        </div>
      </div>

      {/* Lista de diseños */}
      {loading ? (
        <div className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-slate-300 mx-auto" /></div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/40 py-10 text-center">
          <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Aún no tienes diseños. Escribe un tema arriba y deja que Valeria lo construya.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((d) => (
            <div key={d.id} className="group flex items-center gap-3 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition p-3">
              <button onClick={() => openDesign(d.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                <div className="w-9 h-9 rounded-xl bg-fuchsia-50 flex items-center justify-center text-lg flex-shrink-0">✨</div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{d.title}</p>
                  <p className="text-[11px] text-slate-400">{TYPE_LABEL[d.experienceType] || d.experienceType}</p>
                </div>
              </button>
              <button onClick={() => remove(d.id)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition" title="Eliminar diseño">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Helpers de edición de listas (texto multilínea ↔ array) ──────────────────
const toLines = (arr?: string[]) => (arr ?? []).join('\n')
const fromLines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean)

function DesignDetail({ design, onBack, onDeleted }: { design: FullDesign; onBack: () => void; onDeleted: () => void }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState(design.title)
  const [content, setContent] = useState<DesignContent>(design.content || {})

  const c = content
  const setMoment = (idx: number, patch: Partial<NonNullable<DesignContent['moments']>[number]>) => {
    setContent((prev) => ({ ...prev, moments: (prev.moments ?? []).map((m, i) => i === idx ? { ...m, ...patch } : m) }))
  }

  const save = async () => {
    setSaving(true)
    try {
      const r = await pedagogicalDesignApi.update(design.id, { title: title.trim() || design.title, content })
      setContent(r.data.content || content)
      setEditing(false)
      toast.success('Diseño guardado')
    } catch (e: any) { toast.error(e) } finally { setSaving(false) }
  }

  const del = async () => {
    try { await pedagogicalDesignApi.delete(design.id); toast.success('Diseño eliminado'); onDeleted() }
    catch (e: any) { toast.error(e) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700">
          <ArrowLeft className="w-3.5 h-3.5" /> Estudio
        </button>
        <div className="flex items-center gap-2">
          {editing ? (
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-fuchsia-600 text-white text-xs font-semibold disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Guardar
            </button>
          ) : (
            <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200">
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>
          )}
          <button onClick={del} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition" title="Eliminar diseño">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Título */}
      {editing ? (
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full text-xl font-bold text-slate-900 border border-slate-200 rounded-xl px-3 py-2 mb-3 focus:outline-none focus:border-fuchsia-400" />
      ) : (
        <h2 className="text-xl font-bold text-slate-900 mb-1">{title}</h2>
      )}

      {c._placeholder && !editing && (
        <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mb-3 inline-block">
          Plantilla base (IA no disponible al generar) — edítala a tu gusto.
        </p>
      )}

      {/* Identificación */}
      {c.identification && (
        <div className="flex flex-wrap gap-2 text-[11px] text-slate-500 mb-4">
          {c.identification.grade && <Chip>{c.identification.grade}</Chip>}
          {c.identification.subject && <Chip>{c.identification.subject}</Chip>}
          {c.identification.sessions != null && <Chip>{c.identification.sessions} sesión(es)</Chip>}
          {c.identification.totalMinutes != null && <Chip><Clock className="w-3 h-3" /> {c.identification.totalMinutes} min</Chip>}
        </div>
      )}

      {/* Objetivos */}
      <Block icon={<Target className="w-4 h-4 text-violet-500" />} title="Objetivos de aprendizaje">
        {editing ? (
          <Editable value={toLines(c.learning?.objectives)} onChange={(v) => setContent((p) => ({ ...p, learning: { ...p.learning, objectives: fromLines(v) } }))} />
        ) : (
          <Bullets items={c.learning?.objectives} />
        )}
        {!editing && c.learning?.bloomLevels?.length ? (
          <p className="text-[11px] text-slate-400 mt-1">Bloom: {c.learning.bloomLevels.join(' · ')}</p>
        ) : null}
      </Block>

      {/* Momentos */}
      <Block icon={<Clock className="w-4 h-4 text-blue-500" />} title="Momentos de la clase">
        <div className="space-y-3">
          {(c.moments ?? []).map((m, i) => (
            <div key={i} className="rounded-xl border border-slate-150 bg-slate-50/60 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">{m.phase || `Momento ${i + 1}`}</span>
                {m.minutes != null && <span className="text-[11px] text-slate-400">{m.minutes} min</span>}
              </div>
              {editing ? (
                <>
                  <Editable value={m.description || ''} onChange={(v) => setMoment(i, { description: v })} rows={2} />
                  <p className="text-[10px] text-slate-400 mt-1 mb-0.5">Actividades (una por línea):</p>
                  <Editable value={toLines(m.activities)} onChange={(v) => setMoment(i, { activities: fromLines(v) })} />
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{m.description}</p>
                  <Bullets items={m.activities} small />
                </>
              )}
            </div>
          ))}
          {(c.moments ?? []).length === 0 && <p className="text-sm text-slate-400">Sin momentos definidos.</p>}
        </div>
      </Block>

      {/* Actividades */}
      {c.activities?.length ? (
        <Block icon={<ListChecks className="w-4 h-4 text-emerald-500" />} title="Actividades">
          <div className="space-y-2">
            {c.activities.map((a, i) => (
              <div key={i} className="rounded-xl border border-slate-150 p-3">
                <p className="text-sm font-medium text-slate-800">{a.title}</p>
                {a.description && <p className="text-xs text-slate-500 mt-0.5">{a.description}</p>}
                <div className="flex flex-wrap gap-2 mt-1 text-[10px] text-slate-400">
                  {a.type && <Chip>{a.type}</Chip>}
                  {a.minutes != null && <Chip>{a.minutes} min</Chip>}
                  {a.product && <Chip>Producto: {a.product}</Chip>}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">El envío al Aula Virtual llega en la siguiente fase (E3).</p>
        </Block>
      ) : null}

      {/* Evaluación */}
      {c.evaluation && (c.evaluation.criteria?.length || c.evaluation.evidences?.length) ? (
        <Block icon={<ClipboardCheck className="w-4 h-4 text-amber-500" />} title="Evaluación">
          {c.evaluation.type && <p className="text-xs text-slate-500 mb-1">Tipo: {c.evaluation.type}</p>}
          {c.evaluation.criteria?.length ? (<><p className="text-[11px] font-semibold text-slate-500">Criterios</p><Bullets items={c.evaluation.criteria} small /></>) : null}
          {c.evaluation.evidences?.length ? (<><p className="text-[11px] font-semibold text-slate-500 mt-1">Evidencias</p><Bullets items={c.evaluation.evidences} small /></>) : null}
        </Block>
      ) : null}

      {/* DUA */}
      {c.dua && (c.dua.adjustments?.length || c.dua.barriers?.length) ? (
        <Block icon={<Accessibility className="w-4 h-4 text-rose-500" />} title="Ajustes DUA (inclusión)">
          {c.dua.adjustments?.length ? <Bullets items={c.dua.adjustments} small /> : null}
        </Block>
      ) : null}

      {/* Recursos */}
      {c.resources?.length ? (
        <Block icon={<Plus className="w-4 h-4 text-slate-400" />} title="Recursos">
          <Bullets items={c.resources.map((r) => r.name || r.url || '').filter(Boolean)} small />
        </Block>
      ) : null}
    </div>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">{children}</span>
}
function Block({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-white border border-slate-200 p-4 mb-3">
      <div className="flex items-center gap-2 mb-2">{icon}<h3 className="text-sm font-bold text-slate-800">{title}</h3></div>
      {children}
    </motion.div>
  )
}
function Bullets({ items, small }: { items?: string[]; small?: boolean }) {
  if (!items?.length) return <p className="text-sm text-slate-400">—</p>
  return (
    <ul className={`${small ? 'mt-1' : ''} space-y-0.5`}>
      {items.map((it, i) => (
        <li key={i} className={`flex gap-2 ${small ? 'text-xs text-slate-600' : 'text-sm text-slate-700'}`}>
          <span className="text-fuchsia-400 mt-0.5">•</span><span>{it}</span>
        </li>
      ))}
    </ul>
  )
}
function Editable({ value, onChange, rows = 3 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows}
      className="w-full text-sm rounded-lg border border-slate-200 p-2 resize-y focus:outline-none focus:border-fuchsia-400" />
  )
}
