import { AlertTriangle, CheckCircle, Clock, User, ChevronRight } from 'lucide-react'

const mockAlerts = [
  { id: '1', student: 'Pedro Ramírez', group: '8°A', subject: 'Matemáticas', grade: 2.5, status: 'OPEN', date: '2026-01-15' },
  { id: '2', student: 'Laura Sánchez', group: '8°B', subject: 'Español', grade: 2.8, status: 'IN_RECOVERY', date: '2026-01-14' },
  { id: '3', student: 'Carlos Gómez', group: '9°A', subject: 'Ciencias', grade: 2.3, status: 'OPEN', date: '2026-01-13' },
  { id: '4', student: 'Ana Torres', group: '7°A', subject: 'Matemáticas', grade: 2.9, status: 'RESOLVED', date: '2026-01-10' },
]

const statusConfig = {
  OPEN: { label: 'Abierta', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  IN_RECOVERY: { label: 'En recuperación', color: 'bg-amber-100 text-amber-700', icon: Clock },
  RESOLVED: { label: 'Resuelta', color: 'bg-green-100 text-green-700', icon: CheckCircle },
}

export default function Alerts() {
  const openAlerts = mockAlerts.filter(a => a.status === 'OPEN').length
  const inRecovery = mockAlerts.filter(a => a.status === 'IN_RECOVERY').length
  const resolved = mockAlerts.filter(a => a.status === 'RESOLVED').length

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Alertas de Riesgo</h1>
        <p className="text-slate-500 mt-1">Estudiantes con bajo rendimiento académico</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{openAlerts}</p>
              <p className="text-sm text-slate-500">Alertas Abiertas</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{inRecovery}</p>
              <p className="text-sm text-slate-500">En Recuperación</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{resolved}</p>
              <p className="text-sm text-slate-500">Resueltas</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Listado de Alertas</h2>
        </div>

        <div className="divide-y divide-slate-100">
          {mockAlerts.map((alert) => {
            const config = statusConfig[alert.status as keyof typeof statusConfig]
            const StatusIcon = config.icon

            return (
              <div key={alert.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-slate-500" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{alert.student}</p>
                    <p className="text-sm text-slate-500">{alert.subject} • {alert.group}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-lg font-bold text-red-600">{alert.grade}</p>
                    <p className="text-xs text-slate-500">{alert.date}</p>
                  </div>
                  <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    {config.label}
                  </span>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
