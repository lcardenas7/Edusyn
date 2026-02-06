import { useState, useEffect, useMemo } from 'react'
import { Calendar, Check, X, Clock, FileText, ChevronDown, AlertTriangle, Save } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { teacherAssignmentsApi, academicStudentsApi, attendanceApi } from '../lib/api'

interface TeacherAssignment {
  id: string
  subject: { id: string; name: string }
  group: { id: string; name: string; grade?: { name: string } }
  academicYear: { id: string; year: number }
}

const statusConfig = {
  PRESENT: { label: 'Presente', icon: Check, color: 'bg-green-100 text-green-600 border-green-200' },
  ABSENT: { label: 'Ausente', icon: X, color: 'bg-red-100 text-red-600 border-red-200' },
  LATE: { label: 'Tardanza', icon: Clock, color: 'bg-amber-100 text-amber-600 border-amber-200' },
  EXCUSED: { label: 'Excusa', icon: FileText, color: 'bg-blue-100 text-blue-600 border-blue-200' },
}

export default function Attendance() {
  const { user } = useAuth()
  
  const userRoles = useMemo(() => {
    if (!user?.roles) return []
    return user.roles.map((r: any) => typeof r === 'string' ? r : r.role?.name || r.name).filter(Boolean)
  }, [user?.roles])
  
  const isTeacher = userRoles.includes('DOCENTE')
  const isAdmin = userRoles.includes('ADMIN_INSTITUTIONAL') || userRoles.includes('SUPERADMIN') || userRoles.includes('COORDINADOR')
  
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([])
  const [selectedAssignment, setSelectedAssignment] = useState<TeacherAssignment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filtros separados de asignatura y grupo
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('')
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const today = new Date().toISOString().split('T')[0]
  
  // Docente solo puede modificar asistencia del día actual
  // Coordinador/Admin puede modificar cualquier día
  const canEdit = isAdmin || date === today
  
  const [students, setStudents] = useState<Array<{ id: string; name: string; enrollmentId: string; status: string }>>([])
  const [loadingStudents, setLoadingStudents] = useState(false)

  // Obtener asignaturas únicas
  const uniqueSubjects = useMemo(() => {
    const subjects = new Map<string, { id: string; name: string }>()
    assignments.forEach(a => {
      if (!subjects.has(a.subject.id)) {
        subjects.set(a.subject.id, a.subject)
      }
    })
    return Array.from(subjects.values())
  }, [assignments])

  // Obtener grupos únicos para la asignatura seleccionada
  const uniqueGroups = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; gradeName?: string }>()
    assignments
      .filter(a => a.subject.id === selectedSubjectId)
      .forEach(a => {
        if (!groups.has(a.group.id)) {
          groups.set(a.group.id, {
            id: a.group.id,
            name: a.group.name,
            gradeName: a.group.grade?.name
          })
        }
      })
    return Array.from(groups.values())
  }, [assignments, selectedSubjectId])

  // Actualizar selectedAssignment cuando cambian los filtros
  useEffect(() => {
    if (selectedSubjectId && selectedGroupId) {
      const assignment = assignments.find(
        a => a.subject.id === selectedSubjectId && a.group.id === selectedGroupId
      )
      setSelectedAssignment(assignment || null)
    } else {
      setSelectedAssignment(null)
    }
  }, [selectedSubjectId, selectedGroupId, assignments])
  
  // Cargar asignaciones - docente solo ve las suyas, admin/coord ve todas
  useEffect(() => {
    const fetchAssignments = async () => {
      setLoading(true)
      setError(null)
      try {
        const params: any = {}
        // Docente solo ve sus asignaciones, admin/coord ve todas
        if (isTeacher && !isAdmin && user?.id) {
          params.teacherId = user.id
        }
        const response = await teacherAssignmentsApi.getAll(params)
        const data = response.data || []
        setAssignments(data)
        // Inicializar filtros con la primera asignación
        if (data.length > 0) {
          setSelectedSubjectId(data[0].subject.id)
          setSelectedGroupId(data[0].group.id)
        }
      } catch (err: any) {
        console.error('Error loading assignments:', err)
        setError('Error al cargar asignaciones')
      } finally {
        setLoading(false)
      }
    }
    fetchAssignments()
  }, [user?.id, isTeacher, isAdmin])
  
  // Cargar estudiantes cuando cambia la asignación
  useEffect(() => {
    const fetchStudents = async () => {
      if (!selectedAssignment?.group?.id || !selectedAssignment?.academicYear?.id) {
        setStudents([])
        return
      }
      setLoadingStudents(true)
      try {
        // Usar academicStudentsApi para mantener separación de dominios
        const response = await academicStudentsApi.getByGroup({
          groupId: selectedAssignment.group.id,
          academicYearId: selectedAssignment.academicYear.id,
        })
        // El endpoint académico ya retorna el formato correcto, solo agregar status
        const mappedStudents = (response.data || []).map((s: any) => ({
          ...s,
          status: 'PRESENT',
        }))
        setStudents(mappedStudents)
      } catch (err) {
        console.error('Error loading students:', err)
        setStudents([])
      } finally {
        setLoadingStudents(false)
      }
    }
    fetchStudents()
  }, [selectedAssignment?.group?.id, selectedAssignment?.academicYear?.id])

  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const updateStatus = (studentId: string, status: string) => {
    setStudents(students.map(s => s.id === studentId ? { ...s, status } : s))
  }

  const saveAttendance = async () => {
    if (!selectedAssignment?.id) {
      setSaveMessage({ type: 'error', text: 'Selecciona una asignatura y grupo primero' })
      setTimeout(() => setSaveMessage(null), 3000)
      return
    }

    setSaving(true)
    setSaveMessage(null)

    try {
      const records = students.map(s => ({
        studentEnrollmentId: s.enrollmentId,
        status: s.status,
      }))

      await attendanceApi.record({
        teacherAssignmentId: selectedAssignment.id,
        date: date,
        records,
      })

      setSaveMessage({ type: 'success', text: 'Asistencia guardada correctamente' })
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (err: any) {
      console.error('Error saving attendance:', err)
      setSaveMessage({ type: 'error', text: err.response?.data?.message || 'Error al guardar la asistencia' })
      setTimeout(() => setSaveMessage(null), 5000)
    } finally {
      setSaving(false)
    }
  }

  // Cargar asistencia guardada cuando cambia la fecha o asignación
  useEffect(() => {
    const loadSavedAttendance = async () => {
      if (!selectedAssignment?.id || !date) return
      
      try {
        const response = await attendanceApi.getByAssignment(selectedAssignment.id, date)
        const savedRecords = response.data || []
        
        if (savedRecords.length > 0) {
          // Actualizar el estado de los estudiantes con los registros guardados
          setStudents(prev => prev.map(student => {
            const savedRecord = savedRecords.find((r: any) => r.studentEnrollmentId === student.enrollmentId)
            return savedRecord ? { ...student, status: savedRecord.status } : student
          }))
        }
      } catch (err) {
        // Si no hay registros guardados, no es un error
        console.log('No saved attendance found for this date')
      }
    }
    
    loadSavedAttendance()
  }, [selectedAssignment?.id, date, students.length])

  const summary = {
    present: students.filter(s => s.status === 'PRESENT').length,
    absent: students.filter(s => s.status === 'ABSENT').length,
    late: students.filter(s => s.status === 'LATE').length,
    excused: students.filter(s => s.status === 'EXCUSED').length,
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Asistencia</h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">Control de asistencia diaria</p>
        </div>
        <button 
          onClick={saveAttendance}
          disabled={saving || !selectedAssignment || !canEdit}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Guardando...' : 'Guardar Asistencia'}
        </button>
      </div>

      {/* Mensaje de advertencia para docentes */}
      {!canEdit && !isAdmin && (
        <div className="mb-4 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          <span>Solo puedes modificar la asistencia del día actual. Para modificar días anteriores, contacta al coordinador.</span>
        </div>
      )}

      {/* Mensaje de guardado */}
      {saveMessage && (
        <div className={`mb-4 p-4 rounded-lg ${saveMessage.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {saveMessage.text}
        </div>
      )}

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
            <Calendar className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="mt-4 text-slate-500">No tienes asignaturas asignadas</p>
            <p className="text-sm text-slate-400">Contacta al coordinador para asignar tu carga académica</p>
          </div>
        </div>
      ) : (
      <>
      <div className="flex gap-4 mb-6 flex-wrap">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />

        {/* Selector de Asignatura */}
        <div className="relative">
          <select 
            value={selectedSubjectId}
            onChange={(e) => {
              setSelectedSubjectId(e.target.value)
              // Seleccionar el primer grupo disponible para esta asignatura
              const firstGroup = assignments.find(a => a.subject.id === e.target.value)
              if (firstGroup) {
                setSelectedGroupId(firstGroup.group.id)
              }
            }}
            className="appearance-none pl-4 pr-10 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-w-[200px]"
          >
            {uniqueSubjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>

        {/* Selector de Grupo */}
        <div className="relative">
          <select 
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-w-[120px]"
          >
            {uniqueGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.gradeName} {group.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{summary.present}</p>
              <p className="text-sm text-slate-500">Presentes</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <X className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{summary.absent}</p>
              <p className="text-sm text-slate-500">Ausentes</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{summary.late}</p>
              <p className="text-sm text-slate-500">Tardanzas</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{summary.excused}</p>
              <p className="text-sm text-slate-500">Excusas</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-slate-900">Lista de Estudiantes</h2>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {loadingStudents ? (
            <div className="px-6 py-8 text-center text-slate-500">
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                Cargando estudiantes...
              </div>
            </div>
          ) : students.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-500">
              No hay estudiantes matriculados en este grupo
            </div>
          ) : students.map((student) => {
            const statusCfg = statusConfig[student.status as keyof typeof statusConfig]
            void statusCfg
            
            return (
              <div key={student.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-slate-600">
                      {student.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <span className="font-medium text-slate-900">{student.name}</span>
                </div>

                <div className="flex items-center gap-2">
                  {Object.entries(statusConfig).map(([status, cfg]) => (
                    <button
                      key={status}
                      onClick={() => canEdit && updateStatus(student.id, status)}
                      disabled={!canEdit}
                      className={`p-2 rounded-lg border transition-colors ${
                        student.status === status
                          ? cfg.color
                          : 'border-slate-200 text-slate-400 hover:border-slate-300'
                      } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title={canEdit ? cfg.label : 'No puedes modificar la asistencia de este día'}
                    >
                      <cfg.icon className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      </>
      )}
    </div>
  )
}
