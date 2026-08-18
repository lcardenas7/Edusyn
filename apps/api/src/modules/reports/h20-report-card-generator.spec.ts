import { ReportsService } from './reports.service';

/**
 * H-20 · El GENERADOR COMPLETO del boletín respeta la vigencia por período
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Por qué existe este archivo
 * ---------------------------
 * D-12 sustituyó el filtro `isActive: true` del catálogo por la regla de vigencia
 * por período. Hasta ahora eso sólo estaba probado sobre la regla aislada
 * (`evidence-vigencia.util.ts`, 31 pruebas) y sobre los servicios del catálogo.
 * `F0_MINIMO_CARACTERIZACION.md` §A-6 declara explícitamente que H-20 **no se
 * cierra por tener unitarias en verde**: falta ejercitar `buildGroupReportCards`,
 * que es el que produce el documento oficial.
 *
 * Estas pruebas llaman al generador REAL —sin simularlo ni parchearlo— con un
 * Prisma simulado que **filtra de verdad** por los `where` que recibe, para que
 * el resultado dependa del código y no de lo que el mock devuelva por conveniencia.
 *
 * Lo que estas pruebas SÍ demuestran: el recorrido completo desde las matrículas
 * hasta `cards[].subjectGrades[].learningBlocks[].evidenceItems`, en los dos modos
 * de valoración, incluido el degradado fail-open.
 *
 * Lo que NO son: pruebas contra PostgreSQL. No hay FK, ni cascadas, ni
 * transacciones aquí. La integridad referencial se verificó aparte, en la base
 * real (`F2_FK_STUDENT_EVIDENCE_VALUATION.md` §6, §10).
 *
 * Escenario fijo — I.E.D. La Esperanza del Sur, Transición:
 *   Año 2026 con tres períodos (order 1, 2, 3).
 *   Dimensión «Comunicativa» con un propósito y dos imprescindibles:
 *     ev-1  nunca retirado
 *     ev-2  retirado DESDE el período 3
 *   Regla esperada: ev-2 sigue en el boletín de P1 y P2, y desaparece desde P3.
 */

const INSTITUCION = { id: 'inst-1', name: 'I.E.D. La Esperanza del Sur', nit: '900123456', address: 'Cra 1 # 2-3', phone: '3000000', email: 'rectoria@inedes.edu.co', academicLevelsConfig: [{ qualitativeLevels: [{ code: 'L', name: 'Logrado' }, { code: 'EP', name: 'En proceso' }, { code: 'I', name: 'Inicial' }] }] };

const TERMINOS = [
  { id: 't1', name: 'Período 1', type: 'PERIOD', order: 1 },
  { id: 't2', name: 'Período 2', type: 'PERIOD', order: 2 },
  { id: 't3', name: 'Período 3', type: 'PERIOD', order: 3 },
];

const DIMENSION_ID = 'dim-comunicativa';

interface Opciones {
  /** Estructura del grado. Sólo `DIMENSIONS` habilita el modo EVIDENCE. */
  academicStructure?: string;
  valuationScope?: 'PURPOSE' | 'EVIDENCE';
  /** Período de retiro de ev-2. `null` ⇒ nunca retirado. */
  retiroDeEv2?: string | null;
  /** `isActive` de ev-1: columna DEPRECADA, no debe influir. */
  ev1Activa?: boolean;
  /** Fuerza un `order` inválido en el período consultado (degradado fail-open). */
  ordenDelPeriodo?: number | null | undefined;
  /** Valoraciones existentes: evidenceId → nivel, por período. */
  valoraciones?: Array<{ termId: string; evidenceId: string; level: string }>;
  /** Modo PURPOSE: valoraciones por propósito con sus imprescindibles colgando. */
  studentAchievements?: any[];
}

