import * as fs from 'fs';
import * as path from 'path';
import { ConflictException } from '@nestjs/common';
import { AchievementService } from './achievement.service';

/**
 * AUDITORÍA · ¿puede `Achievement` retirarse lógicamente, como hacen las evidencias?
 *
 * Caracteriza el comportamiento ACTUAL. No corrige nada. Las pruebas marcadas
 * [DEFECTO CONGELADO] describen un defecto vigente y **deben fallar** el día que se
 * corrija: ése es su propósito.
 */

const SCHEMA = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'prisma', 'schema.prisma'),
  'utf8',
);

function modelo(nombre: string): string {
  const m = SCHEMA.match(new RegExp(`^model ${nombre} \\{[\\s\\S]*?^\\}`, 'm'));
  if (!m) throw new Error(`modelo ${nombre} no encontrado en schema.prisma`);
  return m[0];
}

function makeService(opts: {
  studentAchievements?: number;
  attitudinal?: number;
} = {}) {
  const store = {
    studentAchievements: Array.from({ length: opts.studentAchievements ?? 0 }, (_, i) => ({ id: `sa-${i}` })),
    attitudinal: Array.from({ length: opts.attitudinal ?? 0 }, (_, i) => ({ id: `aa-${i}`, description: `Logro actitudinal ${i}` })),
  };

  const achievementDelete = jest.fn(async ({ where }: any) => {
    // ON DELETE CASCADE en ambas relaciones.
    store.studentAchievements = [];
    store.attitudinal = [];
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
    achievementEvidence: { findMany: jest.fn().mockResolvedValue([]) },
    studentEvidenceValuation: { findMany: jest.fn().mockResolvedValue([]) },
    studentAchievement: { count: jest.fn(async () => store.studentAchievements.length) },
    attitudinalAchievement: { count: jest.fn(async () => store.attitudinal.length) },
  };

  return { service: new AchievementService(prisma), prisma, achievementDelete, store };
}

describe('AUDITORÍA · retiro lógico de Achievement', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // A · sin historia
  // ═══════════════════════════════════════════════════════════════════════════
  describe('A · Achievement sin StudentAchievement', () => {
    it('puede eliminarse', async () => {
      const { service, achievementDelete } = makeService({ studentAchievements: 0 });
      await expect(service.deleteAchievement('ach-1')).resolves.toEqual({ id: 'ach-1' });
      expect(achievementDelete).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // B · con historia académica
  // ═══════════════════════════════════════════════════════════════════════════
  describe('B · Achievement con StudentAchievement', () => {
    it('queda protegido: ConflictException y ningún DELETE', async () => {
      const { service, achievementDelete } = makeService({ studentAchievements: 4 });
      await expect(service.deleteAchievement('ach-1')).rejects.toBeInstanceOf(ConflictException);
      expect(achievementDelete).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // C · con logros actitudinales — DEFECTO VIGENTE
  // ═══════════════════════════════════════════════════════════════════════════
  describe('C · Achievement con AttitudinalAchievement', () => {
    it('[CORREGIDO] sin historia académica, el borrado se detiene y los actitudinales sobreviven', async () => {
      const { service, achievementDelete, store } = makeService({ studentAchievements: 0, attitudinal: 3 });
      await expect(service.deleteAchievement('ach-1')).rejects.toBeInstanceOf(ConflictException);
      expect(achievementDelete).not.toHaveBeenCalled();
      expect(store.attitudinal).toHaveLength(3); // ya no los arrastra la cascada
    });

    it('[CORREGIDO] la guarda SÍ consulta AttitudinalAchievement antes de borrar', async () => {
      const { service, prisma } = makeService({ studentAchievements: 0, attitudinal: 3 });
      await expect(service.deleteAchievement('ach-1')).rejects.toThrow(ConflictException);
      expect(prisma.attitudinalAchievement.count).toHaveBeenCalledWith({ where: { achievementId: 'ach-1' } });
    });

    it('la relación es CASCADE y nullable en el esquema', () => {
      const m = modelo('AttitudinalAchievement');
      expect(m).toMatch(/achievementId\s+String\?/);
      expect(m).toMatch(/achievement\s+Achievement\?\s+@relation\([^)]*onDelete:\s*Cascade/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // D · ambas relaciones
  // ═══════════════════════════════════════════════════════════════════════════
  describe('D · Achievement con historia académica Y actitudinales', () => {
    it('la guarda de StudentAchievement detiene todo antes de tocar nada', async () => {
      const { service, achievementDelete, store } = makeService({ studentAchievements: 2, attitudinal: 3 });
      await expect(service.deleteAchievement('ach-1')).rejects.toBeInstanceOf(ConflictException);
      expect(achievementDelete).not.toHaveBeenCalled();
      expect(store.studentAchievements).toHaveLength(2);
      expect(store.attitudinal).toHaveLength(3);
    });

    it('[CORREGIDO] los actitudinales ya tienen protección propia, no dependen de la anterior', async () => {
      // Misma situación sin historia académica: antes la protección desaparecía.
      const { service, store } = makeService({ studentAchievements: 0, attitudinal: 3 });
      await expect(service.deleteAchievement('ach-1')).rejects.toThrow(/contenido actitudinal/);
      expect(store.attitudinal).toHaveLength(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // E · ¿existe retiro lógico de Achievement?
  // ═══════════════════════════════════════════════════════════════════════════
  describe('E · mecanismo de retiro lógico de Achievement', () => {
    it('[DEFECTO CONGELADO] el modelo NO tiene ninguna columna de estado o retiro', () => {
      const m = modelo('Achievement');
      expect(m).not.toMatch(/\bisActive\b/);
      expect(m).not.toMatch(/\bretiredFromTermId\b/);
      expect(m).not.toMatch(/\bretiredAt\b/);
      expect(m).not.toMatch(/\bdeletedAt\b/);
      expect(m).not.toMatch(/\barchivedAt\b/);
    });

    it('[DEFECTO CONGELADO] el servicio no expone ningún método de retiro de Achievement', () => {
      const proto = Object.getOwnPropertyNames(AchievementService.prototype);
      expect(proto).not.toContain('retireAchievement');
      expect(proto).not.toContain('reactivateAchievement');
      expect(proto).not.toContain('archiveAchievement');
    });

    it('en contraste, AchievementEvidence SÍ tiene el patrón D-12 completo', () => {
      const m = modelo('AchievementEvidence');
      expect(m).toMatch(/retiredFromTermId\s+String\?/);
      expect(m).toMatch(/retiredAt\s+DateTime\?/);
      const proto = Object.getOwnPropertyNames(AchievementService.prototype);
      expect(proto).toContain('retireEvidence');
      expect(proto).toContain('reactivateEvidence');
    });

    it('la única salida hoy para un propósito con historia es no eliminarlo', async () => {
      const { service } = makeService({ studentAchievements: 1 });
      await expect(service.deleteAchievement('ach-1')).rejects.toThrow(/Edite su texto/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F · el retiro lógico conserva la historia (patrón D-12, sobre evidencias)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('F · conservación de la historia al retirar lógicamente', () => {
    it('retireEvidence no toca las valoraciones: sólo marca el estado de retiro', () => {
      const src = fs.readFileSync(path.join(__dirname, 'achievement.service.ts'), 'utf8');
      const cuerpo = src.slice(src.indexOf('async retireEvidence('), src.indexOf('async reactivateEvidence('));
      expect(cuerpo).toMatch(/retiredFromTermId/);
      // Ninguna escritura sobre valoraciones dentro del retiro.
      expect(cuerpo).not.toMatch(/studentEvidenceValuation\.(delete|deleteMany|update|updateMany)/);
    });

    it('la FK RESTRICT impide además que un retiro degenere en borrado', () => {
      const m = modelo('StudentEvidenceValuation');
      expect(m).toMatch(/achievementEvidence\s+AchievementEvidence\s+@relation\([^)]*onDelete:\s*Restrict/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // G · dependencia del boletín respecto de la fila viva
  // ═══════════════════════════════════════════════════════════════════════════
  describe('G · qué necesita el boletín del catálogo', () => {
    it('el generador de boletines lee el Achievement VIVO, no una copia congelada en la valoración', () => {
      const src = fs.readFileSync(
        path.join(__dirname, '..', 'reports', 'reports.service.ts'), 'utf8',
      );
      const i = src.indexOf('const allAchievements = await this.prisma.studentAchievement.findMany(');
      expect(i).toBeGreaterThan(-1);
      const consulta = src.slice(i, i + 1200);
      // Hace join con el catálogo: descriptores, orden y dimensión salen de ahí.
      expect(consulta).toMatch(/include:\s*\{[\s\S]*achievement:/);
      expect(consulta).toMatch(/levelDescriptors/);
    });

    it('por eso borrar físicamente el propósito destruye también la vía de lectura del histórico', () => {
      // StudentAchievement.achievementId es NOT NULL y CASCADE: no puede quedar
      // huérfano como pasó con las valoraciones; simplemente desaparece con el padre.
      const m = modelo('StudentAchievement');
      expect(m).toMatch(/achievementId\s+String\b/);
      expect(m).not.toMatch(/achievementId\s+String\?/);
      expect(m).toMatch(/achievement\s+Achievement\s+@relation\([^)]*onDelete:\s*Cascade/);
    });

    it('un retiro lógico conservaría la fila y, con ella, el boletín histórico', () => {
      // Caracteriza el requisito, no una implementación: la fila debe sobrevivir.
      // Hoy no hay forma de conseguirlo para Achievement (ver E).
      const m = modelo('Achievement');
      expect(m).not.toMatch(/retiredFromTermId/);
    });
  });
});
