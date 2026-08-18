import { ReportsService } from './reports.service';

/**
 * C-1 · Cierre de períodos con grados DIMENSIONS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Antes: `validateTermGrades` medía la completitud con un único predicado —existe
 * `PeriodFinalGrade`— para todas las modalidades. Transición nunca lo produce, así que
 * un solo grupo de preescolar dejaba `isComplete = false` y **bloqueaba el cierre del
 * período para toda la institución**.
 *
 * Después: despacho por `Grade.academicStructure`. El camino cuantitativo queda
 * intacto; `DIMENSIONS` se resuelve con el MISMO helper que usa `getCompletenessStatus`
 * (C-2), de modo que panel y cierre no puedan discrepar.
 *
 * Los bloques [CONTRATO CUANTITATIVO] son la red de no regresión para las
 * instituciones con datos reales: deben pasar siempre.
 */

const student = (lastName: string) => ({ lastName, firstName: 'X', secondName: null, secondLastName: null });

/**
 * Arnés CUANTITATIVO. Los modelos cualitativos se omiten a propósito: si el camino
 * cuantitativo los tocara, la prueba reventaría por método inexistente.
 */
function quantitativeService(opts: {
  structure?: string;
  enrollments?: any[];
  subjects?: any[];
  finalGrades?: any[];
  status?: string;
} = {}) {
  const prisma: any = {
    academicTerm: {
      findUnique: jest.fn().mockResolvedValue({
        id: 't1', order: 1, status: opts.status ?? 'OPEN', academicYearId: 'y1',
        academicYear: { id: 'y1', institutionId: 'inst-1' },
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    group: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'g1', name: '5A', grade: { id: 'gr1', academicStructure: opts.structure ?? 'AREAS_SUBJECTS' } },
      ]),
    },
    teacherAssignment: {
      findMany: jest.fn().mockResolvedValue(opts.subjects ?? [{ subjectId: 'mat', subject: { name: 'Matemáticas' } }]),
    },
    studentEnrollment: {
      findMany: jest.fn().mockResolvedValue(opts.enrollments ?? [{ id: 'e1', student: student('PEREZ') }]),
    },
    periodFinalGrade: { findMany: jest.fn().mockResolvedValue(opts.finalGrades ?? []) },
  };
  const svc = new ReportsService(prisma, null as any, null as any, null as any, null as any, null as any, null as any, null as any);
  return { svc, prisma };
}

/** Arnés CUALITATIVO: grupo DIMENSIONS con catálogo y valoraciones. */
function qualitativeService(opts: {
  valuationScope?: 'PURPOSE' | 'EVIDENCE';
  achievements?: any[];
  studentAchievements?: any[];
  evidenceValuations?: any[];
  enrollments?: any[];
  retirementTerms?: any[];
  status?: string;
} = {}) {
  const enrollments = opts.enrollments ?? [{ id: 'e1', student: student('PEREZ') }];
  const prisma: any = {
    academicTerm: {
      findUnique: jest.fn().mockResolvedValue({
        id: 't2', order: 2, status: opts.status ?? 'OPEN', academicYearId: 'y1',
        academicYear: { id: 'y1', institutionId: 'inst-1' },
      }),
      findMany: jest.fn().mockResolvedValue(opts.retirementTerms ?? []),
      update: jest.fn().mockResolvedValue({}),
    },
    group: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'g1', name: 'Transición A', grade: { id: 'gr-pre', academicStructure: 'DIMENSIONS' } },
      ]),
    },
    teacherAssignment: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'ta1', subjectId: 'dim-com', subject: { name: 'Dimensión Comunicativa' } },
      ]),
    },
    studentEnrollment: { findMany: jest.fn().mockResolvedValue(enrollments) },
    periodFinalGrade: { findMany: jest.fn().mockResolvedValue([]) },
    achievementConfig: { findUnique: jest.fn().mockResolvedValue({ valuationScope: opts.valuationScope ?? 'PURPOSE' }) },
    achievement: { findMany: jest.fn().mockResolvedValue(opts.achievements ?? []) },
    studentAchievement: { findMany: jest.fn().mockResolvedValue(opts.studentAchievements ?? []) },
    studentEvidenceValuation: { findMany: jest.fn().mockResolvedValue(opts.evidenceValuations ?? []) },
  };
  const svc = new ReportsService(prisma, null as any, null as any, null as any, null as any, null as any, null as any, null as any);
  return { svc, prisma };
}

