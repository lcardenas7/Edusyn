import {
  AchievementService,
  VALUATION_AUDIT_SOURCE,
  JUDGEMENT_AUDIT_SOURCE,
  OBSERVATION_AUDIT_SOURCE,
} from './achievement.service';

/**
 * Pieza 2 — auditoría del EJE CUALITATIVO.
 *
 * El hueco que esto cierra: hasta ahora se auditaba el *catálogo* de evidencias, pero no lo que
 * de verdad aparece en el boletín de un niño. Siete de las ocho escrituras cualitativas eran
 * silenciosas: se podía cambiar la valoración, el juicio o la observación de un estudiante sin
 * que quedara rastro de quién lo hizo ni de qué había antes.
 *
 * Dos reglas gobiernan todo lo que sigue:
 *   1. **El grano es el estudiante**, también en los lotes — porque la pregunta forense siempre
 *      se hace por estudiante, nunca por lote.
 *   2. **Auditar jamás bloquea.** Si el registro falla, el cambio académico ya se aplicó y el
 *      docente debe recibir su respuesta normal.
 */

const INST = 'inst-1';

function montar(over: any = {}) {
  const registrados: any[] = [];
  const actores: any[] = [];
  const gradeAudit: any = {
    record: jest.fn(async (e: any, a: any) => { registrados.push(e); actores.push(a); }),
    recordMany: jest.fn(async (es: any[], a: any) => { es.forEach((e) => { registrados.push(e); actores.push(a); }); }),
  };

  const prisma: any = {
    studentEnrollment: { findFirst: jest.fn(async () => ({ id: 'enr-1', institutionId: INST })), findMany: jest.fn(async () => []) },
    achievement: {
      findFirst: jest.fn(async () => ({ id: 'ach-1', institutionId: INST })),
      findUnique: jest.fn(async () => ({ id: 'ach-1', academicTermId: 'term-1', institutionId: INST })),
    },
    achievementEvidence: {
      findFirst: jest.fn(async () => ({ id: 'ev-1', achievement: { institutionId: INST } })),
      findUnique: jest.fn(async () => ({ id: 'ev-1', text: 'Reconoce las vocales', retiredFromTermId: null })),
    },
    academicTerm: { findFirst: jest.fn(async () => ({ id: 'term-1', order: 1 })), findUnique: jest.fn(async () => ({ id: 'term-1', order: 1 })) },
    studentEvidenceValuation: {
      findUnique: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
      upsert: jest.fn(async () => ({ id: 'sev-1' })),
      deleteMany: jest.fn(async () => ({ count: 1 })),
    },
    studentAchievement: {
      findFirst: jest.fn(async () => null),
      findUnique: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
      create: jest.fn(async ({ data }: any) => ({ id: 'sa-new', ...data })),
      update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
    },
    achievementConfig: { findUnique: jest.fn(async () => null) },
    ...over,
  };

  const svc = new AchievementService(prisma, gradeAudit);
  // `assertOwnership` ya tiene su propia batería de aislamiento; aquí interesa lo que se audita.
  jest.spyOn(svc as any, 'assertOwnership').mockResolvedValue(undefined);
  return { svc, prisma, gradeAudit, registrados, actores };
}

const ACTOR = { userId: 'u-9', name: 'rector@colegio.edu.co', role: 'ADMIN_INSTITUTIONAL' };

