import { useState, useCallback, useEffect, useMemo } from 'react'
import { BookOpen, ChevronDown, Save, Plus, Trash2, X, Settings, AlertTriangle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useInstitution } from '../contexts/InstitutionContext'
import { teacherAssignmentsApi } from '../lib/api'

interface TeacherAssignment {
  id: string
  subject: { id: string; name: string; area?: { name: string } }
  group: { id: string; name: string; grade?: { name: string } }
  academicYear: { id: string; year: number }
}

const activityTypes = [
  'Examen escrito',
  'Examen oral',
  'Taller',
  'Quiz',
  'Proyecto',
  'Actividad práctica',
  'Trabajo en clase',
  'Participación',
]

const getPerformanceLevel = (grade: number) => {
  if (grade >= 4.5) return { label: 'Superior', color: 'text-green-600 bg-green-100' }
  if (grade >= 4.0) return { label: 'Alto', color: 'text-blue-600 bg-blue-100' }
  if (grade >= 3.0) return { label: 'Básico', color: 'text-amber-600 bg-amber-100' }
  return { label: 'Bajo', color: 'text-red-600 bg-red-100' }
}

interface Activity {
  id: string
  name: string
  type: string
}

interface AttitudinalConfig {
  personal: number
  social: number
  autoevaluacion: number
  coevaluacion: number
}

