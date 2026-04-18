import { useEffect, useState, useMemo } from 'react'
import { 
  GraduationCap, 
  LayoutDashboard, 
  BookOpen,
  Users, 
  Bell,
  TrendingUp,
  MousePointer2,
  Save,
  CheckCircle2,
  Trophy,
  Star,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Megaphone,
  Calendar,
  Cake,
  UserCheck,
  Target
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS Y CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════════

type DemoStep = 
  | 'dashboard'
  | 'cursor-to-gestion'
  | 'click-gestion'
  | 'gestion-expanded'
  | 'cursor-to-logros'
  | 'click-logros'
  | 'achievements-view'
  | 'select-student'
  | 'student-selected'
  | 'cursor-to-logro1'
  | 'select-logro1'
  | 'cursor-to-logro2'
  | 'select-logro2'
  | 'cursor-to-observation'
  | 'type-observation'
  | 'cursor-to-save'
  | 'click-save'
  | 'saved-success'

const STEP_DURATION: Record<DemoStep, number> = {
  'dashboard': 2000,
  'cursor-to-gestion': 600,
  'click-gestion': 300,
  'gestion-expanded': 500,
  'cursor-to-logros': 500,
  'click-logros': 300,
  'achievements-view': 1000,
  'select-student': 600,
  'student-selected': 600,
  'cursor-to-logro1': 400,
  'select-logro1': 400,
  'cursor-to-logro2': 400,
  'select-logro2': 400,
  'cursor-to-observation': 400,
  'type-observation': 1000,
  'cursor-to-save': 500,
  'click-save': 300,
  'saved-success': 2500,
}

const CURSOR_POSITIONS: Record<DemoStep, { x: number; y: number; visible: boolean; clicking?: boolean }> = {
  'dashboard': { x: 60, y: 40, visible: true },
  'cursor-to-gestion': { x: 12, y: 38, visible: true },
  'click-gestion': { x: 12, y: 38, visible: true, clicking: true },
  'gestion-expanded': { x: 12, y: 38, visible: true },
  'cursor-to-logros': { x: 14, y: 46, visible: true },
  'click-logros': { x: 14, y: 46, visible: true, clicking: true },
  'achievements-view': { x: 35, y: 22, visible: true },
  'select-student': { x: 35, y: 22, visible: true, clicking: true },
  'student-selected': { x: 50, y: 45, visible: true },
  'cursor-to-logro1': { x: 30, y: 50, visible: true },
  'select-logro1': { x: 30, y: 50, visible: true, clicking: true },
  'cursor-to-logro2': { x: 30, y: 58, visible: true },
  'select-logro2': { x: 30, y: 58, visible: true, clicking: true },
  'cursor-to-observation': { x: 70, y: 65, visible: true },
  'type-observation': { x: 70, y: 65, visible: true, clicking: true },
  'cursor-to-save': { x: 90, y: 18, visible: true },
  'click-save': { x: 90, y: 18, visible: true, clicking: true },
  'saved-success': { x: 50, y: 50, visible: false },
}

const SEQUENCE: DemoStep[] = [
  'dashboard',
  'cursor-to-gestion',
  'click-gestion',
  'gestion-expanded',
  'cursor-to-logros',
  'click-logros',
  'achievements-view',
  'select-student',
  'student-selected',
  'cursor-to-logro1',
  'select-logro1',
  'cursor-to-logro2',
  'select-logro2',
  'cursor-to-observation',
  'type-observation',
  'cursor-to-save',
  'click-save',
  'saved-success',
]

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export default function AchievementsDemo() {
  const [step, setStep] = useState<DemoStep>('dashboard')
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    const timeout = setTimeout(() => {
      const nextIndex = (stepIndex + 1) % SEQUENCE.length
      setStepIndex(nextIndex)
      setStep(SEQUENCE[nextIndex])
    }, STEP_DURATION[step])

    return () => clearTimeout(timeout)
  }, [step, stepIndex])

  const currentView = useMemo(() => {
    if (['dashboard', 'cursor-to-gestion', 'click-gestion', 'gestion-expanded', 'cursor-to-logros', 'click-logros'].includes(step)) return 'dashboard'
    return 'achievements'
  }, [step])

  const gestionExpanded = useMemo(() => {
    return ['gestion-expanded', 'cursor-to-logros', 'click-logros'].includes(step)
  }, [step])

  const studentSelected = useMemo(() => {
    return !['dashboard', 'cursor-to-gestion', 'click-gestion', 'gestion-expanded', 'cursor-to-logros', 'click-logros', 'achievements-view', 'select-student'].includes(step)
  }, [step])

  const selectedLogros = useMemo(() => {
    const logros: number[] = []
    if (['select-logro1', 'cursor-to-logro2', 'select-logro2', 'cursor-to-observation', 'type-observation', 'cursor-to-save', 'click-save', 'saved-success'].includes(step)) {
      logros.push(1)
    }
    if (['select-logro2', 'cursor-to-observation', 'type-observation', 'cursor-to-save', 'click-save', 'saved-success'].includes(step)) {
      logros.push(2)
    }
    return logros
  }, [step])

  const showObservation = useMemo(() => {
    return ['type-observation', 'cursor-to-save', 'click-save', 'saved-success'].includes(step)
  }, [step])

  const cursorPos = CURSOR_POSITIONS[step]
  const browserUrl = currentView === 'dashboard' ? 'edusyn.co/dashboard' : 'edusyn.co/achievements'
  const showSuccess = step === 'saved-success'

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
          <div className="bg-white rounded-md h-5 flex items-center px-3 text-[10px] text-slate-500 font-mono">
            {browserUrl}
          </div>
        </div>
      </div>

      {/* App Container */}
      <div className="flex h-[calc(100%-2rem)]">
        <Sidebar 
          currentView={currentView}
          gestionExpanded={gestionExpanded}
          highlightGestion={step === 'cursor-to-gestion' || step === 'click-gestion'}
          highlightLogros={step === 'cursor-to-logros' || step === 'click-logros'}
        />

        <div className="flex-1 bg-slate-50 overflow-hidden relative">
          {currentView === 'dashboard' && (
            <DashboardView fadeOut={step === 'click-logros'} />
          )}

          {currentView === 'achievements' && (
            <AchievementsView 
              studentSelected={studentSelected}
              highlightStudentSelect={step === 'select-student'}
              selectedLogros={selectedLogros}
              highlightLogro={
                step === 'cursor-to-logro1' || step === 'select-logro1' ? 1 :
                step === 'cursor-to-logro2' || step === 'select-logro2' ? 2 : 0
              }
              showObservation={showObservation}
              highlightObservation={step === 'cursor-to-observation' || step === 'type-observation'}
              highlightSave={step === 'cursor-to-save' || step === 'click-save'}
            />
          )}

          {showSuccess && (
            <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center animate-fadeIn">
              <div className="w-14 h-14 bg-amber-500 rounded-full flex items-center justify-center mb-3 shadow-lg">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <div className="text-lg font-bold text-slate-900">¡Logros asignados!</div>
              <div className="text-sm text-slate-500">Ana García - Matemáticas</div>
            </div>
          )}
        </div>
      </div>

      <AnimatedCursor x={cursorPos.x} y={cursorPos.y} visible={cursorPos.visible} clicking={cursorPos.clicking} />

      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-0.5">
        {SEQUENCE.map((_, i) => (
          <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === stepIndex ? 'w-3 bg-amber-500' : 'w-1 bg-slate-300'}`} />
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTES AUXILIARES
// ═══════════════════════════════════════════════════════════════════════════

function AnimatedCursor({ x, y, visible, clicking }: { x: number; y: number; visible: boolean; clicking?: boolean }) {
  return (
    <div 
      className={`absolute pointer-events-none z-50 transition-all duration-500 ease-out ${visible ? 'opacity-100' : 'opacity-0'}`}
      style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-2px, -2px)' }}
    >
      <div className={`relative transition-transform duration-150 ${clicking ? 'scale-90' : 'scale-100'}`}>
        <MousePointer2 className="w-5 h-5 text-slate-800 drop-shadow-lg" fill="white" strokeWidth={1.5} />
        {clicking && (
          <div className="absolute top-0 left-0 w-6 h-6 -translate-x-1 -translate-y-1">
            <div className="w-full h-full rounded-full bg-amber-400/40 animate-ping" />
          </div>
        )}
      </div>
    </div>
  )
}

function Sidebar({ currentView, gestionExpanded, highlightGestion, highlightLogros }: { 
  currentView: string
  gestionExpanded: boolean
  highlightGestion: boolean
  highlightLogros: boolean
}) {
  return (
    <div className="w-44 bg-white border-r border-slate-200 flex flex-col">
      <div className="px-3 py-2 border-b border-slate-200 flex items-center gap-2">
        <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
          <GraduationCap className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="text-[11px] font-bold text-slate-900">Edusyn</div>
          <div className="text-[7px] text-slate-500">Sistema Académico</div>
        </div>
        <Bell className="w-3.5 h-3.5 text-slate-400 ml-auto" />
      </div>

      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-hidden text-[9px]">
        <SidebarItem icon={LayoutDashboard} label="Dashboard" active={currentView === 'dashboard' && !gestionExpanded} />
        <SidebarGroup icon={Users} label="Gestión de Personas" />
        
        {/* Gestión Académica - expandible */}
        <div className={`flex items-center gap-2 px-2 py-1.5 rounded-md font-medium cursor-pointer transition-all ${
          highlightGestion ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300 ring-offset-1' 
          : gestionExpanded ? 'bg-slate-100 text-slate-700' 
          : 'text-slate-600'
        }`}>
          <BookOpen className="w-3 h-3" />
          <span className="flex-1">Gestión Académica</span>
          {gestionExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </div>
        
        {/* Submenu */}
        {gestionExpanded && (
          <div className="ml-3 pl-2 border-l border-slate-200 space-y-0.5">
            <div className="flex items-center gap-2 px-2 py-1 text-slate-500">
              <BookOpen className="w-3 h-3" />
              Calificaciones
            </div>
            <div className={`flex items-center gap-2 px-2 py-1 rounded-md font-medium transition-all ${
              highlightLogros ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300 ring-offset-1' 
              : currentView === 'achievements' ? 'bg-blue-50 text-blue-700' 
              : 'text-slate-500'
            }`}>
              <Target className="w-3 h-3" />
              Logros y Juicios
            </div>
          </div>
        )}
        
        <SidebarGroup icon={UserCheck} label="Seguimiento" />
        <SidebarGroup icon={TrendingUp} label="Reportes" />
      </nav>

      <div className="px-2 py-2 border-t border-slate-200 flex items-center gap-2">
        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
          <span className="text-[8px] font-bold text-blue-600">MC</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[9px] font-medium text-slate-900 truncate">María Castro</div>
          <div className="text-[7px] text-slate-500">Docente</div>
        </div>
      </div>
    </div>
  )
}

function SidebarItem({ icon: Icon, label, active }: { icon: any; label: string; active?: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 rounded-md font-medium transition-all ${
      active ? 'bg-blue-50 text-blue-700' : 'text-slate-600'
    }`}>
      <Icon className="w-3 h-3" />
      {label}
    </div>
  )
}

