import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import RichTextEditor from './RichTextEditor'
import { MediaInput, SmartImg } from './media/SmartMedia'
import { BlockStackEditor, legacyToBlocks, newBlock, type LessonBlock } from './lesson/blocks'
import {
  ArrowLeft, BookOpen, CheckCircle2, ChevronDown, ChevronUp, Eye,
  Flag, GripVertical, Loader2, Pencil, Play, Plus, Save, Sparkles,
  Trash2, Trophy, Type, X, Image, Video, Music, Wand2, Clock, AlertTriangle, Check
} from 'lucide-react'
import { lessonApi, type Lesson, type LessonSlide } from '../lib/api'
import { valeriaAssistantBridge } from '../contexts/ValeriaContext'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface LessonEditorProps {
  activityId: string
  activityTitle?: string
  classroomTitle?: string
  gradeName?: string
  subjectName?: string
  // Si se abre como "juego suelto": siembra una única diapositiva de actividad
  // fijada a este tipo (WORDSEARCH / CROSSWORD) en vez de la plantilla normal.
  initialGameType?: string
  onClose: () => void
  onPreview: () => void
}

interface SlideForm {
  id?: string
  type: 'CONTENT' | 'ACTIVITY' | 'CHECKPOINT' | 'BADGE_REVEAL'
  sortOrder: number
  title: string
  body: string
  imageUrl: string
  videoUrl: string
  audioUrl: string
  layout: string
  activityData: {
    questionType: string
    question: string
    options: string[]
    correctAnswer: string
    explanation: string
    points: number
    hint: string
    feedbackCorrect: string
    feedbackIncorrect: string
    imageUrl: string
  }
  badgeEmoji: string
  badgeTitle: string
  blocks?: LessonBlock[] // motor de bloques (slides CONTENT)
}

const EMPTY_ACTIVITY_DATA = {
  questionType: 'MULTIPLE_CHOICE',
  question: '',
  options: ['', '', '', ''],
  correctAnswer: '',
  explanation: '',
  points: 10,
  hint: '',
  feedbackCorrect: '',
  feedbackIncorrect: '',
  imageUrl: '',
}

// Etiquetas de los bloques interactivos (editor enfocado / actividad suelta).
const BLOCK_LABELS: Record<string, string> = {
  MULTIPLE_CHOICE: 'Opción múltiple', TRUE_FALSE: 'Verdadero / Falso', SHORT_ANSWER: 'Respuesta corta',
  FILL_BLANK: 'Completar', ORDERING: 'Ordenar palabras', MATCHING: 'Emparejar', FLASHCARDS: 'Flashcards',
  LISTENING: 'Escuchar y elegir', WORDSEARCH: 'Sopa de letras', CROSSWORD: 'Crucigrama', MEMORY: 'Memory',
  LABEL_IMAGE: 'Etiquetar imagen', PUZZLE: 'Rompecabezas',
}
// Opciones por defecto al sembrar un bloque suelto según su tipo.
function defaultBlockOptions(type: string): string[] {
  if (type === 'MATCHING' || type === 'FLASHCARDS' || type === 'CROSSWORD' || type === 'MEMORY') return ['::', '::']
  if (type === 'PUZZLE') return ['3'] // tamaño de rejilla N×N
  if (type === 'ORDERING' || type === 'SHORT_ANSWER' || type === 'FILL_BLANK' || type === 'LABEL_IMAGE') return []
  return ['', '', '', ''] // MCQ / TRUE_FALSE / LISTENING / WORDSEARCH
}

const SLIDE_TYPE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  CONTENT: { label: 'Contenido', icon: Type, color: 'bg-blue-500' },
  ACTIVITY: { label: 'Actividad', icon: Sparkles, color: 'bg-amber-500' },
  CHECKPOINT: { label: 'Checkpoint', icon: Flag, color: 'bg-emerald-500' },
  BADGE_REVEAL: { label: 'Badge Final', icon: Trophy, color: 'bg-purple-500' },
}

const LAYOUT_OPTIONS = [
  { value: 'text-left-image-right', label: 'Texto izq + Imagen der' },
  { value: 'image-top', label: 'Imagen arriba' },
  { value: 'full-text', label: 'Solo texto' },
  { value: 'video-center', label: 'Video centrado' },
]

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

/** Indicador de autoguardado (idle/guardando/guardado). */
function AutosaveBadge({ state }: { state: 'idle' | 'saving' | 'saved' }) {
  if (state === 'saving') return <span className="hidden sm:flex items-center gap-1 text-xs text-slate-400"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando…</span>
  if (state === 'saved') return <span className="hidden sm:flex items-center gap-1 text-xs text-emerald-500"><Check className="w-3.5 h-3.5" /> Guardado</span>
  return null
}