const proposito = (id: string, evidences: any[] = []) => ({
  id, subjectId: 'dim-com', academicTermId: null, teacherAssignment: null, evidences,
});

// ═══════════════════════════════════════════════════════════════════════════
// A · [CONTRATO CUANTITATIVO] — la barrera contra regresiones
// ═══════════════════════════════════════════════════════════════════════════
describe('C-1 · A · [CONTRATO CUANTITATIVO] AREAS_SUBJECTS', () => {
  it('REQ 1 · el predicado sigue siendo la existencia de PeriodFinalGrade', async () => {
    const { svc, prisma } = quantitativeService({
      enrollments: [{ id: 'e1', student: student('PEREZ') }, { id: 'e2', student: student('GOMEZ') }],
      finalGrades: [{ studentEnrollmentId: 'e1', subjectId: 'mat' }],
    });

    const r = await svc.validateTermGrades('t1');

    expect(prisma.periodFinalGrade.findMany).toHaveBeenCalledTimes(1);
    expect(r.totalExpected).toBe(2);
    expect(r.totalFound).toBe(1);
    expect(r.completionPercent).toBe(50);
    expect(r.isComplete).toBe(false);
  });

  it('REQ 12 · NUNCA entra en la rama cualitativa', async () => {
    const { svc, prisma } = quantitativeService();

    await svc.validateTermGrades('t1');

    // Ninguno de estos modelos existe en el mock: si el camino cuantitativo los
    // tocara, la llamada reventaría. Ésta es la barrera principal para las
    // instituciones que ya tienen datos académicos reales.
    expect((prisma as any).achievementConfig).toBeUndefined();
    expect((prisma as any).achievement).toBeUndefined();
    expect((prisma as any).studentAchievement).toBeUndefined();
    expect((prisma as any).studentEvidenceValuation).toBeUndefined();
  });

  it('REQ 9 y 10 · el universo sigue siendo TeacherAssignment × matrículas ACTIVE', async () => {
    const { svc, prisma } = quantitativeService();

    await svc.validateTermGrades('t1');

    expect(prisma.teacherAssignment.findMany).toHaveBeenCalled();
    expect(prisma.studentEnrollment.findMany.mock.calls[0][0].where.status).toBe('ACTIVE');
    // Prohibido en C-1 (pertenece a F4/R-2/A-2).
    expect((prisma as any).enrollmentSubject).toBeUndefined();
    expect((prisma as any).enrollmentArea).toBeUndefined();
  });

  it('SUBJECTS_ONLY también usa el camino cuantitativo', async () => {
    const { svc, prisma } = quantitativeService({
      structure: 'SUBJECTS_ONLY',
      finalGrades: [{ studentEnrollmentId: 'e1', subjectId: 'mat' }],
    });

    const r = await svc.validateTermGrades('t1');

    expect(prisma.periodFinalGrade.findMany).toHaveBeenCalledTimes(1);
    expect(r.isComplete).toBe(true);
  });

  it('un estudiante incompleto mantiene isComplete = false, con detalle', async () => {
    const { svc } = quantitativeService({ finalGrades: [] });

    const r = await svc.validateTermGrades('t1');

    expect(r.isComplete).toBe(false);
    expect(r.missing[0]).toEqual({ group: '5A', student: 'PEREZ X', subject: 'Matemáticas' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// B · DIMENSIONS + PURPOSE
// ═══════════════════════════════════════════════════════════════════════════
describe('C-1 · B · DIMENSIONS + PURPOSE', () => {
  it('REQ 2 · usa StudentAchievement y NO PeriodFinalGrade como criterio', async () => {
    const { svc, prisma } = qualitativeService({
      valuationScope: 'PURPOSE',
      achievements: [proposito('ach-1')],
      studentAchievements: [{ studentEnrollmentId: 'e1', achievementId: 'ach-1', academicTermId: 't2' }],
    });

    const r = await svc.validateTermGrades('t2');

    expect(prisma.studentAchievement.findMany).toHaveBeenCalled();
    // El grupo DIMENSIONS se aparta antes de consultar notas finales.
    expect(prisma.periodFinalGrade.findMany).not.toHaveBeenCalled();
    expect(r.isComplete).toBe(true);
    expect(r.totalExpected).toBe(1);
    expect(r.totalFound).toBe(1);
  });

  it('un propósito sin valorar deja el período incompleto, con el nombre de la dimensión', async () => {
    const { svc } = qualitativeService({
      valuationScope: 'PURPOSE',
      achievements: [proposito('ach-1')],
      studentAchievements: [],
    });

    const r = await svc.validateTermGrades('t2');

    expect(r.isComplete).toBe(false);
    expect(r.missing[0]).toEqual({ group: 'Transición A', student: 'PEREZ X', subject: 'Dimensión Comunicativa' });
  });

  it('exige TODOS los propósitos de la dimensión', async () => {
    const { svc } = qualitativeService({
      valuationScope: 'PURPOSE',
      achievements: [proposito('ach-1'), proposito('ach-2')],
      studentAchievements: [{ studentEnrollmentId: 'e1', achievementId: 'ach-1', academicTermId: 't2' }],
    });

    const r = await svc.validateTermGrades('t2');

    expect(r.isComplete).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C · DIMENSIONS + EVIDENCE
// ═══════════════════════════════════════════════════════════════════════════
describe('C-1 · C · DIMENSIONS + EVIDENCE', () => {
  it('REQ 3 · usa StudentEvidenceValuation, no PeriodFinalGrade', async () => {
    const { svc, prisma } = qualitativeService({
      valuationScope: 'EVIDENCE',
      achievements: [proposito('ach-1', [{ id: 'ev-1', retiredFromTermId: null }])],
      evidenceValuations: [{ studentEnrollmentId: 'e1', achievementEvidenceId: 'ev-1', academicTermId: 't2' }],
    });

    const r = await svc.validateTermGrades('t2');

    expect(prisma.studentEvidenceValuation.findMany).toHaveBeenCalled();
    expect(prisma.periodFinalGrade.findMany).not.toHaveBeenCalled();
    expect(r.isComplete).toBe(true);
  });

  it('REQ 5 · una evidencia VIGENTE sin valorar SÍ bloquea el cierre', async () => {
    const { svc } = qualitativeService({
      valuationScope: 'EVIDENCE',
      achievements: [proposito('ach-1', [{ id: 'ev-1', retiredFromTermId: null }])],
      evidenceValuations: [],
    });

    const r = await svc.validateTermGrades('t2');

    expect(r.isComplete).toBe(false);
    expect(r.totalMissing).toBe(1);
  });

  it('REQ 4 · una evidencia RETIRADA desde este período NO bloquea', async () => {
    const { svc } = qualitativeService({
      valuationScope: 'EVIDENCE',
      // Retirada desde t2 (order 2) → no vigente en t2.
      achievements: [proposito('ach-1', [{ id: 'ev-1', retiredFromTermId: 't2' }])],
      evidenceValuations: [],
      retirementTerms: [{ id: 't2', order: 2 }],
    });

    const r = await svc.validateTermGrades('t2');

    expect(r.isComplete).toBe(true);
  });

  it('REQ 4 · una evidencia retirada en un período ANTERIOR tampoco bloquea', async () => {
    const { svc, prisma } = qualitativeService({
      valuationScope: 'EVIDENCE',
      // Retirada desde t1 (order 1); se valida t2 (order 2) → ya no es vigente.
      achievements: [proposito('ach-1', [{ id: 'ev-1', retiredFromTermId: 't1' }])],
      evidenceValuations: [],
      retirementTerms: [{ id: 't1', order: 1 }],
    });

    const r = await svc.validateTermGrades('t2');

    // Al validar UN solo período, el orden del término de retiro no está entre los
    // consultados: hay que resolverlo aparte o la regla falla ABIERTO y bloquea.
    expect(prisma.academicTerm.findMany).toHaveBeenCalled();
    expect(r.isComplete).toBe(true);
  });

  it('sólo las evidencias vigentes cuentan: mezcla de retirada y vigente', async () => {
    const { svc } = qualitativeService({
      valuationScope: 'EVIDENCE',
      achievements: [proposito('ach-1', [
        { id: 'ev-1', retiredFromTermId: null },  // vigente
        { id: 'ev-2', retiredFromTermId: 't1' },  // retirada antes
      ])],
      evidenceValuations: [{ studentEnrollmentId: 'e1', achievementEvidenceId: 'ev-1', academicTermId: 't2' }],
      retirementTerms: [{ id: 't1', order: 1 }],
    });

    const r = await svc.validateTermGrades('t2');

    // Basta con haber valorado la vigente.
    expect(r.isComplete).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D · closeTerm
// ═══════════════════════════════════════════════════════════════════════════
describe('C-1 · D · closeTerm', () => {
  it('REQ 6 y 8 · [CONTRATO] incompletitud impide cerrar y no escribe', async () => {
    const { svc, prisma } = qualitativeService({
      valuationScope: 'EVIDENCE',
      achievements: [proposito('ach-1', [{ id: 'ev-1', retiredFromTermId: null }])],
      evidenceValuations: [],
    });

    await expect(svc.closeTerm('t2')).rejects.toThrow(/Faltan .* notas/);

    expect(prisma.academicTerm.update).not.toHaveBeenCalled();
  });

  it('REQ 7 · un período de Transición COMPLETO ya puede cerrarse', async () => {
    const { svc, prisma } = qualitativeService({
      valuationScope: 'EVIDENCE',
      achievements: [proposito('ach-1', [{ id: 'ev-1', retiredFromTermId: null }])],
      evidenceValuations: [{ studentEnrollmentId: 'e1', achievementEvidenceId: 'ev-1', academicTermId: 't2' }],
    });

    const r = await svc.closeTerm('t2');

    expect(r.newStatus).toBe('CLOSED');
    expect(prisma.academicTerm.update).toHaveBeenCalledWith({ where: { id: 't2' }, data: { status: 'CLOSED' } });
  });

  it('[CONTRATO] el cuantitativo incompleto sigue impidiendo el cierre', async () => {
    const { svc, prisma } = quantitativeService({ finalGrades: [] });

    await expect(svc.closeTerm('t1')).rejects.toThrow();

    expect(prisma.academicTerm.update).not.toHaveBeenCalled();
  });

  it('[CONTRATO] sólo se cierra desde OPEN, sin consultar nada antes', async () => {
    for (const status of ['CLOSED', 'FINALIZED', 'DRAFT']) {
      const { svc, prisma } = quantitativeService({ status, finalGrades: [] });

      await expect(svc.closeTerm('t1')).rejects.toThrow(/OPEN/);

      expect(prisma.periodFinalGrade.findMany).not.toHaveBeenCalled();
      expect(prisma.academicTerm.update).not.toHaveBeenCalled();
    }
  });

  it('[CONTRATO] closeTerm no añade escrituras ni auditoría', async () => {
    const { svc, prisma } = quantitativeService({ finalGrades: [{ studentEnrollmentId: 'e1', subjectId: 'mat' }] });

    await svc.closeTerm('t1');

    // El único modelo con escritura es academicTerm, y sólo cambia el status.
    expect(prisma.academicTerm.update.mock.calls[0][0].data).toEqual({ status: 'CLOSED' });
    expect((prisma as any).gradeAuditEvent).toBeUndefined();
    expect((prisma as any).termReportCardSnapshot).toBeUndefined();
    expect((prisma as any).$transaction).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// E · isFailing no participa en el cierre (hallazgo separado, sin corregir)
// ═══════════════════════════════════════════════════════════════════════════
describe('C-1 · E · isFailing es ajeno al cierre', () => {
  it('validar y cerrar funcionan sin InstitutionContextService inyectado', async () => {
    // El arnés pasa `null` como institutionContext. Si el cierre dependiera de
    // `isFailing` —que necesita ese contexto— estas llamadas reventarían.
    const { svc } = quantitativeService({ finalGrades: [{ studentEnrollmentId: 'e1', subjectId: 'mat' }] });

    await expect(svc.validateTermGrades('t1')).resolves.toBeDefined();
    await expect(svc.closeTerm('t1')).resolves.toBeDefined();
  });
});
