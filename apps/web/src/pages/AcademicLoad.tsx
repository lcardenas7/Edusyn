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
  AlertTriangle
} from 'lucide-react'
import { teachersApi, groupsApi, subjectsApi, teacherAssignmentsApi, academicYearsApi } from '../lib/api'
import { useInstitution } from '../contexts/InstitutionContext'

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
  const { institution } = useInstitution()
  
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

        // Cargar grupos
        const groupsRes = await groupsApi.getAll()
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
  }, [institution.id])

  const [form, setForm] = useState({
    teacherId: '',
    groupId: '',
    subjectId: '',
    role: 'TITULAR' as 'TITULAR' | 'APOYO',
    weeklyHours: 0,
  })

  const [validationErrors, setValidationErrors] = useState<string[]>([])

  const filteredLoads = loads.filter(load => {
    if (filterTeacher && load.teacherId !== filterTeacher) return false
    if (filterGroup && load.groupId !== filterGroup) return false
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

  const deleteLoad = () => {
    if (!deleteConfirm) return
    setLoads(loads.filter(l => l.id !== deleteConfirm.id))
    setDeleteConfirm(null)
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
        <button
          onClick={() => openModal()}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Nueva Asignación
        </button>
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
            <label className="block text-xs font-medium text-slate-600 mb-1">Grupo</label>
            <select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">Todos los grupos</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name} - {g.shift}</option>
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
              onClick={() => { setFilterTeacher(''); setFilterGroup(''); setFilterArea(''); }}
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
