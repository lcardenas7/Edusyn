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
    const apiKey = process.env.APD_AI_API_KEY;
    const detectedProvider = this.detectProvider(apiKey);
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
    return this.config.provider !== 'DISABLED' && !!this.config.apiKey;
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

  private getDefaultModel(provider: string): string {
    switch (provider) {
      case 'OPENROUTER': return 'nvidia/nemotron-nano-9b-v2:free';
      case 'XAI': return 'grok-3-mini';
      case 'GROQ': return 'llama-3.1-8b-instant';
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
  ): Promise<T> {
    if (!this.isOpenRouterEnabled()) {
      throw new Error('OpenRouter no está habilitado');
    }

    const model = this.config.model || 'google/gemma-2-9b-it:free';
    const url = 'https://openrouter.ai/api/v1/chat/completions';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
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
        max_tokens: this.config.maxTokens ?? 2000,
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
  ): Promise<T> {
    if (!this.isGroqEnabled()) {
      throw new Error('Groq no está habilitado');
    }

    const model = this.config.model || 'llama-3.1-8b-instant';
    const url = 'https://api.groq.com/openai/v1/chat/completions';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userPrompt },
        ],
        temperature: this.config.temperature ?? 0.7,
        max_tokens: this.config.maxTokens ?? 2000,
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
  ): Promise<T> {
    if (!this.isXaiEnabled()) {
      throw new Error('xAI no está habilitado');
    }

    const model = this.config.model || 'grok-3-mini';
    const url = 'https://api.x.ai/v1/chat/completions';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userPrompt },
        ],
        temperature: this.config.temperature ?? 0.7,
        max_tokens: this.config.maxTokens ?? 2000,
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
  ): Promise<T> {
    if (this.isOpenRouterEnabled()) {
      return this.callOpenRouterJson<T>(systemInstruction, userPrompt);
    }
    if (this.isGroqEnabled()) {
      return this.callGroqJson<T>(systemInstruction, userPrompt);
    }
    if (this.isXaiEnabled()) {
      return this.callXaiJson<T>(systemInstruction, userPrompt);
    }
    if (this.isGeminiEnabled()) {
      return this.callGeminiJson<T>(systemInstruction, userPrompt);
    }
    throw new Error('Ningún proveedor de IA está habilitado');
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

  private buildActivityDraftSuggestion(request: ApdAiTeacherQuestionRequest): ApdAiTeacherQuestionResponse['activityDraft'] | undefined {
    const q = (request.question || '').toLowerCase();
    const topicSource = request.context?.topic?.trim()
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
    const q = question.toLowerCase();
    
    // Patrones comunes para extraer el tema
    const patterns = [
      /(?:quiz|examen|cuestionario|evaluaci[oó]n|prueba|preguntas?)\s+(?:sobre|de|acerca de|del tema)\s+(.+?)(?:\s+(?:para|con|de\s+\d+|,|\.|$))/i,
      /(?:sobre|acerca de|del tema)\s+(.+?)(?:\s+(?:para|con|de\s+\d+|,|\.|pros|contras|ventajas|$))/i,
      /(?:tema|t[oó]pico)\s*:?\s*(.+?)(?:\s+(?:para|con|,|\.|$))/i,
    ];
    
    for (const pattern of patterns) {
      const match = question.match(pattern);
      if (match?.[1]) {
        let topic = match[1].trim();
        // Limpiar el tema de palabras comunes al final
        topic = topic.replace(/\s+(y|con|para|de|del|la|el|los|las)\s*$/i, '').trim();
        if (topic.length > 2 && topic.length < 100) {
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
    const isExam = activityType === 'EXAM' || q.includes('examen') || q.includes('prueba');
    const requestedCount = this.extractQuestionCount(request.question || '');

    // Detectar subtemas específicos mencionados en la pregunta
    const mentionsPros = q.includes('pros') || q.includes('ventajas') || q.includes('beneficios');
    const mentionsCons = q.includes('contras') || q.includes('desventajas') || q.includes('riesgos') || q.includes('peligros');
    const mentionsSecurity = q.includes('seguridad') || q.includes('privacidad') || q.includes('protección');

    // Generar preguntas dinámicas basadas en el tema
    const questionBank: ApdAiQuestionDraft[] = [];

    // Preguntas sobre ventajas/pros
    if (mentionsPros || (!mentionsCons && !mentionsSecurity)) {
      questionBank.push(
        {
          type: 'MULTIPLE_CHOICE',
          text: `¿Cuál es una ventaja principal de ${topicLabel}?`,
          options: [
            `Facilita la comunicación y el acceso a información`,
            'No tiene ningún beneficio real',
            'Solo sirve para perder el tiempo',
            'Es completamente peligroso',
          ],
          correctAnswer: 'Facilita la comunicación y el acceso a información',
          points: 1,
          explanation: `Una de las principales ventajas de ${topicLabel} es mejorar la comunicación.`,
        },
        {
          type: 'MULTIPLE_CHOICE',
          text: `¿Cómo puede ${topicLabel} beneficiar el aprendizaje?`,
          options: [
            'Permite acceder a recursos educativos y colaborar con otros',
            'No tiene relación con el aprendizaje',
            'Solo distrae a los estudiantes',
            'Está prohibido en todas las escuelas',
          ],
          correctAnswer: 'Permite acceder a recursos educativos y colaborar con otros',
          points: 1,
          explanation: `${topicLabel} puede ser una herramienta educativa valiosa cuando se usa correctamente.`,
        },
      );
    }

    // Preguntas sobre desventajas/contras
    if (mentionsCons || mentionsPros) {
      questionBank.push(
        {
          type: 'MULTIPLE_CHOICE',
          text: `¿Cuál es un riesgo potencial de ${topicLabel}?`,
          options: [
            'Exposición a contenido inapropiado o ciberacoso',
            'No existe ningún riesgo',
            'Mejora automáticamente las calificaciones',
            'Siempre es 100% seguro',
          ],
          correctAnswer: 'Exposición a contenido inapropiado o ciberacoso',
          points: 1,
          explanation: `Es importante conocer los riesgos de ${topicLabel} para usarlo de forma responsable.`,
        },
        {
          type: 'MULTIPLE_CHOICE',
          text: `¿Qué problema puede causar el uso excesivo de ${topicLabel}?`,
          options: [
            'Adicción, aislamiento social y problemas de sueño',
            'Ningún problema, siempre es beneficioso',
            'Mejora la salud física',
            'Aumenta la concentración en clase',
          ],
          correctAnswer: 'Adicción, aislamiento social y problemas de sueño',
          points: 1,
          explanation: 'El uso excesivo puede afectar la salud mental y física.',
        },
      );
    }

    // Preguntas sobre seguridad
    if (mentionsSecurity || mentionsCons) {
      questionBank.push(
        {
          type: 'MULTIPLE_CHOICE',
          text: `¿Cuál es una buena práctica de seguridad en ${topicLabel}?`,
          options: [
            'Usar contraseñas fuertes y no compartir información personal',
            'Compartir la contraseña con todos los amigos',
            'Publicar la dirección de casa',
            'Aceptar solicitudes de desconocidos',
          ],
          correctAnswer: 'Usar contraseñas fuertes y no compartir información personal',
          points: 1,
          explanation: 'Proteger la información personal es fundamental para la seguridad en línea.',
        },
        {
          type: 'MULTIPLE_CHOICE',
          text: `¿Qué debes hacer si un desconocido te contacta en ${topicLabel}?`,
          options: [
            'No responder y contarle a un adulto de confianza',
            'Darle tu número de teléfono',
            'Aceptar encontrarte en persona',
            'Compartir fotos personales',
          ],
          correctAnswer: 'No responder y contarle a un adulto de confianza',
          points: 1,
          explanation: 'Siempre debemos ser cautelosos con personas desconocidas en internet.',
        },
        {
          type: 'MULTIPLE_CHOICE',
          text: `¿Qué es el ciberacoso?`,
          options: [
            'Usar internet para molestar, amenazar o humillar a alguien',
            'Un juego de computadora',
            'Una forma de hacer amigos',
            'Un tipo de red social',
          ],
          correctAnswer: 'Usar internet para molestar, amenazar o humillar a alguien',
          points: 1,
          explanation: 'El ciberacoso es un problema serio que debemos prevenir y denunciar.',
        },
      );
    }

    // Preguntas generales sobre el tema
    questionBank.push(
      {
        type: 'TRUE_FALSE',
        text: `Verdadero o falso: ${topicLabel} puede tener tanto aspectos positivos como negativos.`,
        options: ['Verdadero', 'Falso'],
        correctAnswer: 'Verdadero',
        points: 1,
        explanation: `Como toda herramienta, ${topicLabel} tiene ventajas y desventajas según cómo se use.`,
      },
      {
        type: 'MULTIPLE_CHOICE',
        text: `¿Cuál es la mejor actitud frente a ${topicLabel}?`,
        options: [
          'Usarlo de forma responsable y consciente',
          'Evitarlo completamente',
          'Usarlo sin ningún límite',
          'Ignorar los consejos de los adultos',
        ],
        correctAnswer: 'Usarlo de forma responsable y consciente',
        points: 1,
        explanation: 'El uso responsable es la clave para aprovechar los beneficios y evitar los riesgos.',
      },
      {
        type: 'MULTIPLE_CHOICE',
        text: `¿Quién debe supervisar el uso de ${topicLabel} en menores de edad?`,
        options: [
          'Los padres o adultos responsables',
          'Nadie, los niños pueden manejarlo solos',
          'Solo los amigos',
          'Las empresas de internet',
        ],
        correctAnswer: 'Los padres o adultos responsables',
        points: 1,
        explanation: 'La supervisión adulta es importante para garantizar un uso seguro.',
      },
    );

    // Pregunta abierta para exámenes
    if (isExam) {
      questionBank.push({
        type: 'SHORT_ANSWER',
        text: `Explica con tus palabras cómo usar ${topicLabel} de forma segura y responsable.`,
        points: 2,
        explanation: 'Pregunta abierta para valorar comprensión y argumentación.',
      });
    }

    // Limitar al número solicitado
    return questionBank.slice(0, requestedCount);
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
    if (!this.isEnabled()) {
      return this.placeholderTeacherQuestion(request);
    }

    try {
      const systemInstruction = [
        'Eres Valeria, la asistente IA de Edusyn.',
        'Responde en español, con tono claro, cercano, breve y práctico.',
        'Puedes responder preguntas generales de cualquier tema, y también consultas sobre Edusyn, pedagogía, administración escolar y Classroom.',
        'Cuando la pregunta sea sobre Edusyn o sobre la pantalla actual, prioriza el contexto interno de la plataforma y de la pantalla.',
        'Si el contexto aporta pageName, pageSummary o currentPath, úsalos para ubicarte y evita responder de forma genérica.',
        '',
        '### GENERACIÓN DE QUIZZES Y EXÁMENES ###',
        'Si la petición busca crear un quiz o examen con preguntas:',
        '1. Extrae el TEMA EXACTO que el usuario menciona (ej: "redes sociales", "fracciones", "la célula").',
        '2. Extrae la CANTIDAD de preguntas solicitadas (ej: "10 preguntas", "5 preguntas"). Si no especifica, genera 5.',
        '3. Extrae el GRADO o nivel educativo si lo menciona (ej: "sexto grado", "primaria").',
        '4. Genera preguntas ESPECÍFICAS sobre ese tema, NO preguntas genéricas sobre Classroom o Edusyn.',
        '5. Usa formato MULTIPLE_CHOICE con 4 opciones (A, B, C, D) a menos que pida otro formato.',
        '6. Incluye correctAnswer con el texto exacto de la opción correcta.',
        '7. Cada pregunta debe tener: type, text, options (array de 4 strings), correctAnswer, points (1-2), explanation.',
        '',
        'Cuando la pregunta no sea sobre Edusyn, responde como una IA general útil y honesta, sin inventar hechos.',
        'Ayudas a planear quizzes, exámenes, guías y logros, pero no decides notas finales ni alteras flujos numéricos críticos.',
        'Si se solicita apoyo visual, propone SVG simple y seguro, sin scripts ni eventos.',
        'Devuelve únicamente JSON válido con las claves: answer, keyPoints, nextSteps, activityDraft, visualSuggestion, confidence.',
        `Contexto interno de Edusyn:\n${this.buildEdusynKnowledgeContext()}`,
      ].join(' ');

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

    if (q.includes('classroom') || q.includes('quiz') || q.includes('examen') || q.includes('actividad')) {
      return {
        answer: `En **Classroom** puedes:\n\n1. **Crear actividades**: Tareas, quizzes, exámenes, guías y autoevaluaciones\n2. **Live Quiz**: Sesiones en tiempo real donde los estudiantes responden simultáneamente\n3. **Quiz en Casa**: Los estudiantes resuelven a su ritmo con fecha límite\n4. **Preguntas variadas**: Opción múltiple, verdadero/falso, completar, emparejar\n5. **Sincronizar notas**: Enviar calificaciones directamente a la planilla\n\nPara crear un quiz: Entra a un aula → Actividades → Nueva Actividad → Selecciona tipo Quiz/Examen → Agrega preguntas → Publica.`,
        keyPoints: [],
        activityDraft: activityDraft
          ? {
              ...activityDraft,
              questions: questionDrafts,
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
