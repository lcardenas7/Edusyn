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
    config.headers['X-Guest-Token'] = token
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
  googleLogin: (idToken: string) =>
    playAxios.post('/auth/google-play', { idToken }),
}

// ═══════════════════════════════════════════════════════════════════════════
// PLAY PANEL - Dashboard, quizzes, lecciones, sesiones del docente
// ═══════════════════════════════════════════════════════════════════════════
export const playPanelApi = {
  dashboard: () => playAxios.get('/play/dashboard'),
  // Quizzes
  listQuizzes: () => playAxios.get('/play/quizzes'),
  createQuiz: (data: { title: string; description?: string; type?: string }) =>
    playAxios.post('/play/quizzes', data),
  updateQuiz: (id: string, data: { title?: string; description?: string }) => playAxios.patch(`/play/quizzes/${id}`, data),
  reorderQuestions: (id: string, order: string[]) => playAxios.patch(`/play/quizzes/${id}/questions/reorder`, { order }),
  deleteQuiz: (id: string) => playAxios.delete(`/play/quizzes/${id}`),
  duplicateQuiz: (id: string) => playAxios.post(`/play/quizzes/${id}/duplicate`),
  // R11: historial del jugador (sesiones donde participó como guest vinculado)
  playerHistory: () => playAxios.get('/play/me/history'),
  claimGuestSession: (guestToken: string) =>
    playAxios.post('/play/me/claim-guest', { guestToken }),
  aiStatus: () => playAxios.get('/play/ai/status'),
  aiGenerateQuestions: (id: string, data: {
    topic: string;
    count?: number;
    gradeName?: string;
    subjectName?: string;
    types?: Array<'MULTIPLE_CHOICE' | 'TRUE_FALSE'>;
    pointsPerQuestion?: number;
    timeLimitSeconds?: number;
  }) => playAxios.post(`/play/quizzes/${id}/ai-generate`, data),
  // Questions
  listQuestions: (activityId: string) => playAxios.get(`/play/quizzes/${activityId}/questions`),
  addQuestion: (activityId: string, data: {
    type: string; text: string; options?: any; correctAnswer?: string;
    points?: number; explanation?: string; imageUrl?: string; timeLimitSeconds?: number;
  }) => playAxios.post(`/play/quizzes/${activityId}/questions`, data),
  updateQuestion: (questionId: string, data: {
    type?: string; text?: string; options?: any; correctAnswer?: string;
    points?: number; explanation?: string; imageUrl?: string; timeLimitSeconds?: number;
  }) => playAxios.put(`/play/questions/${questionId}`, data),
  deleteQuestion: (questionId: string) => playAxios.delete(`/play/questions/${questionId}`),
  // Lessons
  listLessons: () => playAxios.get('/play/lessons'),
  getLesson: (id: string) => playAxios.get(`/play/lessons/${id}`),
  createLesson: (data: { title: string; description?: string }) =>
    playAxios.post('/play/lessons', data),
  createLessonSlide: (id: string, data: {
    type: 'CONTENT' | 'ACTIVITY' | 'CHECKPOINT' | 'BADGE_REVEAL';
    title?: string;
    body?: string;
    imageUrl?: string;
    videoUrl?: string;
    audioUrl?: string;
    layout?: string;
    activityData?: any;
    badgeEmoji?: string;
    badgeTitle?: string;
  }) => playAxios.post(`/play/lessons/${id}/slides`, data),
  updateLessonSlide: (id: string, slideId: string, data: {
    type?: 'CONTENT' | 'ACTIVITY' | 'CHECKPOINT' | 'BADGE_REVEAL';
    title?: string | null;
    body?: string | null;
    imageUrl?: string | null;
    videoUrl?: string | null;
    audioUrl?: string | null;
    layout?: string | null;
    activityData?: any;
    badgeEmoji?: string | null;
    badgeTitle?: string | null;
  }) => playAxios.put(`/play/lessons/${id}/slides/${slideId}`, data),
  deleteLessonSlide: (id: string, slideId: string) => playAxios.delete(`/play/lessons/${id}/slides/${slideId}`),
  reorderLessonSlides: (id: string, order: string[]) => playAxios.patch(`/play/lessons/${id}/slides/reorder`, { order }),
  deleteLesson: (id: string) => playAxios.delete(`/play/lessons/${id}`),
  // Live Quiz Session
  createLiveQuiz: (activityId: string) => playAxios.post(`/play/quizzes/${activityId}/live`),
  getLiveQuizStatus: (sessionId: string) => playAxios.get(`/play/live/${sessionId}`),
  startLiveQuiz: (sessionId: string) => playAxios.post(`/play/live/${sessionId}/start`),
  nextQuestionLive: (sessionId: string) => playAxios.post(`/play/live/${sessionId}/next`),
  closeQuestion: (sessionId: string) => playAxios.post(`/play/live/${sessionId}/close-question`),
  finishLiveQuiz: (sessionId: string) => playAxios.post(`/play/live/${sessionId}/finish`),
  finishAllPending: () => playAxios.post('/play/live/finish-pending'),
  pauseSession: (sessionId: string) => playAxios.post(`/play/live/${sessionId}/pause`),
  resumeSession: (sessionId: string) => playAxios.post(`/play/live/${sessionId}/resume`),
  replaySession: (sessionId: string, opts?: { shuffle?: boolean; keepGuests?: boolean }) =>
    playAxios.post(`/play/live/${sessionId}/replay`, opts ?? {}),
  getQuestionStats: (sessionId: string) => playAxios.get(`/play/live/${sessionId}/question-stats`),
  exportSessionCsv: (sessionId: string) => playAxios.get(`/play/live/${sessionId}/export-csv`, { responseType: 'text' }),
  // Sessions
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
  join: (code: string, data: { nickname: string; avatarEmoji?: string; fingerprint?: string }) => {
    // R11: si hay un Play user logueado, enviamos su token para vincular el guest a su cuenta.
    const playToken = typeof window !== 'undefined' ? localStorage.getItem('play_token') : null
    const headers: Record<string, string> = {}
    if (playToken) headers['Authorization'] = `Bearer ${playToken}`
    return guestAxios.post(`/public/join/${code}`, data, { headers })
  },
  getSessionStatus: (sessionId: string) => guestAxios.get(`/public/session/${sessionId}/status`),
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
