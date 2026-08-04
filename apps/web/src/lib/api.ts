import axios from 'axios'

// Detectar si estamos en producción por el hostname (staging excluido)
const hostname = typeof window !== 'undefined' ? window.location.hostname : ''
const isStaging = hostname.includes('staging')
const isProduction = !isStaging &&
  (hostname.includes('railway.app') || hostname.includes('edusyn.co'))
const API_BASE_URL = isProduction
  ? 'https://api.edusyn.co/api'
  : (import.meta.env.VITE_API_URL || '/api')

console.log('[API] Base URL:', API_BASE_URL, '| Production:', isProduction)

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
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
export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (data: { email: string; password: string; firstName: string; lastName: string }) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) => api.post('/auth/change-password', { currentPassword, newPassword }),
}

// Institutions
export const institutionsApi = {
  getAll: () => api.get('/institutions'),
  getById: (id: string) => api.get(`/institutions/${id}`),
  create: (data: { name: string; daneCode?: string; nit?: string }) => api.post('/institutions', data),
  getSetupStatus: () => api.get('/institutions/setup-status'),
}

// Institution Config (configuración completa institucional)
export const institutionConfigApi = {
  getFullConfig: () => api.get('/institution-config'),
  getGradingConfig: () => api.get('/institution-config/grading'),
  getAcademicLevels: () => api.get('/institution-config/academic-levels'),
  getRulesContext: () => api.get('/institution-config/rules-context'),
}

// Institution Profile (identidad institucional - para admin institucional)
export const institutionProfileApi = {
  get: () => api.get('/institution-config/profile'),
  update: (data: { name?: string; nit?: string; daneCode?: string; city?: string; address?: string; phone?: string; email?: string; website?: string; logo?: string; primaryColor?: string }) =>
    api.put('/institution-config/profile', data),
}

// Campuses (Sedes)
export const campusesApi = {
  getAll: (institutionId?: string) => api.get('/campuses', { params: { institutionId } }),
  create: (data: { institutionId: string; name: string; address?: string }) => api.post('/campuses', data),
}

// Shifts (Jornadas)
export const shiftsApi = {
  getAll: (campusId?: string) => api.get('/shifts', { params: { campusId } }),
  create: (data: { campusId: string; type: string; name: string }) => api.post('/shifts', data),
  update: (id: string, data: { name?: string; type?: string }) => api.patch(`/shifts/${id}`, data),
  delete: (id: string) => api.delete(`/shifts/${id}`),
}

// Grades (Grados)
export const gradesConfigApi = {
  getAll: () => api.get('/grades'),
  create: (data: { stage: string; number?: number; name: string }) => api.post('/grades', data),
}

// Groups (Grupos)
export const groupsApi = {
  getAll: (params?: { campusId?: string; shiftId?: string; gradeId?: string; institutionId?: string }) => api.get('/groups', { params }),
  create: (data: { campusId: string; shiftId: string; gradeId: string; name: string; code?: string; maxCapacity?: number }) => api.post('/groups', data),
  update: (id: string, data: { directorId?: string | null; maxCapacity?: number; name?: string; shiftId?: string }) => api.patch(`/groups/${id}`, data),
  delete: (id: string) => api.delete(`/groups/${id}`),
}

// Areas (Catálogo Académico)
export const areasApi = {
  getAll: (institutionId?: string, includeInactive?: boolean) => 
    api.get('/areas', { params: { institutionId, includeInactive } }),
  getById: (id: string) => api.get(`/areas/${id}`),
  create: (data: { institutionId: string; name: string; code?: string; description?: string; order?: number }) => 
    api.post('/areas', data),
  update: (id: string, data: { name?: string; code?: string; description?: string; order?: number; isActive?: boolean }) => 
    api.put(`/areas/${id}`, data),
  delete: (id: string) => api.delete(`/areas/${id}`),
  
  // Asignaturas
  getSubjects: (areaId: string, includeInactive?: boolean) => 
    api.get(`/areas/${areaId}/subjects`, { params: { includeInactive } }),
  getAllSubjects: (institutionId: string, includeInactive?: boolean) => 
    api.get('/areas/subjects/all', { params: { institutionId, includeInactive } }),
  getSubject: (subjectId: string) => api.get(`/areas/subjects/${subjectId}`),
  addSubject: (areaId: string, data: { name: string; code?: string; description?: string; subjectType?: string; order?: number }) => 
    api.post(`/areas/${areaId}/subjects`, data),
  updateSubject: (subjectId: string, data: { name?: string; code?: string; description?: string; subjectType?: string; order?: number; isActive?: boolean }) => 
    api.put(`/areas/subjects/${subjectId}`, data),
  deleteSubject: (subjectId: string) => api.delete(`/areas/subjects/${subjectId}`),
  moveSubject: (subjectId: string, newAreaId: string) => api.put(`/areas/subjects/${subjectId}/move`, { newAreaId }),
}

// Subjects
export const subjectsApi = {
  getAll: (areaId?: string) => api.get('/subjects', { params: { areaId } }),
  create: (data: { areaId: string; name: string; weeklyHours?: number }) => api.post('/subjects', data),
}

// Guardians (Acudientes)
export const guardiansApi = {
  getAll: (params?: { institutionId?: string; search?: string }) => api.get('/guardians', { params }),
  getById: (id: string) => api.get(`/guardians/${id}`),
  getByStudent: (studentId: string) => api.get(`/guardians/student/${studentId}`),
  create: (data: any) => api.post('/guardians', data),
  createWithLink: (data: any) => api.post('/guardians/with-link', data),
  update: (id: string, data: any) => api.put(`/guardians/${id}`, data),
  delete: (id: string) => api.delete(`/guardians/${id}`),
  linkToStudent: (data: { studentId: string; guardianId: string; relationship: string; isPrimary?: boolean; canPickUp?: boolean; isEmergencyContact?: boolean }) => api.post('/guardians/link', data),
  unlinkFromStudent: (studentId: string, guardianId: string) => api.delete(`/guardians/link/${studentId}/${guardianId}`),
  updateLink: (studentId: string, guardianId: string, data: any) => api.put(`/guardians/link/${studentId}/${guardianId}`, data),
}

// Academic Years
export const academicYearsApi = {
  getAll: (institutionId?: string) => api.get('/academic-terms/years', { params: { institutionId } }),
  create: (data: { institutionId: string; year: number; startDate?: string; endDate?: string }) => api.post('/academic-terms/years', data),
}

// Academic Year Lifecycle Management
export const academicYearLifecycleApi = {
  // CRUD básico
  create: (data: { institutionId: string; year: number; name?: string; startDate?: string; endDate?: string }) => api.post('/academic-years', data),
  getByInstitution: (institutionId: string) => api.get(`/academic-years/institution/${institutionId}`),
  getCurrent: (institutionId: string) => api.get(`/academic-years/institution/${institutionId}/current`),
  getById: (yearId: string) => api.get(`/academic-years/${yearId}`),
  update: (yearId: string, data: { name?: string; startDate?: string; endDate?: string }) => api.put(`/academic-years/${yearId}`, data),
  delete: (yearId: string) => api.delete(`/academic-years/${yearId}`),
  
  // Ciclo de vida
  activate: (yearId: string) => api.post(`/academic-years/${yearId}/activate`),
  close: (yearId: string, data: { calculatePromotions?: boolean }) => api.post(`/academic-years/${yearId}/close`, data),
  
  // Validaciones
  validateActivation: (yearId: string) => api.get(`/academic-years/${yearId}/validate-activation`),
  validateClosure: (yearId: string) => api.get(`/academic-years/${yearId}/validate-closure`),
  
  // Promociones
  previewPromotions: (yearId: string) => api.get(`/academic-years/${yearId}/promotion-preview`),
  promoteStudents: (fromYearId: string, toYearId: string) => api.post(`/academic-years/${fromYearId}/promote-to/${toYearId}`),
  
  // Permisos
  getPermissions: (yearId: string) => api.get(`/academic-years/${yearId}/permissions`),
}

// Enrollment Management
export const enrollmentsApi = {
  // Matrículas
  create: (data: { studentId: string; academicYearId: string; groupId: string; enrollmentType?: string; shift?: string; modality?: string; observations?: string }) => api.post('/enrollments', data),
  getAll: (params?: { academicYearId?: string; gradeId?: string; groupId?: string; status?: string; search?: string }) => api.get('/enrollments', { params }),
  getById: (enrollmentId: string) => api.get(`/enrollments/${enrollmentId}`),
  
  // Historial
  getHistory: (enrollmentId: string) => api.get(`/enrollments/${enrollmentId}/history`),
  getStudentHistory: (studentId: string) => api.get(`/enrollments/student/${studentId}/history`),
  
  // Estadísticas
  getStats: (academicYearId: string) => api.get(`/enrollments/stats/${academicYearId}`),
  
  // Operaciones
  withdraw: (enrollmentId: string, data: { reason: string; observations?: string }) => api.post(`/enrollments/${enrollmentId}/withdraw`, data),
  transfer: (enrollmentId: string, data: { reason: string; destinationInstitution?: string; observations?: string }) => api.post(`/enrollments/${enrollmentId}/transfer`, data),
  changeGroup: (enrollmentId: string, data: { newGroupId: string; reason: string; movementType: string; observations?: string }) => api.post(`/enrollments/${enrollmentId}/change-group`, data),
  reactivate: (enrollmentId: string, data: { reason: string; observations?: string }) => api.post(`/enrollments/${enrollmentId}/reactivate`, data),
}

// Grade Change (cambios de grado con validaciones estrictas)
export const gradeChangeApi = {
  validate: (data: { enrollmentId: string; newGroupId: string }) => api.post('/grade-change/validate', data),
  execute: (data: { enrollmentId: string; newGroupId: string; gradeChangeType: string; movementType: string; reason: string; observations?: string; academicActId?: string }) => api.post('/grade-change/execute', data),
  getRules: () => api.get('/grade-change/rules'),
}

// Academic Terms (Periods)
export const academicTermsApi = {
  getAll: (academicYearId?: string) => api.get('/academic-terms', { params: { academicYearId } }),
  getByAcademicYear: (academicYearId: string) => api.get('/academic-terms', { params: { academicYearId } }),
  create: (data: { academicYearId: string; type: string; name: string; order: number; weightPercentage: number }) => api.post('/academic-terms', data),
  syncPeriods: (academicYearId: string, periods: Array<{ name: string; weight: number; order?: number; startDate?: string; endDate?: string }>) =>
    api.post('/academic-terms/sync', { academicYearId, periods }),
  toggleBulletinsRelease: (termId: string, released: boolean) =>
    api.patch(`/academic-terms/${termId}/toggle-bulletins`, { released }),
}

// Teacher Assignments (Carga Academica)
export const teacherAssignmentsApi = {
  getAll: (params?: { academicYearId?: string; groupId?: string; teacherId?: string; activeOnly?: boolean }) => api.get('/teacher-assignments', { params }),
  create: (data: { academicYearId: string; groupId: string; subjectId: string; teacherId: string; weeklyHours?: number }) => api.post('/teacher-assignments', data),
  delete: (id: string) => api.delete(`/teacher-assignments/${id}`),
  deleteAll: (academicYearId?: string) => api.delete('/teacher-assignments/all', { params: { academicYearId } }),
  activateConvivencia: (data: { institutionId?: string; academicYearId: string; gradeId: string; useTutor: boolean; countInAverage: boolean; teacherId?: string }) =>
    api.post('/teacher-assignments/convivencia/activate', data),
  
  // Reemplazo individual
  replace: (id: string, data: { newTeacherId: string; reason: string; endDate?: string }) => 
    api.post(`/teacher-assignments/${id}/replace`, data),
  end: (id: string, data: { reason: string; endDate?: string }) => 
    api.post(`/teacher-assignments/${id}/end`, data),
  
  // Historial
  getHistory: (params: { academicYearId: string; groupId: string; subjectId: string }) => 
    api.get('/teacher-assignments/history', { params }),
  
  // Transferencia de carga completa
  getTeacherLoad: (teacherId: string, academicYearId?: string) => 
    api.get(`/teacher-assignments/teacher-load/${teacherId}`, { params: { academicYearId } }),
  transfer: (data: { 
    fromTeacherId: string; 
    toTeacherId: string; 
    reason: string; 
    academicYearId?: string;
    assignmentIds?: string[];
    effectiveDate?: string;
  }) => api.post('/teacher-assignments/transfer', data),
}

// Evaluation Components
export const evaluationComponentsApi = {
  getAll: (institutionId?: string) => api.get('/evaluation-components', { params: { institutionId } }),
  create: (data: { institutionId: string; name: string; weightPercentage: number }) => api.post('/evaluation-components', data),
}

// Evaluation Plans
export const evaluationPlansApi = {
  getAll: (params?: { teacherAssignmentId?: string; academicTermId?: string }) => api.get('/evaluation-plans', { params }),
  create: (data: { teacherAssignmentId: string; academicTermId: string; componentId: string; weightPercentage: number }) => api.post('/evaluation-plans', data),
}

// Evaluative Activities
export const evaluativeActivitiesApi = {
  getAll: (params?: { teacherAssignmentId?: string; academicTermId?: string }) => api.get('/evaluative-activities', { params }),
  create: (data: { teacherAssignmentId: string; academicTermId: string; evaluationPlanId: string; componentId: string; name: string; weightPercentage: number; dueDate?: string }) => api.post('/evaluative-activities', data),
}

// Student Grades
export const studentGradesApi = {
  getByActivity: (evaluativeActivityId: string) => api.get('/student-grades/by-activity', { params: { evaluativeActivityId } }),
  getByStudent: (studentEnrollmentId: string) => api.get('/student-grades/by-student', { params: { studentEnrollmentId } }),
  upsert: (data: { studentEnrollmentId: string; evaluativeActivityId: string; score: number }) => api.post('/student-grades', data),
  bulkUpsert: (data: { evaluativeActivityId: string; grades: Array<{ studentEnrollmentId: string; score: number }> }) => api.post('/student-grades/bulk', data),
  getTermGrade: (studentEnrollmentId: string, teacherAssignmentId: string, academicTermId: string) => 
    api.get('/student-grades/term-grade', { params: { studentEnrollmentId, teacherAssignmentId, academicTermId } }),
  getAnnualGrade: (studentEnrollmentId: string, teacherAssignmentId: string, academicYearId: string) =>
    api.get('/student-grades/annual-grade', { params: { studentEnrollmentId, teacherAssignmentId, academicYearId } }),
  getPerformanceLevel: (institutionId: string, score: number) =>
    api.get('/student-grades/performance-level', { params: { institutionId, score } }),
}

// Partial Grades (notas parciales por actividad)
export const partialGradesApi = {
  upsert: (data: {
    studentEnrollmentId: string;
    teacherAssignmentId: string;
    academicTermId: string;
    componentType: string;
    activityIndex: number;
    activityName: string;
    activityType?: string;
    score: number;
    observations?: string;
  }) => api.post('/partial-grades', data),
  bulkUpsert: (grades: Array<{
    studentEnrollmentId: string;
    teacherAssignmentId: string;
    academicTermId: string;
    componentType: string;
    activityIndex: number;
    activityName: string;
    activityType?: string;
    score: number | null; // null = sin nota (borra la celda); número (incl. 0) = guardar (C-2)
    observations?: string;
    expectedUpdatedAt?: string | null; // concurrencia: detecta si alguien más cambió esta celda
  }>) => api.post('/partial-grades/bulk', { grades }),
  getByAssignment: (teacherAssignmentId: string, academicTermId: string) =>
    api.get('/partial-grades/by-assignment', { params: { teacherAssignmentId, academicTermId } }),
  getByStudent: (studentEnrollmentId: string, academicTermId?: string) =>
    api.get('/partial-grades/by-student', { params: { studentEnrollmentId, academicTermId } }),
  delete: (id: string) => api.delete(`/partial-grades/${id}`),
  recoverLostGrades: () => api.post('/partial-grades/recover-lost-grades'),
}

// Performance Scale
export const performanceScaleApi = {
  getAll: (institutionId?: string) => api.get('/performance-scale', { params: { institutionId } }),
  create: (data: { institutionId: string; level: string; minScore: number; maxScore: number }) => api.post('/performance-scale', data),
}

// Attendance
export const attendanceApi = {
  record: (data: { teacherAssignmentId: string; date: string; records: Array<{ studentEnrollmentId: string; status: string }> }) =>
    api.post('/attendance', data),
  getByAssignment: (assignmentId: string, date: string) =>
    api.get(`/attendance/by-assignment/${assignmentId}`, { params: { date } }),
  getByStudent: (studentEnrollmentId: string, params?: { startDate?: string; endDate?: string }) =>
    api.get(`/attendance/by-student/${studentEnrollmentId}`, { params }),
  getReportByGroup: (groupId: string, academicYearId: string, params?: { startDate?: string; endDate?: string; subjectId?: string }) =>
    api.get(`/attendance/report-by-group/${groupId}`, { params: { academicYearId, ...params } }),
  getDetailedReport: (params: { academicYearId: string; groupId?: string; date?: string; startDate?: string; endDate?: string; subjectId?: string; teacherId?: string; studentEnrollmentId?: string; status?: string }) =>
    api.get('/attendance/detailed-report', { params }),
  getTeacherComplianceReport: (params: { academicYearId: string; teacherId?: string; groupId?: string; subjectId?: string; startDate?: string; endDate?: string }) =>
    api.get('/attendance/report/teacher-compliance', { params }),
  getConsolidatedReport: (params: { academicYearId: string; startDate?: string; endDate?: string; subjectId?: string }) =>
    api.get('/attendance/report/consolidated', { params }),
  deleteAll: () => api.delete('/attendance/all'),
}

// Tutoring Attendance (Asistencia de tutoría / dirección de grupo)
export const tutoringAttendanceApi = {
  getStatus: () => api.get('/tutoring-attendance/status'),
  record: (data: { groupId: string; date: string; records: Array<{ studentEnrollmentId: string; status: string; observations?: string }> }) =>
    api.post('/tutoring-attendance/record', data),
  getByGroup: (groupId: string, date: string) =>
    api.get('/tutoring-attendance/by-group', { params: { groupId, date } }),
  getStudentSummary: (studentEnrollmentId: string, params?: { startDate?: string; endDate?: string }) =>
    api.get('/tutoring-attendance/student-summary', { params: { studentEnrollmentId, ...params } }),
  getReportByGroup: (groupId: string, academicYearId: string, params?: { startDate?: string; endDate?: string }) =>
    api.get('/tutoring-attendance/report-by-group', { params: { groupId, academicYearId, ...params } }),
  toggle: (enabled: boolean) => api.post('/tutoring-attendance/toggle', { enabled }),
}

