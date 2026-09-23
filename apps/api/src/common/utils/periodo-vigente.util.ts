/**
 * Qué período académico está vigente hoy. **Lógica pura.**
 *
 * Antes se resolvía con una línea dentro del aula: «el que contiene hoy, si no el primero
 * ABIERTO». Fallaba de tres maneras, y las tres las vio un docente:
 *
 *  1. **El último día del período no contaba.** Las fechas se guardan a medianoche, así que un
 *     período que termina el 19 de septiembre dejaba de estar vigente el 19 a las 00:01.
 *  2. **En el hueco entre dos períodos** —vacaciones, semana de recuperaciones— caía al «primer
 *     ABIERTO». Como muchos colegios nunca finalizan los períodos, ese primero es el Período 1:
 *     el aula te mandaba a febrero estando en septiembre.
 *  3. **La hora del servidor no es la del colegio.** Railway corre en UTC; entre las 19:00 y la
 *     medianoche de Colombia, el servidor ya cree que es el día siguiente, y el día en que
 *     arranca o termina un período se movía.
 *
 * Ahora: manda el período cuyo rango contiene HOY —el día completo, en hora de Colombia—; si hoy
 * cae en un hueco, manda el último que ya empezó, que es donde el colegio está trabajando; y si
 * el colegio no puso fechas, se cae al orden de siempre.
 */

const COLOMBIA = 'America/Bogota';

export interface PeriodoConFechas {
  order?: number | null;
  status?: string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
}

/** El día de calendario de Colombia, como "2026-09-23". */
export function diaEnColombia(momento: Date = new Date()): string {
  return momento.toLocaleDateString('sv-SE', { timeZone: COLOMBIA });
}

/**
 * El día que representa una fecha académica, como "2026-09-19".
 *
 * Se lee en UTC a propósito: estas fechas se guardan a medianoche UTC representando un día de
 * pared ("el período termina el 19"). Leerlas en hora de Colombia las correría un día atrás.
 */
function diaDe(fecha: Date | string | null | undefined): string | null {
  if (!fecha) return null;
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function porOrden<T extends PeriodoConFechas>(periodos: T[]): T[] {
  return [...periodos].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * El período vigente, o `null` si no hay ninguno.
 *
 * `ahora` se puede fijar para probar; por defecto es el momento real.
 */
export function periodoVigente<T extends PeriodoConFechas>(periodos: T[], ahora: Date = new Date()): T | null {
  if (!periodos?.length) return null;
  const lista = porOrden(periodos);
  const hoy = diaEnColombia(ahora);

  const conFechas = lista.filter((p) => diaDe(p.startDate) && diaDe(p.endDate));

  // 1. El que contiene hoy. Los dos extremos entran: el día en que empieza y el día en que
  //    termina son días de clase.
  const enCurso = conFechas.find((p) => diaDe(p.startDate)! <= hoy && hoy <= diaDe(p.endDate)!);
  if (enCurso) return enCurso;

  // 2. En un hueco entre períodos, manda el último que YA empezó: en la semana de vacaciones
  //    entre el tercero y el cuarto, el colegio sigue cerrando notas del tercero.
  const yaEmpezados = conFechas.filter((p) => diaDe(p.startDate)! <= hoy);
  if (yaEmpezados.length) return yaEmpezados[yaEmpezados.length - 1];

  // 3. Antes de que empiece el año, el primero que vendrá.
  if (conFechas.length) return conFechas[0];

  // 4. Sin fechas no hay nada que deducir: el primero abierto, y si ninguno lo está, el primero.
  return lista.find((p) => p.status === 'OPEN') ?? lista[0];
}
