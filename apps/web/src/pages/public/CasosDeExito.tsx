import { Link } from 'react-router-dom'
import { ArrowRight, ShieldCheck, Users, FileCheck } from 'lucide-react'
import PublicNav from '../../components/public/PublicNav'
import PublicFooter from '../../components/public/PublicFooter'
import { useSeo } from '../../hooks/useSeo'

export default function CasosDeExito() {
  useSeo(
    'Casos de éxito — Edusyn',
    'Edusyn está en uso real en instituciones educativas colombianas. Conoce cómo empezar con evidencia propia, sin promesas ni testimonios inventados.',
  )

  return (
    <div className="min-h-screen bg-white">
      <PublicNav />

      <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">Somos honestos sobre dónde estamos</h1>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            Edusyn es una plataforma joven, en uso real por instituciones educativas colombianas
            hoy. No vamos a mostrarte un logo o una cita que no exista solo para parecer más grande
            — preferimos que decidas con evidencia de tu propia institución.
          </p>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8 text-center">
          <div>
            <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-100 flex items-center justify-center mb-4">
              <Users className="w-7 h-7 text-blue-600" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Instituciones activas reales</h3>
            <p className="text-slate-600 text-sm">
              Hoy Edusyn opera en instituciones educativas con años lectivos gestionados de punta a
              punta dentro de la plataforma, y varias más en proceso de prueba.
            </p>
          </div>
          <div>
            <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-100 flex items-center justify-center mb-4">
              <FileCheck className="w-7 h-7 text-blue-600" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Construido desde el aula</h3>
            <p className="text-slate-600 text-sm">
              Su fundador es docente en ejercicio e ingeniero. Cada módulo nace de un problema real
              vivido calificando, no de un catálogo de funciones.
            </p>
          </div>
          <div>
            <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-100 flex items-center justify-center mb-4">
              <ShieldCheck className="w-7 h-7 text-blue-600" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Sin promesas que no sostenemos</h3>
            <p className="text-slate-600 text-sm">
              No prometemos resultados académicos garantizados ni afirmamos integraciones o
              certificaciones que no tenemos. Lo que decimos que hace la plataforma, lo hace.
            </p>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">
            Prueba con la información real de tu institución
          </h2>
          <p className="text-slate-600 mb-8">
            En vez de pedirte que confíes en una cita ajena, te proponemos algo más simple: usa
            Edusyn en paralelo con tu plataforma actual, con tus propios datos, y compara los
            resultados al cierre del período. Nosotros cargamos la información — tú decides con lo
            que veas.
          </p>
          <Link
            to="/contacto"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-xl"
          >
            Conversemos sobre tu institución <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
