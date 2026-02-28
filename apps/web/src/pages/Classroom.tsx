import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { classroomApi, storageApi } from '../lib/api'
import {
  Plus, Loader2, AlertCircle, ChevronLeft, Users, Megaphone,
  FolderOpen, FileText, Video, Link2, ImageIcon, Type, Eye, EyeOff,
  Trash2, Pencil, Pin, PinOff, X, Upload, ExternalLink,
  GraduationCap, Layers, ClipboardList, BookOpen, Download,
  Bold, Italic, Underline, List, ListOrdered, Youtube,
  FileUp, Image, Search, Paperclip, File,
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
  attachmentUrl?: string
  attachmentName?: string
  createdAt: string
  author: { id: string; firstName: string; lastName: string }
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316']

type TabKey = 'home' | 'content' | 'activities' | 'students'

const TEACHER_TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'home', label: 'Inicio', icon: Megaphone },
  { key: 'content', label: 'Contenido', icon: FolderOpen },
  { key: 'activities', label: 'Actividades', icon: ClipboardList },
  { key: 'students', label: 'Estudiantes', icon: Users },
]

const STUDENT_TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'home', label: 'Inicio', icon: Megaphone },
  { key: 'content', label: 'Contenido', icon: FolderOpen },
  { key: 'activities', label: 'Actividades', icon: ClipboardList },
]

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const getMaterialIcon = (type: string, size = 'w-4 h-4') => {
  switch (type) {
    case 'DOCUMENT': return <FileText className={`${size} text-blue-500`} />
    case 'VIDEO_YOUTUBE': case 'VIDEO_UPLOAD': return <Video className={`${size} text-red-500`} />
    case 'LINK': return <Link2 className={`${size} text-green-500`} />
    case 'TEXT': return <Type className={`${size} text-purple-500`} />
    case 'IMAGE': return <ImageIcon className={`${size} text-pink-500`} />
    default: return <FileText className={`${size} text-slate-400`} />
  }
}

const getMaterialLabel = (type: string) => {
  switch (type) {
    case 'DOCUMENT': return 'Documento'
    case 'VIDEO_YOUTUBE': return 'Video YouTube'
    case 'LINK': return 'Enlace'
    case 'TEXT': return 'Texto'
    case 'IMAGE': return 'Imagen'
    default: return type
  }
}

