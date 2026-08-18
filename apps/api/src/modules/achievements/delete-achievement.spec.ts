import { ConflictException } from '@nestjs/common';
import { AchievementService } from './achievement.service';

/**
 * F2 · Guarda funcional de `deleteAchievement`.
 *
 * La FK `StudentEvidenceValuation_achievementEvidenceId_fkey` (ON DELETE RESTRICT)
 * ya impide en la base de datos que borrar un propósito arrastre, por cascada, un
 * imprescindible con valoraciones. Pero lo hace con un `23503` crudo de PostgreSQL,
 * que el usuario ve como error 500.
 *
 * Estas pruebas caracterizan primero ese comportamiento y luego exigen que el
 * conflicto se detecte ANTES de llegar a la base de datos, como error de negocio.
 *
 * La FK NO se toca: sigue siendo la última barrera de integridad.
 */

/** Error tal como lo emite Prisma ante una violación de clave foránea (23503). */
function fkViolation() {
  const e: any = new Error(
    'Foreign key constraint failed on the field: ' +
    '`StudentEvidenceValuation_achievementEvidenceId_fkey (index)`',
  );
  e.code = 'P2003';
  e.meta = { field_name: 'StudentEvidenceValuation_achievementEvidenceId_fkey (index)' };
  e.clientVersion = '5.22.0';
  e.name = 'PrismaClientKnownRequestError';
  return e;
}

type Escenario = {
  /** Imprescindibles del propósito. */
  evidences?: { id: string; text: string }[];
  /** Ids de imprescindibles que TIENEN valoraciones de estudiantes. */
  valued?: string[];
};

function makeService(esc: Escenario = {}) {
  const evidences = esc.evidences ?? [];
  const valued = new Set(esc.valued ?? []);

  const achievementDelete = jest.fn(async ({ where }: any) => {
    // La base de datos cascadea a AchievementEvidence; si alguna está referenciada
    // por StudentEvidenceValuation, la FK RESTRICT aborta la operación completa.
    if (evidences.some((e) => valued.has(e.id))) throw fkViolation();
    return { id: where.id };
  });

  const evidenceFindMany = jest.fn(async () => evidences);
  const valuationFindMany = jest.fn(async ({ where }: any) => {
    const ids: string[] = where?.achievementEvidenceId?.in ?? [];
    // Dos valoraciones por evidencia valorada: permite comprobar que el mensaje cuenta.
    return ids.filter((id) => valued.has(id)).flatMap((id) => [
      { achievementEvidenceId: id },
      { achievementEvidenceId: id },
    ]);
  });

  const prisma: any = {
    achievement: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'ach-1',
        baseDescription: 'Reconoce y expresa sus emociones',
        gradeId: 'grade-1',
        teacherAssignmentId: null,
      }),
      delete: achievementDelete,
    },
    achievementEvidence: { findMany: evidenceFindMany },
    studentEvidenceValuation: { findMany: valuationFindMany },
    // Sin historia académica ni contenido actitudinal en estos escenarios: aquí se
    // prueba la guarda de valoraciones por imprescindible. Las otras dos tienen
    // spec propia.
    studentAchievement: { count: jest.fn().mockResolvedValue(0) },
    attitudinalAchievement: { count: jest.fn().mockResolvedValue(0) },
  };

  const service = new AchievementService(prisma);
  return { service, prisma, achievementDelete, evidenceFindMany, valuationFindMany };
}

const EV = (id: string, text: string) => ({ id, text });

