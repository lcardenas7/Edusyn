import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  timetablingTimeBlocksApi,
  timetablingRoomsApi,
  timetablingConfigApi,
  timetablingEntriesApi,
  timetablingGeneratorApi,
  academicGradesApi,
  academicYearLifecycleApi,
  capabilitiesApi,
} from '../lib/api'
import {
  Clock, MapPin, Settings, Calendar, AlertTriangle, Plus, Trash2, Save,
  ChevronDown, Edit2, X, Check, Grid3X3, Users, Building2, Layers,
  Upload, Download, Wand2, FileSpreadsheet, RefreshCw, Eye, CheckCircle2, XCircle,
  Move, ArrowRight, CalendarDays
} from 'lucide-react'

const DAYS = [
  { key: 'MONDAY', label: 'Lunes', short: 'Lun' },
  { key: 'TUESDAY', label: 'Martes', short: 'Mar' },
  { key: 'WEDNESDAY', label: 'Miércoles', short: 'Mié' },
  { key: 'THURSDAY', label: 'Jueves', short: 'Jue' },
  { key: 'FRIDAY', label: 'Viernes', short: 'Vie' },
  { key: 'SATURDAY', label: 'Sábado', short: 'Sáb' },
]

const BLOCK_TYPES = [
  { value: 'CLASS', label: 'Clase', color: 'bg-blue-100 text-blue-800' },
  { value: 'BREAK', label: 'Descanso', color: 'bg-green-100 text-green-800' },
  { value: 'LUNCH', label: 'Almuerzo', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'ASSEMBLY', label: 'Formación', color: 'bg-purple-100 text-purple-800' },
  { value: 'FREE', label: 'Libre', color: 'bg-gray-100 text-gray-800' },
  { value: 'TUTORING', label: 'Tutoría', color: 'bg-indigo-100 text-indigo-800' },
]

const SCHEDULE_MODES = [
  { value: 'FIXED_TEACHER', label: 'Docente fijo', desc: 'El docente permanece con el grupo (preescolar, primaria baja)' },
  { value: 'ROTATING_TEACHER', label: 'Rotación de docentes', desc: 'Los docentes rotan entre grupos (primaria alta, secundaria, media)' },
]

interface TimeBlock {
  id: string
  shiftId: string
  type: string
  startTime: string
  endTime: string
  order: number
  label: string | null
  shift?: { id: string; name: string; type: string }
}

interface Room {
  id: string
  name: string
  code: string | null
  capacity: number | null
  description: string | null
  equipment: string[]
  isReservable: boolean
  isActive: boolean
  campus?: { id: string; name: string } | null
  restrictions?: any[]
  _count?: { scheduleEntries: number }
}

interface ScheduleEntry {
  id: string
  dayOfWeek: string
  timeBlockId: string
  groupId: string
  teacherAssignmentId: string | null
  projectName: string | null
  projectDescription: string | null
  roomId: string | null
  notes: string | null
  color: string | null
  group?: { id: string; name: string; code: string | null }
  timeBlock?: { id: string; startTime: string; endTime: string; order: number; label: string | null; type: string }
  teacherAssignment?: {
    teacher?: { id: string; firstName?: string; lastName?: string; name?: string; email?: string }
    subject?: { id: string; name: string; code?: string | null }
  } | null
  room?: { id: string; name: string; code?: string | null } | null
}

interface GradeGroup {
  id: string
  name: string
  stage: string
  groups: Array<{ id: string; name: string; code?: string; shift?: { id: string; name: string } }>
}

