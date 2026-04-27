import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { classroomApi } from '../../lib/api'
import { playPanelApi } from '../../lib/playApi'
import {
  ArrowLeft,
  BookOpen,
  Check,
  GripVertical,
  Image as ImageIcon,
  LayoutTemplate,
  Loader2,
  Plus,
  Presentation,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'

type SlideType = 'CONTENT' | 'ACTIVITY' | 'CHECKPOINT' | 'BADGE_REVEAL'

interface LessonSlide {
  id: string
  type: SlideType
  sortOrder: number
  title?: string | null
  body?: string | null
  imageUrl?: string | null
  videoUrl?: string | null
  audioUrl?: string | null
  layout?: string | null
  activityData?: any
  badgeEmoji?: string | null
  badgeTitle?: string | null
}

interface LessonResponse {
  id: string
  title: string
  description?: string | null
  lesson: {
    id: string
    title: string
    description?: string | null
    playMode?: string | null
    slides: LessonSlide[]
  }
}

const SLIDE_TYPES: Array<{ value: SlideType; label: string }> = [
  { value: 'CONTENT', label: 'Contenido' },
  { value: 'ACTIVITY', label: 'Actividad' },
  { value: 'CHECKPOINT', label: 'Checkpoint' },
  { value: 'BADGE_REVEAL', label: 'Badge' },
]

const DEFAULT_SLIDE_BY_TYPE: Record<SlideType, Partial<LessonSlide>> = {
  CONTENT: { title: 'Nuevo slide', body: '', layout: 'text-left-image-right' },
  ACTIVITY: { title: 'Nueva actividad', body: '', activityData: { question: '', options: ['', '', '', ''], correctAnswer: 0 } },
  CHECKPOINT: { title: 'Checkpoint', body: 'Resumen o pausa pedagógica' },
  BADGE_REVEAL: { title: 'Logro desbloqueado', badgeEmoji: '🏆', badgeTitle: '¡Excelente trabajo!' },
}

export default function PlayLessonEditor() {
  const { lessonId } = useParams<{ lessonId: string }>()
  const navigate = useNavigate()
  const [lesson, setLesson] = useState<LessonResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState('')
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [draggedSlideId, setDraggedSlideId] = useState<string | null>(null)
  const debounceRef = useRef<number | null>(null)

  const loadLesson = useCallback(async () => {
    if (!lessonId) return
    setLoading(true)
    try {
      const res = await playPanelApi.getLesson(lessonId)
      const data = res.data as LessonResponse
      setLesson(data)
      setSelectedSlideId((prev) => prev ?? data.lesson.slides[0]?.id ?? null)
      setError('')
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error al cargar la lección')
    } finally {
      setLoading(false)
    }
  }, [lessonId])

  useEffect(() => {
    loadLesson()
  }, [loadLesson])

  const slides = lesson?.lesson.slides || []
  const selectedSlide = useMemo(
    () => slides.find((slide) => slide.id === selectedSlideId) || slides[0] || null,
    [slides, selectedSlideId],
  )

  useEffect(() => {
    if (!selectedSlide && slides.length > 0) {
      setSelectedSlideId(slides[0].id)
    }
  }, [selectedSlide, slides])

  const replaceSlide = useCallback((slideId: string, updater: (slide: LessonSlide) => LessonSlide) => {
    setLesson((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        lesson: {
          ...prev.lesson,
          slides: prev.lesson.slides.map((slide) => (slide.id === slideId ? updater(slide) : slide)),
        },
      }
    })
  }, [])

  const persistSlide = useCallback(async (slide: LessonSlide) => {
    if (!lessonId) return
    setSavingState('saving')
    try {
      await playPanelApi.updateLessonSlide(lessonId, slide.id, {
        type: slide.type,
        title: slide.title ?? null,
        body: slide.body ?? null,
        imageUrl: slide.imageUrl ?? null,
        videoUrl: slide.videoUrl ?? null,
        audioUrl: slide.audioUrl ?? null,
        layout: slide.layout ?? null,
        activityData: slide.activityData ?? null,
        badgeEmoji: slide.badgeEmoji ?? null,
        badgeTitle: slide.badgeTitle ?? null,
      })
      setSavingState('saved')
      window.clearTimeout(debounceRef.current ?? undefined)
      debounceRef.current = window.setTimeout(() => setSavingState('idle'), 1200)
    } catch {
      setSavingState('error')
      setError('No se pudo guardar el slide')
    }
  }, [lessonId])

  const queueSave = useCallback((nextSlide: LessonSlide) => {
    window.clearTimeout(debounceRef.current ?? undefined)
    setSavingState('saving')
    debounceRef.current = window.setTimeout(() => {
      persistSlide(nextSlide)
    }, 1500)
  }, [persistSlide])

  useEffect(() => {
    return () => {
      window.clearTimeout(debounceRef.current ?? undefined)
    }
  }, [])

  const updateSelectedSlide = (patch: Partial<LessonSlide>) => {
    if (!selectedSlide) return
    const nextSlide = { ...selectedSlide, ...patch }
    replaceSlide(selectedSlide.id, () => nextSlide)
    queueSave(nextSlide)
  }

  const handleCreateSlide = async (type: SlideType) => {
    if (!lessonId) return
    try {
      const defaults = DEFAULT_SLIDE_BY_TYPE[type]
      const payload: {
        type: SlideType
        title?: string
        body?: string
        imageUrl?: string
        videoUrl?: string
        audioUrl?: string
        layout?: string
        activityData?: any
        badgeEmoji?: string
        badgeTitle?: string
      } = {
        type,
        title: defaults.title ?? undefined,
        body: defaults.body ?? undefined,
        imageUrl: defaults.imageUrl ?? undefined,
        videoUrl: defaults.videoUrl ?? undefined,
        audioUrl: defaults.audioUrl ?? undefined,
        layout: defaults.layout ?? undefined,
        activityData: defaults.activityData ?? undefined,
        badgeEmoji: defaults.badgeEmoji ?? undefined,
        badgeTitle: defaults.badgeTitle ?? undefined,
      }
      const res = await playPanelApi.createLessonSlide(lessonId, payload)
      const created = res.data as LessonSlide
      setLesson((prev) => prev ? {
        ...prev,
        lesson: {
          ...prev.lesson,
          slides: [...prev.lesson.slides, created].sort((a, b) => a.sortOrder - b.sortOrder),
        },
      } : prev)
      setSelectedSlideId(created.id)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo crear el slide')
    }
  }

  const handleDeleteSlide = async (slideId: string) => {
    if (!lessonId || !confirm('¿Eliminar este slide?')) return
    try {
      await playPanelApi.deleteLessonSlide(lessonId, slideId)
      setLesson((prev) => prev ? {
        ...prev,
        lesson: {
          ...prev.lesson,
          slides: prev.lesson.slides.filter((slide) => slide.id !== slideId).map((slide, index) => ({ ...slide, sortOrder: index })),
        },
      } : prev)
      setSelectedSlideId((prev) => (prev === slideId ? null : prev))
    } catch {
      setError('No se pudo eliminar el slide')
    }
  }

  const reorderSlides = async (ordered: LessonSlide[]) => {
    if (!lessonId) return
    setLesson((prev) => prev ? {
      ...prev,
      lesson: {
        ...prev.lesson,
        slides: ordered.map((slide, index) => ({ ...slide, sortOrder: index })),
      },
    } : prev)
    try {
      await playPanelApi.reorderLessonSlides(lessonId, ordered.map((slide) => slide.id))
    } catch {
      setError('No se pudo reordenar los slides')
      loadLesson()
    }
  }

  const handleDropOnSlide = async (targetSlideId: string) => {
    if (!draggedSlideId || draggedSlideId === targetSlideId) return
    const current = [...slides]
    const fromIndex = current.findIndex((slide) => slide.id === draggedSlideId)
    const toIndex = current.findIndex((slide) => slide.id === targetSlideId)
    if (fromIndex < 0 || toIndex < 0) return
    const [moved] = current.splice(fromIndex, 1)
    current.splice(toIndex, 0, moved)
    setDraggedSlideId(null)
    await reorderSlides(current)
  }

  const handleUploadImage = async () => {
    if (!selectedSlide) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      setUploadingImage(true)
      try {
        const response = await classroomApi.uploadMaterial(file)
        const uploadedUrl = response.data?.data?.url || response.data?.data?.path || response.data?.url || response.data?.path
        if (uploadedUrl) {
          updateSelectedSlide({ imageUrl: uploadedUrl })
        } else {
          setError('No se pudo obtener la URL de la imagen subida')
        }
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Error al subir imagen')
      } finally {
        setUploadingImage(false)
      }
    }
    input.click()
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-fuchsia-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/play/lessons')} className="rounded-lg p-2 transition hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
              <BookOpen className="h-6 w-6 text-fuchsia-500" />
              {lesson?.title || 'Editor de lección'}
            </h1>
            <p className="text-sm text-gray-500">Slides sincronizados tipo Nearpod con auto-guardado</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {savingState === 'saving' && <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-amber-700"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando...</span>}
          {savingState === 'saved' && <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700"><Check className="h-3.5 w-3.5" /> Guardado</span>}
          {savingState === 'error' && <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-red-700">Error al guardar</span>}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">Slides</h2>
            <span className="text-xs text-gray-400">{slides.length}</span>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2">
            {SLIDE_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => handleCreateSlide(type.value)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-fuchsia-200 bg-fuchsia-50 px-3 py-2 text-xs font-semibold text-fuchsia-700 transition hover:bg-fuchsia-100"
              >
                <Plus className="h-3.5 w-3.5" /> {type.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                draggable
                onDragStart={() => setDraggedSlideId(slide.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDropOnSlide(slide.id)}
                onClick={() => setSelectedSlideId(slide.id)}
                className={`w-full rounded-2xl border p-3 text-left transition ${selectedSlide?.id === slide.id ? 'border-fuchsia-400 bg-fuchsia-50' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-500">{index + 1}. {slide.type}</span>
                  <GripVertical className="h-4 w-4 text-gray-400" />
                </div>
                <div className="line-clamp-2 text-sm font-semibold text-gray-900">{slide.title || 'Sin título'}</div>
                <div className="mt-1 line-clamp-2 text-xs text-gray-500">{slide.body || slide.badgeTitle || 'Sin contenido todavía'}</div>
              </button>
            ))}
            {slides.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                Agrega tu primer slide.
              </div>
            )}
          </div>
        </aside>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          {!selectedSlide ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center text-center text-gray-500">
              <Presentation className="mb-3 h-10 w-10 text-fuchsia-300" />
              Selecciona o crea un slide para comenzar.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Editor de slide</h2>
                  <p className="text-sm text-gray-500">Tipo: {selectedSlide.type}</p>
                </div>
                <button
                  onClick={() => handleDeleteSlide(selectedSlide.id)}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
                >
                  <Trash2 className="h-4 w-4" /> Eliminar
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Tipo</label>
                  <select
                    value={selectedSlide.type}
                    onChange={(e) => updateSelectedSlide({ type: e.target.value as SlideType })}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500"
                  >
                    {SLIDE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Layout</label>
                  <input
                    value={selectedSlide.layout || ''}
                    onChange={(e) => updateSelectedSlide({ layout: e.target.value })}
                    placeholder="text-left-image-right"
                    className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Título</label>
                <input
                  value={selectedSlide.title || ''}
                  onChange={(e) => updateSelectedSlide({ title: e.target.value })}
                  placeholder="Título del slide"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Contenido</label>
                <textarea
                  value={selectedSlide.body || ''}
                  onChange={(e) => updateSelectedSlide({ body: e.target.value })}
                  rows={8}
                  placeholder="Texto principal del slide..."
                  className="w-full resize-none rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Imagen</label>
                  <div className="flex gap-2">
                    <input
                      value={selectedSlide.imageUrl || ''}
                      onChange={(e) => updateSelectedSlide({ imageUrl: e.target.value })}
                      placeholder="URL de imagen"
                      className="flex-1 rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500"
                    />
                    <button
                      type="button"
                      onClick={handleUploadImage}
                      disabled={uploadingImage}
                      className="inline-flex items-center gap-2 rounded-xl border border-fuchsia-200 bg-fuchsia-50 px-3 py-2.5 text-sm font-medium text-fuchsia-700 transition hover:bg-fuchsia-100 disabled:opacity-50"
                    >
                      {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      Subir
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Video URL</label>
                  <input
                    value={selectedSlide.videoUrl || ''}
                    onChange={(e) => updateSelectedSlide({ videoUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500"
                  />
                </div>
              </div>

              {selectedSlide.type === 'BADGE_REVEAL' && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Emoji</label>
                    <input
                      value={selectedSlide.badgeEmoji || ''}
                      onChange={(e) => updateSelectedSlide({ badgeEmoji: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Título del badge</label>
                    <input
                      value={selectedSlide.badgeTitle || ''}
                      onChange={(e) => updateSelectedSlide({ badgeTitle: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500"
                    />
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-fuchsia-100 bg-fuchsia-50/50 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-fuchsia-800">
                  <LayoutTemplate className="h-4 w-4" /> Vista previa
                </div>
                <div className="rounded-2xl border border-white bg-white p-5 shadow-sm">
                  <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-gray-400">
                    <Sparkles className="h-3.5 w-3.5" /> {selectedSlide.type}
                  </div>
                  <h3 className="mb-2 text-xl font-black text-gray-900">{selectedSlide.title || 'Sin título'}</h3>
                  {selectedSlide.imageUrl && (
                    <img src={selectedSlide.imageUrl} alt="Slide" className="mb-4 h-48 w-full rounded-xl border border-gray-200 object-cover" />
                  )}
                  <p className="whitespace-pre-wrap text-sm text-gray-700">{selectedSlide.body || 'Agrega contenido para visualizar este slide.'}</p>
                  {selectedSlide.type === 'BADGE_REVEAL' && (
                    <div className="mt-4 rounded-xl bg-fuchsia-100 px-4 py-3 text-center text-fuchsia-800">
                      <div className="text-3xl">{selectedSlide.badgeEmoji || '🏆'}</div>
                      <div className="mt-1 font-bold">{selectedSlide.badgeTitle || 'Badge desbloqueado'}</div>
                    </div>
                  )}
                  {selectedSlide.type === 'ACTIVITY' && (
                    <div className="mt-4 rounded-xl border border-dashed border-fuchsia-200 bg-fuchsia-50 px-4 py-3 text-sm text-fuchsia-700">
                      Mini-quiz embebido: la estructura de `activityData` queda lista para enriquecerla en la siguiente iteración.
                    </div>
                  )}
                  {!selectedSlide.imageUrl && (
                    <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
                      <ImageIcon className="h-3.5 w-3.5" /> Sin imagen
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
