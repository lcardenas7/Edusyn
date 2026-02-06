import { useState } from 'react'
import { 
  GraduationCap,
  Calendar,
  BookOpen,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  Save,
  Eye,
  ArrowLeft
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAcademic, AcademicLevel, GradingScaleType } from '../../../contexts/AcademicContext'
import { usePermissions, PERMISSIONS } from '../../../hooks/usePermissions'
import AcademicYearBanner, { useAcademicYearStatus } from '../../../components/AcademicYearBanner'

export default function Levels() {
  const { 
    institution, setInstitution,
    saveAcademicLevelsToAPI,
    isSaving 
  } = useAcademic()
  const { can } = usePermissions()
  const { yearStatus, isReadOnly } = useAcademicYearStatus()
  
  const canEditGradingLevels = can(PERMISSIONS.CONFIG_GRADING_EDIT_LEVELS) && !isReadOnly
  
  const [expandedLevels, setExpandedLevels] = useState<string[]>([])

  const toggleExpand = (levelId: string) => {
    const key = `level-${levelId}`
    setExpandedLevels(prev => 
      prev.includes(key) ? prev.filter(id => id !== key) : [...prev, key]
    )
  }

  const addLevel = () => {
    const defaultPerfLevels = [
      { id: `perf-${Date.now()}-1`, name: 'Superior', code: 'SUPERIOR', minScore: 4.5, maxScore: 5.0, order: 0, color: '#22c55e', isApproved: true },
      { id: `perf-${Date.now()}-2`, name: 'Alto', code: 'ALTO', minScore: 4.0, maxScore: 4.4, order: 1, color: '#3b82f6', isApproved: true },
      { id: `perf-${Date.now()}-3`, name: 'Básico', code: 'BASICO', minScore: 3.0, maxScore: 3.9, order: 2, color: '#f59e0b', isApproved: true },
      { id: `perf-${Date.now()}-4`, name: 'Bajo', code: 'BAJO', minScore: 1.0, maxScore: 2.9, order: 3, color: '#ef4444', isApproved: false },
    ]
    const newLevel: AcademicLevel = {
      id: `lvl-${Date.now()}`,
      name: 'Nuevo Nivel',
      code: 'NUEVO',
      order: institution.academicLevels.length,
      gradingScaleType: 'NUMERIC_1_5',
      minGrade: 1.0,
      maxGrade: 5.0,
      minPassingGrade: 3.0,
      grades: [],
      performanceLevels: defaultPerfLevels,
    }
    setInstitution({
      ...institution,
      academicLevels: [...institution.academicLevels, newLevel],
    })
  }

  const removeLevel = (levelId: string) => {
    const updated = institution.academicLevels.filter(l => l.id !== levelId)
    setInstitution({ ...institution, academicLevels: updated })
  }

  const updateLevel = (levelId: string, updates: Partial<AcademicLevel>) => {
    const updated = institution.academicLevels.map(l =>
      l.id === levelId ? { ...l, ...updates } : l
    )
    setInstitution({ ...institution, academicLevels: updated })
  }

  const getNumericConfig = (type: GradingScaleType) => {
    switch (type) {
      case 'NUMERIC_1_5':
        return {
          minGrade: 1.0, maxGrade: 5.0, minPassingGrade: 3.0,
          performanceLevels: [
            { id: `perf-${Date.now()}-1`, name: 'Superior', code: 'SUPERIOR', minScore: 4.5, maxScore: 5.0, order: 0, color: '#22c55e', isApproved: true },
            { id: `perf-${Date.now()}-2`, name: 'Alto', code: 'ALTO', minScore: 4.0, maxScore: 4.4, order: 1, color: '#3b82f6', isApproved: true },
            { id: `perf-${Date.now()}-3`, name: 'Básico', code: 'BASICO', minScore: 3.0, maxScore: 3.9, order: 2, color: '#f59e0b', isApproved: true },
            { id: `perf-${Date.now()}-4`, name: 'Bajo', code: 'BAJO', minScore: 1.0, maxScore: 2.9, order: 3, color: '#ef4444', isApproved: false },
          ]
        }
      case 'NUMERIC_1_10':
        return {
          minGrade: 1, maxGrade: 10, minPassingGrade: 6,
          performanceLevels: [
            { id: `perf-${Date.now()}-1`, name: 'Superior', code: 'SUPERIOR', minScore: 9, maxScore: 10, order: 0, color: '#22c55e', isApproved: true },
            { id: `perf-${Date.now()}-2`, name: 'Alto', code: 'ALTO', minScore: 8, maxScore: 8.9, order: 1, color: '#3b82f6', isApproved: true },
            { id: `perf-${Date.now()}-3`, name: 'Básico', code: 'BASICO', minScore: 6, maxScore: 7.9, order: 2, color: '#f59e0b', isApproved: true },
            { id: `perf-${Date.now()}-4`, name: 'Bajo', code: 'BAJO', minScore: 1, maxScore: 5.9, order: 3, color: '#ef4444', isApproved: false },
          ]
        }
      case 'NUMERIC_0_100':
        return {
          minGrade: 0, maxGrade: 100, minPassingGrade: 60,
          performanceLevels: [
            { id: `perf-${Date.now()}-1`, name: 'Superior', code: 'SUPERIOR', minScore: 90, maxScore: 100, order: 0, color: '#22c55e', isApproved: true },
            { id: `perf-${Date.now()}-2`, name: 'Alto', code: 'ALTO', minScore: 80, maxScore: 89, order: 1, color: '#3b82f6', isApproved: true },
            { id: `perf-${Date.now()}-3`, name: 'Básico', code: 'BASICO', minScore: 60, maxScore: 79, order: 2, color: '#f59e0b', isApproved: true },
            { id: `perf-${Date.now()}-4`, name: 'Bajo', code: 'BAJO', minScore: 0, maxScore: 59, order: 3, color: '#ef4444', isApproved: false },
          ]
        }
      default:
        return { minGrade: 1.0, maxGrade: 5.0, minPassingGrade: 3.0, performanceLevels: [] }
    }
  }

  const changeGradingScaleType = (levelId: string, newType: GradingScaleType) => {
    const updated = institution.academicLevels.map(l =>
      l.id === levelId ? {
        ...l,
        gradingScaleType: newType,
        ...(newType.startsWith('NUMERIC') ? {
          ...getNumericConfig(newType),
          qualitativeLevels: undefined,
        } : {
          qualitativeLevels: [
            { id: 'q1', code: 'S', name: 'Superior', description: 'Supera los logros', color: '#22c55e', order: 0, isApproved: true },
            { id: 'q2', code: 'A', name: 'Alto', description: 'Alcanza los logros', color: '#3b82f6', order: 1, isApproved: true },
            { id: 'q3', code: 'B', name: 'Básico', description: 'Logros mínimos', color: '#f59e0b', order: 2, isApproved: true },
            { id: 'q4', code: 'J', name: 'Bajo', description: 'No alcanza', color: '#ef4444', order: 3, isApproved: false },
          ],
          minGrade: undefined,
          maxGrade: undefined,
          minPassingGrade: undefined,
          performanceLevels: undefined,
        }),
      } : l
    )
    setInstitution({ ...institution, academicLevels: updated })
  }

  const loadDefaultLevels = () => {
    const defaultLevels: AcademicLevel[] = [
      {
        id: 'lvl-preescolar',
        name: 'Preescolar',
        code: 'PREESCOLAR',
        order: 0,
        gradingScaleType: 'QUALITATIVE',
        qualitativeLevels: [
          { id: 'q1', code: 'S', name: 'Superior', description: 'Supera los logros', color: '#22c55e', order: 0, isApproved: true },
          { id: 'q2', code: 'A', name: 'Alto', description: 'Alcanza los logros', color: '#3b82f6', order: 1, isApproved: true },
          { id: 'q3', code: 'B', name: 'Básico', description: 'Logros mínimos', color: '#f59e0b', order: 2, isApproved: true },
          { id: 'q4', code: 'J', name: 'Bajo', description: 'No alcanza', color: '#ef4444', order: 3, isApproved: false },
        ],
        grades: ['Pre-Jardín', 'Jardín', 'Transición'],
      },
      {
        id: 'lvl-primaria',
        name: 'Básica Primaria',
        code: 'PRIMARIA',
        order: 1,
        gradingScaleType: 'NUMERIC_1_5',
        minGrade: 1.0,
        maxGrade: 5.0,
        minPassingGrade: 3.0,
        grades: ['1°', '2°', '3°', '4°', '5°'],
      },
      {
        id: 'lvl-secundaria',
        name: 'Básica Secundaria',
        code: 'SECUNDARIA',
        order: 2,
        gradingScaleType: 'NUMERIC_1_5',
        minGrade: 1.0,
        maxGrade: 5.0,
        minPassingGrade: 3.0,
        grades: ['6°', '7°', '8°', '9°'],
      },
      {
        id: 'lvl-media',
        name: 'Media',
        code: 'MEDIA',
        order: 3,
        gradingScaleType: 'NUMERIC_1_5',
        minGrade: 1.0,
        maxGrade: 5.0,
        minPassingGrade: 3.0,
        grades: ['10°', '11°'],
      },
    ]
    setInstitution({ ...institution, academicLevels: defaultLevels })
  }

  const handleSave = async () => {
    const success = await saveAcademicLevelsToAPI()
    if (success) {
      alert('✅ Niveles académicos guardados correctamente')
    } else {
      alert('❌ Error al guardar. Intente de nuevo.')
    }
  }

  return (
    <div className="p-6">
      <AcademicYearBanner yearStatus={yearStatus} />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link 
            to="/academic/config/scale" 
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Niveles Académicos y Calendario</h1>
              <p className="text-sm text-slate-500">Configura el calendario y los niveles con su sistema de calificación</p>
            </div>
          </div>
        </div>
        
        {!canEditGradingLevels && (
          <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
            <Eye className="w-3 h-3" /> Solo lectura
          </span>
        )}
      </div>

      <div className="space-y-6">
        {/* Calendario Académico */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-slate-900">Calendario Académico</h3>
          </div>
          <div className="flex gap-4">
            <label className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all flex-1 ${
              institution.academicCalendar === 'A' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'
            } ${canEditGradingLevels ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'}`}>
              <input
                type="radio"
                name="calendar"
                checked={institution.academicCalendar === 'A'}
                onChange={() => canEditGradingLevels && setInstitution({ ...institution, academicCalendar: 'A' })}
                disabled={!canEditGradingLevels}
                className="w-4 h-4 text-blue-600"
              />
              <div>
                <div className="font-medium text-slate-900">Calendario A</div>
                <div className="text-sm text-slate-500">Febrero - Noviembre</div>
              </div>
            </label>
            <label className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all flex-1 ${
              institution.academicCalendar === 'B' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'
            } ${canEditGradingLevels ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'}`}>
              <input
                type="radio"
                name="calendar"
                checked={institution.academicCalendar === 'B'}
                onChange={() => canEditGradingLevels && setInstitution({ ...institution, academicCalendar: 'B' })}
                disabled={!canEditGradingLevels}
                className="w-4 h-4 text-blue-600"
              />
              <div>
                <div className="font-medium text-slate-900">Calendario B</div>
                <div className="text-sm text-slate-500">Septiembre - Junio</div>
              </div>
            </label>
          </div>
        </div>

        {/* Niveles Académicos */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-purple-600" />
              <h3 className="font-semibold text-slate-900">Niveles Académicos</h3>
            </div>
            {canEditGradingLevels && (
              <button
                onClick={addLevel}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <Plus className="w-4 h-4" />
                Agregar Nivel
              </button>
            )}
          </div>

          <div className="space-y-3">
            {institution.academicLevels.map((level) => {
              const isExpanded = expandedLevels.includes(`level-${level.id}`)
              const isQualitative = level.gradingScaleType.startsWith('QUALITATIVE')
              
              return (
                <div key={level.id} className="border border-slate-200 rounded-lg overflow-hidden">
                  {/* Cabecera colapsable */}
                  <div 
                    className={`p-4 cursor-pointer ${isQualitative ? 'bg-amber-50 hover:bg-amber-100' : 'bg-purple-50 hover:bg-purple-100'} transition-colors`}
                    onClick={() => toggleExpand(level.id)}
                  >
                    <div className="flex items-center gap-4">
                      <button className="p-1">
                        {isExpanded ? (
                          <ChevronDown className={`w-5 h-5 ${isQualitative ? 'text-amber-600' : 'text-purple-600'}`} />
                        ) : (
                          <ChevronRight className={`w-5 h-5 ${isQualitative ? 'text-amber-600' : 'text-purple-600'}`} />
                        )}
                      </button>
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isQualitative ? 'bg-amber-200' : 'bg-purple-200'}`}>
                        <GraduationCap className={`w-5 h-5 ${isQualitative ? 'text-amber-700' : 'text-purple-700'}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900">{level.name}</span>
                          <span className="px-2 py-0.5 text-xs bg-white/50 text-slate-600 rounded">{level.code}</span>
                          <span className={`px-2 py-0.5 text-xs rounded ${isQualitative ? 'bg-amber-200 text-amber-700' : 'bg-purple-200 text-purple-700'}`}>
                            {isQualitative ? 'Cualitativo' : 'Numérico'}
                          </span>
                        </div>
                        <div className="text-sm text-slate-500 mt-0.5">
                          {level.grades.length > 0 ? level.grades.join(', ') : 'Sin grados asignados'}
                        </div>
                      </div>
                      {/* Colores de la escala */}
                      <div className="flex gap-1">
                        {isQualitative ? (
                          level.qualitativeLevels?.slice(0, 4).map((ql) => (
                            <div key={ql.id} className="w-4 h-4 rounded" style={{ backgroundColor: ql.color }} title={ql.name} />
                          ))
                        ) : (
                          level.performanceLevels?.slice(0, 4).map((pl) => (
                            <div key={pl.id} className="w-4 h-4 rounded" style={{ backgroundColor: pl.color }} title={pl.name} />
                          ))
                        )}
                      </div>
                      {canEditGradingLevels && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            removeLevel(level.id)
                          }}
                          className="p-2 hover:bg-red-100 rounded text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Contenido expandible */}
                  {isExpanded && (
                    <div className="p-4 bg-white border-t border-slate-100 space-y-4">
                      {/* Información básica */}
                      <div className="grid grid-cols-4 gap-4">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Nombre del nivel</label>
                          <input
                            type="text"
                            value={level.name}
                            onChange={(e) => canEditGradingLevels && updateLevel(level.id, { name: e.target.value })}
                            disabled={!canEditGradingLevels}
                            className={`w-full px-2 py-1.5 text-sm border border-slate-300 rounded ${canEditGradingLevels ? 'bg-white' : 'bg-slate-100 cursor-not-allowed'}`}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Código</label>
                          <input
                            type="text"
                            value={level.code}
                            onChange={(e) => canEditGradingLevels && updateLevel(level.id, { code: e.target.value.toUpperCase() })}
                            disabled={!canEditGradingLevels}
                            className={`w-full px-2 py-1.5 text-sm border border-slate-300 rounded ${canEditGradingLevels ? 'bg-white' : 'bg-slate-100 cursor-not-allowed'}`}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Jornada</label>
                          <select
                            value={level.shift || 'SINGLE'}
                            disabled={!canEditGradingLevels}
                            className={`w-full px-2 py-1.5 text-sm border border-slate-300 rounded ${canEditGradingLevels ? 'bg-white' : 'bg-slate-100 cursor-not-allowed'}`}
                            onChange={(e) => canEditGradingLevels && updateLevel(level.id, { shift: e.target.value as any })}
                          >
                            <option value="MORNING">Mañana</option>
                            <option value="AFTERNOON">Tarde</option>
                            <option value="EVENING">Noche</option>
                            <option value="SINGLE">Jornada Única</option>
                            <option value="OTHER">Otra</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Tipo de calificación</label>
                          <select
                            value={level.gradingScaleType}
                            disabled={!canEditGradingLevels}
                            className={`w-full px-2 py-1.5 text-sm border border-slate-300 rounded ${canEditGradingLevels ? 'bg-white' : 'bg-slate-100 cursor-not-allowed'}`}
                            onChange={(e) => canEditGradingLevels && changeGradingScaleType(level.id, e.target.value as GradingScaleType)}
                          >
                            <option value="NUMERIC_1_5">Numérico 1.0 - 5.0</option>
                            <option value="NUMERIC_1_10">Numérico 1 - 10</option>
                            <option value="NUMERIC_0_100">Numérico 0 - 100</option>
                            <option value="QUALITATIVE">Cualitativo (letras)</option>
                            <option value="QUALITATIVE_DESC">Cualitativo descriptivo</option>
                          </select>
                        </div>
                      </div>

                      {/* Grados del nivel */}
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Grados (separados por coma)</label>
                        <input
                          type="text"
                          value={level.grades.join(', ')}
                          disabled={!canEditGradingLevels}
                          onChange={(e) => {
                            if (!canEditGradingLevels) return
                            const gradesArray = e.target.value.split(',').map(g => g.trim()).filter(g => g)
                            updateLevel(level.id, { grades: gradesArray })
                          }}
                          placeholder="Ej: Transición, 1°, 2°, 3°"
                          className={`w-full px-3 py-2 text-sm border border-slate-300 rounded-lg ${!canEditGradingLevels ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                        />
                      </div>

                      {/* Configuración según tipo de escala */}
                      {!isQualitative ? (
                        <>
                          {/* Escala numérica */}
                          <div className="grid grid-cols-3 gap-4 p-3 bg-purple-50 rounded-lg">
                            <div>
                              <label className="block text-xs text-purple-600 mb-1">Nota mínima</label>
                              <input
                                type="number"
                                step="0.1"
                                value={level.minGrade || 1}
                                disabled={!canEditGradingLevels}
                                onChange={(e) => canEditGradingLevels && updateLevel(level.id, { minGrade: parseFloat(e.target.value) || 1 })}
                                className={`w-full px-2 py-1.5 text-sm border border-purple-300 rounded ${!canEditGradingLevels ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-purple-600 mb-1">Nota máxima</label>
                              <input
                                type="number"
                                step="0.1"
                                value={level.maxGrade || 5}
                                disabled={!canEditGradingLevels}
                                onChange={(e) => canEditGradingLevels && updateLevel(level.id, { maxGrade: parseFloat(e.target.value) || 5 })}
                                className={`w-full px-2 py-1.5 text-sm border border-purple-300 rounded ${!canEditGradingLevels ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-purple-600 mb-1">Nota para aprobar</label>
                              <input
                                type="number"
                                step="0.1"
                                value={level.minPassingGrade || 3}
                                disabled={!canEditGradingLevels}
                                onChange={(e) => canEditGradingLevels && updateLevel(level.id, { minPassingGrade: parseFloat(e.target.value) || 3 })}
                                className={`w-full px-2 py-1.5 text-sm border border-purple-300 rounded ${!canEditGradingLevels ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                              />
                            </div>
                          </div>

                          {/* Escala de valoración (Performance Levels) */}
                          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                            <div className="flex items-center justify-between mb-3">
                              <div className="text-xs text-green-700 font-medium">Escala de Valoración (Niveles de Desempeño)</div>
                              {canEditGradingLevels && (
                                <button
                                  onClick={() => {
                                    const newPerf = {
                                      id: `perf-${Date.now()}`,
                                      name: 'Nuevo Nivel',
                                      code: 'NUEVO',
                                      minScore: 0,
                                      maxScore: 0,
                                      order: level.performanceLevels?.length || 0,
                                      color: '#6b7280',
                                      isApproved: true,
                                    }
                                    updateLevel(level.id, { performanceLevels: [...(level.performanceLevels || []), newPerf] })
                                  }}
                                  className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                                >
                                  + Agregar
                                </button>
                              )}
                            </div>
                            <div className="space-y-2">
                              {level.performanceLevels?.map((pl, plIndex) => (
                                <div 
                                  key={pl.id} 
                                  className="flex items-center gap-2 p-2 bg-white rounded border"
                                  style={{ borderColor: pl.color, borderLeftWidth: '4px' }}
                                >
                                  <input
                                    type="color"
                                    value={pl.color}
                                    disabled={!canEditGradingLevels}
                                    onChange={(e) => {
                                      if (!canEditGradingLevels) return
                                      const updatedPl = level.performanceLevels?.map((p, i) =>
                                        i === plIndex ? { ...p, color: e.target.value } : p
                                      )
                                      updateLevel(level.id, { performanceLevels: updatedPl })
                                    }}
                                    className={`w-8 h-8 rounded border-0 ${canEditGradingLevels ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                                  />
                                  <input
                                    type="text"
                                    value={pl.name}
                                    disabled={!canEditGradingLevels}
                                    onChange={(e) => {
                                      if (!canEditGradingLevels) return
                                      const updatedPl = level.performanceLevels?.map((p, i) =>
                                        i === plIndex ? { ...p, name: e.target.value } : p
                                      )
                                      updateLevel(level.id, { performanceLevels: updatedPl })
                                    }}
                                    placeholder="Nombre"
                                    className={`w-24 px-2 py-1 text-xs border border-slate-200 rounded font-medium ${!canEditGradingLevels ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                                  />
                                  <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-xs">
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={pl.minScore}
                                      disabled={!canEditGradingLevels}
                                      onChange={(e) => {
                                        if (!canEditGradingLevels) return
                                        const updatedPl = level.performanceLevels?.map((p, i) =>
                                          i === plIndex ? { ...p, minScore: parseFloat(e.target.value) || 0 } : p
                                        )
                                        updateLevel(level.id, { performanceLevels: updatedPl })
                                      }}
                                      className={`w-14 px-1 py-0.5 text-xs border border-slate-200 rounded text-center ${canEditGradingLevels ? 'bg-white' : 'bg-slate-50 cursor-not-allowed'}`}
                                    />
                                    <span className="text-slate-400">-</span>
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={pl.maxScore}
                                      disabled={!canEditGradingLevels}
                                      onChange={(e) => {
                                        if (!canEditGradingLevels) return
                                        const updatedPl = level.performanceLevels?.map((p, i) =>
                                          i === plIndex ? { ...p, maxScore: parseFloat(e.target.value) || 0 } : p
                                        )
                                        updateLevel(level.id, { performanceLevels: updatedPl })
                                      }}
                                      className={`w-14 px-1 py-0.5 text-xs border border-slate-200 rounded text-center ${canEditGradingLevels ? 'bg-white' : 'bg-slate-50 cursor-not-allowed'}`}
                                    />
                                  </div>
                                  <label className={`flex items-center gap-1 px-2 py-1 rounded text-xs whitespace-nowrap ${pl.isApproved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} ${!canEditGradingLevels ? 'cursor-not-allowed opacity-60' : ''}`}>
                                    <input
                                      type="checkbox"
                                      checked={pl.isApproved}
                                      disabled={!canEditGradingLevels}
                                      onChange={(e) => {
                                        if (!canEditGradingLevels) return
                                        const updatedPl = level.performanceLevels?.map((p, i) =>
                                          i === plIndex ? { ...p, isApproved: e.target.checked } : p
                                        )
                                        updateLevel(level.id, { performanceLevels: updatedPl })
                                      }}
                                      className="w-3 h-3"
                                    />
                                    {pl.isApproved ? 'Aprueba' : 'No aprueba'}
                                  </label>
                                  {canEditGradingLevels && (
                                    <button
                                      onClick={() => {
                                        const updatedPl = level.performanceLevels?.filter((_, i) => i !== plIndex)
                                        updateLevel(level.id, { performanceLevels: updatedPl })
                                      }}
                                      className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-600"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              ))}
                              {(!level.performanceLevels || level.performanceLevels.length === 0) && (
                                <div className="text-xs text-slate-400 text-center py-2">Sin niveles de desempeño configurados</div>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        /* Escala cualitativa */
                        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-xs text-amber-700 font-medium">Escala Cualitativa</div>
                            {canEditGradingLevels && (
                              <button
                                onClick={() => {
                                  const newQl = {
                                    id: `ql-${Date.now()}`,
                                    code: 'N',
                                    name: 'Nuevo',
                                    description: '',
                                    color: '#6b7280',
                                    order: level.qualitativeLevels?.length || 0,
                                    isApproved: true,
                                  }
                                  updateLevel(level.id, { qualitativeLevels: [...(level.qualitativeLevels || []), newQl] })
                                }}
                                className="text-xs px-2 py-1 bg-amber-600 text-white rounded hover:bg-amber-700"
                              >
                                + Agregar
                              </button>
                            )}
                          </div>
                          <div className="space-y-2">
                            {level.qualitativeLevels?.map((ql, qlIndex) => (
                              <div key={ql.id} className="flex items-center gap-2 p-2 bg-white rounded border border-amber-200">
                                <input
                                  type="color"
                                  value={ql.color}
                                  disabled={!canEditGradingLevels}
                                  onChange={(e) => {
                                    if (!canEditGradingLevels) return
                                    const updatedQl = level.qualitativeLevels?.map((q, i) =>
                                      i === qlIndex ? { ...q, color: e.target.value } : q
                                    )
                                    updateLevel(level.id, { qualitativeLevels: updatedQl })
                                  }}
                                  className={`w-8 h-8 rounded border-0 ${canEditGradingLevels ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                                />
                                <input
                                  type="text"
                                  value={ql.code}
                                  disabled={!canEditGradingLevels}
                                  onChange={(e) => {
                                    if (!canEditGradingLevels) return
                                    const updatedQl = level.qualitativeLevels?.map((q, i) =>
                                      i === qlIndex ? { ...q, code: e.target.value } : q
                                    )
                                    updateLevel(level.id, { qualitativeLevels: updatedQl })
                                  }}
                                  className={`w-12 px-2 py-1 text-xs text-center border border-slate-200 rounded ${!canEditGradingLevels ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                                  placeholder="Código"
                                />
                                <input
                                  type="text"
                                  value={ql.name}
                                  disabled={!canEditGradingLevels}
                                  onChange={(e) => {
                                    if (!canEditGradingLevels) return
                                    const updatedQl = level.qualitativeLevels?.map((q, i) =>
                                      i === qlIndex ? { ...q, name: e.target.value } : q
                                    )
                                    updateLevel(level.id, { qualitativeLevels: updatedQl })
                                  }}
                                  className={`flex-1 px-2 py-1 text-xs border border-slate-200 rounded ${!canEditGradingLevels ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                                  placeholder="Nombre"
                                />
                                <label className={`flex items-center gap-1 text-xs whitespace-nowrap ${!canEditGradingLevels ? 'cursor-not-allowed opacity-60' : ''}`}>
                                  <input
                                    type="checkbox"
                                    checked={ql.isApproved}
                                    disabled={!canEditGradingLevels}
                                    onChange={(e) => {
                                      if (!canEditGradingLevels) return
                                      const updatedQl = level.qualitativeLevels?.map((q, i) =>
                                        i === qlIndex ? { ...q, isApproved: e.target.checked } : q
                                      )
                                      updateLevel(level.id, { qualitativeLevels: updatedQl })
                                    }}
                                    className="w-3 h-3"
                                  />
                                  Aprueba
                                </label>
                                {canEditGradingLevels && (
                                  <button
                                    onClick={() => {
                                      const updatedQl = level.qualitativeLevels?.filter((_, i) => i !== qlIndex)
                                      updateLevel(level.id, { qualitativeLevels: updatedQl })
                                    }}
                                    className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-600"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {institution.academicLevels.length === 0 && (
              <div className="text-center py-8 text-slate-500 border-2 border-dashed border-slate-200 rounded-lg">
                <p className="mb-2">No hay niveles académicos configurados</p>
                {canEditGradingLevels && (
                  <button
                    onClick={loadDefaultLevels}
                    className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                  >
                    Cargar niveles por defecto
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Botón Guardar */}
          {canEditGradingLevels && (
            <div className="flex justify-end pt-6 mt-6 border-t border-slate-200">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className={`px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 font-medium ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Guardando...' : 'Guardar Niveles Académicos'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
