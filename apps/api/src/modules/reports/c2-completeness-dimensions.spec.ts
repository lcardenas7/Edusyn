import { ReportsService } from './reports.service';

/**
 * C-2 · Completitud cualitativa para grados DIMENSIONS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Antes: `getCompletenessStatus` medía los aprendizajes con una única consulta que
 * exigía `achievement.teacherAssignment` y `achievement.academicTermId`. El catálogo
 * compartido de Transición tiene ambos en `null`, así que nunca entraba → 0 % eterno.
 * En modo EVIDENCE ni siquiera existía eje: `StudentEvidenceValuation` no se consultaba.
 *
 * Después: los grados DIMENSIONS se miden con un eje propio que respeta
 * `AchievementConfig.valuationScope` y la regla de vigencia de D-12. El camino
 * cuantitativo (AREAS_SUBJECTS / SUBJECTS_ONLY) queda intacto.
 *
 * Grano de la obligación (plan §5.2):
 *   PURPOSE  → matrícula × propósito      × período
 *   EVIDENCE → matrícula × imprescindible × período
 * Un estudiante cuenta como diligenciado sólo si cubrió TODAS sus obligaciones.
 */

const TERMS = [
  { id: 't1', name: 'P1', status: 'OPEN', order: 1 },
  { id: 't2', name: 'P2', status: 'OPEN', order: 2 },
];

const student = (id: string, lastName: string) => ({
  id, firstName: 'X', secondName: null, lastName, secondLastName: null,
});

function makeService(opts: {
  structure: 'DIMENSIONS' | 'AREAS_SUBJECTS';
  valuationScope?: 'PURPOSE' | 'EVIDENCE';
  expectedAchievements?: any[];
  studentAchievements?: any[];
  evidenceValuations?: any[];
  finalGrades?: any[];
  terms?: any[];
}) {
  const terms = opts.terms ?? [TERMS[0]];
  const prisma: any = {
    academicTerm: { findMany: jest.fn().mockResolvedValue(terms) },
    group: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'g1', name: 'A', grade: { id: 'gr1', name: 'Transición', stage: 'PREESCOLAR', academicStructure: opts.structure }, _count: { studentEnrollments: 2 } },
      ]),
    },
    teacherAssignment: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'ta1', groupId: 'g1', subjectId: 'dim-com', subject: { name: 'Dimensión Comunicativa' }, teacher: { firstName: 'Ana', lastName: 'Ruiz' } },
      ]),
    },
    periodFinalGrade: { findMany: jest.fn().mockResolvedValue(opts.finalGrades ?? []) },
    studentEnrollment: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'e1', groupId: 'g1', student: student('s1', 'PEREZ') },
        { id: 'e2', groupId: 'g1', student: student('s2', 'GOMEZ') },
      ]),
    },
    // Se llama dos veces con filtros distintos: el cuantitativo (exige teacherAssignment)
    // y el cualitativo (por achievementId). Se distinguen por la forma del `where`.
    studentAchievement: {
      findMany: jest.fn().mockImplementation((args: any) =>
        args?.where?.achievement?.teacherAssignment
          ? Promise.resolve([])                                   // camino cuantitativo
          : Promise.resolve(opts.studentAchievements ?? []),      // camino cualitativo
      ),
    },
    achievementConfig: { findUnique: jest.fn().mockResolvedValue({ valuationScope: opts.valuationScope ?? 'PURPOSE' }) },
    achievement: { findMany: jest.fn().mockResolvedValue(opts.expectedAchievements ?? []) },
    studentEvidenceValuation: { findMany: jest.fn().mockResolvedValue(opts.evidenceValuations ?? []) },
  };
  const svc = new ReportsService(prisma, null as any, null as any, null as any, null as any, null as any, null as any, null as any);
  return { svc, prisma };
}

const cell = (r: any) => r.groups[0].subjects[0].terms[0];

