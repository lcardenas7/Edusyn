import {
  parseCourse,
  inferEcosystem,
  stageFromNumber,
  gradeNameFromNumber,
} from './student-ecosystem-inference.util';

describe('student-ecosystem-inference (Módulo 3)', () => {
  describe('stageFromNumber', () => {
    it('mapea número → etapa', () => {
      expect(stageFromNumber(0)).toBe('PREESCOLAR');
      expect(stageFromNumber(3)).toBe('BASICA_PRIMARIA');
      expect(stageFromNumber(6)).toBe('BASICA_SECUNDARIA');
      expect(stageFromNumber(11)).toBe('MEDIA');
      expect(stageFromNumber(12)).toBeNull();
    });
  });

  describe('parseCourse — dígito+letra', () => {
    it('"6A" → grado 6, grupo A, secundaria', () => {
      expect(parseCourse('6A')).toEqual({
        raw: '6A', gradeNumber: 6, gradeName: '6°', stage: 'BASICA_SECUNDARIA', groupName: 'A',
      });
    });
    it('"11B" → grado 11, grupo B, media', () => {
      expect(parseCourse('11B')).toMatchObject({ gradeNumber: 11, groupName: 'B', stage: 'MEDIA' });
    });
  });

  describe('parseCourse — con separador', () => {
    it.each([
      ['6°A', 6, 'A'],
      ['6º A', 6, 'A'],
      ['6 A', 6, 'A'],
      ['6-1', 6, '1'],
      ['11.2', 11, '2'],
      ['6/A', 6, 'A'],
    ])('"%s" → grado %i grupo %s', (raw, num, grp) => {
      expect(parseCourse(raw as string)).toMatchObject({ gradeNumber: num, groupName: grp });
    });
  });

  describe('parseCourse — por palabra', () => {
    it('"Sexto A" → grado 6, grupo A', () => {
      expect(parseCourse('Sexto A')).toMatchObject({ gradeNumber: 6, groupName: 'A' });
    });
    it('"Transición B" → grado 0, grupo B, preescolar', () => {
      expect(parseCourse('Transición B')).toMatchObject({ gradeNumber: 0, groupName: 'B', stage: 'PREESCOLAR' });
    });
    it('"Undécimo 1" → grado 11 (no 10)', () => {
      expect(parseCourse('Undécimo 1')).toMatchObject({ gradeNumber: 11, groupName: '1' });
    });
  });

  describe('parseCourse — NNGG colombiano (solo dígitos)', () => {
    it('"601" → grado 6, grupo 1', () => {
      expect(parseCourse('601')).toMatchObject({ gradeNumber: 6, groupName: '1' });
    });
    it('"1101" → grado 11, grupo 1', () => {
      expect(parseCourse('1101')).toMatchObject({ gradeNumber: 11, groupName: '1' });
    });
    it('"1002" → grado 10, grupo 2', () => {
      expect(parseCourse('1002')).toMatchObject({ gradeNumber: 10, groupName: '2' });
    });
  });

  describe('parseCourse — modelos flexibles', () => {
    it('"Aceleración del Aprendizaje" crea un grado especial no ordinal', () => {
      expect(parseCourse('Aceleración del Aprendizaje')).toEqual({
        raw: 'Aceleración del Aprendizaje',
        gradeNumber: null,
        gradeName: 'Aceleración del Aprendizaje',
        stage: 'BASICA_PRIMARIA',
        groupName: 'A',
      });
    });

    it.each(['CICLO 3', '', 'XYZ'])('"%s" → null', (raw) => {
      expect(parseCourse(raw)).toBeNull();
    });
  });

  describe('inferEcosystem', () => {
    it('agrega cursos en grados+grupos, niveles, sede y jornada por defecto', () => {
      const eco = inferEcosystem([
        { curso: '6A' }, { curso: '6B' }, { curso: '7A' },
        { curso: '11A' },
      ]);
      expect(eco.grados.map((g) => g.number)).toEqual([6, 7, 11]);
      const sexto = eco.grados.find((g) => g.number === 6)!;
      expect(sexto.grupos).toEqual(['A', 'B']);
      expect(eco.totalGrupos).toBe(4);
      expect(eco.niveles.map((n) => n.stage)).toEqual(['BASICA_SECUNDARIA', 'MEDIA']);
      expect(eco.sedes).toEqual(['Sede Principal']);
      expect(eco.jornadas).toEqual(['Única']);
      expect(eco.issues).toEqual([]);
    });

    it('respeta sede/jornada de las columnas y reporta cursos no reconocidos', () => {
      const eco = inferEcosystem([
        { curso: '6A', jornada: 'Mañana', sede: 'Sede Norte' },
        { curso: 'CICLO 3', jornada: 'Tarde', sede: 'Sede Norte' },
        { curso: 'CICLO 3', jornada: 'Tarde', sede: 'Sede Norte' },
      ]);
      expect(eco.sedes).toContain('Sede Norte');
      expect(eco.jornadas.sort()).toEqual(['Mañana', 'Tarde']);
      expect(eco.issues).toEqual([{ curso: 'CICLO 3', motivo: expect.any(String), filas: 2 }]);
    });

    it('los grados ordinarios conservan número para la promoción', () => {
      const eco = inferEcosystem([{ curso: '6A' }, { curso: 'Sexto B' }, { curso: '1101' }]);
      for (const g of eco.grados) expect(typeof g.number).toBe('number');
    });

    it('incluye Aceleración como grado especial sin reportarlo como error', () => {
      const eco = inferEcosystem([{ curso: 'Aceleración del Aprendizaje' }]);
      expect(eco.grados).toEqual([{
        number: null,
        name: 'Aceleración del Aprendizaje',
        stage: 'BASICA_PRIMARIA',
        grupos: ['A'],
      }]);
      expect(eco.issues).toEqual([]);
    });
  });

  describe('gradeNameFromNumber', () => {
    it('usa las plantillas de Fase 1', () => {
      expect(gradeNameFromNumber(6)).toBe('6°');
      expect(gradeNameFromNumber(0)).toBe('Transición');
    });
  });
});
