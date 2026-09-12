import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle, ArrowRight, MessageCircle, Minus, Plus } from 'lucide-react'
import PublicNav from '../../components/public/PublicNav'
import PublicFooter from '../../components/public/PublicFooter'
import { useSeo } from '../../hooks/useSeo'

type Plan = {
  name: string
  perStudentYear: number
  minAnnual: number
  minSize: number
  maxSize: number
  mostChosen: boolean
  features: string[]
}

const PLANS: Plan[] = [
  {
    name: 'Esencial',
    perStudentYear: 3500,
    minAnnual: 700_000,
    minSize: 0,
    maxSize: 300,
    mostChosen: false,
    features: [
      'Años lectivos, períodos, áreas y asignaturas',
      'Matrículas y hoja de vida del estudiante',
      'Notas, recuperaciones y boletines conforme al Decreto 1290',
      'Asistencia y certificados',
      'Circulares, comunicados y calendario de eventos',
    ],
  },
  {
    name: 'Crecimiento',
    perStudentYear: 5200,
    minAnnual: 1_200_000,
    minSize: 301,
    maxSize: 800,
    mostChosen: false,
    features: [
      'Todo lo de Esencial',
      'Aula virtual: clases, contenidos y quices integrados con las notas',
      'Observador del estudiante',
      'Estadísticas en tiempo real y exportación a Excel/PDF',
      'Acompañamiento de adopción durante la implementación',
    ],
  },
  {
    name: 'Integral',
    perStudentYear: 7800,
    minAnnual: 2_200_000,
    minSize: 801,
    maxSize: 1500,
    mostChosen: true,
    features: [
      'Todo lo de Crecimiento',
      'Gestión financiera institucional: cartera, pagos y facturación',
      'Configuración ampliada y seguimiento mensual con Edusyn',
      'Analítica educativa habilitada',
      'Reportes avanzados de desempeño',
    ],
  },
  {
    name: 'Institucional',
    perStudentYear: 11_500,
    minAnnual: 4_000_000,
    minSize: 1501,
    maxSize: Infinity,
    mostChosen: false,
    features: [
      'Todo lo de Integral',
      'Valeria IA para docentes',
      'Multi-sede y varias jornadas',
      'Requerimientos e integraciones especiales, a la medida',
      'Soporte prioritario',
    ],
  },
]

function formatCOP(value: number) {
  return `$${Math.round(value).toLocaleString('es-CO')}`
}

function planForStudents(count: number) {
  return PLANS.find((p) => count >= p.minSize && count <= p.maxSize) ?? PLANS[0]
}