const extractYoutubeId = (url: string) => {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : null
}

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
  const [activeTab, setActiveTab] = useState<TabKey>('home')

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
  const [availableAssignments, setAvailableAssignments] = useState<any[]>([])
  const [createForm, setCreateForm] = useState({ teacherAssignmentId: '', color: '#3B82F6' })

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

  const loadClassroom = async (id: string, preserveTab = false) => {
    try {
      setLoading(true)
      const { data } = await classroomApi.getById(id)
      setActiveClassroom(data)
      if (!preserveTab) setActiveTab('home')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al cargar aula')
    } finally {
      setLoading(false)
    }
  }

  const reloadClassroom = () => { if (activeClassroom?.id) loadClassroom(activeClassroom.id, true) }

  const loadAvailableAssignments = async () => {
    try {
      const { data } = await classroomApi.getAvailableAssignments()
      setAvailableAssignments(data)
    } catch {}
  }

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
            <AlertCircle className="w-4 h-4" />{error}
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
                    <span className="flex items-center gap-1"><Layers className="w-3.5 h-3.5" />{c._count.sections}</span>
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
                  <button onClick={handleCreate} disabled={!createForm.teacherAssignmentId} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Crear Aula</button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: CLASSROOM DETAIL (sidebar + content area)
  // ═══════════════════════════════════════════════════════════════════════

  const ta = activeClassroom.teacherAssignment
  const tabs = isTeacher ? TEACHER_TABS : STUDENT_TABS

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* ── SIDEBAR ── */}
      <div className="w-60 shrink-0 bg-white border-r border-slate-200 flex flex-col">
        {/* Classroom header */}
        <div className="p-4 border-b border-slate-100">
          <button onClick={() => setActiveClassroom(null)} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 mb-2">
            <ChevronLeft className="w-3.5 h-3.5" /> Todas las aulas
          </button>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: activeClassroom.color || '#3B82F6' }} />
            <h2 className="font-bold text-slate-800 text-sm leading-tight line-clamp-2">{activeClassroom.title}</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 ml-5">
            {ta.group.grade.name} {ta.group.name}
          </p>
          <p className="text-xs text-slate-400 ml-5">
            {ta.subject.name}
          </p>
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-2 space-y-0.5">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <tab.icon className={`w-4 h-4 ${activeTab === tab.key ? 'text-blue-600' : 'text-slate-400'}`} />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Teacher info at bottom */}
        {ta.teacher && (
          <div className="p-4 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                {ta.teacher.firstName?.[0]}{ta.teacher.lastName?.[0]}
              </div>
              <div>
                <p className="text-xs font-medium text-slate-700">Prof. {ta.teacher.firstName} {ta.teacher.lastName}</p>
                <p className="text-[10px] text-slate-400">Docente</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── MAIN CONTENT AREA ── */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        {error && (
          <div className="flex items-center gap-2 p-3 mx-6 mt-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <AlertCircle className="w-4 h-4" />{error}
            <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
        ) : (
          <>
            {activeTab === 'home' && <HomeTab classroom={activeClassroom} isTeacher={!!isTeacher} onReload={reloadClassroom} setError={setError} />}
            {activeTab === 'content' && <ContentTab classroom={activeClassroom} isTeacher={!!isTeacher} onReload={reloadClassroom} setError={setError} />}
            {activeTab === 'activities' && <ActivitiesTab isTeacher={!!isTeacher} />}
            {activeTab === 'students' && <StudentsTab classroomId={activeClassroom.id} />}
          </>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: INICIO (Anuncios)
// ═══════════════════════════════════════════════════════════════════════════

function HomeTab({ classroom, isTeacher, onReload, setError }: {
  classroom: any; isTeacher: boolean; onReload: () => void; setError: (e: string) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', content: '' })
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const announcements: Announcement[] = classroom.announcements || []
  const sections: Section[] = classroom.sections || []
  const totalMaterials = sections.reduce((acc: number, s: Section) => acc + s.materials.length, 0)

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.content.trim()) return
    try {
      setUploading(true)
      let attachmentUrl: string | undefined
      let attachmentName: string | undefined

      if (attachmentFile) {
        const { data } = await classroomApi.uploadMaterial(attachmentFile)
        attachmentUrl = data.data.path || data.data.url
        attachmentName = attachmentFile.name
      }

      await classroomApi.createAnnouncement(classroom.id, { ...form, attachmentUrl, attachmentName })
      setForm({ title: '', content: '' })
      setAttachmentFile(null)
      setShowForm(false)
      onReload()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al crear anuncio')
    } finally {
      setUploading(false)
    }
  }

  const handleTogglePin = async (id: string, pinned: boolean) => {
    try { await classroomApi.updateAnnouncement(id, { isPinned: !pinned }); onReload() } catch {}
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este anuncio?')) return
    try { await classroomApi.deleteAnnouncement(id); onReload() } catch {}
  }

  const openAttachment = async (url: string) => {
    try {
      const { data } = await storageApi.resolveUrl(url)
      window.open(data.url, '_blank')
    } catch { window.open(url, '_blank') }
  }

  return (
    <div className="p-6 space-y-5">
      {/* Overview cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 text-center">
          <Layers className="w-6 h-6 mx-auto text-blue-500 mb-1.5" />
          <p className="text-2xl font-bold text-slate-800">{sections.length}</p>
          <p className="text-xs text-slate-500">Secciones</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 text-center">
          <BookOpen className="w-6 h-6 mx-auto text-green-500 mb-1.5" />
          <p className="text-2xl font-bold text-slate-800">{totalMaterials}</p>
          <p className="text-xs text-slate-500">Recursos</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 text-center">
          <Megaphone className="w-6 h-6 mx-auto text-amber-500 mb-1.5" />
          <p className="text-2xl font-bold text-slate-800">{announcements.length}</p>
          <p className="text-xs text-slate-500">Anuncios</p>
        </div>
      </div>

      {/* Announcements header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-800">Anuncios</h3>
        {isTeacher && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            <Plus className="w-4 h-4" /> Nuevo Anuncio
          </button>
        )}
      </div>

      {/* New announcement form */}
      {showForm && (
        <div className="bg-white border border-blue-200 rounded-xl p-5 space-y-3">
          <input
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="Título del anuncio"
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            autoFocus
          />
          <textarea
            value={form.content}
            onChange={e => setForm({ ...form, content: e.target.value })}
            placeholder="Escribe tu anuncio aquí..."
            rows={4}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          {/* Attachment */}
          <input ref={fileRef} type="file" className="hidden" onChange={e => setAttachmentFile(e.target.files?.[0] || null)} />
          {attachmentFile ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
              <Paperclip className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-700 flex-1 truncate">{attachmentFile.name}</span>
              <button onClick={() => setAttachmentFile(null)} className="p-0.5 rounded hover:bg-slate-200"><X className="w-3.5 h-3.5 text-slate-400" /></button>
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-slate-200 hover:border-blue-300 transition-colors">
              <Paperclip className="w-3.5 h-3.5" /> Adjuntar archivo
            </button>
            <div className="flex gap-2">
              <button onClick={() => { setShowForm(false); setAttachmentFile(null) }} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
              <button onClick={handleSubmit} disabled={!form.title.trim() || !form.content.trim() || uploading} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                {uploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {uploading ? 'Publicando...' : 'Publicar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Announcements list */}
      {announcements.length === 0 && !showForm ? (
        <div className="text-center py-16 text-slate-400 bg-white rounded-xl border border-slate-200">
          <Megaphone className="w-14 h-14 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No hay anuncios aún</p>
          {isTeacher && <p className="text-xs mt-1 text-slate-400">Publica un anuncio para comunicarte con tus estudiantes</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => (
            <div key={a.id} className={`bg-white rounded-xl border p-5 ${a.isPinned ? 'border-yellow-300 ring-1 ring-yellow-100' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {a.isPinned && <Pin className="w-3.5 h-3.5 text-yellow-500 shrink-0" />}
                    <h4 className="font-semibold text-slate-800 text-base">{a.title}</h4>
                  </div>
                  <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap leading-relaxed">{a.content}</p>
                  {a.attachmentUrl && (
                    <button onClick={() => openAttachment(a.attachmentUrl!)} className="flex items-center gap-2 mt-3 px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors group">
                      <File className="w-4 h-4 text-blue-500" />
                      <span className="text-sm text-slate-700 group-hover:text-blue-600 truncate">{a.attachmentName || 'Archivo adjunto'}</span>
                      <Download className="w-3.5 h-3.5 text-slate-400 ml-auto shrink-0" />
                    </button>
                  )}
                  <p className="text-xs text-slate-400 mt-3">
                    {a.author.firstName} {a.author.lastName} · {new Date(a.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {isTeacher && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => handleTogglePin(a.id, a.isPinned)} className="p-1.5 rounded-lg hover:bg-slate-100" title={a.isPinned ? 'Desfijar' : 'Fijar'}>
                      {a.isPinned ? <PinOff className="w-4 h-4 text-slate-400" /> : <Pin className="w-4 h-4 text-slate-400" />}
                    </button>
                    <button onClick={() => handleDelete(a.id)} className="p-1.5 rounded-lg hover:bg-red-50">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: CONTENIDO (Secciones + Materiales con formularios mejorados)
// ═══════════════════════════════════════════════════════════════════════════

function ContentTab({ classroom, isTeacher, onReload, setError }: {
  classroom: any; isTeacher: boolean; onReload: () => void; setError: (e: string) => void
}) {
  const sections: Section[] = classroom.sections || []

  const [showAddSection, setShowAddSection] = useState(false)
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [editingSectionTitle, setEditingSectionTitle] = useState('')

  // Material modal
  const [materialModal, setMaterialModal] = useState<{ sectionId: string; type: string } | null>(null)
  const [materialTitle, setMaterialTitle] = useState('')
  const [materialContent, setMaterialContent] = useState('')
  const [materialFile, setMaterialFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAddSection = async () => {
    if (!newSectionTitle.trim()) return
    try {
      await classroomApi.createSection(classroom.id, { title: newSectionTitle.trim() })
      setNewSectionTitle('')
      setShowAddSection(false)
      onReload()
    } catch (err: any) { setError(err.response?.data?.message || 'Error al crear sección') }
  }

  const handleUpdateSectionTitle = async (sectionId: string) => {
    if (!editingSectionTitle.trim()) return
    try {
      await classroomApi.updateSection(sectionId, { title: editingSectionTitle.trim() })
      setEditingSection(null)
      onReload()
    } catch {}
  }

  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm('¿Eliminar esta sección y todos sus materiales?')) return
    try { await classroomApi.deleteSection(sectionId); onReload() } catch (err: any) { setError(err.response?.data?.message || 'Error') }
  }

  const handleToggleVis = async (sectionId: string, vis: boolean) => {
    try { await classroomApi.updateSection(sectionId, { isVisible: !vis }); onReload() } catch {}
  }

  const handleDeleteMaterial = async (id: string) => {
    try { await classroomApi.deleteMaterial(id); onReload() } catch {}
  }

  const handleToggleMaterialVis = async (id: string, vis: boolean) => {
    try { await classroomApi.updateMaterial(id, { isVisible: !vis }); onReload() } catch {}
  }

  const openMaterialModal = (sectionId: string, type: string) => {
    setMaterialModal({ sectionId, type })
    setMaterialTitle('')
    setMaterialContent('')
    setMaterialFile(null)
  }

  const handleSaveMaterial = async () => {
    if (!materialModal || !materialTitle.trim()) return
    const { sectionId, type } = materialModal
    try {
      setUploading(true)
      let fileUrl: string | undefined
      let content = materialContent || undefined

      // Upload file for DOCUMENT and IMAGE types
      if ((type === 'DOCUMENT' || type === 'IMAGE') && materialFile) {
        const { data } = await classroomApi.uploadMaterial(materialFile)
        fileUrl = data.data.path || data.data.url
      }

      await classroomApi.createMaterial(sectionId, {
        type,
        title: materialTitle.trim(),
        content,
        fileUrl,
      })

      setMaterialModal(null)
      onReload()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al agregar recurso')
    } finally {
      setUploading(false)
    }
  }

  // Simple toolbar for text formatting
  const insertFormatting = (tag: string) => {
    const textarea = document.getElementById('material-text-editor') as HTMLTextAreaElement
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = materialContent.substring(start, end)
    let replacement = ''
    switch (tag) {
      case 'bold': replacement = `**${selected || 'texto'}**`; break
      case 'italic': replacement = `*${selected || 'texto'}*`; break
      case 'underline': replacement = `__${selected || 'texto'}__`; break
      case 'ul': replacement = `\n- ${selected || 'elemento'}`; break
      case 'ol': replacement = `\n1. ${selected || 'elemento'}`; break
      default: replacement = selected
    }
    const newContent = materialContent.substring(0, start) + replacement + materialContent.substring(end)
    setMaterialContent(newContent)
  }

  const resolveFileUrl = async (path: string) => {
    try {
      const { data } = await storageApi.resolveUrl(path)
      return data.url
    } catch { return path }
  }

  const handleDownload = async (material: Material) => {
    if (!material.fileUrl) return
    const url = await resolveFileUrl(material.fileUrl)
    window.open(url, '_blank')
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-800">Contenido del aula</h3>
        {isTeacher && (
          <button onClick={() => setShowAddSection(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            <Plus className="w-4 h-4" /> Nueva Sección
          </button>
        )}
      </div>

      {/* New section form */}
      {showAddSection && (
        <div className="bg-white border border-blue-200 rounded-xl p-4 flex gap-2">
          <input
            value={newSectionTitle}
            onChange={e => setNewSectionTitle(e.target.value)}
            placeholder="Nombre de la sección (ej: Semana 1, Unidad: Fracciones)"
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleAddSection()}
          />
          <button onClick={() => setShowAddSection(false)} className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
          <button onClick={handleAddSection} disabled={!newSectionTitle.trim()} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Crear</button>
        </div>
      )}

      {/* Sections */}
      {sections.length === 0 && !showAddSection ? (
        <div className="text-center py-16 text-slate-400 bg-white rounded-xl border border-slate-200">
          <FolderOpen className="w-14 h-14 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No hay secciones de contenido aún</p>
          {isTeacher && <p className="text-xs mt-1">Crea secciones para organizar tu material por temas o semanas</p>}
        </div>
      ) : (
        sections.filter(s => isTeacher || s.isVisible).map(section => (
          <div key={section.id} className={`bg-white rounded-xl border ${section.isVisible ? 'border-slate-200' : 'border-dashed border-slate-300 opacity-70'}`}>
            {/* Section header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <FolderOpen className="w-5 h-5 text-blue-500 shrink-0" />
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
                  <h4 className="font-semibold text-slate-800 text-sm">{section.title}</h4>
                )}
                {!section.isVisible && <span className="text-xs bg-slate-200 text-slate-500 px-2 py-0.5 rounded shrink-0">Oculta</span>}
              </div>
              {isTeacher && (
                <div className="flex items-center gap-0.5 ml-2 shrink-0">
                  <button onClick={() => { setEditingSection(section.id); setEditingSectionTitle(section.title) }} className="p-1.5 rounded-lg hover:bg-slate-100" title="Renombrar">
                    <Pencil className="w-4 h-4 text-slate-400" />
                  </button>
                  <button onClick={() => handleToggleVis(section.id, section.isVisible)} className="p-1.5 rounded-lg hover:bg-slate-100" title={section.isVisible ? 'Ocultar' : 'Mostrar'}>
                    {section.isVisible ? <EyeOff className="w-4 h-4 text-slate-400" /> : <Eye className="w-4 h-4 text-slate-400" />}
                  </button>
                  <button onClick={() => handleDeleteSection(section.id)} className="p-1.5 rounded-lg hover:bg-red-50" title="Eliminar">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              )}
            </div>

            {/* Materials list - bigger cards */}
            <div className="p-4 space-y-3">
              {section.materials.filter(m => isTeacher || m.isVisible).map(material => (
                <MaterialCard key={material.id} material={material} isTeacher={isTeacher} onToggleVis={handleToggleMaterialVis} onDelete={handleDeleteMaterial} onDownload={handleDownload} resolveFileUrl={resolveFileUrl} />
              ))}

              {section.materials.filter(m => isTeacher || m.isVisible).length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">Esta sección aún no tiene recursos</p>
              )}

              {/* Add resource buttons (teacher only) */}
              {isTeacher && (
                <div className="pt-3 border-t border-slate-100 mt-3">
                  <p className="text-xs text-slate-400 mb-2.5 font-medium">Agregar recurso:</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { type: 'TEXT', label: 'Texto', icon: Type, color: 'bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100' },
                      { type: 'VIDEO_YOUTUBE', label: 'Video YouTube', icon: Youtube, color: 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' },
                      { type: 'DOCUMENT', label: 'Documento', icon: FileUp, color: 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' },
                      { type: 'IMAGE', label: 'Imagen', icon: Image, color: 'bg-pink-50 text-pink-600 border-pink-200 hover:bg-pink-100' },
                      { type: 'LINK', label: 'Enlace', icon: Link2, color: 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100' },
                    ].map(btn => (
                      <button
                        key={btn.type}
                        onClick={() => openMaterialModal(section.id, btn.type)}
                        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border rounded-lg transition-colors ${btn.color}`}
                      >
                        <btn.icon className="w-4 h-4" />
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))
      )}

      {/* ── MATERIAL CREATION MODAL ── */}
      {materialModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getMaterialIcon(materialModal.type, 'w-5 h-5')}
                <h3 className="font-bold text-slate-800">
                  {materialModal.type === 'TEXT' && 'Agregar texto'}
                  {materialModal.type === 'VIDEO_YOUTUBE' && 'Agregar video de YouTube'}
                  {materialModal.type === 'DOCUMENT' && 'Subir documento'}
                  {materialModal.type === 'IMAGE' && 'Subir imagen'}
                  {materialModal.type === 'LINK' && 'Agregar enlace'}
                </h3>
              </div>
              <button onClick={() => setMaterialModal(null)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-5 space-y-4">
              {/* Title (all types) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Título del recurso</label>
                <input
                  value={materialTitle}
                  onChange={e => setMaterialTitle(e.target.value)}
                  placeholder="Ej: Guía de ejercicios, Video explicativo..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  autoFocus
                />
              </div>

              {/* TEXT type - with formatting toolbar */}
              {materialModal.type === 'TEXT' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contenido</label>
                  <div className="border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                    <div className="flex items-center gap-0.5 px-2 py-1.5 bg-slate-50 border-b border-slate-200">
                      <button onClick={() => insertFormatting('bold')} className="p-1.5 rounded hover:bg-slate-200" title="Negrita"><Bold className="w-3.5 h-3.5" /></button>
                      <button onClick={() => insertFormatting('italic')} className="p-1.5 rounded hover:bg-slate-200" title="Cursiva"><Italic className="w-3.5 h-3.5" /></button>
                      <button onClick={() => insertFormatting('underline')} className="p-1.5 rounded hover:bg-slate-200" title="Subrayado"><Underline className="w-3.5 h-3.5" /></button>
                      <div className="w-px h-4 bg-slate-300 mx-1" />
                      <button onClick={() => insertFormatting('ul')} className="p-1.5 rounded hover:bg-slate-200" title="Lista"><List className="w-3.5 h-3.5" /></button>
                      <button onClick={() => insertFormatting('ol')} className="p-1.5 rounded hover:bg-slate-200" title="Lista numerada"><ListOrdered className="w-3.5 h-3.5" /></button>
                    </div>
                    <textarea
                      id="material-text-editor"
                      value={materialContent}
                      onChange={e => setMaterialContent(e.target.value)}
                      placeholder="Escribe el contenido aquí... Puedes usar **negrita**, *cursiva*, y listas."
                      rows={6}
                      className="w-full px-3 py-2 text-sm resize-none outline-none"
                    />
                  </div>
                </div>
              )}

              {/* VIDEO_YOUTUBE type */}
              {materialModal.type === 'VIDEO_YOUTUBE' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">URL del video</label>
                  <div className="relative">
                    <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                    <input
                      value={materialContent}
                      onChange={e => setMaterialContent(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full border border-slate-300 rounded-lg pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  {materialContent && extractYoutubeId(materialContent) && (
                    <div className="mt-3 aspect-video max-w-sm rounded-lg overflow-hidden border border-slate-200">
                      <iframe src={`https://www.youtube-nocookie.com/embed/${extractYoutubeId(materialContent)}`} className="w-full h-full" allowFullScreen />
                    </div>
                  )}
                  {materialContent && !extractYoutubeId(materialContent) && (
                    <p className="text-xs text-amber-600 mt-1">URL no válida. Ejemplo: https://www.youtube.com/watch?v=dQw4w9WgXcQ</p>
                  )}
                </div>
              )}

              {/* DOCUMENT type */}
              {materialModal.type === 'DOCUMENT' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Archivo (máx. 10MB)</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                    onChange={e => setMaterialFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex flex-col items-center gap-2 px-4 py-6 border-2 border-dashed border-slate-300 rounded-xl hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
                  >
                    <FileUp className="w-8 h-8 text-slate-400" />
                    {materialFile ? (
                      <span className="text-sm text-blue-600 font-medium">{materialFile.name}</span>
                    ) : (
                      <>
                        <span className="text-sm text-slate-500">Haz clic para seleccionar un archivo</span>
                        <span className="text-xs text-slate-400">PDF, Word, Excel, PowerPoint, TXT, CSV</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* IMAGE type */}
              {materialModal.type === 'IMAGE' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Imagen (máx. 10MB)</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={e => setMaterialFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex flex-col items-center gap-2 px-4 py-6 border-2 border-dashed border-slate-300 rounded-xl hover:border-pink-400 hover:bg-pink-50/30 transition-colors"
                  >
                    <Image className="w-8 h-8 text-slate-400" />
                    {materialFile ? (
                      <span className="text-sm text-pink-600 font-medium">{materialFile.name}</span>
                    ) : (
                      <>
                        <span className="text-sm text-slate-500">Haz clic para seleccionar una imagen</span>
                        <span className="text-xs text-slate-400">JPG, PNG, GIF, WebP</span>
                      </>
                    )}
                  </button>
                  {materialFile && (
                    <div className="mt-2">
                      <img src={URL.createObjectURL(materialFile)} alt="Preview" className="max-h-40 rounded-lg border border-slate-200" />
                    </div>
                  )}
                </div>
              )}

              {/* LINK type */}
              {materialModal.type === 'LINK' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">URL del enlace</label>
                  <div className="relative">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                    <input
                      value={materialContent}
                      onChange={e => setMaterialContent(e.target.value)}
                      placeholder="https://ejemplo.com/recurso"
                      className="w-full border border-slate-300 rounded-lg pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={() => setMaterialModal(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
              <button
                onClick={handleSaveMaterial}
                disabled={!materialTitle.trim() || uploading || ((materialModal.type === 'DOCUMENT' || materialModal.type === 'IMAGE') && !materialFile)}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
                {uploading ? 'Subiendo...' : 'Agregar recurso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MATERIAL CARD (bigger, with inline previews)
// ═══════════════════════════════════════════════════════════════════════════

function MaterialCard({ material, isTeacher, onToggleVis, onDelete, onDownload, resolveFileUrl }: {
  material: Material; isTeacher: boolean;
  onToggleVis: (id: string, vis: boolean) => void;
  onDelete: (id: string) => void;
  onDownload: (m: Material) => void;
  resolveFileUrl: (path: string) => Promise<string>;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    if (material.type === 'IMAGE' && material.fileUrl) {
      resolveFileUrl(material.fileUrl).then(url => setImageUrl(url)).catch(() => {})
    }
  }, [material.fileUrl, material.type])

  const typeColors: Record<string, string> = {
    TEXT: 'border-l-purple-400',
    VIDEO_YOUTUBE: 'border-l-red-400',
    DOCUMENT: 'border-l-blue-400',
    IMAGE: 'border-l-pink-400',
    LINK: 'border-l-green-400',
  }

  return (
    <div className={`rounded-xl border border-slate-200 border-l-4 ${typeColors[material.type] || 'border-l-slate-300'} ${material.isVisible ? 'bg-white' : 'bg-slate-50/50 opacity-60'} group transition-all hover:shadow-sm`}>
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              {getMaterialIcon(material.type, 'w-5 h-5')}
            </div>
            <div className="flex-1 min-w-0">
              <h5 className="text-sm font-semibold text-slate-800">{material.title}</h5>
              <span className="text-[11px] text-slate-400">{getMaterialLabel(material.type)}</span>
            </div>
          </div>
          {isTeacher && (
            <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 shrink-0 transition-opacity">
              <button onClick={() => onToggleVis(material.id, material.isVisible)} className="p-1.5 rounded-lg hover:bg-slate-100">
                {material.isVisible ? <EyeOff className="w-4 h-4 text-slate-400" /> : <Eye className="w-4 h-4 text-slate-400" />}
              </button>
              <button onClick={() => onDelete(material.id)} className="p-1.5 rounded-lg hover:bg-red-50">
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
            </div>
          )}
        </div>

        {/* Content area */}
        {material.type === 'TEXT' && material.content && (
          <div className="mt-3 px-1">
            <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{material.content}</p>
          </div>
        )}

        {material.type === 'VIDEO_YOUTUBE' && material.content && (() => {
          const vid = extractYoutubeId(material.content)
          return vid ? (
            <div className="mt-3 aspect-video rounded-lg overflow-hidden border border-slate-200">
              <iframe src={`https://www.youtube-nocookie.com/embed/${vid}`} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          ) : null
        })()}

        {material.type === 'LINK' && material.content && (
          <a href={material.content} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 mt-3 px-3 py-2.5 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors group/link">
            <ExternalLink className="w-4 h-4 text-green-500" />
            <span className="text-sm text-green-700 group-hover/link:underline truncate">{material.content}</span>
          </a>
        )}

        {material.type === 'IMAGE' && material.fileUrl && (
          <div className="mt-3">
            {imageUrl ? (
              <img src={imageUrl} alt={material.title} className="max-h-72 rounded-lg border border-slate-200 object-contain" />
            ) : (
              <div className="h-32 bg-slate-100 rounded-lg flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            )}
            <button onClick={() => onDownload(material)} className="flex items-center gap-2 mt-2 px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
              <Download className="w-3.5 h-3.5" /> Descargar imagen
            </button>
          </div>
        )}

        {material.type === 'DOCUMENT' && material.fileUrl && (
          <button onClick={() => onDownload(material)} className="flex items-center gap-3 mt-3 w-full px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors text-left group/doc">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-blue-800 group-hover/doc:underline">{material.title}</p>
              <p className="text-xs text-blue-500">Haz clic para abrir el documento</p>
            </div>
            <Download className="w-4 h-4 text-blue-400 shrink-0" />
          </button>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: ACTIVIDADES (placeholder para Fase 2+)
// ═══════════════════════════════════════════════════════════════════════════

function ActivitiesTab({ isTeacher }: { isTeacher: boolean }) {
  const activityTypes = [
    { icon: ClipboardList, label: 'Tareas', desc: 'Asigna trabajos con fecha de entrega y calificación', color: 'text-blue-500 bg-blue-50' },
    { icon: BookOpen, label: 'Quizzes', desc: 'Evaluaciones rápidas con calificación automática', color: 'text-green-500 bg-green-50' },
    { icon: FileText, label: 'Exámenes', desc: 'Evaluaciones formales con tiempo límite', color: 'text-purple-500 bg-purple-50' },
    { icon: GraduationCap, label: 'Simulacro ICFES', desc: 'Simulacros Saber 11 con análisis detallado', color: 'text-amber-500 bg-amber-50' },
  ]

  return (
    <div className="p-6">
      <div className="text-center py-12">
        <ClipboardList className="w-16 h-16 mx-auto text-slate-300 mb-4" />
        <h3 className="text-lg font-semibold text-slate-700">Actividades</h3>
        <p className="text-sm text-slate-500 mt-1 mb-8">
          {isTeacher ? 'Próximamente podrás crear y gestionar actividades evaluativas' : 'Próximamente encontrarás aquí tus tareas, quizzes y exámenes'}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-3xl mx-auto">
          {activityTypes.map(at => (
            <div key={at.label} className="bg-white rounded-xl border border-slate-200 p-5 text-left opacity-70">
              <div className={`w-11 h-11 rounded-lg ${at.color} flex items-center justify-center mb-3`}>
                <at.icon className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-semibold text-slate-700">{at.label}</h4>
              <p className="text-xs text-slate-500 mt-1">{at.desc}</p>
              <span className="inline-block mt-3 text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">Próximamente</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: ESTUDIANTES
// ═══════════════════════════════════════════════════════════════════════════

function StudentsTab({ classroomId }: { classroomId: string }) {
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const { data } = await classroomApi.getStudents(classroomId)
        setStudents(data)
      } catch {} finally { setLoading(false) }
    }
    load()
  }, [classroomId])

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>

  // Student model has firstName/lastName directly on it, with optional user relation
  const getStudentName = (s: any) => {
    const student = s.student || {}
    const firstName = student.firstName || student.user?.firstName || ''
    const lastName = student.lastName || student.user?.lastName || ''
    const secondName = student.secondName || ''
    const secondLastName = student.secondLastName || ''
    const email = student.email || student.user?.email || ''
    return { firstName, lastName, secondName, secondLastName, email }
  }

  const filtered = students.filter((s: any) => {
    if (!search.trim()) return true
    const { firstName, lastName } = getStudentName(s)
    const name = `${firstName} ${lastName}`.toLowerCase()
    return name.includes(search.toLowerCase())
  })

  return (
    <div className="p-6">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-blue-500" />
            <h3 className="text-sm font-bold text-slate-800">Estudiantes del grupo</h3>
            <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full font-semibold">{students.length}</span>
          </div>
          {students.length > 5 && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar estudiante..."
                className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-52"
              />
            </div>
          )}
        </div>

        {/* Student list */}
        <div className="divide-y divide-slate-100">
          {filtered.length === 0 && students.length > 0 && (
            <div className="text-center py-8 text-slate-400 text-sm">No se encontraron estudiantes</div>
          )}
          {filtered.length === 0 && students.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-sm">No hay estudiantes matriculados en este grupo</div>
          )}
          {filtered.map((s: any, i: number) => {
            const { firstName, lastName, secondLastName, email } = getStudentName(s)
            const displayName = lastName && firstName
              ? `${lastName}${secondLastName ? ' ' + secondLastName : ''}, ${firstName}`
              : lastName || firstName || 'Sin nombre'
            const initials = `${firstName[0] || ''}${lastName[0] || ''}`

            return (
              <div key={s.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                <span className="text-xs text-slate-400 w-7 text-right font-mono">{i + 1}</span>
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
                  {initials || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{displayName}</p>
                  {email && <p className="text-xs text-slate-400 truncate">{email}</p>}
                </div>
                <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full shrink-0">Activo</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
