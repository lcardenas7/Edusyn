import { ReactNode, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  ClipboardList, 
  Calendar, 
  FileText, 
  Bell, 
  LogOut,
  GraduationCap,
  BarChart3,
  AlertTriangle,
  Building2,
  Layers,
  UserCog,
  Briefcase,
  PieChart,
  RefreshCw,
  Megaphone,
  Menu,
  X
} from 'lucide-react'

type Role = 'SUPERADMIN' | 'ADMIN_INSTITUTIONAL' | 'COORDINADOR' | 'DOCENTE' | 'ACUDIENTE' | 'ESTUDIANTE'

interface NavItem {
  name: string
  href: string
  icon: any
  roles: Role[]
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE'] },
  { name: 'Institución', href: '/institution', icon: Building2, roles: ['SUPERADMIN', 'ADMIN_INSTITUTIONAL'] },
  { name: 'Docentes', href: '/teachers', icon: UserCog, roles: ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR'] },
  { name: 'Carga Académica', href: '/academic-load', icon: Briefcase, roles: ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR'] },
  { name: 'Estudiantes', href: '/students', icon: Users, roles: ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR'] },
  { name: 'Calificaciones', href: '/grades', icon: BookOpen, roles: ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE'] },
  { name: 'Nota Final Período', href: '/period-final-grades', icon: FileText, roles: ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR'] },
  { name: 'Asistencia', href: '/attendance', icon: Calendar, roles: ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE'] },
  { name: 'Observador', href: '/observer', icon: ClipboardList, roles: ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE'] },
  { name: 'Alertas', href: '/alerts', icon: AlertTriangle, roles: ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE'] },
  { name: 'Reportes', href: '/reports', icon: PieChart, roles: ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR'] },
  { name: 'Boletines', href: '/report-cards', icon: FileText, roles: ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR'] },
  { name: 'Estadísticas', href: '/statistics', icon: BarChart3, roles: ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR'] },
  { name: 'Comunicaciones', href: '/communications', icon: Bell, roles: ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE'] },
  { name: 'Contenidos', href: '/content-manager', icon: Megaphone, roles: ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR'] },
  { name: 'Recuperaciones', href: '/recoveries', icon: RefreshCw, roles: ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE'] },
  { name: 'Desempeños', href: '/performances', icon: FileText, roles: ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE'] },
  { name: 'Áreas', href: '/admin/areas', icon: Layers, roles: ['SUPERADMIN', 'ADMIN_INSTITUTIONAL'] },
]

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const userRoles = useMemo(() => {
    if (!user?.roles) return []
    return user.roles.map((r: any) => typeof r === 'string' ? r : r.role?.name || r.name).filter(Boolean)
  }, [user?.roles])

  const filteredNavigation = useMemo(() => {
    return navigation.filter(item => 
      item.roles.some(role => userRoles.includes(role))
    )
  }, [userRoles])

  const handleNavClick = () => {
    setSidebarOpen(false)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Edusyn</h1>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg hover:bg-slate-100"
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 shadow-sm
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:top-0 top-14
      `}>
        <div className="hidden lg:flex items-center gap-3 px-6 py-5 border-b border-slate-200">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Edusyn</h1>
            <p className="text-xs text-slate-500">Sistema Académico</p>
          </div>
        </div>

        <nav className="px-3 py-4 space-y-1 overflow-y-auto max-h-[calc(100vh-200px)] lg:max-h-[calc(100vh-200px)]">
          {filteredNavigation.map((item) => {
            const isActive = location.pathname === item.href
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={handleNavClick}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            )
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-200 bg-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-slate-600">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:pl-64 pt-14 lg:pt-0">
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
