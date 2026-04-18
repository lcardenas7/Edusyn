import { useEffect, useState } from 'react'
import { 
  GraduationCap, 
  LayoutDashboard, 
  Monitor, 
  Plus, 
  CheckCircle2, 
  Users, 
  BookOpen,
  BarChart3,
  Settings,
  Bell,
  Search,
  ChevronRight,
  Sparkles
} from 'lucide-react'

type DemoStep = 'dashboard' | 'click-aula' | 'aula-module' | 'click-create' | 'form-filling' | 'success'

const STEP_DURATION = {
  dashboard: 2500,
  'click-aula': 800,
  'aula-module': 2000,
  'click-create': 800,
  'form-filling': 4500,
  success: 3000,
}

export default function AnimatedDemo() {
  const [step, setStep] = useState<DemoStep>('dashboard')
  const [formProgress, setFormProgress] = useState(0)

  useEffect(() => {
    const sequence: DemoStep[] = ['dashboard', 'click-aula', 'aula-module', 'click-create', 'form-filling', 'success']
    let currentIndex = 0
    let timeout: NodeJS.Timeout

    const nextStep = () => {
      currentIndex = (currentIndex + 1) % sequence.length
      const nextStepName = sequence[currentIndex]
      setStep(nextStepName)
      if (nextStepName === 'form-filling') {
        setFormProgress(0)
      }
      timeout = setTimeout(nextStep, STEP_DURATION[nextStepName])
    }

    timeout = setTimeout(nextStep, STEP_DURATION[step])
    return () => clearTimeout(timeout)
  }, [])

  // Form filling animation
  useEffect(() => {
    if (step === 'form-filling') {
      const interval = setInterval(() => {
        setFormProgress(p => Math.min(p + 1, 100))
      }, 40)
      return () => clearInterval(interval)
    }
  }, [step])

  return (
    <div className="relative w-full aspect-[16/10] bg-slate-100 rounded-2xl overflow-hidden shadow-2xl border border-slate-200">
      {/* Browser Chrome */}
      <div className="h-8 bg-slate-200 flex items-center px-3 gap-2 border-b border-slate-300">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 mx-4">
          <div className="bg-white rounded-md h-5 flex items-center px-3 text-[10px] text-slate-500">
            app.edusyn.co/dashboard
          </div>
        </div>
      </div>

      {/* App Container */}
      <div className="flex h-[calc(100%-2rem)]">
        {/* Sidebar */}
        <div className="w-14 bg-slate-900 flex flex-col items-center py-3 gap-1">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center mb-3">
            <GraduationCap className="w-4 h-4 text-white" />
          </div>
          
          <SidebarItem icon={LayoutDashboard} active={step === 'dashboard'} />
          <SidebarItem 
            icon={Monitor} 
            active={step !== 'dashboard'} 
            highlight={step === 'click-aula'}
            pulse={step === 'dashboard'}
          />
          <SidebarItem icon={BookOpen} />
          <SidebarItem icon={Users} />
          <SidebarItem icon={BarChart3} />
          <div className="flex-1" />
          <SidebarItem icon={Settings} />
        </div>

        {/* Main Content */}
        <div className="flex-1 bg-slate-50 overflow-hidden">
          {/* Top Bar */}
          <div className="h-10 bg-white border-b border-slate-200 flex items-center px-4 justify-between">
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <div className="w-32 h-5 bg-slate-100 rounded text-[9px] text-slate-400 flex items-center px-2">
                Buscar...
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Bell className="w-4 h-4 text-slate-400" />
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500" />
            </div>
          </div>

          {/* Content Area */}
          <div className="p-4 h-[calc(100%-2.5rem)] overflow-hidden">
            {/* Dashboard View */}
            {(step === 'dashboard' || step === 'click-aula') && (
              <div className={`transition-all duration-500 ${step === 'click-aula' ? 'opacity-0 scale-95' : 'opacity-100'}`}>
                <div className="text-sm font-semibold text-slate-800 mb-3">Dashboard</div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <StatCard label="Estudiantes" value="156" color="blue" />
                  <StatCard label="Cursos" value="8" color="indigo" />
                  <StatCard label="Docentes" value="12" color="emerald" />
                </div>
                <div className="bg-white rounded-lg p-2 border border-slate-200">
                  <div className="text-[10px] font-medium text-slate-700 mb-2">Accesos rápidos</div>
                  <div className="grid grid-cols-2 gap-2">
                    <QuickAction icon={Monitor} label="Aula Virtual" highlight={step === 'dashboard'} />
                    <QuickAction icon={BookOpen} label="Calificaciones" />
                  </div>
                </div>
              </div>
            )}

            {/* Aula Virtual Module */}
            {(step === 'aula-module' || step === 'click-create') && (
              <div className={`transition-all duration-500 ${step === 'click-create' ? 'opacity-50' : 'opacity-100'}`}>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-3">
                  <Monitor className="w-4 h-4 text-violet-600" />
                  Aula Virtual
                </div>
                <div className="flex gap-2 mb-3">
                  <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                    step === 'click-create' 
                      ? 'bg-violet-600 text-white scale-105 shadow-lg' 
                      : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                  }`}>
                    <Plus className="w-3 h-3" />
                    Crear Quiz
                    {step === 'aula-module' && (
                      <span className="ml-1 w-1.5 h-1.5 bg-violet-500 rounded-full animate-ping" />
                    )}
                  </button>
                  <button className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-medium">
                    Mis Clases
                  </button>
                </div>
                <div className="bg-white rounded-lg p-2 border border-slate-200">
                  <div className="text-[10px] font-medium text-slate-700 mb-2">Quizzes recientes</div>
                  <div className="space-y-1.5">
                    <QuizItem title="Matemáticas - Fracciones" students={24} />
                    <QuizItem title="Ciencias - El Sistema Solar" students={28} />
                  </div>
                </div>
              </div>
            )}

            {/* Form Filling */}
            {step === 'form-filling' && (
              <div className="animate-fadeIn">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-3">
                  <Plus className="w-4 h-4 text-violet-600" />
                  Crear nuevo Quiz
                </div>
                <div className="bg-white rounded-lg p-3 border border-slate-200 space-y-2.5">
                  <FormField 
                    label="Título del Quiz" 
                    value="Evaluación de Comprensión Lectora" 
                    progress={formProgress} 
                    threshold={20}
                  />
                  <FormField 
                    label="Asignatura" 
                    value="Lengua Castellana - 5° Grado" 
                    progress={formProgress} 
                    threshold={40}
                  />
                  <FormField 
                    label="Número de preguntas" 
                    value="10 preguntas" 
                    progress={formProgress} 
                    threshold={60}
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <Sparkles className={`w-3.5 h-3.5 transition-all duration-300 ${formProgress > 70 ? 'text-amber-500 animate-pulse' : 'text-slate-300'}`} />
                    <span className={`text-[9px] transition-all duration-300 ${formProgress > 70 ? 'text-amber-600 font-medium' : 'text-slate-400'}`}>
                      Valeria IA generará las preguntas automáticamente
                    </span>
                  </div>
                  <button className={`w-full py-2 rounded-lg text-[10px] font-semibold transition-all duration-500 flex items-center justify-center gap-2 ${
                    formProgress > 85 
                      ? 'bg-violet-600 text-white shadow-lg scale-[1.02]' 
                      : 'bg-slate-100 text-slate-400'
                  }`}>
                    {formProgress > 85 && <Sparkles className="w-3 h-3" />}
                    Crear Quiz con IA
                  </button>
                </div>
              </div>
            )}

            {/* Success */}
            {step === 'success' && (
              <div className="h-full flex flex-col items-center justify-center animate-fadeIn">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center mb-3 animate-bounce shadow-lg shadow-emerald-500/30">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <div className="text-sm font-bold text-slate-800 mb-1">¡Quiz creado!</div>
                <div className="text-[10px] text-slate-500 mb-3">10 preguntas generadas por Valeria IA</div>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 bg-violet-100 text-violet-700 rounded-lg text-[9px] font-medium">
                    Ver Quiz
                  </button>
                  <button className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-[9px] font-medium">
                    Compartir
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
        {['dashboard', 'click-aula', 'aula-module', 'click-create', 'form-filling', 'success'].map((s, i) => (
          <div 
            key={s} 
            className={`h-1 rounded-full transition-all duration-300 ${
              s === step ? 'w-4 bg-violet-500' : 'w-1 bg-slate-300'
            }`} 
          />
        ))}
      </div>
    </div>
  )
}

function SidebarItem({ icon: Icon, active, highlight, pulse }: { 
  icon: typeof LayoutDashboard
  active?: boolean
  highlight?: boolean
  pulse?: boolean
}) {
  return (
    <div className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300 ${
      highlight ? 'bg-violet-500 scale-110 shadow-lg shadow-violet-500/50' :
      active ? 'bg-slate-700' : 'hover:bg-slate-800'
    }`}>
      <Icon className={`w-4 h-4 ${highlight || active ? 'text-white' : 'text-slate-400'}`} />
      {pulse && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-violet-500 rounded-full animate-ping" />
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'from-blue-500 to-blue-600',
    indigo: 'from-indigo-500 to-indigo-600',
    emerald: 'from-emerald-500 to-emerald-600',
  }
  return (
    <div className="bg-white rounded-lg p-2 border border-slate-200">
      <div className={`text-lg font-bold bg-gradient-to-r ${colors[color]} bg-clip-text text-transparent`}>
        {value}
      </div>
      <div className="text-[9px] text-slate-500">{label}</div>
    </div>
  )
}

function QuickAction({ icon: Icon, label, highlight }: { 
  icon: typeof Monitor
  label: string
  highlight?: boolean 
}) {
  return (
    <div className={`flex items-center gap-2 p-2 rounded-lg transition-all duration-300 cursor-pointer ${
      highlight ? 'bg-violet-100 border-2 border-violet-300' : 'bg-slate-50 border border-slate-200'
    }`}>
      <Icon className={`w-4 h-4 ${highlight ? 'text-violet-600' : 'text-slate-500'}`} />
      <span className={`text-[10px] font-medium ${highlight ? 'text-violet-700' : 'text-slate-600'}`}>{label}</span>
      {highlight && <ChevronRight className="w-3 h-3 text-violet-500 ml-auto animate-pulse" />}
    </div>
  )
}

function QuizItem({ title, students }: { title: string; students: number }) {
  return (
    <div className="flex items-center justify-between p-1.5 bg-slate-50 rounded">
      <span className="text-[9px] text-slate-700">{title}</span>
      <span className="text-[8px] text-slate-400">{students} respuestas</span>
    </div>
  )
}

function FormField({ label, value, progress, threshold }: { 
  label: string
  value: string
  progress: number
  threshold: number 
}) {
  const isActive = progress >= threshold
  const isTyping = progress >= threshold && progress < threshold + 15
  
  return (
    <div>
      <div className="text-[9px] text-slate-500 mb-1">{label}</div>
      <div className={`h-7 rounded border px-2 flex items-center text-[10px] transition-all duration-300 ${
        isActive ? 'border-violet-300 bg-violet-50' : 'border-slate-200 bg-slate-50'
      }`}>
        {isActive ? (
          <span className="text-slate-700">
            {value}
            {isTyping && <span className="animate-pulse">|</span>}
          </span>
        ) : (
          <span className="text-slate-300">...</span>
        )}
      </div>
    </div>
  )
}
