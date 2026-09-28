import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeft, BookOpen, Check, ChevronRight, Pencil, Plus, Save } from 'lucide-react'
import api from '../../lib/api/client'

type Question = { id: string; type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE'; text: string; options: string[]; correctAnswer: string; explanation: string | null }
type Collection = { id: string; officialCatalogId?: string | null; title: string; subjectArea: string; category: string; isPublished: boolean; canEdit: boolean; questions: Question[] }
type OfficialCatalog = { catalogId: string; title: string; grade: number; subjectArea: string; category: string; version: string; questionCount: number; imported: boolean };
type Bank = { grade: { id: string; name: string }; collections: Collection[]; targetActivities: { id: string; title: string; type: string }[] }
type CollectionForm = { title: string; subjectArea: string; category: string; isPublished: boolean }
type QuestionForm = { type: Question['type']; text: string; options: string[]; correctAnswer: string; explanation: string }
const emptyCollection: CollectionForm = { title: '', subjectArea: '', category: '', isPublished: false }
const emptyQuestion: QuestionForm = { type: 'MULTIPLE_CHOICE', text: '', options: ['', '', '', ''], correctAnswer: '', explanation: '' }

function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message
    if (typeof message === 'string') return message
    if (Array.isArray(message)) return message.join(' · ')
  }
  return 'No se pudo guardar. Revisa los datos e intenta de nuevo.'
}