function harness(opciones: Opciones = {}) {
  const {
    academicStructure = 'DIMENSIONS',
    valuationScope = 'EVIDENCE',
    retiroDeEv2 = 't3',
    ev1Activa = true,
    valoraciones = [
      { termId: 't1', evidenceId: 'ev-1', level: 'SUPERIOR' },
      { termId: 't1', evidenceId: 'ev-2', level: 'BASICO' },
      { termId: 't2', evidenceId: 'ev-1', level: 'ALTO' },
      { termId: 't2', evidenceId: 'ev-2', level: 'BAJO' },
      { termId: 't3', evidenceId: 'ev-1', level: 'SUPERIOR' },
    ],
    studentAchievements = [],
  } = opciones;

  // El generador REASIGNA `a.evidences` al filtrar por vigencia. Si el mock
  // devolviera siempre el mismo objeto, la primera llamada contaminaría a las
  // siguientes: cada llamada entrega una copia propia.
  const copia = <T>(valor: T): T => structuredClone(valor);

  const catalogo = [
    {
      id: 'a1',
      institutionId: 'inst-1',
      gradeId: 'gr-1',
      subjectId: DIMENSION_ID,
      academicYearId: 'y1',
      academicTermId: null, // catálogo ANUAL compartido por grado
      teacherAssignmentId: null,
      orderNumber: 1,
      isPromotional: false,
      baseDescription: 'Se expresa con claridad y escucha a los demás',
      evidences: [
        { id: 'ev-1', text: 'Narra experiencias propias', orderNumber: 1, isActive: ev1Activa, retiredFromTermId: null },
        { id: 'ev-2', text: 'Reconoce su nombre escrito', orderNumber: 2, isActive: true, retiredFromTermId: retiroDeEv2 },
      ],
    },
  ];

  const enrollment = {
    id: 'e1',
    groupId: 'g1',
    academicYearId: 'y1',
    status: 'ACTIVE',
    student: { id: 's1', firstName: 'Ana', lastName: 'Pérez', documentType: 'RC', documentNumber: '1010101' },
    group: {
      id: 'g1',
      name: 'TRANSICIÓN B',
      grade: { id: 'gr-1', name: 'Transición', academicStructure },
      director: null,
    },
    academicYear: { id: 'y1', year: 2026, name: '2026', institutionId: 'inst-1', institution: INSTITUCION },
  };

  const enrollmentArea = {
    id: 'ea-1',
    enrollmentId: 'e1',
    areaName: 'Dimensiones',
    areaCode: 'DIM',
    weightPercentage: 100,
    calculationType: 'INFORMATIVE',
    order: 1,
    enrollmentSubjects: [
      {
        subjectId: DIMENSION_ID,
        subjectName: 'Comunicativa',
        subjectCode: 'COM',
        weightPercentage: 100,
        teacherName: 'Marta Gómez',
        order: 1,
        subject: { id: DIMENSION_ID, name: 'Comunicativa', displayHours: 4, subjectType: 'PRESCHOOL_DIMENSION' },
      },
    ],
  };

  const teacherAssignment = {
    id: 'ta-1',
    subjectId: DIMENSION_ID,
    groupId: 'g1',
    academicYearId: 'y1',
    weeklyHours: 4,
    subject: { id: DIMENSION_ID, name: 'Comunicativa', code: 'COM', areaId: 'ar-1', displayHours: 4, subjectType: 'PRESCHOOL_DIMENSION', area: { id: 'ar-1', name: 'Dimensiones', code: 'DIM' } },
    teacher: { firstName: 'Marta', lastName: 'Gómez' },
  };

  const prisma: any = {
    studentEnrollment: { findMany: jest.fn().mockResolvedValue([enrollment]) },
    enrollmentArea: { findMany: jest.fn().mockResolvedValue([enrollmentArea]) },
    teacherAssignment: { findMany: jest.fn().mockResolvedValue([teacherAssignment]) },
    evaluationPlan: { findMany: jest.fn().mockResolvedValue([]) },
    partialGrade: { findMany: jest.fn().mockResolvedValue([]) },
    periodFinalGrade: { findMany: jest.fn().mockResolvedValue([]) },
    performanceScale: { findMany: jest.fn().mockResolvedValue([]) },
    periodRecovery: { findMany: jest.fn().mockResolvedValue([]) },
    attendanceRecord: { findMany: jest.fn().mockResolvedValue([]) },
    studentObservation: { findMany: jest.fn().mockResolvedValue([]) },
    convivenciaEntry: { findMany: jest.fn().mockResolvedValue([]) },

    studentAchievement: { findMany: jest.fn(async () => copia(studentAchievements)) },

    achievementConfig: {
      findUnique: jest.fn().mockResolvedValue({
        institutionId: 'inst-1',
        valuationScope,
        showLearningInReport: true,
        showEvidencesInReport: true,
        showLevelDescriptorInReport: false,
        showJudgmentInReport: false,
        reportLearningGranularity: 'ALL',
        learningLabelSingular: 'Propósito',
        learningLabelPlural: 'Propósitos',
        evidenceLabelSingular: 'Imprescindible',
        evidenceLabelPlural: 'Imprescindibles',
      }),
    },
    reportCardConfig: {
      findUnique: jest.fn().mockResolvedValue({
        institutionId: 'inst-1',
        preschoolShowRank: false,
        preschoolRankWeights: null,
        showZeroAbsences: true,
        preschoolLevelDisplay: 'COLUMNS',
      }),
    },

    // El catálogo del modo EVIDENCE. Filtra por grado y por período como la consulta real.
    achievement: {
      findMany: jest.fn(async (args: any) => {
        const w = args?.where ?? {};
        return copia(
          catalogo.filter((a) => {
            if (w.gradeId && a.gradeId !== w.gradeId) return false;
            if (w.teacherAssignmentId === null && a.teacherAssignmentId !== null) return false;
            if (w.OR) {
              const termIds = w.OR.map((o: any) => o.academicTermId);
              if (!termIds.includes(a.academicTermId)) return false;
            }
            return true;
          }),
        );
      }),
    },

    // Filtra por período y por evidencia, igual que la consulta real.
    studentEvidenceValuation: {
      findMany: jest.fn(async (args: any) => {
        const w = args?.where ?? {};
        return valoraciones
          .filter((v) => v.termId === w.academicTermId)
          .filter((v) => !w.achievementEvidenceId?.in || w.achievementEvidenceId.in.includes(v.evidenceId))
          .map((v) => ({ studentEnrollmentId: 'e1', achievementEvidenceId: v.evidenceId, academicTermId: v.termId, performanceLevel: v.level }));
      }),
    },

    // `resolveRetirementTermOrders`: sólo devuelve los períodos que EXISTEN.
    // Un id desconocido no aparece aquí, y eso es lo que dispara el fail-open.
    academicTerm: {
      findMany: jest.fn(async (args: any) => {
        const ids: string[] = args?.where?.id?.in ?? [];
        return TERMINOS.filter((t) => ids.includes(t.id)).map((t) => ({ id: t.id, order: t.order }));
      }),
    },
  };

  const studentGradesService: any = {
    calculateTermGradeFromPreloaded: jest.fn().mockReturnValue({ grade: null, components: [] }),
    getPerformanceLevelFromScale: jest.fn().mockReturnValue(null),
  };

  const academicYearService: any = {
    getTermById: jest.fn(async (id: string) => {
      const t = TERMINOS.find((x) => x.id === id);
      if (!t) return null;
      return 'ordenDelPeriodo' in opciones ? { ...t, order: opciones.ordenDelPeriodo } : t;
    }),
  };

  const svc = new ReportsService(
    prisma,
    studentGradesService,
    null as any,
    null as any,
    academicYearService,
    null as any,
    null as any,
    null as any,
  );

  return { svc, prisma };
}

