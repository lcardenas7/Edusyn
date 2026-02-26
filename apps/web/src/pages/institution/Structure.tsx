import { useState, useEffect, useCallback } from 'react'
import { 
  GraduationCap,
  Plus,
  Edit2,
  Trash2,
  ChevronRight,
  ChevronDown,
  UsersRound,
  Eye,
  ArrowLeft,
  X,
  Building2,
  Layers,
  Loader2
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useAcademic } from '../../contexts/AcademicContext'
import { usePermissions, PERMISSIONS } from '../../hooks/usePermissions'
import { academicGradesApi, groupsApi, teachersApi, shiftsApi, campusesApi } from '../../lib/api'

// Nivel educativo para visualización (derivado de AcademicLevel)
interface EducationLevel {
  id: string
  name: string
  code: string
  color: string
  order: number
}

interface Group {
  id: string
  name: string
  shift: 'MAÑANA' | 'TARDE' | 'NOCHE' | 'ÚNICA'
  shiftId?: string
  shiftName?: string
  capacity: number
  director?: string
  directorId?: string
  directorName?: string
}

interface Grade {
  id: string
  name: string
  levelId: string  // Referencia al nivel educativo
  order: number
  groups: Group[]
}

// Helper: asignar color por índice
function getLevelColor(index: number): string {
  return LEVEL_COLORS[index % LEVEL_COLORS.length]
}

// Colores disponibles para niveles
const LEVEL_COLORS = [
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-green-100 text-green-700 border-green-200',
  'bg-purple-100 text-purple-700 border-purple-200',
  'bg-pink-100 text-pink-700 border-pink-200',
  'bg-cyan-100 text-cyan-700 border-cyan-200',
  'bg-orange-100 text-orange-700 border-orange-200',
  'bg-rose-100 text-rose-700 border-rose-200',
  'bg-teal-100 text-teal-700 border-teal-200',
  'bg-indigo-100 text-indigo-700 border-indigo-200',
]

