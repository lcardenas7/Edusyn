import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

type Review = {
  status: 'CONTINUE' | 'REVIEW_PENDING'; reasons: string[]; policyRevision: number | null;
  evidenceFingerprint: string | null; reportText?: string; confirmationCurrent?: boolean;
  periods?: Array<{ id: string; name: string; dimensions: Array<{
    id: string; name: string; expectedIds: string[]; valuedIds: string[]
  }> }>
}

export default function QualitativePromotionReview({ enrollmentId, onSaved }: {
  enrollmentId: string; onSaved: () => void
}) {
  const { institution, user, isSuperAdmin } = useAuth()
  const [review, setReview] = useState<Review | null>(null)
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false)
  const [report, setReport] = useState(''), [reason, setReason] = useState('')
  const [error, setError] = useState(''), [saved, setSaved] = useState(false)
  const roles = (user?.roles || []).map((r: any) => typeof r === 'string' ? r : r.role?.name || r.name)
  const canConfirm = isSuperAdmin || roles.some((r: string) => ['RECTOR', 'ADMIN_INSTITUTIONAL', 'SUPERADMIN'].includes(r))
  useEffect(() => {
    let live = true
    setLoading(true); setReview(null); setError(''); setReport(''); setReason(''); setSaved(false)
    api.get(`/qualitative-promotion/${enrollmentId}`, { params: { institutionId: institution?.id } })
      .then(({ data }) => { if (live) { setReview(data); setReport(data.reportText || '') } })
      .catch(() => { if (live) setError('No se pudo consultar la evaluación. Cierra y vuelve a abrir esta revisión.') })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [enrollmentId, institution?.id])
  async function confirm() {
    if (!review?.evidenceFingerprint) return
    setSaving(true); setError('')
    try {
      await api.post(`/qualitative-promotion/${enrollmentId}/confirm`, {
        reportText: report, reason, expectedFingerprint: review.evidenceFingerprint,
      }, { params: { institutionId: institution?.id } })
      setSaved(true); onSaved()
    } catch (e: any) {
      const data = e.response?.data
      setError(Array.isArray(data?.errors) ? data.errors.join('; ') :
        typeof data?.message === 'string' ? data.message : 'No se pudo guardar la decisión. Revisa los requisitos antes de intentarlo de nuevo.')
    } finally { setSaving(false) }
  }
  return <section className="mt-3 rounded-lg border border-slate-200 bg-white p-4 text-slate-800 space-y-3" aria-label="Revisión cualitativa individual">
    <Link to="/academic/config/qualitative-promotion" className="underline text-blue-700">Consultar política en Configuración SIEE</Link>
    {loading && <p role="status">Consultando obligaciones y valoraciones…</p>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {saved && <p role="status" className="text-green-800">Informe y continuidad registrados. Actualiza la previsualización antes de cerrar el año.</p>}
    {review && <>
      <p>Revisión de política: {review.policyRevision ?? 'Sin configurar'}. {review.confirmationCurrent ? 'Confirmación vigente.' : 'Sin confirmación vigente.'}</p>
      <ul className="list-disc pl-5">{review.reasons.map(r => <li key={r}>{r}</li>)}</ul>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <caption className="text-left font-semibold mb-2">Cobertura por período y dimensión</caption>
        <thead><tr><th className="p-2">Período</th><th className="p-2">Dimensión</th><th className="p-2">Valoraciones</th></tr></thead>
        <tbody>{review.periods?.flatMap(p => p.dimensions.map(d => {
          const expected = [...new Set(d.expectedIds)]
          const done = expected.filter(id => d.valuedIds.includes(id)).length
          return <tr className="border-t" key={`${p.id}-${d.id}`}><td className="p-2">{p.name}</td><td className="p-2">{d.name}</td>
            <td className="p-2">{expected.length ? `${done} de ${expected.length}` : 'Sin obligaciones configuradas'}</td></tr>
        }))}</tbody>
      </table></div>
      <fieldset disabled={!canConfirm || saving || saved} className="space-y-3">
        <label className="block">Informe descriptivo final<textarea className="block w-full border rounded p-2 mt-1" rows={5} value={report} onChange={e => setReport(e.target.value)} /></label>
        <label className="block">Motivo de la decisión<textarea className="block w-full border rounded p-2 mt-1" value={reason} onChange={e => setReason(e.target.value)} /></label>
        <p>La confirmación conserva el informe, responsable, fecha y revisión de los datos. Si cambian las valoraciones, será necesario revisar nuevamente.</p>
        <button type="button" disabled={!review.evidenceFingerprint || !reason.trim()} onClick={confirm}
          className="rounded bg-blue-700 text-white px-4 py-2 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar informe y confirmar continuidad'}</button>
      </fieldset>
    </>}
  </section>
}
