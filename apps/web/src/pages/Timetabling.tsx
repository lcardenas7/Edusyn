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
} from '../lib/api'
import {
  Clock, MapPin, Settings, Calendar, AlertTriangle, Plus, Trash2, Save,
  ChevronDown, Edit2, X, Check, Grid3X3, Users, Building2, Layers,
  Upload, Download, Wand2, FileSpreadsheet, RefreshCw, Eye, CheckCircle2, XCircle
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
  const { user } = useAuth()
  const isManager = user?.roles?.some((r: any) => {
    const roleName = r.role?.name || r.name || ''
    return roleName.includes('ADMIN') || roleName.includes('COORDINADOR') || roleName.includes('SUPERADMIN')
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
        />
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

// ═══════════════════════════════════════════════════════
// GENERATOR TAB - Importar Excel, Generar y Exportar
// ═══════════════════════════════════════════════════════

function GeneratorTab({ academicYearId, grades, showMessage, onScheduleGenerated }: {
  academicYearId: string
  grades: GradeGroup[]
  showMessage: (msg: string, type: 'success' | 'error') => void
  onScheduleGenerated: () => void
}) {
  const [step, setStep] = useState<'load' | 'preview' | 'generate' | 'result'>('load')
  const [loading, setLoading] = useState(false)
  const [teachingLoad, setTeachingLoad] = useState<any>(null)
  const [importResult, setImportResult] = useState<any>(null)
  const [generateResult, setGenerateResult] = useState<any>(null)
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [genOptions, setGenOptions] = useState({
    clearExisting: true,
    respectAvailability: true,
  })

  const allGroups = grades.flatMap(g => g.groups.map(gr => ({ ...gr, gradeName: g.name })))

  // Cargar carga académica actual
  const loadTeachingLoad = async () => {
    if (!academicYearId) return
    setLoading(true)
    try {
      const res = await timetablingGeneratorApi.getTeachingLoad(academicYearId)
      setTeachingLoad(res.data)
    } catch (err: any) {
      console.error('Error loading teaching load:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTeachingLoad() }, [academicYearId])

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

  // Generar horario
  const handleGenerate = async () => {
    if (!academicYearId) return
    setLoading(true)
    setGenerateResult(null)
    try {
      const res = await timetablingGeneratorApi.generateSchedule({
        academicYearId,
        groupIds: selectedGroupIds.length > 0 ? selectedGroupIds : undefined,
        clearExisting: genOptions.clearExisting,
        respectAvailability: genOptions.respectAvailability,
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
      {/* Step indicators */}
      <div className="flex items-center gap-2 text-sm">
        {[
          { key: 'load', label: '1. Carga Académica', icon: FileSpreadsheet },
          { key: 'preview', label: '2. Revisar', icon: Eye },
          { key: 'generate', label: '3. Generar', icon: Wand2 },
          { key: 'result', label: '4. Resultado', icon: CheckCircle2 },
        ].map((s, i) => {
          const Icon = s.icon
          const isActive = step === s.key
          const isPast = ['load', 'preview', 'generate', 'result'].indexOf(step) > i
          return (
            <button
              key={s.key}
              onClick={() => setStep(s.key as any)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
                isActive ? 'bg-indigo-100 text-indigo-700 font-medium'
                : isPast ? 'bg-green-50 text-green-700'
                : 'bg-gray-50 text-gray-400'
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
                <button onClick={loadTeachingLoad} className="text-gray-400 hover:text-gray-600">
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

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

              {(teachingLoad.summary?.totalAssignments || 0) > 0 && (
                <button
                  onClick={() => setStep('generate')}
                  className="mt-4 w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Wand2 className="w-5 h-5" />
                  Continuar a Generar Horario
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* PASO 2: Revisar (preview) */}
      {step === 'preview' && teachingLoad && (
        <div className="bg-white border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Vista Previa de Carga</h3>
          <p className="text-sm text-gray-500 mb-4">Revise la carga académica antes de generar el horario.</p>
          {/* Reuse the same table */}
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Docente</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Email</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Materia</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Grupo</th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-gray-500">Horas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(teachingLoad.assignments || []).map((a: any) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">{a.teacherName}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{a.teacherEmail}</td>
                    <td className="px-3 py-2">{a.subjectName}</td>
                    <td className="px-3 py-2"><span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs font-medium">{a.groupName}</span></td>
                    <td className="px-3 py-2 text-center font-medium">{a.weeklyHours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={() => setStep('generate')} className="mt-4 w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
            <Wand2 className="w-5 h-5" /> Continuar a Generar
          </button>
        </div>
      )}

      {/* PASO 3: Configurar y Generar */}
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
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleExport('by-group')}
                disabled={loading}
                className="flex items-center gap-3 p-4 border-2 border-green-300 rounded-xl hover:bg-green-50 transition-colors"
              >
                <Users className="w-8 h-8 text-green-600" />
                <div className="text-left">
                  <p className="font-medium text-gray-800">Por Grupo</p>
                  <p className="text-xs text-gray-500">Una hoja por cada grupo</p>
                </div>
              </button>
              <button
                onClick={() => handleExport('by-teacher')}
                disabled={loading}
                className="flex items-center gap-3 p-4 border-2 border-blue-300 rounded-xl hover:bg-blue-50 transition-colors"
              >
                <Building2 className="w-8 h-8 text-blue-600" />
                <div className="text-left">
                  <p className="font-medium text-gray-800">Por Docente</p>
                  <p className="text-xs text-gray-500">Una hoja por cada docente</p>
                </div>
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
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// SCHEDULE VIEWER TAB - Múltiples vistas del horario
// ═══════════════════════════════════════════════════════

const VIEW_MODES = [
  { key: 'total', label: 'Vista Total', icon: Grid3X3 },
  { key: 'by-grade', label: 'Por Grado', icon: Layers },
  { key: 'by-teacher', label: 'Por Docente', icon: Users },
  { key: 'by-subject', label: 'Por Asignatura', icon: Calendar },
  { key: 'by-area', label: 'Por Área/Depto', icon: Building2 },
] as const

function ScheduleViewerTab({ academicYearId }: { academicYearId: string }) {
  const [viewMode, setViewMode] = useState<'total' | 'by-grade' | 'by-teacher' | 'by-subject' | 'by-area'>('total')
  const [viewData, setViewData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState<string>('')

  const loadView = async (mode?: string) => {
    if (!academicYearId) return
    setLoading(true)
    try {
      const res = await timetablingGeneratorApi.getScheduleViews(
        academicYearId,
        (mode || viewMode) as any,
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
  }

  // Renderizar grilla horaria para un conjunto de entradas
  const renderScheduleGrid = (entries: any[], title: string, subtitle?: string) => {
    if (!entries || entries.length === 0) {
      return (
        <div className="text-center py-6 text-gray-400 text-sm">
          No hay entradas para mostrar
        </div>
      )
    }

    // Obtener bloques y días únicos
    const blocksMap = new Map<string, any>()
    const daysSet = new Set<string>()
    for (const e of entries) {
      if (e.timeBlock && !blocksMap.has(e.timeBlock.id)) {
        blocksMap.set(e.timeBlock.id, e.timeBlock)
      }
      if (e.dayOfWeek) daysSet.add(e.dayOfWeek)
    }
    const sortedBlocks = Array.from(blocksMap.values()).sort((a, b) => a.order - b.order)
    const daysOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
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
                return (
                  <tr key={block.id} className={`border-t ${isBreak ? 'bg-gray-50' : bi % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
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
                      if (!entry) {
                        return <td key={day} className="px-2 py-1.5 border-r" />
                      }
                      return (
                        <td key={day} className="px-2 py-1.5 border-r">
                          <div className="bg-blue-50 border border-blue-200 rounded px-1.5 py-1 text-center">
                            <div className="font-semibold text-blue-800 truncate">{entry.subjectName}</div>
                            {entry.teacherName && <div className="text-blue-600 truncate">{entry.teacherName}</div>}
                            {entry.groupName && viewMode !== 'total' && viewMode !== 'by-grade' && (
                              <div className="text-gray-500 truncate">{entry.groupName}</div>
                            )}
                            {entry.roomName && <div className="text-gray-400 truncate">{entry.roomName}</div>}
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
        return (
          <div>
            <p className="text-sm text-gray-500 mb-4">{viewData.totalEntries} entradas • {viewData.grades?.length || 0} grados</p>
            {(viewData.grades || []).map((grade: any) => (
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
          </div>
        )
      }

      case 'by-teacher': {
        const teachers = viewData.teachers || []
        return (
          <div>
            <p className="text-sm text-gray-500 mb-4">{viewData.totalEntries} entradas • {teachers.length} docentes</p>
            {/* Selector de docente */}
            {teachers.length > 5 && (
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
                  {teachers.map((t: any) => (
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
          {VIEW_MODES.map(vm => {
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
          <button
            onClick={() => loadView()}
            className="ml-auto text-gray-400 hover:text-gray-600 p-2"
            title="Recargar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Contenido de la vista */}
      <div className="bg-white border rounded-xl p-6">
        {renderViewContent()}
      </div>
    </div>
  )
}
