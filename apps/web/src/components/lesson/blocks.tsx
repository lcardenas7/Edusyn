/**
 * Motor de bloques de la Lección (docs/MOTOR_LECCIONES.md, Prioridad 2 corte 2).
 *
 * Una slide CONTENT pasa de campos fijos (body/imagen/video/audio) a una PILA de
 * bloques tipados que el docente combina libremente y reordena arrastrando.
 * Reutiliza RichTextEditor (texto sin HTML) y el módulo de medios (subida + resolución).
 * Compat: si una slide no tiene `blocks`, el player usa el render legacy.
 */
import { useState } from 'react'
import { Reorder, useDragControls } from 'framer-motion'
import { GripVertical, Trash2, Plus, Type, Image as ImageIcon, Video as VideoIcon, Music, Table as TableIcon } from 'lucide-react'
import RichTextEditor, { RichContent } from '../RichTextEditor'
import { MediaInput, SmartImg, SmartVideo, SmartAudio } from '../media/SmartMedia'

export type BlockType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'TABLE'
export interface LessonBlock {
  id: string
  type: BlockType
  html?: string // TEXT
  url?: string // IMAGE/VIDEO/AUDIO (key de storage o URL externa)
  rows?: string[][] // TABLE
  header?: boolean // TABLE: primera fila como cabecera
}

const uid = () => `b_${Math.random().toString(36).slice(2, 9)}`

export function newBlock(type: BlockType): LessonBlock {
  if (type === 'TABLE') return { id: uid(), type, header: true, rows: [['', ''], ['', '']] }
  return { id: uid(), type }
}

/** Adapta una slide legacy (body/media) a bloques, para editarla como pila. */
export function legacyToBlocks(s: { body?: string; imageUrl?: string; videoUrl?: string; audioUrl?: string }): LessonBlock[] {
  const out: LessonBlock[] = []
  if (s.body && s.body.trim()) out.push({ id: uid(), type: 'TEXT', html: s.body })
  if (s.imageUrl) out.push({ id: uid(), type: 'IMAGE', url: s.imageUrl })
  if (s.videoUrl) out.push({ id: uid(), type: 'VIDEO', url: s.videoUrl })
  if (s.audioUrl) out.push({ id: uid(), type: 'AUDIO', url: s.audioUrl })
  if (out.length === 0) out.push({ id: uid(), type: 'TEXT', html: '' })
  return out
}

// Decodifica HTML a texto (entidades incluidas: &nbsp; &amp;…) para TTS.
function htmlToText(html: string): string {
  if (typeof document !== 'undefined') {
    const el = document.createElement('div')
    el.innerHTML = html
    return el.textContent || ''
  }
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ')
}

/** Texto plano de los bloques (para "Escuchar" / lectura por voz en el player). */
export function blocksToPlainText(blocks: LessonBlock[]): string {
  return (blocks || [])
    .map(b => b.type === 'TEXT' ? htmlToText(b.html || '') : b.type === 'TABLE' ? (b.rows || []).flat().join(' ') : '')
    .join(' ').replace(/\s+/g, ' ').trim()
}

// ─── EDITOR ──────────────────────────────────────────────────────────────────
const ADD_MENU: { type: BlockType; label: string; icon: any }[] = [
  { type: 'TEXT', label: 'Texto', icon: Type },
  { type: 'IMAGE', label: 'Imagen', icon: ImageIcon },
  { type: 'VIDEO', label: 'Video', icon: VideoIcon },
  { type: 'AUDIO', label: 'Audio', icon: Music },
  { type: 'TABLE', label: 'Tabla', icon: TableIcon },
]

