import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  timetablingTimeBlocksApi,
  timetablingRoomsApi,
  timetablingConfigApi,
  timetablingEntriesApi,
  academicGradesApi,
  academicYearLifecycleApi,
} from '../lib/api'
import {
  Clock, MapPin, Settings, Calendar, AlertTriangle, Plus, Trash2, Save,
  ChevronDown, Edit2, X, Check, Grid3X3, Users, Building2, Layers
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
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'blocks' | 'rooms' | 'config' | 'schedule' | 'conflicts'>('schedule')
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
    // Cargar año académico activo
    if (user?.institution?.id) {
      academicYearLifecycleApi.getByInstitution(user.institution.id)
        .then(res => {
          const years = res.data || []
          const active = years.find((y: any) => y.status === 'ACTIVE') || years[0]
          if (active) {
            setAcademicYearId(active.id)
            setAcademicYearLabel(active.year?.toString() || active.name || '')
          }
        })
        .catch(() => {})
    }
    loadGrades()
    loadTimeBlocks()
    loadRooms()
  }, [user?.institution?.id])

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
    { key: 'blocks', label: 'Bloques de tiempo', icon: Clock },
    { key: 'rooms', label: 'Espacios', icon: Building2 },
    { key: 'config', label: 'Configuración', icon: Settings },
    { key: 'conflicts', label: 'Conflictos', icon: AlertTriangle },
  ] as const

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
                onClick={() => setActiveTab(tab.key)}
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
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// SCHEDULE TAB - Grilla visual del horario
// ═══════════════════════════════════════════════════════

function ScheduleTab({ grades, selectedGroup, setSelectedGroup, gridData, loading, academicYearId, timeBlocks, rooms, onReload, showMessage }: any) {
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

  const allGroups = grades.flatMap((g: any) => g.groups?.map((gr: any) => ({ ...gr, gradeName: g.name })) || [])

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