export default function Structure() {
  const { institution: authInstitution } = useAuth()
  const { academicLevels, setAcademicLevels, saveAcademicLevelsToAPI, loadAcademicConfigFromAPI } = useAcademic()
  const { can } = usePermissions()
  
  const canEditGrades = can(PERMISSIONS.CONFIG_GRADES_EDIT)

  // Forzar recarga de niveles desde API al montar para evitar datos stale del localStorage
  useEffect(() => {
    loadAcademicConfigFromAPI()
  }, [loadAcademicConfigFromAPI])
  
  // Derivar niveles educativos desde AcademicContext (persistido en BD)
  const levels: EducationLevel[] = academicLevels.map((al, idx) => ({
    id: al.id,
    name: al.name,
    code: al.code,
    color: getLevelColor(idx),
    order: al.order,
  }))
  
  // Mapeo de GradeStage (BD) a códigos de nivel académico
  const stageToLevelCode: Record<string, string[]> = {
    'PREESCOLAR': ['PREESCOLAR'],
    'BASICA_PRIMARIA': ['PRIMARIA', 'BASICA_PRIMARIA'],
    'BASICA_SECUNDARIA': ['SECUNDARIA', 'BASICA_SECUNDARIA'],
    'MEDIA': ['MEDIA'],
  }

  // Buscar el levelId del contexto académico que corresponde a un GradeStage
  const findLevelIdForStage = useCallback((stage: string): string => {
    const possibleCodes = stageToLevelCode[stage] || []
    for (const code of possibleCodes) {
      const level = academicLevels.find(al => 
        al.code.toUpperCase() === code.toUpperCase() || 
        al.name.toUpperCase().includes(code.toUpperCase())
      )
      if (level) return level.id
    }
    // Fallback: buscar por coincidencia parcial en el nombre
    const level = academicLevels.find(al => 
      al.code.toUpperCase().includes(stage.toUpperCase().replace('BASICA_', '')) ||
      al.name.toUpperCase().includes(stage.toUpperCase().replace('BASICA_', '').replace('_', ' '))
    )
    return level?.id || ''
  }, [academicLevels])

  // Estados para grados y grupos (cargados desde API)
  const [grades, setGrades] = useState<Grade[]>([])
  const [loadingGrades, setLoadingGrades] = useState(true)
  
  const [expandedGrades, setExpandedGrades] = useState<string[]>([])
  const [expandedLevels, setExpandedLevels] = useState<string[]>([])
  
  // Auto-expandir niveles cuando se cargan
  useEffect(() => {
    if (levels.length > 0 && expandedLevels.length === 0) {
      setExpandedLevels(levels.map(l => l.id))
    }
  }, [levels.length])
  
  // Modal states para niveles
  const [showLevelModal, setShowLevelModal] = useState(false)
  const [editingLevel, setEditingLevel] = useState<EducationLevel | null>(null)
  const [levelForm, setLevelForm] = useState({ name: '', code: '', color: LEVEL_COLORS[0], order: 0 })
  
  // Modal states para grados
  const [showGradeModal, setShowGradeModal] = useState(false)
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null)
  const [gradeForm, setGradeForm] = useState({ name: '', levelId: '', order: 0 })
  
  // Modal states para grupos
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<{ gradeId: string; group: Group | null } | null>(null)
  const [groupForm, setGroupForm] = useState({ name: '', shiftId: '', capacity: 35, directorId: '' })
  const [teachers, setTeachers] = useState<any[]>([])
  const [savingGroup, setSavingGroup] = useState(false)

  // Jornadas (Shifts)
  const [shifts, setShifts] = useState<any[]>([])
  const [loadingShifts, setLoadingShifts] = useState(false)
  const [showShiftModal, setShowShiftModal] = useState(false)
  const [editingShift, setEditingShift] = useState<any>(null)
  const [shiftForm, setShiftForm] = useState({ name: '', type: 'MORNING' })
  const [savingShift, setSavingShift] = useState(false)
  const [campusId, setCampusId] = useState<string>('')

  // Cargar campus y jornadas
  useEffect(() => {
    const loadCampusAndShifts = async () => {
      if (!authInstitution?.id) return
      try {
        // Cargar campus principal
        const campusRes = await campusesApi.getAll(authInstitution.id)
        const campuses = campusRes.data || []
        if (campuses.length > 0) {
          setCampusId(campuses[0].id)
          // Cargar jornadas del campus
          setLoadingShifts(true)
          const shiftsRes = await shiftsApi.getAll(campuses[0].id)
          setShifts(shiftsRes.data || [])
        }
      } catch (err) {
        console.error('[Structure] Error loading shifts:', err)
      } finally {
        setLoadingShifts(false)
      }
    }
    loadCampusAndShifts()
  }, [authInstitution?.id])

  const loadShifts = async () => {
    if (!campusId) return
    try {
      setLoadingShifts(true)
      const res = await shiftsApi.getAll(campusId)
      setShifts(res.data || [])
    } catch (err) {
      console.error('[Structure] Error loading shifts:', err)
    } finally {
      setLoadingShifts(false)
    }
  }

  const openShiftModal = (shift?: any) => {
    if (shift) {
      setEditingShift(shift)
      setShiftForm({ name: shift.name, type: shift.type })
    } else {
      setEditingShift(null)
      setShiftForm({ name: '', type: 'MORNING' })
    }
    setShowShiftModal(true)
  }

  const saveShift = async () => {
    if (!shiftForm.name.trim() || !campusId) return
    setSavingShift(true)
    try {
      if (editingShift) {
        await shiftsApi.update(editingShift.id, { name: shiftForm.name, type: shiftForm.type })
      } else {
        await shiftsApi.create({ campusId, name: shiftForm.name, type: shiftForm.type })
      }
      await loadShifts()
      setShowShiftModal(false)
    } catch (err: any) {
      console.error('[Structure] Error saving shift:', err)
      alert(err.response?.data?.message || 'Error al guardar la jornada')
    } finally {
      setSavingShift(false)
    }
  }

  const deleteShift = async (id: string) => {
    if (!confirm('¿Eliminar esta jornada?')) return
    try {
      await shiftsApi.delete(id)
      await loadShifts()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al eliminar la jornada')
    }
  }

  const SHIFT_TYPES = [
    { value: 'MORNING', label: 'Mañana' },
    { value: 'AFTERNOON', label: 'Tarde' },
    { value: 'NIGHT', label: 'Noche' },
    { value: 'SINGLE', label: 'Jornada Única' },
  ]

  // Cargar docentes
  useEffect(() => {
    const loadTeachers = async () => {
      try {
        const res = await teachersApi.getAll({ isActive: true })
        setTeachers(res.data || [])
      } catch (err) {
        console.error('[Structure] Error loading teachers:', err)
      }
    }
    if (authInstitution?.id) loadTeachers()
  }, [authInstitution?.id])

  // Cargar grados y grupos desde la API (base de datos real)
  const loadGradesFromAPI = useCallback(async () => {
    try {
      setLoadingGrades(true)
      const res = await academicGradesApi.getAll(authInstitution?.id)
      const dbGrades: any[] = res.data || []
      
      // Mapear datos de BD al formato local
      // Solo mostrar grados que tienen grupos en esta institución
      // (Grade es global, Group es por institución via Campus)
      const mappedGrades: Grade[] = dbGrades
        .filter((g: any) => g.groups && g.groups.length > 0)
        .map((g: any) => ({
          id: g.id,
          name: g.name,
          levelId: findLevelIdForStage(g.stage),
          order: g.number || 0,
          groups: (g.groups || []).map((gr: any) => ({
            id: gr.id,
            name: gr.name,
            shiftId: gr.shiftId || gr.shift?.id,
            shiftName: gr.shift?.name,
            shift: gr.shift?.type === 'MORNING' ? 'MAÑANA' 
                 : gr.shift?.type === 'AFTERNOON' ? 'TARDE'
                 : gr.shift?.type === 'NIGHT' ? 'NOCHE'
                 : 'ÚNICA',
            capacity: gr.maxCapacity || 35,
            directorId: gr.director?.id || undefined,
            directorName: gr.director ? `${gr.director.firstName} ${gr.director.lastName}` : undefined,
          })),
        }))

      setGrades(mappedGrades)
      console.log(`[Structure] Cargados ${mappedGrades.length} grados con grupos desde API`)  
    } catch (err) {
      console.error('[Structure] Error cargando grados desde API:', err)
    } finally {
      setLoadingGrades(false)
    }
  }, [authInstitution?.id, findLevelIdForStage])

  useEffect(() => {
    if (authInstitution?.id && academicLevels.length > 0) {
      loadGradesFromAPI()
    }
  }, [authInstitution?.id, academicLevels.length, loadGradesFromAPI])

  // === FUNCIONES PARA NIVELES ===
  const toggleLevelExpand = (levelId: string) => {
    setExpandedLevels(prev => 
      prev.includes(levelId) ? prev.filter(id => id !== levelId) : [...prev, levelId]
    )
  }

  const openLevelModal = (level?: EducationLevel) => {
    if (level) {
      setEditingLevel(level)
      setLevelForm({ name: level.name, code: level.code, color: level.color, order: level.order })
    } else {
      setEditingLevel(null)
      const nextOrder = levels.length > 0 ? Math.max(...levels.map(l => l.order)) + 1 : 0
      const nextColor = LEVEL_COLORS[levels.length % LEVEL_COLORS.length]
      setLevelForm({ name: '', code: '', color: nextColor, order: nextOrder })
    }
    setShowLevelModal(true)
  }

  const saveLevel = async () => {
    if (!levelForm.name.trim()) return
    
    const code = levelForm.code.trim() || levelForm.name.toUpperCase().replace(/\s+/g, '_')
    
    if (editingLevel) {
      const updated = academicLevels.map(l => 
        l.id === editingLevel.id 
          ? { ...l, name: levelForm.name, code }
          : l
      )
      setAcademicLevels(updated)
    } else {
      const newLevel = {
        id: `level-${Date.now()}`,
        name: levelForm.name,
        code,
        order: levelForm.order,
        gradingScaleType: 'NUMERIC_1_5' as const,
        minGrade: 1.0,
        maxGrade: 5.0,
        minPassingGrade: 3.0,
        grades: [],
        performanceLevels: [
          { id: `perf-${Date.now()}-1`, name: 'Superior', code: 'SUPERIOR', minScore: 4.5, maxScore: 5.0, order: 0, color: '#22c55e', isApproved: true },
          { id: `perf-${Date.now()}-2`, name: 'Alto', code: 'ALTO', minScore: 4.0, maxScore: 4.4, order: 1, color: '#3b82f6', isApproved: true },
          { id: `perf-${Date.now()}-3`, name: 'Básico', code: 'BASICO', minScore: 3.0, maxScore: 3.9, order: 2, color: '#f59e0b', isApproved: true },
          { id: `perf-${Date.now()}-4`, name: 'Bajo', code: 'BAJO', minScore: 1.0, maxScore: 2.9, order: 3, color: '#ef4444', isApproved: false },
        ],
      }
      setAcademicLevels([...academicLevels, newLevel])
      setExpandedLevels([...expandedLevels, newLevel.id])
    }
    setShowLevelModal(false)
    // Persistir a BD
    await saveAcademicLevelsToAPI()
  }

  const deleteLevel = async (id: string) => {
    const gradesInLevel = grades.filter(g => g.levelId === id)
    if (gradesInLevel.length > 0) {
      alert(`No se puede eliminar este nivel porque tiene ${gradesInLevel.length} grado(s) asignados. Elimina o mueve los grados primero.`)
      return
    }
    setAcademicLevels(academicLevels.filter(l => l.id !== id))
    await saveAcademicLevelsToAPI()
  }

  const toggleGradeExpand = (gradeId: string) => {
    setExpandedGrades(prev => 
      prev.includes(gradeId) ? prev.filter(id => id !== gradeId) : [...prev, gradeId]
    )
  }

  const openGradeModal = (grade?: Grade, defaultLevelId?: string) => {
    if (grade) {
      setEditingGrade(grade)
      setGradeForm({ name: grade.name, levelId: grade.levelId, order: grade.order })
    } else {
      setEditingGrade(null)
      const levelId = defaultLevelId || (levels.length > 0 ? levels[0].id : '')
      setGradeForm({ name: '', levelId, order: grades.length })
    }
    setShowGradeModal(true)
  }

  const saveGrade = () => {
    if (!gradeForm.name.trim() || !gradeForm.levelId) return
    
    if (editingGrade) {
      setGrades(grades.map(g => 
        g.id === editingGrade.id 
          ? { ...g, name: gradeForm.name, levelId: gradeForm.levelId, order: gradeForm.order }
          : g
      ))
    } else {
      const newGrade: Grade = {
        id: `grade-${Date.now()}`,
        name: gradeForm.name,
        levelId: gradeForm.levelId,
        order: gradeForm.order,
        groups: []
      }
      setGrades([...grades, newGrade])
    }
    setShowGradeModal(false)
  }

  const deleteGrade = (id: string) => {
    setGrades(grades.filter(g => g.id !== id))
  }

  const openGroupModal = (gradeId: string, group?: Group) => {
    if (group) {
      setEditingGroup({ gradeId, group })
      setGroupForm({ name: group.name, shiftId: group.shiftId || '', capacity: group.capacity, directorId: group.directorId || '' })
    } else {
      setEditingGroup({ gradeId, group: null })
      // Default to first shift if available
      setGroupForm({ name: '', shiftId: shifts[0]?.id || '', capacity: 35, directorId: '' })
    }
    setShowGroupModal(true)
  }

  const saveGroup = async () => {
    if (!editingGroup || !groupForm.name.trim()) return
    
    const { gradeId, group } = editingGroup
    
    if (group) {
      // Grupo existente: actualizar en BD
      setSavingGroup(true)
      try {
        await groupsApi.update(group.id, {
          name: groupForm.name,
          maxCapacity: groupForm.capacity,
          directorId: groupForm.directorId || null,
          shiftId: groupForm.shiftId || undefined,
        })
        // Encontrar nombre del director y jornada seleccionados
        const selTeacher = teachers.find(t => t.id === groupForm.directorId)
        const directorName = selTeacher ? `${selTeacher.firstName} ${selTeacher.lastName}` : undefined
        const selShift = shifts.find(s => s.id === groupForm.shiftId)
        const shiftLabel = selShift?.type === 'MORNING' ? 'MAÑANA' : selShift?.type === 'AFTERNOON' ? 'TARDE' : selShift?.type === 'NIGHT' ? 'NOCHE' : 'ÚNICA'
        setGrades(grades.map(g => 
          g.id === gradeId 
            ? { ...g, groups: g.groups.map(gr => gr.id === group.id ? { ...gr, name: groupForm.name, capacity: groupForm.capacity, shiftId: groupForm.shiftId, shift: shiftLabel as any, shiftName: selShift?.name, directorId: groupForm.directorId || undefined, directorName } : gr) }
            : g
        ))
        // Reload to get fresh data
        await loadGradesFromAPI()
      } catch (err) {
        console.error('[Structure] Error updating group:', err)
        alert('Error al actualizar el grupo')
      } finally {
        setSavingGroup(false)
      }
    } else {
      // Crear grupo nuevo - llamar a la API
      if (!groupForm.shiftId || !campusId) {
        alert('Selecciona una jornada')
        return
      }
      setSavingGroup(true)
      try {
        await groupsApi.create({
          campusId,
          shiftId: groupForm.shiftId,
          gradeId,
          name: groupForm.name,
        })
        await loadGradesFromAPI()
      } catch (err: any) {
        console.error('[Structure] Error creating group:', err)
        alert(err.response?.data?.message || 'Error al crear el grupo')
      } finally {
        setSavingGroup(false)
      }
    }
    setShowGroupModal(false)
  }

  const deleteGroup = (gradeId: string, groupId: string) => {
    setGrades(grades.map(g => 
      g.id === gradeId ? { ...g, groups: g.groups.filter(gr => gr.id !== groupId) } : g
    ))
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link 
            to="/institution" 
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Estructura Organizacional</h1>
              <p className="text-sm text-slate-500">Grados y grupos de la institución</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {!canEditGrades && (
            <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
              <Eye className="w-3 h-3" /> Solo lectura
            </span>
          )}
          {canEditGrades && (
            <>
              <button
                onClick={() => openLevelModal()}
                className="flex items-center gap-2 px-4 py-2 border border-teal-600 text-teal-600 rounded-lg hover:bg-teal-50 transition-colors"
              >
                <Layers className="w-4 h-4" />
                Agregar Nivel
              </button>
              <button
                onClick={() => openGradeModal()}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Agregar Grado
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-6">
          {/* Resumen */}
          <div className="grid grid-cols-5 gap-4 mb-6">
            <div className="bg-slate-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-slate-900">{shifts.length}</p>
              <p className="text-xs text-slate-500">Jornadas</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-slate-900">{levels.length}</p>
              <p className="text-xs text-slate-500">Niveles</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-slate-900">{grades.length}</p>
              <p className="text-xs text-slate-500">Grados</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-slate-900">{grades.reduce((sum, g) => sum + g.groups.length, 0)}</p>
              <p className="text-xs text-slate-500">Grupos</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-slate-900">{grades.reduce((sum, g) => sum + g.groups.reduce((s, gr) => s + gr.capacity, 0), 0)}</p>
              <p className="text-xs text-slate-500">Capacidad Total</p>
            </div>
          </div>

          {/* Sección de Jornadas */}
          <div className="mb-6 border border-indigo-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-indigo-100 text-indigo-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <h3 className="font-semibold">Jornadas</h3>
                <span className="text-xs opacity-70">({shifts.length})</span>
              </div>
              {canEditGrades && (
                <button
                  onClick={() => openShiftModal()}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
                >
                  <Plus className="w-3 h-3" /> Agregar
                </button>
              )}
            </div>
            <div className="bg-white p-4">
              {loadingShifts ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              ) : shifts.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">
                  No hay jornadas configuradas. {canEditGrades && 'Agrega una jornada para poder crear grupos.'}
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {shifts.map((shift: any) => (
                    <div key={shift.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div>
                        <p className="font-medium text-slate-900">{shift.name}</p>
                        <p className="text-xs text-slate-500">
                          {SHIFT_TYPES.find(t => t.value === shift.type)?.label || shift.type}
                          {shift._count?.groups > 0 && ` · ${shift._count.groups} grupo(s)`}
                        </p>
                      </div>
                      {canEditGrades && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => openShiftModal(shift)} className="p-1 hover:bg-slate-200 rounded" title="Editar">
                            <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                          </button>
                          <button onClick={() => deleteShift(shift.id)} className="p-1 hover:bg-slate-200 rounded" title="Eliminar">
                            <Trash2 className="w-3.5 h-3.5 text-slate-500" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Lista por nivel educativo (editables) */}
          <div className="space-y-4">
            {levels.sort((a, b) => a.order - b.order).map((level) => {
              const levelGrades = grades.filter(g => g.levelId === level.id)
              const isExpanded = expandedLevels.includes(level.id)
              return (
                <div key={level.id} className={`border rounded-lg overflow-hidden ${level.color.split(' ')[2] || 'border-slate-200'}`}>
                  <div 
                    className={`px-4 py-3 ${level.color} flex items-center justify-between cursor-pointer`}
                    onClick={() => toggleLevelExpand(level.id)}
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      <h3 className="font-semibold">{level.name}</h3>
                      <span className="text-xs opacity-70">({level.code})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{levelGrades.length} grado(s)</span>
                      {canEditGrades && (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => openGradeModal(undefined, level.id)}
                            className="p-1 hover:bg-white/30 rounded"
                            title="Agregar grado a este nivel"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openLevelModal(level)}
                            className="p-1 hover:bg-white/30 rounded"
                            title="Editar nivel"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteLevel(level.id)}
                            className="p-1 hover:bg-white/30 rounded"
                            title="Eliminar nivel"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="bg-white divide-y divide-slate-100">
                      {levelGrades.length === 0 ? (
                        <div className="px-4 py-6 text-center text-slate-400 text-sm">
                          <p>No hay grados en este nivel</p>
                          {canEditGrades && (
                            <button
                              onClick={() => openGradeModal(undefined, level.id)}
                              className="mt-2 text-teal-600 hover:text-teal-700 text-sm font-medium"
                            >
                              + Agregar primer grado
                            </button>
                          )}
                        </div>
                      ) : (
                        levelGrades.sort((a, b) => a.order - b.order).map((grade) => (
                          <div key={grade.id}>
                            <div 
                              className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 cursor-pointer"
                              onClick={() => toggleGradeExpand(grade.id)}
                            >
                              <button className="p-1">
                                {expandedGrades.includes(grade.id) ? (
                                  <ChevronDown className="w-4 h-4 text-slate-400" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-slate-400" />
                                )}
                              </button>
                              <div className="flex-1">
                                <span className="font-medium text-slate-900">{grade.name}</span>
                                <span className="ml-2 text-sm text-slate-500">({grade.groups.length} grupo{grade.groups.length !== 1 ? 's' : ''})</span>
                              </div>
                              {canEditGrades && (
                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => openGroupModal(grade.id)}
                                    className="p-1.5 hover:bg-teal-100 rounded text-teal-600"
                                    title="Agregar grupo"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => openGradeModal(grade)}
                                    className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => deleteGrade(grade.id)}
                                    className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-red-600"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                            {expandedGrades.includes(grade.id) && grade.groups.length > 0 && (
                              <div className="bg-slate-50 px-4 py-2 ml-8 border-l-2 border-slate-200">
                                <div className="grid grid-cols-1 gap-2">
                                  {grade.groups.map((group) => (
                                    <div key={group.id} className="flex items-center gap-3 bg-white px-3 py-2 rounded-lg border border-slate-200">
                                      <UsersRound className="w-4 h-4 text-slate-400" />
                                      <span className="font-medium text-slate-700">{grade.name} {group.name}</span>
                                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                                        group.shift === 'MAÑANA' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                        group.shift === 'TARDE' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                                        group.shift === 'NOCHE' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' :
                                        'bg-slate-100 text-slate-600'
                                      }`}>{group.shiftName || group.shift}</span>
                                      <span className="text-xs text-slate-500">Cap: {group.capacity}</span>
                                      {group.directorName && <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-600 rounded border border-purple-200">Tutor: {group.directorName}</span>}
                                      {canEditGrades && (
                                        <div className="ml-auto flex items-center gap-1">
                                          <button
                                            onClick={() => openGroupModal(grade.id, group)}
                                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600"
                                          >
                                            <Edit2 className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={() => deleteGroup(grade.id, group.id)}
                                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-red-600"
                                          >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  )}
                </div>
              )
            })}

            {loadingGrades && (
              <div className="text-center py-12 text-slate-500">
                <Loader2 className="w-8 h-8 mx-auto mb-3 text-teal-500 animate-spin" />
                <p className="text-sm">Cargando estructura organizacional...</p>
              </div>
            )}

            {!loadingGrades && grades.length === 0 && (
              <div className="text-center py-12 text-slate-500 border-2 border-dashed border-slate-200 rounded-lg">
                <Building2 className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p className="mb-2">No hay grados configurados</p>
                <p className="text-sm mb-4">Agrega los grados de tu institución para organizar los grupos.</p>
                {canEditGrades && (
                  <button
                    onClick={() => openGradeModal()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar Primer Grado
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Nivel */}
      {showLevelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingLevel ? 'Editar Nivel Educativo' : 'Nuevo Nivel Educativo'}
              </h3>
              <button onClick={() => setShowLevelModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del nivel</label>
                <input
                  type="text"
                  value={levelForm.name}
                  onChange={(e) => setLevelForm({ ...levelForm, name: e.target.value })}
                  placeholder="Ej: Preescolar, Primaria, Ciclo I"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Código (opcional)</label>
                <input
                  type="text"
                  value={levelForm.code}
                  onChange={(e) => setLevelForm({ ...levelForm, code: e.target.value.toUpperCase() })}
                  placeholder="Ej: PREESCOLAR, CICLO_1"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                />
                <p className="text-xs text-slate-500 mt-1">Si no se especifica, se generará automáticamente</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
                <div className="grid grid-cols-5 gap-2">
                  {LEVEL_COLORS.map((color, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setLevelForm({ ...levelForm, color })}
                      className={`h-8 rounded-lg border-2 ${color} ${levelForm.color === color ? 'ring-2 ring-offset-2 ring-teal-500' : ''}`}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Orden</label>
                <input
                  type="number"
                  min="0"
                  value={levelForm.order}
                  onChange={(e) => setLevelForm({ ...levelForm, order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowLevelModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveLevel}
                disabled={!levelForm.name.trim()}
                className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                {editingLevel ? 'Guardar Cambios' : 'Crear Nivel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Grado */}
      {showGradeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingGrade ? 'Editar Grado' : 'Nuevo Grado'}
              </h3>
              <button onClick={() => setShowGradeModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del grado</label>
                <input
                  type="text"
                  value={gradeForm.name}
                  onChange={(e) => setGradeForm({ ...gradeForm, name: e.target.value })}
                  placeholder="Ej: Primero, Segundo, Transición"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nivel Educativo</label>
                <select
                  value={gradeForm.levelId}
                  onChange={(e) => setGradeForm({ ...gradeForm, levelId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                >
                  <option value="">Seleccionar nivel...</option>
                  {levels.sort((a, b) => a.order - b.order).map(level => (
                    <option key={level.id} value={level.id}>{level.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Orden</label>
                <input
                  type="number"
                  min="0"
                  value={gradeForm.order}
                  onChange={(e) => setGradeForm({ ...gradeForm, order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowGradeModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveGrade}
                disabled={!gradeForm.name.trim() || !gradeForm.levelId}
                className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                {editingGrade ? 'Guardar Cambios' : 'Crear Grado'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Grupo */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingGroup?.group ? 'Editar Grupo' : 'Nuevo Grupo'}
              </h3>
              <button onClick={() => setShowGroupModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del grupo</label>
                <input
                  type="text"
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  placeholder="Ej: A, B, 01, 02"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Jornada</label>
                <select
                  value={groupForm.shiftId}
                  onChange={(e) => setGroupForm({ ...groupForm, shiftId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                >
                  <option value="">— Seleccionar jornada —</option>
                  {shifts.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Capacidad</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={groupForm.capacity}
                  onChange={(e) => setGroupForm({ ...groupForm, capacity: parseInt(e.target.value) || 35 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Director de grupo (Tutor)</label>
                <select
                  value={groupForm.directorId}
                  onChange={(e) => setGroupForm({ ...groupForm, directorId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                >
                  <option value="">— Sin director asignado —</option>
                  {teachers.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">El director podrá tomar asistencia de tutoría para este grupo.</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowGroupModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveGroup}
                disabled={!groupForm.name.trim() || savingGroup}
                className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                {savingGroup ? 'Guardando...' : editingGroup?.group ? 'Guardar Cambios' : 'Crear Grupo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Jornada */}
      {showShiftModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingShift ? 'Editar Jornada' : 'Nueva Jornada'}
              </h3>
              <button onClick={() => setShowShiftModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la jornada</label>
                <input
                  type="text"
                  value={shiftForm.name}
                  onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                  placeholder="Ej: Mañana, Tarde, Jornada Única"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                <select
                  value={shiftForm.type}
                  onChange={(e) => setShiftForm({ ...shiftForm, type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                >
                  {SHIFT_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowShiftModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveShift}
                disabled={!shiftForm.name.trim() || savingShift}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {savingShift ? 'Guardando...' : editingShift ? 'Guardar Cambios' : 'Crear Jornada'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
