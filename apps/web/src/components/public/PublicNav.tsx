import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, Menu, X } from 'lucide-react'

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
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-b border-slate-100 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-2 h-16">
          <Link to="/" className="flex items-center gap-3">
            <img src="/brand/edusyn-icon.png" alt="Edusyn" className="w-10 h-10 object-contain" />
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Edusyn
            </span>
          </Link>

          <nav aria-label="Navegación principal" className="hidden xl:flex items-center gap-5">
            {LINKS.map((link) => {
              const isActive = pathname === link.to
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  aria-current={isActive ? 'page' : undefined}
                  className={`text-sm font-medium transition-colors ${
                    isActive ? 'text-blue-600' : 'text-slate-600 hover:text-blue-600'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3 sm:px-5 py-2.5 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2 text-sm whitespace-nowrap"
            >
              <span className="sm:hidden">Ingresar</span>
              <span className="hidden sm:inline">Iniciar sesión</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <button
              type="button"
              aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={menuOpen}
              aria-controls="public-mobile-nav"
              onClick={() => setMenuOpen((open) => !open)}
              className="xl:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg text-slate-700 hover:bg-slate-100"
            >
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav id="public-mobile-nav" aria-label="Navegación móvil" className="xl:hidden border-t border-slate-100 py-3 max-h-[calc(100vh-4rem)] overflow-y-auto">
            {LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                aria-current={pathname === link.to ? 'page' : undefined}
                className={`block rounded-lg px-3 py-3 text-sm font-medium hover:bg-blue-50 hover:text-blue-700 ${pathname === link.to ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  )
}
