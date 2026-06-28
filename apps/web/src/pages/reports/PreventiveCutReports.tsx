import { useState } from 'react'
import {
  ShieldAlert,
  ArrowLeft,
  Download,
  FileDown,
  Loader2,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useReportsData } from '../../hooks/useReportsData'
import { preventiveCutsApi } from '../../lib/api'

interface CutSubject {
  subjectName: string
  grade: number | null
  isRisk: boolean
  hasData: boolean
}
interface CutStudent {
  studentEnrollmentId: string
  name: string
  subjects: CutSubject[]
  average: number | null
  atRiskCount: number
  overallRisk: boolean
}
interface GroupCut {
  cutoffDate: string
  threshold: number
  group: { id: string; name: string; gradeName: string }
  term: { id: string; name: string }
  subjectNames: string[]
  students: CutStudent[]
  totalStudents: number
  atRiskStudents: number
}

function downloadBlob(data: BlobPart, filename: string) {
  const blob = new Blob([data], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function PreventiveCutReports() {
  const {
    academicYears, terms, groups,
    gradingScale,
    filterYear, setFilterYear,
    filterPeriod, setFilterPeriod,
    filterGrade, setFilterGrade,
  } = useReportsData()

  const [cutoffDate, setCutoffDate] = useState(() => new Date().toISOString().split('T')[0])
  const [threshold, setThreshold] = useState<number>(gradingScale.minPassingGrade || 3.0)
  const [data, setData] = useState<GroupCut | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloadingGroup, setDownloadingGroup] = useState(false)
  const [downloadingStudent, setDownloadingStudent] = useState<string | null>(null)

  const canRun = filterPeriod && filterGrade && filterGrade !== 'all'

  const handleRun = async () => {
    if (!canRun) {
      setError('Selecciona período y un grupo específico')
      return
    }
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const res = await preventiveCutsApi.groupView({
        academicTermId: filterPeriod,
        groupId: filterGrade,
        cutoffDate,
        threshold,
      })
      setData(res.data as GroupCut)
    } catch (e: any) {
      setError(e?.response?.data?.message || 'No se pudo generar el corte preventivo.')
    } finally {
      setLoading(false)
    }
  }

  const handleGroupPdf = async () => {
    if (!canRun) return
    setDownloadingGroup(true)
    try {
      const res = await preventiveCutsApi.groupPdf({ academicTermId: filterPeriod, groupId: filterGrade, cutoffDate, threshold })
      downloadBlob(res.data, `corte-preventivo-${data?.group.gradeName || ''}-${data?.group.name || 'grupo'}.pdf`)
    } catch {
      setError('No se pudo descargar el PDF del grupo.')
    } finally {
      setDownloadingGroup(false)
    }
  }

  const handleStudentPdf = async (student: CutStudent) => {
    if (!canRun) return
    setDownloadingStudent(student.studentEnrollmentId)
    try {
      const res = await preventiveCutsApi.studentPdf({
        academicTermId: filterPeriod, groupId: filterGrade,
        studentEnrollmentId: student.studentEnrollmentId, cutoffDate, threshold,
      })
      downloadBlob(res.data, `corte-${student.name.replace(/\s+/g, '_').toLowerCase()}.pdf`)
    } catch {
      setError('No se pudo descargar el PDF del estudiante.')
    } finally {
      setDownloadingStudent(null)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/reports" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Corte Preventivo</h1>
            <p className="text-sm text-slate-500">Cómo va cada estudiante antes de cerrar el período</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="lg:col-span-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">Año Escolar</label>
            <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
              <option value="">Seleccionar...</option>
              {academicYears.map(y => (
                <option key={y.id} value={y.id}>{y.year}{y.status === 'ACTIVE' ? ' - Activo' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Período</label>
            <select value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
              <option value="">Seleccionar...</option>
              {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Grupo</label>
            <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
              <option value="all">Seleccionar...</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.grade?.name} {g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fecha de corte</label>
            <input type="date" value={cutoffDate} onChange={(e) => setCutoffDate(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Umbral de riesgo</label>
            <input type="number" step="0.1" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
          </div>
          <div className="flex items-end">
            <button onClick={handleRun} disabled={loading || !canRun} className="px-4 py-1.5 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 w-full disabled:opacity-50 flex items-center justify-center gap-1.5">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando...</> : 'Generar corte'}
            </button>
          </div>
        </div>
        <p className="text-[11px] text-orange-700/70 mt-3">
          Las notas se calculan con las actividades calificadas hasta la fecha de corte. Una materia sin
          calificaciones aún aparece como "sin datos", no como riesgo.
        </p>
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      )}

      {/* Resultados */}
      {data && (
        <div className="mt-6">
          {/* Resumen + descarga grupo */}
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div className="flex gap-4">
              <div className="bg-white border border-slate-200 rounded-lg px-4 py-2 text-center">
                <p className="text-2xl font-bold text-slate-900">{data.totalStudents}</p>
                <p className="text-xs text-slate-500">Estudiantes</p>
              </div>
              <div className="bg-white border border-red-200 rounded-lg px-4 py-2 text-center">
                <p className="text-2xl font-bold text-red-600">{data.atRiskStudents}</p>
                <p className="text-xs text-slate-500">En riesgo</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg px-4 py-2 text-center">
                <p className="text-2xl font-bold text-slate-700">{data.subjectNames.length}</p>
                <p className="text-xs text-slate-500">Materias</p>
              </div>
            </div>
            <button onClick={handleGroupPdf} disabled={downloadingGroup} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm disabled:opacity-50">
              {downloadingGroup ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              Descargar PDF del grupo
            </button>
          </div>

          {/* Tabla */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Estudiante</th>
                  <th className="px-3 py-2 text-center">Prom. parcial</th>
                  <th className="px-3 py-2 text-center">En riesgo</th>
                  <th className="px-3 py-2 text-left">Materias en riesgo</th>
                  <th className="px-3 py-2 text-center">PDF</th>
                </tr>
              </thead>
              <tbody>
                {data.students.map((s, idx) => {
                  const riskSubjects = s.subjects.filter(x => x.isRisk)
                  return (
                    <tr key={s.studentEnrollmentId} className={`border-b hover:bg-slate-50 ${s.overallRisk ? 'bg-red-50/40' : ''}`}>
                      <td className="px-3 py-2 text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-2 font-medium text-slate-800">{s.name}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={s.average !== null && s.average < data.threshold ? 'text-red-600 font-semibold' : 'text-slate-700'}>
                          {s.average !== null ? s.average.toFixed(1) : 's/d'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {s.atRiskCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                            <AlertTriangle className="w-3 h-3" /> {s.atRiskCount}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-green-600 text-xs">
                            <CheckCircle className="w-3.5 h-3.5" /> Al día
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {riskSubjects.length === 0 ? (
                            <span className="text-slate-400 text-xs">—</span>
                          ) : riskSubjects.map((r) => (
                            <span key={r.subjectName} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 border border-red-200 text-red-700 text-[11px]">
                              {r.subjectName} <span className="font-semibold">{r.grade?.toFixed(1)}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => handleStudentPdf(s)}
                          disabled={downloadingStudent === s.studentEnrollmentId}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-orange-50 hover:text-orange-600 transition disabled:opacity-50"
                          title="Descargar corte de este estudiante"
                        >
                          {downloadingStudent === s.studentEnrollmentId
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Download className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!data && !loading && !error && (
        <div className="mt-6 text-center py-16 text-slate-500">
          <ShieldAlert className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>Selecciona período, grupo y fecha de corte, luego genera el corte preventivo.</p>
        </div>
      )}
    </div>
  )
}
