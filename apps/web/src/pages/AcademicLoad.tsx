import { useState, useEffect } from 'react'
import { 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Users,
  BookOpen,
  Filter,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  AlertOctagon,
  ArrowRightLeft,
  Loader2
} from 'lucide-react'
import { teachersApi, groupsApi, subjectsApi, teacherAssignmentsApi, academicYearsApi } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

interface Teacher {
  id: string
  name: string
  documentNumber: string
}

interface Subject {
  id: string
  name: string
  areaId: string
  areaName: string
}

interface Group {
  id: string
  name: string
  grade: string
  shift: string
}

interface AcademicLoad {
  id: string
  teacherId: string
  teacherName: string
  academicYearId: string
  groupId: string
  groupName: string
  grade: string
  areaId: string
  areaName: string
  subjectId: string
  subjectName: string
  role: 'TITULAR' | 'APOYO'
  weeklyHours: number
  status: 'ACTIVE' | 'INACTIVE'
}


export default function AcademicLoad() {
  const { institution } = useAuth()
  
  // Data from API
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loads, setLoads] = useState<AcademicLoad[]>([])
  const [academicYearId, setAcademicYearId] = useState<string>('')
  
  // UI State
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingLoad, setEditingLoad] = useState<AcademicLoad | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<AcademicLoad | null>(null)
  const [filterTeacher, setFilterTeacher] = useState<string>('')
  const [filterGroup, setFilterGroup] = useState<string>('')
  const [filterArea, setFilterArea] = useState<string>('')
  const [filterShift, setFilterShift] = useState<string>('')

  // Transfer Modal State
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [transferFrom, setTransferFrom] = useState<string>('')
  const [transferTo, setTransferTo] = useState<string>('')
  const [transferReason, setTransferReason] = useState<string>('')
  const [transferLoading, setTransferLoading] = useState(false)
  const [transferPreview, setTransferPreview] = useState<any>(null)
  const [selectedAssignments, setSelectedAssignments] = useState<string[]>([])

  // Cargar datos iniciales
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        // Cargar año académico actual (sin filtrar por institución)
        const yearsRes = await academicYearsApi.getAll()
        const years = yearsRes.data || []
        const currentYear = years[0] // Tomar el más reciente (ordenado por año desc)
        if (currentYear) {
          setAcademicYearId(currentYear.id)
        }

        // Cargar docentes
        const teachersRes = await teachersApi.getAll()
        const teachersData = (teachersRes.data || []).map((t: any) => ({
          id: t.id,
          name: `${t.firstName} ${t.lastName}`.toUpperCase(),
          documentNumber: t.documentNumber || '',
        }))
        setTeachers(teachersData)

        // Cargar grupos (filtrar por institución)
        const groupsRes = await groupsApi.getAll({ institutionId: institution?.id })
        const groupsData = (groupsRes.data || []).map((g: any) => ({
          id: g.id,
          name: g.name,
          grade: g.grade?.name || '',
          shift: g.shift?.name || '',
        }))
        setGroups(groupsData)

        // Cargar asignaturas
        const subjectsRes = await subjectsApi.getAll()
        const subjectsData = (subjectsRes.data || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          areaId: s.area?.id || s.areaId || '',
          areaName: s.area?.name || '',
        }))
        setSubjects(subjectsData)

        // Cargar asignaciones existentes
        if (currentYear) {
          const assignmentsRes = await teacherAssignmentsApi.getAll({ academicYearId: currentYear.id })
          const assignmentsData = (assignmentsRes.data || []).map((a: any) => ({
            id: a.id,
            teacherId: a.teacherId,
            teacherName: `${a.teacher?.firstName || ''} ${a.teacher?.lastName || ''}`.toUpperCase(),
            academicYearId: a.academicYearId,
            groupId: a.groupId,
            groupName: a.group?.name || '',
            grade: a.group?.grade?.name || '',
            areaId: a.subject?.area?.id || '',
            areaName: a.subject?.area?.name || '',
            subjectId: a.subjectId,
            subjectName: a.subject?.name || '',
            role: 'TITULAR' as const,
            weeklyHours: a.weeklyHours || 0,
            status: 'ACTIVE' as const,
          }))
          setLoads(assignmentsData)
        }
      } catch (err: any) {
        console.error('Error loading data:', err)
        setError('Error al cargar datos')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [institution?.id])

  const [form, setForm] = useState({
    teacherId: '',
    groupId: '',
    subjectId: '',
    role: 'TITULAR' as 'TITULAR' | 'APOYO',
    weeklyHours: 0,
  })

  const [validationErrors, setValidationErrors] = useState<string[]>([])

  // Unique shifts from groups
  const uniqueShifts = [...new Map(groups.map(g => [g.shift, g.shift])).values()].filter(Boolean).sort()

  // Filter groups by selected shift
  const filteredGroups = filterShift ? groups.filter(g => g.shift === filterShift) : groups

  const filteredLoads = loads.filter(load => {
    if (filterTeacher && load.teacherId !== filterTeacher) return false
    if (filterGroup && load.groupId !== filterGroup) return false
    if (filterShift) {
      const loadGroup = groups.find(g => g.id === load.groupId)
      if (loadGroup && loadGroup.shift !== filterShift) return false
    }
    if (filterArea && load.areaId !== filterArea) return false
    return true
  })

  const groupedByTeacher = filteredLoads.reduce((acc, load) => {
    if (!acc[load.teacherId]) {
      acc[load.teacherId] = {
        teacher: load.teacherName,
        loads: [],
        totalHours: 0,
      }
    }
    acc[load.teacherId].loads.push(load)
    acc[load.teacherId].totalHours += load.weeklyHours
    return acc
  }, {} as Record<string, { teacher: string; loads: AcademicLoad[]; totalHours: number }>)

  const selectedSubject = subjects.find(s => s.id === form.subjectId)
  const selectedGroup = groups.find(g => g.id === form.groupId)
  const selectedTeacher = teachers.find(t => t.id === form.teacherId)

  const validateForm = (): string[] => {
    const errors: string[] = []
    
    if (!form.teacherId) errors.push('Debe seleccionar un docente')
    if (!form.groupId) errors.push('Debe seleccionar un grupo')
    if (!form.subjectId) errors.push('Debe seleccionar una asignatura')
    if (form.weeklyHours <= 0) errors.push('Las horas semanales deben ser mayor a 0')

    // Validar duplicados
    const duplicate = loads.find(l => 
      l.teacherId === form.teacherId && 
      l.groupId === form.groupId && 
      l.subjectId === form.subjectId &&
      (!editingLoad || l.id !== editingLoad.id)
    )
    if (duplicate) {
      errors.push('Ya existe una asignación para este docente, grupo y asignatura')
    }

    // Validar que no haya otro titular para el mismo grupo y asignatura
    if (form.role === 'TITULAR') {
      const existingTitular = loads.find(l =>
        l.groupId === form.groupId &&
        l.subjectId === form.subjectId &&
        l.role === 'TITULAR' &&
        (!editingLoad || l.id !== editingLoad.id)
      )
      if (existingTitular) {
        errors.push(`Ya existe un docente titular (${existingTitular.teacherName}) para esta asignatura en este grupo`)
      }
    }

    return errors
  }

  const openModal = (load?: AcademicLoad) => {
    if (load) {
      setEditingLoad(load)
      setForm({
        teacherId: load.teacherId,
        groupId: load.groupId,
        subjectId: load.subjectId,
        role: load.role,
        weeklyHours: load.weeklyHours,
      })
    } else {
      setEditingLoad(null)
      setForm({
        teacherId: '',
        groupId: '',
        subjectId: '',
        role: 'TITULAR',
        weeklyHours: 0,
      })
    }
    setValidationErrors([])
    setShowModal(true)
  }

  const saveLoad = async () => {
    const errors = validateForm()
    if (errors.length > 0) {
      setValidationErrors(errors)
      return
    }

    const subject = subjects.find(s => s.id === form.subjectId)!
    const group = groups.find(g => g.id === form.groupId)!
    const teacher = teachers.find(t => t.id === form.teacherId)!

    setSaving(true)
    try {
      if (editingLoad) {
        // Por ahora solo actualizar localmente (API de update no implementada)
        setLoads(loads.map(l => 
          l.id === editingLoad.id 
            ? {
                ...l,
                teacherId: form.teacherId,
                teacherName: teacher.name,
                groupId: form.groupId,
                groupName: group.name,
                grade: group.grade,
                areaId: subject.areaId,
                areaName: subject.areaName,
                subjectId: form.subjectId,
                subjectName: subject.name,
                role: form.role,
                weeklyHours: form.weeklyHours,
              }
            : l
        ))
      } else {
        // Validar que tenemos año académico
        if (!academicYearId) {
          setValidationErrors(['No hay año académico configurado. Contacte al administrador.'])
          setSaving(false)
          return
        }
        
        // Crear nueva asignación via API
        const response = await teacherAssignmentsApi.create({
          academicYearId,
          groupId: form.groupId,
          subjectId: form.subjectId,
          teacherId: form.teacherId,
          weeklyHours: form.weeklyHours,
        })
        
        const newLoad: AcademicLoad = {
          id: response.data.id,
          teacherId: form.teacherId,
          teacherName: teacher.name,
          academicYearId,
          groupId: form.groupId,
          groupName: group.name,
          grade: group.grade,
          areaId: subject.areaId,
          areaName: subject.areaName,
          subjectId: form.subjectId,
          subjectName: subject.name,
          role: form.role,
          weeklyHours: form.weeklyHours,
          status: 'ACTIVE',
        }
        setLoads([...loads, newLoad])
      }
      setShowModal(false)
    } catch (err: any) {
      console.error('Error saving assignment:', err)
      setValidationErrors([err.response?.data?.message || 'Error al guardar la asignación'])
    } finally {
      setSaving(false)
    }
  }

  const deleteLoad = async () => {
    if (!deleteConfirm) return
    try {
      await teacherAssignmentsApi.delete(deleteConfirm.id)
      setLoads(loads.filter(l => l.id !== deleteConfirm.id))
      setDeleteConfirm(null)
    } catch (err: any) {
      console.error('Error deleting assignment:', err)
      alert(err.response?.data?.message || 'Error al eliminar la asignación')
    }
  }

  const uniqueAreas = [...new Set(subjects.map(s => ({ id: s.areaId, name: s.areaName })))]
    .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
          <p className="mt-4 text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Carga Académica</h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">Asignación de docentes a grupos y asignaturas</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Botón Transferir Carga */}
          <button
            onClick={() => {
              setTransferFrom('')
              setTransferTo('')
              setTransferReason('')
              setTransferPreview(null)
              setSelectedAssignments([])
              setShowTransferModal(true)
            }}
            disabled={saving || teachers.length < 2}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            <ArrowRightLeft className="w-4 h-4" />
            Transferir Carga
          </button>
          {/* TEMPORAL: Botón para eliminar toda la carga */}
          <button
            onClick={async () => {
              if (!confirm('⚠️ ¿Estás seguro de eliminar TODA la carga académica?\n\nEsta acción no se puede deshacer.')) return
              if (!confirm('🚨 ÚLTIMA CONFIRMACIÓN: Se eliminarán TODAS las asignaciones de docentes.\n\n¿Continuar?')) return
              try {
                setSaving(true)
                const res = await teacherAssignmentsApi.deleteAll(academicYearId || undefined)
                alert(res.data?.message || 'Carga eliminada')
                // Recargar datos
                const loadsRes = await teacherAssignmentsApi.getAll({ academicYearId })
                const mappedLoads = (loadsRes.data || []).map((a: any) => ({
                  id: a.id,
                  teacherId: a.teacher?.id || '',
                  teacherName: a.teacher ? `${a.teacher.firstName || ''} ${a.teacher.lastName || ''}`.trim() : 'Sin docente',
                  academicYearId: a.academicYearId,
                  groupId: a.group?.id || '',
                  groupName: a.group?.name || '',
                  grade: a.group?.grade?.name || '',
                  areaId: a.subject?.area?.id || '',
                  areaName: a.subject?.area?.name || '',
                  subjectId: a.subject?.id || '',
                  subjectName: a.subject?.name || '',
                  role: a.role || 'TITULAR',
                  weeklyHours: a.weeklyHours || 0,
                  status: a.endDate ? 'INACTIVE' : 'ACTIVE',
                }))
                setLoads(mappedLoads)
              } catch (err: any) {
                alert(err.response?.data?.message || 'Error al eliminar')
              } finally {
                setSaving(false)
              }
            }}
            disabled={saving || loads.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            <AlertOctagon className="w-4 h-4" />
            Eliminar Todo
          </button>
          <button
            onClick={() => openModal()}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Nueva Asignación
          </button>
        </div>
      </div>

      {/* Información importante */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">Principio clave del sistema:</p>
            <p>"El administrador configura la estructura. El docente solo ejecuta su carga académica."</p>
            <p className="mt-2 text-blue-600">La carga académica es la única fuente de verdad para registrar notas, asistencia y actividades evaluativas.</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="font-medium text-slate-700">Filtros</span>
          </div>
        </div>
        <div className="p-4 flex flex-col md:flex-row items-stretch md:items-center gap-4">
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-medium text-slate-600 mb-1">Docente</label>
            <select
              value={filterTeacher}
              onChange={(e) => setFilterTeacher(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">Todos los docentes</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">Jornada</label>
            <select
              value={filterShift}
              onChange={(e) => { setFilterShift(e.target.value); setFilterGroup(''); }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">Todas las jornadas</option>
              {uniqueShifts.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">Grupo</label>
            <select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">Todos los grupos</option>
              {filteredGroups.map(g => (
                <option key={g.id} value={g.id}>{g.name} - {g.grade} ({g.shift})</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">Área</label>
            <select
              value={filterArea}
              onChange={(e) => setFilterArea(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">Todas las áreas</option>
              {uniqueAreas.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div className="pt-5">
            <button
              onClick={() => { setFilterTeacher(''); setFilterGroup(''); setFilterArea(''); setFilterShift(''); }}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>

      {/* Vista por docente */}
      <div className="space-y-4">
        {Object.entries(groupedByTeacher).map(([teacherId, data]) => (
          <div key={teacherId} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{data.teacher}</h3>
                    <p className="text-sm text-slate-500">{data.loads.length} asignaciones</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-blue-600">{data.totalHours}</span>
                  <p className="text-xs text-slate-500">horas/semana</p>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase">Grupo</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase">Área</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase">Asignatura</th>
                    <th className="text-center px-4 py-2 text-xs font-medium text-slate-500 uppercase">Rol</th>
                    <th className="text-center px-4 py-2 text-xs font-medium text-slate-500 uppercase">Horas/Sem</th>
                    <th className="text-center px-4 py-2 text-xs font-medium text-slate-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.loads.map(load => (
                    <tr key={load.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-900">{load.groupName}</span>
                        <span className="text-slate-500 text-xs ml-2">({load.grade})</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{load.areaName}</td>
                      <td className="px-4 py-3 text-slate-900">{load.subjectName}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          load.role === 'TITULAR' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {load.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-slate-900">{load.weeklyHours}h</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openModal(load)}
                            className="p-1.5 hover:bg-blue-100 rounded text-blue-600"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(load)}
                            className="p-1.5 hover:bg-red-100 rounded text-red-600"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {Object.keys(groupedByTeacher).length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500">No hay asignaciones de carga académica</p>
            <button
              onClick={() => openModal()}
              className="mt-4 text-blue-600 hover:underline"
            >
              Crear primera asignación
            </button>
          </div>
        )}
      </div>

      {/* Modal Asignación */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingLoad ? 'Editar Asignación' : 'Nueva Asignación de Carga Académica'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {validationErrors.length > 0 && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-700">Errores de validación:</p>
                    <ul className="text-sm text-red-600 list-disc list-inside mt-1">
                      {validationErrors.map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Docente <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.teacherId}
                  onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">Seleccione un docente</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Grupo <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.groupId}
                  onChange={(e) => setForm({ ...form, groupId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">Seleccione un grupo</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name} - {g.grade} ({g.shift})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Asignatura <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.subjectId}
                  onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">Seleccione una asignatura</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.areaName})</option>
                  ))}
                </select>
                {selectedSubject && (
                  <p className="text-xs text-slate-500 mt-1">
                    Área: <span className="font-medium">{selectedSubject.areaName}</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Rol <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as 'TITULAR' | 'APOYO' })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option value="TITULAR">Titular</option>
                    <option value="APOYO">Apoyo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Horas Semanales <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={form.weeklyHours}
                    onChange={(e) => setForm({ ...form, weeklyHours: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Resumen de la asignación */}
              {form.teacherId && form.groupId && form.subjectId && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-green-700">Resumen de la asignación:</p>
                      <p className="text-green-600 mt-1">
                        <strong>{selectedTeacher?.name}</strong> dictará <strong>{selectedSubject?.name}</strong> al grupo <strong>{selectedGroup?.name}</strong> como <strong>{form.role}</strong> ({form.weeklyHours}h/semana)
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveLoad}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingLoad ? 'Guardar Cambios' : 'Crear Asignación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Transferir Carga */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                  <ArrowRightLeft className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Transferir Carga Docente</h3>
                  <p className="text-sm text-slate-500">Transfiere todas las asignaciones de un docente a otro</p>
                </div>
              </div>
              <button onClick={() => setShowTransferModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Docente Saliente */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Docente Saliente <span className="text-red-500">*</span>
                </label>
                <select
                  value={transferFrom}
                  onChange={async (e) => {
                    setTransferFrom(e.target.value)
                    setTransferPreview(null)
                    setSelectedAssignments([])
                    if (e.target.value) {
                      try {
                        setTransferLoading(true)
                        const res = await teacherAssignmentsApi.getTeacherLoad(e.target.value, academicYearId)
                        setTransferPreview(res.data)
                        setSelectedAssignments(res.data.summary?.map((s: any) => s.id) || [])
                      } catch (err) {
                        console.error('Error loading teacher load:', err)
                      } finally {
                        setTransferLoading(false)
                      }
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                >
                  <option value="">Seleccione el docente que se va</option>
                  {teachers.filter(t => t.id !== transferTo).map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Preview de carga */}
              {transferLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
                  <span className="ml-2 text-slate-600">Cargando asignaciones...</span>
                </div>
              )}

              {transferPreview && !transferLoading && (
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-slate-700">Asignaciones a transferir</span>
                    <span className="text-sm text-slate-500">{transferPreview.totalHours} horas/semana</span>
                  </div>
                  {transferPreview.summary?.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {transferPreview.summary.map((item: any) => (
                        <label key={item.id} className="flex items-center gap-3 p-2 bg-white rounded border border-slate-200 cursor-pointer hover:bg-amber-50">
                          <input
                            type="checkbox"
                            checked={selectedAssignments.includes(item.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedAssignments([...selectedAssignments, item.id])
                              } else {
                                setSelectedAssignments(selectedAssignments.filter(id => id !== item.id))
                              }
                            }}
                            className="w-4 h-4 text-amber-600 rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-800">{item.subject}</div>
                            <div className="text-xs text-slate-500">{item.group} • {item.area} • {item.weeklyHours}h/sem</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 text-center py-4">Este docente no tiene asignaciones activas</p>
                  )}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200">
                    <button
                      onClick={() => setSelectedAssignments(transferPreview.summary?.map((s: any) => s.id) || [])}
                      className="text-xs text-amber-600 hover:underline"
                    >
                      Seleccionar todas
                    </button>
                    <button
                      onClick={() => setSelectedAssignments([])}
                      className="text-xs text-slate-500 hover:underline"
                    >
                      Deseleccionar todas
                    </button>
                  </div>
                </div>
              )}

              {/* Docente Reemplazo */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Docente de Reemplazo <span className="text-red-500">*</span>
                </label>
                <select
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                >
                  <option value="">Seleccione el docente de reemplazo</option>
                  {teachers.filter(t => t.id !== transferFrom).map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Razón */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Razón del cambio <span className="text-red-500">*</span>
                </label>
                <select
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                >
                  <option value="">Seleccione la razón</option>
                  <option value="Renuncia">Renuncia</option>
                  <option value="Traslado">Traslado a otra institución</option>
                  <option value="Licencia">Licencia (maternidad, enfermedad, etc.)</option>
                  <option value="Terminación de contrato">Terminación de contrato</option>
                  <option value="Reorganización institucional">Reorganización institucional</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              {/* Resumen */}
              {transferFrom && transferTo && transferReason && selectedAssignments.length > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-800">Resumen de la transferencia:</p>
                      <p className="text-amber-700 mt-1">
                        Se transferirán <strong>{selectedAssignments.length} asignaciones</strong> de{' '}
                        <strong>{teachers.find(t => t.id === transferFrom)?.name}</strong> a{' '}
                        <strong>{teachers.find(t => t.id === transferTo)?.name}</strong>.
                      </p>
                      <p className="text-amber-600 text-xs mt-2">
                        Las notas y asistencia registradas se conservarán vinculadas al docente original.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => setShowTransferModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!transferFrom || !transferTo || !transferReason || selectedAssignments.length === 0) return
                  try {
                    setTransferLoading(true)
                    const res = await teacherAssignmentsApi.transfer({
                      fromTeacherId: transferFrom,
                      toTeacherId: transferTo,
                      reason: transferReason,
                      academicYearId,
                      assignmentIds: selectedAssignments,
                    })
                    alert(`✅ Transferencia exitosa: ${res.data.transferredCount} asignaciones transferidas de ${res.data.fromTeacher} a ${res.data.toTeacher}`)
                    setShowTransferModal(false)
                    // Recargar asignaciones
                    const loadsRes = await teacherAssignmentsApi.getAll({ academicYearId })
                    const mappedLoads = (loadsRes.data || []).map((a: any) => ({
                      id: a.id,
                      teacherId: a.teacher?.id || '',
                      teacherName: a.teacher ? `${a.teacher.firstName || ''} ${a.teacher.lastName || ''}`.trim().toUpperCase() : 'Sin docente',
                      academicYearId: a.academicYearId,
                      groupId: a.group?.id || '',
                      groupName: a.group?.name || '',
                      grade: a.group?.grade?.name || '',
                      areaId: a.subject?.area?.id || '',
                      areaName: a.subject?.area?.name || '',
                      subjectId: a.subject?.id || '',
                      subjectName: a.subject?.name || '',
                      role: 'TITULAR' as const,
                      weeklyHours: a.weeklyHours || 0,
                      status: a.endDate ? 'INACTIVE' : 'ACTIVE' as const,
                    }))
                    setLoads(mappedLoads)
                  } catch (err: any) {
                    alert(err.response?.data?.message || 'Error al transferir carga')
                  } finally {
                    setTransferLoading(false)
                  }
                }}
                disabled={!transferFrom || !transferTo || !transferReason || selectedAssignments.length === 0 || transferLoading}
                className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {transferLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                Transferir Carga
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmación Eliminar */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 text-center mb-2">
              ¿Eliminar asignación?
            </h3>
            <p className="text-sm text-slate-500 text-center mb-4">
              Estás a punto de eliminar la asignación de <strong>{deleteConfirm.subjectName}</strong> para el grupo <strong>{deleteConfirm.groupName}</strong>.
              <span className="text-red-600 font-medium"> El docente perderá acceso a este grupo.</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={deleteLoad}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
