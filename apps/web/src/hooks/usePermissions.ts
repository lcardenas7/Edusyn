import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'

interface PermissionCheck {
  hasPermission: boolean
  source: 'SUPERADMIN' | 'ROLE' | 'EXTRA' | 'DENIED'
  expiresAt?: string | null
}

interface UserPermissions {
  rolePermissions: string[]
  extraPermissions: Array<{
    code: string
    expiresAt: string | null
    reason: string
  }>
  allPermissions: string[]
}

interface PermissionCatalog {
  [module: string]: {
    [func: string]: Array<{
      code: string
      name: string
      description: string
      subFunction: string
    }>
  }
}

export function usePermissions() {
  const { user } = useAuth()
  const [permissions, setPermissions] = useState<UserPermissions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Cargar permisos del usuario al iniciar
  useEffect(() => {
    if (!user) {
      setPermissions(null)
      setLoading(false)
      return
    }

    const fetchPermissions = async () => {
      try {
        setLoading(true)
        const response = await api.get('/permissions/my-permissions')
        setPermissions(response.data)
        setError(null)
      } catch (err: any) {
        console.error('Error fetching permissions:', err)
        setError(err.message)
        // Si falla, usar permisos vacíos
        setPermissions({
          rolePermissions: [],
          extraPermissions: [],
          allPermissions: []
        })
      } finally {
        setLoading(false)
      }
    }

    fetchPermissions()
  }, [user])

  /**
   * Verifica si el usuario tiene un permiso específico
   * Usa cache local para evitar llamadas al servidor
   */
  const can = useCallback((permissionCode: string): boolean => {
    // SuperAdmin tiene acceso total (verificar por rol)
    const isSuperAdmin = user?.roles?.some(r => r.role?.name === 'SUPERADMIN')
    if (isSuperAdmin) return true
    
    // Verificar en permisos cargados
    if (!permissions) return false
    
    return permissions.allPermissions.includes(permissionCode)
  }, [user, permissions])

  /**
   * Verifica si el usuario tiene ALGUNO de los permisos especificados
   */
  const canAny = useCallback((permissionCodes: string[]): boolean => {
    return permissionCodes.some(code => can(code))
  }, [can])

  /**
   * Verifica si el usuario tiene TODOS los permisos especificados
   */
  const canAll = useCallback((permissionCodes: string[]): boolean => {
    return permissionCodes.every(code => can(code))
  }, [can])

  /**
   * Verifica un permiso contra el servidor (para casos críticos)
   */
  const checkPermission = useCallback(async (permissionCode: string): Promise<PermissionCheck> => {
    try {
      const response = await api.get(`/permissions/check/${permissionCode}`)
      return response.data
    } catch (err) {
      return { hasPermission: false, source: 'DENIED' }
    }
  }, [])

  /**
   * Obtiene el catálogo completo de permisos
   */
  const getCatalog = useCallback(async (): Promise<PermissionCatalog> => {
    const response = await api.get('/permissions/catalog')
    return response.data
  }, [])

  /**
   * Obtiene los permisos de un usuario específico
   */
  const getUserPermissions = useCallback(async (userId: string): Promise<UserPermissions> => {
    const response = await api.get(`/permissions/users/${userId}`)
    return response.data
  }, [])

  /**
   * Otorga un permiso extra a un usuario
   */
  const grantPermission = useCallback(async (data: {
    userId: string
    permissionCode: string
    reason: string
    validFrom?: string
    validTo?: string
  }): Promise<void> => {
    await api.post('/permissions/grant', data)
  }, [])

  /**
   * Revoca un permiso extra de un usuario
   */
  const revokePermission = useCallback(async (data: {
    userId: string
    permissionCode: string
    reason: string
  }): Promise<void> => {
    await api.delete('/permissions/revoke', { data })
  }, [])

  /**
   * Obtiene el historial de auditoría
   */
  const getAuditLog = useCallback(async (options?: {
    userId?: string
    action?: string
    fromDate?: string
    toDate?: string
    limit?: number
  }): Promise<any[]> => {
    const params = new URLSearchParams()
    if (options?.userId) params.append('userId', options.userId)
    if (options?.action) params.append('action', options.action)
    if (options?.fromDate) params.append('fromDate', options.fromDate)
    if (options?.toDate) params.append('toDate', options.toDate)
    if (options?.limit) params.append('limit', options.limit.toString())
    
    const response = await api.get(`/permissions/audit?${params.toString()}`)
    return response.data
  }, [])

  /**
   * Refresca los permisos del usuario actual
   */
  const refreshPermissions = useCallback(async () => {
    if (!user) return
    
    try {
      const response = await api.get('/permissions/my-permissions')
      setPermissions(response.data)
    } catch (err) {
      console.error('Error refreshing permissions:', err)
    }
  }, [user])

  return {
    // Estado
    permissions,
    loading,
    error,
    
    // Verificación de permisos
    can,
    canAny,
    canAll,
    checkPermission,
    
    // Gestión de permisos (para admins)
    getCatalog,
    getUserPermissions,
    grantPermission,
    revokePermission,
    getAuditLog,
    
    // Utilidades
    refreshPermissions,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES DE PERMISOS (para autocompletado y referencia)
// ═══════════════════════════════════════════════════════════════════════════

export const PERMISSIONS = {
  // Configuración Institucional
  CONFIG_INFO_VIEW: 'CONFIG_INFO_VIEW',
  CONFIG_INFO_EDIT: 'CONFIG_INFO_EDIT',
  CONFIG_GRADING_VIEW: 'CONFIG_GRADING_VIEW',
  CONFIG_GRADING_EDIT_SCALE: 'CONFIG_GRADING_EDIT_SCALE',
  CONFIG_GRADING_EDIT_LEVELS: 'CONFIG_GRADING_EDIT_LEVELS',
  CONFIG_GRADING_EDIT_WEIGHTS: 'CONFIG_GRADING_EDIT_WEIGHTS',
  CONFIG_PERIODS_VIEW: 'CONFIG_PERIODS_VIEW',
  CONFIG_PERIODS_EDIT: 'CONFIG_PERIODS_EDIT',
  CONFIG_PERIODS_TOGGLE: 'CONFIG_PERIODS_TOGGLE',
  CONFIG_GRADE_WINDOWS_VIEW: 'CONFIG_GRADE_WINDOWS_VIEW',
  CONFIG_GRADE_WINDOWS_DATES: 'CONFIG_GRADE_WINDOWS_DATES',
  CONFIG_GRADE_WINDOWS_RULES: 'CONFIG_GRADE_WINDOWS_RULES',
  CONFIG_RECOVERY_VIEW: 'CONFIG_RECOVERY_VIEW',
  CONFIG_RECOVERY_DATES: 'CONFIG_RECOVERY_DATES',
  CONFIG_RECOVERY_RULES: 'CONFIG_RECOVERY_RULES',
  CONFIG_AREAS_VIEW: 'CONFIG_AREAS_VIEW',
  CONFIG_AREAS_EDIT: 'CONFIG_AREAS_EDIT',
  CONFIG_AREAS_GLOBAL: 'CONFIG_AREAS_GLOBAL',
  CONFIG_GRADES_VIEW: 'CONFIG_GRADES_VIEW',
  CONFIG_GRADES_EDIT: 'CONFIG_GRADES_EDIT',
  
  // Usuarios
  USERS_LIST_VIEW: 'USERS_LIST_VIEW',
  USERS_CREATE: 'USERS_CREATE',
  USERS_EDIT: 'USERS_EDIT',
  USERS_ASSIGN_ROLES: 'USERS_ASSIGN_ROLES',
  USERS_ASSIGN_PERMISSIONS: 'USERS_ASSIGN_PERMISSIONS',
  STUDENTS_LIST_VIEW: 'STUDENTS_LIST_VIEW',
  STUDENTS_VIEW_ALL: 'STUDENTS_VIEW_ALL',
  STUDENTS_VIEW_OWN: 'STUDENTS_VIEW_OWN',
  STUDENTS_CREATE: 'STUDENTS_CREATE',
  STUDENTS_EDIT: 'STUDENTS_EDIT',
  STUDENTS_ENROLL: 'STUDENTS_ENROLL',
  GUARDIANS_VIEW: 'GUARDIANS_VIEW',
  GUARDIANS_EDIT: 'GUARDIANS_EDIT',
  
  // Académico
  ACADEMIC_LOAD_VIEW_ALL: 'ACADEMIC_LOAD_VIEW_ALL',
  ACADEMIC_LOAD_VIEW_OWN: 'ACADEMIC_LOAD_VIEW_OWN',
  ACADEMIC_LOAD_ASSIGN: 'ACADEMIC_LOAD_ASSIGN',
  GRADES_VIEW_ALL: 'GRADES_VIEW_ALL',
  GRADES_VIEW_OWN: 'GRADES_VIEW_OWN',
  GRADES_ENTER: 'GRADES_ENTER',
  GRADES_EDIT_OVERRIDE: 'GRADES_EDIT_OVERRIDE',
  GRADES_APPROVE_ADJUSTMENTS: 'GRADES_APPROVE_ADJUSTMENTS',
  RECOVERY_VIEW_ALL: 'RECOVERY_VIEW_ALL',
  RECOVERY_MANAGE_OWN: 'RECOVERY_MANAGE_OWN',
  RECOVERY_APPROVE: 'RECOVERY_APPROVE',
  
  // Seguimiento
  OBSERVER_VIEW_ALL: 'OBSERVER_VIEW_ALL',
  OBSERVER_VIEW_OWN: 'OBSERVER_VIEW_OWN',
  OBSERVER_CREATE: 'OBSERVER_CREATE',
  OBSERVER_EDIT: 'OBSERVER_EDIT',
  ATTENDANCE_VIEW_ALL: 'ATTENDANCE_VIEW_ALL',
  ATTENDANCE_REGISTER: 'ATTENDANCE_REGISTER',
  ATTENDANCE_EDIT_HISTORY: 'ATTENDANCE_EDIT_HISTORY',
  
  // Reportes
  RPT_ADMIN_VIEW: 'RPT_ADMIN_VIEW',
  RPT_ACADEMIC_VIEW_ALL: 'RPT_ACADEMIC_VIEW_ALL',
  RPT_ACADEMIC_VIEW_OWN: 'RPT_ACADEMIC_VIEW_OWN',
  RPT_BULLETINS_GENERATE: 'RPT_BULLETINS_GENERATE',
  RPT_BULLETINS_VIEW: 'RPT_BULLETINS_VIEW',
  RPT_STATS_INSTITUTIONAL: 'RPT_STATS_INSTITUTIONAL',
  RPT_EXPORT: 'RPT_EXPORT',
  
  // Comunicaciones
  COMM_MESSAGES_VIEW: 'COMM_MESSAGES_VIEW',
  COMM_MESSAGES_SEND: 'COMM_MESSAGES_SEND',
  COMM_ANNOUNCEMENTS_VIEW: 'COMM_ANNOUNCEMENTS_VIEW',
  COMM_ANNOUNCEMENTS_CREATE: 'COMM_ANNOUNCEMENTS_CREATE',
} as const

export type PermissionCode = keyof typeof PERMISSIONS
