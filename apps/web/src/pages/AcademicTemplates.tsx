import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, X, ChevronDown, ChevronRight, BookOpen, Layers, Save, Loader2, AlertTriangle, Settings, GraduationCap, Clock, Percent, Star, Calendar } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { academicTemplatesApi, areasApi, academicGradesApi, academicYearLifecycleApi } from '../lib/api'

interface Subject {
  id: string
  name: string
  code: string | null
}

interface Area {
  id: string
  name: string
  code: string | null
  subjects: Subject[]
}

interface TemplateSubject {
  id: string
  subjectId: string
  weeklyHours: number
  weightPercentage: number
  isDominant: boolean
  order: number
  subject: Subject
}

interface TemplateArea {
  id: string
  areaId: string
  weightPercentage: number
  calculationType: string
  approvalRule: string
  recoveryRule: string
  isMandatory: boolean
  order: number
  area: Area
  templateSubjects: TemplateSubject[]
}

interface Template {
  id: string
  name: string
  description: string | null
  level: string
  isDefault: boolean
  isActive: boolean
  achievementsPerPeriod: number
  useAttitudinalAchievement: boolean
  templateAreas: TemplateArea[]
  _count?: { gradeTemplates: number; templateAreas: number }
}

interface Grade {
  id: string
  name: string
  stage: string
  gradeTemplates?: { template: { id: string; name: string } }[]
}

interface AcademicYear {
  id: string
  year: number
  name: string
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED'
}

const levelLabels: Record<string, string> = {
  PREESCOLAR: 'Preescolar',
  PRIMARIA: 'Primaria',
  SECUNDARIA: 'Secundaria',
  MEDIA: 'Media',
  MEDIA_TECNICA: 'Media Técnica',
  OTRO: 'Otro',
}

const calculationTypeLabels: Record<string, string> = {
  INFORMATIVE: 'Informativa',
  AVERAGE: 'Promedio simple',
  WEIGHTED: 'Ponderado',
  DOMINANT: 'Dominante',
}

