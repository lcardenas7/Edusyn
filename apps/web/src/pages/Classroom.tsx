import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { classroomApi, storageApi } from '../lib/api'
import {
  Plus, Loader2, AlertCircle, ChevronLeft, Users, Megaphone,
  FolderOpen, FileText, Video, Link2, ImageIcon, Type, Eye, EyeOff,
  Trash2, Pencil, Pin, PinOff, X, Upload, ExternalLink,
  GraduationCap, Layers, ClipboardList, BookOpen, Download,
  Bold, Italic, Underline, List, ListOrdered, Youtube,
  FileUp, Image, Search, Paperclip, File, Home, MessageSquare,
  BarChart3, ChevronDown, ChevronRight, Clock, CheckCircle2, AlertTriangle,
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

type TabKey = 'home' | 'announcements' | 'content' | 'activities' | 'forum' | 'students' | 'grades'

const TEACHER_TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'home', label: 'Inicio', icon: Home },
  { key: 'announcements', label: 'Anuncios', icon: Megaphone },
  { key: 'content', label: 'Contenidos', icon: FolderOpen },
  { key: 'activities', label: 'Actividades', icon: ClipboardList },
  { key: 'forum', label: 'Foro', icon: MessageSquare },
  { key: 'students', label: 'Estudiantes', icon: Users },
]

