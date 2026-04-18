import { useEffect, useState, useMemo } from 'react'
import { 
  GraduationCap, 
  LayoutDashboard, 
  BookOpen,
  Users, 
  Bell,
  ChevronDown,
  ChevronRight,
  Building2,
  TrendingUp,
  MousePointer2,
  Save,
  CheckCircle2,
  Megaphone,
  Calendar,
  Cake,
  UserCheck
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS Y CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════════

type DemoStep = 
  | 'dashboard'
  | 'cursor-to-gestion'
  | 'click-gestion'
  | 'gestion-expanded'
  | 'cursor-to-calificaciones'
  | 'click-calificaciones'
  | 'grades-view'
  | 'select-group'
  | 'group-selected'
  | 'cursor-to-grade1'
  | 'type-grade1'
  | 'cursor-to-grade2'
  | 'type-grade2'
  | 'cursor-to-grade3'
  | 'type-grade3'
  | 'cursor-to-grade4'
  | 'type-grade4'
  | 'cursor-to-save'
  | 'click-save'
  | 'saved-success'

const STEP_DURATION: Record<DemoStep, number> = {
  'dashboard': 2000,
  'cursor-to-gestion': 600,
  'click-gestion': 300,
  'gestion-expanded': 500,
  'cursor-to-calificaciones': 500,
  'click-calificaciones': 300,
  'grades-view': 1000,
  'select-group': 600,
  'group-selected': 600,
  'cursor-to-grade1': 350,
  'type-grade1': 400,
  'cursor-to-grade2': 350,
  'type-grade2': 400,
  'cursor-to-grade3': 350,
  'type-grade3': 400,
  'cursor-to-grade4': 350,
  'type-grade4': 400,
  'cursor-to-save': 500,
  'click-save': 300,
  'saved-success': 2500,
}

const CURSOR_POSITIONS: Record<DemoStep, { x: number; y: number; visible: boolean; clicking?: boolean }> = {
  'dashboard': { x: 60, y: 40, visible: true },
  'cursor-to-gestion': { x: 12, y: 38, visible: true },
  'click-gestion': { x: 12, y: 38, visible: true, clicking: true },
  'gestion-expanded': { x: 12, y: 38, visible: true },
  'cursor-to-calificaciones': { x: 14, y: 42, visible: true },
  'click-calificaciones': { x: 14, y: 42, visible: true, clicking: true },
  'grades-view': { x: 40, y: 22, visible: true },
  'select-group': { x: 40, y: 22, visible: true, clicking: true },
  'group-selected': { x: 50, y: 45, visible: true },
  'cursor-to-grade1': { x: 55, y: 48, visible: true },
  'type-grade1': { x: 55, y: 48, visible: true, clicking: true },
  'cursor-to-grade2': { x: 65, y: 48, visible: true },
  'type-grade2': { x: 65, y: 48, visible: true, clicking: true },
  'cursor-to-grade3': { x: 55, y: 56, visible: true },
  'type-grade3': { x: 55, y: 56, visible: true, clicking: true },
  'cursor-to-grade4': { x: 65, y: 56, visible: true },
  'type-grade4': { x: 65, y: 56, visible: true, clicking: true },
  'cursor-to-save': { x: 90, y: 18, visible: true },
  'click-save': { x: 90, y: 18, visible: true, clicking: true },
  'saved-success': { x: 50, y: 50, visible: false },
}

const SEQUENCE: DemoStep[] = [
  'dashboard',
  'cursor-to-gestion',
  'click-gestion',
  'gestion-expanded',
  'cursor-to-calificaciones',
  'click-calificaciones',
  'grades-view',
  'select-group',
  'group-selected',
  'cursor-to-grade1',
  'type-grade1',
  'cursor-to-grade2',
  'type-grade2',
  'cursor-to-grade3',
  'type-grade3',
  'cursor-to-grade4',
  'type-grade4',
  'cursor-to-save',
  'click-save',
  'saved-success',
]

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export default function GradesDemo() {
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
    if (['dashboard', 'cursor-to-gestion', 'click-gestion', 'gestion-expanded', 'cursor-to-calificaciones', 'click-calificaciones'].includes(step)) return 'dashboard'
    return 'grades'
  }, [step])

  const gestionExpanded = useMemo(() => {
    return ['gestion-expanded', 'cursor-to-calificaciones', 'click-calificaciones'].includes(step)
  }, [step])

  const groupSelected = useMemo(() => {
    return !['dashboard', 'cursor-to-gestion', 'click-gestion', 'gestion-expanded', 'cursor-to-calificaciones', 'click-calificaciones', 'grades-view', 'select-group'].includes(step)
  }, [step])

  const gradeValues = useMemo(() => {
    const base = { g1: '', g2: '', g3: '', g4: '' }
    if (['type-grade1', 'cursor-to-grade2', 'type-grade2', 'cursor-to-grade3', 'type-grade3', 'cursor-to-grade4', 'type-grade4', 'cursor-to-save', 'click-save', 'saved-success'].includes(step)) {
      base.g1 = '4.5'
    }
    if (['type-grade2', 'cursor-to-grade3', 'type-grade3', 'cursor-to-grade4', 'type-grade4', 'cursor-to-save', 'click-save', 'saved-success'].includes(step)) {
      base.g2 = '3.8'
    }
    if (['type-grade3', 'cursor-to-grade4', 'type-grade4', 'cursor-to-save', 'click-save', 'saved-success'].includes(step)) {
      base.g3 = '4.2'
    }
    if (['type-grade4', 'cursor-to-save', 'click-save', 'saved-success'].includes(step)) {
      base.g4 = '3.5'
    }
    return base
  }, [step])

  const cursorPos = CURSOR_POSITIONS[step]
  const browserUrl = currentView === 'dashboard' ? 'edusyn.co/dashboard' : 'edusyn.co/grades'
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
          highlightCalificaciones={step === 'cursor-to-calificaciones' || step === 'click-calificaciones'}
        />

        <div className="flex-1 bg-slate-50 overflow-hidden relative">
          {currentView === 'dashboard' && (
            <DashboardView fadeOut={step === 'click-calificaciones'} />
          )}

          {currentView === 'grades' && (
            <GradesView 
              groupSelected={groupSelected}
              highlightGroupSelect={step === 'select-group'}
              gradeValues={gradeValues}
              highlightCell={
                step === 'cursor-to-grade1' || step === 'type-grade1' ? 1 :
                step === 'cursor-to-grade2' || step === 'type-grade2' ? 2 :
                step === 'cursor-to-grade3' || step === 'type-grade3' ? 3 :
                step === 'cursor-to-grade4' || step === 'type-grade4' ? 4 : 0
              }
              highlightSave={step === 'cursor-to-save' || step === 'click-save'}
            />
          )}

          {showSuccess && (
            <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center animate-fadeIn">
              <div className="w-14 h-14 bg-indigo-500 rounded-full flex items-center justify-center mb-3 shadow-lg">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              <div className="text-lg font-bold text-slate-900">¡Notas guardadas!</div>
              <div className="text-sm text-slate-500">Taller de Fracciones - 28 estudiantes</div>
            </div>
          )}
        </div>
      </div>

      <AnimatedCursor x={cursorPos.x} y={cursorPos.y} visible={cursorPos.visible} clicking={cursorPos.clicking} />

      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-0.5">
        {SEQUENCE.map((_, i) => (
          <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === stepIndex ? 'w-3 bg-indigo-500' : 'w-1 bg-slate-300'}`} />
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
            <div className="w-full h-full rounded-full bg-indigo-400/40 animate-ping" />
          </div>
        )}
      </div>
    </div>
  )
}

function Sidebar({ currentView, gestionExpanded, highlightGestion, highlightCalificaciones }: { 
  currentView: string
  gestionExpanded: boolean
  highlightGestion: boolean
  highlightCalificaciones: boolean
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
          highlightGestion ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-300 ring-offset-1' 
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
            <div className={`flex items-center gap-2 px-2 py-1 rounded-md font-medium transition-all ${
              highlightCalificaciones ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-300 ring-offset-1' 
              : currentView === 'grades' ? 'bg-blue-50 text-blue-700' 
              : 'text-slate-500'
            }`}>
              <BookOpen className="w-3 h-3" />
              Calificaciones
            </div>
            <div className="flex items-center gap-2 px-2 py-1 text-slate-500">
              <UserCheck className="w-3 h-3" />
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

function GradesView({ 
  groupSelected, 
  highlightGroupSelect, 
  gradeValues,
  highlightCell,
  highlightSave
}: { 
  groupSelected: boolean
  highlightGroupSelect: boolean
  gradeValues: { g1: string; g2: string; g3: string; g4: string }
  highlightCell: number
  highlightSave: boolean
}) {
  return (
    <div className="h-full animate-fadeIn">
      {/* Header con botón guardar */}
      <div className="px-4 py-2 border-b border-slate-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-bold text-slate-900">Calificaciones</span>
          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[8px] font-medium">Período 1</span>
        </div>
        {groupSelected && (
          <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-semibold transition-all ${
            highlightSave 
              ? 'bg-indigo-600 text-white ring-2 ring-indigo-300 ring-offset-1 scale-105 shadow-lg' 
              : 'bg-indigo-600 text-white'
          }`}>
            <Save className="w-3 h-3" />
            Guardar
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex gap-2">
        <div className={`flex-1 bg-white border rounded-lg px-2 py-1.5 text-[9px] flex items-center justify-between transition-all ${
          highlightGroupSelect ? 'ring-2 ring-indigo-300 border-indigo-300' : 'border-slate-200'
        }`}>
          <span className={groupSelected ? 'text-slate-900' : 'text-slate-400'}>
            {groupSelected ? '5° A - Matemáticas' : 'Seleccionar grupo...'}
          </span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </div>
      </div>

      {/* Planilla de notas estilo tabla real */}
      {groupSelected && (
        <div className="p-2 overflow-auto">
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            {/* Header de la tabla */}
            <div className="bg-slate-100 grid grid-cols-[30px_1fr_60px_60px_60px] text-[8px] font-semibold text-slate-600">
              <div className="px-2 py-1.5 border-r border-slate-200">#</div>
              <div className="px-2 py-1.5 border-r border-slate-200">Estudiante</div>
              <div className="px-2 py-1.5 border-r border-slate-200 text-center">Taller 1</div>
              <div className="px-2 py-1.5 border-r border-slate-200 text-center">Quiz</div>
              <div className="px-2 py-1.5 text-center">Prom.</div>
            </div>
            
            {/* Filas de estudiantes */}
            <GradeTableRow num={1} name="Ana García" g1={gradeValues.g1} g2={gradeValues.g2} highlightCell={highlightCell === 1 ? 1 : highlightCell === 2 ? 2 : 0} />
            <GradeTableRow num={2} name="Carlos López" g1={gradeValues.g3} g2={gradeValues.g4} highlightCell={highlightCell === 3 ? 1 : highlightCell === 4 ? 2 : 0} />
            <GradeTableRow num={3} name="María Rodríguez" g1="" g2="" highlightCell={0} />
            <GradeTableRow num={4} name="Juan Martínez" g1="" g2="" highlightCell={0} />
            <div className="text-center text-[8px] text-slate-400 py-1.5 border-t border-slate-100">... 24 estudiantes más</div>
          </div>
        </div>
      )}
    </div>
  )
}

