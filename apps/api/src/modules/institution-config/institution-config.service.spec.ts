import { ConflictException, NotFoundException } from '@nestjs/common';
import { InstitutionConfigService } from './institution-config.service';

/**
 * Módulo 2 (Onboarding v2) — applyBaseConfig + getConfigCompleteness.
 */
describe('InstitutionConfigService — configuración base (Módulo 2)', () => {
  function makeService(prismaOver: any = {}) {
    const prisma: any = {
      institution: { findUnique: jest.fn() },
      performanceScale: { count: jest.fn().mockResolvedValue(0) },
      evaluationComponent: { findMany: jest.fn().mockResolvedValue([]) },
      academicYear: { count: jest.fn().mockResolvedValue(0) },
      ...prismaOver,
    };
    return new InstitutionConfigService(prisma as any);
  }

  describe('applyBaseConfig', () => {
    it('lanza 404 si la institución no existe', async () => {
      const svc = makeService({ institution: { findUnique: jest.fn().mockResolvedValue(null) } });
      await expect(svc.applyBaseConfig('nope')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lanza 409 si ya hay config y overwrite es false', async () => {
      const svc = makeService({
        institution: {
          findUnique: jest.fn().mockResolvedValue({ id: 'i1', gradingConfig: { x: 1 }, periodsConfig: null }),
        },
      });
      await expect(svc.applyBaseConfig('i1')).rejects.toBeInstanceOf(ConflictException);
    });

    it('aplica defaults (grading + períodos) en institución sin config', async () => {
      const svc = makeService({
        institution: {
          findUnique: jest.fn().mockResolvedValue({ id: 'i1', gradingConfig: null, periodsConfig: null }),
        },
      });
      // Evitar tocar la BD: espiar los setters validados y el getter final.
      const grading = jest.spyOn(svc, 'updateGradingConfig').mockResolvedValue({} as any);
      const periods = jest.spyOn(svc, 'updatePeriods').mockResolvedValue({} as any);
      const full = jest.spyOn(svc, 'getFullConfig').mockResolvedValue({ ok: true } as any);

      const res = await svc.applyBaseConfig('i1');

      expect(grading).toHaveBeenCalledTimes(1);
      expect(periods).toHaveBeenCalledTimes(1);
      // Los defaults deben sumar 100% (composición 40/40/20; períodos 25×4).
      const gradingArg: any = grading.mock.calls[0][1];
      expect(gradingArg.evaluationProcesses.reduce((s: number, p: any) => s + p.weightPercentage, 0)).toBe(100);
      const periodsArg: any = periods.mock.calls[0][1];
      expect(periodsArg.reduce((s: number, p: any) => s + p.weight, 0)).toBe(100);
      expect(res).toEqual({ ok: true });
      full.mockRestore();
    });

    it('con config existente y overwrite=true, sí aplica', async () => {
      const svc = makeService({
        institution: {
          findUnique: jest.fn().mockResolvedValue({ id: 'i1', gradingConfig: { x: 1 }, periodsConfig: [{}] }),
        },
      });
      jest.spyOn(svc, 'updateGradingConfig').mockResolvedValue({} as any);
      jest.spyOn(svc, 'updatePeriods').mockResolvedValue({} as any);
      jest.spyOn(svc, 'getFullConfig').mockResolvedValue({ ok: true } as any);
      await expect(svc.applyBaseConfig('i1', { overwrite: true })).resolves.toEqual({ ok: true });
    });
  });

  describe('getConfigCompleteness', () => {
    it('reporta todo lo que falta cuando la institución está vacía', async () => {
      const svc = makeService({
        performanceScale: { count: jest.fn().mockResolvedValue(0) },
        evaluationComponent: { findMany: jest.fn().mockResolvedValue([]) },
        institution: { findUnique: jest.fn().mockResolvedValue({ gradingConfig: null, periodsConfig: null }) },
      });
      const res = await svc.getConfigCompleteness('i1');
      expect(res.ready).toBe(false);
      expect(res.missing.sort()).toEqual(['composicion', 'escala', 'periodos']);
    });

    it('ready=true con escala + períodos(100) + composición desde EvaluationComponent(100)', async () => {
      const svc = makeService({
        performanceScale: { count: jest.fn().mockResolvedValue(4) },
        evaluationComponent: {
          findMany: jest.fn().mockResolvedValue([{ weightPercentage: 40 }, { weightPercentage: 40 }, { weightPercentage: 20 }]),
        },
        institution: {
          findUnique: jest.fn().mockResolvedValue({
            gradingConfig: null,
            periodsConfig: [{ weight: 25 }, { weight: 25 }, { weight: 25 }, { weight: 25 }],
          }),
        },
      });
      const res = await svc.getConfigCompleteness('i1');
      expect(res.checks).toEqual({ escala: true, periodos: true, composicion: true });
      expect(res.ready).toBe(true);
    });

    it('usa gradingConfig.evaluationProcesses para la composición si aún no hay EvaluationComponent', async () => {
      const svc = makeService({
        performanceScale: { count: jest.fn().mockResolvedValue(4) },
        evaluationComponent: { findMany: jest.fn().mockResolvedValue([]) },
        institution: {
          findUnique: jest.fn().mockResolvedValue({
            gradingConfig: { evaluationProcesses: [{ weightPercentage: 60 }, { weightPercentage: 40 }] },
            periodsConfig: [{ weight: 100 }],
          }),
        },
      });
      const res = await svc.getConfigCompleteness('i1');
      expect(res.checks.composicion).toBe(true);
      expect(res.ready).toBe(true);
    });
  });
});