/** Los imprescindibles que el boletín entrega para la dimensión, con su nivel. */
async function imprescindiblesDelBoletin(svc: ReportsService, termId: string) {
  const boletin: any = await svc.buildGroupReportCards('g1', termId);
  const dimension = boletin.cards[0].subjectGrades.find((s: any) => s.subjectId === DIMENSION_ID);
  const bloques = dimension?.learningBlocks ?? [];
  return { boletin, bloques, items: bloques[0]?.evidenceItems ?? [] };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 · La regla de vigencia, medida en el documento que ve el acudiente
// ═══════════════════════════════════════════════════════════════════════════
describe('H-20 · vigencia por período en el generador del boletín (modo EVIDENCE)', () => {
  it('P1: un imprescindible retirado DESDE P3 sigue apareciendo, con su valoración', async () => {
    const { svc } = harness();
    const { items } = await imprescindiblesDelBoletin(svc, 't1');

    expect(items.map((i: any) => i.text)).toEqual(['Narra experiencias propias', 'Reconoce su nombre escrito']);
    expect(items.find((i: any) => i.text === 'Reconoce su nombre escrito').level).toBe('BASICO');
  });

  it('P2: sigue apareciendo — el retiro es prospectivo, no retroactivo', async () => {
    const { svc } = harness();
    const { items } = await imprescindiblesDelBoletin(svc, 't2');

    expect(items).toHaveLength(2);
    expect(items.find((i: any) => i.text === 'Reconoce su nombre escrito').level).toBe('BAJO');
  });

  it('P3: desde el período de retiro DESAPARECE del boletín', async () => {
    const { svc } = harness();
    const { items } = await imprescindiblesDelBoletin(svc, 't3');

    expect(items.map((i: any) => i.text)).toEqual(['Narra experiencias propias']);
    expect(items.find((i: any) => i.text === 'Reconoce su nombre escrito')).toBeUndefined();
  });

  it('el propósito NO desaparece cuando se retira uno de sus imprescindibles', async () => {
    const { svc } = harness();
    const { bloques } = await imprescindiblesDelBoletin(svc, 't3');

    expect(bloques).toHaveLength(1);
    expect(bloques[0].learning).toBe('Se expresa con claridad y escucha a los demás');
  });

  it('sin retiro, el imprescindible aparece en los tres períodos', async () => {
    for (const termId of ['t1', 't2', 't3']) {
      const { svc } = harness({ retiroDeEv2: null });
      const { items } = await imprescindiblesDelBoletin(svc, termId);
      expect(items).toHaveLength(2);
    }
  });

  it('un boletín ya generado de P1 no cambia porque después se retire algo', async () => {
    // Mismo período, mismos datos, con y sin retiro posterior: resultado idéntico.
    const antes = await imprescindiblesDelBoletin(harness({ retiroDeEv2: null }).svc, 't1');
    const despues = await imprescindiblesDelBoletin(harness({ retiroDeEv2: 't3' }).svc, 't1');

    expect(despues.items).toEqual(antes.items);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2 · `isActive` está DEPRECADO: ya no puede ocultar nada
// ═══════════════════════════════════════════════════════════════════════════
describe('H-20 · la columna deprecada `isActive` no influye en el boletín', () => {
  it('un imprescindible con isActive=false SIGUE apareciendo', async () => {
    const { svc } = harness({ ev1Activa: false });
    const { items } = await imprescindiblesDelBoletin(svc, 't1');

    expect(items.map((i: any) => i.text)).toContain('Narra experiencias propias');
  });

  it('la consulta del catálogo no filtra por isActive', async () => {
    const { svc, prisma } = harness();
    await svc.buildGroupReportCards('g1', 't1');

    const consultaCatalogo = prisma.achievement.findMany.mock.calls[0][0];
    expect(JSON.stringify(consultaCatalogo)).not.toContain('isActive');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3 · Degradado fail-open — ante un dato inconsistente, se CONSERVA
// ═══════════════════════════════════════════════════════════════════════════
describe('H-20 · fail-open del generador', () => {
  it('período de retiro inexistente ⇒ el imprescindible se conserva', async () => {
    const { svc } = harness({ retiroDeEv2: 'term-que-ya-no-existe' });
    const { items } = await imprescindiblesDelBoletin(svc, 't3');

    expect(items).toHaveLength(2);
  });

  it('período consultado sin `order` ⇒ se conserva (ocultar es peor que mostrar)', async () => {
    const { svc } = harness({ ordenDelPeriodo: null });
    const { items } = await imprescindiblesDelBoletin(svc, 't3');

    expect(items).toHaveLength(2);
  });

  it('sin ningún retiro no se consulta la tabla de períodos (0 consultas de más)', async () => {
    const { svc, prisma } = harness({ retiroDeEv2: null });
    await svc.buildGroupReportCards('g1', 't1');

    expect(prisma.academicTerm.findMany).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4 · La valoración por imprescindible es SÓLO para grados por dimensiones
//     (regresión de 720978d — el modo EVIDENCE no debe filtrarse a bachillerato)
// ═══════════════════════════════════════════════════════════════════════════
describe('H-20 · el modo EVIDENCE queda acotado a DIMENSIONS', () => {
  it('en AREAS_SUBJECTS no se lee el catálogo del grado aunque valuationScope sea EVIDENCE', async () => {
    const { svc, prisma } = harness({ academicStructure: 'AREAS_SUBJECTS' });
    await svc.buildGroupReportCards('g1', 't1');

    expect(prisma.achievement.findMany).not.toHaveBeenCalled();
    expect(prisma.studentEvidenceValuation.findMany).not.toHaveBeenCalled();
  });

  it('en DIMENSIONS sí se lee', async () => {
    const { svc, prisma } = harness();
    await svc.buildGroupReportCards('g1', 't1');

    expect(prisma.achievement.findMany).toHaveBeenCalled();
    expect(prisma.studentEvidenceValuation.findMany).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5 · Modo PURPOSE — el otro punto donde el generador aplica la vigencia
// ═══════════════════════════════════════════════════════════════════════════
describe('H-20 · vigencia en modo PURPOSE (StudentAchievement)', () => {
  const valoracionPorProposito = (retiredFromTermId: string | null) => [
    {
      studentEnrollmentId: 'e1',
      performanceLevel: 'ALTO',
      observation: 'Avanza muy bien',
      achievement: {
        id: 'a1',
        orderNumber: 1,
        subjectId: DIMENSION_ID,
        baseDescription: 'Se expresa con claridad y escucha a los demás',
        teacherAssignment: null,
        subject: { id: DIMENSION_ID, name: 'Comunicativa' },
        levelDescriptors: [{ levelCode: 'ALTO', text: 'Logra lo esperado' }],
        evidences: [
          { id: 'ev-1', text: 'Narra experiencias propias', orderNumber: 1, isActive: true, retiredFromTermId: null },
          { id: 'ev-2', text: 'Reconoce su nombre escrito', orderNumber: 2, isActive: true, retiredFromTermId },
        ],
      },
    },
  ];

  it('P1: el imprescindible retirado desde P3 sigue en el bloque del propósito', async () => {
    const { svc } = harness({ valuationScope: 'PURPOSE', studentAchievements: valoracionPorProposito('t3') });
    const { bloques } = await imprescindiblesDelBoletin(svc, 't1');

    expect(bloques[0].evidences).toEqual(['Narra experiencias propias', 'Reconoce su nombre escrito']);
  });

  it('P3: desaparece', async () => {
    const { svc } = harness({ valuationScope: 'PURPOSE', studentAchievements: valoracionPorProposito('t3') });
    const { bloques } = await imprescindiblesDelBoletin(svc, 't3');

    expect(bloques[0].evidences).toEqual(['Narra experiencias propias']);
  });

  it('el descriptor del nivel alcanzado se resuelve igual, con o sin retiro', async () => {
    const { svc } = harness({ valuationScope: 'PURPOSE', studentAchievements: valoracionPorProposito('t3') });
    const { boletin } = await imprescindiblesDelBoletin(svc, 't3');

    expect(boletin.cards[0].achievements[0].description).toBe('Se expresa con claridad y escucha a los demás');
    expect(boletin.cards[0].achievements[0].performanceLevel).toBe('ALTO');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6 · El contrato de publicación que C-4 congela sale del generador completo
// ═══════════════════════════════════════════════════════════════════════════
describe('H-20 · contrato de publicación producido por el generador', () => {
  it('las etiquetas configuradas por la institución viajan en `reportContent`', async () => {
    const { svc } = harness();
    const boletin: any = await svc.buildGroupReportCards('g1', 't1');

    expect(boletin.reportContent).toMatchObject({
      valuationScope: 'EVIDENCE',
      learningLabelSingular: 'Propósito',
      evidenceLabelPlural: 'Imprescindibles',
      showEvidences: true,
      granularity: 'ALL',
    });
  });

  it('`academicStructure` y la escala cualitativa acompañan al documento', async () => {
    const { svc } = harness();
    const boletin: any = await svc.buildGroupReportCards('g1', 't1');

    expect(boletin.academicStructure).toBe('DIMENSIONS');
    expect(boletin.reportContent.qualitativeLevels.map((l: any) => l.code)).toEqual(['L', 'EP', 'I']);
  });
});
