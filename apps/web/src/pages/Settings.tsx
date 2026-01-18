import { useState } from 'react'
import {
  Settings as SettingsIcon,
  Building2,
  GraduationCap,
  BookOpen,
  Users,
  Calendar,
  Scale,
  Save,
  Plus,
  Edit2,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff
} from 'lucide-react'

type SettingsTab = 'institutional' | 'academic' | 'siee' | 'users'

interface Period {
  id: string
  name: string
  order: number
  startDate: string
  endDate: string
  weight: number
}

interface PerformanceLevel {
  id: string
  name: string
  minScore: number
  maxScore: number
  color: string
}

interface EvaluationDimension {
  id: string
  name: string
  weight: number
  isActive: boolean
}

interface SystemUser {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
  isActive: boolean
}

const mockPeriods: Period[] = [
  { id: '1', name: 'Primer Periodo', order: 1, startDate: '2025-01-20', endDate: '2025-04-04', weight: 25 },
  { id: '2', name: 'Segundo Periodo', order: 2, startDate: '2025-04-07', endDate: '2025-06-20', weight: 25 },
  { id: '3', name: 'Tercer Periodo', order: 3, startDate: '2025-07-14', endDate: '2025-09-19', weight: 25 },
  { id: '4', name: 'Cuarto Periodo', order: 4, startDate: '2025-09-22', endDate: '2025-11-28', weight: 25 },
]

const mockLevels: PerformanceLevel[] = [
  { id: '1', name: 'Superior', minScore: 4.6, maxScore: 5.0, color: 'green' },
  { id: '2', name: 'Alto', minScore: 4.0, maxScore: 4.5, color: 'blue' },
  { id: '3', name: 'Basico', minScore: 3.0, maxScore: 3.9, color: 'amber' },
  { id: '4', name: 'Bajo', minScore: 1.0, maxScore: 2.9, color: 'red' },
]

const mockDimensions: EvaluationDimension[] = [
  { id: '1', name: 'Cognitiva (Saber)', weight: 40, isActive: true },
  { id: '2', name: 'Procedimental (Hacer)', weight: 30, isActive: true },
  { id: '3', name: 'Actitudinal (Ser)', weight: 20, isActive: true },
  { id: '4', name: 'Autoevaluacion', weight: 10, isActive: true },
]

const mockUsers: SystemUser[] = [
  { id: '1', firstName: 'Admin', lastName: 'Sistema', email: 'admin@edusyn.co', role: 'SUPERADMIN', isActive: true },
  { id: '2', firstName: 'Maria', lastName: 'Rodriguez', email: 'maria@colegio.edu.co', role: 'COORDINATOR', isActive: true },
  { id: '3', firstName: 'Carlos', lastName: 'Perez', email: 'carlos@colegio.edu.co', role: 'TEACHER', isActive: true },
]

const roles = [
  { name: 'SUPERADMIN', displayName: 'Super Admin' },
  { name: 'ADMIN_INSTITUTIONAL', displayName: 'Admin Institucional' },
  { name: 'COORDINATOR', displayName: 'Coordinador' },
  { name: 'TEACHER', displayName: 'Docente' },
  { name: 'COUNSELOR', displayName: 'Orientacion' },
]

