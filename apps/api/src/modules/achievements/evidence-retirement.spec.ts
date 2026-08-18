import * as fs from 'fs';
import * as path from 'path';
import { AchievementService } from './achievement.service';
import { isEvidenceVigente } from './evidence-vigencia.util';

/**
 * D-12 · Retiro lógico y prospectivo de imprescindibles/evidencias.
 *
 * Regla canónica: una evidencia retirada desde el período T sigue vigente en todo
 * período P del mismo año con P.order < T.order, y deja de serlo desde T.
 * `retiredFromTermId` es la ÚNICA fuente de verdad; `retiredAt` es trazabilidad;
 * `isActive` está deprecado.
 */

const TERM = (id: string, order: number, status = 'OPEN', name = `Período ${order}`) => ({ id, order, status, name, academicYearId: 'year-1' });

function makeService(opts: {
  evidence?: any;
  achievement?: any;
  term?: any;
  retiredTerm?: any;
  valuationCount?: number;
} = {}) {
  const evidenceUpdate = jest.fn(async (args: any) => ({ id: 'ev-1', ...args.data }));
  const valuationUpsert = jest.fn().mockResolvedValue({ id: 'sev-1' });
  const valuationDelete = jest.fn();
  const auditRecord = jest.fn().mockResolvedValue(undefined);

  const prisma: any = {
    achievementEvidence: {
      findUnique: jest.fn().mockResolvedValue(
        opts.evidence === undefined
          ? { id: 'ev-1', text: 'Reconoce su nombre', achievementId: 'ach-1', retiredFromTermId: null, retiredAt: null }
          : opts.evidence,
      ),
      update: evidenceUpdate,
      findMany: jest.fn().mockResolvedValue([]),
    },
    achievement: {
      findUnique: jest.fn().mockResolvedValue(
        opts.achievement ?? {
          id: 'ach-1', institutionId: 'inst-1', baseDescription: 'Propósito comunicativo',
          academicYearId: 'year-1', teacherAssignment: null,
        },
      ),
      findMany: jest.fn().mockResolvedValue([]),
    },
    academicTerm: {
      findUnique: jest.fn().mockResolvedValue(opts.term === undefined ? TERM('t2', 2) : opts.term),
      findMany: jest.fn().mockResolvedValue([]),
    },
    studentEvidenceValuation: {
      count: jest.fn().mockResolvedValue(opts.valuationCount ?? 0),
      upsert: valuationUpsert,
      deleteMany: valuationDelete,
      findMany: jest.fn().mockResolvedValue([]),
    },
    studentEnrollment: { findUnique: jest.fn().mockResolvedValue({ institutionId: 'inst-1' }) },
    teacherAssignment: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const gradeAudit: any = { record: auditRecord, recordMany: jest.fn() };
  return { svc: new AchievementService(prisma, gradeAudit), prisma, evidenceUpdate, valuationUpsert, valuationDelete, auditRecord };
}

// ═══════════════════════════════════════════════════════════════════════════
describe('D-12 · regla de vigencia (unidad pura)', () => {
  const orders = new Map<string, number>([['t2', 2], ['t3', 3]]);

  it('CASO 1 · evidencia activa (retiredFromTermId = null) es vigente en cualquier período', () => {
    expect(isEvidenceVigente({ retiredFromTermId: null }, 1, orders)).toBe(true);
    expect(isEvidenceVigente({ retiredFromTermId: null }, 99, orders)).toBe(true);
  });

  it('CASO 13 · retirada desde P2 SIGUE vigente en P1 (histórico preservado)', () => {
    expect(isEvidenceVigente({ retiredFromTermId: 't2' }, 1, orders)).toBe(true);
  });

  it('CASO 14 · retirada desde P2 NO es vigente en P2 ni en P3', () => {
    expect(isEvidenceVigente({ retiredFromTermId: 't2' }, 2, orders)).toBe(false);
    expect(isEvidenceVigente({ retiredFromTermId: 't2' }, 3, orders)).toBe(false);
  });

  it('CASO 20-21 · el cálculo NO usa startDate/endDate: sólo `order`', () => {
    // Los períodos aquí no tienen fecha alguna; la regla resuelve igual.
    expect(isEvidenceVigente({ retiredFromTermId: 't3' }, 2, orders)).toBe(true);
    expect(isEvidenceVigente({ retiredFromTermId: 't3' }, 3, orders)).toBe(false);
  });

  it('falla ABIERTO ante datos inconsistentes: conserva la evidencia', () => {
    expect(isEvidenceVigente({ retiredFromTermId: 'desconocido' }, 2, orders)).toBe(true);
    expect(isEvidenceVigente({ retiredFromTermId: 't2' }, undefined, orders)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('D-12 · retirar', () => {
  it('CASO 2-3 · establece retiredFromTermId y retiredAt', async () => {
    const t = makeService({ term: TERM('t2', 2, 'OPEN') });

    await t.svc.retireEvidence('ev-1', { academicTermId: 't2', reason: 'Ya no aplica' });

    expect(t.evidenceUpdate).toHaveBeenCalledTimes(1);
    const arg = t.evidenceUpdate.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 'ev-1' });
    expect(arg.data.retiredFromTermId).toBe('t2');
    expect(arg.data.retiredAt).toBeInstanceOf(Date);
  });

  it('CASO 5 · NO modifica ninguna valoración', async () => {
    const t = makeService({ term: TERM('t2', 2, 'OPEN'), valuationCount: 9 });

    await t.svc.retireEvidence('ev-1', { academicTermId: 't2' });

    expect(t.valuationUpsert).not.toHaveBeenCalled();
    expect(t.valuationDelete).not.toHaveBeenCalled();
  });

  it('CASO 7 · rechaza retirar desde un período CLOSED, sin escribir nada', async () => {
    const t = makeService({ term: TERM('t2', 2, 'CLOSED') });

    await expect(t.svc.retireEvidence('ev-1', { academicTermId: 't2' })).rejects.toThrow(/CLOSED/);
    expect(t.evidenceUpdate).not.toHaveBeenCalled();
  });

  it('CASO 8 · rechaza retirar desde un período FINALIZED, sin escribir nada', async () => {
    const t = makeService({ term: TERM('t2', 2, 'FINALIZED') });

    await expect(t.svc.retireEvidence('ev-1', { academicTermId: 't2' })).rejects.toThrow(/FINALIZED/);
    expect(t.evidenceUpdate).not.toHaveBeenCalled();
  });

  it('rechaza un período de otro año académico', async () => {
    const t = makeService({ term: { ...TERM('t2', 2, 'OPEN'), academicYearId: 'otro-year' } });

    await expect(t.svc.retireEvidence('ev-1', { academicTermId: 't2' })).rejects.toThrow(/año académico/i);
    expect(t.evidenceUpdate).not.toHaveBeenCalled();
  });

  it('CASO 15 · no toca snapshots: sólo escribe en AchievementEvidence', async () => {
    const t = makeService({ term: TERM('t2', 2, 'OPEN') });

    await t.svc.retireEvidence('ev-1', { academicTermId: 't2' });

    // El servicio no expone ni usa termReportCardSnapshot: si lo intentara, el mock
    // no lo tendría y la llamada explotaría. Se comprueba explícitamente.
    expect((t.prisma as any).termReportCardSnapshot).toBeUndefined();
    expect(t.evidenceUpdate).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('D-12 · reactivar', () => {
  const retired = { id: 'ev-1', text: 'Reconoce su nombre', achievementId: 'ach-1', retiredFromTermId: 't2', retiredAt: new Date() };

  it('CASO 4 · limpia retiredFromTermId y retiredAt', async () => {
    const t = makeService({ evidence: retired, term: TERM('t2', 2, 'OPEN') });

    await t.svc.reactivateEvidence('ev-1');

    const arg = t.evidenceUpdate.mock.calls[0][0];
    expect(arg.data).toEqual({ retiredFromTermId: null, retiredAt: null });
  });

  it('CASO 6 · NO modifica valoraciones históricas', async () => {
    const t = makeService({ evidence: retired, term: TERM('t2', 2, 'OPEN'), valuationCount: 4 });

    await t.svc.reactivateEvidence('ev-1');

    expect(t.valuationUpsert).not.toHaveBeenCalled();
    expect(t.valuationDelete).not.toHaveBeenCalled();
  });

  it('CASO 19 · es prospectiva: rechaza reactivar si el período de retiro ya está cerrado', async () => {
    const t = makeService({ evidence: retired, term: TERM('t2', 2, 'FINALIZED') });

    await expect(t.svc.reactivateEvidence('ev-1')).rejects.toThrow(/FINALIZED/);
    expect(t.evidenceUpdate).not.toHaveBeenCalled();
  });

  it('rechaza reactivar una evidencia que ya está activa', async () => {
    const t = makeService(); // retiredFromTermId = null

    await expect(t.svc.reactivateEvidence('ev-1')).rejects.toThrow(/ya está activo/i);
    expect(t.evidenceUpdate).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('D-12 · valoración sobre evidencia retirada (H-19)', () => {
  function valuationService(retiredFromTermId: string | null, termOrders: Array<{ id: string; order: number }>) {
    const t = makeService({ evidence: { id: 'ev-1', text: 'Imprescindible A', achievementId: 'ach-1', retiredFromTermId, retiredAt: null } });
    t.prisma.academicTerm.findMany.mockResolvedValue(termOrders);
    return t;
  }

  it('CASO 9-10 · rechaza la valoración en el período desde el que fue retirada', async () => {
    const t = valuationService('t2', [{ id: 't2', order: 2 }]);

    await expect(
      t.svc.upsertEvidenceValuation({
        studentEnrollmentId: 'se-1', achievementEvidenceId: 'ev-1', academicTermId: 't2', performanceLevel: 'ALTO' as any,
      }),
    ).rejects.toThrow(/retirado del catálogo/i);

    expect(t.valuationUpsert).not.toHaveBeenCalled();
  });

  it('SÍ permite editar la valoración de un período anterior al retiro', async () => {
    const t = valuationService('t2', [{ id: 't2', order: 2 }, { id: 't1', order: 1 }]);

    await t.svc.upsertEvidenceValuation({
      studentEnrollmentId: 'se-1', achievementEvidenceId: 'ev-1', academicTermId: 't1', performanceLevel: 'ALTO' as any,
    });

    expect(t.valuationUpsert).toHaveBeenCalledTimes(1);
  });

  it('permite valorar una evidencia activa', async () => {
    const t = valuationService(null, []);

    await t.svc.upsertEvidenceValuation({
      studentEnrollmentId: 'se-1', achievementEvidenceId: 'ev-1', academicTermId: 't2', performanceLevel: 'BASICO' as any,
    });

    expect(t.valuationUpsert).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('D-12 · planilla del docente (H-18)', () => {
  it('no ofrece evidencias retiradas en el período consultado', async () => {
    const t = makeService();
    t.prisma.teacherAssignment.findUnique.mockResolvedValue({ academicYearId: 'year-1', subjectId: 'sub-1', group: { gradeId: 'g-1' } });
    t.prisma.teacherAssignment.findMany.mockResolvedValue([{ id: 'ta-1' }]);
    t.prisma.achievement.findMany.mockResolvedValue([
      {
        id: 'ach-1',
        evidences: [
          { id: 'ev-1', text: 'Vigente', retiredFromTermId: null },
          { id: 'ev-2', text: 'Retirada desde P2', retiredFromTermId: 't2' },
        ],
      },
    ]);
    t.prisma.academicTerm.findMany.mockResolvedValue([{ id: 't2', order: 2 }]);

    const result: any[] = await t.svc.getAchievementsByAssignment('ta-1', 't2');

    expect(result[0].evidences.map((e: any) => e.id)).toEqual(['ev-1']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('D-12 · catálogo y reconciliación (compatibilidad con F1)', () => {
  it('CASO 11 · el catálogo NO filtra las retiradas: deben seguir viajando en el payload', () => {
    // Si getCatalogAchievements las ocultara, reconcileEvidences las vería como bajas
    // y bloquearía cada guardado. Se verifica sobre el código fuente.
    const src = fs.readFileSync(path.join(__dirname, 'achievement.service.ts'), 'utf8');
    const catalogFn = src.slice(src.indexOf('async getCatalogAchievements'));
    const body = catalogFn.slice(0, catalogFn.indexOf('async createCatalogAchievement'));
    expect(body).toContain('evidences:');
    expect(body).not.toContain('retiredFromTermId: null');
    expect(body).not.toContain('isActive');
  });

  it('CASO 12 · reconcileEvidences no da de baja una evidencia RETIRADA presente en el payload', async () => {
    const t = makeService();
    // ev-2 está efectivamente retirada: retiredFromTermId != null.
    t.prisma.achievementEvidence.findMany.mockResolvedValue([
      { id: 'ev-1', text: 'A', orderNumber: 1, retiredFromTermId: null },
      { id: 'ev-2', text: 'B retirada', orderNumber: 2, retiredFromTermId: 't2' },
    ]);
    t.prisma.achievement.update = jest.fn().mockResolvedValue({ id: 'ach-1' });

    await t.svc.updateAchievement('ach-1', {
      baseDescription: 'Propósito',
      evidences: [{ id: 'ev-1', text: 'A' }, { id: 'ev-2', text: 'B retirada' }],
    });

    // Ni baja ni alta: la retirada se reconoce como la misma fila por su id.
    // Si reconcileEvidences la tratara como eliminación, habría consultado sus
    // valoraciones y llamado a deleteMany (o lanzado ConflictException).
    expect(t.prisma.achievementEvidence.deleteMany).toBeUndefined();
    expect(t.prisma.studentEvidenceValuation.findMany).not.toHaveBeenCalled();
    expect(t.prisma.achievementEvidence.update).not.toHaveBeenCalled();
    expect(t.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('CASO 12b · quitar del payload una evidencia retirada CON valoraciones sigue bloqueado (guarda F1)', async () => {
    const t = makeService();
    t.prisma.achievementEvidence.findMany.mockResolvedValue([
      { id: 'ev-1', text: 'A', orderNumber: 1, retiredFromTermId: null },
      { id: 'ev-2', text: 'B retirada', orderNumber: 2, retiredFromTermId: 't2' },
    ]);
    t.prisma.studentEvidenceValuation.findMany.mockResolvedValue([{ achievementEvidenceId: 'ev-2' }]);
    t.prisma.achievement.update = jest.fn().mockResolvedValue({ id: 'ach-1' });

    // Estar retirada NO la vuelve borrable: la guarda de F1 sigue mandando.
    await expect(
      t.svc.updateAchievement('ach-1', { baseDescription: 'Propósito', evidences: [{ id: 'ev-1', text: 'A' }] }),
    ).rejects.toThrow(/valoraciones registradas/i);

    expect(t.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('CASO 16-17 · retirar NO sustituye la guarda de eliminación de F1', async () => {
    const t = makeService({
      evidence: { id: 'ev-1', text: 'Retirada con historia', achievementId: 'ach-1', retiredFromTermId: 't2', retiredAt: new Date() },
      valuationCount: 3,
    });

    await expect(t.svc.deleteEvidence('ev-1')).rejects.toThrow(/No se puede eliminar/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('D-12 · auditoría E-5', () => {
  it('registra el retiro con source, actor, motivo y número de valoraciones', async () => {
    const t = makeService({ term: TERM('t2', 2, 'OPEN'), valuationCount: 7 });

    await t.svc.retireEvidence('ev-1', { academicTermId: 't2', reason: 'Cambió el plan' }, { userId: 'u-1', name: 'admin@x.co', role: 'ADMIN_INSTITUTIONAL' });

    expect(t.auditRecord).toHaveBeenCalledTimes(1);
    const [event, actor] = t.auditRecord.mock.calls[0];
    expect(event.source).toBe('ACHIEVEMENT_EVIDENCE');
    expect(event.action).toBe('UPDATE');
    expect(event.institutionId).toBe('inst-1');
    expect(event.previousValue.operation).toBe('RETIRE');
    expect(event.previousValue.valuationCount).toBe(7);
    expect(event.previousValue.achievement).toBe('Propósito comunicativo');
    expect(event.newValue.reason).toBe('Cambió el plan');
    expect(actor.userId).toBe('u-1');
  });

  it('registra la reactivación', async () => {
    const t = makeService({
      evidence: { id: 'ev-1', text: 'A', achievementId: 'ach-1', retiredFromTermId: 't2', retiredAt: new Date() },
      term: TERM('t2', 2, 'OPEN'),
    });

    await t.svc.reactivateEvidence('ev-1', { reason: 'Se repuso' });

    expect(t.auditRecord.mock.calls[0][0].previousValue.operation).toBe('REACTIVATE');
  });

  it('un fallo de auditoría NO impide el retiro ni propaga la excepción', async () => {
    const t = makeService({ term: TERM('t2', 2, 'OPEN') });
    t.auditRecord.mockRejectedValue(new Error('auditoría caída'));

    // 1. La operación resuelve correctamente.
    const result = await t.svc.retireEvidence('ev-1', { academicTermId: 't2' });

    // 2. El cambio de estado se conserva.
    expect(t.evidenceUpdate).toHaveBeenCalledTimes(1);
    expect(t.evidenceUpdate.mock.calls[0][0].data.retiredFromTermId).toBe('t2');
    expect(result.retiredFromTermId).toBe('t2');

    // 3. El auditor fue llamado y falló, sin que eso rompa nada.
    expect(t.auditRecord).toHaveBeenCalledTimes(1);

    // 4. Ninguna valoración modificada ni eliminada.
    expect(t.valuationUpsert).not.toHaveBeenCalled();
    expect(t.valuationDelete).not.toHaveBeenCalled();
  });

  it('un fallo de auditoría NO impide la reactivación', async () => {
    const t = makeService({
      evidence: { id: 'ev-1', text: 'A', achievementId: 'ach-1', retiredFromTermId: 't2', retiredAt: new Date() },
      term: TERM('t2', 2, 'OPEN'),
    });
    t.auditRecord.mockRejectedValue(new Error('auditoría caída'));

    const result = await t.svc.reactivateEvidence('ev-1');

    expect(result.retiredFromTermId).toBeNull();
    expect(t.valuationUpsert).not.toHaveBeenCalled();
    expect(t.valuationDelete).not.toHaveBeenCalled();
  });

  it('funciona sin GradeAuditService inyectado (auditoría opcional)', async () => {
    const t = makeService({ term: TERM('t2', 2, 'OPEN') });
    const sinAudit = new AchievementService(t.prisma);

    await expect(sinAudit.retireEvidence('ev-1', { academicTermId: 't2' })).resolves.toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('D-12 · CASO 23 · isActive queda sin lecturas funcionales', () => {
  const read = (p: string) => fs.readFileSync(path.join(__dirname, p), 'utf8');

  it('achievement.service.ts no filtra ni escribe el isActive DE EVIDENCIAS', () => {
    const src = read('achievement.service.ts');
    // Filtro de evidencias por isActive: eliminado.
    expect(src).not.toMatch(/evidences:\s*\{\s*where:\s*\{[^}]*isActive/);
    // Escrituras de isActive de evidencias: eliminadas.
    expect(src).not.toContain('updateData.isActive');
    expect(src).not.toContain('isActive: e.isActive');
  });

  it('NO se tocó el isActive de otros modelos (semántica distinta)', () => {
    const src = read('achievement.service.ts');
    // ValueJudgmentTemplate y ObservationTemplate tienen su propio isActive, ajeno a
    // D-12. Esta prueba impide que una limpieza mecánica se los lleve por delante.
    expect(src).toMatch(/valueJudgmentTemplates:\s*\{[\s\S]{0,120}isActive: true/);
    expect(src).toMatch(/observationTemplates:\s*\{[\s\S]{0,120}isActive: true/);
  });

  it('reports.service.ts no filtra evidencias por isActive', () => {
    const src = read('../reports/reports.service.ts');
    expect(src).not.toContain('where: { isActive: true }');
  });
});
