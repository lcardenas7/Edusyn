import { useState, useEffect } from 'react'
import { BarChart3, TrendingUp, Users, Award, RefreshCw, Building2 } from 'lucide-react'
import { useInstitution } from '../contexts/InstitutionContext'
import { statisticsApi, academicYearsApi } from '../lib/api'

const LEVEL_COLORS: Record<string, string> = {
  SUPERIOR: 'bg-green-500',
  ALTO: 'bg-blue-500',
  BASICO: 'bg-amber-500',
  BAJO: 'bg-red-500',
}

const LEVEL_LABELS: Record<string, string> = {
  SUPERIOR: 'Superior',
  ALTO: 'Alto',
  BASICO: 'Básico',
  BAJO: 'Bajo',
}

interface GeneralStats {
  totalStudents: number
  generalAverage: number
  approvalRate: number
  attendanceRate: number
}

interface PerformanceDistribution {
  level: string
  count: number
  percentage: number
}

interface SubjectStat {
  id: string
  name: string
  areaName: string
  average: number
  approvalRate: number
  totalGrades: number
}

interface GroupStat {
  id: string
  name: string
  studentCount: number
  average: number
  approvalRate: number
}

export default function Statistics() {
  const { institution } = useInstitution()
  const [loading, setLoading] = useState(true)
  const [academicYears, setAcademicYears] = useState<any[]>([])
  const [selectedYearId, setSelectedYearId] = useState('')
  const [terms, setTerms] = useState<any[]>([])
  const [selectedTermId, setSelectedTermId] = useState('')

  const [general, setGeneral] = useState<GeneralStats>({
    totalStudents: 0,
    generalAverage: 0,
    approvalRate: 0,
    attendanceRate: 0,
  })
  const [performanceDistribution, setPerformanceDistribution] = useState<PerformanceDistribution[]>([])
  const [subjectStats, setSubjectStats] = useState<SubjectStat[]>([])
  const [groupStats, setGroupStats] = useState<GroupStat[]>([])

  useEffect(() => {
    loadAcademicYears()
  }, [])

  useEffect(() => {
    if (selectedYearId) {
      const year = academicYears.find(y => y.id === selectedYearId)
      setTerms(year?.terms || [])
    }
  }, [selectedYearId, academicYears])

  useEffect(() => {
    if (institution?.id) {
      if (selectedYearId) {
        loadStatistics()
      } else {
        setLoading(false)
      }
    }
  }, [institution, selectedYearId, selectedTermId])

  const loadAcademicYears = async () => {
    try {
      const response = await academicYearsApi.getAll()
      setAcademicYears(response.data)
      const current = response.data.find((y: any) => y.isCurrent)
      if (current) {
        setSelectedYearId(current.id)
      }
    } catch (err) {
      console.error('Error loading academic years:', err)
    }
  }

  const loadStatistics = async () => {
    if (!institution?.id) return
    setLoading(true)
    try {
      const response = await statisticsApi.getFull(
        institution.id,
        selectedYearId || undefined,
        selectedTermId || undefined
      )
      const data = response.data
      setGeneral(data.general)
      setPerformanceDistribution(data.performanceDistribution || [])
      setSubjectStats(data.subjectStats || [])
      setGroupStats(data.groupStats || [])
    } catch (err) {
      console.error('Error loading statistics:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!institution) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">Seleccione una institución</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Año Académico</label>
              <select
                value={selectedYearId}
                onChange={(e) => setSelectedYearId(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                {academicYears.map(year => (
                  <option key={year.id} value={year.id}>{year.year}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Período</label>
              <select
                value={selectedTermId}
                onChange={(e) => setSelectedTermId(e.target.value)}
                disabled={!selectedYearId}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
              >
                <option value="">Todos</option>
                {terms.map(term => (
                  <option key={term.id} value={term.id}>{term.name}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={loadStatistics}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Estadísticas</h1>
        <p className="text-slate-500 mt-1">Análisis del rendimiento académico institucional</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{general.totalStudents}</p>
                  <p className="text-sm text-slate-500">Estudiantes</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{general.generalAverage.toFixed(2)}</p>
                  <p className="text-sm text-slate-500">Promedio General</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Award className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{general.approvalRate}%</p>
                  <p className="text-sm text-slate-500">Tasa Aprobación</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{general.attendanceRate}%</p>
                  <p className="text-sm text-slate-500">Asistencia</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="px-6 py-4 border-b border-slate-200">
                <h2 className="font-semibold text-slate-900">Distribución por Desempeño</h2>
              </div>
              <div className="p-6">
                {performanceDistribution.length > 0 ? (
                  <div className="space-y-4">
                    {performanceDistribution.map((item) => (
                      <div key={item.level}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-slate-700">{LEVEL_LABELS[item.level] || item.level}</span>
                          <span className="text-sm text-slate-500">{item.count} ({item.percentage}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-3">
                          <div
                            className={`${LEVEL_COLORS[item.level] || 'bg-slate-400'} h-3 rounded-full transition-all`}
                            style={{ width: `${item.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-slate-500 py-8">No hay datos de desempeño disponibles</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="px-6 py-4 border-b border-slate-200">
                <h2 className="font-semibold text-slate-900">Rendimiento por Asignatura</h2>
              </div>
              <div className="p-6">
                {subjectStats.length > 0 ? (
                  <div className="space-y-4 max-h-80 overflow-y-auto">
                    {subjectStats.slice(0, 10).map((subject) => (
                      <div key={subject.id} className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">{subject.name}</p>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="text-sm text-slate-500">Promedio: <strong>{subject.average.toFixed(2)}</strong></span>
                            <span className="text-sm text-slate-500">Aprobación: <strong>{subject.approvalRate}%</strong></span>
                          </div>
                        </div>
                        <div className="w-24 bg-slate-100 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${(subject.average / 5) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-slate-500 py-8">No hay datos de asignaturas disponibles</p>
                )}
              </div>
            </div>
          </div>

          {/* Rendimiento por Grupo */}
          {groupStats.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="px-6 py-4 border-b border-slate-200">
                <h2 className="font-semibold text-slate-900">Rendimiento por Grupo</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {groupStats.map((group) => (
                    <div key={group.id} className="border border-slate-200 rounded-lg p-4">
                      <p className="font-medium text-slate-900 mb-2">{group.name}</p>
                      <div className="space-y-1 text-sm">
                        <p className="text-slate-500">Estudiantes: <strong>{group.studentCount}</strong></p>
                        <p className="text-slate-500">Promedio: <strong>{group.average.toFixed(2)}</strong></p>
                        <p className="text-slate-500">Aprobación: <strong>{group.approvalRate}%</strong></p>
                      </div>
                      <div className="mt-2 w-full bg-slate-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${group.average >= 4 ? 'bg-green-500' : group.average >= 3 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${(group.average / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
