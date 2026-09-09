import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { classroomApi } from '../../../lib/api'
import { toast } from '../../../lib/toast'

export type GestionAula = 'crear' | 'copiar' | 'color'
const titles = { crear: 'Crear aula', copiar: 'Copiar aula a otros grupos', color: 'Color del aula' }

export function GestionarAula({ modo, classroomId, colorInicial, onCerrar, onGuardado }: {
  modo: GestionAula; classroomId?: string; colorInicial?: string | null;
  onCerrar: () => void; onGuardado: (id?: string) => void;
}) {
  const [assignments, setAssignments] = useState<any[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [color, setColor] = useState(colorInicial || '#3B82F6')
  const [loading, setLoading] = useState(modo !== 'color')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (modo === 'color') return
    let active = true
    setLoading(true)
    setError('')
    classroomApi.getAvailableAssignments().then(({data}) => { if (active) setAssignments(data) })
      .catch(() => { if (active) setError('No se pudieron cargar tus asignaciones.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [modo, revision])
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onCerrar() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onCerrar, saving])
  const guardar = async () => {
    if (saving || loading || (modo !== 'color' && !selected.length)) return
    setSaving(true)
    setError('')
    try {
      if (modo === 'crear') {
        const {data} = await classroomApi.create({teacherAssignmentId:selected[0],color})
        toast.success('Aula creada')
        onGuardado(data.id)
      } else if (modo === 'copiar' && classroomId) {
        const {data} = await classroomApi.copyClassroomTo(classroomId,selected)
        const failed = (data.results ?? []).filter((r: { error?: string }) => r.error)
        if (failed.length || data.copied !== selected.length) {
          setSelected([])
          setError(`Se completaron ${data.copied} de ${selected.length} copias. ${failed.map((r: { error: string }) => r.error).join('. ')} Revisa los grupos de destino antes de volver a intentarlo.`)
          return
        }
        toast.success(`Aula copiada a ${data.copied} grupo(s)`)
        onGuardado()
      } else if (classroomId) {
        await classroomApi.update(classroomId,{color})
        toast.success('Color actualizado')
        onGuardado()
      }
    } catch (err: any) { setError(err.response?.data?.message || 'No se pudo guardar. Vuelve a intentarlo.') }
    finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-ink-primary/40 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="gestion-aula-title" className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-modal border border-hairline bg-surface-1 p-6 shadow-xl">
        <header className="mb-5 flex items-center justify-between gap-3">
          <h2 id="gestion-aula-title" className="text-xl font-semibold text-ink-primary">{titles[modo]}</h2>
          <button autoFocus type="button" aria-label="Cerrar" disabled={saving} onClick={onCerrar} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-surface-2"><X className="h-5 w-5" /></button>
        </header>
        {loading && <p role="status">Cargando asignaciones…</p>}
        {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-red-800">{error}
          {!assignments.length && modo !== 'color' && <button type="button" className="ml-2 min-h-btn underline" onClick={() => setRevision(r=>r+1)}>Reintentar</button>}
        </p>}
        {!loading && !error && modo !== 'color' && !assignments.length && <p className="text-ink-secondary">No hay asignaciones disponibles. Cada grupo necesita una carga docente asignada y una asignatura sin aula creada.</p>}
        {!loading && modo !== 'color' && assignments.length > 0 && <fieldset disabled={saving} className="space-y-2">
          <legend className="mb-2 font-medium text-ink-primary">{modo === 'crear' ? 'Asignatura y grupo' : 'Grupos de destino'}</legend>
          {assignments.map(a => <label key={a.id} className="flex min-h-btn cursor-pointer items-center gap-3 rounded-lg border border-hairline p-3 text-body-sm text-ink-primary">
            <input type={modo === 'crear' ? 'radio' : 'checkbox'} name="asignacion-aula" checked={selected.includes(a.id)} onChange={e => setSelected(modo === 'crear' ? [a.id] : e.target.checked ? [...selected,a.id] : selected.filter(id=>id!==a.id))} />
            {a.subject?.name} · {a.group?.grade?.name} {a.group?.name}
          </label>)}
        </fieldset>}
        {modo === 'copiar' && <p className="mt-4 text-body-sm text-ink-secondary">Copia unidades, materiales, actividades del aula y temas del foro. Las actividades quedan como borradores para revisar fechas y publicación. Las entregas, calificaciones y anuncios permanecen en el aula de origen.</p>}
        {modo !== 'copiar' && <label className="mt-5 flex min-h-btn items-center gap-3 text-ink-primary">Color del aula
          <input type="color" aria-label="Color del aula" value={color} disabled={saving} onChange={e=>setColor(e.target.value)} className="h-11 w-16 rounded-lg" />
        </label>}
        <footer className="mt-6 flex justify-end gap-3">
          <button type="button" disabled={saving} onClick={onCerrar} className="min-h-btn rounded-lg border border-hairline px-4 text-ink-secondary">Cancelar</button>
          <button type="button" disabled={saving || loading || (modo !== 'color' && !selected.length)} onClick={guardar} className="min-h-btn rounded-lg bg-accent px-4 font-medium text-white disabled:opacity-50">{saving ? 'Guardando…' : modo === 'copiar' ? 'Copiar a los grupos elegidos' : 'Guardar'}</button>
        </footer>
      </section>
    </div>
  )
}
