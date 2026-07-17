import { DependencyEdge, isReachable, wouldCreateCycle, hasCycle, validateNewDependency } from './activity-graph.util';

// Helper: arista "a requiere b".
const dep = (activityId: string, prerequisiteId: string): DependencyEdge => ({ activityId, prerequisiteId });

describe('activity-graph.util', () => {
  describe('Caso 1 — cadena Lección → Actividad → Quiz', () => {
    // actividad requiere leccion; quiz requiere actividad
    const edges = [dep('actividad', 'leccion'), dep('quiz', 'actividad')];

    it('detecta alcanzabilidad transitiva', () => {
      expect(isReachable(edges, 'quiz', 'leccion')).toBe(true); // quiz → actividad → leccion
      expect(isReachable(edges, 'leccion', 'quiz')).toBe(false);
    });

    it('el grafo válido no tiene ciclo', () => {
      expect(hasCycle(edges)).toBe(false);
    });

    it('cerrar la cadena (leccion requiere quiz) sería ciclo', () => {
      expect(wouldCreateCycle(edges, 'leccion', 'quiz')).toBe(true);
      expect(validateNewDependency(edges, 'leccion', 'quiz')).toBe('CYCLE');
    });
  });

  describe('Caso 2 — diamante: Lección → (Video, Speaking, Writing) → Proyecto → Quiz', () => {
    const edges = [
      dep('video', 'leccion'),
      dep('speaking', 'leccion'),
      dep('writing', 'leccion'),
      dep('proyecto', 'video'),
      dep('proyecto', 'speaking'),
      dep('proyecto', 'writing'),
      dep('quiz', 'proyecto'),
    ];

    it('es un DAG válido (sin ciclos)', () => {
      expect(hasCycle(edges)).toBe(false);
    });

    it('quiz alcanza la lección por cualquier rama', () => {
      expect(isReachable(edges, 'quiz', 'leccion')).toBe(true);
    });

    it('la lección no puede requerir al quiz (ciclo)', () => {
      expect(validateNewDependency(edges, 'leccion', 'quiz')).toBe('CYCLE');
    });

    it('permite dependencias válidas nuevas', () => {
      expect(validateNewDependency(edges, 'quiz', 'leccion')).toBeNull(); // atajo redundante pero válido (no cierra ciclo)
    });
  });

  describe('Caso 3 — diagnóstica libre + cadena independiente', () => {
    // diagnostica sin dependencias; leccion → video → quiz aparte
    const edges = [dep('video', 'leccion'), dep('quiz', 'video')];

    it('la diagnóstica no está en el grafo (siempre libre)', () => {
      expect(isReachable(edges, 'diagnostica', 'leccion')).toBe(false);
      expect(edges.some(e => e.activityId === 'diagnostica')).toBe(false);
    });
  });

  describe('validaciones básicas', () => {
    it('rechaza auto-dependencia', () => {
      expect(validateNewDependency([], 'a', 'a')).toBe('SELF');
      expect(wouldCreateCycle([], 'a', 'a')).toBe(true);
    });

    it('rechaza duplicados', () => {
      const edges = [dep('a', 'b')];
      expect(validateNewDependency(edges, 'a', 'b')).toBe('DUPLICATE');
    });

    it('detecta ciclo directo A↔B', () => {
      const edges = [dep('a', 'b')];
      expect(validateNewDependency(edges, 'b', 'a')).toBe('CYCLE');
    });

    it('hasCycle encuentra ciclos ya presentes', () => {
      expect(hasCycle([dep('a', 'b'), dep('b', 'c'), dep('c', 'a')])).toBe(true);
    });
  });
});