export function BlockStackEditor({ blocks, onChange }: { blocks: LessonBlock[]; onChange: (b: LessonBlock[]) => void }) {
  const [adding, setAdding] = useState(false)
  const update = (id: string, patch: Partial<LessonBlock>) => onChange(blocks.map(b => b.id === id ? { ...b, ...patch } : b))
  const remove = (id: string) => onChange(blocks.filter(b => b.id !== id))
  const add = (type: BlockType) => { onChange([...blocks, newBlock(type)]); setAdding(false) }

  return (
    <div className="space-y-2">
      <Reorder.Group axis="y" values={blocks} onReorder={onChange} className="space-y-2">
        {blocks.map(block => (
          <BlockRow key={block.id} block={block} onUpdate={p => update(block.id, p)} onRemove={() => remove(block.id)} />
        ))}
      </Reorder.Group>

      <div className="relative">
        <button type="button" onClick={() => setAdding(a => !a)} className="w-full py-2 rounded-xl border-2 border-dashed border-slate-200 text-sm font-semibold text-slate-400 hover:border-violet-300 hover:text-violet-600 flex items-center justify-center gap-1.5">
          <Plus className="w-4 h-4" /> Añadir bloque
        </button>
        {adding && (
          <div className="absolute z-10 mt-1 left-1/2 -translate-x-1/2 bg-white rounded-xl border border-slate-200 shadow-lg p-1 flex gap-1">
            {ADD_MENU.map(m => (
              <button key={m.type} type="button" onClick={() => add(m.type)} className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg hover:bg-violet-50 text-slate-600 hover:text-violet-700">
                <m.icon className="w-4 h-4" /><span className="text-[11px] font-medium">{m.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function BlockRow({ block, onUpdate, onRemove }: { block: LessonBlock; onUpdate: (p: Partial<LessonBlock>) => void; onRemove: () => void }) {
  const controls = useDragControls()
  return (
    <Reorder.Item value={block} dragListener={false} dragControls={controls} className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-start gap-2 p-2">
        <button type="button" onPointerDown={e => controls.start(e)} className="mt-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none"><GripVertical className="w-4 h-4" /></button>
        <div className="flex-1 min-w-0">
          {block.type === 'TEXT' && <RichTextEditor value={block.html || ''} onChange={v => onUpdate({ html: v })} placeholder="Escribe…" />}
          {(block.type === 'IMAGE' || block.type === 'VIDEO' || block.type === 'AUDIO') && (
            <MediaInput kind={block.type.toLowerCase() as any} value={block.url || ''} onChange={v => onUpdate({ url: v })} />
          )}
          {block.type === 'TABLE' && <TableEditor block={block} onUpdate={onUpdate} />}
        </div>
        <button type="button" onClick={onRemove} className="mt-1 text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
      </div>
    </Reorder.Item>
  )
}

function TableEditor({ block, onUpdate }: { block: LessonBlock; onUpdate: (p: Partial<LessonBlock>) => void }) {
  const rows = block.rows || [['', '']]
  const cols = rows[0]?.length || 1
  const setCell = (r: number, c: number, v: string) => onUpdate({ rows: rows.map((row, i) => i === r ? row.map((cell, j) => j === c ? v : cell) : row) })
  const addRow = () => onUpdate({ rows: [...rows, Array(cols).fill('')] })
  const addCol = () => onUpdate({ rows: rows.map(row => [...row, '']) })
  const delRow = (r: number) => onUpdate({ rows: rows.length > 1 ? rows.filter((_, i) => i !== r) : rows })
  const delCol = (c: number) => onUpdate({ rows: cols > 1 ? rows.map(row => row.filter((_, j) => j !== c)) : rows })

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-xs text-slate-500"><input type="checkbox" checked={!!block.header} onChange={e => onUpdate({ header: e.target.checked })} className="accent-violet-600" /> Primera fila como cabecera</label>
      <div className="overflow-x-auto">
        <table className="border-collapse">
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className="group/row">
                {row.map((cell, c) => (
                  <td key={c} className="border border-slate-200 p-0">
                    <input value={cell} onChange={e => setCell(r, c, e.target.value)} className={`w-32 px-2 py-1.5 text-sm outline-none ${block.header && r === 0 ? 'font-semibold bg-slate-50' : ''}`} placeholder={block.header && r === 0 ? 'Encabezado' : '—'} />
                  </td>
                ))}
                <td className="pl-1"><button type="button" onClick={() => delRow(r)} className="opacity-0 group-hover/row:opacity-100 text-slate-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button></td>
              </tr>
            ))}
            <tr>{Array.from({ length: cols }).map((_, c) => <td key={c} className="text-center"><button type="button" onClick={() => delCol(c)} className="text-slate-300 hover:text-rose-500 text-xs">✕</button></td>)}</tr>
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={addRow} className="text-xs font-semibold text-violet-600 hover:text-violet-700">+ Fila</button>
        <button type="button" onClick={addCol} className="text-xs font-semibold text-violet-600 hover:text-violet-700">+ Columna</button>
      </div>
    </div>
  )
}

// ─── RENDER (player) ──────────────────────────────────────────────────────────
export function BlockStackView({ blocks }: { blocks: LessonBlock[] }) {
  return (
    <div className="space-y-4">
      {(blocks || []).map(b => {
        if (b.type === 'TEXT') return b.html ? <RichContent key={b.id} html={b.html} className="prose prose-neutral prose-base sm:prose-lg max-w-none leading-relaxed text-ink-primary" /> : null
        if (b.type === 'IMAGE') return <SmartImg key={b.id} src={b.url} className="w-full rounded-2xl border border-hairline shadow-sm object-contain max-h-80" />
        if (b.type === 'VIDEO') return <VideoBlockView key={b.id} url={b.url} />
        if (b.type === 'AUDIO') return <SmartAudio key={b.id} src={b.url} className="w-full" />
        if (b.type === 'TABLE') return <TableView key={b.id} block={b} />
        return null
      })}
    </div>
  )
}

function VideoBlockView({ url }: { url?: string }) {
  if (!url) return null
  if (url.includes('youtube') || url.includes('youtu.be')) {
    return <iframe src={url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')} className="w-full aspect-video rounded-2xl" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
  }
  return <SmartVideo src={url} className="w-full rounded-2xl max-h-80" />
}

function TableView({ block }: { block: LessonBlock }) {
  const rows = block.rows || []
  if (rows.length === 0) return null
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => {
                const isHead = block.header && r === 0
                const Tag = (isHead ? 'th' : 'td') as any
                return <Tag key={c} className={`border border-hairline px-3 py-2 text-left ${isHead ? 'bg-surface-2 font-semibold text-ink-primary' : 'text-ink-secondary'}`}>{cell}</Tag>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
