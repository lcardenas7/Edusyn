import { toast as sonnerToast } from 'sonner'

// ─────────────────────────────────────────────────────────────────────────────
// MAPPER: errores de backend → mensajes humanos
// ─────────────────────────────────────────────────────────────────────────────
const ERROR_MAP: Record<string, string> = {
  // Prisma constraint errors
  'P2002': 'Ya existe un registro con esos datos. Verifica que el correo o documento no esté duplicado.',
  'P2025': 'No se encontró el registro que intentas modificar.',
  'P2003': 'No se puede eliminar: otro registro depende de este.',
  'P2014': 'La relación entre registros no es válida.',
  // Auth
  'Unauthorized': 'Tu sesión expiró. Por favor ingresa de nuevo.',
  'Invalid credentials': 'Correo o contraseña incorrectos.',
  'User not found': 'No se encontró un usuario con ese correo.',
  // Network
  'Network Error': 'Sin conexión. Verifica tu internet e inténtalo de nuevo.',
  'timeout': 'La solicitud tardó demasiado. Inténtalo de nuevo.',
  // Validation
  'must be a valid email': 'El correo electrónico no es válido.',
  'must not be empty': 'Hay campos requeridos vacíos.',
  'must be a number': 'El valor debe ser numérico.',
}

export function parseApiError(error: any): string {
  // 1. Mensaje explícito del backend
  const backendMsg: string | undefined =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message

  if (backendMsg) {
    // Buscar coincidencia en el mapa
    for (const [key, human] of Object.entries(ERROR_MAP)) {
      if (backendMsg.includes(key)) return human
    }
    // Ocultar mensajes técnicos de Prisma
    if (backendMsg.startsWith('P2') || backendMsg.includes('prisma')) {
      return 'Ocurrió un error interno. Por favor inténtalo de nuevo.'
    }
    return backendMsg
  }

  // 2. Status HTTP
  const status: number | undefined = error?.response?.status
  if (status === 401) return 'Tu sesión expiró. Por favor ingresa de nuevo.'
  if (status === 403) return 'No tienes permiso para realizar esta acción.'
  if (status === 404) return 'No se encontró el recurso solicitado.'
  if (status === 409) return 'Ya existe un registro con esos datos.'
  if (status === 422) return 'Los datos enviados no son válidos.'
  if (status && status >= 500) return 'Error en el servidor. Intenta en unos momentos.'

  // 3. Errores de red
  if (error?.code === 'ERR_NETWORK' || error?.message === 'Network Error') {
    return 'Sin conexión a internet. Verifica tu red e inténtalo de nuevo.'
  }
  if (error?.code === 'ECONNABORTED') {
    return 'La solicitud tardó demasiado. Inténtalo de nuevo.'
  }

  return 'Ocurrió un error inesperado. Por favor inténtalo de nuevo.'
}

// ─────────────────────────────────────────────────────────────────────────────
// API PÚBLICA — úsala en lugar de alert() o setState de mensajes
// ─────────────────────────────────────────────────────────────────────────────
export const toast = {
  /** Operación exitosa: notas guardadas, asistencia registrada, etc. */
  success: (title: string, description?: string) =>
    sonnerToast.success(title, { description }),

  /** Error de API o validación — acepta el objeto error directamente */
  error: (titleOrError: string | any, description?: string) => {
    if (typeof titleOrError === 'string') {
      sonnerToast.error(titleOrError, { description })
    } else {
      const msg = parseApiError(titleOrError)
      sonnerToast.error(msg)
    }
  },

  /** Advertencia: datos incompletos, campos faltantes */
  warning: (title: string, description?: string) =>
    sonnerToast.warning(title, { description }),

  /** Información neutral */
  info: (title: string, description?: string) =>
    sonnerToast.info(title, { description }),

  /** Operación en curso: útil para procesos largos */
  loading: (title: string) => sonnerToast.loading(title),

  /** Cierra un toast por su ID */
  dismiss: (id?: string | number) => sonnerToast.dismiss(id),

  /** Promesa con estados loading / success / error automáticos */
  promise: <T>(
    promise: Promise<T>,
    msgs: { loading: string; success: string; error?: string },
  ) =>
    sonnerToast.promise(promise, {
      loading: msgs.loading,
      success: msgs.success,
      error: (err) => msgs.error ?? parseApiError(err),
    }),
}

// ─────────────────────────────────────────────────────────────────────────────
// MENSAJES PREDEFINIDOS — reutilizables en toda la app
// ─────────────────────────────────────────────────────────────────────────────
export const TOAST = {
  attendance: {
    saved: (count: number, groupName?: string) =>
      toast.success(
        'Asistencia registrada correctamente',
        groupName ? `${count} estudiantes · ${groupName}` : `${count} estudiantes`,
      ),
    error: (err: any) => toast.error(err),
  },
  grades: {
    saved: (subject?: string, group?: string) =>
      toast.success(
        'Calificaciones guardadas',
        [subject, group].filter(Boolean).join(' · '),
      ),
    partial: (saved: number, total: number) =>
      toast.warning(
        `Se guardaron ${saved} de ${total} calificaciones`,
        'Revisa los registros con error e inténtalo de nuevo.',
      ),
    error: (err: any) => toast.error(err),
  },
  import: {
    success: (entity: string, count: number) =>
      toast.success(`${count} ${entity} importados correctamente`),
    partial: (entity: string, ok: number, errors: number) =>
      toast.warning(
        `${ok} ${entity} importados · ${errors} con error`,
        'Descarga el reporte para ver los detalles.',
      ),
    error: (err: any) => toast.error(err),
  },
  template: {
    downloading: () => toast.loading('Generando plantilla…'),
    ready: () => toast.success('Plantilla descargada correctamente'),
    error: (err: any) => toast.error(err),
  },
  save: {
    generic: () => toast.success('Cambios guardados correctamente'),
    error: (err: any) => toast.error(err),
  },
  delete: {
    success: (entity: string) => toast.success(`${entity} eliminado correctamente`),
    error: (err: any) => toast.error(err),
  },
}