export default function LessonEditor({
  activityId, activityTitle, classroomTitle, gradeName, subjectName, initialGameType, onClose, onPreview,
}: LessonEditorProps) {
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Lesson metadata
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [badgeEmoji, setBadgeEmoji] = useState('🏆')
  const [badgeTitle, setBadgeTitle] = useState('Lección completada')
  const [badgeColor, setBadgeColor] = useState('#8B5CF6')
  const [estimatedMinutes, setEstimatedMinutes] = useState('')

  // Slides
  const [slides, setSlides] = useState<SlideForm[]>([])
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0)
  const [showMetadata, setShowMetadata] = useState(false)

  // Seguridad del editor: autoguardado · recuperación · historial (docs/MOTOR_LECCIONES.md)
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [recovery, setRecovery] = useState<{ id: string; snapshot: any; createdAt: string } | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [versions, setVersions] = useState<{ id: string; kind: string; label: string | null; createdAt: string }[]>([])
  const lastSavedSnap = useRef<string>('')
  const dirtyRef = useRef(false)

  // AI generation
  const [showAIModal, setShowAIModal] = useState(false)
  const [aiTopic, setAiTopic] = useState('')
  const [aiContent, setAiContent] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  // ─────────────────────────────────────────────────────────────────
  // LOAD
  // ─────────────────────────────────────────────────────────────────

  const loadLesson = useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await lessonApi.getByActivity(activityId)
      setLesson(data)
      setTitle(data.title)
      setDescription(data.description || '')
      setBadgeEmoji(data.badgeEmoji || '🏆')
      setBadgeTitle(data.badgeTitle || 'Lección completada')
      setBadgeColor(data.badgeColor || '#8B5CF6')
      setEstimatedMinutes(data.estimatedMinutes ? String(data.estimatedMinutes) : '')
      setSlides(data.slides.map(slideToForm))
    } catch {
      // No lesson exists yet — start fresh
      setTitle(activityTitle || classroomTitle || '')
      setShowMetadata(true)
      if (initialGameType) {
        // Actividad interactiva suelta: una sola diapositiva de actividad ya fijada al tipo.
        const block = createEmptySlide('ACTIVITY', 0)
        block.activityData.questionType = initialGameType
        block.activityData.options = defaultBlockOptions(initialGameType)
        setSlides([block, createEmptySlide('BADGE_REVEAL', 1)])
        setSelectedSlideIndex(0)
      } else {
        setSlides([
          createEmptySlide('CONTENT', 0),
          createEmptySlide('BADGE_REVEAL', 1),
        ])
      }
    } finally {
      setLoading(false)
    }
  }, [activityId, initialGameType])

  useEffect(() => { loadLesson() }, [loadLesson])

  // ── Seguridad del editor ───────────────────────────────────────────────────
  const buildSnapshot = useCallback(() => ({
    title, description, badgeEmoji, badgeTitle, badgeColor, estimatedMinutes, slides,
  }), [title, description, badgeEmoji, badgeTitle, badgeColor, estimatedMinutes, slides])

  const applySnapshot = useCallback((snap: any) => {
    if (!snap) return
    setTitle(snap.title ?? '')
    setDescription(snap.description ?? '')
    setBadgeEmoji(snap.badgeEmoji ?? '🏆')
    setBadgeTitle(snap.badgeTitle ?? 'Lección completada')
    setBadgeColor(snap.badgeColor ?? '#8B5CF6')
    setEstimatedMinutes(snap.estimatedMinutes ?? '')
    if (Array.isArray(snap.slides)) setSlides(snap.slides)
    setSelectedSlideIndex(0)
  }, [])

  // Tras cargar, marca el snapshot base y comprueba si hay un borrador sin guardar.
  useEffect(() => {
    if (loading) return
    lastSavedSnap.current = JSON.stringify(buildSnapshot())
    dirtyRef.current = false
    if (lesson?.id) {
      lessonApi.getRecovery(lesson.id).then(({ data }) => { if (data.hasRecovery) setRecovery(data.version) }).catch(() => { })
    }
    // Solo al terminar la carga inicial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, lesson?.id])

  // Autoguardado con debounce (solo si la lección ya existe en el servidor).
  useEffect(() => {
    if (loading || !lesson?.id) return
    const serialized = JSON.stringify(buildSnapshot())
    if (serialized === lastSavedSnap.current) { dirtyRef.current = false; return }
    dirtyRef.current = true
    const t = setTimeout(async () => {
      try {
        setAutosaveState('saving')
        await lessonApi.saveVersion(lesson.id, { kind: 'AUTOSAVE', snapshot: buildSnapshot() })
        lastSavedSnap.current = serialized
        dirtyRef.current = false
        setAutosaveState('saved')
      } catch { setAutosaveState('idle') }
    }, 2500)
    return () => clearTimeout(t)
  }, [buildSnapshot, lesson?.id, loading])

  // Aviso antes de abandonar con cambios sin guardar.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  const openHistory = async () => {
    if (!lesson?.id) return
    setShowHistory(true)
    try { const { data } = await lessonApi.listVersions(lesson.id); setVersions(data) } catch { setVersions([]) }
  }
  const restoreVersion = async (versionId: string) => {
    try {
      const { data } = await lessonApi.getVersion(versionId)
      applySnapshot(data.snapshot)
      setShowHistory(false)
      setSuccess('Versión cargada en el editor. Revisa y pulsa Guardar para conservarla.')
    } catch { setError('No se pudo cargar la versión') }
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  function slideToForm(s: LessonSlide): SlideForm {
    return {
      id: s.id,
      type: s.type,
      sortOrder: s.sortOrder,
      title: s.title || '',
      body: s.body || '',
      imageUrl: s.imageUrl || '',
      videoUrl: s.videoUrl || '',
      audioUrl: s.audioUrl || '',
      layout: s.layout || 'text-left-image-right',
      activityData: s.activityData ? {
        questionType: s.activityData.questionType || 'MULTIPLE_CHOICE',
        question: s.activityData.question || '',
        options: Array.isArray(s.activityData.options) ? s.activityData.options : ['', '', '', ''],
        correctAnswer: s.activityData.correctAnswer || '',
        explanation: s.activityData.explanation || '',
        points: s.activityData.points || 10,
        hint: s.activityData.hint || '',
        feedbackCorrect: (s.activityData as any).feedbackCorrect || '',
        feedbackIncorrect: (s.activityData as any).feedbackIncorrect || '',
        imageUrl: (s.activityData as any).imageUrl || '',
      } : { ...EMPTY_ACTIVITY_DATA },
      badgeEmoji: s.badgeEmoji || '',
      badgeTitle: s.badgeTitle || '',
      // Bloques: los del servidor, o adaptados de los campos legacy (solo CONTENT).
      blocks: s.type === 'CONTENT'
        ? (Array.isArray((s as any).blocks) && (s as any).blocks.length ? (s as any).blocks : legacyToBlocks(s))
        : undefined,
    }
  }

  function createEmptySlide(type: SlideForm['type'], order: number): SlideForm {
    return {
      type,
      sortOrder: order,
      title: '',
      body: '',
      imageUrl: '',
      videoUrl: '',
      audioUrl: '',
      layout: 'text-left-image-right',
      activityData: { ...EMPTY_ACTIVITY_DATA },
      badgeEmoji: type === 'BADGE_REVEAL' ? '🏆' : '',
      badgeTitle: type === 'BADGE_REVEAL' ? 'Lección completada' : '',
      blocks: type === 'CONTENT' ? [newBlock('TEXT')] : undefined,
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // SLIDE OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  const addSlide = (type: SlideForm['type']) => {
    const insertIndex = selectedSlideIndex + 1
    const newSlide = createEmptySlide(type, insertIndex)
    const updated = [...slides]
    updated.splice(insertIndex, 0, newSlide)
    // Re-order
    updated.forEach((s, i) => s.sortOrder = i)
    setSlides(updated)
    setSelectedSlideIndex(insertIndex)
  }

  const removeSlide = (index: number) => {
    if (slides.length <= 1) return
    const updated = slides.filter((_, i) => i !== index)
    updated.forEach((s, i) => s.sortOrder = i)
    setSlides(updated)
    if (selectedSlideIndex >= updated.length) setSelectedSlideIndex(updated.length - 1)
    else if (selectedSlideIndex > index) setSelectedSlideIndex(selectedSlideIndex - 1)
  }

  const moveSlide = (from: number, to: number) => {
    if (to < 0 || to >= slides.length) return
    const updated = [...slides]
    const [moved] = updated.splice(from, 1)
    updated.splice(to, 0, moved)
    updated.forEach((s, i) => s.sortOrder = i)
    setSlides(updated)
    setSelectedSlideIndex(to)
  }

  const updateSlide = (index: number, patch: Partial<SlideForm>) => {
    setSlides(prev => prev.map((s, i) => i === index ? { ...s, ...patch } : s))
  }

  const updateActivityData = (index: number, patch: Partial<SlideForm['activityData']>) => {
    setSlides(prev => prev.map((s, i) => i === index ? {
      ...s,
      activityData: { ...s.activityData, ...patch },
    } : s))
  }

  // ─────────────────────────────────────────────────────────────────
  // SAVE
  // ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!title.trim()) {
      setError('El título de la lección es obligatorio')
      return
    }
    if (slides.length === 0) {
      setError('Agrega al menos un slide')
      return
    }

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const slidesPayload = slides.map((s, i) => ({
        id: s.id || undefined,
        type: s.type,
        sortOrder: i,
        title: s.title || undefined,
        body: s.body || undefined,
        imageUrl: s.imageUrl || undefined,
        videoUrl: s.videoUrl || undefined,
        audioUrl: s.audioUrl || undefined,
        layout: s.layout || undefined,
        activityData: s.type === 'ACTIVITY' ? {
          questionType: s.activityData.questionType,
          question: s.activityData.question,
          options: s.activityData.options.filter(o => o.trim()),
          correctAnswer: s.activityData.correctAnswer,
          explanation: s.activityData.explanation || undefined,
          points: s.activityData.points || 10,
          hint: s.activityData.hint || undefined,
          feedbackCorrect: s.activityData.feedbackCorrect || undefined,
          feedbackIncorrect: s.activityData.feedbackIncorrect || undefined,
          imageUrl: s.activityData.imageUrl || undefined,
        } : undefined,
        blocks: s.type === 'CONTENT' ? (s.blocks || undefined) : undefined,
        badgeEmoji: s.type === 'BADGE_REVEAL' ? (s.badgeEmoji || badgeEmoji) : undefined,
        badgeTitle: s.type === 'BADGE_REVEAL' ? (s.badgeTitle || badgeTitle) : undefined,
      }))

      if (lesson) {
        // Update existing
        await lessonApi.update(lesson.id, {
          title: title.trim(),
          description: description || undefined,
          badgeEmoji,
          badgeTitle,
          badgeColor,
          estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes) : undefined,
        })
        const { data: updated } = await lessonApi.bulkUpdateSlides(lesson.id, slidesPayload as any)
        if (updated) {
          setLesson(updated)
          setSlides(updated.slides.map(slideToForm))
        }
      } else {
        // Create new
        const { data: created } = await lessonApi.create(activityId, {
          title: title.trim(),
          description: description || undefined,
          badgeEmoji,
          badgeTitle,
          badgeColor,
          estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes) : undefined,
          slides: slidesPayload as any,
        })
        setLesson(created)
        setSlides(created.slides.map(slideToForm))
      }

      // Marca el estado como "guardado" (para autosave/beforeunload) y deja un
      // punto de restauración manual en el historial.
      lastSavedSnap.current = JSON.stringify(buildSnapshot())
      dirtyRef.current = false
      setAutosaveState('idle')
      setRecovery(null)
      const savedLessonId = lesson?.id
      if (savedLessonId) {
        lessonApi.saveVersion(savedLessonId, { kind: 'MANUAL', snapshot: buildSnapshot() }).catch(() => { })
      }

      setSuccess('Lección guardada correctamente')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // AI GENERATION
  // ─────────────────────────────────────────────────────────────────

  const handleGenerateAI = async () => {
    if (!aiTopic.trim() && !aiContent.trim()) return
    try {
      setAiLoading(true)
      const { data } = await lessonApi.generateAI({
        topic: aiTopic.trim(),
        content: aiContent.trim(),
        gradeName,
        subjectName,
      })
      if (data) {
        setTitle(data.title || aiTopic)
        setDescription(data.description || '')
        if (Array.isArray(data.slides)) {
          setSlides(data.slides.map((s: any, i: number) => ({
            type: s.type || 'CONTENT',
            sortOrder: i,
            title: s.title || '',
            body: s.body || '',
            imageUrl: s.imageUrl || '',
            videoUrl: s.videoUrl || '',
            audioUrl: s.audioUrl || '',
            layout: s.layout || 'full-text',
            activityData: s.activityData || { ...EMPTY_ACTIVITY_DATA },
            badgeEmoji: s.badgeEmoji || '',
            badgeTitle: s.badgeTitle || '',
          })))
          setSelectedSlideIndex(0)
        }
        // Avisar qué motor produjo la lección: IA real vs plantilla base.
        if (data.source === 'TEMPLATE') {
          setSuccess('Se creó una estructura base (IA no disponible). Revísala y enriquécela antes de publicar.')
        } else {
          setSuccess('Valeria generó tu lección. Revisa y ajusta cada slide antes de publicar.')
        }
        setTimeout(() => setSuccess(''), 5000)
      }
      setShowAIModal(false)
      setAiTopic('')
      setAiContent('')
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error generando con IA')
    } finally {
      setAiLoading(false)
    }
  }

  const openValeriaForLesson = () => {
    valeriaAssistantBridge.open({
      title: 'Valeria — Crear Lección',
      subtitle: 'Genera contenido interactivo para tu lección',
      prompt: `Ayúdame a crear una lección interactiva${subjectName ? ` de ${subjectName}` : ''}${gradeName ? ` para ${gradeName}` : ''}. Quiero que organices el tema en secciones con contenido y actividades intercaladas.`,
      context: {
        pageName: 'Lesson Editor',
        pageSummary: 'Editor de lecciones interactivas con slides, actividades y checkpoints',
        gradeName,
        subjectName,
      },
    })
  }

  // ─────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────
  // MODO BLOQUE — editor enfocado para una actividad interactiva SUELTA (un
  // solo bloque, sin andamiaje de lección). Se activa al crear (initialGameType,
  // que aquí es el tipo de bloque) o al reabrir una actividad de una sola
  // diapositiva de actividad. Reutiliza renderActivityEditor → sirve a TODOS los
  // tipos (opción múltiple, emparejar, ordenar, flashcards, sopa, crucigrama…).
  // ─────────────────────────────────────────────────────────────────
  // Modo bloque SOLO para juego suelto (la actividad anfitriona es GAME → el
  // padre pasa initialGameType). NO se infiere por composición: una lección normal
  // [Actividad, Badge] no debe perder la barra lateral ni el selector de tipo.
  const blockIdx = slides.findIndex(s => s.type === 'ACTIVITY')
  const isBlockMode = !!initialGameType && slides.length > 0

  if (isBlockMode) {
    const gi = blockIdx >= 0 ? blockIdx : 0
    const bname = BLOCK_LABELS[slides[gi].activityData.questionType] || 'Actividad interactiva'
    return (
      <div className="flex flex-col h-full bg-slate-50">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-slate-800 truncate text-sm sm:text-base">🧩 {bname}</h2>
            <p className="text-xs text-slate-400 truncate">{classroomTitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <AutosaveBadge state={autosaveState} />
            {lesson?.id && (
              <button onClick={openHistory} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200" title="Historial de versiones">
                <Clock className="w-4 h-4" /> Historial
              </button>
            )}
            <button onClick={onPreview} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200">
              <Eye className="w-4 h-4" /> Vista previa
            </button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
            </button>
          </div>
        </div>

        {/* Banner de recuperación de borrador sin guardar */}
        {recovery && (
          <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <p className="flex-1 text-sm text-amber-800">Se encontró un <b>borrador sin guardar</b> del {new Date(recovery.createdAt).toLocaleString()}. ¿Recuperarlo?</p>
            <button onClick={() => { applySnapshot(recovery.snapshot); setRecovery(null); setSuccess('Borrador recuperado. Revisa y pulsa Guardar.') }} className="px-3 py-1.5 bg-amber-500 text-white text-sm font-bold rounded-lg hover:bg-amber-600 shrink-0">Recuperar</button>
            <button onClick={() => setRecovery(null)} className="text-amber-500 hover:text-amber-700 shrink-0" title="Descartar"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Historial de versiones */}
        {showHistory && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/40" onClick={() => setShowHistory(false)}>
            <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-bold text-slate-800">Historial de versiones</h3>
                <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-3 overflow-y-auto">
                {versions.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">Sin versiones todavía.</p> : (
                  <div className="space-y-1.5">
                    {versions.map(v => (
                      <button key={v.id} onClick={() => restoreVersion(v.id)} className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 hover:border-violet-300 hover:bg-violet-50 text-left">
                        <span className={`text-[10px] font-bold uppercase rounded px-1.5 py-0.5 ${v.kind === 'MANUAL' ? 'bg-violet-100 text-violet-700' : v.kind === 'PUBLISH' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{v.kind === 'AUTOSAVE' ? 'Auto' : v.kind === 'MANUAL' ? 'Guardado' : 'Publicado'}</span>
                        <span className="flex-1 text-sm text-slate-700">{new Date(v.createdAt).toLocaleString()}</span>
                        <span className="text-xs font-semibold text-violet-600">Restaurar</span>
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-slate-400 mt-2 px-1">Restaurar carga la versión en el editor; revísala y pulsa Guardar para conservarla.</p>
              </div>
            </div>
          </div>
        )}

        {/* Body — reutiliza el mismo panel de autoría del editor de lección */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-2xl mx-auto space-y-4">
            {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">{error}</div>}
            {success && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">{success}</div>}

            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Título</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder={`Mi ${bname.toLowerCase()}`} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-base" />
            </div>

            {renderActivityEditor(slides[gi], gi)}
          </div>
        </div>
      </div>
    )
  }

  const currentSlideData = slides[selectedSlideIndex]

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-slate-800 truncate text-sm sm:text-base">Editor de Lección</h2>
          <p className="text-xs text-slate-400 truncate">{classroomTitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAIModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 text-violet-600 text-sm font-medium hover:bg-violet-100"
          >
            <Wand2 className="w-4 h-4" /> IA
          </button>
          <button
            onClick={openValeriaForLesson}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 text-violet-600 text-sm font-medium hover:bg-violet-100"
          >
            <Sparkles className="w-4 h-4" /> Valeria
          </button>
          <button
            onClick={onPreview}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200"
          >
            <Eye className="w-4 h-4" /> Preview
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mx-4 mt-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 flex items-center gap-2">
          <X className="w-4 h-4 cursor-pointer" onClick={() => setError('')} /> {error}
        </div>
      )}
      {success && (
        <div className="mx-4 mt-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-3 py-2 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {success}
        </div>
      )}

      {/* MAIN CONTENT */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: Slide list */}
        <div className="w-56 sm:w-64 border-r border-slate-200 bg-white flex flex-col overflow-hidden flex-shrink-0">
          {/* Metadata toggle */}
          <button
            onClick={() => setShowMetadata(!showMetadata)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 border-b border-slate-100"
          >
            <BookOpen className="w-4 h-4" />
            Datos de la lección
            {showMetadata ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
          </button>

          {showMetadata && (
            <div className="px-3 py-2 border-b border-slate-100 space-y-2 text-xs">
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Título de la lección"
                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
              />
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Descripción"
                rows={2}
                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm resize-none"
              />
              <div className="flex gap-2">
                <input
                  value={badgeEmoji}
                  onChange={e => setBadgeEmoji(e.target.value)}
                  placeholder="Badge emoji"
                  className="w-16 border border-slate-200 rounded-lg px-2 py-1.5 text-center text-lg"
                />
                <input
                  value={badgeColor}
                  onChange={e => setBadgeColor(e.target.value)}
                  type="color"
                  className="w-10 h-8 rounded-lg border border-slate-200 cursor-pointer"
                />
                <input
                  value={estimatedMinutes}
                  onChange={e => setEstimatedMinutes(e.target.value)}
                  placeholder="Min"
                  type="number"
                  className="w-16 border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
                />
              </div>
            </div>
          )}

          {/* Slide list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {slides.map((slide, i) => {
              const typeInfo = SLIDE_TYPE_LABELS[slide.type] || SLIDE_TYPE_LABELS.CONTENT
              const Icon = typeInfo.icon
              const isSelected = i === selectedSlideIndex

              return (
                <div
                  key={i}
                  onClick={() => setSelectedSlideIndex(i)}
                  className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors text-xs ${
                    isSelected ? 'bg-violet-50 border border-violet-200' : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <button
                      onClick={e => { e.stopPropagation(); moveSlide(i, i - 1) }}
                      className="text-slate-300 hover:text-slate-600"
                      disabled={i === 0}
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <GripVertical className="w-3 h-3 text-slate-300" />
                    <button
                      onClick={e => { e.stopPropagation(); moveSlide(i, i + 1) }}
                      className="text-slate-300 hover:text-slate-600"
                      disabled={i === slides.length - 1}
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>

                  <div className={`w-6 h-6 rounded-md ${typeInfo.color} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-3 h-3 text-white" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-700 truncate">
                      {slide.title || slide.activityData?.question || typeInfo.label}
                    </p>
                    <p className="text-slate-400 truncate">{i + 1}. {typeInfo.label}</p>
                  </div>

                  <button
                    onClick={e => { e.stopPropagation(); removeSlide(i) }}
                    className="text-slate-300 hover:text-red-500 p-0.5"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )
            })}
          </div>

          {/* Add slide buttons */}
          <div className="p-2 border-t border-slate-100 grid grid-cols-2 gap-1">
            {Object.entries(SLIDE_TYPE_LABELS).map(([type, info]) => {
              const Icon = info.icon
              return (
                <button
                  key={type}
                  onClick={() => addSlide(type as SlideForm['type'])}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <div className={`w-4 h-4 rounded ${info.color} flex items-center justify-center`}>
                    <Plus className="w-2.5 h-2.5 text-white" />
                  </div>
                  {info.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* RIGHT: Slide editor */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {currentSlideData ? renderSlideEditor(currentSlideData, selectedSlideIndex) : (
            <div className="text-center text-slate-400 mt-20">
              Selecciona o agrega un slide para comenzar
            </div>
          )}
        </div>
      </div>

      {/* AI Generation Modal */}
      <AnimatePresence>
        {showAIModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
            onClick={() => setShowAIModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                  <Wand2 className="w-4 h-4 text-violet-600" />
                </div>
                <h3 className="font-bold text-slate-800">Generar lección con IA</h3>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Tema</label>
                  <input
                    value={aiTopic}
                    onChange={e => setAiTopic(e.target.value)}
                    placeholder="Ej: La fotosíntesis, Fracciones, La independencia..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">
                    Contenido (pega texto o describe lo que quieres)
                  </label>
                  <textarea
                    value={aiContent}
                    onChange={e => setAiContent(e.target.value)}
                    placeholder="Pega aquí el contenido del tema o describe lo que quieres que incluya la lección..."
                    rows={6}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowAIModal(false)}
                  className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleGenerateAI}
                  disabled={aiLoading || (!aiTopic.trim() && !aiContent.trim())}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50"
                >
                  {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  Generar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────
  // SLIDE EDITORS
  // ─────────────────────────────────────────────────────────────────

  function renderActivityEditor(slide: SlideForm, index: number) {
    return (
          <div className="space-y-3 bg-white rounded-xl border border-slate-200 p-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Tipo de pregunta</label>
              <select
                value={slide.activityData.questionType}
                onChange={e => updateActivityData(index, { questionType: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm"
              >
                <option value="MULTIPLE_CHOICE">Opción múltiple</option>
                <option value="TRUE_FALSE">Verdadero / Falso</option>
                <option value="SHORT_ANSWER">Respuesta corta</option>
                <option value="FILL_BLANK">Completar en línea</option>
                <option value="ORDERING">Ordenar palabras</option>
                <option value="MATCHING">Emparejar</option>
                <option value="FLASHCARDS">Flashcards</option>
                <option value="LISTENING">Escuchar y seleccionar</option>
                <option value="WORDSEARCH">Sopa de letras</option>
                <option value="CROSSWORD">Crucigrama</option>
                <option value="MEMORY">Memory (parejas)</option>
                <option value="LABEL_IMAGE">Etiquetar sobre imagen</option>
                <option value="PUZZLE">Rompecabezas</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                {slide.activityData.questionType === 'ORDERING' || slide.activityData.questionType === 'MATCHING' ? 'Instrucción'
                  : slide.activityData.questionType === 'LISTENING' ? 'Texto que se escuchará (no se muestra)'
                  : slide.activityData.questionType === 'WORDSEARCH' ? 'Instrucción'
                  : slide.activityData.questionType === 'CROSSWORD' ? 'Instrucción'
                  : slide.activityData.questionType === 'MEMORY' ? 'Instrucción'
                  : slide.activityData.questionType === 'LABEL_IMAGE' ? 'Instrucción'
                  : slide.activityData.questionType === 'PUZZLE' ? 'Instrucción'
                  : 'Pregunta'}
              </label>
              <textarea
                value={slide.activityData.question}
                onChange={e => updateActivityData(index, { question: e.target.value })}
                placeholder={
                  slide.activityData.questionType === 'FILL_BLANK' ? 'My mother ___ dinner every day'
                  : slide.activityData.questionType === 'ORDERING' ? 'Ordena las palabras para formar la frase'
                  : slide.activityData.questionType === 'MATCHING' ? 'Empareja cada palabra con su significado'
                  : slide.activityData.questionType === 'LISTENING' ? 'The girl is reading a book'
                  : slide.activityData.questionType === 'WORDSEARCH' ? 'Encuentra las palabras escondidas'
                  : slide.activityData.questionType === 'CROSSWORD' ? 'Resuelve el crucigrama con las pistas'
                  : slide.activityData.questionType === 'MEMORY' ? 'Encuentra todas las parejas'
                  : slide.activityData.questionType === 'LABEL_IMAGE' ? 'Arrastra cada etiqueta a su lugar'
                  : slide.activityData.questionType === 'PUZZLE' ? 'Arma la imagen'
                  : '¿Cuál es...?'
                }
                rows={2}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none"
              />
              {slide.activityData.questionType === 'FILL_BLANK' && (
                <p className="text-xs text-slate-400 mt-1">Escribe <code className="text-violet-600">___</code> (2+ guiones) donde va el hueco.</p>
              )}
              {slide.activityData.questionType === 'LISTENING' && (
                <p className="text-xs text-slate-400 mt-1">El alumno lo oye con TTS (no lo ve) y elige entre las opciones.</p>
              )}
            </div>

            {/* Options for MC / LISTENING */}
            {(slide.activityData.questionType === 'MULTIPLE_CHOICE' || slide.activityData.questionType === 'TRUE_FALSE' || slide.activityData.questionType === 'LISTENING') && (
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Opciones</label>
                <div className="space-y-2">
                  {(slide.activityData.questionType === 'TRUE_FALSE'
                    ? ['Verdadero', 'Falso']
                    : slide.activityData.options
                  ).map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${index}`}
                        checked={slide.activityData.correctAnswer === opt}
                        onChange={() => updateActivityData(index, { correctAnswer: opt })}
                        className="accent-emerald-500"
                      />
                      {slide.activityData.questionType === 'TRUE_FALSE' ? (
                        <span className="text-sm text-slate-700">{opt}</span>
                      ) : (
                        <input
                          value={opt}
                          onChange={e => {
                            const updated = [...slide.activityData.options]
                            updated[oi] = e.target.value
                            updateActivityData(index, { options: updated })
                          }}
                          placeholder={`Opción ${oi + 1}`}
                          className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
                        />
                      )}
                    </div>
                  ))}
                  {(slide.activityData.questionType === 'MULTIPLE_CHOICE' || slide.activityData.questionType === 'LISTENING') && (
                    <button
                      onClick={() => updateActivityData(index, { options: [...slide.activityData.options, ''] })}
                      className="text-xs text-violet-600 hover:text-violet-700 font-medium"
                    >
                      + Agregar opción
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Correct answer for SHORT_ANSWER / FILL_BLANK */}
            {(slide.activityData.questionType === 'SHORT_ANSWER' || slide.activityData.questionType === 'FILL_BLANK') && (
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">
                  {slide.activityData.questionType === 'FILL_BLANK' ? 'Palabra del hueco' : 'Respuesta correcta'}
                </label>
                <input
                  value={slide.activityData.correctAnswer}
                  onChange={e => updateActivityData(index, { correctAnswer: e.target.value })}
                  placeholder={slide.activityData.questionType === 'FILL_BLANK' ? 'cooks' : 'Respuesta exacta'}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm"
                />
              </div>
            )}

            {/* ORDERING — frase correcta + banco de palabras */}
            {slide.activityData.questionType === 'ORDERING' && (
              <div className="space-y-2">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Frase correcta (en orden)</label>
                  <input
                    value={slide.activityData.correctAnswer}
                    onChange={e => updateActivityData(index, { correctAnswer: e.target.value })}
                    placeholder="My brother is a student"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-500 block">Palabras (banco)</label>
                  <button
                    onClick={() => updateActivityData(index, { options: (slide.activityData.correctAnswer || '').trim().split(/\s+/).filter(Boolean) })}
                    className="text-xs text-violet-600 hover:text-violet-700 font-medium"
                  >
                    Generar desde la frase
                  </button>
                </div>
                <div className="space-y-2">
                  {slide.activityData.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input
                        value={opt}
                        onChange={e => {
                          const updated = [...slide.activityData.options]
                          updated[oi] = e.target.value
                          updateActivityData(index, { options: updated })
                        }}
                        placeholder={`Palabra ${oi + 1}`}
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
                      />
                      <button
                        onClick={() => updateActivityData(index, { options: slide.activityData.options.filter((_, j) => j !== oi) })}
                        className="text-slate-400 hover:text-red-500 px-1"
                        title="Quitar"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => updateActivityData(index, { options: [...slide.activityData.options, ''] })}
                    className="text-xs text-violet-600 hover:text-violet-700 font-medium"
                  >
                    + Agregar palabra
                  </button>
                </div>
              </div>
            )}

            {/* MATCHING — pares izquierda ↔ derecha (se guardan como "izq::der") */}
            {slide.activityData.questionType === 'MATCHING' && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 block">Pares a emparejar</label>
                {slide.activityData.options.map((opt, oi) => {
                  const parts = String(opt).split('::')
                  const left = parts[0] || ''
                  const right = parts[1] || ''
                  const setPair = (l: string, r: string) => {
                    const updated = [...slide.activityData.options]
                    updated[oi] = `${l}::${r}`
                    updateActivityData(index, { options: updated })
                  }
                  return (
                    <div key={oi} className="flex items-center gap-2">
                      <input
                        value={left}
                        onChange={e => setPair(e.target.value, right)}
                        placeholder="Izquierda"
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
                      />
                      <span className="text-slate-400">↔</span>
                      <input
                        value={right}
                        onChange={e => setPair(left, e.target.value)}
                        placeholder="Derecha"
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
                      />
                      <button
                        onClick={() => updateActivityData(index, { options: slide.activityData.options.filter((_, j) => j !== oi) })}
                        className="text-slate-400 hover:text-red-500 px-1"
                        title="Quitar"
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
                <button
                  onClick={() => updateActivityData(index, { options: [...slide.activityData.options, '::'] })}
                  className="text-xs text-violet-600 hover:text-violet-700 font-medium"
                >
                  + Agregar par
                </button>
              </div>
            )}

            {/* FLASHCARDS — tarjetas frente ↔ reverso (se guardan como "frente::reverso") */}
            {slide.activityData.questionType === 'FLASHCARDS' && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 block">Tarjetas (frente ↔ reverso)</label>
                {slide.activityData.options.map((opt, oi) => {
                  const parts = String(opt).split('::')
                  const front = parts[0] || ''
                  const back = parts[1] || ''
                  const setCard = (f: string, b: string) => {
                    const updated = [...slide.activityData.options]
                    updated[oi] = `${f}::${b}`
                    updateActivityData(index, { options: updated })
                  }
                  return (
                    <div key={oi} className="flex items-center gap-2">
                      <input
                        value={front}
                        onChange={e => setCard(e.target.value, back)}
                        placeholder="Frente (p. ej. dog)"
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
                      />
                      <span className="text-slate-400">↔</span>
                      <input
                        value={back}
                        onChange={e => setCard(front, e.target.value)}
                        placeholder="Reverso (p. ej. perro)"
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
                      />
                      <button
                        onClick={() => updateActivityData(index, { options: slide.activityData.options.filter((_, j) => j !== oi) })}
                        className="text-slate-400 hover:text-red-500 px-1"
                        title="Quitar"
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
                <button
                  onClick={() => updateActivityData(index, { options: [...slide.activityData.options, '::'] })}
                  className="text-xs text-violet-600 hover:text-violet-700 font-medium"
                >
                  + Agregar tarjeta
                </button>
              </div>
            )}

            {/* WORDSEARCH — lista de palabras a esconder en la sopa de letras */}
            {slide.activityData.questionType === 'WORDSEARCH' && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 block">Palabras a encontrar</label>
                {slide.activityData.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input
                      value={opt}
                      onChange={e => {
                        const updated = [...slide.activityData.options]
                        updated[oi] = e.target.value
                        updateActivityData(index, { options: updated })
                      }}
                      placeholder="p. ej. AMAZONAS"
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
                    />
                    {slide.activityData.options.length > 1 && (
                      <button
                        onClick={() => updateActivityData(index, { options: slide.activityData.options.filter((_, k) => k !== oi) })}
                        className="text-slate-400 hover:text-rose-500 text-lg leading-none px-1"
                        title="Quitar"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => updateActivityData(index, { options: [...slide.activityData.options, ''] })}
                  className="text-xs text-violet-600 hover:text-violet-700 font-medium"
                >
                  + Agregar palabra
                </button>
                <p className="text-xs text-slate-400">Se ocultan en una rejilla generada automáticamente (horizontal, vertical y diagonal). Los acentos se ignoran. Se resuelve al encontrarlas todas.</p>
              </div>
            )}

            {/* CROSSWORD — pares respuesta ↔ pista (se guardan como "RESPUESTA::pista") */}
            {slide.activityData.questionType === 'CROSSWORD' && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 block">Respuestas y pistas</label>
                {slide.activityData.options.map((opt, oi) => {
                  const parts = String(opt).split('::')
                  const ans = parts[0] || ''
                  const clue = parts[1] || ''
                  const setPair = (a: string, c: string) => {
                    const updated = [...slide.activityData.options]
                    updated[oi] = `${a}::${c}`
                    updateActivityData(index, { options: updated })
                  }
                  return (
                    <div key={oi} className="flex items-center gap-2">
                      <input
                        value={ans}
                        onChange={e => setPair(e.target.value, clue)}
                        placeholder="Respuesta (p. ej. AMAZONAS)"
                        className="w-40 border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
                      />
                      <input
                        value={clue}
                        onChange={e => setPair(ans, e.target.value)}
                        placeholder="Pista (p. ej. El río más caudaloso)"
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
                      />
                      {slide.activityData.options.length > 1 && (
                        <button
                          onClick={() => updateActivityData(index, { options: slide.activityData.options.filter((_, k) => k !== oi) })}
                          className="text-slate-400 hover:text-rose-500 text-lg leading-none px-1"
                          title="Quitar"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  )
                })}
                <button
                  onClick={() => updateActivityData(index, { options: [...slide.activityData.options, '::'] })}
                  className="text-xs text-violet-600 hover:text-violet-700 font-medium"
                >
                  + Agregar palabra
                </button>
                <p className="text-xs text-slate-400">El tablero se entrelaza automáticamente. Los acentos se ignoran. Se resuelve al completar todas.</p>
              </div>
            )}

            {/* MEMORY — parejas de cartas (se guardan como "carta::pareja") */}
            {slide.activityData.questionType === 'MEMORY' && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 block">Parejas (carta ↔ pareja)</label>
                {slide.activityData.options.map((opt, oi) => {
                  const parts = String(opt).split('::')
                  const a = parts[0] || ''
                  const b = parts[1] || ''
                  const setPair = (x: string, y: string) => {
                    const updated = [...slide.activityData.options]
                    updated[oi] = `${x}::${y}`
                    updateActivityData(index, { options: updated })
                  }
                  return (
                    <div key={oi} className="flex items-center gap-2">
                      <input
                        value={a}
                        onChange={e => setPair(e.target.value, b)}
                        placeholder="Carta (p. ej. dog)"
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
                      />
                      <span className="text-slate-400">↔</span>
                      <input
                        value={b}
                        onChange={e => setPair(a, e.target.value)}
                        placeholder="Pareja (p. ej. perro)"
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
                      />
                      {slide.activityData.options.length > 1 && (
                        <button
                          onClick={() => updateActivityData(index, { options: slide.activityData.options.filter((_, k) => k !== oi) })}
                          className="text-slate-400 hover:text-rose-500 text-lg leading-none px-1"
                          title="Quitar"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  )
                })}
                <button
                  onClick={() => updateActivityData(index, { options: [...slide.activityData.options, '::'] })}
                  className="text-xs text-violet-600 hover:text-violet-700 font-medium"
                >
                  + Agregar pareja
                </button>
                <p className="text-xs text-slate-400">Cada pareja son dos cartas boca abajo. Se resuelve al emparejarlas todas.</p>
              </div>
            )}

            {/* LABEL_IMAGE — imagen + puntos (se guardan como "etiqueta::x::y", x/y en %) */}
            {slide.activityData.questionType === 'LABEL_IMAGE' && (() => {
              const hotspots = slide.activityData.options.map(o => {
                const p = String(o).split('::')
                return { label: p[0] || '', x: parseFloat(p[1]) || 0, y: parseFloat(p[2]) || 0 }
              })
              const setHotspots = (hs: { label: string; x: number; y: number }[]) =>
                updateActivityData(index, { options: hs.map(h => `${h.label}::${h.x}::${h.y}`) })
              const addAt = (e: React.MouseEvent<HTMLDivElement>) => {
                const r = e.currentTarget.getBoundingClientRect()
                const x = Math.round(((e.clientX - r.left) / r.width) * 100)
                const y = Math.round(((e.clientY - r.top) / r.height) * 100)
                setHotspots([...hotspots, { label: '', x, y }])
              }
              return (
                <div className="space-y-3">
                  <MediaInput kind="image" label="Imagen (célula, mapa, cuerpo humano…)" value={slide.activityData.imageUrl} onChange={v => updateActivityData(index, { imageUrl: v })} />
                  {slide.activityData.imageUrl ? (
                    <>
                      <p className="text-xs text-slate-400">Haz clic sobre la imagen para marcar cada punto; luego escribe su etiqueta abajo.</p>
                      <div className="relative inline-block border border-slate-200 rounded-lg overflow-hidden cursor-crosshair" onClick={addAt}>
                        <SmartImg src={slide.activityData.imageUrl} alt="" className="block max-w-full max-h-72" />
                        {hotspots.map((h, i) => (
                          <span key={i} style={{ left: `${h.x}%`, top: `${h.y}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white shadow pointer-events-none">{i + 1}</span>
                        ))}
                      </div>
                      <div className="space-y-1.5">
                        {hotspots.map((h, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                            <input
                              value={h.label}
                              onChange={e => { const hs = [...hotspots]; hs[i] = { ...h, label: e.target.value }; setHotspots(hs) }}
                              placeholder="Etiqueta (p. ej. Núcleo)"
                              className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
                            />
                            <span className="text-xs text-slate-400 tabular-nums w-14 text-right">{h.x}%, {h.y}%</span>
                            <button onClick={() => setHotspots(hotspots.filter((_, k) => k !== i))} className="text-slate-400 hover:text-rose-500 text-lg leading-none px-1" title="Quitar">×</button>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-slate-400">Se resuelve cuando el alumno etiqueta todos los puntos correctamente.</p>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400">Pega la URL de una imagen para empezar a marcar puntos.</p>
                  )}
                </div>
              )
            })()}

            {/* PUZZLE — imagen + dificultad N×N (options[0] = N) */}
            {slide.activityData.questionType === 'PUZZLE' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Imagen (URL)</label>
                  <input
                    value={slide.activityData.imageUrl}
                    onChange={e => updateActivityData(index, { imageUrl: e.target.value })}
                    placeholder="https://… (paisaje, obra de arte, diagrama…)"
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Dificultad</label>
                  <div className="flex gap-2">
                    {[2, 3, 4].map(nn => {
                      const active = (parseInt(slide.activityData.options[0] || '3') || 3) === nn
                      return (
                        <button key={nn} onClick={() => updateActivityData(index, { options: [String(nn)] })}
                          className={`px-3 py-1.5 rounded-lg border text-sm font-medium ${active ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-500 hover:border-violet-300'}`}>
                          {nn}×{nn}
                        </button>
                      )
                    })}
                  </div>
                </div>
                {slide.activityData.imageUrl ? (
                  <div className="inline-block border border-slate-200 rounded-lg overflow-hidden">
                    <img src={slide.activityData.imageUrl} alt="" className="block max-w-full max-h-56" draggable={false} />
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Pega la URL de una imagen; se partirá en piezas automáticamente y el alumno la arma.</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Puntos</label>
                <input
                  type="number"
                  value={slide.activityData.points}
                  onChange={e => updateActivityData(index, { points: parseInt(e.target.value) || 10 })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Pista</label>
                <input
                  value={slide.activityData.hint}
                  onChange={e => updateActivityData(index, { hint: e.target.value })}
                  placeholder="Pista opcional..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Explicación</label>
              <textarea
                value={slide.activityData.explanation}
                onChange={e => updateActivityData(index, { explanation: e.target.value })}
                placeholder="Explica por qué esta es la respuesta correcta..."
                rows={2}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none"
              />
            </div>

            {/* Retroalimentación predefinida por resultado (setpoints del docente §7) */}
            {slide.activityData.questionType !== 'FLASHCARDS' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-emerald-600 mb-1 block">Feedback si acierta</label>
                  <input
                    value={slide.activityData.feedbackCorrect}
                    onChange={e => updateActivityData(index, { feedbackCorrect: e.target.value })}
                    placeholder="¡Muy bien! (opcional)"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-rose-600 mb-1 block">Feedback si falla</label>
                  <input
                    value={slide.activityData.feedbackIncorrect}
                    onChange={e => updateActivityData(index, { feedbackIncorrect: e.target.value })}
                    placeholder="Casi… vuelve a leer (opcional)"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}
          </div>
    )
  }

  function renderSlideEditor(slide: SlideForm, index: number) {
    const typeInfo = SLIDE_TYPE_LABELS[slide.type] || SLIDE_TYPE_LABELS.CONTENT

    return (
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Slide header */}
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${typeInfo.color} flex items-center justify-center`}>
            <typeInfo.icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Slide {index + 1}: {typeInfo.label}</h3>
            <select
              value={slide.type}
              onChange={e => updateSlide(index, { type: e.target.value as SlideForm['type'] })}
              className="text-xs text-slate-500 bg-transparent border-none p-0 cursor-pointer"
            >
              {Object.entries(SLIDE_TYPE_LABELS).map(([val, info]) => (
                <option key={val} value={val}>{info.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* CONTENT slide — motor de bloques (docs/MOTOR_LECCIONES.md P2 corte 2):
            título + pila de bloques (texto/imagen/video/audio/tabla) que el docente
            combina y reordena arrastrando. Reemplaza los campos fijos. */}
        {slide.type === 'CONTENT' && (
          <div className="space-y-3 bg-white rounded-xl border border-slate-200 p-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Título</label>
              <input
                value={slide.title}
                onChange={e => updateSlide(index, { title: e.target.value })}
                placeholder="Título del slide"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm"
              />
            </div>
            <BlockStackEditor
              blocks={slide.blocks || legacyToBlocks(slide)}
              onChange={b => updateSlide(index, { blocks: b })}
            />
          </div>
        )}

        {/* ACTIVITY slide fields */}
        {slide.type === 'ACTIVITY' && renderActivityEditor(slide, index)}

        {/* CHECKPOINT slide */}
        {slide.type === 'CHECKPOINT' && (
          <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-6 text-center">
            <Flag className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <h4 className="font-bold text-emerald-800 mb-1">Punto de control</h4>
            <p className="text-sm text-emerald-600">
              Si el estudiante sale de la lección, regresará a este punto.
              No requiere configuración adicional.
            </p>
          </div>
        )}

        {/* BADGE_REVEAL slide */}
        {slide.type === 'BADGE_REVEAL' && (
          <div className="bg-purple-50 rounded-xl border border-purple-200 p-6 text-center space-y-3">
            <div
              className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center text-4xl shadow-lg"
              style={{ backgroundColor: badgeColor }}
            >
              {slide.badgeEmoji || badgeEmoji || '🏆'}
            </div>
            <h4 className="font-bold text-purple-800">Slide de Insignia</h4>
            <p className="text-sm text-purple-600 mb-3">
              Este es el último slide. Al completarlo, el estudiante recibe su insignia con confetti.
            </p>
            <div className="flex gap-2 justify-center">
              <input
                value={slide.badgeEmoji || badgeEmoji}
                onChange={e => updateSlide(index, { badgeEmoji: e.target.value })}
                placeholder="Emoji"
                className="w-16 text-center text-2xl border border-purple-200 rounded-lg px-2 py-1"
              />
              <input
                value={slide.badgeTitle || badgeTitle}
                onChange={e => updateSlide(index, { badgeTitle: e.target.value })}
                placeholder="Título del badge"
                className="flex-1 border border-purple-200 rounded-lg px-3 py-1 text-sm"
              />
            </div>
          </div>
        )}
      </div>
    )
  }
}
