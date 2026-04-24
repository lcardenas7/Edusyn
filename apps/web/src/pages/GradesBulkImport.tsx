import { useState, useEffect } from 'react'
import { 
  Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, XCircle, 
  Users, BookOpen, ArrowRight, Loader2, Info, UserPlus, UserMinus, Download,
  Heart, ToggleLeft, ToggleRight, UserCheck
} from 'lucide-react'
import { gradesBulkImportApi, GradesImportPreview, GradesImportResult, ConvivenciaStatus } from '../lib/api'

type Tab = 'import' | 'convivencia'
type Step = 'select' | 'preview' | 'options' | 'importing' | 'result'

interface GradeOption {
  id: string
  name: string
  stage: string
  groups: Array<{ id: string; name: string }>
}

interface TermOption {
  id: string
  name: string
  status: string
}

export default function GradesBulkImport() {
  const [activeTab, setActiveTab] = useState<Tab>('import')
  const [step, setStep] = useState<Step>('select')
  const [grades, setGrades] = useState<GradeOption[]>([])
  const [terms, setTerms] = useState<TermOption[]>([])
  const [selectedGrade, setSelectedGrade] = useState('')
  const [selectedTerm, setSelectedTerm] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<GradesImportPreview | null>(null)
  const [result, setResult] = useState<GradesImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Convivencia
  const [convivenciaGrade, setConvivenciaGrade] = useState('')
  const [convivenciaStatus, setConvivenciaStatus] = useState<ConvivenciaStatus[]>([])
  const [convivenciaLoading, setConvivenciaLoading] = useState(false)

  // Opciones de importación
  const [options, setOptions] = useState({
    createMissingStudents: false,
    deactivateMissingStudents: false,
    overwriteExistingGrades: true,
  })

  // Cargar grados y períodos disponibles
  useEffect(() => {
    const loadData = async () => {
      try {
        const [gradesRes, termsRes] = await Promise.all([
          gradesBulkImportApi.getAvailableGrades(),
          gradesBulkImportApi.getAvailableTerms(),
        ])
        setGrades(gradesRes.data)
        setTerms(termsRes.data)
        
        // Seleccionar primer período abierto por defecto
        const openTerm = termsRes.data.find(t => t.status === 'OPEN')
        if (openTerm) setSelectedTerm(openTerm.id)
      } catch (err: any) {
        setError(err.response?.data?.message || 'Error cargando datos')
      }
    }
    loadData()
  }, [])

  // Cargar estado de Convivencia cuando se selecciona un grado
  useEffect(() => {
    if (convivenciaGrade) {
      loadConvivenciaStatus(convivenciaGrade)
    }
  }, [convivenciaGrade])

  const loadConvivenciaStatus = async (gradeId: string) => {
    setConvivenciaLoading(true)
    try {
      const res = await gradesBulkImportApi.getConvivenciaStatus(gradeId)
      setConvivenciaStatus(res.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error cargando estado de Convivencia')
    } finally {
      setConvivenciaLoading(false)
    }
  }

  const handleToggleConvivencia = async (groupId: string, currentEnabled: boolean) => {
    try {
      const res = await gradesBulkImportApi.toggleConvivencia(groupId, !currentEnabled)
      if (res.data.success) {
        // Recargar estado
        await loadConvivenciaStatus(convivenciaGrade)
        alert(res.data.message)
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error actualizando Convivencia')
    }
  }

  const handleDownloadTemplate = async () => {
    if (!selectedGrade) {
      setError('Seleccione un grado antes de descargar la plantilla')
      return
    }

    try {
      setLoading(true)
      const res = await gradesBulkImportApi.downloadTemplate(selectedGrade)
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data])
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `plantilla_notas_${selectedGradeInfo?.name || selectedGrade}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(err.response?.data?.message || 'No se pudo descargar la plantilla')
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      if (!f.name.match(/\.(xlsx|xls)$/i)) {
        setError('Solo se permiten archivos Excel (.xlsx, .xls)')
        return
      }
      setFile(f)
      setError('')
    }
  }

  const handlePreview = async () => {
    if (!file || !selectedGrade || !selectedTerm) {
      setError('Debe seleccionar grado, período y archivo')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await gradesBulkImportApi.preview(file, selectedGrade, selectedTerm)
      setPreview(res.data)
      setStep('preview')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error analizando archivo')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!file || !selectedGrade || !selectedTerm) return

    setStep('importing')
    setError('')

    try {
      const res = await gradesBulkImportApi.execute(file, selectedGrade, selectedTerm, options)
      setResult(res.data)
      setStep('result')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error importando notas')
      setStep('options')
    }
  }

  const resetForm = () => {
    setStep('select')
    setFile(null)
    setPreview(null)
    setResult(null)
    setError('')
    setOptions({
      createMissingStudents: false,
      deactivateMissingStudents: false,
      overwriteExistingGrades: true,
    })
  }

  const selectedGradeInfo = grades.find(g => g.id === selectedGrade)
  const selectedTermInfo = terms.find(t => t.id === selectedTerm)

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-indigo-600" />
            Gestión Académica Masiva
          </h1>
          <p className="text-gray-600 mt-1">
            Importación de notas y configuración de Convivencia
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('import')}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
              activeTab === 'import'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 border'
            }`}
          >
            <Upload className="w-4 h-4" />
            Importar Notas
          </button>
          <button
            onClick={() => setActiveTab('convivencia')}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
              activeTab === 'convivencia'
                ? 'bg-pink-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 border'
            }`}
          >
            <Heart className="w-4 h-4" />
            Convivencia
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 font-medium">Error</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        {/* TAB: CONVIVENCIA */}
        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'convivencia' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3 bg-pink-100 rounded-lg">
                  <Heart className="w-6 h-6 text-pink-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Asignatura Convivencia</h2>
                  <p className="text-gray-600 text-sm">
                    Active la asignatura "Convivencia" para que el tutor de cada grupo pueda ingresar notas de comportamiento y convivencia escolar.
                  </p>
                </div>
              </div>

              {/* Selector de grado */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seleccione un grado
                </label>
                <select
                  value={convivenciaGrade}
                  onChange={(e) => setConvivenciaGrade(e.target.value)}
                  className="w-full max-w-xs px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500"
                >
                  <option value="">Seleccione un grado...</option>
                  {grades.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              {/* Lista de grupos */}
              {convivenciaLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 text-pink-600 animate-spin" />
                </div>
              ) : convivenciaGrade && convivenciaStatus.length > 0 ? (
                <div className="space-y-3">
                  {convivenciaStatus.map(group => (
                    <div
                      key={group.groupId}
                      className={`flex items-center justify-between p-4 rounded-lg border ${
                        group.convivenciaEnabled ? 'bg-pink-50 border-pink-200' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${group.convivenciaEnabled ? 'bg-pink-100' : 'bg-gray-200'}`}>
                          <Users className={`w-5 h-5 ${group.convivenciaEnabled ? 'text-pink-600' : 'text-gray-500'}`} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{group.groupName}</p>
                          <p className="text-sm text-gray-500">
                            {group.hasDirector ? (
                              <span className="flex items-center gap-1">
                                <UserCheck className="w-3 h-3" />
                                Tutor: {group.director}
                              </span>
                            ) : (
                              <span className="text-amber-600">Sin tutor asignado</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleConvivencia(group.groupId, group.convivenciaEnabled)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                          group.convivenciaEnabled
                            ? 'bg-pink-600 text-white hover:bg-pink-700'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {group.convivenciaEnabled ? (
                          <>
                            <ToggleRight className="w-5 h-5" />
                            Activada
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-5 h-5" />
                            Desactivada
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              ) : convivenciaGrade ? (
                <p className="text-gray-500 text-center py-8">No hay grupos en este grado</p>
              ) : null}

              {/* Info */}
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">¿Cómo funciona?</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-700">
                      <li>Al activar Convivencia, se crea automáticamente la asignatura si no existe</li>
                      <li>El tutor del grupo (Director de Grupo) será asignado como docente de Convivencia</li>
                      <li>El tutor podrá ingresar notas de Convivencia desde su planilla de notas</li>
                      <li>Las notas de Convivencia aparecerán en los boletines de los estudiantes</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        {/* TAB: IMPORTAR NOTAS */}
        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'import' && (
          <>
            {/* Progress Steps */}
            <div className="flex items-center justify-center mb-8">
              {['Seleccionar', 'Vista Previa', 'Opciones', 'Resultado'].map((label, idx) => {
                const stepMap: Step[] = ['select', 'preview', 'options', 'result']
                const currentIdx = stepMap.indexOf(step === 'importing' ? 'options' : step)
                const isActive = idx <= currentIdx
                const isCurrent = idx === currentIdx

                return (
                  <div key={label} className="flex items-center">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
                      ${isCurrent ? 'bg-indigo-600 text-white' : isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-500'}`}>
                      {idx + 1}
                    </div>
                    <span className={`ml-2 text-sm ${isCurrent ? 'text-indigo-600 font-medium' : 'text-gray-500'}`}>
                      {label}
                    </span>
                    {idx < 3 && <ArrowRight className="w-4 h-4 mx-4 text-gray-300" />}
                  </div>
                )
              })}
            </div>

        {/* Step 1: Select */}
        {step === 'select' && (
          <div className="bg-white rounded-xl shadow-sm border p-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Grado a importar
                </label>
                <select
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Seleccione un grado...</option>
                  {grades.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.groups.length} grupos)
                    </option>
                  ))}
                </select>
                {selectedGradeInfo && (
                  <p className="text-xs text-gray-500 mt-1">
                    Grupos: {selectedGradeInfo.groups.map((g) => g.name).join(', ')}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Período académico
                </label>
                <select
                  value={selectedTerm}
                  onChange={(e) => setSelectedTerm(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Seleccione un período...</option>
                  {terms.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.status === 'OPEN' ? '(Abierto)' : t.status === 'CLOSED' ? '(Cerrado)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Archivo Excel del consolidado
              </label>
              <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
                <p className="text-xs text-gray-500">
                  Descargue primero la plantilla oficial, diligénciela y luego súbala aquí.
                </p>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  disabled={!selectedGrade || loading}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Descargar plantilla
                </button>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-400 transition-colors">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  {file ? (
                    <div>
                      <p className="text-indigo-600 font-medium">{file.name}</p>
                      <p className="text-gray-500 text-sm">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-gray-600">Haga clic para seleccionar o arrastre el archivo aquí</p>
                      <p className="text-gray-400 text-sm mt-1">Solo archivos .xlsx o .xls</p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Formato esperado del Excel:</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-700">
                    <li>Fila 1: nombres de asignaturas</li>
                    <li>Fila 2: encabezados técnicos de importación</li>
                    <li>Datos desde la fila 3 en adelante</li>
                    <li>Use la plantilla descargable para evitar errores de formato</li>
                  </ul>
                </div>
              </div>
            </div>

            <button
              onClick={handlePreview}
              disabled={!file || !selectedGrade || !selectedTerm || loading}
              className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analizando archivo...
                </>
              ) : (
                <>
                  Analizar archivo
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && preview && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-sm border p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{preview.students.length}</p>
                    <p className="text-sm text-gray-500">Estudiantes en Excel</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <BookOpen className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {preview.subjects.filter(s => s.foundInSystem).length}/{preview.subjects.length}
                    </p>
                    <p className="text-sm text-gray-500">Asignaturas encontradas</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${preview.studentsInSystemNotInExcel.length > 0 ? 'bg-amber-100' : 'bg-gray-100'}`}>
                    <UserMinus className={`w-6 h-6 ${preview.studentsInSystemNotInExcel.length > 0 ? 'text-amber-600' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{preview.studentsInSystemNotInExcel.length}</p>
                    <p className="text-sm text-gray-500">No están en Excel</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Warnings */}
            {preview.warnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800">Advertencias</p>
                    <ul className="text-sm text-amber-700 mt-1 space-y-1">
                      {preview.warnings.map((w, i) => (
                        <li key={i}>• {w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Students Table */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <h3 className="font-medium text-gray-900">Estudiantes detectados</h3>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-gray-600">Fila</th>
                      <th className="px-4 py-2 text-left text-gray-600">Nombre</th>
                      <th className="px-4 py-2 text-left text-gray-600">Documento</th>
                      <th className="px-4 py-2 text-left text-gray-600">Grupo</th>
                      <th className="px-4 py-2 text-center text-gray-600">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.students.slice(0, 20).map((s, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-500">{s.rowNumber}</td>
                        <td className="px-4 py-2 font-medium">{s.fullName}</td>
                        <td className="px-4 py-2 text-gray-600">{s.documentNumber}</td>
                        <td className="px-4 py-2 text-gray-600">{s.groupCode}</td>
                        <td className="px-4 py-2 text-center">
                          {s.existsInSystem ? (
                            <span className="inline-flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="w-4 h-4" /> Existe
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-600">
                              <UserPlus className="w-4 h-4" /> Nuevo
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.students.length > 20 && (
                  <p className="px-4 py-2 text-sm text-gray-500 bg-gray-50">
                    ... y {preview.students.length - 20} estudiantes más
                  </p>
                )}
              </div>
            </div>

            {/* Subjects */}
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <h3 className="font-medium text-gray-900 mb-3">Asignaturas detectadas</h3>
              <div className="flex flex-wrap gap-2">
                {preview.subjects.map((s, i) => (
                  <span
                    key={i}
                    className={`px-3 py-1 rounded-full text-sm ${
                      s.foundInSystem
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {s.name} {s.foundInSystem ? '✓' : '✗'}
                  </span>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={() => setStep('select')}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
              >
                Volver
              </button>
              <button
                onClick={() => setStep('options')}
                disabled={!preview.canProceed}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Continuar
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Options */}
        {step === 'options' && preview && (
          <div className="bg-white rounded-xl shadow-sm border p-6 space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Opciones de importación</h3>
              
              <div className="space-y-4">
                {/* Create missing students */}
                <label className="flex items-start gap-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.createMissingStudents}
                    onChange={(e) => setOptions({ ...options, createMissingStudents: e.target.checked })}
                    className="mt-1 w-4 h-4 text-indigo-600 rounded"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Crear estudiantes faltantes</p>
                    <p className="text-sm text-gray-500">
                      {preview.students.filter(s => !s.existsInSystem).length} estudiantes del Excel no existen en el sistema.
                      Se crearán con contraseña = documento.
                    </p>
                  </div>
                </label>

                {/* Deactivate missing */}
                <label className="flex items-start gap-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={true}
                    disabled
                    onChange={(e) => setOptions({ ...options, deactivateMissingStudents: e.target.checked })}
                    className="mt-1 w-4 h-4 text-indigo-600 rounded"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Eliminar del sistema a los que no están en Excel</p>
                    <p className="text-sm text-gray-500">
                      {preview.studentsInSystemNotInExcel.length} estudiantes del sistema no aparecen en el Excel.
                      Se eliminarán automáticamente del sistema al importar.
                    </p>
                  </div>
                </label>

                {/* Overwrite grades */}
                <label className="flex items-start gap-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.overwriteExistingGrades}
                    onChange={(e) => setOptions({ ...options, overwriteExistingGrades: e.target.checked })}
                    className="mt-1 w-4 h-4 text-indigo-600 rounded"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Sobrescribir notas existentes</p>
                    <p className="text-sm text-gray-500">
                      Si ya existen notas para este período, serán reemplazadas por las del Excel.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <p className="font-medium text-indigo-900 mb-2">Resumen de la importación:</p>
              <ul className="text-sm text-indigo-700 space-y-1">
                <li>• Grado: <strong>{selectedGradeInfo?.name}</strong></li>
                <li>• Período: <strong>{selectedTermInfo?.name}</strong></li>
                <li>• Estudiantes a procesar: <strong>{preview.students.length}</strong></li>
                <li>• Asignaturas a importar: <strong>{preview.subjects.filter(s => s.foundInSystem).length}</strong></li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={() => setStep('preview')}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
              >
                Volver
              </button>
              <button
                onClick={handleImport}
                className="flex-1 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <Upload className="w-5 h-5" />
                Importar Notas
              </button>
            </div>
          </div>
        )}

        {/* Step 3.5: Importing */}
        {step === 'importing' && (
          <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
            <Loader2 className="w-16 h-16 text-indigo-600 animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">Importando notas...</h3>
            <p className="text-gray-500">Este proceso puede tomar varios minutos dependiendo del tamaño del archivo.</p>
          </div>
        )}

        {/* Step 4: Result */}
        {step === 'result' && result && (
          <div className="space-y-6">
            {/* Success/Error Header */}
            <div className={`rounded-xl p-6 ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-center gap-4">
                {result.success ? (
                  <CheckCircle2 className="w-12 h-12 text-green-500" />
                ) : (
                  <XCircle className="w-12 h-12 text-red-500" />
                )}
                <div>
                  <h3 className={`text-xl font-bold ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                    {result.success ? 'Importación completada' : 'Importación con errores'}
                  </h3>
                  <p className={result.success ? 'text-green-600' : 'text-red-600'}>
                    {result.summary.gradesImported} notas importadas para {result.summary.totalStudents} estudiantes
                  </p>
                </div>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow-sm border p-4 text-center">
                <p className="text-3xl font-bold text-gray-900">{result.summary.totalStudents}</p>
                <p className="text-sm text-gray-500">Total estudiantes</p>
              </div>
              <div className="bg-white rounded-lg shadow-sm border p-4 text-center">
                <p className="text-3xl font-bold text-green-600">{result.summary.studentsCreated}</p>
                <p className="text-sm text-gray-500">Creados</p>
              </div>
              <div className="bg-white rounded-lg shadow-sm border p-4 text-center">
                <p className="text-3xl font-bold text-blue-600">{result.summary.studentsUpdated}</p>
                <p className="text-sm text-gray-500">Actualizados</p>
              </div>
              <div className="bg-white rounded-lg shadow-sm border p-4 text-center">
                <p className="text-3xl font-bold text-amber-600">{result.summary.studentsDeactivated}</p>
                <p className="text-sm text-gray-500">Eliminados</p>
              </div>
            </div>

            {/* Errors */}
            {result.errors.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="px-4 py-3 border-b bg-red-50">
                  <h3 className="font-medium text-red-800">Errores ({result.errors.length})</h3>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Fila</th>
                        <th className="px-4 py-2 text-left">Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {result.errors.map((e, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2 text-gray-500">{e.row}</td>
                          <td className="px-4 py-2 text-red-600">{e.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Created Students */}
            {result.details.created.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border p-4">
                <h3 className="font-medium text-gray-900 mb-3">Estudiantes creados</h3>
                <div className="flex flex-wrap gap-2">
                  {result.details.created.map((s, i) => (
                    <span key={i} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                      {s.name} ({s.document})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action */}
            <button
              onClick={resetForm}
              className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
            >
              Importar otro grado
            </button>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  )
}