// ═══════════════════════════════════════════════════════════════════════════
// A · Valoración de un imprescindible
// ═══════════════════════════════════════════════════════════════════════════
describe('Eje cualitativo · valoración de imprescindibles', () => {
  const datos = {
    studentEnrollmentId: 'enr-1',
    achievementEvidenceId: 'ev-1',
    academicTermId: 'term-1',
    performanceLevel: 'ALTO' as any,
  };

  it('la carga inicial se registra como CREATE, sin exigir motivo', async () => {
    const { svc, registrados } = montar();
    await svc.upsertEvidenceValuation(datos, INST, ACTOR);

    expect(registrados).toHaveLength(1);
    expect(registrados[0]).toMatchObject({
      source: VALUATION_AUDIT_SOURCE,
      action: 'CREATE',
      institutionId: INST,
      studentEnrollmentId: 'enr-1',
      academicTermId: 'term-1',
      reason: null,
    });
    expect(registrados[0].previousValue).toBeNull();
  });

  it('una corrección posterior se registra como UPDATE y conserva lo que había', async () => {
    const f = montar({
      studentEvidenceValuation: {
        findUnique: jest.fn(async () => ({ id: 'sev-1', performanceLevel: 'BAJO', observation: 'texto viejo' })),
        findMany: jest.fn(async () => []),
        upsert: jest.fn(async () => ({ id: 'sev-1' })),
        deleteMany: jest.fn(async () => ({ count: 1 })),
      },
    });
    await f.svc.upsertEvidenceValuation({ ...datos, observation: 'texto nuevo' }, INST, ACTOR);

    expect(f.registrados[0]).toMatchObject({ action: 'UPDATE', recordId: 'sev-1' });
    expect(f.registrados[0].previousValue).toEqual({ performanceLevel: 'BAJO', observation: 'texto viejo' });
    expect(f.registrados[0].newValue).toMatchObject({ performanceLevel: 'ALTO', observation: 'texto nuevo' });
  });

  it('el motivo se registra cuando el usuario lo declara, y nunca se inventa', async () => {
    const conMotivo = montar();
    await conMotivo.svc.upsertEvidenceValuation({ ...datos, reason: 'Acta 12: error de digitación' }, INST, ACTOR);
    expect(conMotivo.registrados[0].reason).toBe('Acta 12: error de digitación');

    const sinMotivo = montar();
    await sinMotivo.svc.upsertEvidenceValuation(datos, INST, ACTOR);
    expect(sinMotivo.registrados[0].reason).toBeNull();
  });

  it('el borrado conserva la valoración que desaparece', async () => {
    const { svc, registrados } = montar({
      studentEvidenceValuation: {
        findUnique: jest.fn(async () => null),
        findMany: jest.fn(async () => [{ id: 'sev-7', performanceLevel: 'SUPERIOR', observation: 'muy bien' }]),
        upsert: jest.fn(),
        deleteMany: jest.fn(async () => ({ count: 1 })),
      },
    });

    await svc.deleteEvidenceValuation('enr-1', 'ev-1', 'term-1', INST, ACTOR, 'Se valoró al estudiante equivocado');

    expect(registrados[0]).toMatchObject({
      source: VALUATION_AUDIT_SOURCE,
      action: 'DELETE',
      recordId: 'sev-7',
      reason: 'Se valoró al estudiante equivocado',
      newValue: null,
    });
    expect(registrados[0].previousValue).toMatchObject({ performanceLevel: 'SUPERIOR', observation: 'muy bien' });
  });

  it('el borrado se lee ANTES de borrar: si no, no habría nada que conservar', async () => {
    const orden: string[] = [];
    const { svc } = montar({
      studentEvidenceValuation: {
        findUnique: jest.fn(async () => null),
        findMany: jest.fn(async () => { orden.push('lee'); return [{ id: 'sev-7', performanceLevel: 'ALTO', observation: null }]; }),
        upsert: jest.fn(),
        deleteMany: jest.fn(async () => { orden.push('borra'); return { count: 1 }; }),
      },
    });

    await svc.deleteEvidenceValuation('enr-1', 'ev-1', 'term-1', INST, ACTOR);

    expect(orden).toEqual(['lee', 'borra']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// B · Juicio valorativo del aprendizaje
// ═══════════════════════════════════════════════════════════════════════════
describe('Eje cualitativo · juicio valorativo', () => {
  const datos = {
    studentEnrollmentId: 'enr-1',
    achievementId: 'ach-1',
    academicTermId: 'term-1',
    performanceLevel: 'ALTO' as const,
  };

  it('crear un juicio queda como CREATE, sin estado previo', async () => {
    const { svc, registrados } = montar();
    await svc.upsertStudentAchievement(datos, INST, ACTOR);

    expect(registrados[0]).toMatchObject({
      source: JUDGEMENT_AUDIT_SOURCE,
      action: 'CREATE',
      studentEnrollmentId: 'enr-1',
      academicTermId: 'term-1',
    });
    expect(registrados[0].previousValue).toBeNull();
  });

  it('modificar un juicio existente conserva el texto anterior', async () => {
    const { svc, registrados } = montar({
      studentAchievement: {
        findFirst: jest.fn(async () => ({
          id: 'sa-1', institutionId: INST, performanceLevel: 'BAJO',
          approvedText: 'Texto anterior', isTextApproved: true, approvedJudgment: null,
          isJudgmentApproved: false, attitudinalText: null, observation: null,
        })),
        findUnique: jest.fn(async () => null),
        findMany: jest.fn(async () => []),
        create: jest.fn(),
        update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
      },
    });

    await svc.upsertStudentAchievement({ ...datos, approvedText: 'Texto corregido' }, INST, ACTOR);

    expect(registrados[0]).toMatchObject({ action: 'UPDATE', recordId: 'sa-1' });
    expect(registrados[0].previousValue).toMatchObject({ performanceLevel: 'BAJO', approvedText: 'Texto anterior' });
    expect(registrados[0].newValue).toMatchObject({ achievementId: 'ach-1', approvedText: 'Texto corregido' });
  });

  it('aprobar un juicio queda auditado como UPDATE — es el momento en que pasa al boletín', async () => {
    const { svc, registrados } = montar({
      studentAchievement: {
        findFirst: jest.fn(async () => null),
        findUnique: jest.fn(async () => ({
          id: 'sa-1', studentEnrollmentId: 'enr-1', achievementId: 'ach-1', academicTermId: 'term-1',
          approvedText: null, isTextApproved: false,
        })),
        findMany: jest.fn(async () => []),
        create: jest.fn(),
        update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
      },
    });

    await svc.approveStudentAchievement('sa-1', 'u-9', { approvedText: 'Alcanza el propósito' }, INST, ACTOR);

    expect(registrados[0]).toMatchObject({
      source: JUDGEMENT_AUDIT_SOURCE,
      action: 'UPDATE',
      recordId: 'sa-1',
      studentEnrollmentId: 'enr-1',
      academicTermId: 'term-1',
    });
    expect(registrados[0].newValue).toMatchObject({ approvedText: 'Alcanza el propósito', isTextApproved: true });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C · Observación escrita
// ═══════════════════════════════════════════════════════════════════════════
describe('Eje cualitativo · observaciones', () => {
  it('escribir la primera observación es CREATE; reescribirla es UPDATE', async () => {
    const vacia = montar({
      studentAchievement: {
        findFirst: jest.fn(async () => null), findMany: jest.fn(async () => []),
        findUnique: jest.fn(async () => ({ observation: null, studentEnrollmentId: 'enr-1', academicTermId: 'term-1' })),
        create: jest.fn(), update: jest.fn(async ({ where }: any) => ({ id: where.id })),
      },
    });
    await vacia.svc.updateStudentObservation('sa-1', 'Primera nota', INST, ACTOR);
    expect(vacia.registrados[0]).toMatchObject({ source: OBSERVATION_AUDIT_SOURCE, action: 'CREATE' });

    const escrita = montar({
      studentAchievement: {
        findFirst: jest.fn(async () => null), findMany: jest.fn(async () => []),
        findUnique: jest.fn(async () => ({ observation: 'Lo que decía antes', studentEnrollmentId: 'enr-1', academicTermId: 'term-1' })),
        create: jest.fn(), update: jest.fn(async ({ where }: any) => ({ id: where.id })),
      },
    });
    await escrita.svc.updateStudentObservation('sa-1', 'Lo que dice ahora', INST, ACTOR, 'Corrección solicitada por la familia');

    expect(escrita.registrados[0]).toMatchObject({ action: 'UPDATE', reason: 'Corrección solicitada por la familia' });
    expect(escrita.registrados[0].previousValue).toEqual({ observation: 'Lo que decía antes' });
    expect(escrita.registrados[0].newValue).toEqual({ observation: 'Lo que dice ahora' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D · Operaciones masivas — un evento por estudiante, batchId común
// ═══════════════════════════════════════════════════════════════════════════
describe('Eje cualitativo · operaciones masivas', () => {
  function montarAutoFill(filas: any[]) {
    return montar({
      achievementConfig: {
        findUnique: jest.fn(async () => ({
          observationTemplates: [
            { level: 'ALTO', template: 'Alcanza lo esperado', isActive: true },
            { level: 'BAJO', template: 'Requiere apoyo', isActive: true },
          ],
        })),
      },
      studentAchievement: {
        findFirst: jest.fn(async () => null),
        findUnique: jest.fn(async () => null),
        findMany: jest.fn(async () => filas),
        create: jest.fn(),
        update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
      },
    });
  }

  const filas = [
    { id: 'sa-1', performanceLevel: 'ALTO', observation: null, studentEnrollmentId: 'enr-1', academicTermId: 'term-1' },
    { id: 'sa-2', performanceLevel: 'BAJO', observation: 'algo previo', studentEnrollmentId: 'enr-2', academicTermId: 'term-1' },
  ];

  it('emite un evento POR ESTUDIANTE, no uno por lote', async () => {
    const { svc, registrados } = montarAutoFill(filas);
    await svc.autoFillObservations('ach-1', INST, ACTOR);

    expect(registrados).toHaveLength(2);
    expect(registrados.map((e) => e.studentEnrollmentId).sort()).toEqual(['enr-1', 'enr-2']);
    expect(registrados.map((e) => e.recordId).sort()).toEqual(['sa-1', 'sa-2']);
  });

  it('todos los eventos del lote comparten un mismo batchId', async () => {
    const { svc, registrados } = montarAutoFill(filas);
    await svc.autoFillObservations('ach-1', INST, ACTOR);

    const lotes = new Set(registrados.map((e) => e.batchId));
    expect(lotes.size).toBe(1);
    expect([...lotes][0]).toBeTruthy();
  });

  it('distingue dentro del mismo lote la carga inicial de la corrección', async () => {
    const { svc, registrados } = montarAutoFill(filas);
    await svc.autoFillObservations('ach-1', INST, ACTOR);

    const porRegistro = Object.fromEntries(registrados.map((e) => [e.recordId, e.action]));
    expect(porRegistro).toEqual({ 'sa-1': 'CREATE', 'sa-2': 'UPDATE' });
  });

  it('no audita a quien no se le cambió nada', async () => {
    // 'SUPERIOR' no tiene plantilla: esa fila no se actualiza, así que no debe generar evento.
    const { svc, registrados } = montarAutoFill([
      ...filas,
      { id: 'sa-3', performanceLevel: 'SUPERIOR', observation: null, studentEnrollmentId: 'enr-3', academicTermId: 'term-1' },
    ]);
    await svc.autoFillObservations('ach-1', INST, ACTOR);

    expect(registrados).toHaveLength(2);
    expect(registrados.map((e) => e.recordId)).not.toContain('sa-3');
  });

  it('la asignación masiva de aprendizajes también audita por estudiante con batchId común', async () => {
    const { svc, registrados } = montar({
      performanceScale: { findMany: jest.fn(async () => [{ level: 'ALTO', minScore: 4, maxScore: 5 }]) },
      achievement: {
        findFirst: jest.fn(async () => ({ id: 'ach-1', institutionId: INST })),
        findUnique: jest.fn(async () => ({ id: 'ach-1', academicTermId: 'term-1', subjectId: 's1', teacherAssignment: null })),
      },
      periodFinalGrade: { findMany: jest.fn(async () => []) },
    });

    await svc.bulkAssignAchievement('ach-1', ['enr-1', 'enr-2', 'enr-3'], INST, 'term-1', ACTOR);

    expect(registrados).toHaveLength(3);
    expect(new Set(registrados.map((e) => e.batchId)).size).toBe(1);
    expect(registrados.every((e) => e.source === JUDGEMENT_AUDIT_SOURCE)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// E · Actor, institución y resistencia al fallo
// ═══════════════════════════════════════════════════════════════════════════
describe('Eje cualitativo · actor, tenant y tolerancia a fallos', () => {
  it('cada evento lleva el actor que hizo el cambio', async () => {
    const { svc, actores } = montar();
    await svc.upsertEvidenceValuation(
      { studentEnrollmentId: 'enr-1', achievementEvidenceId: 'ev-1', academicTermId: 'term-1', performanceLevel: 'ALTO' as any },
      INST, ACTOR,
    );
    expect(actores[0]).toEqual(ACTOR);
  });

  it('el institutionId del evento es el del ACTOR, no uno derivado del cuerpo', async () => {
    const { svc, registrados } = montar();
    await svc.upsertStudentAchievement(
      { studentEnrollmentId: 'enr-1', achievementId: 'ach-1', academicTermId: 'term-1', performanceLevel: 'ALTO' },
      INST, ACTOR,
    );
    expect(registrados[0].institutionId).toBe(INST);
  });

  it('si la auditoría revienta, la operación académica NO falla', async () => {
    const { svc, gradeAudit } = montar();
    gradeAudit.recordMany.mockRejectedValue(new Error('base caída'));
    jest.spyOn((svc as any).logger, 'error').mockImplementation(() => {});

    await expect(
      svc.upsertStudentAchievement(
        { studentEnrollmentId: 'enr-1', achievementId: 'ach-1', academicTermId: 'term-1', performanceLevel: 'ALTO' },
        INST, ACTOR,
      ),
    ).resolves.toBeTruthy();
  });

  it('un fallo de auditoría deja constancia en el log del sistema', async () => {
    const { svc, gradeAudit } = montar();
    gradeAudit.recordMany.mockRejectedValue(new Error('base caída'));
    const log = jest.spyOn((svc as any).logger, 'error').mockImplementation(() => {});

    await svc.updateStudentObservation('sa-1', 'texto', INST, ACTOR);

    expect(log).toHaveBeenCalled();
    expect(String(log.mock.calls[0][0])).toContain('SÍ se aplicaron');
  });

  it('sin servicio de auditoría inyectado, todo sigue funcionando', async () => {
    const { prisma } = montar();
    const svc = new AchievementService(prisma);
    jest.spyOn(svc as any, 'assertOwnership').mockResolvedValue(undefined);

    await expect(svc.updateStudentObservation('sa-1', 'texto', INST)).resolves.toBeTruthy();
  });
});