export default function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('institutional')
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const [institutionConfig, setInstitutionConfig] = useState({
    name: 'Institucion Educativa Ejemplo',
    nit: '900.123.456-7',
    dane: '123456789012',
    resolution: 'Resolucion de Aprobacion No. 1234 del 01 de Enero de 2020',
    address: 'Calle 10 # 15-20, Barrio Centro',
    municipality: 'Sincelejo',
    department: 'Sucre',
    phone: '(605) 123-4567',
    email: 'contacto@ieejemplo.edu.co',
    rector: 'MARIA ELENA GONZALEZ PEREZ',
    coordinator: 'CARLOS ANDRES LOPEZ MARTINEZ',
    activeYear: 2025
  })

  const [periods, setPeriods] = useState<Period[]>(mockPeriods)
  const [levels, setLevels] = useState<PerformanceLevel[]>(mockLevels)
  const [dimensions, setDimensions] = useState<EvaluationDimension[]>(mockDimensions)
  const [users, setUsers] = useState<SystemUser[]>(mockUsers)

  const [academicConfig, setAcademicConfig] = useState({
    minPassingScore: 3.0,
    maxScore: 5.0,
    minScore: 1.0,
    decimalPlaces: 1,
    showRank: true,
    showAbsences: true
  })

  const [sieeConfig, setSieeConfig] = useState({
    periodCalculation: 'WEIGHTED_DIMENSIONS',
    finalCalculation: 'WEIGHTED_PERIODS',
    includeRecovery: true,
    maxRecoveryScore: 3.5,
    maxFailedAreas: 1,
    minAttendance: 75
  })

  const [userFilter, setUserFilter] = useState({ search: '', role: 'ALL' })

  const handleSave = async () => {
    setIsSaving(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsSaving(false)
    setSaveMessage({ type: 'success', text: 'Configuracion guardada exitosamente' })
    setTimeout(() => setSaveMessage(null), 3000)
  }

  const filteredUsers = users.filter(u => {
    const matchesSearch = `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(userFilter.search.toLowerCase())
    const matchesRole = userFilter.role === 'ALL' || u.role === userFilter.role
    return matchesSearch && matchesRole
  })

  const tabs = [
    { id: 'institutional' as SettingsTab, name: 'Institucional', icon: Building2 },
    { id: 'academic' as SettingsTab, name: 'Academica', icon: GraduationCap },
    { id: 'siee' as SettingsTab, name: 'SIEE', icon: Scale },
    { id: 'users' as SettingsTab, name: 'Usuarios', icon: Users },
  ]

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <SettingsIcon className="w-7 h-7 text-slate-600" />
            Configuracion del Sistema
          </h1>
          <p className="text-slate-500 mt-1">Administra la configuracion general de la plataforma</p>
        </div>
        <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {isSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
          {isSaving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>

      {saveMessage && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${saveMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {saveMessage.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {saveMessage.text}
        </div>
      )}

      <div className="flex gap-6">
        <div className="w-64 flex-shrink-0">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-slate-100 last:border-b-0 ${activeTab === tab.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}`}>
                <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-blue-600' : 'text-slate-500'}`} />
                <span className={`font-medium ${activeTab === tab.id ? 'text-blue-900' : 'text-slate-700'}`}>{tab.name}</span>
                <ChevronRight className={`w-4 h-4 ml-auto ${activeTab === tab.id ? 'text-blue-600' : 'text-slate-400'}`} />
              </button>
            ))}
          </div>
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-700">Los cambios en configuracion academica afectaran el calculo de notas.</p>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-6">
          {activeTab === 'institutional' && (
            <>
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-slate-600" />
                  Datos de la Institucion
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                    <input type="text" value={institutionConfig.name} onChange={(e) => setInstitutionConfig({ ...institutionConfig, name: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">NIT</label>
                    <input type="text" value={institutionConfig.nit} onChange={(e) => setInstitutionConfig({ ...institutionConfig, nit: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Codigo DANE</label>
                    <input type="text" value={institutionConfig.dane} onChange={(e) => setInstitutionConfig({ ...institutionConfig, dane: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Resolucion</label>
                    <input type="text" value={institutionConfig.resolution} onChange={(e) => setInstitutionConfig({ ...institutionConfig, resolution: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Direccion</label>
                    <input type="text" value={institutionConfig.address} onChange={(e) => setInstitutionConfig({ ...institutionConfig, address: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Municipio</label>
                    <input type="text" value={institutionConfig.municipality} onChange={(e) => setInstitutionConfig({ ...institutionConfig, municipality: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Departamento</label>
                    <input type="text" value={institutionConfig.department} onChange={(e) => setInstitutionConfig({ ...institutionConfig, department: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Telefono</label>
                    <input type="text" value={institutionConfig.phone} onChange={(e) => setInstitutionConfig({ ...institutionConfig, phone: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Correo</label>
                    <input type="email" value={institutionConfig.email} onChange={(e) => setInstitutionConfig({ ...institutionConfig, email: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Rector(a)</label>
                    <input type="text" value={institutionConfig.rector} onChange={(e) => setInstitutionConfig({ ...institutionConfig, rector: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Coordinador(a)</label>
                    <input type="text" value={institutionConfig.coordinator} onChange={(e) => setInstitutionConfig({ ...institutionConfig, coordinator: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-slate-600" />
                  Ano Lectivo Activo
                </h3>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-green-100 rounded-xl flex items-center justify-center">
                    <span className="text-3xl font-bold text-green-700">{institutionConfig.activeYear}</span>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Ano Lectivo {institutionConfig.activeYear}</p>
                    <p className="text-sm text-slate-500">20 Enero - 28 Noviembre</p>
                    <span className="inline-block mt-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">Activo</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'academic' && (
            <>
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-slate-600" />
                  Periodos Academicos
                </h3>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 px-3 text-sm font-medium text-slate-600">#</th>
                      <th className="text-left py-2 px-3 text-sm font-medium text-slate-600">Nombre</th>
                      <th className="text-left py-2 px-3 text-sm font-medium text-slate-600">Inicio</th>
                      <th className="text-left py-2 px-3 text-sm font-medium text-slate-600">Fin</th>
                      <th className="text-center py-2 px-3 text-sm font-medium text-slate-600">Peso %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map((p) => (
                      <tr key={p.id} className="border-b border-slate-100">
                        <td className="py-2 px-3"><span className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-bold">{p.order}</span></td>
                        <td className="py-2 px-3 font-medium">{p.name}</td>
                        <td className="py-2 px-3"><input type="date" value={p.startDate} onChange={(e) => setPeriods(ps => ps.map(x => x.id === p.id ? { ...x, startDate: e.target.value } : x))} className="px-2 py-1 border border-slate-300 rounded text-sm" /></td>
                        <td className="py-2 px-3"><input type="date" value={p.endDate} onChange={(e) => setPeriods(ps => ps.map(x => x.id === p.id ? { ...x, endDate: e.target.value } : x))} className="px-2 py-1 border border-slate-300 rounded text-sm" /></td>
                        <td className="py-2 px-3 text-center"><input type="number" value={p.weight} onChange={(e) => setPeriods(ps => ps.map(x => x.id === p.id ? { ...x, weight: parseInt(e.target.value) || 0 } : x))} className="w-16 px-2 py-1 border border-slate-300 rounded text-sm text-center" /></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50">
                      <td colSpan={4} className="py-2 px-3 text-right font-medium">Total:</td>
                      <td className="py-2 px-3 text-center"><span className={`font-bold ${periods.reduce((s, p) => s + p.weight, 0) === 100 ? 'text-green-600' : 'text-red-600'}`}>{periods.reduce((s, p) => s + p.weight, 0)}%</span></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Scale className="w-5 h-5 text-slate-600" />
                  Escala de Valoracion (Decreto 1290)
                </h3>
                <div className="space-y-2">
                  {levels.map((l) => (
                    <div key={l.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <div className={`w-4 h-4 rounded-full ${l.color === 'green' ? 'bg-green-500' : l.color === 'blue' ? 'bg-blue-500' : l.color === 'amber' ? 'bg-amber-500' : 'bg-red-500'}`} />
                      <input type="text" value={l.name} onChange={(e) => setLevels(ls => ls.map(x => x.id === l.id ? { ...x, name: e.target.value } : x))} className="w-28 px-2 py-1 border border-slate-300 rounded font-medium" />
                      <input type="number" value={l.minScore} step="0.1" onChange={(e) => setLevels(ls => ls.map(x => x.id === l.id ? { ...x, minScore: parseFloat(e.target.value) } : x))} className="w-16 px-2 py-1 border border-slate-300 rounded text-center" />
                      <span>-</span>
                      <input type="number" value={l.maxScore} step="0.1" onChange={(e) => setLevels(ls => ls.map(x => x.id === l.id ? { ...x, maxScore: parseFloat(e.target.value) } : x))} className="w-16 px-2 py-1 border border-slate-300 rounded text-center" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-slate-600" />
                  Configuracion de Calificaciones
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nota Minima Aprobacion</label>
                    <input type="number" value={academicConfig.minPassingScore} step="0.1" onChange={(e) => setAcademicConfig({ ...academicConfig, minPassingScore: parseFloat(e.target.value) })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nota Maxima</label>
                    <input type="number" value={academicConfig.maxScore} step="0.1" onChange={(e) => setAcademicConfig({ ...academicConfig, maxScore: parseFloat(e.target.value) })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Decimales</label>
                    <select value={academicConfig.decimalPlaces} onChange={(e) => setAcademicConfig({ ...academicConfig, decimalPlaces: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                      <option value={0}>Sin decimales</option>
                      <option value={1}>1 decimal</option>
                      <option value={2}>2 decimales</option>
                    </select>
                  </div>
                  <div className="col-span-3 flex gap-6">
                    <label className="flex items-center gap-2"><input type="checkbox" checked={academicConfig.showRank} onChange={(e) => setAcademicConfig({ ...academicConfig, showRank: e.target.checked })} className="w-4 h-4 rounded" /><span className="text-sm">Mostrar puesto</span></label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={academicConfig.showAbsences} onChange={(e) => setAcademicConfig({ ...academicConfig, showAbsences: e.target.checked })} className="w-4 h-4 rounded" /><span className="text-sm">Mostrar fallas</span></label>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'siee' && (
            <>
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Scale className="w-5 h-5 text-slate-600" />
                  Dimensiones Evaluativas
                </h3>
                <div className="space-y-2">
                  {dimensions.map((d) => (
                    <div key={d.id} className={`flex items-center gap-4 p-3 rounded-lg border ${d.isActive ? 'bg-white border-slate-200' : 'bg-slate-100 border-slate-200 opacity-60'}`}>
                      <input type="checkbox" checked={d.isActive} onChange={(e) => setDimensions(ds => ds.map(x => x.id === d.id ? { ...x, isActive: e.target.checked } : x))} className="w-4 h-4 rounded" />
                      <input type="text" value={d.name} onChange={(e) => setDimensions(ds => ds.map(x => x.id === d.id ? { ...x, name: e.target.value } : x))} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg font-medium" disabled={!d.isActive} />
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500">Peso:</span>
                        <input type="number" value={d.weight} onChange={(e) => setDimensions(ds => ds.map(x => x.id === d.id ? { ...x, weight: parseInt(e.target.value) || 0 } : x))} className="w-16 px-2 py-2 border border-slate-300 rounded-lg text-center" disabled={!d.isActive} />
                        <span className="text-sm text-slate-500">%</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 p-3 bg-slate-50 rounded-lg flex justify-between">
                  <span className="text-sm font-medium">Total dimensiones activas:</span>
                  <span className={`font-bold ${dimensions.filter(d => d.isActive).reduce((s, d) => s + d.weight, 0) === 100 ? 'text-green-600' : 'text-red-600'}`}>{dimensions.filter(d => d.isActive).reduce((s, d) => s + d.weight, 0)}%</span>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-slate-600" />
                  Metodo de Calculo
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Calculo por Periodo</label>
                    <select value={sieeConfig.periodCalculation} onChange={(e) => setSieeConfig({ ...sieeConfig, periodCalculation: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                      <option value="WEIGHTED_DIMENSIONS">Promedio ponderado de dimensiones</option>
                      <option value="SUM_ACTIVITIES">Suma de actividades</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Calculo Final Anual</label>
                    <select value={sieeConfig.finalCalculation} onChange={(e) => setSieeConfig({ ...sieeConfig, finalCalculation: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                      <option value="WEIGHTED_PERIODS">Promedio ponderado de periodos</option>
                      <option value="AVERAGE_PERIODS">Promedio simple</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-slate-600" />
                  Reglas de Promocion (Decreto 1290)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Max. Areas Reprobadas</label>
                    <input type="number" value={sieeConfig.maxFailedAreas} onChange={(e) => setSieeConfig({ ...sieeConfig, maxFailedAreas: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" min="0" />
                    <p className="text-xs text-slate-500 mt-1">Maximo de areas que puede reprobar para ser promovido</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Min. Asistencia (%)</label>
                    <input type="number" value={sieeConfig.minAttendance} onChange={(e) => setSieeConfig({ ...sieeConfig, minAttendance: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" min="0" max="100" />
                    <p className="text-xs text-slate-500 mt-1">Porcentaje minimo de asistencia requerido</p>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 mb-2"><input type="checkbox" checked={sieeConfig.includeRecovery} onChange={(e) => setSieeConfig({ ...sieeConfig, includeRecovery: e.target.checked })} className="w-4 h-4 rounded" /><span className="text-sm font-medium">Incluir recuperacion</span></label>
                    <p className="text-xs text-slate-500">La nota de recuperacion se incluye en el calculo final</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nota Max. Recuperacion</label>
                    <input type="number" value={sieeConfig.maxRecoveryScore} step="0.1" onChange={(e) => setSieeConfig({ ...sieeConfig, maxRecoveryScore: parseFloat(e.target.value) })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" disabled={!sieeConfig.includeRecovery} />
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'users' && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-slate-600" />
                  Usuarios del Sistema
                </h3>
                <button className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  <Plus className="w-4 h-4" />
                  Nuevo Usuario
                </button>
              </div>
              <div className="flex gap-4 mb-4">
                <input type="text" placeholder="Buscar..." value={userFilter.search} onChange={(e) => setUserFilter({ ...userFilter, search: e.target.value })} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg" />
                <select value={userFilter.role} onChange={(e) => setUserFilter({ ...userFilter, role: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg">
                  <option value="ALL">Todos los roles</option>
                  {roles.map(r => <option key={r.name} value={r.name}>{r.displayName}</option>)}
                </select>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Usuario</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Rol</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-slate-600">Estado</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-slate-600">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center"><span className="text-sm font-medium text-slate-600">{u.firstName[0]}{u.lastName[0]}</span></div>
                          <div>
                            <p className="font-medium text-slate-900">{u.firstName} {u.lastName}</p>
                            <p className="text-sm text-slate-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4"><span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded">{roles.find(r => r.name === u.role)?.displayName}</span></td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{u.isActive ? 'Activo' : 'Inactivo'}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button className="p-1.5 hover:bg-slate-100 rounded text-slate-500"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => setUsers(us => us.map(x => x.id === u.id ? { ...x, isActive: !x.isActive } : x))} className="p-1.5 hover:bg-slate-100 rounded text-slate-500">{u.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
