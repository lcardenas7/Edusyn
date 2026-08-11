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
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ArrowUp,
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
  | 'cursor-to-recovery'
  | 'click-recovery'
  | 'recovery-view'
  | 'cursor-to-grade1'
  | 'type-grade1'
  | 'cursor-to-grade2'
  | 'type-grade2'
  | 'cursor-to-save'
  | 'click-save'
  | 'saved-success'

const STEP_DURATION: Record<DemoStep, number> = {
  'dashboard': 2000,
  'cursor-to-gestion': 600,
  'click-gestion': 300,
  'gestion-expanded': 500,
  'cursor-to-recovery': 500,
  'click-recovery': 300,
  'recovery-view': 1200,
  'cursor-to-grade1': 500,
  'type-grade1': 500,
  'cursor-to-grade2': 500,
  'type-grade2': 500,
  'cursor-to-save': 500,
  'click-save': 300,
  'saved-success': 2500,
}

const CURSOR_POSITIONS: Record<DemoStep, { x: number; y: number; visible: boolean; clicking?: boolean }> = {
  'dashboard': { x: 60, y: 40, visible: true },
  'cursor-to-gestion': { x: 12, y: 38, visible: true },
  'click-gestion': { x: 12, y: 38, visible: true, clicking: true },
  'gestion-expanded': { x: 12, y: 38, visible: true },
  'cursor-to-recovery': { x: 14, y: 50, visible: true },
  'click-recovery': { x: 14, y: 50, visible: true, clicking: true },
  'recovery-view': { x: 50, y: 45, visible: true },
  'cursor-to-grade1': { x: 80, y: 48, visible: true },
  'type-grade1': { x: 80, y: 48, visible: true, clicking: true },
  'cursor-to-grade2': { x: 80, y: 56, visible: true },
  'type-grade2': { x: 80, y: 56, visible: true, clicking: true },
  'cursor-to-save': { x: 90, y: 18, visible: true },
  'click-save': { x: 90, y: 18, visible: true, clicking: true },
  'saved-success': { x: 50, y: 50, visible: false },
}