export default function Grades() {
  const { user } = useAuth()
  const { gradingConfig, setGradingConfig, periods, selectedPeriod, setSelectedPeriod } = useInstitution()
  
  const userRoles = useMemo(() => {
    if (!user?.roles) return []
    return user.roles.map((r: any) => typeof r === 'string' ? r : r.role?.name || r.name).filter(Boolean)
  }, [user?.roles])
  
  const isAdmin = userRoles.includes('ADMIN_INSTITUTIONAL') || userRoles.includes('SUPERADMIN') || userRoles.includes('COORDINADOR')
  const isTeacher = userRoles.includes('DOCENTE')
  
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAssignment, setSelectedAssignment] = useState<TeacherAssignment | null>(null)
  const [showAddActivity, setShowAddActivity] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [addToComponent, setAddToComponent] = useState<'COGNITIVO' | 'PROCEDIMENTAL' | null>(null)
  const [viewMode, setViewMode] = useState<'detailed' | 'summary'>('detailed')
  const [deleteConfirm, setDeleteConfirm] = useState<{ component: 'COGNITIVO' | 'PROCEDIMENTAL'; activityId: string; activityName: string } | null>(null)
  
  const componentWeights = {
    COGNITIVO: gradingConfig.cognitivo,
    PROCEDIMENTAL: gradingConfig.procedimental,
    ACTITUDINAL: gradingConfig.actitudinal,
  }

  const setComponentWeights = (weights: { COGNITIVO: number; PROCEDIMENTAL: number; ACTITUDINAL: number }) => {
    setGradingConfig({
      ...gradingConfig,
      cognitivo: weights.COGNITIVO,
      procedimental: weights.PROCEDIMENTAL,
      actitudinal: weights.ACTITUDINAL,
    })
  }
  
  const attitudinalConfig = gradingConfig.attitudinalBreakdown

  const setAttitudinalConfig = (config: AttitudinalConfig) => {
    setGradingConfig({
      ...gradingConfig,
      attitudinalBreakdown: config,
    })
  }

  // Cargar asignaciones del docente
  useEffect(() => {
    const fetchAssignments = async () => {
      setLoading(true)
      setError(null)
      try {
        const params: any = {}
        // Si es docente, filtrar por su ID
        if (isTeacher && user?.id) {
          params.teacherId = user.id
        }
        const response = await teacherAssignmentsApi.getAll(params)
        const data = response.data || []
        setAssignments(data)
        if (data.length > 0) {
          setSelectedAssignment(data[0])
        }
      } catch (err: any) {
        console.error('Error loading assignments:', err)
        setError('Error al cargar asignaciones')
      } finally {
        setLoading(false)
      }
    }
    fetchAssignments()
  }, [user?.id, isTeacher])

  // Mock students por ahora (se conectará a API después)
  const mockStudents = selectedAssignment ? [
    { id: '1', name: 'Juan Pérez' },
    { id: '2', name: 'María López' },
    { id: '3', name: 'Carlos Martínez' },
    { id: '4', name: 'Ana González' },
    { id: '5', name: 'Pedro Ramírez' },
  ] : []

  const [cognitivoActivities, setCognitivoActivities] = useState<Activity[]>([
    { id: 'cog1', name: 'Nota 1', type: 'Examen escrito' },
    { id: 'cog2', name: 'Nota 2', type: 'Taller' },
    { id: 'cog3', name: 'Nota 3', type: 'Quiz' },
  ])

  const [procedimentalActivities, setProcedimentalActivities] = useState<Activity[]>([
    { id: 'proc1', name: 'Nota 1', type: 'Actividad práctica' },
    { id: 'proc2', name: 'Nota 2', type: 'Proyecto' },
    { id: 'proc3', name: 'Nota 3', type: 'Trabajo en clase' },
  ])

  const [grades, setGrades] = useState<Record<string, Record<string, number>>>(() => {
    const initial: Record<string, Record<string, number>> = {}
    return initial
  })

  // Inicializar notas cuando cambian los estudiantes
  useEffect(() => {
    if (mockStudents.length > 0) {
      setGrades(prev => {
        const updated = { ...prev }
        mockStudents.forEach(student => {
          if (!updated[student.id]) {
            updated[student.id] = {
              cog1: 0, cog2: 0, cog3: 0,
              proc1: 0, proc2: 0, proc3: 0,
              personal: 0, social: 0, autoevaluacion: 0, coevaluacion: 0,
            }
          }
        })
        return updated
      })
    }
  }, [selectedAssignment])

  const [newActivity, setNewActivity] = useState({ name: '', type: activityTypes[0] })

  const addActivity = (component: 'COGNITIVO' | 'PROCEDIMENTAL') => {
    const activities = component === 'COGNITIVO' ? cognitivoActivities : procedimentalActivities
    const setActivities = component === 'COGNITIVO' ? setCognitivoActivities : setProcedimentalActivities
    const prefix = component === 'COGNITIVO' ? 'cog' : 'proc'
    
    const newId = `${prefix}${activities.length + 1}`
    const newAct: Activity = {
      id: newId,
      name: newActivity.name || `Nota ${activities.length + 1}`,
      type: newActivity.type,
    }
    
    setActivities([...activities, newAct])
    setGrades(prev => {
      const updated = { ...prev }
      Object.keys(updated).forEach(studentId => {
        updated[studentId] = { ...updated[studentId], [newId]: 0 }
      })
      return updated
    })
    
    setNewActivity({ name: '', type: activityTypes[0] })
    setShowAddActivity(false)
    setAddToComponent(null)
  }

  const removeActivity = (component: 'COGNITIVO' | 'PROCEDIMENTAL', activityId: string) => {
    const activities = component === 'COGNITIVO' ? cognitivoActivities : procedimentalActivities
    if (activities.length <= 1) return
    
    const setActivities = component === 'COGNITIVO' ? setCognitivoActivities : setProcedimentalActivities
    setActivities(activities.filter(a => a.id !== activityId))
    
    setGrades(prev => {
      const updated = { ...prev }
      Object.keys(updated).forEach(studentId => {
        const { [activityId]: _, ...rest } = updated[studentId]
        updated[studentId] = rest
      })
      return updated
    })
  }

  const updateGrade = (studentId: string, activityId: string, value: number) => {
    setGrades(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [activityId]: value }
    }))
  }

  const calculateAvg = (studentId: string, activityIds: string[]) => {
    const studentGrades = grades[studentId] || {}
    const values = activityIds.map(id => studentGrades[id]).filter(v => v > 0)
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
  }

  const calculateFinalGrade = (studentId: string) => {
    const cogAvg = calculateAvg(studentId, cognitivoActivities.map(a => a.id))
    const procAvg = calculateAvg(studentId, procedimentalActivities.map(a => a.id))
    
    const attAvg = (
      (grades[studentId]?.personal || 0) * (attitudinalConfig.personal / 20) +
      (grades[studentId]?.social || 0) * (attitudinalConfig.social / 20) +
      (grades[studentId]?.autoevaluacion || 0) * (attitudinalConfig.autoevaluacion / 20) +
      (grades[studentId]?.coevaluacion || 0) * (attitudinalConfig.coevaluacion / 20)
    )
    
    return (
      cogAvg * (componentWeights.COGNITIVO / 100) +
      procAvg * (componentWeights.PROCEDIMENTAL / 100) +
      attAvg * (componentWeights.ACTITUDINAL / 100)
    )
  }

  // Obtener todas las columnas de actividades en orden
  const allActivityColumns = [
    ...cognitivoActivities.map(a => a.id),
    ...procedimentalActivities.map(a => a.id),
    'personal', 'social', 'autoevaluacion', 'coevaluacion'
  ]

  // Navegación con teclado entre inputs de notas
  const handleKeyNavigation = useCallback((e: React.KeyboardEvent<HTMLInputElement>, studentId: string, activityId: string) => {
    const studentIndex = mockStudents.findIndex(s => s.id === studentId)
    const activityIndex = allActivityColumns.indexOf(activityId)
    
    let targetStudentId: string | null = null
    let targetActivityId: string | null = null

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (studentIndex < mockStudents.length - 1) {
          targetStudentId = mockStudents[studentIndex + 1].id
          targetActivityId = activityId
        }
        break
      case 'ArrowUp':
        e.preventDefault()
        if (studentIndex > 0) {
          targetStudentId = mockStudents[studentIndex - 1].id
          targetActivityId = activityId
        }
        break
      case 'ArrowRight':
        if (e.currentTarget.selectionStart === e.currentTarget.value.length) {
          e.preventDefault()
          if (activityIndex < allActivityColumns.length - 1) {
            targetStudentId = studentId
            targetActivityId = allActivityColumns[activityIndex + 1]
          }
        }
        break
      case 'ArrowLeft':
        if (e.currentTarget.selectionStart === 0) {
          e.preventDefault()
          if (activityIndex > 0) {
            targetStudentId = studentId
            targetActivityId = allActivityColumns[activityIndex - 1]
          }
        }
        break
      case 'Enter':
      case 'Tab':
        if (!e.shiftKey) {
          e.preventDefault()
          // Mover al siguiente estudiante en la misma actividad
          if (studentIndex < mockStudents.length - 1) {
            targetStudentId = mockStudents[studentIndex + 1].id
            targetActivityId = activityId
          } else if (activityIndex < allActivityColumns.length - 1) {
            // Si es el último estudiante, ir a la siguiente actividad del primer estudiante
            targetStudentId = mockStudents[0].id
            targetActivityId = allActivityColumns[activityIndex + 1]
          }
        }
        break
    }

    if (targetStudentId && targetActivityId) {
      const targetInput = document.getElementById(`grade-${targetStudentId}-${targetActivityId}`) as HTMLInputElement
      if (targetInput) {
        targetInput.focus()
        targetInput.select()
      }
    }
  }, [allActivityColumns])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Calificaciones</h1>
          <p className="text-slate-500 mt-1">Registro de notas por componente evaluativo</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button 
              onClick={() => setShowConfig(true)}
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Configurar
            </button>
          )}
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Save className="w-4 h-4" />
            Guardar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
            <p className="mt-4 text-red-600">{error}</p>
          </div>
        </div>
      ) : assignments.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="mt-4 text-slate-500">No tienes asignaturas asignadas</p>
            <p className="text-sm text-slate-400">Contacta al coordinador para asignar tu carga académica</p>
          </div>
        </div>
      ) : (
      <>
      <div className="flex gap-4 mb-6 flex-wrap">
        <div className="relative">
          <select
            value={selectedAssignment?.id || ''}
            onChange={(e) => setSelectedAssignment(assignments.find(a => a.id === e.target.value) || null)}
            className="appearance-none pl-4 pr-10 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            {assignments.map((assignment) => (
              <option key={assignment.id} value={assignment.id}>
                {assignment.subject.name} - {assignment.group.grade?.name} {assignment.group.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            {periods.map((period) => (
              <option key={period.id} value={period.id}>{period.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>

        <div className="flex bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('detailed')}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${viewMode === 'detailed' ? 'bg-white shadow-sm' : 'text-slate-600'}`}
          >
            Detallado
          </button>
          <button
            onClick={() => setViewMode('summary')}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${viewMode === 'summary' ? 'bg-white shadow-sm' : 'text-slate-600'}`}
          >
            Resumen
          </button>
        </div>

        <div className="ml-auto flex gap-2">
          <span className="px-3 py-1 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200">
            Cognitivo ({componentWeights.COGNITIVO}%)
          </span>
          <span className="px-3 py-1 rounded-lg text-sm font-medium bg-green-50 text-green-700 border border-green-200">
            Procedimental ({componentWeights.PROCEDIMENTAL}%)
          </span>
          <span className="px-3 py-1 rounded-lg text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200">
            Actitudinal ({componentWeights.ACTITUDINAL}%)
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="font-semibold text-slate-900">{selectedAssignment?.subject.name}</h2>
              <p className="text-sm text-slate-500">{selectedAssignment?.group.grade?.name} {selectedAssignment?.group.name} • {periods.find(p => p.id === selectedPeriod)?.name || 'Período'}</p>
            </div>
          </div>
        </div>

        {viewMode === 'detailed' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th rowSpan={2} className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase border-r border-slate-200 min-w-[140px] sticky left-0 bg-slate-100 z-10">
                    Estudiante
                  </th>
                  <th 
                    colSpan={cognitivoActivities.length + 2}
                    className="text-center px-2 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border-r border-slate-200"
                  >
                    COGNITIVO - {componentWeights.COGNITIVO}%
                  </th>
                  <th 
                    colSpan={procedimentalActivities.length + 2}
                    className="text-center px-2 py-2 text-xs font-semibold text-green-700 bg-green-50 border-r border-slate-200"
                  >
                    PROCEDIMENTAL - {componentWeights.PROCEDIMENTAL}%
                  </th>
                  <th 
                    colSpan={5}
                    className="text-center px-2 py-2 text-xs font-semibold text-amber-700 bg-amber-50 border-r border-slate-200"
                  >
                    ACTITUDINAL - {componentWeights.ACTITUDINAL}%
                  </th>
                  <th rowSpan={2} className="text-center px-3 py-2 text-xs font-medium text-slate-600 uppercase bg-slate-200 min-w-[60px]">
                    Final
                  </th>
                  <th rowSpan={2} className="text-center px-3 py-2 text-xs font-medium text-slate-500 uppercase min-w-[50px]">
                    Niv
                  </th>
                </tr>
                <tr className="bg-slate-50 text-[11px]">
                  {cognitivoActivities.map((activity) => (
                    <th key={activity.id} className="text-center px-1 py-1 min-w-[50px] border-b border-slate-200">
                      <div className="flex flex-col items-center">
                        <span className="text-slate-600 truncate max-w-[45px]" title={`${activity.name} (${activity.type})`}>
                          {activity.name}
                        </span>
                        {cognitivoActivities.length > 1 && (
                          <button 
                            onClick={() => setDeleteConfirm({ component: 'COGNITIVO', activityId: activity.id, activityName: activity.name })}
                            className="p-0.5 hover:bg-red-100 rounded text-slate-400 hover:text-red-500 mt-0.5"
                            title="Eliminar actividad"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="text-center px-1 py-1 min-w-[30px] border-b border-slate-200">
                    <button 
                      onClick={() => { setAddToComponent('COGNITIVO'); setShowAddActivity(true); }}
                      className="p-1 rounded hover:bg-blue-100 text-blue-600"
                      title="Agregar actividad"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-center px-1 py-1 text-[10px] font-medium uppercase bg-blue-100 text-blue-700 min-w-[40px] border-b border-slate-200">
                    Prom
                  </th>
                  
                  {procedimentalActivities.map((activity) => (
                    <th key={activity.id} className="text-center px-1 py-1 min-w-[50px] border-b border-slate-200">
                      <div className="flex flex-col items-center">
                        <span className="text-slate-600 truncate max-w-[45px]" title={`${activity.name} (${activity.type})`}>
                          {activity.name}
                        </span>
                        {procedimentalActivities.length > 1 && (
                          <button 
                            onClick={() => setDeleteConfirm({ component: 'PROCEDIMENTAL', activityId: activity.id, activityName: activity.name })}
                            className="p-0.5 hover:bg-red-100 rounded text-slate-400 hover:text-red-500 mt-0.5"
                            title="Eliminar actividad"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="text-center px-1 py-1 min-w-[30px] border-b border-slate-200">
                    <button 
                      onClick={() => { setAddToComponent('PROCEDIMENTAL'); setShowAddActivity(true); }}
                      className="p-1 rounded hover:bg-green-100 text-green-600"
                      title="Agregar actividad"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-center px-1 py-1 text-[10px] font-medium uppercase bg-green-100 text-green-700 min-w-[40px] border-b border-slate-200">
                    Prom
                  </th>
                  
                  <th className="text-center px-1 py-1 min-w-[45px] bg-amber-50 border-b border-slate-200">
                    <span className="text-amber-700">Personal</span>
                    <div className="text-[9px] text-amber-500">{attitudinalConfig.personal}%</div>
                  </th>
                  <th className="text-center px-1 py-1 min-w-[45px] bg-amber-50 border-b border-slate-200">
                    <span className="text-amber-700">Social</span>
                    <div className="text-[9px] text-amber-500">{attitudinalConfig.social}%</div>
                  </th>
                  <th className="text-center px-1 py-1 min-w-[45px] bg-amber-50 border-b border-slate-200">
                    <span className="text-amber-700">Autoev.</span>
                    <div className="text-[9px] text-amber-500">{attitudinalConfig.autoevaluacion}%</div>
                  </th>
                  <th className="text-center px-1 py-1 min-w-[45px] bg-amber-50 border-b border-slate-200">
                    <span className="text-amber-700">Coev.</span>
                    <div className="text-[9px] text-amber-500">{attitudinalConfig.coevaluacion}%</div>
                  </th>
                  <th className="text-center px-1 py-1 text-[10px] font-medium uppercase bg-amber-100 text-amber-700 min-w-[40px] border-b border-slate-200">
                    Prom
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mockStudents.map((student) => {
                  const cogAvg = calculateAvg(student.id, cognitivoActivities.map(a => a.id))
                  const procAvg = calculateAvg(student.id, procedimentalActivities.map(a => a.id))
                  const attAvg = (
                    (grades[student.id]?.personal || 0) * (attitudinalConfig.personal / 20) +
                    (grades[student.id]?.social || 0) * (attitudinalConfig.social / 20) +
                    (grades[student.id]?.autoevaluacion || 0) * (attitudinalConfig.autoevaluacion / 20) +
                    (grades[student.id]?.coevaluacion || 0) * (attitudinalConfig.coevaluacion / 20)
                  )
                  const finalGrade = calculateFinalGrade(student.id)
                  const performance = getPerformanceLevel(finalGrade)
                  
                  return (
                    <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2 font-medium text-slate-900 border-r border-slate-100 sticky left-0 bg-white z-10">
                        {student.name}
                      </td>
                      
                      {cognitivoActivities.map((activity) => (
                        <td key={activity.id} className="px-1 py-1 text-center">
                          <input
                            id={`grade-${student.id}-${activity.id}`}
                            type="number"
                            step="0.1"
                            min="1"
                            max="5"
                            value={grades[student.id]?.[activity.id] || ''}
                            onChange={(e) => updateGrade(student.id, activity.id, parseFloat(e.target.value) || 0)}
                            onKeyDown={(e) => handleKeyNavigation(e, student.id, activity.id)}
                            onFocus={(e) => e.target.select()}
                            className="w-11 px-1 py-1 text-center text-xs border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                        </td>
                      ))}
                      <td className="px-1 py-1"></td>
                      <td className="px-1 py-1 text-center font-semibold text-blue-700 bg-blue-50/50">
                        {cogAvg > 0 ? cogAvg.toFixed(1) : '-'}
                      </td>
                      
                      {procedimentalActivities.map((activity) => (
                        <td key={activity.id} className="px-1 py-1 text-center">
                          <input
                            id={`grade-${student.id}-${activity.id}`}
                            type="number"
                            step="0.1"
                            min="1"
                            max="5"
                            value={grades[student.id]?.[activity.id] || ''}
                            onChange={(e) => updateGrade(student.id, activity.id, parseFloat(e.target.value) || 0)}
                            onKeyDown={(e) => handleKeyNavigation(e, student.id, activity.id)}
                            onFocus={(e) => e.target.select()}
                            className="w-11 px-1 py-1 text-center text-xs border border-slate-200 rounded focus:ring-1 focus:ring-green-500 focus:border-green-500 outline-none"
                          />
                        </td>
                      ))}
                      <td className="px-1 py-1"></td>
                      <td className="px-1 py-1 text-center font-semibold text-green-700 bg-green-50/50">
                        {procAvg > 0 ? procAvg.toFixed(1) : '-'}
                      </td>
                      
                      <td className="px-1 py-1 text-center bg-amber-50/30">
                        <input
                          id={`grade-${student.id}-personal`}
                          type="number"
                          step="0.1"
                          min="1"
                          max="5"
                          value={grades[student.id]?.personal || ''}
                          onChange={(e) => updateGrade(student.id, 'personal', parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => handleKeyNavigation(e, student.id, 'personal')}
                          onFocus={(e) => e.target.select()}
                          className="w-11 px-1 py-1 text-center text-xs border border-amber-200 rounded focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none"
                        />
                      </td>
                      <td className="px-1 py-1 text-center bg-amber-50/30">
                        <input
                          id={`grade-${student.id}-social`}
                          type="number"
                          step="0.1"
                          min="1"
                          max="5"
                          value={grades[student.id]?.social || ''}
                          onChange={(e) => updateGrade(student.id, 'social', parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => handleKeyNavigation(e, student.id, 'social')}
                          onFocus={(e) => e.target.select()}
                          className="w-11 px-1 py-1 text-center text-xs border border-amber-200 rounded focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none"
                        />
                      </td>
                      <td className="px-1 py-1 text-center bg-amber-50/30">
                        <input
                          id={`grade-${student.id}-autoevaluacion`}
                          type="number"
                          step="0.1"
                          min="1"
                          max="5"
                          value={grades[student.id]?.autoevaluacion || ''}
                          onChange={(e) => updateGrade(student.id, 'autoevaluacion', parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => handleKeyNavigation(e, student.id, 'autoevaluacion')}
                          onFocus={(e) => e.target.select()}
                          className="w-11 px-1 py-1 text-center text-xs border border-amber-200 rounded focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none"
                        />
                      </td>
                      <td className="px-1 py-1 text-center bg-amber-50/30">
                        <input
                          id={`grade-${student.id}-coevaluacion`}
                          type="number"
                          step="0.1"
                          min="1"
                          max="5"
                          value={grades[student.id]?.coevaluacion || ''}
                          onChange={(e) => updateGrade(student.id, 'coevaluacion', parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => handleKeyNavigation(e, student.id, 'coevaluacion')}
                          onFocus={(e) => e.target.select()}
                          className="w-11 px-1 py-1 text-center text-xs border border-amber-200 rounded focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none"
                        />
                      </td>
                      <td className="px-1 py-1 text-center font-semibold text-amber-700 bg-amber-50/50">
                        {attAvg > 0 ? attAvg.toFixed(1) : '-'}
                      </td>
                      
                      <td className="px-2 py-1 text-center font-bold text-slate-900 bg-slate-100">
                        {finalGrade > 0 ? finalGrade.toFixed(1) : '-'}
                      </td>
                      <td className="px-2 py-1 text-center">
                        {finalGrade > 0 && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${performance.color}`}>
                            {performance.label}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Estudiante</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-blue-600 uppercase bg-blue-50">Cognitivo ({componentWeights.COGNITIVO}%)</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-green-600 uppercase bg-green-50">Procedimental ({componentWeights.PROCEDIMENTAL}%)</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-amber-600 uppercase bg-amber-50">Actitudinal ({componentWeights.ACTITUDINAL}%)</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-slate-600 uppercase bg-slate-100">Promedio Final</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Desempeño</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mockStudents.map((student) => {
                  const cogAvg = calculateAvg(student.id, cognitivoActivities.map(a => a.id))
                  const procAvg = calculateAvg(student.id, procedimentalActivities.map(a => a.id))
                  const attAvg = (
                    (grades[student.id]?.personal || 0) * (attitudinalConfig.personal / 20) +
                    (grades[student.id]?.social || 0) * (attitudinalConfig.social / 20) +
                    (grades[student.id]?.autoevaluacion || 0) * (attitudinalConfig.autoevaluacion / 20) +
                    (grades[student.id]?.coevaluacion || 0) * (attitudinalConfig.coevaluacion / 20)
                  )
                  const finalGrade = calculateFinalGrade(student.id)
                  const performance = getPerformanceLevel(finalGrade)
                  
                  return (
                    <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">{student.name}</td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-lg font-semibold text-blue-700">{cogAvg > 0 ? cogAvg.toFixed(1) : '-'}</span>
                        <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${getPerformanceLevel(cogAvg).color}`}>
                          {getPerformanceLevel(cogAvg).label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-lg font-semibold text-green-700">{procAvg > 0 ? procAvg.toFixed(1) : '-'}</span>
                        <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${getPerformanceLevel(procAvg).color}`}>
                          {getPerformanceLevel(procAvg).label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-lg font-semibold text-amber-700">{attAvg > 0 ? attAvg.toFixed(1) : '-'}</span>
                        <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${getPerformanceLevel(attAvg).color}`}>
                          {getPerformanceLevel(attAvg).label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center bg-slate-50">
                        <span className="text-xl font-bold text-slate-900">{finalGrade > 0 ? finalGrade.toFixed(1) : '-'}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${performance.color}`}>
                          {performance.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Nueva Actividad */}
      {showAddActivity && addToComponent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                Nueva Actividad - {addToComponent === 'COGNITIVO' ? 'Cognitivo' : 'Procedimental'}
              </h3>
              <button onClick={() => { setShowAddActivity(false); setAddToComponent(null); }} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre (opcional)</label>
                <input 
                  type="text" 
                  placeholder={`Nota ${(addToComponent === 'COGNITIVO' ? cognitivoActivities : procedimentalActivities).length + 1}`}
                  value={newActivity.name}
                  onChange={(e) => setNewActivity({ ...newActivity, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de actividad</label>
                <select 
                  value={newActivity.type}
                  onChange={(e) => setNewActivity({ ...newActivity, type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  {activityTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => { setShowAddActivity(false); setAddToComponent(null); }} 
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => addActivity(addToComponent)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Configuración (Solo Admin) */}
      {showConfig && isAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Configuración de Componentes</h3>
              <button onClick={() => setShowConfig(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <div className="space-y-6">
              <div>
                <h4 className="font-medium text-slate-800 mb-3">Pesos de Componentes</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <label className="flex-1 text-blue-700 font-medium">Cognitivo</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={componentWeights.COGNITIVO}
                        onChange={(e) => setComponentWeights({ ...componentWeights, COGNITIVO: parseInt(e.target.value) || 0 })}
                        className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-center"
                      />
                      <span className="text-slate-500">%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex-1 text-green-700 font-medium">Procedimental</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={componentWeights.PROCEDIMENTAL}
                        onChange={(e) => setComponentWeights({ ...componentWeights, PROCEDIMENTAL: parseInt(e.target.value) || 0 })}
                        className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-center"
                      />
                      <span className="text-slate-500">%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex-1 text-amber-700 font-medium">Actitudinal</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={componentWeights.ACTITUDINAL}
                        onChange={(e) => setComponentWeights({ ...componentWeights, ACTITUDINAL: parseInt(e.target.value) || 0 })}
                        className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-center"
                      />
                      <span className="text-slate-500">%</span>
                    </div>
                  </div>
                </div>
                <div className="mt-2 p-2 bg-slate-50 rounded text-sm">
                  Total: <span className={`font-semibold ${componentWeights.COGNITIVO + componentWeights.PROCEDIMENTAL + componentWeights.ACTITUDINAL === 100 ? 'text-green-600' : 'text-red-600'}`}>
                    {componentWeights.COGNITIVO + componentWeights.PROCEDIMENTAL + componentWeights.ACTITUDINAL}%
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-slate-800 mb-3">Distribución Actitudinal (debe sumar {componentWeights.ACTITUDINAL}%)</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <label className="flex-1 text-sm text-slate-600">Personal</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={attitudinalConfig.personal}
                      onChange={(e) => setAttitudinalConfig({ ...attitudinalConfig, personal: parseInt(e.target.value) || 0 })}
                      className="w-16 px-2 py-1 border border-slate-300 rounded text-center text-sm"
                    />
                    <span className="text-slate-400 text-sm">%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex-1 text-sm text-slate-600">Social</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={attitudinalConfig.social}
                      onChange={(e) => setAttitudinalConfig({ ...attitudinalConfig, social: parseInt(e.target.value) || 0 })}
                      className="w-16 px-2 py-1 border border-slate-300 rounded text-center text-sm"
                    />
                    <span className="text-slate-400 text-sm">%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex-1 text-sm text-slate-600">Autoevaluación</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={attitudinalConfig.autoevaluacion}
                      onChange={(e) => setAttitudinalConfig({ ...attitudinalConfig, autoevaluacion: parseInt(e.target.value) || 0 })}
                      className="w-16 px-2 py-1 border border-slate-300 rounded text-center text-sm"
                    />
                    <span className="text-slate-400 text-sm">%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex-1 text-sm text-slate-600">Coevaluación</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={attitudinalConfig.coevaluacion}
                      onChange={(e) => setAttitudinalConfig({ ...attitudinalConfig, coevaluacion: parseInt(e.target.value) || 0 })}
                      className="w-16 px-2 py-1 border border-slate-300 rounded text-center text-sm"
                    />
                    <span className="text-slate-400 text-sm">%</span>
                  </div>
                </div>
                <div className="mt-2 p-2 bg-slate-50 rounded text-sm">
                  Total Actitudinal: <span className={`font-semibold ${
                    attitudinalConfig.personal + attitudinalConfig.social + attitudinalConfig.autoevaluacion + attitudinalConfig.coevaluacion === componentWeights.ACTITUDINAL 
                      ? 'text-green-600' 
                      : 'text-red-600'
                  }`}>
                    {attitudinalConfig.personal + attitudinalConfig.social + attitudinalConfig.autoevaluacion + attitudinalConfig.coevaluacion}%
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowConfig(false)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button 
                onClick={() => setShowConfig(false)}
                disabled={
                  componentWeights.COGNITIVO + componentWeights.PROCEDIMENTAL + componentWeights.ACTITUDINAL !== 100 ||
                  attitudinalConfig.personal + attitudinalConfig.social + attitudinalConfig.autoevaluacion + attitudinalConfig.coevaluacion !== componentWeights.ACTITUDINAL
                }
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmación Eliminar Actividad */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 text-center mb-2">
              ¿Eliminar actividad?
            </h3>
            <p className="text-sm text-slate-500 text-center mb-4">
              Estás a punto de eliminar <strong>"{deleteConfirm.activityName}"</strong> del componente {deleteConfirm.component === 'COGNITIVO' ? 'Cognitivo' : 'Procedimental'}. 
              <span className="text-red-600 font-medium"> Las notas registradas en esta actividad se perderán.</span>
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteConfirm(null)} 
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  removeActivity(deleteConfirm.component, deleteConfirm.activityId)
                  setDeleteConfirm(null)
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  )
}
