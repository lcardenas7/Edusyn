/**
 * Utilidades para normalización de grupos escolares
 * Convierte formatos como "11A", "11-01", "Undécimo A" a estructura interna (grado + sección)
 */

// Tabla de equivalencias: nombres textuales de grados → número
const GRADE_TEXT_TO_NUMBER: Record<string, number> = {
  'PRIMERO': 1,
  'SEGUNDO': 2,
  'TERCERO': 3,
  'CUARTO': 4,
  'QUINTO': 5,
  'SEXTO': 6,
  'SEPTIMO': 7,
  'OCTAVO': 8,
  'NOVENO': 9,
  'DECIMO': 10,
  'UNDECIMO': 11,
  'ONCE': 11,
  'DOCE': 12,
  'TRANSICION': 0,
  'PREJARDIN': -2,
  'JARDIN': -1,
  'KINDER': -1,
  'PREJARDÍN': -2,
  'JARDÍN': -1,
};

// Grados numéricos válidos
const VALID_NUMERIC_GRADES = [-2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// Secciones válidas (letras A-Z o números 01-99)
const VALID_LETTER_SECTIONS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export interface NormalizedGroup {
  grade: number;
  section: string;
  originalInput: string;
  displayName: string; // Formato visible: "11-A" o "11-01"
}

export interface GroupNormalizationResult {
  success: boolean;
  normalized?: NormalizedGroup;
  error?: string;
  errorType?: 'INVALID_GRADE' | 'INVALID_SECTION' | 'AMBIGUOUS' | 'EMPTY';
}

/**
 * Limpia el texto de entrada:
 * - Convierte a MAYÚSCULAS
 * - Quita tildes
 * - Elimina espacios extra
 */
export function cleanText(text: string): string {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
    .replace(/\s+/g, ' ')            // Espacios múltiples → uno
    .trim();
}

/**
 * Detecta el grado a partir del texto normalizado
 */
export function detectGrade(text: string): { grade: number | null; remaining: string } {
  const cleaned = cleanText(text);
  
  // 1. Intentar detectar grado textual primero (más largo primero para evitar conflictos)
  const sortedKeys = Object.keys(GRADE_TEXT_TO_NUMBER).sort((a, b) => b.length - a.length);
  
  for (const gradeText of sortedKeys) {
    // Buscar el texto del grado al inicio, con separador después
    const regex = new RegExp(`^${gradeText}[\\s\\-]*`, 'i');
    if (regex.test(cleaned)) {
      const remaining = cleaned.replace(regex, '').trim();
      return { grade: GRADE_TEXT_TO_NUMBER[gradeText], remaining };
    }
  }
  
  // 2. Intentar detectar grado numérico al inicio
  const numericMatch = cleaned.match(/^(\d{1,2})[\s\-]*/);
  if (numericMatch) {
    const gradeNum = parseInt(numericMatch[1], 10);
    if (VALID_NUMERIC_GRADES.includes(gradeNum)) {
      const remaining = cleaned.slice(numericMatch[0].length).trim();
      return { grade: gradeNum, remaining };
    }
  }
  
  return { grade: null, remaining: cleaned };
}

/**
 * Detecta la sección a partir del texto restante
 */
export function detectSection(text: string): { section: string | null; isLetter: boolean } {
  const cleaned = cleanText(text).replace(/^[\-\s]+/, ''); // Quitar guiones/espacios al inicio
  
  if (!cleaned) {
    return { section: null, isLetter: false };
  }
  
  // 1. Si es una sola letra A-Z
  if (cleaned.length === 1 && VALID_LETTER_SECTIONS.includes(cleaned)) {
    return { section: cleaned, isLetter: true };
  }
  
  // 2. Si es un número (1, 01, 02, etc.)
  const numericMatch = cleaned.match(/^(\d{1,2})$/);
  if (numericMatch) {
    const sectionNum = parseInt(numericMatch[1], 10);
    if (sectionNum >= 1 && sectionNum <= 99) {
      // Normalizar a dos dígitos
      return { section: sectionNum.toString().padStart(2, '0'), isLetter: false };
    }
  }
  
  // 3. Si el texto comienza con una letra seguida de caracteres inválidos, es ambiguo
  if (cleaned.length > 1 && VALID_LETTER_SECTIONS.includes(cleaned[0])) {
    // Podría ser "A1" que es ambiguo
    return { section: null, isLetter: false };
  }
  
  return { section: null, isLetter: false };
}

/**
 * Normaliza un string de grupo a la estructura interna
 * Acepta: "11A", "11-A", "11 A", "Undécimo A", "11-01", etc.
 */
export function normalizeGroup(input: string): GroupNormalizationResult {
  if (!input || typeof input !== 'string' || !input.trim()) {
    return {
      success: false,
      error: 'El campo grupo está vacío',
      errorType: 'EMPTY',
    };
  }
  
  const originalInput = input.trim();
  const cleaned = cleanText(originalInput);
  
  // Detectar grado
  const { grade, remaining } = detectGrade(cleaned);
  
  if (grade === null) {
    return {
      success: false,
      error: `No se pudo detectar el grado en "${originalInput}"`,
      errorType: 'INVALID_GRADE',
    };
  }
  
  // Detectar sección
  const { section, isLetter } = detectSection(remaining);
  
  if (section === null) {
    return {
      success: false,
      error: `Sección no válida en "${originalInput}". Se esperaba una letra (A-Z) o número (01-99)`,
      errorType: 'INVALID_SECTION',
    };
  }
  
  // Construir nombre visible
  const displayName = isLetter ? `${grade}-${section}` : `${grade}-${section}`;
  
  return {
    success: true,
    normalized: {
      grade,
      section,
      originalInput,
      displayName,
    },
  };
}

/**
 * Normaliza entrada con columnas separadas de grado y sección
 */
export function normalizeGradeSection(
  gradeInput: string | number,
  sectionInput: string | number
): GroupNormalizationResult {
  // Normalizar grado
  let grade: number | null = null;
  
  if (typeof gradeInput === 'number') {
    grade = VALID_NUMERIC_GRADES.includes(gradeInput) ? gradeInput : null;
  } else {
    const cleaned = cleanText(String(gradeInput));
    
    // Primero intentar como número
    const numMatch = cleaned.match(/^(\d{1,2})$/);
    if (numMatch) {
      const num = parseInt(numMatch[1], 10);
      if (VALID_NUMERIC_GRADES.includes(num)) {
        grade = num;
      }
    }
    
    // Luego como texto
    if (grade === null && GRADE_TEXT_TO_NUMBER[cleaned] !== undefined) {
      grade = GRADE_TEXT_TO_NUMBER[cleaned];
    }
  }
  
  if (grade === null) {
    return {
      success: false,
      error: `Grado no válido: "${gradeInput}"`,
      errorType: 'INVALID_GRADE',
    };
  }
  
  // Normalizar sección
  const sectionCleaned = cleanText(String(sectionInput));
  const { section, isLetter } = detectSection(sectionCleaned);
  
  if (section === null) {
    return {
      success: false,
      error: `Sección no válida: "${sectionInput}"`,
      errorType: 'INVALID_SECTION',
    };
  }
  
  const displayName = `${grade}-${section}`;
  
  return {
    success: true,
    normalized: {
      grade,
      section,
      originalInput: `${gradeInput} ${sectionInput}`,
      displayName,
    },
  };
}

/**
 * Compara dos grupos normalizados para detectar duplicados
 * Retorna true si son el mismo grupo
 */
export function areGroupsEqual(a: NormalizedGroup, b: NormalizedGroup): boolean {
  return a.grade === b.grade && a.section === b.section;
}

/**
 * Genera una clave única para un grupo normalizado
 * Usado para detección de duplicados
 */
export function getGroupKey(normalized: NormalizedGroup): string {
  return `${normalized.grade}|${normalized.section}`;
}

/**
 * Obtiene el nombre visible preferido para un grado
 */
export function getGradeDisplayName(grade: number): string {
  const names: Record<number, string> = {
    [-2]: 'Prejardín',
    [-1]: 'Jardín',
    [0]: 'Transición',
    [1]: 'Primero',
    [2]: 'Segundo',
    [3]: 'Tercero',
    [4]: 'Cuarto',
    [5]: 'Quinto',
    [6]: 'Sexto',
    [7]: 'Séptimo',
    [8]: 'Octavo',
    [9]: 'Noveno',
    [10]: 'Décimo',
    [11]: 'Undécimo',
    [12]: 'Duodécimo',
  };
  
  return names[grade] || `Grado ${grade}`;
}
