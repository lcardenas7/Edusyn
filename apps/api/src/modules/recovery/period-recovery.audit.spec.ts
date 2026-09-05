import { readFileSync } from 'fs';
import { join } from 'path';

import { PeriodFinalGradeWriter } from '../evaluation/period-final-grade.writer';

/**
 * H-1 · Una recuperación siempre la inicia una persona.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * G-1 encaminó las recuperaciones por la puerta única, pero el actor humano no
 * llegaba hasta ella: el evento quedaba atribuido al sistema. Eso incumplía la
 * condición que sostiene todo este frente —que quede registro claro de quién
 * cambia una nota— porque decía «lo hizo el sistema» de algo que hizo alguien.
 *
 * Estas pruebas fijan que el actor, su rol, la institución de la sesión y la
 * correlación con el expediente llegan hasta el registro.
 */
describe('H-1 · el rastro de una recuperación identifica a quien la hizo', () => {
  const CLAVE = { studentEnrollmentId: 'enr-1', academicTermId: 't1', subjectId: 's1' };
  const COORDINACION = { userId: 'u-7', name: 'quien-aprueba', role: 'COORDINADOR' };

  const prismaCon = (previa: any) => ({
    periodFinalGrade: {
      findUnique: jest.fn().mockResolvedValue(previa),
      update: jest.fn().mockResolvedValue({ id: 'pfg-1' }),
    },
  });

  it('el evento lleva la persona y el rol con el que actuó, no al sistema', async () => {
    const prisma: any = prismaCon({ id: 'pfg-1', finalScore: 2.4, institutionId: 'inst-1' });
    const audit = { record: jest.fn() };
    const writer = new PeriodFinalGradeWriter(prisma, audit as any);

    await writer.fijarValor(
      CLAVE,
      3,
      {
        origen: 'RECUPERACION',
        causal: 'RECUPERACION_NIVELACION',
        batchId: 'rec-42',
        actor: COORDINACION,
      },
      'inst-1',
    );

    const [evento, actor] = audit.record.mock.calls[0];
    expect(actor).toEqual(COORDINACION);
    expect(actor).not.toEqual({ role: 'SISTEMA' });
    expect(evento).toMatchObject({
      source: 'PERIOD_FINAL_GRADE_RECOVERY',
      reason: 'RECUPERACION_NIVELACION',
      previousScore: 2.4,
      newScore: 3,
    });
  });

  it('la correlación apunta al expediente de recuperación que explica el cambio', async () => {
    const prisma: any = prismaCon({ id: 'pfg-1', finalScore: 2, institutionId: 'inst-1' });
    const audit = { record: jest.fn() };
    const writer = new PeriodFinalGradeWriter(prisma, audit as any);

    await writer.fijarValor(
      CLAVE,
      3.5,
      { origen: 'RECUPERACION', batchId: 'rec-42', actor: COORDINACION },
      'inst-1',
    );

    expect(audit.record.mock.calls[0][0].batchId).toBe('rec-42');
  });

  it('una nota de otra institución no se toca aunque su coordenada coincida', async () => {
    const prisma: any = prismaCon({ id: 'pfg-1', finalScore: 2, institutionId: 'inst-2' });
    const audit = { record: jest.fn() };
    const writer = new PeriodFinalGradeWriter(prisma, audit as any);

    const n = await writer.fijarValor(
      CLAVE,
      5,
      { origen: 'RECUPERACION', actor: COORDINACION },
      'inst-1',
    );

    expect(n).toBe(0);
    expect(prisma.periodFinalGrade.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // El cableado, comprobado sobre el código: sin él, lo anterior no sirve
  // ═══════════════════════════════════════════════════════════════════════

  describe('el actor llega desde el controlador hasta la propagación', () => {
    const leer = (rel: string) => readFileSync(join(__dirname, rel), 'utf8');

    it('las dos rutas que cambian la nota final propagan el actor de la sesión', () => {
      const controlador = leer('period-recovery.controller.ts');
      const llamadas = controlador.match(/actorFromRequest\(req\)/g) ?? [];
      expect(llamadas).toHaveLength(2);
      expect(controlador).toContain('registerResult');
      expect(controlador).toContain('reviewResult');
    });

    it('ambas rutas derivan la institución de la sesión, no del cuerpo', () => {
      const controlador = leer('period-recovery.controller.ts');
      const resoluciones = controlador.match(/requireInstitutionId\(/g) ?? [];
      expect(resoluciones.length).toBeGreaterThanOrEqual(2);
    });

    it('el servicio no vuelve a atribuir la propagación al sistema', () => {
      const servicio = leer('period-recovery.service.ts');
      // La firma debe exigir actor e institución explícitos.
      expect(servicio).toMatch(/actor: GradeAuditActor \| undefined,\s*institutionId: string,/);
      // Y ya no debe quedar el aviso de que el actor no llegaba.
      expect(servicio).not.toContain('TODO(G-1)');
    });
  });
});
