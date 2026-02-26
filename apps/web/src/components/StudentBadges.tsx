import { Shield } from 'lucide-react'

function ColorPuzzle({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M6 2h4v2a2 2 0 1 0 4 0V2h4v6h-2a2 2 0 1 0 0 4h2v6h-4v-2a2 2 0 1 0-4 0v2H6v-6h2a2 2 0 1 0 0-4H6V2z" fill="url(#puzzleGrad)" stroke="#7c3aed" strokeWidth="0.5"/>
      <defs>
        <linearGradient id="puzzleGrad" x1="0" y1="0" x2="24" y2="24">
          <stop offset="0%" stopColor="#3b82f6"/>
          <stop offset="33%" stopColor="#ef4444"/>
          <stop offset="66%" stopColor="#eab308"/>
          <stop offset="100%" stopColor="#22c55e"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

export function DiagnosisBadge({ student }: { student: Record<string, any> }) {
  if (!student.hasDiagnosis && !student.hasSupportProfile) return null
  return (
    <span className="inline-flex items-center gap-0.5 ml-1.5">
      {student.hasDiagnosis && (
        <span title={student.diagnosisType ? `Diagnóstico: ${student.diagnosisType}` : 'Estudiante con diagnóstico'}>
          <ColorPuzzle className="w-4 h-4" />
        </span>
      )}
      {student.hasSupportProfile && (
        <span title="Perfil de acompañamiento diferencial activo">
          <Shield className="w-3.5 h-3.5 text-blue-500 fill-blue-200" />
        </span>
      )}
    </span>
  )
}
