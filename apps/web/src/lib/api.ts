import axios from 'axios'

// Detectar si estamos en producción por el hostname
const isProduction = typeof window !== 'undefined' && 
  (window.location.hostname.includes('railway.app') || window.location.hostname.includes('edusyn.co'))
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
}

// Institution Profile (identidad institucional - para admin institucional)
export const institutionProfileApi = {
  get: () => api.get('/institution-config/profile'),
  update: (data: { name?: string; nit?: string; daneCode?: string; address?: string; phone?: string; email?: string; website?: string; logo?: string }) => 
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
}

// Grades (Grados)
export const gradesConfigApi = {
  getAll: () => api.get('/grades'),
  create: (data: { stage: string; number?: number; name: string }) => api.post('/grades', data),
}

// Groups (Grupos)
export const groupsApi = {
  getAll: (params?: { campusId?: string; shiftId?: string; gradeId?: string; institutionId?: string }) => api.get('/groups', { params }),
  create: (data: { campusId: string; shiftId: string; gradeId: string; name: string; code?: string }) => api.post('/groups', data),
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
}

// Teacher Assignments (Carga Academica)
export const teacherAssignmentsApi = {
  getAll: (params?: { academicYearId?: string; groupId?: string; teacherId?: string }) => api.get('/teacher-assignments', { params }),
  create: (data: { academicYearId: string; groupId: string; subjectId: string; teacherId: string; weeklyHours?: number }) => api.post('/teacher-assignments', data),
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
    score: number;
    observations?: string;
  }>) => api.post('/partial-grades/bulk', { grades }),
  getByAssignment: (teacherAssignmentId: string, academicTermId: string) =>
    api.get('/partial-grades/by-assignment', { params: { teacherAssignmentId, academicTermId } }),
  getByStudent: (studentEnrollmentId: string, academicTermId?: string) =>
    api.get('/partial-grades/by-student', { params: { studentEnrollmentId, academicTermId } }),
  delete: (id: string) => api.delete(`/partial-grades/${id}`),
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

// Observer (Observador del estudiante)
export const observerApi = {
  getByStudent: (studentEnrollmentId: string) => api.get('/observer', { params: { studentEnrollmentId } }),
  create: (data: { studentEnrollmentId: string; type: string; category: string; description: string; date: string }) => api.post('/observer', data),
}

// Preventive Alerts
export const preventiveAlertsApi = {
  getAll: (params?: { academicTermId?: string; groupId?: string }) => api.get('/preventive-cuts/alerts', { params }),
  generate: (academicTermId: string) => api.post(`/preventive-cuts/generate/${academicTermId}`),
}

// Reports
export const reportsApi = {
  getReportCard: (studentEnrollmentId: string, academicTermId: string) =>
    api.get('/reports/report-card', { params: { studentEnrollmentId, academicTermId } }),
  getGroupReport: (groupId: string, academicTermId: string) =>
    api.get('/reports/group', { params: { groupId, academicTermId } }),
  // Reportes predictivos - Nota mínima requerida
  getMinimumGrade: (studentEnrollmentId: string, academicYearId: string) =>
    api.get(`/reports/minimum-grade/${studentEnrollmentId}`, { params: { academicYearId } }),
  getMinimumGradeForGroup: (groupId: string, academicYearId: string) =>
    api.get(`/reports/minimum-grade/group/${groupId}`, { params: { academicYearId } }),
}

// Communications
export const communicationsApi = {
  getAll: (params?: { institutionId?: string; type?: string }) => api.get('/communications', { params }),
  create: (data: { institutionId: string; type: string; subject: string; content: string; recipients?: string[] }) => api.post('/communications', data),
  getById: (id: string) => api.get(`/communications/${id}`),
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
  getCredentials: (institutionId: string) => api.get('/students/credentials/list', { params: { institutionId } }),
  bulkDeleteWithoutRecords: (institutionId: string) => api.post('/students/bulk-delete-without-records', { institutionId }),
}

// Teachers
export const teachersApi = {
  getAll: (params?: { isActive?: boolean }) => api.get('/teachers', { params }),
  getById: (id: string) => api.get(`/teachers/${id}`),
  create: (data: { email: string; password: string; firstName: string; lastName: string; documentType?: string; documentNumber?: string; phone?: string }) => api.post('/teachers', data),
  update: (id: string, data: { firstName?: string; lastName?: string; documentType?: string; documentNumber?: string; phone?: string; isActive?: boolean }) => api.put(`/teachers/${id}`, data),
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
  sync: (grades: any[]) => api.post('/grades/sync', { grades }),
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
  removeSubject: (templateSubjectId: string) => api.delete(`/academic-templates/subjects/${templateSubjectId}`),

  // Asignación a grados (por año académico)
  assignToGrade: (gradeId: string, templateId: string, academicYearId: string, overrides?: any) => 
    api.post(`/academic-templates/grades/${gradeId}/assign`, { templateId, academicYearId, overrides }),
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
  getAll: (params?: { thirdPartyId?: string; conceptId?: string; status?: string }) => 
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
  update: (data: { invoicePrefix?: string; receiptPrefix?: string; defaultLateFeeType?: string; defaultLateFeeValue?: number; defaultGracePeriodDays?: number; taxId?: string; taxRegime?: string; bankAccounts?: any; sendPaymentReminders?: boolean; reminderDaysBefore?: number }) => 
    api.put('/finance/settings', data),
}