const STUDENT_TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'home', label: 'Inicio', icon: Home },
  { key: 'announcements', label: 'Anuncios', icon: Megaphone },
  { key: 'content', label: 'Contenidos', icon: FolderOpen },
  { key: 'activities', label: 'Actividades', icon: ClipboardList },
  { key: 'forum', label: 'Foro', icon: MessageSquare },
  { key: 'grades', label: 'Mis Notas', icon: BarChart3 },
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
  // RENDER: CLASSROOM DETAIL (horizontal nav + full-width content)
  // ═══════════════════════════════════════════════════════════════════════

  const ta = activeClassroom.teacherAssignment
  const tabs = isTeacher ? TEACHER_TABS : STUDENT_TABS

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50">
      {/* ── COLOR HEADER BAR ── */}
      <div className="relative" style={{ backgroundColor: activeClassroom.color || '#3B82F6' }}>
        <div className="max-w-6xl mx-auto px-6 py-5">
          <button onClick={() => setActiveClassroom(null)} className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm mb-2 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Todas las aulas
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">{activeClassroom.title}</h1>
              <p className="text-base text-white/80 mt-1">
                {ta.group.grade.name} {ta.group.name} · {ta.subject.name}
                {ta.teacher && ` · Prof. ${ta.teacher.firstName} ${ta.teacher.lastName}`}
              </p>
            </div>
            {activeClassroom.studentCount !== undefined && (
              <div className="hidden sm:flex items-center gap-2 bg-white/20 rounded-xl px-4 py-2">
                <Users className="w-5 h-5 text-white" />
                <span className="text-white font-semibold text-lg">{activeClassroom.studentCount || (activeClassroom as any)._count?.sections || '—'}</span>
                <span className="text-white/70 text-sm">estudiantes</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── HORIZONTAL TAB NAVIGATION ── */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-6">
          <nav className="flex gap-1 overflow-x-auto scrollbar-hide -mb-px">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <tab.icon className={`w-5 h-5 ${activeTab === tab.key ? 'text-blue-600' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* ── MAIN CONTENT AREA ── */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        {error && (
          <div className="flex items-center gap-2 p-4 mb-5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-base">
            <AlertCircle className="w-5 h-5 shrink-0" />{error}
            <button onClick={() => setError('')} className="ml-auto p-1"><X className="w-4 h-4" /></button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
        ) : (
          <>
            {activeTab === 'home' && <HomeTab classroom={activeClassroom} isTeacher={!!isTeacher} isStudent={!!isStudent} user={user} onReload={reloadClassroom} setError={setError} />}
            {activeTab === 'announcements' && <AnnouncementsTab classroom={activeClassroom} isTeacher={!!isTeacher} onReload={reloadClassroom} setError={setError} />}
            {activeTab === 'content' && <ContentTab classroom={activeClassroom} isTeacher={!!isTeacher} onReload={reloadClassroom} setError={setError} />}
            {activeTab === 'activities' && <ActivitiesTab classroom={activeClassroom} isTeacher={!!isTeacher} isStudent={!!isStudent} onReload={reloadClassroom} setError={setError} />}
            {activeTab === 'forum' && <ForumTab classroom={activeClassroom} isTeacher={!!isTeacher} isStudent={!!isStudent} user={user} setError={setError} />}
            {activeTab === 'students' && <StudentsTab classroomId={activeClassroom.id} />}
            {activeTab === 'grades' && <GradesTab />}
          </>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: INICIO (Dashboard diferenciado docente/estudiante)
// ═══════════════════════════════════════════════════════════════════════════

function HomeTab({ classroom, isTeacher, isStudent, user, onReload, setError }: {
  classroom: any; isTeacher: boolean; isStudent: boolean; user: any; onReload: () => void; setError: (e: string) => void
}) {
  const announcements: Announcement[] = classroom.announcements || []
  const sections: Section[] = classroom.sections || []
  const totalMaterials = sections.reduce((acc: number, s: Section) => acc + s.materials.length, 0)
  const pinnedAnnouncements = announcements.filter(a => a.isPinned).slice(0, 3)
  const recentAnnouncements = announcements.filter(a => !a.isPinned).slice(0, 2)

  // Student dashboard
  if (isStudent) {
    const firstName = user?.firstName || 'Estudiante'
    return (
      <div className="space-y-6">
        {/* Welcome */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-2xl font-bold text-slate-800">Bienvenido, {firstName}</h2>
          <p className="text-base text-slate-500 mt-1">Curso: {classroom.title}</p>
        </div>

        {/* Dashboard cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Actividades pendientes */}
          <div className="bg-white rounded-2xl border-2 border-orange-200 overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-orange-400 px-5 py-3 flex items-center gap-2.5">
              <ClipboardList className="w-6 h-6 text-white" />
              <h3 className="text-lg font-bold text-white">Actividades Pendientes</h3>
            </div>
            <div className="p-5">
              <p className="text-base text-slate-600">Las actividades aparecerán aquí próximamente</p>
              <button className="mt-4 px-5 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 transition-colors">
                Ver pendientes
              </button>
            </div>
          </div>

          {/* Anuncios recientes */}
          <div className="bg-white rounded-2xl border-2 border-blue-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-blue-400 px-5 py-3 flex items-center gap-2.5">
              <Megaphone className="w-6 h-6 text-white" />
              <h3 className="text-lg font-bold text-white">Anuncios Recientes</h3>
            </div>
            <div className="p-5">
              {[...pinnedAnnouncements, ...recentAnnouncements].slice(0, 3).length === 0 ? (
                <p className="text-base text-slate-500">Sin anuncios recientes</p>
              ) : (
                <div className="space-y-2.5">
                  {[...pinnedAnnouncements, ...recentAnnouncements].slice(0, 3).map(a => (
                    <div key={a.id} className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                      <p className="text-base text-slate-700">{a.title}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Mis Calificaciones */}
          <div className="bg-white rounded-2xl border-2 border-green-200 overflow-hidden">
            <div className="bg-gradient-to-r from-green-500 to-green-400 px-5 py-3 flex items-center gap-2.5">
              <BarChart3 className="w-6 h-6 text-white" />
              <h3 className="text-lg font-bold text-white">Mis Calificaciones</h3>
            </div>
            <div className="p-5">
              <p className="text-base text-slate-600">Tus calificaciones aparecerán aquí</p>
              <button className="mt-4 px-5 py-2.5 bg-green-500 text-white rounded-xl text-sm font-semibold hover:bg-green-600 transition-colors">
                Ver calificaciones
              </button>
            </div>
          </div>

          {/* Contenidos del Curso */}
          <div className="bg-white rounded-2xl border-2 border-purple-200 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-purple-400 px-5 py-3 flex items-center gap-2.5">
              <BookOpen className="w-6 h-6 text-white" />
              <h3 className="text-lg font-bold text-white">Contenidos del Curso</h3>
            </div>
            <div className="p-5">
              {sections.length === 0 ? (
                <p className="text-base text-slate-500">Aún no hay contenidos publicados</p>
              ) : (
                <div className="space-y-2">
                  {sections.filter(s => s.isVisible).slice(0, 3).map(s => (
                    <div key={s.id} className="flex items-center gap-2">
                      <FolderOpen className="w-5 h-5 text-purple-500 shrink-0" />
                      <p className="text-base text-slate-700">{s.title}</p>
                    </div>
                  ))}
                </div>
              )}
              <button className="mt-4 px-5 py-2.5 bg-purple-500 text-white rounded-xl text-sm font-semibold hover:bg-purple-600 transition-colors">
                Ver materiales
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Teacher dashboard
  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Layers className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-2xl font-bold text-slate-800">{sections.length}</span>
          </div>
          <p className="text-sm text-slate-500">Secciones</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-2xl font-bold text-slate-800">{totalMaterials}</span>
          </div>
          <p className="text-sm text-slate-500">Recursos</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-2xl font-bold text-slate-800">{announcements.length}</span>
          </div>
          <p className="text-sm text-slate-500">Anuncios</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-2xl font-bold text-slate-800">{classroom._count?.activities || 0}</span>
          </div>
          <p className="text-sm text-slate-500">Actividades</p>
        </div>
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent announcements */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-amber-500" /> Anuncios recientes
            </h3>
          </div>
          <div className="p-5">
            {announcements.length === 0 ? (
              <p className="text-base text-slate-400 text-center py-6">No hay anuncios aún</p>
            ) : (
              <div className="space-y-3">
                {announcements.slice(0, 4).map(a => (
                  <div key={a.id} className="flex items-start gap-3 pb-3 border-b border-slate-50 last:border-0 last:pb-0">
                    {a.isPinned && <Pin className="w-4 h-4 text-yellow-500 mt-1 shrink-0" />}
                    {!a.isPinned && <Megaphone className="w-4 h-4 text-slate-300 mt-1 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700">{a.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{new Date(a.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Activity feed placeholder */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" /> Actividad reciente
            </h3>
          </div>
          <div className="p-5">
            <div className="text-center py-6 text-slate-400">
              <Clock className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-base">Las entregas y actividad de los estudiantes aparecerán aquí</p>
              <p className="text-sm mt-1">Próximamente en Fase 2</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: ANUNCIOS (separada del Inicio)
// ═══════════════════════════════════════════════════════════════════════════

function AnnouncementsTab({ classroom, isTeacher, onReload, setError }: {
  classroom: any; isTeacher: boolean; onReload: () => void; setError: (e: string) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', content: '' })
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const announcements: Announcement[] = classroom.announcements || []

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
    } finally { setUploading(false) }
  }

  const handleTogglePin = async (id: string, pinned: boolean) => {
    try { await classroomApi.updateAnnouncement(id, { isPinned: !pinned }); onReload() } catch {}
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este anuncio?')) return
    try { await classroomApi.deleteAnnouncement(id); onReload() } catch {}
  }

  const openAttachment = async (url: string) => {
    try { const { data } = await storageApi.resolveUrl(url); window.open(data.url, '_blank') } catch { window.open(url, '_blank') }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Anuncios</h2>
        {isTeacher && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors" style={{ minHeight: '44px' }}>
            <Plus className="w-5 h-5" /> Nuevo Anuncio
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white border-2 border-blue-200 rounded-2xl p-6 space-y-4">
          <input
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="Título del anuncio"
            className="w-full border border-slate-300 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            autoFocus
          />
          <textarea
            value={form.content}
            onChange={e => setForm({ ...form, content: e.target.value })}
            placeholder="Escribe tu anuncio aquí..."
            rows={4}
            className="w-full border border-slate-300 rounded-xl px-4 py-3 text-base resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <input ref={fileRef} type="file" className="hidden" onChange={e => setAttachmentFile(e.target.files?.[0] || null)} />
          {attachmentFile && (
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
              <Paperclip className="w-5 h-5 text-slate-400" />
              <span className="text-base text-slate-700 flex-1 truncate">{attachmentFile.name}</span>
              <button onClick={() => setAttachmentFile(null)} className="p-1 rounded-lg hover:bg-slate-200"><X className="w-4 h-4 text-slate-400" /></button>
            </div>
          )}
          <div className="flex items-center justify-between pt-1">
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors" style={{ minHeight: '44px' }}>
              <Paperclip className="w-5 h-5" /> Adjuntar archivo
            </button>
            <div className="flex gap-3">
              <button onClick={() => { setShowForm(false); setAttachmentFile(null) }} className="px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100 rounded-xl" style={{ minHeight: '44px' }}>Cancelar</button>
              <button onClick={handleSubmit} disabled={!form.title.trim() || !form.content.trim() || uploading} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2" style={{ minHeight: '44px' }}>
                {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
                {uploading ? 'Publicando...' : 'Publicar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {announcements.length === 0 && !showForm ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
          <Megaphone className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <p className="text-lg font-medium text-slate-500">No hay anuncios aún</p>
          {isTeacher && <p className="text-base mt-1 text-slate-400">Publica un anuncio para comunicarte con tus estudiantes</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map(a => (
            <div key={a.id} className={`bg-white rounded-2xl border-2 p-6 ${a.isPinned ? 'border-yellow-300' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5">
                    {a.isPinned && <Pin className="w-5 h-5 text-yellow-500 shrink-0" />}
                    <h3 className="text-lg font-bold text-slate-800">{a.title}</h3>
                  </div>
                  <p className="text-base text-slate-600 mt-3 whitespace-pre-wrap leading-relaxed">{a.content}</p>
                  {a.attachmentUrl && (
                    <button onClick={() => openAttachment(a.attachmentUrl!)} className="flex items-center gap-3 mt-4 px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors group w-full sm:w-auto">
                      <File className="w-5 h-5 text-blue-500" />
                      <span className="text-base text-slate-700 group-hover:text-blue-600 truncate">{a.attachmentName || 'Archivo adjunto'}</span>
                      <Download className="w-4 h-4 text-slate-400 ml-auto shrink-0" />
                    </button>
                  )}
                  <p className="text-sm text-slate-400 mt-4">
                    {a.author.firstName} {a.author.lastName} · {new Date(a.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {isTeacher && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => handleTogglePin(a.id, a.isPinned)} className="p-2 rounded-xl hover:bg-slate-100" title={a.isPinned ? 'Desfijar' : 'Fijar'}>
                      {a.isPinned ? <PinOff className="w-5 h-5 text-slate-400" /> : <Pin className="w-5 h-5 text-slate-400" />}
                    </button>
                    <button onClick={() => handleDelete(a.id)} className="p-2 rounded-xl hover:bg-red-50">
                      <Trash2 className="w-5 h-5 text-red-400" />
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
// TAB: ACTIVIDADES (Tareas funcionales)
// ═══════════════════════════════════════════════════════════════════════════

interface Activity {
  id: string; sectionId: string; classroomId: string; type: string;
  title: string; description?: string; maxScore?: number;
  dueDate?: string; openDate?: string; allowLateSubmit: boolean;
  isVisible: boolean; isPublished: boolean; metadata?: any;
  createdAt: string; updatedAt: string;
  section?: { id: string; title: string };
  _count?: { submissions: number };
  submissions?: { id: string; status: string; score?: number; submittedAt?: string; feedback?: string; attemptNumber: number }[];
}

interface Submission {
  id: string; activityId: string; status: string; content?: string; fileUrl?: string;
  score?: number; feedback?: string; submittedAt?: string; attemptNumber: number;
  studentEnrollment?: { student: { id: string; firstName: string; lastName: string; secondLastName?: string; photo?: string } };
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  DRAFT: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Borrador' },
  SUBMITTED: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Entregado' },
  GRADED: { bg: 'bg-green-100', text: 'text-green-700', label: 'Calificado' },
  RETURNED: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Devuelto' },
  LATE: { bg: 'bg-red-100', text: 'text-red-700', label: 'Tardío' },
  AUTO_GRADED: { bg: 'bg-green-100', text: 'text-green-700', label: 'Auto-calificado' },
}

function ActivitiesTab({ classroom, isTeacher, isStudent, onReload, setError }: {
  classroom: any; isTeacher: boolean; isStudent: boolean; onReload: () => void; setError: (e: string) => void
}) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [submissionsLoading, setSubmissionsLoading] = useState(false)

  // Create form
  const [form, setForm] = useState({ title: '', description: '', sectionId: '', maxScore: '5.0', dueDate: '', allowLateSubmit: false })
  const [attachFile, setAttachFile] = useState<File | null>(null)
  const [creating, setCreating] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Student submit
  const [submitContent, setSubmitContent] = useState('')
  const [submitFile, setSubmitFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [mySubmission, setMySubmission] = useState<any>(null)
  const submitFileRef = useRef<HTMLInputElement>(null)

  // Grading
  const [gradingSubmission, setGradingSubmission] = useState<Submission | null>(null)
  const [gradeScore, setGradeScore] = useState('')
  const [gradeFeedback, setGradeFeedback] = useState('')
  const [grading, setGrading] = useState(false)

  const sections: Section[] = classroom.sections || []

  const loadActivities = useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await classroomApi.listActivities(classroom.id, isStudent ? 'student' : undefined)
      setActivities(data)
    } catch {} finally { setLoading(false) }
  }, [classroom.id, isStudent])

  useEffect(() => { loadActivities() }, [loadActivities])

  const handleCreate = async () => {
    if (!form.title.trim() || !form.sectionId) return
    try {
      setCreating(true)
      let attachmentUrl: string | undefined
      let attachmentName: string | undefined
      if (attachFile) {
        const { data } = await classroomApi.uploadMaterial(attachFile)
        attachmentUrl = data.data.path || data.data.url
        attachmentName = attachFile.name
      }
      await classroomApi.createActivity(classroom.id, {
        sectionId: form.sectionId, type: 'TASK', title: form.title,
        description: form.description || undefined,
        maxScore: parseFloat(form.maxScore) || 5.0,
        dueDate: form.dueDate || undefined,
        allowLateSubmit: form.allowLateSubmit,
        attachmentUrl, attachmentName,
      })
      setForm({ title: '', description: '', sectionId: '', maxScore: '5.0', dueDate: '', allowLateSubmit: false })
      setAttachFile(null)
      setShowCreate(false)
      loadActivities()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al crear actividad')
    } finally { setCreating(false) }
  }

  const handlePublish = async (id: string, published: boolean) => {
    try {
      if (published) await classroomApi.unpublishActivity(id)
      else await classroomApi.publishActivity(id)
      loadActivities()
    } catch {}
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta actividad y todas sus entregas?')) return
    try { await classroomApi.deleteActivity(id); loadActivities(); setSelectedActivity(null) } catch {}
  }

  const openActivity = async (activity: Activity) => {
    setSelectedActivity(activity)
    if (isTeacher) {
      setSubmissionsLoading(true)
      try {
        const { data } = await classroomApi.listSubmissions(activity.id)
        setSubmissions(data)
      } catch {} finally { setSubmissionsLoading(false) }
    }
    if (isStudent) {
      try {
        const { data } = await classroomApi.getMySubmission(activity.id)
        setMySubmission(data)
      } catch { setMySubmission(null) }
    }
  }

  const handleStudentSubmit = async () => {
    if (!selectedActivity) return
    try {
      setSubmitting(true)
      let fileUrl: string | undefined
      if (submitFile) {
        const { data } = await classroomApi.uploadMaterial(submitFile)
        fileUrl = data.data.path || data.data.url
      }
      await classroomApi.submitTask(selectedActivity.id, { content: submitContent || undefined, fileUrl })
      setSubmitContent('')
      setSubmitFile(null)
      const { data } = await classroomApi.getMySubmission(selectedActivity.id)
      setMySubmission(data)
      loadActivities()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al entregar')
    } finally { setSubmitting(false) }
  }

  const handleGrade = async () => {
    if (!gradingSubmission || !gradeScore) return
    try {
      setGrading(true)
      await classroomApi.gradeSubmission(gradingSubmission.id, { score: parseFloat(gradeScore), feedback: gradeFeedback || undefined })
      setGradingSubmission(null)
      setGradeScore(''); setGradeFeedback('')
      if (selectedActivity) openActivity(selectedActivity)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al calificar')
    } finally { setGrading(false) }
  }

  const handleReturn = async (sub: Submission) => {
    const fb = prompt('Retroalimentación para el estudiante (opcional):')
    try {
      await classroomApi.returnSubmission(sub.id, { feedback: fb || undefined })
      if (selectedActivity) openActivity(selectedActivity)
    } catch {}
  }

  const openFile = async (url: string) => {
    try { const { data } = await storageApi.resolveUrl(url); window.open(data.url, '_blank') } catch { window.open(url, '_blank') }
  }

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
  const isDuePast = (d?: string) => d ? new Date(d) < new Date() : false

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>

  // ── ACTIVITY DETAIL VIEW ──
  if (selectedActivity) {
    const act = selectedActivity
    const meta = act.metadata as any
    return (
      <div className="space-y-5">
        <button onClick={() => { setSelectedActivity(null); setMySubmission(null) }} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600">
          <ChevronLeft className="w-4 h-4" /> Volver a actividades
        </button>

        {/* Activity header card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">{act.title}</h2>
                  <p className="text-sm text-slate-400">{act.section?.title || 'Sin sección'}</p>
                </div>
              </div>
              {act.description && <p className="text-base text-slate-600 mt-3 whitespace-pre-wrap leading-relaxed">{act.description}</p>}
              {meta?.attachmentUrl && (
                <button onClick={() => openFile(meta.attachmentUrl)} className="flex items-center gap-3 mt-4 px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors group">
                  <File className="w-5 h-5 text-blue-500" />
                  <span className="text-base text-slate-700 group-hover:text-blue-600">{meta.attachmentName || 'Archivo adjunto'}</span>
                  <Download className="w-4 h-4 text-slate-400 ml-auto" />
                </button>
              )}
            </div>
            {isTeacher && (
              <div className="flex gap-1 shrink-0">
                <button onClick={() => handlePublish(act.id, act.isPublished)} className={`px-4 py-2 rounded-xl text-sm font-medium ${act.isPublished ? 'bg-orange-50 text-orange-600 hover:bg-orange-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`} style={{ minHeight: '44px' }}>
                  {act.isPublished ? 'Despublicar' : 'Publicar'}
                </button>
                <button onClick={() => handleDelete(act.id)} className="p-2.5 rounded-xl hover:bg-red-50">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </button>
              </div>
            )}
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 text-sm">
              <BarChart3 className="w-4 h-4 text-slate-400" />
              <span className="text-slate-600">Nota máx: <strong>{act.maxScore ? Number(act.maxScore) : '—'}</strong></span>
            </div>
            <div className={`flex items-center gap-2 text-sm ${isDuePast(act.dueDate) ? 'text-red-600' : 'text-slate-600'}`}>
              <Clock className="w-4 h-4" />
              <span>Fecha límite: <strong>{formatDate(act.dueDate)}</strong></span>
            </div>
            {act.allowLateSubmit && <span className="text-xs px-2.5 py-1 bg-amber-50 text-amber-600 rounded-full">Permite entrega tardía</span>}
            <span className={`text-xs px-2.5 py-1 rounded-full ${act.isPublished ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
              {act.isPublished ? 'Publicada' : 'Borrador'}
            </span>
          </div>
        </div>

        {/* TEACHER: Submissions list */}
        {isTeacher && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Entregas ({submissions.length})</h3>
            </div>
            {submissionsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
            ) : submissions.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Upload className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-base">Aún no hay entregas</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {submissions.map(sub => {
                  const st = sub.studentEnrollment?.student
                  const name = st ? `${st.lastName}${st.secondLastName ? ' ' + st.secondLastName : ''}, ${st.firstName}` : 'Estudiante'
                  const initials = st ? `${st.firstName?.[0] || ''}${st.lastName?.[0] || ''}` : '?'
                  const statusInfo = STATUS_COLORS[sub.status] || STATUS_COLORS.DRAFT
                  return (
                    <div key={sub.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50">
                      {st?.photo ? (
                        <img src={st.photo} alt={name} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-sm font-bold text-blue-700">{initials}</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-medium text-slate-800">{name}</p>
                        <p className="text-sm text-slate-400">{formatDate(sub.submittedAt)}</p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusInfo.bg} ${statusInfo.text}`}>{statusInfo.label}</span>
                      {sub.score !== undefined && sub.score !== null && (
                        <span className="text-base font-bold text-slate-800">{Number(sub.score)}/{act.maxScore ? Number(act.maxScore) : '?'}</span>
                      )}
                      {sub.fileUrl && (
                        <button onClick={() => openFile(sub.fileUrl!)} className="p-2 rounded-xl hover:bg-blue-50" title="Ver archivo">
                          <Download className="w-5 h-5 text-blue-500" />
                        </button>
                      )}
                      {(sub.status === 'SUBMITTED' || sub.status === 'LATE') && (
                        <div className="flex gap-1">
                          <button onClick={() => { setGradingSubmission(sub); setGradeScore(''); setGradeFeedback('') }} className="px-3 py-2 bg-green-50 text-green-700 rounded-xl text-sm font-medium hover:bg-green-100" style={{ minHeight: '40px' }}>
                            Calificar
                          </button>
                          <button onClick={() => handleReturn(sub)} className="px-3 py-2 bg-orange-50 text-orange-600 rounded-xl text-sm font-medium hover:bg-orange-100" style={{ minHeight: '40px' }}>
                            Devolver
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* TEACHER: Grading modal */}
        {gradingSubmission && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
              <h3 className="text-lg font-bold text-slate-800">Calificar entrega</h3>
              <p className="text-sm text-slate-500">
                {gradingSubmission.studentEnrollment?.student?.firstName} {gradingSubmission.studentEnrollment?.student?.lastName}
              </p>
              {gradingSubmission.content && (
                <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-600 max-h-40 overflow-y-auto whitespace-pre-wrap">{gradingSubmission.content}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nota (máx {act.maxScore ? Number(act.maxScore) : '5.0'})</label>
                <input type="number" step="0.1" min="0" max={act.maxScore ? Number(act.maxScore) : 5} value={gradeScore} onChange={e => setGradeScore(e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Retroalimentación (opcional)</label>
                <textarea value={gradeFeedback} onChange={e => setGradeFeedback(e.target.value)} rows={3} className="w-full border border-slate-300 rounded-xl px-4 py-3 text-base resize-none focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Comentarios para el estudiante..." />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setGradingSubmission(null)} className="px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100 rounded-xl" style={{ minHeight: '44px' }}>Cancelar</button>
                <button onClick={handleGrade} disabled={!gradeScore || grading} className="px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2" style={{ minHeight: '44px' }}>
                  {grading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {grading ? 'Guardando...' : 'Guardar nota'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STUDENT: My submission / submit form */}
        {isStudent && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Tu entrega</h3>
            {mySubmission ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className={`text-sm px-3 py-1 rounded-full font-medium ${(STATUS_COLORS[mySubmission.status] || STATUS_COLORS.DRAFT).bg} ${(STATUS_COLORS[mySubmission.status] || STATUS_COLORS.DRAFT).text}`}>
                    {(STATUS_COLORS[mySubmission.status] || STATUS_COLORS.DRAFT).label}
                  </span>
                  {mySubmission.score !== undefined && mySubmission.score !== null && (
                    <span className="text-lg font-bold text-green-700">{Number(mySubmission.score)}/{act.maxScore ? Number(act.maxScore) : '?'}</span>
                  )}
                  <span className="text-sm text-slate-400">Entregado: {formatDate(mySubmission.submittedAt)}</span>
                </div>
                {mySubmission.content && <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-600 whitespace-pre-wrap">{mySubmission.content}</div>}
                {mySubmission.fileUrl && (
                  <button onClick={() => openFile(mySubmission.fileUrl)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 text-sm text-blue-700">
                    <Download className="w-4 h-4" /> Ver archivo entregado
                  </button>
                )}
                {mySubmission.feedback && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-sm font-medium text-amber-700 mb-1">Retroalimentación del docente:</p>
                    <p className="text-sm text-amber-800 whitespace-pre-wrap">{mySubmission.feedback}</p>
                  </div>
                )}
                {mySubmission.status === 'RETURNED' && (
                  <p className="text-sm text-orange-600 font-medium">El docente devolvió tu entrega. Puedes volver a entregar.</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <textarea value={submitContent} onChange={e => setSubmitContent(e.target.value)} rows={4} placeholder="Escribe tu respuesta aquí (opcional)..." className="w-full border border-slate-300 rounded-xl px-4 py-3 text-base resize-none focus:ring-2 focus:ring-blue-500 outline-none" />
                <input ref={submitFileRef} type="file" className="hidden" onChange={e => setSubmitFile(e.target.files?.[0] || null)} />
                {submitFile ? (
                  <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
                    <Paperclip className="w-5 h-5 text-slate-400" />
                    <span className="text-base text-slate-700 flex-1 truncate">{submitFile.name}</span>
                    <button onClick={() => setSubmitFile(null)} className="p-1 rounded-lg hover:bg-slate-200"><X className="w-4 h-4" /></button>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <button onClick={() => submitFileRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors" style={{ minHeight: '44px' }}>
                    <Upload className="w-5 h-5" /> Subir archivo
                  </button>
                  <button onClick={handleStudentSubmit} disabled={(!submitContent.trim() && !submitFile) || submitting} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2" style={{ minHeight: '44px' }}>
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {submitting ? 'Entregando...' : 'Entregar actividad'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── ACTIVITIES LIST VIEW ──
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Actividades</h2>
        {isTeacher && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors" style={{ minHeight: '44px' }}>
            <Plus className="w-5 h-5" /> Crear Tarea
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-white border-2 border-blue-200 rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-bold text-slate-800">Nueva Tarea</h3>
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Título de la tarea" className="w-full border border-slate-300 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 outline-none" autoFocus />
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Instrucciones y descripción..." rows={4} className="w-full border border-slate-300 rounded-xl px-4 py-3 text-base resize-none focus:ring-2 focus:ring-blue-500 outline-none" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sección</label>
              <select value={form.sectionId} onChange={e => setForm({ ...form, sectionId: e.target.value })} className="w-full border border-slate-300 rounded-xl px-4 py-3 text-base">
                <option value="">Seleccionar sección...</option>
                {sections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nota máxima</label>
              <input type="number" step="0.1" min="0" value={form.maxScore} onChange={e => setForm({ ...form, maxScore: e.target.value })} className="w-full border border-slate-300 rounded-xl px-4 py-3 text-base" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha límite</label>
              <input type="datetime-local" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} className="w-full border border-slate-300 rounded-xl px-4 py-3 text-base" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={form.allowLateSubmit} onChange={e => setForm({ ...form, allowLateSubmit: e.target.checked })} className="rounded" />
            Permitir entregas tardías
          </label>
          <input ref={fileRef} type="file" className="hidden" onChange={e => setAttachFile(e.target.files?.[0] || null)} />
          {attachFile && (
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
              <Paperclip className="w-5 h-5 text-slate-400" />
              <span className="text-base text-slate-700 flex-1 truncate">{attachFile.name}</span>
              <button onClick={() => setAttachFile(null)} className="p-1 rounded-lg hover:bg-slate-200"><X className="w-4 h-4" /></button>
            </div>
          )}
          <div className="flex items-center justify-between pt-2">
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors" style={{ minHeight: '44px' }}>
              <Paperclip className="w-5 h-5" /> Adjuntar archivo
            </button>
            <div className="flex gap-3">
              <button onClick={() => { setShowCreate(false); setAttachFile(null) }} className="px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100 rounded-xl" style={{ minHeight: '44px' }}>Cancelar</button>
              <button onClick={handleCreate} disabled={!form.title.trim() || !form.sectionId || creating} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2" style={{ minHeight: '44px' }}>
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                {creating ? 'Creando...' : 'Crear Tarea'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activities list */}
      {activities.length === 0 && !showCreate ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
          <ClipboardList className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <p className="text-lg font-medium text-slate-500">{isTeacher ? 'No has creado actividades aún' : 'No hay actividades publicadas'}</p>
          {isTeacher && <p className="text-base mt-1 text-slate-400">Crea tu primera tarea para que los estudiantes puedan entregar</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map(act => {
            const statusInfo = act.isPublished ? { bg: 'bg-green-50', text: 'text-green-600', label: 'Publicada' } : { bg: 'bg-slate-100', text: 'text-slate-500', label: 'Borrador' }
            const duePast = isDuePast(act.dueDate)
            const studentSub = act.submissions?.[0]
            const studentStatus = studentSub ? STATUS_COLORS[studentSub.status] : null
            return (
              <button key={act.id} onClick={() => openActivity(act)} className="w-full text-left bg-white rounded-2xl border-2 border-slate-200 hover:border-blue-300 p-5 transition-all hover:shadow-sm group">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <ClipboardList className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-base font-bold text-slate-800 group-hover:text-blue-700">{act.title}</h3>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${statusInfo.bg} ${statusInfo.text}`}>{statusInfo.label}</span>
                      {studentStatus && (
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${studentStatus.bg} ${studentStatus.text}`}>{studentStatus.label}</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-1">{act.section?.title || 'Sin sección'}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      {act.dueDate && (
                        <span className={`flex items-center gap-1 ${duePast ? 'text-red-500' : 'text-slate-400'}`}>
                          <Clock className="w-4 h-4" /> {formatDate(act.dueDate)}
                        </span>
                      )}
                      {act.maxScore && <span className="text-slate-400">Nota máx: {Number(act.maxScore)}</span>}
                      {isTeacher && act._count && <span className="text-slate-400">{act._count.submissions} entrega(s)</span>}
                      {studentSub?.score !== undefined && studentSub.score !== null && (
                        <span className="text-green-700 font-bold">{Number(studentSub.score)}/{act.maxScore ? Number(act.maxScore) : '?'}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 shrink-0 mt-1" />
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: FORO (funcional)
// ═══════════════════════════════════════════════════════════════════════════

interface ForumPostData {
  id: string; title?: string; content: string; authorId: string; parentId?: string;
  isPinned: boolean; isAnonymous: boolean; createdAt: string;
  author: { id: string; firstName: string; lastName: string };
  _count?: { replies: number };
  replies?: ForumPostData[];
}

function ForumTab({ classroom, isTeacher, isStudent, user, setError }: {
  classroom: any; isTeacher: boolean; isStudent: boolean; user: any; setError: (e: string) => void
}) {
  const [posts, setPosts] = useState<ForumPostData[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', content: '' })
  const [creating, setCreating] = useState(false)

  // Thread view
  const [selectedPost, setSelectedPost] = useState<ForumPostData | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [replying, setReplying] = useState(false)
  const [replyToId, setReplyToId] = useState<string | null>(null)

  const loadPosts = useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await classroomApi.listForumPosts(classroom.id)
      setPosts(data)
    } catch {} finally { setLoading(false) }
  }, [classroom.id])

  useEffect(() => { loadPosts() }, [loadPosts])

  const handleCreate = async () => {
    if (!form.title.trim() || !form.content.trim()) return
    try {
      setCreating(true)
      await classroomApi.createForumPost(classroom.id, { title: form.title, content: form.content })
      setForm({ title: '', content: '' })
      setShowCreate(false)
      loadPosts()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al crear tema')
    } finally { setCreating(false) }
  }

  const openThread = async (post: ForumPostData) => {
    setThreadLoading(true)
    try {
      const { data } = await classroomApi.getForumPost(post.id)
      setSelectedPost(data)
    } catch {} finally { setThreadLoading(false) }
  }

  const handleReply = async () => {
    if (!replyContent.trim() || !selectedPost) return
    try {
      setReplying(true)
      await classroomApi.createForumPost(classroom.id, {
        title: '', content: replyContent,
        parentId: replyToId || selectedPost.id,
      })
      setReplyContent('')
      setReplyToId(null)
      openThread(selectedPost)
      loadPosts()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al responder')
    } finally { setReplying(false) }
  }

  const handlePin = async (postId: string) => {
    try { await classroomApi.togglePinForumPost(postId); loadPosts(); if (selectedPost) openThread(selectedPost) } catch {}
  }

  const handleDeletePost = async (postId: string) => {
    if (!confirm('¿Eliminar esta publicación?')) return
    try {
      await classroomApi.deleteForumPost(postId)
      if (selectedPost?.id === postId) setSelectedPost(null)
      loadPosts()
    } catch {}
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  const currentUserId = user?.id

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>

  // ── THREAD DETAIL VIEW ──
  if (selectedPost) {
    const post = selectedPost
    return (
      <div className="space-y-5">
        <button onClick={() => { setSelectedPost(null); setReplyToId(null); setReplyContent('') }} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600">
          <ChevronLeft className="w-4 h-4" /> Volver al foro
        </button>

        {threadLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
        ) : (
          <>
            {/* Main post */}
            <div className={`bg-white rounded-2xl border-2 p-6 ${post.isPinned ? 'border-yellow-300' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2.5 mb-2">
                    {post.isPinned && <Pin className="w-4 h-4 text-yellow-500" />}
                    <h2 className="text-xl font-bold text-slate-800">{post.title || 'Sin título'}</h2>
                  </div>
                  <p className="text-base text-slate-600 whitespace-pre-wrap leading-relaxed">{post.content}</p>
                  <p className="text-sm text-slate-400 mt-4">
                    {post.author.firstName} {post.author.lastName} · {formatDate(post.createdAt)}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {isTeacher && (
                    <button onClick={() => handlePin(post.id)} className="p-2 rounded-xl hover:bg-slate-100" title={post.isPinned ? 'Desfijar' : 'Fijar'}>
                      {post.isPinned ? <PinOff className="w-5 h-5 text-slate-400" /> : <Pin className="w-5 h-5 text-slate-400" />}
                    </button>
                  )}
                  {(isTeacher || post.authorId === currentUserId) && (
                    <button onClick={() => handleDeletePost(post.id)} className="p-2 rounded-xl hover:bg-red-50">
                      <Trash2 className="w-5 h-5 text-red-400" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Replies */}
            <div className="space-y-3">
              <h3 className="text-base font-bold text-slate-700">{post.replies?.length || 0} Respuesta(s)</h3>
              {post.replies?.map(reply => (
                <div key={reply.id} className="bg-white rounded-2xl border border-slate-200 p-5 ml-4">
                  <p className="text-base text-slate-700 whitespace-pre-wrap">{reply.content}</p>
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-sm text-slate-400">
                      {reply.author.firstName} {reply.author.lastName} · {formatDate(reply.createdAt)}
                    </p>
                    <div className="flex gap-1">
                      <button onClick={() => setReplyToId(reply.id)} className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50">Responder</button>
                      {(isTeacher || reply.authorId === currentUserId) && (
                        <button onClick={() => handleDeletePost(reply.id)} className="p-1 rounded hover:bg-red-50"><Trash2 className="w-4 h-4 text-red-400" /></button>
                      )}
                    </div>
                  </div>
                  {/* Nested replies (level 2) */}
                  {reply.replies && reply.replies.length > 0 && (
                    <div className="mt-3 ml-4 space-y-2 border-l-2 border-slate-100 pl-4">
                      {reply.replies.map((nested: any) => (
                        <div key={nested.id} className="py-2">
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">{nested.content}</p>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-xs text-slate-400">{nested.author.firstName} {nested.author.lastName} · {formatDate(nested.createdAt)}</p>
                            {(isTeacher || nested.authorId === currentUserId) && (
                              <button onClick={() => handleDeletePost(nested.id)} className="p-0.5 rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Reply form */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              {replyToId && (
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <span>Respondiendo a un comentario</span>
                  <button onClick={() => setReplyToId(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                </div>
              )}
              <textarea value={replyContent} onChange={e => setReplyContent(e.target.value)} rows={3} placeholder="Escribe tu respuesta..." className="w-full border border-slate-300 rounded-xl px-4 py-3 text-base resize-none focus:ring-2 focus:ring-blue-500 outline-none" />
              <div className="flex justify-end">
                <button onClick={handleReply} disabled={!replyContent.trim() || replying} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2" style={{ minHeight: '44px' }}>
                  {replying && <Loader2 className="w-4 h-4 animate-spin" />}
                  {replying ? 'Enviando...' : 'Responder'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  // ── FORUM LIST VIEW ──
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Foro de Discusión</h2>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors" style={{ minHeight: '44px' }}>
          <Plus className="w-5 h-5" /> Nuevo Tema
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-white border-2 border-blue-200 rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-bold text-slate-800">Nuevo Tema de Discusión</h3>
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Título del tema" className="w-full border border-slate-300 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 outline-none" autoFocus />
          <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Describe el tema de discusión..." rows={4} className="w-full border border-slate-300 rounded-xl px-4 py-3 text-base resize-none focus:ring-2 focus:ring-blue-500 outline-none" />
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100 rounded-xl" style={{ minHeight: '44px' }}>Cancelar</button>
            <button onClick={handleCreate} disabled={!form.title.trim() || !form.content.trim() || creating} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2" style={{ minHeight: '44px' }}>
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              {creating ? 'Publicando...' : 'Publicar Tema'}
            </button>
          </div>
        </div>
      )}

      {/* Posts list */}
      {posts.length === 0 && !showCreate ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
          <MessageSquare className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <p className="text-lg font-medium text-slate-500">No hay temas de discusión</p>
          <p className="text-base mt-1 text-slate-400">Crea el primer tema para iniciar la conversación</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(post => (
            <button key={post.id} onClick={() => openThread(post)} className="w-full text-left bg-white rounded-2xl border-2 border-slate-200 hover:border-blue-300 p-5 transition-all hover:shadow-sm group">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-sm font-bold text-blue-700 shrink-0">
                  {post.author.firstName?.[0] || ''}{post.author.lastName?.[0] || ''}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {post.isPinned && <Pin className="w-4 h-4 text-yellow-500" />}
                    <h3 className="text-base font-bold text-slate-800 group-hover:text-blue-700">{post.title || 'Sin título'}</h3>
                  </div>
                  <p className="text-sm text-slate-500 mt-1 line-clamp-2">{post.content}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                    <span>{post.author.firstName} {post.author.lastName}</span>
                    <span>{formatDate(post.createdAt)}</span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-4 h-4" /> {post._count?.replies || 0} respuesta(s)
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 shrink-0 mt-1" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: MIS NOTAS (placeholder para estudiantes)
// ═══════════════════════════════════════════════════════════════════════════

function GradesTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-800">Mis Calificaciones</h2>

      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <BarChart3 className="w-16 h-16 mx-auto text-slate-300 mb-4" />
        <h3 className="text-xl font-bold text-slate-700">Próximamente</h3>
        <p className="text-base text-slate-500 mt-2 max-w-lg mx-auto">
          Aquí podrás ver todas tus calificaciones del curso, organizadas por actividad con tu nota, fecha de entrega y retroalimentación del docente.
        </p>
      </div>

      {/* Preview table structure */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden opacity-70">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h3 className="text-base font-bold text-slate-700">Vista previa de calificaciones</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-6 py-3 text-sm font-semibold text-slate-600">Actividad</th>
              <th className="text-left px-6 py-3 text-sm font-semibold text-slate-600">Fecha límite</th>
              <th className="text-left px-6 py-3 text-sm font-semibold text-slate-600">Estado</th>
              <th className="text-left px-6 py-3 text-sm font-semibold text-slate-600">Nota</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-50">
              <td className="px-6 py-3 text-sm text-slate-500">—</td>
              <td className="px-6 py-3 text-sm text-slate-500">—</td>
              <td className="px-6 py-3"><span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-500 rounded-full">Sin datos</span></td>
              <td className="px-6 py-3 text-sm text-slate-500">—</td>
            </tr>
          </tbody>
        </table>
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

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>

  const getStudentName = (s: any) => {
    const student = s.student || {}
    const firstName = student.firstName || student.user?.firstName || ''
    const lastName = student.lastName || student.user?.lastName || ''
    const secondLastName = student.secondLastName || ''
    const email = student.email || student.user?.email || ''
    const photo = student.photo || null
    return { firstName, lastName, secondLastName, email, photo }
  }

  const filtered = students.filter((s: any) => {
    if (!search.trim()) return true
    const { firstName, lastName } = getStudentName(s)
    return `${firstName} ${lastName}`.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2.5">
          Estudiantes del grupo
          <span className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-semibold">{students.length}</span>
        </h2>
        {students.length > 5 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar estudiante..."
              className="pl-10 pr-4 py-2.5 text-base border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none w-64"
            />
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="divide-y divide-slate-100">
          {filtered.length === 0 && students.length > 0 && (
            <div className="text-center py-12 text-slate-400 text-base">No se encontraron estudiantes</div>
          )}
          {filtered.length === 0 && students.length === 0 && (
            <div className="text-center py-16 text-slate-400 text-base">No hay estudiantes matriculados en este grupo</div>
          )}
          {filtered.map((s: any, i: number) => {
            const { firstName, lastName, secondLastName, email, photo } = getStudentName(s)
            const displayName = lastName && firstName
              ? `${lastName}${secondLastName ? ' ' + secondLastName : ''}, ${firstName}`
              : lastName || firstName || 'Sin nombre'
            const initials = `${firstName[0] || ''}${lastName[0] || ''}`

            return (
              <div key={s.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                <span className="text-sm text-slate-400 w-8 text-right font-mono">{i + 1}</span>
                {photo ? (
                  <img src={photo} alt={displayName} className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-sm font-bold text-blue-700 shrink-0">
                    {initials || '?'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium text-slate-800">{displayName}</p>
                  {email && <p className="text-sm text-slate-400 truncate">{email}</p>}
                </div>
                <span className="text-sm bg-green-50 text-green-600 px-3 py-1 rounded-full shrink-0 font-medium">Activo</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