export default function AcademicTemplates() {
  const { institution } = useAuth()
  const [templates, setTemplates] = useState<Template[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set())
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set())
  
  // Año académico
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [selectedYear, setSelectedYear] = useState<AcademicYear | null>(null)
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'templates' | 'grades'>('templates')
  
  // Modales
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [showAreaModal, setShowAreaModal] = useState(false)
  const [showSubjectModal, setShowSubjectModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [editingTemplateArea, setEditingTemplateArea] = useState<{ templateId: string; templateArea: TemplateArea | null } | null>(null)
  const [editingTemplateSubject, setEditingTemplateSubject] = useState<{ templateAreaId: string; templateSubject: TemplateSubject | null } | null>(null)
  const [assigningGrade, setAssigningGrade] = useState<Grade | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: string; name: string } | null>(null)

  // Formularios
  const [templateForm, setTemplateForm] = useState({
    name: '', description: '', level: 'PRIMARIA', isDefault: false,
    achievementsPerPeriod: 1, useAttitudinalAchievement: false
  })
  const [areaForm, setAreaForm] = useState({
    areaId: '', weightPercentage: 0, calculationType: 'AVERAGE',
    approvalRule: 'AREA_AVERAGE', recoveryRule: 'INDIVIDUAL_SUBJECT', isMandatory: true
  })
  const [subjectForm, setSubjectForm] = useState({
    subjectId: '', weeklyHours: 4, weightPercentage: 100, isDominant: false
  })
  const [assignForm, setAssignForm] = useState({ templateId: '' })

  // Cargar años académicos al inicio
  useEffect(() => {
    if (institution?.id) {
      loadAcademicYears()
    }
  }, [institution?.id])

  const loadAcademicYears = async () => {
    try {
      const response = await academicYearLifecycleApi.getByInstitution(institution!.id)
      const years = response.data || []
      setAcademicYears(years)
      // Seleccionar el año activo por defecto
      const activeYear = years.find((y: AcademicYear) => y.status === 'ACTIVE')
      if (activeYear) {
        setSelectedYear(activeYear)
      } else if (years.length > 0) {
        setSelectedYear(years[0])
      }
    } catch (error) {
      console.error('Error loading academic years:', error)
    }
  }

  const loadData = useCallback(async () => {
    if (!institution?.id || !selectedYear?.id) return
    setLoading(true)
    try {
      const [templatesRes, areasRes, gradesRes] = await Promise.all([
        academicTemplatesApi.getAll(institution.id, selectedYear.id),
        areasApi.getAll(institution.id),
        academicTemplatesApi.listGradesWithTemplates(institution.id, selectedYear.id),
      ])
      setTemplates(templatesRes.data || [])
      setAreas(areasRes.data || [])
      setGrades(gradesRes.data || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }, [institution?.id, selectedYear?.id])

  useEffect(() => {
    if (selectedYear) {
      loadData()
    }
  }, [loadData, selectedYear])

  const toggleExpandTemplate = (id: string) => {
    const newExpanded = new Set(expandedTemplates)
    newExpanded.has(id) ? newExpanded.delete(id) : newExpanded.add(id)
    setExpandedTemplates(newExpanded)
  }

  const toggleExpandArea = (id: string) => {
    const newExpanded = new Set(expandedAreas)
    newExpanded.has(id) ? newExpanded.delete(id) : newExpanded.add(id)
    setExpandedAreas(newExpanded)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PLANTILLAS
  // ═══════════════════════════════════════════════════════════════════════════

  const openTemplateModal = (template?: Template) => {
    if (template) {
      setEditingTemplate(template)
      setTemplateForm({
        name: template.name,
        description: template.description || '',
        level: template.level,
        isDefault: template.isDefault,
        achievementsPerPeriod: template.achievementsPerPeriod,
        useAttitudinalAchievement: template.useAttitudinalAchievement,
      })
    } else {
      setEditingTemplate(null)
      setTemplateForm({ name: '', description: '', level: 'PRIMARIA', isDefault: false, achievementsPerPeriod: 1, useAttitudinalAchievement: false })
    }
    setShowTemplateModal(true)
  }

  const saveTemplate = async () => {
    if (!institution?.id) {
      alert('Error: No se encontró la institución')
      return
    }
    if (!selectedYear?.id) {
      alert('Error: Debe seleccionar un año académico')
      return
    }
    if (!templateForm.name.trim()) {
      alert('Error: El nombre de la plantilla es requerido')
      return
    }
    
    setSaving(true)
    try {
      console.log('[AcademicTemplates] Saving template:', { 
        institutionId: institution.id, 
        academicYearId: selectedYear.id,
        ...templateForm 
      })
      
      if (editingTemplate) {
        await academicTemplatesApi.update(editingTemplate.id, templateForm)
      } else {
        const response = await academicTemplatesApi.create({ 
          institutionId: institution.id, 
          academicYearId: selectedYear.id,
          ...templateForm 
        })
        console.log('[AcademicTemplates] Template created:', response.data)
      }
      await loadData()
      setShowTemplateModal(false)
    } catch (error: any) {
      console.error('[AcademicTemplates] Error saving template:', error)
      alert(error.response?.data?.message || 'Error al guardar plantilla')
    } finally {
      setSaving(false)
    }
  }

  const deleteTemplate = async () => {
    if (!deleteConfirm || deleteConfirm.type !== 'template') return
    setSaving(true)
    try {
      await academicTemplatesApi.delete(deleteConfirm.id)
      await loadData()
      setDeleteConfirm(null)
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al eliminar plantilla')
    } finally {
      setSaving(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ÁREAS EN PLANTILLA
  // ═══════════════════════════════════════════════════════════════════════════

  const openAreaModal = (templateId: string, templateArea?: TemplateArea) => {
    if (templateArea) {
      setEditingTemplateArea({ templateId, templateArea })
      setAreaForm({
        areaId: templateArea.areaId,
        weightPercentage: templateArea.weightPercentage,
        calculationType: templateArea.calculationType,
        approvalRule: templateArea.approvalRule,
        recoveryRule: templateArea.recoveryRule,
        isMandatory: templateArea.isMandatory,
      })
    } else {
      setEditingTemplateArea({ templateId, templateArea: null })
      setAreaForm({ areaId: '', weightPercentage: 0, calculationType: 'AVERAGE', approvalRule: 'AREA_AVERAGE', recoveryRule: 'INDIVIDUAL_SUBJECT', isMandatory: true })
    }
    setShowAreaModal(true)
  }

  const saveTemplateArea = async () => {
    if (!editingTemplateArea || !areaForm.areaId) return
    setSaving(true)
    try {
      if (editingTemplateArea.templateArea) {
        await academicTemplatesApi.updateArea(editingTemplateArea.templateArea.id, areaForm)
      } else {
        await academicTemplatesApi.addArea(editingTemplateArea.templateId, areaForm)
      }
      await loadData()
      setShowAreaModal(false)
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al guardar área')
    } finally {
      setSaving(false)
    }
  }

  const removeTemplateArea = async (templateAreaId: string) => {
    setSaving(true)
    try {
      await academicTemplatesApi.removeArea(templateAreaId)
      await loadData()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al eliminar área')
    } finally {
      setSaving(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ASIGNATURAS EN PLANTILLA
  // ═══════════════════════════════════════════════════════════════════════════

  const openSubjectModal = (templateAreaId: string, templateSubject?: TemplateSubject) => {
    if (templateSubject) {
      setEditingTemplateSubject({ templateAreaId, templateSubject })
      setSubjectForm({
        subjectId: templateSubject.subjectId,
        weeklyHours: templateSubject.weeklyHours,
        weightPercentage: templateSubject.weightPercentage,
        isDominant: templateSubject.isDominant,
      })
    } else {
      setEditingTemplateSubject({ templateAreaId, templateSubject: null })
      setSubjectForm({ subjectId: '', weeklyHours: 4, weightPercentage: 100, isDominant: false })
    }
    setShowSubjectModal(true)
  }

  const saveTemplateSubject = async () => {
    if (!editingTemplateSubject || !subjectForm.subjectId) return
    setSaving(true)
    try {
      if (editingTemplateSubject.templateSubject) {
        await academicTemplatesApi.updateSubject(editingTemplateSubject.templateSubject.id, subjectForm)
      } else {
        await academicTemplatesApi.addSubject(editingTemplateSubject.templateAreaId, subjectForm)
      }
      await loadData()
      setShowSubjectModal(false)
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al guardar asignatura')
    } finally {
      setSaving(false)
    }
  }

  const removeTemplateSubject = async (templateSubjectId: string) => {
    setSaving(true)
    try {
      await academicTemplatesApi.removeSubject(templateSubjectId)
      await loadData()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al eliminar asignatura')
    } finally {
      setSaving(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ASIGNACIÓN A GRADOS
  // ═══════════════════════════════════════════════════════════════════════════

  const openAssignModal = (grade: Grade) => {
    setAssigningGrade(grade)
    setAssignForm({ templateId: grade.gradeTemplates?.[0]?.template?.id || '' })
    setShowAssignModal(true)
  }

  const saveGradeAssignment = async () => {
    if (!assigningGrade) return
    setSaving(true)
    try {
      if (assignForm.templateId && selectedYear) {
        await academicTemplatesApi.assignToGrade(assigningGrade.id, assignForm.templateId, selectedYear.id)
      } else if (assigningGrade.gradeTemplates?.length && selectedYear) {
        await academicTemplatesApi.removeFromGrade(assigningGrade.id, selectedYear.id)
      }
      await loadData()
      setShowAssignModal(false)
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al asignar plantilla')
    } finally {
      setSaving(false)
    }
  }

  // Obtener asignaturas disponibles para un área específica
  const getAvailableSubjects = (areaId: string) => {
    const area = areas.find(a => a.id === areaId)
    return area?.subjects || []
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plantillas Académicas</h1>
          <p className="text-gray-600 mt-1">
            Configura la estructura académica para cada nivel o grado
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Selector de Año Académico */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <select
              value={selectedYear?.id || ''}
              onChange={(e) => {
                const year = academicYears.find(y => y.id === e.target.value)
                setSelectedYear(year || null)
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              {academicYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name || `Año ${year.year}`} {year.status === 'ACTIVE' ? '(Activo)' : year.status === 'CLOSED' ? '(Cerrado)' : ''}
                </option>
              ))}
            </select>
          </div>
          {activeTab === 'templates' && selectedYear && (
            <button
              onClick={() => openTemplateModal()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nueva Plantilla
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('templates')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'templates'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Plantillas
            </div>
          </button>
          <button
            onClick={() => setActiveTab('grades')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'grades'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4" />
              Asignación a Grados
            </div>
          </button>
        </nav>
      </div>

      {/* Tab: Plantillas */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          {templates.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <Layers className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900">No hay plantillas creadas</h3>
              <p className="text-gray-500 mt-1">Crea tu primera plantilla académica</p>
              <button
                onClick={() => openTemplateModal()}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Crear plantilla
              </button>
            </div>
          ) : (
            templates.map((template) => (
              <div key={template.id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                {/* Cabecera de Plantilla */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleExpandTemplate(template.id)}
                >
                  <div className="flex items-center gap-3">
                    {expandedTemplates.has(template.id) ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{template.name}</h3>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          {levelLabels[template.level] || template.level}
                        </span>
                        {template.isDefault && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded flex items-center gap-1">
                            <Star className="w-3 h-3" /> Por defecto
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {template.templateAreas.length} área{template.templateAreas.length !== 1 ? 's' : ''}
                        {template._count?.gradeTemplates ? ` • ${template._count.gradeTemplates} grado${template._count.gradeTemplates !== 1 ? 's' : ''} asignado${template._count.gradeTemplates !== 1 ? 's' : ''}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => openAreaModal(template.id)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                      title="Agregar área"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openTemplateModal(template)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="Editar plantilla"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({ type: 'template', id: template.id, name: template.name })}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="Eliminar plantilla"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Áreas de la Plantilla */}
                {expandedTemplates.has(template.id) && (
                  <div className="border-t border-gray-100 bg-gray-50">
                    {template.templateAreas.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        <p>No hay áreas configuradas</p>
                        <button
                          onClick={() => openAreaModal(template.id)}
                          className="mt-2 text-blue-600 hover:underline text-sm"
                        >
                          + Agregar área
                        </button>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {template.templateAreas.map((ta) => (
                          <div key={ta.id}>
                            {/* Cabecera del Área */}
                            <div
                              className="flex items-center justify-between px-4 py-3 pl-10 hover:bg-gray-100 cursor-pointer"
                              onClick={() => toggleExpandArea(ta.id)}
                            >
                              <div className="flex items-center gap-3">
                                {expandedAreas.has(ta.id) ? (
                                  <ChevronDown className="w-4 h-4 text-gray-400" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-gray-400" />
                                )}
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-800">{ta.area.name}</span>
                                    <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                                      {ta.weightPercentage}%
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {calculationTypeLabels[ta.calculationType]}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500">
                                    {ta.templateSubjects.length} asignatura{ta.templateSubjects.length !== 1 ? 's' : ''}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => openSubjectModal(ta.id)}
                                  className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                                  title="Agregar asignatura"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => openAreaModal(template.id, ta)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                  title="Editar"
                                >
                                  <Settings className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => removeTemplateArea(ta.id)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                  title="Quitar"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Asignaturas del Área */}
                            {expandedAreas.has(ta.id) && ta.templateSubjects.length > 0 && (
                              <div className="bg-white border-t border-gray-100">
                                {ta.templateSubjects.map((ts) => (
                                  <div
                                    key={ts.id}
                                    className="flex items-center justify-between px-4 py-2 pl-20 hover:bg-gray-50"
                                  >
                                    <div className="flex items-center gap-3">
                                      <BookOpen className="w-4 h-4 text-gray-400" />
                                      <span className="text-gray-700">{ts.subject.name}</span>
                                      <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <span className="flex items-center gap-1">
                                          <Clock className="w-3 h-3" /> {ts.weeklyHours}h
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <Percent className="w-3 h-3" /> {ts.weightPercentage}%
                                        </span>
                                        {ts.isDominant && (
                                          <span className="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                                            Dominante
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => openSubjectModal(ta.id, ts)}
                                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => removeTemplateSubject(ts.id)}
                                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Asignación a Grados */}
      {activeTab === 'grades' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nivel</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plantilla Asignada</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {grades.map((grade) => (
                <tr key={grade.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{grade.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">{grade.stage}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {grade.gradeTemplates?.[0] ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-sm">
                        <Layers className="w-3 h-3" />
                        {grade.gradeTemplates[0].template.name}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">Sin asignar</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={() => openAssignModal(grade)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      {grade.gradeTemplates?.[0] ? 'Cambiar' : 'Asignar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Plantilla */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">
                {editingTemplate ? 'Editar Plantilla' : 'Nueva Plantilla'}
              </h2>
              <button onClick={() => setShowTemplateModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Plantilla Primaria"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nivel Académico</label>
                <select
                  value={templateForm.level}
                  onChange={(e) => setTemplateForm({ ...templateForm, level: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(levelLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={templateForm.description}
                  onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Logros por período</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={templateForm.achievementsPerPeriod}
                    onChange={(e) => setTemplateForm({ ...templateForm, achievementsPerPeriod: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={templateForm.useAttitudinalAchievement}
                      onChange={(e) => setTemplateForm({ ...templateForm, useAttitudinalAchievement: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-700">Logro actitudinal</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={templateForm.isDefault}
                    onChange={(e) => setTemplateForm({ ...templateForm, isDefault: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Plantilla por defecto para este nivel</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
              <button onClick={() => setShowTemplateModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                Cancelar
              </button>
              <button
                onClick={saveTemplate}
                disabled={saving || !templateForm.name.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Área en Plantilla */}
      {showAreaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">
                {editingTemplateArea?.templateArea ? 'Configurar Área' : 'Agregar Área'}
              </h2>
              <button onClick={() => setShowAreaModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Área *</label>
                <select
                  value={areaForm.areaId}
                  onChange={(e) => setAreaForm({ ...areaForm, areaId: e.target.value })}
                  disabled={!!editingTemplateArea?.templateArea}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                >
                  <option value="">Seleccionar área...</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>{area.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Peso (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={areaForm.weightPercentage}
                    onChange={(e) => setAreaForm({ ...areaForm, weightPercentage: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cálculo</label>
                  <select
                    value={areaForm.calculationType}
                    onChange={(e) => setAreaForm({ ...areaForm, calculationType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="AVERAGE">Promedio simple</option>
                    <option value="WEIGHTED">Ponderado</option>
                    <option value="DOMINANT">Dominante</option>
                    <option value="INFORMATIVE">Informativa</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={areaForm.isMandatory}
                    onChange={(e) => setAreaForm({ ...areaForm, isMandatory: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Área obligatoria</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
              <button onClick={() => setShowAreaModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                Cancelar
              </button>
              <button
                onClick={saveTemplateArea}
                disabled={saving || !areaForm.areaId}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Asignatura en Plantilla */}
      {showSubjectModal && editingTemplateSubject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">
                {editingTemplateSubject.templateSubject ? 'Configurar Asignatura' : 'Agregar Asignatura'}
              </h2>
              <button onClick={() => setShowSubjectModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Asignatura *</label>
                <select
                  value={subjectForm.subjectId}
                  onChange={(e) => setSubjectForm({ ...subjectForm, subjectId: e.target.value })}
                  disabled={!!editingTemplateSubject.templateSubject}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                >
                  <option value="">Seleccionar asignatura...</option>
                  {/* Buscar el área correspondiente al templateArea */}
                  {(() => {
                    const template = templates.find(t => t.templateAreas.some(ta => ta.id === editingTemplateSubject.templateAreaId))
                    const templateArea = template?.templateAreas.find(ta => ta.id === editingTemplateSubject.templateAreaId)
                    const subjects = templateArea ? getAvailableSubjects(templateArea.areaId) : []
                    return subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>{subject.name}</option>
                    ))
                  })()}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Horas semanales</label>
                  <input
                    type="number"
                    min="0"
                    max="40"
                    value={subjectForm.weeklyHours}
                    onChange={(e) => setSubjectForm({ ...subjectForm, weeklyHours: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Peso en área (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={subjectForm.weightPercentage}
                    onChange={(e) => setSubjectForm({ ...subjectForm, weightPercentage: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={subjectForm.isDominant}
                    onChange={(e) => setSubjectForm({ ...subjectForm, isDominant: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Asignatura dominante del área</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
              <button onClick={() => setShowSubjectModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                Cancelar
              </button>
              <button
                onClick={saveTemplateSubject}
                disabled={saving || !subjectForm.subjectId}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Asignación a Grado */}
      {showAssignModal && assigningGrade && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Asignar Plantilla a {assigningGrade.name}</h2>
              <button onClick={() => setShowAssignModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Plantilla</label>
              <select
                value={assignForm.templateId}
                onChange={(e) => setAssignForm({ templateId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sin plantilla</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({levelLabels[template.level]})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
              <button onClick={() => setShowAssignModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                Cancelar
              </button>
              <button
                onClick={saveGradeAssignment}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">¿Eliminar plantilla?</h3>
              <p className="text-gray-600 mb-6">
                Estás por eliminar <strong>"{deleteConfirm.name}"</strong>. Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={deleteTemplate}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
