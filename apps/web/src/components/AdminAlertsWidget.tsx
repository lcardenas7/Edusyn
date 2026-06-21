import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Users, GraduationCap, BookOpen, ChevronRight, Loader2, CheckCircle2, Sparkles, Calendar } from 'lucide-react'
import { groupsApi, teacherAssignmentsApi, studentsApi, teachersApi, academicYearsApi, institutionsApi } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

interface Stats {
  totalGroups: number
  groupsWithoutDirector: number
  totalStudents: number
  totalTeachers: number
  groupsWithoutAssignment: number
  activeYear?: number
}

interface SetupStatus {
  currentStep: string
  currentStepLabel: string
  nextPath: string | null
  progress: number
  completedCount: number
  totalSteps: number
  steps: Array<{ key: string; label: string; complete: boolean; path: string }>
}

/** Panel de alertas para ADMIN_INSTITUTIONAL, COORDINADOR, RECTOR */
export default function AdminAlertsWidget() {
  const navigate = useNavigate()
  const { institution } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        // Resolver año académico activo + setup status en paralelo
        const [yearsRes, setupRes] = await Promise.all([
          academicYearsApi.getAll(institution?.id),
          institutionsApi.getSetupStatus().catch(() => null),
        ])
        const activeYear = (yearsRes.data || []).find((y: any) => y.isActive) || (yearsRes.data || [])[0]

        if (setupRes?.data) setSetupStatus(setupRes.data as SetupStatus)

        const [groupsRes, assignmentsRes, studentsRes, teachersRes] = await Promise.all([
          groupsApi.getAll({ institutionId: institution?.id }),
          activeYear?.id
            ? teacherAssignmentsApi.getAll({ academicYearId: activeYear.id, activeOnly: true })
            : Promise.resolve({ data: [] }),
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
          activeYear: activeYear?.year,
        })
      } catch {
        // silently ignore — dashboard should not crash on partial failure
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [institution?.id])

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

  const setupIncomplete = setupStatus && setupStatus.progress < 100

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* HERO: estado de la institución */}
      <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-base font-semibold text-slate-900 truncate">
              {institution?.name || 'Institución'}
            </h2>
            {stats?.activeYear && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500 shrink-0">
                <Calendar className="w-3 h-3" />
                {stats.activeYear}
              </span>
            )}
          </div>
        </div>

        {setupStatus && (
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-600">
                  Configuración: <span className="font-medium text-slate-900">{setupStatus.completedCount}/{setupStatus.totalSteps} pasos</span>
                </span>
                <span className={`font-semibold ${setupIncomplete ? 'text-amber-600' : 'text-green-600'}`}>
                  {setupStatus.progress}%
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    setupStatus.progress >= 100 ? 'bg-green-500' :
                    setupStatus.progress >= 60 ? 'bg-blue-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${setupStatus.progress}%` }}
                />
              </div>
            </div>
            {setupIncomplete && (
              <button
                onClick={() => navigate('/setup')}
                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Continuar setup
              </button>
            )}
          </div>
        )}
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

      {/* Procesos pendientes (paso de setup actual) */}
      {setupIncomplete && setupStatus.nextPath && (
        <button
          onClick={() => navigate('/setup')}
          className="w-full px-5 py-3 flex items-center gap-3 bg-blue-50/50 border-b border-slate-100 hover:bg-blue-50 transition-colors text-left"
        >
          <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-700">
              Siguiente paso: <span className="font-medium text-slate-900">{setupStatus.currentStepLabel}</span>
            </p>
          </div>
          <span className="text-xs text-blue-600 font-medium flex items-center gap-1 shrink-0">
            Ir al wizard
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </button>
      )}

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