export default function QuestionBank() {
  const { classroomId } = useParams<{ classroomId: string }>()
  const [bank, setBank] = useState<Bank | null>(null)
  const [officialCatalogs, setOfficialCatalogs] = useState<OfficialCatalog[]>([])
  const [collectionId, setCollectionId] = useState<string | null>(null)
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null)
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null)
  const [collectionForm, setCollectionForm] = useState<CollectionForm>(emptyCollection)
  const [questionForm, setQuestionForm] = useState<QuestionForm>(emptyQuestion)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [targetActivityId, setTargetActivityId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refresh = useCallback(async () => {
    if (!classroomId) return
    const [response, official] = await Promise.all([api.get<Bank>(`/question-bank/classrooms/${classroomId}`), api.get<OfficialCatalog[]>(`/question-bank/classrooms/${classroomId}/official`)])
    setBank(response.data)
    setOfficialCatalogs(official.data)
  }, [classroomId])
  useEffect(() => { refresh().catch((err) => setError(errorMessage(err))).finally(() => setLoading(false)) }, [refresh])

  const selected = bank?.collections.find((collection) => collection.id === collectionId) ?? null
  const categories = useMemo(() => [...new Set((bank?.collections ?? []).map((collection) => `${collection.subjectArea} · ${collection.category}`))].sort((a, b) => a.localeCompare(b, 'es')), [bank])
  const visible = (bank?.collections ?? []).filter((collection) => !categoryFilter || `${collection.subjectArea} · ${collection.category}` === categoryFilter)

  function select(collection: Collection) { setCollectionId(collection.id); setEditingQuestionId(null); setQuestionForm(emptyQuestion); setError(''); setNotice('') }
  function editCollection(collection: Collection) { setEditingCollectionId(collection.id); setCollectionForm({ title: collection.title, subjectArea: collection.subjectArea, category: collection.category, isPublished: collection.isPublished }); setError(''); setNotice('') }
  function editQuestion(question: Question) { setEditingQuestionId(question.id); setQuestionForm({ type: question.type, text: question.text, options: question.type === 'TRUE_FALSE' ? ['Verdadero', 'Falso'] : [...question.options, ...Array(Math.max(0, 4 - question.options.length)).fill('')], correctAnswer: question.correctAnswer, explanation: question.explanation ?? '' }); setError(''); setNotice('') }
  function resetCollection() { setEditingCollectionId(null); setCollectionForm(emptyCollection) }
  function resetQuestion() { setEditingQuestionId(null); setQuestionForm(emptyQuestion) }

  async function saveCollection() {
    if (!classroomId) return
    setSaving(true); setError(''); setNotice('')
    try {
      const base = `/question-bank/classrooms/${classroomId}/collections`
      const response = editingCollectionId ? await api.put<Bank>(`${base}/${editingCollectionId}`, collectionForm) : await api.post<Bank>(base, collectionForm)
      setBank(response.data)
      setCollectionId(editingCollectionId ?? response.data.collections[0]?.id ?? null)
      resetCollection()
      setNotice('Cuestionario guardado. Ahora puedes agregarle preguntas.')
    } catch (err) { setError(errorMessage(err)) } finally { setSaving(false) }
  }

  async function saveQuestion() {
    if (!classroomId || !selected) return
    setSaving(true); setError(''); setNotice('')
    const base = `/question-bank/classrooms/${classroomId}/collections/${selected.id}/questions`
    const payload = { ...questionForm, options: questionForm.type === 'TRUE_FALSE' ? ['Verdadero', 'Falso'] : questionForm.options.map((option) => option.trim()).filter(Boolean), explanation: questionForm.explanation.trim() || null }
    try {
      const response = editingQuestionId ? await api.put<Bank>(`${base}/${editingQuestionId}`, payload) : await api.post<Bank>(base, payload)
      setBank(response.data)
      resetQuestion()
      setNotice('Pregunta guardada en el cuestionario.')
    } catch (err) { setError(errorMessage(err)) } finally { setSaving(false) }
  }

  async function copyToActivity() {
    if (!classroomId || !selected || !targetActivityId) return
    setSaving(true); setError(''); setNotice('')
    try {
      const response = await api.post<{ copied: number }>(`/question-bank/classrooms/${classroomId}/collections/${selected.id}/copy-to/${targetActivityId}`)
      setNotice(`${response.data.copied} preguntas copiadas al quiz en borrador. Puedes revisarlas en Actividades antes de publicarlo.`)
    } catch (err) { setError(errorMessage(err)) } finally { setSaving(false) }
  }

  return <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#f2f4f0] text-[#19302e]">
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-5 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3"><Link to={`/aula/${classroomId}/actividades`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#c6d7cf] bg-white px-4 text-sm font-bold text-[#285e4d]"><ArrowLeft size={17} /> Actividades</Link><Link to={`/aula/${classroomId}/duelos`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#263455] px-4 text-sm font-bold text-white">Ver Arena <ChevronRight size={17} /></Link></header>
      <div className="mt-8"><p className="text-xs font-black uppercase tracking-[.2em] text-[#527a68]">Biblioteca docente · {bank?.grade.name ?? 'Grado'}</p><h1 className="mt-2 flex items-center gap-3 text-3xl font-black tracking-tight sm:text-4xl"><BookOpen className="text-[#1f806d]" /> Banco de cuestionarios</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-[#536862]">Crea tu cuestionario, asigna una materia y una categoría, y añade sus preguntas. Este banco es independiente de Arena: los docentes del mismo grado pueden consultarlo y los cuestionarios publicados pueden alimentar distintas experiencias.</p></div>
      {error && <p role="alert" className="mt-5 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}{notice && <p role="status" className="mt-5 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</p>}{loading && <p className="mt-8 text-sm">Cargando banco…</p>}
      {bank && <main className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-[#b9d9cb] bg-gradient-to-br from-[#eff8f1] to-white p-5 shadow-sm sm:p-6"><p className="text-xs font-black uppercase tracking-[.16em] text-[#28715c]">Banco oficial opcional</p><h2 className="mt-1 text-xl font-black">Disponible para tu institución</h2><p className="mt-2 max-w-xl text-sm leading-5 text-[#536862]">Puedes importarlo y usarlo en Arena, o ignorarlo y crear tus propios cuestionarios. Puedes importar bancos de tu grado o de hasta dos grados anteriores; se copiarán al grado actual como bancos publicados.</p><div className="mt-4 space-y-2">{officialCatalogs.length === 0 && <p className="rounded-xl bg-white/80 p-3 text-sm text-[#64776d]">Aún no hay bancos oficiales completos para {bank.grade.name}.</p>}{officialCatalogs.map((catalog) => <div key={catalog.catalogId} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d1e4d9] bg-white p-4"><div><strong className="block">{catalog.title}</strong><span className="text-sm text-[#64776d]">{catalog.questionCount} preguntas · banco de {catalog.grade}.º · versión {catalog.version}</span></div><button type="button" disabled={saving || catalog.imported} onClick={async () => { setSaving(true); setError(''); setNotice(''); try { const response = await api.post<Bank>(`/question-bank/classrooms/${classroomId}/official/${catalog.catalogId}/import`); setBank(response.data); setOfficialCatalogs((items) => items.map((item) => item.catalogId === catalog.catalogId ? { ...item, imported: true } : item)); setCollectionId(response.data.collections.find((item) => item.officialCatalogId === catalog.catalogId)?.id ?? null); setNotice(`Banco oficial ${catalog.title} importado para ${response.data.grade.name}; ya está disponible para Arena.`); } catch (err) { setError(errorMessage(err)); } finally { setSaving(false); } }} className="min-h-11 rounded-xl bg-[#1f806d] px-4 font-bold text-white disabled:opacity-50">{catalog.imported ? 'Ya importado' : 'Usar este banco'}</button></div>)}</div></section>
          <section className="rounded-3xl border border-[#d5e0d8] bg-white p-5 shadow-sm sm:p-7"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black">{editingCollectionId ? 'Editar cuestionario' : 'Crear cuestionario'}</h2>{editingCollectionId && <button type="button" onClick={resetCollection} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-[#52665e]">Cancelar</button>}</div><div className="mt-4 space-y-4"><label className="block text-sm font-semibold">Título<input value={collectionForm.title} onChange={(event) => setCollectionForm({ ...collectionForm, title: event.target.value })} placeholder="Reto de fracciones" maxLength={120} className="mt-1.5 min-h-12 w-full rounded-xl border border-[#cbd8d0] px-3" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Materia<input value={collectionForm.subjectArea} onChange={(event) => setCollectionForm({ ...collectionForm, subjectArea: event.target.value })} placeholder="Matemáticas" maxLength={80} className="mt-1.5 min-h-12 w-full rounded-xl border border-[#cbd8d0] px-3" /></label><label className="text-sm font-semibold">Categoría<input value={collectionForm.category} onChange={(event) => setCollectionForm({ ...collectionForm, category: event.target.value })} placeholder="Fracciones" maxLength={80} className="mt-1.5 min-h-12 w-full rounded-xl border border-[#cbd8d0] px-3" /></label></div><label className="flex items-start gap-3 rounded-xl bg-[#edf4ee] p-3 text-sm"><input type="checkbox" checked={collectionForm.isPublished} onChange={(event) => setCollectionForm({ ...collectionForm, isPublished: event.target.checked })} className="mt-0.5 h-5 w-5 accent-[#1f806d]" /><span><strong>Publicar para experiencias</strong><span className="mt-0.5 block text-[#536862]">Cuando tenga suficientes preguntas, Arena podrá usarlo en duelos de este grado.</span></span></label></div><button type="button" disabled={saving} onClick={saveCollection} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1f806d] px-5 font-bold text-white disabled:opacity-50"><Save size={18} /> {saving ? 'Guardando…' : editingCollectionId ? 'Guardar cuestionario' : 'Crear cuestionario'}</button></section>
          <section className="rounded-3xl border border-[#d5e0d8] bg-white p-5 shadow-sm sm:p-7"><div className="flex items-center justify-between"><h2 className="text-xl font-black">Cuestionarios del grado</h2><span className="text-sm font-bold text-[#527a68]">{bank.collections.length}</span></div><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filtrar categoría" className="mt-4 min-h-11 w-full rounded-xl border border-[#cbd8d0] bg-white px-3"><option value="">Todas las categorías</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select><div className="mt-4 space-y-2">{visible.length === 0 && <p className="rounded-xl bg-[#f4f6f3] p-4 text-sm text-[#5c6f66]">Crea el primer cuestionario del grado.</p>}{visible.map((collection) => <div key={collection.id} className={`flex items-start gap-2 rounded-xl border p-3 ${collectionId === collection.id ? 'border-[#1f806d] bg-[#edf8f1]' : 'border-[#d5e0d8]'}`}><button type="button" onClick={() => select(collection)} className="min-h-11 min-w-0 flex-1 text-left"><strong className="block truncate">{collection.title}</strong><span className="mt-1 block text-xs text-[#5b7166]">{collection.subjectArea} · {collection.category} · {collection.questions.length} preguntas</span><span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${collection.isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{collection.isPublished ? 'Publicado' : 'Borrador'}</span></button>{collection.canEdit && <button type="button" onClick={() => editCollection(collection)} aria-label={`Editar ${collection.title}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-[#1f806d] hover:bg-[#dcefe5]"><Pencil size={17} /></button>}</div>)}</div></section>
        </div>

        <section className="rounded-3xl border border-[#d5e0d8] bg-white p-5 shadow-sm sm:p-7">{!selected ? <div className="flex min-h-[300px] flex-col items-center justify-center text-center"><BookOpen size={42} className="text-[#1f806d]" /><h2 className="mt-4 text-xl font-black">Elige o crea un cuestionario</h2><p className="mt-2 max-w-sm text-sm text-[#64776d]">Aquí prepararás sus preguntas. El tema y el grado ya quedan asociados al cuestionario.</p></div> : <><span className="rounded-full bg-[#dcefe9] px-3 py-1 text-xs font-bold text-[#236453]">{selected.subjectArea} · {selected.category}</span><h2 className="mt-3 text-2xl font-black">{selected.title}</h2><p className="mt-1 text-sm text-[#64776d]">{selected.questions.length} preguntas · {Math.max(0, 7 - selected.questions.length)} para llegar al mínimo de una categoría en Arena</p><div className="mt-5 space-y-3">{selected.questions.length === 0 && <p className="rounded-xl bg-[#f4f6f3] p-4 text-sm text-[#5c6f66]">Aún no hay preguntas. Añade la primera debajo.</p>}{selected.questions.map((question, index) => <article key={question.id} className="rounded-xl border border-[#d5e0d8] p-3"><div className="flex items-start justify-between gap-3"><div><span className="text-xs font-bold uppercase text-[#527a68]">Pregunta {index + 1}</span><p className="mt-1 font-semibold">{question.text}</p><p className="mt-1 text-xs text-[#64776d]">Correcta: {question.correctAnswer}</p></div>{selected.canEdit && <button type="button" onClick={() => editQuestion(question)} aria-label={`Editar pregunta ${index + 1}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[#1f806d]"><Pencil size={16} /></button>}</div></article>)}</div>
          {selected.canEdit && <div className="mt-7 border-t border-[#d5e0d8] pt-6"><div className="flex items-center justify-between"><h3 className="flex items-center gap-2 text-lg font-black"><Plus size={19} /> {editingQuestionId ? 'Editar pregunta' : 'Añadir pregunta'}</h3>{editingQuestionId && <button type="button" onClick={resetQuestion} className="min-h-10 px-3 text-sm font-semibold">Cancelar</button>}</div><label className="mt-4 block text-sm font-semibold">Tipo<select value={questionForm.type} onChange={(event) => setQuestionForm({ ...questionForm, type: event.target.value as Question['type'], options: event.target.value === 'TRUE_FALSE' ? ['Verdadero', 'Falso'] : ['', '', '', ''], correctAnswer: '' })} className="mt-1.5 min-h-12 w-full rounded-xl border border-[#cbd8d0] bg-white px-3"><option value="MULTIPLE_CHOICE">Opción múltiple</option><option value="TRUE_FALSE">Verdadero o falso</option></select></label><label className="mt-4 block text-sm font-semibold">Enunciado<textarea value={questionForm.text} onChange={(event) => setQuestionForm({ ...questionForm, text: event.target.value })} rows={3} maxLength={2000} className="mt-1.5 w-full rounded-xl border border-[#cbd8d0] p-3" /></label><fieldset className="mt-4"><legend className="text-sm font-semibold">Opciones · marca la correcta</legend><div className="mt-2 space-y-2">{(questionForm.type === 'TRUE_FALSE' ? ['Verdadero', 'Falso'] : questionForm.options).map((option, index) => <div key={index} className="flex items-center gap-2"><input type="radio" name="correct-option" checked={!!option && questionForm.correctAnswer === option} onChange={() => setQuestionForm({ ...questionForm, correctAnswer: option })} aria-label={`Marcar opción ${index + 1} como correcta`} className="h-5 w-5 accent-[#1f806d]" /><input value={option} readOnly={questionForm.type === 'TRUE_FALSE'} onChange={(event) => { const options = [...questionForm.options]; options[index] = event.target.value; setQuestionForm({ ...questionForm, options, correctAnswer: questionForm.correctAnswer === option ? event.target.value : questionForm.correctAnswer }) }} placeholder={`Opción ${index + 1}`} maxLength={300} className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#cbd8d0] px-3" /></div>)}</div></fieldset><label className="mt-4 block text-sm font-semibold">Explicación<textarea value={questionForm.explanation} onChange={(event) => setQuestionForm({ ...questionForm, explanation: event.target.value })} rows={2} maxLength={2000} className="mt-1.5 w-full rounded-xl border border-[#cbd8d0] p-3" /></label><button type="button" disabled={saving} onClick={saveQuestion} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1f806d] px-5 font-bold text-white disabled:opacity-50"><Check size={18} /> {saving ? 'Guardando…' : editingQuestionId ? 'Guardar cambios' : 'Añadir pregunta'}</button></div>}
          {(selected.isPublished || selected.canEdit) && <div className="mt-7 rounded-2xl border border-[#bad5c5] bg-[#edf6ef] p-4"><h3 className="font-black">Reutilizar en un quiz del aula</h3><p className="mt-1 text-sm text-[#587067]">Copia estas preguntas a una actividad en borrador. Allí podrás revisarlas y publicarlas después.</p>{bank.targetActivities.length ? <div className="mt-3 flex flex-col gap-2"><select value={targetActivityId} onChange={(event) => setTargetActivityId(event.target.value)} aria-label="Quiz en borrador" className="min-h-11 rounded-xl border border-[#cbd8d0] bg-white px-3"><option value="">Elige un quiz en borrador</option>{bank.targetActivities.map((activity) => <option key={activity.id} value={activity.id}>{activity.title}</option>)}</select><button type="button" disabled={!targetActivityId || !selected.questions.length || saving} onClick={copyToActivity} className="min-h-11 rounded-xl bg-[#285e4d] px-4 font-bold text-white disabled:opacity-50">Copiar {selected.questions.length} preguntas al quiz</button></div> : <p className="mt-3 text-sm font-semibold text-[#586e63]">Crea primero un quiz en borrador desde Actividades.</p>}</div>}
        </>}</section>
      </main>}
    </div>
  </div>
}
