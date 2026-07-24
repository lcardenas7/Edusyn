import { GradeStage } from '@prisma/client';

/**
 * FUENTE ÚNICA del mapeo "etapa del grado" ↔ "nivel académico configurado".
 *
 * Por qué existe: los grados guardan su etapa con el enum (`BASICA_PRIMARIA`),
 * pero los niveles que configura la institución usan códigos humanos (`PRIMARIA`).
 * Antes se comparaban directamente (`l.code === stage`), así que NUNCA casaban, y
 * el sistema caía a la lista `grades[]` del nivel — que casi siempre está vacía.
 * Resultado: la nota mínima y la escala POR NIVEL se ignoraban en silencio y todo
 * usaba el umbral global. Este util corrige la raíz.
 */

/** Normaliza a una clave comparable: sin acentos, sin separadores, mayúsculas. */
export function levelKey(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/** Alias aceptados para cada etapa (así el nivel se llame "Primaria" o "Básica Primaria"). */
const STAGE_ALIASES: Record<GradeStage, string[]> = {
  PREESCOLAR: ['PREESCOLAR', 'TRANSICION', 'INICIAL'],
  BASICA_PRIMARIA: ['BASICAPRIMARIA', 'PRIMARIA'],
  BASICA_SECUNDARIA: ['BASICASECUNDARIA', 'SECUNDARIA'],
  MEDIA: ['MEDIA', 'EDUCACIONMEDIA', 'MEDIAACADEMICA', 'MEDIATECNICA'],
};

/**
 * ¿Este nivel configurado corresponde a esta etapa?
 *
 * Acepta tanto el enum del grado (`BASICA_PRIMARIA`) como el código del nivel
 * tal cual (`PRIMARIA`), porque distintos llamadores pasan uno u otro.
 */
export function levelMatchesStage(
  level: { code?: string | null; name?: string | null } | null | undefined,
  stage: GradeStage | string | null | undefined,
): boolean {
  if (!level || !stage) return false;

  const candidates = new Set<string>();
  const aliases = STAGE_ALIASES[stage as GradeStage];
  if (aliases) for (const a of aliases) candidates.add(a);
  const raw = levelKey(String(stage));
  if (raw) candidates.add(raw);

  const codeK = levelKey(level.code);
  const nameK = levelKey(level.name);
  return (!!codeK && candidates.has(codeK)) || (!!nameK && candidates.has(nameK));
}

/**
 * Encuentra el nivel configurado que corresponde a un grado.
 * 1) Por etapa (robusto — el camino correcto).
 * 2) Fallback: por nombre del grado dentro de `level.grades[]` (compatibilidad
 *    con instituciones que aún tengan esa lista poblada). Esa lista es la
 *    representación duplicada que se está retirando.
 */
export function findLevelForGrade<T extends { code?: string | null; name?: string | null; grades?: string[] }>(
  levels: T[] | null | undefined,
  stage: GradeStage | string | null | undefined,
  gradeName?: string | null,
): T | null {
  if (!Array.isArray(levels) || levels.length === 0) return null;

  const byStage = levels.find((l) => levelMatchesStage(l, stage));
  if (byStage) return byStage;

  if (gradeName) {
    const gk = levelKey(gradeName);
    const byName = levels.find((l) => (l.grades || []).some((g) => levelKey(g) === gk));
    if (byName) return byName;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// PLANTILLAS DE GRADOS — "generar los grados estándar de un nivel"
// ═══════════════════════════════════════════════════════════════════════════

export interface GradeTemplateRow {
  number: number;
  name: string;
}

/**
 * Grados estándar por etapa (Colombia). Se generan con su `number` ya puesto:
 * la promoción ordena por ese número, y dejarlo en NULL rompe el cálculo del
 * "grado siguiente".
 */
export const GRADE_TEMPLATES: Record<GradeStage, GradeTemplateRow[]> = {
  PREESCOLAR: [{ number: 0, name: 'Transición' }],
  BASICA_PRIMARIA: [
    { number: 1, name: '1°' },
    { number: 2, name: '2°' },
    { number: 3, name: '3°' },
    { number: 4, name: '4°' },
    { number: 5, name: '5°' },
  ],
  BASICA_SECUNDARIA: [
    { number: 6, name: '6°' },
    { number: 7, name: '7°' },
    { number: 8, name: '8°' },
    { number: 9, name: '9°' },
  ],
  MEDIA: [
    { number: 10, name: '10°' },
    { number: 11, name: '11°' },
  ],
};

/** Nombre → número de grado (para rellenar `number` faltante desde el nombre). */
const NAME_TO_NUMBER: Record<string, number> = {
  TRANSICION: 0, PREJARDIN: -2, JARDIN: -1,
  PRIMERO: 1, PRIMER: 1, SEGUNDO: 2, TERCERO: 3, TERCER: 3, CUARTO: 4, QUINTO: 5,
  SEXTO: 6, SEPTIMO: 7, OCTAVO: 8, NOVENO: 9, DECIMO: 10,
  UNDECIMO: 11, ONCE: 11, DUODECIMO: 12, DOCE: 12,
};

/**
 * Deriva el número de un grado a partir de su nombre. `null` si no se puede
 * inferir con confianza (p. ej. "CICLO 6", que no es un grado ordinario).
 */
export function deriveGradeNumber(name: string): number | null {
  const raw = (name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

  // 1) Palabra exacta (token) — evita que "UNDECIMO" case como "DECIMO".
  for (const token of raw.split(/[^A-Z]+/).filter(Boolean)) {
    if (NAME_TO_NUMBER[token] !== undefined) return NAME_TO_NUMBER[token];
  }
  // 2) Nombre puramente numérico: "6", "6°", "11º" (NO "CICLO 6").
  const compact = raw.replace(/[°º\s]/g, '');
  if (/^\d{1,2}$/.test(compact)) return parseInt(compact, 10);

  return null;
}