// ═══════════════════════════════════════════════════════════════════════════
describe('C-2 · aislamiento del camino cuantitativo', () => {
  it('CASO 1 · AREAS_SUBJECTS conserva exactamente su comportamiento', async () => {
    const { svc, prisma } = makeService({
      structure: 'AREAS_SUBJECTS',
      finalGrades: [{ studentEnrollmentId: 'e1', subjectId: 'dim-com', academicTermId: 't1', studentEnrollment: { groupId: 'g1' } }],
    });

    const r: any = await svc.getCompletenessStatus('inst-1', 'y1');

    // Notas: 1 de 2 → 50 %. Aprendizajes: el camino cuantitativo devuelve vacío → 0 %.
    expect(cell(r).studentsWithGrade).toBe(1);
    expect(cell(r).gradeCompleteness).toBe(50);
    expect(cell(r).studentsWithAchievement).toBe(0);
    // Y NO se activa nada del eje cualitativo.
    expect(prisma.achievementConfig.findUnique).not.toHaveBeenCalled();
    expect(prisma.achievement.findMany).not.toHaveBeenCalled();
    expect(prisma.studentEvidenceValuation.findMany).not.toHaveBeenCalled();
  });

  it('CASO 8 · el universo cuantitativo no cambia: sigue saliendo de TeacherAssignment', async () => {
    const { svc, prisma } = makeService({ structure: 'DIMENSIONS' });

    await svc.getCompletenessStatus('inst-1', 'y1');

    // El denominador sigue siendo matrículas ACTIVE × asignaturas de TeacherAssignment.
    expect(prisma.teacherAssignment.findMany).toHaveBeenCalled();
    expect(prisma.studentEnrollment.findMany.mock.calls[0][0].where.status).toBe('ACTIVE');
    // La consulta cuantitativa de logros conserva su filtro original.
    const cuantitativa = prisma.studentAchievement.findMany.mock.calls.find(
      (c: any[]) => c[0]?.where?.achievement?.teacherAssignment,
    );
    expect(cuantitativa).toBeDefined();
  });

  it('CASO 9 · no se introduce ninguna dependencia con EnrollmentSubject', async () => {
    const { svc, prisma } = makeService({ structure: 'DIMENSIONS' });

    await svc.getCompletenessStatus('inst-1', 'y1');

    // Si el servicio consultara EnrollmentSubject, el mock no lo tendría y explotaría.
    expect((prisma as any).enrollmentSubject).toBeUndefined();
    expect((prisma as any).enrollmentArea).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('C-2 · DIMENSIONS + PURPOSE', () => {
  const propositoAnual = {
    id: 'ach-1', subjectId: 'dim-com', academicTermId: null, // catálogo compartido: ambos null
    teacherAssignment: null, evidences: [],
  };

  it('CASO 2 y 4 · el catálogo compartido (sin teacherAssignment ni término) SÍ participa', async () => {
    const { svc } = makeService({
      structure: 'DIMENSIONS',
      valuationScope: 'PURPOSE',
      expectedAchievements: [propositoAnual],
      studentAchievements: [{ studentEnrollmentId: 'e1', achievementId: 'ach-1', academicTermId: 't1' }],
    });

    const r: any = await svc.getCompletenessStatus('inst-1', 'y1');

    // Antes esto daba 0 % siempre. Ahora: 1 de 2 estudiantes → 50 %.
    expect(cell(r).studentsWithAchievement).toBe(1);
    expect(cell(r).achievementCompleteness).toBe(50);
    expect(cell(r).missingAchievementStudents).toEqual([{ enrollmentId: 'e2', name: 'GOMEZ X' }]);
  });

  it('exige TODOS los propósitos de la dimensión, no sólo uno', async () => {
    const { svc } = makeService({
      structure: 'DIMENSIONS',
      valuationScope: 'PURPOSE',
      expectedAchievements: [propositoAnual, { ...propositoAnual, id: 'ach-2' }],
      studentAchievements: [{ studentEnrollmentId: 'e1', achievementId: 'ach-1', academicTermId: 't1' }],
    });

    const r: any = await svc.getCompletenessStatus('inst-1', 'y1');

    expect(cell(r).studentsWithAchievement).toBe(0); // e1 cubrió 1 de 2
  });

  it('un propósito por-período no se exige en otro período', async () => {
    const { svc } = makeService({
      structure: 'DIMENSIONS',
      valuationScope: 'PURPOSE',
      terms: TERMS,
      expectedAchievements: [{ ...propositoAnual, academicTermId: 't1' }],
      studentAchievements: [],
    });

    const r: any = await svc.getCompletenessStatus('inst-1', 'y1');
    const [p1, p2] = r.groups[0].subjects[0].terms;

    expect(p1.achievementCompleteness).toBe(0);   // en P1 sí se exige y nadie lo valoró
    expect(p2.achievementCompleteness).toBe(100); // en P2 no existe la obligación
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('C-2 · DIMENSIONS + EVIDENCE (regla de vigencia D-12)', () => {
  const conEvidencias = (evidences: any[]) => ({
    id: 'ach-1', subjectId: 'dim-com', academicTermId: null, teacherAssignment: null, evidences,
  });

  it('CASO 3 y 6 · mide sobre StudentEvidenceValuation; una evidencia vigente genera obligación', async () => {
    const { svc, prisma } = makeService({
      structure: 'DIMENSIONS',
      valuationScope: 'EVIDENCE',
      expectedAchievements: [conEvidencias([
        { id: 'ev-1', retiredFromTermId: null },
        { id: 'ev-2', retiredFromTermId: null },
      ])],
      evidenceValuations: [
        { studentEnrollmentId: 'e1', achievementEvidenceId: 'ev-1', academicTermId: 't1' },
        { studentEnrollmentId: 'e1', achievementEvidenceId: 'ev-2', academicTermId: 't1' },
        { studentEnrollmentId: 'e2', achievementEvidenceId: 'ev-1', academicTermId: 't1' },
      ],
    });

    const r: any = await svc.getCompletenessStatus('inst-1', 'y1');

    expect(prisma.studentEvidenceValuation.findMany).toHaveBeenCalled();
    // e1 cubrió las dos; e2 sólo una → 1 de 2.
    expect(cell(r).studentsWithAchievement).toBe(1);
    expect(cell(r).achievementCompleteness).toBe(50);
    expect(cell(r).missingAchievementStudents).toEqual([{ enrollmentId: 'e2', name: 'GOMEZ X' }]);
  });

  it('CASO 5 · una evidencia retirada desde P2 NO genera obligación en P2', async () => {
    const { svc } = makeService({
      structure: 'DIMENSIONS',
      valuationScope: 'EVIDENCE',
      terms: TERMS,
      expectedAchievements: [conEvidencias([
        { id: 'ev-1', retiredFromTermId: null },
        { id: 'ev-2', retiredFromTermId: 't2' }, // retirada desde P2
      ])],
      evidenceValuations: [
        // P1: ambas evidencias valoradas por los dos estudiantes
        { studentEnrollmentId: 'e1', achievementEvidenceId: 'ev-1', academicTermId: 't1' },
        { studentEnrollmentId: 'e1', achievementEvidenceId: 'ev-2', academicTermId: 't1' },
        { studentEnrollmentId: 'e2', achievementEvidenceId: 'ev-1', academicTermId: 't1' },
        { studentEnrollmentId: 'e2', achievementEvidenceId: 'ev-2', academicTermId: 't1' },
        // P2: sólo la vigente
        { studentEnrollmentId: 'e1', achievementEvidenceId: 'ev-1', academicTermId: 't2' },
        { studentEnrollmentId: 'e2', achievementEvidenceId: 'ev-1', academicTermId: 't2' },
      ],
    });

    const r: any = await svc.getCompletenessStatus('inst-1', 'y1');
    const [p1, p2] = r.groups[0].subjects[0].terms;

    expect(p1.achievementCompleteness).toBe(100); // en P1 ev-2 era vigente y se valoró
    expect(p2.achievementCompleteness).toBe(100); // en P2 ev-2 ya no se exige
  });

  it('CASO 5b · la retirada seguiría restando si se exigiera: prueba en negativo', async () => {
    const { svc } = makeService({
      structure: 'DIMENSIONS',
      valuationScope: 'EVIDENCE',
      terms: TERMS,
      expectedAchievements: [conEvidencias([{ id: 'ev-2', retiredFromTermId: 't2' }])],
      evidenceValuations: [], // nadie valoró nada
    });

    const r: any = await svc.getCompletenessStatus('inst-1', 'y1');
    const [p1, p2] = r.groups[0].subjects[0].terms;

    expect(p1.achievementCompleteness).toBe(0);   // vigente en P1 y sin valorar → penaliza
    expect(p2.achievementCompleteness).toBe(100); // retirada desde P2 → sin obligación
  });

  it('una dimensión sin obligaciones configuradas no resta completitud', async () => {
    const { svc } = makeService({
      structure: 'DIMENSIONS',
      valuationScope: 'EVIDENCE',
      expectedAchievements: [],
    });

    const r: any = await svc.getCompletenessStatus('inst-1', 'y1');

    expect(cell(r).achievementCompleteness).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('C-2 · garantías de no escritura', () => {
  it('CASO 7 · getCompletenessStatus no modifica ninguna valoración', async () => {
    const { svc, prisma } = makeService({
      structure: 'DIMENSIONS',
      valuationScope: 'EVIDENCE',
      expectedAchievements: [{ id: 'ach-1', subjectId: 'dim-com', academicTermId: null, teacherAssignment: null, evidences: [{ id: 'ev-1', retiredFromTermId: null }] }],
      evidenceValuations: [{ studentEnrollmentId: 'e1', achievementEvidenceId: 'ev-1', academicTermId: 't1' }],
    });

    await svc.getCompletenessStatus('inst-1', 'y1');

    // Los mocks sólo exponen findMany/findUnique. Cualquier intento de escritura
    // (update/upsert/create/delete) reventaría por método inexistente.
    for (const model of ['studentEvidenceValuation', 'studentAchievement', 'achievement', 'periodFinalGrade']) {
      expect((prisma as any)[model].update).toBeUndefined();
      expect((prisma as any)[model].upsert).toBeUndefined();
      expect((prisma as any)[model].create).toBeUndefined();
      expect((prisma as any)[model].deleteMany).toBeUndefined();
    }
    expect((prisma as any).$transaction).toBeUndefined();
  });
});
