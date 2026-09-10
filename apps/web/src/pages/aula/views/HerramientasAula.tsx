import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { classroomApi } from '../../../lib/api'
import { useAuth } from '../../../contexts/AuthContext'
import { ActivitiesTab, AnnouncementsTab, ContentTab, ForumTab } from '../../Classroom'
import { AulaState } from '../ui/EmptyState'
import type { Rol } from '../data/useAula'

export type Herramienta = 'actividades' | 'materiales' | 'anuncios' | 'foro'
const titles: Record<Herramienta, string> = {
  actividades: 'Editor y herramientas de actividades', materiales: 'Materiales del aula',
  anuncios: 'Anuncios del aula', foro: 'Foro del aula',
}

/** Reutiliza los editores existentes con el aula exacta; no copia ni transforma datos. */
export default function HerramientasAula({ classroomId, herramienta, activityId, rol, onVolver, onCambio, abrirValeria }: {
  classroomId: string; herramienta: Herramienta; activityId?: string; rol: Rol;
  onVolver: () => void; onCambio: () => void;
  /** Llegó desde el botón «Pedirle a Valeria»: hay que abrirle el asistente, no solo la pantalla. */
  abrirValeria?: boolean;
}) {
  const { user } = useAuth()
  const [classroom, setClassroom] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    classroomApi.getById(classroomId).then(({ data }) => {
      if (active) setClassroom(data)
    }).catch(() => {
      if (active) setError('No se pudo cargar el aula. Vuelve a intentarlo.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [classroomId, revision])
  const onReload = useCallback(() => { setRevision(r => r + 1); onCambio() }, [onCambio])
  const props = { classroom, isTeacher: rol === 'docente', isStudent: rol === 'estudiante', onReload, setError }
  return (
    <section className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-center gap-4 border-b border-hairline pb-5">
        <button type="button" onClick={onVolver} className="inline-flex min-h-btn items-center gap-2 rounded-lg border border-hairline bg-surface-1 px-4 text-body-sm text-ink-primary hover:bg-surface-2">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Volver
        </button>
        <div><h1 className="text-xl font-semibold text-ink-primary">{titles[herramienta]}</h1>
          <p className="text-body-sm text-ink-secondary">{classroom?.title || 'Aula Virtual'}</p></div>
      </header>
      {error && classroom && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}<button type="button" className="ml-3 min-h-btn underline" onClick={() => setError('')}>Cerrar aviso</button></div>}
      <AulaState loading={loading} error={!classroom ? error : null} onRetry={() => setRevision(r => r + 1)} isEmpty={!classroom} empty={null}>
        {classroom && <div className="rounded-card border border-hairline bg-surface-1 p-4 sm:p-6 [&_button]:min-h-11">
          {herramienta === 'actividades' ? <ActivitiesTab {...props} initialActivityId={activityId} openValeria={abrirValeria} />
            : herramienta === 'materiales' ? <ContentTab {...props} />
            : herramienta === 'anuncios' ? <AnnouncementsTab {...props} />
            : <ForumTab {...props} user={user} />}
        </div>}
      </AulaState>
    </section>
  )
}