function SidebarGroup({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1 font-medium text-slate-500">
      <Icon className="w-3 h-3" />
      <span className="flex-1 truncate">{label}</span>
      <ChevronRight className="w-3 h-3" />
    </div>
  )
}

function DashboardView({ fadeOut }: { fadeOut: boolean }) {
  return (
    <div className={`h-full transition-all duration-300 ${fadeOut ? 'opacity-0 scale-95' : 'opacity-100'}`}>
      <div className="px-4 py-2 bg-white border-b border-slate-200">
        <div className="text-sm font-bold text-slate-900">¡Bienvenido, María!</div>
        <div className="text-[8px] text-slate-500">Aquí tienes las novedades de la institución</div>
      </div>

      <div className="p-3 grid grid-cols-3 gap-2 h-[calc(100%-3rem)]">
        <div className="col-span-2 bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-2 py-1.5 border-b border-slate-100 flex items-center gap-1.5">
            <Megaphone className="w-3 h-3 text-blue-600" />
            <span className="text-[9px] font-semibold text-slate-900">Anuncios</span>
          </div>
          <div className="p-2 space-y-1.5">
            <div className="p-1.5 bg-slate-50 rounded">
              <div className="text-[9px] font-medium text-slate-800">Reunión de padres</div>
              <div className="text-[7px] text-slate-500">Viernes 25 de abril a las 3:00 PM</div>
            </div>
            <div className="p-1.5 bg-slate-50 rounded">
              <div className="text-[9px] font-medium text-slate-800">Entrega de boletines</div>
              <div className="text-[7px] text-slate-500">Disponibles desde el lunes</div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-2 py-1.5 border-b border-slate-100 flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-green-600" />
              <span className="text-[9px] font-semibold text-slate-900">Eventos</span>
            </div>
            <div className="p-2 space-y-1">
              <div className="flex items-center gap-1.5">
                <div className="bg-green-100 text-green-700 rounded px-1 py-0.5 text-[7px] font-medium">18 Abr</div>
                <span className="text-[8px] text-slate-600">Día del Idioma</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-2 py-1.5 border-b border-slate-100 flex items-center gap-1.5">
              <Cake className="w-3 h-3 text-pink-600" />
              <span className="text-[9px] font-semibold text-slate-900">Cumpleaños</span>
            </div>
            <div className="p-2 space-y-1">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 bg-pink-500 text-white rounded-full flex items-center justify-center text-[7px] font-bold">20</div>
                <div>
                  <div className="text-[8px] font-medium text-slate-800">Juan Pérez</div>
                  <div className="text-[7px] text-slate-500">5°A</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AchievementsView({ 
  studentSelected, 
  highlightStudentSelect, 
  selectedLogros,
  highlightLogro,
  showObservation,
  highlightObservation,
  highlightSave
}: { 
  studentSelected: boolean
  highlightStudentSelect: boolean
  selectedLogros: number[]
  highlightLogro: number
  showObservation: boolean
  highlightObservation: boolean
  highlightSave: boolean
}) {
  return (
    <div className="h-full animate-fadeIn">
      {/* Header */}
      <div className="px-4 py-2 border-b border-slate-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-bold text-slate-900">Logros y Juicios</span>
        </div>
        <div className="flex items-center gap-1 text-[9px] text-slate-500">
          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">Período 1</span>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex gap-2">
        <div className={`flex-1 bg-white border rounded-lg px-2 py-1.5 text-[9px] flex items-center justify-between transition-all ${
          highlightStudentSelect ? 'ring-2 ring-amber-300 border-amber-300' : 'border-slate-200'
        }`}>
          <span className={studentSelected ? 'text-slate-900' : 'text-slate-400'}>
            {studentSelected ? 'Ana García - 5°A' : 'Seleccionar estudiante...'}
          </span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </div>
        <div className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[9px] text-slate-600">
          Matemáticas
        </div>
      </div>

      {/* Content */}
      {studentSelected && (
        <div className="p-3 grid grid-cols-2 gap-3">
          {/* Logros disponibles */}
          <div className="space-y-2">
            <div className="text-[10px] font-semibold text-slate-700 flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-500" />
              Logros disponibles
            </div>
            <LogroItem 
              num={1} 
              text="Resuelve operaciones con fracciones" 
              selected={selectedLogros.includes(1)}
              highlight={highlightLogro === 1}
            />
            <LogroItem 
              num={2} 
              text="Identifica fracciones equivalentes" 
              selected={selectedLogros.includes(2)}
              highlight={highlightLogro === 2}
            />
            <LogroItem 
              num={3} 
              text="Aplica fracciones en problemas" 
              selected={false}
              highlight={false}
            />
          </div>

          {/* Observación */}
          <div className="space-y-2">
            <div className="text-[10px] font-semibold text-slate-700 flex items-center gap-1">
              <MessageSquare className="w-3 h-3 text-blue-500" />
              Observación del período
            </div>
            <div className={`bg-white border rounded-lg p-2 transition-all ${
              highlightObservation ? 'ring-2 ring-amber-300 border-amber-300' : 'border-slate-200'
            }`}>
              <textarea 
                className="w-full h-16 text-[9px] text-slate-700 resize-none outline-none"
                placeholder="Escribe una observación..."
                value={showObservation ? "Excelente desempeño en el tema de fracciones. Demuestra comprensión y ayuda a sus compañeros." : ""}
                readOnly
              />
            </div>

            {/* Resumen */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
              <div className="text-[9px] font-semibold text-amber-800 mb-1">Resumen</div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                  <span className="text-[8px] text-slate-600">{selectedLogros.length} logros</span>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-500" />
                  <span className="text-[8px] text-slate-600">Superior</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save button */}
      {studentSelected && (
        <div className="absolute bottom-3 right-3">
          <button className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-semibold transition-all ${
            highlightSave 
              ? 'bg-amber-600 text-white ring-2 ring-amber-300 ring-offset-1 scale-105 shadow-lg' 
              : 'bg-amber-600 text-white'
          }`}>
            <Save className="w-3.5 h-3.5" />
            Guardar
          </button>
        </div>
      )}
    </div>
  )
}

function LogroItem({ num, text, selected, highlight }: { num: number; text: string; selected: boolean; highlight: boolean }) {
  return (
    <div className={`bg-white rounded-lg border p-2 flex items-start gap-2 transition-all cursor-pointer ${
      highlight ? 'ring-2 ring-amber-300 border-amber-300' : 
      selected ? 'border-green-300 bg-green-50' : 'border-slate-200'
    }`}>
      <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all ${
        selected ? 'bg-green-500' : 'bg-slate-100'
      }`}>
        {selected ? (
          <CheckCircle2 className="w-3 h-3 text-white" />
        ) : (
          <span className="text-[8px] text-slate-500">{num}</span>
        )}
      </div>
      <span className={`text-[9px] ${selected ? 'text-green-700 font-medium' : 'text-slate-600'}`}>{text}</span>
    </div>
  )
}
