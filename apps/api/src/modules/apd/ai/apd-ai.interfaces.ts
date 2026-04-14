/**
 * APD AI Module - Interfaces
 * 
 * Fase 2: Preparación de arquitectura para integración con IA
 * 
 * Funcionalidades planificadas:
 * - Generación automática de estrategias de apoyo basadas en perfil del estudiante
 * - Sugerencias de actividades adaptadas según categoría de acompañamiento
 * - Análisis predictivo de riesgo académico para estudiantes APD
 * - Generación de informes narrativos de progreso
 * - Recomendaciones de ajustes razonables según normativa colombiana
 */

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS DE SOLICITUD IA
// ═══════════════════════════════════════════════════════════════════════════

export type ApdAiRequestType =
  | 'GENERATE_SUPPORT_STRATEGY'
  | 'SUGGEST_ACTIVITIES'
  | 'PREDICT_RISK'
  | 'GENERATE_PROGRESS_REPORT'
  | 'RECOMMEND_ADJUSTMENTS';

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXTO DEL ESTUDIANTE PARA IA
// ═══════════════════════════════════════════════════════════════════════════

export interface ApdStudentContext {
  studentId: string;
  studentName: string;
  grade: string;
  group?: string;
  
  // Perfil de acompañamiento
  supportCategory: string;
  learningBarriers?: string;
  strengths?: string;
  supportNeeds?: string;
  learningStyleObservations?: string;
  
  // Historial académico (opcional)
  academicHistory?: {
    subjectName: string;
    averageGrade: number;
    performanceLevel: string;
  }[];
  
  // Planes anteriores (opcional)
  previousPlans?: {
    planType: 'APD' | 'PIAR';
    status: string;
    progressPercentage: number;
    supportStrategy: string;
    completedActivities: number;
  }[];
}

// ═══════════════════════════════════════════════════════════════════════════
// SOLICITUDES DE IA
// ═══════════════════════════════════════════════════════════════════════════

export interface ApdAiGenerateStrategyRequest {
  type: 'GENERATE_SUPPORT_STRATEGY';
  context: ApdStudentContext;
  planType: 'APD' | 'PIAR';
  academicTermName?: string;
  focusAreas?: string[]; // Áreas específicas a abordar
}

export interface ApdAiSuggestActivitiesRequest {
  type: 'SUGGEST_ACTIVITIES';
  context: ApdStudentContext;
  subjectName?: string;
  topic?: string;
  adaptationLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  adjustmentType?: 'CURRICULAR' | 'METHODOLOGICAL' | 'EVALUATIVE' | 'COMMUNICATION' | 'ENVIRONMENTAL';
  count?: number; // Número de sugerencias
  includeVisuals?: boolean;
  visualPlacement?: 'QUESTION_IMAGE' | 'CONTEXT_IMAGE' | 'INLINE';
}

export interface ApdAiPredictRiskRequest {
  type: 'PREDICT_RISK';
  context: ApdStudentContext;
  currentTermGrades?: { subjectName: string; grade: number }[];
  attendancePercentage?: number;
}

export interface ApdAiGenerateReportRequest {
  type: 'GENERATE_PROGRESS_REPORT';
  context: ApdStudentContext;
  planId: string;
  activities: {
    topic: string;
    completionStatus: string;
    teacherFeedback?: string;
    studentPerformanceScore?: number;
  }[];
  progressLogs: {
    progressIndicator: number;
    qualitativeObservation?: string;
    createdAt: Date;
  }[];
  reportType: 'BRIEF' | 'DETAILED' | 'FAMILY_FRIENDLY';
}

export interface ApdAiRecommendAdjustmentsRequest {
  type: 'RECOMMEND_ADJUSTMENTS';
  context: ApdStudentContext;
  subjectName: string;
  currentChallenges?: string;
  evaluationType?: 'WRITTEN' | 'ORAL' | 'PRACTICAL' | 'PROJECT';
}

export type ApdAiRequest =
  | ApdAiGenerateStrategyRequest
  | ApdAiSuggestActivitiesRequest
  | ApdAiPredictRiskRequest
  | ApdAiGenerateReportRequest
  | ApdAiRecommendAdjustmentsRequest
  | ApdAiTeacherQuestionRequest;

// ═══════════════════════════════════════════════════════════════════════════
// RESPUESTAS DE IA
// ═══════════════════════════════════════════════════════════════════════════

export interface ApdAiGenerateStrategyResponse {
  supportStrategy: string;
  objectives: string[];
  adaptationStrategies: string[];
  evaluationAdjustments: string[];
  familyCommitmentSuggestion?: string;
  followUpRecommendation?: string;
  confidence: number; // 0-1
}

