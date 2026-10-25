import { ReportsService } from './reports.service';

describe('ReportsService.getPromotionProjection', () => {
  const terms = [1, 2, 3, 4].map((order) => ({
    id: `p${order}`,
    name: `P${order}`,
    order,
    weightPercentage: 25,
  }));

  function makeService(grades: any[], areaApprovalRule = 'AREA_AVERAGE') {
    const prisma: any = {
      institution: {
        findUnique: jest.fn().mockResolvedValue({ areaApprovalRule, areaFailIfAnyFails: false }),
      },
    };
    const academicYearService: any = {
      getTermsByAcademicYear: jest.fn().mockResolvedValue(terms),
    };
    const institutionContext: any = {
      getContext: jest.fn().mockResolvedValue({ minPassingGrade: 3, maxFailedSubjectsForPromotion: 2 }),
    };
    const academicDataSource: any = {
      getTermGradeData: jest.fn().mockResolvedValue({ meta: { source: 'live' }, grades }),
    };

    const service = new ReportsService(
      prisma,
      null as any,
      null as any,
      null as any,
      academicYearService,
      institutionContext,
      null as any,
      academicDataSource,
    );
    return service;
  }

  function grade(studentEnrollmentId: string, subjectId: string, areaId: string, score: number) {
    return {
      studentEnrollmentId,
      studentFirstName: 'QA',
      studentLastName: 'Estudiante',
      studentSecondName: '',
      studentSecondLastName: '',
      studentFullName: 'Estudiante QA',
      groupId: 'g1',
      groupName: '11° B',
      gradeName: '11°',
      academicTermId: 'p1',
      termName: 'P1',
      termWeight: 25,
      termOrder: 1,
      subjectId,
      subjectName: subjectId,
      areaId,
      areaName: areaId,
      finalScore: score,
    };
  }

  it('applies the SIEE area limit and keeps a one-period projection as at risk', async () => {
    const service = makeService([grade('e1', 'Ciencias', 'Ciencias', 2)]);

    const result: any = await service.getPromotionProjection('i1', 'y1', 'g1');

    expect(result.results[0].projectedFailed).toBe(1);
    expect(result.results[0].projectedFailedAreas).toBe(1);
    expect(result.results[0].overallProjection).toBe('EN_RIESGO');
    expect(result.results[0].completedTerms).toBe(1);
    expect(result.results[0].totalTerms).toBe(4);
    expect(result.summary).toMatchObject({ total: 1, atRisk: 1, notPromoted: 0 });
  });

  it('only projects no promotion when failed areas exceed the configured limit', async () => {
    const grades = [
      grade('e1', 'Ciencias', 'Ciencias', 2),
      grade('e1', 'Matemáticas', 'Matemáticas', 2),
      grade('e1', 'Lenguaje', 'Lenguaje', 2),
    ];
    const service = makeService(grades);

    const result: any = await service.getPromotionProjection('i1', 'y1', 'g1');

    expect(result.results[0].projectedFailedAreas).toBe(3);
    expect(result.results[0].overallProjection).toBe('NO_PROMUEVE');
  });

  it('uses the area average when multiple subjects share one area', async () => {
    const grades = [
      grade('e1', 'Álgebra', 'Matemáticas', 2),
      grade('e1', 'Geometría', 'Matemáticas', 4),
    ];
    const service = makeService(grades);

    const result: any = await service.getPromotionProjection('i1', 'y1', 'g1');

    expect(result.results[0].projectedFailedAreas).toBe(0);
  });
});
