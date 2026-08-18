import { ReportsService } from './reports.service';

/**
 * F0-MÍNIMO · PRUEBAS DE CARACTERIZACIÓN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Estas pruebas NO afirman lo que el sistema DEBERÍA hacer. Fijan lo que HACE HOY,
 * para poder demostrar más adelante —al implementar C-1, C-2 y C-4— que el
 * comportamiento CUANTITATIVO no cambió.
 *
 * Los cuatro servicios cubiertos aquí tenían cobertura CERO. Son exactamente los
 * que C-1/C-2/C-4 necesitan modificar:
 *
 *   C-1 → validateTermGrades · closeTerm
 *   C-2 → getCompletenessStatus
 *   C-4 → finalizeTerm (buildGroupReportCards se sustituye por un doble)
 *
 * Varias aserciones congelan comportamiento DEFECTUOSO a propósito: están marcadas
 * con [DEFECTO CONGELADO]. Cuando se corrija el defecto, esa prueba DEBE fallar y
 * actualizarse conscientemente. Ese fallo es la señal, no un accidente.
 *
 * Ninguna prueba toca base de datos: todo es Prisma simulado.
 */

// ── Arnés ────────────────────────────────────────────────────────────────────
// Mismo patrón que reports.failed-subjects.spec.ts: sólo se inyectan los deps
// que el camino bajo prueba realmente usa.
function makeService(prisma: any, extra: { institutionContext?: any } = {}) {
  const institutionContext: any = extra.institutionContext ?? {
    getContext: jest.fn().mockResolvedValue({ academicStructure: 'AREAS_SUBJECTS', minPassingGrade: 3.0 }),
  };
  return new ReportsService(
    prisma,
    null as any, // studentGradesService
    null as any, // attendanceService
    null as any, // studentsService
    null as any, // academicYearService
    institutionContext,
    null as any, // storageService
    null as any, // academicDataSource
  );
}

const student = (lastName: string, firstName: string) => ({
  lastName, firstName, secondLastName: null, secondName: null,
});

