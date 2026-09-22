import { AlertTriangle, Download, Repeat, Smartphone, Users } from 'lucide-react'
import type { ConstruyeAppUsage } from '../../lib/api/construye'
import { formatBogota } from '../../lib/datetime'

const pct = ({ eligible, returned }: { eligible: number; returned: number }) => (eligible ? `${Math.round((returned / eligible) * 100)} %` : '—')

/**
 * Uso de la app publicada: lo que se evalúa es que OTRAS personas la instalen y la usen. Los
 * dispositivos del propio equipo se cuentan aparte. Todo es anónimo (ver api app-usage.ts).
 */
export default function AppUsage({ stats, compact = false }: { stats: ConstruyeAppUsage; compact?: boolean }) {
  const max = Math.max(1, ...stats.daily.map(day => day.active))
  const kpis = [
    { icon: Users, label: 'Personas', value: String(stats.devices), hint: 'Dispositivos distintos que la abrieron' },
    { icon: Download, label: 'Instalada', value: String(stats.installs), hint: 'La agregaron a su pantalla de inicio' },
    { icon: Smartphone, label: 'Activas (7 días)', value: String(stats.activeWeek), hint: `Hoy: ${stats.activeToday}` },
    { icon: Repeat, label: 'Volvieron', value: pct(stats.returnedNextDay), hint: stats.returnedNextDay.eligible ? `${stats.returnedNextDay.returned} de ${stats.returnedNextDay.eligible} volvieron otro día` : 'Aún no hay datos' },
  ]
  return <div className="space-y-3">
    <div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
      {kpis.map(({ icon: Icon, label, value, hint }) => <div key={label} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5" title={hint}>
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500"><Icon className="h-3.5 w-3.5" /> {label}</p>
        <p className="mt-0.5 text-2xl font-bold text-slate-900">{value}</p>
        {!compact && <p className="text-[11px] leading-4 text-slate-500">{hint}</p>}
      </div>)}
    </div>

    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Personas activas por día (últimas 2 semanas)</p>
      <div className="mt-2 flex h-16 items-end gap-1" role="img" aria-label={`Uso diario: ${stats.daily.map(day => `${day.day} ${day.active}`).join(', ')}`}>
        {stats.daily.map(day => <div key={day.day} className="flex flex-1 flex-col items-center justify-end" title={`${formatBogota(`${day.day}T12:00:00-05:00`, { day: 'numeric', month: 'short' })}: ${day.active} activas, ${day.newDevices} nuevas`}>
          <div className={`w-full rounded-t ${day.active ? 'bg-indigo-500' : 'bg-slate-100'}`} style={{ height: `${Math.max(6, (day.active / max) * 100)}%` }} />
        </div>)}
      </div>
    </div>

    <p className="text-xs leading-5 text-slate-500">
      Llegaron por QR: <b>{stats.sources.qr}</b> · por enlace: <b>{stats.sources.link}</b> · directo: <b>{stats.sources.direct}</b>
      {' · '}{stats.minutes} min de uso{stats.lastUseAt ? ` · último uso ${formatBogota(stats.lastUseAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}
      {stats.teamDevices > 0 && <> · <span title="No suman: lo que cuenta es el uso de otras personas.">{stats.teamDevices} dispositivo(s) del equipo, aparte</span></>}
    </p>
    {stats.suspicious && <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-900"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Llegaron muchos dispositivos nuevos en una hora. Puede ser una clase entera abriéndola a la vez; si no, conviene revisarlo.</p>}
  </div>
}