function GradeTableRow({ num, name, g1, g2, highlightCell }: { 
  num: number; name: string; g1: string; g2: string; highlightCell: number 
}) {
  const calcProm = () => {
    if (!g1 && !g2) return ''
    const vals = [g1, g2].filter(Boolean).map(parseFloat)
    if (vals.length === 0) return ''
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
  }
  const prom = calcProm()

  return (
    <div className="grid grid-cols-[30px_1fr_60px_60px_60px] text-[9px] border-t border-slate-100">
      <div className="px-2 py-1.5 border-r border-slate-100 text-slate-500">{num}</div>
      <div className="px-2 py-1.5 border-r border-slate-100 font-medium text-slate-900 truncate">{name}</div>
      <div className={`px-1 py-1 border-r border-slate-100 flex justify-center ${highlightCell === 1 ? 'bg-indigo-50' : ''}`}>
        <input 
          type="text"
          value={g1}
          readOnly
          className={`w-10 text-center text-[9px] font-bold rounded border px-1 py-0.5 transition-all ${
            highlightCell === 1 ? 'ring-2 ring-indigo-300 border-indigo-300 bg-white' :
            g1 ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-slate-50 text-slate-400'
          }`}
          placeholder="-"
        />
      </div>
      <div className={`px-1 py-1 border-r border-slate-100 flex justify-center ${highlightCell === 2 ? 'bg-indigo-50' : ''}`}>
        <input 
          type="text"
          value={g2}
          readOnly
          className={`w-10 text-center text-[9px] font-bold rounded border px-1 py-0.5 transition-all ${
            highlightCell === 2 ? 'ring-2 ring-indigo-300 border-indigo-300 bg-white' :
            g2 ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-slate-50 text-slate-400'
          }`}
          placeholder="-"
        />
      </div>
      <div className="px-2 py-1.5 flex justify-center">
        {prom && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
            parseFloat(prom) >= 4.0 ? 'bg-green-100 text-green-700' : 
            parseFloat(prom) >= 3.0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
          }`}>
            {prom}
          </span>
        )}
      </div>
    </div>
  )
}
