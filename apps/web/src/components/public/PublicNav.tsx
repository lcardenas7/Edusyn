import { Link, useLocation } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

const LINKS = [
  { to: '/caracteristicas', label: 'Características' },
  { to: '/precios', label: 'Precios' },
  { to: '/casos-de-exito', label: 'Casos de Éxito' },
  { to: '/preguntas-frecuentes', label: 'Preguntas Frecuentes' },
  { to: '/recursos', label: 'Recursos' },
  { to: '/contacto', label: 'Contacto' },
]

export default function PublicNav() {
  const { pathname } = useLocation()

  return (
    <header className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-b border-slate-100 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-3">
            <img src="/brand/edusyn-icon.png" alt="Edusyn" className="w-10 h-10 object-contain" />
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Edusyn
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-7">
            {LINKS.map((link) => {
              const isActive = pathname === link.to
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`text-sm font-medium transition-colors ${
                    isActive ? 'text-blue-600' : 'text-slate-600 hover:text-blue-600'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>

          <Link
            to="/login"
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2 text-sm"
          >
            Iniciar Sesión
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </header>
  )
}
