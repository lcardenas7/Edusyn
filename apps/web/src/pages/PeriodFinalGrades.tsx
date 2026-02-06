import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { 
  Save,
  Search,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { 
  academicYearsApi, 
  groupsApi, 
  academicStudentsApi,
  periodFinalGradesApi 
} from '../lib/api'

interface AcademicTerm {
  id: string
  name: string
  order: number
}

interface Subject {
  id: string
  name: string
}

interface Student {
  id: string
  firstName: string
  lastName: string
  enrollmentId: string
}

interface GradeEntry {
  studentEnrollmentId: string
  studentName: string
  subjectId: string
  subjectName: string
  finalScore: number | null
  observations: string
  saved: boolean
}

export default function PeriodFinalGrades() {
  useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [academicYears, setAcademicYears] = useState<any[]>([])
  const [selectedYearId, setSelectedYearId] = useState('')
  const [terms, setTerms] = useState<AcademicTerm[]>([])
  const [selectedTermId, setSelectedTermId] = useState('')
  const [groups, setGroups] = useState<any[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  const [grades, setGrades] = useState<GradeEntry[]>([])

  useEffect(() => {
    loadAcademicYears()
  }, [])

  useEffect(() => {
    if (selectedYearId) {
      const year = academicYears.find(y => y.id === selectedYearId)
      setTerms(year?.terms || [])
      setSelectedTermId('')
      loadGroups()
    }
  }, [selectedYearId])

  useEffect(() => {
    if (selectedGroupId && selectedTermId) {
      loadStudentsAndSubjects()
    }
  }, [selectedGroupId, selectedTermId])

  useEffect(() => {
    if (selectedSubjectId && students.length > 0 && selectedTermId) {
      loadExistingGrades()
    }
  }, [selectedSubjectId, students, selectedTermId])

  const loadAcademicYears = async () => {
    try {
      const response = await academicYearsApi.getAll()
      setAcademicYears(response.data)
      const current = response.data.find((y: any) => y.isCurrent)
      if (current) {
        setSelectedYearId(current.id)
      }
    } catch (err) {
      console.error('Error loading academic years:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadGroups = async () => {
    try {
      const response = await groupsApi.getAll()
      setGroups(response.data)
    } catch (err) {
      console.error('Error loading groups:', err)
    }
  }

  const loadStudentsAndSubjects = async () => {
    try {
      // Usar academicStudentsApi para mantener separación de dominios
      const studentsRes = await academicStudentsApi.getByGroup({ groupId: selectedGroupId, academicYearId: selectedYearId })
      // El endpoint académico retorna { id, name, enrollmentId }, adaptar al formato esperado
      const studentsList = (studentsRes.data || []).map((s: any) => {
        const [firstName, ...lastParts] = s.name.split(' ')
        return {
          id: s.id,
          firstName,
          lastName: lastParts.join(' '),
          enrollmentId: s.enrollmentId,
        }
      })
      setStudents(studentsList)

      // Obtener asignaturas del grupo (desde las asignaciones de docentes)
      const group = groups.find(g => g.id === selectedGroupId)
      if (group?.grade?.areas) {
        const allSubjects: Subject[] = []
        group.grade.areas.forEach((area: any) => {
          area.subjects?.forEach((subject: any) => {
            allSubjects.push({ id: subject.id, name: subject.name })
          })
        })
        setSubjects(allSubjects)
      }
    } catch (err) {
      console.error('Error loading students/subjects:', err)
    }
  }

  const loadExistingGrades = async () => {
    try {
      const response = await periodFinalGradesApi.getByGroup(selectedGroupId, selectedTermId)
      const existingGrades = response.data

      // Crear entradas de notas para cada estudiante
      const gradeEntries: GradeEntry[] = students.map(student => {
        const existing = existingGrades.find(
          (g: any) => g.studentEnrollmentId === student.enrollmentId && g.subjectId === selectedSubjectId
        )
        return {
          studentEnrollmentId: student.enrollmentId,
          studentName: `${student.lastName}, ${student.firstName}`,
          subjectId: selectedSubjectId,
          subjectName: subjects.find(s => s.id === selectedSubjectId)?.name || '',
          finalScore: existing?.finalScore ? parseFloat(existing.finalScore) : null,
          observations: existing?.observations || '',
          saved: !!existing,
        }
      })

      setGrades(gradeEntries.sort((a, b) => a.studentName.localeCompare(b.studentName)))
    } catch (err) {
      console.error('Error loading existing grades:', err)
    }
  }

  const handleScoreChange = (enrollmentId: string, value: string) => {
    const score = value === '' ? null : parseFloat(value)
    if (score !== null && (score < 0 || score > 5)) return

    setGrades(prev => prev.map(g => 
      g.studentEnrollmentId === enrollmentId 
        ? { ...g, finalScore: score, saved: false }
        : g
    ))
  }

  const handleObservationChange = (enrollmentId: string, value: string) => {
    setGrades(prev => prev.map(g => 
      g.studentEnrollmentId === enrollmentId 
        ? { ...g, observations: value, saved: false }
        : g
    ))
  }

  const handleSaveAll = async () => {
    const gradesToSave = grades
      .filter(g => g.finalScore !== null && !g.saved)
      .map(g => ({
        studentEnrollmentId: g.studentEnrollmentId,
        academicTermId: selectedTermId,
        subjectId: selectedSubjectId,
        finalScore: g.finalScore!,
        observations: g.observations || undefined,
      }))

    if (gradesToSave.length === 0) {
      setMessage({ type: 'error', text: 'No hay notas para guardar' })
      return
    }

    setSaving(true)
    try {
      await periodFinalGradesApi.bulkUpsert(gradesToSave)
      setGrades(prev => prev.map(g => ({ ...g, saved: g.finalScore !== null })))
      setMessage({ type: 'success', text: `${gradesToSave.length} notas guardadas correctamente` })
    } catch (err) {
      console.error('Error saving grades:', err)
      setMessage({ type: 'error', text: 'Error al guardar las notas' })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const getScoreColor = (score: number | null) => {
    if (score === null) return ''
    if (score >= 4.6) return 'bg-green-100 text-green-800 border-green-300'
    if (score >= 4.0) return 'bg-blue-100 text-blue-800 border-blue-300'
    if (score >= 3.0) return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    return 'bg-red-100 text-red-800 border-red-300'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Ingresar Nota Final de Período</h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">Ingresa notas finales directamente (solo Coordinador/Admin)</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Año Académico */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Año Académico</label>
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar...</option>
              {academicYears.map(year => (
                <option key={year.id} value={year.id}>{year.year}</option>
              ))}
            </select>
          </div>

          {/* Período */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Período</label>
            <select
              value={selectedTermId}
              onChange={(e) => setSelectedTermId(e.target.value)}
              disabled={!selectedYearId}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
            >
              <option value="">Seleccionar...</option>
              {terms.map(term => (
                <option key={term.id} value={term.id}>{term.name}</option>
              ))}
            </select>
          </div>

          {/* Grupo */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Grupo</label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              disabled={!selectedYearId}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
            >
              <option value="">Seleccionar...</option>
              {groups.map(group => (
                <option key={group.id} value={group.id}>
                  {group.grade?.name} - {group.name}
                </option>
              ))}
            </select>
          </div>

          {/* Asignatura */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Asignatura</label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              disabled={!selectedGroupId || subjects.length === 0}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
            >
              <option value="">Seleccionar...</option>
              {subjects.map(subject => (
                <option key={subject.id} value={subject.id}>{subject.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Mensaje */}
      {message && (
        <div className={`mb-4 p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* Tabla de Notas */}
      {selectedSubjectId && grades.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              Notas - {subjects.find(s => s.id === selectedSubjectId)?.name}
            </h2>
            <button
              onClick={handleSaveAll}
              disabled={saving || !grades.some(g => g.finalScore !== null && !g.saved)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Guardando...' : 'Guardar Todo'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Estudiante
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider w-32">
                    Nota Final
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Observaciones
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider w-24">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {grades.map((grade) => (
                  <tr key={grade.studentEnrollmentId} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-medium text-slate-900">{grade.studentName}</span>
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="5"
                        value={grade.finalScore ?? ''}
                        onChange={(e) => handleScoreChange(grade.studentEnrollmentId, e.target.value)}
                        className={`w-full px-3 py-2 text-center border rounded-lg focus:ring-2 focus:ring-blue-500 ${getScoreColor(grade.finalScore)}`}
                        placeholder="0.0"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        value={grade.observations}
                        onChange={(e) => handleObservationChange(grade.studentEnrollmentId, e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Observaciones (opcional)"
                      />
                    </td>
                    <td className="px-6 py-4 text-center">
                      {grade.saved ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                          <CheckCircle className="w-3 h-3" />
                          Guardado
                        </span>
                      ) : grade.finalScore !== null ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs">
                          Pendiente
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">Sin nota</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mensaje cuando no hay selección */}
      {(!selectedSubjectId || grades.length === 0) && selectedGroupId && selectedTermId && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <Search className="w-12 h-12 mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">Selecciona una asignatura para ingresar las notas finales</p>
        </div>
      )}
    </div>
  )
}
