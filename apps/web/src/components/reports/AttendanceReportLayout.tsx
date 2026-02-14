import { ReactNode } from 'react'
import {
  ChevronLeft,
  Download,
  Printer,
  Info,
} from 'lucide-react'

// ─── Umbrales de asistencia (configurables desde reglas institucionales) ───
export let THRESHOLDS = {
  NORMAL_MIN: 85,
  ALERT_MIN: 70,
}

export function setAttendanceThresholds(minAttendancePercentage: number) {
  THRESHOLDS = {
    NORMAL_MIN: minAttendancePercentage,
    ALERT_MIN: Math.max(0, minAttendancePercentage - 15),
  }
}

export function getStatusFromPct(pct: number): 'Normal' | 'Alerta' | 'Riesgo' {
  if (pct >= THRESHOLDS.NORMAL_MIN) return 'Normal'
  if (pct >= THRESHOLDS.ALERT_MIN) return 'Alerta'
  return 'Riesgo'
}

export function getPctColor(pct: number): string {
  if (pct >= 90) return 'text-emerald-700'
  if (pct >= 80) return 'text-amber-600'
  return 'text-red-600'
}

export function getRowBg(status: string): string {
  if (status === 'Riesgo') return 'bg-red-50/60'
  if (status === 'Alerta') return 'bg-amber-50/50'
  return ''
}

export function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    Normal: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
    Alerta: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
    Riesgo: 'bg-red-100 text-red-700 ring-1 ring-red-200',
  }
  return map[status] || 'bg-slate-100 text-slate-700'
}

// ─── Sorting helpers ───────────────────────────────────────────────────
const STATUS_ORDER: Record<string, number> = { Riesgo: 0, Alerta: 1, Normal: 2 }

export function sortByRisk<T extends { status?: string; pct?: number }>(data: T[]): T[] {
  return [...data].sort((a, b) => {
    const sa = STATUS_ORDER[a.status || 'Normal'] ?? 3
    const sb = STATUS_ORDER[b.status || 'Normal'] ?? 3
    if (sa !== sb) return sa - sb
    return (a.pct ?? 100) - (b.pct ?? 100)
  })
}

// ─── KPI Card ──────────────────────────────────────────────────────────
interface KPICardProps {
  label: string
  value: string | number
  sub?: string
  color?: 'green' | 'amber' | 'red' | 'blue' | 'slate'
  icon?: ReactNode
}

const kpiColors = {
  green: 'border-emerald-200 bg-emerald-50',
  amber: 'border-amber-200 bg-amber-50',
  red: 'border-red-200 bg-red-50',
  blue: 'border-blue-200 bg-blue-50',
  slate: 'border-slate-200 bg-white',
}

const kpiValueColors = {
  green: 'text-emerald-700',
  amber: 'text-amber-700',
  red: 'text-red-700',
  blue: 'text-blue-700',
  slate: 'text-slate-800',
}

export function KPICard({ label, value, sub, color = 'slate', icon }: KPICardProps) {
  return (
    <div className={`rounded-xl border p-4 ${kpiColors[color]} transition-all`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
        {icon && <span className="opacity-60">{icon}</span>}
      </div>
      <p className={`text-2xl font-bold ${kpiValueColors[color]}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

export function kpiColorFromPct(pct: number): 'green' | 'amber' | 'red' {
  if (pct >= 90) return 'green'
  if (pct >= 80) return 'amber'
  return 'red'
}

// ─── Criteria Legend ───────────────────────────────────────────────────
export function CriteriaLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5">
      <div className="flex items-center gap-1.5">
        <Info className="w-3.5 h-3.5 text-slate-400" />
        <span className="font-medium text-slate-700">Criterios:</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
        <span>Normal &ge; {THRESHOLDS.NORMAL_MIN}%</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
        <span>Alerta {THRESHOLDS.ALERT_MIN}&ndash;{THRESHOLDS.NORMAL_MIN - 1}%</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
        <span>Riesgo &lt; {THRESHOLDS.ALERT_MIN}%</span>
      </div>
      <div className="ml-auto text-slate-400 italic">
        El porcentaje incluye asistencias, tardanzas y excusas justificadas.
      </div>
    </div>
  )
}

// ─── Empty State ───────────────────────────────────────────────────────
export function EmptyState({ icon, message }: { icon: ReactNode; message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
      <div className="mb-3 opacity-40">{icon}</div>
      <p className="text-sm">{message || 'Seleccione los filtros y haga clic en "Generar reporte"'}</p>
    </div>
  )
}

// ─── Layout Principal ──────────────────────────────────────────────────
interface AttendanceReportLayoutProps {
  title: string
  subtitle: string
  icon: ReactNode
  onBack: () => void
  onExport: () => void
  onPrint?: () => void
  filters: ReactNode
  kpis?: ReactNode
  children: ReactNode
  hasData?: boolean
}

export default function AttendanceReportLayout({
  title,
  subtitle,
  icon,
  onBack,
  onExport,
  onPrint,
  filters,
  kpis,
  children,
  hasData,
}: AttendanceReportLayoutProps) {
  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-amber-100 rounded-xl flex items-center justify-center shadow-sm">
              {icon}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 leading-tight">{title}</h2>
              <p className="text-sm text-slate-500">{subtitle}</p>
            </div>
          </div>
        </div>
        {hasData && (
          <div className="flex items-center gap-2">
            <button
              onClick={onExport}
              className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium shadow-sm transition-colors"
            >
              <Download className="w-4 h-4" /> Exportar CSV
            </button>
            <button
              onClick={onPrint || (() => window.print())}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-sm font-medium shadow-sm transition-colors"
            >
              <Printer className="w-4 h-4" /> Imprimir
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      {filters}

      {/* Criteria Legend */}
      <CriteriaLegend />

      {/* KPI Cards */}
      {kpis && <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{kpis}</div>}

      {/* Table / Content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {children}
      </div>
    </div>
  )
}
