import { resolveScaleLevel, deriveScaleFromConfig, DEFAULT_PERFORMANCE_SCALE, validateScaleRanges } from './performance-scale.util';

/**
 * Q-1 — La escala enriquecida usa los valores configurados por la institución;
 * si están en null, cae a los defaults derivados del enum. Sin backfill.
 */
describe('resolveScaleLevel (Q-1)', () => {
  it('usa defaults del enum cuando los campos son null', () => {
    expect(resolveScaleLevel({ level: 'SUPERIOR', label: null, order: null, isApproved: null }))
      .toEqual({ level: 'SUPERIOR', label: 'Superior', order: 4, isApproved: true });
    expect(resolveScaleLevel({ level: 'BAJO' }))
      .toEqual({ level: 'BAJO', label: 'Bajo', order: 1, isApproved: false });
  });

  it('respeta los valores configurados cuando existen', () => {
    const r = resolveScaleLevel({
      level: 'BASICO',
      label: 'En proceso',
      order: 2,
      isApproved: true,
    });
    expect(r.label).toBe('En proceso');
    expect(r.isApproved).toBe(true);
  });

  it('isApproved=false configurado NO se pisa con el default true', () => {
    // BASICO por default aprueba; si la institución lo marca como no aprobatorio, se respeta
    const r = resolveScaleLevel({ level: 'BASICO', isApproved: false });
    expect(r.isApproved).toBe(false);
  });

  it('order de todos los niveles es coherente (SUP>ALT>BAS>BAJO)', () => {
    const sup = resolveScaleLevel({ level: 'SUPERIOR' }).order;
    const alt = resolveScaleLevel({ level: 'ALTO' }).order;
    const bas = resolveScaleLevel({ level: 'BASICO' }).order;
    const bajo = resolveScaleLevel({ level: 'BAJO' }).order;
    expect(sup).toBeGreaterThan(alt);
    expect(alt).toBeGreaterThan(bas);
    expect(bas).toBeGreaterThan(bajo);
  });
});

describe('deriveScaleFromConfig (Consolidación)', () => {
  it('usa gradingConfig.performanceLevels cuando existen (caso Ciudadela)', () => {
    const grading = {
      performanceLevels: [
        { code: 'SUPERIOR', name: 'Superior', minScore: 4.5, maxScore: 5, order: 0, isApproved: true },
        { code: 'BAJO', name: 'Bajo', minScore: 1, maxScore: 2.9, order: 3, isApproved: false },
      ],
    };
    const rows = deriveScaleFromConfig(grading, null);
    expect(rows).toHaveLength(2);
    const sup = rows.find((r) => r.level === 'SUPERIOR')!;
    expect(sup.minScore).toBe(4.5);
    expect(sup.label).toBe('Superior');
    expect(rows.find((r) => r.level === 'BAJO')!.isApproved).toBe(false);
  });

  it('cae a academicLevelsConfig numérico si gradingConfig no tiene niveles (caso Villas)', () => {
    const academic = [
      { name: 'Preescolar', gradingScaleType: 'QUALITATIVE_DESC', performanceLevels: [] },
      {
        name: 'Primaria',
        gradingScaleType: 'NUMERIC_1_5',
        performanceLevels: [
          { code: 'BASICO', name: 'Básico', minScore: 3, maxScore: 3.9, isApproved: true },
        ],
      },
    ];
    const rows = deriveScaleFromConfig({ performanceLevels: [] }, academic);
    expect(rows).toHaveLength(1);
    expect(rows[0].level).toBe('BASICO');
  });

  it('cae a la escala por defecto 0-5 si no hay niveles en ningún lado', () => {
    const rows = deriveScaleFromConfig(null, null);
    expect(rows).toEqual(DEFAULT_PERFORMANCE_SCALE);
    expect(rows).toHaveLength(4);
  });

  it('ignora códigos desconocidos y niveles sin rango', () => {
    const grading = {
      performanceLevels: [
        { code: 'RARO', name: 'X', minScore: 1, maxScore: 2 },
        { code: 'ALTO', name: 'Alto', minScore: 4, maxScore: 4.5 }, // válido
        { code: 'BASICO', name: 'Básico', minScore: null, maxScore: 3.9 }, // sin rango
      ],
    };
    const rows = deriveScaleFromConfig(grading, null);
    expect(rows).toHaveLength(1);
    expect(rows[0].level).toBe('ALTO');
  });
});

describe('validateScaleRanges (P2)', () => {
  const R = (level: any, minScore: number, maxScore: number) => ({ level, minScore, maxScore });

  it('escala por defecto es válida (adyacencia 2.9→3.0 no es hueco)', () => {
    expect(validateScaleRanges(DEFAULT_PERFORMANCE_SCALE)).toEqual([]);
  });

  it('detecta un hueco real (> 0.1)', () => {
    const issues = validateScaleRanges([R('BAJO', 1, 2.5), R('BASICO', 3, 5)]);
    expect(issues.some((i) => i.includes('Hueco'))).toBe(true);
  });

  it('detecta solape', () => {
    const issues = validateScaleRanges([R('BAJO', 1, 3.2), R('BASICO', 3, 3.9)]);
    expect(issues.some((i) => i.includes('Solape'))).toBe(true);
  });

  it('detecta min > max', () => {
    const issues = validateScaleRanges([R('ALTO', 4.5, 4)]);
    expect(issues.some((i) => i.includes('mayor que máximo'))).toBe(true);
  });
});
