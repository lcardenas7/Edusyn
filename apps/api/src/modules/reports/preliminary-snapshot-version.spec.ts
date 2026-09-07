import { ReportsService } from './reports.service';

/**
 * Numeración de los congelados PRELIMINARY.
 *
 * Lo que se protege aquí es la condición que puso el rector: **un congelado de trabajo no puede
 * confundirse con el cierre oficial**. En este modelo eso se traduce en algo muy concreto —
 * un preliminar no debe poder desplazar la numeración de los cierres.
 *
 * El riesgo real, y por qué existen estas pruebas: la versión oficial se calcula como
 * `MAX(version) + 1`. Si los preliminares compartieran esa cuenta y se creara uno antes del
 * primer cierre, `MAX` sería −1 y el cierre oficial nacería con **versión 0**.
 */
describe('Congelado PRELIMINARY · numeración', () => {
  const servicioCon = (min: number | null, max: number | null = null) => {
    const aggregate = jest.fn().mockImplementation(({ where }: any) =>
      where?.snapshotType === 'PRELIMINARY'
        ? Promise.resolve({ _min: { version: min } })
        : Promise.resolve({ _max: { version: max } }),
    );
    const prisma = { termReportCardSnapshot: { aggregate } } as any;
    const s = Object.create(ReportsService.prototype) as ReportsService;
    (s as any).prisma = prisma;
    return { servicio: s, aggregate };
  };

  it('el primer preliminar de un período es la versión −1', async () => {
    const { servicio } = servicioCon(null);
    await expect(servicio.preliminaryVersionFor('term-1')).resolves.toBe(-1);
  });

  it('cada preliminar siguiente baja un número', async () => {
    await expect(servicioCon(-1).servicio.preliminaryVersionFor('t')).resolves.toBe(-2);
    await expect(servicioCon(-7).servicio.preliminaryVersionFor('t')).resolves.toBe(-8);
  });

  it('convive con cierres oficiales ya existentes sin tocar su numeración', async () => {
    // Hay tres cierres oficiales (1, 2, 3) y ningún preliminar todavía.
    const { servicio } = servicioCon(null, 3);
    await expect(servicio.preliminaryVersionFor('t')).resolves.toBe(-1);
  });

  it('nunca devuelve un número positivo, ni aunque la consulta traiga basura', async () => {
    // Defensa: si por lo que sea `_min` viniera positivo, seguir restando produciría colisión
    // con la secuencia oficial. Se fuerza a arrancar de nuevo en −1.
    const { servicio } = servicioCon(5);
    const v = await servicio.preliminaryVersionFor('t');
    expect(v).toBe(-1);
    expect(v).toBeLessThan(0);
  });

  it('consulta SOLO los preliminares del período, no todos los snapshots', async () => {
    const { servicio, aggregate } = servicioCon(-2);
    await servicio.preliminaryVersionFor('term-42');

    expect(aggregate).toHaveBeenCalledWith({
      where: { academicTermId: 'term-42', snapshotType: 'PRELIMINARY' },
      _min: { version: true },
    });
  });

  it('usa MIN y no un conteo: borrar una fila no debe reutilizar un número', async () => {
    // Con un conteo, tras borrar el −2 de {−1, −2} el siguiente volvería a ser −2 y chocaría
    // con el índice único (academicTermId, studentEnrollmentId, version).
    const { servicio, aggregate } = servicioCon(-3);
    await servicio.preliminaryVersionFor('t');

    expect(aggregate.mock.calls[0][0]).toHaveProperty('_min');
    expect(aggregate.mock.calls[0][0]).not.toHaveProperty('_count');
  });
});
