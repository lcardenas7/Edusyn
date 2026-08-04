import { useState, useEffect } from 'react'
import { confirmDialog } from '../components/ui/confirm'
import { useAuth } from '../contexts/AuthContext'
import { capabilitiesApi } from '../lib/api'
import {
  Shield,
  Save,
  RotateCcw,
  CheckSquare,
  Square,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Calendar,
  BarChart3,
  ClipboardList,
  Clock,
  Users,
} from 'lucide-react'

// Etiquetas legibles para cada capability
const CAPABILITY_LABELS: Record<string, { name: string; description: string; icon: any; module: string }> = {
  VIEW_OWN_SCHEDULE: {
    name: 'Ver su propio horario',
    description: 'El docente puede ver únicamente su horario personal',
    icon: Clock,
    module: 'Horarios',
  },
  VIEW_TUTOR_GROUP_SCHEDULE: {
    name: 'Ver horario del grupo tutor',
    description: 'El director de grupo puede ver el horario completo de su grupo',
    icon: Calendar,
    module: 'Horarios',
  },
  VIEW_OWN_COURSE_REPORTS: {
    name: 'Reportes de sus cursos',
    description: 'El docente puede ver reportes académicos de los cursos donde dicta clase',
    icon: BarChart3,
    module: 'Reportes',
  },
  VIEW_TUTOR_GROUP_REPORTS: {
    name: 'Reportes del grupo tutor',
    description: 'El director de grupo puede ver reportes globales de su grupo',
    icon: Eye,
    module: 'Reportes',
  },
  VIEW_STUDENT_OBSERVER: {
    name: 'Observador de sus estudiantes',
    description: 'El docente puede ver el observador de los estudiantes que atiende',
    icon: ClipboardList,
    module: 'Reportes',
  },
  VIEW_GROUP_ATTENDANCE: {
    name: 'Asistencia del grupo tutor',
    description: 'El director de grupo puede ver la asistencia completa de su grupo',
    icon: Users,
    module: 'Reportes',
  },
  VIEW_GLOBAL_STATS: {
    name: 'Estadísticas institucionales',
    description: 'Permite ver estadísticas globales de toda la institución',
    icon: BarChart3,
    module: 'Reportes',
  },
}

// Etiquetas para roles configurables
const ROLE_LABELS: Record<string, { name: string; description: string }> = {
  DOCENTE: { name: 'Docente', description: 'Docente sin dirección de grupo' },
  DOCENTE_TUTOR: { name: 'Director de Grupo', description: 'Docente que es director/tutor de un grupo' },
  COORDINADOR: { name: 'Coordinador', description: 'Coordinador académico o de convivencia' },
}

