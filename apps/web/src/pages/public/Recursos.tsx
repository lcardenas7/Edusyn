import PublicNav from '../../components/public/PublicNav'
import PublicFooter from '../../components/public/PublicFooter'
import { useSeo } from '../../hooks/useSeo'
import { BookOpen, Scale, ClipboardCheck } from 'lucide-react'

const GUIDES = [
  {
    icon: Scale,
    title: 'Decreto 1290: cómo lo modela Edusyn',
    body: 'El Sistema Institucional de Evaluación de Estudiantes (Decreto 1290 de 2009) define escalas propias por institución, recuperaciones y criterios de promoción. Edusyn permite configurar la escala de valoración, los períodos y las reglas de recuperación de tu institución, en vez de forzarte a una escala genérica.',
  },
  {
    icon: ClipboardCheck,
    title: 'Evaluación cualitativa en preescolar (Decreto 1411)',
    body: 'Preescolar no se califica igual que el resto de la básica: se trabaja por dimensiones de desarrollo y descriptores cualitativos, no por notas numéricas. Edusyn tiene un módulo de evaluación configurable pensado específicamente para este nivel.',
  },
  {
    icon: BookOpen,
    title: 'Cómo migrar sin perder el año lectivo',
    body: 'El cambio de plataforma a mitad de año es el mayor temor de cualquier coordinador académico. Por eso ofrecemos usar Edusyn en paralelo con la plataforma actual: se carga la información real, se compara un período completo, y solo se decide con evidencia propia — sin apagar lo que hoy funciona.',
  },
]

export default function Recursos() {
  useSeo(
    'Recursos — Edusyn',
    'Guías prácticas sobre normativa educativa colombiana y cómo Edusyn la modela: Decreto 1290, evaluación cualitativa de preescolar y migración sin riesgo.',
  )

  return (
    <div className="min-h-screen bg-white">
      <PublicNav />

      <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">Recursos</h1>
        <p className="text-xl text-slate-600 max-w-2xl mx-auto">
          Guías cortas sobre la normativa educativa colombiana y cómo la resolvemos en la
          plataforma. Esta sección crece con el tiempo.
        </p>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {GUIDES.map((g) => (
            <div key={g.title} className="flex gap-6 p-6 rounded-2xl border border-slate-200 hover:border-blue-200 hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <g.icon className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{g.title}</h3>
                <p className="text-slate-600 leading-relaxed">{g.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
