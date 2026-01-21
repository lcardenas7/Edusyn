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
  X,
  ChevronDown,
  ChevronRight,
  Settings,
  UserCheck,
  Target,
  TrendingUp,
  Plus
} from 'lucide-react'

type Role = 'SUPERADMIN' | 'ADMIN_INSTITUTIONAL' | 'COORDINADOR' | 'DOCENTE' | 'ACUDIENTE' | 'ESTUDIANTE'

interface NavItem {
  name: string
  href?: string
  icon: any
  roles: Role[]
  module?: string  // Módulo requerido para mostrar este item
  children?: NavItem[]
}

// ═══════════════════════════════════════════════════════════════════════════
// MENÚ SUPERADMIN - Panel de control de la plataforma SaaS
// El SuperAdmin es el arquitecto del sistema, NO el rector
// ═══════════════════════════════════════════════════════════════════════════
const superAdminNavigation: NavItem[] = [
  { name: 'Panel SuperAdmin', href: '/superadmin', icon: LayoutDashboard, roles: ['SUPERADMIN'] },
  
  // Gestión de Instituciones
  { 
    name: 'Instituciones', 
    icon: Building2, 
    roles: ['SUPERADMIN'],
    children: [
      { name: 'Todas las Instituciones', href: '/superadmin/institutions', icon: Building2, roles: ['SUPERADMIN'] },
      { name: 'Crear Institución', href: '/superadmin/institutions/new', icon: Plus, roles: ['SUPERADMIN'] },
      { name: 'Configuraciones', href: '/superadmin/configs', icon: Settings, roles: ['SUPERADMIN'] },
    ]
  },
  
  // Auditoría y Control
  { 
    name: 'Auditoría', 
    icon: ClipboardList, 
    roles: ['SUPERADMIN'],
    children: [
      { name: 'Logs del Sistema', href: '/superadmin/audit-logs', icon: FileText, roles: ['SUPERADMIN'] },
      { name: 'Actividad Usuarios', href: '/superadmin/user-activity', icon: Users, roles: ['SUPERADMIN'] },
    ]
  },
  
  // Herramientas
  { 
    name: 'Herramientas', 
    icon: Settings, 
    roles: ['SUPERADMIN'],
    children: [
      { name: 'Recalcular Académico', href: '/superadmin/recalculate', icon: RefreshCw, roles: ['SUPERADMIN'] },
      { name: 'Clonar Configuración', href: '/superadmin/clone-config', icon: Layers, roles: ['SUPERADMIN'] },
    ]
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// MENÚ INSTITUCIONAL - Para Admin, Coordinador, Docente
// Cada institución define sus propias reglas académicas
// Los módulos se filtran según lo configurado por el SuperAdmin
// ═══════════════════════════════════════════════════════════════════════════
const institutionalNavigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE'], module: 'DASHBOARD' },
  
  // Gestión Institucional (Solo Admin y Coordinador)
  { 
    name: 'Gestión Institucional', 
    icon: Building2, 
    roles: ['ADMIN_INSTITUTIONAL', 'COORDINADOR'],
    module: 'CONFIG',
    children: [
      { name: 'Configuración', href: '/institution', icon: Settings, roles: ['ADMIN_INSTITUTIONAL', 'COORDINADOR'], module: 'CONFIG' },
      { name: 'Áreas y Asignaturas', href: '/admin/areas', icon: Layers, roles: ['ADMIN_INSTITUTIONAL', 'COORDINADOR'], module: 'ACADEMIC' },
    ]
  },
  
  // Gestión de Personas
  { 
    name: 'Gestión de Personas', 
    icon: Users, 
    roles: ['ADMIN_INSTITUTIONAL', 'COORDINADOR'],
    module: 'USERS',
    children: [
      { name: 'Docentes', href: '/teachers', icon: UserCog, roles: ['ADMIN_INSTITUTIONAL', 'COORDINADOR'], module: 'USERS' },
      { name: 'Estudiantes', href: '/students', icon: Users, roles: ['ADMIN_INSTITUTIONAL', 'COORDINADOR'], module: 'USERS' },
      { name: 'Carga Académica', href: '/academic-load', icon: Briefcase, roles: ['ADMIN_INSTITUTIONAL', 'COORDINADOR'], module: 'ACADEMIC' },
      { name: 'Permisos', href: '/admin/permissions', icon: UserCheck, roles: ['ADMIN_INSTITUTIONAL'], module: 'USERS' },
    ]
  },
  
  // Gestión Académica
  { 
    name: 'Gestión Académica', 
    icon: BookOpen, 
    roles: ['ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE'],
    module: 'ACADEMIC',
    children: [
      { name: 'Calificaciones', href: '/grades', icon: BookOpen, roles: ['ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE'], module: 'ACADEMIC' },
      { name: 'Nota Final Período', href: '/period-final-grades', icon: FileText, roles: ['ADMIN_INSTITUTIONAL', 'COORDINADOR'], module: 'ACADEMIC' },
      { name: 'Desempeños', href: '/performances', icon: Target, roles: ['ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE'], module: 'PERFORMANCE' },
      { name: 'Recuperaciones', href: '/recoveries', icon: RefreshCw, roles: ['ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE'], module: 'RECOVERY' },
    ]
  },
  
  // Seguimiento Estudiantil
  { 
    name: 'Seguimiento', 
    icon: UserCheck, 
    roles: ['ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE'],
    children: [
      { name: 'Asistencia', href: '/attendance', icon: Calendar, roles: ['ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE'], module: 'ATTENDANCE' },
      { name: 'Observador', href: '/observer', icon: ClipboardList, roles: ['ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE'], module: 'OBSERVER' },
      { name: 'Alertas', href: '/alerts', icon: AlertTriangle, roles: ['ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE'] },
    ]
  },
  
  // Reportes y Estadísticas
  { 
    name: 'Reportes', 
    icon: TrendingUp, 
    roles: ['ADMIN_INSTITUTIONAL', 'COORDINADOR'],
    module: 'REPORTS',
    children: [
      { name: 'Informes', href: '/reports', icon: PieChart, roles: ['ADMIN_INSTITUTIONAL', 'COORDINADOR'], module: 'REPORTS' },
      { name: 'Boletines', href: '/report-cards', icon: FileText, roles: ['ADMIN_INSTITUTIONAL', 'COORDINADOR'], module: 'REPORTS' },
      { name: 'Estadísticas', href: '/statistics', icon: BarChart3, roles: ['ADMIN_INSTITUTIONAL', 'COORDINADOR'], module: 'REPORTS' },
    ]
  },
  
  // Comunicaciones
  { 
    name: 'Comunicaciones', 
    icon: Bell, 
    roles: ['ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE'],
    module: 'COMMUNICATIONS',
    children: [
      { name: 'Mensajes', href: '/communications', icon: Bell, roles: ['ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE'], module: 'COMMUNICATIONS' },
      { name: 'Contenidos', href: '/content-manager', icon: Megaphone, roles: ['ADMIN_INSTITUTIONAL', 'COORDINADOR'], module: 'COMMUNICATIONS' },
    ]
  },
]

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout, hasModule } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expandedMenus, setExpandedMenus] = useState<string[]>([])

  const userRoles = useMemo(() => {
    if (!user?.roles) return []
    return user.roles.map((r: any) => typeof r === 'string' ? r : r.role?.name || r.name).filter(Boolean)
  }, [user?.roles])

  // Determinar si es SuperAdmin
  const isSuperAdmin = useMemo(() => userRoles.includes('SUPERADMIN'), [userRoles])

  // Seleccionar menú según rol: SuperAdmin tiene su propio menú
  const navigation = useMemo(() => {
    return isSuperAdmin ? superAdminNavigation : institutionalNavigation
  }, [isSuperAdmin])

  // Filtrar navegación según roles del usuario Y módulos habilitados
  const filteredNavigation = useMemo(() => {
    const filterByRoleAndModule = (item: NavItem): boolean => {
      // Verificar rol
      const hasRole = item.roles.some((role: Role) => userRoles.includes(role))
      if (!hasRole) return false
      
      // Si no tiene módulo definido o es SuperAdmin, mostrar
      if (!item.module || isSuperAdmin) return true
      
      // Verificar si el módulo está habilitado
      return hasModule(item.module)
    }

    return navigation
      .filter(filterByRoleAndModule)
      .map((item: NavItem) => ({
        ...item,
        children: item.children?.filter(filterByRoleAndModule)
      }))
      // Filtrar items padre que quedaron sin hijos
      .filter((item: NavItem) => !item.children || item.children.length > 0)
  }, [userRoles, navigation, isSuperAdmin, hasModule])

  // Auto-expandir menú si la ruta actual está en un submenú
  useMemo(() => {
    const currentPath = location.pathname
    filteredNavigation.forEach(item => {
      if (item.children?.some(child => child.href === currentPath)) {
        if (!expandedMenus.includes(item.name)) {
          setExpandedMenus(prev => [...prev, item.name])
        }
      }
    })
  }, [location.pathname, filteredNavigation])

  const toggleMenu = (menuName: string) => {
    setExpandedMenus(prev => 
      prev.includes(menuName) 
        ? prev.filter(m => m !== menuName) 
        : [...prev, menuName]
    )
  }

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
            const hasChildren = item.children && item.children.length > 0
            const isExpanded = expandedMenus.includes(item.name)
            const isChildActive = item.children?.some(child => location.pathname === child.href)
            const isActive = location.pathname === item.href

            // Ítem con submenú
            if (hasChildren) {
              return (
                <div key={item.name}>
                  <button
                    onClick={() => toggleMenu(item.name)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isChildActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-5 h-5" />
                      {item.name}
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  
                  {isExpanded && (
                    <div className="ml-4 mt-1 space-y-1 border-l-2 border-slate-200 pl-3">
                      {item.children?.map((child) => {
                        const isChildItemActive = location.pathname === child.href
                        return (
                          <Link
                            key={child.name}
                            to={child.href!}
                            onClick={handleNavClick}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                              isChildItemActive
                                ? 'bg-blue-50 text-blue-700 font-medium'
                                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                          >
                            <child.icon className="w-4 h-4" />
                            {child.name}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            // Ítem simple sin submenú
            return (
              <Link
                key={item.name}
                to={item.href!}
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
