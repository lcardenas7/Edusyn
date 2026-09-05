import { readFileSync } from 'fs';
import { join } from 'path';

import { PeriodFinalGradeWriter } from './period-final-grade.writer';

/**
 * G-1 · La nota final de período tiene una sola puerta.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Cerrar la captura manual no bastaba: la misma nota podía alterarse desde el
 * recálculo, la importación masiva y las recuperaciones, y ninguna de esas tres
 * dejaba rastro. Estas pruebas fijan dos cosas:
 *
 *  1. El adaptador audita SIEMPRE, distinguiendo el origen y sin inventar un
 *     actor humano donde no lo hay.
 *  2. Nadie escribe la tabla por su cuenta. Esta última se comprueba sobre el
 *     código fuente, porque es una regla del módulo y no de una función: una
 *     prueba de comportamiento no puede impedir que mañana alguien abra otra
 *     ventana.
 */
describe('G-1 · puerta única de la nota final de período', () => {
  const CLAVE = { studentEnrollmentId: 'enr-1', academicTermId: 't1', subjectId: 's1' };

  const prismaCon = (previa: any) => ({
    periodFinalGrade: {
      findUnique: jest.fn().mockResolvedValue(previa),
      upsert: jest.fn().mockResolvedValue({ id: 'pfg-1' }),
      update: jest.fn().mockResolvedValue({ id: 'pfg-1' }),
      delete: jest.fn().mockResolvedValue({ id: 'pfg-1' }),
    },
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 1. Cada origen deja su propia huella
  // ═══════════════════════════════════════════════════════════════════════

  describe('el evento distingue de dónde viene el cambio', () => {
    it.each([
      ['MANUAL', 'PERIOD_FINAL_GRADE'],
      ['RECALCULO', 'PERIOD_FINAL_GRADE_RECALC'],
      ['IMPORTACION', 'PERIOD_FINAL_GRADE_IMPORT'],
      ['RECUPERACION', 'PERIOD_FINAL_GRADE_RECOVERY'],
    ])('origen %s se registra como %s', async (origen, fuente) => {
      const prisma: any = prismaCon(null);
      const audit = { record: jest.fn() };
      const writer = new PeriodFinalGradeWriter(prisma, audit as any);

      await writer.upsert({
        clave: CLAVE,
        institutionId: 'inst-1',
        finalScore: 4,
        isManualOverride: false,
        contexto: { origen: origen as any },
      });

      expect(audit.record.mock.calls[0][0]).toMatchObject({ source: fuente, action: 'CREATE' });
    });

    it('una escritura sin persona detrás se atribuye al sistema, no a nadie', async () => {
      const prisma: any = prismaCon(null);
      const audit = { record: jest.fn() };
      const writer = new PeriodFinalGradeWriter(prisma, audit as any);

      await writer.upsert({
        clave: CLAVE,
        institutionId: 'inst-1',
        finalScore: 4,
        isManualOverride: false,
        contexto: { origen: 'RECALCULO' },
      });

      expect(audit.record.mock.calls[0][1]).toEqual({ role: 'SISTEMA' });
    });

    it('el recálculo correlaciona con la operación que lo desencadenó', async () => {
      const prisma: any = prismaCon({ id: 'pfg-1', finalScore: 3, institutionId: 'inst-1' });
      const audit = { record: jest.fn() };
      const writer = new PeriodFinalGradeWriter(prisma, audit as any);

      await writer.upsert({
        clave: CLAVE,
        institutionId: 'inst-1',
        finalScore: 4,
        isManualOverride: false,
        contexto: { origen: 'RECALCULO', batchId: 'lote-7' },
      });

      expect(audit.record.mock.calls[0][0]).toMatchObject({
        batchId: 'lote-7',
        previousScore: 3,
        newScore: 4,
        action: 'UPDATE',
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 2. Sin cambio no hay evento
  // ═══════════════════════════════════════════════════════════════════════

  it('recalcular sin que la nota se mueva no genera ruido en el registro', async () => {
    const prisma: any = prismaCon({ id: 'pfg-1', finalScore: 4, institutionId: 'inst-1' });
    const audit = { record: jest.fn() };
    const writer = new PeriodFinalGradeWriter(prisma, audit as any);

    await writer.upsert({
      clave: CLAVE,
      institutionId: 'inst-1',
      finalScore: 4,
      isManualOverride: false,
      contexto: { origen: 'RECALCULO' },
    });

    expect(prisma.periodFinalGrade.upsert).toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('fijar el mismo valor que ya había no escribe ni audita', async () => {
    const prisma: any = prismaCon({ id: 'pfg-1', finalScore: 4.5, institutionId: 'inst-1' });
    const audit = { record: jest.fn() };
    const writer = new PeriodFinalGradeWriter(prisma, audit as any);

    const n = await writer.fijarValor(CLAVE, 4.5, { origen: 'RECUPERACION' });

    expect(n).toBe(0);
    expect(prisma.periodFinalGrade.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 3. Borrados y propagaciones también dejan rastro
  // ═══════════════════════════════════════════════════════════════════════

  it('el borrado por recálculo conserva el valor que existía', async () => {
    const prisma: any = prismaCon({ id: 'pfg-1', finalScore: 2.8, institutionId: 'inst-1' });
    const audit = { record: jest.fn() };
    const writer = new PeriodFinalGradeWriter(prisma, audit as any);

    await writer.eliminar(CLAVE, { origen: 'RECALCULO', batchId: 'lote-9' });

    expect(prisma.periodFinalGrade.delete).toHaveBeenCalled();
    expect(audit.record.mock.calls[0][0]).toMatchObject({
      source: 'PERIOD_FINAL_GRADE_RECALC',
      action: 'DELETE',
      previousScore: 2.8,
      newScore: null,
      batchId: 'lote-9',
    });
  });

  it('borrar lo que no existe no escribe ni audita', async () => {
    const prisma: any = prismaCon(null);
    const audit = { record: jest.fn() };
    const writer = new PeriodFinalGradeWriter(prisma, audit as any);

    expect(await writer.eliminar(CLAVE, { origen: 'RECALCULO' })).toBe(0);
    expect(prisma.periodFinalGrade.delete).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('la propagación de una recuperación registra su causal', async () => {
    const prisma: any = prismaCon({ id: 'pfg-1', finalScore: 2, institutionId: 'inst-1' });
    const audit = { record: jest.fn() };
    const writer = new PeriodFinalGradeWriter(prisma, audit as any);

    await writer.fijarValor(CLAVE, 3, {
      origen: 'RECUPERACION',
      causal: 'RECUPERACION_NIVELACION',
    });

    expect(audit.record.mock.calls[0][0]).toMatchObject({
      source: 'PERIOD_FINAL_GRADE_RECOVERY',
      reason: 'RECUPERACION_NIVELACION',
      previousScore: 2,
      newScore: 3,
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 4. La regla del módulo, comprobada sobre el código
  // ═══════════════════════════════════════════════════════════════════════

  describe('nadie escribe la tabla fuera del adaptador', () => {
    const RAIZ = join(__dirname, '..', '..');
    /**
     * Excepción única y deliberada: el borrado de una institución entera elimina
     * también su registro de auditoría, de modo que auditar fila por fila lo que
     * se está purgando no dejaría nada que leer.
     */
    const EXCEPCIONES = ['modules/superadmin/superadmin.service.ts'];

    const ficherosDeCodigo = (dir: string): string[] => {
      const { readdirSync, statSync } = require('fs');
      return readdirSync(dir).flatMap((n: string) => {
        const ruta = join(dir, n);
        if (statSync(ruta).isDirectory()) return ficherosDeCodigo(ruta);
        return n.endsWith('.ts') && !n.endsWith('.spec.ts') ? [ruta] : [];
      });
    };

    it('ninguna escritura directa a periodFinalGrade fuera de la puerta única', () => {
      const escritura = /periodFinalGrade\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/;
      const infractores = ficherosDeCodigo(RAIZ)
        .filter((f) => !f.endsWith('period-final-grade.writer.ts'))
        .filter((f) => !EXCEPCIONES.some((e) => f.replace(/\\/g, '/').endsWith(e)))
        .filter((f) => escritura.test(readFileSync(f, 'utf8')))
        .map((f) => f.replace(/\\/g, '/').split('/src/')[1]);

      expect(infractores).toEqual([]);
    });
  });
});
