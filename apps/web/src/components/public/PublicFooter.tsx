import { Link } from 'react-router-dom'
import { Mail, Phone, MapPin } from 'lucide-react'

export default function PublicFooter() {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-900">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-3 mb-6">
              <img src="/brand/edusyn-icon.png" alt="Edusyn" className="w-12 h-12 object-contain" />
              <span className="text-3xl font-bold text-white">Edusyn</span>
            </Link>
            <p className="text-slate-400 max-w-md">
              Plataforma colombiana de gestión educativa, construida desde la práctica docente
              real. Aprende, Conecta, Transforma.
            </p>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Explorar</h4>
            <ul className="space-y-3">
              <li><Link to="/caracteristicas" className="text-slate-400 hover:text-white transition-colors">Características</Link></li>
              <li><Link to="/precios" className="text-slate-400 hover:text-white transition-colors">Precios</Link></li>
              <li><Link to="/casos-de-exito" className="text-slate-400 hover:text-white transition-colors">Casos de éxito</Link></li>
              <li><Link to="/preguntas-frecuentes" className="text-slate-400 hover:text-white transition-colors">Preguntas frecuentes</Link></li>
              <li><Link to="/recursos" className="text-slate-400 hover:text-white transition-colors">Recursos</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Contacto</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-3 text-slate-400">
                <Mail className="w-5 h-5 flex-shrink-0" />
                <a href="mailto:info@edusyn.co" className="hover:text-white transition-colors">info@edusyn.co</a>
              </li>
              <li className="flex items-center gap-3 text-slate-400">
                <Phone className="w-5 h-5 flex-shrink-0" />
                <a href="https://wa.me/573104019732" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">+57 310 401 9732</a>
              </li>
              <li className="flex items-center gap-3 text-slate-400">
                <MapPin className="w-5 h-5 flex-shrink-0" />
                <span>Barranquilla, Colombia</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-12 pt-8 text-center">
          <p className="text-slate-500">© {new Date().getFullYear()} Edusyn. Todos los derechos reservados.</p>
        </div>
      </div>
    </section>
  )
}
