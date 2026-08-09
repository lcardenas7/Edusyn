import { GradeStage } from '@prisma/client';
import { deriveGradeNumber, GRADE_TEMPLATES } from '../../common/utils/academic-level.util';

/**
 * MÓDULO 3 (Onboarding v2) — Inferencia del ECOSISTEMA desde el Excel de estudiantes.
 *
 * Función PURA (no toca la BD). Dada la columna "Curso" de cada fila ("6A", "601",
 * "Sexto A"…), deduce: grado (con número y etapa), grupo, y agrega niveles/jornadas/
 * sedes. Lo que no se pueda mapear con confianza va a `issues` (nunca revienta).
 *
 * Regla clave (Fase 1): el grado SIEMPRE lleva `number` — sin él la promoción no
 * puede ordenar los grados.
 */

// ── Etapa a partir del número de grado (Colombia) ───────────────────────────
export function stageFromNumber(n: number): GradeStage | null {
  if (n === 0) return 'PREESCOLAR';
  if (n >= 1 && n <= 5) return 'BASICA_PRIMARIA';
  if (n >= 6 && n <= 9) return 'BASICA_SECUNDARIA';
  if (n >= 10 && n <= 11) return 'MEDIA';
  return null;
}

/** Nombre canónico del grado a partir del número (usa las plantillas de Fase 1). */
export function gradeNameFromNumber(n: number): string {
  for (const rows of Object.values(GRADE_TEMPLATES)) {
    const hit = rows.find((r) => r.number === n);
    if (hit) return hit.name;
  }
  return n === 0 ? 'Transición' : `${n}°`;
}

export interface ParsedCourse {
  raw: string;
  /** null para modelos flexibles que no equivalen a un grado ordinal. */
  gradeNumber: number | null;
  gradeName: string;
  stage: GradeStage;
  groupName: string;
}

function norm(s: string): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
}

/**
 * Parsea un código de curso a { grado, grupo }. Devuelve null si no es un curso
 * ordinario reconocible, salvo los modelos flexibles soportados explícitamente.
 *
 * Casos soportados:
 *   "6A", "11B"            → grado 6/11 · grupo A/B
 *   "6°A", "6º A", "6 A"   → grado 6 · grupo A
 *   "6-1", "11.2", "6/A"   → separador explícito
 *   "Sexto A", "Once 2"    → grado por palabra
 *   "601", "1101", "1002"  → NNGG colombiano (grado + grupo numérico)
 *   "Transición A"         → grado 0 · grupo A
 *   "TA", "TB", "TC"       → abreviatura Transición · grupo A/B/C
 *   "Aceleración del Aprendizaje" → modelo flexible · grupo A
 */
export function parseCourse(raw: string): ParsedCourse | null {
  const n = norm(raw);
  if (!n) return null;

  const build = (gradeNumber: number, groupName: string): ParsedCourse | null => {
    const stage = stageFromNumber(gradeNumber);
    if (!stage) return null;
    const g = groupName.trim().replace(/^0+(?=\d)/, ''); // "01" → "1"
    if (!g) return null;
    return { raw, gradeNumber, gradeName: gradeNameFromNumber(gradeNumber), stage, groupName: g };
  };

  // Modelo Educativo Flexible del MEN. No corresponde a un grado ordinal, por
  // lo que se guarda sin número y se mantiene separado de 1°–11° al promover.
  if (n === 'ACELERACION' || n === 'ACELERACION DEL APRENDIZAJE') {
    return {
      raw,
      gradeNumber: null,
      gradeName: 'Aceleración del Aprendizaje',
      stage: 'BASICA_PRIMARIA',
      groupName: 'A',
    };
  }

  // 1) Palabra de grado + resto como grupo ("SEXTO A", "TRANSICION B", "ONCE 2").
  const words = n.split(/[^A-Z0-9]+/).filter(Boolean);
  if (words.length >= 2) {
    const wNum = deriveGradeNumber(words[0]);
    if (wNum !== null) {
      const built = build(wNum, words.slice(1).join(' '));
      if (built) return built;
    }
  }

  // 2) Con separador explícito: "6-1", "11.2", "6°A", "6 A", "6/A".
  const sep = n.match(/^(\d{1,2})\s*[°º\-\.\/\s]\s*([A-Z0-9]{1,3})$/);
  if (sep) {
    const built = build(parseInt(sep[1], 10), sep[2]);
    if (built) return built;
  }

  // 3) Dígitos + letra pegados: "6A", "11B".
  const dl = n.match(/^(\d{1,2})([A-Z]{1,2})$/);
  if (dl) {
    const built = build(parseInt(dl[1], 10), dl[2]);
    if (built) return built;
  }

  // 4) Solo dígitos (NNGG colombiano): "601"→6·01, "1101"→11·01, "1002"→10·02.
  const digits = n.match(/^(\d{3,4})$/);
  if (digits) {
    const d = digits[1];
    // Preferir grado de 2 dígitos si es 10/11; si no, grado de 1 dígito.
    const two = parseInt(d.slice(0, 2), 10);
    if (two === 10 || two === 11) {
      const built = build(two, d.slice(2));
      if (built) return built;
    }
    const one = parseInt(d.slice(0, 1), 10);
    const built = build(one, d.slice(1));
    if (built) return built;
  }

  // 5) Abreviatura de grado + grupo: "TA"→Transición·A, "TB"→Transición·B.
  const ABBREV_TO_GRADE: Record<string, number> = { T: 0 };
  const abbr = n.match(/^([A-Z])([A-Z]{1,2})$/);
  if (abbr && ABBREV_TO_GRADE[abbr[1]] !== undefined) {
    const built = build(ABBREV_TO_GRADE[abbr[1]], abbr[2]);
    if (built) return built;
  }

  return null;
}

