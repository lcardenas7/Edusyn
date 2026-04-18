import { Link } from 'react-router-dom'
import { useEffect, useState, lazy, Suspense } from 'react'

const AnimatedDemo = lazy(() => import('../components/landing/AnimatedDemo'))
const AttendanceDemo = lazy(() => import('../components/landing/AttendanceDemo'))
const GradesDemo = lazy(() => import('../components/landing/GradesDemo'))
const AchievementsDemo = lazy(() => import('../components/landing/AchievementsDemo'))
const RecoveryDemo = lazy(() => import('../components/landing/RecoveryDemo'))
import { 
  GraduationCap, 
  Users, 
  BookOpen, 
  BarChart3, 
  Shield, 
  Clock, 
  CheckCircle, 
  ArrowRight,
  School,
  Calendar,
  FileText,
  Bell,
  Globe,
  Award,
  TrendingUp,
  UserCheck,
  ClipboardList,
  Mail,
  Phone,
  MapPin,
  Sparkles,
  MessageCircle,
  Zap,
  Target,
  Layers,
  Send,
  Monitor,
  Bot,
  Wand2,
  Video,
  MonitorPlay,
  Trophy,
  RefreshCw
} from 'lucide-react'

export default function LandingPage() {
  // Smooth scroll para enlaces internos
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const anchor = target.closest('a[href^="#"]')
      if (anchor) {
        e.preventDefault()
        const id = anchor.getAttribute('href')?.slice(1)
        if (id) {
          document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  return (
    <div className="min-h-screen bg-white scroll-smooth">
      {/* Header/Navbar */}
      <header className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-b border-slate-100 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                EduSyn
              </span>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-slate-600 hover:text-blue-600 transition-colors font-medium">
                Características
              </a>
              <a href="#about" className="text-slate-600 hover:text-blue-600 transition-colors font-medium">
                Conócenos
              </a>
              <a href="#modules" className="text-slate-600 hover:text-blue-600 transition-colors font-medium">
                Módulos
              </a>
              <a href="#benefits" className="text-slate-600 hover:text-blue-600 transition-colors font-medium">
                Beneficios
              </a>
              <a href="#contact" className="text-slate-600 hover:text-blue-600 transition-colors font-medium">
                Contacto
              </a>
            </nav>

            {/* CTA Button */}
            <Link 
              to="/login" 
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2"
            >
              Iniciar Sesión
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Award className="w-4 h-4" />
                Sistema de Gestión Educativa Integral
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight mb-6">
                Transforma tu institución con{' '}
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  EduSyn
                </span>
              </h1>
              <p className="text-xl text-slate-600 mb-8 leading-relaxed">
                La plataforma integral que simplifica la gestión académica, administrativa y de comunicación 
                de tu institución educativa. Todo en un solo lugar.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link 
                  to="/login" 
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-xl shadow-blue-500/30 flex items-center justify-center gap-2 text-lg"
                >
                  Comenzar Ahora
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <a 
                  href="#about" 
                  className="border-2 border-slate-300 text-slate-700 px-8 py-4 rounded-xl font-semibold hover:border-blue-600 hover:text-blue-600 transition-all flex items-center justify-center gap-2 text-lg"
                >
                  Solicitar Demo
                </a>
              </div>
              
              {/* Product highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12 pt-8 border-t border-slate-200">
                <div className="bg-white/80 backdrop-blur rounded-2xl border border-slate-200 p-4 shadow-sm">
                  <div className="text-sm font-semibold text-slate-900 mb-1">Gestión integral</div>
                  <div className="text-slate-600 text-sm">Académico, asistencia, evaluación y reportes en un solo sistema.</div>
                </div>
                <div className="bg-white/80 backdrop-blur rounded-2xl border border-slate-200 p-4 shadow-sm">
                  <div className="text-sm font-semibold text-slate-900 mb-1">Multirol</div>
                  <div className="text-slate-600 text-sm">Docentes, directivos, estudiantes y acudientes con acceso por permisos.</div>
                </div>
                <div className="bg-white/80 backdrop-blur rounded-2xl border border-slate-200 p-4 shadow-sm">
                  <div className="text-sm font-semibold text-slate-900 mb-1">Implementación rápida</div>
                  <div className="text-slate-600 text-sm">Pensado para adaptarse a la operación real de tu institución.</div>
                </div>
              </div>
            </div>

            {/* Hero Image/Illustration */}
            <div className="relative">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl p-8 shadow-2xl">
                <div className="bg-white rounded-2xl p-6 shadow-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <School className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">Dashboard Institucional</div>
                      <div className="text-sm text-slate-500">Vista en tiempo real</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-green-50 p-3 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">1,234</div>
                      <div className="text-xs text-green-700">Estudiantes Activos</div>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">98%</div>
                      <div className="text-xs text-blue-700">Asistencia Hoy</div>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">45</div>
                      <div className="text-xs text-purple-700">Docentes</div>
                    </div>
                    <div className="bg-amber-50 p-3 rounded-lg">
                      <div className="text-2xl font-bold text-amber-600">12</div>
                      <div className="text-xs text-amber-700">Eventos Hoy</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Floating Cards */}
              <div className="absolute -left-4 top-1/4 bg-white p-4 rounded-xl shadow-lg border border-slate-100 hidden lg:block">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="text-sm font-medium text-slate-700">Notas actualizadas</div>
                </div>
              </div>
              
              <div className="absolute -right-4 bottom-1/4 bg-white p-4 rounded-xl shadow-lg border border-slate-100 hidden lg:block">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Bell className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-sm font-medium text-slate-700">Nueva notificación</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Promo / Demo Section */}
      <section id="about" className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white via-blue-50/30 to-white overflow-hidden">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 px-5 py-2.5 rounded-full text-sm font-semibold mb-6 shadow-sm">
              <Sparkles className="w-4 h-4 animate-pulse" />
              Descubre EduSyn
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-6 leading-tight">
              La plataforma que tu institución<br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">necesita para crecer</span>
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Centraliza la gestión académica y administrativa. Más control, menos reprocesos, mejor comunicación.
            </p>
          </div>

          {/* Animated Feature Showcase */}
          <div className="grid lg:grid-cols-3 gap-6 mb-16">
            {/* Card 1 - Qué es */}
            <div className="group relative bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-500 border border-slate-100 hover:border-blue-200 hover:-translate-y-2">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-6 shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform duration-300">
                  <Target className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">¿Qué es EduSyn?</h3>
                <p className="text-slate-600 leading-relaxed mb-4">
                  Un sistema integral de gestión educativa que conecta académica, evaluación, asistencia, comunicaciones y reportes en una sola plataforma.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">Todo en uno</span>
                  <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">En la nube</span>
                </div>
              </div>
            </div>

            {/* Card 2 - Cómo funciona */}
            <div className="group relative bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-500 border border-slate-100 hover:border-indigo-200 hover:-translate-y-2">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/30 group-hover:scale-110 transition-transform duration-300">
                  <Layers className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">¿Cómo funciona?</h3>
                <p className="text-slate-600 leading-relaxed mb-4">
                  Cada rol ve lo que necesita: docentes registran notas y asistencia, directivos analizan datos, y familias consultan información clave.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full">Multi-rol</span>
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full">Permisos</span>
                </div>
              </div>
            </div>

            {/* Card 3 - Puntos fuertes */}
            <div className="group relative bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-500 border border-slate-100 hover:border-emerald-200 hover:-translate-y-2">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-green-500/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform duration-300">
                  <Zap className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Puntos fuertes</h3>
                <p className="text-slate-600 leading-relaxed mb-4">
                  Orden, trazabilidad, reportes al instante, boletines automáticos y una experiencia clara para docentes y administrativos.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full">Reportes</span>
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full">Automático</span>
                </div>
              </div>
            </div>
          </div>

          {/* Aula Virtual & Valeria IA - Featured Section */}
          <div className="grid lg:grid-cols-2 gap-6 mb-16">
            {/* Aula Virtual */}
            <div className="group relative bg-gradient-to-br from-violet-50 to-purple-50 rounded-3xl p-8 border border-violet-100 hover:border-violet-300 transition-all duration-500 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-400/20 to-purple-400/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
              <div className="relative flex flex-col sm:flex-row gap-6 items-start">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 flex-shrink-0">
                  <Monitor className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xl font-bold text-slate-900">Aula Virtual</h3>
                    <span className="px-2 py-0.5 bg-violet-100 text-violet-700 text-xs font-semibold rounded-full">Nuevo</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed mb-4">
                    Crea clases interactivas con contenido multimedia, quizzes en tiempo real, y seguimiento del progreso de cada estudiante. Todo integrado con tu gestión académica.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-violet-700 text-xs font-medium rounded-full shadow-sm">
                      <Video className="w-3.5 h-3.5" />
                      Clases en vivo
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-violet-700 text-xs font-medium rounded-full shadow-sm">
                      <ClipboardList className="w-3.5 h-3.5" />
                      Quizzes interactivos
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-violet-700 text-xs font-medium rounded-full shadow-sm">
                      <BarChart3 className="w-3.5 h-3.5" />
                      Progreso en tiempo real
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Valeria IA */}
            <div className="group relative bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-8 border border-amber-100 hover:border-amber-300 transition-all duration-500 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-400/20 to-orange-400/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
              <div className="relative flex flex-col sm:flex-row gap-6 items-start">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 flex-shrink-0">
                  <Bot className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xl font-bold text-slate-900">Valeria IA</h3>
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full animate-pulse">IA</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed mb-4">
                    Tu asistente inteligente que te ayuda en todo: genera contenido para el aula, crea evaluaciones, analiza el desempeño de estudiantes y te guía en cada paso del flujo académico.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-amber-700 text-xs font-medium rounded-full shadow-sm">
                      <Wand2 className="w-3.5 h-3.5" />
                      Genera contenido
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-amber-700 text-xs font-medium rounded-full shadow-sm">
                      <FileText className="w-3.5 h-3.5" />
                      Crea evaluaciones
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-amber-700 text-xs font-medium rounded-full shadow-sm">
                      <Sparkles className="w-3.5 h-3.5" />
                      Asistencia 24/7
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Animated Demo Section with Tabs */}
          <DemoSection />

          {/* Process Steps - Animated Timeline */}
          <div className="relative mb-16">
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-blue-200 via-indigo-200 to-emerald-200 rounded-full hidden lg:block" style={{ transform: 'translateY(-50%)' }} />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { step: '01', title: 'Organiza', desc: 'Años, períodos, cursos y docentes', color: 'blue', icon: BookOpen },
                { step: '02', title: 'Registra', desc: 'Notas y asistencia diaria', color: 'indigo', icon: ClipboardList },
                { step: '03', title: 'Analiza', desc: 'Reportes e indicadores', color: 'purple', icon: BarChart3 },
                { step: '04', title: 'Comunica', desc: 'Toda la comunidad conectada', color: 'emerald', icon: Users },
              ].map((item, i) => (
                <div key={i} className="relative group">
                  <div className={`bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-all duration-300 border border-slate-100 hover:border-${item.color}-200 text-center hover:-translate-y-1`}>
                    <div className={`w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-${item.color}-500 to-${item.color}-600 flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      <item.icon className="w-6 h-6 text-white" />
                    </div>
                    <div className={`text-xs font-bold text-${item.color}-600 mb-1`}>PASO {item.step}</div>
                    <h4 className="font-bold text-slate-900 mb-1">{item.title}</h4>
                    <p className="text-sm text-slate-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Section */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl blur-xl opacity-20" />
            <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-8 sm:p-12 text-center overflow-hidden">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
              <div className="relative">
                <h3 className="text-2xl sm:text-3xl font-bold text-white mb-4">
                  ¿Listo para transformar tu institución?
                </h3>
                <p className="text-blue-100 mb-8 max-w-xl mx-auto">
                  Agenda una demostración personalizada y descubre cómo EduSyn puede ayudarte.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <a
                    href="https://wa.me/573104019732"
                    target="_blank"
                    rel="noreferrer"
                    className="group bg-white text-blue-600 px-8 py-4 rounded-xl font-semibold hover:bg-blue-50 transition-all shadow-xl flex items-center justify-center gap-3 hover:scale-105 active:scale-95"
                  >
                    <MessageCircle className="w-5 h-5 group-hover:animate-bounce" />
                    Escríbenos por WhatsApp
                  </a>
                  <a
                    href="mailto:info@edusyn.co"
                    className="group border-2 border-white/30 text-white px-8 py-4 rounded-xl font-semibold hover:bg-white/10 transition-all flex items-center justify-center gap-3 hover:border-white/60"
                  >
                    <Send className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    info@edusyn.co
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Todo lo que necesitas para gestionar tu institución
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              EduSyn integra todas las herramientas necesarias para la gestión educativa moderna
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all group">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Gestión de Estudiantes</h3>
              <p className="text-slate-600">Administra matrículas, historial académico, observador y documentos de todos tus estudiantes.</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-lg transition-all group">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <BookOpen className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Control Académico</h3>
              <p className="text-slate-600">Gestiona notas, actividades evaluativas, períodos académicos y planes de estudio.</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-green-300 hover:shadow-lg transition-all group">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Calendar className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Asistencia Inteligente</h3>
              <p className="text-slate-600">Registro de asistencia en tiempo real con reportes automáticos para padres.</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-purple-300 hover:shadow-lg transition-all group">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Reportes y Estadísticas</h3>
              <p className="text-slate-600">Genera boletines, informes de desempeño y análisis estadísticos al instante.</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-amber-300 hover:shadow-lg transition-all group">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Seguridad y Roles</h3>
              <p className="text-slate-600">Control de acceso por roles: directivos, docentes, estudiantes y padres.</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-rose-300 hover:shadow-lg transition-all group">
              <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Bell className="w-6 h-6 text-rose-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Comunicación</h3>
              <p className="text-slate-600">Notificaciones, circulares y comunicados directos a toda la comunidad educativa.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Modules Section */}
      <section id="modules" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Módulos Especializados
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Cada módulo diseñado para resolver necesidades específicas de tu institución
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                    <GraduationCap className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">Gestión Académica</h3>
                </div>
              </div>
              <div className="p-6">
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-slate-700">Años lectivos y períodos</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-slate-700">Áreas y asignaturas</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-slate-700">Planes de estudio</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-slate-700">Escala de valoración</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
              <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 p-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                    <Users className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">Gestión de Personas</h3>
                </div>
              </div>
              <div className="p-6">
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-slate-700">Estudiantes y matrículas</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-slate-700">Docentes y carga académica</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-slate-700">Acudientes y contactos</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-slate-700">Personal administrativo</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                    <ClipboardList className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">Evaluación</h3>
                </div>
              </div>
              <div className="p-6">
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-slate-700">Actividades evaluativas</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-slate-700">Registro de notas</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-slate-700">Recuperaciones</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-slate-700">Boletines automáticos</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
              <div className="bg-gradient-to-r from-green-500 to-green-600 p-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">Reportes</h3>
                </div>
              </div>
              <div className="p-6">
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-slate-700">Estadísticas en tiempo real</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-slate-700">Informes de desempeño</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-slate-700">Exportación Excel/PDF</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-slate-700">Dashboards interactivos</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6">
                ¿Por qué elegir EduSyn?
              </h2>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Clock className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">Ahorra tiempo</h3>
                    <p className="text-slate-600">Automatiza procesos que antes tomaban horas. Genera boletines en segundos.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Globe className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">Acceso desde cualquier lugar</h3>
                    <p className="text-slate-600">Plataforma 100% en la nube. Accede desde computador, tablet o celular.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Shield className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">Seguridad garantizada</h3>
                    <p className="text-slate-600">Datos encriptados y respaldos automáticos. Tu información siempre protegida.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <UserCheck className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">Soporte dedicado</h3>
                    <p className="text-slate-600">Equipo de soporte disponible para ayudarte en cada paso del camino.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl p-8 text-white">
              <h3 className="text-2xl font-bold mb-6">Cumplimiento Normativo</h3>
              <p className="text-blue-100 mb-8">
                EduSyn está diseñado siguiendo los lineamientos del Ministerio de Educación Nacional de Colombia.
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="text-blue-50">Decreto 1290 de 2009 - Evaluación</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="text-blue-50">Ley 115 de 1994 - Ley General de Educación</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="text-blue-50">Decreto 1075 de 2015 - Sector Educativo</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="text-blue-50">Resolución 2680 de 2014 - Matrículas</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            ¿Listo para transformar tu institución?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Únete a las instituciones que ya confían en EduSyn para su gestión educativa.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              to="/login" 
              className="bg-white text-blue-600 px-8 py-4 rounded-xl font-semibold hover:bg-blue-50 transition-all shadow-xl flex items-center justify-center gap-2 text-lg"
            >
              Iniciar Sesión
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a 
              href="mailto:info@edusyn.co" 
              className="border-2 border-white text-white px-8 py-4 rounded-xl font-semibold hover:bg-white/10 transition-all flex items-center justify-center gap-2 text-lg"
            >
              Solicitar Demo
            </a>
          </div>
        </div>
      </section>

      {/* Contact/Footer Section */}
      <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
            {/* Logo and Description */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                  <GraduationCap className="w-7 h-7 text-white" />
                </div>
                <span className="text-3xl font-bold text-white">EduSyn</span>
              </div>
              <p className="text-slate-400 mb-6 max-w-md">
                Plataforma integral de gestión educativa diseñada para instituciones que buscan 
                excelencia en la administración académica y administrativa.
              </p>
              <div className="flex gap-4">
                <a href="#" className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center hover:bg-blue-600 transition-colors">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
                <a href="#" className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center hover:bg-blue-600 transition-colors">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
                </a>
                <a href="#" className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center hover:bg-blue-600 transition-colors">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/></svg>
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-white font-semibold mb-4">Enlaces Rápidos</h4>
              <ul className="space-y-3">
                <li><a href="#features" className="text-slate-400 hover:text-white transition-colors">Características</a></li>
                <li><a href="#modules" className="text-slate-400 hover:text-white transition-colors">Módulos</a></li>
                <li><a href="#benefits" className="text-slate-400 hover:text-white transition-colors">Beneficios</a></li>
                <li><Link to="/login" className="text-slate-400 hover:text-white transition-colors">Iniciar Sesión</Link></li>
              </ul>
            </div>

            {/* Contact Info */}
            <div>
              <h4 className="text-white font-semibold mb-4">Contacto</h4>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-slate-400">
                  <Mail className="w-5 h-5" />
                  <span>info@edusyn.co</span>
                </li>
                <li className="flex items-center gap-3 text-slate-400">
                  <Phone className="w-5 h-5" />
                  <span>3104019732</span>
                </li>
                <li className="flex items-center gap-3 text-slate-400">
                  <MapPin className="w-5 h-5" />
                  <span>Colombia</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Copyright */}
          <div className="border-t border-slate-800 mt-12 pt-8 text-center">
            <p className="text-slate-500">
              © {new Date().getFullYear()} EduSyn. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// DEMO SECTION CON TABS
// ═══════════════════════════════════════════════════════════════════════════

type DemoType = 'aula-virtual' | 'asistencia' | 'calificaciones' | 'logros' | 'recuperaciones'

const DEMO_TABS: Array<{ id: DemoType; label: string; icon: any; color: string; description: string }> = [
  { id: 'aula-virtual', label: 'Aula Virtual', icon: MonitorPlay, color: 'violet', description: 'Crea quizzes con Valeria IA y lanza Live Quiz' },
  { id: 'asistencia', label: 'Asistencia', icon: Calendar, color: 'green', description: 'Registra asistencia en segundos' },
  { id: 'calificaciones', label: 'Calificaciones', icon: BookOpen, color: 'indigo', description: 'Ingresa notas por actividad' },
  { id: 'logros', label: 'Logros', icon: Trophy, color: 'amber', description: 'Asigna logros y observaciones' },
  { id: 'recuperaciones', label: 'Recuperaciones', icon: RefreshCw, color: 'emerald', description: 'Gestiona nivelaciones fácilmente' },
]

function DemoSection() {
  const [activeDemo, setActiveDemo] = useState<DemoType>('aula-virtual')
  const currentTab = DEMO_TABS.find(t => t.id === activeDemo)!

  return (
    <div className="mb-16">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-slate-900 mb-2">Mira cómo funciona</h3>
        <p className="text-slate-600">Explora los flujos principales de EduSyn</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        {DEMO_TABS.map((tab) => {
          const isActive = activeDemo === tab.id
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveDemo(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                isActive 
                  ? `bg-${tab.color}-100 text-${tab.color}-700 ring-2 ring-${tab.color}-300 shadow-sm` 
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
              style={isActive ? {
                backgroundColor: tab.color === 'violet' ? '#ede9fe' : 
                                 tab.color === 'green' ? '#dcfce7' :
                                 tab.color === 'indigo' ? '#e0e7ff' :
                                 tab.color === 'amber' ? '#fef3c7' :
                                 tab.color === 'emerald' ? '#d1fae5' : '#f1f5f9',
                color: tab.color === 'violet' ? '#6d28d9' : 
                       tab.color === 'green' ? '#15803d' :
                       tab.color === 'indigo' ? '#4338ca' :
                       tab.color === 'amber' ? '#b45309' :
                       tab.color === 'emerald' ? '#047857' : '#475569',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              } : {}}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Description */}
      <div className="text-center mb-4">
        <p className="text-sm text-slate-500">{currentTab.description}</p>
      </div>

      {/* Demo container */}
      <div className="max-w-4xl mx-auto">
        <Suspense fallback={
          <div className="w-full aspect-[16/10] bg-slate-100 rounded-2xl animate-pulse flex items-center justify-center">
            <div className="text-slate-400 text-sm">Cargando demo...</div>
          </div>
        }>
          {activeDemo === 'aula-virtual' && <AnimatedDemo />}
          {activeDemo === 'asistencia' && <AttendanceDemo />}
          {activeDemo === 'calificaciones' && <GradesDemo />}
          {activeDemo === 'logros' && <AchievementsDemo />}
          {activeDemo === 'recuperaciones' && <RecoveryDemo />}
        </Suspense>
      </div>
    </div>
  )
}
