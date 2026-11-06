import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useAcademic } from '../../../contexts/AcademicContext'
import { useAuth } from '../../../contexts/AuthContext'
import { useAcademicYearStatus } from '../../../components/AcademicYearBanner'

export default function PromotionAttendance() {
  const { gradingConfig, setGradingConfig, saveGradingConfigToAPI, isSaving } = useAcademic()
  const { user } = useAuth()
  const { isReadOnly } = useAcademicYearStatus()
  const [message, setMessage] = useState('')
  const roles = (user?.roles || []).map((r: any) => typeof r === 'string' ? r : r.role?.name || r.name)
  const canEdit = !isReadOnly && (user?.isSuperAdmin || roles.some((r: string) => ['SUPERADMIN', 'SUPER_ADMIN', 'ADMIN_INSTITUTIONAL', 'RECTOR'].includes(r)))
  return <main className="max-w-3xl mx-auto p-6 space-y-6">
    <Link to="/academic" className="text-blue-700 underline">Volver a Configuración SIEE</Link>
    <header><h1 className="text-2xl font-semibold">Asistencia para promoción</h1>
      <p className="mt-2 text-slate-600">Selecciona la fuente que usará el cierre anual para evaluar la asistencia. Esta política es institucional y afecta las próximas evaluaciones del cierre.</p></header>
    <section className="rounded-xl border bg-white p-5 space-y-4">
      <label htmlFor="promotion-attendance-source" className="block font-medium">Fuente de asistencia</label>
      <select id="promotion-attendance-source" disabled={!canEdit || isSaving} value={gradingConfig.promotionAttendanceSource ?? 'SUBJECT'}
        onChange={e => { setMessage(''); setGradingConfig({ ...gradingConfig, promotionAttendanceSource: e.target.value as 'SUBJECT' | 'TUTORING' }) }}
        className="w-full rounded-lg border border-slate-300 p-3">
        <option value="SUBJECT">Clases por asignatura</option><option value="TUTORING">Asistencia diaria de tutoría</option>
      </select>
      <p className="text-sm text-slate-600">Se utiliza únicamente la fuente seleccionada. Los días de tutoría y las sesiones por asignatura no se suman. La falta de registros queda pendiente de revisión.</p>
      {!canEdit && <p className="text-sm text-slate-600">Solo lectura. Requiere rectoría o administración institucional y un año editable.</p>}
      <button disabled={!canEdit || isSaving} onClick={async () => { setMessage(await saveGradingConfigToAPI() ? 'Configuración guardada. Vuelve a consultar la previsualización del cierre.' : 'No fue posible guardar la configuración.') }}
        className="rounded-lg bg-blue-700 text-white px-4 py-2 disabled:opacity-50">{isSaving ? 'Guardando…' : 'Guardar configuración'}</button>
      <p role="status">{message}</p>
    </section>
    <Link to="/academic-year-closure" className="text-blue-700 underline">Revisar cierre y promociones</Link>
  </main>
}