// ═══════════════════════════════════════════════════════════════════════════
// 1 · validateTermGrades  (base de C-1)
// ═══════════════════════════════════════════════════════════════════════════
describe('F0 · validateTermGrades — línea base', () => {
  function prismaFor(opts: {
    enrollments?: any[];
    subjects?: any[];
    grades?: any[];
  } = {}) {
    return {
      academicTerm: {
        findUnique: jest.fn().mockResolvedValue({
          id: 't1', academicYearId: 'y1', academicYear: { id: 'y1', institutionId: 'inst-1' },
        }),
      },
      group: { findMany: jest.fn().mockResolvedValue([{ id: 'g1', name: '5A' }]) },
      teacherAssignment: {
        findMany: jest.fn().mockResolvedValue(
          opts.subjects ?? [{ subjectId: 'mat', subject: { name: 'Matemáticas' } }],
        ),
      },
      studentEnrollment: {
        findMany: jest.fn().mockResolvedValue(
          opts.enrollments ?? [{ id: 'e1', student: student('PEREZ', 'JUAN') }],
        ),
      },
      periodFinalGrade: { findMany: jest.fn().mockResolvedValue(opts.grades ?? []) },
    } as any;
  }

  it('CUANTITATIVO · universo = matrículas ACTIVE × asignaturas de TeacherAssignment', async () => {
    const prisma = prismaFor({
      enrollments: [{ id: 'e1', student: student('PEREZ', 'JUAN') }, { id: 'e2', student: student('GOMEZ', 'ANA') }],
      subjects: [{ subjectId: 'mat', subject: { name: 'Matemáticas' } }, { subjectId: 'len', subject: { name: 'Lengua' } }],
      grades: [{ studentEnrollmentId: 'e1', subjectId: 'mat' }],
    });

    const r = await makeService(prisma).validateTermGrades('t1');

    expect(r.totalExpected).toBe(4); // 2 estudiantes × 2 asignaturas
    expect(r.totalFound).toBe(1);
    expect(r.totalMissing).toBe(3);
    expect(r.completionPercent).toBe(25);
    expect(r.isComplete).toBe(false);
  });

  it('CUANTITATIVO · isComplete=true y 100 % cuando no falta ninguna nota', async () => {
    const prisma = prismaFor({ grades: [{ studentEnrollmentId: 'e1', subjectId: 'mat' }] });

    const r = await makeService(prisma).validateTermGrades('t1');

    expect(r.isComplete).toBe(true);
    expect(r.completionPercent).toBe(100);
    expect(r.missing).toEqual([]);
  });

  it('CUANTITATIVO · predicado ÚNICO = existe PeriodFinalGrade(enrollment, subject)', async () => {
    const prisma = prismaFor();

    await makeService(prisma).validateTermGrades('t1');

    // El único origen consultado para decidir "completo" es PeriodFinalGrade.
    expect(prisma.periodFinalGrade.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.studentEnrollment.findMany.mock.calls[0][0].where.status).toBe('ACTIVE');
  });

  it('CUANTITATIVO · sin universo (0 estudiantes o 0 asignaturas) el grupo se omite y da 100 %', async () => {
    const prisma = prismaFor({ enrollments: [], subjects: [] });

    const r = await makeService(prisma).validateTermGrades('t1');

    expect(r.totalExpected).toBe(0);
    expect(r.completionPercent).toBe(100); // 100 % por ausencia de universo, no por mérito
    expect(r.isComplete).toBe(true);
  });

  it('CUANTITATIVO · la lista de faltantes se corta en 100 y marca hasMore', async () => {
    const enrollments = Array.from({ length: 101 }, (_, i) => ({ id: `e${i}`, student: student(`AP${i}`, 'X') }));
    const prisma = prismaFor({ enrollments, grades: [] });

    const r = await makeService(prisma).validateTermGrades('t1');

    expect(r.totalMissing).toBe(101);
    expect(r.missing).toHaveLength(100);
    expect(r.hasMore).toBe(true);
  });

  // Antes [DEFECTO CONGELADO · C-1]: el servicio era ciego a `Grade.academicStructure`
  // y medía un grupo DIMENSIONS con el predicado cuantitativo. C-1 (2026-08-16) añade
  // el despacho por estructura; la prueba se convirtió para fijar el comportamiento nuevo.
  it('[CORREGIDO por C-1] el servicio LEE Grade.academicStructure para despachar', async () => {
    const prisma = prismaFor({ grades: [] });

    await makeService(prisma).validateTermGrades('t1');

    const groupArgs = JSON.stringify(prisma.group.findMany.mock.calls[0][0]);
    expect(groupArgs).toContain('academicStructure');
    // Un grupo sin estructura DIMENSIONS sigue por el camino cuantitativo, y por tanto
    // no se consulta ninguna fuente cualitativa (los modelos ni existen en el mock).
    expect((prisma as any).studentAchievement).toBeUndefined();
    expect((prisma as any).studentEvidenceValuation).toBeUndefined();
    expect((prisma as any).achievementConfig).toBeUndefined();
  });

  it('lanza NotFound si el período no existe', async () => {
    const prisma = prismaFor();
    prisma.academicTerm.findUnique.mockResolvedValue(null);

    await expect(makeService(prisma).validateTermGrades('t1')).rejects.toThrow(/no encontrado/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2 · closeTerm  (base de C-1)
// ═══════════════════════════════════════════════════════════════════════════
describe('F0 · closeTerm — línea base', () => {
  function prismaFor(status: string, grades: any[]) {
    return {
      academicTerm: {
        findUnique: jest.fn().mockResolvedValue({
          id: 't1', status, academicYearId: 'y1', academicYear: { id: 'y1', institutionId: 'inst-1' },
        }),
        update: jest.fn().mockResolvedValue({ id: 't1' }),
      },
      group: { findMany: jest.fn().mockResolvedValue([{ id: 'g1', name: '5A' }]) },
      teacherAssignment: { findMany: jest.fn().mockResolvedValue([{ subjectId: 'mat', subject: { name: 'Matemáticas' } }]) },
      studentEnrollment: { findMany: jest.fn().mockResolvedValue([{ id: 'e1', student: student('PEREZ', 'JUAN') }]) },
      periodFinalGrade: { findMany: jest.fn().mockResolvedValue(grades) },
    } as any;
  }

  it('CUANTITATIVO · OPEN + completo → CLOSED', async () => {
    const prisma = prismaFor('OPEN', [{ studentEnrollmentId: 'e1', subjectId: 'mat' }]);

    const r = await makeService(prisma).closeTerm('t1');

    expect(r.newStatus).toBe('CLOSED');
    expect(prisma.academicTerm.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { status: 'CLOSED' } });
  });

  it('CUANTITATIVO · OPEN + incompleto → BadRequest y NO cambia de estado', async () => {
    const prisma = prismaFor('OPEN', []);

    await expect(makeService(prisma).closeTerm('t1')).rejects.toThrow();
    expect(prisma.academicTerm.update).not.toHaveBeenCalled();
  });

  it('CUANTITATIVO · sólo se puede cerrar desde OPEN', async () => {
    for (const status of ['CLOSED', 'FINALIZED', 'DRAFT']) {
      const prisma = prismaFor(status, [{ studentEnrollmentId: 'e1', subjectId: 'mat' }]);
      await expect(makeService(prisma).closeTerm('t1')).rejects.toThrow(/OPEN/);
      expect(prisma.academicTerm.update).not.toHaveBeenCalled();
    }
  });

  it('[DEFECTO CONGELADO] cerrar NO registra actor ni fecha', async () => {
    const prisma = prismaFor('OPEN', [{ studentEnrollmentId: 'e1', subjectId: 'mat' }]);

    await makeService(prisma).closeTerm('t1');

    // El payload del update contiene EXCLUSIVAMENTE el status: no hay closedById
    // ni closedAt, a diferencia de RecoveryPeriodConfig, que sí los tiene.
    expect(prisma.academicTerm.update.mock.calls[0][0].data).toEqual({ status: 'CLOSED' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3 · getCompletenessStatus  (base de C-2)
// ═══════════════════════════════════════════════════════════════════════════
describe('F0 · getCompletenessStatus — línea base', () => {
  function prismaFor(opts: { achievements?: any[]; grades?: any[] } = {}) {
    return {
      academicTerm: { findMany: jest.fn().mockResolvedValue([{ id: 't1', name: 'P1', status: 'OPEN', order: 1 }]) },
      group: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'g1', name: 'A', grade: { name: '5', stage: 'BASICA_PRIMARIA' }, _count: { studentEnrollments: 2 } },
        ]),
      },
      teacherAssignment: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'ta1', groupId: 'g1', subjectId: 'mat', subject: { name: 'Matemáticas' }, teacher: { firstName: 'Ana', lastName: 'Ruiz' } },
        ]),
      },
      periodFinalGrade: {
        findMany: jest.fn().mockResolvedValue(
          opts.grades ?? [{ studentEnrollmentId: 'e1', subjectId: 'mat', academicTermId: 't1', studentEnrollment: { groupId: 'g1' } }],
        ),
      },
      studentAchievement: { findMany: jest.fn().mockResolvedValue(opts.achievements ?? []) },
      studentEnrollment: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'e1', groupId: 'g1', student: { id: 's1', ...student('PEREZ', 'JUAN') } },
          { id: 'e2', groupId: 'g1', student: { id: 's2', ...student('GOMEZ', 'ANA') } },
        ]),
      },
    } as any;
  }

  it('CUANTITATIVO · dos ejes independientes: notas y aprendizajes', async () => {
    const prisma = prismaFor();

    const r: any = await makeService(prisma).getCompletenessStatus('inst-1', 'y1');

    const subject = r.groups[0].subjects[0];
    expect(subject.terms[0].studentsWithGrade).toBe(1);
    expect(subject.terms[0].missingGradeCount).toBe(1);
    expect(subject.terms[0].gradeCompleteness).toBe(50);
    expect(subject.terms[0].achievementCompleteness).toBe(0);
    expect(r.summary.overallGradeCompleteness).toBe(50);
  });

  it('CUANTITATIVO · identifica por nombre a los estudiantes faltantes', async () => {
    const prisma = prismaFor();

    const r: any = await makeService(prisma).getCompletenessStatus('inst-1', 'y1');

    const missing = r.groups[0].subjects[0].terms[0].missingGradeStudents;
    expect(missing).toHaveLength(1);
    expect(missing[0]).toEqual({ enrollmentId: 'e2', name: 'GOMEZ ANA' });
  });

  it('CUANTITATIVO · el responsable se expone por asignatura, sin agregación por docente', async () => {
    const prisma = prismaFor();

    const r: any = await makeService(prisma).getCompletenessStatus('inst-1', 'y1');

    expect(r.groups[0].subjects[0].teacherName).toBe('Ana Ruiz');
    expect(r).not.toHaveProperty('teachers'); // no existe vista por docente
  });

  it('[DEFECTO CONGELADO · C-2a] el eje de aprendizajes EXIGE achievement.teacherAssignment', async () => {
    const prisma = prismaFor();

    await makeService(prisma).getCompletenessStatus('inst-1', 'y1');

    const where = prisma.studentAchievement.findMany.mock.calls[0][0].where;
    // El catálogo compartido de Transición tiene teacherAssignmentId = null y
    // academicTermId = null, así que NUNCA satisface este filtro → 0 % permanente.
    expect(where.achievement.teacherAssignment).toBeDefined();
    expect(where.achievement.academicTermId).toEqual({ in: ['t1'] });
  });

  it('[DEFECTO CONGELADO · C-2b] StudentEvidenceValuation NO se consulta jamás', async () => {
    const prisma = prismaFor();

    await makeService(prisma).getCompletenessStatus('inst-1', 'y1');

    // En modo EVIDENCE no existe eje que medir: la tabla ni siquiera está en el mock,
    // y el servicio funciona igual — prueba de que nunca la toca.
    expect((prisma as any).studentEvidenceValuation).toBeUndefined();
  });

  it('[DEFECTO CONGELADO] AchievementConfig.valuationScope no se consulta', async () => {
    const prisma = prismaFor();

    await makeService(prisma).getCompletenessStatus('inst-1', 'y1');

    expect((prisma as any).achievementConfig).toBeUndefined();
  });

  it('lanza NotFound si el año no tiene períodos', async () => {
    const prisma = prismaFor();
    prisma.academicTerm.findMany.mockResolvedValue([]);

    await expect(makeService(prisma).getCompletenessStatus('inst-1', 'y1')).rejects.toThrow(/períodos/i);
  });

  it('devuelve resumen vacío si no hay grupos con matrícula activa', async () => {
    const prisma = prismaFor();
    prisma.group.findMany.mockResolvedValue([]);

    const r: any = await makeService(prisma).getCompletenessStatus('inst-1', 'y1');

    expect(r.groups).toEqual([]);
    expect(r.summary.totalGroups).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4 · finalizeTerm  (base de C-4)
// ═══════════════════════════════════════════════════════════════════════════
describe('F0 · finalizeTerm — línea base', () => {
  const card = (enrollmentId: string, grades: Array<number | null>, calculationType = 'AVERAGE') => ({
    enrollmentId,
    student: { id: 's', firstName: 'X', lastName: 'Y' },
    group: { id: 'g1', name: 'A', gradeLevel: '5' },
    areaGrades: [{ area: 'Matemáticas', calculationType, subjects: grades.map((g, i) => ({ subject: `S${i}`, grade: g })) }],
    subjectGrades: [],
    structureSource: 'calculated',
    attendance: { total: 0 },
    achievements: [],
    observations: [],
  });

  function setup(cards: any[], status = 'CLOSED') {
    const prisma: any = {
      academicTerm: {
        findUnique: jest.fn().mockResolvedValue({ id: 't1', status, academicYearId: 'y1', academicYear: { id: 'y1', institutionId: 'inst-1' } }),
        update: jest.fn().mockResolvedValue({}),
      },
      group: { findMany: jest.fn().mockResolvedValue([{ id: 'g1' }]) },
      termReportCardSnapshot: {
        aggregate: jest.fn().mockResolvedValue({ _max: { version: 2 } }),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const svc = makeService(prisma);
    const buildSpy = jest.spyOn(svc as any, 'buildGroupReportCards').mockResolvedValue({
      institution: { id: 'inst-1' }, academicYear: { id: 'y1' }, term: { id: 't1' },
      academicStructure: 'AREAS_SUBJECTS',
      displayConfig: { mode: 'QUANTITATIVE' },
      reportContent: { showLearning: true, showEvidences: false },
      cards, generatedAt: new Date(),
    });
    return { svc, prisma, buildSpy };
  }

  it('CUANTITATIVO · exige estado CLOSED', async () => {
    const { svc, prisma } = setup([card('e1', [4])], 'OPEN');

    await expect(svc.finalizeTerm('t1', 'u1')).rejects.toThrow(/CLOSED/);
    expect(prisma.termReportCardSnapshot.create).not.toHaveBeenCalled();
  });

  it('CUANTITATIVO · versión = max+1 y estado final FINALIZED', async () => {
    const { svc, prisma } = setup([card('e1', [4])]);

    const r = await svc.finalizeTerm('t1', 'u1');

    expect(r.version).toBe(3);
    expect(r.totalSnapshots).toBe(1);
    expect(prisma.academicTerm.update.mock.calls[0][0].data.status).toBe('FINALIZED');
    expect(prisma.academicTerm.update.mock.calls[0][0].data.finalizedAt).toBeInstanceOf(Date);
  });

  it('CUANTITATIVO · promedio a 1 decimal, conteo de reprobadas y promoción', async () => {
    const { svc, prisma } = setup([card('e1', [2.0, 4.0, 5.0])]); // min aprobatoria = 3.0

    await svc.finalizeTerm('t1', 'u1');

    const data = prisma.termReportCardSnapshot.create.mock.calls[0][0].data.data;
    expect(data.generalAverage).toBe(3.7); // (2+4+5)/3 = 3.666… → 3.7
    expect(data.failedSubjectsCount).toBe(1);
    expect(data.approvedSubjectsCount).toBe(2);
    expect(data.promotionStatus).toBe('NO_APRUEBA');
  });

  it('CUANTITATIVO · APRUEBA sin reprobadas · PENDIENTE sin notas computables', async () => {
    const a = setup([card('e1', [4, 5])]);
    await a.svc.finalizeTerm('t1', 'u1');
    expect(a.prisma.termReportCardSnapshot.create.mock.calls[0][0].data.data.promotionStatus).toBe('APRUEBA');

    const b = setup([card('e2', [null])]);
    await b.svc.finalizeTerm('t1', 'u1');
    const d = b.prisma.termReportCardSnapshot.create.mock.calls[0][0].data.data;
    expect(d.promotionStatus).toBe('PENDIENTE');
    expect(d.generalAverage).toBeNull();
  });

  it('CUANTITATIVO · las áreas INFORMATIVE se excluyen del promedio y del conteo', async () => {
    const { svc, prisma } = setup([card('e1', [1.0], 'INFORMATIVE')]);

    await svc.finalizeTerm('t1', 'u1');

    const data = prisma.termReportCardSnapshot.create.mock.calls[0][0].data.data;
    expect(data.generalAverage).toBeNull();
    expect(data.failedSubjectsCount).toBe(0);
    expect(data.promotionStatus).toBe('PENDIENTE');
  });

  it('CUANTITATIVO · ranking descendente sólo entre quienes tienen promedio', async () => {
    const { svc, prisma } = setup([card('e1', [3.0]), card('e2', [5.0]), card('e3', [null])]);

    await svc.finalizeTerm('t1', 'u1');

    const byEnrollment: Record<string, any> = {};
    for (const c of prisma.termReportCardSnapshot.create.mock.calls) {
      byEnrollment[c[0].data.studentEnrollmentId] = c[0].data.data;
    }
    expect(byEnrollment.e2.rank).toBe(1);
    expect(byEnrollment.e1.rank).toBe(2);
    expect(byEnrollment.e3.rank).toBeNull();
    expect(byEnrollment.e1.totalStudentsRanked).toBe(2);
  });

  // Antes marcada [DEFECTO CONGELADO · C-4]: el payload descartaba los tres campos.
  // C-4 (2026-08-16) los congela; la prueba se convirtió para fijar el comportamiento nuevo.
  it('[CORREGIDO por C-4] el snapshot congela reportContent, academicStructure y displayConfig', async () => {
    const { svc, prisma, buildSpy } = setup([card('e1', [4])]);

    await svc.finalizeTerm('t1', 'u1');

    const data = prisma.termReportCardSnapshot.create.mock.calls[0][0].data.data;
    const built = await buildSpy.mock.results[0].value;
    // Lo que el generador produce es exactamente lo que queda congelado.
    expect(data.reportContent).toEqual(built.reportContent);
    expect(data.academicStructure).toBe('AREAS_SUBJECTS');
    expect(data.displayConfig).toEqual(built.displayConfig);
  });

  it('[DEFECTO CONGELADO] snapshotType siempre INITIAL_CLOSE, incluso re-finalizando', async () => {
    const { svc, prisma } = setup([card('e1', [4])]);

    await svc.finalizeTerm('t1', 'u1');

    expect(prisma.termReportCardSnapshot.create.mock.calls[0][0].data.snapshotType).toBe('INITIAL_CLOSE');
  });

  it('[DEFECTO CONGELADO] un grupo que falla se traga y el término queda FINALIZED igual', async () => {
    const { svc, prisma, buildSpy } = setup([card('e1', [4])]);
    buildSpy.mockRejectedValue(new Error('grupo roto'));
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});

    const r = await svc.finalizeTerm('t1', 'u1');

    expect(r.success).toBe(true);          // reporta éxito…
    expect(r.totalSnapshots).toBe(0);      // …sin haber generado ningún snapshot
    expect(prisma.academicTerm.update.mock.calls[0][0].data.status).toBe('FINALIZED');
    err.mockRestore();
  });

  it('[DEFECTO CONGELADO] los snapshots se crean uno a uno, SIN transacción', async () => {
    const { svc, prisma } = setup([card('e1', [4]), card('e2', [5])]);

    await svc.finalizeTerm('t1', 'u1');

    expect(prisma.termReportCardSnapshot.create).toHaveBeenCalledTimes(2);
    expect((prisma as any).$transaction).toBeUndefined();
  });

  it('CUANTITATIVO · isFailing recibe el contexto INSTITUCIONAL, no el del grado', async () => {
    const institutionContext = { getContext: jest.fn().mockResolvedValue({ academicStructure: 'DIMENSIONS', minPassingGrade: 3.0 }) };
    const prisma: any = {
      academicTerm: {
        findUnique: jest.fn().mockResolvedValue({ id: 't1', status: 'CLOSED', academicYearId: 'y1', academicYear: { id: 'y1', institutionId: 'inst-1' } }),
        update: jest.fn().mockResolvedValue({}),
      },
      group: { findMany: jest.fn().mockResolvedValue([{ id: 'g1' }]) },
      termReportCardSnapshot: { aggregate: jest.fn().mockResolvedValue({ _max: { version: 0 } }), create: jest.fn().mockResolvedValue({}) },
    };
    const svc = makeService(prisma, { institutionContext });
    jest.spyOn(svc as any, 'buildGroupReportCards').mockResolvedValue({
      institution: {}, academicYear: {}, term: {}, cards: [card('e1', [1.0])], generatedAt: new Date(),
    });

    await svc.finalizeTerm('t1', 'u1');

    // Con academicStructure = DIMENSIONS en el contexto institucional, isFailing
    // devuelve false SIEMPRE. El contexto es por INSTITUCIÓN mientras la estructura
    // real es por GRADO: en un colegio mixto esto puede no corresponder.
    const data = prisma.termReportCardSnapshot.create.mock.calls[0][0].data.data;
    expect(data.failedSubjectsCount).toBe(0);
    expect(data.promotionStatus).toBe('APRUEBA');
  });
});
