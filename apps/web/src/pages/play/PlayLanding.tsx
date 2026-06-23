import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Gamepad2,
  Zap,
  BookOpen,
  LayoutGrid,
  MessageSquare,
  BarChart2,
  Users,
  Clock,
  Trophy,
  Smartphone,
  MonitorPlay,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  Star,
  ArrowRight,
  Play,
  QrCode,
} from 'lucide-react'

const availableTools = [
  {
    icon: Zap,
    name: 'Quiz Live',
    color: 'from-violet-500 to-purple-600',
    desc: 'Preguntas en tiempo real tipo Kahoot. Timer servidor, scoring por velocidad, podío animado, reacciones y modo proyector.',
    features: ['Timer server-driven', 'Podío animado', 'Modo proyector', 'QR de acceso'],
  },
  {
    icon: BookOpen,
    name: 'Lecciones Live',
    color: 'from-fuchsia-500 to-pink-600',
    desc: 'Slides interactivos al estilo Nearpod. El docente avanza los slides para todos en tiempo real. Embeds de actividades y checkpoints.',
    features: ['Slides sincronizados', 'Actividades embebidas', 'Reacciones en vivo', 'Auto-ritmo opcional'],
  },
]

const roadmapTools = [
  {
    icon: LayoutGrid,
    name: 'Mural Colaborativo',
    color: 'from-amber-500 to-orange-600',
    desc: 'Tipo Padlet. Los invitados pegan notas de colores que aparecen en la pantalla del docente en tiempo real.',
  },
  {
    icon: MessageSquare,
    name: 'Nube de Palabras',
    color: 'from-cyan-500 to-teal-600',
    desc: 'Tipo Mentimeter. Pregunta abierta, los invitados envían palabras y se forma una word cloud en vivo.',
  },
  {
    icon: BarChart2,
    name: 'Encuesta Relámpago',
    color: 'from-emerald-500 to-green-600',
    desc: 'Multipregunta tipo Likert o emojis. Resultados con barras animadas en tiempo real.',
  },
]

const stats = [
  { icon: Users, value: '50', label: 'Invitados por sesión', sub: 'Sin cuenta requerida' },
  { icon: Clock, value: 'Tiempo real', label: 'Conexión SSE', sub: 'Sin recargar la página' },
  { icon: Smartphone, value: 'Móvil', label: 'Diseñado para celular', sub: 'Tap-targets grandes' },
  { icon: Trophy, value: 'Kahoot-style', label: 'Podio, racha, confeti', sub: 'MC, V/F, orden y abierta' },
]

const steps = [
  { n: '1', title: 'Ingresa como docente', desc: 'Crea tu cuenta Play (independiente de tu cuenta institucional) y accede al panel.' },
  { n: '2', title: 'Crea tu quiz o lección', desc: 'Editor visual con preguntas, imágenes, timers y puntos configurables por cada elemento.' },
  { n: '3', title: 'Lanza en vivo', desc: 'Un clic y obtienes un código de 6 dígitos + QR. Compártelo en pantalla o proyector.' },
  { n: '4', title: 'Los estudiantes se unen', desc: 'Sin cuenta, sin app. Solo van a edusyn.co/join, escriben el código y entran al instante.' },
]

