import { sortGroups, gradeAcademicRank } from './group-order.util';

/**
 * Orden canónico "por grupo": grado en orden académico y luego la letra del grupo.
 * Ej.: Sexto A, Sexto B, Sexto C, Séptimo A…  (no por letra ni alfabético por nombre de grado).
 */
describe('group-order.util', () => {
  it('ordena por grado (académico) y luego por letra', () => {
    const groups = [
      { name: 'B', grade: { stage: 'BASICA_SECUNDARIA', name: 'Sexto', number: 6 } },
      { name: 'A', grade: { stage: 'MEDIA', name: 'Décimo', number: 10 } },
      { name: 'A', grade: { stage: 'BASICA_SECUNDARIA', name: 'Sexto', number: 6 } },
      { name: 'C', grade: { stage: 'BASICA_SECUNDARIA', name: 'Sexto', number: 6 } },
      { name: 'A', grade: { stage: 'BASICA_SECUNDARIA', name: 'Séptimo', number: 7 } },
      { name: 'A', grade: { stage: 'PREESCOLAR', name: 'Transición', number: 0 } },
    ];
    const ordered = sortGroups(groups).map((g) => `${g.grade.name} ${g.name}`);
    expect(ordered).toEqual([
      'Transición A',
      'Sexto A',
      'Sexto B',
      'Sexto C',
      'Séptimo A',
      'Décimo A',
    ]);
  });

  it('es robusto a grade.number sin poblar (usa el ordinal del nombre)', () => {
    const groups = [
      { name: 'A', grade: { stage: 'BASICA_SECUNDARIA', name: 'Noveno', number: null } },
      { name: 'A', grade: { stage: 'BASICA_SECUNDARIA', name: 'Sexto', number: null } },
      { name: 'A', grade: { stage: 'BASICA_PRIMARIA', name: 'Cuarto', number: null } },
    ];
    const ordered = sortGroups(groups).map((g) => g.grade.name);
    expect(ordered).toEqual(['Cuarto', 'Sexto', 'Noveno']);
  });

  it('gradeAcademicRank respeta el orden de niveles', () => {
    expect(gradeAcademicRank({ stage: 'PREESCOLAR', number: 0 })).toBeLessThan(gradeAcademicRank({ stage: 'BASICA_PRIMARIA', number: 1 }));
    expect(gradeAcademicRank({ stage: 'BASICA_SECUNDARIA', number: 9 })).toBeLessThan(gradeAcademicRank({ stage: 'MEDIA', number: 10 }));
  });
});
