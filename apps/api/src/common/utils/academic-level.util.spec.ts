import {
  levelKey,
  levelMatchesStage,
  findLevelForGrade,
  deriveGradeNumber,
  GRADE_TEMPLATES,
} from './academic-level.util';

describe('academic-level.util', () => {
  describe('levelMatchesStage — el enum del grado debe casar con el código humano del nivel', () => {
    const primaria = { code: 'PRIMARIA', name: 'Básica Primaria' };

    it('casa el enum BASICA_PRIMARIA con el nivel "PRIMARIA" (el bug que se corrigió)', () => {
      expect(levelMatchesStage(primaria, 'BASICA_PRIMARIA')).toBe(true);
    });

    it('casa también cuando se pasa el código del nivel tal cual', () => {
      expect(levelMatchesStage(primaria, 'PRIMARIA')).toBe(true);
    });

    it('tolera acentos y separadores', () => {
      expect(levelMatchesStage({ code: null, name: 'Básica  Primaria' }, 'BASICA_PRIMARIA')).toBe(true);
    });

    it('no casa niveles ajenos', () => {
      expect(levelMatchesStage(primaria, 'MEDIA')).toBe(false);
      expect(levelMatchesStage(primaria, 'DESCONOCIDO')).toBe(false);
    });

    it('secundaria y media', () => {
      expect(levelMatchesStage({ code: 'SECUNDARIA' }, 'BASICA_SECUNDARIA')).toBe(true);
      expect(levelMatchesStage({ code: 'MEDIA' }, 'MEDIA')).toBe(true);
    });
  });

  describe('findLevelForGrade', () => {
    const levels = [
      { code: 'PRIMARIA', name: 'Primaria', grades: ['5A'], minPassingGrade: 3.5 },
      { code: 'MEDIA', name: 'Media', grades: ['10A'], minPassingGrade: 3.0 },
    ];

    it('resuelve por etapa (camino correcto)', () => {
      expect(findLevelForGrade(levels, 'BASICA_PRIMARIA')?.code).toBe('PRIMARIA');
    });

    it('cae al nombre del grado dentro de grades[] (compatibilidad)', () => {
      expect(findLevelForGrade(levels, undefined, '10A')?.code).toBe('MEDIA');
    });

    it('devuelve null si no hay match', () => {
      expect(findLevelForGrade(levels, 'PREESCOLAR', 'ZZZ')).toBeNull();
      expect(findLevelForGrade([], 'MEDIA')).toBeNull();
    });
  });

  describe('deriveGradeNumber', () => {
    it('deduce el número desde el nombre en palabra', () => {
      expect(deriveGradeNumber('Primero')).toBe(1);
      expect(deriveGradeNumber('Sexto')).toBe(6);
      expect(deriveGradeNumber('Noveno')).toBe(9);
      expect(deriveGradeNumber('Décimo')).toBe(10);
    });

    it('Undécimo es 11, NO 10 (contiene "decimo" como subcadena)', () => {
      expect(deriveGradeNumber('Undécimo')).toBe(11);
      expect(deriveGradeNumber('Úndecimo')).toBe(11);
      expect(deriveGradeNumber('Once')).toBe(11);
    });

    it('acepta nombres numéricos', () => {
      expect(deriveGradeNumber('6°')).toBe(6);
      expect(deriveGradeNumber('11')).toBe(11);
    });

    it('no inventa número cuando no es un grado ordinario', () => {
      expect(deriveGradeNumber('CICLO 6')).toBeNull();
      expect(deriveGradeNumber('Play')).toBeNull();
      expect(deriveGradeNumber('')).toBeNull();
    });
  });

  describe('GRADE_TEMPLATES', () => {
    it('primaria genera 1°–5° con su número', () => {
      expect(GRADE_TEMPLATES.BASICA_PRIMARIA.map((g) => g.number)).toEqual([1, 2, 3, 4, 5]);
    });

    it('secundaria 6–9 y media 10–11 (para que la promoción ordene bien)', () => {
      expect(GRADE_TEMPLATES.BASICA_SECUNDARIA.map((g) => g.number)).toEqual([6, 7, 8, 9]);
      expect(GRADE_TEMPLATES.MEDIA.map((g) => g.number)).toEqual([10, 11]);
    });

    it('ningún grado de plantilla queda sin número', () => {
      for (const rows of Object.values(GRADE_TEMPLATES)) {
        for (const r of rows) expect(typeof r.number).toBe('number');
      }
    });
  });

  describe('levelKey', () => {
    it('normaliza a clave comparable', () => {
      expect(levelKey('Básica Primaria')).toBe('BASICAPRIMARIA');
      expect(levelKey('BASICA_PRIMARIA')).toBe('BASICAPRIMARIA');
      expect(levelKey(null)).toBe('');
    });
  });
});
