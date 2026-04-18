import { useEffect, useState, useMemo } from 'react'
import { 
  GraduationCap, 
  LayoutDashboard, 
  Calendar,
  Users, 
  BookOpen,
  Bell,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Clock,
  FileText,
  Building2,
  TrendingUp,
  MousePointer2,
  Save,
  CheckCircle2,
  Megaphone,
  Image,
  Cake,
  UserCheck
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS Y CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════════

type DemoStep = 
  | 'dashboard'
  | 'cursor-to-seguimiento'
  | 'click-seguimiento'
  | 'seguimiento-expanded'
  | 'cursor-to-asistencia'
  | 'click-asistencia'
  | 'attendance-view'
  | 'select-group'
  | 'group-selected'
  | 'cursor-to-student1'
  | 'mark-present1'
  | 'cursor-to-student2'
  | 'mark-absent2'
  | 'cursor-to-student3'
  | 'mark-late3'
  | 'cursor-to-save'
  | 'click-save'
  | 'saved-success'

const STEP_DURATION: Record<DemoStep, number> = {
  'dashboard': 2000,
  'cursor-to-seguimiento': 600,
  'click-seguimiento': 300,
  'seguimiento-expanded': 600,
  'cursor-to-asistencia': 500,
  'click-asistencia': 300,
  'attendance-view': 1000,
  'select-group': 600,
  'group-selected': 600,
  'cursor-to-student1': 400,
  'mark-present1': 350,
  'cursor-to-student2': 400,
  'mark-absent2': 350,
  'cursor-to-student3': 400,
  'mark-late3': 350,
  'cursor-to-save': 500,
  'click-save': 300,
  'saved-success': 2500,
}

const CURSOR_POSITIONS: Record<DemoStep, { x: number; y: number; visible: boolean; clicking?: boolean }> = {
  'dashboard': { x: 60, y: 40, visible: true },
  'cursor-to-seguimiento': { x: 12, y: 52, visible: true },
  'click-seguimiento': { x: 12, y: 52, visible: true, clicking: true },
  'seguimiento-expanded': { x: 12, y: 52, visible: true },
  'cursor-to-asistencia': { x: 14, y: 56, visible: true },
  'click-asistencia': { x: 14, y: 56, visible: true, clicking: true },
  'attendance-view': { x: 45, y: 22, visible: true },
  'select-group': { x: 45, y: 22, visible: true, clicking: true },
  'group-selected': { x: 50, y: 45, visible: true },
  'cursor-to-student1': { x: 75, y: 42, visible: true },
  'mark-present1': { x: 75, y: 42, visible: true, clicking: true },
  'cursor-to-student2': { x: 81, y: 50, visible: true },
  'mark-absent2': { x: 81, y: 50, visible: true, clicking: true },
  'cursor-to-student3': { x: 87, y: 58, visible: true },
  'mark-late3': { x: 87, y: 58, visible: true, clicking: true },
  'cursor-to-save': { x: 90, y: 22, visible: true },
  'click-save': { x: 90, y: 22, visible: true, clicking: true },
  'saved-success': { x: 50, y: 50, visible: false },
}

const SEQUENCE: DemoStep[] = [
  'dashboard',
  'cursor-to-seguimiento',
  'click-seguimiento',
  'seguimiento-expanded',
  'cursor-to-asistencia',
  'click-asistencia',
  'attendance-view',
  'select-group',
  'group-selected',
  'cursor-to-student1',
  'mark-present1',
  'cursor-to-student2',
  'mark-absent2',
  'cursor-to-student3',
  'mark-late3',
  'cursor-to-save',
  'click-save',
  'saved-success',
]

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export default function AttendanceDemo() {
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
    if (['dashboard', 'cursor-to-seguimiento', 'click-seguimiento', 'seguimiento-expanded', 'cursor-to-asistencia', 'click-asistencia'].includes(step)) return 'dashboard'
    return 'attendance'
  }, [step])

  const seguimientoExpanded = useMemo(() => {
    return ['seguimiento-expanded', 'cursor-to-asistencia', 'click-asistencia'].includes(step)
  }, [step])

  const groupSelected = useMemo(() => {
    return !['dashboard', 'cursor-to-seguimiento', 'click-seguimiento', 'seguimiento-expanded', 'cursor-to-asistencia', 'click-asistencia', 'attendance-view', 'select-group'].includes(step)
  }, [step])

  const studentStates = useMemo(() => {
    const base = { s1: '', s2: '', s3: '', s4: '', s5: '' }
    if (['mark-present1', 'cursor-to-student2', 'mark-absent2', 'cursor-to-student3', 'mark-late3', 'cursor-to-save', 'click-save', 'saved-success'].includes(step)) {
      base.s1 = 'PRESENT'
    }
    if (['mark-absent2', 'cursor-to-student3', 'mark-late3', 'cursor-to-save', 'click-save', 'saved-success'].includes(step)) {
      base.s2 = 'ABSENT'
    }
    if (['mark-late3', 'cursor-to-save', 'click-save', 'saved-success'].includes(step)) {
      base.s3 = 'LATE'
    }
    return base
  }, [step])

  const cursorPos = CURSOR_POSITIONS[step]
  const browserUrl = currentView === 'dashboard' ? 'edusyn.co/dashboard' : 'edusyn.co/attendance'
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
          seguimientoExpanded={seguimientoExpanded}
          highlightSeguimiento={step === 'cursor-to-seguimiento' || step === 'click-seguimiento'}
          highlightAsistencia={step === 'cursor-to-asistencia' || step === 'click-asistencia'}
        />

        <div className="flex-1 bg-slate-50 overflow-hidden relative">
          {currentView === 'dashboard' && (
            <DashboardView fadeOut={step === 'click-asistencia'} />
          )}

          {currentView === 'attendance' && (
            <AttendanceView 
              groupSelected={groupSelected}
              highlightGroupSelect={step === 'select-group'}
              studentStates={studentStates}
              highlightStudent={
                step === 'cursor-to-student1' || step === 'mark-present1' ? 1 :
                step === 'cursor-to-student2' || step === 'mark-absent2' ? 2 :
                step === 'cursor-to-student3' || step === 'mark-late3' ? 3 : 0
              }
              highlightSave={step === 'cursor-to-save' || step === 'click-save'}
            />
          )}

          {showSuccess && (
            <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center animate-fadeIn">
              <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center mb-3 shadow-lg">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              <div className="text-lg font-bold text-slate-900">¡Asistencia guardada!</div>
              <div className="text-sm text-slate-500">28 estudiantes registrados</div>
            </div>
          )}
        </div>
      </div>

      <AnimatedCursor x={cursorPos.x} y={cursorPos.y} visible={cursorPos.visible} clicking={cursorPos.clicking} />

      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-0.5">
        {SEQUENCE.map((_, i) => (
          <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === stepIndex ? 'w-3 bg-green-500' : 'w-1 bg-slate-300'}`} />
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
            <div className="w-full h-full rounded-full bg-green-400/40 animate-ping" />
          </div>
        )}
      </div>
    </div>
  )
}

function Sidebar({ currentView, seguimientoExpanded, highlightSeguimiento, highlightAsistencia }: { 
  currentView: string
  seguimientoExpanded: boolean
  highlightSeguimiento: boolean
  highlightAsistencia: boolean
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
        <SidebarItem icon={LayoutDashboard} label="Dashboard" active={currentView === 'dashboard' && !seguimientoExpanded} />
        <SidebarGroup icon={Users} label="Gestión de Personas" />
        <SidebarGroup icon={BookOpen} label="Gestión Académica" />
        
        {/* Seguimiento - expandible */}
        <div className={`flex items-center gap-2 px-2 py-1.5 rounded-md font-medium cursor-pointer transition-all ${
          highlightSeguimiento ? 'bg-green-100 text-green-700 ring-2 ring-green-300 ring-offset-1' 
          : seguimientoExpanded ? 'bg-slate-100 text-slate-700' 
          : 'text-slate-600'
        }`}>
          <UserCheck className="w-3 h-3" />
          <span className="flex-1">Seguimiento</span>
          {seguimientoExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </div>
        
        {/* Submenu de Seguimiento */}
        {seguimientoExpanded && (
          <div className="ml-3 pl-2 border-l border-slate-200 space-y-0.5">
            <div className={`flex items-center gap-2 px-2 py-1 rounded-md font-medium transition-all ${
              highlightAsistencia ? 'bg-green-100 text-green-700 ring-2 ring-green-300 ring-offset-1' 
              : currentView === 'attendance' ? 'bg-blue-50 text-blue-700' 
              : 'text-slate-500'
            }`}>
              <Calendar className="w-3 h-3" />
              Asistencia
            </div>
            <div className="flex items-center gap-2 px-2 py-1 text-slate-500">
              <FileText className="w-3 h-3" />
              Observador
            </div>
          </div>
        )}
        
        <SidebarGroup icon={TrendingUp} label="Reportes" />
        <SidebarGroup icon={Bell} label="Comunicaciones" />
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
      {/* Header */}
      <div className="px-4 py-2 bg-white border-b border-slate-200">
        <div className="text-sm font-bold text-slate-900">¡Bienvenido, María!</div>
        <div className="text-[8px] text-slate-500">Aquí tienes las novedades de la institución</div>
      </div>

      {/* Content Grid */}
      <div className="p-3 grid grid-cols-3 gap-2 h-[calc(100%-3rem)]">
        {/* Anuncios */}
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

        {/* Columna derecha */}
        <div className="space-y-2">
          {/* Eventos */}
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
              <div className="flex items-center gap-1.5">
                <div className="bg-green-100 text-green-700 rounded px-1 py-0.5 text-[7px] font-medium">22 Abr</div>
                <span className="text-[8px] text-slate-600">Día de la Tierra</span>
              </div>
            </div>
          </div>

          {/* Cumpleaños */}
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
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 bg-pink-500 text-white rounded-full flex items-center justify-center text-[7px] font-bold">23</div>
                <div>
                  <div className="text-[8px] font-medium text-slate-800">Ana García</div>
                  <div className="text-[7px] text-slate-500">5°B</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AttendanceView({ 
  groupSelected, 
  highlightGroupSelect, 
  studentStates,
  highlightStudent,
  highlightSave
}: { 
  groupSelected: boolean
  highlightGroupSelect: boolean
  studentStates: { s1: string; s2: string; s3: string; s4: string; s5: string }
  highlightStudent: number
  highlightSave: boolean
}) {
  return (
    <div className="h-full animate-fadeIn">
      {/* Header con botón guardar */}
      <div className="px-4 py-2 border-b border-slate-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-green-600" />
          <span className="text-sm font-bold text-slate-900">Asistencia</span>
        </div>
        {groupSelected && (
          <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-semibold transition-all ${
            highlightSave 
              ? 'bg-green-600 text-white ring-2 ring-green-300 ring-offset-1 scale-105 shadow-lg' 
              : 'bg-green-600 text-white'
          }`}>
            <Save className="w-3 h-3" />
            Guardar
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex gap-2">
        <div className={`flex-1 bg-white border rounded-lg px-2 py-1.5 text-[9px] flex items-center justify-between transition-all ${
          highlightGroupSelect ? 'ring-2 ring-green-300 border-green-300' : 'border-slate-200'
        }`}>
          <span className={groupSelected ? 'text-slate-900' : 'text-slate-400'}>
            {groupSelected ? '5° A - Matemáticas' : 'Seleccionar grupo...'}
          </span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </div>
        <div className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[9px] text-slate-600">
          {new Date().toISOString().split('T')[0]}
        </div>
      </div>

      {/* Student list */}
      {groupSelected && (
        <div className="p-3 space-y-1.5">
          <StudentRow name="Ana García" num={1} status={studentStates.s1} highlight={highlightStudent === 1} />
          <StudentRow name="Carlos López" num={2} status={studentStates.s2} highlight={highlightStudent === 2} />
          <StudentRow name="María Rodríguez" num={3} status={studentStates.s3} highlight={highlightStudent === 3} />
          <StudentRow name="Juan Martínez" num={4} status={studentStates.s4} highlight={false} />
          <StudentRow name="Laura Sánchez" num={5} status={studentStates.s5} highlight={false} />
          <div className="text-center text-[8px] text-slate-400 pt-1">... 23 estudiantes más</div>
        </div>
      )}
    </div>
  )
}