// Observer (Observador del estudiante)
export const observerApi = {
  // Observaciones
  create: (data: any) => api.post('/observer', data),
  update: (id: string, data: any) => api.put(`/observer/${id}`, data),
  delete: (id: string) => api.delete(`/observer/${id}`),
  getById: (id: string) => api.get(`/observer/${id}`),
  getByStudent: (enrollmentId: string, filters?: any) => api.get(`/observer/by-student/${enrollmentId}`, { params: filters }),
  getByGroup: (groupId: string, academicYearId: string, filters?: any) => api.get(`/observer/by-group/${groupId}`, { params: { academicYearId, ...filters } }),
  getTimeline: (enrollmentId: string) => api.get(`/observer/timeline/${enrollmentId}`),
  getSummary: (enrollmentId: string) => api.get(`/observer/summary/${enrollmentId}`),
  getDashboard: (academicYearId: string) => api.get('/observer/dashboard', { params: { academicYearId } }),
  getPendingFollowUps: (all?: boolean) => api.get('/observer/pending-followups', { params: { all: all ? 'true' : undefined } }),
  markParentNotified: (id: string) => api.put(`/observer/${id}/notify-parent`),
  // Actas
  createActa: (data: any) => api.post('/observer/actas', data),
  updateActa: (id: string, data: any) => api.put(`/observer/actas/${id}`, data),
  // Compromisos
  createCommitment: (data: any) => api.post('/observer/commitments', data),
  updateCommitment: (id: string, data: any) => api.put(`/observer/commitments/${id}`, data),
  getCommitmentsByStudent: (enrollmentId: string) => api.get(`/observer/commitments/by-student/${enrollmentId}`),
  // Citaciones
  createCitation: (data: any) => api.post('/observer/citations', data),
  updateCitation: (id: string, data: any) => api.put(`/observer/citations/${id}`, data),
  getCitationsByStudent: (enrollmentId: string) => api.get(`/observer/citations/by-student/${enrollmentId}`),
  // Remisiones
  createReferral: (data: any) => api.post('/observer/referrals', data),
  updateReferral: (id: string, data: any) => api.put(`/observer/referrals/${id}`, data),
  getReferralsByStudent: (enrollmentId: string) => api.get(`/observer/referrals/by-student/${enrollmentId}`),
  // Medidas pedagógicas
  createMeasure: (data: any) => api.post('/observer/measures', data),
  updateMeasure: (id: string, data: any) => api.put(`/observer/measures/${id}`, data),
  // Estadísticas convivenciales
  getConvivencialStats: (academicYearId: string, filters?: { groupId?: string; gradeId?: string; startDate?: string; endDate?: string }) =>
    api.get('/observer/stats/convivencial', { params: { academicYearId, ...filters } }),
  getCommissionData: (academicYearId: string, gradeId: string, actaTypes?: string) =>
    api.get('/observer/commission-data', { params: { academicYearId, gradeId, actaTypes } }),
}

// Preventive Cuts (Corte Preventivo)
export const preventiveCutsApi = {
  // Configuración por período
  getConfig: (academicTermId: string) =>
    api.get('/preventive-cuts/config', { params: { academicTermId } }),
  saveConfig: (data: { academicTermId: string; cutoffDate: string; riskThresholdScore: number }) =>
    api.post('/preventive-cuts/config', data),

  // Consolidado por grupo (solo lectura, no persiste)
  groupView: (params: { academicTermId: string; groupId: string; cutoffDate?: string; threshold?: number }) =>
    api.get('/preventive-cuts/group-view', { params }),

  // Alertas persistidas (workflow de seguimiento)
  listAlerts: (params?: { academicTermId?: string; teacherAssignmentId?: string; studentEnrollmentId?: string; status?: string }) =>
    api.get('/preventive-cuts/alerts', { params }),

  // Descargas PDF (blob con auth)
  groupPdf: (params: { academicTermId: string; groupId: string; cutoffDate?: string; threshold?: number; showGrades?: boolean }) =>
    api.get('/preventive-cuts/pdf/group', { params, responseType: 'blob' }),
  studentPdf: (params: { academicTermId: string; groupId: string; studentEnrollmentId: string; cutoffDate?: string; threshold?: number; showGrades?: boolean }) =>
    api.get('/preventive-cuts/pdf/student', { params, responseType: 'blob' }),
}

// Reports
export const reportsApi = {
  getReportCard: (studentEnrollmentId: string, academicTermId: string) =>
    api.get(`/reports/report-card/${studentEnrollmentId}`, { params: { academicTermId } }),
  getGroupReport: (groupId: string, academicTermId: string) =>
    api.get('/reports/group', { params: { groupId, academicTermId } }),
  // Reportes predictivos - Nota mínima requerida
  getMinimumGrade: (studentEnrollmentId: string, academicYearId: string) =>
    api.get(`/reports/minimum-grade/${studentEnrollmentId}`, { params: { academicYearId } }),
  getMinimumGradeForGroup: (groupId: string, academicYearId: string) =>
    api.get(`/reports/minimum-grade/group/${groupId}`, { params: { academicYearId } }),
  // Reportes académicos institucionales
  getSubjectAverages: (academicYearId: string, params?: { groupId?: string; termId?: string; stage?: string }) =>
    api.get('/reports/academic/subject-averages', { params: { academicYearId, ...params } }),
  getAreaAverages: (academicYearId: string, params?: { groupId?: string; termId?: string; stage?: string }) =>
    api.get('/reports/academic/area-averages', { params: { academicYearId, ...params } }),
  getAreaConsolidated: (academicYearId: string, groupId: string, termId?: string) =>
    api.get('/reports/academic/area-consolidated', { params: { academicYearId, groupId, termId } }),
  getStudentRanking: (academicYearId: string, groupId: string, termId?: string) =>
    api.get('/reports/academic/student-ranking', { params: { academicYearId, groupId, termId } }),
  getInstitutionalRanking: (academicYearId: string, params?: { termId?: string; groupId?: string; gradeId?: string; stage?: string }) =>
    api.get('/reports/academic/institutional-ranking', { params: { academicYearId, ...params } }),
  getGradeDistribution: (academicYearId: string, groupId: string, params?: { subjectId?: string; termId?: string }) =>
    api.get('/reports/academic/grade-distribution', { params: { academicYearId, groupId, ...params } }),
  getSubjectLevelDistribution: (academicYearId: string, params?: { groupId?: string; gradeId?: string; termId?: string; stage?: string }) =>
    api.get('/reports/academic/subject-level-distribution', { params: { academicYearId, ...params } }),
  getFailedSubjects: (academicYearId: string, groupId: string, termId?: string, opts?: { scope?: 'partial' | 'final'; cutoffDate?: string; areaId?: string; subjectId?: string }) =>
    api.get('/reports/academic/failed-subjects', { params: { academicYearId, groupId, termId, ...opts } }),
  getRecoveryList: (academicYearId: string, groupId: string, params?: { termId?: string; minScore?: number; maxScore?: number }) =>
    api.get('/reports/academic/recovery-list', { params: { academicYearId, groupId, ...params } }),
  getPromotionProjection: (academicYearId: string, groupId: string) =>
    api.get('/reports/academic/promotion-projection', { params: { academicYearId, groupId } }),
  getPeriodComparison: (academicYearId: string, params?: { groupId?: string; studentEnrollmentId?: string }) =>
    api.get('/reports/academic/period-comparison', { params: { academicYearId, ...params } }),
  getStudentHistory: (studentId: string) =>
    api.get('/reports/academic/student-history', { params: { studentId } }),
  getSubjectAnalysis: (academicYearId: string, subjectId: string, groupId?: string) =>
    api.get('/reports/academic/subject-analysis', { params: { academicYearId, subjectId, groupId } }),
  getTeacherPerformance: (academicYearId: string, teacherId?: string) =>
    api.get('/reports/academic/teacher-performance', { params: { academicYearId, teacherId } }),
  // Configuración de boletines
  getReportCardConfig: () => api.get('/reports/report-card-config'),
  updateReportCardConfig: (data: any) => api.put('/reports/report-card-config', data),
  // Lista de boletines por grupo
  getGroupReportCardList: (groupId: string, academicTermId: string, academicYearId: string) =>
    api.get(`/reports/report-cards/group/${groupId}`, { params: { academicTermId, academicYearId } }),
  // PDF de boletín individual
  downloadReportCardPdf: (studentEnrollmentId: string, academicTermId: string) =>
    api.get(`/reports/report-card/${studentEnrollmentId}/pdf`, { params: { academicTermId }, responseType: 'blob' }),
  // PDF bulk (todos los del grupo)
  generateBulkReportCards: (groupId: string, academicTermId: string, academicYearId: string) =>
    api.post('/reports/report-cards/bulk', { groupId, academicTermId, academicYearId }),
  // Ciclo de vida de períodos
  validateTermGrades: (termId: string) =>
    api.get(`/reports/terms/${termId}/validate-grades`),
  closeTerm: (termId: string) =>
    api.post(`/reports/terms/${termId}/close`),
  finalizeTerm: (termId: string) =>
    api.post(`/reports/terms/${termId}/finalize`),
  reopenTerm: (termId: string, reason: string) =>
    api.post(`/reports/terms/${termId}/reopen`, { reason }),
  reSnapshotTerm: (termId: string) =>
    api.post(`/reports/terms/${termId}/re-snapshot`),
  // Impacto de recuperaciones
  getRecoveryImpact: (academicTermId: string, groupId?: string) =>
    api.get('/reports/recovery-impact', { params: { academicTermId, groupId } }),
  getCompletenessStatus: (academicYearId: string, termId?: string) =>
    api.get('/reports/academic/completeness-status', { params: { academicYearId, termId } }),
  // Exportaciones Excel
  exportConsolidated: (academicYearId: string, groupId: string, termId?: string) =>
    api.get('/reports/export/consolidated', { params: { academicYearId, groupId, termId }, responseType: 'blob' }),
  exportGradeDistribution: (academicYearId: string, groupId: string, params?: { subjectId?: string; termId?: string }) =>
    api.get('/reports/export/grade-distribution', { params: { academicYearId, groupId, ...params }, responseType: 'blob' }),
  exportTeacherPerformance: (academicYearId: string, teacherId?: string) =>
    api.get('/reports/export/teacher-performance', { params: { academicYearId, teacherId }, responseType: 'blob' }),
  exportStudentRanking: (academicYearId: string, groupId: string, termId?: string) =>
    api.get('/reports/export/student-ranking', { params: { academicYearId, groupId, termId }, responseType: 'blob' }),
  exportFailedSubjects: (academicYearId: string, groupId: string, termId?: string) =>
    api.get('/reports/export/failed-subjects', { params: { academicYearId, groupId, termId }, responseType: 'blob' }),
  exportRecoveryList: (academicYearId: string, groupId: string, termId?: string) =>
    api.get('/reports/export/recovery-list', { params: { academicYearId, groupId, termId }, responseType: 'blob' }),
  exportPromotionProjection: (academicYearId: string, groupId: string) =>
    api.get('/reports/export/promotion-projection', { params: { academicYearId, groupId }, responseType: 'blob' }),
  // PDFs formales
  pdfRecoveryCertificate: (academicYearId: string, groupId: string, termId?: string) =>
    api.get('/reports/pdf/recovery-certificate', { params: { academicYearId, groupId, termId }, responseType: 'blob' }),
  pdfNonPromoted: (academicYearId: string, groupId: string) =>
    api.get('/reports/pdf/non-promoted', { params: { academicYearId, groupId }, responseType: 'blob' }),
  pdfStatisticalSummary: (academicYearId: string, groupId: string, termId?: string) =>
    api.get('/reports/pdf/statistical-summary', { params: { academicYearId, groupId, termId }, responseType: 'blob' }),
  pdfStudentHistory: (studentId: string) =>
    api.get(`/reports/pdf/student-history/${studentId}`, { responseType: 'blob' }),
  // Reportes institucionales
  getInstitutionalStatistics: (academicYearId: string, termId?: string) =>
    api.get('/reports/institutional-statistics', { params: { academicYearId, termId } }),
  getAnnualComparison: (academicYearIds: string[]) =>
    api.get('/reports/annual-comparison', { params: { academicYearIds: academicYearIds.join(',') } }),
  getMinGradeConsolidated: (academicYearId: string, groupId: string) =>
    api.get('/reports/min-grade-consolidated', { params: { academicYearId, groupId } }),
}

