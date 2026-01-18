import axios from 'axios'

// En producción usar la variable de entorno, en desarrollo usar el proxy
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

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
}

// Institutions
export const institutionsApi = {
  getAll: () => api.get('/institutions'),
  getById: (id: string) => api.get(`/institutions/${id}`),
  create: (data: { name: string; daneCode?: string; nit?: string }) => api.post('/institutions', data),
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
  getAll: (params?: { campusId?: string; shiftId?: string; gradeId?: string }) => api.get('/groups', { params }),
  create: (data: { campusId: string; shiftId: string; gradeId: string; name: string; code?: string }) => api.post('/groups', data),
}

// Areas
export const areasApi = {
  getAll: (institutionId?: string) => api.get('/areas', { params: { institutionId } }),
  getById: (id: string) => api.get(`/areas/${id}`),
  create: (data: { institutionId: string; name: string; isMandatory?: boolean }) => api.post('/areas', data),
  update: (id: string, data: { name?: string; isMandatory?: boolean; order?: number }) => api.put(`/areas/${id}`, data),
  delete: (id: string) => api.delete(`/areas/${id}`),
  addSubject: (areaId: string, data: { name: string; weeklyHours?: number; weight?: number }) => api.post(`/areas/${areaId}/subjects`, data),
  updateSubject: (subjectId: string, data: { name?: string; weeklyHours?: number; weight?: number }) => api.put(`/areas/subjects/${subjectId}`, data),
  deleteSubject: (subjectId: string) => api.delete(`/areas/subjects/${subjectId}`),
}

// Subjects
export const subjectsApi = {
  getAll: (areaId?: string) => api.get('/subjects', { params: { areaId } }),
  create: (data: { areaId: string; name: string; weeklyHours?: number }) => api.post('/subjects', data),
}

// Academic Years
export const academicYearsApi = {
  getAll: (institutionId?: string) => api.get('/academic-terms/years', { params: { institutionId } }),
  create: (data: { institutionId: string; year: number; startDate?: string; endDate?: string }) => api.post('/academic-terms/years', data),
}

// Academic Terms (Periods)
export const academicTermsApi = {
  getAll: (academicYearId?: string) => api.get('/academic-terms', { params: { academicYearId } }),
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
}

// Communications
export const communicationsApi = {
  getAll: (params?: { institutionId?: string; type?: string }) => api.get('/communications', { params }),
  create: (data: { institutionId: string; type: string; subject: string; content: string; recipients?: string[] }) => api.post('/communications', data),
  getById: (id: string) => api.get(`/communications/${id}`),
}

// Students
export const studentsApi = {
  getAll: (params?: { institutionId?: string; groupId?: string; academicYearId?: string }) => api.get('/students', { params }),
  getById: (id: string) => api.get(`/students/${id}`),
  create: (data: { institutionId: string; documentType: string; documentNumber: string; firstName: string; lastName: string; birthDate?: string; gender?: string; email?: string; phone?: string; address?: string }) => api.post('/students', data),
  update: (id: string, data: { documentType?: string; documentNumber?: string; firstName?: string; lastName?: string; birthDate?: string; gender?: string; email?: string; phone?: string; address?: string }) => api.put(`/students/${id}`, data),
  delete: (id: string) => api.delete(`/students/${id}`),
  enroll: (data: { studentId: string; academicYearId: string; groupId: string }) => api.post('/students/enroll', data),
  updateEnrollmentStatus: (enrollmentId: string, status: string) => api.put(`/students/enrollment/${enrollmentId}/status`, { status }),
  getEnrollments: (studentId: string) => api.get(`/students/${studentId}/enrollments`),
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
