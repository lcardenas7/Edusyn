import PublicNav from '../../components/public/PublicNav'
import PublicFooter from '../../components/public/PublicFooter'
import { useSeo } from '../../hooks/useSeo'
import { MessageCircle, Mail, Clock } from 'lucide-react'

export default function Contacto() {
  useSeo(
    'Contacto — Edusyn',
    'Agenda una demostración de Edusyn o escríbenos por WhatsApp o correo. Respondemos en horario laboral, Colombia.',
  )

  return (
    <div className="min-h-screen bg-white">
      <PublicNav />

      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">Hablemos de tu institución</h1>
          <p className="text-xl text-slate-600 mb-10">
            Una demostración de 30 minutos, sin compromiso, con los procesos de tu propia
            institución.
          </p>

          <div className="grid sm:grid-cols-2 gap-6 max-w-xl mx-auto">
            <a
              href="https://wa.me/573104019732"
              target="_blank" rel="noreferrer"
              className="flex flex-col items-center gap-3 bg-white p-6 rounded-2xl border border-slate-200 hover:border-green-300 hover:shadow-lg transition-all"
            >
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-green-600" />
              </div>
              <span className="font-semibold text-slate-900">WhatsApp</span>
              <span className="text-sm text-slate-500">+57 310 401 9732</span>
            </a>

            <a
              href="mailto:info@edusyn.co"
              className="flex flex-col items-center gap-3 bg-white p-6 rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Mail className="w-6 h-6 text-blue-600" />
              </div>
              <span className="font-semibold text-slate-900">Correo</span>
              <span className="text-sm text-slate-500">info@edusyn.co</span>
            </a>
          </div>

          <div className="flex items-center justify-center gap-2 text-sm text-slate-500 mt-10">
            <Clock className="w-4 h-4" />
            Lunes a viernes, 8:00 a.m. a 6:00 p.m., hora de Colombia
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
