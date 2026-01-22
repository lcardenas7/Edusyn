import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ChevronLeft, Check, AlertCircle, Calendar, Users, Settings, Play, Square, Trash2, Plus } from 'lucide-react'
import { academicYearLifecycleApi, academicTermsApi, enrollmentsApi } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { useInstitution } from '../contexts/InstitutionContext'

interface AcademicYear {
  id: string
  year: number
  name: string
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED'
  startDate?: string
  endDate?: string
  activatedAt?: string
  closedAt?: string
  calendar?: any
  terms: any[]
  _count: {
    studentEnrollments: number
    teacherAssignments: number
  }
}

interface AcademicTerm {
  id: string
  name: string
  type: string
  order: number
  weightPercentage: number
  startDate?: string
  endDate?: string
}

interface ValidationErrors {
  [key: string]: string[]
}

const AcademicYearWizard: React.FC = () => {
  const navigate = useNavigate()
  const { user, institution } = useAuth()
  const { loadPeriodsFromActiveYear } = useInstitution()
  
  // Estado del wizard
  const [currentStep, setCurrentStep] = useState(0)
  const [isCreating, setIsCreating] = useState(false)
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({})
  const [successMessage, setSuccessMessage] = useState('')
  
  // Datos del año lectivo
  const [yearData, setYearData] = useState({
    year: new Date().getFullYear(),
    name: '',
    startDate: '',
    endDate: ''
  })
  
  // Períodos académicos
  const [terms, setTerms] = useState<AcademicTerm[]>([
    { id: '1', name: 'Primer Período', type: 'PERIOD', order: 1, weightPercentage: 25 },
    { id: '2', name: 'Segundo Período', type: 'PERIOD', order: 2, weightPercentage: 25 },
    { id: '3', name: 'Tercer Período', type: 'PERIOD', order: 3, weightPercentage: 25 },
    { id: '4', name: 'Cuarto Período', type: 'PERIOD', order: 4, weightPercentage: 25 }
  ])
  
  // Componentes Finales Institucionales (Pruebas Semestrales, etc.)
  const [useFinalComponents, setUseFinalComponents] = useState(false)
  const [finalComponents, setFinalComponents] = useState<Array<{ id: string; name: string; weightPercentage: number }>>([
    { id: 'fc-1', name: 'Examen Semestral 1', weightPercentage: 10 },
    { id: 'fc-2', name: 'Examen Semestral 2', weightPercentage: 10 }
  ])
  
  // Años existentes
  const [existingYears, setExistingYears] = useState<AcademicYear[]>([])
  const [currentYear, setCurrentYear] = useState<AcademicYear | null>(null)
  
  // Estado de la operación
  const [createdYear, setCreatedYear] = useState<AcademicYear | null>(null)
  const [isActivating, setIsActivating] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  const steps = [
    { id: 'info', title: 'Información Básica', icon: Calendar, description: 'Datos del año lectivo' },
    { id: 'periods', title: 'Períodos Académicos', icon: Settings, description: 'Configurar períodos' },
    { id: 'review', title: 'Revisión', icon: Check, description: 'Confirmar configuración' },
    { id: 'actions', title: 'Acciones', icon: Play, description: 'Activar o cerrar año' }
  ]

  useEffect(() => {
    if (institution?.id) {
      loadExistingYears()
      loadCurrentYear()
    }
  }, [institution])

  const loadExistingYears = async () => {
    try {
      const response = await academicYearLifecycleApi.getByInstitution(institution!.id)
      setExistingYears(response.data)
    } catch (error) {
      console.error('Error loading existing years:', error)
    }
  }

  const loadCurrentYear = async () => {
    try {
      const response = await academicYearLifecycleApi.getCurrent(institution!.id)
      if (response.data) {
        setCurrentYear(response.data)
      }
    } catch (error) {
      console.error('Error loading current year:', error)
    }
  }

  const validateStep = (step: number): boolean => {
    const errors: ValidationErrors = {}

    switch (step) {
      case 0: // Información básica
        if (!yearData.year) {
          errors.year = ['El año es requerido']
        }
        if (yearData.year < 2000 || yearData.year > 2100) {
          errors.year = ['El año debe estar entre 2000 y 2100']
        }
        if (existingYears.some(y => y.year === yearData.year)) {
          errors.year = ['Ya existe un año lectivo para este año']
        }
        if (yearData.startDate && yearData.endDate && yearData.startDate >= yearData.endDate) {
          errors.dates = ['La fecha de inicio debe ser anterior a la fecha de fin']
        }
        break

      case 1: // Períodos académicos
        const termsWeight = terms.reduce((sum, term) => sum + term.weightPercentage, 0)
        const finalWeight = useFinalComponents ? finalComponents.reduce((sum, fc) => sum + fc.weightPercentage, 0) : 0
        const totalWeight = termsWeight + finalWeight
        
        if (terms.length < 1) {
          errors.terms = ['Debe haber al menos 1 período académico']
        } else if (terms.some(t => !t.name.trim())) {
          errors.terms = ['Todos los períodos deben tener nombre']
        } else if (terms.some(t => t.weightPercentage <= 0)) {
          errors.terms = ['Ningún período puede tener peso 0% o menor']
        } else if (useFinalComponents && finalComponents.some(fc => fc.weightPercentage <= 0)) {
          errors.terms = ['Ningún componente final puede tener peso 0% o menor']
        } else if (totalWeight !== 100) {
          errors.terms = [`El peso total debe ser 100%. Actual: ${totalWeight}% (Períodos: ${termsWeight}%${useFinalComponents ? `, Componentes Finales: ${finalWeight}%` : ''})`]
        }
        break

      case 2: // Revisión - no hay validación específica
        break
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length - 1))
    }
  }

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0))
    setValidationErrors({})
  }

  const createYear = async () => {
    if (!institution?.id) return

    // Verificar si el año ya existe
    const existingYear = existingYears.find(y => y.year === yearData.year)
    if (existingYear) {
      setValidationErrors({
        general: [`El año ${yearData.year} ya existe con estado: ${existingYear.status === 'DRAFT' ? 'Borrador' : existingYear.status === 'ACTIVE' ? 'Activo' : 'Cerrado'}. Usa el botón "Continuar Configuración" para editarlo.`]
      })
      return
    }

    setIsCreating(true)
    try {
      const response = await academicYearLifecycleApi.create({
        institutionId: institution.id,
        year: yearData.year,
        name: yearData.name || `Año Lectivo ${yearData.year}`,
        startDate: yearData.startDate || undefined,
        endDate: yearData.endDate || undefined
      })

      const newYear = response.data
      console.log('Created year response:', newYear)
      
      if (!newYear?.id) {
        throw new Error('No se recibió el ID del año lectivo creado')
      }
      
      const yearId = newYear.id
      setCreatedYear(newYear)

      // Crear períodos académicos
      console.log('Creating terms for yearId:', yearId)
      for (const term of terms) {
        console.log('Creating term:', term.name, 'for year:', yearId)
        await academicTermsApi.create({
          academicYearId: yearId,
          type: 'PERIOD',
          name: term.name,
          order: term.order,
          weightPercentage: term.weightPercentage
        })
      }

      // Crear componentes finales si están habilitados
      if (useFinalComponents && finalComponents.length > 0) {
        for (let i = 0; i < finalComponents.length; i++) {
          const fc = finalComponents[i]
          console.log('Creating final component:', fc.name, 'for year:', yearId)
          await academicTermsApi.create({
            academicYearId: yearId,
            type: 'SEMESTER_EXAM',
            name: fc.name,
            order: terms.length + i + 1,
            weightPercentage: fc.weightPercentage
          })
        }
      }

      setSuccessMessage('Año lectivo creado exitosamente')
      nextStep()
    } catch (error: any) {
      console.error('Error creating year:', error)
      console.error('Error response:', error.response?.data)
      const errorMessage = Array.isArray(error.response?.data?.message) 
        ? error.response.data.message.join(', ')
        : error.response?.data?.message || 'Error al crear el año lectivo'
      setValidationErrors({ 
        general: [errorMessage] 
      })
    } finally {
      setIsCreating(false)
    }
  }

  const activateYear = async () => {
    if (!createdYear?.id) return

    setIsActivating(true)
    try {
      // Validar antes de activar
      const validation = await academicYearLifecycleApi.validateActivation(createdYear.id)
      if (!validation.data.isValid) {
        setValidationErrors({ activation: validation.data.errors })
        return
      }

      await academicYearLifecycleApi.activate(createdYear.id)
      setSuccessMessage('Año lectivo activado exitosamente')
      
      // Recargar datos
      await loadExistingYears()
      await loadCurrentYear()
      
      // Sincronizar períodos con la configuración institucional
      if (institution?.id) {
        await loadPeriodsFromActiveYear(institution.id)
      }
      
      setTimeout(() => {
        navigate('/institution')
      }, 2000)
    } catch (error: any) {
      console.error('Error activating year:', error)
      setValidationErrors({ 
        activation: [error.response?.data?.message || 'Error al activar el año lectivo'] 
      })
    } finally {
      setIsActivating(false)
    }
  }

  const closeYear = async () => {
    if (!currentYear?.id) return

    setIsClosing(true)
    try {
      // Validar antes de cerrar
      const validation = await academicYearLifecycleApi.validateClosure(currentYear.id)
      if (!validation.data.isValid) {
        setValidationErrors({ closure: validation.data.errors })
        return
      }

      await academicYearLifecycleApi.close(currentYear.id, { calculatePromotions: true })
      setSuccessMessage('Año lectivo cerrado exitosamente')
      
      // Recargar datos
      await loadExistingYears()
      await loadCurrentYear()
    } catch (error: any) {
      console.error('Error closing year:', error)
      setValidationErrors({ 
        closure: [error.response?.data?.message || 'Error al cerrar el año lectivo'] 
      })
    } finally {
      setIsClosing(false)
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Información básica
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Información del Año Lectivo</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Año *</label>
                  <input
                    type="number"
                    value={yearData.year}
                    onChange={(e) => {
                      const newYear = parseInt(e.target.value) || 0
                      setYearData({ ...yearData, year: newYear })
                      // Limpiar error si el año es diferente
                      if (existingYears.some(y => y.year === newYear)) {
                        setValidationErrors(prev => ({
                          ...prev,
                          year: [`El año ${newYear} ya existe. Elige un año diferente.`]
                        }))
                      } else {
                        setValidationErrors(prev => {
                          const newErrors = { ...prev }
                          delete newErrors.year
                          return newErrors
                        })
                      }
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 ${
                      existingYears.some(y => y.year === yearData.year) 
                        ? 'border-red-300 bg-red-50' 
                        : 'border-slate-300'
                    }`}
                    min="2000"
                    max="2100"
                  />
                  {validationErrors.year && (
                    <p className="text-red-500 text-sm mt-1">{validationErrors.year[0]}</p>
                  )}
                  {existingYears.some(y => y.year === yearData.year) && !validationErrors.year && (
                    <p className="text-amber-600 text-sm mt-1">
                      ⚠️ Este año ya existe. Usa "Continuar Configuración" para editarlo.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Nombre (opcional)</label>
                  <input
                    type="text"
                    value={yearData.name}
                    onChange={(e) => setYearData({ ...yearData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    placeholder="Ej: Año Lectivo 2024"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Fecha de inicio (opcional)</label>
                  <input
                    type="date"
                    value={yearData.startDate}
                    onChange={(e) => setYearData({ ...yearData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Fecha de fin (opcional)</label>
                  <input
                    type="date"
                    value={yearData.endDate}
                    onChange={(e) => setYearData({ ...yearData, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                  {validationErrors.dates && (
                    <p className="text-red-500 text-sm mt-1">{validationErrors.dates[0]}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Años existentes */}
            {existingYears.length > 0 && (
              <div>
                <h4 className="text-md font-medium text-slate-700 mb-3">⚠️ Años Lectivos Existentes</h4>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-800 mb-3">
                    Ya existen años lectivos configurados. No puedes crear años duplicados.
                  </p>
                  <div className="space-y-2">
                    {existingYears.map(year => (
                      <div key={year.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${
                            year.status === 'ACTIVE' ? 'bg-green-500' :
                            year.status === 'CLOSED' ? 'bg-red-500' : 'bg-yellow-500'
                          }`} />
                          <div>
                            <span className="font-medium">{year.name}</span>
                            <span className="text-sm text-slate-500 ml-2">({year.year})</span>
                            {year.status === 'ACTIVE' && (
                              <span className="text-xs text-green-600 ml-2">✓ Año actual</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {year.status === 'DRAFT' && (
                            <button
                              onClick={async () => {
                                setCreatedYear(year)
                                // Cargar los términos existentes del año
                                try {
                                  const termsResponse = await academicTermsApi.getByAcademicYear(year.id)
                                  if (termsResponse.data && termsResponse.data.length > 0) {
                                    const loadedTerms = termsResponse.data.map((t: any) => ({
                                      id: t.id,
                                      name: t.name,
                                      type: t.type,
                                      order: t.order,
                                      weightPercentage: t.weightPercentage
                                    }))
                                    setTerms(loadedTerms.filter((t: any) => t.type === 'PERIOD'))
                                    const finalComps = loadedTerms.filter((t: any) => t.type === 'SEMESTER_EXAM')
                                    if (finalComps.length > 0) {
                                      setUseFinalComponents(true)
                                      setFinalComponents(finalComps.map((fc: any) => ({
                                        id: fc.id,
                                        name: fc.name,
                                        weightPercentage: fc.weightPercentage
                                      })))
                                    }
                                    setCurrentStep(3) // Ir a Acciones si ya tiene términos
                                  } else {
                                    setCurrentStep(1) // Ir a configurar períodos si no tiene
                                  }
                                } catch (error) {
                                  console.error('Error loading terms:', error)
                                  setCurrentStep(1) // Ir a configurar períodos en caso de error
                                }
                              }}
                              className="px-3 py-1 text-xs bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                            >
                              Continuar Configuración
                            </button>
                          )}
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            year.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                            year.status === 'CLOSED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {year.status === 'ACTIVE' ? 'Activo' :
                             year.status === 'CLOSED' ? 'Cerrado' : 'Borrador'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {existingYears.some(y => y.status === 'DRAFT') && (
                    <p className="text-xs text-amber-600 mt-3">
                      💡 Tip: Usa "Continuar Configuración" para completar el año en borrador.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )

      case 1: // Períodos académicos
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Períodos Académicos</h3>
              
              <div className="space-y-4">
                {terms.map((term, index) => (
                  <div key={term.id} className="bg-white border border-slate-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                        <input
                          type="text"
                          value={term.name}
                          onChange={(e) => {
                            const newTerms = [...terms]
                            newTerms[index].name = e.target.value
                            setTerms(newTerms)
                          }}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Orden</label>
                        <input
                          type="number"
                          value={term.order}
                          onChange={(e) => {
                            const newTerms = [...terms]
                            newTerms[index].order = parseInt(e.target.value) || 1
                            setTerms(newTerms)
                          }}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                          min="1"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Peso (%)</label>
                        <input
                          type="number"
                          value={term.weightPercentage}
                          onChange={(e) => {
                            const newTerms = [...terms]
                            newTerms[index].weightPercentage = parseInt(e.target.value) || 0
                            setTerms(newTerms)
                          }}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                          min="1"
                          max="100"
                        />
                      </div>
                      {terms.length > 1 && (
                        <div className="flex items-end">
                          <button
                            onClick={() => setTerms(terms.filter((_, i) => i !== index))}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar período"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center mt-4">
                <div className="text-sm text-slate-600">
                  Peso períodos: <span className={`font-semibold ${
                    (terms.reduce((sum, t) => sum + t.weightPercentage, 0) + 
                    (useFinalComponents ? finalComponents.reduce((sum, fc) => sum + fc.weightPercentage, 0) : 0)) === 100 
                    ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {terms.reduce((sum, t) => sum + t.weightPercentage, 0)}%
                  </span>
                </div>
                <button
                  onClick={() => setTerms([...terms, { 
                    id: Date.now().toString(), 
                    name: `Período ${terms.length + 1}`, 
                    type: 'PERIOD', 
                    order: terms.length + 1, 
                    weightPercentage: 20 
                  }])}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Agregar Período
                </button>
              </div>
            </div>

            {/* Componentes Finales Institucionales */}
            <div className="border-t border-slate-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Componentes Finales Institucionales</h3>
                  <p className="text-sm text-slate-500 mt-1">Evaluaciones globales que complementan la nota final del año (ej: Pruebas Semestrales)</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useFinalComponents}
                    onChange={(e) => setUseFinalComponents(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Habilitar</span>
                </label>
              </div>

              {useFinalComponents && (
                <div className="space-y-4">
                  {finalComponents.map((fc, index) => (
                    <div key={fc.id} className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-amber-700 mb-1">Nombre</label>
                          <input
                            type="text"
                            value={fc.name}
                            onChange={(e) => {
                              const newFC = [...finalComponents]
                              newFC[index].name = e.target.value
                              setFinalComponents(newFC)
                            }}
                            className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                          />
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-amber-700 mb-1">Peso (%)</label>
                            <input
                              type="number"
                              value={fc.weightPercentage}
                              onChange={(e) => {
                                const newFC = [...finalComponents]
                                newFC[index].weightPercentage = parseInt(e.target.value) || 0
                                setFinalComponents(newFC)
                              }}
                              className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                              min="1"
                              max="100"
                            />
                          </div>
                          {finalComponents.length > 1 && (
                            <div className="flex items-end">
                              <button
                                onClick={() => setFinalComponents(finalComponents.filter((_, i) => i !== index))}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Eliminar componente"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-between items-center">
                    <div className="text-sm text-amber-700">
                      Peso componentes finales: <span className="font-semibold">{finalComponents.reduce((sum, fc) => sum + fc.weightPercentage, 0)}%</span>
                    </div>
                    <button
                      onClick={() => setFinalComponents([...finalComponents, { 
                        id: `fc-${Date.now()}`, 
                        name: `Componente ${finalComponents.length + 1}`, 
                        weightPercentage: 5 
                      }])}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Agregar Componente
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Resumen de peso total */}
            <div className="bg-slate-100 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="font-medium text-slate-700">Peso Total:</span>
                <span className={`text-lg font-bold ${
                  (terms.reduce((sum, t) => sum + t.weightPercentage, 0) + 
                  (useFinalComponents ? finalComponents.reduce((sum, fc) => sum + fc.weightPercentage, 0) : 0)) === 100 
                  ? 'text-green-600' : 'text-red-600'
                }`}>
                  {terms.reduce((sum, t) => sum + t.weightPercentage, 0) + 
                   (useFinalComponents ? finalComponents.reduce((sum, fc) => sum + fc.weightPercentage, 0) : 0)}%
                </span>
              </div>
              {useFinalComponents && (
                <div className="text-xs text-slate-500 mt-1">
                  (Períodos: {terms.reduce((sum, t) => sum + t.weightPercentage, 0)}% + Componentes Finales: {finalComponents.reduce((sum, fc) => sum + fc.weightPercentage, 0)}%)
                </div>
              )}
            </div>

            {validationErrors.terms && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-700 text-sm">{validationErrors.terms[0]}</p>
              </div>
            )}
          </div>
        )

      case 2: // Revisión
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Revisión de Configuración</h3>
            
            <div className="bg-slate-50 rounded-lg p-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-slate-700 mb-2">Información del Año</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">Año:</span>
                      <span className="ml-2 font-medium">{yearData.year}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Nombre:</span>
                      <span className="ml-2 font-medium">{yearData.name || `Año Lectivo ${yearData.year}`}</span>
                    </div>
                    {yearData.startDate && (
                      <div>
                        <span className="text-slate-500">Inicio:</span>
                        <span className="ml-2 font-medium">{new Date(yearData.startDate).toLocaleDateString()}</span>
                      </div>
                    )}
                    {yearData.endDate && (
                      <div>
                        <span className="text-slate-500">Fin:</span>
                        <span className="ml-2 font-medium">{new Date(yearData.endDate).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-slate-700 mb-2">Períodos Académicos</h4>
                  <div className="space-y-2">
                    {terms.sort((a, b) => a.order - b.order).map(term => (
                      <div key={term.id} className="flex justify-between items-center p-2 bg-white rounded border">
                        <span className="text-sm">{term.name}</span>
                        <span className="text-sm font-medium">{term.weightPercentage}%</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 pt-2 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Subtotal Períodos:</span>
                      <span className="text-sm font-bold text-slate-700">
                        {terms.reduce((sum, t) => sum + t.weightPercentage, 0)}%
                      </span>
                    </div>
                  </div>
                </div>

                {useFinalComponents && (
                  <div>
                    <h4 className="font-medium text-amber-700 mb-2">Componentes Finales Institucionales</h4>
                    <div className="space-y-2">
                      {finalComponents.map(fc => (
                        <div key={fc.id} className="flex justify-between items-center p-2 bg-amber-50 rounded border border-amber-200">
                          <span className="text-sm">{fc.name}</span>
                          <span className="text-sm font-medium text-amber-700">{fc.weightPercentage}%</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 pt-2 border-t border-amber-200">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-amber-700">Subtotal Componentes:</span>
                        <span className="text-sm font-bold text-amber-700">
                          {finalComponents.reduce((sum, fc) => sum + fc.weightPercentage, 0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-slate-200 rounded p-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Peso Total:</span>
                    <span className={`text-lg font-bold ${
                      (terms.reduce((sum, t) => sum + t.weightPercentage, 0) + 
                      (useFinalComponents ? finalComponents.reduce((sum, fc) => sum + fc.weightPercentage, 0) : 0)) === 100 
                      ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {terms.reduce((sum, t) => sum + t.weightPercentage, 0) + 
                       (useFinalComponents ? finalComponents.reduce((sum, fc) => sum + fc.weightPercentage, 0) : 0)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {validationErrors.general && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-700 text-sm">{validationErrors.general[0]}</p>
              </div>
            )}
          </div>
        )

      case 3: // Acciones
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Acciones del Año Lectivo</h3>
            
            {createdYear ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h4 className="font-medium text-green-800 mb-2">✅ Año Lectivo Creado</h4>
                <p className="text-green-700 mb-4">El año lectivo ha sido creado exitosamente con sus períodos académicos.</p>
                
                <div className="space-y-4">
                  <div>
                    <h5 className="font-medium text-slate-700 mb-2">Próximos pasos:</h5>
                    <div className="space-y-2">
                      <button
                        onClick={activateYear}
                        disabled={isActivating}
                        className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <Play className="w-4 h-4" />
                        {isActivating ? 'Activando...' : 'Activar Año Lectivo'}
                      </button>
                      
                      <button
                        onClick={() => setCurrentStep(1)}
                        className="w-full px-4 py-3 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                      >
                        Configurar Períodos
                      </button>
                    </div>
                  </div>

                  {validationErrors.activation && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-red-700 text-sm">{validationErrors.activation[0]}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : currentYear ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h4 className="font-medium text-blue-800 mb-2">📅 Año Lectivo Actual</h4>
                <p className="text-blue-700 mb-4">Ya tienes un año lectivo activo.</p>
                
                <div className="space-y-4">
                  <div className="p-4 bg-white rounded-lg border">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium">{currentYear.name}</span>
                        <span className="ml-2 text-sm text-slate-500">({currentYear.year})</span>
                      </div>
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
                        Activo
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={closeYear}
                    disabled={isClosing}
                    className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Square className="w-4 h-4" />
                    {isClosing ? 'Cerrando...' : 'Cerrar Año Lectivo'}
                  </button>

                  {validationErrors.closure && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-red-700 text-sm">{validationErrors.closure[0]}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
                <p className="text-slate-600">Completa los pasos anteriores para crear un nuevo año lectivo.</p>
              </div>
            )}

            {successMessage && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-green-700 text-sm">{successMessage}</p>
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Wizard de Año Lectivo</h1>
          <p className="text-slate-600">Configura y gestiona el ciclo de vida del año lectivo</p>
        </div>

        {/* Panel de Estado Actual */}
        {currentYear && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                <div>
                  <p className="font-medium text-green-800">Año Activo: {currentYear.name}</p>
                  <p className="text-sm text-green-600">Los cambios de configuración se aplicarán a este año</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/institution')}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Ir a Configuración
              </button>
            </div>
          </div>
        )}

        {existingYears.length > 0 && !currentYear && existingYears.some(y => y.status === 'DRAFT') && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800">Tienes un año en borrador pendiente de activar</p>
                <p className="text-sm text-amber-600">Completa la configuración y activa el año para comenzar a usarlo</p>
              </div>
            </div>
          </div>
        )}

        {existingYears.length === 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-800">¡Bienvenido! Configura tu primer año lectivo</p>
                <p className="text-sm text-blue-600">Sigue los pasos del wizard para crear y activar el año académico</p>
              </div>
            </div>
          </div>
        )}

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon
              const isActive = index === currentStep
              const isCompleted = index < currentStep
              
              return (
                <div key={step.id} className="flex items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                    isActive ? 'border-teal-500 bg-teal-500 text-white' :
                    isCompleted ? 'border-green-500 bg-green-500 text-white' :
                    'border-slate-300 bg-white text-slate-400'
                  }`}>
                    {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <div className="ml-3 hidden sm:block">
                    <p className={`text-sm font-medium ${isActive ? 'text-teal-600' : isCompleted ? 'text-green-600' : 'text-slate-400'}`}>
                      {step.title}
                    </p>
                    <p className="text-xs text-slate-500">{step.description}</p>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`w-full sm:w-24 h-0.5 mx-4 ${
                      index < currentStep ? 'bg-green-500' : 'bg-slate-300'
                    }`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
          {renderStepContent()}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            onClick={prevStep}
            disabled={currentStep === 0}
            className="px-6 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Anterior
          </button>

          <div className="flex gap-3">
            {currentStep === 2 ? (
              <button
                onClick={createYear}
                disabled={isCreating}
                className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isCreating ? 'Creando...' : 'Crear Año Lectivo'}
              </button>
            ) : currentStep < 3 ? (
              <button
                onClick={nextStep}
                className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2"
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AcademicYearWizard
