import { ReactNode, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { usePlayAuth } from '../../contexts/PlayAuthContext'
import {
  Sparkles,
  LayoutDashboard,
  FileQuestion,
  BookOpen,
  Radio,
  LogOut,
  Menu,
  X,
  ChevronRight,
  User,
} from 'lucide-react'

interface NavItem {
  name: string
  href: string
  icon: any
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/play', icon: LayoutDashboard },
  { name: 'Mis Quizzes', href: '/play/quizzes', icon: FileQuestion },
  { name: 'Mis Lecciones', href: '/play/lessons', icon: BookOpen },
  { name: 'Sesiones', href: '/play/sessions', icon: Radio },
]

export default function PlayLayout({ children }: { children: ReactNode }) {
  const { user, logout } = usePlayAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login-play')
  }

  const isActive = (href: string) => {
    if (href === '/play') return location.pathname === '/play'
    return location.pathname.startsWith(href)
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 border-b border-violet-500/20">
        <Link to="/play" className="flex items-center gap-2">
          <Sparkles className="w-7 h-7 text-white" />
          <span className="text-xl font-bold text-white">Edusyn Play</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {navigation.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              isActive(item.href)
                ? 'bg-white/20 text-white shadow-sm'
                : 'text-violet-100 hover:bg-white/10 hover:text-white'
            }`}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            <span>{item.name}</span>
            {isActive(item.href) && <ChevronRight className="w-4 h-4 ml-auto" />}
          </Link>
        ))}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-violet-500/20">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-violet-200 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-violet-100 hover:bg-white/10 rounded-lg transition"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-shrink-0 bg-gradient-to-b from-violet-600 to-fuchsia-700 flex-col fixed inset-y-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-64 bg-gradient-to-b from-violet-600 to-fuchsia-700 flex flex-col z-10">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-lg p-1"
            >
              <X className="w-5 h-5" />
            </button>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Top bar mobile */}
        <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100 transition"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-600" />
            <span className="font-bold text-gray-900">Edusyn Play</span>
          </div>
          <div className="w-9" />
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
