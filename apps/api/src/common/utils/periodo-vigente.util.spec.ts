import { diaEnColombia, periodoVigente } from './periodo-vigente.util';

/**
 * El período vigente del aula.
 *
 * Los casos vienen del calendario real de un colegio: cuatro períodos con vacaciones entre
 * ellos y, como es frecuente, períodos viejos que nadie finalizó. El síntoma que hay que
 * impedir es el que reportó el docente: estar en el tercer período y que el aula abra en el
 * primero.
 */
const PERIODOS = [
  { id: 'p1', order: 1, status: 'OPEN', startDate: new Date('2026-01-20T00:00:00.000Z'), endDate: new Date('2026-04-05T00:00:00.000Z') },
  { id: 'p2', order: 2, status: 'OPEN', startDate: new Date('2026-04-14T00:00:00.000Z'), endDate: new Date('2026-06-20T00:00:00.000Z') },
  { id: 'p3', order: 3, status: 'OPEN', startDate: new Date('2026-07-13T00:00:00.000Z'), endDate: new Date('2026-09-19T00:00:00.000Z') },
  { id: 'p4', order: 4, status: 'OPEN', startDate: new Date('2026-09-28T00:00:00.000Z'), endDate: new Date('2026-11-28T00:00:00.000Z') },
];

const enColombia = (fecha: string) => new Date(`${fecha}-05:00`);

describe('periodoVigente', () => {
  it('manda el período que contiene hoy', () => {
    expect(periodoVigente(PERIODOS, enColombia('2026-08-15T10:00:00'))?.id).toBe('p3');
  });

  describe('los dos extremos son días de clase', () => {
    it('el día en que empieza', () => {
      expect(periodoVigente(PERIODOS, enColombia('2026-07-13T06:30:00'))?.id).toBe('p3');
    });

    it('el día en que termina, a primera hora', () => {
      expect(periodoVigente(PERIODOS, enColombia('2026-09-19T00:30:00'))?.id).toBe('p3');
    });

    it('el día en que termina, por la noche', () => {
      // Con la comparación anterior —`ahora <= endDate`, medianoche— este día ya no contaba.
      expect(periodoVigente(PERIODOS, enColombia('2026-09-19T22:00:00'))?.id).toBe('p3');
    });
  });

  describe('en el hueco entre dos períodos', () => {
    it('manda el último que ya empezó, no el primero abierto', () => {
      // Este es el defecto que reportó el docente: aquí salía "p1" porque era el primero OPEN.
      expect(periodoVigente(PERIODOS, enColombia('2026-09-23T09:00:00'))?.id).toBe('p3');
    });

    it('también entre el primero y el segundo', () => {
      expect(periodoVigente(PERIODOS, enColombia('2026-04-10T09:00:00'))?.id).toBe('p1');
    });

    it('y después de que termine el último', () => {
      expect(periodoVigente(PERIODOS, enColombia('2026-12-15T09:00:00'))?.id).toBe('p4');
    });
  });

  it('antes de que empiece el año, el primero que vendrá', () => {
    expect(periodoVigente(PERIODOS, enColombia('2026-01-05T09:00:00'))?.id).toBe('p1');
  });

  describe('la hora del servidor no es la del colegio', () => {
    it('a las 8 de la noche en Colombia sigue siendo el mismo día', () => {
      // 19-sep 20:00 en Colombia es el 20-sep 01:00 UTC: con la hora del servidor, el período
      // ya habría terminado.
      expect(periodoVigente(PERIODOS, enColombia('2026-09-19T20:00:00'))?.id).toBe('p3');
    });

    it('diaEnColombia no se adelanta de noche', () => {
      expect(diaEnColombia(new Date('2026-09-20T02:00:00.000Z'))).toBe('2026-09-19');
    });
  });

  describe('cuando el colegio no puso fechas', () => {
    const sinFechas = [
      { id: 'a', order: 1, status: 'FINALIZED', startDate: null, endDate: null },
      { id: 'b', order: 2, status: 'OPEN', startDate: null, endDate: null },
    ];

    it('cae al primero abierto', () => {
      expect(periodoVigente(sinFechas, enColombia('2026-09-23T09:00:00'))?.id).toBe('b');
    });

    it('y si ninguno está abierto, al primero', () => {
      const cerrados = sinFechas.map((p) => ({ ...p, status: 'FINALIZED' }));
      expect(periodoVigente(cerrados, enColombia('2026-09-23T09:00:00'))?.id).toBe('a');
    });
  });

  it('los que sí tienen fechas mandan sobre los que no', () => {
    const mezcla = [
      { id: 'viejo', order: 1, status: 'OPEN', startDate: null, endDate: null },
      ...PERIODOS.slice(2),
    ];
    expect(periodoVigente(mezcla, enColombia('2026-08-15T09:00:00'))?.id).toBe('p3');
  });

  it('el orden lo pone el colegio, no la lista que llegue', () => {
    const desordenados = [PERIODOS[3], PERIODOS[0], PERIODOS[2], PERIODOS[1]];
    expect(periodoVigente(desordenados, enColombia('2026-09-23T09:00:00'))?.id).toBe('p3');
  });

  it('sin períodos no inventa ninguno', () => {
    expect(periodoVigente([], new Date())).toBeNull();
    expect(periodoVigente(undefined as any, new Date())).toBeNull();
  });
});