export default function CapabilitiesConfig() {
  const { user } = useAuth()
  const institutionId = user?.institution?.id

  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>({})
  const [catalog, setCatalog] = useState<Array<{ key: string; module: string }>>([])
  const [roles, setRoles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [pendingChanges, setPendingChanges] = useState<Array<{ role: string; capabilityKey: string; isEnabled: boolean }>>([])

  useEffect(() => {
    if (institutionId) loadMatrix()
  }, [institutionId])

  const loadMatrix = async () => {
    if (!institutionId) return
    setLoading(true)
    try {
      const res = await capabilitiesApi.getMatrix(institutionId)
      const data = res.data
      setMatrix(data.matrix)
      setCatalog(data.catalog)
      setRoles(data.roles)
      setPendingChanges([])
    } catch (err) {
      console.error('Error loading capability matrix:', err)
      setMessage({ type: 'error', text: 'Error al cargar la configuración' })
    } finally {
      setLoading(false)
    }
  }

  const toggleCapability = (role: string, capabilityKey: string) => {
    const currentValue = matrix[role]?.[capabilityKey] ?? false
    const newValue = !currentValue

    // Actualizar localmente
    setMatrix(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [capabilityKey]: newValue,
      },
    }))

    // Registrar cambio pendiente
    setPendingChanges(prev => {
      const existing = prev.findIndex(c => c.role === role && c.capabilityKey === capabilityKey)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = { role, capabilityKey, isEnabled: newValue }
        return updated
      }
      return [...prev, { role, capabilityKey, isEnabled: newValue }]
    })
  }

  const handleSave = async () => {
    if (!institutionId || pendingChanges.length === 0) return
    setSaving(true)
    try {
      await capabilitiesApi.updateMatrix(institutionId, pendingChanges)
      setPendingChanges([])
      setMessage({ type: 'success', text: 'Permisos actualizados correctamente' })
    } catch (err) {
      console.error('Error saving capabilities:', err)
      setMessage({ type: 'error', text: 'Error al guardar los permisos' })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleReset = async () => {
    if (!institutionId) return
    if (!(await confirmDialog('¿Restaurar todos los permisos a los valores por defecto del sistema?', { danger: true }))) return
    setSaving(true)
    try {
      await capabilitiesApi.resetToDefaults(institutionId)
      await loadMatrix()
      setMessage({ type: 'success', text: 'Permisos restaurados a valores por defecto' })
    } catch (err) {
      console.error('Error resetting capabilities:', err)
      setMessage({ type: 'error', text: 'Error al restaurar permisos' })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  // Agrupar capabilities por módulo
  const capsByModule = catalog.reduce<Record<string, Array<{ key: string; module: string }>>>((acc, cap) => {
    const mod = cap.module
    if (!acc[mod]) acc[mod] = []
    acc[mod].push(cap)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="ml-3 text-slate-500">Cargando configuración de permisos...</span>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Shield className="w-7 h-7 text-indigo-600" />
            Permisos de Visualización
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure qué información pueden ver los docentes y directores de grupo
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Restaurar por defecto
          </button>
          <button
            onClick={handleSave}
            disabled={saving || pendingChanges.length === 0}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar {pendingChanges.length > 0 && `(${pendingChanges.length})`}
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">Cómo funciona</h3>
        <ul className="text-xs text-blue-700 space-y-1">
          <li><strong>Docente:</strong> Cualquier usuario con rol de docente que no sea director de grupo.</li>
          <li><strong>Director de Grupo:</strong> Docente que ha sido asignado como director/tutor de un grupo. Hereda los permisos de Docente más los propios.</li>
          <li><strong>Coordinador:</strong> Coordinador académico. Los administradores y superadmins siempre tienen acceso completo.</li>
          <li>Los cambios aplican inmediatamente después de guardar.</li>
        </ul>
      </div>

      {/* Matrix table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700 w-2/5">
                Permiso
              </th>
              {roles.map(role => (
                <th key={role} className="text-center px-4 py-4 w-1/5">
                  <div className="text-sm font-semibold text-slate-800">
                    {ROLE_LABELS[role]?.name || role}
                  </div>
                  <div className="text-xs text-slate-400 font-normal mt-0.5">
                    {ROLE_LABELS[role]?.description || ''}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(capsByModule).map(([moduleName, caps]) => (
              <>
                {/* Module header row */}
                <tr key={`mod-${moduleName}`} className="bg-indigo-50/50">
                  <td colSpan={roles.length + 1} className="px-6 py-2">
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide">
                      {moduleName === 'TIMETABLE' ? 'Horarios' : moduleName === 'REPORTS' ? 'Reportes' : moduleName}
                    </span>
                  </td>
                </tr>
                {/* Capability rows */}
                {caps.map(cap => {
                  const label = CAPABILITY_LABELS[cap.key]
                  const Icon = label?.icon || Eye
                  return (
                    <tr key={cap.key} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3">
                        <div className="flex items-start gap-3">
                          <Icon className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="text-sm font-medium text-slate-800">
                              {label?.name || cap.key}
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              {label?.description || ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      {roles.map(role => {
                        const isEnabled = matrix[role]?.[cap.key] ?? false
                        return (
                          <td key={role} className="text-center px-4 py-3">
                            <button
                              onClick={() => toggleCapability(role, cap.key)}
                              className="inline-flex items-center justify-center p-1 rounded-md hover:bg-slate-100 transition-colors"
                              title={isEnabled ? 'Desactivar' : 'Activar'}
                            >
                              {isEnabled ? (
                                <CheckSquare className="w-6 h-6 text-indigo-600" />
                              ) : (
                                <Square className="w-6 h-6 text-slate-300" />
                              )}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pending changes indicator */}
      {pendingChanges.length > 0 && (
        <div className="fixed bottom-6 right-6 bg-indigo-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3">
          <span className="text-sm font-medium">
            {pendingChanges.length} cambio{pendingChanges.length !== 1 ? 's' : ''} sin guardar
          </span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-white text-indigo-700 px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-indigo-50 transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      )}
    </div>
  )
}
