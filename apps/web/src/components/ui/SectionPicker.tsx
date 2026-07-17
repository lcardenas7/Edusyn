/**
 * Selector de sección destino — pieza compartida.
 *
 * Antes estaba repetido 5 veces en Classroom.tsx con DOS redacciones distintas para
 * el mismo vacío ("No hay secciones disponibles" / "Esta aula no tiene secciones") y
 * hovers divergentes (azul vs violeta). Ver docs/AUDITORIA_VISUAL_AULA.md §H4/§H5.
 *
 * Todo estado vacío ofrece salida: si se pasa `onCreate`, el vacío deja de ser un
 * callejón sin salida.
 */
import { FolderOpen, Loader2, Plus } from 'lucide-react'

export interface PickableSection {
  id: string
  title: string
}

interface SectionPickerProps {
  sections: PickableSection[]
  loading?: boolean
  busy?: boolean
  onPick: (section: PickableSection) => void
  /** Si se pasa, el estado vacío muestra un CTA para crear la primera sección. */
  onCreate?: () => void
  emptyMessage?: string
  /** Línea secundaria opcional (p. ej. "3 recursos • 2 actividades"). */
  subtitle?: (section: any) => React.ReactNode
}

export function SectionPicker({
  sections, loading, busy, onPick, onCreate, subtitle,
  emptyMessage = 'Esta aula aún no tiene secciones',
}: SectionPickerProps) {
  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-violet-600" /></div>
  }
  if (sections.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-ink-muted">{emptyMessage}</p>
        {onCreate && (
          <button onClick={onCreate} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700">
            <Plus className="w-4 h-4" /> Crear la primera
          </button>
        )}
      </div>
    )
  }
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {sections.map(s => (
        <button
          key={s.id}
          onClick={() => onPick(s)}
          disabled={busy}
          title={s.title}
          className="w-full flex items-center gap-3 p-3 rounded-lg border border-hairline hover:border-violet-300 hover:bg-violet-50 transition-colors text-left disabled:opacity-50"
        >
          <div className="w-8 h-8 shrink-0 rounded-lg bg-surface-2 flex items-center justify-center">
            <FolderOpen className="w-4 h-4 text-ink-muted" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-ink-primary line-clamp-2 leading-snug">{s.title}</p>
            {subtitle && <p className="text-xs text-ink-muted">{subtitle(s)}</p>}
          </div>
          {busy && <Loader2 className="w-4 h-4 animate-spin text-violet-600 shrink-0" />}
        </button>
      ))}
    </div>
  )
}
