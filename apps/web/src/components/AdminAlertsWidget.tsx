import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Users, GraduationCap, BookOpen, ChevronRight, Loader2, CheckCircle2 } from 'lucide-react'
import { groupsApi, teacherAssignmentsApi, studentsApi, teachersApi } from '../lib/api'
import { useAcademic } from '../contexts/AcademicContext'
import { useAuth } from '../contexts/AuthContext'

interface Stats {
  totalGroups: number
  groupsWithoutDirector: number
  totalStudents: number
  totalTeachers: number
  groupsWithoutAssignment: number
}

/** Panel de alertas para ADMIN_INSTITUTIONAL, COORDINADOR, RECTOR */
export default function AdminAlertsWidget() {
  const navigate = useNavigate()
  const { institution } = useAuth()
  const { currentAcademicYear } = useAcademic()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentAcademicYear?.id) return

    const load = async () => {
      try {
        const [groupsRes, assignmentsRes, studentsRes, teachersRes] = await Promise.all([
          groupsApi.getAll({ institutionId: institution?.id }),
          teacherAssignmentsApi.getAll({ academicYearId: currentAcademicYear.id, activeOnly: true }),
          studentsApi.getAll({ institutionId: institution?.id }),
          teachersApi.getAll({ isActive: true }),
        ])

        const groups = groupsRes.data || []
        const assignments = assignmentsRes.data || []
        const students = studentsRes.data || []
        const teachers = teachersRes.data || []

        // Grupos sin director de grupo asignado
        const groupsWithoutDirector = groups.filter((g: any) => !g.directorId).length

        // Grupos sin ninguna asignación académica
        const assignedGroupIds = new Set(assignments.map((a: any) => a.group?.id))
        const groupsWithoutAssignment = groups.filter((g: any) => !assignedGroupIds.has(g.id)).length

        setStats({
          totalGroups: groups.length,
          groupsWithoutDirector,
          totalStudents: students.length,
          totalTeachers: teachers.length,
          groupsWithoutAssignment,
        })
      } catch {
        // silently ignore — dashboard should not crash on partial failure
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [currentAcademicYear?.id, institution?.id])

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center justify-center gap-2 text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Cargando estadísticas...</span>
      </div>
    )
  }

  if (!stats) return null

  const alerts: { label: string; value: number; action: string; path: string; severity: 'warn' | 'info' }[] = [
    ...(stats.groupsWithoutDirector > 0 ? [{
      label: `${stats.groupsWithoutDirector} grupo${stats.groupsWithoutDirector > 1 ? 's' : ''} sin director de grupo`,
      value: stats.groupsWithoutDirector,
      action: 'Ver grupos',
      path: '/groups',
      severity: 'warn' as const,
    }] : []),
    ...(stats.groupsWithoutAssignment > 0 ? [{
      label: `${stats.groupsWithoutAssignment} grupo${stats.groupsWithoutAssignment > 1 ? 's' : ''} sin carga académica`,
      value: stats.groupsWithoutAssignment,
      action: 'Asignar docentes',
      path: '/academic-load',
      severity: 'warn' as const,
    }] : []),
  ]

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="px-5 py-3.5 border-b border-slate-200">
        <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Resumen Institucional
        </h2>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-px bg-slate-100 border-b border-slate-100">
        {[
          { icon: Users, label: 'Grupos', value: stats.totalGroups, color: 'text-blue-600', bg: 'bg-blue-50' },
          { icon: GraduationCap, label: 'Estudiantes', value: stats.totalStudents, color: 'text-green-600', bg: 'bg-green-50' },
          { icon: BookOpen, label: 'Docentes', value: stats.totalTeachers, color: 'text-violet-600', bg: 'bg-violet-50' },
          { icon: CheckCircle2, label: 'Asignaciones', value: stats.totalGroups - stats.groupsWithoutAssignment, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className={`${bg} px-5 py-4 flex items-center gap-3`}>
            <Icon className={`w-5 h-5 ${color} shrink-0`} />
            <div>
              <p className="text-xl font-bold text-slate-900">{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Alertas */}
      {alerts.length === 0 ? (
        <div className="px-5 py-4 flex items-center gap-2 text-green-700 text-sm">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          Todo en orden — sin alertas pendientes
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {alerts.map((alert, i) => (
            <button
              key={i}
              onClick={() => navigate(alert.path)}
              className="w-full px-5 py-3 flex items-center gap-3 hover:bg-amber-50 transition-colors text-left"
            >
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="flex-1 text-sm text-slate-700">{alert.label}</span>
              <span className="text-xs text-amber-600 font-medium flex items-center gap-1 shrink-0">
                {alert.action}
                <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
