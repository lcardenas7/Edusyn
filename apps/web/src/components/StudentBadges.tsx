import { Heart, Shield } from 'lucide-react'

export function DiagnosisBadge({ student }: { student: Record<string, any> }) {
  if (!student.hasDiagnosis && !student.hasSupportProfile) return null
  return (
    <span className="inline-flex items-center gap-0.5 ml-1.5">
      {student.hasDiagnosis && (
        <span title={student.diagnosisType ? `Diagnóstico: ${student.diagnosisType}` : 'Estudiante con diagnóstico'}>
          <Heart className="w-3.5 h-3.5 text-purple-500 fill-purple-200" />
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
