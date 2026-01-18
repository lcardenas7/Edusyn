import { createContext, useContext, useState, ReactNode } from 'react'

interface AttitudinalBreakdown {
  personal: number
  social: number
  autoevaluacion: number
  coevaluacion: number
}

interface GradingScale {
  superior: { min: number; max: number }
  alto: { min: number; max: number }
  basico: { min: number; max: number }
  bajo: { min: number; max: number }
}

interface Period {
  id: string
  name: string
  weight: number
  startDate: string
  endDate: string
}

interface GradingConfig {
  cognitivo: number
  procedimental: number
  actitudinal: number
  attitudinalBreakdown: AttitudinalBreakdown
  scale: GradingScale
  minPassingGrade: number
}

interface InstitutionConfig {
  id: string
  name: string
  nit: string
  dane: string
  address: string
  city: string
  phone: string
  email: string
  rector: string
  academicYear: number
}

interface InstitutionContextType {
  institution: InstitutionConfig
  setInstitution: (config: InstitutionConfig) => void
  gradingConfig: GradingConfig
  setGradingConfig: (config: GradingConfig) => void
  periods: Period[]
  setPeriods: (periods: Period[]) => void
  selectedPeriod: string
  setSelectedPeriod: (periodId: string) => void
}

const defaultInstitution: InstitutionConfig = {
  id: '1',
  name: 'Institución Educativa Demo',
  nit: '900123456-7',
  dane: '123456789012',
  address: 'Calle 123 #45-67',
  city: 'Bogotá',
  phone: '601 1234567',
  email: 'contacto@institucion.edu.co',
  rector: 'Dr. Juan Pérez',
  academicYear: 2026,
}

const defaultGradingConfig: GradingConfig = {
  cognitivo: 40,
  procedimental: 40,
  actitudinal: 20,
  attitudinalBreakdown: {
    personal: 5,
    social: 5,
    autoevaluacion: 5,
    coevaluacion: 5,
  },
  scale: {
    superior: { min: 4.5, max: 5.0 },
    alto: { min: 4.0, max: 4.4 },
    basico: { min: 3.0, max: 3.9 },
    bajo: { min: 1.0, max: 2.9 },
  },
  minPassingGrade: 3.0,
}

const defaultPeriods: Period[] = [
  { id: '1', name: 'Período 1', weight: 25, startDate: '2026-01-20', endDate: '2026-04-05' },
  { id: '2', name: 'Período 2', weight: 25, startDate: '2026-04-06', endDate: '2026-06-20' },
  { id: '3', name: 'Período 3', weight: 25, startDate: '2026-07-15', endDate: '2026-09-30' },
  { id: '4', name: 'Período 4', weight: 25, startDate: '2026-10-01', endDate: '2026-11-30' },
]

const InstitutionContext = createContext<InstitutionContextType | undefined>(undefined)

export function InstitutionProvider({ children }: { children: ReactNode }) {
  const [institution, setInstitution] = useState<InstitutionConfig>(defaultInstitution)
  const [gradingConfig, setGradingConfig] = useState<GradingConfig>(defaultGradingConfig)
  const [periods, setPeriods] = useState<Period[]>(defaultPeriods)
  const [selectedPeriod, setSelectedPeriod] = useState<string>('1')

  return (
    <InstitutionContext.Provider
      value={{
        institution,
        setInstitution,
        gradingConfig,
        setGradingConfig,
        periods,
        setPeriods,
        selectedPeriod,
        setSelectedPeriod,
      }}
    >
      {children}
    </InstitutionContext.Provider>
  )
}

export function useInstitution() {
  const context = useContext(InstitutionContext)
  if (context === undefined) {
    throw new Error('useInstitution must be used within an InstitutionProvider')
  }
  return context
}

export type { GradingConfig, Period, InstitutionConfig, AttitudinalBreakdown }
