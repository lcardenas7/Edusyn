import { BarChart3, TrendingUp, Users, Award } from 'lucide-react'

const performanceData = [
  { level: 'Superior', count: 45, percentage: 14, color: 'bg-green-500' },
  { level: 'Alto', count: 98, percentage: 30, color: 'bg-blue-500' },
  { level: 'Básico', count: 134, percentage: 41, color: 'bg-amber-500' },
  { level: 'Bajo', count: 47, percentage: 15, color: 'bg-red-500' },
]

const subjectStats = [
  { name: 'Matemáticas', avg: 3.8, approved: 85 },
  { name: 'Español', avg: 4.1, approved: 92 },
  { name: 'Ciencias', avg: 3.6, approved: 78 },
  { name: 'Sociales', avg: 4.0, approved: 88 },
  { name: 'Inglés', avg: 3.9, approved: 86 },
]

export default function Statistics() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Estadísticas</h1>
        <p className="text-slate-500 mt-1">Análisis del rendimiento académico institucional</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">324</p>
              <p className="text-sm text-slate-500">Estudiantes</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">3.85</p>
              <p className="text-sm text-slate-500">Promedio General</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Award className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">86%</p>
              <p className="text-sm text-slate-500">Tasa Aprobación</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">94%</p>
              <p className="text-sm text-slate-500">Asistencia</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-900">Distribución por Desempeño</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {performanceData.map((item) => (
                <div key={item.level}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700">{item.level}</span>
                    <span className="text-sm text-slate-500">{item.count} ({item.percentage}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3">
                    <div
                      className={`${item.color} h-3 rounded-full transition-all`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-900">Rendimiento por Asignatura</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {subjectStats.map((subject) => (
                <div key={subject.name} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{subject.name}</p>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-sm text-slate-500">Promedio: <strong>{subject.avg}</strong></span>
                      <span className="text-sm text-slate-500">Aprobación: <strong>{subject.approved}%</strong></span>
                    </div>
                  </div>
                  <div className="w-24 bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${(subject.avg / 5) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
