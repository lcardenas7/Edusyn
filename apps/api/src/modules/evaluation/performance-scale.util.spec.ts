import { resolveScaleLevel } from './performance-scale.util';

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
