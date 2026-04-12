import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { classroomApi, storageApi, liveSessionApi } from '../lib/api'
import LiveQuiz from '../components/LiveQuiz'
import { CreateSelfAssessmentForm, StudentSelfAssessment, SelfAssessmentResults } from '../components/SelfAssessmentUI'
const RichTextEditor = lazy(() => import('../components/RichTextEditor'))
import { RichContent, isRichTextEmpty } from '../components/RichTextEditor'
import {
  Plus, Loader2, AlertCircle, ChevronLeft, Users, Megaphone,
  FolderOpen, FileText, Video, Link2, ImageIcon, Type, Eye, EyeOff,
  Trash2, Pencil, Pin, PinOff, X, Upload, ExternalLink,
  GraduationCap, Layers, ClipboardList, BookOpen, Download,
  Bold, Italic, Underline, List, ListOrdered, Youtube,
  FileUp, Image, Search, Paperclip, File, Home, MessageSquare,
  BarChart3, ChevronDown, ChevronUp, ChevronRight, Clock, CheckCircle2, AlertTriangle,
  CircleDot, HelpCircle, Award, RotateCcw, CircleCheck, CircleX, Copy, Check, Zap, RefreshCw, Sparkles,
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

  // Copy classroom modal
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [copyTargets, setCopyTargets] = useState<any[]>([])
  const [selectedCopyTargets, setSelectedCopyTargets] = useState<string[]>([])
  const [copying, setCopying] = useState(false)

  const [showColorModal, setShowColorModal] = useState(false)
  const [colorDraft, setColorDraft] = useState('#3B82F6')

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

  // Copy classroom functions
  const loadCopyTargets = async () => {
    if (!activeClassroom?.id) return
    try {
      const { data } = await classroomApi.getAvailableAssignments()
      // Filter out the current classroom's assignment
      const filtered = data.filter((a: any) => a.id !== activeClassroom.teacherAssignment?.id)
      setCopyTargets(filtered)
    } catch {}
  }

  const handleCopyClassroom = async () => {
    if (selectedCopyTargets.length === 0) return
    try {
      setCopying(true)
      const { data } = await classroomApi.copyClassroomTo(activeClassroom.id, selectedCopyTargets)
      setShowCopyModal(false)
      setSelectedCopyTargets([])
      loadClassrooms()
      alert(`Aula copiada a ${data.copied} grupo(s) exitosamente`)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al copiar aula')
    } finally {
      setCopying(false)
    }
  }

  const openColorModal = () => {
    setColorDraft(activeClassroom?.color || '#3B82F6')
    setShowColorModal(true)
  }

  const handleSaveColor = async () => {
    if (!activeClassroom?.id) return
    try {
      await classroomApi.update(activeClassroom.id, { color: colorDraft })
      setShowColorModal(false)
      await loadClassroom(activeClassroom.id, true)
      loadClassrooms()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al actualizar el color')
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
        ) : (() => {
          // Agrupar aulas por grado
          const groupedByGrade = classrooms.reduce((acc, c) => {
            const gradeName = c.teacherAssignment.group.grade.name
            if (!acc[gradeName]) acc[gradeName] = []
            acc[gradeName].push(c)
            return acc
          }, {} as Record<string, ClassroomListItem[]>)
          
          // Ordenar grados naturalmente (Sexto, Séptimo, Octavo, etc.)
          const gradeOrder = ['Preescolar', 'Transición', 'Primero', 'Segundo', 'Tercero', 'Cuarto', 'Quinto', 'Sexto', 'Séptimo', 'Octavo', 'Noveno', 'Décimo', 'Undécimo', 'Once']
          const sortedGrades = Object.keys(groupedByGrade).sort((a, b) => {
            const aIdx = gradeOrder.findIndex(g => a.toLowerCase().includes(g.toLowerCase()))
            const bIdx = gradeOrder.findIndex(g => b.toLowerCase().includes(g.toLowerCase()))
            if (aIdx === -1 && bIdx === -1) return a.localeCompare(b)
            if (aIdx === -1) return 1
            if (bIdx === -1) return -1
            return aIdx - bIdx
          })

          return (
            <div className="space-y-6">
              {sortedGrades.map(gradeName => (
                <div key={gradeName}>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4" />
                    {gradeName}
                    <span className="text-xs font-normal text-slate-400">({groupedByGrade[gradeName].length})</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupedByGrade[gradeName].map(c => (
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
                            {c.teacherAssignment.group.name} · {c.teacherAssignment.subject.name}
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
                </div>
              ))}
            </div>
          )
        })()}

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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
          <button onClick={() => setActiveClassroom(null)} className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm mb-2 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Todas las aulas
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">{activeClassroom.title}</h1>
              <p className="text-base text-white/80 mt-1">
                {ta.group.grade.name} {ta.group.name} · {ta.subject.name}
                {ta.teacher && ` · Prof. ${ta.teacher.firstName} ${ta.teacher.lastName}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isTeacher && (
                <>
                  <button onClick={openColorModal} className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 rounded-xl px-3 py-2 text-white text-sm font-medium transition-colors" title="Cambiar color">
                    <div className="w-3.5 h-3.5 rounded-full border border-white/70" style={{ backgroundColor: activeClassroom.color || '#3B82F6' }} />
                    <span className="hidden sm:inline">Color</span>
                  </button>
                  <button onClick={() => { setShowCopyModal(true); loadCopyTargets() }} className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 rounded-xl px-3 py-2 text-white text-sm font-medium transition-colors">
                    <Copy className="w-4 h-4" />
                    <span className="hidden sm:inline">Copiar aula</span>
                  </button>
                </>
              )}
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
      </div>

      {/* ── HORIZONTAL TAB NAVIGATION ── */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-2 sm:px-6">
          <nav className="flex gap-0.5 sm:gap-1 overflow-x-auto scrollbar-hide -mb-px">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
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
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
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
            {activeTab === 'home' && <HomeTab classroom={activeClassroom} isTeacher={!!isTeacher} isStudent={!!isStudent} user={user} onReload={reloadClassroom} setError={setError} setActiveTab={setActiveTab} />}
            {activeTab === 'announcements' && <AnnouncementsTab classroom={activeClassroom} isTeacher={!!isTeacher} onReload={reloadClassroom} setError={setError} />}
            {activeTab === 'content' && <ContentTab classroom={activeClassroom} isTeacher={!!isTeacher} onReload={reloadClassroom} setError={setError} />}
            {activeTab === 'activities' && <ActivitiesTab classroom={activeClassroom} isTeacher={!!isTeacher} isStudent={!!isStudent} onReload={reloadClassroom} setError={setError} />}
            {activeTab === 'forum' && <ForumTab classroom={activeClassroom} isTeacher={!!isTeacher} isStudent={!!isStudent} user={user} setError={setError} />}
            {activeTab === 'students' && <StudentsTab classroomId={activeClassroom.id} />}
            {activeTab === 'grades' && <GradesTab classroomId={activeClassroom.id} />}
          </>
        )}
      </div>

      {/* Copy Classroom Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Copiar aula a otros grupos</h3>
              <button onClick={() => { setShowCopyModal(false); setSelectedCopyTargets([]) }} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <p className="text-sm text-slate-500">
              Selecciona las asignaciones donde deseas copiar el contenido de esta aula (secciones, materiales, actividades y preguntas de quiz).
            </p>
            
            {copyTargets.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Copy className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p>No hay otras asignaciones disponibles para copiar</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {copyTargets.map((a: any) => {
                  const isSelected = selectedCopyTargets.includes(a.id)
                  return (
                    <label key={a.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          if (isSelected) {
                            setSelectedCopyTargets(prev => prev.filter(id => id !== a.id))
                          } else {
                            setSelectedCopyTargets(prev => [...prev, a.id])
                          }
                        }}
                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800">{a.subject?.name}</p>
                        <p className="text-sm text-slate-500">{a.group?.grade?.name} {a.group?.name}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => { setShowCopyModal(false); setSelectedCopyTargets([]) }} className="px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">
                Cancelar
              </button>
              <button
                onClick={handleCopyClassroom}
                disabled={selectedCopyTargets.length === 0 || copying}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {copying && <Loader2 className="w-4 h-4 animate-spin" />}
                Copiar a {selectedCopyTargets.length} grupo{selectedCopyTargets.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {showColorModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">Cambiar color del aula</h3>
              <button onClick={() => setShowColorModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="flex gap-2 mb-4">
              {COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setColorDraft(color)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${colorDraft === color ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowColorModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
              <button onClick={handleSaveColor} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: INICIO (Dashboard diferenciado docente/estudiante)
// ═══════════════════════════════════════════════════════════════════════════

function HomeTab({ classroom, isTeacher, isStudent, user, onReload, setError, setActiveTab }: {
  classroom: any; isTeacher: boolean; isStudent: boolean; user: any; onReload: () => void; setError: (e: string) => void; setActiveTab: (tab: TabKey) => void
}) {
  const announcements: Announcement[] = classroom.announcements || []
  const sections: Section[] = classroom.sections || []
  const totalMaterials = sections.reduce((acc: number, s: Section) => acc + s.materials.length, 0)
  const pinnedAnnouncements = announcements.filter(a => a.isPinned).slice(0, 3)
  const recentAnnouncements = announcements.filter(a => !a.isPinned).slice(0, 2)

  // Student dashboard
  if (isStudent) {
    const firstName = user?.firstName || 'Estudiante'
    const allActivities = sections.flatMap(s => (s as any).activities || [])
    const formatShortDate = (d?: string) => d ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : null
    const TYPE_LABELS: Record<string, string> = { TASK: 'Tarea', QUIZ: 'Quiz', EXAM: 'Examen', ICFES_SIMULATOR: 'ICFES', FORUM: 'Foro', GAME: 'Juego' }
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
          <div className="bg-white rounded-2xl border-2 border-orange-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('activities')}>
            <div className="bg-gradient-to-r from-orange-500 to-orange-400 px-5 py-3 flex items-center gap-2.5">
              <ClipboardList className="w-6 h-6 text-white" />
              <h3 className="text-lg font-bold text-white">Actividades ({allActivities.length})</h3>
            </div>
            <div className="p-5">
              {allActivities.length === 0 ? (
                <p className="text-base text-slate-500">No hay actividades publicadas aún</p>
              ) : (
                <div className="space-y-2.5">
                  {allActivities.slice(0, 4).map((a: any) => (
                    <div key={a.id} className="flex items-center gap-2.5">
                      <ClipboardList className="w-5 h-5 text-orange-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{a.title}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded font-medium">{TYPE_LABELS[a.type] || a.type}</span>
                          {a.dueDate && <span className={new Date(a.dueDate) < new Date() ? 'text-red-500 font-medium' : ''}>
                            {formatShortDate(a.dueDate)}
                          </span>}
                          {a.maxScore && <span>Nota: {Number(a.maxScore)}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                  {allActivities.length > 4 && <p className="text-xs text-slate-400">+{allActivities.length - 4} más</p>}
                </div>
              )}
            </div>
          </div>

          {/* Anuncios recientes */}
          <div className="bg-white rounded-2xl border-2 border-blue-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('announcements')}>
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
          <div className="bg-white rounded-2xl border-2 border-green-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('grades')}>
            <div className="bg-gradient-to-r from-green-500 to-green-400 px-5 py-3 flex items-center gap-2.5">
              <BarChart3 className="w-6 h-6 text-white" />
              <h3 className="text-lg font-bold text-white">Mis Calificaciones</h3>
            </div>
            <div className="p-5">
              <p className="text-base text-slate-600">Tus calificaciones aparecerán aquí</p>
            </div>
          </div>

          {/* Contenidos del Curso */}
          <div className="bg-white rounded-2xl border-2 border-purple-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('content')}>
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

  // Copy announcement modal
  const [copyModal, setCopyModal] = useState<{ announcementId: string; title: string } | null>(null)
  const [availableClassrooms, setAvailableClassrooms] = useState<any[]>([])
  const [loadingClassrooms, setLoadingClassrooms] = useState(false)
  const [copying, setCopying] = useState(false)

  // Image preview
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  const announcements: Announcement[] = classroom.announcements || []

  const isImageFile = (name?: string, url?: string) => {
    if (!name && !url) return false
    const ext = (name || url || '').toLowerCase().split('.').pop()
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext || '')
  }

  const handleSubmit = async () => {
    if (!form.title.trim() || isRichTextEmpty(form.content)) return
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

  const openCopyModal = async (announcementId: string, title: string) => {
    setCopyModal({ announcementId, title })
    setLoadingClassrooms(true)
    try {
      const { data } = await classroomApi.listClassroomsForCopy(classroom.id)
      setAvailableClassrooms(data || [])
    } catch { setAvailableClassrooms([]) }
    finally { setLoadingClassrooms(false) }
  }

  const handleCopyToClassroom = async (targetClassroomId: string) => {
    if (!copyModal) return
    setCopying(true)
    try {
      await classroomApi.copyAnnouncement(copyModal.announcementId, targetClassroomId)
      setCopyModal(null)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al copiar anuncio')
    } finally { setCopying(false) }
  }

  const openImagePreview = async (url: string) => {
    try {
      const { data } = await storageApi.resolveUrl(url)
      setPreviewImage(data.url)
    } catch { setPreviewImage(url) }
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
          <Suspense fallback={<div className="h-32 bg-slate-50 rounded-xl animate-pulse" />}>
            <RichTextEditor value={form.content} onChange={v => setForm({ ...form, content: v })} placeholder="Escribe tu anuncio aquí..." />
          </Suspense>
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
              <button onClick={handleSubmit} disabled={!form.title.trim() || isRichTextEmpty(form.content) || uploading} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2" style={{ minHeight: '44px' }}>
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
                  <RichContent html={a.content} className="mt-3 text-base text-slate-600" />
                  {a.attachmentUrl && (
                    isImageFile(a.attachmentName, a.attachmentUrl) ? (
                      <div className="mt-4">
                        <ImagePreview url={a.attachmentUrl} name={a.attachmentName} onExpand={() => openImagePreview(a.attachmentUrl!)} />
                      </div>
                    ) : (
                      <button onClick={() => openAttachment(a.attachmentUrl!)} className="flex items-center gap-3 mt-4 px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors group w-full sm:w-auto">
                        <File className="w-5 h-5 text-blue-500" />
                        <span className="text-base text-slate-700 group-hover:text-blue-600 truncate">{a.attachmentName || 'Archivo adjunto'}</span>
                        <Download className="w-4 h-4 text-slate-400 ml-auto shrink-0" />
                      </button>
                    )
                  )}
                  <p className="text-sm text-slate-400 mt-4">
                    {a.author.firstName} {a.author.lastName} · {new Date(a.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {isTeacher && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openCopyModal(a.id, a.title)} className="p-2 rounded-xl hover:bg-blue-50" title="Copiar a otro curso">
                      <Copy className="w-5 h-5 text-blue-400" />
                    </button>
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

      {/* Copy announcement modal */}
      {copyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-800 mb-1">Copiar anuncio</h3>
            <p className="text-sm text-slate-500 mb-4 truncate">"{copyModal.title}"</p>
            {loadingClassrooms ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
            ) : availableClassrooms.length === 0 ? (
              <p className="text-center text-slate-500 py-8">No tienes otras aulas disponibles</p>
            ) : (
              <div className="space-y-2">
                {availableClassrooms.map(c => (
                  <button key={c.id} onClick={() => handleCopyToClassroom(c.id)} disabled={copying} className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 hover:bg-blue-50 hover:border-blue-300 transition-colors disabled:opacity-50">
                    <p className="font-medium text-slate-800">{c.title}</p>
                    <p className="text-xs text-slate-400">{c.teacherAssignment?.group?.grade?.name} {c.teacherAssignment?.group?.name}</p>
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end mt-4">
              <button onClick={() => setCopyModal(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Image preview modal */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-4xl max-h-[90vh]">
            <img src={previewImage} alt="Vista previa" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
            <button onClick={() => setPreviewImage(null)} className="absolute top-2 right-2 p-2 bg-black/50 rounded-full hover:bg-black/70">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ImagePreview({ url, name, onExpand }: { url: string; name?: string; onExpand: () => void }) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)
  useEffect(() => {
    storageApi.resolveUrl(url).then(({ data }) => setResolvedUrl(data.url)).catch(() => setResolvedUrl(url))
  }, [url])
  if (!resolvedUrl) return <div className="w-full h-48 bg-slate-100 rounded-xl animate-pulse" />
  return (
    <div className="relative group">
      <img src={resolvedUrl} alt={name || 'Imagen'} className="max-w-full max-h-64 rounded-xl border border-slate-200 cursor-pointer" onClick={onExpand} />
      <button onClick={onExpand} className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors rounded-xl">
        <Eye className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
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

  // Copy section modal
  const [copySectionModal, setCopySectionModal] = useState<{ sectionId: string; sectionTitle: string } | null>(null)
  const [availableClassrooms, setAvailableClassrooms] = useState<any[]>([])
  const [loadingClassrooms, setLoadingClassrooms] = useState(false)
  const [copyingSection, setCopyingSection] = useState(false)

  // Duplicate material modal
  const [duplicateMaterialModal, setDuplicateMaterialModal] = useState<{ materialId: string; materialTitle: string } | null>(null)
  const [duplicatingMaterial, setDuplicatingMaterial] = useState(false)

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
    try {
      // Primer intento sin force para verificar si hay entregas
      const res = await classroomApi.deleteSection(sectionId, false)
      if (res.data.requiresConfirmation) {
        // Hay actividades con entregas - pedir confirmación especial
        const confirmed = confirm(res.data.message)
        if (confirmed) {
          await classroomApi.deleteSection(sectionId, true)
          onReload()
        }
      } else if (res.data.success) {
        onReload()
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al eliminar sección')
    }
  }

  const handleToggleVis = async (sectionId: string, vis: boolean) => {
    try { await classroomApi.updateSection(sectionId, { isVisible: !vis }); onReload() } catch {}
  }

  const handleDeleteMaterial = async (id: string) => {
    try { await classroomApi.deleteMaterial(id); onReload() } catch {}
  }

  const openDuplicateMaterialModal = (materialId: string, materialTitle: string) => {
    setDuplicateMaterialModal({ materialId, materialTitle })
  }

  const handleDuplicateMaterialToSection = async (targetSectionId: string) => {
    if (!duplicateMaterialModal) return
    setDuplicatingMaterial(true)
    try {
      await classroomApi.duplicateMaterial(duplicateMaterialModal.materialId, targetSectionId)
      setDuplicateMaterialModal(null)
      onReload()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al duplicar material')
    } finally {
      setDuplicatingMaterial(false)
    }
  }

  const openCopySectionModal = async (sectionId: string, sectionTitle: string) => {
    setCopySectionModal({ sectionId, sectionTitle })
    setLoadingClassrooms(true)
    try {
      const res = await classroomApi.listClassroomsForCopy(classroom.id)
      setAvailableClassrooms(res.data || [])
    } catch {
      setAvailableClassrooms([])
    } finally {
      setLoadingClassrooms(false)
    }
  }

  const handleCopySectionToClassroom = async (targetClassroomId: string) => {
    if (!copySectionModal) return
    setCopyingSection(true)
    try {
      const result = await classroomApi.copySectionToClassroom(copySectionModal.sectionId, targetClassroomId)
      alert(`Sección copiada exitosamente.\nMateriales: ${result.data.materialsCopied}\nActividades: ${result.data.activitiesCopied}`)
      setCopySectionModal(null)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al copiar sección')
    } finally {
      setCopyingSection(false)
    }
  }

  const handleToggleMaterialVis = async (id: string, vis: boolean) => {
    try { await classroomApi.updateMaterial(id, { isVisible: !vis }); onReload() } catch {}
  }

  const handleUpdateMaterialTitle = async (id: string, title: string) => {
    try { await classroomApi.updateMaterial(id, { title }); onReload() } catch {}
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
                  <button onClick={() => openCopySectionModal(section.id, section.title)} className="p-1.5 rounded-lg hover:bg-violet-50" title="Copiar a otra aula">
                    <Copy className="w-4 h-4 text-violet-400" />
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
                <MaterialCard key={material.id} material={material} isTeacher={isTeacher} onToggleVis={handleToggleMaterialVis} onDelete={handleDeleteMaterial} onDuplicate={(id, title) => openDuplicateMaterialModal(id, title)} onDownload={handleDownload} onUpdateTitle={handleUpdateMaterialTitle} resolveFileUrl={resolveFileUrl} />
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

              {/* TEXT type - rich text editor */}
              {materialModal.type === 'TEXT' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contenido</label>
                  <Suspense fallback={<div className="h-40 bg-slate-50 rounded-xl animate-pulse" />}>
                    <RichTextEditor value={materialContent} onChange={setMaterialContent} placeholder="Escribe el contenido aquí..." />
                  </Suspense>
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

      {/* ── DUPLICATE MATERIAL MODAL ── */}
      {duplicateMaterialModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Duplicar recurso a otra sección</h3>
              <button onClick={() => setDuplicateMaterialModal(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-slate-600 mb-4">
                Duplicando: <span className="font-medium text-slate-800">{duplicateMaterialModal.materialTitle}</span>
              </p>
              <p className="text-xs text-slate-500 mb-3">Selecciona la sección destino:</p>
              {sections.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No hay secciones disponibles</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {sections.map((s: Section) => (
                    <button
                      key={s.id}
                      onClick={() => handleDuplicateMaterialToSection(s.id)}
                      disabled={duplicatingMaterial}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left disabled:opacity-50"
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                        <FolderOpen className="w-4 h-4 text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 truncate">{s.title}</p>
                        <p className="text-xs text-slate-500">{s.materials.length} recursos • {s.activities?.length || 0} actividades</p>
                      </div>
                      {duplicatingMaterial && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── COPY SECTION MODAL ── */}
      {copySectionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Copiar sección a otra aula</h3>
              <button onClick={() => setCopySectionModal(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-slate-600 mb-4">
                Copiando: <span className="font-medium text-slate-800">{copySectionModal.sectionTitle}</span>
              </p>
              {loadingClassrooms ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
                </div>
              ) : availableClassrooms.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No hay otras aulas disponibles</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {availableClassrooms.map((c: any) => (
                    <button
                      key={c.id}
                      onClick={() => handleCopySectionToClassroom(c.id)}
                      disabled={copyingSection}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-violet-300 hover:bg-violet-50 transition-colors text-left disabled:opacity-50"
                    >
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: c.color || '#6366f1' }}>
                        {c.title?.charAt(0) || 'A'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 truncate">{c.title}</p>
                        <p className="text-xs text-slate-500 truncate">{c.groupName} • {c.subjectName}</p>
                      </div>
                      {copyingSection && <Loader2 className="w-4 h-4 animate-spin text-violet-600" />}
                    </button>
                  ))}
                </div>
              )}
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

function MaterialCard({ material, isTeacher, onToggleVis, onDelete, onDuplicate, onDownload, onUpdateTitle, resolveFileUrl }: {
  material: Material; isTeacher: boolean;
  onToggleVis: (id: string, vis: boolean) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string, title: string) => void;
  onDownload: (m: Material) => void;
  onUpdateTitle: (id: string, title: string) => void;
  resolveFileUrl: (path: string) => Promise<string>;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [docUrl, setDocUrl] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [loadingDoc, setLoadingDoc] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState(material.title)

  // Detectar tipo de documento por extensión
  const getDocType = (url: string): 'pdf' | 'image' | 'office' | 'other' => {
    const ext = url.split('.').pop()?.toLowerCase().split('?')[0] || ''
    if (ext === 'pdf') return 'pdf'
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image'
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'office'
    return 'other'
  }

  const handlePreview = async () => {
    if (!material.fileUrl) return
    setLoadingDoc(true)
    try {
      const url = await resolveFileUrl(material.fileUrl)
      setDocUrl(url)
      setShowPreview(true)
    } catch {
      // Fallback to download
      onDownload(material)
    } finally {
      setLoadingDoc(false)
    }
  }

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
              {editingTitle ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={titleValue}
                    onChange={e => setTitleValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && titleValue.trim()) {
                        onUpdateTitle(material.id, titleValue.trim())
                        setEditingTitle(false)
                      } else if (e.key === 'Escape') {
                        setTitleValue(material.title)
                        setEditingTitle(false)
                      }
                    }}
                    className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <button onClick={() => { if (titleValue.trim()) { onUpdateTitle(material.id, titleValue.trim()); setEditingTitle(false) } }} className="p-1 text-green-600 hover:bg-green-50 rounded">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => { setTitleValue(material.title); setEditingTitle(false) }} className="p-1 text-slate-400 hover:bg-slate-100 rounded">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <h5 className="text-sm font-semibold text-slate-800">{material.title}</h5>
              )}
              <span className="text-[11px] text-slate-400">{getMaterialLabel(material.type)}</span>
            </div>
          </div>
          {isTeacher && !editingTitle && (
            <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 shrink-0 transition-opacity">
              <button onClick={() => setEditingTitle(true)} className="p-1.5 rounded-lg hover:bg-amber-50" title="Editar nombre">
                <Pencil className="w-4 h-4 text-amber-500" />
              </button>
              <button onClick={() => onDuplicate(material.id, material.title)} className="p-1.5 rounded-lg hover:bg-blue-50" title="Duplicar a otra sección">
                <Copy className="w-4 h-4 text-blue-400" />
              </button>
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
            <RichContent html={material.content} className="text-sm text-slate-600" />
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
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <button 
                onClick={handlePreview} 
                disabled={loadingDoc}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors text-sm text-blue-700 font-medium disabled:opacity-50"
              >
                {loadingDoc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                Visualizar
              </button>
              <button 
                onClick={() => onDownload(material)} 
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors text-sm text-slate-600"
              >
                <Download className="w-4 h-4" />
                Descargar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Document Preview Modal */}
      {showPreview && docUrl && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowPreview(false)}>
          <div className="bg-white rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-slate-800 truncate">{material.title}</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => onDownload(material)} className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg">
                  <Download className="w-4 h-4" /> Descargar
                </button>
                <button onClick={() => setShowPreview(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden bg-slate-100">
              {getDocType(docUrl) === 'pdf' ? (
                <iframe src={docUrl} className="w-full h-full" title={material.title} />
              ) : getDocType(docUrl) === 'image' ? (
                <div className="w-full h-full flex items-center justify-center p-4">
                  <img src={docUrl} alt={material.title} className="max-w-full max-h-full object-contain" />
                </div>
              ) : getDocType(docUrl) === 'office' ? (
                <iframe 
                  src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(docUrl)}`} 
                  className="w-full h-full" 
                  title={material.title}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-8">
                  <FileText className="w-16 h-16 text-slate-300" />
                  <p className="text-slate-500 text-center">Este tipo de archivo no se puede previsualizar.<br/>Usa el botón de descargar.</p>
                  <button onClick={() => onDownload(material)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <Download className="w-4 h-4" /> Descargar archivo
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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
  isVisible: boolean; isPublished: boolean; scheduledPublishAt?: string | null; metadata?: any;
  syncToGradebook?: boolean; gradebookComponent?: string; gradebookIndex?: number;
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
  const [form, setForm] = useState({ title: '', description: '', sectionId: '', maxScore: '5.0', dueDate: '', allowLateSubmit: false, type: 'TASK' as string, shuffleQuestions: false, showResults: true, maxAttempts: '1', timeLimitMinutes: '' })
  const [attachFile, setAttachFile] = useState<File | null>(null)
  const [creating, setCreating] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Student submit (TASK)
  const [submitContent, setSubmitContent] = useState('')
  const [submitFile, setSubmitFile] = useState<File | null>(null)
  const [submitLink, setSubmitLink] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [mySubmission, setMySubmission] = useState<any>(null)
  const submitFileRef = useRef<HTMLInputElement>(null)

  // Grading & Review Panel
  const [gradingSubmission, setGradingSubmission] = useState<Submission | null>(null)
  const [gradeScore, setGradeScore] = useState('')
  const [gradeFeedback, setGradeFeedback] = useState('')
  const [grading, setGrading] = useState(false)
  const [reviewingSubmission, setReviewingSubmission] = useState<Submission | null>(null)
  const [reviewFileUrl, setReviewFileUrl] = useState<string | null>(null)
  const [reviewFileLoading, setReviewFileLoading] = useState(false)

  // Quiz questions (teacher)
  const [questions, setQuestions] = useState<any[]>([])
  const [questionsLoading, setQuestionsLoading] = useState(false)
  const [showAddQuestion, setShowAddQuestion] = useState(false)
  const [qForm, setQForm] = useState({ type: 'MULTIPLE_CHOICE', text: '', imageUrl: '', options: ['', '', '', ''], correctAnswer: '', correctAnswers: [] as string[], blanks: [] as string[], matchPairs: [{ left: '', right: '' }] as { left: string; right: string }[], points: '1', explanation: '', subjectArea: '', contextId: '' })
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null)
  const [savingQuestion, setSavingQuestion] = useState(false)
  const questionFormRef = useRef<HTMLDivElement>(null)

  // Question Contexts
  const [contexts, setContexts] = useState<any[]>([])
  const [showContextForm, setShowContextForm] = useState(false)
  const [editingContextId, setEditingContextId] = useState<string | null>(null)
  const [ctxForm, setCtxForm] = useState({ title: '', text: '', imageUrl: '', viewPolicy: 'ALWAYS' })
  const [savingContext, setSavingContext] = useState(false)
  const [contextModalData, setContextModalData] = useState<any>(null) // for student context viewing
  const [viewedOnceContexts, setViewedOnceContexts] = useState<Set<string>>(new Set()) // track ONCE contexts already shown

  // Quiz taking (student)
  const [quizMode, setQuizMode] = useState<'idle' | 'taking' | 'result'>('idle')
  const [quizSubmission, setQuizSubmission] = useState<any>(null)
  const [quizQuestions, setQuizQuestions] = useState<any[]>([])
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({})
  const [quizMultiAnswers, setQuizMultiAnswers] = useState<Record<string, string[]>>({})
  const [quizBlankAnswers, setQuizBlankAnswers] = useState<Record<string, string[]>>({})
  const [quizOrderAnswers, setQuizOrderAnswers] = useState<Record<string, string[]>>({})
  const [quizMatchAnswers, setQuizMatchAnswers] = useState<Record<string, Record<string, string>>>({})
  const [quizShuffledRight, setQuizShuffledRight] = useState<Record<string, string[]>>({})
  const [quizCurrentIdx, setQuizCurrentIdx] = useState(0)
  const [quizSubmitting, setQuizSubmitting] = useState(false)
  const [quizResult, setQuizResult] = useState<any>(null)

  // Schedule publish
  const [showScheduleModal, setShowScheduleModal] = useState<string | null>(null)
  const [scheduleDate, setScheduleDate] = useState('')

  // Edit activity
  const [editingActivity, setEditingActivity] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', description: '', maxScore: '', dueDate: '', allowLateSubmit: false })
  const [savingEdit, setSavingEdit] = useState(false)

  // Live Quiz
  const [showLiveQuiz, setShowLiveQuiz] = useState(false)
  const [liveQuizActivityId, setLiveQuizActivityId] = useState('')
  const [liveQuizActivityTitle, setLiveQuizActivityTitle] = useState('')
  const [liveQuizInitialDeliveryMode, setLiveQuizInitialDeliveryMode] = useState<'SYNC' | 'ASYNC_HOME'>('SYNC')
  const [activeLiveSession, setActiveLiveSession] = useState<any>(null)

  // Gradebook sync
  const [gradebookConfig, setGradebookConfig] = useState<any>(null)
  const [showGradebookLink, setShowGradebookLink] = useState(false)
  const [gradebookLinkForm, setGradebookLinkForm] = useState({ syncToGradebook: false, gradebookComponent: '', gradebookIndex: 1 })
  const [savingLink, setSavingLink] = useState(false)
  const [showSyncPreview, setShowSyncPreview] = useState(false)
  const [syncPreview, setSyncPreview] = useState<any>(null)
  const [syncPreviewLoading, setSyncPreviewLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncIncludeConflicts, setSyncIncludeConflicts] = useState(false)
  const [syncIncludeNoSubmission, setSyncIncludeNoSubmission] = useState(false)

  const sections: Section[] = classroom.sections || []

  const loadActivities = useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await classroomApi.listActivities(classroom.id, isStudent ? 'student' : undefined)
      setActivities(data)
    } catch {} finally { setLoading(false) }
  }, [classroom.id, isStudent])

  useEffect(() => { loadActivities() }, [loadActivities])

  // Check for active live session (student AND teacher for async home)
  useEffect(() => {
    liveSessionApi.getActive(classroom.id).then(({ data }) => {
      if (data && data.id) setActiveLiveSession(data)
    }).catch(() => {})
  }, [classroom.id])

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
        sectionId: form.sectionId, type: form.type, title: form.title,
        description: form.description || undefined,
        maxScore: parseFloat(form.maxScore) || 5.0,
        dueDate: form.dueDate || undefined,
        allowLateSubmit: form.allowLateSubmit,
        attachmentUrl, attachmentName,
        shuffleQuestions: form.shuffleQuestions,
        showResults: form.showResults,
        maxAttempts: parseInt(form.maxAttempts) || 1,
        timeLimitMinutes: form.timeLimitMinutes ? parseInt(form.timeLimitMinutes) : undefined,
      } as any)
      setForm({ title: '', description: '', sectionId: '', maxScore: '5.0', dueDate: '', allowLateSubmit: false, type: 'TASK', shuffleQuestions: false, showResults: true, maxAttempts: '1', timeLimitMinutes: '' })
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
      if (selectedActivity && selectedActivity.id === id) {
        setSelectedActivity({ ...selectedActivity, isPublished: !published, isVisible: true, scheduledPublishAt: null })
      }
      setActivities(prev => prev.map(a => a.id === id ? { ...a, isPublished: !published, isVisible: true, scheduledPublishAt: null } : a))
      loadActivities()
    } catch {}
  }

  const handleSchedulePublish = async (id: string, dateTime: string) => {
    try {
      // datetime-local gives local time string, convert to full ISO with timezone
      const isoDate = new Date(dateTime).toISOString()
      await classroomApi.publishActivity(id, { scheduledPublishAt: isoDate })
      if (selectedActivity && selectedActivity.id === id) {
        setSelectedActivity({ ...selectedActivity, scheduledPublishAt: dateTime, isPublished: false })
      }
      setActivities(prev => prev.map(a => a.id === id ? { ...a, scheduledPublishAt: dateTime, isPublished: false } : a))
      setScheduleDate('')
      setShowScheduleModal(null)
      loadActivities()
    } catch {}
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta actividad?')) return
    try {
      const { data } = await classroomApi.deleteActivity(id)
      if (data.requiresConfirmation) {
        if (!confirm(`⚠️ ${data.message}\n\nEsta acción NO se puede deshacer.`)) return
        await classroomApi.deleteActivity(id, true)
      }
      loadActivities(); setSelectedActivity(null)
    } catch {}
  }

  const startEditActivity = (act: Activity) => {
    setEditForm({
      title: act.title,
      description: act.description || '',
      maxScore: act.maxScore ? String(Number(act.maxScore)) : '5',
      dueDate: act.dueDate ? new Date(act.dueDate).toISOString().slice(0, 16) : '',
      allowLateSubmit: act.allowLateSubmit || false,
    })
    setEditingActivity(true)
  }

  const handleSaveEdit = async () => {
    if (!selectedActivity || !editForm.title.trim()) return
    setSavingEdit(true)
    try {
      await classroomApi.updateActivity(selectedActivity.id, {
        title: editForm.title,
        description: editForm.description || undefined,
        maxScore: parseFloat(editForm.maxScore) || 5,
        dueDate: editForm.dueDate || undefined,
        allowLateSubmit: editForm.allowLateSubmit,
      })
      setEditingActivity(false)
      // Refresh activity detail
      const { data } = await classroomApi.getActivity(selectedActivity.id)
      setSelectedActivity(data)
      loadActivities()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al actualizar actividad')
    } finally { setSavingEdit(false) }
  }

  // Gradebook sync handlers
  const loadGradebookConfig = async () => {
    try {
      const { data } = await classroomApi.getGradebookConfig(classroom.id)
      setGradebookConfig(data)
    } catch {}
  }

  const openGradebookLink = async (act: Activity) => {
    await loadGradebookConfig()
    setGradebookLinkForm({
      syncToGradebook: act.syncToGradebook || false,
      gradebookComponent: act.gradebookComponent || '',
      gradebookIndex: act.gradebookIndex || 1,
    })
    setShowGradebookLink(true)
  }

  const handleSaveGradebookLink = async () => {
    if (!selectedActivity) return
    setSavingLink(true)
    try {
      await classroomApi.updateGradebookLink(selectedActivity.id, gradebookLinkForm)
      const { data } = await classroomApi.getActivity(selectedActivity.id)
      setSelectedActivity(data)
      setShowGradebookLink(false)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al vincular')
    } finally { setSavingLink(false) }
  }

  const openSyncPreview = async () => {
    if (!selectedActivity) return
    setSyncPreviewLoading(true)
    setShowSyncPreview(true)
    setSyncIncludeConflicts(false)
    setSyncIncludeNoSubmission(false)
    try {
      const { data } = await classroomApi.previewGradebookSync(selectedActivity.id)
      setSyncPreview(data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al cargar preview')
      setShowSyncPreview(false)
    } finally { setSyncPreviewLoading(false) }
  }

  const handleSync = async () => {
    if (!selectedActivity || !syncPreview) return
    setSyncing(true)
    try {
      const { data } = await classroomApi.syncToGradebook(selectedActivity.id, {
        includeConflicts: syncIncludeConflicts,
        includeNoSubmission: syncIncludeNoSubmission,
      })
      setShowSyncPreview(false)
      alert(`✅ Sincronización completada:\n• ${data.synced} notas escritas\n• ${data.skipped} omitidas\n${data.errors?.length ? '• ' + data.errors.length + ' errores' : ''}`)
      // Refresh activity
      const res = await classroomApi.getActivity(selectedActivity.id)
      setSelectedActivity(res.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al sincronizar')
    } finally { setSyncing(false) }
  }

  const openDuplicateActivityModal = async (activityId: string, activityTitle: string) => {
    setDuplicateActivityModal({ activityId, activityTitle })
    setDuplicateTargetType('same')
    setSelectedTargetClassroom(null)
    setTargetClassroomSections([])
    // Load other classrooms
    setLoadingClassroomsForDup(true)
    try {
      const res = await classroomApi.listClassroomsForCopy(classroom.id)
      setAvailableClassroomsForDup(res.data || [])
    } catch {
      setAvailableClassroomsForDup([])
    } finally {
      setLoadingClassroomsForDup(false)
    }
  }

  const handleSelectTargetClassroom = async (c: any) => {
    setSelectedTargetClassroom(c)
    setLoadingTargetSections(true)
    try {
      const res = await classroomApi.getById(c.id)
      setTargetClassroomSections(res.data.sections || [])
    } catch {
      setTargetClassroomSections([])
    } finally {
      setLoadingTargetSections(false)
    }
  }

  const handleDuplicateActivityToSection = async (targetSectionId: string) => {
    if (!duplicateActivityModal) return
    setDuplicatingActivity(true)
    try {
      await classroomApi.duplicateActivity(duplicateActivityModal.activityId, targetSectionId)
      setDuplicateActivityModal(null)
      loadActivities()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al duplicar actividad')
    } finally {
      setDuplicatingActivity(false)
    }
  }

  const openAssignStudentsModal = async (activityId: string, activityTitle: string) => {
    setAssignStudentsModal({ activityId, activityTitle })
    setSelectedStudentIds([])
    setIsRestrictedToAssigned(false)
    setLoadingStudents(true)
    try {
      // Load classroom students
      const studentsRes = await classroomApi.getStudentsForAssignment(classroom.id)
      setClassroomStudents(studentsRes.data || [])
      // Load existing assignments
      const assignmentsRes = await classroomApi.getActivityAssignments(activityId)
      const assignedIds = (assignmentsRes.data || []).map((a: any) => a.studentEnrollment.id)
      setSelectedStudentIds(assignedIds)
      // Check if activity is restricted
      const activityRes = await classroomApi.getActivity(activityId)
      setIsRestrictedToAssigned(activityRes.data?.isRestrictedToAssigned || false)
    } catch {
      setClassroomStudents([])
    } finally {
      setLoadingStudents(false)
    }
  }

  const handleSaveAssignments = async () => {
    if (!assignStudentsModal) return
    setSavingAssignments(true)
    try {
      await classroomApi.assignStudentsToActivity(assignStudentsModal.activityId, {
        studentEnrollmentIds: selectedStudentIds,
        isRestrictedToAssigned,
      })
      setAssignStudentsModal(null)
      loadActivities()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al asignar estudiantes')
    } finally {
      setSavingAssignments(false)
    }
  }

  const toggleStudentSelection = (enrollmentId: string) => {
    setSelectedStudentIds(prev => 
      prev.includes(enrollmentId) 
        ? prev.filter(id => id !== enrollmentId)
        : [...prev, enrollmentId]
    )
  }

  const isQuizType = (type: string) => ['QUIZ', 'EXAM', 'ICFES_SIMULATOR'].includes(type)
  const isIcfes = (type: string) => type === 'ICFES_SIMULATOR'
  const isSelfAssessment = (type: string) => type === 'SELF_ASSESSMENT'

  const ICFES_AREAS = ['Lectura Crítica', 'Matemáticas', 'Ciencias Naturales', 'Sociales y Ciudadanas', 'Inglés']
  const AREA_COLORS: Record<string, string> = {
    'Lectura Crítica': 'bg-blue-500', 'Matemáticas': 'bg-red-500', 'Ciencias Naturales': 'bg-green-500',
    'Sociales y Ciudadanas': 'bg-amber-500', 'Inglés': 'bg-purple-500', 'General': 'bg-slate-500',
  }

  // ICFES results state
  const [icfesResult, setIcfesResult] = useState<any>(null)
  const [icfesClassResults, setIcfesClassResults] = useState<any[]>([])
  const [icfesLoading, setIcfesLoading] = useState(false)

  // Duplicate activity modal
  const [duplicateActivityModal, setDuplicateActivityModal] = useState<{ activityId: string; activityTitle: string } | null>(null)
  const [duplicateTargetType, setDuplicateTargetType] = useState<'same' | 'other'>('same')
  const [availableClassroomsForDup, setAvailableClassroomsForDup] = useState<any[]>([])
  const [selectedTargetClassroom, setSelectedTargetClassroom] = useState<any>(null)
  const [targetClassroomSections, setTargetClassroomSections] = useState<Section[]>([])
  const [loadingClassroomsForDup, setLoadingClassroomsForDup] = useState(false)
  const [loadingTargetSections, setLoadingTargetSections] = useState(false)
  const [duplicatingActivity, setDuplicatingActivity] = useState(false)

  // Assign students modal
  const [assignStudentsModal, setAssignStudentsModal] = useState<{ activityId: string; activityTitle: string } | null>(null)
  const [classroomStudents, setClassroomStudents] = useState<any[]>([])
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [isRestrictedToAssigned, setIsRestrictedToAssigned] = useState(false)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [savingAssignments, setSavingAssignments] = useState(false)

  const loadQuestions = async (activityId: string) => {
    setQuestionsLoading(true)
    try {
      const [qRes, cRes] = await Promise.all([
        classroomApi.listQuestions(activityId),
        classroomApi.listContexts(activityId),
      ])
      setQuestions(qRes.data)
      setContexts(cRes.data)
    } catch {} finally { setQuestionsLoading(false) }
  }

  const openActivity = async (activity: Activity) => {
    setSelectedActivity(activity)
    setQuizMode('idle')
    setQuizResult(null)
    if (isTeacher) {
      setSubmissionsLoading(true)
      try {
        const { data } = await classroomApi.listSubmissions(activity.id)
        setSubmissions(data)
      } catch {} finally { setSubmissionsLoading(false) }
      if (isQuizType(activity.type)) {
        loadQuestions(activity.id)
        if (isIcfes(activity.type)) loadIcfesClassResults(activity.id)
      }
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
      // Combinar contenido con enlace si existe
      const fullContent = submitLink 
        ? (submitContent ? `${submitContent}\n\n📎 Enlace: ${submitLink}` : `📎 Enlace: ${submitLink}`)
        : submitContent || undefined
      await classroomApi.submitTask(selectedActivity.id, { content: fullContent, fileUrl })
      setSubmitContent('')
      setSubmitFile(null)
      setSubmitLink('')
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

  const handleDeleteSubmission = async (sub: Submission) => {
    const studentName = sub.studentEnrollment?.student
      ? `${sub.studentEnrollment.student.firstName} ${sub.studentEnrollment.student.lastName}`
      : 'este estudiante'
    if (!confirm(`¿Eliminar el intento de ${studentName}?\n\nEsto permitirá al estudiante volver a intentar la actividad.`)) return
    try {
      await classroomApi.deleteSubmission(sub.id)
      // Reload submissions
      const { data } = await classroomApi.listSubmissions(selectedActivity!.id)
      setSubmissions(data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al eliminar intento')
    }
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

  // Review panel helpers
  const openReviewPanel = async (sub: Submission) => {
    setReviewingSubmission(sub)
    setGradeScore(sub.score !== undefined && sub.score !== null ? String(Number(sub.score)) : '')
    setGradeFeedback(sub.feedback || '')
    setReviewFileUrl(null)
    if (sub.fileUrl) {
      setReviewFileLoading(true)
      try {
        const { data } = await storageApi.resolveUrl(sub.fileUrl)
        setReviewFileUrl(data.url)
      } catch { setReviewFileUrl(sub.fileUrl) }
      finally { setReviewFileLoading(false) }
    }
  }

  const navigateReview = async (dir: -1 | 1) => {
    if (!reviewingSubmission) return
    const idx = submissions.findIndex(s => s.id === reviewingSubmission.id)
    const next = submissions[idx + dir]
    if (next) openReviewPanel(next)
  }

  const handleReviewGrade = async () => {
    if (!reviewingSubmission || !gradeScore) return
    try {
      setGrading(true)
      await classroomApi.gradeSubmission(reviewingSubmission.id, { score: parseFloat(gradeScore), feedback: gradeFeedback || undefined })
      // Move to next ungraded or stay
      const idx = submissions.findIndex(s => s.id === reviewingSubmission.id)
      const nextUngraded = submissions.slice(idx + 1).find(s => s.status === 'SUBMITTED' || s.status === 'LATE')
      if (selectedActivity) {
        const { data } = await classroomApi.listSubmissions(selectedActivity.id)
        setSubmissions(data)
        if (nextUngraded) {
          const refreshed = data.find((s: Submission) => s.id === nextUngraded.id)
          if (refreshed) openReviewPanel(refreshed)
          else setReviewingSubmission(null)
        } else {
          setReviewingSubmission(null)
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al calificar')
    } finally { setGrading(false) }
  }

  const getFilePreviewType = (url: string): 'image' | 'pdf' | 'office' | 'unknown' => {
    const lower = url.toLowerCase()
    if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)/.test(lower)) return 'image'
    if (/\.pdf/.test(lower)) return 'pdf'
    if (/\.(doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp)/.test(lower)) return 'office'
    return 'unknown'
  }

  // Keyboard navigation for review panel
  useEffect(() => {
    if (!reviewingSubmission) return
    const handler = (e: KeyboardEvent) => {
      // Don't navigate if user is typing in input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft') navigateReview(-1)
      if (e.key === 'ArrowRight') navigateReview(1)
      if (e.key === 'Escape') setReviewingSubmission(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [reviewingSubmission, submissions])

  // Quiz question handlers (teacher)
  const resetQForm = () => setQForm({ type: 'MULTIPLE_CHOICE', text: '', imageUrl: '', options: ['', '', '', ''], correctAnswer: '', correctAnswers: [], blanks: [], matchPairs: [{ left: '', right: '' }], points: '1', explanation: '', subjectArea: '', contextId: '' })

  // Context handlers (teacher)
  const resetCtxForm = () => { setCtxForm({ title: '', text: '', imageUrl: '', viewPolicy: 'ALWAYS' }); setEditingContextId(null); setShowContextForm(false) }

  const handleSaveContext = async () => {
    if (!selectedActivity) return
    setSavingContext(true)
    try {
      if (editingContextId) {
        await classroomApi.updateContext(editingContextId, ctxForm)
      } else {
        await classroomApi.createContext(selectedActivity.id, ctxForm)
      }
      resetCtxForm()
      loadQuestions(selectedActivity.id)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al guardar contexto')
    } finally { setSavingContext(false) }
  }

  const handleDeleteContext = async (ctxId: string) => {
    if (!confirm('¿Eliminar este contexto? Las preguntas asociadas se desvinculan pero no se eliminan.')) return
    try {
      await classroomApi.deleteContext(ctxId)
      if (selectedActivity) loadQuestions(selectedActivity.id)
    } catch {}
  }

  const startEditContext = (ctx: any) => {
    setCtxForm({ title: ctx.title || '', text: ctx.text || '', imageUrl: ctx.imageUrl || '', viewPolicy: ctx.viewPolicy || 'ALWAYS' })
    setEditingContextId(ctx.id)
    setShowContextForm(true)
  }

  const handleAddQuestion = async () => {
    if (!selectedActivity || !qForm.text.trim()) return
    try {
      setSavingQuestion(true)
      const payload: any = { type: qForm.type, text: qForm.text, imageUrl: qForm.imageUrl || undefined, points: parseFloat(qForm.points) || 1, explanation: qForm.explanation || undefined, subjectArea: qForm.subjectArea || undefined, contextId: qForm.contextId || undefined }
      if (qForm.type === 'MULTIPLE_CHOICE' || qForm.type === 'TRUE_FALSE') {
        payload.options = qForm.type === 'TRUE_FALSE' ? ['Verdadero', 'Falso'] : qForm.options.filter(o => o.trim())
        payload.correctAnswer = qForm.correctAnswer
      } else if (qForm.type === 'MULTIPLE_SELECT') {
        payload.options = qForm.options.filter(o => o.trim())
        payload.correctAnswer = JSON.stringify(qForm.correctAnswers)
      } else if (qForm.type === 'SHORT_ANSWER') {
        payload.correctAnswer = qForm.correctAnswer
      } else if (qForm.type === 'FILL_BLANK') {
        payload.correctAnswer = JSON.stringify(qForm.blanks.filter(b => b.trim()))
      } else if (qForm.type === 'ORDERING') {
        payload.options = qForm.options.filter(o => o.trim())
      } else if (qForm.type === 'MATCHING') {
        const validPairs = qForm.matchPairs.filter(p => p.left.trim() && p.right.trim())
        const leftItems = validPairs.map(p => p.left)
        const rightItems = [...new Set(validPairs.map(p => p.right))]
        const pairs: Record<string, string> = {}
        validPairs.forEach(p => { pairs[p.left] = p.right })
        // options = { left: [...], right: [...] } para mostrar al estudiante
        payload.options = { left: leftItems, right: rightItems }
        payload.correctAnswer = JSON.stringify(pairs)
      }
      if (editingQuestion) {
        await classroomApi.updateQuestion(editingQuestion, payload)
        setEditingQuestion(null)
      } else {
        await classroomApi.addQuestion(selectedActivity.id, payload)
      }
      resetQForm()
      setShowAddQuestion(false)
      loadQuestions(selectedActivity.id)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al guardar pregunta')
    } finally { setSavingQuestion(false) }
  }

  const handleDeleteQuestion = async (qId: string) => {
    if (!confirm('¿Eliminar esta pregunta?')) return
    try {
      await classroomApi.deleteQuestion(qId)
      if (selectedActivity) loadQuestions(selectedActivity.id)
    } catch {}
  }

  const startEditQuestion = (q: any) => {
    let correctAnswers: string[] = []
    let blanks: string[] = []
    let matchPairs: { left: string; right: string }[] = [{ left: '', right: '' }]
    if (q.type === 'MULTIPLE_SELECT' && q.correctAnswer) {
      try { correctAnswers = JSON.parse(q.correctAnswer) } catch { correctAnswers = [] }
    }
    if (q.type === 'FILL_BLANK' && q.correctAnswer) {
      try { blanks = JSON.parse(q.correctAnswer) } catch { blanks = [] }
    }
    if (q.type === 'MATCHING' && q.correctAnswer) {
      try { 
        const pairs = JSON.parse(q.correctAnswer) as Record<string, string>
        matchPairs = Object.entries(pairs).map(([left, right]) => ({ left, right }))
        if (matchPairs.length === 0) matchPairs = [{ left: '', right: '' }]
      } catch { matchPairs = [{ left: '', right: '' }] }
    }
    setQForm({
      type: q.type,
      text: q.text,
      imageUrl: q.imageUrl || '',
      options: q.type === 'TRUE_FALSE' ? ['Verdadero', 'Falso'] : (q.options || ['', '', '', '']),
      correctAnswer: q.correctAnswer || '',
      correctAnswers,
      blanks,
      matchPairs,
      points: String(q.points ? Number(q.points) : 1),
      explanation: q.explanation || '',
      subjectArea: q.subjectArea || '',
      contextId: q.contextId || '',
    })
    setEditingQuestion(q.id)
    setShowAddQuestion(true)
    // Scroll al formulario después de que se renderice
    setTimeout(() => {
      questionFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  // Quiz taking handlers (student)
  const handleStartQuiz = async () => {
    if (!selectedActivity) return
    try {
      setQuizSubmitting(true)
      const { data } = await classroomApi.startQuiz(selectedActivity.id)
      setQuizSubmission(data.submission)
      setQuizQuestions(data.questions)
      // Pre-shuffle right-side items for MATCHING questions (once, stable)
      const shuffled: Record<string, string[]> = {}
      for (const q of data.questions) {
        if (q.type === 'MATCHING') {
          let rightItems: string[] = []
          if (q.options && typeof q.options === 'object' && 'left' in q.options) {
            rightItems = (q.options as any).right || []
          } else if (q.correctAnswer) {
            try { rightItems = [...new Set(Object.values(JSON.parse(q.correctAnswer)) as string[])] } catch {}
          }
          // Fisher-Yates shuffle
          const arr = [...rightItems]
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]]
          }
          shuffled[q.id] = arr
        }
      }
      setQuizShuffledRight(shuffled)
      const existing: Record<string, string> = {}
      ;(data.answers || []).forEach((a: any) => { if (a.answer) existing[a.questionId] = a.answer })
      setQuizAnswers(existing)
      setQuizCurrentIdx(0)
      setQuizMode('taking')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al iniciar quiz')
    } finally { setQuizSubmitting(false) }
  }

  const handleQuizAnswer = async (questionId: string, answer: string) => {
    setQuizAnswers(prev => ({ ...prev, [questionId]: answer }))
    if (quizSubmission) {
      try { await classroomApi.saveQuizAnswer(quizSubmission.id, { questionId, answer }) } catch {}
    }
  }

  const handleQuizMultiAnswer = async (questionId: string, option: string) => {
    const current = quizMultiAnswers[questionId] || []
    const newAnswers = current.includes(option) 
      ? current.filter(a => a !== option)
      : [...current, option]
    setQuizMultiAnswers(prev => ({ ...prev, [questionId]: newAnswers }))
    if (quizSubmission) {
      try { await classroomApi.saveQuizAnswer(quizSubmission.id, { questionId, selectedOptions: newAnswers }) } catch {}
    }
  }

  const handleQuizBlankAnswer = async (questionId: string, blankIdx: number, value: string) => {
    const current = quizBlankAnswers[questionId] || []
    const newBlanks = [...current]
    newBlanks[blankIdx] = value
    setQuizBlankAnswers(prev => ({ ...prev, [questionId]: newBlanks }))
    if (quizSubmission) {
      try { await classroomApi.saveQuizAnswer(quizSubmission.id, { questionId, answer: JSON.stringify(newBlanks) }) } catch {}
    }
  }

  const handleQuizOrderMove = async (questionId: string, fromIdx: number, toIdx: number) => {
    const current = quizOrderAnswers[questionId] || []
    const newOrder = [...current]
    const [moved] = newOrder.splice(fromIdx, 1)
    newOrder.splice(toIdx, 0, moved)
    setQuizOrderAnswers(prev => ({ ...prev, [questionId]: newOrder }))
    if (quizSubmission) {
      try { await classroomApi.saveQuizAnswer(quizSubmission.id, { questionId, answer: JSON.stringify(newOrder) }) } catch {}
    }
  }

  const initOrderAnswer = (questionId: string, options: string[]) => {
    if (!quizOrderAnswers[questionId]) {
      // Shuffle options for student
      const shuffled = [...options].sort(() => Math.random() - 0.5)
      setQuizOrderAnswers(prev => ({ ...prev, [questionId]: shuffled }))
    }
  }

  const handleQuizMatchAnswer = async (questionId: string, leftItem: string, rightItem: string) => {
    const current = quizMatchAnswers[questionId] || {}
    const newMatches = { ...current, [leftItem]: rightItem }
    setQuizMatchAnswers(prev => ({ ...prev, [questionId]: newMatches }))
    if (quizSubmission) {
      try { await classroomApi.saveQuizAnswer(quizSubmission.id, { questionId, answer: JSON.stringify(newMatches) }) } catch {}
    }
  }

  const handleSubmitQuiz = async () => {
    if (!quizSubmission || !confirm('¿Enviar el quiz? No podrás cambiar tus respuestas.')) return
    try {
      setQuizSubmitting(true)
      const { data } = await classroomApi.submitQuiz(quizSubmission.id)
      setQuizResult(data)
      setQuizMode('result')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al enviar quiz')
    } finally { setQuizSubmitting(false) }
  }

  const handleViewResult = async (submissionId: string) => {
    try {
      const { data } = await classroomApi.getQuizResult(submissionId)
      setQuizResult(data)
      setQuizMode('result')
    } catch {}
  }

  const handleViewIcfesResult = async (submissionId: string) => {
    try {
      setIcfesLoading(true)
      const { data } = await classroomApi.getIcfesResult(submissionId)
      setIcfesResult(data)
      setQuizMode('result')
    } catch {} finally { setIcfesLoading(false) }
  }

  const loadIcfesClassResults = async (activityId: string) => {
    try {
      setIcfesLoading(true)
      const { data } = await classroomApi.getIcfesClassroomResults(activityId)
      setIcfesClassResults(data)
    } catch {} finally { setIcfesLoading(false) }
  }

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
  const isDuePast = (d?: string) => d ? new Date(d) < new Date() : false
  // Convert Date to local datetime-local input value (YYYY-MM-DDTHH:MM)
  const toLocalDatetimeStr = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

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
          {editingActivity ? (
            /* ── INLINE EDIT FORM ── */
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800 text-lg">Editar actividad</h3>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
                <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                <Suspense fallback={<div className="h-32 bg-slate-50 rounded-xl animate-pulse" />}>
                  <RichTextEditor value={editForm.description} onChange={v => setEditForm(f => ({ ...f, description: v }))} placeholder="Descripción e instrucciones..." />
                </Suspense>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nota máxima</label>
                  <input type="number" step="0.1" min="0" value={editForm.maxScore} onChange={e => setEditForm(f => ({ ...f, maxScore: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha límite</label>
                  <input type="datetime-local" value={editForm.dueDate} onChange={e => setEditForm(f => ({ ...f, dueDate: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={editForm.allowLateSubmit} onChange={e => setEditForm(f => ({ ...f, allowLateSubmit: e.target.checked }))} className="w-4 h-4 rounded text-blue-600" />
                Permitir entrega tardía
              </label>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSaveEdit} disabled={savingEdit} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                  {savingEdit && <Loader2 className="w-4 h-4 animate-spin" />} Guardar cambios
                </button>
                <button onClick={() => setEditingActivity(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            /* ── DISPLAY MODE ── */
            <>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-3 mb-2">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isSelfAssessment(act.type) ? 'bg-teal-50' : isIcfes(act.type) ? 'bg-emerald-50' : isQuizType(act.type) ? 'bg-purple-50' : 'bg-blue-50'}`}>
                      {isSelfAssessment(act.type) ? <Sparkles className="w-5 h-5 text-teal-600" /> : isIcfes(act.type) ? <BarChart3 className="w-5 h-5 text-emerald-600" /> : isQuizType(act.type) ? <HelpCircle className="w-5 h-5 text-purple-600" /> : <ClipboardList className="w-5 h-5 text-blue-600" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg sm:text-xl font-bold text-slate-800 break-words">{act.title}</h2>
                        {isSelfAssessment(act.type) && <span className="text-xs px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full font-medium whitespace-nowrap">Autoevaluación</span>}
                        {isIcfes(act.type) && <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium whitespace-nowrap">Simulacro ICFES</span>}
                        {isQuizType(act.type) && !isIcfes(act.type) && <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">{act.type === 'QUIZ' ? 'Quiz' : 'Examen'}</span>}
                      </div>
                      <p className="text-sm text-slate-400">{act.section?.title || 'Sin sección'}</p>
                    </div>
                  </div>
                  {act.description && <RichContent html={act.description} className="mt-3 text-sm sm:text-base text-slate-600" />}
                  {meta?.attachmentUrl && (
                    <button onClick={() => openFile(meta.attachmentUrl)} className="flex items-center gap-3 mt-4 px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors group w-full sm:w-auto">
                      <File className="w-5 h-5 text-blue-500 shrink-0" />
                      <span className="text-sm sm:text-base text-slate-700 group-hover:text-blue-600 truncate">{meta.attachmentName || 'Archivo adjunto'}</span>
                      <Download className="w-4 h-4 text-slate-400 ml-auto shrink-0" />
                    </button>
                  )}
                </div>
                {isTeacher && (
                  <div className="flex flex-wrap gap-1 shrink-0">
                    <button onClick={() => handlePublish(act.id, act.isPublished)} className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium ${act.isPublished ? 'bg-orange-50 text-orange-600 hover:bg-orange-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                      {act.isPublished ? 'Despublicar' : 'Publicar'}
                    </button>
                    {!act.isPublished && (
                      <button onClick={() => { setShowScheduleModal(act.id); setScheduleDate(act.scheduledPublishAt ? toLocalDatetimeStr(new Date(act.scheduledPublishAt)) : '') }} className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium ${act.scheduledPublishAt ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`} title="Programar publicación">
                        <Clock className="w-4 h-4 inline mr-1" />{act.scheduledPublishAt ? new Date(act.scheduledPublishAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Programar'}
                      </button>
                    )}
                    <button onClick={() => startEditActivity(act)} className="p-2 sm:p-2.5 rounded-xl hover:bg-amber-50" title="Editar actividad">
                      <Pencil className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                    </button>
                    <button onClick={() => openAssignStudentsModal(act.id, act.title)} className="p-2 sm:p-2.5 rounded-xl hover:bg-violet-50" title="Asignar estudiantes">
                      <Users className="w-4 h-4 sm:w-5 sm:h-5 text-violet-400" />
                    </button>
                    <button onClick={() => openDuplicateActivityModal(act.id, act.title)} className="p-2 sm:p-2.5 rounded-xl hover:bg-blue-50" title="Duplicar actividad">
                      <Copy className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                    </button>
                    <button onClick={() => handleDelete(act.id)} className="p-2 sm:p-2.5 rounded-xl hover:bg-red-50">
                      <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
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

              {/* Gradebook sync status (teacher only) */}
              {isTeacher && (
                <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                  {act.syncToGradebook ? (
                    <>
                      <span className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 flex items-center gap-1">
                        <BarChart3 className="w-3 h-3" /> Vinculada: {act.gradebookComponent} #{act.gradebookIndex}
                      </span>
                      <button onClick={openSyncPreview} className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" /> Sincronizar con planilla
                      </button>
                      <button onClick={() => openGradebookLink(act)} className="text-xs px-2.5 py-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                        Cambiar destino
                      </button>
                    </>
                  ) : (
                    <button onClick={() => openGradebookLink(act)} className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg font-medium flex items-center gap-1">
                      <BarChart3 className="w-3 h-3" /> Vincular a planilla
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* TEACHER: Submissions list (not for self-assessment, handled by SelfAssessmentResults) */}
        {isTeacher && !isSelfAssessment(act.type) && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Entregas ({submissions.length})</h3>
              {submissions.filter(s => s.status === 'SUBMITTED' || s.status === 'LATE').length > 0 && (
                <span className="text-xs px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full font-medium">
                  {submissions.filter(s => s.status === 'SUBMITTED' || s.status === 'LATE').length} pendientes
                </span>
              )}
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
                    <div key={sub.id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 sm:px-6 py-4 hover:bg-slate-50 cursor-pointer group" onClick={() => openReviewPanel(sub)}>
                      {st?.photo ? (
                        <img src={st.photo} alt={name} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-sm font-bold text-blue-700">{initials}</div>
                      )}
                      <div className="flex-1 min-w-0 flex items-center gap-3">
                        <div className="flex-1">
                          <p className="text-sm sm:text-base font-medium text-slate-800">{name}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-xs sm:text-sm text-slate-400">{formatDate(sub.submittedAt)}</p>
                            {sub.fileUrl && <Paperclip className="w-3 h-3 text-slate-400" />}
                            {sub.content && sub.content.match(/https?:\/\/[^\s]+/) && <Link2 className="w-3 h-3 text-slate-400" />}
                          </div>
                        </div>
                        <span className={`text-xs px-2 sm:px-2.5 py-1 rounded-full font-medium ${statusInfo.bg} ${statusInfo.text}`}>{statusInfo.label}</span>
                        {sub.score !== undefined && sub.score !== null && (
                          <span className="text-sm sm:text-base font-bold text-slate-800">{Number(sub.score)}/{act.maxScore ? Number(act.maxScore) : '?'}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-auto sm:ml-0" onClick={e => e.stopPropagation()}>
                        <button onClick={() => openReviewPanel(sub)} className="px-2 sm:px-3 py-2 bg-blue-50 text-blue-700 rounded-xl text-xs sm:text-sm font-medium hover:bg-blue-100 flex items-center gap-1" style={{ minHeight: '40px' }}>
                          <Eye className="w-4 h-4" /> Revisar
                        </button>
                        {sub.fileUrl && (
                          <button onClick={() => openFile(sub.fileUrl!)} className="p-2 rounded-xl hover:bg-slate-100" title="Descargar archivo">
                            <Download className="w-4 h-4 text-slate-500" />
                          </button>
                        )}
                        <button onClick={() => handleReturn(sub)} className="p-2 rounded-xl hover:bg-orange-50" title="Devolver">
                          <RotateCcw className="w-4 h-4 text-orange-500" />
                        </button>
                        <button onClick={() => handleDeleteSubmission(sub)} className="p-2 rounded-xl hover:bg-red-50" title="Eliminar intento">
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* TEACHER: Fullscreen Review & Grading Panel */}
        {reviewingSubmission && (() => {
          const revSt = reviewingSubmission.studentEnrollment?.student
          const revName = revSt ? `${revSt.firstName} ${revSt.lastName}${revSt.secondLastName ? ' ' + revSt.secondLastName : ''}` : 'Estudiante'
          const revInitials = revSt ? `${revSt.firstName?.[0] || ''}${revSt.lastName?.[0] || ''}` : '?'
          const revStatusInfo = STATUS_COLORS[reviewingSubmission.status] || STATUS_COLORS.DRAFT
          const revIdx = submissions.findIndex(s => s.id === reviewingSubmission.id)
          const hasPrev = revIdx > 0
          const hasNext = revIdx < submissions.length - 1
          const pendingCount = submissions.filter(s => s.status === 'SUBMITTED' || s.status === 'LATE').length
          const fileType = reviewFileUrl ? getFilePreviewType(reviewFileUrl) : null

          return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col">
              {/* Header */}
              <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <button onClick={() => setReviewingSubmission(null)} className="p-2 rounded-xl hover:bg-slate-100">
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                  {revSt?.photo ? (
                    <img src={revSt.photo} alt={revName} className="w-9 h-9 rounded-full object-cover border border-slate-200" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-sm font-bold text-blue-700">{revInitials}</div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{revName}</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${revStatusInfo.bg} ${revStatusInfo.text}`}>{revStatusInfo.label}</span>
                      <span className="text-xs text-slate-400">{formatDate(reviewingSubmission.submittedAt)}</span>
                      {reviewingSubmission.score !== undefined && reviewingSubmission.score !== null && (
                        <span className="text-xs font-bold text-slate-700">{Number(reviewingSubmission.score)}/{act.maxScore ? Number(act.maxScore) : '?'}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {pendingCount > 0 && (
                    <span className="text-xs px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full font-medium hidden sm:inline-flex">
                      {pendingCount} pendientes
                    </span>
                  )}
                  <span className="text-xs text-slate-400">{revIdx + 1} / {submissions.length}</span>
                  <button onClick={() => navigateReview(-1)} disabled={!hasPrev} className="p-2 rounded-xl hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed" title="Anterior">
                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                  </button>
                  <button onClick={() => navigateReview(1)} disabled={!hasNext} className="p-2 rounded-xl hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed" title="Siguiente">
                    <ChevronRight className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
              </div>

              {/* Body: Split view */}
              <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* Left: File preview / Content */}
                <div className="flex-1 bg-slate-100 overflow-auto min-h-0">
                  {reviewFileLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    </div>
                  ) : reviewFileUrl ? (
                    <div className="h-full flex flex-col">
                      {/* File preview toolbar */}
                      <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                          <File className="w-4 h-4 text-slate-400" />
                          <span className="text-xs text-slate-600 font-medium truncate max-w-[200px]">
                            {reviewingSubmission.fileUrl?.split('/').pop() || 'Archivo adjunto'}
                          </span>
                          {fileType === 'image' && <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full">Imagen</span>}
                          {fileType === 'pdf' && <span className="text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded-full">PDF</span>}
                          {fileType === 'office' && <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">Documento</span>}
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => window.open(reviewFileUrl, '_blank')} className="px-3 py-1.5 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> Abrir
                          </button>
                          <a href={reviewFileUrl} download className="px-3 py-1.5 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 flex items-center gap-1">
                            <Download className="w-3 h-3" /> Descargar
                          </a>
                        </div>
                      </div>
                      {/* File preview area */}
                      <div className="flex-1 overflow-auto">
                        {fileType === 'image' && (
                          <div className="flex items-center justify-center h-full p-4 bg-slate-900/5">
                            <img src={reviewFileUrl} alt="Entrega" className="max-w-full max-h-full object-contain rounded-lg shadow-lg" />
                          </div>
                        )}
                        {fileType === 'pdf' && (
                          <iframe src={reviewFileUrl} className="w-full h-full border-0" title="Preview PDF" />
                        )}
                        {fileType === 'office' && (
                          <iframe
                            src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(reviewFileUrl)}`}
                            className="w-full h-full border-0"
                            title="Preview documento"
                          />
                        )}
                        {fileType === 'unknown' && (
                          <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
                            <File className="w-16 h-16 opacity-40" />
                            <p className="text-sm">No se puede previsualizar este tipo de archivo</p>
                            <div className="flex gap-2">
                              <button onClick={() => window.open(reviewFileUrl, '_blank')} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
                                <ExternalLink className="w-4 h-4" /> Abrir en nueva pestaña
                              </button>
                              <a href={reviewFileUrl} download className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-300 flex items-center gap-2">
                                <Download className="w-4 h-4" /> Descargar
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : reviewingSubmission.content ? (
                    <div className="p-6 max-w-3xl mx-auto">
                      <h4 className="text-sm font-semibold text-slate-500 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Contenido de la entrega
                      </h4>
                      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {reviewingSubmission.content.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
                          part.match(/^https?:\/\//) ? (
                            <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all inline-flex items-center gap-1">
                              {part} <ExternalLink className="w-3 h-3 inline" />
                            </a>
                          ) : part
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                      <FileText className="w-16 h-16 opacity-30 mb-3" />
                      <p className="text-sm">Sin archivo ni contenido adjunto</p>
                    </div>
                  )}
                </div>

                {/* Right: Grading sidebar */}
                <div className="w-full lg:w-96 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col shrink-0 overflow-auto">
                  <div className="p-5 space-y-5 flex-1">
                    {/* Student content (if both file + text exist) */}
                    {reviewingSubmission.content && reviewFileUrl && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Texto del estudiante</label>
                        <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-600 max-h-32 overflow-y-auto whitespace-pre-wrap border border-slate-100">
                          {reviewingSubmission.content.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
                            part.match(/^https?:\/\//) ? (
                              <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{part}</a>
                            ) : part
                          )}
                        </div>
                      </div>
                    )}

                    {/* External links */}
                    {reviewingSubmission.content && reviewingSubmission.content.match(/https?:\/\/[^\s]+/) && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Enlaces</label>
                        <div className="space-y-1">
                          {(reviewingSubmission.content.match(/https?:\/\/[^\s]+/g) || []).map((link, i) => (
                            <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg text-sm text-blue-700 hover:bg-blue-100 truncate">
                              <ExternalLink className="w-4 h-4 shrink-0" />
                              <span className="truncate">{link}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Grade input */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
                        Calificación (máx {act.maxScore ? Number(act.maxScore) : '5.0'})
                      </label>
                      <input
                        type="number" step="0.1" min="0" max={act.maxScore ? Number(act.maxScore) : 5}
                        value={gradeScore} onChange={e => setGradeScore(e.target.value)}
                        className="w-full border border-slate-300 rounded-xl px-4 py-3 text-lg font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="0.0"
                      />
                    </div>

                    {/* Feedback */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Retroalimentación</label>
                      <textarea
                        value={gradeFeedback} onChange={e => setGradeFeedback(e.target.value)}
                        rows={4}
                        className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Comentarios para el estudiante..."
                      />
                    </div>

                    {/* Previous feedback if graded */}
                    {reviewingSubmission.feedback && reviewingSubmission.status === 'GRADED' && (
                      <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                        <p className="text-xs font-semibold text-green-700 mb-1">Retroalimentación anterior</p>
                        <p className="text-sm text-green-800 whitespace-pre-wrap">{reviewingSubmission.feedback}</p>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="p-5 border-t border-slate-100 space-y-3 bg-slate-50 shrink-0">
                    <button
                      onClick={handleReviewGrade}
                      disabled={!gradeScore || grading}
                      className="w-full px-5 py-3 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                    >
                      {grading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      {grading ? 'Guardando...' : hasNext ? 'Calificar y siguiente →' : 'Calificar'}
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { handleReturn(reviewingSubmission); setReviewingSubmission(null) }}
                        className="flex-1 px-4 py-2.5 bg-orange-50 text-orange-600 rounded-xl text-sm font-medium hover:bg-orange-100 flex items-center justify-center gap-1.5"
                      >
                        <RotateCcw className="w-4 h-4" /> Devolver
                      </button>
                      <button
                        onClick={() => setReviewingSubmission(null)}
                        className="flex-1 px-4 py-2.5 bg-white text-slate-600 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 flex items-center justify-center gap-1.5"
                      >
                        Cerrar
                      </button>
                    </div>
                    {/* Keyboard shortcuts hint */}
                    <p className="text-center text-xs text-slate-400">
                      Usa ← → para navegar entre entregas
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {/* TEACHER: Question Editor for QUIZ/EXAM */}
        {isTeacher && isQuizType(act.type) && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h3 className="text-lg font-bold text-slate-800">Preguntas ({questions.length})</h3>
                <div className="flex flex-wrap gap-2">
                  {questions.length >= 1 && (
                    <>
                      <button onClick={() => { setLiveQuizActivityId(act.id); setLiveQuizActivityTitle(act.title); setLiveQuizInitialDeliveryMode('SYNC'); setShowLiveQuiz(true) }} className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl text-xs sm:text-sm font-semibold hover:from-yellow-600 hover:to-orange-600 shadow-sm">
                        <Zap className="w-4 h-4" /> <span className="hidden sm:inline">Quiz En Vivo</span><span className="sm:hidden">En Vivo</span>
                      </button>
                      <button onClick={() => { setLiveQuizActivityId(act.id); setLiveQuizActivityTitle(act.title); setLiveQuizInitialDeliveryMode('ASYNC_HOME'); setShowLiveQuiz(true) }} className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-xl text-xs sm:text-sm font-semibold hover:from-rose-600 hover:to-pink-600 shadow-sm">
                        <Home className="w-4 h-4" /> <span className="hidden sm:inline">Quiz En Casa</span><span className="sm:hidden">En Casa</span>
                      </button>
                    </>
                  )}
                  <button onClick={() => { resetCtxForm(); setShowContextForm(true) }} className="flex items-center gap-1.5 px-3 py-2 bg-teal-500 text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-teal-600">
                    <FileText className="w-4 h-4" /> <span className="hidden sm:inline">+</span> Contexto
                  </button>
                  <button onClick={() => { resetQForm(); setEditingQuestion(null); setShowAddQuestion(true) }} className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-purple-700">
                    <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Agregar</span><span className="sm:hidden">+</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Context form (create/edit) */}
            {showContextForm && (
              <div className="p-4 sm:p-6 border-b border-slate-100 bg-amber-50/40 space-y-3">
                <h4 className="text-base font-bold text-slate-800">{editingContextId ? 'Editar contexto' : 'Nuevo contexto de lectura'}</h4>
                <p className="text-xs text-slate-500">Un contexto es un texto o imagen compartido por varias preguntas (ej: lectura comprensiva, enunciado, gráfico).</p>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Título (opcional)</label>
                  <input value={ctxForm.title} onChange={e => setCtxForm({ ...ctxForm, title: e.target.value })} placeholder="Ej: Texto 1, Gráfico de barras..." className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-base focus:ring-2 focus:ring-amber-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Texto del contexto</label>
                  <Suspense fallback={<div className="h-32 bg-slate-50 rounded-xl animate-pulse" />}>
                    <RichTextEditor value={ctxForm.text} onChange={v => setCtxForm({ ...ctxForm, text: v })} placeholder="Pega aquí el texto de lectura, enunciado, caso de estudio..." />
                  </Suspense>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">URL de imagen (opcional)</label>
                  <input value={ctxForm.imageUrl} onChange={e => setCtxForm({ ...ctxForm, imageUrl: e.target.value })} placeholder="https://..." className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-base focus:ring-2 focus:ring-amber-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Visibilidad del contexto</label>
                  <select value={ctxForm.viewPolicy} onChange={e => setCtxForm({ ...ctxForm, viewPolicy: e.target.value })} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-base">
                    <option value="ALWAYS">Siempre visible (el estudiante puede verlo durante todas las preguntas)</option>
                    <option value="ONCE">Solo una vez (el estudiante lo ve antes de las preguntas, luego se oculta)</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3">
                  <button onClick={resetCtxForm} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Cancelar</button>
                  <button onClick={handleSaveContext} disabled={(isRichTextEmpty(ctxForm.text) && !ctxForm.imageUrl.trim()) || savingContext} className="px-5 py-2 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2">
                    {savingContext && <Loader2 className="w-4 h-4 animate-spin" />}
                    {editingContextId ? 'Guardar cambios' : 'Crear contexto'}
                  </button>
                </div>
              </div>
            )}

            {/* Existing contexts list */}
            {contexts.length > 0 && (
              <div className="px-6 py-3 border-b border-slate-100 bg-amber-50/20">
                <p className="text-xs font-medium text-amber-700 mb-2">Contextos de lectura ({contexts.length})</p>
                <div className="space-y-2">
                  {contexts.map(ctx => {
                    const linkedQuestions = questions.filter(q => q.contextId === ctx.id)
                    return (
                      <div key={ctx.id} className="bg-amber-100 border border-amber-200 rounded-xl overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2">
                          <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                          <span className="font-medium text-amber-800 text-sm truncate flex-1">{ctx.title || (ctx.text?.slice(0, 50) + '...')}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ctx.viewPolicy === 'ONCE' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                            {ctx.viewPolicy === 'ONCE' ? 'UNA VEZ' : 'SIEMPRE'}
                          </span>
                          <button onClick={() => startEditContext(ctx)} className="p-1 hover:bg-amber-200 rounded-lg"><Pencil className="w-3.5 h-3.5 text-amber-700" /></button>
                          <button onClick={() => handleDeleteContext(ctx.id)} className="p-1 hover:bg-red-200 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                        </div>
                        {linkedQuestions.length > 0 ? (
                          <div className="px-3 py-2 bg-amber-50 border-t border-amber-200">
                            <p className="text-[10px] text-amber-600 font-semibold mb-1">PREGUNTAS VINCULADAS ({linkedQuestions.length})</p>
                            <div className="flex flex-wrap gap-1">
                              {linkedQuestions.map((q, i) => (
                                <span key={q.id} className="px-2 py-0.5 bg-white border border-amber-200 rounded text-xs text-slate-600">
                                  P{questions.findIndex(qq => qq.id === q.id) + 1}: {q.text.slice(0, 30)}{q.text.length > 30 ? '...' : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="px-3 py-2 bg-amber-50/50 border-t border-amber-200">
                            <p className="text-[10px] text-amber-400 italic">Sin preguntas vinculadas — selecciona este contexto al crear una pregunta</p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Add/Edit question form */}
            {showAddQuestion && (
              <div ref={questionFormRef} className="p-4 sm:p-6 border-b border-slate-100 bg-purple-50/30 space-y-4">
                <h4 className="text-base font-bold text-slate-800">{editingQuestion ? 'Editar pregunta' : 'Nueva pregunta'}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                    <select value={qForm.type} onChange={e => setQForm({ ...qForm, type: e.target.value, options: e.target.value === 'TRUE_FALSE' ? ['Verdadero', 'Falso'] : ['', '', '', ''], correctAnswer: '', correctAnswers: [], blanks: [], matchPairs: [{ left: '', right: '' }] })} className="w-full border border-slate-300 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base">
                      <option value="MULTIPLE_CHOICE">Opción múltiple</option>
                      <option value="MULTIPLE_SELECT">Selección múltiple</option>
                      <option value="TRUE_FALSE">Verdadero/Falso</option>
                      <option value="SHORT_ANSWER">Respuesta corta</option>
                      <option value="FILL_BLANK">Completar espacios</option>
                      <option value="ORDERING">Ordenar elementos</option>
                      <option value="MATCHING">Emparejar</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Puntos</label>
                    <input type="number" step="0.1" min="0.1" value={qForm.points} onChange={e => setQForm({ ...qForm, points: e.target.value })} className="w-full border border-slate-300 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base" />
                  </div>
                  {isIcfes(act.type) && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Área ICFES</label>
                      <select value={qForm.subjectArea} onChange={e => setQForm({ ...qForm, subjectArea: e.target.value })} className="w-full border border-slate-300 rounded-xl px-4 py-3 text-base">
                        <option value="">Seleccionar área...</option>
                        {ICFES_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                  )}
                  {contexts.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Contexto (opcional)</label>
                      <select value={qForm.contextId} onChange={e => setQForm({ ...qForm, contextId: e.target.value })} className="w-full border border-slate-300 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base">
                        <option value="">Sin contexto</option>
                        {contexts.map(ctx => <option key={ctx.id} value={ctx.id}>{ctx.title || (ctx.text?.slice(0, 50) + '...')}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Pregunta</label>
                  <textarea value={qForm.text} onChange={e => setQForm({ ...qForm, text: e.target.value })} rows={2} placeholder="Escribe la pregunta..." className="w-full border border-slate-300 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base resize-none focus:ring-2 focus:ring-purple-500 outline-none" />
                </div>

                {/* Image upload for question */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Imagen (opcional)</label>
                  <div className="flex items-center gap-3">
                    <input 
                      value={qForm.imageUrl} 
                      onChange={e => setQForm(prev => ({ ...prev, imageUrl: e.target.value }))} 
                      placeholder="URL de imagen o sube una..." 
                      className="flex-1 border border-slate-300 rounded-xl px-3 sm:px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 outline-none" 
                    />
                    <button
                      type="button"
                      className="px-4 py-2.5 bg-purple-100 text-purple-700 rounded-xl text-sm font-medium cursor-pointer hover:bg-purple-200 transition-colors flex items-center gap-2"
                      onClick={() => {
                        const input = document.createElement('input')
                        input.type = 'file'
                        input.accept = 'image/*'
                        input.onchange = async () => {
                          const file = input.files?.[0]
                          if (!file) return
                          setQForm(prev => ({ ...prev, imageUrl: '⏳ Subiendo imagen...' }))
                          try {
                            const response = await classroomApi.uploadMaterial(file)
                            const uploadedUrl = response.data?.data?.url || response.data?.data?.path || response.data?.url || response.data?.path
                            if (uploadedUrl) {
                              setQForm(prev => ({ ...prev, imageUrl: uploadedUrl }))
                            } else {
                              console.error('Upload response structure:', JSON.stringify(response.data))
                              setQForm(prev => ({ ...prev, imageUrl: '' }))
                              alert('No se pudo obtener la URL de la imagen subida')
                            }
                          } catch (err: any) {
                            console.error('Error uploading image:', err?.response?.data || err)
                            setQForm(prev => ({ ...prev, imageUrl: '' }))
                            alert('Error al subir imagen: ' + (err?.response?.data?.message || err?.message || 'Intenta de nuevo'))
                          }
                        }
                        input.click()
                      }}
                    >
                      <ImageIcon className="w-4 h-4" />
                      Subir
                    </button>
                  </div>
                  {qForm.imageUrl && qForm.imageUrl !== '⏳ Subiendo imagen...' && (
                    <div className="mt-2 relative inline-block">
                      <img src={qForm.imageUrl} alt="Preview" className="max-h-32 rounded-lg border border-slate-200" />
                      <button 
                        onClick={() => setQForm(prev => ({ ...prev, imageUrl: '' }))}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  {qForm.imageUrl === '⏳ Subiendo imagen...' && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-purple-600">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Subiendo imagen...
                    </div>
                  )}
                </div>

                {/* Options for MULTIPLE_CHOICE */}
                {qForm.type === 'MULTIPLE_CHOICE' && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Opciones</label>
                    {qForm.options.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input type="radio" name="correctOpt" checked={qForm.correctAnswer === opt && opt !== ''} onChange={() => setQForm({ ...qForm, correctAnswer: opt })} className="accent-purple-600" />
                        <input value={opt} onChange={e => { const opts = [...qForm.options]; opts[i] = e.target.value; setQForm({ ...qForm, options: opts }) }} placeholder={`Opción ${String.fromCharCode(65 + i)}`} className="flex-1 border border-slate-300 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base focus:ring-2 focus:ring-purple-500 outline-none" />
                        {qForm.options.length > 2 && (
                          <button onClick={() => { const opts = qForm.options.filter((_, j) => j !== i); setQForm({ ...qForm, options: opts, correctAnswer: qForm.correctAnswer === opt ? '' : qForm.correctAnswer }) }} className="p-1.5 rounded-lg hover:bg-red-50">
                            <X className="w-4 h-4 text-red-400" />
                          </button>
                        )}
                      </div>
                    ))}
                    {qForm.options.length < 6 && (
                      <button onClick={() => setQForm({ ...qForm, options: [...qForm.options, ''] })} className="text-sm text-purple-600 hover:text-purple-700 font-medium">+ Agregar opción</button>
                    )}
                    <p className="text-xs text-slate-400">Selecciona el radio de la respuesta correcta</p>
                  </div>
                )}

                {/* Options for MULTIPLE_SELECT */}
                {qForm.type === 'MULTIPLE_SELECT' && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Opciones (marca las correctas)</label>
                    {qForm.options.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          checked={qForm.correctAnswers.includes(opt) && opt !== ''} 
                          onChange={() => {
                            if (!opt.trim()) return
                            const newCorrect = qForm.correctAnswers.includes(opt)
                              ? qForm.correctAnswers.filter(a => a !== opt)
                              : [...qForm.correctAnswers, opt]
                            setQForm({ ...qForm, correctAnswers: newCorrect })
                          }} 
                          className="accent-purple-600 w-4 h-4" 
                        />
                        <input value={opt} onChange={e => { 
                          const oldOpt = qForm.options[i]
                          const opts = [...qForm.options]; opts[i] = e.target.value
                          const newCorrect = qForm.correctAnswers.map(a => a === oldOpt ? e.target.value : a)
                          setQForm({ ...qForm, options: opts, correctAnswers: newCorrect }) 
                        }} placeholder={`Opción ${String.fromCharCode(65 + i)}`} className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-base focus:ring-2 focus:ring-purple-500 outline-none" />
                        {qForm.options.length > 2 && (
                          <button onClick={() => { 
                            const opts = qForm.options.filter((_, j) => j !== i)
                            const newCorrect = qForm.correctAnswers.filter(a => a !== opt)
                            setQForm({ ...qForm, options: opts, correctAnswers: newCorrect }) 
                          }} className="p-1.5 rounded-lg hover:bg-red-50">
                            <X className="w-4 h-4 text-red-400" />
                          </button>
                        )}
                      </div>
                    ))}
                    {qForm.options.length < 6 && (
                      <button onClick={() => setQForm({ ...qForm, options: [...qForm.options, ''] })} className="text-sm text-purple-600 hover:text-purple-700 font-medium">+ Agregar opción</button>
                    )}
                    <p className="text-xs text-slate-400">Marca con checkbox todas las respuestas correctas</p>
                  </div>
                )}

                {/* TRUE_FALSE correct answer */}
                {qForm.type === 'TRUE_FALSE' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Respuesta correcta</label>
                    <div className="flex gap-4">
                      {['Verdadero', 'Falso'].map(v => (
                        <label key={v} className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="tfAnswer" checked={qForm.correctAnswer === v} onChange={() => setQForm({ ...qForm, correctAnswer: v })} className="accent-purple-600" />
                          <span className="text-base">{v}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* SHORT_ANSWER correct answer */}
                {qForm.type === 'SHORT_ANSWER' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Respuesta correcta</label>
                    <input value={qForm.correctAnswer} onChange={e => setQForm({ ...qForm, correctAnswer: e.target.value })} placeholder="Respuesta esperada..." className="w-full border border-slate-300 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-purple-500 outline-none" />
                  </div>
                )}

                {/* FILL_BLANK */}
                {qForm.type === 'FILL_BLANK' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Texto con espacios</label>
                      <p className="text-xs text-slate-400 mb-2">Usa ___ (3 guiones bajos) donde quieras un espacio en blanco</p>
                      <textarea 
                        value={qForm.text} 
                        onChange={e => {
                          const text = e.target.value
                          const blankCount = (text.match(/___/g) || []).length
                          const newBlanks = [...qForm.blanks]
                          while (newBlanks.length < blankCount) newBlanks.push('')
                          while (newBlanks.length > blankCount) newBlanks.pop()
                          setQForm({ ...qForm, text, blanks: newBlanks })
                        }} 
                        rows={3} 
                        placeholder="Ej: La capital de Colombia es ___ y tiene ___ millones de habitantes." 
                        className="w-full border border-slate-300 rounded-xl px-4 py-3 text-base resize-none focus:ring-2 focus:ring-purple-500 outline-none" 
                      />
                    </div>
                    {qForm.blanks.length > 0 && (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Respuestas correctas (en orden)</label>
                        {qForm.blanks.map((blank, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-bold shrink-0">{i + 1}</span>
                            <input 
                              value={blank} 
                              onChange={e => {
                                const newBlanks = [...qForm.blanks]
                                newBlanks[i] = e.target.value
                                setQForm({ ...qForm, blanks: newBlanks })
                              }} 
                              placeholder={`Respuesta para espacio ${i + 1}`} 
                              className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-base focus:ring-2 focus:ring-purple-500 outline-none" 
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ORDERING */}
                {qForm.type === 'ORDERING' && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Elementos en orden correcto</label>
                    <p className="text-xs text-slate-400">Ingresa los elementos en el orden correcto. El estudiante los verá desordenados.</p>
                    {qForm.options.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-bold shrink-0">{i + 1}</span>
                        <input value={opt} onChange={e => { const opts = [...qForm.options]; opts[i] = e.target.value; setQForm({ ...qForm, options: opts }) }} placeholder={`Elemento ${i + 1}`} className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-base focus:ring-2 focus:ring-purple-500 outline-none" />
                        {qForm.options.length > 2 && (
                          <button onClick={() => { const opts = qForm.options.filter((_, j) => j !== i); setQForm({ ...qForm, options: opts }) }} className="p-1.5 rounded-lg hover:bg-red-50">
                            <X className="w-4 h-4 text-red-400" />
                          </button>
                        )}
                      </div>
                    ))}
                    {qForm.options.length < 8 && (
                      <button onClick={() => setQForm({ ...qForm, options: [...qForm.options, ''] })} className="text-sm text-purple-600 hover:text-purple-700 font-medium">+ Agregar elemento</button>
                    )}
                  </div>
                )}

                {/* MATCHING */}
                {qForm.type === 'MATCHING' && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Pares de elementos</label>
                    <p className="text-xs text-slate-400">Columna izquierda se empareja con columna derecha</p>
                    {qForm.matchPairs.map((pair, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input value={pair.left} onChange={e => { const pairs = [...qForm.matchPairs]; pairs[i] = { ...pairs[i], left: e.target.value }; setQForm({ ...qForm, matchPairs: pairs }) }} placeholder="Elemento izquierdo" className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-base focus:ring-2 focus:ring-purple-500 outline-none" />
                        <span className="text-slate-400">↔</span>
                        <input value={pair.right} onChange={e => { const pairs = [...qForm.matchPairs]; pairs[i] = { ...pairs[i], right: e.target.value }; setQForm({ ...qForm, matchPairs: pairs }) }} placeholder="Elemento derecho" className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-base focus:ring-2 focus:ring-purple-500 outline-none" />
                        {qForm.matchPairs.length > 1 && (
                          <button onClick={() => { const pairs = qForm.matchPairs.filter((_, j) => j !== i); setQForm({ ...qForm, matchPairs: pairs }) }} className="p-1.5 rounded-lg hover:bg-red-50">
                            <X className="w-4 h-4 text-red-400" />
                          </button>
                        )}
                      </div>
                    ))}
                    {qForm.matchPairs.length < 8 && (
                      <button onClick={() => setQForm({ ...qForm, matchPairs: [...qForm.matchPairs, { left: '', right: '' }] })} className="text-sm text-purple-600 hover:text-purple-700 font-medium">+ Agregar par</button>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Explicación (opcional)</label>
                  <input value={qForm.explanation} onChange={e => setQForm({ ...qForm, explanation: e.target.value })} placeholder="Se muestra al estudiante después de enviar..." className="w-full border border-slate-300 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-purple-500 outline-none" />
                </div>

                <div className="flex justify-end gap-3">
                  <button onClick={() => { setShowAddQuestion(false); setEditingQuestion(null); resetQForm() }} className="px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100 rounded-xl" style={{ minHeight: '44px' }}>Cancelar</button>
                  <button onClick={handleAddQuestion} disabled={!qForm.text.trim() || (qForm.type === 'FILL_BLANK' ? qForm.blanks.filter(b => b.trim()).length === 0 : qForm.type === 'MULTIPLE_SELECT' ? qForm.correctAnswers.length === 0 : qForm.type === 'ORDERING' ? qForm.options.filter(o => o.trim()).length < 2 : qForm.type === 'MATCHING' ? qForm.matchPairs.filter(p => p.left.trim() && p.right.trim()).length < 2 : !qForm.correctAnswer) || savingQuestion} className="px-5 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2" style={{ minHeight: '44px' }}>
                    {savingQuestion && <Loader2 className="w-4 h-4 animate-spin" />}
                    {editingQuestion ? 'Guardar cambios' : 'Agregar'}
                  </button>
                </div>
              </div>
            )}

            {/* Questions list */}
            {questionsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-purple-500" /></div>
            ) : questions.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <HelpCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-base">Agrega preguntas para este {act.type === 'QUIZ' ? 'quiz' : 'examen'}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {questions.map((q, i) => (
                  <div key={q.id} className="px-3 sm:px-6 py-3 sm:py-4 hover:bg-slate-50">
                    <div className="flex items-start gap-2 sm:gap-3">
                      <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center text-xs sm:text-sm font-bold shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm sm:text-base font-medium text-slate-800">{q.text}</p>
                        <div className="flex items-center gap-2 sm:gap-3 mt-1 text-xs sm:text-sm text-slate-400 flex-wrap">
                          <span className="px-1.5 sm:px-2 py-0.5 bg-slate-100 rounded text-[10px] sm:text-xs">{q.type === 'MULTIPLE_CHOICE' ? 'Opción múltiple' : q.type === 'MULTIPLE_SELECT' ? 'Selección múltiple' : q.type === 'TRUE_FALSE' ? 'V/F' : q.type === 'FILL_BLANK' ? 'Completar' : q.type === 'ORDERING' ? 'Ordenar' : q.type === 'MATCHING' ? 'Emparejar' : 'Respuesta corta'}</span>
                          <span>{Number(q.points)} pts</span>
                          {q.subjectArea && <span className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs text-white ${AREA_COLORS[q.subjectArea] || 'bg-slate-500'}`}>{q.subjectArea}</span>}
                          {q.context && <span className="px-1.5 sm:px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] sm:text-xs border border-amber-200">{q.context.title || 'Contexto'}</span>}
                          {q.correctAnswer && <span className="text-green-600 text-xs">✓ {q.correctAnswer.length > 20 ? q.correctAnswer.slice(0, 20) + '...' : q.correctAnswer}</span>}
                        </div>
                        {q.options && Array.isArray(q.options) && (
                          <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2">
                            {(q.options as string[]).map((opt: string, j: number) => {
                              const isCorrect = q.type === 'MULTIPLE_SELECT' 
                                ? (() => { try { return JSON.parse(q.correctAnswer || '[]').includes(opt) } catch { return false } })()
                                : opt === q.correctAnswer
                              return (
                                <span key={j} className={`text-[10px] sm:text-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border ${isCorrect ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white border-slate-200 text-slate-600'}`}>
                                  {String.fromCharCode(65 + j)}. {opt.length > 15 ? opt.slice(0, 15) + '...' : opt}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-0.5 sm:gap-1 shrink-0">
                        <button onClick={() => startEditQuestion(q)} className="p-1.5 sm:p-2 rounded-xl hover:bg-slate-100"><Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" /></button>
                        <button onClick={() => handleDeleteQuestion(q.id)} className="p-1.5 sm:p-2 rounded-xl hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TEACHER: ICFES Results Dashboard */}
        {isTeacher && isIcfes(act.type) && icfesClassResults.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Resultados del Simulacro ({icfesClassResults.length} estudiantes)</h3>
            </div>

            {/* Summary averages per area */}
            {(() => {
              const areaAgg: Record<string, { sumPct: number; count: number }> = {}
              icfesClassResults.forEach((s: any) => s.areas?.forEach((a: any) => {
                if (!areaAgg[a.name]) areaAgg[a.name] = { sumPct: 0, count: 0 }
                areaAgg[a.name].sumPct += a.percentage
                areaAgg[a.name].count++
              }))
              const areaAvgs = Object.entries(areaAgg).map(([name, d]) => ({ name, avg: Math.round(d.sumPct / d.count) }))
              const avgGlobal = icfesClassResults.length > 0 ? Math.round(icfesClassResults.reduce((s: number, r: any) => s + r.icfesGlobalScore, 0) / icfesClassResults.length) : 0
              return (
                <div className="p-6 border-b border-slate-100 bg-emerald-50/30">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="bg-emerald-100 rounded-xl px-4 py-2 text-center">
                      <p className="text-xs text-emerald-600 font-medium">Promedio Global</p>
                      <p className="text-2xl font-bold text-emerald-700">{avgGlobal}<span className="text-sm opacity-70">/500</span></p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {areaAvgs.map(a => (
                      <div key={a.name} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full mb-1 ${AREA_COLORS[a.name] || 'bg-slate-500'}`} />
                        <p className="text-xs text-slate-500 truncate">{a.name}</p>
                        <p className={`text-lg font-bold ${a.avg >= 70 ? 'text-green-600' : a.avg >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{a.avg}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Student ranking table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">#</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Estudiante</th>
                    <th className="text-center px-4 py-3 font-medium text-slate-600">Puntaje</th>
                    <th className="text-center px-4 py-3 font-medium text-slate-600">Correctas</th>
                    {ICFES_AREAS.map(a => (
                      <th key={a} className="text-center px-3 py-3 font-medium text-slate-600 whitespace-nowrap">{a.split(' ')[0]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {icfesClassResults.map((r: any, i: number) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-400 font-medium">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{r.student.lastName} {r.student.firstName}</td>
                      <td className="px-4 py-3 text-center font-bold text-emerald-700">{r.icfesGlobalScore}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{r.totalCorrect}/{r.totalQuestions}</td>
                      {ICFES_AREAS.map(areaName => {
                        const area = r.areas?.find((a: any) => a.name === areaName)
                        return (
                          <td key={areaName} className="px-3 py-3 text-center">
                            {area ? (
                              <span className={`text-sm font-medium ${area.percentage >= 70 ? 'text-green-600' : area.percentage >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{area.percentage}%</span>
                            ) : <span className="text-slate-300">—</span>}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STUDENT: Quiz-taking UI for QUIZ/EXAM */}
        {isStudent && isQuizType(act.type) && quizMode === 'taking' && (
          <div className="bg-white rounded-2xl border-2 border-purple-200 p-4 sm:p-6 space-y-4 sm:space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="text-base sm:text-lg font-bold text-slate-800">Pregunta {quizCurrentIdx + 1} de {quizQuestions.length}</h3>
              <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto">
                <div className="flex gap-1 flex-wrap sm:flex-nowrap">
                  {quizQuestions.map((_, i) => (
                    <button key={i} onClick={() => setQuizCurrentIdx(i)} className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs font-bold ${i === quizCurrentIdx ? 'bg-purple-600 text-white' : (quizAnswers[quizQuestions[i]?.id] || (quizMultiAnswers[quizQuestions[i]?.id]?.length > 0) || quizBlankAnswers[quizQuestions[i]?.id]?.some(b => b?.trim()) || quizOrderAnswers[quizQuestions[i]?.id]?.length > 0 || Object.keys(quizMatchAnswers[quizQuestions[i]?.id] || {}).length > 0) ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</button>
                  ))}
                </div>
              </div>
            </div>

            {quizQuestions[quizCurrentIdx] && (() => {
              const q = quizQuestions[quizCurrentIdx]
              const qCtx = q.context
              // Auto-show ONCE context if not yet viewed
              if (qCtx && qCtx.viewPolicy === 'ONCE' && !viewedOnceContexts.has(qCtx.id) && !contextModalData) {
                setTimeout(() => {
                  setContextModalData(qCtx)
                  setViewedOnceContexts(prev => new Set([...prev, qCtx.id]))
                }, 100)
              }
              const onceAlreadyViewed = qCtx && qCtx.viewPolicy === 'ONCE' && viewedOnceContexts.has(qCtx.id)
              return (
                <div className="space-y-4">
                  {qCtx && qCtx.viewPolicy === 'ALWAYS' && (
                    <button onClick={() => setContextModalData(qCtx)} className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 hover:bg-amber-100 transition-colors w-full text-left">
                      <FileText className="w-5 h-5 shrink-0" />
                      <span className="font-medium">{qCtx.title || 'Ver contexto de lectura'}</span>
                      <span className="ml-auto text-xs text-amber-500">Clic para ver</span>
                    </button>
                  )}
                  {onceAlreadyViewed && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-400">
                      <FileText className="w-4 h-4" />
                      <span>{qCtx.title || 'Contexto de lectura'} — ya fue mostrado</span>
                    </div>
                  )}
                  <p className="text-base sm:text-lg text-slate-800 font-medium">{q.text}</p>
                  {q.type === 'MULTIPLE_CHOICE' && q.options && (
                    <div className="space-y-2">
                      {(q.options as string[]).map((opt: string, i: number) => (
                        <button key={i} onClick={() => handleQuizAnswer(q.id, opt)} className={`w-full text-left px-3 sm:px-5 py-3 sm:py-3.5 rounded-xl border-2 text-sm sm:text-base transition-all ${quizAnswers[q.id] === opt ? 'border-purple-500 bg-purple-50 text-purple-800 font-medium' : 'border-slate-200 hover:border-purple-300 text-slate-700'}`}>
                          <span className="font-bold mr-3">{String.fromCharCode(65 + i)}.</span>{opt}
                        </button>
                      ))}
                    </div>
                  )}
                  {q.type === 'TRUE_FALSE' && (
                    <div className="flex gap-2 sm:gap-4">
                      {['Verdadero', 'Falso'].map(v => (
                        <button key={v} onClick={() => handleQuizAnswer(q.id, v)} className={`flex-1 px-3 sm:px-5 py-3 sm:py-3.5 rounded-xl border-2 text-sm sm:text-base font-medium transition-all ${quizAnswers[q.id] === v ? 'border-purple-500 bg-purple-50 text-purple-800' : 'border-slate-200 hover:border-purple-300 text-slate-700'}`}>
                          {v}
                        </button>
                      ))}
                    </div>
                  )}
                  {q.type === 'MULTIPLE_SELECT' && q.options && (
                    <div className="space-y-2">
                      <p className="text-sm text-slate-500 mb-2">Selecciona todas las respuestas correctas</p>
                      {(q.options as string[]).map((opt: string, i: number) => {
                        const selected = (quizMultiAnswers[q.id] || []).includes(opt)
                        return (
                          <button key={i} onClick={() => handleQuizMultiAnswer(q.id, opt)} className={`w-full text-left px-5 py-3.5 rounded-xl border-2 text-base transition-all flex items-center gap-3 ${selected ? 'border-purple-500 bg-purple-50 text-purple-800 font-medium' : 'border-slate-200 hover:border-purple-300 text-slate-700'}`}>
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${selected ? 'border-purple-500 bg-purple-500' : 'border-slate-300'}`}>
                              {selected && <CheckCircle2 className="w-4 h-4 text-white" />}
                            </div>
                            <span><span className="font-bold mr-2">{String.fromCharCode(65 + i)}.</span>{opt}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {q.type === 'SHORT_ANSWER' && (
                    <input value={quizAnswers[q.id] || ''} onChange={e => handleQuizAnswer(q.id, e.target.value)} placeholder="Escribe tu respuesta..." className="w-full border-2 border-slate-200 rounded-xl px-3 sm:px-5 py-3 sm:py-3.5 text-sm sm:text-base focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none" />
                  )}
                  {q.type === 'FILL_BLANK' && (() => {
                    const parts = q.text.split('___')
                    const blankCount = parts.length - 1
                    const answers = quizBlankAnswers[q.id] || []
                    return (
                      <div className="space-y-4">
                        <div className="text-base text-slate-700 leading-relaxed">
                          {parts.map((part: string, i: number) => (
                            <span key={i}>
                              {part}
                              {i < blankCount && (
                                <input
                                  value={answers[i] || ''}
                                  onChange={e => handleQuizBlankAnswer(q.id, i, e.target.value)}
                                  className="inline-block w-32 mx-1 px-3 py-1 border-b-2 border-purple-400 bg-purple-50 text-purple-800 font-medium text-center focus:outline-none focus:border-purple-600"
                                  placeholder={`(${i + 1})`}
                                />
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                  {q.type === 'ORDERING' && (() => {
                    initOrderAnswer(q.id, q.options as string[])
                    const items = quizOrderAnswers[q.id] || []
                    return (
                      <div className="space-y-2">
                        <p className="text-sm text-slate-500 mb-3">Arrastra o usa las flechas para ordenar los elementos</p>
                        {items.map((item: string, i: number) => (
                          <div key={i} className="flex items-center gap-2 p-3 bg-amber-50 border-2 border-amber-200 rounded-xl">
                            <span className="w-7 h-7 rounded-lg bg-amber-200 text-amber-800 flex items-center justify-center text-sm font-bold shrink-0">{i + 1}</span>
                            <span className="flex-1 text-base text-slate-700">{item}</span>
                            <div className="flex flex-col gap-0.5">
                              <button 
                                onClick={() => i > 0 && handleQuizOrderMove(q.id, i, i - 1)} 
                                disabled={i === 0}
                                className="p-1 rounded hover:bg-amber-200 disabled:opacity-30"
                              >
                                <ChevronUp className="w-4 h-4 text-amber-700" />
                              </button>
                              <button 
                                onClick={() => i < items.length - 1 && handleQuizOrderMove(q.id, i, i + 1)} 
                                disabled={i === items.length - 1}
                                className="p-1 rounded hover:bg-amber-200 disabled:opacity-30"
                              >
                                <ChevronDown className="w-4 h-4 text-amber-700" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                  {q.type === 'MATCHING' && (() => {
                    // options puede ser { left: [...], right: [...] } o legacy (parsear de correctAnswer)
                    let leftItems: string[] = []
                    if (q.options && typeof q.options === 'object' && 'left' in q.options) {
                      leftItems = (q.options as any).left || []
                    } else if (q.correctAnswer) {
                      try { leftItems = Object.keys(JSON.parse(q.correctAnswer)) } catch {}
                    }
                    // Usar opciones pre-shuffled (estables entre re-renders)
                    const shuffledRight = quizShuffledRight[q.id] || []
                    const matches = quizMatchAnswers[q.id] || {}
                    return (
                      <div className="space-y-4">
                        <p className="text-sm text-slate-500">Selecciona el elemento que corresponde a cada ítem</p>
                        {leftItems.length === 0 ? (
                          <p className="text-sm text-red-500">Error: No hay elementos para emparejar</p>
                        ) : leftItems.map((left, i) => (
                          <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                            <div className="flex-1 p-2.5 sm:p-3 bg-blue-50 border-2 border-blue-200 rounded-xl text-sm sm:text-base text-slate-700 font-medium">{left}</div>
                            <span className="text-slate-400 text-center hidden sm:block">→</span>
                            <select 
                              value={matches[left] || ''} 
                              onChange={e => handleQuizMatchAnswer(q.id, left, e.target.value)}
                              className="flex-1 p-2.5 sm:p-3 border-2 border-slate-200 rounded-xl text-sm sm:text-base focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none bg-white"
                              style={{ minHeight: '44px' }}
                            >
                              <option value="">Seleccionar respuesta...</option>
                              {shuffledRight.map((right, j) => (
                                <option key={j} value={right}>{right}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              )
            })()}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 sm:pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between w-full sm:w-auto gap-2">
                <button onClick={() => setQuizCurrentIdx(Math.max(0, quizCurrentIdx - 1))} disabled={quizCurrentIdx === 0} className="px-3 sm:px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100 rounded-xl disabled:opacity-30" style={{ minHeight: '44px' }}>
                  ← Anterior
                </button>
                <span className="text-xs sm:text-sm text-slate-400 sm:hidden">{Object.keys(quizAnswers).length + Object.keys(quizMultiAnswers).filter(k => quizMultiAnswers[k]?.length > 0).length + Object.keys(quizBlankAnswers).filter(k => quizBlankAnswers[k]?.some(b => b?.trim())).length + Object.keys(quizOrderAnswers).filter(k => quizOrderAnswers[k]?.length > 0).length + Object.keys(quizMatchAnswers).filter(k => Object.keys(quizMatchAnswers[k] || {}).length > 0).length}/{quizQuestions.length}</span>
              </div>
              <span className="hidden sm:block text-sm text-slate-400">{Object.keys(quizAnswers).length + Object.keys(quizMultiAnswers).filter(k => quizMultiAnswers[k]?.length > 0).length + Object.keys(quizBlankAnswers).filter(k => quizBlankAnswers[k]?.some(b => b?.trim())).length + Object.keys(quizOrderAnswers).filter(k => quizOrderAnswers[k]?.length > 0).length + Object.keys(quizMatchAnswers).filter(k => Object.keys(quizMatchAnswers[k] || {}).length > 0).length} de {quizQuestions.length} respondidas</span>
              {quizCurrentIdx < quizQuestions.length - 1 ? (
                <button onClick={() => setQuizCurrentIdx(quizCurrentIdx + 1)} className="px-4 py-2.5 text-sm text-purple-600 hover:bg-purple-50 rounded-xl font-medium" style={{ minHeight: '44px' }}>
                  Siguiente →
                </button>
              ) : (
                <button onClick={handleSubmitQuiz} disabled={quizSubmitting} className="px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2" style={{ minHeight: '44px' }}>
                  {quizSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Enviar Quiz
                </button>
              )}
            </div>
          </div>
        )}

        {/* STUDENT: Quiz result view (non-ICFES) */}
        {isStudent && isQuizType(act.type) && !isIcfes(act.type) && quizMode === 'result' && quizResult && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border-2 border-green-200 p-6 text-center space-y-3">
              <Award className="w-14 h-14 mx-auto text-green-500" />
              <h3 className="text-2xl font-bold text-slate-800">Resultado</h3>
              <p className="text-4xl font-bold text-green-700">{quizResult.score !== null ? Number(quizResult.score) : '—'}<span className="text-xl text-slate-400">/{act.maxScore ? Number(act.maxScore) : '?'}</span></p>
              {quizResult.timeSpentSeconds && (
                <p className="text-sm text-slate-400">Tiempo: {Math.floor(quizResult.timeSpentSeconds / 60)}m {quizResult.timeSpentSeconds % 60}s</p>
              )}
              <p className="text-sm text-slate-500">
                {(() => {
                  // Live Quiz submissions have no QuestionAnswer records — parse from content
                  const isLiveQuiz = quizResult.content?.startsWith('Live Quiz')
                  if (isLiveQuiz) {
                    const match = quizResult.content?.match(/(\d+)\/(\d+) correctas/)
                    if (match) return `${match[1]} de ${match[2]} correctas`
                    return quizResult.content?.replace('Live Quiz — ', '') || ''
                  }
                  const correct = quizResult.answers?.filter((a: any) => a.isCorrect).length || 0
                  const total = quizResult.answers?.length || 0
                  return `${correct} de ${total} correctas`
                })()}
              </p>
            </div>

            {quizResult.activity?.showResults && quizResult.answers?.map((a: any, i: number) => (
              <div key={a.id} className={`bg-white rounded-2xl border-2 p-5 ${a.isCorrect ? 'border-green-200' : 'border-red-200'}`}>
                <div className="flex items-start gap-3">
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${a.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {a.isCorrect ? <CircleCheck className="w-4 h-4" /> : <CircleX className="w-4 h-4" />}
                  </span>
                  <div className="flex-1">
                    <p className="text-base font-medium text-slate-800">{a.question?.text}</p>
                    <p className="text-sm mt-1"><span className="text-slate-400">Tu respuesta:</span> <span className={a.isCorrect ? 'text-green-700 font-medium' : 'text-red-600'}>{a.answer || '—'}</span></p>
                    {!a.isCorrect && a.question?.correctAnswer && (
                      <p className="text-sm mt-0.5"><span className="text-slate-400">Correcta:</span> <span className="text-green-700 font-medium">{a.question.correctAnswer}</span></p>
                    )}
                    {a.question?.explanation && (
                      <p className="text-sm mt-2 text-blue-600 italic">{a.question.explanation}</p>
                    )}
                  </div>
                  <span className="text-sm font-bold text-slate-500">{a.pointsEarned ? Number(a.pointsEarned) : 0}/{a.question?.points ? Number(a.question.points) : '?'}</span>
                </div>
              </div>
            ))}

            <button onClick={() => { setQuizMode('idle'); setQuizResult(null) }} className="text-sm text-slate-500 hover:text-blue-600">← Volver</button>
          </div>
        )}

        {/* STUDENT: ICFES result view with area breakdown */}
        {isStudent && isIcfes(act.type) && quizMode === 'result' && icfesResult && (
          <div className="space-y-4">
            {/* Global score card */}
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-6 text-white text-center space-y-2">
              <BarChart3 className="w-12 h-12 mx-auto opacity-80" />
              <h3 className="text-xl font-bold">Puntaje Global ICFES</h3>
              <p className="text-5xl font-bold">{icfesResult.icfesGlobalScore}<span className="text-xl opacity-70">/500</span></p>
              <p className="text-sm opacity-80">{icfesResult.totalCorrect} de {icfesResult.totalQuestions} correctas ({icfesResult.globalPercentage}%)</p>
              {icfesResult.timeSpentSeconds && (
                <p className="text-sm opacity-70">Tiempo: {Math.floor(icfesResult.timeSpentSeconds / 60)}m {icfesResult.timeSpentSeconds % 60}s</p>
              )}
            </div>

            {/* Area breakdown */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-800">Resultados por Área</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {icfesResult.areas?.map((area: any) => (
                  <div key={area.name} className="px-6 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className={`w-3 h-3 rounded-full ${AREA_COLORS[area.name] || 'bg-slate-500'}`} />
                        <span className="text-base font-medium text-slate-800">{area.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-500">{area.correct}/{area.total}</span>
                        <span className={`text-base font-bold ${area.percentage >= 70 ? 'text-green-600' : area.percentage >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{area.percentage}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5">
                      <div className={`h-2.5 rounded-full transition-all ${area.percentage >= 70 ? 'bg-green-500' : area.percentage >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${area.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={() => { setQuizMode('idle'); setIcfesResult(null) }} className="text-sm text-slate-500 hover:text-blue-600">← Volver</button>
          </div>
        )}

        {/* STUDENT: Quiz idle state (start or view result) */}
        {isStudent && isQuizType(act.type) && quizMode === 'idle' && (
          <div className={`bg-white rounded-2xl border p-6 space-y-4 ${isIcfes(act.type) ? 'border-emerald-200' : 'border-slate-200'}`}>
            <h3 className="text-lg font-bold text-slate-800">{isIcfes(act.type) ? 'Simulacro ICFES' : act.type === 'QUIZ' ? 'Quiz' : 'Examen'}</h3>
            {mySubmission && (mySubmission.status === 'AUTO_GRADED' || mySubmission.status === 'GRADED') ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className={`text-sm px-3 py-1 rounded-full font-medium ${(STATUS_COLORS[mySubmission.status] || STATUS_COLORS.DRAFT).bg} ${(STATUS_COLORS[mySubmission.status] || STATUS_COLORS.DRAFT).text}`}>
                    {(STATUS_COLORS[mySubmission.status] || STATUS_COLORS.DRAFT).label}
                  </span>
                  {mySubmission.score !== undefined && mySubmission.score !== null && (
                    <span className="text-lg font-bold text-green-700">{Number(mySubmission.score)}/{act.maxScore ? Number(act.maxScore) : '?'}</span>
                  )}
                </div>
                <button onClick={() => isIcfes(act.type) ? handleViewIcfesResult(mySubmission.id) : handleViewResult(mySubmission.id)} className={`px-5 py-2.5 text-white rounded-xl text-sm font-semibold flex items-center gap-2 ${isIcfes(act.type) ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-purple-600 hover:bg-purple-700'}`} style={{ minHeight: '44px' }}>
                  <Eye className="w-5 h-5" /> {isIcfes(act.type) ? 'Ver resultados ICFES' : 'Ver resultados'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {isIcfes(act.type) ? (
                  <p className="text-base text-slate-600">
                    Presentarás un simulacro tipo Saber 11 con preguntas organizadas por áreas: Lectura Crítica, Matemáticas, Ciencias Naturales, Sociales y Ciudadanas, e Inglés.
                  </p>
                ) : (
                  <p className="text-base text-slate-600">
                    {act.type === 'QUIZ' ? 'Presentarás un quiz' : 'Presentarás un examen'} con preguntas de selección y/o respuesta corta.
                    {act.maxScore && <span> La nota máxima es <strong>{Number(act.maxScore)}</strong>.</span>}
                  </p>
                )}
                <button onClick={handleStartQuiz} disabled={quizSubmitting} className={`px-5 py-2.5 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center gap-2 ${isIcfes(act.type) ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-purple-600 hover:bg-purple-700'}`} style={{ minHeight: '44px' }}>
                  {quizSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CircleDot className="w-5 h-5" />}
                  {quizSubmitting ? 'Iniciando...' : isIcfes(act.type) ? 'Iniciar Simulacro' : 'Comenzar'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* STUDENT: Self-Assessment UI */}
        {isStudent && isSelfAssessment(act.type) && (
          <StudentSelfAssessment activity={act} onSubmitted={() => openActivity(act)} />
        )}

        {/* TEACHER: Self-Assessment Results */}
        {isTeacher && isSelfAssessment(act.type) && (
          <SelfAssessmentResults activity={act} />
        )}

        {/* STUDENT: My submission / submit form (TASK only) */}
        {isStudent && !isQuizType(act.type) && !isSelfAssessment(act.type) && (
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
                
                {/* Enlace externo */}
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    value={submitLink} 
                    onChange={e => setSubmitLink(e.target.value)} 
                    placeholder="Pega un enlace externo (Google Docs, Canva, etc.)" 
                    className="w-full border border-slate-300 rounded-xl pl-11 pr-4 py-3 text-base focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                {submitLink && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-green-50 rounded-xl border border-green-200">
                    <ExternalLink className="w-5 h-5 text-green-500" />
                    <a href={submitLink} target="_blank" rel="noopener noreferrer" className="text-sm text-green-700 hover:underline flex-1 truncate">{submitLink}</a>
                    <button onClick={() => setSubmitLink('')} className="p-1 rounded-lg hover:bg-green-100"><X className="w-4 h-4 text-green-600" /></button>
                  </div>
                )}

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
                  <button onClick={handleStudentSubmit} disabled={(!submitContent.trim() && !submitFile && !submitLink.trim()) || submitting} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2" style={{ minHeight: '44px' }}>
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {submitting ? 'Entregando...' : 'Entregar actividad'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── DUPLICATE ACTIVITY MODAL (in detail view) ── */}
        {duplicateActivityModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-200 flex items-center justify-between shrink-0">
                <h3 className="font-bold text-slate-800">Duplicar actividad</h3>
                <button onClick={() => setDuplicateActivityModal(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <div className="p-5 overflow-y-auto flex-1">
                <p className="text-sm text-slate-600 mb-4">
                  Duplicando: <span className="font-medium text-slate-800">{duplicateActivityModal.activityTitle}</span>
                </p>
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => { setDuplicateTargetType('same'); setSelectedTargetClassroom(null) }}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${duplicateTargetType === 'same' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    Esta aula
                  </button>
                  <button
                    onClick={() => setDuplicateTargetType('other')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${duplicateTargetType === 'other' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    Otra aula
                  </button>
                </div>
                {duplicateTargetType === 'same' ? (
                  <>
                    <p className="text-xs text-slate-500 mb-3">Selecciona la sección destino:</p>
                    {sections.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-8">No hay secciones disponibles</p>
                    ) : (
                      <div className="space-y-2">
                        {sections.map((s: Section) => (
                          <button
                            key={s.id}
                            onClick={() => handleDuplicateActivityToSection(s.id)}
                            disabled={duplicatingActivity}
                            className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left disabled:opacity-50"
                          >
                            <FolderOpen className="w-5 h-5 text-slate-400" />
                            <span className="font-medium text-slate-700">{s.title}</span>
                            {duplicatingActivity && <Loader2 className="w-4 h-4 animate-spin text-blue-600 ml-auto" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {!selectedTargetClassroom ? (
                      <>
                        <p className="text-xs text-slate-500 mb-3">Selecciona el aula destino:</p>
                        {loadingClassroomsForDup ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
                          </div>
                        ) : availableClassroomsForDup.length === 0 ? (
                          <p className="text-sm text-slate-500 text-center py-8">No hay otras aulas disponibles</p>
                        ) : (
                          <div className="space-y-2">
                            {availableClassroomsForDup.map((c: any) => (
                              <button
                                key={c.id}
                                onClick={() => handleSelectTargetClassroom(c)}
                                className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-violet-300 hover:bg-violet-50 transition-colors text-left"
                              >
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: c.color || '#6366f1' }}>
                                  {c.title?.charAt(0) || 'A'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-slate-800 truncate">{c.title}</p>
                                  <p className="text-xs text-slate-500 truncate">{c.groupName} • {c.subjectName}</p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <button onClick={() => setSelectedTargetClassroom(null)} className="flex items-center gap-2 text-sm text-violet-600 hover:text-violet-700 mb-3">
                          <ChevronLeft className="w-4 h-4" /> Cambiar aula
                        </button>
                        <div className="flex items-center gap-3 p-3 bg-violet-50 rounded-lg border border-violet-200 mb-4">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: selectedTargetClassroom.color || '#6366f1' }}>
                            {selectedTargetClassroom.title?.charAt(0) || 'A'}
                          </div>
                          <div>
                            <p className="font-medium text-slate-800">{selectedTargetClassroom.title}</p>
                            <p className="text-xs text-slate-500">{selectedTargetClassroom.groupName} • {selectedTargetClassroom.subjectName}</p>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 mb-3">Selecciona la sección destino:</p>
                        {loadingTargetSections ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
                          </div>
                        ) : targetClassroomSections.length === 0 ? (
                          <p className="text-sm text-slate-500 text-center py-8">Esta aula no tiene secciones</p>
                        ) : (
                          <div className="space-y-2">
                            {targetClassroomSections.map((s: Section) => (
                              <button
                                key={s.id}
                                onClick={() => handleDuplicateActivityToSection(s.id)}
                                disabled={duplicatingActivity}
                                className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-violet-300 hover:bg-violet-50 transition-colors text-left disabled:opacity-50"
                              >
                                <FolderOpen className="w-5 h-5 text-slate-400" />
                                <span className="font-medium text-slate-700">{s.title}</span>
                                {duplicatingActivity && <Loader2 className="w-4 h-4 animate-spin text-violet-600 ml-auto" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Context viewing modal (student) */}
        {contextModalData && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setContextModalData(null)}>
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-amber-50">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-600" />
                  <h3 className="font-bold text-slate-800">{contextModalData.title || 'Contexto de lectura'}</h3>
                </div>
                <button onClick={() => setContextModalData(null)} className="p-1 hover:bg-amber-100 rounded-lg">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                {contextModalData.imageUrl && (
                  <img src={contextModalData.imageUrl} alt="Contexto" className="max-w-full rounded-xl border border-slate-200" />
                )}
                {contextModalData.text && (
                  <RichContent html={contextModalData.text} className="text-base text-slate-700" />
                )}
              </div>
              <div className="px-6 py-3 border-t border-slate-200 flex justify-end shrink-0">
                <button onClick={() => setContextModalData(null)} className="px-5 py-2 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600">Cerrar</button>
              </div>
            </div>
          </div>
        )}

        {/* ── SCHEDULE PUBLISH MODAL ── */}
        {showScheduleModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowScheduleModal(null)}>
            <div className="bg-white rounded-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Clock className="w-5 h-5 text-blue-500" /> Programar publicación</h3>
                <button onClick={() => setShowScheduleModal(null)} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-400" /></button>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-sm text-slate-500">La actividad se publicará automáticamente en la fecha y hora seleccionada.</p>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha y hora</label>
                  <input type="datetime-local" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="w-full border border-slate-300 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div className="flex justify-end gap-3">
                  {activities.find(a => a.id === showScheduleModal)?.scheduledPublishAt && (
                    <button onClick={() => { handlePublish(showScheduleModal, false); setShowScheduleModal(null) }} className="px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-xl">
                      Cancelar programación
                    </button>
                  )}
                  <button onClick={() => setShowScheduleModal(null)} className="px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Cerrar</button>
                  <button onClick={() => { if (scheduleDate) handleSchedulePublish(showScheduleModal, scheduleDate) }} disabled={!scheduleDate} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                    Programar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── GRADEBOOK LINK MODAL ── */}
        {showGradebookLink && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowGradebookLink(false)}>
            <div className="bg-white rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-bold text-slate-800">Vincular a planilla de notas</h3>
                <button onClick={() => setShowGradebookLink(false)} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-400" /></button>
              </div>
              <div className="p-5 space-y-4">
                {!gradebookConfig?.academicTermId && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">No hay período académico activo. Configure los períodos primero.</div>
                )}
                {gradebookConfig?.academicTermId && (
                  <>
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
                      Período: <strong>{gradebookConfig.academicTermName}</strong> · Escala: {gradebookConfig.scale.min} - {gradebookConfig.scale.max}
                    </div>
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={gradebookLinkForm.syncToGradebook} onChange={e => setGradebookLinkForm(f => ({ ...f, syncToGradebook: e.target.checked }))} className="w-4 h-4 rounded text-blue-600" />
                      <span className="text-sm font-medium text-slate-700">Sincronizar con planilla</span>
                    </label>
                    {gradebookLinkForm.syncToGradebook && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Componente destino</label>
                          <select value={gradebookLinkForm.gradebookComponent} onChange={e => setGradebookLinkForm(f => ({ ...f, gradebookComponent: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                            <option value="">Seleccionar...</option>
                            {(gradebookConfig.processes || []).map((p: any) => (
                              <option key={p.code} value={p.code}>{p.name} ({p.weight}%)</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Índice de actividad</label>
                          <input type="number" min={1} max={20} value={gradebookLinkForm.gradebookIndex} onChange={e => setGradebookLinkForm(f => ({ ...f, gradebookIndex: parseInt(e.target.value) || 1 }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                          <p className="text-xs text-slate-400 mt-1">Columna en la planilla (1, 2, 3...)</p>
                          {gradebookConfig.existingSlots?.filter((s: any) => s.componentType === gradebookLinkForm.gradebookComponent && s.activityIndex === gradebookLinkForm.gradebookIndex).length > 0 && (
                            <p className="text-xs text-amber-600 mt-1">⚠️ Este slot ya tiene notas: "{gradebookConfig.existingSlots.find((s: any) => s.componentType === gradebookLinkForm.gradebookComponent && s.activityIndex === gradebookLinkForm.gradebookIndex)?.activityName}"</p>
                          )}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
              <div className="p-5 border-t border-slate-200 flex justify-end gap-3">
                <button onClick={() => setShowGradebookLink(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                <button onClick={handleSaveGradebookLink} disabled={savingLink || (gradebookLinkForm.syncToGradebook && !gradebookLinkForm.gradebookComponent)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                  {savingLink && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── SYNC PREVIEW MODAL ── */}
        {showSyncPreview && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowSyncPreview(false)}>
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-slate-200 flex items-center justify-between shrink-0">
                <h3 className="font-bold text-slate-800">Preview de sincronización</h3>
                <button onClick={() => setShowSyncPreview(false)} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-400" /></button>
              </div>
              <div className="p-5 overflow-y-auto flex-1">
                {syncPreviewLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
                ) : syncPreview ? (
                  <div className="space-y-4">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
                      <strong>{syncPreview.activityTitle}</strong> → {syncPreview.destination.component} #{syncPreview.destination.index} · {syncPreview.destination.termName}
                    </div>

                    {/* Summary */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <div className="p-2 bg-green-50 rounded-lg text-center"><p className="text-lg font-bold text-green-700">{syncPreview.summary.toCreate}</p><p className="text-[10px] text-green-600">Nuevas</p></div>
                      <div className="p-2 bg-blue-50 rounded-lg text-center"><p className="text-lg font-bold text-blue-700">{syncPreview.summary.toUpdate}</p><p className="text-[10px] text-blue-600">Actualizar</p></div>
                      <div className="p-2 bg-amber-50 rounded-lg text-center"><p className="text-lg font-bold text-amber-700">{syncPreview.summary.conflicts}</p><p className="text-[10px] text-amber-600">Conflictos</p></div>
                      <div className="p-2 bg-slate-50 rounded-lg text-center"><p className="text-lg font-bold text-slate-600">{syncPreview.summary.alreadySynced}</p><p className="text-[10px] text-slate-500">Sin cambio</p></div>
                      <div className="p-2 bg-red-50 rounded-lg text-center"><p className="text-lg font-bold text-red-600">{syncPreview.summary.noSubmission}</p><p className="text-[10px] text-red-500">Sin entrega</p></div>
                    </div>

                    {/* Table */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Estudiante</th>
                            <th className="text-center px-2 py-2 text-xs font-medium text-slate-500">Nota aula</th>
                            <th className="text-center px-2 py-2 text-xs font-medium text-slate-500">Normalizada</th>
                            <th className="text-center px-2 py-2 text-xs font-medium text-slate-500">En planilla</th>
                            <th className="text-center px-2 py-2 text-xs font-medium text-slate-500">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {syncPreview.rows.map((row: any) => (
                            <tr key={row.studentEnrollmentId} className="hover:bg-slate-50">
                              <td className="px-3 py-2 text-slate-700">{row.studentName}</td>
                              <td className="text-center px-2 py-2">{row.activityScore != null ? row.activityScore : '—'}</td>
                              <td className="text-center px-2 py-2 font-medium">{row.normalizedScore != null ? row.normalizedScore : '—'}</td>
                              <td className="text-center px-2 py-2">{row.existingGrade != null ? row.existingGrade : '—'}</td>
                              <td className="text-center px-2 py-2">
                                {row.action === 'create' && <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Crear</span>}
                                {row.action === 'update' && <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">Actualizar</span>}
                                {row.action === 'skip' && <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">Sin cambio</span>}
                                {row.action === 'conflict' && <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">⚠️ Conflicto</span>}
                                {row.action === 'no_submission' && <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full">Sin entrega</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Options */}
                    {syncPreview.summary.conflicts > 0 && (
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={syncIncludeConflicts} onChange={e => setSyncIncludeConflicts(e.target.checked)} className="w-4 h-4 rounded text-amber-600" />
                        <span className="text-slate-600">Sobrescribir notas editadas en planilla ({syncPreview.summary.conflicts} conflictos)</span>
                      </label>
                    )}
                    {syncPreview.summary.noSubmission > 0 && (
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={syncIncludeNoSubmission} onChange={e => setSyncIncludeNoSubmission(e.target.checked)} className="w-4 h-4 rounded text-red-600" />
                        <span className="text-slate-600">Incluir nota mínima para estudiantes sin entrega ({syncPreview.summary.noSubmission})</span>
                      </label>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="p-5 border-t border-slate-200 flex justify-end gap-3 shrink-0">
                <button onClick={() => setShowSyncPreview(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                <button onClick={handleSync} disabled={syncing || !syncPreview || (syncPreview?.summary.toCreate === 0 && syncPreview?.summary.toUpdate === 0 && !syncIncludeConflicts && !syncIncludeNoSubmission)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                  {syncing && <Loader2 className="w-4 h-4 animate-spin" />} Confirmar sincronización
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Live Quiz overlay (inside detail view) */}
        {showLiveQuiz && (
          <LiveQuiz
            classroomId={classroom.id}
            isTeacher={isTeacher}
            onClose={() => { setShowLiveQuiz(false); setActiveLiveSession(null) }}
            activityId={isTeacher ? liveQuizActivityId : undefined}
            activityTitle={isTeacher ? liveQuizActivityTitle : undefined}
            sessionId={isStudent && activeLiveSession ? activeLiveSession.id : undefined}
            studentEnrollmentId={isStudent ? classroom.studentEnrollmentId : undefined}
            initialDeliveryMode={isTeacher ? liveQuizInitialDeliveryMode : 'SYNC'}
          />
        )}

        {/* ── ASSIGN STUDENTS MODAL (in detail view) ── */}
        {assignStudentsModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-200 flex items-center justify-between shrink-0">
                <h3 className="font-bold text-slate-800">Asignar estudiantes</h3>
                <button onClick={() => setAssignStudentsModal(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <div className="p-5 overflow-y-auto flex-1">
                <p className="text-sm text-slate-600 mb-4">
                  Actividad: <span className="font-medium text-slate-800">{assignStudentsModal.activityTitle}</span>
                </p>

                {/* Restriction toggle */}
                <div className="flex items-center gap-3 p-3 bg-violet-50 rounded-lg border border-violet-200 mb-4">
                  <input
                    type="checkbox"
                    id="restrictToAssigned"
                    checked={isRestrictedToAssigned}
                    onChange={e => setIsRestrictedToAssigned(e.target.checked)}
                    className="w-4 h-4 text-violet-600 rounded"
                  />
                  <label htmlFor="restrictToAssigned" className="text-sm text-violet-800">
                    <strong>Solo para seleccionados</strong> — La actividad solo será visible para los estudiantes marcados (útil para recuperaciones)
                  </label>
                </div>

                {loadingStudents ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
                  </div>
                ) : classroomStudents.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">No hay estudiantes en este aula</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-slate-500">{selectedStudentIds.length} de {classroomStudents.length} seleccionados</p>
                      <div className="flex gap-2">
                        <button onClick={() => setSelectedStudentIds(classroomStudents.map(s => s.enrollmentId))} className="text-xs text-blue-600 hover:underline">
                          Seleccionar todos
                        </button>
                        <button onClick={() => setSelectedStudentIds([])} className="text-xs text-slate-500 hover:underline">
                          Ninguno
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {classroomStudents.map((s: any) => (
                        <button
                          key={s.enrollmentId}
                          onClick={() => toggleStudentSelection(s.enrollmentId)}
                          className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-colors text-left ${selectedStudentIds.includes(s.enrollmentId) ? 'border-violet-300 bg-violet-50' : 'border-slate-200 hover:border-slate-300'}`}
                        >
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${selectedStudentIds.includes(s.enrollmentId) ? 'border-violet-500 bg-violet-500' : 'border-slate-300'}`}>
                            {selectedStudentIds.includes(s.enrollmentId) && <Check className="w-3 h-3 text-white" />}
                          </div>
                          {s.photo ? (
                            <img src={s.photo} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                              {s.firstName?.[0]}{s.lastName?.[0]}
                            </div>
                          )}
                          <span className="text-sm text-slate-700">{s.lastName}{s.secondLastName ? ` ${s.secondLastName}` : ''}, {s.firstName}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="p-4 border-t border-slate-200 flex justify-end gap-3 shrink-0">
                <button onClick={() => setAssignStudentsModal(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
                  Cancelar
                </button>
                <button
                  onClick={handleSaveAssignments}
                  disabled={savingAssignments}
                  className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {savingAssignments && <Loader2 className="w-4 h-4 animate-spin" />}
                  Guardar asignación
                </button>
              </div>
            </div>
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
            <Plus className="w-5 h-5" /> Nueva Actividad
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <div className={`bg-white border-2 rounded-2xl p-6 space-y-4 ${isSelfAssessment(form.type) ? 'border-teal-200' : isQuizType(form.type) ? 'border-purple-200' : 'border-blue-200'}`}>
          <h3 className="text-lg font-bold text-slate-800">Nueva Actividad</h3>

          {/* Activity type selector */}
          <div className="flex gap-2 flex-wrap">
            {[{ value: 'TASK', label: 'Tarea', icon: ClipboardList, color: 'blue' }, { value: 'QUIZ', label: 'Quiz', icon: HelpCircle, color: 'purple' }, { value: 'EXAM', label: 'Examen', icon: Award, color: 'red' }, { value: 'ICFES_SIMULATOR', label: 'Simulacro ICFES', icon: BarChart3, color: 'emerald' }, { value: 'SELF_ASSESSMENT', label: 'Autoevaluación', icon: Sparkles, color: 'teal' }].map(t => (
              <button key={t.value} onClick={() => setForm({ ...form, type: t.value })} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${form.type === t.value ? (t.color === 'blue' ? 'border-blue-500 bg-blue-50 text-blue-700' : t.color === 'purple' ? 'border-purple-500 bg-purple-50 text-purple-700' : t.color === 'emerald' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : t.color === 'teal' ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-red-500 bg-red-50 text-red-700') : 'border-slate-200 text-slate-500 hover:border-slate-300'}`} style={{ minHeight: '44px' }}>
                <t.icon className="w-5 h-5" /> {t.label}
              </button>
            ))}
          </div>

          {/* Self-Assessment: delegate to specialized form */}
          {isSelfAssessment(form.type) ? (
            <CreateSelfAssessmentForm
              classroomId={classroom.id}
              sectionId={form.sectionId || sections[0]?.id || ''}
              onCreated={() => { setShowCreate(false); loadActivities() }}
              onCancel={() => setShowCreate(false)}
            />
          ) : (
          <>
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder={isQuizType(form.type) ? 'Título del quiz/examen' : 'Título de la tarea'} className="w-full border border-slate-300 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 outline-none" autoFocus />
          <Suspense fallback={<div className="h-32 bg-slate-50 rounded-xl animate-pulse" />}>
            <RichTextEditor value={form.description} onChange={v => setForm({ ...form, description: v })} placeholder={isQuizType(form.type) ? 'Instrucciones para el estudiante...' : 'Instrucciones y descripción...'} />
          </Suspense>
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

          {/* Quiz/Exam specific fields */}
          {isQuizType(form.type) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-purple-50/50 rounded-xl border border-purple-100">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Intentos máximos</label>
                <input type="number" min="1" max="10" value={form.maxAttempts} onChange={e => setForm({ ...form, maxAttempts: e.target.value })} className="w-full border border-slate-300 rounded-xl px-4 py-3 text-base" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tiempo límite (min)</label>
                <input type="number" min="1" value={form.timeLimitMinutes} onChange={e => setForm({ ...form, timeLimitMinutes: e.target.value })} placeholder="Sin límite" className="w-full border border-slate-300 rounded-xl px-4 py-3 text-base" />
              </div>
              <div className="flex flex-col gap-2 justify-center">
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={form.shuffleQuestions} onChange={e => setForm({ ...form, shuffleQuestions: e.target.checked })} className="rounded accent-purple-600" />
                  Mezclar preguntas
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={form.showResults} onChange={e => setForm({ ...form, showResults: e.target.checked })} className="rounded accent-purple-600" />
                  Mostrar resultados
                </label>
              </div>
            </div>
          )}

          {!isQuizType(form.type) && (
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={form.allowLateSubmit} onChange={e => setForm({ ...form, allowLateSubmit: e.target.checked })} className="rounded" />
              Permitir entregas tardías
            </label>
          )}
          {!isQuizType(form.type) && (
            <>
              <input ref={fileRef} type="file" className="hidden" onChange={e => setAttachFile(e.target.files?.[0] || null)} />
              {attachFile && (
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
                  <Paperclip className="w-5 h-5 text-slate-400" />
                  <span className="text-base text-slate-700 flex-1 truncate">{attachFile.name}</span>
                  <button onClick={() => setAttachFile(null)} className="p-1 rounded-lg hover:bg-slate-200"><X className="w-4 h-4" /></button>
                </div>
              )}
            </>
          )}
          <div className="flex items-center justify-between pt-2">
            {!isQuizType(form.type) ? (
              <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors" style={{ minHeight: '44px' }}>
                <Paperclip className="w-5 h-5" /> Adjuntar archivo
              </button>
            ) : (
              <p className="text-sm text-purple-500">Las preguntas se agregan después de crear</p>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setShowCreate(false); setAttachFile(null) }} className="px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100 rounded-xl" style={{ minHeight: '44px' }}>Cancelar</button>
              <button onClick={handleCreate} disabled={!form.title.trim() || !form.sectionId || creating} className={`px-5 py-2.5 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center gap-2 ${isQuizType(form.type) ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`} style={{ minHeight: '44px' }}>
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                {creating ? 'Creando...' : `Crear ${form.type === 'TASK' ? 'Tarea' : form.type === 'QUIZ' ? 'Quiz' : form.type === 'ICFES_SIMULATOR' ? 'Simulacro' : 'Examen'}`}
              </button>
            </div>
          </div>
          </>
          )}
        </div>
      )}

      {/* Live Quiz banner (student) */}
      {isStudent && activeLiveSession && (
        <button
          onClick={() => setShowLiveQuiz(true)}
          className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl text-white hover:from-yellow-600 hover:to-orange-600 transition-all shadow-lg shadow-orange-500/20 animate-pulse"
        >
          <Zap className="w-8 h-8 shrink-0" />
          <div className="flex-1 text-left">
            <p className="font-bold text-lg flex items-center gap-2 flex-wrap">
              ¡Live Quiz en curso!
              {((activeLiveSession?.deliveryMode || activeLiveSession?.config?.deliveryMode) === 'ASYNC_HOME') && (
                <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-xs font-black uppercase tracking-wide">
                  En casa
                </span>
              )}
            </p>
            <p className="text-white/80 text-sm">
              {((activeLiveSession?.deliveryMode || activeLiveSession?.config?.deliveryMode) === 'ASYNC_HOME')
                ? 'Tu profesor ha iniciado un quiz en casa. Avanza a tu ritmo.'
                : 'Tu profesor ha iniciado un quiz en vivo. ¡Únete ahora!'}
            </p>
          </div>
          <ChevronRight className="w-6 h-6 shrink-0" />
        </button>
      )}

      {/* Live Quiz banner (teacher - async home active) */}
      {isTeacher && activeLiveSession && ((activeLiveSession?.deliveryMode || activeLiveSession?.config?.deliveryMode) === 'ASYNC_HOME') && (
        <button
          onClick={() => {
            setLiveQuizActivityId(activeLiveSession.activityId)
            setLiveQuizActivityTitle(activeLiveSession.activity?.title || 'Quiz En Casa')
            setLiveQuizInitialDeliveryMode('ASYNC_HOME')
            setShowLiveQuiz(true)
          }}
          className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl text-white hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg shadow-emerald-500/20"
        >
          <Home className="w-8 h-8 shrink-0" />
          <div className="flex-1 text-left">
            <p className="font-bold text-lg flex items-center gap-2 flex-wrap">
              🏠 Quiz En Casa Activo
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-xs font-black uppercase tracking-wide">
                {activeLiveSession.activity?.title || 'En curso'}
              </span>
            </p>
            <p className="text-white/80 text-sm">
              Los estudiantes están resolviendo a su ritmo. Haz clic para ver el progreso.
            </p>
          </div>
          <ChevronRight className="w-6 h-6 shrink-0" />
        </button>
      )}

      {/* Live Quiz overlay */}
      {showLiveQuiz && (
        <LiveQuiz
          classroomId={classroom.id}
          isTeacher={isTeacher}
          onClose={() => { setShowLiveQuiz(false); setActiveLiveSession(null) }}
          activityId={isTeacher ? liveQuizActivityId : undefined}
          activityTitle={isTeacher ? liveQuizActivityTitle : undefined}
          sessionId={activeLiveSession?.id}
          studentEnrollmentId={isStudent ? classroom.studentEnrollmentId : undefined}
          initialDeliveryMode={isTeacher ? liveQuizInitialDeliveryMode : 'SYNC'}
        />
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
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isSelfAssessment(act.type) ? 'bg-teal-50' : isIcfes(act.type) ? 'bg-emerald-50' : isQuizType(act.type) ? 'bg-purple-50' : 'bg-blue-50'}`}>
                    {isSelfAssessment(act.type) ? <Sparkles className="w-6 h-6 text-teal-600" /> : isIcfes(act.type) ? <BarChart3 className="w-6 h-6 text-emerald-600" /> : isQuizType(act.type) ? <HelpCircle className="w-6 h-6 text-purple-600" /> : <ClipboardList className="w-6 h-6 text-blue-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-base font-bold text-slate-800 group-hover:text-blue-700">{act.title}</h3>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${statusInfo.bg} ${statusInfo.text}`}>{statusInfo.label}</span>
                      {isSelfAssessment(act.type) && <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-teal-50 text-teal-700">Autoevaluación</span>}
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

      {/* ── DUPLICATE ACTIVITY MODAL ── */}
      {duplicateActivityModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-slate-800">Duplicar actividad</h3>
              <button onClick={() => setDuplicateActivityModal(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              <p className="text-sm text-slate-600 mb-4">
                Duplicando: <span className="font-medium text-slate-800">{duplicateActivityModal.activityTitle}</span>
              </p>

              {/* Tabs: Same classroom / Other classroom */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => { setDuplicateTargetType('same'); setSelectedTargetClassroom(null) }}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${duplicateTargetType === 'same' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  Esta aula
                </button>
                <button
                  onClick={() => setDuplicateTargetType('other')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${duplicateTargetType === 'other' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  Otra aula
                </button>
              </div>

              {duplicateTargetType === 'same' ? (
                <>
                  <p className="text-xs text-slate-500 mb-3">Selecciona la sección destino:</p>
                  {sections.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-8">No hay secciones disponibles</p>
                  ) : (
                    <div className="space-y-2">
                      {sections.map((s: Section) => (
                        <button
                          key={s.id}
                          onClick={() => handleDuplicateActivityToSection(s.id)}
                          disabled={duplicatingActivity}
                          className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left disabled:opacity-50"
                        >
                          <FolderOpen className="w-5 h-5 text-slate-400" />
                          <span className="font-medium text-slate-700">{s.title}</span>
                          {duplicatingActivity && <Loader2 className="w-4 h-4 animate-spin text-blue-600 ml-auto" />}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {!selectedTargetClassroom ? (
                    <>
                      <p className="text-xs text-slate-500 mb-3">Selecciona el aula destino:</p>
                      {loadingClassroomsForDup ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
                        </div>
                      ) : availableClassroomsForDup.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-8">No hay otras aulas disponibles</p>
                      ) : (
                        <div className="space-y-2">
                          {availableClassroomsForDup.map((c: any) => (
                            <button
                              key={c.id}
                              onClick={() => handleSelectTargetClassroom(c)}
                              className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-violet-300 hover:bg-violet-50 transition-colors text-left"
                            >
                              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: c.color || '#6366f1' }}>
                                {c.title?.charAt(0) || 'A'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-slate-800 truncate">{c.title}</p>
                                <p className="text-xs text-slate-500 truncate">{c.groupName} • {c.subjectName}</p>
                              </div>
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <button onClick={() => setSelectedTargetClassroom(null)} className="flex items-center gap-2 text-sm text-violet-600 hover:text-violet-700 mb-3">
                        <ChevronLeft className="w-4 h-4" /> Cambiar aula
                      </button>
                      <div className="flex items-center gap-3 p-3 bg-violet-50 rounded-lg border border-violet-200 mb-4">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: selectedTargetClassroom.color || '#6366f1' }}>
                          {selectedTargetClassroom.title?.charAt(0) || 'A'}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{selectedTargetClassroom.title}</p>
                          <p className="text-xs text-slate-500">{selectedTargetClassroom.groupName} • {selectedTargetClassroom.subjectName}</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mb-3">Selecciona la sección destino:</p>
                      {loadingTargetSections ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
                        </div>
                      ) : targetClassroomSections.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-8">Esta aula no tiene secciones</p>
                      ) : (
                        <div className="space-y-2">
                          {targetClassroomSections.map((s: Section) => (
                            <button
                              key={s.id}
                              onClick={() => handleDuplicateActivityToSection(s.id)}
                              disabled={duplicatingActivity}
                              className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-violet-300 hover:bg-violet-50 transition-colors text-left disabled:opacity-50"
                            >
                              <FolderOpen className="w-5 h-5 text-slate-400" />
                              <span className="font-medium text-slate-700">{s.title}</span>
                              {duplicatingActivity && <Loader2 className="w-4 h-4 animate-spin text-violet-600 ml-auto" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
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

  // Edit forum post
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [editPostForm, setEditPostForm] = useState({ title: '', content: '' })

  const loadPosts = useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await classroomApi.listForumPosts(classroom.id)
      setPosts(data)
    } catch {} finally { setLoading(false) }
  }, [classroom.id])

  useEffect(() => { loadPosts() }, [loadPosts])

  const handleCreate = async () => {
    if (!form.title.trim() || isRichTextEmpty(form.content)) return
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
    if (isRichTextEmpty(replyContent) || !selectedPost) return
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

  const startEditPost = (post: { id: string; title?: string; content: string }) => {
    setEditingPostId(post.id)
    setEditPostForm({ title: post.title || '', content: post.content })
  }

  const handleUpdatePost = async () => {
    if (!editingPostId || isRichTextEmpty(editPostForm.content)) return
    try {
      await classroomApi.updateForumPost(editingPostId, editPostForm)
      setEditingPostId(null)
      setEditPostForm({ title: '', content: '' })
      if (selectedPost) openThread(selectedPost)
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
            <div className={`bg-white rounded-2xl border-2 p-6 overflow-hidden ${post.isPinned ? 'border-yellow-300' : 'border-slate-200'}`}>
              {editingPostId === post.id ? (
                <div className="space-y-3">
                  <input value={editPostForm.title} onChange={e => setEditPostForm(f => ({ ...f, title: e.target.value }))} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-base font-semibold focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Título del tema" />
                  <Suspense fallback={<div className="h-32 bg-slate-50 rounded-xl animate-pulse" />}>
                    <RichTextEditor value={editPostForm.content} onChange={v => setEditPostForm(f => ({ ...f, content: v }))} placeholder="Contenido..." />
                  </Suspense>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditingPostId(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Cancelar</button>
                    <button onClick={handleUpdatePost} disabled={isRichTextEmpty(editPostForm.content)} className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">Guardar</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-2">
                      {post.isPinned && <Pin className="w-4 h-4 text-yellow-500" />}
                      <h2 className="text-xl font-bold text-slate-800">{post.title || 'Sin título'}</h2>
                    </div>
                    <RichContent html={post.content} className="text-base text-slate-600 break-words overflow-hidden" />
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
                      <button onClick={() => startEditPost(post)} className="p-2 rounded-xl hover:bg-amber-50" title="Editar">
                        <Pencil className="w-5 h-5 text-amber-400" />
                      </button>
                    )}
                    {(isTeacher || post.authorId === currentUserId) && (
                      <button onClick={() => handleDeletePost(post.id)} className="p-2 rounded-xl hover:bg-red-50">
                        <Trash2 className="w-5 h-5 text-red-400" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Replies */}
            <div className="space-y-3">
              <h3 className="text-base font-bold text-slate-700">{post.replies?.length || 0} Respuesta(s)</h3>
              {post.replies?.map(reply => (
                <div key={reply.id} className="bg-white rounded-2xl border border-slate-200 p-5 ml-4 overflow-hidden">
                  {editingPostId === reply.id ? (
                    <div className="space-y-3">
                      <Suspense fallback={<div className="h-24 bg-slate-50 rounded-xl animate-pulse" />}>
                        <RichTextEditor value={editPostForm.content} onChange={v => setEditPostForm(f => ({ ...f, content: v }))} placeholder="Contenido..." minimal />
                      </Suspense>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingPostId(null)} className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                        <button onClick={handleUpdatePost} disabled={isRichTextEmpty(editPostForm.content)} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50">Guardar</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <RichContent html={reply.content} className="text-base text-slate-700 break-words overflow-hidden" />
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-sm text-slate-400">
                          {reply.author.firstName} {reply.author.lastName} · {formatDate(reply.createdAt)}
                        </p>
                        <div className="flex gap-1">
                          <button onClick={() => setReplyToId(reply.id)} className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50">Responder</button>
                          {(isTeacher || reply.authorId === currentUserId) && (
                            <button onClick={() => startEditPost(reply)} className="p-1 rounded hover:bg-amber-50" title="Editar"><Pencil className="w-4 h-4 text-amber-400" /></button>
                          )}
                          {(isTeacher || reply.authorId === currentUserId) && (
                            <button onClick={() => handleDeletePost(reply.id)} className="p-1 rounded hover:bg-red-50"><Trash2 className="w-4 h-4 text-red-400" /></button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                  {/* Nested replies (level 2) */}
                  {reply.replies && reply.replies.length > 0 && (
                    <div className="mt-3 ml-4 space-y-2 border-l-2 border-slate-100 pl-4">
                      {reply.replies.map((nested: any) => (
                        <div key={nested.id} className="py-2">
                          {editingPostId === nested.id ? (
                            <div className="space-y-2">
                              <Suspense fallback={<div className="h-20 bg-slate-50 rounded-xl animate-pulse" />}>
                                <RichTextEditor value={editPostForm.content} onChange={v => setEditPostForm(f => ({ ...f, content: v }))} placeholder="Contenido..." minimal />
                              </Suspense>
                              <div className="flex justify-end gap-2">
                                <button onClick={() => setEditingPostId(null)} className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                                <button onClick={handleUpdatePost} disabled={isRichTextEmpty(editPostForm.content)} className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50">Guardar</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <RichContent html={nested.content} className="text-sm text-slate-700 break-words overflow-hidden" />
                              <div className="flex items-center justify-between mt-1">
                                <p className="text-xs text-slate-400">{nested.author.firstName} {nested.author.lastName} · {formatDate(nested.createdAt)}</p>
                                <div className="flex gap-1">
                                  {(isTeacher || nested.authorId === currentUserId) && (
                                    <button onClick={() => startEditPost(nested)} className="p-0.5 rounded hover:bg-amber-50" title="Editar"><Pencil className="w-3.5 h-3.5 text-amber-400" /></button>
                                  )}
                                  {(isTeacher || nested.authorId === currentUserId) && (
                                    <button onClick={() => handleDeletePost(nested.id)} className="p-0.5 rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
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
              <Suspense fallback={<div className="h-24 bg-slate-50 rounded-xl animate-pulse" />}>
                <RichTextEditor value={replyContent} onChange={setReplyContent} placeholder="Escribe tu respuesta..." minimal />
              </Suspense>
              <div className="flex justify-end">
                <button onClick={handleReply} disabled={isRichTextEmpty(replyContent) || replying} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2" style={{ minHeight: '44px' }}>
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
          <Suspense fallback={<div className="h-32 bg-slate-50 rounded-xl animate-pulse" />}>
            <RichTextEditor value={form.content} onChange={v => setForm({ ...form, content: v })} placeholder="Describe el tema de discusión..." />
          </Suspense>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100 rounded-xl" style={{ minHeight: '44px' }}>Cancelar</button>
            <button onClick={handleCreate} disabled={!form.title.trim() || isRichTextEmpty(form.content) || creating} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2" style={{ minHeight: '44px' }}>
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
// TAB: MIS NOTAS (calificaciones del estudiante)
// ═══════════════════════════════════════════════════════════════════════════

function GradesTab({ classroomId }: { classroomId: string }) {
  const [loading, setLoading] = useState(true)
  const [submissions, setSubmissions] = useState<any[]>([])
  const [pending, setPending] = useState<any[]>([])

  useEffect(() => {
    loadGrades()
  }, [classroomId])

  const loadGrades = async () => {
    try {
      setLoading(true)
      const { data } = await classroomApi.getMyGrades(classroomId)
      setSubmissions(data.submissions || [])
      setPending(data.pending || [])
    } catch { }
    finally { setLoading(false) }
  }

  const TYPE_LABELS: Record<string, string> = { TASK: 'Tarea', QUIZ: 'Quiz', EXAM: 'Examen', ICFES_SIMULATOR: 'ICFES', FORUM: 'Foro', GAME: 'Juego' }
  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    DRAFT: { label: 'Borrador', color: 'bg-slate-100 text-slate-600' },
    SUBMITTED: { label: 'Entregado', color: 'bg-blue-100 text-blue-700' },
    GRADED: { label: 'Calificado', color: 'bg-green-100 text-green-700' },
    RETURNED: { label: 'Devuelto', color: 'bg-amber-100 text-amber-700' },
    LATE: { label: 'Tardío', color: 'bg-red-100 text-red-700' },
    AUTO_GRADED: { label: 'Auto-calificado', color: 'bg-purple-100 text-purple-700' },
  }

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : '—'

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
  }

  const totalActivities = submissions.length + pending.length
  const gradedCount = submissions.filter(s => s.status === 'GRADED' || s.status === 'AUTO_GRADED').length
  const totalScore = submissions.filter(s => s.score != null).reduce((acc, s) => acc + Number(s.score), 0)
  const totalMax = submissions.filter(s => s.score != null).reduce((acc, s) => acc + Number(s.activity?.maxScore || 0), 0)
  const avgPercent = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : null

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-800">Mis Calificaciones</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-slate-800">{totalActivities}</p>
          <p className="text-sm text-slate-500">Actividades</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-green-600">{gradedCount}</p>
          <p className="text-sm text-slate-500">Calificadas</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-amber-600">{pending.length}</p>
          <p className="text-sm text-slate-500">Pendientes</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-blue-600">{avgPercent != null ? `${avgPercent}%` : '—'}</p>
          <p className="text-sm text-slate-500">Promedio</p>
        </div>
      </div>

      {totalActivities === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <BarChart3 className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <p className="text-lg font-medium text-slate-500">No hay actividades publicadas aún</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-600">Actividad</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-600">Tipo</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-600">Fecha límite</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-600">Estado</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-600">Nota</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map(sub => {
                const st = STATUS_LABELS[sub.status] || { label: sub.status, color: 'bg-slate-100 text-slate-600' }
                const isGraded = sub.status === 'GRADED' || sub.status === 'AUTO_GRADED'
                return (
                  <tr key={sub.id} className="border-b border-slate-50 hover:bg-slate-25">
                    <td className="px-6 py-3">
                      <p className="text-sm font-medium text-slate-800">{sub.activity?.title}</p>
                      {sub.activity?.section?.title && <p className="text-xs text-slate-400">{sub.activity.section.title}</p>}
                    </td>
                    <td className="px-6 py-3">
                      <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded">{TYPE_LABELS[sub.activity?.type] || sub.activity?.type}</span>
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-500">{formatDate(sub.activity?.dueDate)}</td>
                    <td className="px-6 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${st.color}`}>{st.label}</span>
                    </td>
                    <td className="px-6 py-3">
                      {isGraded ? (
                        <span className="text-sm font-bold text-slate-800">{Number(sub.score).toFixed(1)} / {Number(sub.activity?.maxScore || 5).toFixed(1)}</span>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {pending.map(act => (
                <tr key={act.id} className="border-b border-slate-50 bg-amber-25">
                  <td className="px-6 py-3">
                    <p className="text-sm font-medium text-slate-800">{act.title}</p>
                    {act.section?.title && <p className="text-xs text-slate-400">{act.section.title}</p>}
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded">{TYPE_LABELS[act.type] || act.type}</span>
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-500">{formatDate(act.dueDate)}</td>
                  <td className="px-6 py-3">
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-amber-100 text-amber-700">Pendiente</span>
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-400">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
