import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Plus, Save, Trash2 } from 'lucide-react'
import { confirmDialog } from '../ui/confirm'
import { achievementConfigApi, achievementsApi, areasApi, gradesConfigApi } from '../../lib/api'

// `retiredFromTermId` es la fuente de verdad del retiro (D-12). `isActive` está deprecado.
type Evidence = { id?: string; text: string; orderNumber?: number; retiredFromTermId?: string | null }
type Purpose = { id: string; baseDescription: string; orderNumber: number; evidences: Evidence[] }

type Props = {
  institutionId: string
  academicYears: any[]
  selectedYearId: string
}

export default function PreschoolCatalog({ institutionId, academicYears, selectedYearId }: Props) {
  const [grades, setGrades] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [gradeId, setGradeId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [termId, setTermId] = useState('')
  const [purposes, setPurposes] = useState<Purpose[]>([])
  const [description, setDescription] = useState('')
  const [evidencesText, setEvidencesText] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [labels, setLabels] = useState({
    learningLabelSingular: 'Propósito',
    learningLabelPlural: 'Propósitos',
    evidenceLabelSingular: 'Imprescindible',
    evidenceLabelPlural: 'Imprescindibles',
    learningCatalogMode: 'ADMIN_FIXED' as 'TEACHER_MANAGED' | 'ADMIN_FIXED',
  })

  const selectedYear = academicYears.find((year) => year.id === selectedYearId)
  const terms = selectedYear?.terms || []
  const preschoolGrades = useMemo(() => grades.filter((grade) => grade.stage === 'PREESCOLAR'), [grades])
  const dimensions = useMemo(() => subjects.filter((subject) => subject.subjectType === 'PRESCHOOL_DIMENSION'), [subjects])

  useEffect(() => {
    const loadSetup = async () => {
      try {
        const [gradesRes, subjectsRes, configRes] = await Promise.all([
          gradesConfigApi.getAll(),
          areasApi.getAllSubjects(institutionId),
          achievementConfigApi.get(institutionId),
        ])
        const allGrades = gradesRes.data || []
        setGrades(allGrades)
        setSubjects(subjectsRes.data || [])
        const initialGrade = allGrades.find((grade: any) => grade.stage === 'PREESCOLAR')
        if (initialGrade) setGradeId(initialGrade.id)
        if (configRes.data) {
          setLabels({
            learningLabelSingular: configRes.data.learningLabelSingular || 'Propósito',
            learningLabelPlural: configRes.data.learningLabelPlural || 'Propósitos',
            evidenceLabelSingular: configRes.data.evidenceLabelSingular || 'Imprescindible',
            evidenceLabelPlural: configRes.data.evidenceLabelPlural || 'Imprescindibles',
            learningCatalogMode: configRes.data.learningCatalogMode || 'ADMIN_FIXED',
          })
        }
      } catch (error) {
        console.error('Error loading preschool catalog setup:', error)
        setMessage('No se pudo cargar la estructura académica.')
      }
    }
    loadSetup()
  }, [institutionId])

  useEffect(() => {
    const loadCatalog = async () => {
      if (!selectedYearId || !gradeId || !subjectId) {
        setPurposes([])
        return
      }
      setLoading(true)
      try {
        const response = await achievementsApi.getCatalog({
          institutionId,
          academicYearId: selectedYearId,
          gradeId,
          subjectId,
          ...(termId ? { academicTermId: termId } : {}),
        })
        setPurposes(response.data || [])
      } catch (error) {
        console.error('Error loading preschool catalog:', error)
        setMessage('No se pudo cargar el catálogo seleccionado.')
      } finally {
        setLoading(false)
      }
    }
    loadCatalog()
  }, [institutionId, selectedYearId, gradeId, subjectId, termId])

  const saveLabels = async () => {
    setSaving(true)
    try {
      await achievementConfigApi.upsert({ institutionId, ...labels })
      setMessage('Etiquetas y modo de catálogo guardados.')
    } catch (error) {
      console.error('Error saving catalog config:', error)
      setMessage('No se pudo guardar la configuración.')
    } finally {
      setSaving(false)
    }
  }

  const createPurpose = async () => {
    if (!description.trim() || !selectedYearId || !gradeId || !subjectId) return
    setSaving(true)
    try {
      const response = await achievementsApi.createCatalog({
        institutionId,
        academicYearId: selectedYearId,
        gradeId,
        subjectId,
        ...(termId ? { academicTermId: termId } : {}),
        baseDescription: description.trim(),
        evidences: evidencesText.split('\n').map((text) => ({ text })).filter((item) => item.text.trim()),
      })
      setPurposes((current) => [...current, response.data].sort((a, b) => a.orderNumber - b.orderNumber))
      setDescription('')
      setEvidencesText('')
      setMessage('Propósito guardado para todos los grupos de este grado.')
    } catch (error: any) {
      console.error('Error creating purpose:', error)
      setMessage(error?.response?.data?.message || 'No se pudo crear el propósito.')
    } finally {
      setSaving(false)
    }
  }

  const savePurpose = async (purpose: Purpose, baseDescription: string, evidences: Evidence[]) => {
    setSaving(true)
    try {
      const response = await achievementsApi.update(purpose.id, {
        baseDescription,
        // El id viaja SIEMPRE que exista: es lo que permite al backend reconocer que la
        // evidencia es la misma y conservar las valoraciones ya registradas por los docentes.
        evidences: evidences.map((evidence) => ({ id: evidence.id, text: evidence.text })),
      })
      setPurposes((current) => current.map((item) => item.id === purpose.id ? response.data : item))
      setMessage('Propósito actualizado.')
    } catch (error) {
      console.error('Error updating purpose:', error)
      setMessage('No se pudo actualizar el propósito.')
    } finally {
      setSaving(false)
    }
  }

  // ── Retiro lógico (D-12) ────────────────────────────────────────────────────
  // El período viaja explícito: el modelo no tiene "período en curso". Si el admin
  // está en la vista "Anual" hay que pedirle que elija uno.
  const retireEvidence = async (evidence: Evidence) => {
    if (!evidence.id) return
    if (!termId) {
      setMessage(`Para retirar un ${labels.evidenceLabelSingular.toLowerCase()} debe elegir primero el período desde el que deja de aplicar.`)
      return
    }
    const termName = terms.find((t: any) => t.id === termId)?.name || 'el período seleccionado'
    if (!(await confirmDialog(`¿Retirar “${evidence.text}” a partir de ${termName}? Se conservan todas las valoraciones ya registradas y seguirá apareciendo en los períodos anteriores.`, { danger: true }))) return
    setSaving(true)
    try {
      await achievementsApi.retireEvidence(evidence.id, { academicTermId: termId })
      setPurposes((current) => current.map((p) => ({ ...p, evidences: p.evidences.map((e) => e.id === evidence.id ? { ...e, retiredFromTermId: termId } : e) })))
      setMessage(`${labels.evidenceLabelSingular} retirado a partir de ${termName}.`)
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'No se pudo retirar.')
    } finally {
      setSaving(false)
    }
  }

  const reactivateEvidence = async (evidence: Evidence) => {
    if (!evidence.id) return
    setSaving(true)
    try {
      await achievementsApi.reactivateEvidence(evidence.id)
      setPurposes((current) => current.map((p) => ({ ...p, evidences: p.evidences.map((e) => e.id === evidence.id ? { ...e, retiredFromTermId: null } : e) })))
      setMessage(`${labels.evidenceLabelSingular} reactivado. El efecto es sólo hacia adelante.`)
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'No se pudo reactivar.')
    } finally {
      setSaving(false)
    }
  }

  const deletePurpose = async (purpose: Purpose) => {
    if (!(await confirmDialog(`¿Eliminar el propósito “${purpose.baseDescription}”? También se retirarán sus imprescindibles.`, { danger: true }))) return
    try {
      await achievementsApi.delete(purpose.id)
      setPurposes((current) => current.filter((item) => item.id !== purpose.id))
      setMessage('Propósito eliminado del catálogo.')
    } catch (error) {
      console.error('Error deleting purpose:', error)
      setMessage('No se pudo eliminar el propósito.')
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-5">
        <div className="flex items-start gap-3">
          <BookOpen className="mt-0.5 h-5 w-5 text-indigo-600" />
          <div>
            <h2 className="font-semibold text-slate-900">Catálogo de Transición</h2>
            <p className="mt-1 text-sm text-slate-600">Los propósitos se comparten con todos los grupos del grado. En modo fijo el docente únicamente los valora.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          {([
            ['learningLabelSingular', 'Etiqueta singular'],
            ['learningLabelPlural', 'Etiqueta plural'],
            ['evidenceLabelSingular', 'Imprescindible singular'],
            ['evidenceLabelPlural', 'Imprescindibles plural'],
          ] as const).map(([key, label]) => (
            <label key={key} className="text-xs font-medium text-slate-600">{label}
              <input value={labels[key]} onChange={(event) => setLabels({ ...labels, [key]: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
            </label>
          ))}
          <label className="text-xs font-medium text-slate-600">Edición docente
            <select value={labels.learningCatalogMode} onChange={(event) => setLabels({ ...labels, learningCatalogMode: event.target.value as any })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="ADMIN_FIXED">Catálogo fijo: solo valora</option>
              <option value="TEACHER_MANAGED">Docente puede gestionar</option>
            </select>
          </label>
        </div>
        <button onClick={saveLabels} disabled={saving} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"><Save className="h-4 w-4" />Guardar configuración</button>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="text-sm font-medium text-slate-700">Año
            <select value={selectedYearId} disabled className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm"><option>{selectedYear?.name || selectedYear?.year || 'Sin año'}</option></select>
          </label>
          <label className="text-sm font-medium text-slate-700">Grado
            <select value={gradeId} onChange={(event) => setGradeId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">Seleccionar</option>{preschoolGrades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select>
          </label>
          <label className="text-sm font-medium text-slate-700">Dimensión
            <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">Seleccionar</option>{dimensions.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select>
          </label>
          <label className="text-sm font-medium text-slate-700">Vigencia
            <select value={termId} onChange={(event) => setTermId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">Anual (todos los períodos)</option>{terms.map((term: any) => <option key={term.id} value={term.id}>{term.name}</option>)}</select>
          </label>
        </div>
        {!dimensions.length && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">No hay asignaturas marcadas como “Dimensión de preescolar”. Configúralas primero en el catálogo académico.</p>}
      </section>

      {message && <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{message}</p>}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-slate-900">Nuevo {labels.learningLabelSingular}</h3>
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder={`Escribe el ${labels.learningLabelSingular.toLowerCase()}…`} className="mt-3 w-full rounded-lg border border-slate-300 p-3 text-sm" disabled={!gradeId || !subjectId} />
        <textarea value={evidencesText} onChange={(event) => setEvidencesText(event.target.value)} rows={4} placeholder={`Un ${labels.evidenceLabelSingular.toLowerCase()} por línea (opcional)…`} className="mt-3 w-full rounded-lg border border-slate-300 p-3 text-sm" disabled={!gradeId || !subjectId} />
        <button onClick={createPurpose} disabled={saving || !description.trim() || !gradeId || !subjectId} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"><Plus className="h-4 w-4" />Agregar al catálogo</button>
      </section>

      <section className="space-y-3">
        {loading && <p className="text-sm text-slate-500">Cargando catálogo…</p>}
        {!loading && gradeId && subjectId && purposes.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Aún no hay propósitos en esta dimensión y vigencia.</p>}
        {purposes.map((purpose) => <PurposeCard key={purpose.id} purpose={purpose} labels={labels} saving={saving} termId={termId} onSave={savePurpose} onDelete={deletePurpose} onRetire={retireEvidence} onReactivate={reactivateEvidence} />)}
      </section>
    </div>
  )
}

function PurposeCard({ purpose, labels, saving, termId, onSave, onDelete, onRetire, onReactivate }: { purpose: Purpose; labels: any; saving: boolean; termId: string; onSave: (purpose: Purpose, description: string, evidences: Evidence[]) => void; onDelete: (purpose: Purpose) => void; onRetire: (evidence: Evidence) => void; onReactivate: (evidence: Evidence) => void }) {
  const [description, setDescription] = useState(purpose.baseDescription)
  const [evidences, setEvidences] = useState<Evidence[]>(purpose.evidences || [])

  useEffect(() => {
    setDescription(purpose.baseDescription)
    setEvidences(purpose.evidences || [])
  }, [purpose])

  return <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-4"><span className="rounded bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">{labels.learningLabelSingular} {purpose.orderNumber}</span><button onClick={() => onDelete(purpose)} className="rounded p-2 text-rose-600 hover:bg-rose-50" title="Eliminar propósito"><Trash2 className="h-4 w-4" /></button></div>
    <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="mt-3 w-full rounded-lg border border-slate-300 p-3 text-sm font-medium" />
    {/* D-12: las evidencias retiradas SIGUEN en la lista y en el payload. Ocultarlas
        haría que reconcileEvidences las interpretara como baja. Se marcan visualmente
        y se editan sólo mediante Retirar/Reactivar. */}
    <div className="mt-3 space-y-2">{evidences.map((evidence, index) => {
      const retired = !!evidence.retiredFromTermId
      return <div key={evidence.id || index} className="flex items-center gap-2">
        <input
          value={evidence.text}
          onChange={(event) => setEvidences(evidences.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item))}
          className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm ${retired ? 'border-slate-200 bg-slate-50 text-slate-400 line-through' : 'border-slate-300'}`}
        />
        {retired
          ? <>
              <span className="shrink-0 rounded bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">Retirada</span>
              <button onClick={() => onReactivate(evidence)} disabled={saving} className="shrink-0 rounded px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">Reactivar</button>
            </>
          : <>
              {evidence.id && <button onClick={() => onRetire(evidence)} disabled={saving} className="shrink-0 rounded px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50" title={termId ? 'Retirar del catálogo desde el período seleccionado' : 'Seleccione un período para poder retirar'}>Retirar</button>}
              <button onClick={() => setEvidences(evidences.filter((_, itemIndex) => itemIndex !== index))} className="shrink-0 rounded px-2 text-slate-500 hover:bg-slate-100" aria-label="Quitar imprescindible">×</button>
            </>}
      </div>
    })}</div>
    <button onClick={() => setEvidences([...evidences, { text: '' }])} className="mt-2 text-sm font-medium text-indigo-700 hover:text-indigo-900">+ Añadir {labels.evidenceLabelSingular.toLowerCase()}</button>
    <div className="mt-4"><button onClick={() => onSave(purpose, description, evidences.filter((evidence) => evidence.text.trim()))} disabled={saving || !description.trim()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Save className="h-4 w-4" />Guardar cambios</button></div>
  </article>
}
