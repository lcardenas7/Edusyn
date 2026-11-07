import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../contexts/AuthContext'
import api, { academicYearLifecycleApi, gradesConfigApi } from '../../../lib/api'

type Policy = { gradeId: string; revision: number; valuationScope: 'PURPOSE' | 'EVIDENCE'; requireFinalReport: boolean;
  decisionMode: 'CONFIRMED' | 'ON_COMPLETION'; approvedAt: string; reason: string }

export default function QualitativePromotion() {
  const { institution, user, isSuperAdmin } = useAuth()
  const [years, setYears] = useState<any[]>([]), [grades, setGrades] = useState<any[]>([])
  const [yearId, setYearId] = useState(''), [gradeId, setGradeId] = useState('')
  const [history, setHistory] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false)
  const [loadingSetup, setLoadingSetup] = useState(true)
  const [error, setError] = useState(''), [message, setMessage] = useState('')
  const [scope, setScope] = useState<'PURPOSE' | 'EVIDENCE'>('PURPOSE')
  const [report, setReport] = useState(true), [decision, setDecision] = useState<'CONFIRMED' | 'ON_COMPLETION'>('CONFIRMED')
  const [reason, setReason] = useState('')
  const current = history.filter(p => p.gradeId === gradeId).sort((a, b) => b.revision - a.revision)[0]
  const roles = (user?.roles || []).map((r: any) => typeof r === 'string' ? r : r.role?.name || r.name)
  const canWrite = isSuperAdmin || roles.some((r: string) => ['ADMIN_INSTITUTIONAL', 'RECTOR', 'SUPERADMIN'].includes(r))
  const closed = years.find(y => y.id === yearId)?.status === 'CLOSED'
  useEffect(() => {
    let live = true
    setYears([]); setGrades([]); setYearId(''); setGradeId(''); setHistory([]); setError('')
    if (!institution?.id) { setLoadingSetup(false); return }
    setLoadingSetup(true)
    Promise.all([academicYearLifecycleApi.getByInstitution(institution.id), gradesConfigApi.getAll()])
      .then(([y, g]) => { if (!live) return; setYears(y.data); setGrades(g.data.filter((v: any) => v.academicStructure === 'DIMENSIONS'));
        setYearId((y.data.find((v: any) => v.status === 'ACTIVE') || y.data[0])?.id || '') })
      .catch(() => { if (live) setError('No fue posible cargar años y grados. Recarga la página.') })
      .finally(() => { if (live) setLoadingSetup(false) })
    return () => { live = false }
  }, [institution?.id])
  useEffect(() => {
    let live = true
    setHistory([]); setMessage(''); setError('')
    if (!yearId || !institution?.id) return
    setLoading(true)
    api.get(`/academic-years/${yearId}/qualitative-promotion-policies`, { params: { institutionId: institution.id } })
      .then(r => { if (live) setHistory(r.data) })
      .catch(() => { if (live) setError('No fue posible consultar la política anual. No se habilitó el guardado.') })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [yearId, institution?.id])
  useEffect(() => {
    setScope(current?.valuationScope ?? 'PURPOSE'); setReport(current?.requireFinalReport ?? true)
    setDecision(current?.decisionMode ?? 'CONFIRMED'); setReason('')
  }, [gradeId, current])
  async function save() {
    setSaving(true); setMessage('')
    try {
      const response = await api.post(`/academic-years/${yearId}/qualitative-promotion-policies/${gradeId}`,
        { valuationScope: scope, requireFinalReport: report, decisionMode: decision, reason, expectedRevision: current?.revision ?? 0 },
        { params: { institutionId: institution?.id } })
      setHistory(previous => [...previous, response.data]); setMessage('Nueva revisión guardada. Las revisiones anteriores se conservan.')
    } catch (e: any) { setError(e.response?.data?.message || 'No se pudo guardar. Recarga para consultar la revisión vigente.') }
    finally { setSaving(false) }
  }
  const disabled = !canWrite || closed || loadingSetup || loading || saving || !!error || !yearId || !gradeId
  return <main className="max-w-3xl mx-auto p-6 space-y-5">
    <Link className="text-blue-700 underline" to="/academic">Volver a Configuración SIEE</Link>
    <h1 className="text-2xl font-semibold">Promoción cualitativa por año y grado</h1>
    <p>La política define los requisitos de continuidad. Guardarla no promueve estudiantes ni completa sus valoraciones.</p>
    {error && <p role="alert" className="bg-red-50 text-red-800 p-3 rounded">{error}</p>}
    {(loadingSetup || loading) && <p role="status">Cargando configuración…</p>}
    <label className="block">Año lectivo<select className="block w-full border rounded p-2" value={yearId} disabled={saving} onChange={e => setYearId(e.target.value)}>
      <option value="">Selecciona un año</option>{years.map(y => <option key={y.id} value={y.id}>{y.name || y.year}</option>)}</select></label>
    <label className="block">Grado por dimensiones<select className="block w-full border rounded p-2" value={gradeId} disabled={saving} onChange={e => setGradeId(e.target.value)}>
      <option value="">Selecciona un grado</option>{grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
    {gradeId && <p>{current ? `Revisión vigente: ${current.revision}` : 'Sin política guardada. Los valores propuestos aún no están aprobados.'}</p>}
    {closed && <p>El año está cerrado. Su política es de solo lectura.</p>}
    <fieldset disabled={disabled} className="space-y-4 border rounded-xl p-5 bg-white">
      <legend className="px-2 font-medium">Requisitos de continuidad cualitativa</legend>
      <label className="block">Registrar valoraciones por<select className="block w-full border rounded p-2" value={scope} onChange={e => setScope(e.target.value as typeof scope)}>
        <option value="PURPOSE">Propósito o aprendizaje</option><option value="EVIDENCE">Evidencia de aprendizaje</option></select></label>
      <label className="flex gap-2"><input type="checkbox" checked={report} onChange={e => setReport(e.target.checked)} />Exigir informe descriptivo final</label>
      <label className="block">Decisión de continuidad<select className="block w-full border rounded p-2" value={decision} onChange={e => setDecision(e.target.value as typeof decision)}>
        <option value="CONFIRMED">Requiere confirmación administrativa</option><option value="ON_COMPLETION">Al completar los requisitos configurados</option></select></label>
      <p className="text-sm text-slate-600">Las obligaciones faltantes quedan pendientes de revisión. No se convierten en una nota numérica ni en repitencia automática.</p>
      <label className="block">Motivo de la revisión<textarea className="block w-full border rounded p-2" value={reason} onChange={e => setReason(e.target.value)} /></label>
      <button className="bg-blue-700 text-white rounded px-4 py-2 disabled:opacity-50" disabled={!reason.trim()} onClick={save}>{saving ? 'Guardando…' : 'Guardar nueva revisión'}</button>
    </fieldset>
    <p role="status">{message}</p>
    <h2 className="font-semibold">Historial del grado</h2>
    <ul className="space-y-2">{history.filter(p => p.gradeId === gradeId).map(p => <li className="border rounded p-3" key={`${p.gradeId}-${p.revision}`}>Revisión {p.revision} · {p.approvedAt} · {p.reason}</li>)}</ul>
  </main>
}