export interface ApdAiSuggestActivitiesResponse {
  activities: {
    topic: string;
    originalActivityDescription: string;
    teacherFinalActivity: string;
    adaptationLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    adjustmentType: string;
    rationale: string; // Por qué se sugiere esta adaptación
    visualSuggestion?: {
      kind: 'SVG' | 'IMAGE' | 'NONE';
      placement?: 'QUESTION_IMAGE' | 'CONTEXT_IMAGE' | 'INLINE';
      svg?: string;
      altText?: string;
      prompt?: string;
    };
  }[];
  confidence: number;
}

export interface ApdAiTeacherQuestionRequest {
  type: 'ASK_VALERIA';
  question: string;
  conversation?: {
    role: 'user' | 'assistant';
    content: string;
  }[];
  context?: {
    institutionName?: string;
    gradeName?: string;
    subjectName?: string;
    topic?: string;
    activityType?: 'QUIZ' | 'EXAM' | 'GUIDE' | 'ACHIEVEMENT' | 'GENERAL';
    details?: string;
  };
  includeVisuals?: boolean;
  visualPlacement?: 'QUESTION_IMAGE' | 'CONTEXT_IMAGE' | 'INLINE';
}

export interface ApdAiTeacherQuestionResponse {
  answer: string;
  keyPoints: string[];
  nextSteps?: string[];
  visualSuggestion?: {
    kind: 'SVG' | 'IMAGE' | 'NONE';
    placement?: 'QUESTION_IMAGE' | 'CONTEXT_IMAGE' | 'INLINE';
    svg?: string;
    altText?: string;
    prompt?: string;
  };
  confidence: number;
}

export interface ApdAiPredictRiskResponse {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number; // 0-100
  riskFactors: {
    factor: string;
    impact: 'LOW' | 'MEDIUM' | 'HIGH';
    description: string;
  }[];
  recommendations: string[];
  confidence: number;
}

export interface ApdAiGenerateReportResponse {
  narrativeReport: string;
  highlights: string[];
  areasOfImprovement: string[];
  recommendations: string[];
  overallAssessment: 'EXCELLENT' | 'GOOD' | 'SATISFACTORY' | 'NEEDS_IMPROVEMENT' | 'AT_RISK';
  confidence: number;
}

export interface ApdAiRecommendAdjustmentsResponse {
  adjustments: {
    type: 'CURRICULAR' | 'METHODOLOGICAL' | 'EVALUATIVE' | 'COMMUNICATION' | 'ENVIRONMENTAL';
    description: string;
    implementation: string;
    legalBasis?: string; // Referencia a normativa colombiana (Decreto 1421, etc.)
  }[];
  generalRecommendations: string[];
  confidence: number;
}

export type ApdAiResponse =
  | ApdAiGenerateStrategyResponse
  | ApdAiSuggestActivitiesResponse
  | ApdAiPredictRiskResponse
  | ApdAiGenerateReportResponse
  | ApdAiRecommendAdjustmentsResponse
  | ApdAiTeacherQuestionResponse;

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DEL SERVICIO IA
// ═══════════════════════════════════════════════════════════════════════════

export interface ApdAiServiceConfig {
  provider: 'OPENAI' | 'ANTHROPIC' | 'LOCAL' | 'GEMINI' | 'DISABLED';
  model?: string;
  apiKey?: string;
  maxTokens?: number;
  temperature?: number;
  enableCaching?: boolean;
  cacheTtlSeconds?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERFAZ DEL SERVICIO IA
// ═══════════════════════════════════════════════════════════════════════════

export interface IApdAiService {
  /**
   * Verifica si el servicio de IA está habilitado y configurado
   */
  isEnabled(): boolean;

  /**
   * Genera una estrategia de apoyo para un estudiante
   */
  generateSupportStrategy(
    request: ApdAiGenerateStrategyRequest,
  ): Promise<ApdAiGenerateStrategyResponse>;

  /**
   * Sugiere actividades adaptadas
   */
  suggestActivities(
    request: ApdAiSuggestActivitiesRequest,
  ): Promise<ApdAiSuggestActivitiesResponse>;

  /**
   * Predice el nivel de riesgo académico
   */
  predictRisk(
    request: ApdAiPredictRiskRequest,
  ): Promise<ApdAiPredictRiskResponse>;

  /**
   * Genera un informe narrativo de progreso
   */
  generateProgressReport(
    request: ApdAiGenerateReportRequest,
  ): Promise<ApdAiGenerateReportResponse>;

  /**
   * Recomienda ajustes razonables
   */
  recommendAdjustments(
    request: ApdAiRecommendAdjustmentsRequest,
  ): Promise<ApdAiRecommendAdjustmentsResponse>;

  /**
   * Responde preguntas del docente como Valeria y puede sugerir apoyos visuales
   */
  answerTeacherQuestion(
    request: ApdAiTeacherQuestionRequest,
  ): Promise<ApdAiTeacherQuestionResponse>;
}
