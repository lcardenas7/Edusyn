import { useEffect, useState, useMemo } from 'react'
import { 
  GraduationCap, 
  LayoutDashboard, 
  MonitorPlay,
  Users, 
  BookOpen,
  Bell,
  Megaphone,
  Calendar,
  Cake,
  ChevronRight,
  ChevronDown,
  Home,
  FolderOpen,
  ClipboardList,
  MessageSquare,
  FileText,
  Video,
  Plus,
  Play,
  Clock,
  Building2,
  TrendingUp,
  MousePointer2,
  Sparkles,
  Send,
  Bot,
  CheckCircle2,
  Zap,
  Trophy,
  Timer,
  Circle,
  X
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS Y CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════════

type DemoStep = 
  | 'dashboard' 
  | 'cursor-to-aula' 
  | 'click-aula' 
  | 'classrooms-list' 
  | 'cursor-to-classroom'
  | 'click-classroom'
  | 'classroom-view'
  | 'cursor-to-activity'
  | 'classroom-activities'
  | 'cursor-to-valeria'
  | 'click-valeria'
  | 'valeria-open'
  | 'valeria-typing'
  | 'valeria-response'
  | 'cursor-to-create'
  | 'click-create'
  | 'quiz-preview'
  | 'cursor-to-start'
  | 'click-start'
  | 'live-quiz-lobby'
  | 'live-quiz-question'
  | 'live-quiz-results'
  | 'live-quiz-podium'

const STEP_DURATION: Record<DemoStep, number> = {
  'dashboard': 2000,
  'cursor-to-aula': 700,
  'click-aula': 350,
  'classrooms-list': 1500,
  'cursor-to-classroom': 700,
  'click-classroom': 350,
  'classroom-view': 1500,
  'cursor-to-activity': 500,
  'classroom-activities': 1500,
  'cursor-to-valeria': 700,
  'click-valeria': 350,
  'valeria-open': 1000,
  'valeria-typing': 2500,
  'valeria-response': 2500,
  'cursor-to-create': 600,
  'click-create': 350,
  'quiz-preview': 2500,
  'cursor-to-start': 600,
  'click-start': 350,
  'live-quiz-lobby': 2000,
  'live-quiz-question': 3000,
  'live-quiz-results': 2000,
  'live-quiz-podium': 3500,
}

// Posiciones del cursor para cada paso (relativas al contenedor)
const CURSOR_POSITIONS: Record<DemoStep, { x: number; y: number; visible: boolean; clicking?: boolean }> = {
  'dashboard': { x: 75, y: 50, visible: true, clicking: false },
  'cursor-to-aula': { x: 7, y: 38, visible: true, clicking: false },
  'click-aula': { x: 7, y: 38, visible: true, clicking: true },
  'classrooms-list': { x: 50, y: 50, visible: true, clicking: false },
  'cursor-to-classroom': { x: 35, y: 55, visible: true, clicking: false },
  'click-classroom': { x: 35, y: 55, visible: true, clicking: true },
  'classroom-view': { x: 60, y: 40, visible: true, clicking: false },
  'cursor-to-activity': { x: 42, y: 22, visible: true, clicking: false },
  'classroom-activities': { x: 55, y: 45, visible: true, clicking: false },
  'cursor-to-valeria': { x: 92, y: 92, visible: true, clicking: false },
  'click-valeria': { x: 92, y: 92, visible: true, clicking: true },
  'valeria-open': { x: 75, y: 60, visible: true, clicking: false },
  'valeria-typing': { x: 75, y: 75, visible: true, clicking: false },
  'valeria-response': { x: 75, y: 55, visible: true, clicking: false },
  'cursor-to-create': { x: 80, y: 72, visible: true, clicking: false },
  'click-create': { x: 80, y: 72, visible: true, clicking: true },
  'quiz-preview': { x: 55, y: 50, visible: true, clicking: false },
  'cursor-to-start': { x: 70, y: 85, visible: true, clicking: false },
  'click-start': { x: 70, y: 85, visible: true, clicking: true },
  'live-quiz-lobby': { x: 50, y: 50, visible: false, clicking: false },
  'live-quiz-question': { x: 50, y: 60, visible: false, clicking: false },
  'live-quiz-results': { x: 50, y: 50, visible: false, clicking: false },
  'live-quiz-podium': { x: 50, y: 50, visible: false, clicking: false },
}

const SEQUENCE: DemoStep[] = [
  'dashboard',
  'cursor-to-aula',
  'click-aula',
  'classrooms-list',
  'cursor-to-classroom',
  'click-classroom',
  'classroom-view',
  'cursor-to-activity',
  'classroom-activities',
  'cursor-to-valeria',
  'click-valeria',
  'valeria-open',
  'valeria-typing',
  'valeria-response',
  'cursor-to-create',
  'click-create',
  'quiz-preview',
  'cursor-to-start',
  'click-start',
  'live-quiz-lobby',
  'live-quiz-question',
  'live-quiz-results',
  'live-quiz-podium',
]

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export default function AnimatedDemo() {
  const [step, setStep] = useState<DemoStep>('dashboard')
  const [stepIndex, setStepIndex] = useState(0)

  // Ciclo de animación
  useEffect(() => {
    const timeout = setTimeout(() => {
      const nextIndex = (stepIndex + 1) % SEQUENCE.length
      setStepIndex(nextIndex)
      setStep(SEQUENCE[nextIndex])
    }, STEP_DURATION[step])

    return () => clearTimeout(timeout)
  }, [step, stepIndex])

  // Determinar qué vista mostrar
  const currentView = useMemo(() => {
    if (['dashboard', 'cursor-to-aula', 'click-aula'].includes(step)) return 'dashboard'
    if (['classrooms-list', 'cursor-to-classroom', 'click-classroom'].includes(step)) return 'classrooms'
    if (['live-quiz-lobby', 'live-quiz-question', 'live-quiz-results', 'live-quiz-podium'].includes(step)) return 'live-quiz'
    if (['quiz-preview', 'cursor-to-start', 'click-start'].includes(step)) return 'quiz-preview'
    return 'classroom-detail'
  }, [step])

  // Determinar tab activo en classroom
  const classroomTab = useMemo(() => {
    if (step === 'classroom-view') return 'home'
    return 'activities'
  }, [step])

  // Mostrar Valeria
  const showValeria = useMemo(() => {
    return ['valeria-open', 'valeria-typing', 'valeria-response', 'cursor-to-create', 'click-create'].includes(step)
  }, [step])

  // Estado de Valeria
  const valeriaState = useMemo(() => {
    if (step === 'valeria-open') return 'empty'
    if (step === 'valeria-typing') return 'typing'
    return 'response'
  }, [step])

  // Posición del cursor
  const cursorPos = CURSOR_POSITIONS[step]

  // URL de la barra de direcciones
  const browserUrl = useMemo(() => {
    if (currentView === 'dashboard') return 'edusyn.co/dashboard'
    if (currentView === 'classrooms') return 'edusyn.co/classroom'
    if (currentView === 'live-quiz') return 'edusyn.co/live-quiz/abc123'
    if (currentView === 'quiz-preview') return 'edusyn.co/classroom/matematicas-5a/quiz/nuevo'
    return 'edusyn.co/classroom/matematicas-5a'
  }, [currentView])

  // Menú activo en sidebar
  const activeMenu = useMemo(() => {
    if (currentView === 'dashboard') return 'dashboard'
    return 'aula-virtual'
  }, [currentView])

  // Mostrar botón de Valeria flotante
  const showValeriaButton = useMemo(() => {
    return currentView === 'classroom-detail' && ['classroom-activities', 'cursor-to-valeria', 'click-valeria'].includes(step)
  }, [currentView, step])

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
        {/* Sidebar - Réplica real de Edusyn (oculto en Live Quiz) */}
        {currentView !== 'live-quiz' && (
          <Sidebar activeMenu={activeMenu} highlightAula={step === 'cursor-to-aula' || step === 'click-aula'} />
        )}

        {/* Main Content */}
        <div className="flex-1 bg-slate-50 overflow-hidden relative">
          {/* Vista Dashboard */}
          {currentView === 'dashboard' && (
            <DashboardView fadeOut={step === 'click-aula'} />
          )}

          {/* Vista Lista de Aulas */}
          {currentView === 'classrooms' && (
            <ClassroomsListView 
              fadeIn={step === 'classrooms-list'} 
              highlightFirst={step === 'cursor-to-classroom' || step === 'click-classroom'}
              fadeOut={step === 'click-classroom'}
            />
          )}

          {/* Vista Detalle de Aula */}
          {currentView === 'classroom-detail' && (
            <ClassroomDetailView 
              activeTab={classroomTab}
              highlightActivityTab={step === 'cursor-to-activity'}
            />
          )}

          {/* Vista Quiz Preview */}
          {currentView === 'quiz-preview' && (
            <QuizPreviewView 
              highlightStart={step === 'cursor-to-start' || step === 'click-start'}
            />
          )}

          {/* Vista Live Quiz */}
          {currentView === 'live-quiz' && (
            <LiveQuizView step={step} />
          )}

          {/* Botón flotante de Valeria */}
          {showValeriaButton && (
            <div className={`absolute bottom-3 right-3 transition-all duration-300 ${
              step === 'cursor-to-valeria' || step === 'click-valeria' 
                ? 'scale-110 ring-2 ring-amber-300 ring-offset-2' 
                : ''
            }`}>
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg cursor-pointer">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
            </div>
          )}

          {/* Panel de Valeria */}
          {showValeria && (
            <ValeriaPanel 
              state={valeriaState} 
              highlightCreate={step === 'cursor-to-create' || step === 'click-create'}
            />
          )}
        </div>
      </div>

      {/* Cursor Animado */}
      <AnimatedCursor 
        x={cursorPos.x} 
        y={cursorPos.y} 
        visible={cursorPos.visible}
        clicking={cursorPos.clicking}
      />

      {/* Step Indicator - más compacto */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-0.5">
        {SEQUENCE.map((s, i) => (
          <div 
            key={s} 
            className={`h-1 rounded-full transition-all duration-300 ${
              i === stepIndex ? 'w-3 bg-blue-500' : 'w-1 bg-slate-300'
            }`} 
          />
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// CURSOR ANIMADO
// ═══════════════════════════════════════════════════════════════════════════

function AnimatedCursor({ x, y, visible, clicking }: { x: number; y: number; visible: boolean; clicking?: boolean }) {
  return (
    <div 
      className={`absolute pointer-events-none z-50 transition-all duration-500 ease-out ${visible ? 'opacity-100' : 'opacity-0'}`}
      style={{ 
        left: `${x}%`, 
        top: `${y}%`,
        transform: 'translate(-2px, -2px)'
      }}
    >
      {/* Cursor icon */}
      <div className={`relative transition-transform duration-150 ${clicking ? 'scale-90' : 'scale-100'}`}>
        <MousePointer2 
          className="w-5 h-5 text-slate-800 drop-shadow-lg" 
          fill="white"
          strokeWidth={1.5}
        />
        {/* Click ripple effect */}
        {clicking && (
          <div className="absolute top-0 left-0 w-6 h-6 -translate-x-1 -translate-y-1">
            <div className="w-full h-full rounded-full bg-blue-400/40 animate-ping" />
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SIDEBAR - Réplica real de Edusyn
// ═══════════════════════════════════════════════════════════════════════════

function Sidebar({ activeMenu, highlightAula }: { activeMenu: string; highlightAula: boolean }) {
  return (
    <div className="w-48 bg-white border-r border-slate-200 flex flex-col">
      {/* Logo */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <GraduationCap className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="text-sm font-bold text-slate-900">Edusyn</div>
          <div className="text-[8px] text-slate-500">Sistema Académico</div>
        </div>
        <Bell className="w-4 h-4 text-slate-400 ml-auto" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-hidden">
        <SidebarItem 
          icon={LayoutDashboard} 
          label="Dashboard" 
          active={activeMenu === 'dashboard'} 
        />
        
        <SidebarGroup icon={Building2} label="Gestión Institucional" />
        <SidebarGroup icon={Users} label="Gestión de Personas" />
        <SidebarGroup icon={BookOpen} label="Gestión Académica" />
        <SidebarGroup icon={TrendingUp} label="Reportes" />
        
        <SidebarItem 
          icon={MonitorPlay} 
          label="Aula Virtual" 
          active={activeMenu === 'aula-virtual'}
          highlight={highlightAula}
        />
      </nav>

      {/* User */}
      <div className="px-3 py-2 border-t border-slate-200 flex items-center gap-2">
        <div className="w-7 h-7 bg-slate-200 rounded-full flex items-center justify-center">
          <span className="text-[9px] font-medium text-slate-600">MC</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-medium text-slate-900 truncate">María Castro</div>
          <div className="text-[8px] text-slate-500 truncate">Docente</div>
        </div>
      </div>
    </div>
  )
}

function SidebarItem({ icon: Icon, label, active, highlight }: { 
  icon: any; 
  label: string; 
  active?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[10px] font-medium transition-all ${
      highlight 
        ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-300 ring-offset-1' 
        : active 
          ? 'bg-blue-50 text-blue-700' 
          : 'text-slate-600 hover:bg-slate-100'
    }`}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </div>
  )
}

function SidebarGroup({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] font-medium text-slate-500">
      <Icon className="w-3.5 h-3.5" />
      <span className="flex-1">{label}</span>
      <ChevronRight className="w-3 h-3" />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// VISTA DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

function DashboardView({ fadeOut }: { fadeOut: boolean }) {
  return (
    <div className={`h-full transition-all duration-300 ${fadeOut ? 'opacity-0 scale-95' : 'opacity-100'}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-white">
        <div className="text-sm font-bold text-slate-900">¡Bienvenido, María!</div>
        <div className="text-[9px] text-slate-500">Aquí tienes las novedades de la institución</div>
      </div>

      {/* Content */}
      <div className="p-3 grid grid-cols-3 gap-3 h-[calc(100%-3.5rem)]">
        {/* Anuncios */}
        <div className="col-span-2 bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2">
            <Megaphone className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-[10px] font-semibold text-slate-900">Anuncios</span>
          </div>
          <div className="p-2 space-y-2">
            <AnnouncementItem 
              title="Reunión de padres" 
              content="Se convoca a reunión general el próximo viernes..."
              date="15 Abr"
            />
            <AnnouncementItem 
              title="Entrega de boletines" 
              content="Los boletines del primer período estarán disponibles..."
              date="12 Abr"
            />
          </div>
        </div>

        {/* Columna lateral */}
        <div className="space-y-3">
          {/* Eventos */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-green-600" />
              <span className="text-[10px] font-semibold text-slate-900">Próximos Eventos</span>
            </div>
            <div className="p-2 space-y-1.5">
              <EventItem date="18 Abr" title="Día del Idioma" />
              <EventItem date="22 Abr" title="Día de la Tierra" />
            </div>
          </div>

          {/* Cumpleaños */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2">
              <Cake className="w-3.5 h-3.5 text-pink-600" />
              <span className="text-[10px] font-semibold text-slate-900">Cumpleaños</span>
            </div>
            <div className="p-2">
              <div className="flex items-center gap-2 p-1.5 bg-pink-50 rounded">
                <div className="w-5 h-5 bg-pink-500 text-white rounded-full flex items-center justify-center text-[8px] font-bold">18</div>
                <span className="text-[9px] text-slate-700">Juan Pérez - 5°A</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AnnouncementItem({ title, content, date }: { title: string; content: string; date: string }) {
  return (
    <div className="p-2 bg-slate-50 rounded hover:bg-slate-100 transition-colors">
      <div className="text-[10px] font-semibold text-slate-900">{title}</div>
      <div className="text-[8px] text-slate-600 line-clamp-1">{content}</div>
      <div className="text-[7px] text-slate-400 mt-1 flex items-center gap-1">
        <Clock className="w-2.5 h-2.5" />
        {date}
      </div>
    </div>
  )
}

function EventItem({ date, title }: { date: string; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="bg-green-100 text-green-700 rounded px-1.5 py-0.5 text-[8px] font-medium">{date}</div>
      <span className="text-[9px] text-slate-700">{title}</span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// VISTA LISTA DE AULAS
// ═══════════════════════════════════════════════════════════════════════════

function ClassroomsListView({ fadeIn, highlightFirst, fadeOut }: { fadeIn: boolean; highlightFirst: boolean; fadeOut: boolean }) {
  return (
    <div className={`h-full transition-all duration-300 ${fadeOut ? 'opacity-0 scale-95' : fadeIn ? 'animate-fadeIn' : 'opacity-100'}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MonitorPlay className="w-4 h-4 text-violet-600" />
          <span className="text-sm font-bold text-slate-900">Aula Virtual</span>
        </div>
        <button className="flex items-center gap-1 px-2 py-1 bg-violet-600 text-white rounded text-[9px] font-medium">
          <Plus className="w-3 h-3" />
          Nueva Aula
        </button>
      </div>

      {/* Grid de aulas */}
      <div className="p-3 grid grid-cols-2 gap-3">
        <ClassroomCard 
          color="#3B82F6"
          subject="Matemáticas"
          group="5° A"
          students={28}
          highlight={highlightFirst}
        />
        <ClassroomCard 
          color="#10B981"
          subject="Ciencias Naturales"
          group="5° A"
          students={28}
        />
        <ClassroomCard 
          color="#F59E0B"
          subject="Lengua Castellana"
          group="5° B"
          students={26}
        />
        <ClassroomCard 
          color="#8B5CF6"
          subject="Inglés"
          group="5° A"
          students={28}
        />
      </div>
    </div>
  )
}

function ClassroomCard({ color, subject, group, students, highlight }: { 
  color: string; 
  subject: string; 
  group: string; 
  students: number;
  highlight?: boolean;
}) {
  return (
    <div className={`bg-white rounded-lg border overflow-hidden transition-all ${
      highlight ? 'ring-2 ring-blue-400 ring-offset-1 scale-[1.02] shadow-lg' : 'border-slate-200 hover:shadow-md'
    }`}>
      <div className="h-12 relative" style={{ backgroundColor: color }}>
        <div className="absolute bottom-2 left-3 text-white">
          <div className="text-[11px] font-bold">{subject}</div>
          <div className="text-[8px] opacity-80">{group}</div>
        </div>
      </div>
      <div className="p-2 flex items-center justify-between">
        <div className="flex items-center gap-1 text-[8px] text-slate-500">
          <Users className="w-3 h-3" />
          {students} estudiantes
        </div>
        <ChevronRight className="w-3 h-3 text-slate-400" />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// VISTA DETALLE DE AULA
// ═══════════════════════════════════════════════════════════════════════════

function ClassroomDetailView({ activeTab, highlightContentTab, highlightActivityTab }: { 
  activeTab: string;
  highlightContentTab?: boolean;
  highlightActivityTab?: boolean;
}) {
  return (
    <div className="h-full animate-fadeIn">
      {/* Header del aula */}
      <div className="h-16 bg-gradient-to-r from-blue-500 to-blue-600 relative">
        <div className="absolute bottom-3 left-4 text-white">
          <div className="text-sm font-bold">Matemáticas</div>
          <div className="text-[9px] opacity-80">5° A • 28 estudiantes</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-4 flex gap-1">
        <TabButton icon={Home} label="Inicio" active={activeTab === 'home'} />
        <TabButton icon={Megaphone} label="Anuncios" />
        <TabButton 
          icon={FolderOpen} 
          label="Contenidos" 
          active={activeTab === 'content'}
          highlight={highlightContentTab}
        />
        <TabButton 
          icon={ClipboardList} 
          label="Actividades" 
          active={activeTab === 'activities'}
          highlight={highlightActivityTab}
        />
        <TabButton icon={MessageSquare} label="Foro" />
        <TabButton icon={Users} label="Estudiantes" />
      </div>

      {/* Contenido del tab */}
      <div className="p-3 h-[calc(100%-6.5rem)] overflow-hidden">
        {activeTab === 'home' && <ClassroomHomeTab />}
        {activeTab === 'content' && <ClassroomContentTab />}
        {activeTab === 'activities' && <ClassroomActivitiesTab />}
      </div>
    </div>
  )
}

function TabButton({ icon: Icon, label, active, highlight }: { 
  icon: any; 
  label: string; 
  active?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={`flex items-center gap-1 px-2 py-2 text-[9px] font-medium border-b-2 transition-all ${
      highlight 
        ? 'border-blue-500 text-blue-600 bg-blue-50' 
        : active 
          ? 'border-blue-500 text-blue-600' 
          : 'border-transparent text-slate-500'
    }`}>
      <Icon className="w-3 h-3" />
      {label}
    </div>
  )
}

function ClassroomHomeTab() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Anuncio reciente */}
      <div className="bg-white rounded-lg border border-slate-200 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Megaphone className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-[10px] font-semibold text-slate-900">Último anuncio</span>
        </div>
        <div className="text-[9px] text-slate-700">Recuerden traer los materiales para la clase práctica del viernes.</div>
        <div className="text-[7px] text-slate-400 mt-2">Hace 2 horas</div>
      </div>

      {/* Próxima actividad */}
      <div className="bg-white rounded-lg border border-slate-200 p-3">
        <div className="flex items-center gap-2 mb-2">
          <ClipboardList className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-[10px] font-semibold text-slate-900">Próxima entrega</span>
        </div>
        <div className="text-[9px] text-slate-700 font-medium">Taller de fracciones</div>
        <div className="text-[8px] text-amber-600 mt-1 flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          Vence en 3 días
        </div>
      </div>
    </div>
  )
}

function ClassroomContentTab() {
  return (
    <div className="space-y-2">
      {/* Sección */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChevronDown className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] font-semibold text-slate-900">Unidad 1: Números y operaciones</span>
          </div>
          <span className="text-[8px] text-slate-400">4 materiales</span>
        </div>
        <div className="p-2 space-y-1.5">
          <MaterialItem icon={FileText} title="Guía de fracciones" type="PDF" />
          <MaterialItem icon={Video} title="Video explicativo: Suma de fracciones" type="YouTube" />
          <MaterialItem icon={FileText} title="Ejercicios prácticos" type="Documento" />
        </div>
      </div>

      {/* Otra sección */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span className="text-[10px] font-semibold text-slate-900">Unidad 2: Geometría básica</span>
        </div>
      </div>
    </div>
  )
}

function MaterialItem({ icon: Icon, title, type }: { icon: any; title: string; type: string }) {
  return (
    <div className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-50 transition-colors">
      <Icon className="w-3.5 h-3.5 text-blue-500" />
      <span className="text-[9px] text-slate-700 flex-1">{title}</span>
      <span className="text-[7px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{type}</span>
    </div>
  )
}

function ClassroomActivitiesTab() {
  return (
    <div className="space-y-2">
      <ActivityItem 
        title="Taller de fracciones"
        type="TASK"
        dueDate="20 Abr"
        submissions={18}
        total={28}
        status="active"
      />
      <ActivityItem 
        title="Quiz: Operaciones básicas"
        type="QUIZ"
        dueDate="15 Abr"
        submissions={28}
        total={28}
        status="completed"
      />
      <ActivityItem 
        title="Ejercicio de geometría"
        type="TASK"
        dueDate="25 Abr"
        submissions={0}
        total={28}
        status="pending"
      />
    </div>
  )
}

function ActivityItem({ title, type, dueDate, submissions, total, status }: {
  title: string;
  type: string;
  dueDate: string;
  submissions: number;
  total: number;
  status: 'active' | 'completed' | 'pending';
}) {
  const typeColors = {
    TASK: 'bg-blue-100 text-blue-700',
    QUIZ: 'bg-violet-100 text-violet-700',
  }
  const statusColors = {
    active: 'text-amber-600',
    completed: 'text-green-600',
    pending: 'text-slate-400',
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3 flex items-center gap-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${type === 'QUIZ' ? 'bg-violet-100' : 'bg-blue-100'}`}>
        {type === 'QUIZ' ? <Play className="w-4 h-4 text-violet-600" /> : <ClipboardList className="w-4 h-4 text-blue-600" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-semibold text-slate-900">{title}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[7px] font-medium px-1.5 py-0.5 rounded ${typeColors[type as keyof typeof typeColors]}`}>
            {type === 'QUIZ' ? 'Quiz' : 'Tarea'}
          </span>
          <span className={`text-[8px] ${statusColors[status]}`}>
            {status === 'completed' ? '✓ Completado' : `Vence: ${dueDate}`}
          </span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-[10px] font-bold text-slate-900">{submissions}/{total}</div>
        <div className="text-[7px] text-slate-400">entregas</div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PANEL DE VALERIA IA
// ═══════════════════════════════════════════════════════════════════════════

function ValeriaPanel({ state, highlightCreate }: { state: string; highlightCreate: boolean }) {
  return (
    <div className="absolute right-3 top-3 bottom-12 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col animate-slideIn overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 bg-gradient-to-r from-amber-400 to-orange-500 flex items-center gap-2">
        <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-[11px] font-bold text-white">Valeria IA</div>
          <div className="text-[8px] text-white/80">Tu asistente inteligente</div>
        </div>
        <X className="w-4 h-4 text-white/70" />
      </div>

      {/* Chat area */}
      <div className="flex-1 p-2 overflow-hidden bg-slate-50">
        {state === 'empty' && (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <Sparkles className="w-8 h-8 text-amber-400 mb-2" />
            <div className="text-[10px] font-medium text-slate-700">¿En qué puedo ayudarte?</div>
            <div className="text-[8px] text-slate-500 mt-1">Puedo crear quizzes, generar contenido y más</div>
          </div>
        )}

        {(state === 'typing' || state === 'response') && (
          <div className="space-y-2">
            {/* User message */}
            <div className="flex justify-end">
              <div className="bg-blue-500 text-white px-2 py-1.5 rounded-lg rounded-br-sm max-w-[85%]">
                <div className="text-[9px]">Crea un quiz de 5 preguntas sobre fracciones para 5° grado</div>
              </div>
            </div>

            {/* Valeria response */}
            {state === 'typing' && (
              <div className="flex gap-2">
                <div className="w-6 h-6 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3 h-3 text-white" />
                </div>
                <div className="bg-white border border-slate-200 px-2 py-1.5 rounded-lg rounded-bl-sm">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            {state === 'response' && (
              <div className="flex gap-2">
                <div className="w-6 h-6 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3 h-3 text-white" />
                </div>
                <div className="bg-white border border-slate-200 px-2 py-1.5 rounded-lg rounded-bl-sm flex-1">
                  <div className="text-[9px] text-slate-700 mb-2">
                    ¡Perfecto! He creado un quiz con 5 preguntas sobre fracciones:
                  </div>
                  <div className="bg-violet-50 border border-violet-200 rounded p-1.5 mb-2">
                    <div className="text-[8px] font-semibold text-violet-700 mb-1">📝 Quiz: Fracciones</div>
                    <div className="text-[7px] text-slate-600 space-y-0.5">
                      <div>1. ¿Cuánto es 1/2 + 1/4?</div>
                      <div>2. Simplifica 4/8</div>
                      <div>3. ¿Qué fracción es mayor: 2/3 o 3/4?</div>
                      <div className="text-slate-400">... 2 preguntas más</div>
                    </div>
                  </div>
                  <button className={`w-full py-1.5 rounded text-[9px] font-semibold flex items-center justify-center gap-1 transition-all ${
                    highlightCreate 
                      ? 'bg-violet-600 text-white ring-2 ring-violet-300 ring-offset-1 scale-[1.02]' 
                      : 'bg-violet-100 text-violet-700'
                  }`}>
                    <Zap className="w-3 h-3" />
                    Crear Quiz
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-2 border-t border-slate-200 bg-white">
        <div className="flex gap-2">
          <div className="flex-1 bg-slate-100 rounded-lg px-2 py-1.5 text-[9px] text-slate-400">
            Escribe tu mensaje...
          </div>
          <button className="w-7 h-7 bg-amber-500 rounded-lg flex items-center justify-center">
            <Send className="w-3 h-3 text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// VISTA PREVIEW DEL QUIZ
// ═══════════════════════════════════════════════════════════════════════════

function QuizPreviewView({ highlightStart }: { highlightStart: boolean }) {
  return (
    <div className="h-full animate-fadeIn">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
            <Play className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">Quiz: Fracciones</div>
            <div className="text-[9px] text-slate-500">5 preguntas • Matemáticas 5°A</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-green-100 text-green-700 text-[8px] font-medium rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Listo
          </span>
        </div>
      </div>

      {/* Preview de preguntas */}
      <div className="p-3 space-y-2 h-[calc(100%-7rem)] overflow-hidden">
        <QuestionPreviewItem 
          number={1}
          question="¿Cuánto es 1/2 + 1/4?"
          options={['1/2', '3/4', '2/6', '1/4']}
          correct={1}
        />
        <QuestionPreviewItem 
          number={2}
          question="Simplifica la fracción 4/8"
          options={['2/4', '1/2', '4/4', '2/8']}
          correct={1}
        />
        <div className="text-center text-[9px] text-slate-400 py-2">
          ... 3 preguntas más
        </div>
      </div>

      {/* Footer con botón de iniciar */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-white border-t border-slate-200">
        <div className="flex gap-2">
          <button className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-medium">
            Editar
          </button>
          <button className={`flex-1 py-2 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 transition-all ${
            highlightStart 
              ? 'bg-violet-600 text-white ring-2 ring-violet-300 ring-offset-1 scale-[1.02] shadow-lg' 
              : 'bg-violet-600 text-white'
          }`}>
            <Zap className="w-3 h-3" />
            Iniciar Live Quiz
          </button>
        </div>
      </div>
    </div>
  )
}

function QuestionPreviewItem({ number, question, options, correct }: {
  number: number;
  question: string;
  options: string[];
  correct: number;
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-2">
      <div className="flex items-start gap-2 mb-2">
        <div className="w-5 h-5 bg-violet-100 rounded flex items-center justify-center text-[9px] font-bold text-violet-600">
          {number}
        </div>
        <div className="text-[10px] text-slate-800 font-medium flex-1">{question}</div>
      </div>
      <div className="grid grid-cols-2 gap-1 pl-7">
        {options.map((opt, i) => (
          <div 
            key={i}
            className={`px-2 py-1 rounded text-[8px] ${
              i === correct 
                ? 'bg-green-100 text-green-700 border border-green-200' 
                : 'bg-slate-50 text-slate-600 border border-slate-100'
            }`}
          >
            {String.fromCharCode(65 + i)}. {opt}
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// VISTA LIVE QUIZ
// ═══════════════════════════════════════════════════════════════════════════

function LiveQuizView({ step }: { step: DemoStep }) {
  return (
    <div className="h-full bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-40 h-40 bg-white rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col items-center justify-center p-4">
        {step === 'live-quiz-lobby' && <LiveQuizLobby />}
        {step === 'live-quiz-question' && <LiveQuizQuestion />}
        {step === 'live-quiz-results' && <LiveQuizResults />}
        {step === 'live-quiz-podium' && <LiveQuizPodium />}
      </div>
    </div>
  )
}

function LiveQuizLobby() {
  return (
    <div className="text-center animate-fadeIn">
      <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Zap className="w-8 h-8 text-white" />
      </div>
      <div className="text-xl font-bold text-white mb-1">Quiz: Fracciones</div>
      <div className="text-white/70 text-sm mb-4">Esperando jugadores...</div>
      
      {/* Código de acceso */}
      <div className="bg-white/10 backdrop-blur rounded-xl px-6 py-3 mb-4">
        <div className="text-white/60 text-[10px] mb-1">Código de acceso</div>
        <div className="text-3xl font-bold text-white tracking-widest">ABC123</div>
      </div>

      {/* Jugadores conectados */}
      <div className="flex items-center justify-center gap-2 text-white/80 text-sm">
        <Users className="w-4 h-4" />
        <span>12 jugadores conectados</span>
      </div>

      {/* Avatares de jugadores */}
      <div className="flex justify-center gap-1 mt-3">
        {['🦊', '🐼', '🦁', '🐸', '🐰'].map((emoji, i) => (
          <div key={i} className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm animate-bounce" style={{ animationDelay: `${i * 100}ms` }}>
            {emoji}
          </div>
        ))}
        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-[10px] text-white">
          +7
        </div>
      </div>
    </div>
  )
}

function LiveQuizQuestion() {
  return (
    <div className="w-full max-w-md animate-fadeIn">
      {/* Timer y pregunta */}
      <div className="text-center mb-4">
        <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-3 py-1 mb-3">
          <Timer className="w-4 h-4 text-white" />
          <span className="text-white font-bold">15s</span>
        </div>
        <div className="text-[10px] text-white/60 mb-1">Pregunta 1 de 5</div>
        <div className="text-lg font-bold text-white">¿Cuánto es 1/2 + 1/4?</div>
      </div>

      {/* Opciones */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { letter: 'A', text: '1/2', color: 'from-red-500 to-red-600' },
          { letter: 'B', text: '3/4', color: 'from-blue-500 to-blue-600' },
          { letter: 'C', text: '2/6', color: 'from-yellow-500 to-yellow-600' },
          { letter: 'D', text: '1/4', color: 'from-green-500 to-green-600' },
        ].map((opt, i) => (
          <div 
            key={i}
            className={`bg-gradient-to-br ${opt.color} rounded-xl p-3 text-center transform hover:scale-105 transition-transform cursor-pointer shadow-lg`}
          >
            <div className="text-white/80 text-[10px] font-bold mb-0.5">{opt.letter}</div>
            <div className="text-white font-bold text-lg">{opt.text}</div>
          </div>
        ))}
      </div>

      {/* Respuestas */}
      <div className="mt-4 text-center text-white/60 text-[10px]">
        8 de 12 han respondido
      </div>
    </div>
  )
}

function LiveQuizResults() {
  return (
    <div className="w-full max-w-md text-center animate-fadeIn">
      <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
        <CheckCircle2 className="w-8 h-8 text-white" />
      </div>
      <div className="text-xl font-bold text-white mb-1">¡Correcto!</div>
      <div className="text-white/70 text-sm mb-4">La respuesta es B. 3/4</div>

      {/* Estadísticas */}
      <div className="bg-white/10 backdrop-blur rounded-xl p-3 mb-4">
        <div className="text-white/60 text-[10px] mb-2">Distribución de respuestas</div>
        <div className="space-y-1.5">
          {[
            { letter: 'A', text: '1/2', percent: 15, correct: false },
            { letter: 'B', text: '3/4', percent: 65, correct: true },
            { letter: 'C', text: '2/6', percent: 12, correct: false },
            { letter: 'D', text: '1/4', percent: 8, correct: false },
          ].map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-5 text-[10px] text-white/80 font-bold">{opt.letter}</div>
              <div className="flex-1 h-4 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${opt.correct ? 'bg-green-500' : 'bg-white/30'}`}
                  style={{ width: `${opt.percent}%` }}
                />
              </div>
              <div className="w-8 text-[10px] text-white/80">{opt.percent}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function LiveQuizPodium() {
  return (
    <div className="w-full max-w-md text-center animate-fadeIn">
      <div className="flex items-center justify-center gap-1 mb-4">
        <Trophy className="w-6 h-6 text-yellow-400" />
        <span className="text-xl font-bold text-white">¡Resultados Finales!</span>
      </div>

      {/* Podio */}
      <div className="flex items-end justify-center gap-2 mb-4">
        {/* 2do lugar */}
        <div className="text-center">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-1 text-2xl">
            🐼
          </div>
          <div className="text-[10px] text-white font-medium truncate w-16">Ana G.</div>
          <div className="w-16 h-16 bg-gradient-to-t from-slate-400 to-slate-300 rounded-t-lg flex items-center justify-center mt-1">
            <div className="text-slate-700 font-bold">2°</div>
          </div>
          <div className="text-[10px] text-white/80">850 pts</div>
        </div>

        {/* 1er lugar */}
        <div className="text-center">
          <div className="w-14 h-14 bg-yellow-400/30 rounded-full flex items-center justify-center mx-auto mb-1 text-3xl ring-2 ring-yellow-400">
            🦊
          </div>
          <div className="text-[11px] text-white font-bold truncate w-20">Carlos M.</div>
          <div className="w-20 h-24 bg-gradient-to-t from-yellow-500 to-yellow-400 rounded-t-lg flex items-center justify-center mt-1">
            <div className="text-yellow-900 font-bold text-lg">1°</div>
          </div>
          <div className="text-[11px] text-yellow-300 font-bold">1,200 pts</div>
        </div>

        {/* 3er lugar */}
        <div className="text-center">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-1 text-2xl">
            🦁
          </div>
          <div className="text-[10px] text-white font-medium truncate w-16">Luis P.</div>
          <div className="w-16 h-12 bg-gradient-to-t from-amber-700 to-amber-600 rounded-t-lg flex items-center justify-center mt-1">
            <div className="text-amber-200 font-bold">3°</div>
          </div>
          <div className="text-[10px] text-white/80">720 pts</div>
        </div>
      </div>

      {/* Confetti visual */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full animate-confetti"
            style={{
              left: `${Math.random() * 100}%`,
              backgroundColor: ['#fbbf24', '#f59e0b', '#8b5cf6', '#ec4899', '#10b981'][i % 5],
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
