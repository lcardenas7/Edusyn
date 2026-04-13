import { Injectable, Logger } from '@nestjs/common';
import {
  IApdAiService,
  ApdAiGenerateStrategyRequest,
  ApdAiGenerateStrategyResponse,
  ApdAiSuggestActivitiesRequest,
  ApdAiSuggestActivitiesResponse,
  ApdAiPredictRiskRequest,
  ApdAiPredictRiskResponse,
  ApdAiGenerateReportRequest,
  ApdAiGenerateReportResponse,
  ApdAiRecommendAdjustmentsRequest,
  ApdAiRecommendAdjustmentsResponse,
  ApdAiTeacherQuestionRequest,
  ApdAiTeacherQuestionResponse,
  ApdAiServiceConfig,
} from './apd-ai.interfaces';

/**
 * APD AI Service - Placeholder Implementation
 * 
 * Fase 2: Servicio placeholder que retorna respuestas de ejemplo.
 * En producción, este servicio se conectará a OpenAI/Anthropic.
 * 
 * Para habilitar IA real:
 * 1. Configurar APD_AI_PROVIDER=OPENAI en variables de entorno
 * 2. Configurar APD_AI_API_KEY con la clave de API
 * 3. Implementar los métodos con llamadas reales al LLM
 */
@Injectable()
export class ApdAiService implements IApdAiService {
  private readonly logger = new Logger(ApdAiService.name);
  private readonly config: ApdAiServiceConfig;

  constructor() {
    const providerEnv = process.env.APD_AI_PROVIDER?.trim().toUpperCase();
    this.config = {
      provider: (providerEnv as any) || (process.env.APD_AI_API_KEY ? 'GEMINI' : 'DISABLED'),
      model: process.env.APD_AI_MODEL || 'gemini-2.0-flash',
      apiKey: process.env.APD_AI_API_KEY,
      maxTokens: parseInt(process.env.APD_AI_MAX_TOKENS || '2000', 10),
      temperature: parseFloat(process.env.APD_AI_TEMPERATURE || '0.7'),
      enableCaching: process.env.APD_AI_CACHE !== 'false',
      cacheTtlSeconds: parseInt(process.env.APD_AI_CACHE_TTL || '3600', 10),
    };

    if (this.config.provider !== 'DISABLED') {
      this.logger.log(`APD AI Service initialized with provider: ${this.config.provider}`);
    } else {
      this.logger.log('APD AI Service is DISABLED - using placeholder responses');
    }
  }

  isEnabled(): boolean {
    return this.config.provider !== 'DISABLED' && !!this.config.apiKey;
  }

  private isGeminiEnabled(): boolean {
    return this.isEnabled() && this.config.provider === 'GEMINI';
  }

