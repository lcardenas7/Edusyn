import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export interface ValeriaContextPayload {
  institutionName?: string
  pageName?: string
  pageSummary?: string
  currentPath?: string
  gradeName?: string
  subjectName?: string
  topic?: string
  activityType?: 'QUIZ' | 'EXAM' | 'GUIDE' | 'ACHIEVEMENT' | 'GENERAL'
  details?: string
}

export interface ValeriaActivityDraft {
  title: string
  description: string
  type?: string
  maxScore?: string
  allowLateSubmit?: boolean
  shuffleQuestions?: boolean
  showResults?: boolean
  maxAttempts?: string
  timeLimitMinutes?: string
}

export interface ValeriaLaunchOptions {
  title?: string
  subtitle?: string
  prompt?: string
  context?: ValeriaContextPayload
  includeVisuals?: boolean
  visualPlacement?: 'QUESTION_IMAGE' | 'CONTEXT_IMAGE' | 'INLINE'
  onApplyVisual?: (svg: string) => void
  onCreateActivity?: (draft: ValeriaActivityDraft) => void
}

interface ValeriaAssistantContextValue {
  isOpen: boolean
  launchOptions: ValeriaLaunchOptions | null
  openValeria: (options?: ValeriaLaunchOptions) => void
  closeValeria: () => void
}

const ValeriaAssistantContext = createContext<ValeriaAssistantContextValue | undefined>(undefined)

export const valeriaAssistantBridge: {
  open: (options?: ValeriaLaunchOptions) => void
  close: () => void
} = {
  open: () => {},
  close: () => {},
}

export function ValeriaProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [launchOptions, setLaunchOptions] = useState<ValeriaLaunchOptions | null>(null)

  const openValeria = useCallback((options?: ValeriaLaunchOptions) => {
    setLaunchOptions(options || null)
    setIsOpen(true)
  }, [])

  const closeValeria = useCallback(() => {
    setIsOpen(false)
  }, [])

  useEffect(() => {
    valeriaAssistantBridge.open = openValeria
    valeriaAssistantBridge.close = closeValeria

    return () => {
      valeriaAssistantBridge.open = () => {}
      valeriaAssistantBridge.close = () => {}
    }
  }, [openValeria, closeValeria])

  const value = useMemo(() => ({
    isOpen,
    launchOptions,
    openValeria,
    closeValeria,
  }), [isOpen, launchOptions])

  return (
    <ValeriaAssistantContext.Provider value={value}>
      {children}
    </ValeriaAssistantContext.Provider>
  )
}

export function useValeriaAssistant() {
  const context = useContext(ValeriaAssistantContext)
  if (!context) {
    throw new Error('useValeriaAssistant must be used within a ValeriaProvider')
  }
  return context
}
