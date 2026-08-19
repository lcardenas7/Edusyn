import { canonicalText, fillBlankMatches, parseBlanks, textMatches } from './answer-matching.util';

describe('answer-matching', () => {
  describe('textMatches', () => {
    it('ignora mayúsculas, tildes y puntuación en los extremos', () => {
      expect(textMatches('canción', 'cancion')).toBe(true);
      expect(textMatches('Bogotá', 'bogota.')).toBe(true);
      expect(textMatches('casa', '  CASA ')).toBe(true);
    });

    it('admite alternativas separadas por "|"', () => {
      expect(textMatches('grande|large', 'LARGE')).toBe(true);
      expect(textMatches('sí|si|claro', 'Si')).toBe(true);
    });

    it('sigue rechazando lo que de verdad está mal', () => {
      expect(textMatches('cooks', 'cook')).toBe(false);
      expect(textMatches('casa', '')).toBe(false);
      expect(textMatches(null, 'casa')).toBe(false);
    });
  });

  describe('parseBlanks', () => {
    it('lee el JSON que guarda el editor del aula', () => {
      expect(parseBlanks('["Bogotá","8"]')).toEqual(['Bogotá', '8']);
    });

    it('tolera correctAnswer en texto plano (hueco único legado)', () => {
      expect(parseBlanks('Bogotá')).toEqual(['Bogotá']);
    });

    it('no revienta con JSON corrupto ni con vacío', () => {
      expect(parseBlanks('[roto')).toEqual(['[roto']);
      expect(parseBlanks('')).toEqual([]);
      expect(parseBlanks(null)).toEqual([]);
    });
  });

  describe('fillBlankMatches', () => {
    it('acepta la palabra correcta escrita sin tilde', () => {
      expect(fillBlankMatches('["canción"]', '["cancion"]')).toBe(true);
    });

    it('acepta el hueco único guardado como texto plano', () => {
      // Antes: JSON.parse('Bogotá') lanzaba → toda respuesta se marcaba incorrecta.
      expect(fillBlankMatches('Bogotá', '["Bogota"]')).toBe(true);
    });

    it('califica varios huecos en orden', () => {
      expect(fillBlankMatches('["Bogotá","ocho"]', '["bogota","OCHO"]')).toBe(true);
      expect(fillBlankMatches('["Bogotá","ocho"]', '["bogota","nueve"]')).toBe(false);
    });

    it('sobrevive al desfase de índices cuando el docente dejó un hueco sin respuesta', () => {
      // El formulario descarta los huecos vacíos del docente (1 esperado) mientras
      // el alumno envía un arreglo posicional de 2 (el primero vacío).
      expect(fillBlankMatches('["millones"]', '["","millones"]')).toBe(true);
    });

    it('marca error si falta responder algún hueco', () => {
      expect(fillBlankMatches('["Bogotá","ocho"]', '["bogota"]')).toBe(false);
      expect(fillBlankMatches('["Bogotá"]', '[]')).toBe(false);
    });

    it('sin respuesta correcta configurada, nada es correcto', () => {
      expect(fillBlankMatches('[]', '["algo"]')).toBe(false);
    });
  });

  it('canonicalText no destroza números con signo ni grados', () => {
    expect(canonicalText('-5')).toBe('-5');
    expect(canonicalText('37°')).toBe('37°');
  });
});
