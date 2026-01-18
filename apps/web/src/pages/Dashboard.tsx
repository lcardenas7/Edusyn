import { useAuth } from '../contexts/AuthContext'
import { 
  Users, 
  BookOpen, 
  Calendar, 
  AlertTriangle,
  TrendingUp,
  Clock
} from 'lucide-react'

const stats = [
  { name: 'Estudiantes', value: '324', icon: Users, color: 'bg-blue-500' },
  { name: 'Asignaturas', value: '12', icon: BookOpen, color: 'bg-green-500' },
  { name: 'Asistencia Hoy', value: '96%', icon: Calendar, color: 'bg-purple-500' },
  { name: 'Alertas Activas', value: '8', icon: AlertTriangle, color: 'bg-amber-500' },
]

const recentActivities = [
  { id: 1, action: 'Calificación registrada', subject: 'Matemáticas 8°A', time: 'Hace 5 min' },
  { id: 2, action: 'Asistencia tomada', subject: 'Ciencias 7°B', time: 'Hace 15 min' },
  { id: 3, action: 'Observación agregada', subject: 'Juan Pérez - 9°A', time: 'Hace 30 min' },
  { id: 4, action: 'Boletín generado', subject: 'Grupo 6°C', time: 'Hace 1 hora' },
]

export default function Dashboard() {
  const { user } = useAuth()

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          ¡Bienvenido, {user?.firstName}!
        </h1>
        <p className="text-slate-500 mt-1">
          Aquí tienes un resumen de la actividad académica
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                <p className="text-sm text-slate-500">{stat.name}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-400" />
              Actividad Reciente
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                <p className="text-sm font-medium text-slate-900">{activity.action}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-sm text-slate-500">{activity.subject}</p>
                  <p className="text-xs text-slate-400">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Performance Overview */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-slate-400" />
              Rendimiento por Período
            </h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {['Período 1', 'Período 2', 'Período 3'].map((period, idx) => (
                <div key={period}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700">{period}</span>
                    <span className="text-sm text-slate-500">{85 - idx * 3}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${85 - idx * 3}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100">
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-lg font-bold text-green-600">45%</p>
                  <p className="text-xs text-slate-500">Superior</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-blue-600">30%</p>
                  <p className="text-xs text-slate-500">Alto</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-amber-600">18%</p>
                  <p className="text-xs text-slate-500">Básico</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-red-600">7%</p>
                  <p className="text-xs text-slate-500">Bajo</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
