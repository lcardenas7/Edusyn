import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { classroomApi } from '../lib/api'
import {
  BookOpen, Plus, Loader2, AlertCircle, ChevronLeft, Users, Megaphone,
  FolderOpen, FileText, Video, Link2, ImageIcon, Type, Eye, EyeOff,
  Trash2, Pencil, Pin, PinOff, X, Upload, ExternalLink, ChevronDown, ChevronUp,
  GraduationCap, Clock, Layers,
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface ClassroomListItem {
  id: string
  title: string
  description?: string
  color?: string
  coverImage?: string
  isActive: boolean
  teacherAssignment: {
    id: string
    group: { id: string; name: string; grade: { id: string; name: string } }
    subject: { id: string; name: string }
    teacher?: { id: string; firstName: string; lastName: string }
  }
  _count: { sections: number; activities: number; announcements: number }
  studentCount?: number
}

interface Section {
  id: string
  title: string
  description?: string
  sortOrder: number
  isVisible: boolean
  materials: Material[]
  activities?: { id: string; type: string; title: string; dueDate?: string; maxScore?: number }[]
}

interface Material {
  id: string
  type: string
  title: string
  content?: string
  fileUrl?: string
  sortOrder: number
  isVisible: boolean
}

interface Announcement {
  id: string
  title: string
  content: string
  isPinned: boolean
  createdAt: string
  author: { id: string; firstName: string; lastName: string }
}

const MATERIAL_TYPES = [
  { value: 'DOCUMENT', label: 'Documento', icon: FileText, accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx' },
  { value: 'VIDEO_YOUTUBE', label: 'Video YouTube', icon: Video },
  { value: 'LINK', label: 'Enlace externo', icon: Link2 },
  { value: 'TEXT', label: 'Texto / Nota', icon: Type },
  { value: 'IMAGE', label: 'Imagen', icon: ImageIcon, accept: 'image/*' },
]

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316']

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function Classroom() {
  const { user } = useAuth()
  const isTeacher = user?.roles?.some((r: any) => ['DOCENTE', 'COORDINADOR'].includes(r.role?.name || r.roleName || ''))
  const isStudent = user?.roles?.some((r: any) => ['ESTUDIANTE'].includes(r.role?.name || r.roleName || ''))

  const [classrooms, setClassrooms] = useState<ClassroomListItem[]>([])
  const [activeClassroom, setActiveClassroom] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
  const [availableAssignments, setAvailableAssignments] = useState<any[]>([])
  const [createForm, setCreateForm] = useState({ teacherAssignmentId: '', color: '#3B82F6' })

  // Section form
  const [showAddSection, setShowAddSection] = useState(false)
  const [newSectionTitle, setNewSectionTitle] = useState('')

  // Material form
  const [addingMaterialTo, setAddingMaterialTo] = useState<string | null>(null)
  const [materialForm, setMaterialForm] = useState({ type: 'TEXT', title: '', content: '' })

  // Announcement form
  const [showAddAnnouncement, setShowAddAnnouncement] = useState(false)
  const [announcementForm, setAnnouncementForm] = useState({ title: '', content: '' })

  // Active tab
  const [activeTab, setActiveTab] = useState<'home' | 'content' | 'students'>('home')

  // Editing
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [editingSectionTitle, setEditingSectionTitle] = useState('')

  // ═══════════════════════════════════════════════════════════════════════
  // LOADERS
  // ═══════════════════════════════════════════════════════════════════════

  const loadClassrooms = useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await classroomApi.list(isStudent ? 'student' : undefined)
      setClassrooms(data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al cargar aulas')
    } finally {
      setLoading(false)
    }
  }, [isStudent])

  useEffect(() => { loadClassrooms() }, [loadClassrooms])

  const loadClassroom = async (id: string) => {
    try {
      setLoading(true)
      const { data } = await classroomApi.getById(id)
      setActiveClassroom(data)
      setActiveTab('home')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al cargar aula')
    } finally {
      setLoading(false)
    }
  }

  const loadAvailableAssignments = async () => {
    try {
      const { data } = await classroomApi.getAvailableAssignments()
      setAvailableAssignments(data)
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════

  const handleCreate = async () => {
    if (!createForm.teacherAssignmentId) return
    try {
      await classroomApi.create({ ...createForm })
      setShowCreate(false)
      setCreateForm({ teacherAssignmentId: '', color: '#3B82F6' })
      loadClassrooms()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al crear aula')
    }
  }

  const handleAddSection = async () => {
    if (!newSectionTitle.trim() || !activeClassroom) return
    try {
      await classroomApi.createSection(activeClassroom.id, { title: newSectionTitle.trim() })
      setNewSectionTitle('')
      setShowAddSection(false)
      loadClassroom(activeClassroom.id)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al crear sección')
    }
  }

  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm('¿Eliminar esta sección y todos sus materiales?')) return
    try {
      await classroomApi.deleteSection(sectionId)
      loadClassroom(activeClassroom.id)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al eliminar sección')
    }
  }

  const handleToggleSectionVisibility = async (sectionId: string, currentVisible: boolean) => {
    try {
      await classroomApi.updateSection(sectionId, { isVisible: !currentVisible })
      loadClassroom(activeClassroom.id)
    } catch {}
  }

  const handleUpdateSectionTitle = async (sectionId: string) => {
    if (!editingSectionTitle.trim()) return
    try {
      await classroomApi.updateSection(sectionId, { title: editingSectionTitle.trim() })
      setEditingSection(null)
      loadClassroom(activeClassroom.id)
    } catch {}
  }

  const handleAddMaterial = async () => {
    if (!materialForm.title.trim() || !addingMaterialTo) return
    try {
      await classroomApi.createMaterial(addingMaterialTo, {
        type: materialForm.type,
        title: materialForm.title.trim(),
        content: materialForm.content || undefined,
      })
      setAddingMaterialTo(null)
      setMaterialForm({ type: 'TEXT', title: '', content: '' })
      loadClassroom(activeClassroom.id)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al agregar material')
    }
  }

  const handleDeleteMaterial = async (materialId: string) => {
    try {
      await classroomApi.deleteMaterial(materialId)
      loadClassroom(activeClassroom.id)
    } catch {}
  }

  const handleToggleMaterialVisibility = async (materialId: string, currentVisible: boolean) => {
    try {
      await classroomApi.updateMaterial(materialId, { isVisible: !currentVisible })
      loadClassroom(activeClassroom.id)
    } catch {}
  }

  const handleAddAnnouncement = async () => {
    if (!announcementForm.title.trim() || !announcementForm.content.trim() || !activeClassroom) return
    try {
      await classroomApi.createAnnouncement(activeClassroom.id, announcementForm)
      setAnnouncementForm({ title: '', content: '' })
      setShowAddAnnouncement(false)
      loadClassroom(activeClassroom.id)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al crear anuncio')
    }
  }

  const handleTogglePin = async (announcementId: string, currentPinned: boolean) => {
    try {
      await classroomApi.updateAnnouncement(announcementId, { isPinned: !currentPinned })
      loadClassroom(activeClassroom.id)
    } catch {}
  }

  const handleDeleteAnnouncement = async (announcementId: string) => {
    if (!confirm('¿Eliminar este anuncio?')) return
    try {
      await classroomApi.deleteAnnouncement(announcementId)
      loadClassroom(activeClassroom.id)
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MATERIAL ICON
  // ═══════════════════════════════════════════════════════════════════════

  const getMaterialIcon = (type: string) => {
    switch (type) {
      case 'DOCUMENT': return <FileText className="w-4 h-4 text-blue-500" />
      case 'VIDEO_YOUTUBE': case 'VIDEO_UPLOAD': return <Video className="w-4 h-4 text-red-500" />
      case 'LINK': return <Link2 className="w-4 h-4 text-green-500" />
      case 'TEXT': return <Type className="w-4 h-4 text-purple-500" />
      case 'IMAGE': return <ImageIcon className="w-4 h-4 text-pink-500" />
      default: return <FileText className="w-4 h-4 text-slate-400" />
    }
  }

  const extractYoutubeId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/)
    return match ? match[1] : null
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: CLASSROOM LIST
  // ═══════════════════════════════════════════════════════════════════════

  if (!activeClassroom) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {isStudent ? 'Mis Clases' : 'Aula Virtual'}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {isStudent ? 'Accede a tus clases y materiales' : 'Gestiona tus aulas virtuales por asignatura'}
            </p>
          </div>
          {isTeacher && (
            <button
              onClick={() => { setShowCreate(true); loadAvailableAssignments() }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Crear Aula
            </button>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
            <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : classrooms.length === 0 ? (
          <div className="text-center py-20">
            <GraduationCap className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-600">
              {isStudent ? 'No tienes clases asignadas aún' : 'No has creado aulas virtuales'}
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              {isStudent ? 'Tus docentes crearán las aulas de tus asignaturas' : 'Crea tu primera aula para comenzar a publicar contenido'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classrooms.map(c => (
              <button
                key={c.id}
                onClick={() => loadClassroom(c.id)}
                className="text-left bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all group"
              >
                {/* Color bar */}
                <div className="h-2" style={{ backgroundColor: c.color || '#3B82F6' }} />
                <div className="p-4">
                  <h3 className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                    {c.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {c.teacherAssignment.group.grade.name} {c.teacherAssignment.group.name} · {c.teacherAssignment.subject.name}
                  </p>
                  {isStudent && c.teacherAssignment.teacher && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      Prof. {c.teacherAssignment.teacher.firstName} {c.teacherAssignment.teacher.lastName}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><Layers className="w-3.5 h-3.5" />{c._count.sections} secciones</span>
                    <span className="flex items-center gap-1"><Megaphone className="w-3.5 h-3.5" />{c._count.announcements}</span>
                    {c.studentCount !== undefined && (
                      <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{c.studentCount}</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4">Crear Aula Virtual</h2>

              {availableAssignments.length === 0 ? (
                <p className="text-sm text-slate-500 py-4">No tienes asignaciones disponibles para crear aulas. Todas tus asignaturas ya tienen aula o no tienes carga académica activa.</p>
              ) : (
                <>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Asignatura y grupo</label>
                  <select
                    value={createForm.teacherAssignmentId}
                    onChange={e => setCreateForm({ ...createForm, teacherAssignmentId: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-3"
                  >
                    <option value="">Seleccionar...</option>
                    {availableAssignments.map((a: any) => (
                      <option key={a.id} value={a.id}>
                        {a.subject.name} — {a.group.grade.name} {a.group.name}
                      </option>
                    ))}
                  </select>

                  <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
                  <div className="flex gap-2 mb-4">
                    {COLORS.map(color => (
                      <button
                        key={color}
                        onClick={() => setCreateForm({ ...createForm, color })}
                        className={`w-7 h-7 rounded-full border-2 transition-all ${createForm.color === color ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                {availableAssignments.length > 0 && (
                  <button
                    onClick={handleCreate}
                    disabled={!createForm.teacherAssignmentId}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    Crear Aula
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: CLASSROOM DETAIL
  // ═══════════════════════════════════════════════════════════════════════

  const sections: Section[] = activeClassroom.sections || []
  const announcements: Announcement[] = activeClassroom.announcements || []
  const ta = activeClassroom.teacherAssignment

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setActiveClassroom(null)}
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: activeClassroom.color || '#3B82F6' }} />
            <h1 className="text-xl font-bold text-slate-800">{activeClassroom.title}</h1>
          </div>
          <p className="text-sm text-slate-500 ml-5">
            {ta.group.grade.name} {ta.group.name} · {ta.subject.name}
            {ta.teacher && ` · Prof. ${ta.teacher.firstName} ${ta.teacher.lastName}`}
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4" />{error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
        {([
          { key: 'home', label: 'Inicio', icon: Megaphone },
          { key: 'content', label: 'Contenido', icon: FolderOpen },
          ...(isTeacher ? [{ key: 'students', label: 'Estudiantes', icon: Users }] : []),
        ] as { key: string; label: string; icon: any }[]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TAB: INICIO (Anuncios) */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'home' && !loading && (
        <div className="space-y-4">
          {isTeacher && (
            <div className="flex justify-end">
              <button
                onClick={() => setShowAddAnnouncement(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />Nuevo Anuncio
              </button>
            </div>
          )}

          {showAddAnnouncement && (
            <div className="bg-white border border-blue-200 rounded-xl p-4">
              <input
                value={announcementForm.title}
                onChange={e => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                placeholder="Título del anuncio"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-2"
                autoFocus
              />
              <textarea
                value={announcementForm.content}
                onChange={e => setAnnouncementForm({ ...announcementForm, content: e.target.value })}
                placeholder="Escribe tu anuncio aquí..."
                rows={3}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-2 resize-none"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowAddAnnouncement(false)} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                <button onClick={handleAddAnnouncement} disabled={!announcementForm.title.trim() || !announcementForm.content.trim()} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Publicar</button>
              </div>
            </div>
          )}

          {announcements.length === 0 && !showAddAnnouncement ? (
            <div className="text-center py-12 text-slate-400">
              <Megaphone className="w-12 h-12 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No hay anuncios aún</p>
            </div>
          ) : (
            announcements.map(a => (
              <div key={a.id} className={`bg-white rounded-xl border p-4 ${a.isPinned ? 'border-yellow-300 bg-yellow-50/30' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {a.isPinned && <Pin className="w-3.5 h-3.5 text-yellow-500" />}
                      <h3 className="font-semibold text-slate-800 text-sm">{a.title}</h3>
                    </div>
                    <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{a.content}</p>
                    <p className="text-xs text-slate-400 mt-2">
                      {a.author.firstName} {a.author.lastName} · {new Date(a.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  {isTeacher && (
                    <div className="flex gap-1 ml-2">
                      <button onClick={() => handleTogglePin(a.id, a.isPinned)} className="p-1 rounded hover:bg-slate-100" title={a.isPinned ? 'Desfijar' : 'Fijar'}>
                        {a.isPinned ? <PinOff className="w-3.5 h-3.5 text-slate-400" /> : <Pin className="w-3.5 h-3.5 text-slate-400" />}
                      </button>
                      <button onClick={() => handleDeleteAnnouncement(a.id)} className="p-1 rounded hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TAB: CONTENIDO (Secciones + Materiales) */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'content' && !loading && (
        <div className="space-y-4">
          {isTeacher && (
            <div className="flex justify-end">
              <button
                onClick={() => setShowAddSection(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />Nueva Sección
              </button>
            </div>
          )}

          {showAddSection && (
            <div className="bg-white border border-blue-200 rounded-xl p-4 flex gap-2">
              <input
                value={newSectionTitle}
                onChange={e => setNewSectionTitle(e.target.value)}
                placeholder="Nombre de la sección (ej: Semana 1, Unidad: Fracciones)"
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleAddSection()}
              />
              <button onClick={() => setShowAddSection(false)} className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
              <button onClick={handleAddSection} disabled={!newSectionTitle.trim()} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Crear</button>
            </div>
          )}

          {sections.length === 0 && !showAddSection ? (
            <div className="text-center py-12 text-slate-400">
              <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No hay secciones de contenido aún</p>
              {isTeacher && <p className="text-xs mt-1">Crea secciones para organizar tu material por temas o semanas</p>}
            </div>
          ) : (
            sections
              .filter(s => isTeacher || s.isVisible)
              .map(section => (
                <div key={section.id} className={`bg-white rounded-xl border ${section.isVisible ? 'border-slate-200' : 'border-dashed border-slate-300 opacity-70'}`}>
                  {/* Section header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <div className="flex items-center gap-2 flex-1">
                      <FolderOpen className="w-4 h-4 text-blue-500" />
                      {editingSection === section.id ? (
                        <input
                          value={editingSectionTitle}
                          onChange={e => setEditingSectionTitle(e.target.value)}
                          onBlur={() => handleUpdateSectionTitle(section.id)}
                          onKeyDown={e => e.key === 'Enter' && handleUpdateSectionTitle(section.id)}
                          className="flex-1 border border-blue-300 rounded px-2 py-1 text-sm"
                          autoFocus
                        />
                      ) : (
                        <h3 className="font-semibold text-slate-700 text-sm">{section.title}</h3>
                      )}
                      {!section.isVisible && <span className="text-xs bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded">Oculta</span>}
                    </div>
                    {isTeacher && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditingSection(section.id); setEditingSectionTitle(section.title) }} className="p-1 rounded hover:bg-slate-100" title="Renombrar">
                          <Pencil className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                        <button onClick={() => handleToggleSectionVisibility(section.id, section.isVisible)} className="p-1 rounded hover:bg-slate-100" title={section.isVisible ? 'Ocultar' : 'Mostrar'}>
                          {section.isVisible ? <EyeOff className="w-3.5 h-3.5 text-slate-400" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
                        </button>
                        <button onClick={() => handleDeleteSection(section.id)} className="p-1 rounded hover:bg-red-50" title="Eliminar">
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Materials */}
                  <div className="p-3 space-y-2">
                    {section.description && (
                      <p className="text-xs text-slate-500 mb-2">{section.description}</p>
                    )}

                    {section.materials
                      .filter(m => isTeacher || m.isVisible)
                      .map(material => (
                        <div key={material.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${material.isVisible ? 'bg-slate-50 hover:bg-slate-100' : 'bg-slate-50/50 opacity-60'} group transition-colors`}>
                          {getMaterialIcon(material.type)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">{material.title}</p>
                            {material.type === 'TEXT' && material.content && (
                              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{material.content}</p>
                            )}
                            {material.type === 'VIDEO_YOUTUBE' && material.content && (
                              <div className="mt-2 aspect-video max-w-md rounded-lg overflow-hidden">
                                <iframe
                                  src={`https://www.youtube-nocookie.com/embed/${extractYoutubeId(material.content)}`}
                                  className="w-full h-full"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                />
                              </div>
                            )}
                            {material.type === 'LINK' && material.content && (
                              <a href={material.content} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-0.5">
                                <ExternalLink className="w-3 h-3" />{material.content}
                              </a>
                            )}
                          </div>
                          {isTeacher && (
                            <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                              <button onClick={() => handleToggleMaterialVisibility(material.id, material.isVisible)} className="p-1 rounded hover:bg-slate-200">
                                {material.isVisible ? <EyeOff className="w-3.5 h-3.5 text-slate-400" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
                              </button>
                              <button onClick={() => handleDeleteMaterial(material.id)} className="p-1 rounded hover:bg-red-50">
                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}

                    {/* Add material */}
                    {isTeacher && addingMaterialTo === section.id ? (
                      <div className="border border-blue-200 rounded-lg p-3 bg-blue-50/30 space-y-2">
                        <div className="flex gap-2">
                          <select
                            value={materialForm.type}
                            onChange={e => setMaterialForm({ ...materialForm, type: e.target.value })}
                            className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs"
                          >
                            {MATERIAL_TYPES.map(t => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                          <input
                            value={materialForm.title}
                            onChange={e => setMaterialForm({ ...materialForm, title: e.target.value })}
                            placeholder="Título del recurso"
                            className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-xs"
                            autoFocus
                          />
                        </div>
                        {(materialForm.type === 'TEXT') && (
                          <textarea
                            value={materialForm.content}
                            onChange={e => setMaterialForm({ ...materialForm, content: e.target.value })}
                            placeholder="Escribe el contenido aquí..."
                            rows={3}
                            className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs resize-none"
                          />
                        )}
                        {(materialForm.type === 'VIDEO_YOUTUBE' || materialForm.type === 'LINK') && (
                          <input
                            value={materialForm.content}
                            onChange={e => setMaterialForm({ ...materialForm, content: e.target.value })}
                            placeholder={materialForm.type === 'VIDEO_YOUTUBE' ? 'URL de YouTube (ej: https://youtube.com/watch?v=...)' : 'URL del enlace'}
                            className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs"
                          />
                        )}
                        <div className="flex justify-end gap-2">
                          <button onClick={() => { setAddingMaterialTo(null); setMaterialForm({ type: 'TEXT', title: '', content: '' }) }} className="px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded">Cancelar</button>
                          <button onClick={handleAddMaterial} disabled={!materialForm.title.trim()} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">Agregar</button>
                        </div>
                      </div>
                    ) : isTeacher ? (
                      <button
                        onClick={() => { setAddingMaterialTo(section.id); setMaterialForm({ type: 'TEXT', title: '', content: '' }) }}
                        className="w-full flex items-center justify-center gap-1.5 px-2 py-2 text-xs text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-dashed border-slate-200 hover:border-blue-300 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Agregar recurso
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TAB: ESTUDIANTES */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'students' && !loading && isTeacher && (
        <StudentsTab classroomId={activeClassroom.id} teacherId={user?.id || ''} />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// STUDENTS TAB (separate to avoid re-fetching on every render)
// ═══════════════════════════════════════════════════════════════════════════

function StudentsTab({ classroomId, teacherId }: { classroomId: string; teacherId: string }) {
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const { data } = await classroomApi.getStudents(classroomId)
        setStudents(data)
      } catch {
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [classroomId])

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Estudiantes del grupo</h3>
        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{students.length}</span>
      </div>
      <div className="divide-y divide-slate-100">
        {students.map((s: any, i: number) => (
          <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="text-xs text-slate-400 w-6 text-right">{i + 1}</span>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
              {s.student?.user?.firstName?.[0]}{s.student?.user?.lastName?.[0]}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">
                {s.student?.user?.lastName}, {s.student?.user?.firstName}
              </p>
              {s.student?.user?.email && (
                <p className="text-xs text-slate-400">{s.student.user.email}</p>
              )}
            </div>
          </div>
        ))}
        {students.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-sm">No hay estudiantes matriculados en este grupo</div>
        )}
      </div>
    </div>
  )
}
