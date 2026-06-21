import { useState, useEffect, useMemo } from 'react'
import { Calendar, Check, X, Clock, FileText, ChevronDown, AlertTriangle, Save, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { DiagnosisBadge } from '../components/StudentBadges'
import { teacherAssignmentsApi, academicStudentsApi, attendanceApi, tutoringAttendanceApi, academicYearsApi, storageApi } from '../lib/api'
import { toast, TOAST } from '../lib/toast'
import { useSaveStatus } from '../hooks/useSaveStatus'
import SaveStatusPill from '../components/SaveStatusPill'
import TodayClassesWidget from '../components/TodayClassesWidget'

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
  const isAdmin = userRoles.includes('ADMIN_INSTITUTIONAL') || userRoles.includes('SUPERADMIN') || userRoles.includes('COORDINADOR') || userRoles.includes('RECTOR')

  // ─── Tutoría state ───
  const [activeTab, setActiveTab] = useState<'subject' | 'tutoring'>('subject')
  const [tutoringEnabled, setTutoringEnabled] = useState(false)
  const [directedGroups, setDirectedGroups] = useState<Array<{ id: string; name: string; gradeName?: string }>>([]) 
  const [selectedTutoringGroupId, setSelectedTutoringGroupId] = useState<string>('')
  const [tutoringStudents, setTutoringStudents] = useState<Array<{ id: string; name: string; enrollmentId: string; status: string; hasDiagnosis?: boolean; diagnosisType?: string }>>([])
  const [loadingTutoringStudents, setLoadingTutoringStudents] = useState(false)
  const [savingTutoring, setSavingTutoring] = useState(false)
  const [togglingTutoring, setTogglingTutoring] = useState(false)
  const [mySignatureUrl, setMySignatureUrl] = useState<string | null>(null)
  const [uploadingSignature, setUploadingSignature] = useState(false)
  
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([])
  const [selectedAssignment, setSelectedAssignment] = useState<TeacherAssignment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filtros separados de asignatura y grupo
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('')
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  
  // Docente puede modificar asistencia para cualquier fecha seleccionada
  const canEdit = isAdmin || isTeacher
  
  const [students, setStudents] = useState<Array<{ id: string; name: string; enrollmentId: string; status: string; hasDiagnosis?: boolean; diagnosisType?: string }>>([])
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
  
  // Cargar estado de tutoría
  useEffect(() => {
    const fetchTutoringStatus = async () => {
      try {
        const response = await tutoringAttendanceApi.getStatus()
        setTutoringEnabled(response.data.enabled)
        setDirectedGroups(response.data.directedGroups || [])
        if (response.data.directedGroups?.length > 0) {
          setSelectedTutoringGroupId(response.data.directedGroups[0].id)
        }
      } catch {
        setTutoringEnabled(false)
      }
    }
    fetchTutoringStatus()
    // Load user's existing signature
    if (user?.signatureImageUrl) setMySignatureUrl(user.signatureImageUrl)
  }, [])

  // Cargar estudiantes de tutoría cuando cambia el grupo seleccionado
  useEffect(() => {
    if (activeTab !== 'tutoring' || !selectedTutoringGroupId) return
    const fetchTutoringStudents = async () => {
      setLoadingTutoringStudents(true)
      try {
        // Obtener academicYearId del primer assignment o del año activo
        let yearId = assignments[0]?.academicYear?.id
        if (!yearId) {
          const yearsRes = await academicYearsApi.getAll()
          const activeYear = (yearsRes.data || []).find((y: any) => y.status === 'ACTIVE')
          if (!activeYear) { setTutoringStudents([]); setLoadingTutoringStudents(false); return }
          yearId = activeYear.id
        }
        const res = await academicStudentsApi.getByGroup({ groupId: selectedTutoringGroupId, academicYearId: yearId })
        const mapped = (res.data || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          enrollmentId: s.enrollmentId,
          status: 'PRESENT',
        }))
        setTutoringStudents(mapped)

        // Cargar registros guardados para esta fecha
        try {
          const savedRes = await tutoringAttendanceApi.getByGroup(selectedTutoringGroupId, date)
          const saved = savedRes.data || []
          if (saved.length > 0) {
            setTutoringStudents(prev => prev.map(student => {
              const record = saved.find((r: any) => r.studentEnrollmentId === student.enrollmentId)
              return record ? { ...student, status: record.status } : student
            }))
          }
        } catch { /* sin registros previos */ }
      } catch (err) {
        console.error('Error loading tutoring students:', err)
        setTutoringStudents([])
      } finally {
        setLoadingTutoringStudents(false)
      }
    }
    fetchTutoringStudents()
  }, [activeTab, selectedTutoringGroupId, date])

  const saveTutoringAttendance = async () => {
    if (!selectedTutoringGroupId) return
    setSavingTutoring(true)
    try {
      await tutoringAttendanceApi.record({
        groupId: selectedTutoringGroupId,
        date,
        records: tutoringStudents.map(s => ({
          studentEnrollmentId: s.enrollmentId,
          status: s.status,
        })),
      })
      TOAST.attendance.saved(tutoringStudents.length, 'Tutoría')
    } catch (err: any) {
      TOAST.attendance.error(err)
    } finally {
      setSavingTutoring(false)
    }
  }

  const updateTutoringStatus = (studentId: string, status: string) => {
    setTutoringStudents(prev => prev.map(s => s.id === studentId ? { ...s, status } : s))
  }

  const tutoringSummary = {
    present: tutoringStudents.filter(s => s.status === 'PRESENT').length,
    absent: tutoringStudents.filter(s => s.status === 'ABSENT').length,
    late: tutoringStudents.filter(s => s.status === 'LATE').length,
    excused: tutoringStudents.filter(s => s.status === 'EXCUSED').length,
  }

  const showTutoringTab = tutoringEnabled && directedGroups.length > 0

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
  const { status: saveStatus, withSave } = useSaveStatus()

  const updateStatus = (studentId: string, status: string) => {
    setStudents(students.map(s => s.id === studentId ? { ...s, status } : s))
  }

  const saveAttendance = async () => {
    if (!selectedAssignment?.id) {
      toast.warning('Selecciona una asignatura y grupo primero')
      return
    }

    setSaving(true)

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

      TOAST.attendance.saved(
        students.length,
        `${selectedAssignment.subject?.name} · ${selectedAssignment.group?.name}`,
      )
    } catch (err: any) {
      console.error('Error saving attendance:', err)
      TOAST.attendance.error(err)
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
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            to="/reports/attendance"
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Ver reportes
          </Link>
          <button 
            onClick={activeTab === 'tutoring' ? saveTutoringAttendance : saveAttendance}
            disabled={activeTab === 'tutoring' ? (savingTutoring || !selectedTutoringGroupId || !canEdit) : (saving || !selectedAssignment || !canEdit)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {(activeTab === 'tutoring' ? savingTutoring : saving) ? 'Guardando...' : 'Guardar Asistencia'}
          </button>
        </div>
      </div>

      {/* Banner para admin: habilitar/deshabilitar tutoría */}
      {isAdmin && !tutoringEnabled && (
        <div className="mb-4 p-4 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-between">
          <div>
            <p className="font-medium text-purple-800">Asistencia de Tutoría</p>
            <p className="text-sm text-purple-600">Habilitar esta función permite a los directores de grupo tomar asistencia diaria de tutoría.</p>
            <p className="text-xs text-purple-500 mt-1">Para asignar un director de grupo, vaya a <strong>Gestión Académica → Carga Académica</strong> y edite el grupo para asignarle un director.</p>
          </div>
          <button
            onClick={async () => {
              setTogglingTutoring(true)
              try {
                await tutoringAttendanceApi.toggle(true)
                setTutoringEnabled(true)
                const res = await tutoringAttendanceApi.getStatus()
                setDirectedGroups(res.data.directedGroups || [])
                if (res.data.directedGroups?.length > 0) setSelectedTutoringGroupId(res.data.directedGroups[0].id)
              } catch (err: any) {
                toast.error(err)
              } finally {
                setTogglingTutoring(false)
              }
            }}
            disabled={togglingTutoring}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 text-sm whitespace-nowrap"
          >
            {togglingTutoring ? 'Habilitando...' : 'Habilitar Tutoría'}
          </button>
        </div>
      )}

      {/* Banner admin: tutoría habilitada — opción de deshabilitar */}
      {isAdmin && tutoringEnabled && (
        <div className="mb-4 p-4 rounded-lg bg-green-50 border border-green-200 flex items-center justify-between">
          <div>
            <p className="font-medium text-green-800">✓ Asistencia de Tutoría habilitada</p>
            <p className="text-xs text-green-600 mt-1">Los directores de grupo pueden tomar asistencia diaria de tutoría. Para asignar un director, vaya a <strong>Gestión Académica → Carga Académica</strong> y edite el grupo.</p>
          </div>
          <button
            onClick={async () => {
              if (!confirm('¿Desea deshabilitar la asistencia de tutoría?')) return
              setTogglingTutoring(true)
              try {
                await tutoringAttendanceApi.toggle(false)
                setTutoringEnabled(false)
                setDirectedGroups([])
                setActiveTab('subject')
              } catch (err: any) {
                toast.error(err)
              } finally {
                setTogglingTutoring(false)
              }
            }}
            disabled={togglingTutoring}
            className="px-3 py-1.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 text-xs whitespace-nowrap"
          >
            {togglingTutoring ? 'Deshabilitando...' : 'Deshabilitar'}
          </button>
        </div>
      )}

      {/* Tabs: Asignatura / Tutoría */}
      {showTutoringTab && (
        <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveTab('subject')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'subject' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Por Asignatura
          </button>
          <button
            onClick={() => setActiveTab('tutoring')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'tutoring' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            Tutoría
          </button>
        </div>
      )}

      {/* Mensaje de advertencia para docentes */}
      {!canEdit && !isAdmin && (
        <div className="mb-4 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          <span>No tienes permisos para modificar la asistencia de este grupo.</span>
        </div>
      )}

      {/* Widget: Tus clases de hoy (solo para docentes) */}
      {activeTab === 'subject' && isTeacher && !loading && assignments.length > 0 && (
        <TodayClassesWidget
          assignments={assignments}
          selectedId={selectedAssignment?.id}
          date={date}
          onSelect={(a) => {
            setSelectedSubjectId(a.subject.id)
            setSelectedGroupId(a.group.id)
          }}
        />
      )}

      {/* Status de guardado */}
      {activeTab === 'subject' && (
        <div className="mb-4 flex justify-end">
          <SaveStatusPill status={saveStatus} />
        </div>
      )}

      {/* ═══ TAB: TUTORÍA ═══ */}
      {activeTab === 'tutoring' && showTutoringTab ? (
        <>
          <div className="flex gap-4 mb-6 flex-wrap">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
            />
            <div className="relative">
              <select
                value={selectedTutoringGroupId}
                onChange={(e) => setSelectedTutoringGroupId(e.target.value)}
                className="appearance-none pl-4 pr-10 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none min-w-[200px]"
              >
                {directedGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.gradeName} {g.name}
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
                  <p className="text-2xl font-bold text-slate-900">{tutoringSummary.present}</p>
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
                  <p className="text-2xl font-bold text-slate-900">{tutoringSummary.absent}</p>
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
                  <p className="text-2xl font-bold text-slate-900">{tutoringSummary.late}</p>
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
                  <p className="text-2xl font-bold text-slate-900">{tutoringSummary.excused}</p>
                  <p className="text-sm text-slate-500">Excusas</p>
                </div>
              </div>
            </div>
          </div>

          {/* Firma del tutor */}
          {!isAdmin && directedGroups.length > 0 && (
            <div className="mb-6 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-600" />
                Mi Firma (Director de Grupo)
              </h3>
              <p className="text-xs text-slate-500 mb-3">Esta firma aparecerá automáticamente en los boletines de tu grupo.</p>
              <div className="flex items-center gap-4">
                {mySignatureUrl ? (
                  <div className="flex items-center gap-4">
                    <div className="border border-slate-200 rounded-lg p-2 bg-slate-50">
                      <img src={mySignatureUrl} alt="Mi firma" className="h-16 object-contain" />
                    </div>
                    <button
                      onClick={() => document.getElementById('signature-upload')?.click()}
                      disabled={uploadingSignature}
                      className="px-3 py-1.5 text-sm border border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-50"
                    >
                      {uploadingSignature ? 'Subiendo...' : 'Cambiar firma'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => document.getElementById('signature-upload')?.click()}
                    disabled={uploadingSignature}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 text-sm"
                  >
                    {uploadingSignature ? 'Subiendo...' : 'Subir mi firma'}
                  </button>
                )}
                <input
                  id="signature-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setUploadingSignature(true)
                    try {
                      const res = await storageApi.uploadMySignature(file)
                      const url = res.data?.data?.url || res.data?.data?.path || ''
                      if (url) setMySignatureUrl(url)
                    } catch (err: any) {
                      toast.error(err)
                    } finally {
                      setUploadingSignature(false)
                      e.target.value = ''
                    }
                  }}
                />
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-purple-600" />
                <h2 className="font-semibold text-slate-900">Lista de Estudiantes — Tutoría</h2>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {loadingTutoringStudents ? (
                <div className="px-6 py-8 text-center text-slate-500">
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
                    Cargando estudiantes...
                  </div>
                </div>
              ) : tutoringStudents.length === 0 ? (
                <div className="px-6 py-8 text-center text-slate-500">
                  No hay estudiantes matriculados en este grupo
                </div>
              ) : tutoringStudents.map((student, idx) => (
                <div key={student.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center text-sm font-medium text-slate-500">{idx + 1}.</span>
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-purple-600">
                        {student.name.split(' ').map((n: string) => n[0]).join('')}
                      </span>
                    </div>
                    <span className="font-medium text-slate-900">{student.name}<DiagnosisBadge student={student} /></span>
                  </div>
                  <div className="flex items-center gap-2">
                    {Object.entries(statusConfig).map(([status, cfg]) => (
                      <button
                        key={status}
                        onClick={() => canEdit && updateTutoringStatus(student.id, status)}
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
              ))}
            </div>
          </div>
        </>
      ) : loading ? (
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
          ) : students.map((student, idx) => {
            const statusCfg = statusConfig[student.status as keyof typeof statusConfig]
            void statusCfg
            
            return (
              <div key={student.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="w-6 text-center text-sm font-medium text-slate-500">{idx + 1}.</span>
                  <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-slate-600">
                      {student.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <span className="font-medium text-slate-900">{student.name}<DiagnosisBadge student={student} /></span>
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
