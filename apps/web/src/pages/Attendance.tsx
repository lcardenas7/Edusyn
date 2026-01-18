import { useState, useEffect, useMemo } from 'react'
import { Calendar, Check, X, Clock, FileText, ChevronDown, AlertTriangle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { teacherAssignmentsApi } from '../lib/api'

interface TeacherAssignment {
  id: string
  subject: { id: string; name: string }
  group: { id: string; name: string; grade?: { name: string } }
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
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  
  // Mock students - se conectará a API después
  const mockStudents = selectedAssignment ? [
    { id: '1', name: 'Juan Pérez', status: 'PRESENT' },
    { id: '2', name: 'María López', status: 'PRESENT' },
    { id: '3', name: 'Carlos Martínez', status: 'ABSENT' },
    { id: '4', name: 'Ana González', status: 'PRESENT' },
    { id: '5', name: 'Pedro Ramírez', status: 'LATE' },
  ] : []
  
  const [students, setStudents] = useState(mockStudents)
  
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
  }, [user?.id, isTeacher, isAdmin])
  
  // Actualizar estudiantes cuando cambia la asignación
  useEffect(() => {
    if (selectedAssignment) {
      setStudents([
        { id: '1', name: 'Juan Pérez', status: 'PRESENT' },
        { id: '2', name: 'María López', status: 'PRESENT' },
        { id: '3', name: 'Carlos Martínez', status: 'ABSENT' },
        { id: '4', name: 'Ana González', status: 'PRESENT' },
        { id: '5', name: 'Pedro Ramírez', status: 'LATE' },
      ])
    } else {
      setStudents([])
    }
  }, [selectedAssignment])

  const updateStatus = (studentId: string, status: string) => {
    setStudents(students.map(s => s.id === studentId ? { ...s, status } : s))
  }

  const summary = {
    present: students.filter(s => s.status === 'PRESENT').length,
    absent: students.filter(s => s.status === 'ABSENT').length,
    late: students.filter(s => s.status === 'LATE').length,
    excused: students.filter(s => s.status === 'EXCUSED').length,
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Asistencia</h1>
          <p className="text-slate-500 mt-1">Control de asistencia diaria</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Check className="w-4 h-4" />
          Guardar Asistencia
        </button>
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
            <Calendar className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="mt-4 text-slate-500">No tienes asignaturas asignadas</p>
            <p className="text-sm text-slate-400">Contacta al coordinador para asignar tu carga académica</p>
          </div>
        </div>
      ) : (
      <>
      <div className="flex gap-4 mb-6">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />

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
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
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
          {students.map((student) => {
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
                      onClick={() => updateStatus(student.id, status)}
                      className={`p-2 rounded-lg border transition-colors ${
                        student.status === status
                          ? cfg.color
                          : 'border-slate-200 text-slate-400 hover:border-slate-300'
                      }`}
                      title={cfg.label}
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