  private sanitizeVisualSvg(svg?: string): string | undefined {
    if (!svg) return undefined;
    return svg
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/on[a-z]+\s*=\s*"[^"]*"/gi, '')
      .replace(/on[a-z]+\s*=\s*'[^']*'/gi, '')
      .trim();
  }

  private extractJsonPayload(text: string): any {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error('Respuesta vacía del modelo');
    }

    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced?.[1]?.trim() || trimmed;

    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    const jsonText = start >= 0 && end >= start ? candidate.slice(start, end + 1) : candidate;

    return JSON.parse(jsonText);
  }

  private async callGeminiJson<T>(
    systemInstruction: string,
    userPrompt: string,
  ): Promise<T> {
    if (!this.isGeminiEnabled()) {
      throw new Error('Gemini no está habilitado');
    }

    const model = this.config.model || 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${this.config.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          role: 'system',
          parts: [{ text: systemInstruction }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: this.config.temperature,
          maxOutputTokens: this.config.maxTokens,
          responseMimeType: 'application/json',
        },
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`Gemini HTTP ${response.status}: ${raw}`);
    }

    const parsed = JSON.parse(raw);
    const candidateText = parsed?.candidates?.[0]?.content?.parts
      ?.map((part: any) => part?.text || '')
      .join('')
      .trim();

    if (!candidateText) {
      throw new Error('El modelo no devolvió contenido utilizable');
    }

    return this.extractJsonPayload(candidateText) as T;
  }

  private normalizeConfidence(value: unknown, fallback = 0.75): number {
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) return fallback;
    if (num > 1) return Math.min(1, num / 100);
    if (num < 0) return fallback;
    return num;
  }

  private buildTeacherContextLine(request: ApdAiTeacherQuestionRequest): string {
    const parts = [
      request.context?.institutionName && `Institución: ${request.context.institutionName}`,
      request.context?.gradeName && `Grado: ${request.context.gradeName}`,
      request.context?.subjectName && `Asignatura: ${request.context.subjectName}`,
      request.context?.topic && `Tema: ${request.context.topic}`,
      request.context?.activityType && `Tipo de actividad: ${request.context.activityType}`,
      request.context?.details && `Detalles: ${request.context.details}`,
    ].filter(Boolean);

    return parts.length ? parts.join('\n') : 'Sin contexto adicional.';
  }

  private buildEdusynKnowledgeContext(): string {
    return [
      'Edusyn es una plataforma educativa SaaS creada por Edusyn SAS.',
      'Valeria es la asistente pedagógica de Edusyn para apoyar al docente.',
      'En Classroom, el flujo normal es: crear actividad en borrador -> agregar preguntas o guía -> revisar -> publicar o programar.',
      'Los quizzes y exámenes pueden publicarse como borrador, Live Quiz o Quiz en Casa.',
      'Las imágenes y apoyos visuales se colocan en el campo de imagen de la pregunta o del contexto; si el docente solicita SVG, debe ser simple, seguro y sin scripts.',
      'Valeria debe dar instrucciones, sugerencias y explicaciones sobre procesos de Edusyn, pero no debe inventar datos no proporcionados ni tocar calificaciones numéricas críticas.',
    ].join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GENERAR ESTRATEGIA DE APOYO
  // ═══════════════════════════════════════════════════════════════════════════

  async generateSupportStrategy(
    request: ApdAiGenerateStrategyRequest,
  ): Promise<ApdAiGenerateStrategyResponse> {
    if (!this.isEnabled()) {
      return this.placeholderStrategy(request);
    }

    // TODO: Implementar llamada real a LLM
    this.logger.warn('AI provider configured but not implemented yet');
    return this.placeholderStrategy(request);
  }

  private placeholderStrategy(
    request: ApdAiGenerateStrategyRequest,
  ): ApdAiGenerateStrategyResponse {
    const { context, planType } = request;
    const category = context.supportCategory || 'general';

    return {
      supportStrategy: `Estrategia de ${planType} para estudiante con ${category}: ` +
        `Implementar ajustes metodológicos que respondan a las necesidades identificadas, ` +
        `con énfasis en ${context.strengths || 'las fortalezas del estudiante'} y ` +
        `abordando ${context.learningBarriers || 'las barreras de aprendizaje'}.`,
      objectives: [
        `Fortalecer las habilidades de ${context.strengths || 'aprendizaje'} del estudiante`,
        `Reducir las barreras relacionadas con ${context.learningBarriers || 'el proceso académico'}`,
        `Implementar ajustes razonables según Decreto 1421 de 2017`,
        `Involucrar a la familia en el proceso de acompañamiento`,
      ],
      adaptationStrategies: [
        'Uso de material visual y concreto para reforzar conceptos',
        'Fragmentación de instrucciones en pasos más pequeños',
        'Tiempo adicional para completar actividades evaluativas',
        'Ubicación preferencial en el aula',
        'Uso de tecnología asistiva cuando sea pertinente',
      ],
      evaluationAdjustments: [
        'Evaluaciones orales como alternativa a escritas cuando sea necesario',
        'Rúbricas adaptadas con criterios claros y específicos',
        'Evaluación del proceso además del producto final',
        'Tiempo extendido en evaluaciones formales',
      ],
      familyCommitmentSuggestion: 
        'La familia se compromete a apoyar el proceso de aprendizaje en casa, ' +
        'asistir a las reuniones de seguimiento y comunicar oportunamente cualquier novedad.',
      followUpRecommendation: 
        'Se recomienda realizar seguimiento quincenal durante el primer mes, ' +
        'luego mensual según evolución del estudiante.',
      confidence: 0.0, // Placeholder = 0 confidence
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUGERIR ACTIVIDADES
  // ═══════════════════════════════════════════════════════════════════════════

  async suggestActivities(
    request: ApdAiSuggestActivitiesRequest,
  ): Promise<ApdAiSuggestActivitiesResponse> {
    if (!this.isEnabled()) {
      return this.placeholderActivities(request);
    }

    // TODO: Implementar llamada real a LLM
    this.logger.warn('AI provider configured but not implemented yet');
    return this.placeholderActivities(request);
  }

  private placeholderActivities(
    request: ApdAiSuggestActivitiesRequest,
  ): ApdAiSuggestActivitiesResponse {
    const { topic, adaptationLevel, adjustmentType } = request;
    const topicText = topic || 'el tema de clase';

    return {
      activities: [
        {
          topic: topicText,
          originalActivityDescription: `Actividad estándar sobre ${topicText}`,
          teacherFinalActivity: `Actividad adaptada: Presentar ${topicText} con apoyo visual, ` +
            `material concreto y guía paso a paso. Permitir trabajo en parejas.`,
          adaptationLevel: adaptationLevel || 'MEDIUM',
          adjustmentType: adjustmentType || 'METHODOLOGICAL',
          rationale: 'Adaptación metodológica que respeta el currículo pero ajusta la forma de presentación.',
        },
        {
          topic: topicText,
          originalActivityDescription: `Evaluación escrita sobre ${topicText}`,
          teacherFinalActivity: `Evaluación adaptada: Formato mixto (selección múltiple + respuesta corta), ` +
            `con tiempo extendido y posibilidad de aclaración oral de preguntas.`,
          adaptationLevel: adaptationLevel || 'MEDIUM',
          adjustmentType: 'EVALUATIVE',
          rationale: 'Ajuste evaluativo que mantiene los mismos objetivos de aprendizaje.',
        },
      ],
      confidence: 0.0,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PREDECIR RIESGO
  // ═══════════════════════════════════════════════════════════════════════════

  async predictRisk(
    request: ApdAiPredictRiskRequest,
  ): Promise<ApdAiPredictRiskResponse> {
    if (!this.isEnabled()) {
      return this.placeholderRisk(request);
    }

    // TODO: Implementar llamada real a LLM
    this.logger.warn('AI provider configured but not implemented yet');
    return this.placeholderRisk(request);
  }

  private placeholderRisk(
    request: ApdAiPredictRiskRequest,
  ): ApdAiPredictRiskResponse {
    // Cálculo básico basado en datos disponibles
    const grades = request.currentTermGrades || [];
    const avgGrade = grades.length > 0
      ? grades.reduce((s, g) => s + g.grade, 0) / grades.length
      : 3.5;
    const attendance = request.attendancePercentage ?? 85;

    let riskScore = 0;
    const riskFactors: ApdAiPredictRiskResponse['riskFactors'] = [];

    if (avgGrade < 3.0) {
      riskScore += 40;
      riskFactors.push({
        factor: 'Rendimiento académico bajo',
        impact: 'HIGH',
        description: `Promedio actual: ${avgGrade.toFixed(2)}`,
      });
    } else if (avgGrade < 3.5) {
      riskScore += 20;
      riskFactors.push({
        factor: 'Rendimiento académico en riesgo',
        impact: 'MEDIUM',
        description: `Promedio actual: ${avgGrade.toFixed(2)}`,
      });
    }

    if (attendance < 70) {
      riskScore += 35;
      riskFactors.push({
        factor: 'Asistencia crítica',
        impact: 'HIGH',
        description: `Asistencia: ${attendance}%`,
      });
    } else if (attendance < 80) {
      riskScore += 15;
      riskFactors.push({
        factor: 'Asistencia irregular',
        impact: 'MEDIUM',
        description: `Asistencia: ${attendance}%`,
      });
    }

    const riskLevel: ApdAiPredictRiskResponse['riskLevel'] =
      riskScore >= 60 ? 'CRITICAL' :
      riskScore >= 40 ? 'HIGH' :
      riskScore >= 20 ? 'MEDIUM' : 'LOW';

    return {
      riskLevel,
      riskScore: Math.min(100, riskScore),
      riskFactors,
      recommendations: [
        'Intensificar el seguimiento del plan de acompañamiento',
        'Comunicar a la familia sobre la situación actual',
        'Revisar y ajustar las estrategias de apoyo',
        'Considerar apoyo adicional en las áreas con mayor dificultad',
      ],
      confidence: 0.0,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GENERAR INFORME DE PROGRESO
  // ═══════════════════════════════════════════════════════════════════════════

  async generateProgressReport(
    request: ApdAiGenerateReportRequest,
  ): Promise<ApdAiGenerateReportResponse> {
    if (!this.isEnabled()) {
      return this.placeholderReport(request);
    }

    // TODO: Implementar llamada real a LLM
    this.logger.warn('AI provider configured but not implemented yet');
    return this.placeholderReport(request);
  }

  private placeholderReport(
    request: ApdAiGenerateReportRequest,
  ): ApdAiGenerateReportResponse {
    const { context, activities, progressLogs } = request;
    const completedCount = activities.filter(a => a.completionStatus === 'COMPLETED').length;
    const totalActivities = activities.length;
    const avgProgress = progressLogs.length > 0
      ? progressLogs.reduce((s, l) => s + l.progressIndicator, 0) / progressLogs.length
      : 3;

    const assessment: ApdAiGenerateReportResponse['overallAssessment'] =
      avgProgress >= 4.5 ? 'EXCELLENT' :
      avgProgress >= 4 ? 'GOOD' :
      avgProgress >= 3 ? 'SATISFACTORY' :
      avgProgress >= 2 ? 'NEEDS_IMPROVEMENT' : 'AT_RISK';

    return {
      narrativeReport: 
        `Durante el período de seguimiento, ${context.studentName} ha participado en ` +
        `${totalActivities} actividades de acompañamiento, completando ${completedCount} de ellas. ` +
        `El indicador promedio de progreso es de ${avgProgress.toFixed(1)}/5. ` +
        `Se observa ${avgProgress >= 3 ? 'un avance positivo' : 'la necesidad de reforzar'} ` +
        `en las áreas trabajadas. ${context.strengths ? `Las fortalezas identificadas (${context.strengths}) ` +
        `han sido aprovechadas en el proceso.` : ''}`,
      highlights: [
        `${completedCount} actividades completadas de ${totalActivities}`,
        `Indicador de progreso promedio: ${avgProgress.toFixed(1)}/5`,
        `Participación activa en el proceso de acompañamiento`,
      ],
      areasOfImprovement: [
        'Continuar fortaleciendo las estrategias de adaptación',
        'Mantener comunicación constante con la familia',
        'Ajustar actividades según respuesta del estudiante',
      ],
      recommendations: [
        'Continuar con el plan de acompañamiento actual',
        'Programar reunión de seguimiento con familia',
        'Documentar avances para el próximo período',
      ],
      overallAssessment: assessment,
      confidence: 0.0,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RECOMENDAR AJUSTES RAZONABLES
  // ═══════════════════════════════════════════════════════════════════════════

  async recommendAdjustments(
    request: ApdAiRecommendAdjustmentsRequest,
  ): Promise<ApdAiRecommendAdjustmentsResponse> {
    if (!this.isEnabled()) {
      return this.placeholderAdjustments(request);
    }

    // TODO: Implementar llamada real a LLM
    this.logger.warn('AI provider configured but not implemented yet');
    return this.placeholderAdjustments(request);
  }

  private placeholderAdjustments(
    request: ApdAiRecommendAdjustmentsRequest,
  ): ApdAiRecommendAdjustmentsResponse {
    const { subjectName, context } = request;

    return {
      adjustments: [
        {
          type: 'METHODOLOGICAL',
          description: `Adaptar la metodología de ${subjectName} usando material visual y concreto`,
          implementation: 'Usar diagramas, mapas conceptuales y material manipulativo',
          legalBasis: 'Decreto 1421 de 2017, Art. 2.3.3.5.2.3.5 - Ajustes razonables',
        },
        {
          type: 'EVALUATIVE',
          description: 'Flexibilizar los tiempos y formatos de evaluación',
          implementation: 'Permitir tiempo adicional y formatos alternativos (oral, práctico)',
          legalBasis: 'Decreto 1421 de 2017, Art. 2.3.3.5.2.3.6 - Evaluación de aprendizajes',
        },
        {
          type: 'CURRICULAR',
          description: 'Priorizar los aprendizajes esenciales del área',
          implementation: 'Identificar DBA fundamentales y adaptar profundidad de contenidos',
          legalBasis: 'Decreto 1421 de 2017 - Diseño Universal para el Aprendizaje (DUA)',
        },
        {
          type: 'ENVIRONMENTAL',
          description: 'Adecuar el espacio físico para favorecer la concentración',
          implementation: 'Ubicación preferencial, reducción de distractores',
          legalBasis: 'Ley 1618 de 2013, Art. 11 - Accesibilidad',
        },
      ],
      generalRecommendations: [
        `Considerar las fortalezas del estudiante: ${context.strengths || 'identificar en observación'}`,
        'Mantener comunicación constante con el equipo de apoyo',
        'Documentar los ajustes implementados y su efectividad',
        'Revisar periódicamente la pertinencia de los ajustes',
      ],
      confidence: 0.0,
    };
  }

  async answerTeacherQuestion(
    request: ApdAiTeacherQuestionRequest,
  ): Promise<ApdAiTeacherQuestionResponse> {
    if (!this.isGeminiEnabled()) {
      return this.placeholderTeacherQuestion(request);
    }

    try {
      const systemInstruction = [
        'Eres Valeria, una asistente pedagógica para docentes.',
        'Responde en español, con tono claro, breve y práctico.',
        'Ayudas a planear quizzes, exámenes, guías y logros, pero no decides notas finales.',
        'Si se solicita apoyo visual, propone SVG simple y seguro, sin scripts ni eventos.',
        'Si la pregunta es sobre Edusyn, usa el contexto interno de la plataforma y prioriza la información dada aquí.',
        'Devuelve únicamente JSON válido con las claves: answer, keyPoints, nextSteps, visualSuggestion, confidence.',
        `Contexto interno de Edusyn:\n${this.buildEdusynKnowledgeContext()}`,
      ].join(' ');

      const userPrompt = [
        `Pregunta del docente: ${request.question}`,
        `Contexto:\n${this.buildTeacherContextLine({
          type: 'ASK_VALERIA',
          question: request.question,
          context: request.context,
          includeVisuals: request.includeVisuals,
          visualPlacement: request.visualPlacement,
        })}`,
        request.includeVisuals
          ? `Necesito una sugerencia visual en formato ${request.visualPlacement || 'QUESTION_IMAGE'}.`
          : 'No es necesario incluir sugerencias visuales.',
      ].join('\n\n');

      const result = await this.callGeminiJson<ApdAiTeacherQuestionResponse>(
        systemInstruction,
        userPrompt,
      );

      return {
        answer: result.answer?.trim() || 'No pude generar una respuesta útil.',
        keyPoints: Array.isArray(result.keyPoints) ? result.keyPoints.filter(Boolean) : [],
        nextSteps: Array.isArray(result.nextSteps) ? result.nextSteps.filter(Boolean) : undefined,
        visualSuggestion: result.visualSuggestion?.kind === 'SVG'
          ? {
              ...result.visualSuggestion,
              svg: this.sanitizeVisualSvg(result.visualSuggestion.svg),
            }
          : result.visualSuggestion,
        confidence: this.normalizeConfidence(result.confidence, 0.8),
      };
    } catch (error: any) {
      this.logger.warn(`Valeria falló con Gemini, usando fallback: ${error?.message || error}`);
      return this.placeholderTeacherQuestion(request);
    }
  }

  private placeholderTeacherQuestion(
    request: ApdAiTeacherQuestionRequest,
  ): ApdAiTeacherQuestionResponse {
    const topic = request.context?.topic || 'el tema solicitado';
    const answer = request.includeVisuals
      ? `Claro. Para ${topic}, Valeria recomienda preparar un borrador breve, revisar el nivel del grupo y luego ubicar el apoyo visual en el bloque de imagen de la pregunta o del contexto.`
      : `Claro. Para ${topic}, Valeria recomienda empezar con un borrador claro, ajustar el lenguaje al grado y revisar que las opciones sean coherentes con el objetivo de aprendizaje.`;

    return {
      answer,
      keyPoints: [
        'Trabajar primero en borrador',
        'Mantener revisión docente antes de publicar',
        'No modificar notas numéricas automáticamente',
      ],
      nextSteps: request.includeVisuals
        ? [
            'Generar un SVG simple o una imagen explicativa',
            'Ubicarla en el bloque de imagen de la pregunta',
            'Validar que no contenga scripts ni elementos peligrosos',
          ]
        : [
            'Definir el objetivo de la actividad',
            'Crear preguntas o guía',
            'Publicar solo después de revisar el borrador',
          ],
      visualSuggestion: request.includeVisuals
        ? {
            kind: 'SVG',
            placement: request.visualPlacement || 'QUESTION_IMAGE',
            svg: this.sanitizeVisualSvg(`
              <svg xmlns="http://www.w3.org/2000/svg" width="640" height="180" viewBox="0 0 640 180" role="img" aria-label="Valeria">
                <rect width="640" height="180" rx="20" fill="#EEF2FF"/>
                <rect x="28" y="28" width="584" height="124" rx="16" fill="#FFFFFF" stroke="#C7D2FE"/>
                <circle cx="88" cy="90" r="34" fill="#6366F1"/>
                <text x="88" y="98" font-size="28" text-anchor="middle" fill="#FFFFFF" font-family="Arial, sans-serif">V</text>
                <text x="150" y="78" font-size="24" font-family="Arial, sans-serif" fill="#1F2937">Valeria</text>
                <text x="150" y="112" font-size="16" font-family="Arial, sans-serif" fill="#4B5563">Asistente pedagógica para borradores, quizzes y guías</text>
              </svg>
            `),
            altText: 'Ilustración simple de Valeria',
            prompt: 'Ilustración SVG simple, limpia y amigable de Valeria para un contexto educativo.',
          }
        : undefined,
      confidence: 0.65,
    };
  }
}
