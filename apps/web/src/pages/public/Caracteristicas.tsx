import { Link } from 'react-router-dom'
import {
  GraduationCap, Users, ClipboardList, TrendingUp, MessageCircle, Bot, Monitor,
  CheckCircle, ArrowRight, MonitorPlay, Video, BarChart3, Wand2, FileText, Sparkles,
} from 'lucide-react'
import PublicNav from '../../components/public/PublicNav'
import PublicFooter from '../../components/public/PublicFooter'
import { useSeo } from '../../hooks/useSeo'

const MODULES = [
  {
    icon: GraduationCap, color: 'blue', title: 'Gestión académica',
    items: ['Años lectivos y períodos', 'Áreas y asignaturas', 'Planes de estudio', 'Escala de valoración institucional'],
  },
  {
    icon: Users, color: 'indigo', title: 'Gestión de personas',
    items: ['Estudiantes y matrículas', 'Docentes y carga académica', 'Acudientes y contactos', 'Personal administrativo'],
  },
  {
    icon: ClipboardList, color: 'purple', title: 'Evaluación',
    items: ['Actividades evaluativas', 'Registro de notas por período', 'Recuperaciones', 'Boletines conforme al Decreto 1290'],
  },
  {
    icon: TrendingUp, color: 'green', title: 'Reportes y seguimiento',
    items: ['Estadísticas en tiempo real', 'Informes de desempeño', 'Exportación a Excel y PDF', 'Observador del estudiante'],
  },
  {
    icon: MessageCircle, color: 'rose', title: 'Comunicación institucional',
    items: ['Circulares y comunicados', 'Notificaciones a familias', 'Canal directo con docentes', 'Calendario de eventos'],
  },
  {
    icon: Monitor, color: 'violet', title: 'Aula virtual',
    items: ['Clases y contenidos digitales', 'Actividades y quices', 'Calificación integrada con el registro académico', 'Seguimiento del progreso por estudiante'],
  },
]

export default function Caracteristicas() {
  useSeo(
    'Características y módulos — Edusyn',
    'Gestión académica, evaluación, comunicación, aula virtual y Valeria IA en una sola plataforma educativa colombiana. Descubre qué incluye Edusyn.',
  )

  return (
    <div className="min-h-screen bg-white">
      <PublicNav />

      <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">
            Un dato, cuatro profundidades
          </h1>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            En cualquier otra plataforma, una nota es un número guardado en una casilla. En Edusyn
            queda conectada al estudiante: el mismo registro que hace un docente sirve para el
            boletín, para el seguimiento y, cuando se activa, para el acompañamiento con IA — sin
            trabajo adicional.
          </p>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Módulos disponibles</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Se activan según el plan contratado — pagas por lo que tu institución usa.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {MODULES.map((m) => (
              <div key={m.title} className="bg-white rounded-2xl overflow-hidden shadow-lg border border-slate-100">
                <div className={`bg-gradient-to-r from-${m.color}-500 to-${m.color}-600 p-6`}>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                      <m.icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-white">{m.title}</h3>
                  </div>
                </div>
                <div className="p-6">
                  <ul className="space-y-3">
                    {m.items.map((it) => (
                      <li key={it} className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                        <span className="text-slate-700">{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-3xl p-8 border border-violet-100">
            <div className="flex items-start gap-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg flex-shrink-0">
                <MonitorPlay className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Aula virtual</h3>
                <p className="text-slate-600 leading-relaxed mb-4">
                  Clases con contenido, quices y seguimiento del progreso — integrado con el
                  registro académico, no como sistema aparte.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-violet-700 text-xs font-medium rounded-full shadow-sm"><Video className="w-3.5 h-3.5" />Clases y contenidos</span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-violet-700 text-xs font-medium rounded-full shadow-sm"><ClipboardList className="w-3.5 h-3.5" />Quices</span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-violet-700 text-xs font-medium rounded-full shadow-sm"><BarChart3 className="w-3.5 h-3.5" />Progreso</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-8 border border-amber-100">
            <div className="flex items-start gap-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg flex-shrink-0">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-bold text-slate-900">Valeria IA</h3>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">Según disponibilidad del plan</span>
                </div>
                <p className="text-slate-600 leading-relaxed mb-4">
                  Asistente para el docente: ayuda a redactar y diseñar actividades, orienta sobre
                  la plataforma y acompaña decisiones del día a día.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-amber-700 text-xs font-medium rounded-full shadow-sm"><Wand2 className="w-3.5 h-3.5" />Apoyo a crear contenido</span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-amber-700 text-xs font-medium rounded-full shadow-sm"><FileText className="w-3.5 h-3.5" />Orienta procesos</span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-amber-700 text-xs font-medium rounded-full shadow-sm"><Sparkles className="w-3.5 h-3.5" />Acompañamiento</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-600 to-indigo-600 text-center">
        <h2 className="text-3xl font-bold text-white mb-6">¿Cuáles activa tu institución?</h2>
        <p className="text-blue-100 mb-8 max-w-xl mx-auto">Lo revisamos juntos en una demostración de 30 minutos, con tu propio caso.</p>
        <Link to="/contacto" className="inline-flex items-center gap-2 bg-white text-blue-600 px-8 py-4 rounded-xl font-semibold hover:bg-blue-50 transition-all shadow-xl">
          Solicitar una demostración <ArrowRight className="w-5 h-5" />
        </Link>
      </section>

      <PublicFooter />
    </div>
  )
}
