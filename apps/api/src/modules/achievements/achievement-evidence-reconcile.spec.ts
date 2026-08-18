import { AchievementService } from './achievement.service';

/**
 * F1 — Integridad de las valoraciones por imprescindible/evidencia.
 *
 * Antes, `updateAchievement` hacía `deleteMany` + `createMany` sobre las evidencias en
 * cada guardado del catálogo. Como `StudentEvidenceValuation.achievementEvidenceId` es un
 * escalar sin FK, regenerar los ids dejaba TODAS las valoraciones del docente huérfanas e
 * invisibles, sin error. Bastaba corregir una tilde en un propósito.
 *
 * Estas pruebas fijan la regla: EDITAR TEXTO ≠ CREAR EVIDENCIA NUEVA.
 */
describe('AchievementService.updateAchievement — reconciliación de evidencias por id', () => {
  function makeService(opts: {
    existing?: Array<{ id: string; text: string; orderNumber: number }>;
    valuations?: Array<{ achievementEvidenceId: string }>;
  } = {}) {
    const evidenceUpdate = jest.fn((args: any) => ({ __op: 'update', ...args }));
    const evidenceCreate = jest.fn((args: any) => ({ __op: 'create', ...args }));
    const evidenceDeleteMany = jest.fn((args: any) => ({ __op: 'deleteMany', ...args }));
    const transaction = jest.fn().mockResolvedValue([]);
    const achievementUpdate = jest.fn().mockResolvedValue({ id: 'ach-1' });

    const prisma: any = {
      achievement: { update: achievementUpdate },
      achievementLevelDescriptor: { deleteMany: jest.fn(), createMany: jest.fn() },
      achievementEvidence: {
        findMany: jest.fn().mockResolvedValue(opts.existing ?? []),
        update: evidenceUpdate,
        create: evidenceCreate,
        deleteMany: evidenceDeleteMany,
      },
      studentEvidenceValuation: {
        findMany: jest.fn().mockResolvedValue(opts.valuations ?? []),
      },
      $transaction: transaction,
    };

    return {
      svc: new AchievementService(prisma),
      prisma,
      evidenceUpdate,
      evidenceCreate,
      evidenceDeleteMany,
      transaction,
      /** Operaciones efectivamente enviadas a la transacción. */
      ops: () => (transaction.mock.calls[0]?.[0] ?? []) as any[],
    };
  }

  const E = (id: string, text: string, orderNumber: number) => ({ id, text, orderNumber });

  // ── CASO 1 ────────────────────────────────────────────────────────────────
  it('CASO 1 · editar solo el texto de una evidencia existente conserva su id', async () => {
    const t = makeService({ existing: [E('ev-1', 'Reconoce su nombre', 1)] });

    await t.svc.updateAchievement('ach-1', {
      baseDescription: 'Propósito',
      evidences: [{ id: 'ev-1', text: 'Reconoce su nombre propio' }],
    });

    expect(t.evidenceUpdate).toHaveBeenCalledTimes(1);
    expect(t.evidenceUpdate.mock.calls[0][0]).toEqual({
      where: { id: 'ev-1' },
      data: { text: 'Reconoce su nombre propio', orderNumber: 1 },
    });
    // Ni se crea otra evidencia ni se borra la existente.
    expect(t.evidenceCreate).not.toHaveBeenCalled();
    expect(t.evidenceDeleteMany).not.toHaveBeenCalled();
  });

  // ── CASO 2 ────────────────────────────────────────────────────────────────
  it('CASO 2 · agregar una evidencia nueva no toca los ids existentes', async () => {
    const t = makeService({ existing: [E('ev-1', 'A', 1), E('ev-2', 'B', 2)] });

    await t.svc.updateAchievement('ach-1', {
      baseDescription: 'Propósito',
      evidences: [
        { id: 'ev-1', text: 'A' },
        { id: 'ev-2', text: 'B' },
        { text: 'C' }, // nueva, sin id
      ],
    });

    expect(t.evidenceCreate).toHaveBeenCalledTimes(1);
    expect(t.evidenceCreate.mock.calls[0][0]).toEqual({
      data: { achievementId: 'ach-1', text: 'C', orderNumber: 3 },
    });
    // Las existentes no cambian (mismo texto, mismo orden) → ni update ni delete.
    expect(t.evidenceUpdate).not.toHaveBeenCalled();
    expect(t.evidenceDeleteMany).not.toHaveBeenCalled();
  });

  // ── CASO 3 ────────────────────────────────────────────────────────────────
  it('CASO 3 · editar varias existentes y agregar una nueva: solo la nueva recibe id nuevo', async () => {
    const t = makeService({ existing: [E('ev-1', 'A', 1), E('ev-2', 'B', 2)] });

    await t.svc.updateAchievement('ach-1', {
      baseDescription: 'Propósito',
      evidences: [
        { id: 'ev-1', text: 'A corregida' },
        { id: 'ev-2', text: 'B corregida' },
        { text: 'C nueva' },
      ],
    });

    expect(t.evidenceUpdate).toHaveBeenCalledTimes(2);
    expect(t.evidenceUpdate.mock.calls.map((c) => c[0].where.id)).toEqual(['ev-1', 'ev-2']);
    expect(t.evidenceCreate).toHaveBeenCalledTimes(1);
    expect(t.evidenceCreate.mock.calls[0][0].data.text).toBe('C nueva');
    // Ninguna baja: no se pierde ninguna valoración histórica.
    expect(t.evidenceDeleteMany).not.toHaveBeenCalled();
  });

  // ── CASO 4 ────────────────────────────────────────────────────────────────
  it('CASO 4 · guardar sin modificar las evidencias no genera ninguna escritura', async () => {
    const t = makeService({ existing: [E('ev-1', 'A', 1), E('ev-2', 'B', 2)] });

    await t.svc.updateAchievement('ach-1', {
      baseDescription: 'Propósito con otro texto',
      evidences: [
        { id: 'ev-1', text: 'A' },
        { id: 'ev-2', text: 'B' },
      ],
    });

    expect(t.evidenceUpdate).not.toHaveBeenCalled();
    expect(t.evidenceCreate).not.toHaveBeenCalled();
    expect(t.evidenceDeleteMany).not.toHaveBeenCalled();
    expect(t.transaction).not.toHaveBeenCalled(); // sin operaciones → sin transacción
  });

  // ── CASO 5 ────────────────────────────────────────────────────────────────
  it('CASO 5 · si el payload no trae `evidences`, no se toca nada (Achievements.tsx envía solo baseDescription)', async () => {
    const t = makeService({ existing: [E('ev-1', 'A', 1)] });

    await t.svc.updateAchievement('ach-1', { baseDescription: 'Solo cambio el propósito' });

    // Ausencia de `evidences` NUNCA significa "borrar todas".
    expect(t.prisma.achievementEvidence.findMany).not.toHaveBeenCalled();
    expect(t.evidenceUpdate).not.toHaveBeenCalled();
    expect(t.evidenceCreate).not.toHaveBeenCalled();
    expect(t.evidenceDeleteMany).not.toHaveBeenCalled();
  });

  // ── GUARDA DE INTEGRIDAD ──────────────────────────────────────────────────
  it('bloquea la baja de una evidencia que ya tiene valoraciones, sin escribir nada', async () => {
    const t = makeService({
      existing: [E('ev-1', 'A', 1), E('ev-2', 'B', 2)],
      valuations: [{ achievementEvidenceId: 'ev-2' }, { achievementEvidenceId: 'ev-2' }],
    });

    await expect(
      t.svc.updateAchievement('ach-1', {
        baseDescription: 'Propósito',
        evidences: [{ id: 'ev-1', text: 'A' }], // ev-2 retirada
      }),
    ).rejects.toThrow(/valoraciones registradas/i);

    // Aborta ANTES de escribir: nada aplicado a medias.
    expect(t.transaction).not.toHaveBeenCalled();
    expect(t.evidenceDeleteMany).not.toHaveBeenCalled();
  });

  it('permite retirar una evidencia que nunca fue valorada', async () => {
    const t = makeService({
      existing: [E('ev-1', 'A', 1), E('ev-2', 'B', 2)],
      valuations: [], // ninguna valoración apunta a ev-2
    });

    await t.svc.updateAchievement('ach-1', {
      baseDescription: 'Propósito',
      evidences: [{ id: 'ev-1', text: 'A' }],
    });

    expect(t.evidenceDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ['ev-2'] } } });
  });

  // ── TOLERANCIA A CLIENTES QUE NO ENVÍAN ID ────────────────────────────────
  it('un cliente que no envía ids no duplica el catálogo ni provoca bajas (empareja por texto)', async () => {
    const t = makeService({ existing: [E('ev-1', 'A', 1), E('ev-2', 'B', 2)] });

    await t.svc.updateAchievement('ach-1', {
      baseDescription: 'Propósito',
      evidences: [{ text: 'A' }, { text: 'B' }], // sin ids (payload legado)
    });

    expect(t.evidenceCreate).not.toHaveBeenCalled();
    expect(t.evidenceDeleteMany).not.toHaveBeenCalled();
  });

  // ── HIGIENE ───────────────────────────────────────────────────────────────
  it('descarta entradas vacías sin darlas de baja por error', async () => {
    const t = makeService({ existing: [E('ev-1', 'A', 1)], valuations: [] });

    await t.svc.updateAchievement('ach-1', {
      baseDescription: 'Propósito',
      evidences: [{ id: 'ev-1', text: '  A  ' }, { text: '   ' }],
    });

    expect(t.evidenceCreate).not.toHaveBeenCalled();
    expect(t.evidenceDeleteMany).not.toHaveBeenCalled();
  });
});

