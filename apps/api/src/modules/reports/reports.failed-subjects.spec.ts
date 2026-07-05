import { ReportsService } from './reports.service';

/**
 * getFailedSubjects — modo final + regla institucional (área vs. asignatura).
 * Verifica que respete areaApprovalRule y devuelva las dos vistas (results + areaResults).
 */
describe('ReportsService.getFailedSubjects (scope=final, regla área/asignatura)', () => {
  // Un estudiante con Matemáticas: Álgebra 2.0 (pierde), Geometría 4.0 (pasa) → área promedio 3.0
  const grades = [
    { studentEnrollmentId: 'e1', studentFullName: 'PEREZ JUAN', studentLastName: 'PEREZ', studentFirstName: 'JUAN', groupName: '5A', subjectId: 'alg', subjectName: 'Álgebra', areaId: 'mat', areaName: 'Matemáticas', termName: 'P1', finalScore: 2.0 },
    { studentEnrollmentId: 'e1', studentFullName: 'PEREZ JUAN', studentLastName: 'PEREZ', studentFirstName: 'JUAN', groupName: '5A', subjectId: 'geo', subjectName: 'Geometría', areaId: 'mat', areaName: 'Matemáticas', termName: 'P1', finalScore: 4.0 },
  ];

  function makeService(approvalRule: string, failIfAnyFails = false) {
    const prisma: any = {
      institution: { findUnique: jest.fn().mockResolvedValue({ areaApprovalRule: approvalRule, areaFailIfAnyFails: failIfAnyFails }) },
      group: { findUnique: jest.fn().mockResolvedValue({ grade: { stage: 'BASICA_PRIMARIA', name: '5A' } }) },
    };
    const academicYearService: any = { getPassingGrade: jest.fn().mockResolvedValue(3.0) };
    const academicDataSource: any = { getTermGradeData: jest.fn().mockResolvedValue({ meta: { source: 'live' }, grades }) };
    // Solo se usan estos 3 deps en scope=final; el resto no se toca.
    return new ReportsService(prisma, null as any, null as any, null as any, academicYearService, null as any, null as any, academicDataSource);
  }

  it('por asignatura: Álgebra reprobada (2.0 < 3.0), Geometría no', async () => {
    const svc = makeService('AREA_AVERAGE');
    const res: any = await svc.getFailedSubjects('inst1', 'yr1', 'g1', 't1', {});
    expect(res.results.map((r: any) => r.subjectName)).toEqual(['Álgebra']);
    expect(res.totalFailed).toBe(1);
  });

  it('AREA_AVERAGE: el área Matemáticas NO se reprueba (promedio 3.0 ≥ 3.0)', async () => {
    const svc = makeService('AREA_AVERAGE');
    const res: any = await svc.getFailedSubjects('inst1', 'yr1', 'g1', 't1', {});
    expect(res.rule.officialUnit).toBe('area');
    expect(res.areaResults).toHaveLength(0);
  });

  it('ALL_SUBJECTS_PASS: el área SÍ se reprueba porque Álgebra pierde', async () => {
    const svc = makeService('ALL_SUBJECTS_PASS');
    const res: any = await svc.getFailedSubjects('inst1', 'yr1', 'g1', 't1', {});
    expect(res.rule.officialUnit).toBe('subject');
    expect(res.areaResults).toHaveLength(1);
    expect(res.areaResults[0].areaName).toBe('Matemáticas');
    expect(res.areaResults[0].failedSubjects).toEqual(['Álgebra']);
  });

  it('AREA_AVERAGE + failIfAnyFails: el área se reprueba por la asignatura perdida', async () => {
    const svc = makeService('AREA_AVERAGE', true);
    const res: any = await svc.getFailedSubjects('inst1', 'yr1', 'g1', 't1', {});
    expect(res.areaResults).toHaveLength(1);
  });

  it('filtro por asignatura: subjectId=geo deja fuera Álgebra → 0 reprobadas', async () => {
    const svc = makeService('AREA_AVERAGE');
    const res: any = await svc.getFailedSubjects('inst1', 'yr1', 'g1', 't1', { subjectId: 'geo' });
    expect(res.totalFailed).toBe(0);
  });
});
