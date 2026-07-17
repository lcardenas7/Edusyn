// ═══════════════════════════════════════════════════════════════════════════
// GRAFO DE DEPENDENCIAS DE ACTIVIDADES — lógica pura (sin NestJS ni Prisma)
// ─────────────────────────────────────────────────────────────────────────
// Una arista (activityId → prerequisiteId) significa "activityId REQUIERE que
// prerequisiteId se complete antes". El conjunto de aristas debe ser un DAG:
// sin auto-dependencias, sin duplicados y sin ciclos. Todo esto es puro y
// testeable en aislamiento (ver activity-graph.util.spec.ts).
// ═══════════════════════════════════════════════════════════════════════════

export interface DependencyEdge {
  activityId: string; // dependiente (queda bloqueada)
  prerequisiteId: string; // prerrequisito (debe completarse antes)
}

export type DependencyValidationError = 'SELF' | 'DUPLICATE' | 'CYCLE';

/** Mapa de adyacencia "requiere": activityId → [prerequisiteIds]. */
function buildRequiresMap(edges: DependencyEdge[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const e of edges) {
    const list = map.get(e.activityId);
    if (list) list.push(e.prerequisiteId);
    else map.set(e.activityId, [e.prerequisiteId]);
  }
  return map;
}

/**
 * ¿Se puede llegar de `start` a `target` siguiendo aristas "requiere"
 * (activityId → prerequisiteId)? DFS iterativo con conjunto de visitados.
 */
export function isReachable(edges: DependencyEdge[], start: string, target: string): boolean {
  if (start === target) return true;
  const requires = buildRequiresMap(edges);
  const stack = [...(requires.get(start) || [])];
  const visited = new Set<string>([start]);
  while (stack.length) {
    const node = stack.pop()!;
    if (node === target) return true;
    if (visited.has(node)) continue;
    visited.add(node);
    const next = requires.get(node);
    if (next) stack.push(...next);
  }
  return false;
}

/**
 * Agregar "activityId requiere prerequisiteId" crearía un ciclo si es una
 * auto-dependencia o si el prerrequisito ya (transitivamente) requiere a la
 * actividad (prerequisiteId → … → activityId), lo que cerraría el ciclo.
 */
export function wouldCreateCycle(edges: DependencyEdge[], activityId: string, prerequisiteId: string): boolean {
  if (activityId === prerequisiteId) return true;
  return isReachable(edges, prerequisiteId, activityId);
}

/** ¿El grafo COMPLETO tiene algún ciclo? (para validar imports/estados enteros). */
export function hasCycle(edges: DependencyEdge[]): boolean {
  const requires = buildRequiresMap(edges);
  const state = new Map<string, 0 | 1 | 2>(); // 0=sin visitar, 1=en pila, 2=terminado
  const nodes = new Set<string>();
  for (const e of edges) { nodes.add(e.activityId); nodes.add(e.prerequisiteId); }

  const dfs = (node: string): boolean => {
    state.set(node, 1);
    for (const next of requires.get(node) || []) {
      const s = state.get(next) || 0;
      if (s === 1) return true; // arista de retroceso → ciclo
      if (s === 0 && dfs(next)) return true;
    }
    state.set(node, 2);
    return false;
  };

  for (const node of nodes) {
    if ((state.get(node) || 0) === 0 && dfs(node)) return true;
  }
  return false;
}

/**
 * Valida agregar una dependencia nueva sobre el grafo actual. Devuelve el tipo
 * de error, o null si es válida.
 */
export function validateNewDependency(
  edges: DependencyEdge[],
  activityId: string,
  prerequisiteId: string,
): DependencyValidationError | null {
  if (activityId === prerequisiteId) return 'SELF';
  if (edges.some(e => e.activityId === activityId && e.prerequisiteId === prerequisiteId)) return 'DUPLICATE';
  if (isReachable(edges, prerequisiteId, activityId)) return 'CYCLE';
  return null;
}