// Communications
export const communicationsApi = {
  getAll: (params?: { institutionId?: string; type?: string; status?: string }) => api.get('/communications', { params }),
  create: (data: { institutionId: string; type: string; subject: string; content: string; recipients?: Array<{ type: string; recipientId?: string }> }) => api.post('/communications', data),
  getById: (id: string) => api.get(`/communications/${id}`),
  update: (id: string, data: { type?: string; subject?: string; content?: string; scheduledAt?: string }) => api.put(`/communications/${id}`, data),
  send: (id: string) => api.post(`/communications/${id}/send`),
  delete: (id: string) => api.delete(`/communications/${id}`),
  getInbox: () => api.get('/communications/inbox'),
  markAsRead: (id: string) => api.post(`/communications/${id}/read`),
  reply: (id: string, content: string) => api.post(`/communications/${id}/reply`, { content }),
  getReplies: (id: string) => api.get(`/communications/${id}/replies`),
  getAvailableRecipients: (search?: string) => api.get('/communications/available-recipients', { params: { search } }),
  getAllowedCategories: () => api.get('/communications/allowed-categories'),
  uploadAttachment: (messageId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`/communications/${messageId}/attachments`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  removeAttachment: (attachmentId: string) => api.delete(`/communications/attachments/${attachmentId}`),
  getAttachmentDownloadUrl: (attachmentId: string) => api.get(`/communications/attachments/${attachmentId}/download`),
  getStorageUsage: () => api.get('/communications/storage-usage'),
}

// ═══════════════════════════════════════════════════════════════════════════
// ACADEMIC STUDENTS API - Para uso exclusivo de páginas académicas
// ═══════════════════════════════════════════════════════════════════════════
// Las páginas académicas (Grades, Attendance, Observer, Achievements, etc.)
// deben usar esta API en lugar de studentsApi para mantener la separación de dominios.

export const academicStudentsApi = {
  /**
   * Obtiene estudiantes para un grupo en un año académico.
   * Retorna solo datos necesarios para el contexto académico: id, name, enrollmentId
   */
  getByGroup: (params: { groupId: string; academicYearId: string; institutionId?: string }) => 
    api.get('/academic/students/by-group', { params }),
  
  /**
   * Obtiene estudiantes para múltiples grupos (útil para reportes)
   */
  getByGroups: (params: { groupIds: string[]; academicYearId: string; institutionId?: string }) => 
    api.get('/academic/students/by-groups', { params: { ...params, groupIds: params.groupIds.join(',') } }),
}

// ═══════════════════════════════════════════════════════════════════════════
// STUDENTS API - Para gestión estudiantil (matrícula, estados, documentos)
// ═══════════════════════════════════════════════════════════════════════════
// Esta API es para el dominio de Gestión Estudiantil, NO para páginas académicas.

export const studentsApi = {
  getAll: (params?: { institutionId?: string; groupId?: string; academicYearId?: string }) => api.get('/students', { params }),
  getById: (id: string) => api.get(`/students/${id}`),
  create: (data: any) => api.post('/students', data),
  update: (id: string, data: any) => api.put(`/students/${id}`, data),
  delete: (id: string) => api.delete(`/students/${id}`),
  enroll: (data: { studentId: string; academicYearId: string; groupId: string }) => api.post('/students/enroll', data),
  updateEnrollmentStatus: (enrollmentId: string, status: string) => api.put(`/students/enrollment/${enrollmentId}/status`, { status }),
  getEnrollments: (studentId: string) => api.get(`/students/${studentId}/enrollments`),
  bulkImport: (data: { institutionId: string; academicYearId: string; students: any[] }) => api.post('/students/bulk-import', data),
  // Acceso al sistema
  activateAccess: (studentId: string) => api.post(`/students/${studentId}/activate-access`),
  deactivateAccess: (studentId: string) => api.post(`/students/${studentId}/deactivate-access`),
  bulkActivateAccess: (studentIds: string[]) => api.post('/students/bulk-activate-access', { studentIds }),
  resetPassword: (studentId: string) => api.post(`/students/${studentId}/reset-password`),
  bulkResetPassword: (studentIds: string[]) => api.post('/students/bulk-reset-password', { studentIds }),
  bulkRegenerateCredentials: (studentIds: string[]) => api.post('/students/bulk-regenerate-credentials', { studentIds }),
  getCredentials: (institutionId: string) => api.get('/students/credentials/list', { params: { institutionId } }),
  bulkDeleteWithoutRecords: (institutionId: string) => api.post('/students/bulk-delete-without-records', { institutionId }),
  // Actualización masiva segura
  exportForBulkUpdate: (params?: { institutionId?: string; groupId?: string; academicYearId?: string }) => 
    api.get('/students/export-for-update', { params }),
  bulkUpdate: (data: { institutionId?: string; rows: any[]; previewOnly?: boolean }) => api.post('/students/bulk-update', data),
}

// Teachers
export const teachersApi = {
  getAll: (params?: { isActive?: boolean }) => api.get('/teachers', { params }),
  getById: (id: string) => api.get(`/teachers/${id}`),
  create: (data: { email: string; password: string; firstName: string; lastName: string; documentType?: string; documentNumber?: string; phone?: string }) => api.post('/teachers', data),
  update: (id: string, data: { firstName?: string; lastName?: string; email?: string; documentType?: string; documentNumber?: string; phone?: string; isActive?: boolean }) => api.put(`/teachers/${id}`, data),
  delete: (id: string) => api.delete(`/teachers/${id}`),
  getAssignments: (teacherId: string, academicYearId?: string) => api.get(`/teachers/${teacherId}/assignments`, { params: { academicYearId } }),
}

export const gradesApi = {
  getByStudent: (enrollmentId: string) => api.get(`/student-grades/by-student`, { params: { studentEnrollmentId: enrollmentId } }),
  upsert: (data: { studentEnrollmentId: string; evaluativeActivityId: string; score: number }) => api.post('/student-grades', data),
}

// Academic Grades (grados académicos - Transición, Primero, etc.)
export const academicGradesApi = {
  getAll: (institutionId?: string) => api.get('/grades', { params: { institutionId } }),
  getActive: (institutionId?: string) => api.get('/grades/active', { params: { institutionId } }),
  create: (data: { name: string; stage: string; number?: number }) => api.post('/grades', data),
  update: (id: string, data: { name?: string; stage?: string; number?: number }) => api.patch(`/grades/${id}`, data),
  sync: (grades: any[]) => api.post('/grades/sync', { grades }),
  delete: (id: string) => api.delete(`/grades/${id}`),
}

// Dashboard APIs
export const dashboardApi = {
  getData: (institutionId?: string) => api.get('/dashboard', { params: { institutionId } }),
}

export const announcementsApi = {
  getAll: (institutionId?: string, onlyActive = true) => api.get('/announcements', { params: { institutionId, onlyActive } }),
  create: (data: { institutionId: string; title: string; content: string; imageUrl?: string; priority?: number; expiresAt?: string }) => api.post('/announcements', data),
  update: (id: string, data: any) => api.patch(`/announcements/${id}`, data),
  delete: (id: string) => api.delete(`/announcements/${id}`),
}

export const galleryApi = {
  getAll: (institutionId?: string, category?: string, onlyActive = true) => api.get('/gallery', { params: { institutionId, category, onlyActive } }),
  create: (data: { institutionId: string; title: string; description?: string; imageUrl: string; category?: string }) => api.post('/gallery', data),
  update: (id: string, data: any) => api.patch(`/gallery/${id}`, data),
  delete: (id: string) => api.delete(`/gallery/${id}`),
}

// Storage API - Subida de archivos a Supabase
export const storageApi = {
  resolveUrl: (path: string) => api.get('/storage/resolve-url', { params: { path } }),
  uploadGalleryImage: (file: File, institutionId: string, category?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('institutionId', institutionId);
    if (category) formData.append('category', category);
    return api.post('/storage/upload/gallery', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadAnnouncementImage: (file: File, institutionId: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('institutionId', institutionId);
    return api.post('/storage/upload/announcement', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadSignature: (file: File, role: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('role', role);
    return api.post('/storage/upload/signature', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadMySignature: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/storage/upload/my-signature', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
}

export const eventsApi = {
  getAll: (institutionId?: string, onlyActive = true, upcoming = false) => api.get('/events', { params: { institutionId, onlyActive, upcoming } }),
  getBirthdays: (institutionId?: string) => api.get('/events/birthdays', { params: { institutionId } }),
  create: (data: { institutionId: string; title: string; description?: string; eventDate: string; endDate?: string; location?: string; eventType?: string }) => api.post('/events', data),
  update: (id: string, data: any) => api.patch(`/events/${id}`, data),
  delete: (id: string) => api.delete(`/events/${id}`),
}

// Period Final Grades API (solo admin/coordinador)
export const periodFinalGradesApi = {
  upsert: (data: { studentEnrollmentId: string; academicTermId: string; subjectId: string; finalScore: number; observations?: string }) => 
    api.post('/period-final-grades', data),
  bulkUpsert: (grades: Array<{ studentEnrollmentId: string; academicTermId: string; subjectId: string; finalScore: number; observations?: string }>) => 
    api.post('/period-final-grades/bulk', { grades }),
  getByGroup: (groupId: string, academicTermId: string) => 
    api.get('/period-final-grades/by-group', { params: { groupId, academicTermId } }),
  getByStudent: (studentEnrollmentId: string, academicTermId?: string) => 
    api.get('/period-final-grades/by-student', { params: { studentEnrollmentId, academicTermId } }),
  delete: (id: string) => api.delete(`/period-final-grades/${id}`),
}

// ============================================
// MÓDULO DE RECUPERACIONES ACADÉMICAS
// ============================================

// Configuración de recuperaciones
export const recoveryConfigApi = {
  get: (institutionId: string, academicYearId: string) => 
    api.get('/recovery-config', { params: { institutionId, academicYearId } }),
  upsert: (data: any) => api.post('/recovery-config', data),
}

// Recuperación por período
export const periodRecoveryApi = {
  detect: (academicTermId: string, institutionId: string) => 
    api.get('/period-recovery/detect', { params: { academicTermId, institutionId } }),
  create: (data: any) => api.post('/period-recovery', data),
  getByTerm: (academicTermId: string, status?: string) => 
    api.get('/period-recovery/by-term', { params: { academicTermId, status } }),
  getByStudent: (studentEnrollmentId: string) => 
    api.get(`/period-recovery/by-student/${studentEnrollmentId}`),
  updateActivity: (id: string, data: any) => 
    api.patch(`/period-recovery/${id}/activity`, data),
  registerResult: (id: string, data: any, institutionId: string) => 
    api.patch(`/period-recovery/${id}/result`, data, { params: { institutionId } }),
  review: (id: string, data: { approved: boolean; observations?: string }) => 
    api.patch(`/period-recovery/${id}/review`, data),
  getStats: (academicTermId: string) => 
    api.get('/period-recovery/stats', { params: { academicTermId } }),
}

// Recuperación final (Plan de apoyo)
export const finalRecoveryApi = {
  detect: (academicYearId: string, institutionId: string) => 
    api.get('/final-recovery/detect', { params: { academicYearId, institutionId } }),
  create: (data: any) => api.post('/final-recovery', data),
  getByYear: (academicYearId: string, status?: string) => 
    api.get('/final-recovery/by-year', { params: { academicYearId, status } }),
  getByStudent: (studentEnrollmentId: string) => 
    api.get(`/final-recovery/by-student/${studentEnrollmentId}`),
  updatePlan: (id: string, data: any) => 
    api.patch(`/final-recovery/${id}/plan`, data),
  registerResult: (id: string, data: any, institutionId: string) => 
    api.patch(`/final-recovery/${id}/result`, data, { params: { institutionId } }),
  approve: (id: string, data: any, institutionId: string) => 
    api.patch(`/final-recovery/${id}/approve`, data, { params: { institutionId } }),
  getStats: (academicYearId: string) => 
    api.get('/final-recovery/stats', { params: { academicYearId } }),
}

// Actas académicas
export const academicActsApi = {
  create: (data: any) => api.post('/academic-acts', data),
  getAll: (institutionId: string, academicYearId?: string, actType?: string) => 
    api.get('/academic-acts', { params: { institutionId, academicYearId, actType } }),
  getByStudent: (studentEnrollmentId: string) => 
    api.get(`/academic-acts/by-student/${studentEnrollmentId}`),
  approve: (id: string) => api.patch(`/academic-acts/${id}/approve`),
  generatePromotionAct: (data: any) => api.post('/academic-acts/promotion', data),
  generateAcademicCouncilAct: (data: any) => api.post('/academic-acts/academic-council', data),
}

// ==================== STAFF LEAVE (PERMISOS) ====================

export const staffLeaveApi = {
  create: (data: any) => api.post('/staff-leave', data),
  getMyRequests: () => api.get('/staff-leave/my-requests'),
  getAll: (params?: { status?: string; requesterId?: string; type?: string; startDate?: string; endDate?: string }) =>
    api.get('/staff-leave', { params }),
  getById: (id: string) => api.get(`/staff-leave/${id}`),
  review: (id: string, data: { status: 'APPROVED' | 'REJECTED'; reviewerNote?: string }) =>
    api.patch(`/staff-leave/${id}/review`, data),
  cancel: (id: string) => api.patch(`/staff-leave/${id}/cancel`),
  getStats: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/staff-leave/stats/summary', { params }),
}

// ==================== PERFORMANCE (DESEMPEÑOS) ====================

export const performanceConfigApi = {
  get: (institutionId: string) => 
    api.get('/performance-config', { params: { institutionId } }),
  upsert: (data: {
    institutionId: string;
    isEnabled?: boolean;
    showByDimension?: boolean;
    allowManualEdit?: boolean;
  }) => api.post('/performance-config', data),
  getComplements: (institutionId: string) => 
    api.get('/performance-config/complements', { params: { institutionId } }),
  upsertComplement: (data: {
    institutionId: string;
    level: 'SUPERIOR' | 'ALTO' | 'BASICO' | 'BAJO';
    complement: string;
    isActive?: boolean;
    displayMode?: 'CONCATENATE' | 'SEPARATE_LINE';
  }) => api.post('/performance-config/complements', data),
  bulkUpsertComplements: (data: {
    institutionId: string;
    complements: Array<{
      level: 'SUPERIOR' | 'ALTO' | 'BASICO' | 'BAJO';
      complement: string;
      isActive?: boolean;
      displayMode?: 'CONCATENATE' | 'SEPARATE_LINE';
    }>;
  }) => api.post('/performance-config/complements/bulk', data),
  createDefaultComplements: (institutionId: string) => 
    api.post('/performance-config/complements/defaults', { institutionId }),
}

export const subjectPerformanceApi = {
  getByTeacherAssignment: (teacherAssignmentId: string, academicTermId: string) => 
    api.get('/subject-performance', { params: { teacherAssignmentId, academicTermId } }),
  getByGroup: (groupId: string, academicTermId: string) => 
    api.get('/subject-performance/by-group', { params: { groupId, academicTermId } }),
  upsert: (data: {
    teacherAssignmentId: string;
    academicTermId: string;
    dimension: 'COGNITIVO' | 'PROCEDIMENTAL' | 'ACTITUDINAL';
    baseDescription: string;
  }) => api.post('/subject-performance', data),
  bulkUpsert: (data: {
    teacherAssignmentId: string;
    academicTermId: string;
    performances: Array<{
      dimension: 'COGNITIVO' | 'PROCEDIMENTAL' | 'ACTITUDINAL';
      baseDescription: string;
    }>;
  }) => api.post('/subject-performance/bulk', data),
  delete: (id: string) => api.delete(`/subject-performance/${id}`),
}

export const performanceGeneratorApi = {
  generateStudentPerformances: (
    studentEnrollmentId: string,
    academicTermId: string,
    institutionId: string,
  ) => api.get('/performance-generator/student', { 
    params: { studentEnrollmentId, academicTermId, institutionId } 
  }),
  getReport: (institutionId: string, academicTermId: string, groupId?: string) => 
    api.get('/performance-generator/report', { params: { institutionId, academicTermId, groupId } }),
  getScale: (institutionId: string) => 
    api.get('/performance-generator/scale', { params: { institutionId } }),
}

// ==================== ACHIEVEMENTS (LOGROS Y JUICIOS VALORATIVOS) ====================

export const achievementConfigApi = {
  get: (institutionId: string) => 
    api.get(`/achievements/config/${institutionId}`),
  upsert: (data: {
    institutionId: string;
    achievementsPerPeriod?: number;
    usePromotionalAchievement?: boolean;
    useAttitudinalAchievement?: boolean;
    attitudinalMode?: 'GENERAL_PER_PERIOD' | 'PER_ACADEMIC_ACHIEVEMENT';
    useValueJudgments?: boolean;
    displayMode?: 'SEPARATE' | 'COMBINED';
    displayFormat?: 'LIST' | 'PARAGRAPH';
    judgmentPosition?: 'END_OF_EACH' | 'END_OF_ALL' | 'NONE';
  }) => api.put('/achievements/config', data),
  getTemplates: (institutionId: string) => 
    api.get(`/achievements/config/${institutionId}/templates`),
  bulkUpsertTemplates: (data: {
    institutionId: string;
    templates: Array<{
      level: 'SUPERIOR' | 'ALTO' | 'BASICO' | 'BAJO';
      template: string;
      isActive?: boolean;
    }>;
  }) => api.put('/achievements/config/templates', data),
  createDefaultTemplates: (institutionId: string) => 
    api.post(`/achievements/config/${institutionId}/templates/defaults`),
  // Observation templates
  getObservationTemplates: (institutionId: string) => 
    api.get(`/achievements/config/${institutionId}/observation-templates`),
  bulkUpsertObservationTemplates: (data: {
    institutionId: string;
    templates: Array<{
      level: 'SUPERIOR' | 'ALTO' | 'BASICO' | 'BAJO';
      template: string;
      isActive?: boolean;
    }>;
  }) => api.put('/achievements/config/observation-templates', data),
  createDefaultObservationTemplates: (institutionId: string) => 
    api.post(`/achievements/config/${institutionId}/observation-templates/defaults`),
}

export const achievementsApi = {
  getByAssignment: (teacherAssignmentId: string, academicTermId: string) => 
    api.get('/achievements/by-assignment', { params: { teacherAssignmentId, academicTermId } }),
  getPromotional: (teacherAssignmentId: string) => 
    api.get(`/achievements/promotional/${teacherAssignmentId}`),
  create: (data: {
    teacherAssignmentId: string;
    academicTermId: string;
    orderNumber: number;
    baseDescription: string;
    isPromotional?: boolean;
  }) => api.post('/achievements', data),
  update: (id: string, data: { baseDescription: string }) => 
    api.put(`/achievements/${id}`, data),
  delete: (id: string) => api.delete(`/achievements/${id}`),
  
  // Attitudinal achievements
  getAttitudinal: (teacherAssignmentId: string, academicTermId: string) => 
    api.get('/achievements/attitudinal', { params: { teacherAssignmentId, academicTermId } }),
  upsertAttitudinal: (data: {
    teacherAssignmentId: string;
    academicTermId: string;
    achievementId?: string;
    description: string;
  }) => api.put('/achievements/attitudinal', data),
  
  // Student achievements
  getStudentAchievements: (achievementId: string) => 
    api.get(`/achievements/students/${achievementId}`),
  getByEnrollment: (studentEnrollmentId: string, academicTermId?: string) => 
    api.get(`/achievements/by-enrollment/${studentEnrollmentId}`, { params: { academicTermId } }),
  generateSuggestions: (data: {
    achievementId: string;
    institutionId: string;
    studentGrades: Array<{
      studentEnrollmentId: string;
      finalGrade: number;
    }>;
  }) => api.post('/achievements/students/generate-suggestions', data),
  upsertStudentAchievement: (id: string, data: {
    studentEnrollmentId: string;
    achievementId: string;
    performanceLevel: 'BAJO' | 'BASICO' | 'ALTO' | 'SUPERIOR';
    suggestedText?: string;
    approvedText?: string;
    isTextApproved?: boolean;
    suggestedJudgment?: string;
    approvedJudgment?: string;
    isJudgmentApproved?: boolean;
    attitudinalText?: string;
    observation?: string;
  }) => api.put(`/achievements/students/${id}`, data),
  approveStudentAchievement: (id: string, data: {
    approvedText: string;
    approvedJudgment?: string;
  }) => api.post(`/achievements/students/${id}/approve`, data),
  
  // Validation
  validate: (teacherAssignmentId: string, academicTermId: string, requiredCount: number) => 
    api.get('/achievements/validate', { params: { teacherAssignmentId, academicTermId, requiredCount } }),
  getUnapproved: (teacherAssignmentId: string, academicTermId: string) => 
    api.get('/achievements/unapproved', { params: { teacherAssignmentId, academicTermId } }),
  // Bulk operations
  bulkAssign: (data: {
    achievementId: string;
    studentEnrollmentIds: string[];
    institutionId: string;
  }) => api.post('/achievements/students/bulk-assign', data),
  autoFillObservations: (data: {
    achievementId: string;
    institutionId: string;
  }) => api.post('/achievements/students/auto-fill-observations', data),
  updateObservation: (id: string, observation: string) => 
    api.put(`/achievements/students/${id}/observation`, { observation }),
}

// ==================== GRADING PERIOD CONFIG ====================

export const gradingPeriodConfigApi = {
  getByAcademicYear: (academicYearId: string) => 
    api.get('/grading-period-config', { params: { academicYearId } }),
  getStatus: (academicYearId: string) => 
    api.get('/grading-period-config/status', { params: { academicYearId } }),
  checkPeriod: (academicTermId: string) => 
    api.get(`/grading-period-config/check/${academicTermId}`),
  updateConfig: (academicTermId: string, data: {
    isOpen: boolean;
    openDate?: string | null;
    closeDate?: string | null;
    allowLateEntry?: boolean;
    lateEntryDays?: number;
  }) => api.post(`/grading-period-config/${academicTermId}`, data),
}

export const recoveryPeriodConfigApi = {
  getByAcademicYear: (academicYearId: string) => 
    api.get('/recovery-period-config', { params: { academicYearId } }),
  getStatus: (academicYearId: string) => 
    api.get('/recovery-period-config/status', { params: { academicYearId } }),
  checkPeriod: (academicTermId: string) => 
    api.get(`/recovery-period-config/check/${academicTermId}`),
  updateConfig: (academicTermId: string, data: {
    isOpen: boolean;
    openDate?: string | null;
    closeDate?: string | null;
    allowLateEntry?: boolean;
    lateEntryDays?: number;
  }) => api.post(`/recovery-period-config/${academicTermId}`, data),
}

// ==================== STATISTICS ====================

export const statisticsApi = {
  getFull: (institutionId: string, academicYearId?: string, academicTermId?: string) => 
    api.get('/statistics', { params: { institutionId, academicYearId, academicTermId } }),
  getGeneral: (institutionId: string, academicYearId?: string) => 
    api.get('/statistics/general', { params: { institutionId, academicYearId } }),
  getPerformanceDistribution: (institutionId: string, academicYearId?: string, academicTermId?: string) => 
    api.get('/statistics/performance-distribution', { params: { institutionId, academicYearId, academicTermId } }),
  getSubjects: (institutionId: string, academicYearId?: string, academicTermId?: string) => 
    api.get('/statistics/subjects', { params: { institutionId, academicYearId, academicTermId } }),
  getGroups: (institutionId: string, academicYearId?: string, academicTermId?: string) => 
    api.get('/statistics/groups', { params: { institutionId, academicYearId, academicTermId } }),
}

// ==================== SIEE CONFIG (Multitenant) ====================

export const sieeConfigApi = {
  // Full config
  getFullConfig: (institutionId: string) => api.get(`/siee-config/full/${institutionId}`),
  initializeDefaultConfig: (institutionId: string) => api.post(`/siee-config/initialize/${institutionId}`),
  
  // Grading Scale
  getGradingScale: (institutionId: string) => api.get(`/siee-config/grading-scale/${institutionId}`),
  updateGradingScale: (institutionId: string, data: { minScore: number; maxScore: number; passingScore: number; decimalsAllowed: number }) => 
    api.put(`/siee-config/grading-scale/${institutionId}`, data),
  
  // Performance Levels
  getPerformanceLevels: (institutionId: string) => api.get(`/siee-config/performance-levels/${institutionId}`),
  createPerformanceLevel: (institutionId: string, data: { name: string; code: string; minScore: number; maxScore: number; order: number; color?: string; description?: string }) => 
    api.post(`/siee-config/performance-levels/${institutionId}`, data),
  updatePerformanceLevel: (id: string, data: { name?: string; code?: string; minScore?: number; maxScore?: number; order?: number; color?: string; description?: string }) => 
    api.put(`/siee-config/performance-levels/${id}`, data),
  deletePerformanceLevel: (id: string) => api.delete(`/siee-config/performance-levels/${id}`),
  
  // Evaluation Processes
  getProcesses: (institutionId: string) => api.get(`/siee-config/processes/${institutionId}`),
  createProcess: (institutionId: string, data: { name: string; code: string; weightPercentage: number; order: number; processType: string; allowsSubprocesses: boolean; visibleInReport: boolean }) => 
    api.post(`/siee-config/processes/${institutionId}`, data),
  updateProcess: (id: string, data: { name?: string; code?: string; weightPercentage?: number; order?: number; processType?: string; allowsSubprocesses?: boolean; visibleInReport?: boolean; isActive?: boolean }) => 
    api.put(`/siee-config/processes/${id}`, data),
  deleteProcess: (id: string) => api.delete(`/siee-config/processes/${id}`),
  
  // Evaluation Subprocesses
  getSubprocesses: (processId: string) => api.get(`/siee-config/subprocesses/${processId}`),
  createSubprocess: (processId: string, data: { name: string; code: string; weightPercentage: number; order: number; numberOfInstruments: number; calculationMethod: string }) => 
    api.post(`/siee-config/subprocesses/${processId}`, data),
  updateSubprocess: (id: string, data: { name?: string; code?: string; weightPercentage?: number; order?: number; numberOfInstruments?: number; calculationMethod?: string; isActive?: boolean }) => 
    api.put(`/siee-config/subprocesses/${id}`, data),
  deleteSubprocess: (id: string) => api.delete(`/siee-config/subprocesses/${id}`),
  
  // Academic Year Config
  getAcademicYearConfig: (academicYearId: string) => api.get(`/siee-config/academic-year/${academicYearId}`),
  updateAcademicYearConfig: (academicYearId: string, data: { calendarType?: string; numberOfPeriods?: number; useSemesterExams?: boolean; semesterExamWeight?: number; periodsWeight?: number }) => 
    api.put(`/siee-config/academic-year/${academicYearId}`, data),
}

// ═══════════════════════════════════════════════════════════════════════════
// BULK UPLOAD API - Carga masiva de usuarios
// ═══════════════════════════════════════════════════════════════════════════
export const bulkUploadApi = {
  // Descargar plantillas
  downloadTeacherTemplate: () => api.get('/iam/bulk/template/teachers', { responseType: 'blob' }),
  downloadStudentTemplate: () => api.get('/iam/bulk/template/students', { responseType: 'blob' }),
  downloadStaffTemplate: () => api.get('/iam/bulk/template/staff', { responseType: 'blob' }),
  
  // Subir archivos
  uploadTeachers: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/iam/bulk/upload/teachers', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  uploadStudents: (file: File, academicYearId?: string) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/iam/bulk/upload/students', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: academicYearId ? { academicYearId } : undefined
    })
  },
  uploadStaff: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/iam/bulk/upload/staff', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
}

// Staff/Other Users API
export const staffApi = {
  getAll: () => api.get('/iam/users'),
  create: (data: {
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    documentType?: string;
    documentNumber?: string;
    phone?: string;
  }) => api.post('/iam/staff', data),
  update: (id: string, data: any) => api.put(`/iam/staff/${id}`, data),
  delete: (id: string) => api.delete(`/iam/staff/${id}`),
  resetPassword: (userId: string, opts?: { newPassword?: string; mustChangePassword?: boolean }) => api.post(`/iam/users/${userId}/reset-password`, opts || {}),
  bulkResetPassword: (userIds?: string[]) => api.post('/iam/users/bulk-reset-password', { userIds }),
  updateUsername: (userId: string, username: string) => api.post(`/iam/users/${userId}/update-username`, { username }),
  getPasswordSettings: () => api.get('/iam/institution/password-settings'),
  toggleStudentPasswordChange: (allow: boolean) => api.put('/iam/institution/allow-student-password-change', { allow }),
  // Permisos delegados de credenciales
  checkCredentialsPermission: () => api.get('/iam/delegated-permissions/credentials/check'),
  getDelegatedCredentialsPermissions: () => api.get('/iam/delegated-permissions/credentials'),
  getAvailableTeachersForPermission: () => api.get('/iam/delegated-permissions/available-teachers'),
  toggleCredentialsPermission: (userId: string, allow: boolean) => api.post('/iam/delegated-permissions/credentials', { userId, allow }),
  // Permisos delegados de estudiantes (temporal para pruebas)
  checkStudentsPermission: () => api.get('/iam/delegated-permissions/students/check'),
  getDelegatedStudentsPermissions: () => api.get('/iam/delegated-permissions/students'),
  getAvailableTeachersForStudentsPermission: () => api.get('/iam/delegated-permissions/students/available-teachers'),
  toggleStudentsPermission: (userId: string, allow: boolean) => api.post('/iam/delegated-permissions/students', { userId, allow }),
}

// ═══════════════════════════════════════════════════════════════════════════
// SUPERADMIN API - Gestión de la plataforma SaaS
// ═══════════════════════════════════════════════════════════════════════════
export const superadminApi = {
  // Estadísticas globales del sistema
  getStats: () => api.get('/superadmin/stats'),
  
  // Instituciones
  getAllInstitutions: () => api.get('/superadmin/institutions'),
  getInstitutionById: (id: string) => api.get(`/superadmin/institutions/${id}`),
  createInstitution: (data: {
    name: string;
    slug: string;
    daneCode?: string;
    nit?: string;
    adminFirstName: string;
    adminLastName: string;
    adminEmail: string;
    adminUsername?: string;
    adminPassword?: string;
    modules?: string[];
    rectorSameAsAdmin?: boolean;
    rectorFirstName?: string;
    rectorLastName?: string;
    rectorEmail?: string;
    rectorUsername?: string;
    rectorPassword?: string;
    rectorHasLogin?: boolean;
  }) => api.post('/superadmin/institutions', data),
  updateInstitution: (id: string, data: {
    name?: string;
    slug?: string;
    daneCode?: string;
    nit?: string;
    status?: string;
  }) => api.put(`/superadmin/institutions/${id}`, data),
  
  // Módulos y Features
  updateInstitutionModules: (id: string, modules: string[], features?: string[]) => 
    api.patch(`/superadmin/institutions/${id}/modules`, { modules, features }),
  
  // Estado
  activateInstitution: (id: string) => api.patch(`/superadmin/institutions/${id}/activate`),
  suspendInstitution: (id: string) => api.patch(`/superadmin/institutions/${id}/suspend`),
  
  // Eliminar institución (requiere confirmación)
  deleteInstitution: (id: string, confirmationName: string) =>
    api.delete(`/superadmin/institutions/${id}`, { data: { confirmationName } }),

  // Observabilidad: estadísticas de uso por institución
  getInstitutionUsage: (id: string) => api.get(`/superadmin/institutions/${id}/usage`),

  // Observabilidad: registro forense de cambios de notas (general o por institución)
  getGradeAuditLog: (params?: { institutionId?: string; action?: string; studentEnrollmentId?: string; actorUserId?: string; limit?: number; offset?: number }) =>
    api.get('/superadmin/grade-audit', { params }),
}

// Documentos Institucionales
export const institutionalDocumentsApi = {
  getAll: (institutionId: string) => api.get('/institutional-documents', { params: { institutionId } }),
  getOne: (id: string) => api.get(`/institutional-documents/${id}`),
  getCategories: () => api.get('/institutional-documents/categories'),
  getStorageUsage: (institutionId: string) => api.get('/institutional-documents/storage-usage', { params: { institutionId } }),
  getDownloadUrl: (id: string) => api.get(`/institutional-documents/${id}/download-url`),
  create: (formData: FormData) => api.post('/institutional-documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id: string, data: { title?: string; description?: string; category?: string; visibleToRoles?: string[]; isActive?: boolean }) => 
    api.put(`/institutional-documents/${id}`, data),
  delete: (id: string) => api.delete(`/institutional-documents/${id}`),
  cleanup: (institutionId: string) => api.post('/institutional-documents/cleanup', { institutionId }),
}

// Gestión de Tareas
export const managementTasksApi = {
  // Líderes
  getLeaders: (institutionId: string) => api.get('/management-tasks/leaders', { params: { institutionId } }),
  createLeader: (data: { institutionId: string; userId: string; area: string }) => api.post('/management-tasks/leaders', data),
  removeLeader: (id: string) => api.delete(`/management-tasks/leaders/${id}`),
  
  // Miembros de área
  getAreaMembers: (institutionId: string, area?: string) => api.get('/management-tasks/area-members', { params: { institutionId, area } }),
  addAreaMember: (data: { institutionId: string; userId: string; area: string }) => api.post('/management-tasks/area-members', data),
  removeAreaMember: (id: string) => api.delete(`/management-tasks/area-members/${id}`),
  
  // Tareas
  getTasks: (institutionId: string, filters?: { status?: string; priority?: string; category?: string }) => 
    api.get('/management-tasks', { params: { institutionId, ...filters } }),
  getTask: (id: string) => api.get(`/management-tasks/${id}`),
  createTask: (data: { institutionId: string; title: string; description?: string; category: string; priority?: string; dueDate?: string; assigneeIds: string[] }) => 
    api.post('/management-tasks', data),
  updateTask: (id: string, data: { title?: string; description?: string; category?: string; priority?: string; dueDate?: string }) => 
    api.put(`/management-tasks/${id}`, data),
  deleteTask: (id: string) => api.delete(`/management-tasks/${id}`),
  
  // Mis tareas (docente)
  getMyTasks: (status?: string) => api.get('/management-tasks/my-tasks', { params: { status } }),
  getMyPendingCount: () => api.get('/management-tasks/my-pending-count'),
  
  // Verificaciones pendientes
  getPendingVerifications: (institutionId: string) => api.get('/management-tasks/pending-verifications', { params: { institutionId } }),
  
  // Acciones del docente
  startTask: (assignmentId: string) => api.post(`/management-tasks/assignments/${assignmentId}/start`),
  submitEvidence: (assignmentId: string, formData: FormData) => api.post(`/management-tasks/assignments/${assignmentId}/submit`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  completeTask: (assignmentId: string, responseNote?: string) => api.post(`/management-tasks/assignments/${assignmentId}/complete`, { responseNote }),
  
  // Verificación (coordinador/líder)
  verifyTask: (assignmentId: string, data: { status: 'APPROVED' | 'REJECTED'; verificationNote?: string }) => 
    api.post(`/management-tasks/assignments/${assignmentId}/verify`, data),
  
  // Enums
  getEnums: () => api.get('/management-tasks/enums'),
}

// ═══════════════════════════════════════════════════════════════════════════
// PLANTILLAS ACADÉMICAS
// ═══════════════════════════════════════════════════════════════════════════

export const academicTemplatesApi = {
  // Plantillas (filtradas por año académico)
  getAll: (institutionId: string, academicYearId: string, level?: string, includeInactive?: boolean) => 
    api.get('/academic-templates', { params: { institutionId, academicYearId, level, includeInactive } }),
  getOne: (id: string) => api.get(`/academic-templates/${id}`),
  create: (data: {
    institutionId: string;
    academicYearId: string;  // 🔥 REQUERIDO
    name: string;
    description?: string;
    level: string;
    isDefault?: boolean;
    achievementsPerPeriod?: number;
    useAttitudinalAchievement?: boolean;
  }) => api.post('/academic-templates', data),
  update: (id: string, data: {
    name?: string;
    description?: string;
    level?: string;
    isDefault?: boolean;
    isActive?: boolean;
    achievementsPerPeriod?: number;
    useAttitudinalAchievement?: boolean;
  }) => api.put(`/academic-templates/${id}`, data),
  delete: (id: string) => api.delete(`/academic-templates/${id}`),
  getEnums: () => api.get('/academic-templates/enums'),

  // Áreas en plantilla
  addArea: (templateId: string, data: {
    areaId: string;
    weightPercentage?: number;
    calculationType?: string;
    approvalRule?: string;
    recoveryRule?: string;
    isMandatory?: boolean;
    order?: number;
  }) => api.post(`/academic-templates/${templateId}/areas`, data),
  updateArea: (templateAreaId: string, data: {
    weightPercentage?: number;
    calculationType?: string;
    approvalRule?: string;
    recoveryRule?: string;
    isMandatory?: boolean;
    order?: number;
  }) => api.put(`/academic-templates/areas/${templateAreaId}`, data),
  removeArea: (templateAreaId: string) => api.delete(`/academic-templates/areas/${templateAreaId}`),

  // Asignaturas en plantilla
  addSubject: (templateAreaId: string, data: {
    subjectId: string;
    weeklyHours?: number;
    weightPercentage?: number;
    isDominant?: boolean;
    order?: number;
    achievementsPerPeriod?: number;
    useAttitudinalAchievement?: boolean;
  }) => api.post(`/academic-templates/areas/${templateAreaId}/subjects`, data),
  updateSubject: (templateSubjectId: string, data: {
    weeklyHours?: number;
    weightPercentage?: number;
    isDominant?: boolean;
    order?: number;
    achievementsPerPeriod?: number | null;
    useAttitudinalAchievement?: boolean | null;
  }) => api.put(`/academic-templates/subjects/${templateSubjectId}`, data),
  removeSubject: (templateSubjectId: string, force = false) => api.delete(`/academic-templates/subjects/${templateSubjectId}${force ? '?force=true' : ''}`),

  // Asignación a grados (por año académico)
  assignToGrade: (gradeId: string, templateId: string, academicYearId: string, overrides?: any) =>
    api.post(`/academic-templates/grades/${gradeId}/assign`, { templateId, academicYearId, overrides }),
  // Asistente Plan de Estudios: crea catálogo + plantilla + asignación en una llamada
  quickSetup: (data: {
    institutionId: string;
    academicYearId: string;
    gradeId: string;
    areas: Array<{
      areaId?: string;
      newAreaName?: string;
      subjects: Array<{ subjectId?: string; newSubjectName?: string; weeklyHours: number; subjectType?: string }>;
    }>;
  }) => api.post('/academic-templates/quick-setup', data),
  syncFromAssignments: (gradeId: string, academicYearId: string) =>
    api.post(`/academic-templates/grades/${gradeId}/sync-from-assignments`, { academicYearId }),
  removeFromGrade: (gradeId: string, academicYearId: string) => 
    api.delete(`/academic-templates/grades/${gradeId}/assign`, { params: { academicYearId } }),
  getGradeTemplate: (gradeId: string, academicYearId: string) => 
    api.get(`/academic-templates/grades/${gradeId}`, { params: { academicYearId } }),
  listGradesWithTemplates: (institutionId: string, academicYearId: string) => 
    api.get('/academic-templates/grades', { params: { institutionId, academicYearId } }),

  // Excepciones por grupo (por año académico)
  addGroupException: (groupId: string, data: {
    subjectId: string;
    academicYearId: string;  // 🔥 REQUERIDO
    type: 'EXCLUDE' | 'INCLUDE' | 'MODIFY';
    weeklyHours?: number;
    weightPercentage?: number;
    reason?: string;
  }) => api.post(`/academic-templates/groups/${groupId}/exceptions`, data),
  removeGroupException: (groupId: string, subjectId: string, academicYearId: string) => 
    api.delete(`/academic-templates/groups/${groupId}/exceptions/${subjectId}`, { params: { academicYearId } }),
  getGroupExceptions: (groupId: string, academicYearId: string) => 
    api.get(`/academic-templates/groups/${groupId}/exceptions`, { params: { academicYearId } }),
  getEffectiveStructure: (groupId: string, academicYearId: string) => 
    api.get(`/academic-templates/groups/${groupId}/effective-structure`, { params: { academicYearId } }),
}

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO FINANCIERO
// ═══════════════════════════════════════════════════════════════════════════

export const financeDashboardApi = {
  get: () => api.get('/finance/dashboard'),
}

export const financeThirdPartiesApi = {
  getAll: (params?: { type?: string; search?: string; isActive?: string }) => 
    api.get('/finance/third-parties', { params }),
  getById: (id: string) => api.get(`/finance/third-parties/${id}`),
  getByType: (type: string) => api.get(`/finance/third-parties/by-type/${type}`),
  getSummary: (id: string) => api.get(`/finance/third-parties/${id}/summary`),
  create: (data: { type: string; name: string; document?: string; documentType?: string; email?: string; phone?: string; address?: string; businessName?: string; nit?: string; bankName?: string; bankAccount?: string; bankAccountType?: string; notes?: string; referenceId?: string }) => 
    api.post('/finance/third-parties', data),
  update: (id: string, data: any) => api.put(`/finance/third-parties/${id}`, data),
  delete: (id: string) => api.delete(`/finance/third-parties/${id}`),
  syncFromAcademic: (data: { syncStudents?: boolean; syncTeachers?: boolean; syncGuardians?: boolean }) => 
    api.post('/finance/third-parties/sync', data),
}

export const financeCategoriesApi = {
  getAll: (type?: string) => api.get('/finance/categories', { params: { type } }),
  getById: (id: string) => api.get(`/finance/categories/${id}`),
  create: (data: { name: string; description?: string; code?: string; type?: string; budgetAmount?: number; color?: string; icon?: string }) => 
    api.post('/finance/categories', data),
  update: (id: string, data: any) => api.put(`/finance/categories/${id}`, data),
  delete: (id: string) => api.delete(`/finance/categories/${id}`),
  seedDefaults: () => api.post('/finance/categories/seed-defaults'),
}

export const financeConceptsApi = {
  getAll: (params?: { categoryId?: string; isActive?: string; isMassive?: string }) => 
    api.get('/finance/concepts', { params }),
  getById: (id: string) => api.get(`/finance/concepts/${id}`),
  create: (data: { name: string; description?: string; categoryId: string; defaultAmount: number; isMassive?: boolean; isRecurring?: boolean; allowPartial?: boolean; allowDiscount?: boolean; validFrom?: string; validUntil?: string; dueDate?: string; lateFeeType?: string; lateFeeValue?: number; gracePeriodDays?: number }) => 
    api.post('/finance/concepts', data),
  update: (id: string, data: any) => api.put(`/finance/concepts/${id}`, data),
  delete: (id: string) => api.delete(`/finance/concepts/${id}`),
}

export const financeObligationsApi = {
  getAll: (params?: { thirdPartyId?: string; conceptId?: string; status?: string; gradeId?: string; groupId?: string; search?: string; page?: number; limit?: number }) => 
    api.get('/finance/obligations', { params }),
  getById: (id: string) => api.get(`/finance/obligations/${id}`),
  getStats: () => api.get('/finance/obligations/stats'),
  create: (data: { thirdPartyId: string; conceptId: string; amount?: number; discountAmount?: number; discountReason?: string; dueDate?: string; notes?: string }) => 
    api.post('/finance/obligations', data),
  createMassive: (data: { conceptId: string; targetType: 'GRADE' | 'GROUP' | 'STUDENTS'; targetIds: string[]; amount?: number; discountAmount?: number; discountReason?: string; dueDate?: string }) => 
    api.post('/finance/obligations/massive', data),
  applyDiscount: (id: string, data: { discountAmount: number; discountReason: string }) => 
    api.put(`/finance/obligations/${id}/discount`, data),
  cancel: (id: string, reason: string) => 
    api.put(`/finance/obligations/${id}/cancel`, { reason }),
}

export const financePaymentsApi = {
  getAll: (params?: { thirdPartyId?: string; obligationId?: string; paymentMethod?: string }) => 
    api.get('/finance/payments', { params }),
  getById: (id: string) => api.get(`/finance/payments/${id}`),
  getStats: (params?: { dateFrom?: string; dateTo?: string }) => 
    api.get('/finance/payments/stats', { params }),
  create: (data: { thirdPartyId: string; obligationId?: string; amount: number; paymentMethod: string; transactionRef?: string; notes?: string }) => 
    api.post('/finance/payments', data),
  void: (id: string, reason: string) => 
    api.put(`/finance/payments/${id}/void`, { reason }),
  closeRegister: (data: { closeDate: string; physicalCash?: number; notes?: string }) => 
    api.post('/finance/payments/close-register', data),
  downloadReceipt: (id: string) => 
    api.get(`/finance/payments/${id}/receipt`, { responseType: 'blob' }),
}

export const financeExpensesApi = {
  getAll: (params?: { categoryId?: string; providerId?: string; dateFrom?: string; dateTo?: string }) => 
    api.get('/finance/expenses', { params }),
  getById: (id: string) => api.get(`/finance/expenses/${id}`),
  create: (data: { categoryId: string; providerId?: string; description: string; amount: number; expenseDate?: string; invoiceNumber?: string; invoiceDate?: string; paymentMethod?: string; transactionRef?: string; notes?: string }) => 
    api.post('/finance/expenses', data),
  approve: (id: string) => api.put(`/finance/expenses/${id}/approve`),
  void: (id: string, reason: string) => 
    api.put(`/finance/expenses/${id}/void`, { reason }),
}

export const financeInvoicesApi = {
  getAll: (params?: { thirdPartyId?: string; status?: string; type?: string }) => 
    api.get('/finance/invoices', { params }),
  getById: (id: string) => api.get(`/finance/invoices/${id}`),
  create: (data: { thirdPartyId: string; type: 'INCOME' | 'EXPENSE'; items: Array<{ description: string; quantity: number; unitPrice: number; obligationId?: string }>; dueDate?: string; notes?: string }) => 
    api.post('/finance/invoices', data),
  issue: (id: string) => api.put(`/finance/invoices/${id}/issue`),
  cancel: (id: string, reason: string) => 
    api.put(`/finance/invoices/${id}/cancel`, { reason }),
  downloadPdf: (id: string) => 
    api.get(`/finance/invoices/${id}/pdf`, { responseType: 'blob' }),
}

export const financeReportsApi = {
  getPortfolioByGrade: () => api.get('/finance/reports/portfolio-by-grade'),
  getTopDebtors: (limit?: number) => api.get('/finance/reports/top-debtors', { params: { limit } }),
  getMonthlyBalance: (year: number) => api.get('/finance/reports/monthly-balance', { params: { year } }),
  getProfitabilityByConcept: () => api.get('/finance/reports/profitability'),
  getStudentHistory: (studentId: string) => api.get(`/finance/reports/student/${studentId}`),
}

export const financeSettingsApi = {
  get: () => api.get('/finance/settings'),
  update: (data: { invoicePrefix?: string; receiptPrefix?: string; defaultLateFeeType?: string; defaultLateFeeValue?: number; defaultGracePeriodDays?: number; taxId?: string; taxRegime?: string; bankAccounts?: any; sendPaymentReminders?: boolean; reminderDaysBefore?: number; invoiceLogoUrl?: string; invoiceResolution?: string; invoiceResolutionDate?: string; invoiceRangeFrom?: number; invoiceRangeTo?: number; invoiceFooterText?: string; invoicePageSize?: string; invoiceCity?: string; invoicePhone?: string; invoiceEmail?: string; economicActivity?: string }) => 
    api.put('/finance/settings', data),
}

// ═══════════════════════════════════════════════════════════════
// TIMETABLING (HORARIOS)
// ═══════════════════════════════════════════════════════════════

export const timetablingTimeBlocksApi = {
  getAll: (shiftId?: string) => api.get('/timetabling/time-blocks', { params: { shiftId } }),
  getById: (id: string) => api.get(`/timetabling/time-blocks/${id}`),
  create: (data: { shiftId: string; type?: string; startTime: string; endTime: string; order: number; label?: string }) =>
    api.post('/timetabling/time-blocks', data),
  bulkCreate: (data: { shiftId: string; blocks: Array<{ type?: string; startTime: string; endTime: string; order: number; label?: string }> }) =>
    api.post('/timetabling/time-blocks/bulk', data),
  update: (id: string, data: { type?: string; startTime?: string; endTime?: string; order?: number; label?: string }) =>
    api.put(`/timetabling/time-blocks/${id}`, data),
  delete: (id: string) => api.delete(`/timetabling/time-blocks/${id}`),
}

export const timetablingRoomsApi = {
  getAll: (campusId?: string) => api.get('/timetabling/rooms', { params: { campusId } }),
  getById: (id: string) => api.get(`/timetabling/rooms/${id}`),
  create: (data: { campusId?: string; name: string; code?: string; capacity?: number; description?: string; equipment?: string[]; isReservable?: boolean }) =>
    api.post('/timetabling/rooms', data),
  update: (id: string, data: { campusId?: string; name?: string; code?: string; capacity?: number; description?: string; equipment?: string[]; isReservable?: boolean; isActive?: boolean }) =>
    api.put(`/timetabling/rooms/${id}`, data),
  delete: (id: string) => api.delete(`/timetabling/rooms/${id}`),
  addRestriction: (roomId: string, data: { subjectId?: string; type?: string }) =>
    api.post(`/timetabling/rooms/${roomId}/restrictions`, data),
  removeRestriction: (restrictionId: string) =>
    api.delete(`/timetabling/rooms/restrictions/${restrictionId}`),
}

export const timetablingConfigApi = {
  getAll: (academicYearId: string) => api.get('/timetabling/schedule-config', { params: { academicYearId } }),
  upsert: (data: { academicYearId: string; gradeId: string; mode?: string; maxConsecutiveHours?: number; preferDistribution?: boolean; avoidHeavyLastHours?: boolean; allowDoubleBlocks?: boolean }) =>
    api.post('/timetabling/schedule-config', data),
  bulkUpsert: (data: { academicYearId: string; configs: Array<{ gradeId: string; mode?: string; maxConsecutiveHours?: number; preferDistribution?: boolean; avoidHeavyLastHours?: boolean; allowDoubleBlocks?: boolean }> }) =>
    api.post('/timetabling/schedule-config/bulk', data),
  delete: (id: string) => api.delete(`/timetabling/schedule-config/${id}`),
}

export const timetablingAvailabilityApi = {
  getAll: (academicYearId: string, teacherId?: string) =>
    api.get('/timetabling/teacher-availability', { params: { academicYearId, teacherId } }),
  upsert: (data: { academicYearId: string; teacherId: string; dayOfWeek: string; startTime: string; endTime: string; isAvailable?: boolean; reason?: string }) =>
    api.post('/timetabling/teacher-availability', data),
  bulkSet: (data: { academicYearId: string; teacherId: string; entries: Array<{ dayOfWeek: string; startTime: string; endTime: string; isAvailable?: boolean; reason?: string }> }) =>
    api.post('/timetabling/teacher-availability/bulk', data),
  delete: (id: string) => api.delete(`/timetabling/teacher-availability/${id}`),
}

export const timetablingEntriesApi = {
  getGrid: (academicYearId: string, groupId: string) =>
    api.get('/timetabling/schedule-entries/grid', { params: { academicYearId, groupId } }),
  getByGroup: (academicYearId: string, groupId: string) =>
    api.get('/timetabling/schedule-entries/by-group', { params: { academicYearId, groupId } }),
  getByTeacher: (academicYearId: string, teacherId: string) =>
    api.get('/timetabling/schedule-entries/by-teacher', { params: { academicYearId, teacherId } }),
  getByRoom: (academicYearId: string, roomId: string) =>
    api.get('/timetabling/schedule-entries/by-room', { params: { academicYearId, roomId } }),
  getConflicts: (academicYearId: string, groupId?: string) =>
    api.get('/timetabling/schedule-entries/conflicts', { params: { academicYearId, groupId } }),
  create: (data: { academicYearId: string; groupId: string; timeBlockId: string; dayOfWeek: string; teacherAssignmentId?: string; projectName?: string; projectDescription?: string; roomId?: string; notes?: string; color?: string }) =>
    api.post('/timetabling/schedule-entries', data),
  update: (id: string, data: { timeBlockId?: string; dayOfWeek?: string; teacherAssignmentId?: string | null; projectName?: string | null; projectDescription?: string | null; roomId?: string | null; notes?: string | null; color?: string | null }) =>
    api.put(`/timetabling/schedule-entries/${id}`, data),
  swap: (entryAId: string, entryBId: string) =>
    api.post('/timetabling/schedule-entries/swap', { entryAId, entryBId }),
  delete: (id: string) => api.delete(`/timetabling/schedule-entries/${id}`),
  clearGroup: (groupId: string, academicYearId: string) =>
    api.delete(`/timetabling/schedule-entries/clear/${groupId}`, { params: { academicYearId } }),
}

// ═══════════════════════════════════════════════════════════════
// HORARIO PERSONAL DEL DOCENTE (agenda propia, manual, solo visual)
// Distinto del horario institucional (timetablingEntriesApi).
// ═══════════════════════════════════════════════════════════════

export type TeacherScheduleBlockType = 'CLASE' | 'TUTORIA' | 'ATENCION_PADRES' | 'REUNION_AREA' | 'OTRO'

export interface TeacherScheduleBlock {
  id: string
  dayOfWeek: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY'
  startTime: string // "07:00"
  endTime: string   // "07:45"
  type: TeacherScheduleBlockType
  title: string
  location?: string | null
  color?: string | null
  notes?: string | null
}

export type TeacherScheduleBlockInput = Omit<TeacherScheduleBlock, 'id'>

export const teacherScheduleApi = {
  getAll: () => api.get<TeacherScheduleBlock[]>('/teacher-schedule'),
  create: (data: TeacherScheduleBlockInput) => api.post<TeacherScheduleBlock>('/teacher-schedule', data),
  update: (id: string, data: Partial<TeacherScheduleBlockInput>) =>
    api.put<TeacherScheduleBlock>(`/teacher-schedule/${id}`, data),
  remove: (id: string) => api.delete(`/teacher-schedule/${id}`),
}

// ═══════════════════════════════════════════════════════════════
// TIMETABLING - GENERADOR DE HORARIOS
// ═══════════════════════════════════════════════════════════════

export const timetablingGeneratorApi = {
  // Contexto persistente de generación (por jornada)
  getContext: (academicYearId: string, shiftId: string) =>
    api.get('/timetabling/generator/context', { params: { academicYearId, shiftId } }),
  saveContext: (data: {
    academicYearId: string;
    shiftId: string;
    lastStep?: string;
    startTime?: string;
    classesPerDay?: number;
    classDurationMinutes?: number;
    breakDurationMinutes?: number;
    breakAfterBlock?: number;
    secondBreakAfterBlock?: number;
    includeLunch?: boolean;
    lunchDurationMinutes?: number;
    lunchAfterBlock?: number;
    includeTutoring?: boolean;
    tutoringDurationMinutes?: number;
    activeDays?: string[];
    clearExisting?: boolean;
    respectAvailability?: boolean;
    groupTeacherBlocks?: boolean;
    selectedGroupIds?: string[];
    lastGenerationResult?: any;
    configSaved?: boolean;
  }) => api.post('/timetabling/generator/context', data),
  // Jornadas disponibles
  getShifts: () =>
    api.get('/timetabling/generator/shifts'),
  downloadTemplate: (academicYearId: string) =>
    api.get('/timetabling/generator/template', {
      params: { academicYearId },
      responseType: 'blob',
    }),
  importTeachingLoad: (academicYearId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('academicYearId', academicYearId);
    return api.post('/timetabling/generator/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  generateSchedule: (data: {
    academicYearId: string;
    shiftId?: string;
    groupIds?: string[];
    clearExisting?: boolean;
    respectAvailability?: boolean;
    groupTeacherBlocks?: boolean;
    activeDays?: string[];
  }) => api.post('/timetabling/generator/generate', data),
  exportSchedule: (academicYearId: string, viewType: 'by-group' | 'by-teacher' = 'by-group') =>
    api.get('/timetabling/generator/export', {
      params: { academicYearId, viewType },
      responseType: 'blob',
    }),
  getTeachingLoad: (academicYearId: string, shiftId?: string) =>
    api.get('/timetabling/generator/teaching-load', { params: { academicYearId, ...(shiftId ? { shiftId } : {}) } }),
  getScheduleViews: (academicYearId: string, view: 'total' | 'by-grade' | 'by-teacher' | 'by-subject' | 'by-area' = 'total', filterId?: string, shiftId?: string) =>
    api.get('/timetabling/generator/schedule-views', { params: { academicYearId, view, ...(filterId ? { filterId } : {}), ...(shiftId ? { shiftId } : {}) } }),
  autoPlace: (academicYearId: string, shiftId?: string) =>
    api.post('/timetabling/generator/auto-place', { academicYearId, ...(shiftId ? { shiftId } : {}) }),
  deleteTeachingLoad: (academicYearId: string, confirmDelete?: boolean) =>
    api.post('/timetabling/generator/delete-teaching-load', { academicYearId, ...(confirmDelete ? { confirmDelete } : {}) }),
  checkFeasibility: (academicYearId: string, shiftId?: string) =>
    api.get('/timetabling/generator/feasibility-check', { params: { academicYearId, ...(shiftId ? { shiftId } : {}) } }),
  getScheduleConfig: (shiftId?: string) =>
    api.get('/timetabling/generator/schedule-config', { params: { ...(shiftId ? { shiftId } : {}) } }),
  configureSchedule: (data: {
    shiftId?: string;
    startTime: string;
    classesPerDay: number;
    classDuration: number;
    breakDuration: number;
    breakAfterBlock: number;
    secondBreakAfterBlock?: number;
    includeLunch: boolean;
    lunchDuration: number;
    lunchAfterBlock: number;
    includeTutoring: boolean;
    tutoringDuration: number;
    activeDays: string[];
  }) => api.post('/timetabling/generator/configure-schedule', data),
  exportSchedulePdf: (academicYearId: string, viewType: 'by-group' | 'by-teacher' = 'by-group') =>
    api.get('/timetabling/generator/export-pdf', {
      params: { academicYearId, viewType },
      responseType: 'blob',
    }),
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPABILITIES (Permisos de visualización por rol)
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// BANCO DE LOGROS (Achievement Bank)
// ═══════════════════════════════════════════════════════════════════════════

export const achievementBankApi = {
  search: (params?: {
    subjectId?: string; areaId?: string; gradeId?: string;
    achievementType?: string; performanceLevel?: string;
    category?: string; query?: string; page?: number; limit?: number;
  }) => api.get('/achievement-bank', { params }),
  getCategories: () => api.get('/achievement-bank/categories'),
  create: (data: {
    description: string; subjectId?: string; areaId?: string; gradeId?: string;
    achievementType?: string; performanceLevel?: string;
    category?: string; tags?: string; isShared?: boolean;
  }) => api.post('/achievement-bank', data),
  bulkCreate: (entries: Array<{
    description: string; subjectId?: string; areaId?: string; gradeId?: string;
    achievementType?: string; performanceLevel?: string;
    category?: string; tags?: string; isShared?: boolean;
  }>) => api.post('/achievement-bank/bulk', { entries }),
  update: (id: string, data: any) => api.put(`/achievement-bank/${id}`, data),
  delete: (id: string) => api.delete(`/achievement-bank/${id}`),
  markUsed: (id: string) => api.post(`/achievement-bank/${id}/use`),
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTES FINALES (Pruebas Semestrales, Proyecto Final, etc.)
// ═══════════════════════════════════════════════════════════════════════════

export const finalComponentsApi = {
  getByAcademicYear: (academicYearId: string) =>
    api.get('/final-components', { params: { academicYearId } }),
  create: (data: { academicYearId: string; name: string; weightPercentage: number; order: number }) =>
    api.post('/final-components', data),
  sync: (academicYearId: string, components: Array<{ id?: string; name: string; weightPercentage: number; order: number }>) =>
    api.post('/final-components/sync', { academicYearId, components }),
  update: (id: string, data: { name?: string; weightPercentage?: number; order?: number }) =>
    api.put(`/final-components/${id}`, data),
  toggleOpen: (id: string, isOpen: boolean) =>
    api.put(`/final-components/${id}/toggle-open`, { isOpen }),
  delete: (id: string) => api.delete(`/final-components/${id}`),
}

export const finalComponentGradesApi = {
  getByComponent: (finalComponentId: string, teacherAssignmentId: string) =>
    api.get('/final-component-grades', { params: { finalComponentId, teacherAssignmentId } }),
  getByStudent: (studentEnrollmentId: string, academicYearId: string) =>
    api.get('/final-component-grades/student', { params: { studentEnrollmentId, academicYearId } }),
  upsert: (data: { studentEnrollmentId: string; teacherAssignmentId: string; finalComponentId: string; grade: number }) =>
    api.post('/final-component-grades/upsert', data),
  bulkUpsert: (grades: Array<{ studentEnrollmentId: string; teacherAssignmentId: string; finalComponentId: string; grade: number }>) =>
    api.post('/final-component-grades/bulk-upsert', grades),
  delete: (id: string) => api.delete(`/final-component-grades/${id}`),
}

export const capabilitiesApi = {
  getMyCapabilities: () =>
    api.get('/capabilities/my-capabilities'),
  getMatrix: (institutionId: string) =>
    api.get(`/capabilities/matrix/${institutionId}`),
  updateMatrix: (institutionId: string, updates: Array<{ role: string; capabilityKey: string; isEnabled: boolean }>) =>
    api.put(`/capabilities/matrix/${institutionId}`, { updates }),
  resetToDefaults: (institutionId: string) =>
    api.post(`/capabilities/matrix/${institutionId}/reset`),
  checkCapability: (capabilityKey: string) =>
    api.get(`/capabilities/check/${capabilityKey}`),
}

// ============================================
// ACOMPAÑAMIENTO PEDAGÓGICO (DIMENSIONS)
// ============================================

export const pedagogicalSupportApi = {
  create: (data: {
    studentEnrollmentId: string;
    achievementId?: string;
    academicTermId: string;
    supportStrategy: string;
    familyCommitment?: string;
    followUpDate?: string;
    observations?: string;
  }) => api.post('/pedagogical-support', data),
  update: (id: string, data: {
    supportStrategy?: string;
    familyCommitment?: string;
    followUpDate?: string;
    observations?: string;
    status?: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  }) => api.patch(`/pedagogical-support/${id}`, data),
  markCompleted: (id: string, observations?: string) =>
    api.patch(`/pedagogical-support/${id}/complete`, { observations }),
  getByStudent: (studentEnrollmentId: string, academicTermId?: string) =>
    api.get(`/pedagogical-support/by-student/${studentEnrollmentId}`, { params: { academicTermId } }),
  getByGroup: (groupId: string, academicTermId: string, status?: string) =>
    api.get(`/pedagogical-support/by-group/${groupId}`, { params: { academicTermId, status } }),
  getById: (id: string) => api.get(`/pedagogical-support/${id}`),
}

// ============================================
// APD — ACOMPAÑAMIENTO PEDAGÓGICO DIFERENCIAL
// ============================================

export const apdApi = {
  // Configuración institucional
  getConfig: () => api.get('/apd/config'),
  updateConfig: (data: { enableDifferentialSupport?: boolean; allowTeacherAccess?: boolean }) =>
    api.put('/apd/config', data),

  // Perfiles de acompañamiento
  createProfile: (data: {
    studentId: string;
    supportCategory: string;
    supportCategoryId?: string;
    pedagogicalNotes?: string;
    learningBarriers?: string;
    strengths?: string;
    supportNeeds?: string;
    learningStyleObservations?: string;
    parentConsentAccepted?: boolean;
    consentDate?: string;
    consentDocumentUrl?: string;
  }) => api.post('/apd/profiles', data),
  updateProfile: (id: string, data: {
    supportCategory?: string;
    supportCategoryId?: string;
    pedagogicalNotes?: string;
    learningBarriers?: string;
    strengths?: string;
    supportNeeds?: string;
    learningStyleObservations?: string;
    parentConsentAccepted?: boolean;
    consentDate?: string;
    consentDocumentUrl?: string;
    active?: boolean;
  }) => api.put(`/apd/profiles/${id}`, data),
  getProfile: (id: string) => api.get(`/apd/profiles/${id}`),
  getProfileByStudent: (studentId: string) => api.get(`/apd/profiles/by-student/${studentId}`),
  getProfiles: (params?: { active?: string; search?: string }) =>
    api.get('/apd/profiles', { params }),

  // Planes de acompañamiento (APD extendido)
  createPlan: (data: {
    studentEnrollmentId: string;
    academicTermId: string;
    supportProfileId?: string;
    achievementId?: string;
    planType?: 'APD' | 'PIAR';
    supportStrategy: string;
    familyCommitment?: string;
    followUpDate?: string;
    observations?: string;
    objectives?: any;
    adaptationStrategies?: any;
    evaluationAdjustments?: any;
    planApprovedByFamily?: boolean;
    familyApprovalDate?: string;
    familySignatureUrl?: string;
  }) => api.post('/apd/plans', data),
  updatePlan: (id: string, data: {
    planType?: 'APD' | 'PIAR';
    supportStrategy?: string;
    familyCommitment?: string;
    followUpDate?: string;
    observations?: string;
    objectives?: any;
    adaptationStrategies?: any;
    evaluationAdjustments?: any;
    planApprovedByFamily?: boolean;
    familyApprovalDate?: string;
    familySignatureUrl?: string;
    status?: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  }) => api.put(`/apd/plans/${id}`, data),
  getPlan: (id: string) => api.get(`/apd/plans/${id}`),

  // Actividades
  createActivity: (data: {
    supportPlanId: string;
    topic: string;
    originalActivityDescription?: string;
    teacherFinalActivity?: string;
    adaptationLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
    adjustmentType?: 'CURRICULAR' | 'METHODOLOGICAL' | 'EVALUATIVE' | 'COMMUNICATION' | 'ENVIRONMENTAL';
  }) => api.post('/apd/activities', data),
  updateActivity: (id: string, data: {
    topic?: string;
    originalActivityDescription?: string;
    teacherFinalActivity?: string;
    adaptationLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
    adjustmentType?: 'CURRICULAR' | 'METHODOLOGICAL' | 'EVALUATIVE' | 'COMMUNICATION' | 'ENVIRONMENTAL';
    completionStatus?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
    teacherFeedback?: string;
    studentPerformanceScore?: number;
  }) => api.put(`/apd/activities/${id}`, data),

  // Logs de progreso
  createProgressLog: (data: {
    supportPlanId: string;
    progressIndicator: number;
    qualitativeObservation?: string;
  }) => api.post('/apd/progress-logs', data),

  // Categorías de acompañamiento (configurables por institución)
  getCategories: () => api.get('/apd/categories'),
  createCategory: (data: { name: string; description?: string; sortOrder?: number }) =>
    api.post('/apd/categories', data),
  updateCategory: (id: string, data: { name?: string; description?: string; active?: boolean; sortOrder?: number }) =>
    api.put(`/apd/categories/${id}`, data),

  // Participantes del plan (equipo interdisciplinario)
  addParticipant: (data: {
    supportPlanId: string;
    userId?: string;
    role: 'TEACHER' | 'COUNSELOR' | 'COORDINATOR' | 'FAMILY_MEMBER' | 'EXTERNAL_SPECIALIST';
    fullName?: string;
    relationship?: string;
    observations?: string;
  }) => api.post('/apd/participants', data),
  removeParticipant: (id: string) => api.delete(`/apd/participants/${id}`),
  signParticipant: (id: string, data: { signatureUrl?: string }) =>
    api.put(`/apd/participants/${id}/sign`, data),

  // Asignaturas vinculadas al plan
  addPlanSubject: (data: {
    supportPlanId: string;
    subjectId: string;
    teacherId?: string;
    specificNotes?: string;
  }) => api.post('/apd/plan-subjects', data),
  removePlanSubject: (id: string) => api.delete(`/apd/plan-subjects/${id}`),

  // Documentos de soporte
  addDocument: (data: {
    supportPlanId: string;
    type: 'EVIDENCE' | 'FAMILY_DOCUMENT' | 'ASSESSMENT' | 'REPORT';
    fileName: string;
    fileUrl: string;
    description?: string;
  }) => api.post('/apd/documents', data),
  removeDocument: (id: string) => api.delete(`/apd/documents/${id}`),

  // Reportes APD/PIAR
  getReportByCategory: () => api.get('/apd/reports/category'),
  getReportProgress: () => api.get('/apd/reports/progress'),
  getReportByGrade: () => api.get('/apd/reports/grades'),
  getReportAtRisk: () => api.get('/apd/reports/at-risk'),

  // Índice de inclusión
  getInclusionIndex: () => api.get('/apd/inclusion-index'),

  // Estadísticas de diagnóstico (funnel: diagnóstico → perfil → plan)
  getDiagnosisStats: () => api.get('/apd/diagnosis-stats'),

  // Alertas automáticas
  getAlerts: () => api.get('/apd/alerts'),

  // Cruce rendimiento académico vs APD
  getAcademicCrossover: (academicTermId?: string) =>
    api.get('/apd/academic-crossover', { params: { academicTermId } }),

  // Valeria AI
  askValeria: (data: {
    institutionId?: string;
    question: string;
    conversation?: {
      role: 'user' | 'assistant';
      content: string;
    }[];
    context?: {
      institutionName?: string;
      pageName?: string;
      pageSummary?: string;
      currentPath?: string;
      gradeName?: string;
      subjectName?: string;
      topic?: string;
      activityType?: 'QUIZ' | 'EXAM' | 'GUIDE' | 'ACHIEVEMENT' | 'GENERAL';
      details?: string;
    };
    includeVisuals?: boolean;
    visualPlacement?: 'QUESTION_IMAGE' | 'CONTEXT_IMAGE' | 'INLINE';
  }) => api.post('/apd/ai/valeria', data),
};

// Teacher Workspace
export const teacherWorkspaceApi = {
  // Dashboard "Centro del día"
  getToday: () => api.get('/teacher-workspace/today'),
  getPersonalSpace: () => api.get('/teacher-workspace/personal-space'),
  globalSearch: (q: string) => api.get('/teacher-workspace/search', { params: { q } }),

  // Calendario
  listEvents: (params?: { from?: string; to?: string }) => api.get('/teacher-workspace/events', { params }),
  createEvent: (data: { title: string; date: string; type?: string; boardId?: string; itemId?: string; allDay?: boolean }) =>
    api.post('/teacher-workspace/events', data),
  updateEvent: (id: string, data: { title?: string; date?: string; type?: string; done?: boolean; isArchived?: boolean }) =>
    api.patch(`/teacher-workspace/events/${id}`, data),
  deleteEvent: (id: string) => api.delete(`/teacher-workspace/events/${id}`),

  // Seguimientos
  listFollowUps: (params?: { status?: string; boardId?: string; includeResolved?: string }) =>
    api.get('/teacher-workspace/follow-ups', { params }),
  createFollowUp: (data: { title: string; notes?: string; dueDate?: string; boardId?: string; sourceType?: string; sourceItemId?: string; studentId?: string }) =>
    api.post('/teacher-workspace/follow-ups', data),
  updateFollowUp: (id: string, data: { title?: string; notes?: string; dueDate?: string | null; status?: string; isArchived?: boolean }) =>
    api.patch(`/teacher-workspace/follow-ups/${id}`, data),
  deleteFollowUp: (id: string) => api.delete(`/teacher-workspace/follow-ups/${id}`),

  // Boards
  listBoards: (params?: { type?: string; groupId?: string; isArchived?: string }) =>
    api.get('/teacher-workspace/boards', { params }),
  getBoard: (id: string) => api.get(`/teacher-workspace/boards/${id}`),
  createBoard: (data: {
    type: string; title: string; description?: string; color?: string;
    scopeType?: string; metadata?: any; academicYearId?: string;
    groupId?: string; gradeId?: string; groupIds?: string[];
    startDate?: string; endDate?: string;
  }) => api.post('/teacher-workspace/boards', data),
  updateBoard: (id: string, data: { title?: string; description?: string; color?: string; metadata?: any; isArchived?: boolean; sortOrder?: number; emoji?: string; bannerColor?: string; coverImage?: string; isPinned?: boolean; enabledModules?: string[] }) =>
    api.put(`/teacher-workspace/boards/${id}`, data),
  deleteBoard: (id: string, force?: boolean) =>
    api.delete(`/teacher-workspace/boards/${id}`, force ? { params: { force: 'true' } } : undefined),

  // Scope, Populate, Summary, Students
  getScopeOptions: () => api.get('/teacher-workspace/scope-options'),
  populateBoard: (id: string) => api.post(`/teacher-workspace/boards/${id}/populate`),
  getBoardSummary: (id: string) => api.get(`/teacher-workspace/boards/${id}/summary`),
  searchStudents: (boardId: string, q: string) => api.get(`/teacher-workspace/boards/${boardId}/search-students`, { params: { q } }),
  addStudent: (boardId: string, studentRecordId: string) => api.post(`/teacher-workspace/boards/${boardId}/add-student`, { studentRecordId }),

  // Calendar
  getCalendarEvents: (from: string, to: string) =>
    api.get('/teacher-workspace/calendar', { params: { from, to } }),

  // Columns
  createColumn: (data: { boardId: string; title: string; color?: string }) =>
    api.post('/teacher-workspace/columns', data),
  updateColumn: (id: string, data: { title?: string; color?: string; sortOrder?: number }) =>
    api.put(`/teacher-workspace/columns/${id}`, data),
  deleteColumn: (id: string) => api.delete(`/teacher-workspace/columns/${id}`),

  // Proyecto (F10)
  listProjects: (boardId: string) => api.get('/teacher-workspace/projects', { params: { boardId } }),
  createProject: (data: { boardId: string; name: string; objective?: string; competencies?: string; startDate?: string; endDate?: string }) => api.post('/teacher-workspace/projects', data),
  getProject: (id: string) => api.get(`/teacher-workspace/projects/${id}`),
  updateProject: (id: string, data: any) => api.put(`/teacher-workspace/projects/${id}`, data),
  deleteProject: (id: string) => api.delete(`/teacher-workspace/projects/${id}`),
  addProjectTask: (id: string, data: { title: string; dueDate?: string }) => api.post(`/teacher-workspace/projects/${id}/tasks`, data),
  toggleProjectTask: (id: string) => api.patch(`/teacher-workspace/project-tasks/${id}/toggle`),
  deleteProjectTask: (id: string) => api.delete(`/teacher-workspace/project-tasks/${id}`),
  addProjectMember: (id: string, studentId: string) => api.post(`/teacher-workspace/projects/${id}/members`, { studentId }),
  removeProjectMember: (id: string) => api.delete(`/teacher-workspace/project-members/${id}`),

  // Biblioteca (F9)
  listResources: (boardId: string, folderId?: string) => api.get('/teacher-workspace/resources', { params: { boardId, folderId } }),
  createFolder: (data: { boardId: string; name: string }) => api.post('/teacher-workspace/resource-folders', data),
  deleteFolder: (id: string) => api.delete(`/teacher-workspace/resource-folders/${id}`),
  addResourceLink: (data: { boardId: string; name: string; url: string; folderId?: string; tags?: string[] }) => api.post('/teacher-workspace/resources/link', data),
  uploadResource: (formData: FormData) => api.post('/teacher-workspace/resources/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  downloadResource: (id: string) => api.get(`/teacher-workspace/resources/${id}/download`),
  updateResource: (id: string, data: { name?: string; folderId?: string | null; tags?: string[]; isFavorite?: boolean; isArchived?: boolean }) => api.patch(`/teacher-workspace/resources/${id}`, data),
  deleteResource: (id: string) => api.delete(`/teacher-workspace/resources/${id}`),

  // Roster + Roles (F7)
  getRoster: (boardId: string) => api.get(`/teacher-workspace/boards/${boardId}/roster`),
  listRoles: (boardId: string) => api.get('/teacher-workspace/roles', { params: { boardId } }),
  createRole: (data: { boardId: string; name: string; isCustom?: boolean }) => api.post('/teacher-workspace/roles', data),
  deleteRole: (id: string) => api.delete(`/teacher-workspace/roles/${id}`),
  assignRole: (roleId: string, studentId: string) => api.post(`/teacher-workspace/roles/${roleId}/assign`, { studentId }),
  unassignRole: (assignmentId: string) => api.delete(`/teacher-workspace/assignments/${assignmentId}`),

  // Recaudo (F6)
  listCollections: (boardId: string) => api.get('/teacher-workspace/collections', { params: { boardId } }),
  createCollection: (data: { boardId: string; name: string; description?: string; unitValue: number; dueDate?: string; assign?: 'ALL' | string[] }) =>
    api.post('/teacher-workspace/collections', data),
  getCollection: (id: string) => api.get(`/teacher-workspace/collections/${id}`),
  updateCollection: (id: string, data: { name?: string; description?: string; unitValue?: number; dueDate?: string | null; isArchived?: boolean }) =>
    api.put(`/teacher-workspace/collections/${id}`, data),
  deleteCollection: (id: string) => api.delete(`/teacher-workspace/collections/${id}`),
  addStudentsToCollection: (id: string, studentIds: string[]) => api.post(`/teacher-workspace/collections/${id}/students`, { studentIds }),
  addPayment: (chargeId: string, data: { amount: number; note?: string }) => api.post(`/teacher-workspace/charges/${chargeId}/payments`, data),
  deletePayment: (paymentId: string) => api.delete(`/teacher-workspace/payments/${paymentId}`),

  // Items
  createItem: (data: { boardId: string; columnId?: string; studentId?: string; title: string; content?: string; metadata?: any; dueDate?: string; eventDate?: string; entryType?: string; isImportant?: boolean; tags?: string[] }) =>
    api.post('/teacher-workspace/items', data),
  updateItem: (id: string, data: { columnId?: string; title?: string; content?: string; metadata?: any; status?: string; dueDate?: string | null; eventDate?: string | null; sortOrder?: number; isArchived?: boolean; entryType?: string; isImportant?: boolean; tags?: string[] }) =>
    api.put(`/teacher-workspace/items/${id}`, data),
  moveItem: (id: string, data: { columnId: string; sortOrder: number }) =>
    api.patch(`/teacher-workspace/items/${id}/move`, data),
  deleteItem: (id: string) => api.delete(`/teacher-workspace/items/${id}`),
}

// ═══════════════════════════════════════════════════════════════════════════
// DISEÑO PEDAGÓGICO IA ("Estudio")
// ═══════════════════════════════════════════════════════════════════════════
export const pedagogicalDesignApi = {
  generate: (data: { prompt: string; experienceType?: string; boardId?: string; gradeName?: string; subjectName?: string; sessions?: number }) =>
    api.post('/pedagogical-design/generate', data),
  list: (boardId?: string) => api.get('/pedagogical-design', { params: boardId ? { boardId } : undefined }),
  get: (id: string) => api.get(`/pedagogical-design/${id}`),
  update: (id: string, data: { title?: string; summary?: string; experienceType?: string; dna?: any; content?: any; changeNote?: string }) =>
    api.put(`/pedagogical-design/${id}`, data),
  delete: (id: string) => api.delete(`/pedagogical-design/${id}`),
}

// ═══════════════════════════════════════════════════════════════════════════
// AULA VIRTUAL
// ═══════════════════════════════════════════════════════════════════════════
export const classroomApi = {
  // Classrooms
  list: (role?: string) => api.get('/classrooms', { params: { role } }),
  getAvailableAssignments: () => api.get('/classrooms/available-assignments'),
  create: (data: { teacherAssignmentId: string; title?: string; description?: string; color?: string }) =>
    api.post('/classrooms', data),
  getById: (id: string) => api.get(`/classrooms/${id}`),
  update: (id: string, data: { title?: string; description?: string; color?: string; coverImage?: string; isActive?: boolean }) =>
    api.put(`/classrooms/${id}`, data),
  getStudents: (id: string) => api.get(`/classrooms/${id}/students`),

  // Sections
  createSection: (classroomId: string, data: { title: string; description?: string; academicTermId?: string | null }) =>
    api.post(`/classrooms/${classroomId}/sections`, data),
  updateSection: (sectionId: string, data: { title?: string; description?: string; isVisible?: boolean; sortOrder?: number; academicTermId?: string | null }) =>
    api.put(`/classrooms/sections/${sectionId}`, data),
  deleteSection: (sectionId: string, force = false) => api.delete(`/classrooms/sections/${sectionId}?force=${force}`),

  // Materials
  createMaterial: (sectionId: string, data: { type: string; title: string; content?: string; fileUrl?: string }) =>
    api.post(`/classrooms/sections/${sectionId}/materials`, data),
  updateMaterial: (materialId: string, data: { title?: string; content?: string; fileUrl?: string; isVisible?: boolean; sortOrder?: number }) =>
    api.put(`/classrooms/materials/${materialId}`, data),
  deleteMaterial: (materialId: string) => api.delete(`/classrooms/materials/${materialId}`),

  // Announcements
  createAnnouncement: (classroomId: string, data: { title: string; content: string; isPinned?: boolean; attachmentUrl?: string; attachmentName?: string }) =>
    api.post(`/classrooms/${classroomId}/announcements`, data),
  updateAnnouncement: (announcementId: string, data: { title?: string; content?: string; isPinned?: boolean; attachmentUrl?: string; attachmentName?: string }) =>
    api.put(`/classrooms/announcements/${announcementId}`, data),
  deleteAnnouncement: (announcementId: string) => api.delete(`/classrooms/announcements/${announcementId}`),
  copyAnnouncement: (announcementId: string, targetClassroomId: string) =>
    api.post(`/classrooms/announcements/${announcementId}/copy`, { targetClassroomId }),

  // Activities
  createActivity: (classroomId: string, data: {
    sectionId?: string | null; academicTermId?: string | null; type: string; title: string; description?: string;
    maxScore?: number; dueDate?: string; openDate?: string; allowLateSubmit?: boolean;
    attachmentUrl?: string; attachmentName?: string; rubricId?: string;
  }) => api.post(`/classrooms/${classroomId}/activities`, data),
  listActivities: (classroomId: string, role?: string) =>
    api.get(`/classrooms/${classroomId}/activities`, { params: { role } }),
  getActivity: (activityId: string, role?: string) =>
    api.get(`/classrooms/activities/${activityId}`, { params: { role } }),
  // Dependencias/prerrequisitos (Fase 4): reemplaza el conjunto de prerrequisitos.
  setActivityDependencies: (activityId: string, prerequisites: { prerequisiteId: string; condition?: string; minScore?: number | null }[]) =>
    api.put(`/classrooms/activities/${activityId}/dependencies`, { prerequisites }),
  // Reiniciar una lección para un estudiante puntual (docente).
  resetLessonForStudent: (activityId: string, studentEnrollmentId: string) =>
    api.post(`/classrooms/activities/${activityId}/lesson/reset`, { studentEnrollmentId }),
  updateActivity: (activityId: string, data: {
    title?: string; description?: string; maxScore?: number; dueDate?: string;
    openDate?: string; allowLateSubmit?: boolean; isVisible?: boolean;
    attachmentUrl?: string; attachmentName?: string;
  }) => api.put(`/classrooms/activities/${activityId}`, data),
  publishActivity: (activityId: string, body?: { scheduledPublishAt?: string }) =>
    api.put(`/classrooms/activities/${activityId}/publish`, body || {}),
  unpublishActivity: (activityId: string) =>
    api.put(`/classrooms/activities/${activityId}/unpublish`),
  assignStudentsToActivity: (activityId: string, data: { studentEnrollmentIds: string[]; isRestrictedToAssigned: boolean }) =>
    api.put(`/classrooms/activities/${activityId}/assign-students`, data),
  getActivityAssignments: (activityId: string) =>
    api.get(`/classrooms/activities/${activityId}/assignments`),
  getStudentsForAssignment: (classroomId: string) =>
    api.get(`/classrooms/${classroomId}/students-for-assignment`),
  deleteActivity: (activityId: string, force = false) => api.delete(`/classrooms/activities/${activityId}`, { params: force ? { force: 'true' } : {} }),

  // Submissions
  submitTask: (activityId: string, data: { content?: string; fileUrl?: string }) =>
    api.post(`/classrooms/activities/${activityId}/submit`, data),
  updateSubmission: (submissionId: string, data: { content?: string; fileUrl?: string }) =>
    api.put(`/classrooms/submissions/${submissionId}`, data),
  listSubmissions: (activityId: string) =>
    api.get(`/classrooms/activities/${activityId}/submissions`),
  getMySubmission: (activityId: string) =>
    api.get(`/classrooms/activities/${activityId}/my-submission`),
  getMyGrades: (classroomId: string) =>
    api.get(`/classrooms/${classroomId}/my-grades`),
  gradeSubmission: (submissionId: string, data: { score: number; feedback?: string }) =>
    api.put(`/classrooms/submissions/${submissionId}/grade`, data),
  returnSubmission: (submissionId: string, data: { feedback?: string }) =>
    api.put(`/classrooms/submissions/${submissionId}/return`, data),
  deleteSubmission: (submissionId: string) =>
    api.delete(`/classrooms/submissions/${submissionId}`),

  // Quiz / Exam – Question Contexts
  createContext: (activityId: string, data: { title?: string; text?: string; imageUrl?: string; viewPolicy?: string }) =>
    api.post(`/classrooms/activities/${activityId}/contexts`, data),
  listContexts: (activityId: string) =>
    api.get(`/classrooms/activities/${activityId}/contexts`),
  updateContext: (contextId: string, data: { title?: string; text?: string; imageUrl?: string; viewPolicy?: string }) =>
    api.put(`/classrooms/contexts/${contextId}`, data),
  deleteContext: (contextId: string) =>
    api.delete(`/classrooms/contexts/${contextId}`),

  // Quiz / Exam – Questions
  addQuestion: (activityId: string, data: any) =>
    api.post(`/classrooms/activities/${activityId}/questions`, data),
  listQuestions: (activityId: string) =>
    api.get(`/classrooms/activities/${activityId}/questions`),
  updateQuestion: (questionId: string, data: any) =>
    api.put(`/classrooms/questions/${questionId}`, data),
  deleteQuestion: (questionId: string) =>
    api.delete(`/classrooms/questions/${questionId}`),
  reorderQuestions: (activityId: string, questionIds: string[]) =>
    api.put(`/classrooms/activities/${activityId}/questions/reorder`, { questionIds }),

  // Quiz / Exam – Taking
  startQuiz: (activityId: string) =>
    api.post(`/classrooms/activities/${activityId}/start-quiz`),
  saveQuizAnswer: (submissionId: string, data: { questionId: string; answer?: string; selectedOptions?: any }) =>
    api.put(`/classrooms/submissions/${submissionId}/answer`, data),
  submitQuiz: (submissionId: string) =>
    api.post(`/classrooms/submissions/${submissionId}/submit-quiz`),
  getQuizResult: (submissionId: string) =>
    api.get(`/classrooms/submissions/${submissionId}/result`),

  // ICFES Simulator
  getIcfesResult: (submissionId: string) =>
    api.get(`/classrooms/submissions/${submissionId}/icfes-result`),
  getIcfesClassroomResults: (activityId: string) =>
    api.get(`/classrooms/activities/${activityId}/icfes-results`),

  // Forum
  createForumPost: (classroomId: string, data: { title: string; content: string; parentId?: string }) =>
    api.post(`/classrooms/${classroomId}/forum`, data),
  listForumPosts: (classroomId: string) => api.get(`/classrooms/${classroomId}/forum`),
  getForumPost: (postId: string) => api.get(`/classrooms/forum/${postId}`),
  togglePinForumPost: (postId: string) => api.put(`/classrooms/forum/${postId}/pin`),
  updateForumPost: (postId: string, data: { title?: string; content?: string }) => api.put(`/classrooms/forum/${postId}`, data),
  deleteForumPost: (postId: string) => api.delete(`/classrooms/forum/${postId}`),

  // File upload for classroom materials (documents, images)
  uploadMaterial: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/storage/upload/classroom-material', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  // Copy classroom & duplicate resources
  copyClassroomTo: (classroomId: string, targetTeacherAssignmentIds: string[]) =>
    api.post(`/classrooms/${classroomId}/copy-to`, { targetTeacherAssignmentIds }),
  listClassroomsForCopy: (classroomId: string) =>
    api.get(`/classrooms/${classroomId}/classrooms-for-copy`),
  duplicateMaterial: (materialId: string, targetSectionId: string) =>
    api.post(`/classrooms/materials/${materialId}/duplicate-to`, { targetSectionId }),
  duplicateActivity: (activityId: string, targetSectionId: string) =>
    api.post(`/classrooms/activities/${activityId}/duplicate-to`, { targetSectionId }),
  copySectionToClassroom: (sectionId: string, targetClassroomId: string) =>
    api.post(`/classrooms/sections/${sectionId}/copy-to`, { targetClassroomId }),

  // Gradebook sync
  getGradebookConfig: (classroomId: string) =>
    api.get(`/classrooms/${classroomId}/gradebook-config`),
  updateGradebookLink: (activityId: string, data: { syncToGradebook: boolean; gradebookComponent?: string; gradebookIndex?: number }) =>
    api.put(`/classrooms/activities/${activityId}/gradebook-link`, data),
  previewGradebookSync: (activityId: string, academicTermId?: string) =>
    api.get(`/classrooms/activities/${activityId}/sync-preview`, { params: academicTermId ? { academicTermId } : undefined }),
  syncToGradebook: (activityId: string, data: { studentEnrollmentIds?: string[]; includeConflicts?: boolean; includeNoSubmission?: boolean; academicTermId?: string }) =>
    api.post(`/classrooms/activities/${activityId}/sync-gradebook`, data),

  // ═══════════════════════════════════════════════════════════════════════════
  // EVALUACIÓN ACTITUDINAL (Autoevaluación, Coevaluación)
  // ═══════════════════════════════════════════════════════════════════════════

  // Rúbricas
  listRubrics: (type?: 'SELF_ASSESSMENT' | 'PEER_ASSESSMENT' | 'TEACHER_ASSESSMENT') =>
    api.get('/classrooms/rubrics', { params: { type } }),
  getRubric: (id: string) => api.get(`/classrooms/rubrics/${id}`),
  createRubric: (data: {
    name: string;
    description?: string;
    type: 'SELF_ASSESSMENT' | 'PEER_ASSESSMENT' | 'TEACHER_ASSESSMENT';
    targetProcess?: string;
    isDefault?: boolean;
    criteria: {
      name: string;
      description?: string;
      weight: number;
      order: number;
      levels: { score: number; label: string; description?: string; order: number }[];
    }[];
  }) => api.post('/classrooms/rubrics', data),
  updateRubric: (id: string, data: {
    name?: string;
    description?: string;
    targetProcess?: string;
    isDefault?: boolean;
    isActive?: boolean;
    criteria?: {
      name: string;
      description?: string;
      weight: number;
      order: number;
      levels: { score: number; label: string; description?: string; order: number }[];
    }[];
  }) => api.put(`/classrooms/rubrics/${id}`, data),
  deleteRubric: (id: string) => api.delete(`/classrooms/rubrics/${id}`),
  seedDefaultRubrics: () => api.post('/classrooms/rubrics/seed-defaults'),

  // Autoevaluación
  submitSelfAssessment: (activityId: string, data: {
    responses: { criterionId: string; levelId: string }[];
    reflection?: string;
  }) => api.post(`/classrooms/activities/${activityId}/self-assessment`, data),

  // Coevaluación
  getPendingPeerAssessments: (activityId: string) =>
    api.get(`/classrooms/activities/${activityId}/peer-assessments/pending`),
  submitPeerAssessment: (activityId: string, data: {
    targetEnrollmentId: string;
    responses: { criterionId: string; levelId: string }[];
    reflection?: string;
  }) => api.post(`/classrooms/activities/${activityId}/peer-assessment`, data),
  createPeerAssessmentPairs: (activityId: string, data: { mode?: 'random' | 'all'; peersPerStudent?: number }) =>
    api.post(`/classrooms/activities/${activityId}/peer-assessment/create-pairs`, data),

  // Resultados y sincronización
  getAttitudinalResults: (activityId: string) =>
    api.get(`/classrooms/activities/${activityId}/attitudinal-results`),
  syncAttitudinalToGradebook: (activityId: string, academicTermId: string) =>
    api.post(`/classrooms/activities/${activityId}/attitudinal-sync`, { academicTermId }),
}

// ═══════════════════════════════════════════════════════════════════════════
// LIVE QUIZ (Kahoot-like)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Convierte una key de R2 o URL firmada a una URL proxy estable que nunca expira.
 * Usa el endpoint GET /storage/public?path=... que sirve archivos directamente.
 * Solo funciona para prefijos permitidos: galeria/, firmas/.
 */
export function toPublicFileUrl(storedValue: string | null | undefined): string {
  if (!storedValue) return ''
  // Si ya es una URL proxy, devolverla tal cual
  if (storedValue.includes('/storage/public?path=')) return storedValue
  // Extraer key de una URL firmada de R2
  let key = storedValue
  if (storedValue.startsWith('http')) {
    try {
      const url = new URL(storedValue)
      const parts = url.pathname.split('/').filter(Boolean)
      // Quitar bucket name del path: /edusyn-files/galeria/... → galeria/...
      key = parts.length > 1 ? parts.slice(1).join('/') : parts.join('/')
    } catch { return storedValue }
  }
  // Solo proxiar prefijos permitidos
  if (!key.startsWith('galeria/') && !key.startsWith('firmas/')) return storedValue
  return `${API_BASE_URL}/storage/public?path=${encodeURIComponent(key)}`
}

export const liveSessionApi = {
  create: (data: { classroomId: string; activityId: string; mode?: string; config?: any }) =>
    api.post('/live-session/create', data),
  get: (sessionId: string) => api.get(`/live-session/${sessionId}`),
  getActive: (classroomId: string) => api.get(`/live-session/active/${classroomId}`),
  joinHome: (sessionId: string) => api.post(`/live-session/${sessionId}/join-home`),
  start: (sessionId: string) => api.post(`/live-session/${sessionId}/start`),
  nextQuestion: (sessionId: string) => api.post(`/live-session/${sessionId}/next-question`),
  advanceHomeQuestion: (sessionId: string, data: { expectedQuestionIdx: number }) =>
    api.post(`/live-session/${sessionId}/advance-home-question`, data),
  closeQuestion: (sessionId: string) => api.post(`/live-session/${sessionId}/close-question`),
  showRanking: (sessionId: string) => api.post(`/live-session/${sessionId}/show-ranking`),
  getAsyncRanking: (sessionId: string) => api.get(`/live-session/${sessionId}/async-ranking`),
  getQuestionRanking: (sessionId: string, questionId: string) =>
    api.get(`/live-session/${sessionId}/question-ranking/${questionId}`),
  finish: (sessionId: string) => api.post(`/live-session/${sessionId}/finish`),
  answer: (sessionId: string, data: { questionId: string; answer: string; responseTimeMs: number }) =>
    api.post(`/live-session/${sessionId}/answer`, data),
  streamUrl: (sessionId: string) => `${api.defaults.baseURL}/live-session/${sessionId}/stream`,
  createTeams: (sessionId: string, teams: { name: string; color?: string }[]) =>
    api.post(`/live-session/${sessionId}/teams`, { teams }),
  getTeams: (sessionId: string) =>
    api.get(`/live-session/${sessionId}/teams`),
  joinTeam: (sessionId: string, teamId: string) =>
    api.post(`/live-session/${sessionId}/join-team`, { teamId }),
  addPartner: (sessionId: string, teamId: string, studentEnrollmentId: string) =>
    api.post(`/live-session/${sessionId}/add-partner`, { teamId, studentEnrollmentId }),
  removeFromTeam: (sessionId: string, studentEnrollmentId: string) =>
    api.post(`/live-session/${sessionId}/remove-from-team`, { studentEnrollmentId }),
  searchStudents: (sessionId: string, query?: string) =>
    api.get(`/live-session/${sessionId}/search-students`, { params: { q: query } }),
  createTeamByStudent: (sessionId: string, name: string) =>
    api.post(`/live-session/${sessionId}/create-team`, { name }),
  reset: (sessionId: string) =>
    api.post(`/live-session/${sessionId}/reset`),
  getParticipants: (sessionId: string) =>
    api.get(`/live-session/${sessionId}/participants`),
  updateAvatar: (sessionId: string, avatarId: string) =>
    api.post(`/live-session/${sessionId}/avatar`, { avatarId }),
  sendReaction: (sessionId: string, emoji: string) =>
    api.post(`/live-session/${sessionId}/reaction`, { emoji }),
}

// ═══════════════════════════════════════════════════════════════════════════
// LECCIONES INTERACTIVAS
// ═══════════════════════════════════════════════════════════════════════════

export interface LessonSlide {
  id: string
  lessonId: string
  type: 'CONTENT' | 'ACTIVITY' | 'CHECKPOINT' | 'BADGE_REVEAL'
  sortOrder: number
  title?: string
  body?: string
  imageUrl?: string
  videoUrl?: string
  audioUrl?: string
  layout?: string
  activityData?: {
    questionType: string
    question: string
    options?: string[]
    correctAnswer?: string
    explanation?: string
    points?: number
    hint?: string
    feedbackCorrect?: string
    feedbackIncorrect?: string
    imageUrl?: string
    openAnswer?: boolean // SHORT_ANSWER abierta: sin respuesta exacta
  }
  badgeEmoji?: string
  badgeTitle?: string
}

export interface Lesson {
  id: string
  activityId: string
  title: string
  description?: string
  coverImage?: string
  badgeEmoji?: string
  badgeTitle?: string
  badgeColor?: string
  estimatedMinutes?: number
  slides: LessonSlide[]
  activity?: { id: string; classroomId: string; title: string; isPublished: boolean }
}

export interface LessonProgress {
  id?: string
  lessonId: string
  studentEnrollmentId: string
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
  currentSlideIndex: number
  completedSlides: string[]
  answers: Record<string, { answer: any; isCorrect: boolean; points: number; maxPoints: number }>
  score: number
  maxScore: number
  badgeEarned: boolean
  lastCheckpointIndex: number
  startedAt?: string
  completedAt?: string
  timeSpentSeconds: number
}

export interface LessonStudentProgress {
  id: string
  studentEnrollmentId: string
  studentName: string
  status: string
  currentSlideIndex: number
  totalSlides: number
  progressPercent: number
  score: number
  maxScore: number
  badgeEarned: boolean
  timeSpentSeconds: number
  startedAt?: string
  completedAt?: string
}

export const lessonApi = {
  // Teacher CRUD
  create: (activityId: string, data: Partial<Lesson> & { slides?: Partial<LessonSlide>[] }) =>
    api.post(`/classrooms/activities/${activityId}/lesson`, data),
  getByActivity: (activityId: string) =>
    api.get<Lesson>(`/classrooms/activities/${activityId}/lesson`),
  update: (lessonId: string, data: Partial<Lesson>) =>
    api.put<Lesson>(`/classrooms/lessons/${lessonId}`, data),
  delete: (lessonId: string) =>
    api.delete(`/classrooms/lessons/${lessonId}`),
  // Seguridad del editor: autoguardado, recuperación e historial de versiones
  saveVersion: (lessonId: string, data: { kind?: 'AUTOSAVE' | 'MANUAL' | 'PUBLISH'; label?: string; snapshot: any }) =>
    api.post<{ id: string; kind: string; label: string | null; createdAt: string }>(`/classrooms/lessons/${lessonId}/versions`, data),
  listVersions: (lessonId: string) =>
    api.get<{ id: string; kind: string; label: string | null; createdAt: string }[]>(`/classrooms/lessons/${lessonId}/versions`),
  getRecovery: (lessonId: string) =>
    api.get<{ hasRecovery: boolean; version: { id: string; snapshot: any; createdAt: string } | null }>(`/classrooms/lessons/${lessonId}/recovery`),
  getVersion: (versionId: string) =>
    api.get<{ id: string; snapshot: any; createdAt: string; kind: string }>(`/classrooms/lesson-versions/${versionId}`),
  activityHint: (lessonId: string, slideId: string) =>
    api.post<{ hint: string }>(`/classrooms/lessons/${lessonId}/slides/${slideId}/hint`, {}),

  // Slides
  addSlide: (lessonId: string, data: Partial<LessonSlide>) =>
    api.post<LessonSlide>(`/classrooms/lessons/${lessonId}/slides`, data),
  reorderSlides: (lessonId: string, slideIds: string[]) =>
    api.put(`/classrooms/lessons/${lessonId}/slides/reorder`, { slideIds }),
  bulkUpdateSlides: (lessonId: string, slides: Partial<LessonSlide>[]) =>
    api.put<Lesson>(`/classrooms/lessons/${lessonId}/slides/bulk`, { slides }),
  updateSlide: (slideId: string, data: Partial<LessonSlide>) =>
    api.put<LessonSlide>(`/classrooms/slides/${slideId}`, data),
  deleteSlide: (slideId: string) =>
    api.delete(`/classrooms/slides/${slideId}`),

  // Student progress
  getMyProgress: (lessonId: string) =>
    api.get<LessonProgress>(`/classrooms/lessons/${lessonId}/my-progress`),
  start: (lessonId: string) =>
    api.post<LessonProgress>(`/classrooms/lessons/${lessonId}/start`),
  advance: (lessonId: string, data: { slideIndex: number; slideId: string; answer?: any; attempt?: number; timeSpentDelta?: number }) =>
    api.post<LessonProgress & {
      isComplete?: boolean
      slideResult?: { answer: any; isCorrect: boolean; points: number; maxPoints: number } | null
      xp?: {
        awarded: number; leveledUp: boolean; level: number | null; currentStreak: number | null
        newBadges: { code: string; name: string; description: string; emoji: string; tier: string }[]
      } | null
    }>(`/classrooms/lessons/${lessonId}/advance`, data),

  // Teacher progress overview
  getAllProgress: (lessonId: string) =>
    api.get<LessonStudentProgress[]>(`/classrooms/lessons/${lessonId}/progress`),

  // AI generation
  generateAI: (data: { topic: string; content: string; gradeName?: string; subjectName?: string }) =>
    api.post<{ title: string; description: string; slides: any[]; source: 'AI' | 'TEMPLATE' }>(`/classrooms/lessons/generate-ai`, data),
}

// ═══════════════════════════════════════════════════════════════════════════
// GAMIFICACIÓN — Identidad de Aprendizaje (XP / nivel / racha)
// ═══════════════════════════════════════════════════════════════════════════

export interface LearningIdentityView {
  totalXp: number
  level: number
  currentStreak: number
  longestStreak: number
  skillXp: Record<string, number>
  levelFloorXp: number
  levelCeilXp: number
  lastActivityDate: string | null
}

export interface BadgeView {
  code: string
  name: string
  description: string
  emoji: string
  tier: string
  earned: boolean
  earnedAt: string | null
}

export const gamificationApi = {
  // Identidad del estudiante autenticado
  me: () => api.get<LearningIdentityView>(`/gamification/me`),
  // Catálogo de insignias con estado ganado/bloqueado
  badges: () => api.get<{ total: number; earned: number; badges: BadgeView[] }>(`/gamification/badges`),
}

// ═══════════════════════════════════════════════════════════════════════════
// RUTAS DE APRENDIZAJE (Learning Journeys) + grafo de competencias CEFR
// ═══════════════════════════════════════════════════════════════════════════

export interface CompetencyView {
  id: string
  framework: string
  level: string | null
  skill: string | null
  code: string
  statement: string
}
export interface RouteStepView {
  id: string
  title: string
  sortOrder: number
  activity?: { id: string; title: string; type: string; isPublished?: boolean } | null
  competency?: CompetencyView | null
}
export interface RouteView {
  id: string
  title: string
  description?: string | null
  isPublished: boolean
  targetLevel?: string | null
  hasInstructions?: boolean
  hasSourceMaterial?: boolean
  targetCompetency?: { code: string; statement: string; level: string | null; skill: string | null } | null
  steps: RouteStepView[]
}
export interface RouteSummary {
  id: string
  title: string
  description?: string | null
  isPublished: boolean
  targetLevel?: string | null
  targetCompetency?: { code: string; statement: string; level: string | null; skill: string | null } | null
  stepsCount: number
}

export interface RoutePlan {
  title: string
  description: string
  targetLevel: string
  targetSkill: string
  steps: { title: string; skill: string }[]
}
export interface RouteProgress {
  routeId: string
  targetMastery: number
  demonstrated: boolean
  completedSteps: number
  totalSteps: number
  steps: { id: string; title: string; done: boolean; mastery: number }[]
}

// ─── Expedición ABP ──────────────────────────────────────────────────────────
export const abpApi = {
  phases: () => api.get<any[]>(`/abp/phases`),
  listByClassroom: (classroomId: string) => api.get<any[]>(`/abp/classroom/${classroomId}/projects`),
  roster: (classroomId: string, projectId?: string) => api.get<{ enrollmentId: string; studentId: string; name: string; assignedTeamName: string | null }[]>(`/abp/classroom/${classroomId}/roster${projectId ? `?projectId=${projectId}` : ''}`),
  getProject: (projectId: string) => api.get<any>(`/abp/projects/${projectId}`),
  dashboard: (projectId: string) => api.get<any>(`/abp/projects/${projectId}/dashboard`),
  projectPresentation: (projectId: string) => api.get<any>(`/abp/projects/${projectId}/presentation`),
  updatePresentation: (projectId: string, data: { challenge?: string; presentation?: any }) => api.post<any>(`/abp/projects/${projectId}/presentation`, data),
  setPhaseInstruments: (projectId: string, phase: number, items: { key: string; required?: boolean }[]) => api.post<any>(`/abp/projects/${projectId}/instruments`, { phase, items }),
  setStationInstructions: (projectId: string, phase: number, text: string) => api.post<any>(`/abp/projects/${projectId}/station-instructions`, { phase, text }),
  listResources: (projectId: string) => api.get<any[]>(`/abp/projects/${projectId}/resources`),
  addResource: (projectId: string, data: { type?: string; title: string; url: string; description?: string }) => api.post<any>(`/abp/projects/${projectId}/resources`, data),
  deleteResource: (resourceId: string) => api.delete(`/abp/resources/${resourceId}`),
  listAnnouncements: (projectId: string) => api.get<any[]>(`/abp/projects/${projectId}/announcements`),
  addAnnouncement: (projectId: string, data: { content: string; pinned?: boolean }) => api.post<any>(`/abp/projects/${projectId}/announcements`, data),
  pinAnnouncement: (announcementId: string, pinned: boolean) => api.post<any>(`/abp/announcements/${announcementId}/pin`, { pinned }),
  deleteAnnouncement: (announcementId: string) => api.delete(`/abp/announcements/${announcementId}`),
  teamExpedition: (teamId: string) => api.get<any>(`/abp/teams/${teamId}/expedition`),
  createProject: (data: { classroomId: string; title: string; challenge?: string }) => api.post<any>(`/abp/projects`, data),
  createTeam: (data: { projectId: string; name: string; emoji?: string; color?: string; problem?: string; memberEnrollmentIds: string[]; letStudentsName?: boolean }) => api.post<any>(`/abp/teams`, data),
  deleteTeam: (teamId: string) => api.delete(`/abp/teams/${teamId}`),
  addTeamMember: (teamId: string, enrollmentId: string) => api.post<any>(`/abp/teams/${teamId}/members`, { enrollmentId }),
  removeTeamMember: (teamId: string, enrollmentId: string) => api.delete(`/abp/teams/${teamId}/members/${enrollmentId}`),
  foundTeamIdentity: (teamId: string, name: string, emoji: string) => api.post<any>(`/abp/teams/${teamId}/identity`, { name, emoji }),
  requestTeamRename: (teamId: string, proposedName: string) => api.post<any>(`/abp/teams/${teamId}/rename-request`, { proposedName }),
  resolveTeamRename: (teamId: string, approve: boolean) => api.post<any>(`/abp/teams/${teamId}/rename-resolve`, { approve }),
  setMyAvatar: (teamId: string, avatarId: string) => api.post<any>(`/abp/teams/${teamId}/my-avatar`, { avatarId }),
  myTeam: (projectId: string) => api.get<any>(`/abp/projects/${projectId}/my-team`),
  saveCanvas: (teamId: string, cardIndex: number, value: string) => api.post<any>(`/abp/teams/${teamId}/canvas`, { cardIndex, value }),
  addIdea: (teamId: string, text: string) => api.post<any>(`/abp/teams/${teamId}/ideas`, { text }),
  voteIdea: (teamId: string, ideaId: string) => api.post<any>(`/abp/teams/${teamId}/ideas/${ideaId}/vote`),
  saveSmart: (teamId: string, text: string, checks: boolean[]) => api.post<any>(`/abp/teams/${teamId}/smart`, { text, checks }),
  addTask: (teamId: string, text: string, ownerEnrollmentId: string) => api.post<any>(`/abp/teams/${teamId}/tasks`, { text, ownerEnrollmentId }),
  moveTask: (teamId: string, taskId: string) => api.post<any>(`/abp/teams/${teamId}/tasks/${taskId}/move`),
  removeTask: (teamId: string, taskId: string) => api.delete(`/abp/teams/${teamId}/tasks/${taskId}`),
  addEvidence: (teamId: string, kind: 'LINK' | 'FILE', url: string, label?: string) => api.post<any>(`/abp/teams/${teamId}/evidences`, { kind, url, label }),
  removeEvidence: (teamId: string, evidenceId: string) => api.delete(`/abp/teams/${teamId}/evidences/${evidenceId}`),
  coeval: (teamId: string, targetTeamId: string, scores: number[]) => api.post<any>(`/abp/teams/${teamId}/coeval`, { targetTeamId, scores }),
  requestValidation: (teamId: string) => api.post<any>(`/abp/teams/${teamId}/request-validation`, {}),
  queue: (classroomId?: string) => api.get<any[]>(`/abp/queue`, { params: { classroomId } }),
  resolve: (validationId: string, data: { action: 'approve' | 'return'; feedback?: string; rubricScores?: number[]; rubricComment?: string; missions?: { title: string; description?: string; required?: boolean; deliverableKind?: string }[] }) => api.post<any>(`/abp/validations/${validationId}/resolve`, data),
  getReview: (validationId: string) => api.get<any>(`/abp/validations/${validationId}/review`),
  addComment: (teamId: string, data: { phase: number; refType: string; refId?: string; content: string; parentId?: string }) => api.post<any>(`/abp/teams/${teamId}/comments`, data),
  resolveComment: (commentId: string, resolved: boolean) => api.post<any>(`/abp/comments/${commentId}/resolve`, { resolved }),
  // Misiones (Opción A: herramienta = misión por defecto de la fase)
  listMissions: (teamId: string, phase: number) => api.get<any[]>(`/abp/teams/${teamId}/phases/${phase}/missions`),
  addMission: (teamId: string, phase: number, data: { title: string; description?: string; required?: boolean; deliverableKind?: string; assigneeEnrollmentId?: string; dueAt?: string }) => api.post<any>(`/abp/teams/${teamId}/phases/${phase}/missions`, data),
  broadcastMission: (projectId: string, data: { phase: number; title: string; description?: string; required?: boolean; deliverableKind?: string; activities?: { type: string; title: string }[] }) => api.post<{ ok: boolean; count: number }>(`/abp/projects/${projectId}/broadcast-mission`, data),
  submitDelivery: (missionId: string, data: { url?: string; text?: string; label?: string }) => api.post<any>(`/abp/missions/${missionId}/deliver`, data),
  suggestActivities: (teamId: string, missionId: string, count?: number) => api.post<{ configured: boolean; model?: string; activities: { type: string; title: string; description: string }[] }>(`/abp/teams/${teamId}/missions/${missionId}/suggest`, { count }),
  addActivitiesBulk: (missionId: string, items: { type: string; title: string }[]) => api.post<any[]>(`/abp/missions/${missionId}/activities/bulk`, { items }),
  addLessonActivity: (missionId: string, title: string) => api.post<any>(`/abp/missions/${missionId}/lesson-activity`, { title }),
  reusableActivities: (missionId: string) => api.get<{ id: string; title: string; type: string }[]>(`/abp/missions/${missionId}/reusable-activities`),
  attachActivity: (missionId: string, classroomActivityId: string) => api.post<any>(`/abp/missions/${missionId}/attach-activity`, { classroomActivityId }),
  generateLessonContent: (activityId: string, instructions?: string) => api.post<{ ok: boolean; title: string; slides: number; model?: string }>(`/abp/activities/${activityId}/generate-lesson`, { instructions }),
  deleteMission: (missionId: string) => api.delete(`/abp/missions/${missionId}`),
  setMissionStatus: (missionId: string, completed: boolean) => api.post<any>(`/abp/missions/${missionId}/status`, { completed }),
  addActivity: (missionId: string, data: { type: string; title: string; content?: any }) => api.post<any>(`/abp/missions/${missionId}/activities`, data),
  completeActivity: (activityId: string, completed: boolean) => api.post<any>(`/abp/activities/${activityId}/complete`, { completed }),
  deleteActivity: (activityId: string) => api.delete(`/abp/activities/${activityId}`),
  // Bitácora + Descubrimientos (Nivel 2)
  listLog: (teamId: string) => api.get<any[]>(`/abp/teams/${teamId}/log`),
  addLog: (teamId: string, data: { content: string; phase?: number }) => api.post<any>(`/abp/teams/${teamId}/log`, data),
  deleteLog: (entryId: string) => api.delete(`/abp/log/${entryId}`),
  listDiscoveries: (teamId: string) => api.get<any[]>(`/abp/teams/${teamId}/discoveries`),
  addDiscovery: (teamId: string, data: { phase: number; title: string; description: string; evidenceKind?: string; evidenceUrl?: string; impact?: string }) => api.post<any>(`/abp/teams/${teamId}/discoveries`, data),
  deleteDiscovery: (discoveryId: string) => api.delete(`/abp/discoveries/${discoveryId}`),
}

// ═══ EL TALLER — núcleo del Sistema Operativo de Colaboración ═══
// Objetos Universales + Grafo + Eventos + Motores (Board·Brainstorm primero).
export const tallerApi = {
  catalog: () => api.get<{ intents: { id: string; name: string }[]; instruments: { key: string; motor: string; dynamic: string; name: string; emoji: string; intent: string; description: string; available: boolean }[] }>(`/taller/catalog`),
  resolveInstrument: (data: { teamId: string; motor: string; dynamic?: string; stationId?: string; title?: string }) =>
    api.post<any>(`/taller/instruments/resolve`, data),
  instrumentState: (instrumentId: string) => api.get<any>(`/taller/instruments/${instrumentId}`),
  createObject: (instrumentId: string, data: { type?: string; text?: string; colorId?: number; x?: number; y?: number; parentId?: string; date?: string; fields?: Record<string, string> }) =>
    api.post<any>(`/taller/instruments/${instrumentId}/objects`, data),
  updateObject: (objectId: string, data: { text?: string; colorId?: number; x?: number; y?: number; version?: number; date?: string; fields?: Record<string, string> }) =>
    api.patch<any>(`/taller/objects/${objectId}`, data),
  deleteObject: (objectId: string) => api.delete(`/taller/objects/${objectId}`),
  toggleVote: (objectId: string) => api.post<{ voted: boolean }>(`/taller/objects/${objectId}/vote`),
  addComment: (objectId: string, text: string) => api.post<any>(`/taller/objects/${objectId}/comments`, { text }),
  connect: (data: { fromId: string; toId: string; relType?: string; label?: string }) => api.post<any>(`/taller/relations`, data),
  disconnect: (relationId: string) => api.delete(`/taller/relations/${relationId}`),
  teamTimeline: (teamId: string, limit?: number) => api.get<any[]>(`/taller/teams/${teamId}/timeline`, { params: { limit } }),
}

export const learningRouteApi = {
  competencies: (level?: string, skill?: string) =>
    api.get<CompetencyView[]>(`/learning-routes/competencies`, { params: { level, skill } }),
  listByClassroom: (classroomId: string) =>
    api.get<RouteSummary[]>(`/learning-routes/classroom/${classroomId}`),
  get: (routeId: string) => api.get<RouteView>(`/learning-routes/${routeId}`),
  progress: (routeId: string) => api.get<RouteProgress>(`/learning-routes/${routeId}/progress`),
  create: (data: { classroomId: string; title: string; description?: string; targetCompetencyId?: string }) =>
    api.post<RouteView>(`/learning-routes`, data),
  generate: (data: { objective: string; gradeName?: string; targetLevel?: string; instructions?: string; sourceMaterial?: string }) =>
    api.post<RoutePlan>(`/learning-routes/generate`, data),
  fromPlan: (data: { classroomId: string; plan: RoutePlan; instructions?: string; sourceMaterial?: string }) =>
    api.post<RouteView>(`/learning-routes/from-plan`, data),
  update: (routeId: string, data: { title?: string; description?: string; isPublished?: boolean; targetCompetencyId?: string | null }) =>
    api.put(`/learning-routes/${routeId}`, data),
  remove: (routeId: string) => api.delete(`/learning-routes/${routeId}`),
  addStep: (routeId: string, data: { title: string; activityId?: string; competencyId?: string }) =>
    api.post(`/learning-routes/${routeId}/steps`, data),
  addStepWithActivity: (routeId: string, data: { title: string; activityType?: string; description?: string; competencyId?: string; maxScore?: number }) =>
    api.post(`/learning-routes/${routeId}/steps/new-activity`, data),
  generateStepLesson: (stepId: string, data?: { instructions?: string }) =>
    api.post<{ activityId: string; slides: number }>(`/learning-routes/steps/${stepId}/generate-lesson`, data || {}),
  updateStep: (stepId: string, data: { title?: string; activityId?: string | null; competencyId?: string | null }) =>
    api.put(`/learning-routes/steps/${stepId}`, data),
  createStepActivity: (stepId: string, data: { activityType?: string; description?: string; maxScore?: number }) =>
    api.post<{ activityId: string }>(`/learning-routes/steps/${stepId}/activity`, data),
  removeStep: (stepId: string) => api.delete(`/learning-routes/steps/${stepId}`),
  reorder: (routeId: string, stepIds: string[]) => api.put(`/learning-routes/${routeId}/steps/reorder`, { stepIds }),
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPORTACIÓN MASIVA DE NOTAS (Solo Rector/Admin)
// ═══════════════════════════════════════════════════════════════════════════

export interface GradesImportPreview {
  students: Array<{
    rowNumber: number
    fullName: string
    documentNumber: string
    groupCode: string
    existsInSystem: boolean
    enrollmentId?: string
  }>
  subjects: Array<{
    name: string
    foundInSystem: boolean
    subjectId?: string
  }>
  studentsInSystemNotInExcel: Array<{
    name: string
    documentNumber: string
    enrollmentId: string
  }>
  canProceed: boolean
  warnings: string[]
}

export interface GradesImportResult {
  success: boolean
  summary: {
    totalStudents: number
    studentsCreated: number
    studentsUpdated: number
    studentsDeactivated: number
    gradesImported: number
    subjectsFound: number
  }
  errors: Array<{ row: number; message: string; data?: any }>
  warnings: Array<{ row: number; message: string }>
  details: {
    created: Array<{ name: string; document: string }>
    deactivated: Array<{ name: string; document: string }>
    subjectsNotFound: string[]
  }
}

export interface ConvivenciaStatus {
  groupId: string
  groupName: string
  convivenciaEnabled: boolean
  hasDirector: boolean
  director: string | null
}

export const gradesBulkImportApi = {
  getAvailableGrades: () => 
    api.get<Array<{ id: string; name: string; stage: string; groups: Array<{ id: string; name: string }> }>>('/admin/grades-import/grades'),
  
  getAvailableTerms: () => 
    api.get<Array<{ id: string; name: string; status: string }>>('/admin/grades-import/terms'),

  downloadTemplate: (gradeId: string) =>
    api.get('/admin/grades-import/template', {
      params: { gradeId },
      responseType: 'blob',
    }),
  
  preview: (file: File, gradeId: string, academicTermId: string) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<GradesImportPreview>(
      `/admin/grades-import/preview?gradeId=${gradeId}&academicTermId=${academicTermId}`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
  },
  
  execute: (
    file: File, 
    gradeId: string, 
    academicTermId: string,
    options: {
      createMissingStudents?: boolean
      deactivateMissingStudents?: boolean
      overwriteExistingGrades?: boolean
    }
  ) => {
    const formData = new FormData()
    formData.append('file', file)
    Object.entries(options).forEach(([key, value]) => {
      formData.append(key, String(value))
    })
    return api.post<GradesImportResult>(
      `/admin/grades-import/execute?gradeId=${gradeId}&academicTermId=${academicTermId}`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
  },

  // Convivencia
  getConvivenciaStatus: (gradeId: string) =>
    api.get<ConvivenciaStatus[]>(`/admin/grades-import/convivencia/${gradeId}`),
  
  toggleConvivencia: (groupId: string, enabled: boolean) =>
    api.put<{ success: boolean; message: string }>(`/admin/grades-import/convivencia/${groupId}`, { enabled }),
}

// Pool curado de nombres de equipo para sesiones TEAM.
// El docente (o el primer estudiante) elige de aquí para evitar nombres
// inapropiados o poco pedagógicos.
export const LIVE_QUIZ_TEAM_POOL: { name: string; color: string; emoji: string }[] = [
  { name: 'Equipo Agua',      color: '#06b6d4', emoji: '💧' },
  { name: 'Equipo Fuego',     color: '#ef4444', emoji: '🔥' },
  { name: 'Equipo Tierra',    color: '#78350f', emoji: '🌱' },
  { name: 'Equipo Aire',      color: '#0ea5e9', emoji: '🌬️' },
  { name: 'Equipo Sol',       color: '#f59e0b', emoji: '☀️' },
  { name: 'Equipo Luna',      color: '#6366f1', emoji: '🌙' },
  { name: 'Equipo Rayo',      color: '#eab308', emoji: '⚡' },
  { name: 'Equipo Estrella',  color: '#c026d3', emoji: '⭐' },
  { name: 'Equipo Océano',    color: '#0284c7', emoji: '🌊' },
  { name: 'Equipo Bosque',    color: '#16a34a', emoji: '🌳' },
  { name: 'Equipo Montaña',   color: '#525252', emoji: '⛰️' },
  { name: 'Equipo Galaxia',   color: '#7c3aed', emoji: '🌌' },
  { name: 'Equipo Relámpago', color: '#facc15', emoji: '🌩️' },
  { name: 'Equipo Viento',    color: '#94a3b8', emoji: '🌀' },
  { name: 'Equipo Volcán',    color: '#dc2626', emoji: '🌋' },
  { name: 'Equipo Nieve',     color: '#e2e8f0', emoji: '❄️' },
  { name: 'Equipo Arcoíris',  color: '#ec4899', emoji: '🌈' },
  { name: 'Equipo Trueno',    color: '#475569', emoji: '🌪️' },
  { name: 'Equipo Cometa',    color: '#f97316', emoji: '☄️' },
  { name: 'Equipo Planeta',   color: '#14b8a6', emoji: '🪐' },
]