// ── Agregación del ecosistema ───────────────────────────────────────────────

export interface EcosystemRow {
  curso: string;
  jornada?: string;
  sede?: string;
}

export interface InferredEcosystem {
  sedes: string[];
  jornadas: string[];
  niveles: { stage: GradeStage; label: string }[];
  grados: { number: number | null; name: string; stage: GradeStage; grupos: string[] }[];
  totalGrupos: number;
  issues: { curso: string; motivo: string; filas: number }[];
}

const STAGE_LABEL: Record<GradeStage, string> = {
  PREESCOLAR: 'Preescolar',
  BASICA_PRIMARIA: 'Básica Primaria',
  BASICA_SECUNDARIA: 'Básica Secundaria',
  MEDIA: 'Media',
};

const DEFAULT_SEDE = 'Sede Principal';
const DEFAULT_JORNADA = 'Única';

/** Infiere el ecosistema completo a partir de las filas del Excel. No escribe nada. */
export function inferEcosystem(rows: EcosystemRow[]): InferredEcosystem {
  const gradeMap = new Map<string, { number: number | null; name: string; stage: GradeStage; grupos: Set<string> }>();
  const sedes = new Set<string>();
  const jornadas = new Set<string>();
  const issuesMap = new Map<string, number>();

  for (const row of rows) {
    if (row.sede?.trim()) sedes.add(row.sede.trim());
    if (row.jornada?.trim()) jornadas.add(row.jornada.trim());

    const parsed = parseCourse(row.curso);
    if (!parsed) {
      const key = (row.curso || '(vacío)').trim();
      issuesMap.set(key, (issuesMap.get(key) || 0) + 1);
      continue;
    }
    const gradeKey = parsed.gradeNumber === null
      ? `SPECIAL:${norm(parsed.gradeName)}`
      : `NUMBER:${parsed.gradeNumber}`;
    let g = gradeMap.get(gradeKey);
    if (!g) {
      g = { number: parsed.gradeNumber, name: parsed.gradeName, stage: parsed.stage, grupos: new Set() };
      gradeMap.set(gradeKey, g);
    }
    g.grupos.add(parsed.groupName);
  }

  if (sedes.size === 0) sedes.add(DEFAULT_SEDE);
  if (jornadas.size === 0) jornadas.add(DEFAULT_JORNADA);

  const grados = [...gradeMap.values()]
    .sort((a, b) => (a.number ?? Number.MAX_SAFE_INTEGER) - (b.number ?? Number.MAX_SAFE_INTEGER))
    .map((g) => ({
      number: g.number,
      name: g.name,
      stage: g.stage,
      grupos: [...g.grupos].sort(),
    }));

  const stages = [...new Set(grados.map((g) => g.stage))];
  const niveles = stages
    .sort((a, b) => grados.findIndex((g) => g.stage === a) - grados.findIndex((g) => g.stage === b))
    .map((stage) => ({ stage, label: STAGE_LABEL[stage] }));

  return {
    sedes: [...sedes],
    jornadas: [...jornadas],
    niveles,
    grados,
    totalGrupos: grados.reduce((s, g) => s + g.grupos.length, 0),
    issues: [...issuesMap.entries()].map(([curso, filas]) => ({
      curso,
      motivo: 'Curso no reconocido (no es un grado ordinario) — revisar a mano',
      filas,
    })),
  };
}
