// Dominio APD. Lo consume el asistente, que cuelga de Layout y carga al arranque.
import api from './client'

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
