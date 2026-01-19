import { useState, useEffect } from 'react'
import { AlertTriangle, CheckCircle, Clock, User } from 'lucide-react'
import { academicYearsApi, academicTermsApi, periodFinalGradesApi, teacherAssignmentsApi, periodRecoveryApi } from '../lib/api'

interface Alert {
  id: string
  student: string
  enrollmentId: string
  group: string
  subject: string
  subjectId: string
  grade: number
  status: 'OPEN' | 'IN_RECOVERY' | 'RESOLVED'
  date: string
}

const statusConfig = {
  OPEN: { label: 'Abierta', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  IN_RECOVERY: { label: 'En recuperación', color: 'bg-amber-100 text-amber-700', icon: Clock },
  RESOLVED: { label: 'Resuelta', color: 'bg-green-100 text-green-700', icon: CheckCircle },
}

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYearId, setSelectedYearId] = useState('')
  const [selectedTermId, setSelectedTermId] = useState('')
  const [academicYears, setAcademicYears] = useState<any[]>([])
  const [terms, setTerms] = useState<any[]>([])

  // Cargar años académicos
  useEffect(() => {
    const loadYears = async () => {
      try {
        const response = await academicYearsApi.getAll()
        const years = response.data || []
        setAcademicYears(years)
        // Seleccionar el año activo o el más reciente
        const activeYear = years.find((y: any) => y.status === 'ACTIVE') || years[0]
        if (activeYear) setSelectedYearId(activeYear.id)
      } catch (err) {
        console.error('Error loading years:', err)
      }
    }
    loadYears()
  }, [])

  // Cargar períodos cuando cambia el año
  useEffect(() => {
    const loadTerms = async () => {
      if (!selectedYearId) return
      try {
        const response = await academicTermsApi.getAll(selectedYearId)
        const termsData = response.data || []
        setTerms(termsData)
        if (termsData.length > 0) setSelectedTermId(termsData[0].id)
      } catch (err) {
        console.error('Error loading terms:', err)
      }
    }
    loadTerms()
  }, [selectedYearId])

  // Cargar alertas basadas en notas bajas
  useEffect(() => {
    const loadAlerts = async () => {
      if (!selectedTermId || !selectedYearId) {
        setAlerts([])
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        // Obtener asignaciones del docente
        const assignmentsRes = await teacherAssignmentsApi.getAll({ academicYearId: selectedYearId })
        const assignments = assignmentsRes.data || []

        // Obtener grupos únicos
        const groupIds = [...new Set(assignments.map((a: any) => a.group?.id).filter(Boolean))]

        // Obtener notas de todos los grupos
        let allGrades: any[] = []
        for (const groupId of groupIds) {
          try {
            const gradesRes = await periodFinalGradesApi.getByGroup(groupId as string, selectedTermId)
            allGrades = [...allGrades, ...(gradesRes.data || [])]
          } catch (err) {
            console.error(`Error loading grades for group ${groupId}:`, err)
          }
        }

        // Obtener recuperaciones existentes
        let recoveries: any[] = []
        try {
          const recoveriesRes = await periodRecoveryApi.getByTerm(selectedTermId)
          recoveries = recoveriesRes.data || []
        } catch (err) {
          console.error('Error loading recoveries:', err)
        }

        // Filtrar notas bajas y crear alertas
        const alertsList: Alert[] = allGrades
          .filter((g: any) => Number(g.finalScore) < 3.0)
          .map((g: any) => {
            const student = g.studentEnrollment?.student
            const recovery = recoveries.find((r: any) => 
              r.studentEnrollmentId === g.studentEnrollmentId && 
              r.subjectId === g.subjectId
            )
            
            let status: 'OPEN' | 'IN_RECOVERY' | 'RESOLVED' = 'OPEN'
            if (recovery) {
              if (recovery.status === 'COMPLETED' && recovery.recoveryScore >= 3.0) {
                status = 'RESOLVED'
              } else {
                status = 'IN_RECOVERY'
              }
            }

            return {
              id: g.id,
              student: student ? `${student.firstName} ${student.lastName}` : 'Estudiante',
              enrollmentId: g.studentEnrollmentId,
              group: g.studentEnrollment?.group?.name || '',
              subject: g.subject?.name || 'Asignatura',
              subjectId: g.subjectId,
              grade: Number(g.finalScore),
              status,
              date: g.updatedAt?.split('T')[0] || new Date().toISOString().split('T')[0],
            }
          })

        setAlerts(alertsList)
      } catch (err) {
        console.error('Error loading alerts:', err)
        setAlerts([])
      } finally {
        setLoading(false)
      }
    }

    loadAlerts()
  }, [selectedTermId, selectedYearId])

  const openAlerts = alerts.filter(a => a.status === 'OPEN').length
  const inRecovery = alerts.filter(a => a.status === 'IN_RECOVERY').length
  const resolved = alerts.filter(a => a.status === 'RESOLVED').length

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Alertas de Riesgo</h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">Estudiantes con bajo rendimiento académico</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Año Académico</label>
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar...</option>
              {academicYears.map(year => (
                <option key={year.id} value={year.id}>{year.year}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Período</label>
            <select
              value={selectedTermId}
              onChange={(e) => setSelectedTermId(e.target.value)}
              disabled={!selectedYearId}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
            >
              <option value="">Seleccionar...</option>
              {terms.map(term => (
                <option key={term.id} value={term.id}>{term.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{openAlerts}</p>
              <p className="text-sm text-slate-500">Alertas Abiertas</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{inRecovery}</p>
              <p className="text-sm text-slate-500">En Recuperación</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{resolved}</p>
              <p className="text-sm text-slate-500">Resueltas</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Listado de Alertas</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-12 h-12 mx-auto text-green-400 mb-4" />
            <p className="text-slate-500">No hay alertas de bajo rendimiento</p>
            <p className="text-sm text-slate-400">Todos los estudiantes tienen notas aprobatorias</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {alerts.map((alert) => {
              const config = statusConfig[alert.status]
              const StatusIcon = config.icon

              return (
                <div key={alert.id} className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-slate-500" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{alert.student}</p>
                      <p className="text-sm text-slate-500">{alert.subject} • {alert.group}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 ml-14 sm:ml-0">
                    <div className="text-right">
                      <p className="text-lg font-bold text-red-600">{alert.grade.toFixed(1)}</p>
                      <p className="text-xs text-slate-500">{alert.date}</p>
                    </div>
                    <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${config.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {config.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
