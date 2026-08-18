import { ConflictException } from '@nestjs/common';
import { AchievementService } from './achievement.service';

/**
 * F2 · Guarda de historia académica en `deleteAchievement`.
 *
 * `StudentAchievement.achievementId` tiene `ON DELETE CASCADE` y **ninguna guarda**:
 * borrar un propósito arrastra en silencio los juicios valorativos por estudiante
 * (nivel de desempeño, texto aprobado, juicio aprobado, observación del docente).
 * A diferencia de las valoraciones por imprescindible, aquí la base de datos **no**
 * opone resistencia: no hay un `RESTRICT` que rescate al usuario.
 *
 * Estas pruebas caracterizan primero esa destrucción y luego exigen que el propósito
 * quede protegido antes de cualquier operación destructiva.
 */

/** Base de datos simulada: el DELETE cascadea igual que en PostgreSQL. */
function makeService(opts: {
  studentAchievements?: number;
  evidences?: { id: string; text: string }[];
  valuedEvidenceIds?: string[];
} = {}) {
  const evidences = opts.evidences ?? [];
  const valued = new Set(opts.valuedEvidenceIds ?? []);

  // Almacén observable: permite comprobar qué se destruyó de verdad.
  const store = {
    studentAchievements: Array.from({ length: opts.studentAchievements ?? 0 }, (_, i) => ({
      id: `sa-${i + 1}`,
      achievementId: 'ach-1',
    })),
    evidences: [...evidences],
  };

  const achievementDelete = jest.fn(async ({ where }: any) => {
    // ON DELETE CASCADE: StudentAchievement y AchievementEvidence caen con el padre.
    store.studentAchievements = store.studentAchievements.filter((s) => s.achievementId !== where.id);
    store.evidences = [];
    return { id: where.id };
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
    achievementEvidence: {
      findMany: jest.fn(async () => store.evidences),
    },
    studentEvidenceValuation: {
      findMany: jest.fn(async ({ where }: any) => {
        const ids: string[] = where?.achievementEvidenceId?.in ?? [];
        return ids.filter((id) => valued.has(id)).map((id) => ({ achievementEvidenceId: id }));
      }),
    },
    studentAchievement: {
      count: jest.fn(async () => store.studentAchievements.length),
    },
    // Sin contenido actitudinal en estos escenarios: tiene spec propia.
    attitudinalAchievement: { count: jest.fn().mockResolvedValue(0) },
  };

  const service = new AchievementService(prisma);
  return { service, prisma, achievementDelete, store };
}

const EV = (id: string, text: string) => ({ id, text });

describe('deleteAchievement — guarda de historia académica (StudentAchievement)', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // A · sin historia académica
  // ═══════════════════════════════════════════════════════════════════════════
  describe('A · propósito sin StudentAchievement', () => {
    it('sigue pudiéndose eliminar', async () => {
      const { service, achievementDelete } = makeService({ studentAchievements: 0 });
      await expect(service.deleteAchievement('ach-1')).resolves.toEqual({ id: 'ach-1' });
      expect(achievementDelete).toHaveBeenCalledWith({ where: { id: 'ach-1' } });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // B · con historia académica
  // ═══════════════════════════════════════════════════════════════════════════
  describe('B · propósito con StudentAchievement', () => {
    it('lanza ConflictException', async () => {
      const { service } = makeService({ studentAchievements: 1 });
      await expect(service.deleteAchievement('ach-1')).rejects.toBeInstanceOf(ConflictException);
    });

    it('NO ejecuta el DELETE', async () => {
      const { service, achievementDelete } = makeService({ studentAchievements: 1 });
      await expect(service.deleteAchievement('ach-1')).rejects.toThrow(ConflictException);
      expect(achievementDelete).not.toHaveBeenCalled();
    });

    it('la historia académica sobrevive intacta', async () => {
      const { service, store } = makeService({ studentAchievements: 3 });
      await expect(service.deleteAchievement('ach-1')).rejects.toThrow(ConflictException);
      expect(store.studentAchievements).toHaveLength(3);
    });

    it('la cascada de la base de datos habría destruido esos registros', async () => {
      // Demuestra que la protección no es decorativa: si el DELETE llegara a ejecutarse,
      // los registros desaparecerían sin que ninguna FK lo impidiera.
      const { service, achievementDelete, store } = makeService({ studentAchievements: 3 });
      await expect(service.deleteAchievement('ach-1')).rejects.toThrow(ConflictException);
      expect(store.studentAchievements).toHaveLength(3);

      await achievementDelete({ where: { id: 'ach-1' } });
      expect(store.studentAchievements).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // C · varios registros: el conteo del mensaje
  // ═══════════════════════════════════════════════════════════════════════════
  describe('C · varios StudentAchievement', () => {
    it('el mensaje informa cuántos registros hay', async () => {
      const { service } = makeService({ studentAchievements: 27 });
      await expect(service.deleteAchievement('ach-1')).rejects.toThrow(/27 registro/);
    });

    it('el mensaje nombra el propósito afectado', async () => {
      const { service } = makeService({ studentAchievements: 5 });
      await expect(service.deleteAchievement('ach-1')).rejects.toThrow(/Reconoce y expresa sus emociones/);
    });

    it('el mensaje explica qué se perdería y qué hacer en su lugar', async () => {
      const { service } = makeService({ studentAchievements: 5 });
      await expect(service.deleteAchievement('ach-1')).rejects.toThrow(/historia académica/i);
      await expect(service.deleteAchievement('ach-1')).rejects.toThrow(/Edite su texto/i);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // D/E · las dos historias a la vez
  // ═══════════════════════════════════════════════════════════════════════════
  describe('E · historia académica Y valoraciones por imprescindible', () => {
    const escenario = () => makeService({
      studentAchievements: 4,
      evidences: [EV('ev-1', 'Nombra sus emociones'), EV('ev-2', 'Pide ayuda')],
      valuedEvidenceIds: ['ev-1'],
    });

    it('se rechaza sin llegar a ningún borrado', async () => {
      const { service, achievementDelete } = escenario();
      await expect(service.deleteAchievement('ach-1')).rejects.toBeInstanceOf(ConflictException);
      expect(achievementDelete).not.toHaveBeenCalled();
    });

    it('nada se elimina parcialmente: ambas historias quedan completas', async () => {
      const { service, store } = escenario();
      await expect(service.deleteAchievement('ach-1')).rejects.toThrow(ConflictException);
      expect(store.studentAchievements).toHaveLength(4);
      expect(store.evidences).toHaveLength(2);
    });

    it('no existe vía de borrado granular en este método', async () => {
      const { service, prisma } = escenario();
      await expect(service.deleteAchievement('ach-1')).rejects.toThrow(ConflictException);
      expect(prisma.achievementEvidence.delete).toBeUndefined();
      expect(prisma.achievementEvidence.deleteMany).toBeUndefined();
      expect(prisma.studentAchievement.delete).toBeUndefined();
      expect(prisma.studentAchievement.deleteMany).toBeUndefined();
    });
  });

  describe('E.2 · sólo valoraciones por imprescindible, sin historia académica', () => {
    it('sigue protegido por la guarda de valoraciones (F2 anterior)', async () => {
      const { service, achievementDelete } = makeService({
        studentAchievements: 0,
        evidences: [EV('ev-1', 'Nombra sus emociones')],
        valuedEvidenceIds: ['ev-1'],
      });
      await expect(service.deleteAchievement('ach-1')).rejects.toBeInstanceOf(ConflictException);
      expect(achievementDelete).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F · higiene del mensaje
  // ═══════════════════════════════════════════════════════════════════════════
  describe('F · el mensaje no filtra jerga de base de datos', () => {
    it('sin P2003, 23503, constraint ni nombres internos de tabla', async () => {
      const { service } = makeService({ studentAchievements: 2 });
      const err: any = await service.deleteAchievement('ach-1').catch((e) => e);
      const msg = String(err.message);
      expect(msg).not.toMatch(/P2003|23503|constraint|foreign key/i);
      expect(msg).not.toMatch(/StudentAchievement|AchievementEvidence|StudentEvidenceValuation/);
    });
  });
});