export default function Timetabling() {
  const { user, institution } = useAuth()
  const isManager = user?.roles?.some((r: any) => {
    const roleName = r.role?.name || r.name || ''
    return roleName.includes('ADMIN') || roleName.includes('COORDINADOR') || roleName.includes('SUPERADMIN') || roleName.includes('RECTOR')
  }) ?? false
  const [activeTab, setActiveTab] = useState<'blocks' | 'rooms' | 'config' | 'schedule' | 'conflicts' | 'generator' | 'viewer'>('schedule')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Data
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [grades, setGrades] = useState<GradeGroup[]>([])
  const [selectedGroup, setSelectedGroup] = useState<string>('')
  const [gridData, setGridData] = useState<any>(null)
  const [conflicts, setConflicts] = useState<any>(null)
  const [academicYearId, setAcademicYearId] = useState<string>('')
  const [academicYearLabel, setAcademicYearLabel] = useState<string>('')
  const [noAcademicYear, setNoAcademicYear] = useState(false)

  // Capabilities del usuario
  const [userCaps, setUserCaps] = useState<{
    capabilities: string[];
    effectiveRoles: string[];
    isTutor: boolean;
    tutorGroupIds: string[];
    teacherAssignmentGroupIds: string[];
  } | null>(null)

  const loadGrades = useCallback(async () => {
    try {
      const res = await academicGradesApi.getAll()
      const data = res.data || []
      setGrades(data)
      // Auto-select first group
      if (data.length > 0 && data[0].groups?.length > 0 && !selectedGroup) {
        setSelectedGroup(data[0].groups[0].id)
      }
    } catch (err) {
      console.error('Error loading grades:', err)
    }
  }, [selectedGroup])

  const loadTimeBlocks = useCallback(async () => {
    try {
      const res = await timetablingTimeBlocksApi.getAll()
      setTimeBlocks(res.data || [])
    } catch (err) {
      console.error('Error loading time blocks:', err)
    }
  }, [])

  const loadRooms = useCallback(async () => {
    try {
      const res = await timetablingRoomsApi.getAll()
      setRooms(res.data || [])
    } catch (err) {
      console.error('Error loading rooms:', err)
    }
  }, [])

  const loadGrid = useCallback(async () => {
    if (!academicYearId || !selectedGroup) return
    setLoading(true)
    try {
      const res = await timetablingEntriesApi.getGrid(academicYearId, selectedGroup)
      setGridData(res.data)
    } catch (err) {
      console.error('Error loading grid:', err)
    } finally {
      setLoading(false)
    }
  }, [academicYearId, selectedGroup])

  const loadConflicts = useCallback(async () => {
    if (!academicYearId) return
    try {
      const res = await timetablingEntriesApi.getConflicts(academicYearId)
      setConflicts(res.data)
    } catch (err) {
      console.error('Error loading conflicts:', err)
    }
  }, [academicYearId])

  useEffect(() => {
    const instId = institution?.id || user?.institution?.id
    if (!instId) return

    // Intentar primero getCurrent, luego getByInstitution como fallback
    const resolveAcademicYear = async () => {
      try {
        // Primero intentar obtener el año actual directamente
        const currentRes = await academicYearLifecycleApi.getCurrent(instId)
        if (currentRes.data?.id) {
          setAcademicYearId(currentRes.data.id)
          setAcademicYearLabel(currentRes.data.year?.toString() || currentRes.data.name || '')
          setNoAcademicYear(false)
          return
        }
      } catch {
        // getCurrent puede fallar si no hay año activo, intentar fallback
      }

      try {
        const res = await academicYearLifecycleApi.getByInstitution(instId)
        const years = res.data || []
        const active = years.find((y: any) => y.status === 'ACTIVE') || years[0]
        if (active) {
          setAcademicYearId(active.id)
          setAcademicYearLabel(active.year?.toString() || active.name || '')
          setNoAcademicYear(false)
        } else {
          setNoAcademicYear(true)
        }
      } catch {
        setNoAcademicYear(true)
      }
    }

    resolveAcademicYear()
    loadGrades()
    loadTimeBlocks()
    loadRooms()

    // Cargar capabilities del usuario
    capabilitiesApi.getMyCapabilities().then(res => {
      setUserCaps(res.data)
    }).catch(err => console.error('Error loading capabilities:', err))
  }, [institution?.id, user?.institution?.id])

  useEffect(() => {
    if (activeTab === 'schedule') loadGrid()
    if (activeTab === 'conflicts') loadConflicts()
  }, [activeTab, selectedGroup, academicYearId])

  const showMessage = (msg: string, type: 'success' | 'error') => {
    if (type === 'success') { setSuccess(msg); setError('') }
    else { setError(msg); setSuccess('') }
    setTimeout(() => { setSuccess(''); setError('') }, 4000)
  }

  const tabs = [
    { key: 'schedule', label: 'Horario', icon: Grid3X3 },
    { key: 'viewer', label: 'Vistas', icon: Eye },
    ...(isManager ? [
      { key: 'generator' as const, label: 'Generador', icon: Wand2 },
      { key: 'blocks' as const, label: 'Bloques de tiempo', icon: Clock },
      { key: 'rooms' as const, label: 'Espacios', icon: Building2 },
      { key: 'config' as const, label: 'Configuración', icon: Settings },
      { key: 'conflicts' as const, label: 'Conflictos', icon: AlertTriangle },
    ] : []),
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-7 h-7 text-indigo-600" />
            Timetabling - Horarios
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestión visual de horarios escolares
            {academicYearLabel && <span className="ml-2 text-indigo-600 font-medium">• {academicYearLabel}</span>}
          </p>
        </div>
      </div>

      {/* No academic year banner */}
      {noAcademicYear && (
        <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-amber-800 font-medium">No se encontró un año académico activo</p>
            <p className="text-amber-700 text-sm mt-1">
              Para usar el módulo de horarios, primero debe crear y activar un año académico desde
              <strong> Gestión Académica → Año Académico</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded">
          <p className="text-green-700 text-sm">{success}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-4 overflow-x-auto" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-2 py-3 px-4 border-b-2 text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.key === 'conflicts' && conflicts?.totalConflicts > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                    {conflicts.totalConflicts}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'schedule' && (
        <ScheduleTab
          grades={grades}
          selectedGroup={selectedGroup}
          setSelectedGroup={setSelectedGroup}
          gridData={gridData}
          loading={loading}
          academicYearId={academicYearId}
          timeBlocks={timeBlocks}
          rooms={rooms}
          onReload={loadGrid}
          showMessage={showMessage}
          isManager={isManager}
          userCaps={userCaps}
        />
      )}

      {activeTab === 'blocks' && (
        <TimeBlocksTab
          timeBlocks={timeBlocks}
          onReload={loadTimeBlocks}
          showMessage={showMessage}
        />
      )}

      {activeTab === 'rooms' && (
        <RoomsTab
          rooms={rooms}
          onReload={loadRooms}
          showMessage={showMessage}
        />
      )}

      {activeTab === 'config' && (
        <ConfigTab
          grades={grades}
          academicYearId={academicYearId}
          showMessage={showMessage}
        />
      )}

      {activeTab === 'conflicts' && (
        <ConflictsTab conflicts={conflicts} loading={loading} />
      )}

      {activeTab === 'generator' && (
        <GeneratorTab
          academicYearId={academicYearId}
          grades={grades}
          showMessage={showMessage}
          onScheduleGenerated={() => { loadGrid(); loadConflicts() }}
        />
      )}

      {activeTab === 'viewer' && (
        <ScheduleViewerTab
          academicYearId={academicYearId}
          isManager={isManager}
          user={user}
          userCaps={userCaps}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// SCHEDULE TAB - Grilla visual del horario
// ═══════════════════════════════════════════════════════

function ScheduleTab({ grades, selectedGroup, setSelectedGroup, gridData, loading, academicYearId, timeBlocks, rooms, onReload, showMessage, isManager, userCaps }: any) {
  const [editingCell, setEditingCell] = useState<{ day: string; blockId: string } | null>(null)
  const [cellForm, setCellForm] = useState<any>({})

  const getTeacherName = (entry: ScheduleEntry) => {
    if (!entry?.teacherAssignment?.teacher) return ''
    const t = entry.teacherAssignment.teacher
    return t.firstName ? `${t.firstName} ${t.lastName || ''}`.trim() : (t.name || '')
  }

  const getCellContent = (entry: ScheduleEntry | null) => {
    if (!entry) return null
    if (entry.projectName) {
      return (
        <div className="text-xs">
          <div className="font-semibold text-purple-700">{entry.projectName}</div>
          {entry.room && <div className="text-gray-500">{entry.room.name}</div>}
        </div>
      )
    }
    if (entry.teacherAssignment) {
      return (
        <div className="text-xs">
          <div className="font-semibold text-blue-700">{entry.teacherAssignment.subject?.name}</div>
          <div className="text-gray-600">{getTeacherName(entry)}</div>
          {entry.room && <div className="text-gray-400">{entry.room.name}</div>}
        </div>
      )
    }
    return null
  }

  const handleCellClick = (day: string, blockId: string, entry: any) => {
    setEditingCell({ day, blockId })
    setCellForm({
      teacherAssignmentId: entry?.teacherAssignmentId || '',
      projectName: entry?.projectName || '',
      roomId: entry?.roomId || '',
      entryId: entry?.id || null,
    })
  }

  const handleSaveCell = async () => {
    if (!editingCell || !academicYearId || !selectedGroup) return
    try {
      if (cellForm.entryId) {
        await timetablingEntriesApi.update(cellForm.entryId, {
          teacherAssignmentId: cellForm.teacherAssignmentId || null,
          projectName: cellForm.projectName || null,
          roomId: cellForm.roomId || null,
        })
      } else {
        await timetablingEntriesApi.create({
          academicYearId,
          groupId: selectedGroup,
          timeBlockId: editingCell.blockId,
          dayOfWeek: editingCell.day,
          teacherAssignmentId: cellForm.teacherAssignmentId || undefined,
          projectName: cellForm.projectName || undefined,
          roomId: cellForm.roomId || undefined,
        })
      }
      setEditingCell(null)
      onReload()
      showMessage('Entrada guardada', 'success')
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Error al guardar'
      const conflicts = err.response?.data?.conflicts
      if (conflicts?.length) {
        showMessage(conflicts.map((c: any) => c.message).join('. '), 'error')
      } else {
        showMessage(typeof msg === 'string' ? msg : JSON.stringify(msg), 'error')
      }
    }
  }

  const handleDeleteCell = async (entryId: string) => {
    try {
      await timetablingEntriesApi.delete(entryId)
      setEditingCell(null)
      onReload()
      showMessage('Entrada eliminada', 'success')
    } catch (err) {
      showMessage('Error al eliminar', 'error')
    }
  }

  const allGroupsRaw = grades.flatMap((g: any) => g.groups?.map((gr: any) => ({ ...gr, gradeName: g.name })) || [])

  // Filtrar grupos según capabilities para no-managers: solo grupo de tutoría
  const allGroups = (() => {
    if (isManager) return allGroupsRaw
    if (!userCaps) return [] // esperar a que carguen las capabilities
    const tutorIds = new Set<string>(userCaps.tutorGroupIds || [])
    if (tutorIds.size === 0) return [] // docente sin grupo de tutoría no ve selector de grupos
    return allGroupsRaw.filter((g: any) => tutorIds.has(g.id))
  })()

  // Fix race condition: after userCaps loads, redirect to first valid tutor group
  useEffect(() => {
    if (isManager || !userCaps || allGroupsRaw.length === 0) return
    const tutorIds = new Set<string>(userCaps.tutorGroupIds || [])
    if (tutorIds.size === 0) {
      if (selectedGroup) setSelectedGroup('')
      return
    }
    if (!selectedGroup || !tutorIds.has(selectedGroup)) {
      const firstValid = allGroupsRaw.find((g: any) => tutorIds.has(g.id))
      setSelectedGroup(firstValid?.id || '')
    }
  }, [userCaps]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      {/* Group Selector */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-500" />
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Seleccionar grupo...</option>
            {allGroups.map((g: any) => (
              <option key={g.id} value={g.id}>{g.gradeName} - {g.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
        </div>
      ) : !selectedGroup ? (
        <div className="text-center py-12 text-gray-500">
          <Grid3X3 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>Selecciona un grupo para ver su horario</p>
        </div>
      ) : gridData ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500 w-24">Hora</th>
                {DAYS.slice(0, gridData.days?.length || 6).map((day) => (
                  <th key={day.key} className="border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500 min-w-[140px]">
                    {day.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(gridData.timeBlocks || []).map((block: TimeBlock) => {
                const blockType = BLOCK_TYPES.find(t => t.value === block.type)
                const isClassBlock = block.type === 'CLASS'
                
                return (
                  <tr key={block.id}>
                    <td className="border border-gray-200 px-2 py-1 text-xs text-center bg-gray-50">
                      <div className="font-medium">{block.label || `Bloque ${block.order}`}</div>
                      <div className="text-gray-400">{block.startTime}-{block.endTime}</div>
                      {blockType && (
                        <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] ${blockType.color}`}>
                          {blockType.label}
                        </span>
                      )}
                    </td>
                    {DAYS.slice(0, gridData.days?.length || 6).map((day) => {
                      const entry = gridData.grid?.[day.key]?.[block.id] || null
                      const isEditing = editingCell?.day === day.key && editingCell?.blockId === block.id

                      if (!isClassBlock) {
                        return (
                          <td key={day.key} className={`border border-gray-200 px-2 py-2 text-center ${blockType?.color || 'bg-gray-50'}`}>
                            <span className="text-xs font-medium">{blockType?.label}</span>
                          </td>
                        )
                      }

                      return (
                        <td
                          key={day.key}
                          onClick={() => !isEditing && handleCellClick(day.key, block.id, entry)}
                          className={`border border-gray-200 px-2 py-1 cursor-pointer transition-colors min-h-[60px] ${
                            entry
                              ? entry.projectName
                                ? 'bg-purple-50 hover:bg-purple-100'
                                : 'bg-blue-50 hover:bg-blue-100'
                              : 'bg-white hover:bg-gray-50'
                          } ${isEditing ? 'ring-2 ring-indigo-500' : ''}`}
                          style={entry?.color ? { backgroundColor: entry.color + '20' } : undefined}
                        >
                          {isEditing ? (
                            <div className="space-y-1 min-w-[130px]" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="text"
                                placeholder="Proyecto (opc.)"
                                value={cellForm.projectName}
                                onChange={(e) => setCellForm({ ...cellForm, projectName: e.target.value, teacherAssignmentId: e.target.value ? '' : cellForm.teacherAssignmentId })}
                                className="w-full border rounded px-1 py-0.5 text-xs"
                              />
                              {rooms.length > 0 && (
                                <select
                                  value={cellForm.roomId}
                                  onChange={(e) => setCellForm({ ...cellForm, roomId: e.target.value })}
                                  className="w-full border rounded px-1 py-0.5 text-xs"
                                >
                                  <option value="">Sin aula</option>
                                  {rooms.map((r: Room) => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                  ))}
                                </select>
                              )}
                              <div className="flex gap-1 justify-end">
                                {cellForm.entryId && (
                                  <button onClick={() => handleDeleteCell(cellForm.entryId)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Eliminar">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                                <button onClick={() => setEditingCell(null)} className="p-1 text-gray-500 hover:bg-gray-100 rounded">
                                  <X className="w-3 h-3" />
                                </button>
                                <button onClick={handleSaveCell} className="p-1 text-green-600 hover:bg-green-50 rounded">
                                  <Check className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            getCellContent(entry) || (
                              <div className="text-xs text-gray-300 text-center py-2">
                                <Plus className="w-3 h-3 mx-auto" />
                              </div>
                            )
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No hay bloques de tiempo configurados</p>
          <p className="text-xs mt-1">Ve a la pestaña "Bloques de tiempo" para crear la estructura horaria</p>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// TIME BLOCKS TAB
// ═══════════════════════════════════════════════════════

function TimeBlocksTab({ timeBlocks, onReload, showMessage }: any) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ shiftId: '', type: 'CLASS', startTime: '', endTime: '', order: 1, label: '' })
  const [shifts, setShifts] = useState<any[]>([])

  useEffect(() => {
    // Extract unique shifts from existing blocks or load from API
    const uniqueShifts = new Map()
    timeBlocks.forEach((b: TimeBlock) => {
      if (b.shift) uniqueShifts.set(b.shift.id, b.shift)
    })
    setShifts(Array.from(uniqueShifts.values()))
  }, [timeBlocks])

  const handleCreate = async () => {
    if (!form.shiftId || !form.startTime || !form.endTime) {
      showMessage('Complete todos los campos requeridos', 'error')
      return
    }
    try {
      await timetablingTimeBlocksApi.create(form)
      setShowForm(false)
      setForm({ shiftId: '', type: 'CLASS', startTime: '', endTime: '', order: timeBlocks.length + 1, label: '' })
      onReload()
      showMessage('Bloque creado', 'success')
    } catch (err: any) {
      showMessage(err.response?.data?.message || 'Error al crear bloque', 'error')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este bloque?')) return
    try {
      await timetablingTimeBlocksApi.delete(id)
      onReload()
      showMessage('Bloque eliminado', 'success')
    } catch (err: any) {
      showMessage(err.response?.data?.message || 'Error al eliminar', 'error')
    }
  }

  // Group blocks by shift
  const blocksByShift = timeBlocks.reduce((acc: any, b: TimeBlock) => {
    const key = b.shift?.name || b.shiftId
    if (!acc[key]) acc[key] = []
    acc[key].push(b)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-800">Bloques de tiempo por jornada</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
        >
          <Plus className="w-4 h-4" />
          Nuevo bloque
        </button>
      </div>

      {showForm && (
        <div className="bg-white border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Jornada*</label>
              <select value={form.shiftId} onChange={(e) => setForm({ ...form, shiftId: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm">
                <option value="">Seleccionar...</option>
                {shifts.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm">
                {BLOCK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Inicio*</label>
              <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fin*</label>
              <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Orden</label>
              <input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 1 })} className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Etiqueta</label>
              <input type="text" value={form.label} placeholder="Bloque 1" onChange={(e) => setForm({ ...form, label: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 border rounded text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button onClick={handleCreate} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">Guardar</button>
          </div>
        </div>
      )}

      {Object.keys(blocksByShift).length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No hay bloques de tiempo configurados</p>
          <p className="text-xs mt-1">Crea bloques para definir la estructura horaria de cada jornada</p>
        </div>
      ) : (
        Object.entries(blocksByShift).map(([shiftName, blocks]: [string, any]) => (
          <div key={shiftName} className="bg-white border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b">
              <h3 className="font-medium text-gray-700 flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Jornada: {shiftName}
              </h3>
            </div>
            <div className="divide-y">
              {(blocks as TimeBlock[]).sort((a, b) => a.order - b.order).map((block) => {
                const blockType = BLOCK_TYPES.find(t => t.value === block.type)
                return (
                  <div key={block.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-mono text-gray-500 w-8">#{block.order}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${blockType?.color || 'bg-gray-100'}`}>{blockType?.label}</span>
                      <span className="text-sm font-medium">{block.startTime} - {block.endTime}</span>
                      {block.label && <span className="text-sm text-gray-500">({block.label})</span>}
                    </div>
                    <button onClick={() => handleDelete(block.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// ROOMS TAB
// ═══════════════════════════════════════════════════════

function RoomsTab({ rooms, onReload, showMessage }: any) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', code: '', capacity: '', description: '', equipment: '' })

  const handleCreate = async () => {
    if (!form.name) { showMessage('El nombre es requerido', 'error'); return }
    try {
      await timetablingRoomsApi.create({
        name: form.name,
        code: form.code || undefined,
        capacity: form.capacity ? parseInt(form.capacity) : undefined,
        description: form.description || undefined,
        equipment: form.equipment ? form.equipment.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
      })
      setShowForm(false)
      setForm({ name: '', code: '', capacity: '', description: '', equipment: '' })
      onReload()
      showMessage('Espacio creado', 'success')
    } catch (err: any) {
      showMessage(err.response?.data?.message || 'Error al crear espacio', 'error')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este espacio?')) return
    try {
      await timetablingRoomsApi.delete(id)
      onReload()
      showMessage('Espacio eliminado', 'success')
    } catch (err: any) {
      showMessage(err.response?.data?.message || 'Error al eliminar', 'error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-800">Espacios y aulas</h2>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
          <Plus className="w-4 h-4" />
          Nuevo espacio
        </button>
      </div>

      {showForm && (
        <div className="bg-white border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre*</label>
              <input type="text" value={form.name} placeholder="Laboratorio de Ciencias" onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Código</label>
              <input type="text" value={form.code} placeholder="LAB-1" onChange={(e) => setForm({ ...form, code: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Capacidad</label>
              <input type="number" value={form.capacity} placeholder="30" onChange={(e) => setForm({ ...form, capacity: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
              <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Equipamiento (separado por comas)</label>
              <input type="text" value={form.equipment} placeholder="proyector, computadores" onChange={(e) => setForm({ ...form, equipment: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 border rounded text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button onClick={handleCreate} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">Guardar</button>
          </div>
        </div>
      )}

      {rooms.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No hay espacios configurados</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room: Room) => (
            <div key={room.id} className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-gray-800">{room.name}</h3>
                  {room.code && <p className="text-xs text-gray-500">{room.code}</p>}
                </div>
                <button onClick={() => handleDelete(room.id)} className="p-1 text-red-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {room.capacity && <p className="text-xs text-gray-600 mt-2">Capacidad: {room.capacity}</p>}
              {room.description && <p className="text-xs text-gray-500 mt-1">{room.description}</p>}
              {room.equipment?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {room.equipment.map((eq: string, i: number) => (
                    <span key={i} className="bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded">{eq}</span>
                  ))}
                </div>
              )}
              {room._count && (
                <p className="text-[10px] text-gray-400 mt-2">{room._count.scheduleEntries} entradas en horario</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// CONFIG TAB
// ═══════════════════════════════════════════════════════

function ConfigTab({ grades, academicYearId, showMessage }: any) {
  const [configs, setConfigs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!academicYearId) return
    setLoading(true)
    timetablingConfigApi.getAll(academicYearId)
      .then(res => setConfigs(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [academicYearId])

  const handleModeChange = async (gradeId: string, mode: string) => {
    try {
      await timetablingConfigApi.upsert({ academicYearId, gradeId, mode })
      const res = await timetablingConfigApi.getAll(academicYearId)
      setConfigs(res.data || [])
      showMessage('Configuración actualizada', 'success')
    } catch (err: any) {
      showMessage(err.response?.data?.message || 'Error al actualizar', 'error')
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">Configuración de modo por grado</h2>
      <p className="text-sm text-gray-500">
        Define cómo se organiza el horario para cada grado. En modo "Docente fijo" el docente permanece con el grupo;
        en "Rotación" los docentes cambian según la materia.
      </p>

      {!academicYearId ? (
        <div className="text-center py-8 text-gray-500">
          <Settings className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>Selecciona un año académico activo</p>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
        </div>
      ) : (
        <div className="bg-white border rounded-lg divide-y">
          {grades.map((grade: GradeGroup) => {
            const config = configs.find((c: any) => c.gradeId === grade.id)
            const currentMode = config?.mode || 'ROTATING_TEACHER'
            return (
              <div key={grade.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="font-medium text-gray-800">{grade.name}</span>
                  <span className="text-xs text-gray-400 ml-2">({grade.stage})</span>
                </div>
                <select
                  value={currentMode}
                  onChange={(e) => handleModeChange(grade.id, e.target.value)}
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  {SCHEDULE_MODES.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// CONFLICTS TAB
// ═══════════════════════════════════════════════════════

function ConflictsTab({ conflicts, loading }: any) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    )
  }

  if (!conflicts) {
    return (
      <div className="text-center py-12 text-gray-500">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p>No hay datos de conflictos disponibles</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-gray-800">{conflicts.totalConflicts}</div>
          <div className="text-xs text-gray-500">Total conflictos</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{conflicts.errors}</div>
          <div className="text-xs text-red-500">Errores</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">{conflicts.warnings}</div>
          <div className="text-xs text-yellow-500">Advertencias</div>
        </div>
      </div>

      {/* Conflict List */}
      {conflicts.totalConflicts === 0 ? (
        <div className="text-center py-8 text-green-600">
          <Check className="w-12 h-12 mx-auto mb-3" />
          <p className="font-medium">Sin conflictos detectados</p>
          <p className="text-xs text-gray-500 mt-1">Todos los horarios están correctamente configurados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(conflicts.conflicts || []).map((c: any, i: number) => (
            <div key={i} className={`border rounded-lg p-3 ${c.severity === 'ERROR' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
              <div className="flex items-start gap-2">
                <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${c.severity === 'ERROR' ? 'text-red-500' : 'text-yellow-500'}`} />
                <div>
                  <p className="text-sm font-medium text-gray-800">{c.message}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {c.type === 'TEACHER_OVERLAP' && 'Conflicto de docente'}
                    {c.type === 'ROOM_OVERLAP' && 'Conflicto de espacio'}
                    {c.type === 'GROUP_OVERLAP' && 'Conflicto de grupo'}
                    {c.type === 'TEACHER_UNAVAILABLE' && 'Docente no disponible'}
                    {c.details?.dayOfWeek && ` • ${DAYS.find(d => d.key === c.details.dayOfWeek)?.label || c.details.dayOfWeek}`}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// GENERATOR TAB - Con selector de jornada y contexto persistente
// ═══════════════════════════════════════════════════════

function GeneratorTab({ academicYearId, grades, showMessage, onScheduleGenerated }: {
  academicYearId: string
  grades: GradeGroup[]
  showMessage: (msg: string, type: 'success' | 'error') => void
  onScheduleGenerated: () => void
}) {
  // ── Shift selector ──
  const [shifts, setShifts] = useState<any[]>([])
  const [selectedShiftId, setSelectedShiftId] = useState<string>('')
  const [shiftsLoading, setShiftsLoading] = useState(false)

  // ── Flow state ──
  const [step, setStep] = useState<'load' | 'configure' | 'generate' | 'result'>('load')
  const [loading, setLoading] = useState(false)
  const [teachingLoad, setTeachingLoad] = useState<any>(null)
  const [importResult, setImportResult] = useState<any>(null)
  const [generateResult, setGenerateResult] = useState<any>(null)
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [genOptions, setGenOptions] = useState({
    clearExisting: true,
    respectAvailability: true,
    groupTeacherBlocks: true,
  })
  const [scheduleConfig, setScheduleConfig] = useState({
    startTime: '06:30',
    classesPerDay: 7,
    classDuration: 55,
    breakDuration: 15,
    breakAfterBlock: 2,
    secondBreakAfterBlock: 4,
    includeLunch: true,
    lunchDuration: 30,
    lunchAfterBlock: 6,
    includeTutoring: true,
    tutoringDuration: 55,
    activeDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as string[],
  })
  const [configSaved, setConfigSaved] = useState(false)
  const [configPreview, setConfigPreview] = useState<any[]>([])
  const [contextLoaded, setContextLoaded] = useState(false)

  const allGroups = grades.flatMap(g => g.groups.map(gr => ({ ...gr, gradeName: g.name })))

  const selectedShift = shifts.find(s => s.id === selectedShiftId)

  // ── Load shifts on mount ──
  useEffect(() => {
    if (!academicYearId) return
    setShiftsLoading(true)
    timetablingGeneratorApi.getShifts()
      .then(res => {
        const data = res.data || []
        setShifts(data)
        if (data.length === 1 && !selectedShiftId) setSelectedShiftId(data[0].id)
      })
      .catch(() => {})
      .finally(() => setShiftsLoading(false))
  }, [academicYearId])

  // ── Load persistent context when shift changes ──
  useEffect(() => {
    if (!academicYearId || !selectedShiftId) { setContextLoaded(false); return }
    setContextLoaded(false)
    timetablingGeneratorApi.getContext(academicYearId, selectedShiftId)
      .then(res => {
        const ctx = res.data
        if (ctx) {
          setScheduleConfig(prev => ({
            ...prev,
            startTime: ctx.startTime || prev.startTime,
            classesPerDay: ctx.classesPerDay ?? prev.classesPerDay,
            classDuration: ctx.classDurationMinutes ?? prev.classDuration,
            breakDuration: ctx.breakDurationMinutes ?? prev.breakDuration,
            breakAfterBlock: ctx.breakAfterBlock ?? prev.breakAfterBlock,
            secondBreakAfterBlock: ctx.secondBreakAfterBlock ?? prev.secondBreakAfterBlock,
            includeLunch: ctx.includeLunch ?? prev.includeLunch,
            lunchDuration: ctx.lunchDurationMinutes ?? prev.lunchDuration,
            lunchAfterBlock: ctx.lunchAfterBlock ?? prev.lunchAfterBlock,
            includeTutoring: ctx.includeTutoring ?? prev.includeTutoring,
            tutoringDuration: ctx.tutoringDurationMinutes ?? prev.tutoringDuration,
            activeDays: ctx.activeDays?.length > 0 ? ctx.activeDays : prev.activeDays,
          }))
          setGenOptions({
            clearExisting: ctx.clearExisting ?? true,
            respectAvailability: ctx.respectAvailability ?? true,
            groupTeacherBlocks: ctx.groupTeacherBlocks ?? true,
          })
          setSelectedGroupIds(ctx.selectedGroupIds || [])
          setConfigSaved(ctx.configSaved ?? false)
          if (ctx.lastGenerationResult) setGenerateResult(ctx.lastGenerationResult)
          const validSteps = ['load', 'configure', 'generate', 'result']
          if (ctx.lastStep && validSteps.includes(ctx.lastStep)) setStep(ctx.lastStep as any)
        } else {
          loadScheduleConfigFromBlocks()
        }
      })
      .catch(() => {})
      .finally(() => setContextLoaded(true))
    loadTeachingLoad()
  }, [academicYearId, selectedShiftId])

  // ── Save context on step change ──
  const saveContext = useCallback(async (overrides?: any) => {
    if (!academicYearId || !selectedShiftId) return
    try {
      await timetablingGeneratorApi.saveContext({
        academicYearId, shiftId: selectedShiftId, lastStep: step,
        startTime: scheduleConfig.startTime, classesPerDay: scheduleConfig.classesPerDay,
        classDurationMinutes: scheduleConfig.classDuration, breakDurationMinutes: scheduleConfig.breakDuration,
        breakAfterBlock: scheduleConfig.breakAfterBlock, secondBreakAfterBlock: scheduleConfig.secondBreakAfterBlock,
        includeLunch: scheduleConfig.includeLunch, lunchDurationMinutes: scheduleConfig.lunchDuration,
        lunchAfterBlock: scheduleConfig.lunchAfterBlock, includeTutoring: scheduleConfig.includeTutoring,
        tutoringDurationMinutes: scheduleConfig.tutoringDuration, activeDays: scheduleConfig.activeDays,
        clearExisting: genOptions.clearExisting, respectAvailability: genOptions.respectAvailability,
        groupTeacherBlocks: genOptions.groupTeacherBlocks, selectedGroupIds, configSaved,
        ...overrides,
      })
    } catch (_) { /* non-critical */ }
  }, [academicYearId, selectedShiftId, step, scheduleConfig, genOptions, selectedGroupIds, configSaved])

  useEffect(() => { if (contextLoaded && selectedShiftId) saveContext() }, [step])

  // ── Load teaching load for selected shift ──
  const loadTeachingLoad = async () => {
    if (!academicYearId) return
    setLoading(true)
    try {
      const res = await timetablingGeneratorApi.getTeachingLoad(academicYearId, selectedShiftId || undefined)
      setTeachingLoad(res.data)
    } catch (err: any) {
      console.error('Error loading teaching load:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── Load existing block config from TimeBlocks ──
  const loadScheduleConfigFromBlocks = async () => {
    try {
      const res = await timetablingGeneratorApi.getScheduleConfig(selectedShiftId || undefined)
      const d = res.data
      setScheduleConfig(prev => ({
        ...prev,
        startTime: d.startTime || prev.startTime,
        classesPerDay: d.classesPerDay || prev.classesPerDay,
        classDuration: d.classDurationMinutes || prev.classDuration,
        breakDuration: d.breakDurationMinutes || prev.breakDuration,
        breakAfterBlock: d.breakAfterBlock > 0 ? d.breakAfterBlock : prev.breakAfterBlock,
        includeLunch: d.includeLunch ?? prev.includeLunch,
        lunchDuration: d.lunchDurationMinutes || prev.lunchDuration,
        lunchAfterBlock: d.lunchAfterBlock || prev.lunchAfterBlock,
        includeTutoring: d.includeTutoring ?? prev.includeTutoring,
        tutoringDuration: d.tutoringDurationMinutes || prev.tutoringDuration,
        activeDays: d.activeDays || prev.activeDays,
      }))
      if (d.existingBlocks?.length > 0) setConfigSaved(true)
    } catch (err) {
      console.error('Error loading config:', err)
    }
  }

  // ── Compute block preview ──
  const computePreview = useCallback(() => {
    const blocks: { label: string; type: string; start: string; end: string }[] = []
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
    const toTime = (mins: number) => `${Math.floor(mins / 60).toString().padStart(2, '0')}:${(mins % 60).toString().padStart(2, '0')}`

    let cur = toMin(scheduleConfig.startTime)
    let classNum = 0

    if (scheduleConfig.includeTutoring) {
      const ts = toTime(cur)
      cur += scheduleConfig.tutoringDuration
      blocks.push({ label: 'Tutoría', type: 'TUTORING', start: ts, end: toTime(cur) })
    }

    for (let i = 0; i < scheduleConfig.classesPerDay; i++) {
      classNum++
      const s = toTime(cur)
      cur += scheduleConfig.classDuration
      const e = toTime(cur)
      blocks.push({ label: `${classNum}° Hora`, type: 'CLASS', start: s, end: e })

      if (classNum === scheduleConfig.breakAfterBlock && i < scheduleConfig.classesPerDay - 1) {
        const bs = toTime(cur)
        cur += scheduleConfig.breakDuration
        blocks.push({ label: 'Receso', type: 'BREAK', start: bs, end: toTime(cur) })
      }
      if (scheduleConfig.secondBreakAfterBlock && classNum === scheduleConfig.secondBreakAfterBlock && i < scheduleConfig.classesPerDay - 1) {
        const bs = toTime(cur)
        cur += scheduleConfig.breakDuration
        blocks.push({ label: 'Receso', type: 'BREAK', start: bs, end: toTime(cur) })
      }
      if (scheduleConfig.includeLunch && classNum === scheduleConfig.lunchAfterBlock && i < scheduleConfig.classesPerDay - 1) {
        const ls = toTime(cur)
        cur += scheduleConfig.lunchDuration
        blocks.push({ label: 'Almuerzo', type: 'LUNCH', start: ls, end: toTime(cur) })
      }
    }
    setConfigPreview(blocks)
  }, [scheduleConfig])

  useEffect(() => { computePreview() }, [computePreview])

  // Guardar configuración (scoped al shift seleccionado)
  const handleSaveConfig = async () => {
    setLoading(true)
    try {
      const res = await timetablingGeneratorApi.configureSchedule({ ...scheduleConfig, shiftId: selectedShiftId || undefined })
      if (res.data.success) {
        showMessage(`Configuración guardada: ${res.data.classBlocks} bloques de clase, ${res.data.startTime} a ${res.data.endTime}`, 'success')
        setConfigSaved(true)
        saveContext({ configSaved: true })
      } else {
        showMessage(res.data.error || 'Error al guardar configuración', 'error')
      }
    } catch (err: any) {
      showMessage(err.response?.data?.message || 'Error al guardar configuración', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Eliminar carga académica
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const handleDeleteTeachingLoad = async () => {
    if (!academicYearId) return
    setLoading(true)
    try {
      const res = await timetablingGeneratorApi.deleteTeachingLoad(academicYearId)
      showMessage(res.data.message || 'Carga eliminada', 'success')
      setTeachingLoad(null)
      setImportResult(null)
      setGenerateResult(null)
      setConfigSaved(false)
      setShowDeleteConfirm(false)
      setStep('load')
    } catch (err: any) {
      showMessage(err.response?.data?.message || 'Error al eliminar', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Descargar plantilla Excel
  const handleDownloadTemplate = async () => {
    if (!academicYearId) { showMessage('Seleccione un año académico', 'error'); return }
    setLoading(true)
    try {
      const res = await timetablingGeneratorApi.downloadTemplate(academicYearId)
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = 'plantilla-carga-academica.xlsx'
      link.click()
      window.URL.revokeObjectURL(url)
      showMessage('Plantilla descargada', 'success')
    } catch (err: any) {
      showMessage('Error al descargar plantilla', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Importar archivo Excel
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !academicYearId) return
    setLoading(true)
    setImportResult(null)
    try {
      const res = await timetablingGeneratorApi.importTeachingLoad(academicYearId, file)
      setImportResult(res.data)
      if (res.data.created > 0 || res.data.updated > 0) {
        showMessage(`Importación exitosa: ${res.data.created} creadas, ${res.data.updated} actualizadas`, 'success')
        loadTeachingLoad()
      }
    } catch (err: any) {
      showMessage(err.response?.data?.message || 'Error al importar archivo', 'error')
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  // Generar horario (scoped al shift seleccionado)
  const handleGenerate = async () => {
    if (!academicYearId) return
    setLoading(true)
    setGenerateResult(null)
    try {
      const res = await timetablingGeneratorApi.generateSchedule({
        academicYearId,
        shiftId: selectedShiftId || undefined,
        groupIds: selectedGroupIds.length > 0 ? selectedGroupIds : undefined,
        clearExisting: genOptions.clearExisting,
        respectAvailability: genOptions.respectAvailability,
        groupTeacherBlocks: genOptions.groupTeacherBlocks,
        activeDays: scheduleConfig.activeDays,
      })
      setGenerateResult(res.data)
      setStep('result')
      if (res.data.success) {
        showMessage(`Horario generado: ${res.data.placedHours} horas ubicadas`, 'success')
      } else {
        showMessage(`Horario parcial: ${res.data.placedHours} de ${res.data.placedHours + res.data.unplacedHours} horas`, 'error')
      }
      onScheduleGenerated()
    } catch (err: any) {
      showMessage(err.response?.data?.message || 'Error al generar horario', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Exportar horario a PDF
  const handleExportPdf = async (viewType: 'by-group' | 'by-teacher') => {
    if (!academicYearId) return
    setLoading(true)
    try {
      const res = await timetablingGeneratorApi.exportSchedulePdf(academicYearId, viewType)
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.download = viewType === 'by-teacher' ? 'horario-por-docente.pdf' : 'horario-por-grupo.pdf'
      link.click()
      window.URL.revokeObjectURL(url)
      showMessage('Horario exportado en PDF', 'success')
    } catch (err: any) {
      showMessage('Error al exportar PDF', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Exportar horario a Excel
  const handleExport = async (viewType: 'by-group' | 'by-teacher') => {
    if (!academicYearId) return
    setLoading(true)
    try {
      const res = await timetablingGeneratorApi.exportSchedule(academicYearId, viewType)
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = viewType === 'by-teacher' ? 'horario-por-docente.xlsx' : 'horario-por-grupo.xlsx'
      link.click()
      window.URL.revokeObjectURL(url)
      showMessage('Horario exportado', 'success')
    } catch (err: any) {
      showMessage('Error al exportar', 'error')
    } finally {
      setLoading(false)
    }
  }

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds(prev =>
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    )
  }

  return (
    <div className="space-y-6">
      {/* ═══ SHIFT SELECTOR ═══ */}
      <div className="bg-white border rounded-xl p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Building2 className="w-4 h-4 text-indigo-600" />
            Jornada:
          </div>
          {shiftsLoading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500" />
          ) : shifts.length === 0 ? (
            <span className="text-sm text-gray-400">No hay jornadas. Importe la carga académica primero.</span>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {shifts.map(s => (
                <button key={s.id} onClick={() => {
                  if (s.id !== selectedShiftId) {
                    setSelectedShiftId(s.id); setStep('load'); setTeachingLoad(null)
                    setImportResult(null); setGenerateResult(null); setConfigSaved(false); setContextLoaded(false)
                  }
                }} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedShiftId === s.id ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {s.name} <span className="ml-1 text-xs opacity-75">({s.groupCount} grupos)</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {selectedShift && <p className="text-xs text-gray-400 mt-2">Sede: {selectedShift.campusName} · {selectedShift.timeBlockCount} bloques configurados</p>}
      </div>

      {!selectedShiftId && shifts.length > 0 && (
        <div className="text-center py-12 text-gray-500">
          <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Seleccione una jornada para continuar</p>
          <p className="text-xs mt-1">Cada jornada tiene su propia configuración de horarios</p>
        </div>
      )}

      {selectedShiftId && (<>
      {/* Step indicators — 4 steps */}
      <div className="flex items-center gap-2 text-sm flex-wrap">
        {[
          { key: 'load', label: '1. Carga', icon: FileSpreadsheet },
          { key: 'configure', label: '2. Configurar', icon: Settings },
          { key: 'generate', label: '3. Generar', icon: Wand2 },
          { key: 'result', label: '4. Resultado', icon: CheckCircle2 },
        ].map((s, i) => {
          const Icon = s.icon
          const isActive = step === s.key
          const stepOrder = ['load', 'configure', 'generate', 'result']
          const currentIdx = stepOrder.indexOf(step)
          const isPast = currentIdx > i
          const canReach = (key: string) => {
            if (key === 'load') return true
            if (key === 'configure') return !!teachingLoad
            if (key === 'generate') return teachingLoad?.assignments?.length > 0 && configSaved
            if (key === 'result') return !!generateResult
            return false
          }
          const isReachable = canReach(s.key)
          return (
            <button
              key={s.key}
              onClick={() => { if (isReachable) setStep(s.key as any) }}
              disabled={!isReachable}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
                isActive ? 'bg-indigo-100 text-indigo-700 font-medium'
                : isPast && isReachable ? 'bg-green-50 text-green-700 cursor-pointer'
                : isReachable ? 'bg-gray-100 text-gray-600 cursor-pointer hover:bg-gray-200'
                : 'bg-gray-50 text-gray-300 cursor-not-allowed'
              }`}
            >
              <Icon className="w-4 h-4" />
              {s.label}
              {i < 3 && <ChevronDown className="w-3 h-3 -rotate-90 ml-1" />}
            </button>
          )
        })}
      </div>

      {/* PASO 1: Carga Académica */}
      {step === 'load' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
              Carga Académica (Docente → Materia → Grupo → Horas)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Descargar plantilla */}
              <button
                onClick={handleDownloadTemplate}
                disabled={loading}
                className="flex items-center gap-3 p-4 border-2 border-dashed border-indigo-300 rounded-xl hover:bg-indigo-50 transition-colors group"
              >
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-200">
                  <Download className="w-6 h-6 text-indigo-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-800">Descargar Plantilla</p>
                  <p className="text-xs text-gray-500">Excel con formato para la carga académica</p>
                </div>
              </button>

              {/* Importar archivo */}
              <label className="flex items-center gap-3 p-4 border-2 border-dashed border-green-300 rounded-xl hover:bg-green-50 transition-colors cursor-pointer group">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200">
                  <Upload className="w-6 h-6 text-green-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-800">Importar Excel</p>
                  <p className="text-xs text-gray-500">Subir archivo con la carga académica</p>
                </div>
                <input type="file" accept=".xlsx,.xls" onChange={handleImportFile} className="hidden" />
              </label>
            </div>

            {/* Resultado de importación */}
            {importResult && (
              <div className={`mt-4 p-4 rounded-lg border ${importResult.errors?.length > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
                <div className="flex items-center gap-4 text-sm flex-wrap">
                  <span className="font-medium">{importResult.totalRows} filas</span>
                  <span className="text-green-700">{importResult.created} asignaciones creadas</span>
                  <span className="text-blue-700">{importResult.updated} actualizadas</span>
                  <span className="text-gray-500">{importResult.skipped} omitidas</span>
                </div>
                {importResult.entitiesCreated && (
                  <div className="mt-2 flex items-center gap-3 text-xs flex-wrap">
                    <span className="font-medium text-gray-600">Auto-creados:</span>
                    {importResult.entitiesCreated.teachers > 0 && (
                      <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">{importResult.entitiesCreated.teachers} docentes</span>
                    )}
                    {importResult.entitiesCreated.areas > 0 && (
                      <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{importResult.entitiesCreated.areas} áreas</span>
                    )}
                    {importResult.entitiesCreated.subjects > 0 && (
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{importResult.entitiesCreated.subjects} asignaturas</span>
                    )}
                    {importResult.entitiesCreated.grades > 0 && (
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">{importResult.entitiesCreated.grades} grados</span>
                    )}
                    {importResult.entitiesCreated.groups > 0 && (
                      <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">{importResult.entitiesCreated.groups} grupos</span>
                    )}
                    {Object.values(importResult.entitiesCreated || {}).every((v: any) => v === 0) && (
                      <span className="text-gray-400">Ninguna entidad nueva</span>
                    )}
                  </div>
                )}
                {importResult.warnings?.length > 0 && (
                  <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
                    {importResult.warnings.slice(0, 10).map((w: string, i: number) => (
                      <p key={i} className="text-xs text-yellow-700 flex items-start gap-1">
                        <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {w}
                      </p>
                    ))}
                    {importResult.warnings.length > 10 && (
                      <p className="text-xs text-yellow-600">...y {importResult.warnings.length - 10} más</p>
                    )}
                  </div>
                )}
                {importResult.errors?.length > 0 && (
                  <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
                    {importResult.errors.map((e: string, i: number) => (
                      <p key={i} className="text-xs text-red-600 flex items-start gap-1">
                        <XCircle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {e}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Resumen de carga actual */}
          {teachingLoad && (
            <div className="bg-white border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Carga Académica Actual</h3>
                <div className="flex items-center gap-2">
                  <button onClick={loadTeachingLoad} className="text-gray-400 hover:text-gray-600" title="Refrescar">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                  <button onClick={() => setShowDeleteConfirm(true)} className="text-red-400 hover:text-red-600" title="Eliminar carga">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {showDeleteConfirm && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800 font-medium mb-2">¿Eliminar toda la carga académica?</p>
                  <p className="text-xs text-red-600 mb-3">Se eliminarán todas las asignaciones docente-materia-grupo y las entradas de horario asociadas. Esta acción no se puede deshacer.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDeleteTeachingLoad}
                      disabled={loading}
                      className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      {loading ? 'Eliminando...' : 'Sí, eliminar todo'}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-700">{teachingLoad.summary?.totalAssignments || 0}</div>
                  <div className="text-xs text-blue-600">Asignaciones</div>
                </div>
                <div className="bg-indigo-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-indigo-700">{teachingLoad.summary?.uniqueTeachers || 0}</div>
                  <div className="text-xs text-indigo-600">Docentes</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-purple-700">{teachingLoad.summary?.uniqueGroups || 0}</div>
                  <div className="text-xs text-purple-600">Grupos</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-700">{teachingLoad.summary?.totalWeeklyHours || 0}</div>
                  <div className="text-xs text-green-600">Horas/semana</div>
                </div>
              </div>

              {teachingLoad.assignments?.length > 0 && (
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Docente</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Materia</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Grupo</th>
                        <th className="text-center px-3 py-2 text-xs font-medium text-gray-500">Horas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {teachingLoad.assignments.map((a: any) => (
                        <tr key={a.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-700">{a.teacherName}</td>
                          <td className="px-3 py-2 text-gray-700">{a.subjectName}</td>
                          <td className="px-3 py-2">
                            <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs font-medium">{a.groupName}</span>
                          </td>
                          <td className="px-3 py-2 text-center font-medium">{a.weeklyHours}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <button
                onClick={() => setStep('configure')}
                className="mt-4 w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
              >
                <Settings className="w-5 h-5" />
                Continuar a Configurar Horario
              </button>
            </div>
          )}
        </div>
      )}

      {/* PASO 2: Configurar Parámetros */}
      {step === 'configure' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-600" />
              Configurar Jornada Escolar
            </h3>
            <p className="text-sm text-gray-500 mb-6">Defina los parámetros de la jornada. Los bloques de tiempo se generarán automáticamente.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left column: parameters */}
              <div className="space-y-4">
                {/* Días activos */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Días de clase</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: 'MONDAY', label: 'Lun' },
                      { key: 'TUESDAY', label: 'Mar' },
                      { key: 'WEDNESDAY', label: 'Mié' },
                      { key: 'THURSDAY', label: 'Jue' },
                      { key: 'FRIDAY', label: 'Vie' },
                      { key: 'SATURDAY', label: 'Sáb' },
                    ].map(d => (
                      <button
                        key={d.key}
                        onClick={() => {
                          setScheduleConfig(prev => ({
                            ...prev,
                            activeDays: prev.activeDays.includes(d.key)
                              ? prev.activeDays.filter(x => x !== d.key)
                              : [...prev.activeDays, d.key],
                          }))
                          setConfigSaved(false)
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          scheduleConfig.activeDays.includes(d.key)
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hora de inicio */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora de inicio de la jornada</label>
                  <input
                    type="time"
                    value={scheduleConfig.startTime}
                    onChange={e => { setScheduleConfig(prev => ({ ...prev, startTime: e.target.value })); setConfigSaved(false) }}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                {/* Clases por día y duración */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Clases por día</label>
                    <input
                      type="number" min={1} max={12}
                      value={scheduleConfig.classesPerDay}
                      onChange={e => { setScheduleConfig(prev => ({ ...prev, classesPerDay: Number(e.target.value) })); setConfigSaved(false) }}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Duración clase (min)</label>
                    <input
                      type="number" min={20} max={120} step={5}
                      value={scheduleConfig.classDuration}
                      onChange={e => { setScheduleConfig(prev => ({ ...prev, classDuration: Number(e.target.value) })); setConfigSaved(false) }}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                {/* Recesos */}
                <div className="bg-amber-50 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-medium text-amber-800">Recesos</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Duración receso (min)</label>
                      <input
                        type="number" min={5} max={30} step={5}
                        value={scheduleConfig.breakDuration}
                        onChange={e => { setScheduleConfig(prev => ({ ...prev, breakDuration: Number(e.target.value) })); setConfigSaved(false) }}
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">1er receso después de clase #</label>
                      <input
                        type="number" min={1} max={scheduleConfig.classesPerDay}
                        value={scheduleConfig.breakAfterBlock}
                        onChange={e => { setScheduleConfig(prev => ({ ...prev, breakAfterBlock: Number(e.target.value) })); setConfigSaved(false) }}
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">2do receso después de clase # (0 = sin 2do receso)</label>
                    <input
                      type="number" min={0} max={scheduleConfig.classesPerDay}
                      value={scheduleConfig.secondBreakAfterBlock || 0}
                      onChange={e => { setScheduleConfig(prev => ({ ...prev, secondBreakAfterBlock: Number(e.target.value) || 0 })); setConfigSaved(false) }}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                {/* Tutoría */}
                <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scheduleConfig.includeTutoring}
                      onChange={e => { setScheduleConfig(prev => ({ ...prev, includeTutoring: e.target.checked })); setConfigSaved(false) }}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm font-medium text-blue-800">Incluir tutoría (primera hora)</span>
                  </label>
                  {scheduleConfig.includeTutoring && (
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Duración tutoría (min)</label>
                      <input
                        type="number" min={15} max={120} step={5}
                        value={scheduleConfig.tutoringDuration}
                        onChange={e => { setScheduleConfig(prev => ({ ...prev, tutoringDuration: Number(e.target.value) })); setConfigSaved(false) }}
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  )}
                </div>

                {/* Almuerzo */}
                <div className="bg-green-50 rounded-lg p-4 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scheduleConfig.includeLunch}
                      onChange={e => { setScheduleConfig(prev => ({ ...prev, includeLunch: e.target.checked })); setConfigSaved(false) }}
                      className="w-4 h-4 text-green-600 rounded"
                    />
                    <span className="text-sm font-medium text-green-800">Incluir almuerzo</span>
                  </label>
                  {scheduleConfig.includeLunch && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Duración almuerzo (min)</label>
                        <input
                          type="number" min={15} max={60} step={5}
                          value={scheduleConfig.lunchDuration}
                          onChange={e => { setScheduleConfig(prev => ({ ...prev, lunchDuration: Number(e.target.value) })); setConfigSaved(false) }}
                          className="w-full border rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Almuerzo después de clase #</label>
                        <input
                          type="number" min={1} max={scheduleConfig.classesPerDay}
                          value={scheduleConfig.lunchAfterBlock}
                          onChange={e => { setScheduleConfig(prev => ({ ...prev, lunchAfterBlock: Number(e.target.value) })); setConfigSaved(false) }}
                          className="w-full border rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right column: live preview */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Vista previa de la jornada</p>
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-indigo-600 text-white text-xs font-medium px-3 py-2 flex justify-between">
                    <span>Bloque</span>
                    <span>Horario</span>
                  </div>
                  <div className="divide-y max-h-[400px] overflow-y-auto">
                    {configPreview.map((b, i) => (
                      <div
                        key={i}
                        className={`flex items-center justify-between px-3 py-2.5 text-sm ${
                          b.type === 'BREAK' ? 'bg-amber-50 text-amber-700'
                          : b.type === 'LUNCH' ? 'bg-green-50 text-green-700'
                          : 'bg-white text-gray-800'
                        }`}
                      >
                        <span className="font-medium">{b.label}</span>
                        <span className="text-xs text-gray-500">{b.start} — {b.end}</span>
                      </div>
                    ))}
                  </div>
                  {configPreview.length > 0 && (
                    <div className="bg-gray-50 px-3 py-2 text-xs text-gray-500 flex justify-between">
                      <span>{configPreview.filter(b => b.type === 'CLASS').length} clases · {scheduleConfig.activeDays.length} días</span>
                      <span>Termina: {configPreview[configPreview.length - 1]?.end}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Save button */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleSaveConfig}
                disabled={loading}
                className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <><RefreshCw className="w-5 h-5 animate-spin" /> Guardando...</>
                ) : (
                  <><Save className="w-5 h-5" /> Guardar Configuración</>
                )}
              </button>
              {configSaved && (
                <button
                  onClick={() => setStep('generate')}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Wand2 className="w-5 h-5" /> Continuar a Generar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PASO 4: Generar */}
      {step === 'generate' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-indigo-600" />
              Generar Horario Automáticamente
            </h3>

            {/* Opciones */}
            <div className="space-y-3 mb-6">
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                <input
                  type="checkbox"
                  checked={genOptions.clearExisting}
                  onChange={e => setGenOptions(prev => ({ ...prev, clearExisting: e.target.checked }))}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <div>
                  <p className="font-medium text-sm text-gray-800">Limpiar horario existente</p>
                  <p className="text-xs text-gray-500">Elimina las entradas actuales antes de generar</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                <input
                  type="checkbox"
                  checked={genOptions.respectAvailability}
                  onChange={e => setGenOptions(prev => ({ ...prev, respectAvailability: e.target.checked }))}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <div>
                  <p className="font-medium text-sm text-gray-800">Respetar disponibilidad docente</p>
                  <p className="text-xs text-gray-500">No asignar docentes en horarios donde no están disponibles</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                <input
                  type="checkbox"
                  checked={genOptions.groupTeacherBlocks}
                  onChange={e => setGenOptions(prev => ({ ...prev, groupTeacherBlocks: e.target.checked }))}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <div>
                  <p className="font-medium text-sm text-gray-800">Agrupar bloques de docentes</p>
                  <p className="text-xs text-gray-500">Prefiere colocar las clases de un docente en horas consecutivas del mismo día</p>
                </div>
              </label>
            </div>

            {/* Selección de grupos (opcional) */}
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Grupos a incluir <span className="text-gray-400 font-normal">(vacío = todos)</span>
              </p>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {allGroups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => toggleGroup(g.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      selectedGroupIds.includes(g.id)
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl font-semibold text-lg hover:from-indigo-700 hover:to-purple-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? (
                <><RefreshCw className="w-6 h-6 animate-spin" /> Generando horario...</>
              ) : (
                <><Wand2 className="w-6 h-6" /> Generar Horario Automáticamente</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* PASO 4: Resultado */}
      {step === 'result' && generateResult && (
        <div className="space-y-4">
          <div className={`bg-white border-2 rounded-xl p-6 ${generateResult.success ? 'border-green-300' : 'border-yellow-300'}`}>
            <div className="flex items-center gap-3 mb-4">
              {generateResult.success
                ? <CheckCircle2 className="w-8 h-8 text-green-500" />
                : <AlertTriangle className="w-8 h-8 text-yellow-500" />
              }
              <div>
                <h3 className="text-lg font-semibold text-gray-800">
                  {generateResult.success ? '¡Horario generado exitosamente!' : 'Horario generado con advertencias'}
                </h3>
                <p className="text-sm text-gray-500">
                  {generateResult.placedHours} de {generateResult.placedHours + generateResult.unplacedHours} horas ubicadas
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-700">{generateResult.placedHours}</div>
                <div className="text-xs text-green-600">Horas ubicadas</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-700">{generateResult.unplacedHours}</div>
                <div className="text-xs text-red-600">Horas sin ubicar</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-700">{generateResult.totalAssignments}</div>
                <div className="text-xs text-blue-600">Asignaciones</div>
              </div>
            </div>

            {/* Conflicts */}
            {generateResult.conflicts?.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Notas:</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {generateResult.conflicts.map((c: string, i: number) => (
                    <p key={i} className="text-xs text-yellow-700 bg-yellow-50 px-3 py-1.5 rounded flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {c}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Details per group */}
            {generateResult.details?.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Detalle por grupo:</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {generateResult.details.map((d: any) => (
                    <div key={d.groupId} className={`p-3 rounded-lg border text-sm ${
                      d.hoursUnplaced === 0 ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
                    }`}>
                      <div className="font-medium">{d.groupName}</div>
                      <div className="text-xs text-gray-600">{d.hoursPlaced}/{d.totalHoursNeeded} horas</div>
                      {d.unplacedSubjects?.length > 0 && (
                        <div className="mt-1">
                          {d.unplacedSubjects.map((s: any, i: number) => (
                            <p key={i} className="text-xs text-red-600">{s.subjectName}: {s.hoursPlaced}/{s.hoursNeeded}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Export buttons */}
          <div className="bg-white border rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Download className="w-5 h-5 text-green-600" />
              Exportar Horario
            </h3>
            <p className="text-sm text-gray-500 mb-3">PDF listo para imprimir — una página por grupo o por docente</p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <button
                onClick={() => handleExportPdf('by-group')}
                disabled={loading}
                className="flex items-center gap-3 p-4 border-2 border-green-300 rounded-xl hover:bg-green-50 transition-colors"
              >
                <Users className="w-8 h-8 text-green-600" />
                <div className="text-left">
                  <p className="font-medium text-gray-800">PDF por Grupo</p>
                  <p className="text-xs text-gray-500">Una página por grupo — para pegar en el salón</p>
                </div>
              </button>
              <button
                onClick={() => handleExportPdf('by-teacher')}
                disabled={loading}
                className="flex items-center gap-3 p-4 border-2 border-blue-300 rounded-xl hover:bg-blue-50 transition-colors"
              >
                <Building2 className="w-8 h-8 text-blue-600" />
                <div className="text-left">
                  <p className="font-medium text-gray-800">PDF por Docente</p>
                  <p className="text-xs text-gray-500">Una página por docente</p>
                </div>
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={() => handleExport('by-group')} disabled={loading} className="text-xs text-gray-400 hover:text-gray-600 underline">
                Excel por grupo
              </button>
              <button onClick={() => handleExport('by-teacher')} disabled={loading} className="text-xs text-gray-400 hover:text-gray-600 underline">
                Excel por docente
              </button>
            </div>
          </div>

          <button
            onClick={() => setStep('generate')}
            className="w-full border-2 border-indigo-300 text-indigo-700 py-3 rounded-lg font-medium hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Volver a Generar
          </button>
        </div>
      )}

      </>)}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// SCHEDULE VIEWER TAB - Múltiples vistas del horario
// ═══════════════════════════════════════════════════════

const VIEW_MODES = [
  { key: 'total', label: 'Vista Total', icon: Grid3X3 },
  { key: 'by-grade', label: 'Por Grado', icon: Layers },
  { key: 'by-day', label: 'Por Día', icon: CalendarDays },
  { key: 'by-teacher', label: 'Por Docente', icon: Users },
  { key: 'by-subject', label: 'Por Asignatura', icon: Calendar },
  { key: 'by-area', label: 'Por Área/Depto', icon: Building2 },
] as const

function ScheduleViewerTab({ academicYearId, isManager, user, userCaps }: { academicYearId: string; isManager?: boolean; user?: any; userCaps?: any }) {
  // Para docentes: solo mostrar su grupo de tutoría (no todos los que enseña)
  // null = sin restricción (managers); Set vacío = esperar carga; Set con ids = filtro activo
  const allowedGroupIds = !isManager
    ? (userCaps ? new Set<string>(userCaps.tutorGroupIds || []) : new Set<string>())
    : null

  const defaultView = isManager ? 'by-grade' : 'by-teacher'
  const [viewMode, setViewMode] = useState<'total' | 'by-grade' | 'by-day' | 'by-teacher' | 'by-subject' | 'by-area'>(defaultView)
  const [viewData, setViewData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState<string>('')
  const [selectedDay, setSelectedDay] = useState<string>('MONDAY')
  const [movingEntry, setMovingEntry] = useState<any>(null)
  const [exporting, setExporting] = useState(false)

  // Provisional daily schedule
  const [provisionalMode, setProvisionalMode] = useState(false)
  const [provisionalDate, setProvisionalDate] = useState<string>(() => {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  })
  const [provisionalEdits, setProvisionalEdits] = useState<Map<string, any>>(new Map())
  const [provisionalSelected, setProvisionalSelected] = useState<{ groupId: string; blockId: string } | null>(null)
  const [provisionalNotes, setProvisionalNotes] = useState('')

  const loadView = async (mode?: string) => {
    if (!academicYearId) return
    setLoading(true)
    try {
      // Para 'by-day' usamos los datos de 'by-grade' y filtramos en el frontend
      const backendView = (mode || viewMode) === 'by-day' ? 'by-grade' : (mode || viewMode)
      const res = await timetablingGeneratorApi.getScheduleViews(
        academicYearId,
        backendView as any,
        selectedFilter || undefined,
      )
      setViewData(res.data)
    } catch (err: any) {
      console.error('Error loading view:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadView()
  }, [academicYearId, viewMode])

  const handleViewChange = (mode: string) => {
    setViewMode(mode as any)
    setSelectedFilter('')
    setMovingEntry(null)
  }

  // Get day of week from a date string
  const getDayOfWeekFromDate = (dateStr: string): string => {
    const date = new Date(dateStr + 'T12:00:00')
    const dayMap: Record<number, string> = { 0: 'SUNDAY', 1: 'MONDAY', 2: 'TUESDAY', 3: 'WEDNESDAY', 4: 'THURSDAY', 5: 'FRIDAY', 6: 'SATURDAY' }
    return dayMap[date.getDay()] || 'MONDAY'
  }

  // Toggle provisional mode
  const toggleProvisionalMode = () => {
    if (!provisionalMode) {
      const dayKey = getDayOfWeekFromDate(provisionalDate)
      setSelectedDay(dayKey)
      setProvisionalEdits(new Map())
      setProvisionalSelected(null)
      setProvisionalNotes('')
    }
    setProvisionalMode(!provisionalMode)
  }

  // Handle provisional date change
  const handleProvisionalDateChange = (dateStr: string) => {
    setProvisionalDate(dateStr)
    const dayKey = getDayOfWeekFromDate(dateStr)
    setSelectedDay(dayKey)
    setProvisionalEdits(new Map())
    setProvisionalSelected(null)
  }

  // Handle click on entry in provisional mode (for swapping)
  const handleProvisionalClick = (groupId: string, blockId: string, entry: any) => {
    if (!provisionalMode) return
    const key = `${groupId}::${blockId}`
    if (!provisionalSelected) {
      setProvisionalSelected({ groupId, blockId })
    } else {
      const sourceKey = `${provisionalSelected.groupId}::${provisionalSelected.blockId}`
      if (sourceKey === key) {
        setProvisionalSelected(null)
        return
      }
      // Swap the two entries
      const newEdits = new Map(provisionalEdits)
      const sourceEntry = newEdits.get(sourceKey) !== undefined ? newEdits.get(sourceKey) : null // will resolve later
      const targetEntry = newEdits.get(key) !== undefined ? newEdits.get(key) : null
      newEdits.set(sourceKey, { ...entry, _swapped: true })
      newEdits.set(key, { ...getResolvedEntry(provisionalSelected.groupId, provisionalSelected.blockId), _swapped: true })
      setProvisionalEdits(newEdits)
      setProvisionalSelected(null)
    }
  }

  // Cancel an entry in provisional mode
  const handleProvisionalCancel = (groupId: string, blockId: string) => {
    const key = `${groupId}::${blockId}`
    const newEdits = new Map(provisionalEdits)
    newEdits.set(key, { _cancelled: true })
    setProvisionalEdits(newEdits)
    setProvisionalSelected(null)
  }

  // Restore an entry in provisional mode
  const handleProvisionalRestore = (groupId: string, blockId: string) => {
    const key = `${groupId}::${blockId}`
    const newEdits = new Map(provisionalEdits)
    newEdits.delete(key)
    setProvisionalEdits(newEdits)
  }

  // Get resolved entry (original or edited)
  const getResolvedEntry = (groupId: string, blockId: string): any => {
    const key = `${groupId}::${blockId}`
    if (provisionalEdits.has(key)) return provisionalEdits.get(key)
    return null // will be resolved in render
  }

  // Print daily schedule
  const handlePrintDay = () => {
    if (!viewData) return
    const allGroups: any[] = []
    for (const grade of (viewData.grades || [])) {
      for (const group of (grade.groups || [])) {
        const dayEntries = (group.entries || []).filter((e: any) => e.dayOfWeek === selectedDay)
        allGroups.push({ groupId: group.groupId, groupName: group.groupName, gradeName: grade.gradeName, entries: dayEntries })
      }
    }
    const blocksMap = new Map<string, any>()
    for (const g of allGroups) {
      for (const e of g.entries) {
        if (e.timeBlock && !blocksMap.has(e.timeBlock.id)) blocksMap.set(e.timeBlock.id, e.timeBlock)
      }
    }
    for (const tb of (viewData.allTimeBlocks || [])) {
      if (!blocksMap.has(tb.id) && tb.type !== 'CLASS' && tb.type !== 'FREE') blocksMap.set(tb.id, tb)
    }
    const sortedBlocks = Array.from(blocksMap.values()).sort((a: any, b: any) => a.order - b.order)
    const dayLabel = DAYS.find(d => d.key === selectedDay)?.label || selectedDay
    const dateStr = provisionalMode ? new Date(provisionalDate + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : dayLabel

    const rows = sortedBlocks.map(block => {
      const isBreak = block.type === 'BREAK' || block.type === 'LUNCH'
      const isTutoring = block.type === 'TUTORING'
      const isAssembly = block.type === 'ASSEMBLY'
      const isSpecial = isBreak || isTutoring || isAssembly
      const specialLabel = isBreak ? 'Receso' : isTutoring ? (block.label || 'Tutoría') : isAssembly ? (block.label || 'Formación') : ''
      const specialColor = isBreak ? '#94a3b8' : isTutoring ? '#4f46e5' : '#7c3aed'
      const specialBg = isBreak ? '' : isTutoring ? 'background:#eef2ff;' : 'background:#f5f3ff;'
      const cells = allGroups.map(g => {
        if (isSpecial) return `<td style="text-align:center;color:${specialColor};font-weight:${isBreak ? 'normal' : '600'};font-style:${isBreak ? 'italic' : 'normal'};border:1px solid #e2e8f0;padding:4px;${specialBg}">${specialLabel}</td>`
        const key = `${g.groupId}::${block.id}`
        const edit = provisionalEdits.get(key)
        if (edit?._cancelled) return '<td style="text-align:center;color:#ef4444;border:1px solid #e2e8f0;padding:4px;background:#fef2f2;"><s>Cancelada</s></td>'
        const entry = edit?._swapped ? edit : g.entries.find((e: any) => e.timeBlock?.id === block.id)
        if (!entry || (!entry.subjectName && !entry.projectName)) return '<td style="border:1px solid #e2e8f0;padding:4px;"></td>'
        const bg = edit?._swapped ? 'background:#fef3c7;' : ''
        return `<td style="text-align:center;border:1px solid #e2e8f0;padding:4px;${bg}"><strong style="font-size:11px;">${entry.subjectName || entry.projectName || ''}</strong><br/><span style="font-size:10px;color:#64748b;">${entry.teacherName || ''}</span></td>`
      }).join('')
      return `<tr${isBreak ? ' style="background:#f8fafc;"' : ''}><td style="padding:4px 8px;border:1px solid #e2e8f0;font-weight:600;font-size:11px;white-space:nowrap;">${block.label || 'B' + block.order}<br/><span style="font-size:10px;color:#94a3b8;font-weight:normal;">${block.startTime}-${block.endTime}</span></td>${cells}</tr>`
    }).join('')

    const headers = allGroups.map(g => `<th style="padding:6px 4px;border:1px solid #e2e8f0;font-size:11px;background:#4f46e5;color:white;text-align:center;">${g.groupName}</th>`).join('')

    const printHTML = `<html><head><title>Horario ${dateStr}</title><style>@media print{@page{size:landscape;margin:1cm;}}body{font-family:Arial,sans-serif;font-size:12px;margin:20px;}table{border-collapse:collapse;width:100%;}h2{color:#1e293b;margin-bottom:4px;}p{color:#64748b;margin-top:0;}</style></head><body>
      <h2>${provisionalMode ? '📋 HORARIO PROVISIONAL' : 'Horario del Día'}</h2>
      <p>${dateStr}${provisionalMode && provisionalNotes ? ' — ' + provisionalNotes : ''}</p>
      ${provisionalMode ? '<p style="color:#f59e0b;font-weight:bold;font-size:11px;">⚠️ Este horario es provisional y puede cambiar.</p>' : ''}
      <table><thead><tr><th style="padding:6px 8px;border:1px solid #e2e8f0;background:#4f46e5;color:white;text-align:left;font-size:11px;">Hora</th>${headers}</tr></thead><tbody>${rows}</tbody></table>
      <p style="margin-top:16px;font-size:10px;color:#94a3b8;">Generado por Edusyn — ${new Date().toLocaleString('es-CO')}</p>
    </body></html>`

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(printHTML)
      printWindow.document.close()
      printWindow.print()
    }
  }

  // Print daily schedule BY COURSE (one table per group)
  const handlePrintDayByCourse = () => {
    if (!viewData) return
    const allGroups: any[] = []
    for (const grade of (viewData.grades || [])) {
      for (const group of (grade.groups || [])) {
        const dayEntries = (group.entries || []).filter((e: any) => e.dayOfWeek === selectedDay)
        allGroups.push({ groupId: group.groupId, groupName: group.groupName, gradeName: grade.gradeName, entries: dayEntries })
      }
    }
    const blocksMap = new Map<string, any>()
    for (const g of allGroups) for (const e of g.entries) if (e.timeBlock && !blocksMap.has(e.timeBlock.id)) blocksMap.set(e.timeBlock.id, e.timeBlock)
    for (const tb of (viewData.allTimeBlocks || [])) if (!blocksMap.has(tb.id) && tb.type !== 'CLASS' && tb.type !== 'FREE') blocksMap.set(tb.id, tb)
    const sortedBlocks = Array.from(blocksMap.values()).sort((a: any, b: any) => a.order - b.order)
    const dayLabel = DAYS.find(d => d.key === selectedDay)?.label || selectedDay
    const dateStr = provisionalMode ? new Date(provisionalDate + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : dayLabel

    const groupTables = allGroups.map(g => {
      const rows = sortedBlocks.map(block => {
        const isBreak = block.type === 'BREAK' || block.type === 'LUNCH'
        const isTutoring = block.type === 'TUTORING'
        const isAssembly = block.type === 'ASSEMBLY'
        const cellKey = `${g.groupId}::${block.id}`
        const edit = provisionalEdits.get(cellKey)
        const originalEntry = g.entries.find((e: any) => e.timeBlock?.id === block.id)
        let cellContent = ''
        if (isBreak) {
          cellContent = `<td style="text-align:center;color:#94a3b8;font-style:italic;padding:6px;border:1px solid #e2e8f0;" colspan="2">Receso</td>`
        } else if (isTutoring) {
          cellContent = `<td style="text-align:center;color:#4f46e5;font-weight:600;padding:6px;border:1px solid #e2e8f0;background:#eef2ff;" colspan="2">${block.label || 'Tutoría'}</td>`
        } else if (isAssembly) {
          cellContent = `<td style="text-align:center;color:#7c3aed;font-weight:600;padding:6px;border:1px solid #e2e8f0;background:#f5f3ff;" colspan="2">${block.label || 'Formación'}</td>`
        } else if (edit?._cancelled) {
          cellContent = `<td style="color:#ef4444;background:#fef2f2;padding:6px;border:1px solid #e2e8f0;"><s>${originalEntry?.subjectName || ''}</s></td><td style="color:#ef4444;background:#fef2f2;padding:6px;border:1px solid #e2e8f0;">Cancelada</td>`
        } else {
          const entry = edit?._swapped ? edit : originalEntry
          const bg = edit?._swapped ? 'background:#fef3c7;' : ''
          cellContent = entry
            ? `<td style="padding:6px;border:1px solid #e2e8f0;font-weight:600;${bg}">${entry.subjectName || ''}</td><td style="padding:6px;border:1px solid #e2e8f0;${bg}">${entry.teacherName || ''}</td>`
            : `<td style="padding:6px;border:1px solid #e2e8f0;"></td><td style="padding:6px;border:1px solid #e2e8f0;"></td>`
        }
        return `<tr><td style="padding:6px 8px;border:1px solid #e2e8f0;font-weight:600;font-size:12px;white-space:nowrap;">${block.label || 'B' + block.order}<br/><span style="font-size:10px;color:#94a3b8;font-weight:normal;">${block.startTime}-${block.endTime}</span></td>${cellContent}</tr>`
      }).join('')
      return `<div style="page-break-inside:avoid;margin-bottom:24px;"><h3 style="margin:0 0 8px;color:#1e293b;">${g.groupName} <span style="font-weight:normal;color:#64748b;font-size:14px;">(${g.gradeName})</span></h3><table style="border-collapse:collapse;width:100%;font-size:12px;"><thead><tr style="background:#4f46e5;color:white;"><th style="padding:6px 8px;border:1px solid #e2e8f0;text-align:left;">Hora</th><th style="padding:6px;border:1px solid #e2e8f0;text-align:left;">Asignatura</th><th style="padding:6px;border:1px solid #e2e8f0;text-align:left;">Docente</th></tr></thead><tbody>${rows}</tbody></table></div>`
    }).join('')

    const printHTML = `<html><head><title>Horario por Curso - ${dateStr}</title><style>@media print{@page{size:portrait;margin:1cm;}}body{font-family:Arial,sans-serif;margin:20px;}h2{color:#1e293b;margin-bottom:4px;}p{color:#64748b;margin-top:0;}</style></head><body>
      <h2>${provisionalMode ? '📋 HORARIO PROVISIONAL POR CURSO' : 'Horario por Curso'}</h2>
      <p>${dateStr}${provisionalMode && provisionalNotes ? ' — ' + provisionalNotes : ''}</p>
      ${provisionalMode ? '<p style="color:#f59e0b;font-weight:bold;font-size:11px;">⚠️ Este horario es provisional.</p>' : ''}
      ${groupTables}
      <p style="margin-top:16px;font-size:10px;color:#94a3b8;">Generado por Edusyn — ${new Date().toLocaleString('es-CO')}</p>
    </body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(printHTML); w.document.close(); w.print() }
  }

  // Print daily schedule BY TEACHER
  const handlePrintDayByTeacher = () => {
    if (!viewData) return
    const teacherMap = new Map<string, { name: string; entries: { groupName: string; gradeName: string; block: any; entry: any; edited?: boolean; cancelled?: boolean }[] }>()

    for (const grade of (viewData.grades || [])) {
      for (const group of (grade.groups || [])) {
        const dayEntries = (group.entries || []).filter((e: any) => e.dayOfWeek === selectedDay)
        for (const entry of dayEntries) {
          if (!entry.teacherName) continue
          const cellKey = `${group.groupId}::${entry.timeBlock?.id}`
          const edit = provisionalEdits.get(cellKey)
          if (edit?._cancelled) {
            const teacherKey = entry.teacherName
            if (!teacherMap.has(teacherKey)) teacherMap.set(teacherKey, { name: entry.teacherName, entries: [] })
            teacherMap.get(teacherKey)!.entries.push({ groupName: group.groupName, gradeName: grade.gradeName, block: entry.timeBlock, entry, cancelled: true })
            continue
          }
          const displayEntry = edit?._swapped ? edit : entry
          const teacherKey = displayEntry.teacherName || entry.teacherName
          if (!teacherMap.has(teacherKey)) teacherMap.set(teacherKey, { name: teacherKey, entries: [] })
          teacherMap.get(teacherKey)!.entries.push({ groupName: group.groupName, gradeName: grade.gradeName, block: entry.timeBlock, entry: displayEntry, edited: !!edit?._swapped })
        }
      }
    }

    const dayLabel = DAYS.find(d => d.key === selectedDay)?.label || selectedDay
    const dateStr = provisionalMode ? new Date(provisionalDate + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : dayLabel

    const sortedTeachers = Array.from(teacherMap.values()).sort((a, b) => a.name.localeCompare(b.name))
    const teacherTables = sortedTeachers.map(t => {
      const sorted = t.entries.sort((a, b) => (a.block?.order || 0) - (b.block?.order || 0))
      const rows = sorted.map(e => {
        const bg = e.cancelled ? 'background:#fef2f2;' : e.edited ? 'background:#fef3c7;' : ''
        return `<tr><td style="padding:6px 8px;border:1px solid #e2e8f0;font-weight:600;white-space:nowrap;${bg}">${e.block?.label || ''}<br/><span style="font-size:10px;color:#94a3b8;font-weight:normal;">${e.block?.startTime || ''}-${e.block?.endTime || ''}</span></td><td style="padding:6px;border:1px solid #e2e8f0;${bg}">${e.cancelled ? '<s>' + e.entry.subjectName + '</s> <span style="color:red;">Cancelada</span>' : e.entry.subjectName || ''}</td><td style="padding:6px;border:1px solid #e2e8f0;${bg}">${e.groupName}</td></tr>`
      }).join('')
      return `<div style="page-break-inside:avoid;margin-bottom:24px;"><h3 style="margin:0 0 8px;color:#1e293b;">${t.name} <span style="font-weight:normal;color:#64748b;font-size:14px;">(${t.entries.length} horas)</span></h3><table style="border-collapse:collapse;width:100%;font-size:12px;"><thead><tr style="background:#7c3aed;color:white;"><th style="padding:6px 8px;border:1px solid #e2e8f0;text-align:left;">Hora</th><th style="padding:6px;border:1px solid #e2e8f0;text-align:left;">Asignatura</th><th style="padding:6px;border:1px solid #e2e8f0;text-align:left;">Grupo</th></tr></thead><tbody>${rows}</tbody></table></div>`
    }).join('')

    const printHTML = `<html><head><title>Horario por Docente - ${dateStr}</title><style>@media print{@page{size:portrait;margin:1cm;}}body{font-family:Arial,sans-serif;margin:20px;}h2{color:#1e293b;margin-bottom:4px;}p{color:#64748b;margin-top:0;}</style></head><body>
      <h2>${provisionalMode ? '📋 HORARIO PROVISIONAL POR DOCENTE' : 'Horario por Docente'}</h2>
      <p>${dateStr}${provisionalMode && provisionalNotes ? ' — ' + provisionalNotes : ''} — ${sortedTeachers.length} docentes</p>
      ${provisionalMode ? '<p style="color:#f59e0b;font-weight:bold;font-size:11px;">⚠️ Este horario es provisional.</p>' : ''}
      ${teacherTables}
      <p style="margin-top:16px;font-size:10px;color:#94a3b8;">Generado por Edusyn — ${new Date().toLocaleString('es-CO')}</p>
    </body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(printHTML); w.document.close(); w.print() }
  }

  // Exportar horario (Excel o PDF)
  const handleExport = async (format: 'excel' | 'pdf', viewType: 'by-group' | 'by-teacher' = 'by-group') => {
    if (!academicYearId) return
    setExporting(true)
    try {
      const res = format === 'pdf'
        ? await timetablingGeneratorApi.exportSchedulePdf(academicYearId, viewType)
        : await timetablingGeneratorApi.exportSchedule(academicYearId, viewType)
      const ext = format === 'pdf' ? 'pdf' : 'xlsx'
      const mime = format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      const url = window.URL.createObjectURL(new Blob([res.data], { type: mime }))
      const link = document.createElement('a')
      link.href = url
      link.download = `horario-${viewType === 'by-teacher' ? 'docentes' : 'grupos'}.${ext}`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      console.error('Error exporting:', err)
    } finally {
      setExporting(false)
    }
  }

  // Mover entrada a otro bloque/día
  const handleMoveEntry = async (entryId: string, newTimeBlockId: string, newDayOfWeek: string) => {
    try {
      await timetablingEntriesApi.update(entryId, { timeBlockId: newTimeBlockId, dayOfWeek: newDayOfWeek })
      setMovingEntry(null)
      loadView() // Recargar datos
    } catch (err: any) {
      console.error('Error moving entry:', err)
      alert(err.response?.data?.message || 'Error al mover la entrada. Puede haber conflictos.')
      setMovingEntry(null)
    }
  }

  // Intercambiar dos entradas (swap)
  const handleSwapEntries = async (entryA: any, entryB: any) => {
    try {
      await timetablingEntriesApi.swap(entryA.id, entryB.id)
      setMovingEntry(null)
      loadView()
    } catch (err: any) {
      console.error('Error swapping entries:', err)
      alert(err.response?.data?.message || 'Error al intercambiar. Puede haber conflictos.')
      setMovingEntry(null)
      loadView()
    }
  }

  // Renderizar grilla horaria para un conjunto de entradas
  const renderScheduleGrid = (entries: any[], title: string, subtitle?: string, shiftId?: string) => {
    if (!entries || entries.length === 0) {
      return (
        <div className="text-center py-6 text-gray-400 text-sm">
          No hay entradas para mostrar
        </div>
      )
    }

    // Obtener bloques de las entradas
    const blocksMap = new Map<string, any>()
    const daysSet = new Set<string>()
    for (const e of entries) {
      if (e.timeBlock && !blocksMap.has(e.timeBlock.id)) {
        blocksMap.set(e.timeBlock.id, e.timeBlock)
      }
      if (e.dayOfWeek) daysSet.add(e.dayOfWeek)
    }

    // Agregar bloques TUTORING/BREAK/LUNCH/ASSEMBLY del allTimeBlocks que no estén en las entradas
    const allBlocks = viewData?.allTimeBlocks || []
    for (const tb of allBlocks) {
      if (!blocksMap.has(tb.id) && tb.type !== 'CLASS' && tb.type !== 'FREE') {
        // Si hay shiftId, solo incluir bloques del mismo turno
        if (shiftId && tb.shiftId !== shiftId) continue
        blocksMap.set(tb.id, tb)
      }
    }

    const sortedBlocks = Array.from(blocksMap.values()).sort((a, b) => a.order - b.order)
    const daysOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
    // Mostrar al menos Lun-Vie si hay entradas en algún día
    if (daysSet.size > 0) {
      ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'].forEach(d => daysSet.add(d))
    }
    const activeDays = daysOrder.filter(d => daysSet.has(d))

    // Crear lookup
    const lookup = new Map<string, any>()
    for (const e of entries) {
      lookup.set(`${e.timeBlock?.id}|${e.dayOfWeek}`, e)
    }

    return (
      <div className="mb-6">
        {title && (
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-semibold text-gray-800">{title}</h4>
            {subtitle && <span className="text-xs text-gray-400">{subtitle}</span>}
          </div>
        )}
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-indigo-600 text-white">
                <th className="px-2 py-2 text-left font-medium w-24">Hora</th>
                {activeDays.map(d => (
                  <th key={d} className="px-2 py-2 text-center font-medium">
                    {DAYS.find(dd => dd.key === d)?.short || d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedBlocks.map((block, bi) => {
                const isBreak = block.type === 'BREAK' || block.type === 'LUNCH'
                const isTutoring = block.type === 'TUTORING'
                const isAssembly = block.type === 'ASSEMBLY'
                const isSpecial = isBreak || isTutoring || isAssembly
                return (
                  <tr key={block.id} className={`border-t ${isBreak ? 'bg-gray-50' : isTutoring ? 'bg-indigo-50/50' : isAssembly ? 'bg-purple-50/50' : bi % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                    <td className="px-2 py-1.5 text-gray-600 font-medium whitespace-nowrap border-r">
                      <div>{block.label || `Bloque ${block.order}`}</div>
                      <div className="text-gray-400 text-[10px]">{block.startTime}-{block.endTime}</div>
                    </td>
                    {activeDays.map(day => {
                      const entry = lookup.get(`${block.id}|${day}`)
                      if (isBreak) {
                        return (
                          <td key={day} className="px-2 py-1.5 text-center text-gray-400 italic border-r">
                            {block.type === 'LUNCH' ? 'Almuerzo' : 'Receso'}
                          </td>
                        )
                      }
                      if (isTutoring) {
                        return (
                          <td key={day} className="px-2 py-1.5 border-r">
                            <div className="bg-indigo-50 border border-indigo-200 rounded px-1.5 py-1 text-center">
                              <div className="font-semibold text-indigo-700 truncate">{block.label || 'Tutoría'}</div>
                            </div>
                          </td>
                        )
                      }
                      if (isAssembly) {
                        return (
                          <td key={day} className="px-2 py-1.5 border-r">
                            <div className="bg-purple-50 border border-purple-200 rounded px-1.5 py-1 text-center">
                              <div className="font-semibold text-purple-700 truncate">{block.label || 'Formación'}</div>
                            </div>
                          </td>
                        )
                      }
                      if (!entry) {
                        // Celda vacía: si hay entrada en movimiento, permitir soltar aquí
                        const isTarget = movingEntry && !isSpecial
                        return (
                          <td
                            key={day}
                            className={`px-2 py-1.5 border-r ${isTarget ? 'bg-green-50 cursor-pointer hover:bg-green-100' : ''}`}
                            onClick={isTarget ? () => handleMoveEntry(movingEntry.id, block.id, day) : undefined}
                          >
                            {isTarget && (
                              <div className="border-2 border-dashed border-green-300 rounded px-1.5 py-1 text-center text-green-500 text-[10px]">
                                <ArrowRight className="w-3 h-3 mx-auto" />
                                Mover aquí
                              </div>
                            )}
                          </td>
                        )
                      }
                      const isMoving = movingEntry?.id === entry.id
                      const isSwapTarget = movingEntry && !isMoving && !isSpecial
                      return (
                        <td key={day} className="px-2 py-1.5 border-r">
                          <div
                            className={`rounded px-1.5 py-1 text-center cursor-pointer transition-all ${
                              isMoving
                                ? 'bg-amber-100 border-2 border-amber-400 ring-2 ring-amber-200'
                                : isSwapTarget
                                  ? 'bg-orange-50 border-2 border-dashed border-orange-300 hover:border-orange-500 hover:shadow-sm'
                                  : 'bg-blue-50 border border-blue-200 hover:border-blue-400 hover:shadow-sm'
                            }`}
                            onClick={() => {
                              if (isMoving) {
                                setMovingEntry(null)
                              } else if (isSwapTarget) {
                                handleSwapEntries(movingEntry, entry)
                              } else {
                                setMovingEntry(entry)
                              }
                            }}
                            title={isMoving ? 'Click para cancelar' : isSwapTarget ? 'Click para intercambiar con la ficha seleccionada' : 'Click para mover esta ficha'}
                          >
                            <div className="font-semibold text-blue-800 truncate">{entry.subjectName}</div>
                            {entry.teacherName && <div className="text-blue-600 truncate">{entry.teacherName}</div>}
                            {entry.groupName && viewMode !== 'total' && viewMode !== 'by-grade' && viewMode !== 'by-day' && (
                              <div className="text-gray-500 truncate">{entry.groupName}</div>
                            )}
                            {entry.roomName && <div className="text-gray-400 truncate">{entry.roomName}</div>}
                            {isMoving && <div className="text-amber-600 text-[10px] mt-0.5 font-medium">← Moviendo... (click otra celda)</div>}
                            {isSwapTarget && <div className="text-orange-500 text-[10px] mt-0.5 font-medium">↔ Intercambiar</div>}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // Renderizar contenido según la vista activa
  const renderViewContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
          <span className="ml-2 text-gray-500">Cargando vista...</span>
        </div>
      )
    }

    if (!viewData || viewData.totalEntries === 0) {
      return (
        <div className="text-center py-12 text-gray-400">
          <Grid3X3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No hay horarios generados</p>
          <p className="text-sm mt-1">Use la pestaña "Generador" para crear un horario</p>
        </div>
      )
    }

    switch (viewMode) {
      case 'total': {
        // Agrupar por grupo
        const groupMap = new Map<string, any[]>()
        for (const e of viewData.entries || []) {
          const key = e.groupId || 'unknown'
          if (!groupMap.has(key)) groupMap.set(key, [])
          groupMap.get(key)!.push(e)
        }
        return (
          <div>
            <p className="text-sm text-gray-500 mb-4">{viewData.totalEntries} entradas en total • {groupMap.size} grupos</p>
            {Array.from(groupMap.entries()).map(([gId, entries]) => (
              renderScheduleGrid(entries, entries[0]?.groupName || 'Grupo', `${entries[0]?.gradeName || ''} — ${entries[0]?.shiftName || ''}`)
            ))}
          </div>
        )
      }

      case 'by-grade': {
        // Para docentes: filtrar solo los grupos asignados/tutor
        const filteredGrades = (viewData.grades || []).map((grade: any) => ({
          ...grade,
          groups: allowedGroupIds
            ? (grade.groups || []).filter((g: any) => allowedGroupIds.has(g.groupId))
            : (grade.groups || []),
        })).filter((grade: any) => grade.groups.length > 0)

        return (
          <div>
            {!isManager && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-700">
                Mostrando solo los horarios de tus grupos asignados y de tutoría.
              </div>
            )}
            <p className="text-sm text-gray-500 mb-4">{filteredGrades.reduce((s: number, g: any) => s + g.groups.reduce((s2: number, gr: any) => s2 + (gr.entries?.length || 0), 0), 0)} entradas • {filteredGrades.length} grado{filteredGrades.length !== 1 ? 's' : ''}</p>
            {filteredGrades.map((grade: any) => (
              <div key={grade.gradeId} className="mb-8">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                  <Layers className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-lg font-bold text-gray-800">{grade.gradeName}</h3>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{grade.stage}</span>
                </div>
                {(grade.groups || []).map((group: any) => (
                  renderScheduleGrid(group.entries, group.groupName)
                ))}
              </div>
            ))}
            {filteredGrades.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <Layers className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No tienes grupos asignados</p>
              </div>
            )}
          </div>
        )
      }

      case 'by-day': {
        // Recopilar todos los grupos y entradas del día seleccionado
        const allGroups: { groupId: string; groupName: string; gradeName: string; entries: any[] }[] = []
        for (const grade of (viewData.grades || [])) {
          for (const group of (grade.groups || [])) {
            const dayEntries = (group.entries || []).filter((e: any) => e.dayOfWeek === selectedDay)
            allGroups.push({ groupId: group.groupId, groupName: group.groupName, gradeName: grade.gradeName, entries: dayEntries })
          }
        }

        // Obtener bloques de tiempo del primer grupo que tenga entradas
        const blocksMap = new Map<string, any>()
        for (const g of allGroups) {
          for (const e of g.entries) {
            if (e.timeBlock && !blocksMap.has(e.timeBlock.id)) blocksMap.set(e.timeBlock.id, e.timeBlock)
          }
        }
        // Agregar bloques especiales
        for (const tb of (viewData.allTimeBlocks || [])) {
          if (!blocksMap.has(tb.id) && tb.type !== 'CLASS' && tb.type !== 'FREE') {
            blocksMap.set(tb.id, tb)
          }
        }
        const sortedBlocks = Array.from(blocksMap.values()).sort((a: any, b: any) => a.order - b.order)

        const dayLabel = DAYS.find(d => d.key === selectedDay)?.label || selectedDay
        const editCount = provisionalEdits.size

        return (
          <div>
            {/* Selector de día + controles */}
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {!provisionalMode && (
                  <>
                    <span className="text-sm text-gray-500 font-medium">Día:</span>
                    {DAYS.filter(d => d.key !== 'SATURDAY').map(d => (
                      <button
                        key={d.key}
                        onClick={() => setSelectedDay(d.key)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          selectedDay === d.key
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </>
                )}
                {provisionalMode && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-medium text-amber-700">📋 Provisional para:</span>
                    <input
                      type="date"
                      value={provisionalDate}
                      onChange={(e) => handleProvisionalDateChange(e.target.value)}
                      className="px-3 py-1.5 border border-amber-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 bg-amber-50"
                    />
                    <span className="text-sm text-amber-600 font-medium">
                      ({DAYS.find(d => d.key === selectedDay)?.label})
                    </span>
                    <input
                      type="text"
                      value={provisionalNotes}
                      onChange={(e) => setProvisionalNotes(e.target.value)}
                      placeholder="Motivo del cambio (opcional)"
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-64"
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleProvisionalMode}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                    provisionalMode
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-gray-100 text-gray-600 hover:bg-amber-50 hover:text-amber-700'
                  }`}
                >
                  <CalendarDays className="w-4 h-4" />
                  {provisionalMode ? 'Salir Provisional' : 'Horario Provisional'}
                </button>
                <div className="relative group">
                  <button
                    className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-200 flex items-center gap-1"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Imprimir Día
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg py-1 z-20 hidden group-hover:block min-w-[200px]">
                    <button onClick={handlePrintDay} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                      <Grid3X3 className="w-4 h-4 text-indigo-500" /> Grilla general del día
                    </button>
                    <button onClick={handlePrintDayByCourse} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-blue-500" /> Por curso (grupo)
                    </button>
                    <button onClick={handlePrintDayByTeacher} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                      <Users className="w-4 h-4 text-purple-500" /> Por docente
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Provisional mode instructions */}
            {provisionalMode && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm">
                <p className="font-medium text-amber-800 mb-1">Modo Provisional — Edición temporal</p>
                <p className="text-amber-700 text-xs">
                  • Haz <strong>clic en una celda</strong> para seleccionarla, luego <strong>clic en otra</strong> para intercambiarlas.
                  • Haz <strong>doble clic</strong> en una celda para cancelarla.
                  • Los cambios son temporales y solo afectan la impresión.
                  {editCount > 0 && <span className="ml-2 px-2 py-0.5 bg-amber-200 rounded-full font-medium">{editCount} cambio{editCount !== 1 ? 's' : ''}</span>}
                </p>
                {editCount > 0 && (
                  <button
                    onClick={() => { setProvisionalEdits(new Map()); setProvisionalSelected(null) }}
                    className="mt-2 text-xs text-amber-600 underline hover:text-amber-800"
                  >
                    Deshacer todos los cambios
                  </button>
                )}
              </div>
            )}

            <p className="text-sm text-gray-500 mb-4">
              {provisionalMode
                ? `${new Date(provisionalDate + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })} — ${allGroups.length} grupos`
                : `${dayLabel} — ${allGroups.length} grupos • ${allGroups.reduce((s, g) => s + g.entries.length, 0)} clases`
              }
            </p>

            {/* Tabla compacta: filas = bloques, columnas = grupos */}
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead>
                  <tr className={provisionalMode ? 'bg-amber-600 text-white' : 'bg-indigo-600 text-white'}>
                    <th className={`px-2 py-2 text-left font-medium w-20 sticky left-0 z-10 ${provisionalMode ? 'bg-amber-600' : 'bg-indigo-600'}`}>Hora</th>
                    {allGroups.map(g => (
                      <th key={g.groupId} className="px-1 py-2 text-center font-medium min-w-[80px]">
                        <div>{g.groupName}</div>
                        <div className={`text-[10px] font-normal ${provisionalMode ? 'text-amber-200' : 'text-indigo-200'}`}>{g.gradeName}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedBlocks.map((block: any, bi: number) => {
                    const isBreak = block.type === 'BREAK' || block.type === 'LUNCH'
                    const isTutoring = block.type === 'TUTORING'
                    const isAssembly = block.type === 'ASSEMBLY'
                    return (
                      <tr key={block.id} className={`border-t ${isBreak ? 'bg-gray-50' : isTutoring ? 'bg-indigo-50/50' : bi % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                        <td className="px-2 py-1 text-gray-600 font-medium whitespace-nowrap border-r sticky left-0 bg-inherit z-10">
                          <div className="text-[10px]">{block.label || `B${block.order}`}</div>
                          <div className="text-gray-400 text-[9px]">{block.startTime}-{block.endTime}</div>
                        </td>
                        {allGroups.map(g => {
                          if (isBreak) {
                            return <td key={g.groupId} className="px-1 py-1 text-center text-gray-300 italic border-r text-[9px]">—</td>
                          }
                          if (isTutoring) {
                            return (
                              <td key={g.groupId} className="px-1 py-1 border-r">
                                <div className="bg-indigo-50 rounded px-1 py-0.5 text-center text-indigo-600 text-[10px] font-medium truncate">
                                  {block.label || 'Tutoría'}
                                </div>
                              </td>
                            )
                          }
                          if (isAssembly) {
                            return (
                              <td key={g.groupId} className="px-1 py-1 border-r">
                                <div className="bg-purple-50 rounded px-1 py-0.5 text-center text-purple-600 text-[10px] font-medium truncate">
                                  {block.label || 'Formación'}
                                </div>
                              </td>
                            )
                          }

                          const cellKey = `${g.groupId}::${block.id}`
                          const edit = provisionalEdits.get(cellKey)
                          const originalEntry = g.entries.find((e: any) => e.timeBlock?.id === block.id)
                          const isSelected = provisionalSelected?.groupId === g.groupId && provisionalSelected?.blockId === block.id
                          const isCancelled = edit?._cancelled
                          const isSwapped = edit?._swapped
                          const displayEntry = isSwapped ? edit : originalEntry

                          if (provisionalMode) {
                            return (
                              <td
                                key={g.groupId}
                                className={`px-1 py-1 border-r cursor-pointer transition-all ${isSelected ? 'ring-2 ring-amber-500 ring-inset bg-amber-50' : ''}`}
                                onClick={() => handleProvisionalClick(g.groupId, block.id, originalEntry || {})}
                                onDoubleClick={() => originalEntry && !isCancelled ? handleProvisionalCancel(g.groupId, block.id) : isCancelled ? handleProvisionalRestore(g.groupId, block.id) : undefined}
                              >
                                {isCancelled ? (
                                  <div className="bg-red-50 border border-red-200 rounded px-1 py-0.5 text-center">
                                    <div className="text-red-400 line-through text-[10px]">{originalEntry?.subjectName || '—'}</div>
                                    <div className="text-red-500 text-[9px] font-medium">Cancelada</div>
                                  </div>
                                ) : displayEntry ? (
                                  <div className={`rounded px-1 py-0.5 text-center border ${isSwapped ? 'bg-amber-50 border-amber-300' : 'bg-blue-50 border-blue-100'}`}>
                                    <div className={`font-semibold truncate text-[10px] ${isSwapped ? 'text-amber-800' : 'text-blue-800'}`}>{displayEntry.subjectName}</div>
                                    {displayEntry.teacherName && <div className={`truncate text-[9px] ${isSwapped ? 'text-amber-600' : 'text-blue-500'}`}>{displayEntry.teacherName?.split(' ').slice(0, 2).join(' ')}</div>}
                                    {isSwapped && <div className="text-amber-500 text-[8px]">⇄ modificado</div>}
                                  </div>
                                ) : (
                                  <div className="text-center text-gray-300 text-[9px] py-1">vacío</div>
                                )}
                              </td>
                            )
                          }

                          if (!originalEntry) {
                            return <td key={g.groupId} className="px-1 py-1 border-r" />
                          }
                          return (
                            <td key={g.groupId} className="px-1 py-1 border-r">
                              <div className="bg-blue-50 border border-blue-100 rounded px-1 py-0.5 text-center">
                                <div className="font-semibold text-blue-800 truncate text-[10px]">{originalEntry.subjectName}</div>
                                {originalEntry.teacherName && <div className="text-blue-500 truncate text-[9px]">{originalEntry.teacherName.split(' ').slice(0, 2).join(' ')}</div>}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      }

      case 'by-teacher': {
        const allTeachers = viewData.teachers || []
        // Para docentes: solo mostrar su propio horario
        const teachers = !isManager && user?.id
          ? allTeachers.filter((t: any) => t.teacherId === user.id)
          : allTeachers
        return (
          <div>
            {!isManager && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-700">
                Mostrando tu horario personal.
              </div>
            )}
            <p className="text-sm text-gray-500 mb-4">{teachers.reduce((s: number, t: any) => s + (t.entries?.length || 0), 0)} entradas • {teachers.length} docente{teachers.length !== 1 ? 's' : ''}</p>
            {/* Selector de docente - solo para managers */}
            {isManager && allTeachers.length > 5 && (
              <div className="mb-4">
                <select
                  value={selectedFilter}
                  onChange={e => {
                    setSelectedFilter(e.target.value)
                    if (e.target.value) {
                      // Filtrar localmente
                    }
                  }}
                  className="border rounded-lg px-3 py-2 text-sm w-full max-w-md"
                >
                  <option value="">Todos los docentes</option>
                  {allTeachers.map((t: any) => (
                    <option key={t.teacherId} value={t.teacherId}>{t.teacherName} ({t.entries.length} entradas)</option>
                  ))}
                </select>
              </div>
            )}
            {teachers
              .filter((t: any) => !selectedFilter || t.teacherId === selectedFilter)
              .map((teacher: any) => (
                <div key={teacher.teacherId} className="mb-8">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                    <Users className="w-5 h-5 text-green-600" />
                    <h3 className="text-lg font-bold text-gray-800">{teacher.teacherName}</h3>
                    <span className="text-xs text-gray-400">{teacher.email}</span>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded ml-auto">{teacher.entries.length} horas</span>
                  </div>
                  {renderScheduleGrid(teacher.entries, '')}
                </div>
              ))}
            {teachers.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No se encontró tu horario</p>
                <p className="text-sm mt-1">Contacta al coordinador si crees que esto es un error.</p>
              </div>
            )}
          </div>
        )
      }

      case 'by-subject': {
        const subjects = viewData.subjects || []
        return (
          <div>
            <p className="text-sm text-gray-500 mb-4">{viewData.totalEntries} entradas • {subjects.length} asignaturas</p>
            {subjects.map((subject: any) => (
              <div key={subject.subjectId} className="mb-8">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-bold text-gray-800">{subject.subjectName}</h3>
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{subject.areaName}</span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded ml-auto">{subject.entries.length} horas</span>
                </div>
                {/* Agrupar por grupo */}
                {(() => {
                  const groupMap = new Map<string, any[]>()
                  for (const e of subject.entries) {
                    const key = e.groupId || 'unknown'
                    if (!groupMap.has(key)) groupMap.set(key, [])
                    groupMap.get(key)!.push(e)
                  }
                  return Array.from(groupMap.entries()).map(([gId, entries]) => (
                    renderScheduleGrid(entries, entries[0]?.groupName || '', `${entries[0]?.teacherName || ''}`)
                  ))
                })()}
              </div>
            ))}
          </div>
        )
      }

      case 'by-area': {
        const areas = viewData.areas || []
        return (
          <div>
            <p className="text-sm text-gray-500 mb-4">{viewData.totalEntries} entradas • {areas.length} áreas/departamentos</p>
            {areas.map((area: any) => (
              <div key={area.areaId} className="mb-8">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-indigo-200">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-lg font-bold text-gray-800">{area.areaName}</h3>
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded ml-auto">{area.totalEntries} horas</span>
                </div>
                {(area.subjects || []).map((subject: any) => (
                  <div key={subject.subjectId} className="ml-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-blue-400 rounded-full" />
                      <h4 className="font-semibold text-gray-700">{subject.subjectName}</h4>
                      <span className="text-xs text-gray-400">{subject.entries.length} horas</span>
                    </div>
                    {/* Summary table: show groups and teachers */}
                    <div className="ml-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-2">
                      {(() => {
                        const groupMap = new Map<string, Set<string>>()
                        for (const e of subject.entries) {
                          if (!groupMap.has(e.groupName || '')) groupMap.set(e.groupName || '', new Set())
                          if (e.teacherName) groupMap.get(e.groupName || '')!.add(e.teacherName)
                        }
                        return Array.from(groupMap.entries()).map(([groupName, teachers]) => (
                          <div key={groupName} className="bg-gray-50 rounded px-3 py-2 text-xs">
                            <div className="font-medium text-gray-800">{groupName}</div>
                            <div className="text-gray-500">{Array.from(teachers).join(', ')}</div>
                          </div>
                        ))
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Barra de vistas */}
      <div className="bg-white border rounded-xl p-4">
        <div className="flex items-center gap-2 flex-wrap">
          {VIEW_MODES.filter(vm => {
            // Docentes solo ven: Por Docente y Por Grado (sus grupos)
            if (isManager) return true
            return vm.key === 'by-teacher' || vm.key === 'by-grade'
          }).map(vm => {
            const Icon = vm.icon
            const isActive = viewMode === vm.key
            return (
              <button
                key={vm.key}
                onClick={() => handleViewChange(vm.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {vm.label}
              </button>
            )
          })}
          <div className="ml-auto flex items-center gap-1">
            {/* Exportar - solo managers */}
            {isManager && (
            <div className="relative group">
              <button
                disabled={exporting || !viewData || viewData.totalEntries === 0}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-40 transition-colors"
              >
                <Download className="w-4 h-4" />
                Exportar
                <ChevronDown className="w-3 h-3" />
              </button>
              <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg py-1 w-52 hidden group-hover:block z-20">
                <button onClick={() => handleExport('pdf', 'by-group')} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-red-500" /> PDF por grupo
                </button>
                <button onClick={() => handleExport('pdf', 'by-teacher')} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-red-500" /> PDF por docente
                </button>
                <hr className="my-1" />
                <button onClick={() => handleExport('excel', 'by-group')} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-green-500" /> Excel por grupo
                </button>
                <button onClick={() => handleExport('excel', 'by-teacher')} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-green-500" /> Excel por docente
                </button>
              </div>
            </div>
            )}
            <button
              onClick={() => loadView()}
              className="text-gray-400 hover:text-gray-600 p-2"
              title="Recargar"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Indicador de ficha en movimiento */}
      {movingEntry && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center gap-3">
          <Move className="w-5 h-5 text-amber-600" />
          <div className="flex-1">
            <span className="text-sm font-medium text-amber-800">
              Moviendo: {movingEntry.subjectName} ({movingEntry.teacherName || 'Sin docente'})
            </span>
            <span className="text-xs text-amber-600 ml-2">Haga click en una celda vacía para mover la ficha</span>
          </div>
          <button
            onClick={() => setMovingEntry(null)}
            className="text-amber-600 hover:text-amber-800 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Contenido de la vista */}
      <div className="bg-white border rounded-xl p-6">
        {renderViewContent()}
      </div>
    </div>
  )
}