export default function PlayLanding() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-[#0d0d1a] text-white overflow-x-hidden">

      {/* ── NAVBAR ── */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#0d0d1a]/95 backdrop-blur border-b border-white/10 shadow-xl' : ''}`}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-violet-600 p-1.5">
              <Gamepad2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-black tracking-tight">
              edusyn<span className="text-violet-400">play</span>
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-6 text-sm text-white/70">
            <a href="#herramientas" className="hover:text-white transition">Herramientas</a>
            <a href="#como-funciona" className="hover:text-white transition">Cómo funciona</a>
            <a href="#unirse" className="hover:text-white transition">Unirse como invitado</a>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/login-play"
              className="text-sm font-semibold text-violet-300 hover:text-white transition px-3 py-1.5"
            >
              Iniciar sesión
            </Link>
            <Link
              to="/register-play"
              className="text-sm font-black bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-xl transition"
            >
              Registrarse
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative pt-32 pb-24 px-6 text-center overflow-hidden">
        {/* glow bg */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-violet-600/20 rounded-full blur-3xl" />
          <div className="absolute top-20 left-1/4 w-64 h-64 bg-fuchsia-600/10 rounded-full blur-3xl" />
          <div className="absolute top-20 right-1/4 w-64 h-64 bg-cyan-600/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-300 mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            Clases interactivas en tiempo real · Sin instalaciones
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05] mb-6">
            El aula que{' '}
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
              responde
            </span>
            {' '}en tiempo real
          </h1>

          <p className="text-lg sm:text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed">
            Quizzes en vivo tipo Kahoot y lecciones al estilo Nearpod.
            Sin cuentas para los estudiantes — solo un código de 6 dígitos.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/login-play"
              className="group inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-black px-8 py-4 rounded-2xl text-base transition-all shadow-2xl shadow-violet-500/30"
            >
              <MonitorPlay className="w-5 h-5" />
              Ingresar como docente
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              to="/join"
              className="inline-flex items-center gap-2 border border-white/20 hover:border-white/40 text-white/80 hover:text-white font-bold px-8 py-4 rounded-2xl text-base transition-all bg-white/5 hover:bg-white/10"
            >
              <QrCode className="w-5 h-5" />
              Tengo un código de acceso
            </Link>
          </div>

          {/* mini join preview */}
          <div className="mt-14 inline-flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-6 py-3 text-sm text-white/60">
            <span className="font-mono font-bold text-white text-base tracking-widest bg-violet-600/30 px-3 py-1 rounded-lg">AB-3X7K</span>
            <ArrowRight className="w-4 h-4" />
            <span>Estudiante entra en <span className="text-violet-300 font-semibold">edusyn.co/join</span></span>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="py-12 px-6 border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6">
          {stats.map(({ icon: Icon, value, label, sub }) => (
            <div key={label} className="text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-violet-500/20 text-violet-400 mb-3">
                <Icon className="w-5 h-5" />
              </div>
              <div className="text-2xl font-black text-white mb-0.5">{value}</div>
              <div className="text-sm font-semibold text-white/80">{label}</div>
              <div className="text-xs text-white/40 mt-0.5">{sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HERRAMIENTAS ── */}
      <section id="herramientas" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-4 py-1.5 text-sm text-green-300 mb-4">
              <CheckCircle2 className="w-3.5 h-3.5" />Herramientas disponibles hoy
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">
              Lo que puedes lanzar ya mismo
            </h2>
            <p className="text-white/50 max-w-xl mx-auto">
              Estas son las herramientas listas y funcionando en producción.
              Sin asteriscos, sin “beta cerrada”.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {availableTools.map((tool) => {
              const Icon = tool.icon
              return (
                <div
                  key={tool.name}
                  className="group relative bg-white/[0.04] border border-white/10 rounded-2xl p-6 hover:bg-white/[0.07] hover:border-white/20 transition-all duration-300"
                >
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${tool.color} mb-4 shadow-lg`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-lg font-black text-white">{tool.name}</h3>
                    <span className="flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      Disponible
                    </span>
                  </div>
                  <p className="text-sm text-white/50 mb-4 leading-relaxed">{tool.desc}</p>
                  <ul className="space-y-1">
                    {tool.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-xs text-white/50">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}

            {/* CTA card */}
            <div className="group bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20 border border-violet-500/30 rounded-2xl p-6 flex flex-col items-start justify-between hover:from-violet-600/30 hover:to-fuchsia-600/30 transition-all duration-300">
              <div>
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 mb-4 shadow-lg">
                  <Star className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-black text-white mb-2">¿Listo para empezar?</h3>
                <p className="text-sm text-white/60 mb-6 leading-relaxed">
                  Regístrate gratis y lanza tu primera sesión en menos de 3 minutos. Sin tarjeta de crédito.
                </p>
              </div>
              <Link
                to="/register-play"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-black px-5 py-2.5 rounded-xl text-sm transition-all shadow-lg"
              >
                Crear cuenta gratis <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Roadmap section — honestly labeled */}
          <div className="mt-20">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs uppercase tracking-wide font-bold text-amber-300 mb-3">
                Roadmap · En diseño
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white mb-2">Lo que viene</h3>
              <p className="text-white/40 text-sm max-w-lg mx-auto">
                Estas herramientas todavía no están liberadas. Las publicamos aquí para que sepas qué esperar, no para venderlas como si existieran.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {roadmapTools.map(tool => {
                const Icon = tool.icon
                return (
                  <div key={tool.name} className="flex items-start gap-3 bg-white/[0.02] border border-white/5 rounded-xl p-4">
                    <div className={`flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br ${tool.color} opacity-60`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white/80">{tool.name}</p>
                      <p className="text-xs text-white/40 leading-relaxed mt-0.5">{tool.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ── */}
      <section id="como-funciona" className="py-24 px-6 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">
              Del cero a la sesión en vivo
            </h2>
            <p className="text-white/50 max-w-lg mx-auto">4 pasos. Sin configuraciones complicadas.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {/* connector line desktop */}
            <div className="hidden lg:block absolute top-9 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />

            {steps.map((step, i) => (
              <div key={i} className="relative text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white font-black text-xl mb-4 shadow-lg shadow-violet-500/30 relative z-10">
                  {step.n}
                </div>
                <h3 className="text-base font-black text-white mb-2">{step.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── UNIRSE COMO INVITADO ── */}
      <section id="unirse" className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-3xl bg-gradient-to-br from-violet-600/20 via-fuchsia-600/10 to-transparent border border-violet-500/20 p-8 sm:p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl" />
              <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-fuchsia-500/10 rounded-full blur-3xl" />
            </div>
            <div className="relative">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 mb-6 shadow-2xl shadow-violet-500/40">
                <QrCode className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">
                ¿Eres estudiante?
              </h2>
              <p className="text-white/60 max-w-lg mx-auto mb-8 leading-relaxed">
                No necesitas cuenta ni instalar nada. Tu docente te dará un código de 6 dígitos.
                Solo entra aquí y escríbelo.
              </p>
              <Link
                to="/join"
                className="group inline-flex items-center gap-2 bg-white text-violet-700 font-black px-8 py-4 rounded-2xl text-base transition-all hover:bg-violet-50 shadow-2xl"
              >
                <Play className="w-5 h-5" />
                Ingresar con código
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-8 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/30">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-violet-600/40 p-1">
              <Gamepad2 className="w-4 h-4 text-violet-300" />
            </div>
            <span className="font-black text-white/60">edusyn<span className="text-violet-400">play</span></span>
            <span className="ml-2">· Un producto de Edusyn</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login-play" className="hover:text-white transition">Ingresar (docente)</Link>
            <Link to="/register-play" className="hover:text-white transition">Registrarse</Link>
            <Link to="/join" className="hover:text-white transition">Unirse con código</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
