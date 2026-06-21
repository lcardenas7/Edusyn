import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2, Circle, Lock, Loader2, ChevronRight, ArrowRight,
  RefreshCw, Sparkles, AlertTriangle,
} from 'lucide-react'
import { institutionsApi } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

interface SetupStep {
  key: string
  label: string
  complete: boolean
  count: number
  target: number
  path: string
}

interface SetupStatus {
  institution: { id?: string; name?: string; logo?: string | null }
  currentStep: string
  currentStepLabel: string
  nextPath: string | null
  progress: number
  completedCount: number
  totalSteps: number
  steps: SetupStep[]
}

const STEP_HINTS: Record<string, string> = {
  IDENTITY: 'Empieza por el nombre, logo, NIT y datos de contacto. Aparecen en boletines y reportes.',
  ACADEMIC_YEAR: 'Define el año en curso y sus períodos (1°, 2°, 3°, 4°). Sin esto no se puede operar.',
  LEVELS: 'Configura los niveles (Preescolar, Primaria, Secundaria, Media) y la escala de evaluación de cada uno.',
  GRADES: 'Crea los grados (1°–11°) heredando reglas del nivel. Necesarios antes de armar grupos.',
  SUBJECTS: 'Catálogo institucional de áreas y asignaturas. Se reutilizan en todos los grupos.',
  GROUPS: 'Crea los grupos/cursos (8°A, 8°B, etc.) por sede y grado.',
  TEACHERS: 'Carga el listado de docentes (manual o por Excel). Necesario antes de la carga académica.',
  WORKLOAD: 'Asigna cada docente a sus asignaturas y grupos con intensidad horaria semanal.',
  STUDENTS: 'Importa estudiantes y matricúlalos a su grupo. El paso final del setup.',
}

export default function Setup() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [status, setStatus] = useState<SetupStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const userRoles = (user?.roles || []).map((r: any) =>
    typeof r === 'string' ? r : r.role?.name || r.name
  ).filter(Boolean)

  const isAdmin = userRoles.includes('ADMIN_INSTITUTIONAL') ||
                  userRoles.includes('SUPERADMIN') ||
                  userRoles.includes('COORDINADOR') ||
                  userRoles.includes('RECTOR')

  const load = useCallback(async () => {
    try {
      const res = await institutionsApi.getSetupStatus()
      setStatus(res.data)
      setError(null)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo cargar el estado de configuración')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleRefresh = () => {
    setRefreshing(true)
    load()
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto mt-12 p-6 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <p className="text-sm">Esta sección está disponible solo para administradores institucionales.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-slate-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Cargando estado de configuración...</span>
      </div>
    )
  }

  if (error || !status) {
    return (
      <div className="max-w-2xl mx-auto mt-12 p-6 bg-red-50 border border-red-200 rounded-xl text-red-800">
        <p className="font-medium">Error</p>
        <p className="text-sm mt-1">{error || 'Sin datos'}</p>
        <button
          onClick={handleRefresh}
          className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          <RefreshCw className="w-4 h-4" />
          Reintentar
        </button>
      </div>
    )
  }

  const isDone = status.progress >= 100

  // Calcular el primer paso incompleto para marcar el "actual"
  const firstIncompleteIdx = status.steps.findIndex((s) => !s.complete)

  return (
    <div className="max-w-3xl mx-auto py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-blue-600" />
          Configurando {status.institution.name || 'tu institución'}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Sigue estos pasos en orden para tener tu sistema listo. Cada paso depende del anterior.
        </p>
      </div>

      {/* Progress card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{status.progress}%</span>
            <span className="text-sm text-slate-500">
              · Paso {Math.min(status.completedCount + 1, status.totalSteps)} de {status.totalSteps}
            </span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
        <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isDone ? 'bg-green-500' :
              status.progress >= 60 ? 'bg-blue-500' :
              status.progress >= 30 ? 'bg-amber-500' : 'bg-orange-500'
            }`}
            style={{ width: `${status.progress}%` }}
          />
        </div>
      </div>

      {/* Steps list */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
        {status.steps.map((step, idx) => {
          const isCurrent = idx === firstIncompleteIdx
          const isBlocked = !step.complete && idx > firstIncompleteIdx && firstIncompleteIdx !== -1

          return (
            <div
              key={step.key}
              className={`px-5 py-4 flex items-start gap-4 ${
                isCurrent ? 'bg-blue-50/50' : ''
              }`}
            >
              {/* Indicador */}
              <div className="shrink-0 mt-0.5">
                {step.complete ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : isBlocked ? (
                  <Lock className="w-5 h-5 text-slate-300" />
                ) : isCurrent ? (
                  <div className="relative">
                    <Circle className="w-5 h-5 text-blue-500 fill-blue-100" />
                    <div className="absolute inset-0 w-5 h-5 rounded-full bg-blue-500 animate-ping opacity-20" />
                  </div>
                ) : (
                  <Circle className="w-5 h-5 text-slate-300" />
                )}
              </div>

              {/* Contenido */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className={`text-sm font-semibold ${
                    step.complete ? 'text-slate-900' :
                    isBlocked ? 'text-slate-400' :
                    'text-slate-900'
                  }`}>
                    {idx + 1}. {step.label}
                  </h3>
                  {step.complete && (
                    <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      Completado
                    </span>
                  )}
                  {isCurrent && (
                    <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full font-medium">
                      Aquí estás
                    </span>
                  )}
                  {isBlocked && (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      <Lock className="w-3 h-3" />
                      Bloqueado
                    </span>
                  )}
                </div>

                {(isCurrent || (!step.complete && !isBlocked)) && STEP_HINTS[step.key] && (
                  <p className="text-xs text-slate-500 mt-1">{STEP_HINTS[step.key]}</p>
                )}

                {step.complete && step.count > 0 && (
                  <p className="text-xs text-slate-500 mt-1">
                    {step.count} {step.count === 1 ? 'registro' : 'registros'}
                  </p>
                )}

                {/* CTA */}
                {(isCurrent || (!step.complete && !isBlocked)) && (
                  <button
                    onClick={() => navigate(step.path)}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Ir a este paso
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {step.complete && (
                  <button
                    onClick={() => navigate(step.path)}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                  >
                    Editar
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-sm text-slate-500 hover:text-slate-700 underline"
        >
          Saltar al sistema completo
        </button>

        {isDone && (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            ¡Configuración completa! Tu institución está lista.
          </div>
        )}
      </div>
    </div>
  )
}