/**
 * Segundo camino de eliminación: `DELETE /achievements/evidences/:id`.
 * Produce exactamente la misma corrupción que el vector corregido arriba, así que
 * lleva la misma guarda. Sin esto, F1 dejaría abierta una puerta conocida.
 */
describe('AchievementService.deleteEvidence — guarda de integridad', () => {
  function makeService(opts: { evidence?: { achievementId: string; text: string } | null; valuations?: number }) {
    const evidenceDelete = jest.fn().mockResolvedValue({ id: 'ev-1' });
    const valuationCount = jest.fn().mockResolvedValue(opts.valuations ?? 0);
    const prisma: any = {
      achievementEvidence: {
        findUnique: jest.fn().mockResolvedValue(
          opts.evidence === undefined ? { achievementId: 'ach-1', text: 'Reconoce su nombre' } : opts.evidence,
        ),
        delete: evidenceDelete,
      },
      studentEvidenceValuation: { count: valuationCount },
    };
    return { svc: new AchievementService(prisma), evidenceDelete, valuationCount };
  }

  // ── CASO A ────────────────────────────────────────────────────────────────
  it('CASO A · evidencia sin valoraciones: se elimina', async () => {
    const t = makeService({ valuations: 0 });

    await t.svc.deleteEvidence('ev-1');

    expect(t.evidenceDelete).toHaveBeenCalledWith({ where: { id: 'ev-1' } });
  });

  // ── CASO B ────────────────────────────────────────────────────────────────
  it('CASO B · evidencia con una valoración: ConflictException y nada se borra', async () => {
    const t = makeService({ valuations: 1 });

    await expect(t.svc.deleteEvidence('ev-1')).rejects.toThrow(/valoración\(es\) académica\(s\)/i);

    expect(t.evidenceDelete).not.toHaveBeenCalled();
  });

  // ── CASO C ────────────────────────────────────────────────────────────────
  it('CASO C · valoraciones de varios estudiantes y períodos: ConflictException, cero borrados', async () => {
    const t = makeService({ valuations: 47 });

    await expect(t.svc.deleteEvidence('ev-1')).rejects.toThrow(/47/);

    expect(t.evidenceDelete).not.toHaveBeenCalled();
  });

  // ── CASO D ────────────────────────────────────────────────────────────────
  it('CASO D · valoraciones sólo de períodos anteriores: también bloquea (el conteo no filtra por período)', async () => {
    const t = makeService({ valuations: 3 });

    await expect(t.svc.deleteEvidence('ev-1')).rejects.toThrow();

    // La garantía real: el conteo NO lleva academicTermId. Historia de cualquier
    // período basta para bloquear.
    expect(t.valuationCount).toHaveBeenCalledWith({ where: { achievementEvidenceId: 'ev-1' } });
    expect(t.valuationCount.mock.calls[0][0].where).not.toHaveProperty('academicTermId');
    expect(t.evidenceDelete).not.toHaveBeenCalled();
  });

  it('evidencia inexistente: NotFound, sin consultar valoraciones', async () => {
    const t = makeService({ evidence: null });

    await expect(t.svc.deleteEvidence('ev-x')).rejects.toThrow(/no encontrado/i);

    expect(t.valuationCount).not.toHaveBeenCalled();
    expect(t.evidenceDelete).not.toHaveBeenCalled();
  });
});
