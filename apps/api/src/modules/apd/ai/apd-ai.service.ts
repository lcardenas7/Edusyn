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
  ApdAiQuestionDraft,
  ApdAiLessonDraft,
  ApdAiLessonSlideDraft,
  ApdAiRoutePlan,
  ApdAiRouteSkill,
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
  // Multi-key: claves por proveedor para que coexistan free (OpenRouter) y
  // premium (Gemini) según el plan de la institución (orquestador §21).
  private readonly providerKeys: Record<string, string | undefined>;

  constructor() {
    const providerEnv = process.env.APD_AI_PROVIDER?.trim().toUpperCase();
    const apiKey = process.env.APD_AI_API_KEY;
    const detectedProvider = this.detectProvider(apiKey);
    this.providerKeys = {
      OPENROUTER: process.env.OPENROUTER_API_KEY || (detectedProvider === 'OPENROUTER' ? apiKey : undefined),
      GEMINI: process.env.GEMINI_API_KEY || (detectedProvider === 'GEMINI' ? apiKey : undefined),
      GROQ: process.env.GROQ_API_KEY || (detectedProvider === 'GROQ' ? apiKey : undefined),
      XAI: process.env.XAI_API_KEY || (detectedProvider === 'XAI' ? apiKey : undefined),
    };
    this.config = {
      provider: (providerEnv as any) || detectedProvider,
      model: process.env.APD_AI_MODEL || this.getDefaultModel(detectedProvider),
      apiKey,
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
    if (this.config.provider !== 'DISABLED' && !!this.config.apiKey) return true;
    // También habilitado si hay alguna key por proveedor (multi-key del orquestador).
    return Object.values(this.providerKeys).some(Boolean);
  }

  private isGeminiEnabled(): boolean {
    return this.isEnabled() && this.config.provider === 'GEMINI';
  }

  private detectProvider(apiKey?: string): 'XAI' | 'GROQ' | 'GEMINI' | 'OPENROUTER' | 'DISABLED' {
    if (!apiKey) return 'DISABLED';
    if (apiKey.startsWith('sk-or-')) return 'OPENROUTER';
    if (apiKey.startsWith('xai-')) return 'XAI';
    if (apiKey.startsWith('gsk_')) return 'GROQ';
    if (apiKey.startsWith('AIza')) return 'GEMINI';
    return 'GEMINI'; // fallback
  }

  // Modelos de OpenRouter en orden de prioridad para cascada de reintentos.
  // Si un modelo ya no existe / dejó de ser gratis (404) o está saturado (429),
  // se cae al siguiente. TODOS deben ser slugs ":free" vigentes (verificado contra
  // https://openrouter.ai/api/v1/models) — un slug muerto desperdicia una llamada
  // y encarece la latencia. Solo modelos "instruct/it" (no "reasoning/thinking",
  // que rompen el JSON-only). Revisar esta lista cada pocos meses.
  // Última verificación: 2026-07.
  private static readonly OPENROUTER_MODEL_CASCADE = [
    'meta-llama/llama-3.3-70b-instruct:free', // fuerte; a veces 429 transitorio → cae rápido al siguiente
    'openai/gpt-oss-120b:free',
    'qwen/qwen3-next-80b-a3b-instruct:free',
    'openai/gpt-oss-20b:free',
    'google/gemma-4-31b-it:free',
    'nvidia/nemotron-nano-9b-v2:free', // verificado funcionando; fallback rápido
    'meta-llama/llama-3.2-3b-instruct:free', // último recurso, ligero
  ];

  private getDefaultModel(provider: string): string {
    switch (provider) {
      case 'OPENROUTER': return ApdAiService.OPENROUTER_MODEL_CASCADE[0];
      case 'XAI': return 'grok-3-mini';
      case 'GROQ': return 'llama-3.3-70b-versatile';
      case 'GEMINI': return 'gemini-2.0-flash';
      default: return 'gemini-2.0-flash';
    }
  }

  private isOpenRouterEnabled(): boolean {
    return this.isEnabled() && this.config.provider === 'OPENROUTER';
  }

  private async callOpenRouterJson<T>(
    systemInstruction: string,
    userPrompt: string,
    maxTokens?: number,
    creds?: { apiKey?: string; model?: string },
  ): Promise<T> {
    const apiKey = creds?.apiKey ?? this.providerKeys.OPENROUTER ?? this.config.apiKey;
    if (!apiKey) throw new Error('OpenRouter no está habilitado');

    const preferred = creds?.model || this.config.model;
    const modelsToTry = preferred && !ApdAiService.OPENROUTER_MODEL_CASCADE.includes(preferred)
      ? [preferred, ...ApdAiService.OPENROUTER_MODEL_CASCADE]
      : ApdAiService.OPENROUTER_MODEL_CASCADE;

    let lastError: Error | null = null;

    for (const model of modelsToTry) {
      try {
        this.logger.log(`OpenRouter intentando modelo: ${model}`);
        const result = await this.callOpenRouterWithModel<T>(model, systemInstruction, userPrompt, maxTokens, apiKey);
        this.logger.log(`OpenRouter modelo exitoso: ${model}`);
        return result;
      } catch (err: any) {
        lastError = err;
        const errMessage = String(err?.message || err || '');
        const lower = errMessage.toLowerCase();
        const is429 = errMessage.includes('429') || lower.includes('rate-limit');
        const isRetryableProviderError =
          /OpenRouter HTTP (5\d\d)/i.test(errMessage) ||
          lower.includes('no healthy upstream') ||
          lower.includes('provider returned error') ||
          lower.includes('temporarily unavailable');
        // Modelo inexistente / ya no gratis (404): cae al siguiente de la cascada.
        const isModelUnavailable =
          /OpenRouter HTTP 404/i.test(errMessage) ||
          lower.includes('unavailable') ||
          lower.includes('use this slug instead') ||
          lower.includes('not a valid model') ||
          lower.includes('no endpoints found') ||
          lower.includes('no allowed providers');

        if (is429 || isRetryableProviderError || isModelUnavailable) {
          this.logger.warn(`OpenRouter modelo ${model} no usable (${errMessage}), probando siguiente...`);
          continue;
        }
        // Para otros errores, no reintentar con otro modelo
        throw err;
      }
    }

    throw lastError || new Error('Todos los modelos de OpenRouter fallaron');
  }

  private async callOpenRouterWithModel<T>(
    model: string,
    systemInstruction: string,
    userPrompt: string,
    maxTokens?: number,
    apiKey?: string,
  ): Promise<T> {
    const url = 'https://openrouter.ai/api/v1/chat/completions';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey ?? this.config.apiKey}`,
        'HTTP-Referer': 'https://edusyn.co',
        'X-Title': 'Edusyn - Valeria AI',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userPrompt },
        ],
        temperature: this.config.temperature ?? 0.7,
        max_tokens: Math.max(maxTokens ?? this.config.maxTokens ?? 2000, 4000),
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`OpenRouter HTTP ${response.status}: ${raw}`);
    }

    const parsed = JSON.parse(raw);
    const content = parsed?.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error('OpenRouter no devolvió contenido utilizable');
    }

    return this.extractJsonPayload(content) as T;
  }

  private isXaiEnabled(): boolean {
    return this.isEnabled() && this.config.provider === 'XAI';
  }

  private isGroqEnabled(): boolean {
    return this.isEnabled() && this.config.provider === 'GROQ';
  }

  private async callGroqJson<T>(
    systemInstruction: string,
    userPrompt: string,
    maxTokens?: number,
    creds?: { apiKey?: string; model?: string },
  ): Promise<T> {
    const apiKey = creds?.apiKey ?? this.providerKeys.GROQ ?? this.config.apiKey;
    if (!apiKey) throw new Error('Groq no está habilitado');

    const model = creds?.model || this.config.model || 'llama-3.1-8b-instant';
    const url = 'https://api.groq.com/openai/v1/chat/completions';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userPrompt },
        ],
        temperature: this.config.temperature ?? 0.7,
        max_tokens: maxTokens ?? this.config.maxTokens ?? 2000,
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`Groq HTTP ${response.status}: ${raw}`);
    }

    const parsed = JSON.parse(raw);
    const content = parsed?.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error('Groq no devolvió contenido utilizable');
    }

    return this.extractJsonPayload(content) as T;
  }

  private async callXaiJson<T>(
    systemInstruction: string,
    userPrompt: string,
    maxTokens?: number,
    creds?: { apiKey?: string; model?: string },
  ): Promise<T> {
    const apiKey = creds?.apiKey ?? this.providerKeys.XAI ?? this.config.apiKey;
    if (!apiKey) throw new Error('xAI no está habilitado');

    const model = creds?.model || this.config.model || 'grok-3-mini';
    const url = 'https://api.x.ai/v1/chat/completions';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userPrompt },
        ],
        temperature: this.config.temperature ?? 0.7,
        max_tokens: maxTokens ?? this.config.maxTokens ?? 2000,
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`xAI HTTP ${response.status}: ${raw}`);
    }

    const parsed = JSON.parse(raw);
    const content = parsed?.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error('xAI no devolvió contenido utilizable');
    }

    return this.extractJsonPayload(content) as T;
  }

  private async callLlmJson<T>(
    systemInstruction: string,
    userPrompt: string,
    maxTokens?: number,
    route?: { provider?: string; model?: string },
  ): Promise<T> {
    // Proveedor efectivo: el del route (orquestador) o el de la config por defecto.
    const provider = (route?.provider || this.config.provider || '').toUpperCase();
    const apiKey = this.providerKeys[provider] || this.config.apiKey;
    if (!apiKey) throw new Error(`Sin API key para el proveedor ${provider || 'IA'}`);
    const creds = { apiKey, model: route?.model };
    switch (provider) {
      case 'OPENROUTER': return this.callOpenRouterJson<T>(systemInstruction, userPrompt, maxTokens, creds);
      case 'GROQ': return this.callGroqJson<T>(systemInstruction, userPrompt, maxTokens, creds);
      case 'XAI': return this.callXaiJson<T>(systemInstruction, userPrompt, maxTokens, creds);
      case 'GEMINI': return this.callGeminiJson<T>(systemInstruction, userPrompt, maxTokens, creds);
      default: throw new Error('Ningún proveedor de IA está habilitado');
    }
  }

  /** ¿Hay API key disponible para este proveedor? (para el orquestador). */
  providerAvailable(provider: string): boolean {
    return !!this.providerKeys[(provider || '').toUpperCase()];
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
    maxTokens?: number,
    creds?: { apiKey?: string; model?: string },
  ): Promise<T> {
    const apiKey = creds?.apiKey ?? this.providerKeys.GEMINI ?? this.config.apiKey;
    if (!apiKey) throw new Error('Gemini no está habilitado');

    const model = creds?.model || this.config.model || 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

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
          maxOutputTokens: maxTokens ?? this.config.maxTokens,
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
      request.context?.pageName && `Pantalla actual: ${request.context.pageName}`,
      request.context?.pageSummary && `Qué hace la pantalla: ${request.context.pageSummary}`,
      request.context?.currentPath && `Ruta actual: ${request.context.currentPath}`,
      request.context?.gradeName && `Grado: ${request.context.gradeName}`,
      request.context?.subjectName && `Asignatura: ${request.context.subjectName}`,
      request.context?.topic && `Tema: ${request.context.topic}`,
      request.context?.activityType && `Tipo de actividad: ${request.context.activityType}`,
      request.context?.details && `Detalles: ${request.context.details}`,
    ].filter(Boolean);

    return parts.length ? parts.join('\n') : 'Sin contexto adicional.';
  }

  private buildConversationContext(conversation?: ApdAiTeacherQuestionRequest['conversation']): string {
    if (!conversation || conversation.length === 0) {
      return 'Sin historial previo.';
    }

    return conversation
      .slice(-4)
      .map((message) => {
        const content = message.content.length > 280
          ? `${message.content.slice(0, 280).trim()}…`
          : message.content;
        return `${message.role === 'assistant' ? 'Asistente' : 'Docente'}: ${content}`;
      })
      .join('\n');
  }

  private buildEdusynKnowledgeContext(): string {
    return [
      'Edusyn es una plataforma educativa SaaS creada por Edusyn SAS.',
      'Valeria es la asistente pedagógica de Edusyn para apoyar al docente.',
      'Si el usuario pregunta por la pantalla actual, responde primero con base en el contexto de esa pantalla.',
      'Si el contexto incluye pageName o pageSummary, úsalo como referencia principal para ubicar al usuario en la interfaz.',
      'Cuando la pregunta sea sobre un flujo de Edusyn, responde con pasos concretos, menú probable, campos que debe llenar y resultado esperado.',
      'No respondas como IA genérica si la intención del usuario es usar un módulo de la plataforma.',
      'En Classroom, el flujo normal es: crear actividad en borrador -> agregar preguntas o guía -> revisar -> publicar o programar.',
      'Los quizzes y exámenes pueden publicarse como borrador, Live Quiz o Quiz en Casa.',
      'Si la petición es crear un quiz o un examen, incluye también una lista de preguntas dentro de activityDraft.questions y procura que sean editables y listas para crear en Classroom.',
      'Las imágenes y apoyos visuales se colocan en el campo de imagen de la pregunta o del contexto; si el docente solicita SVG, debe ser simple, seguro y sin scripts.',
      'En notas y calificaciones, normalmente se trabaja por grupo, asignatura y período; el docente ingresa valoraciones, logros o descriptores y el sistema calcula promedios según la configuración institucional.',
      'En logros, explica cómo registrarlos o consultarlos por asignatura, período o reporte, y menciona que pueden aparecer en boletines o reportes académicos.',
      'En asistencia, orienta sobre selección de grupo o docente, fecha, registro de presentes/ausentes/tardanzas/excusas y consultas de reportes.',
      'En observaciones o seguimiento, orienta a registrar notas de comportamiento o seguimiento con fecha, categoría y estudiante, especialmente desde observador o workspace del docente.',
      'En reportes y boletines, explica cómo generar salidas por período, grupo o estudiante, incluyendo notas, logros, asistencia y observaciones cuando aplique.',
      'Valeria debe dar instrucciones, sugerencias y explicaciones sobre procesos de Edusyn, pero no debe inventar datos no proporcionados ni tocar calificaciones numéricas críticas.',
    ].join('\n');
  }

  /**
   * Construye el prompt del sistema optimizado para generación de quizzes educativos.
   */
  private buildQuizSystemPrompt(request: ApdAiTeacherQuestionRequest): string {
    const q = (request.question || '').toLowerCase();
    const isQuizRequest = q.includes('quiz') || q.includes('examen') || q.includes('pregunta') || q.includes('cuestionario') || q.includes('evaluación');
    const requestedCount = this.extractQuestionCount(request.question || '');
    const extractedTopic = this.extractTopicFromQuestion(request.question || '');
    const wantsTrueFalse = q.includes('falso') || q.includes('verdadero') || q.includes('v/f');

    const basePrompt = [
      'Eres Valeria, asistente IA educativa de Edusyn. Responde en español, claro y práctico.',
    ];

    if (isQuizRequest) {
      basePrompt.push(
        '',
        '=== INSTRUCCIONES CRÍTICAS PARA GENERAR QUIZ ===',
        `TEMA DETECTADO: "${extractedTopic || 'tema solicitado por el usuario'}"`,
        `CANTIDAD REQUERIDA: ${requestedCount} preguntas`,
        '',
        'REGLAS OBLIGATORIAS:',
        `1. Genera EXACTAMENTE ${requestedCount} preguntas sobre "${extractedTopic || 'el tema solicitado'}".`,
        '2. Las preguntas deben ser ESPECÍFICAS del tema, con contenido educativo real.',
        '3. NO generes preguntas genéricas como "¿Cuál es una ventaja de X?" o "¿Quién debe supervisar X?".',
        '4. Cada pregunta debe evaluar un concepto o conocimiento específico del tema.',
        '5. Las 4 opciones deben ser PLAUSIBLES - no uses opciones obviamente incorrectas.',
        '6. VARÍA la posición de la respuesta correcta (no siempre A).',
        wantsTrueFalse 
          ? '7. INCLUYE preguntas tipo TRUE_FALSE (Verdadero/Falso) como solicitó el usuario.'
          : '7. Usa principalmente MULTIPLE_CHOICE con 4 opciones.',
        '8. Adapta la dificultad al nivel educativo mencionado.',
        '',
        'FORMATO JSON para activityDraft.questions:',
        '[',
        '  {',
        '    "type": "MULTIPLE_CHOICE" | "TRUE_FALSE",',
        '    "text": "Pregunta específica sobre el tema",',
        '    "options": ["Opción A", "Opción B", "Opción C", "Opción D"],',
        '    "correctAnswer": "Texto exacto de la opción correcta",',
        '    "points": 1,',
        '    "explanation": "Breve explicación de por qué es correcta"',
        '  }',
        ']',
        '',
        'EJEMPLO para "pensamiento computacional":',
        '- "¿Qué es la descomposición en pensamiento computacional?" (concepto específico)',
        '- "¿Cuál es un ejemplo de abstracción?" (aplicación práctica)',
        '- "Verdadero o falso: Un algoritmo es una secuencia de pasos para resolver un problema" (TRUE_FALSE)',
        '',
      );
    }

    basePrompt.push(
      'Devuelve JSON válido con: answer, keyPoints, activityDraft (con questions), confidence.',
      `Contexto Edusyn:\n${this.buildEdusynKnowledgeContext()}`,
    );

    return basePrompt.join('\n');
  }

  /**
   * Randomiza la posición de la respuesta correcta en las opciones.
   */
  private shuffleOptionsWithCorrectAnswer(options: string[], correctAnswer: string): { options: string[]; correctAnswer: string } {
    const shuffled = [...options].sort(() => Math.random() - 0.5);
    return { options: shuffled, correctAnswer };
  }

  private buildActivityDraftSuggestion(request: ApdAiTeacherQuestionRequest): ApdAiTeacherQuestionResponse['activityDraft'] | undefined {
    const q = (request.question || '').toLowerCase();
    // PRIORIZAR tema extraído de la pregunta del usuario sobre el contexto de página
    const extractedTopic = this.extractTopicFromQuestion(request.question || '');
    const topicSource = extractedTopic
      || request.context?.topic?.trim()
      || request.context?.subjectName?.trim()
      || request.context?.gradeName?.trim()
      || 'el curso';

    const isExam = q.includes('examen') || q.includes('icfes') || q.includes('prueba');
    const isQuiz = q.includes('quiz') || q.includes('cuestionario') || q.includes('evaluación rápida');
    const isTask = q.includes('actividad') || q.includes('tarea') || q.includes('guía') || q.includes('guia') || q.includes('ejercicio');

    if (!isExam && !isQuiz && !isTask) {
      return undefined;
    }

    const type = isExam ? 'EXAM' : isQuiz ? 'QUIZ' : 'TASK';
    const title = isExam
      ? `Examen: ${topicSource}`
      : isQuiz
        ? `Quiz: ${topicSource}`
        : `Actividad: ${topicSource}`;

    const description = [
      `Actividad sugerida por Valeria para ${topicSource}.`,
      '',
      request.question?.trim() || 'Usa esta actividad como base y ajusta el contenido según tu grupo.',
      '',
      isExam
        ? 'Sugerencia: usa preguntas de selección única, define un tiempo límite y deja los resultados visibles al final.'
        : isQuiz
          ? 'Sugerencia: combina preguntas cortas y de selección múltiple, y publícala como borrador antes de enviarla.'
          : 'Sugerencia: define instrucciones claras, criterios de entrega y un producto final simple para el estudiante.',
    ].join('\n');

    const questions = this.buildQuestionDraftSuggestion(request, type);

    return {
      title,
      description,
      type,
      maxScore: '5.0',
      allowLateSubmit: false,
      shuffleQuestions: isExam || isQuiz,
      showResults: true,
      maxAttempts: '1',
      questions,
    };
  }

  /**
   * Extrae el tema principal de la pregunta del usuario.
   * Busca patrones como "sobre X", "de X", "tema X", etc.
   */
  private extractTopicFromQuestion(question: string): string | undefined {
    // Patrones ordenados de más específico a más general
    const patterns = [
      // "tema de X" o "el tema de X"
      /(?:el\s+)?tema\s+(?:de|del)\s+(.+?)(?:\s*[,.]|\s+(?:deben|las opciones|organiza|con\s+\d+|para\s+\w+\s+grado))/i,
      // "preguntas relacionadas con el tema de X"
      /preguntas?\s+(?:relacionadas?\s+)?(?:con\s+(?:el\s+tema\s+(?:de|del)\s+)?|sobre\s+(?:el\s+tema\s+(?:de|del)\s+)?)(.+?)(?:\s*[,.]|\s+(?:deben|las opciones|organiza|con\s+\d+|para\s+\w+\s+grado))/i,
      // "quiz/examen de N preguntas sobre X" o "quiz sobre X"
      /(?:quiz|examen|cuestionario|evaluaci[oó]n|prueba)\s+(?:(?:en\s+el\s+classrr?oom\s+)?(?:de\s+)?\d+\s+pre[gq]untas?\s+)?(?:sobre|de|acerca de|del tema(?:\s+de)?|relacionad[ao]s?\s+con(?:\s+el\s+tema\s+de)?)\s+(.+?)(?:\s*[,.]|\s+(?:deben|las opciones|organiza|para\s+\w+\s+grado))/i,
      // "sobre X" (más general, captura amplia)
      /(?:sobre|acerca de)\s+(?:el\s+tema\s+(?:de|del)\s+)?(.+?)(?:\s*[,.]|\s+(?:deben|las opciones|organiza|con\s+\d+\s+pre|para\s+\w+\s+grado))/i,
      // "tema: X" o "tema X"
      /(?:tema|t[oó]pico)\s*:?\s+(.+?)(?:\s*[,.]|\s+(?:deben|las opciones|organiza|para|con\s+\d+))/i,
    ];
    
    for (const pattern of patterns) {
      const match = question.match(pattern);
      if (match?.[1]) {
        let topic = match[1].trim();
        // Limpiar palabras sueltas al final
        topic = topic.replace(/\s+(y|con|para|de|del|la|el|los|las|en)\s*$/i, '').trim();
        if (topic.length > 2 && topic.length < 150) {
          return topic;
        }
      }
    }
    
    return undefined;
  }

  /**
   * Extrae la cantidad de preguntas solicitadas de la pregunta del usuario.
   */
  private extractQuestionCount(question: string): number {
    const match = question.match(/(\d+)\s*preguntas?/i);
    if (match?.[1]) {
      const count = parseInt(match[1], 10);
      if (count >= 1 && count <= 50) {
        return count;
      }
    }
    return 5; // default
  }

  private buildQuestionDraftSuggestion(
    request: ApdAiTeacherQuestionRequest,
    activityType?: 'QUIZ' | 'EXAM' | 'TASK',
  ): ApdAiQuestionDraft[] | undefined {
    const q = (request.question || '').toLowerCase();
    
    // Priorizar tema extraído de la pregunta del usuario
    const extractedTopic = this.extractTopicFromQuestion(request.question || '');
    const topicSource = extractedTopic
      || request.context?.topic?.trim()
      || request.context?.subjectName?.trim()
      || request.context?.gradeName?.trim()
      || 'el tema';

    const shouldGenerate = activityType === 'QUIZ'
      || activityType === 'EXAM'
      || q.includes('quiz')
      || q.includes('examen')
      || q.includes('cuestionario')
      || q.includes('pregunta')
      || q.includes('evaluación')
      || q.includes('prueba');

    if (!shouldGenerate) {
      return undefined;
    }

    const topicLabel = topicSource.replace(/^./, (char) => char.toUpperCase());
    const requestedCount = this.extractQuestionCount(request.question || '');
    const wantsTrueFalse = q.includes('falso') || q.includes('verdadero') || q.includes('v/f');

    // Banco de preguntas con opciones que se randomizarán
    const rawQuestions: Array<{
      type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE';
      text: string;
      options: string[];
      correctIndex: number; // índice de la respuesta correcta (antes de randomizar)
      explanation: string;
    }> = [
      // Preguntas de concepto
      {
        type: 'MULTIPLE_CHOICE',
        text: `¿Cuál de las siguientes opciones describe mejor qué es ${topicLabel}?`,
        options: [
          `Un conjunto de conceptos y habilidades relacionados con ${topicLabel}`,
          'Un tipo de software de computadora únicamente',
          'Una materia que solo se estudia en la universidad',
          'Un pasatiempo sin aplicación práctica',
        ],
        correctIndex: 0,
        explanation: `${topicLabel} abarca conceptos y habilidades aplicables en diversos contextos.`,
      },
      {
        type: 'MULTIPLE_CHOICE',
        text: `¿Por qué es importante estudiar ${topicLabel}?`,
        options: [
          'Solo es importante para programadores',
          'No tiene ninguna importancia real',
          `Desarrolla habilidades de análisis y resolución de problemas`,
          'Es obligatorio pero no tiene beneficios',
        ],
        correctIndex: 2,
        explanation: `Estudiar ${topicLabel} desarrolla habilidades valiosas para la vida.`,
      },
      {
        type: 'MULTIPLE_CHOICE',
        text: `¿En qué áreas se puede aplicar ${topicLabel}?`,
        options: [
          'Solo en matemáticas',
          'Únicamente en informática',
          'En ninguna área práctica',
          `En múltiples áreas: ciencias, arte, vida cotidiana`,
        ],
        correctIndex: 3,
        explanation: `${topicLabel} tiene aplicaciones en diversas áreas del conocimiento.`,
      },
      {
        type: 'MULTIPLE_CHOICE',
        text: `¿Cuál es una característica fundamental de ${topicLabel}?`,
        options: [
          'Requiere memorizar fórmulas complejas',
          `Implica analizar problemas y buscar soluciones sistemáticas`,
          'Solo se puede aprender con computadoras',
          'Es exclusivo para adultos',
        ],
        correctIndex: 1,
        explanation: `${topicLabel} se centra en el análisis y la resolución sistemática de problemas.`,
      },
      {
        type: 'MULTIPLE_CHOICE',
        text: `¿Qué habilidad NO está directamente relacionada con ${topicLabel}?`,
        options: [
          'Descomponer problemas en partes más pequeñas',
          'Identificar patrones',
          `Memorizar datos sin analizarlos`,
          'Crear algoritmos o pasos ordenados',
        ],
        correctIndex: 2,
        explanation: `${topicLabel} enfatiza el análisis, no la memorización sin comprensión.`,
      },
      {
        type: 'MULTIPLE_CHOICE',
        text: `¿Cómo puede ${topicLabel} ayudarte en la vida diaria?`,
        options: [
          `Organizando tareas y resolviendo problemas de forma lógica`,
          'No tiene aplicación fuera del aula',
          'Solo sirve para usar computadoras',
          'Únicamente para hacer tareas escolares',
        ],
        correctIndex: 0,
        explanation: `${topicLabel} ayuda a organizar el pensamiento y resolver problemas cotidianos.`,
      },
      {
        type: 'MULTIPLE_CHOICE',
        text: `¿Cuál es el primer paso recomendado al abordar un problema usando ${topicLabel}?`,
        options: [
          'Escribir código inmediatamente',
          'Pedir ayuda sin intentar',
          'Ignorar el problema',
          `Entender y analizar el problema antes de buscar soluciones`,
        ],
        correctIndex: 3,
        explanation: 'Comprender el problema es esencial antes de buscar soluciones.',
      },
      {
        type: 'MULTIPLE_CHOICE',
        text: `¿Qué significa "descomponer" en el contexto de ${topicLabel}?`,
        options: [
          'Destruir algo físicamente',
          `Dividir un problema grande en partes más pequeñas y manejables`,
          'Olvidar información innecesaria',
          'Combinar varios problemas en uno',
        ],
        correctIndex: 1,
        explanation: 'La descomposición es dividir problemas complejos en partes más simples.',
      },
    ];

    // Preguntas tipo Verdadero/Falso
    const trueFalseQuestions: Array<{
      type: 'TRUE_FALSE';
      text: string;
      options: string[];
      correctIndex: number;
      explanation: string;
    }> = [
      {
        type: 'TRUE_FALSE',
        text: `Verdadero o falso: ${topicLabel} solo se puede aprender usando computadoras.`,
        options: ['Verdadero', 'Falso'],
        correctIndex: 1,
        explanation: `${topicLabel} se puede aprender con o sin computadoras, usando lógica y análisis.`,
      },
      {
        type: 'TRUE_FALSE',
        text: `Verdadero o falso: ${topicLabel} ayuda a desarrollar el pensamiento lógico.`,
        options: ['Verdadero', 'Falso'],
        correctIndex: 0,
        explanation: `${topicLabel} fortalece las habilidades de razonamiento lógico.`,
      },
      {
        type: 'TRUE_FALSE',
        text: `Verdadero o falso: Un algoritmo es una secuencia ordenada de pasos para resolver un problema.`,
        options: ['Verdadero', 'Falso'],
        correctIndex: 0,
        explanation: 'Un algoritmo es precisamente una serie de pasos ordenados para lograr un objetivo.',
      },
      {
        type: 'TRUE_FALSE',
        text: `Verdadero o falso: ${topicLabel} es útil solo para quienes quieren ser programadores.`,
        options: ['Verdadero', 'Falso'],
        correctIndex: 1,
        explanation: `${topicLabel} es útil para cualquier persona, no solo programadores.`,
      },
      {
        type: 'TRUE_FALSE',
        text: `Verdadero o falso: Identificar patrones es una habilidad importante en ${topicLabel}.`,
        options: ['Verdadero', 'Falso'],
        correctIndex: 0,
        explanation: 'Reconocer patrones ayuda a encontrar soluciones más eficientes.',
      },
      {
        type: 'TRUE_FALSE',
        text: `Verdadero o falso: La abstracción consiste en enfocarse en los detalles importantes e ignorar los irrelevantes.`,
        options: ['Verdadero', 'Falso'],
        correctIndex: 0,
        explanation: 'La abstracción permite simplificar problemas enfocándose en lo esencial.',
      },
    ];

    // Combinar preguntas según lo solicitado
    let questionBank = wantsTrueFalse
      ? [...trueFalseQuestions, ...rawQuestions]
      : [...rawQuestions, ...trueFalseQuestions];

    // Randomizar y construir las preguntas finales
    const finalQuestions: ApdAiQuestionDraft[] = questionBank
      .slice(0, requestedCount)
      .map((q, idx) => {
        if (q.type === 'TRUE_FALSE') {
          return {
            type: q.type,
            text: q.text,
            options: q.options,
            correctAnswer: q.options[q.correctIndex],
            points: 1,
            explanation: q.explanation,
            sortOrder: idx,
          };
        }

        // Para MULTIPLE_CHOICE, randomizar las opciones
        const correctAnswer = q.options[q.correctIndex];
        const shuffled = [...q.options].sort(() => Math.random() - 0.5);
        
        return {
          type: q.type,
          text: q.text,
          options: shuffled,
          correctAnswer: correctAnswer,
          points: 1,
          explanation: q.explanation,
          sortOrder: idx,
        };
      });

    return finalQuestions;
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

  // ═══════════════════════════════════════════════════════════════════════════
  // PARSER DE PREGUNTAS PEGADAS (ChatGPT, Google, etc.)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Detecta si el texto del usuario contiene preguntas formateadas (pegadas de ChatGPT u otra fuente).
   */
  private detectsPastedQuestions(text: string): boolean {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    let numberedLines = 0;
    let optionLines = 0;
    let answerLines = 0;

    for (const line of lines) {
      if (/^\d+[\.\)\-]/.test(line)) numberedLines++;
      if (/^[a-dA-D][\.\)\-]\s*.{1,}/.test(line)) optionLines++;
      if (/(?:respuesta|✅|answer)/i.test(line)) answerLines++;
    }

    // Al menos 2 preguntas numeradas Y (opciones O respuestas de V/F)
    return numberedLines >= 2 && (optionLines >= 4 || answerLines >= 2);
  }

  /**
   * Parsea preguntas pegadas de texto formateado (ChatGPT, etc.).
   * 
   * Soporta formatos multi-línea como:
   *   1. (Selección múltiple)
   *   ¿Cuál es la pregunta real?
   *   A. Opción
   *   B. Opción
   *   ✅ Respuesta: B. Opción
   * 
   * Y también formato de una línea:
   *   1. ¿Cuál es la pregunta?
   *   a) Opción
   *   Respuesta: a
   */
  private parsePastedQuestions(text: string): ApdAiQuestionDraft[] {
    const questions: ApdAiQuestionDraft[] = [];
    
    // Dividir en bloques por líneas que empiezan con número
    const blocks: string[] = [];
    let currentBlock = '';
    
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      // Nueva pregunta: línea que empieza con "N." o "N)" o "N-"
      if (/^\d+[\.\)\-]/.test(trimmed)) {
        if (currentBlock.trim()) {
          blocks.push(currentBlock);
        }
        currentBlock = '';
      }
      currentBlock += line + '\n';
    }
    if (currentBlock.trim()) blocks.push(currentBlock);
    
    for (const block of blocks) {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) continue;

      // Verificar que empiece con número
      if (!/^\d+[\.\)\-]/.test(lines[0])) continue;

      // Extraer todas las partes del bloque
      const options: string[] = [];
      let correctAnswer: string | undefined;
      let explanation: string | undefined;
      const questionParts: string[] = [];

      for (const line of lines) {
        const cleaned = line.replace(/\*\*/g, '').trim();

        // Detectar opción: "A.", "a)", "A)", "a.-", "A.-"
        const optionMatch = cleaned.match(/^([a-dA-D])[\.\)\-]+\s*(.+)/);
        if (optionMatch) {
          let optText = optionMatch[2].trim();
          // Detectar marca de correcta: ✓, ✔, (correcta)
          if (/[✓✔]/.test(line) || /\(correcta?\)/i.test(line)) {
            optText = optText.replace(/[✓✔]/g, '').replace(/\(correcta?\)/gi, '').trim();
            correctAnswer = optText;
          }
          options.push(optText);
          continue;
        }

        // Detectar respuesta con ✅ o "Respuesta:"
        // Formatos: "✅ Respuesta: B. Erling Haaland", "Respuesta: b", "✅ Respuesta: Verdadero"
        const answerMatch = cleaned.match(/^(?:✅\s*)?(?:respuesta|respuesta\s+correcta|correct[ao]?|answer)\s*:\s*(.+)/i);
        if (answerMatch) {
          let answerValue = answerMatch[1].trim();
          // Limpiar "B. Texto" → extraer letra y texto
          const letterWithText = answerValue.match(/^([a-dA-D])[\.\)\-]\s*(.+)/);
          if (letterWithText && options.length > 0) {
            // Usar la letra para encontrar la opción correcta
            const idx = letterWithText[1].toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0);
            if (idx >= 0 && idx < options.length) {
              correctAnswer = options[idx];
            } else {
              correctAnswer = letterWithText[2].trim();
            }
          } else {
            // Solo una letra: "b" → mapear al índice
            const justLetter = answerValue.match(/^([a-dA-D])$/i);
            if (justLetter && options.length > 0) {
              const idx = justLetter[1].toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0);
              if (idx >= 0 && idx < options.length) {
                correctAnswer = options[idx];
              }
            } else {
              // Texto directo: "Verdadero", "Falso"
              correctAnswer = answerValue;
            }
          }
          continue;
        }

        // Detectar explicación
        const explMatch = cleaned.match(/^(?:explicaci[oó]n|justificaci[oó]n|nota|explanation)\s*:\s*(.+)/i);
        if (explMatch) {
          explanation = explMatch[1].trim();
          continue;
        }

        // Todo lo demás es parte del texto de la pregunta
        questionParts.push(cleaned);
      }

      // Construir el texto de la pregunta:
      // Unir todas las partes que no son opciones/respuestas/explicaciones
      // Filtrar: número inicial, etiquetas como "(Selección múltiple)", "(Falso / Verdadero)"
      let questionText = questionParts
        .map(p => p.replace(/^\d+[\.\)\-]\s*/, '').trim()) // quitar numeración
        .filter(p => {
          if (!p) return false;
          // Filtrar etiquetas de tipo
          if (/^\(?\s*(?:selecci[oó]n\s+m[uú]ltiple|opci[oó]n\s+m[uú]ltiple|falso\s*[\/-]\s*verdadero|verdadero\s*[\/-]\s*falso|an[aá]lisis|selecci[oó]n\s+m[uú]ltiple\s*-\s*an[aá]lisis)\s*\)?$/i.test(p)) return false;
          return true;
        })
        .join(' ')
        .trim();

      if (!questionText || questionText.length < 5) continue;

      // Detectar si es Verdadero/Falso
      const blockText = block.toLowerCase();
      const isTrueFalse = /falso\s*[\/-]\s*verdadero|verdadero\s*[\/-]\s*falso/i.test(blockText)
        || (options.length === 0 && correctAnswer && /^(verdadero|falso|true|false)$/i.test(correctAnswer));

      // Construir la pregunta final
      if (isTrueFalse) {
        questions.push({
          type: 'TRUE_FALSE',
          text: questionText,
          options: ['Verdadero', 'Falso'],
          correctAnswer: correctAnswer || 'Verdadero',
          points: 1,
          explanation,
        });
      } else if (options.length >= 2) {
        questions.push({
          type: 'MULTIPLE_CHOICE',
          text: questionText,
          options,
          correctAnswer: correctAnswer || options[0],
          points: 1,
          explanation,
        });
      }
    }

    return questions;
  }

  /**
   * Intenta detectar y parsear preguntas pegadas del usuario.
   * Si las detecta, retorna la respuesta con el quiz armado. Si no, retorna undefined.
   */
  private tryParsePastedQuiz(request: ApdAiTeacherQuestionRequest): ApdAiTeacherQuestionResponse | undefined {
    const text = request.question || '';
    
    if (!this.detectsPastedQuestions(text)) {
      return undefined;
    }

    const parsedQuestions = this.parsePastedQuestions(text);
    if (parsedQuestions.length < 2) {
      return undefined;
    }

    this.logger.log(`Parser detectó ${parsedQuestions.length} preguntas pegadas del usuario`);

    const extractedTopic = this.extractTopicFromQuestion(text) || 'Quiz personalizado';
    const topicLabel = extractedTopic.replace(/^./, (c) => c.toUpperCase());

    return {
      answer: `✅ **¡Listo!** He detectado y organizado **${parsedQuestions.length} preguntas** de tu texto.\n\nHe creado un borrador de quiz con todas las preguntas, opciones y respuestas correctas extraídas automáticamente.\n\n**Resumen:**\n- ${parsedQuestions.filter(q => q.type === 'MULTIPLE_CHOICE').length} preguntas de selección múltiple\n- ${parsedQuestions.filter(q => q.type === 'TRUE_FALSE').length} preguntas de verdadero/falso\n\n_Revisa el borrador y ajusta lo que necesites antes de publicar._`,
      keyPoints: [
        `${parsedQuestions.length} preguntas parseadas correctamente`,
        'Las respuestas correctas fueron detectadas automáticamente',
        'Puedes editar cualquier pregunta antes de publicar',
      ],
      activityDraft: {
        title: `Quiz: ${topicLabel}`,
        description: `Quiz creado a partir de preguntas proporcionadas por el docente.`,
        type: 'QUIZ',
        maxScore: '5.0',
        allowLateSubmit: false,
        shuffleQuestions: true,
        showResults: true,
        maxAttempts: '1',
        questions: parsedQuestions,
      },
      confidence: 0.95,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DISEÑO PEDAGÓGICO IA ("Estudio") — genera un Activo Pedagógico estructurado.
  // Reutiliza el cliente LLM (callLlmJson). Si la IA no está habilitada o falla,
  // devuelve una plantilla estructurada para que el módulo nunca quede vacío.
  // ═══════════════════════════════════════════════════════════════════════════
  async generatePedagogicalDesign(input: {
    prompt: string;
    experienceType?: string;
    gradeName?: string;
    subjectName?: string;
    sessions?: number;
    institutionName?: string;
  }, route?: { provider?: string; model?: string }): Promise<{ content: any; dna: any; provider: string; model: string }> {
    const system = this.buildDesignSystemPrompt(input);
    const user = this.buildDesignUserPrompt(input);

    const provider = (route?.provider || this.config.provider || '').toUpperCase();
    const model = route?.model || this.config.model || '';
    const available = this.providerAvailable(provider) || (this.isEnabled() && !route?.provider);

    if (!available) {
      return {
        content: { ...this.placeholderDesign(input), _aiStatus: 'disabled', _aiError: `IA no configurada para el proveedor ${provider || 'IA'} en el servidor.` },
        dna: this.placeholderDesignDna(input), provider: 'DISABLED', model: 'none',
      };
    }
    try {
      // El diseño es un JSON grande y detallado: margen amplio para no truncarlo.
      const raw = await this.callLlmJson<any>(system, user, 10000, route);
      const content = raw?.content ?? raw;
      const dna = raw?.dna ?? this.placeholderDesignDna(input);
      if (!content || typeof content !== 'object' || (!content.moments && !content.learning && !content.activities)) {
        throw new Error('La IA devolvió un contenido incompleto o con formato inesperado.');
      }
      return { content, dna, provider, model };
    } catch (e) {
      const msg = String((e as any)?.message || e).slice(0, 400);
      this.logger.warn(`generatePedagogicalDesign falló (${provider}/${model}): ${msg}`);
      return {
        content: { ...this.placeholderDesign(input), _aiStatus: 'error', _aiError: msg },
        dna: this.placeholderDesignDna(input), provider: 'FALLBACK', model: model || 'none',
      };
    }
  }

  private static readonly DESIGN_TYPE_GUIDANCE: Record<string, string> = {
    LESSON_PLAN: 'PLAN DE CLASE: UNA sola sesión. EXACTAMENTE 3 momentos: INICIO, DESARROLLO, CIERRE. 2-3 actividades. identification.sessions = 1.',
    SEQUENCE: 'SECUENCIA DIDÁCTICA: VARIAS sesiones encadenadas (usa 4-6). Aquí cada elemento de "moments" representa una SESIÓN COMPLETA con su propio propósito (NO los 3 momentos de una clase). Progresión de menor a mayor complejidad. identification.sessions = número de sesiones.',
    UNIT: 'UNIDAD COMPLETA: abarca varias semanas (6-10 sesiones). MÁS objetivos y resultados de aprendizaje, evaluación formativa Y sumativa, varios productos. "moments" lista las SESIONES o etapas de la unidad. identification.sessions alto.',
    PBL: 'PROYECTO ABP: DEBE incluir una PREGUNTA ORIENTADORA como primer objetivo y un PRODUCTO FINAL auténtico. "moments" son las FASES del proyecto (lanzamiento, investigación, construcción, presentación), no momentos de clase. Evaluación por proceso + producto.',
    STEAM: 'CLASE STEAM: integra AL MENOS 2 áreas (ciencia/tecnología/ingeniería/arte/matemáticas) en torno a un RETO de diseño. Las actividades incluyen diseñar, construir y probar.',
    FLIPPED: 'CLASE INVERTIDA: el contenido se estudia ANTES en casa (descríbelo y ponlo en resources); el primer momento es ese trabajo previo y la sesión presencial es práctica activa y resolución de dudas.',
    CHALLENGE: 'APRENDIZAJE BASADO EN RETOS: un reto auténtico del contexto del estudiante. Fases: comprometer, investigar, actuar. Solución real e iteración.',
    WORKSHOP: 'TALLER: foco en práctica guiada PASO A PASO para producir algo concreto. Actividades detalladas con tiempos y producto tangible.',
    LAB: 'LABORATORIO: práctica experimental con objetivo, materiales, procedimiento, registro de datos, conclusiones y normas de seguridad.',
    EVALUATION: 'EVALUACIÓN: el foco es el INSTRUMENTO. Prioriza "evaluation" y "rubric" MUY detallados (criterios con niveles y descriptores claros); "moments" puede ser breve.',
    INTERACTIVE_LESSON: 'LECCIÓN INTERACTIVA: secuencia de pantallas/slides con micro-actividades y chequeos de comprensión frecuentes. "moments" = bloques de la lección.',
  };

  private buildDesignSystemPrompt(input: { experienceType?: string }): string {
    const type = (input.experienceType || 'LESSON_PLAN').toUpperCase();
    const guidance = ApdAiService.DESIGN_TYPE_GUIDANCE[type] || ApdAiService.DESIGN_TYPE_GUIDANCE.LESSON_PLAN;
    return [
      'Eres Valeria, diseñadora pedagógica experta del sistema educativo colombiano (MEN).',
      'Diseñas experiencias de aprendizaje completas, prácticas y aplicables en el aula.',
      '',
      `=== TIPO DE EXPERIENCIA: ${type} ===`,
      guidance,
      'La ESTRUCTURA, el alcance y el número de momentos/actividades DEBEN reflejar este tipo. No entregues un plan de clase genérico para todos los tipos.',
      '',
      'Devuelve EXCLUSIVAMENTE un JSON válido con esta forma exacta:',
      '{',
      '  "content": {',
      '    "identification": { "area": "", "subject": "", "grade": "", "sessions": 1, "totalMinutes": 0 },',
      '    "framework": { "competencies": [""], "dba": [""], "standards": [""] },',
      '    "learning": { "objectives": [""], "outcomes": [""], "bloomLevels": [""] },',
      '    "contentSummary": "2 a 4 párrafos que EXPLICAN el contenido conceptual del tema con sustancia, definiciones y ejemplos concretos (el saber que el docente enseña, no un resumen vago)",',
      '    "moments": [ { "phase": "nombre del momento, sesión o fase según el tipo", "minutes": 0, "description": "párrafo detallado de QUÉ ocurre y CÓMO", "teacherActions": ["lo que el docente hace y dice, concreto"], "studentActions": ["lo que hacen los estudiantes"] } ],',
      '    "activities": [ { "title": "", "type": "TASK|QUIZ|FORUM|PROJECT|GAME|LESSON", "minutes": 0, "instructions": "instrucciones detalladas paso a paso para realizarla", "content": "el desarrollo/contenido REAL de la actividad con ejemplos concretos del tema", "example": "un ejemplo trabajado y resuelto", "product": "" } ],',
      '    "evaluation": { "type": "", "criteria": [""], "evidences": [""] },',
      '    "rubric": { "criteria": [ { "name": "", "levels": [ { "label": "", "descriptor": "", "score": 0 } ] } ] },',
      '    "dua": { "barriers": [""], "adjustments": [""] },',
      '    "resources": [ { "name": "", "url": "" } ]',
      '  },',
      '  "dna": {',
      '    "topic": "", "competencies": [""], "difficulty": "BAJA|MEDIA|ALTA",',
      '    "bloomLevels": [""], "methodology": ["ABP|STEAM|FLIPPED|COOP|TRADICIONAL"],',
      '    "evaluationType": "", "usesICT": false, "estimatedMinutes": 0,',
      '    "work": { "individual": true, "collaborative": true }',
      '  }',
      '}',
      '',
      '=== PROFUNDIDAD (lo más importante) ===',
      'Sé EXTENSO y EXPLICATIVO. "contentSummary", cada "description", "instructions" y "content" deben tener VARIAS oraciones con sustancia real, el contenido del tema y ejemplos concretos — NUNCA títulos sueltos ni generalidades como "explicación del tema". Un docente debe poder dar la clase leyendo esto, sin buscar nada más. Escribe como un experto que prepara material listo para usar.',
      '',
      'Reglas: español claro; los "moments" y su cantidad deben corresponder al TIPO de experiencia (no siempre 3); actividades concretas y realizables con tiempos; evaluación con evidencias; ajustes DUA reales. No incluyas texto fuera del JSON.',
    ].join('\n');
  }

  private buildDesignUserPrompt(input: {
    prompt: string; gradeName?: string; subjectName?: string; sessions?: number; institutionName?: string;
  }): string {
    return [
      `Solicitud del docente: ${input.prompt}`,
      input.gradeName ? `Grado: ${input.gradeName}` : '',
      input.subjectName ? `Asignatura: ${input.subjectName}` : '',
      input.sessions ? `Número de sesiones: ${input.sessions}` : '',
      input.institutionName ? `Institución: ${input.institutionName}` : '',
      '',
      'Diseña la experiencia completa siguiendo la estructura JSON indicada.',
    ].filter(Boolean).join('\n');
  }

  private placeholderDesignDna(input: { prompt: string }): any {
    return {
      topic: (input.prompt || '').slice(0, 80),
      competencies: [], difficulty: 'MEDIA', bloomLevels: ['Comprender', 'Aplicar'],
      methodology: ['TRADICIONAL'], evaluationType: 'Formativa', usesICT: false,
      estimatedMinutes: 110, work: { individual: true, collaborative: true },
    };
  }

  private placeholderDesign(input: { prompt: string; gradeName?: string; subjectName?: string; sessions?: number }): any {
    const topic = (input.prompt || 'el tema').replace(/^necesito\s+(un|una)?\s*(plan|gu[ií]a)\s*(de\s*clase[s]?)?\s*(sobre|de|del)?\s*/i, '').trim() || input.prompt;
    return {
      identification: { area: input.subjectName || '', subject: input.subjectName || '', grade: input.gradeName || '', sessions: input.sessions || 1, totalMinutes: 110 },
      framework: { competencies: [], dba: [], standards: [] },
      learning: { objectives: [`Comprender los conceptos centrales de ${topic}.`], outcomes: [`El estudiante explica y aplica ${topic}.`], bloomLevels: ['Comprender', 'Aplicar'] },
      moments: [
        { phase: 'INICIO', minutes: 20, description: `Exploración de saberes previos sobre ${topic} con una pregunta motivadora.`, activities: ['Lluvia de ideas guiada'] },
        { phase: 'DESARROLLO', minutes: 60, description: `Explicación, modelado y práctica guiada de ${topic}.`, activities: ['Explicación con ejemplos', 'Práctica en parejas'] },
        { phase: 'CIERRE', minutes: 30, description: 'Síntesis, producto y evaluación formativa.', activities: ['Ticket de salida'] },
      ],
      activities: [
        { title: `Actividad introductoria: ${topic}`, description: 'Actividad de apertura para activar saberes previos.', type: 'TASK', minutes: 20, product: 'Participación oral' },
        { title: `Práctica guiada: ${topic}`, description: 'Ejercicio aplicado en parejas.', type: 'TASK', minutes: 40, product: 'Hoja de trabajo' },
      ],
      evaluation: { type: 'Formativa', criteria: ['Comprende los conceptos', 'Aplica lo aprendido'], evidences: ['Hoja de trabajo', 'Ticket de salida'] },
      rubric: { criteria: [ { name: 'Comprensión', levels: [ { label: 'Superior', descriptor: 'Domina el concepto', score: 5 }, { label: 'Básico', descriptor: 'Comprende parcialmente', score: 3 } ] } ] },
      dua: { barriers: ['Diferentes ritmos de aprendizaje'], adjustments: ['Material visual de apoyo', 'Tiempo adicional', 'Trabajo en parejas'] },
      resources: [],
      _placeholder: true,
    };
  }

  async answerTeacherQuestion(
    request: ApdAiTeacherQuestionRequest,
  ): Promise<ApdAiTeacherQuestionResponse> {
    // PRIMERO: intentar parsear preguntas pegadas (no requiere IA)
    const pastedQuiz = this.tryParsePastedQuiz(request);
    if (pastedQuiz) {
      return pastedQuiz;
    }

    if (!this.isEnabled()) {
      return this.placeholderTeacherQuestion(request);
    }

    try {
      const systemInstruction = this.buildQuizSystemPrompt(request);

      const userPrompt = [
        `Pregunta del docente: ${request.question}`,
        `Historial de conversación:\n${this.buildConversationContext(request.conversation)}`,
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

      const result = await this.callLlmJson<ApdAiTeacherQuestionResponse>(
        systemInstruction,
        userPrompt,
      );

      const suggestedDraft = this.buildActivityDraftSuggestion(request);
      const suggestedQuestions = suggestedDraft?.questions?.length
        ? suggestedDraft.questions
        : this.buildQuestionDraftSuggestion(request, suggestedDraft?.type as 'QUIZ' | 'EXAM' | 'TASK' | undefined);
      const activityDraft = result.activityDraft?.title?.trim() || suggestedDraft
        ? {
            title: result.activityDraft?.title?.trim() || suggestedDraft?.title || 'Actividad sugerida',
            description: result.activityDraft?.description?.trim() || suggestedDraft?.description || request.question,
            type: result.activityDraft?.type || suggestedDraft?.type,
            maxScore: result.activityDraft?.maxScore || suggestedDraft?.maxScore,
            allowLateSubmit: result.activityDraft?.allowLateSubmit ?? suggestedDraft?.allowLateSubmit,
            shuffleQuestions: result.activityDraft?.shuffleQuestions ?? suggestedDraft?.shuffleQuestions,
            showResults: result.activityDraft?.showResults ?? suggestedDraft?.showResults,
            maxAttempts: result.activityDraft?.maxAttempts || suggestedDraft?.maxAttempts,
            timeLimitMinutes: result.activityDraft?.timeLimitMinutes || suggestedDraft?.timeLimitMinutes,
            questions: result.activityDraft?.questions?.length ? result.activityDraft.questions : suggestedQuestions,
          }
        : undefined;

      return {
        answer: result.answer?.trim() || 'No pude generar una respuesta útil.',
        keyPoints: Array.isArray(result.keyPoints) ? result.keyPoints.filter(Boolean) : [],
        nextSteps: Array.isArray(result.nextSteps) ? result.nextSteps.filter(Boolean) : undefined,
        activityDraft,
        visualSuggestion: result.visualSuggestion?.kind === 'SVG'
          ? {
              ...result.visualSuggestion,
              svg: this.sanitizeVisualSvg(result.visualSuggestion.svg),
            }
          : result.visualSuggestion,
        confidence: this.normalizeConfidence(result.confidence, 0.8),
      };
    } catch (error: any) {
      this.logger.warn(
        `Valeria falló con ${this.config.provider}, usando fallback: ${error?.message || error}`,
      );
      return this.placeholderTeacherQuestion(request);
    }
  }

  /**
   * Generación dedicada de preguntas tipo Kahoot para Edusyn Play.
   * - Llama directamente al LLM con un prompt JSON-only enfocado en el tema.
   * - NO hace fallback silencioso: si falla, lanza Error para que el caller decida.
   * - Valida estructura básica antes de retornar.
   */
  /**
   * Genera la estructura de una Lección Interactiva viva usando el LLM real (Valeria),
   * a partir de un tema y/o material del docente. Reemplaza al generador de plantilla
   * de LessonService (que queda como fallback cuando la IA no está habilitada).
   *
   * Produce una secuencia pedagógica: introducción → contenido intercalado con preguntas
   * embebidas (con opciones reales, respuesta y explicación) → checkpoints → insignia final.
   * Nunca puntúa notas críticas: el grading de las respuestas lo hace LessonService.
   */
  async generateLessonSlides(params: {
    topic: string;
    content?: string;
    gradeName?: string;
    subjectName?: string;
    language?: string;
  }): Promise<ApdAiLessonDraft> {
    if (!this.isEnabled()) {
      throw new Error('La generación con IA no está habilitada (APD_AI_API_KEY ausente).');
    }
    const topic = (params.topic || '').trim();
    const content = (params.content || '').trim();
    if (!topic && !content) throw new Error('Tema o contenido requerido');
    const lang = params.language || 'español';

    const systemInstruction = [
      'Eres Valeria, diseñadora pedagógica experta del sistema educativo colombiano (MEN).',
      `Diseñas Lecciones Interactivas vivas (estilo Nearpod/Brilliant) en ${lang}, para consumo autónomo del estudiante.`,
      'Responde EXCLUSIVAMENTE con un JSON válido, sin texto adicional, sin markdown, sin backticks.',
      '',
      'Principios de diseño de la lección:',
      '- Bloques cortos: cada slide CONTENT explica UNA idea, en 2-4 frases, lenguaje claro y cercano al nivel del estudiante.',
      '- Interacción frecuente: inserta una slide ACTIVITY (pregunta embebida) cada 1-2 slides de contenido.',
      '- Las preguntas evalúan comprensión real, no memoria trivial. Distractores plausibles del mismo dominio.',
      '- Usa CHECKPOINT como pausa de consolidación tras cada bloque temático (2-3 en total).',
      '- Termina SIEMPRE con una slide BADGE_REVEAL.',
      '- NUNCA generes contenido genérico tipo "Opción A/B/C/D" ni "¿Qué aprendiste?". Todo debe ser específico y verificable.',
      '- El body de CONTENT es HTML simple (usa <p>, <strong>, <ul><li>). Sin estilos inline ni scripts.',
      '',
      'Esquema JSON exacto a producir:',
      '{',
      '  "title": "Título atractivo de la lección",',
      '  "description": "1 frase que resume qué aprenderá el estudiante",',
      '  "slides": [',
      '    { "type": "CONTENT", "title": "…", "body": "<p>…</p>" },',
      '    { "type": "ACTIVITY", "title": "…", "activityData": {',
      '        "questionType": "MULTIPLE_CHOICE" | "TRUE_FALSE",',
      '        "question": "Enunciado específico",',
      '        "options": ["…","…","…","…"],',
      '        "correctAnswer": "Texto EXACTO de la opción correcta (o \\"Verdadero\\"/\\"Falso\\")",',
      '        "explanation": "Por qué es correcta (1-2 frases)",',
      '        "hint": "Pista breve sin revelar la respuesta",',
      '        "points": 10 } },',
      '    { "type": "CHECKPOINT", "title": "…" },',
      '    { "type": "BADGE_REVEAL" }',
      '  ]',
      '}',
      '',
      'Genera entre 6 y 12 slides en total, con al menos 3 slides ACTIVITY.',
      params.gradeName ? `Nivel educativo objetivo: ${params.gradeName}.` : '',
      params.subjectName ? `Asignatura: ${params.subjectName}.` : '',
    ].filter(Boolean).join('\n');

    const materialBlock = content
      ? `\n\nMaterial base del docente (fundamenta la lección en este contenido, no lo contradigas):\n"""\n${content.slice(0, 6000)}\n"""`
      : '';
    const userPrompt = `Tema de la lección: ${topic || '(deriva un título del material)'}\n\nDiseña la lección interactiva siguiendo el esquema JSON indicado.${materialBlock}`;

    let raw: any;
    try {
      raw = await this.callLlmJson<{ title?: string; description?: string; slides?: any[] }>(
        systemInstruction,
        userPrompt,
        8000,
      );
    } catch (err: any) {
      this.logger.error(`generateLessonSlides LLM error (${this.config.provider}): ${err?.message || err}`);
      throw new Error(`El proveedor de IA (${this.config.provider}) no respondió: ${err?.message || 'error desconocido'}`);
    }

    const rawSlides: any[] = Array.isArray(raw?.slides) ? raw.slides : [];
    const slides: ApdAiLessonSlideDraft[] = [];
    for (const s of rawSlides) {
      const rawType = (typeof s?.type === 'string' ? s.type : '').toUpperCase();
      if (rawType === 'CONTENT') {
        const body = typeof s?.body === 'string' ? s.body.trim() : '';
        if (!body) continue;
        slides.push({ type: 'CONTENT', title: typeof s?.title === 'string' ? s.title.trim() : undefined, body });
      } else if (rawType === 'ACTIVITY') {
        const ad = s?.activityData || {};
        const question = typeof ad?.question === 'string' ? ad.question.trim() : '';
        if (!question) continue;
        const qType = String(ad?.questionType || 'MULTIPLE_CHOICE').toUpperCase() === 'TRUE_FALSE'
          ? 'TRUE_FALSE' : 'MULTIPLE_CHOICE';
        const correct = typeof ad?.correctAnswer === 'string' ? ad.correctAnswer.trim() : '';
        if (qType === 'TRUE_FALSE') {
          const isTrue = correct.toLowerCase().startsWith('v') || correct.toLowerCase() === 'true';
          slides.push({
            type: 'ACTIVITY',
            title: typeof s?.title === 'string' ? s.title.trim() : undefined,
            activityData: {
              questionType: 'TRUE_FALSE', question, options: ['Verdadero', 'Falso'],
              correctAnswer: isTrue ? 'Verdadero' : 'Falso',
              explanation: typeof ad?.explanation === 'string' ? ad.explanation.trim() : undefined,
              hint: typeof ad?.hint === 'string' ? ad.hint.trim() : undefined,
              points: Number.isFinite(ad?.points) ? ad.points : 10,
            },
          });
        } else {
          const options = Array.isArray(ad?.options)
            ? ad.options.filter((o: any) => typeof o === 'string' && o.trim()).map((o: string) => o.trim()).slice(0, 6)
            : [];
          if (options.length < 2) continue;
          slides.push({
            type: 'ACTIVITY',
            title: typeof s?.title === 'string' ? s.title.trim() : undefined,
            activityData: {
              questionType: 'MULTIPLE_CHOICE', question, options,
              correctAnswer: correct && options.includes(correct) ? correct : options[0],
              explanation: typeof ad?.explanation === 'string' ? ad.explanation.trim() : undefined,
              hint: typeof ad?.hint === 'string' ? ad.hint.trim() : undefined,
              points: Number.isFinite(ad?.points) ? ad.points : 10,
            },
          });
        }
      } else if (rawType === 'CHECKPOINT') {
        slides.push({ type: 'CHECKPOINT', title: typeof s?.title === 'string' ? s.title.trim() : undefined });
      } else if (rawType === 'BADGE_REVEAL') {
        slides.push({ type: 'BADGE_REVEAL', badgeEmoji: typeof s?.badgeEmoji === 'string' ? s.badgeEmoji : undefined, badgeTitle: typeof s?.badgeTitle === 'string' ? s.badgeTitle : undefined });
      }
    }

    // Garantías mínimas de estructura: al menos 1 contenido y cierre con insignia.
    const hasContent = slides.some(s => s.type === 'CONTENT');
    if (!hasContent) {
      throw new Error('La IA respondió pero la lección no tenía contenido válido.');
    }
    if (!slides.some(s => s.type === 'BADGE_REVEAL')) {
      slides.push({ type: 'BADGE_REVEAL' });
    }

    return {
      title: (typeof raw?.title === 'string' && raw.title.trim()) || topic || 'Nueva lección',
      description: (typeof raw?.description === 'string' && raw.description.trim())
        || `Lección interactiva sobre ${topic || 'el tema'}`,
      slides,
    };
  }

  /**
   * Valeria arma una Ruta de Aprendizaje bilingüe a partir de un objetivo del
   * docente: propone título, nivel/habilidad CEFR objetivo y una secuencia de
   * pasos por habilidad (Reading/Listening/Speaking/Writing). No inventa códigos
   * de competencia: solo nivel+habilidad; el servicio los mapea al grafo CEFR.
   */
  async generateRoutePlan(params: {
    objective: string;
    gradeName?: string;
    targetLevel?: string;
  }): Promise<ApdAiRoutePlan> {
    if (!this.isEnabled()) {
      throw new Error('La generación con IA no está habilitada (APD_AI_API_KEY ausente).');
    }
    const objective = (params.objective || '').trim();
    if (!objective) throw new Error('Objetivo requerido');
    const SKILLS = ['READING', 'LISTENING', 'SPEAKING', 'WRITING'];

    const systemInstruction = [
      'Eres Valeria, diseñadora de currículo bilingüe (inglés) alineada al CEFR (MCER).',
      'Diseñas una Ruta de Aprendizaje: una secuencia corta de pasos que converge en una competencia comunicativa.',
      'Responde EXCLUSIVAMENTE con un JSON válido, sin texto adicional, sin markdown, sin backticks.',
      '',
      'Reglas:',
      '- Se puntúa por INTELIGIBILIDAD y can-do, no por acento nativo.',
      '- La ruta tiene entre 4 y 6 pasos, en orden pedagógico (normalmente input primero: Reading/Listening; luego producción: Speaking/Writing).',
      `- Cada paso usa exactamente una habilidad: ${SKILLS.join(', ')}.`,
      '- El nivel objetivo (targetLevel) es uno de: A1, A2, B1, B2.',
      '- La habilidad objetivo (targetSkill) suele ser SPEAKING o WRITING (producción).',
      '- Títulos de paso cortos y concretos en español (máx 6 palabras).',
      '',
      'Esquema JSON exacto:',
      '{',
      '  "title": "Título atractivo de la ruta (puede incluir inglés)",',
      '  "description": "1 frase de qué logrará el estudiante",',
      '  "targetLevel": "A2",',
      '  "targetSkill": "SPEAKING",',
      '  "steps": [ { "title": "Lectura · My Family", "skill": "READING" } ]',
      '}',
      params.gradeName ? `Nivel escolar: ${params.gradeName}.` : '',
      params.targetLevel ? `Usa como nivel objetivo: ${params.targetLevel}.` : '',
    ].filter(Boolean).join('\n');

    const userPrompt = `Objetivo del docente: ${objective}\n\nDiseña la ruta siguiendo el esquema JSON.`;

    let raw: any;
    try {
      raw = await this.callLlmJson<any>(systemInstruction, userPrompt, 3000);
    } catch (err: any) {
      this.logger.error(`generateRoutePlan LLM error (${this.config.provider}): ${err?.message || err}`);
      throw new Error(`El proveedor de IA (${this.config.provider}) no respondió: ${err?.message || 'error desconocido'}`);
    }

    const norm = (s: any): ApdAiRouteSkill => {
      const u = String(s || '').toUpperCase();
      return (SKILLS.includes(u) ? u : 'READING') as ApdAiRouteSkill;
    };
    const level = ['A1', 'A2', 'B1', 'B2'].includes(String(raw?.targetLevel).toUpperCase())
      ? String(raw.targetLevel).toUpperCase() : (params.targetLevel || 'A2');
    const steps: ApdAiRoutePlan['steps'] = (Array.isArray(raw?.steps) ? raw.steps : [])
      .map((s: any) => ({ title: String(s?.title || '').trim(), skill: norm(s?.skill) }))
      .filter((s: any) => s.title)
      .slice(0, 8);
    if (!steps.length) throw new Error('La IA no propuso pasos válidos.');

    return {
      title: String(raw?.title || objective).trim(),
      description: String(raw?.description || '').trim(),
      targetLevel: level,
      targetSkill: norm(raw?.targetSkill || 'SPEAKING'),
      steps,
    };
  }

  async generateQuizQuestions(params: {
    topic: string;
    count: number;
    types: Array<'MULTIPLE_CHOICE' | 'TRUE_FALSE'>;
    gradeName?: string;
    subjectName?: string;
    language?: string;
  }): Promise<ApdAiQuestionDraft[]> {
    if (!this.isEnabled()) {
      throw new Error('La generación con IA no está habilitada (APD_AI_API_KEY ausente).');
    }
    const topic = (params.topic || '').trim();
    if (!topic) throw new Error('Tema requerido');

    // Cap total a 50 (UX) y chunking de 10 para no exceder max_tokens del LLM (default 2000-4000).
    const totalCount = Math.min(Math.max(params.count || 5, 1), 50);
    const CHUNK_SIZE = 10;

    // Si cabe en una sola llamada, ruta directa.
    if (totalCount <= CHUNK_SIZE) {
      return this.generateQuizQuestionsChunk({ ...params, count: totalCount, avoidQuestions: [] });
    }

    // Chunking secuencial con dedup por texto normalizado.
    const allDrafts: ApdAiQuestionDraft[] = [];
    const seenKeys = new Set<string>();
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').replace(/[¿?¡!.,;:]/g, '').trim();

    let chunkIndex = 0;
    const maxChunks = Math.ceil(totalCount / CHUNK_SIZE) + 2; // margen por dedup
    let lastError: any = null;

    while (allDrafts.length < totalCount && chunkIndex < maxChunks) {
      const remaining = totalCount - allDrafts.length;
      const requestSize = Math.min(remaining + 2, CHUNK_SIZE); // pedir 2 extra para compensar duplicados
      // pasamos los textos de las últimas preguntas generadas para que el LLM no las repita
      const avoidQuestions = allDrafts.slice(-15).map(d => d.text);

      let chunkDrafts: ApdAiQuestionDraft[] = [];
      try {
        chunkDrafts = await this.generateQuizQuestionsChunk({
          ...params,
          count: requestSize,
          avoidQuestions,
        });
      } catch (err: any) {
        lastError = err;
        this.logger.warn(`generateQuizQuestions chunk ${chunkIndex} falló: ${err?.message || err}`);
        if (allDrafts.length === 0 && chunkIndex === 0) {
          // primer chunk falla -> propagar
          throw err;
        }
        // chunks posteriores: cortar y devolver lo conseguido
        break;
      }

      if (!chunkDrafts.length) {
        // LLM dejó de producir; cortar para evitar bucle infinito
        break;
      }

      let addedThisChunk = 0;
      for (const d of chunkDrafts) {
        const key = normalize(d.text);
        if (!key || seenKeys.has(key)) continue;
        seenKeys.add(key);
        allDrafts.push(d);
        addedThisChunk++;
        if (allDrafts.length >= totalCount) break;
      }

      // si un chunk no aportó nada nuevo, evitar bucle
      if (addedThisChunk === 0) break;

      chunkIndex++;
    }

    if (!allDrafts.length) {
      throw lastError || new Error('La IA no devolvió preguntas válidas.');
    }

    return allDrafts.slice(0, totalCount);
  }

  /**
   * Genera un lote (chunk) de preguntas. Soporta hasta ~10-15 por llamada según max_tokens del proveedor.
   * Acepta `avoidQuestions` para reducir duplicación entre chunks.
   */
  private async generateQuizQuestionsChunk(params: {
    topic: string;
    count: number;
    types: Array<'MULTIPLE_CHOICE' | 'TRUE_FALSE'>;
    gradeName?: string;
    subjectName?: string;
    language?: string;
    avoidQuestions?: string[];
  }): Promise<ApdAiQuestionDraft[]> {
    const topic = (params.topic || '').trim();
    const count = Math.min(Math.max(params.count || 5, 1), 15);
    const allowed = params.types?.length ? params.types : ['MULTIPLE_CHOICE', 'TRUE_FALSE'];
    const onlyTF = allowed.length === 1 && allowed[0] === 'TRUE_FALSE';
    const onlyMC = allowed.length === 1 && allowed[0] === 'MULTIPLE_CHOICE';
    const lang = params.language || 'español';

    const typeDirective = onlyTF
      ? `Todas las preguntas DEBEN ser de tipo "TRUE_FALSE".`
      : onlyMC
        ? `Todas las preguntas DEBEN ser de tipo "MULTIPLE_CHOICE" con EXACTAMENTE 4 opciones.`
        : `Usa una mezcla equilibrada de "MULTIPLE_CHOICE" (4 opciones) y "TRUE_FALSE".`;

    const systemInstruction = [
      'Eres un asistente experto en diseño de evaluaciones educativas tipo Kahoot/Quizizz.',
      `Generas preguntas precisas, pedagógicamente válidas, en ${lang}.`,
      'Responde EXCLUSIVAMENTE con un JSON válido, sin texto adicional, sin markdown, sin backticks.',
      'NUNCA inventes contenido genérico tipo "describe mejor qué es X". Las preguntas deben ser específicas y verificables.',
      'Para MULTIPLE_CHOICE: 4 opciones plausibles, una sola correcta, distractores creíbles del mismo dominio temático.',
      'Para TRUE_FALSE: la afirmación debe ser claramente verdadera o falsa según conocimiento estándar.',
      'La respuesta correcta debe variar de posición entre preguntas; no la pongas siempre primero.',
      '',
      'Esquema JSON exacto a producir:',
      '{',
      '  "questions": [',
      '    {',
      '      "type": "MULTIPLE_CHOICE" | "TRUE_FALSE",',
      '      "text": "Enunciado claro y específico de la pregunta",',
      '      "options": ["Opción A", "Opción B", "Opción C", "Opción D"],',
      '      "correctAnswer": "Texto EXACTO de la opción correcta (o \\"Verdadero\\"/\\"Falso\\")",',
      '      "explanation": "Explicación breve (1-2 frases) del porqué es correcta"',
      '    }',
      '  ]',
      '}',
      '',
      `Genera EXACTAMENTE ${count} preguntas. ${typeDirective}`,
      params.gradeName ? `Nivel educativo objetivo: ${params.gradeName}.` : '',
      params.subjectName ? `Asignatura: ${params.subjectName}.` : '',
    ].filter(Boolean).join('\n');

    const avoidBlock = (params.avoidQuestions?.length)
      ? `\n\nIMPORTANTE: NO repitas ni parafrasees ninguna de estas preguntas ya generadas:\n${params.avoidQuestions.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nGenera preguntas COMPLETAMENTE distintas, cubriendo otros sub-temas, ángulos o niveles de dificultad.`
      : '';

    const userPrompt = `Tema: ${topic}\n\nGenera ${count} preguntas siguiendo el esquema JSON indicado.${avoidBlock}`;

    let raw: any;
    try {
      raw = await this.callLlmJson<{ questions: any[] }>(systemInstruction, userPrompt);
    } catch (err: any) {
      this.logger.error(`generateQuizQuestions LLM error (${this.config.provider}): ${err?.message || err}`);
      throw new Error(`El proveedor de IA (${this.config.provider}) no respondió: ${err?.message || 'error desconocido'}`);
    }

    const list: any[] = Array.isArray(raw?.questions) ? raw.questions : [];
    if (!list.length) {
      throw new Error('La IA respondió sin preguntas válidas. Intenta con otro tema o reformula.');
    }

    const drafts: ApdAiQuestionDraft[] = [];
    for (const q of list) {
      const text = typeof q?.text === 'string' ? q.text.trim() : '';
      if (!text) continue;
      const rawType = (typeof q?.type === 'string' ? q.type : 'MULTIPLE_CHOICE').toUpperCase();
      const type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' =
        rawType === 'TRUE_FALSE' || rawType === 'TRUEFALSE' ? 'TRUE_FALSE' : 'MULTIPLE_CHOICE';
      if (!allowed.includes(type)) continue;

      const correct = typeof q?.correctAnswer === 'string' ? q.correctAnswer.trim() : '';
      const explanation = typeof q?.explanation === 'string' ? q.explanation.trim() : undefined;

      if (type === 'TRUE_FALSE') {
        // Aceptar "Verdadero"/"Falso", "true"/"false", "V"/"F"
        const norm = correct.toLowerCase();
        const isTrue = norm.startsWith('v') || norm === 'true' || norm === '1';
        drafts.push({
          type,
          text,
          options: ['Verdadero', 'Falso'],
          correctAnswer: isTrue ? 'Verdadero' : 'Falso',
          explanation,
        });
      } else {
        const options = Array.isArray(q?.options)
          ? q.options.filter((o: any) => typeof o === 'string' && o.trim()).map((o: string) => o.trim()).slice(0, 6)
          : [];
        if (options.length < 2) continue; // descarta malformadas
        drafts.push({
          type,
          text,
          options,
          correctAnswer: correct || options[0],
          explanation,
        });
      }
    }

    if (!drafts.length) {
      throw new Error('La IA respondió pero todas las preguntas estaban malformadas.');
    }
    return drafts.slice(0, count);
  }

  private placeholderTeacherQuestion(
    request: ApdAiTeacherQuestionRequest,
  ): ApdAiTeacherQuestionResponse {
    const q = (request.question || '').toLowerCase().trim();
    const activityDraft = this.buildActivityDraftSuggestion(request);
    const questionDrafts = activityDraft?.questions?.length
      ? activityDraft.questions
      : this.buildQuestionDraftSuggestion(request, activityDraft?.type as 'QUIZ' | 'EXAM' | 'TASK' | undefined);

    // Respuestas contextuales básicas cuando Gemini no está habilitado
    if (q.includes('edusyn') || q.includes('qué puedo hacer') || q.includes('funcionalidades')) {
      return {
        answer: `Edusyn es una plataforma educativa integral creada por Luis Cárdenas. Puedes gestionar:\n\n• **Classroom**: Crear quizzes, exámenes, guías y actividades interactivas\n• **Notas**: Registrar calificaciones por período y componente\n• **Asistencia**: Control diario con reportes automáticos\n• **Boletines**: Generación de informes académicos\n• **Logros**: Definir indicadores por asignatura\n• **Comunicaciones**: Enviar mensajes a padres y estudiantes\n• **Finanzas**: Facturación, pagos y cartera\n\nNavega por el menú lateral para explorar cada módulo.`,
        keyPoints: [],
        confidence: 0.9,
      };
    }

    if (q.includes('quiz') || q.includes('examen') || q.includes('cuestionario') || q.includes('pregunta')) {
      const extractedTopic = this.extractTopicFromQuestion(request.question || '') || 'el tema solicitado';
      return {
        answer: `⚠️ **Modo sin conexión a IA**: No pude conectarme al servicio de inteligencia artificial para generar las preguntas específicas sobre **"${extractedTopic}"**.\n\nHe creado el borrador de la actividad (título y configuración), pero **las preguntas NO fueron generadas** porque necesito la IA para crear contenido específico del tema.\n\n**¿Qué puedes hacer?**\n1. **Reintentar** — Envía tu solicitud de nuevo en unos segundos\n2. **Crear manualmente** — Usa el borrador creado y agrega tus propias preguntas\n\n_El servicio de IA puede estar temporalmente ocupado. Normalmente se recupera en 1-2 minutos._`,
        keyPoints: [
          `Tema detectado: ${extractedTopic}`,
          'Las preguntas deben generarse con IA o manualmente',
          'Reintenta en unos segundos si necesitas generación automática',
        ],
        activityDraft: activityDraft
          ? {
              ...activityDraft,
              questions: undefined, // NO generar preguntas genéricas falsas
            }
          : undefined,
        confidence: 0.3,
      };
    }

    if (q.includes('classroom') || q.includes('actividad')) {
      return {
        answer: `En **Classroom** puedes:\n\n1. **Crear actividades**: Tareas, quizzes, exámenes, guías y autoevaluaciones\n2. **Live Quiz**: Sesiones en tiempo real donde los estudiantes responden simultáneamente\n3. **Quiz en Casa**: Los estudiantes resuelven a su ritmo con fecha límite\n4. **Preguntas variadas**: Opción múltiple, verdadero/falso, completar, emparejar\n5. **Sincronizar notas**: Enviar calificaciones directamente a la planilla\n\nPara crear un quiz: Entra a un aula → Actividades → Nueva Actividad → Selecciona tipo Quiz/Examen → Agrega preguntas → Publica.`,
        keyPoints: [],
        activityDraft: activityDraft
          ? {
              ...activityDraft,
              questions: undefined,
            }
          : undefined,
        confidence: 0.9,
      };
    }

    if (q.includes('logro') || q.includes('logros') || q.includes('achievement')) {
      return {
        answer: `En Edusyn, los **logros** se usan para describir el aprendizaje alcanzado por el estudiante y suelen mostrarse en reportes o boletines junto con la valoración del período.\n\nFlujo recomendado:\n1. Entra al módulo de **Notas / Evaluación / Reportes** según tu menú\n2. Selecciona grupo, asignatura y período\n3. Registra el logro o descriptor correspondiente\n4. Guarda para que aparezca en los informes del estudiante o del grupo\n\nSi me dices en qué pantalla estás, te indico el flujo exacto dentro de esa ruta.`,
        keyPoints: [],
        confidence: 0.9,
      };
    }

    if (q.includes('nota') || q.includes('calificacion') || q.includes('planilla')) {
      return {
        answer: `Para gestionar **notas** en Edusyn:\n\n1. Ve a **Notas** en el menú lateral\n2. Selecciona grupo y asignatura\n3. Elige el período activo\n4. Ingresa las calificaciones por componente (Cognitivo, Procedimental, Actitudinal)\n5. El sistema calcula promedios automáticamente\n\nTambién puedes importar notas desde Excel o sincronizar desde Classroom.`,
        keyPoints: [],
        confidence: 0.9,
      };
    }

    if (q.includes('asistencia')) {
      return {
        answer: `El módulo de **Asistencia** permite:\n\n• Registrar asistencia diaria por grupo\n• Marcar: Presente, Ausente, Tardanza, Excusa\n• Ver reportes de inasistencia por estudiante\n• Alertas automáticas cuando un estudiante supera el límite\n\nAccede desde el menú lateral → Asistencia → Selecciona grupo y fecha.`,
        keyPoints: [],
        confidence: 0.9,
      };
    }

    if (q.includes('observacion') || q.includes('observador') || q.includes('seguimiento')) {
      return {
        answer: `Para registrar **observaciones** o hacer seguimiento en Edusyn puedes usar el observador del estudiante o el espacio de seguimiento del docente, según el módulo que tengas habilitado.\n\nFlujo típico:\n1. Busca al estudiante o grupo\n2. Abre el observador / seguimiento / notas del aula\n3. Escribe la observación con fecha y categoría\n4. Guarda para que quede en el historial\n\nSi estás usando Classroom, también puedes apoyarte en **observaciones por actividad** o en los tableros de seguimiento del docente.`,
        keyPoints: [],
        confidence: 0.9,
      };
    }

    if (q.includes('boletin') || q.includes('informe') || q.includes('reporte')) {
      return {
        answer: `Los **boletines** y reportes académicos en Edusyn se generan a partir de la información registrada en notas, logros, asistencia y observaciones.\n\nNormalmente incluyen:\n• Notas por asignatura y período\n• Promedio general y puesto\n• Logros e indicadores\n• Observaciones del director de grupo\n• Asistencia del período\n\nVe a **Reportes / Boletines** → Selecciona grupo, período o estudiante → Genera PDF individual o masivo.`,
        keyPoints: [],
        confidence: 0.9,
      };
    }

    if (q.includes('hola') || q.includes('buenos') || q.includes('saludos')) {
      return {
        answer: `¡Hola! Soy Valeria, tu asistente en Edusyn. Puedo ayudarte con:\n\n• Cómo usar Classroom y crear quizzes\n• Gestión de notas y asistencia\n• Generación de boletines\n• Flujos de la plataforma\n\n¿En qué te puedo ayudar hoy?`,
        keyPoints: [],
        confidence: 0.95,
      };
    }

    // Respuesta genérica mejorada
    return {
      answer: `Gracias por tu consulta. Actualmente estoy en modo básico (sin conexión a IA avanzada).\n\nPuedo ayudarte con información sobre:\n• **Classroom**: Quizzes, exámenes, actividades y preguntas\n• **Notas**: Planillas, calificaciones, promedios y logros\n• **Asistencia**: Registro diario, reportes y alertas\n• **Observaciones**: Seguimiento del estudiante y del aula\n• **Boletines**: Generación de informes académicos\n\nIntenta preguntar algo más específico como "¿Cómo creo un quiz?", "¿Cómo asigno notas?" o "¿Cómo registro una observación?"`,
      keyPoints: [],
      confidence: 0.5,
    };
  }
}