describe('deleteAchievement — guarda de valoraciones (F2)', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // CASO A · propósito sin imprescindibles
  // ═══════════════════════════════════════════════════════════════════════════
  describe('CASO A · sin imprescindibles', () => {
    it('el borrado continúa', async () => {
      const { service, achievementDelete } = makeService({ evidences: [] });
      await expect(service.deleteAchievement('ach-1')).resolves.toEqual({ id: 'ach-1' });
      expect(achievementDelete).toHaveBeenCalledWith({ where: { id: 'ach-1' } });
    });

    it('no consulta valoraciones si no hay imprescindibles que proteger', async () => {
      const { service, valuationFindMany } = makeService({ evidences: [] });
      await service.deleteAchievement('ach-1');
      expect(valuationFindMany).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CASO B · con imprescindibles, ninguno valorado
  // ═══════════════════════════════════════════════════════════════════════════
  describe('CASO B · con imprescindibles, ninguna valoración', () => {
    it('el borrado continúa', async () => {
      const { service, achievementDelete } = makeService({
        evidences: [EV('ev-1', 'Nombra sus emociones'), EV('ev-2', 'Pide ayuda cuando la necesita')],
        valued: [],
      });
      await expect(service.deleteAchievement('ach-1')).resolves.toEqual({ id: 'ach-1' });
      expect(achievementDelete).toHaveBeenCalledTimes(1);
    });

    it('la cascada de la base de datos se lleva los imprescindibles sin oposición', async () => {
      const { service, achievementDelete } = makeService({
        evidences: [EV('ev-1', 'Nombra sus emociones')],
        valued: [],
      });
      await expect(service.deleteAchievement('ach-1')).resolves.toBeDefined();
      expect(achievementDelete).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CASO C · al menos un imprescindible valorado
  // ═══════════════════════════════════════════════════════════════════════════
  describe('CASO C · un imprescindible con valoraciones', () => {
    const escenario = () => makeService({
      evidences: [EV('ev-1', 'Nombra sus emociones')],
      valued: ['ev-1'],
    });

    it('lanza ConflictException, no el 23503 crudo de PostgreSQL', async () => {
      const { service } = escenario();
      await expect(service.deleteAchievement('ach-1')).rejects.toBeInstanceOf(ConflictException);
    });

    it('NO intenta el DELETE: el conflicto se detecta antes de tocar la base', async () => {
      const { service, achievementDelete } = escenario();
      await expect(service.deleteAchievement('ach-1')).rejects.toThrow(ConflictException);
      expect(achievementDelete).not.toHaveBeenCalled();
    });

    it('el mensaje nombra el imprescindible y cuenta sus valoraciones', async () => {
      const { service } = escenario();
      await expect(service.deleteAchievement('ach-1')).rejects.toThrow(/Nombra sus emociones/);
      await expect(service.deleteAchievement('ach-1')).rejects.toThrow(/2 valoración/);
    });

    it('el mensaje distingue este conflicto de otros: habla del propósito completo', async () => {
      const { service } = escenario();
      await expect(service.deleteAchievement('ach-1')).rejects.toThrow(/propósito/i);
    });

    it('el error no arrastra jerga de base de datos', async () => {
      const { service } = escenario();
      await expect(service.deleteAchievement('ach-1')).rejects.not.toThrow(/P2003|23503|constraint/i);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CASO D · varios imprescindibles, sólo uno valorado
  // ═══════════════════════════════════════════════════════════════════════════
  describe('CASO D · varios imprescindibles, sólo uno valorado', () => {
    const escenario = () => makeService({
      evidences: [
        EV('ev-1', 'Nombra sus emociones'),
        EV('ev-2', 'Pide ayuda cuando la necesita'),
        EV('ev-3', 'Respeta el turno de la palabra'),
      ],
      valued: ['ev-2'],
    });

    it('el propósito entero queda protegido', async () => {
      const { service } = escenario();
      await expect(service.deleteAchievement('ach-1')).rejects.toBeInstanceOf(ConflictException);
    });

    it('NO se intenta ningún borrado, ni total ni parcial', async () => {
      const { service, achievementDelete, prisma } = escenario();
      await expect(service.deleteAchievement('ach-1')).rejects.toThrow(ConflictException);
      expect(achievementDelete).not.toHaveBeenCalled();
      // No existe ninguna vía de borrado granular de evidencias en este método:
      // si apareciera, este mock inexistente haría estallar la prueba.
      expect(prisma.achievementEvidence.delete).toBeUndefined();
      expect(prisma.achievementEvidence.deleteMany).toBeUndefined();
    });

    it('el mensaje nombra SÓLO el imprescindible valorado', async () => {
      const { service } = escenario();
      await expect(service.deleteAchievement('ach-1')).rejects.toThrow(/Pide ayuda cuando la necesita/);
      await expect(service.deleteAchievement('ach-1')).rejects.not.toThrow(/Nombra sus emociones/);
      await expect(service.deleteAchievement('ach-1')).rejects.not.toThrow(/Respeta el turno/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LA FK SIGUE SIENDO LA ÚLTIMA BARRERA
  // ═══════════════════════════════════════════════════════════════════════════
  describe('la FK permanece como red de seguridad', () => {
    it('si la guarda no viera la valoración, la base de datos seguiría rechazando', async () => {
      // La guarda no encuentra valoraciones (findMany vacío) pero la base sí las tiene:
      // simula una condición de carrera o una consulta desalineada.
      const { service, prisma } = makeService({
        evidences: [EV('ev-1', 'Nombra sus emociones')],
        valued: ['ev-1'],
      });
      prisma.studentEvidenceValuation.findMany = jest.fn().mockResolvedValue([]);

      const err: any = await service.deleteAchievement('ach-1').catch((e) => e);
      expect(err.code).toBe('P2003');
      expect(err).not.toBeInstanceOf(ConflictException);
    });
  });
});