function StudentRow({ name, num, status, highlight }: { name: string; num: number; status: string; highlight: boolean }) {
  return (
    <div className={`bg-white rounded-lg border p-2 flex items-center gap-3 transition-all ${
      highlight ? 'ring-2 ring-green-300 border-green-300' : 'border-slate-200'
    }`}>
      <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[9px] font-medium text-slate-600">
        {num}
      </div>
      <div className="flex-1 text-[10px] font-medium text-slate-900">{name}</div>
      <div className="flex gap-1">
        <StatusButton type="PRESENT" active={status === 'PRESENT'} />
        <StatusButton type="ABSENT" active={status === 'ABSENT'} />
        <StatusButton type="LATE" active={status === 'LATE'} />
        <StatusButton type="EXCUSED" active={status === 'EXCUSED'} />
      </div>
    </div>
  )
}

function StatusButton({ type, active }: { type: string; active: boolean }) {
  const config: Record<string, { icon: any; color: string; activeColor: string }> = {
    PRESENT: { icon: Check, color: 'text-slate-300', activeColor: 'bg-green-500 text-white' },
    ABSENT: { icon: X, color: 'text-slate-300', activeColor: 'bg-red-500 text-white' },
    LATE: { icon: Clock, color: 'text-slate-300', activeColor: 'bg-amber-500 text-white' },
    EXCUSED: { icon: FileText, color: 'text-slate-300', activeColor: 'bg-blue-500 text-white' },
  }
  const { icon: Icon, color, activeColor } = config[type]
  
  return (
    <div className={`w-6 h-6 rounded flex items-center justify-center transition-all ${active ? activeColor : `bg-slate-50 ${color}`}`}>
      <Icon className="w-3 h-3" />
    </div>
  )
}
