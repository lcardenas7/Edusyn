import axios from 'axios'

// Detectar si estamos en producción por el hostname
const isProduction = typeof window !== 'undefined' && 
  (window.location.hostname.includes('railway.app') || window.location.hostname.includes('edusyn.co'))
const API_BASE_URL = isProduction 
  ? 'https://api.edusyn.co/api'
  : (import.meta.env.VITE_API_URL || '/api')

// ─── Axios instance con token de Play ───────────────────────────────────────
const playAxios = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

playAxios.interceptors.request.use((config) => {
  const token = localStorage.getItem('play_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

playAxios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('play_token')
      localStorage.removeItem('play_user')
      window.location.href = '/login-play'
    }
    return Promise.reject(error)
  }
)

// ─── Axios instance para invitados (guest token) ────────────────────────────
const guestAxios = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

guestAxios.interceptors.request.use((config) => {
  const token = localStorage.getItem('guest_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ═══════════════════════════════════════════════════════════════════════════
// AUTH PLAY - Registro y login de docentes personales
// ═══════════════════════════════════════════════════════════════════════════
export const authPlayApi = {
  register: (data: { email: string; password: string; firstName: string; lastName: string }) =>
    playAxios.post('/auth/register-play', data),
  login: (data: { email: string; password: string }) =>
    playAxios.post('/auth/login-play', data),
}

// ═══════════════════════════════════════════════════════════════════════════
// PLAY PANEL - Dashboard, quizzes, lecciones, sesiones del docente
// ═══════════════════════════════════════════════════════════════════════════
export const playPanelApi = {
  dashboard: () => playAxios.get('/play/dashboard'),
  listQuizzes: () => playAxios.get('/play/quizzes'),
  listLessons: () => playAxios.get('/play/lessons'),
  listSessions: () => playAxios.get('/play/sessions'),
}

// ═══════════════════════════════════════════════════════════════════════════
// LIVE LESSON SESSION - Crear, iniciar, avanzar, pausar, finalizar
// ═══════════════════════════════════════════════════════════════════════════
export const liveLessonApi = {
  create: (data: { lessonId: string; guestMode?: string }) =>
    playAxios.post('/live-lesson-session', data),
  start: (id: string) => playAxios.post(`/live-lesson-session/${id}/start`),
  advance: (id: string, currentSlideIndex: number) =>
    playAxios.patch(`/live-lesson-session/${id}/advance`, { currentSlideIndex }),
  pause: (id: string) => playAxios.post(`/live-lesson-session/${id}/pause`),
  resume: (id: string) => playAxios.post(`/live-lesson-session/${id}/resume`),
  finish: (id: string) => playAxios.post(`/live-lesson-session/${id}/finish`),
  reactionStats: (id: string) => playAxios.get(`/live-lesson-session/${id}/reaction-stats`),
  publicStatus: (id: string) => guestAxios.get(`/public/lesson-session/${id}/status`),
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVERSION - Convertir resultados de invitados a notas
// ═══════════════════════════════════════════════════════════════════════════
export const conversionApi = {
  compute: (sessionId: string, data?: { scaleMin?: number; scaleMax?: number }) =>
    playAxios.post(`/live-session/${sessionId}/compute-grades`, data || {}),
  save: (sessionId: string, data?: { scaleMin?: number; scaleMax?: number }) =>
    playAxios.post(`/live-session/${sessionId}/convert-grades`, data || {}),
  exportCsv: (sessionId: string) =>
    playAxios.get(`/live-session/${sessionId}/export.csv`, { responseType: 'blob' }),
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC / GUEST - Endpoints públicos para invitados
// ═══════════════════════════════════════════════════════════════════════════
export const guestApi = {
  lookup: (code: string) => guestAxios.get(`/public/join/${code}`),
  join: (code: string, data: { nickname: string; avatarEmoji?: string; fingerprint?: string }) =>
    guestAxios.post(`/public/join/${code}`, data),
  ranking: (sessionId: string) => guestAxios.get(`/public/session/${sessionId}/ranking`),
  submitAnswer: (sessionId: string, data: {
    questionId?: string;
    slideId?: string;
    selectedOption?: string;
    answerText?: string;
    timeTakenMs?: number;
  }) => guestAxios.post(`/public/session/${sessionId}/answer`, data),
  submitReaction: (sessionId: string, data: { emoji: string; slideIndex?: number }) =>
    guestAxios.post(`/public/session/${sessionId}/reaction`, data),
}
