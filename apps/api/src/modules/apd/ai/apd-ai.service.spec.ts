import { ApdAiService } from './apd-ai.service';
import { matchValeriaTopic, normalizeQuery } from './valeria-knowledge';

describe('ApdAiService · intención de Valeria', () => {
  const service = new ApdAiService() as any;

  it('mantiene las consultas normales en modo conversación', () => {
    expect(service.isExplicitActivityRequest('¿Cuál es la capital de Francia?')).toBe(false);
    expect(service.isExplicitActivityRequest('¿Cómo registro una observación en Edusyn?')).toBe(false);

    const prompt = service.buildValeriaChatSystemPrompt({
      type: 'ASK_VALERIA',
      question: '¿Cómo registro una observación en Edusyn?',
    });
    expect(prompt).toContain('NO incluyas activityDraft');
  });

  it('abre el flujo de actividad solo ante una solicitud explícita', () => {
    expect(service.isExplicitActivityRequest('Crea un quiz de 5 preguntas sobre fracciones para sexto')).toBe(true);
    expect(service.isExplicitActivityRequest('Genera 10 preguntas sobre el sistema solar')).toBe(true);

    const prompt = service.buildValeriaChatSystemPrompt({
      type: 'ASK_VALERIA',
      question: 'Crea un quiz de 5 preguntas sobre fracciones para sexto',
    });
    expect(prompt).toContain('activityDraft (con questions)');
  });

  it('incluye el flujo verificable de aprendizajes y evidencias', () => {
    const knowledge = service.buildEdusynKnowledgeContext();

    expect(knowledge).toContain('APRENDIZAJES Y EVIDENCIAS');
    expect(knowledge).toContain('Agregar evidencia');
    expect(knowledge).toContain('selecciona grupo, asignatura y período');
    expect(knowledge).toContain('Las evidencias pertenecen al aprendizaje');
  });
});

describe('Filtro previo · base de conocimiento interna', () => {
  it('normaliza tildes y puntuación antes de comparar', () => {
    expect(normalizeQuery('¿Cómo registro una observación?')).toBe('como registro una observacion');
    expect(normalizeQuery('¿Cómo asigno una calificación?')).toBe('como asigno una calificacion');
  });

  it('reconoce los procesos internos aunque se escriban con acento', () => {
    const casos: Array<[string, string]> = [
      ['¿Cómo registro un aprendizaje y una evidencia?', 'aprendizajes-evidencias'],
      ['¿Cómo registro una observación?', 'observador'],
      ['¿Cómo asigno una calificación?', 'notas'],
      ['¿Cómo genero el boletín del período?', 'boletines'],
      ['¿Cómo tomo la asistencia del grupo?', 'asistencia'],
      ['¿Cómo matriculo un estudiante nuevo?', 'matricula'],
      ['¿Qué es Edusyn?', 'plataforma'],
    ];

    for (const [pregunta, esperado] of casos) {
      expect(matchValeriaTopic(pregunta)?.topic.id).toBe(esperado);
    }
  });

  it('deja pasar las consultas ajenas a la plataforma', () => {
    expect(matchValeriaTopic('guerra contra Irán')).toBeUndefined();
    expect(matchValeriaTopic('¿Cuál es la capital de Francia?')).toBeUndefined();
  });

  it('usa la pantalla actual para desempatar', () => {
    const match = matchValeriaTopic('¿Cómo agrego esto?', { currentPath: '/achievements' });
    expect(match?.topic.id).toBe('aprendizajes-evidencias');
  });

  it('no deja que la pantalla actual tape una intención explícita', () => {
    const match = matchValeriaTopic('¿Cómo registro la asistencia?', { currentPath: '/achievements' });
    expect(match?.topic.id).toBe('asistencia');
  });
});

describe('Valeria sin LLM · respuesta desde el filtro previo', () => {
  const service = new ApdAiService() as any;

  it('responde el flujo real de aprendizajes y evidencias', () => {
    const res = service.placeholderTeacherQuestion({
      type: 'ASK_VALERIA',
      question: '¿Cómo registro un aprendizaje y una evidencia?',
    });

    expect(res.answer).toContain('Aprendizajes y Evidencias');
    expect(res.answer).toContain('Agregar evidencia');
    expect(res.answer).not.toContain('modo básico');
    expect(res.answer.toLowerCase()).not.toContain('logro');
    expect(res.keyPoints.length).toBeGreaterThan(0);
  });

  it('responde el flujo del observador', () => {
    const res = service.placeholderTeacherQuestion({
      type: 'ASK_VALERIA',
      question: '¿Cómo registro una observación?',
    });

    expect(res.answer).toContain('Observador del Estudiante');
    expect(res.answer).not.toContain('modo básico');
  });

  it('avisa con honestidad ante una consulta ajena a la plataforma', () => {
    const res = service.placeholderTeacherQuestion({
      type: 'ASK_VALERIA',
      question: 'guerra contra Irán',
    });

    expect(res.answer).toContain('no tengo conexión con el servicio de IA');
    expect(res.confidence).toBeLessThan(0.5);
  });

  it('no inventa preguntas cuando se pide una actividad sin IA', () => {
    const res = service.placeholderTeacherQuestion({
      type: 'ASK_VALERIA',
      question: 'Crea un quiz de 5 preguntas sobre fracciones',
    });

    expect(res.answer).toContain('Sin conexión a IA');
    expect(res.activityDraft?.questions).toBeUndefined();
  });
});
