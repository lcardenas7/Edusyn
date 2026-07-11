import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import {
  ArrowLeft, BookOpen, CheckCircle2, ChevronDown, ChevronUp, Eye,
  Flag, GripVertical, Loader2, Pencil, Play, Plus, Save, Sparkles,
  Trash2, Trophy, Type, X, Image, Video, Music, Wand2
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
  }
  badgeEmoji: string
  badgeTitle: string
}

const EMPTY_ACTIVITY_DATA = {
  questionType: 'MULTIPLE_CHOICE',
  question: '',
  options: ['', '', '', ''],
  correctAnswer: '',
  explanation: '',
  points: 10,
  hint: '',
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

export default function LessonEditor({
  activityId, activityTitle, classroomTitle, gradeName, subjectName, onClose, onPreview,
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
      setSlides([
        createEmptySlide('CONTENT', 0),
        createEmptySlide('BADGE_REVEAL', 1),
      ])
    } finally {
      setLoading(false)
    }
  }, [activityId])

  useEffect(() => { loadLesson() }, [loadLesson])

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
      } : { ...EMPTY_ACTIVITY_DATA },
      badgeEmoji: s.badgeEmoji || '',
      badgeTitle: s.badgeTitle || '',
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
        } : undefined,
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

        {/* CONTENT slide fields */}
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
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Contenido (HTML)</label>
              <textarea
                value={slide.body}
                onChange={e => updateSlide(index, { body: e.target.value })}
                placeholder="<p>Escribe el contenido aquí...</p>"
                rows={6}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block flex items-center gap-1">
                  <Image className="w-3 h-3" /> URL imagen
                </label>
                <input
                  value={slide.imageUrl}
                  onChange={e => updateSlide(index, { imageUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block flex items-center gap-1">
                  <Video className="w-3 h-3" /> URL video
                </label>
                <input
                  value={slide.videoUrl}
                  onChange={e => updateSlide(index, { videoUrl: e.target.value })}
                  placeholder="https://youtube.com/..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block flex items-center gap-1">
                  <Music className="w-3 h-3" /> URL audio
                </label>
                <input
                  value={slide.audioUrl}
                  onChange={e => updateSlide(index, { audioUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Layout</label>
                <select
                  value={slide.layout}
                  onChange={e => updateSlide(index, { layout: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                >
                  {LAYOUT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ACTIVITY slide fields */}
        {slide.type === 'ACTIVITY' && (
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
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                {slide.activityData.questionType === 'ORDERING' || slide.activityData.questionType === 'MATCHING' ? 'Instrucción'
                  : slide.activityData.questionType === 'LISTENING' ? 'Texto que se escuchará (no se muestra)'
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
          </div>
        )}

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
