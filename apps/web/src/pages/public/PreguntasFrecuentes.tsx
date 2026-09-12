import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ArrowRight } from 'lucide-react'
import PublicNav from '../../components/public/PublicNav'
import PublicFooter from '../../components/public/PublicFooter'
import { useSeo } from '../../hooks/useSeo'

const FAQS = [
  {
    q: '¿Edusyn reemplaza todas las plataformas que usamos?',
    a: 'No necesariamente. Edusyn integra varios procesos en un solo lugar según los módulos que actives, y puede convivir con herramientas que ya uses. En la demo revisamos tu caso concreto.',
  },
  {
    q: '¿Cuánto tarda la implementación?',
    a: 'La implementación estándar toma entre 2 y 4 semanas una vez recibida la información de la institución, según el plan y el alcance acordado.',
  },
  {
    q: '¿Qué pasa con nuestros datos si decidimos no continuar?',
    a: 'Tus datos son tuyos. Al finalizar el contrato tienes la opción de exportarlos en un formato estándar. No hay renovaciones automáticas.',
  },
  {
    q: '¿Cómo manejan la protección de datos de estudiantes y familias?',
    a: 'Trabajamos con un acuerdo de tratamiento de datos conforme a la Ley 1581 de 2012. Edusyn trata los datos únicamente para prestar el servicio, y la institución conserva su titularidad.',
  },
  {
    q: '¿Puedo probar antes de contratar un año completo?',
    a: 'Sí: puedes usar Edusyn en paralelo con tu plataforma actual, con alcance real y limitado, para validar antes de decidir.',
  },
  {
    q: '¿Atienden instituciones públicas?',
    a: 'Sí, bajo condiciones específicas de contratación pública, con revisión jurídica previa y reglas de transparencia. Escríbenos para revisar tu caso.',
  },
  {
    q: '¿Qué soporte incluye?',
    a: 'Soporte por correo y WhatsApp en horario laboral, con tiempos orientativos de respuesta según la prioridad, definidos en el anexo de soporte de tu contrato.',
  },
  {
    q: '¿Necesitamos instalar algo en los computadores del colegio?',
    a: 'No. Edusyn funciona en el navegador, desde cualquier computador, tableta o celular, sin servidores ni programas adicionales.',
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="font-semibold text-slate-900">{q}</span>
        <ChevronDown className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-5 pb-5 text-slate-600 leading-relaxed">{a}</div>}
    </div>
  )
}

export default function PreguntasFrecuentes() {
  useSeo(
    'Preguntas frecuentes — Edusyn',
    'Resolvemos las dudas más comunes sobre implementación, datos, soporte y contratación de Edusyn, la plataforma de gestión educativa colombiana.',
  )

  return (
    <div className="min-h-screen bg-white">
      <PublicNav />

      <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">Preguntas frecuentes</h1>
        <p className="text-xl text-slate-600 max-w-2xl mx-auto">Lo que más nos preguntan rectores y coordinadores antes de decidir.</p>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto space-y-4">
          {FAQS.map((f) => <FaqItem key={f.q} q={f.q} a={f.a} />)}
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-50 text-center">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">¿Tu pregunta no está aquí?</h2>
        <Link to="/contacto" className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all">
          Escríbenos <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      <PublicFooter />
    </div>
  )
}
