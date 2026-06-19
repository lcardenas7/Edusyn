import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, ClipboardList, BarChart2, ChevronRight, Loader2 } from 'lucide-react'
import { teacherAssignmentsApi } from '../lib/api'

interface Assignment {
  id: string
  subject: { id: string; name: string; area?: { name: string } }
  group: { id: string; name: string; grade?: { name: string } }
  academicYear: { id: string; year: number }
  weeklyHours?: number
}

/** Widget mostrado en Dashboard solo para DOCENTE: lista de asignaturas del año activo */
export default function TeacherAssignmentsWidget() {
  const navigate = useNavigate()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    teacherAssignmentsApi
      .getAll({ activeOnly: true })
      .then(res => setAssignments(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const activeYear = assignments[0]?.academicYear?.year

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex items-center justify-center gap-2 text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Cargando asignaturas...</span>
      </div>
    )
  }

  if (assignments.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center text-slate-400">
        <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-300" />
        <p className="text-sm">No tienes asignaturas asignadas para este año</p>
      </div>
    )
  }

  // Agrupar por área si está disponible
  const byArea: Record<string, Assignment[]> = {}
  assignments.forEach(a => {
    const area = a.subject.area?.name || 'Sin área'
    if (!byArea[area]) byArea[area] = []
    byArea[area].push(a)
  })

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-blue-600" />
          Mis Asignaturas
          {activeYear && (
            <span className="text-xs font-normal text-slate-400 ml-1">
              {activeYear}
            </span>
          )}
        </h2>
        <span className="text-xs text-slate-400">{assignments.length} asignación{assignments.length !== 1 ? 'es' : ''}</span>
      </div>

      <div className="divide-y divide-slate-100">
        {assignments.map(a => {
          const groupLabel = `${a.group.grade?.name ?? ''} ${a.group.name}`.trim()
          return (
            <div key={a.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
              {/* Color pill por área */}
              <div className="w-1 h-10 rounded-full bg-blue-400 shrink-0" />

              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 text-sm truncate">{a.subject.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{groupLabel}</p>
              </div>

              {/* Acciones rápidas */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => navigate('/attendance')}
                  title="Ir a Asistencia"
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors font-medium"
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  Asistencia
                </button>
                <button
                  onClick={() => navigate('/grades')}
                  title="Ir a Calificaciones"
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors font-medium"
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  Notas
                </button>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
            </div>
          )
        })}
      </div>
    </div>
  )
}
