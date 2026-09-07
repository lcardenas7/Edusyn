import axios from 'axios'

// Detectar si estamos en producción por el hostname (staging excluido)
const hostname = typeof window !== 'undefined' ? window.location.hostname : ''
const isStaging = hostname.includes('staging')
const isProduction = !isStaging &&
  (hostname.includes('railway.app') || hostname.includes('edusyn.co'))
export const API_BASE_URL = isProduction
  ? 'https://api.edusyn.co/api'
  : (import.meta.env.VITE_API_URL || '/api')

console.log('[API] Base URL:', API_BASE_URL, '| Production:', isProduction)

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Enabled only while a SuperAdmin is inside Academic Reports. It is limited
// to the screen's read endpoints and never affects writes or other pages.
let reportTenantInstitutionId: string | undefined

// Anchored to a whole first segment: a merely similar prefix such as
// /reports-legacy or /institution-config-extra must never inherit the target.
const REPORT_TENANT_READ_SEGMENT =
  /^\/(reports|academic-terms|groups|subjects|teacher-assignments|institution-config)(?=[/?]|$)/

export const isReportTenantReadPath = (url?: string): boolean =>
  typeof url === 'string' && REPORT_TENANT_READ_SEGMENT.test(url)

export const setReportTenantContext = (institutionId?: string) => {
  reportTenantInstitutionId = institutionId
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  const isRead = !config.method || config.method.toLowerCase() === 'get'
  if (reportTenantInstitutionId && isRead && isReportTenantReadPath(config.url)) {
    // An institutionId supplied by the caller always wins: the temporary
    // Reports target only fills the gap when the caller named none.
    config.params = {
      ...config.params,
      institutionId: config.params?.institutionId ?? reportTenantInstitutionId,
    }
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api

// Auth

// Alias con nombre: permite importar el cliente sin arrastrar la fachada.
export { api }
