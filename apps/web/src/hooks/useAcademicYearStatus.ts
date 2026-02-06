import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { academicYearLifecycleApi } from '../lib/api'

export type YearStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED' | null

interface AcademicYearStatusResult {
  yearStatus: YearStatus
  loading: boolean
  isEditable: boolean
  isReadOnly: boolean
  statusLabel: string
  statusMessage: string
}

export function useAcademicYearStatus(): AcademicYearStatusResult {
  const { institution } = useAuth()
  const [yearStatus, setYearStatus] = useState<YearStatus>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStatus = async () => {
      if (!institution?.id) {
        setLoading(false)
        return
      }
      try {
        const response = await academicYearLifecycleApi.getCurrent(institution.id)
        if (response.data) {
          setYearStatus(response.data.status as YearStatus)
        }
      } catch {
        // No active year found — editable by default
        setYearStatus(null)
      } finally {
        setLoading(false)
      }
    }
    loadStatus()
  }, [institution?.id])

  const isEditable = yearStatus === null || yearStatus === 'DRAFT'
  const isReadOnly = yearStatus === 'CLOSED'

  const statusLabel = 
    yearStatus === 'DRAFT' ? 'Borrador' :
    yearStatus === 'ACTIVE' ? 'Activo' :
    yearStatus === 'CLOSED' ? 'Cerrado' : ''

  const statusMessage = 
    yearStatus === 'DRAFT' ? 'Toda la configuración es editable. Active el año cuando esté listo.' :
    yearStatus === 'ACTIVE' ? 'Algunos cambios están restringidos para proteger datos existentes.' :
    yearStatus === 'CLOSED' ? 'El año está cerrado. Solo lectura.' : ''

  return {
    yearStatus,
    loading,
    isEditable,
    isReadOnly,
    statusLabel,
    statusMessage,
  }
}
