import { ConflictException } from '@nestjs/common';
import { AchievementService } from './achievement.service';

/**
 * F2 · Guarda de contenido actitudinal en `deleteAchievement`.
 *
 * `AttitudinalAchievement.achievementId` es nullable y tiene `ON DELETE CASCADE`:
 * borrar un propósito arrastra el texto actitudinal que el docente redactó para esa
 * asignación y período. No es historia por estudiante —no lleva
 * `studentEnrollmentId`— pero sí es contenido de un docente que llega al boletín, y
 * la base de datos no opone ninguna resistencia.
 *
 * El comportamiento anterior quedó caracterizado en `achievement-retirement-audit.spec.ts`,
 * cuyas pruebas `[DEFECTO CONGELADO]` pasaban en verde demostrando la desprotección.
 */

function makeService(opts: {
  studentAchievements?: number;
  attitudinal?: number;
  evidences?: { id: string; text: string }[];
  valuedEvidenceIds?: string[];
} = {}) {
  const evidences = opts.evidences ?? [];
  const valued = new Set(opts.valuedEvidenceIds ?? []);

  const store = {
    studentAchievements: opts.studentAchievements ?? 0,
    attitudinal: Array.from({ length: opts.attitudinal ?? 0 }, (_, i) => ({
      id: `aa-${i + 1}`,
      description: `Demuestra respeto por sus compañeros (${i + 1})`,
    })),
    evidences: [...evidences],
  };

  const achievementDelete = jest.fn(async ({ where }: any) => {
    store.attitudinal = [];
    store.evidences = [];
    store.studentAchievements = 0;
    return { id: where.id };
  });

  const attitudinalCount = jest.fn(async () => store.attitudinal.length);
  const studentAchievementCount = jest.fn(async () => store.studentAchievements);
  const valuationFindMany = jest.fn(async ({ where }: any) => {
    const ids: string[] = where?.achievementEvidenceId?.in ?? [];
    return ids.filter((id) => valued.has(id)).map((id) => ({ achievementEvidenceId: id }));
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
    achievementEvidence: { findMany: jest.fn(async () => store.evidences) },
    studentEvidenceValuation: { findMany: valuationFindMany },
    studentAchievement: { count: studentAchievementCount },
    attitudinalAchievement: { count: attitudinalCount },
  };

  return {
    service: new AchievementService(prisma),
    prisma, store, achievementDelete,
    attitudinalCount, studentAchievementCount, valuationFindMany,
  };
}

const EV = (id: string, text: string) => ({ id, text });

describe('deleteAchievement — guarda de contenido actitudinal (F2)', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // A · limpio por las tres vías
  // ═══════════════════════════════════════════════════════════════════════════
  describe('A · sin historia, sin valoraciones y sin contenido actitudinal', () => {
    it('se puede eliminar', async () => {
      const { service, achievementDelete } = makeService();
      await expect(service.deleteAchievement('ach-1')).resolves.toEqual({ id: 'ach-1' });
      expect(achievementDelete).toHaveBeenCalledWith({ where: { id: 'ach-1' } });
    });

    it('las tres guardas se consultan antes de borrar', async () => {
      const { service, studentAchievementCount, valuationFindMany, attitudinalCount, prisma } = makeService({
        evidences: [EV('ev-1', 'Nombra sus emociones')],
      });
      await service.deleteAchievement('ach-1');
      expect(studentAchievementCount).toHaveBeenCalledWith({ where: { achievementId: 'ach-1' } });
      expect(prisma.achievementEvidence.findMany).toHaveBeenCalled();
      expect(valuationFindMany).toHaveBeenCalled();
      expect(attitudinalCount).toHaveBeenCalledWith({ where: { achievementId: 'ach-1' } });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // B · con contenido actitudinal
  // ═══════════════════════════════════════════════════════════════════════════
  describe('B · propósito con AttitudinalAchievement', () => {
    it('lanza ConflictException', async () => {
      const { service } = makeService({ attitudinal: 1 });
      await expect(service.deleteAchievement('ach-1')).rejects.toBeInstanceOf(ConflictException);
    });

    it('el mensaje nombra el propósito y explica qué se perdería', async () => {
      const { service } = makeService({ attitudinal: 1 });
      await expect(service.deleteAchievement('ach-1')).rejects.toThrow(/Reconoce y expresa sus emociones/);
      await expect(service.deleteAchievement('ach-1')).rejects.toThrow(/contenido actitudinal/i);
      await expect(service.deleteAchievement('ach-1')).rejects.toThrow(/texto redactado por el docente/i);
      await expect(service.deleteAchievement('ach-1')).rejects.toThrow(/Edite su texto/i);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // C · varios registros: conteo correcto
  // ═══════════════════════════════════════════════════════════════════════════
  describe('C · varios AttitudinalAchievement', () => {
    it('el mensaje informa el número exacto', async () => {
      const { service } = makeService({ attitudinal: 4 });
      await expect(service.deleteAchievement('ach-1')).rejects.toThrow(/4 registro\(s\) de contenido actitudinal/);
    });

    it('con uno solo, el conteo también es correcto', async () => {
      const { service } = makeService({ attitudinal: 1 });
      await expect(service.deleteAchievement('ach-1')).rejects.toThrow(/1 registro\(s\) de contenido actitudinal/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // D · orden de las guardas
  // ═══════════════════════════════════════════════════════════════════════════
  describe('D · historia académica Y contenido actitudinal', () => {
    it('se detiene por StudentAchievement, que va primero', async () => {
      const { service } = makeService({ studentAchievements: 3, attitudinal: 2 });
      await expect(service.deleteAchievement('ach-1')).rejects.toThrow(/historia académica/);
    });

    it('AttitudinalAchievement NO llega a consultarse', async () => {
      const { service, attitudinalCount } = makeService({ studentAchievements: 3, attitudinal: 2 });
      await expect(service.deleteAchievement('ach-1')).rejects.toThrow(ConflictException);
      expect(attitudinalCount).not.toHaveBeenCalled();
    });

    it('la guarda de valoraciones también precede a la actitudinal', async () => {
      const { service, attitudinalCount } = makeService({
        attitudinal: 2,
        evidences: [EV('ev-1', 'Nombra sus emociones')],
        valuedEvidenceIds: ['ev-1'],
      });
      await expect(service.deleteAchievement('ach-1')).rejects.toThrow(/imprescindibles/);
      expect(attitudinalCount).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // E · las guardas anteriores no cambian
  // ═══════════════════════════════════════════════════════════════════════════
  describe('E · no hay regresión en las guardas existentes', () => {
    it('con valoraciones y sin actitudinal, el mensaje es el de siempre', async () => {
      const { service, achievementDelete } = makeService({
        evidences: [EV('ev-1', 'Nombra sus emociones')],
        valuedEvidenceIds: ['ev-1'],
      });
      await expect(service.deleteAchievement('ach-1')).rejects.toThrow(
        /No se puede eliminar este propósito: «Nombra sus emociones» \(1 valoración\(es\)\)/,
      );
      expect(achievementDelete).not.toHaveBeenCalled();
    });

    it('con historia académica y sin actitudinal, el mensaje es el de siempre', async () => {
      const { service } = makeService({ studentAchievements: 7 });
      await expect(service.deleteAchievement('ach-1')).rejects.toThrow(
        /tiene 7 registro\(s\) de historia académica/,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F/G · ninguna operación destructiva
  // ═══════════════════════════════════════════════════════════════════════════
  describe('F/G · nada se borra cuando existe contenido actitudinal', () => {
    it('achievement.delete NO se ejecuta', async () => {
      const { service, achievementDelete } = makeService({ attitudinal: 2 });
      await expect(service.deleteAchievement('ach-1')).rejects.toThrow(ConflictException);
      expect(achievementDelete).not.toHaveBeenCalled();
    });

    it('el contenido actitudinal y los imprescindibles quedan intactos', async () => {
      const { service, store } = makeService({
        attitudinal: 2,
        evidences: [EV('ev-1', 'Nombra sus emociones'), EV('ev-2', 'Pide ayuda')],
      });
      await expect(service.deleteAchievement('ach-1')).rejects.toThrow(ConflictException);
      expect(store.attitudinal).toHaveLength(2);
      expect(store.evidences).toHaveLength(2);
    });

    it('no existe ninguna vía de borrado parcial en este método', async () => {
      const { service, prisma } = makeService({ attitudinal: 2 });
      await expect(service.deleteAchievement('ach-1')).rejects.toThrow(ConflictException);
      expect(prisma.attitudinalAchievement.delete).toBeUndefined();
      expect(prisma.attitudinalAchievement.deleteMany).toBeUndefined();
      expect(prisma.achievementEvidence.delete).toBeUndefined();
      expect(prisma.achievementEvidence.deleteMany).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // H · higiene del mensaje
  // ═══════════════════════════════════════════════════════════════════════════
  describe('H · el mensaje no filtra jerga de base de datos', () => {
    it('sin P2003, 23503, constraint, foreign key ni nombres de tabla', async () => {
      const { service } = makeService({ attitudinal: 3 });
      const err: any = await service.deleteAchievement('ach-1').catch((e) => e);
      const msg = String(err.message);
      expect(msg).not.toMatch(/P2003|23503|constraint|foreign key/i);
      expect(msg).not.toMatch(/AttitudinalAchievement|StudentAchievement|AchievementEvidence|StudentEvidenceValuation/);
    });
  });
});