export default function Precios() {
  useSeo(
    'Precios — Edusyn',
    'Planes de Edusyn por estudiante/año. Calcula el costo según el tamaño de tu institución y compara mensual vs. anual.',
  )

  const [students, setStudents] = useState(500)
  const [cycle, setCycle] = useState<'annual' | 'monthly'>('annual')
  const suggested = useMemo(() => planForStudents(students), [students])

  const step = students < 200 ? 10 : students < 1000 ? 25 : 100

  return (
    <div className="min-h-screen bg-white">
      <PublicNav />

      <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">Un plan para cada tamaño de institución</h1>
        <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10">
          Precio por estudiante al año, en pesos colombianos, sin impuestos aplicables. Ajusta el
          número de estudiantes y elige cómo prefieres pagar.
        </p>

        {/* Stepper de estudiantes */}
        <div className="max-w-md mx-auto mb-8">
          <label className="block text-sm font-semibold text-slate-700 mb-3">
            ¿Cuántos estudiantes tiene tu institución?
          </label>
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setStudents((s) => Math.max(20, s - step))}
              className="w-11 h-11 flex items-center justify-center rounded-full border border-slate-300 text-slate-600 hover:border-blue-600 hover:text-blue-600 transition-all"
              aria-label="Menos estudiantes"
            >
              <Minus className="w-5 h-5" />
            </button>
            <input
              type="number"
              min={0}
              value={students}
              onChange={(e) => setStudents(Math.max(0, Number(e.target.value) || 0))}
              className="w-28 text-center text-2xl font-bold text-slate-900 border border-slate-300 rounded-xl py-2"
            />
            <button
              type="button"
              onClick={() => setStudents((s) => s + step)}
              className="w-11 h-11 flex items-center justify-center rounded-full border border-slate-300 text-slate-600 hover:border-blue-600 hover:text-blue-600 transition-all"
              aria-label="Más estudiantes"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toggle mensual / anual */}
        <div className="inline-flex items-center bg-white border border-slate-200 rounded-full p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setCycle('monthly')}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
              cycle === 'monthly' ? 'bg-blue-600 text-white shadow' : 'text-slate-600'
            }`}
          >
            Mensual
          </button>
          <button
            type="button"
            onClick={() => setCycle('annual')}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
              cycle === 'annual' ? 'bg-blue-600 text-white shadow' : 'text-slate-600'
            }`}
          >
            Anual <span className="opacity-80">(paga 10, usa 12)</span>
          </button>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((p) => {
            const isSuggested = p.name === suggested.name
            const rawAnnual = Math.max(p.perStudentYear * students, p.minAnnual)
            const annualPrepay = rawAnnual * (10 / 12)
            const monthlyEquivalent = rawAnnual / 12
            const savings = rawAnnual - annualPrepay
            const bigPrice = cycle === 'annual' ? annualPrepay : monthlyEquivalent

            return (
              <div
                key={p.name}
                className={`rounded-2xl p-6 border flex flex-col transition-all bg-white ${
                  isSuggested
                    ? 'border-blue-300 shadow-xl ring-2 ring-blue-100'
                    : 'border-slate-200 shadow-sm'
                }`}
              >
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {p.mostChosen && (
                    <span className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full">
                      El más elegido
                    </span>
                  )}
                  {isSuggested && !p.mostChosen && (
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                      Para tu institución
                    </span>
                  )}
                </div>

                <h3 className="text-xl font-bold text-slate-900">{p.name}</h3>
                <p className="text-sm text-slate-500 mb-4">{formatCOP(p.perStudentYear)}/estudiante/año</p>

                <div className="text-3xl font-bold text-slate-900 mb-1">
                  {formatCOP(bigPrice)}
                  <span className="text-base font-normal text-slate-500">{cycle === 'annual' ? '/año' : '/mes'}</span>
                </div>

                {cycle === 'annual' && savings > 0 && (
                  <p className="text-xs font-semibold text-green-700 bg-green-50 border border-green-100 rounded-lg px-2 py-1 inline-block w-fit mb-4">
                    Ahorras {formatCOP(savings)} frente al pago mensual
                  </p>
                )}
                {cycle === 'monthly' && <p className="text-xs text-slate-400 mb-4">Equivalente a {formatCOP(rawAnnual)}/año</p>}

                <ul className="space-y-3 mb-8 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                      <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  to="/contacto"
                  className={`text-center px-4 py-3 rounded-xl font-semibold transition-all ${
                    isSuggested
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700'
                      : 'border border-slate-300 text-slate-700 hover:border-blue-600 hover:text-blue-600'
                  }`}
                >
                  Solicitar demo
                </Link>
              </div>
            )
          })}
        </div>

        <p className="text-center text-sm text-slate-500 mt-10 max-w-2xl mx-auto">
          ¿Tu institución tiene más de 1.500 estudiantes, varias sedes o necesita integraciones
          especiales? <Link to="/contacto" className="text-blue-600 font-semibold hover:underline">Hablemos</Link> — la cotización se hace a la medida.
        </p>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">¿Ya tienes plataforma?</h2>
          <p className="text-slate-600 mb-6">
            Puedes usar Edusyn en paralelo con la tuya, sin apagar lo que hoy te funciona, y decidir
            con evidencia propia. Nosotros cargamos la información — tú no dedicas horas a montar la
            prueba.
          </p>
          <a
            href="https://wa.me/573104019732"
            target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-6 py-3 rounded-xl font-semibold hover:border-blue-600 hover:text-blue-600 transition-all"
          >
            <MessageCircle className="w-5 h-5" /> Pregunta por la Experiencia Paralela
          </a>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-600 to-indigo-600 text-center">
        <h2 className="text-3xl font-bold text-white mb-6">Cotiza tu institución</h2>
        <p className="text-blue-100 mb-8 max-w-xl mx-auto">Cotización con vigencia de 15 días, sin compromiso.</p>
        <Link to="/contacto" className="inline-flex items-center gap-2 bg-white text-blue-600 px-8 py-4 rounded-xl font-semibold hover:bg-blue-50 transition-all shadow-xl">
          Solicitar cotización <ArrowRight className="w-5 h-5" />
        </Link>
      </section>

      <PublicFooter />
    </div>
  )
}
