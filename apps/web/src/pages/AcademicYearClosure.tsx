import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Users, AlertTriangle, CheckCircle, FileText, Eye, RefreshCw } from 'lucide-react'
import { academicYearLifecycleApi } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

interface AcademicYear {
  id: string
  year: number
  name: string
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED'
  _count: {
    studentEnrollments: number
    teacherAssignments: number
  }
}

const AcademicYearClosure: React.FC = () => {
  const navigate = useNavigate()
  const { institution } = useAuth()
  
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [selectedYear, setSelectedYear] = useState<AcademicYear | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loadingClosure, setLoadingClosure] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  useEffect(() => {
    if (institution?.id) {
      loadAcademicYears()
    }
  }, [institution])

  const loadAcademicYears = async () => {
    try {
      const response = await academicYearLifecycleApi.getByInstitution(institution!.id)
      const years = response.data
      const closableYears = years.filter((year: AcademicYear) => year.status === 'ACTIVE')
      setAcademicYears(closableYears)
      
      if (closableYears.length === 0) {
        setError('No hay años lectivos activos para cerrar')
      }
    } catch (err: any) {
      console.error('Error loading academic years:', err)
      setError(err.response?.data?.message || 'Error al cargar años académicos')
    } finally {
      setLoading(false)
    }
  }

  const closeAcademicYear = async () => {
    if (!selectedYear?.id) return
    
    setLoadingClosure(true)
    try {
      const response = await academicYearLifecycleApi.close(selectedYear.id, { calculatePromotions: true })
      const result = response.data
      
      setSuccessMessage(`Año lectivo cerrado exitosamente. ${result.promotedCount} promovidos, ${result.repeatedCount} repiten, ${result.withdrawnCount} retirados.`)
      
      await loadAcademicYears()
      setSelectedYear(null)
      setShowConfirmModal(false)
      
      setTimeout(() => {
        navigate('/institution')
      }, 3000)
    } catch (err: any) {
      console.error('Error closing academic year:', err)
      setError(err.response?.data?.message || 'Error al cerrar año lectivo')
    } finally {
      setLoadingClosure(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Cierre de Año Lectivo</h1>
              <p className="text-slate-600 mt-1">Gestiona el cierre de años lectivos y promociones de estudiantes</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/academic-year-wizard')}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
              >
                <Calendar className="w-4 h-4" />
                Wizard Año
              </button>
              <button
                onClick={() => navigate('/enrollments')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Users className="w-4 h-4" />
                Matrículas
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600">{error}</p>
            <button
              onClick={() => navigate('/institution')}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Volver a Configuración
            </button>
          </div>
        ) : academicYears.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <p className="text-yellow-800 mb-4">No hay años lectivos activos para cerrar</p>
            <p className="text-yellow-600 text-sm mb-4">
              Solo se pueden cerrar años lectivos que estén en estado "Activo". 
              Usa el Wizard de Año Lectivo para crear y activar un nuevo año.
            </p>
            <button
              onClick={() => navigate('/academic-year-wizard')}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
            >
              Ir al Wizard de Año Lectivo
            </button>
          </div>
        ) : (
          <>
            {/* Selector de año */}
            <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Seleccionar Año Lectivo</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {academicYears.map((year: AcademicYear) => (
                  <div
                    key={year.id}
                    onClick={() => setSelectedYear(year)}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      selectedYear?.id === year.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-slate-900">{year.name}</h3>
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
                        Activo
                      </span>
                    </div>
                    <div className="text-sm text-slate-600 space-y-1">
                      <p>Año: {year.year}</p>
                      <p>Matrículas: {year._count.studentEnrollments}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedYear && (
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Resumen del Año Lectivo</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-600">Matrículas Totales</span>
                      <Users className="w-5 h-5 text-slate-400" />
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{selectedYear._count.studentEnrollments}</p>
                  </div>
                  
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-600">Asignaciones Docentes</span>
                      <Users className="w-5 h-5 text-slate-400" />
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{selectedYear._count.teacherAssignments}</p>
                  </div>
                  
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-600">Estado</span>
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                    <p className="text-2xl font-bold text-green-600">Activo</p>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-amber-900 mb-2">Advertencia de Cierre</h4>
                      <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                        <li>El cierre del año lectivo es una acción irreversible</li>
                        <li>Se calcularán automáticamente las promociones de estudiantes</li>
                        <li>Las calificaciones quedarán bloqueadas para este año</li>
                        <li>Se generarán eventos de auditoría para todas las promociones</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <button
                    onClick={() => setShowConfirmModal(true)}
                    className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Cerrar Año Lectivo
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Modal de confirmación */}
        {showConfirmModal && selectedYear && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">Confirmar Cierre de Año</h3>
              
              <div className="space-y-4 mb-6">
                <p className="text-slate-600">
                  ¿Estás seguro de que deseas cerrar el año lectivo <strong>{selectedYear.name}</strong>?
                </p>
                
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-700">
                    Esta acción es irreversible y afectará a todos los estudiantes matriculados.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  disabled={loadingClosure}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={closeAcademicYear}
                  disabled={loadingClosure}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loadingClosure ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Cerrando...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      Cerrar Año
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mensaje de éxito */}
        {successMessage && (
          <div className="fixed bottom-4 right-4 bg-green-50 border border-green-200 rounded-lg p-4 shadow-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <p className="text-green-700">{successMessage}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AcademicYearClosure