const SEQUENCE: DemoStep[] = [
  'dashboard',
  'cursor-to-gestion',
  'click-gestion',
  'gestion-expanded',
  'cursor-to-recovery',
  'click-recovery',
  'recovery-view',
  'cursor-to-grade1',
  'type-grade1',
  'cursor-to-grade2',
  'type-grade2',
  'cursor-to-save',
  'click-save',
  'saved-success',
]

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export default function RecoveryDemo() {
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
    if (['dashboard', 'cursor-to-gestion', 'click-gestion', 'gestion-expanded', 'cursor-to-recovery', 'click-recovery'].includes(step)) return 'dashboard'
    return 'recovery'
  }, [step])

  const gestionExpanded = useMemo(() => {
    return ['gestion-expanded', 'cursor-to-recovery', 'click-recovery'].includes(step)
  }, [step])

  const recoveryGrades = useMemo(() => {
    const base = { g1: '', g2: '' }
    if (['type-grade1', 'cursor-to-grade2', 'type-grade2', 'cursor-to-save', 'click-save', 'saved-success'].includes(step)) {
      base.g1 = '3.5'
    }
    if (['type-grade2', 'cursor-to-save', 'click-save', 'saved-success'].includes(step)) {
      base.g2 = '3.8'
    }
    return base
  }, [step])

  const cursorPos = CURSOR_POSITIONS[step]
  const browserUrl = currentView === 'dashboard' ? 'edusyn.co/dashboard' : 'edusyn.co/recoveries'
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
          highlightRecovery={step === 'cursor-to-recovery' || step === 'click-recovery'}
        />

        <div className="flex-1 bg-slate-50 overflow-hidden relative">
          {currentView === 'dashboard' && (
            <DashboardView fadeOut={step === 'click-recovery'} />
          )}

          {currentView === 'recovery' && (
            <RecoveryView 
              recoveryGrades={recoveryGrades}
              highlightRow={
                step === 'cursor-to-grade1' || step === 'type-grade1' ? 1 :
                step === 'cursor-to-grade2' || step === 'type-grade2' ? 2 : 0
              }
              highlightSave={step === 'cursor-to-save' || step === 'click-save'}
            />
          )}

          {showSuccess && (
            <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center animate-fadeIn">
              <div className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center mb-3 shadow-lg">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              <div className="text-lg font-bold text-slate-900">¡Recuperaciones guardadas!</div>
              <div className="text-sm text-slate-500">Carlos López ahora aprueba Matemáticas</div>
              <div className="flex items-center gap-1 mt-2 text-emerald-600">
                <ArrowUp className="w-4 h-4" />
                <span className="text-sm font-medium">2.5 → 3.5</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <AnimatedCursor x={cursorPos.x} y={cursorPos.y} visible={cursorPos.visible} clicking={cursorPos.clicking} />

      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-0.5">
        {SEQUENCE.map((_, i) => (
          <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === stepIndex ? 'w-3 bg-emerald-500' : 'w-1 bg-slate-300'}`} />
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
            <div className="w-full h-full rounded-full bg-emerald-400/40 animate-ping" />
          </div>
        )}
      </div>
    </div>
  )
}

function Sidebar({ currentView, gestionExpanded, highlightGestion, highlightRecovery }: { 
  currentView: string
  gestionExpanded: boolean
  highlightGestion: boolean
  highlightRecovery: boolean
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
          highlightGestion ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300 ring-offset-1' 
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
            <div className="flex items-center gap-2 px-2 py-1 text-slate-500">
              <Target className="w-3 h-3" />
              Aprendizajes y Evidencias
            </div>
            <div className={`flex items-center gap-2 px-2 py-1 rounded-md font-medium transition-all ${
              highlightRecovery ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300 ring-offset-1' 
              : currentView === 'recovery' ? 'bg-blue-50 text-blue-700' 
              : 'text-slate-500'
            }`}>
              <RefreshCw className="w-3 h-3" />
              Recuperaciones
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

function RecoveryView({ 
  recoveryGrades,
  highlightRow,
  highlightSave
}: { 
  recoveryGrades: { g1: string; g2: string }
  highlightRow: number
  highlightSave: boolean
}) {
  return (
    <div className="h-full animate-fadeIn">
      {/* Header con botón guardar */}
      <div className="px-4 py-2 border-b border-slate-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-bold text-slate-900">Recuperaciones</span>
          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[8px] font-medium rounded-full flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            12 pendientes
          </span>
        </div>
        <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-semibold transition-all ${
          highlightSave 
            ? 'bg-emerald-600 text-white ring-2 ring-emerald-300 ring-offset-1 scale-105 shadow-lg' 
            : 'bg-emerald-600 text-white'
        }`}>
          <Save className="w-3 h-3" />
          Guardar
        </button>
      </div>

      {/* Info banner */}
      <div className="mx-4 mt-3 bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <div className="text-[9px] font-semibold text-amber-800">Estudiantes con nota inferior a 3.0</div>
          <div className="text-[8px] text-amber-700">Registra las notas de recuperación para actualizar el promedio final</div>
        </div>
      </div>

      {/* Student list */}
      <div className="p-3 space-y-2">
        <div className="text-[10px] font-semibold text-slate-700 mb-2">Matemáticas - 5°A</div>
        
        <RecoveryStudentRow 
          name="Carlos López"
          originalGrade="2.5"
          recoveryGrade={recoveryGrades.g1}
          highlight={highlightRow === 1}
          selected={true}
        />
        <RecoveryStudentRow 
          name="Pedro Ramírez"
          originalGrade="2.8"
          recoveryGrade={recoveryGrades.g2}
          highlight={highlightRow === 2}
          selected={true}
        />
        <RecoveryStudentRow 
          name="Laura Gómez"
          originalGrade="2.3"
          recoveryGrade=""
          highlight={false}
          selected={false}
        />
        
        <div className="text-center text-[8px] text-slate-400 pt-1">... 9 estudiantes más</div>
      </div>
    </div>
  )
}

function RecoveryStudentRow({ name, originalGrade, recoveryGrade, highlight, selected }: { 
  name: string
  originalGrade: string
  recoveryGrade: string
  highlight: boolean
  selected: boolean
}) {
  const hasRecovery = recoveryGrade !== ''
  const passed = hasRecovery && parseFloat(recoveryGrade) >= 3.0

  return (
    <div className={`bg-white rounded-lg border p-2 transition-all ${
      highlight ? 'ring-2 ring-emerald-300 border-emerald-300' : 'border-slate-200'
    }`}>
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center">
          <span className="text-[9px] font-medium text-slate-600">{name.split(' ').map(n => n[0]).join('')}</span>
        </div>
        <div className="flex-1">
          <div className="text-[10px] font-medium text-slate-900">{name}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[8px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
              Original: {originalGrade}
            </span>
            {hasRecovery && (
              <>
                <ArrowUp className="w-3 h-3 text-emerald-500" />
                <span className={`text-[8px] px-1.5 py-0.5 rounded ${passed ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50'}`}>
                  Recuperación: {recoveryGrade}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="w-16">
          <input 
            type="text"
            value={recoveryGrade}
            readOnly
            className={`w-full text-center text-[10px] font-bold rounded border px-2 py-1.5 transition-all ${
              hasRecovery 
                ? passed 
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700' 
                  : 'border-amber-200 bg-amber-50 text-amber-700'
                : 'border-slate-200 bg-slate-50 text-slate-400'
            }`}
            placeholder="0.0"
          />
        </div>
        {hasRecovery && passed && (
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        )}
      </div>
    </div>
  )
}
