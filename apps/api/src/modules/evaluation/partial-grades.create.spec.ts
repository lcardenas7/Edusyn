import { PartialGradesService } from './partial-grades.service';

/**
 * Regresión (hotfix): al CREAR una nota nueva, el payload `create` no debe incluir
 * `expectedUpdatedAt` (campo de control de concurrencia, no columna de PartialGrade).
 * Si se cuela, Prisma lanza PrismaClientValidationError (500) y el docente no puede
 * guardar notas nuevas.
 */
describe('PartialGradesService.upsert — create sin expectedUpdatedAt', () => {
  function makeService() {
    const upsert = jest.fn().mockResolvedValue({ id: 'pg1', score: 5 });
    const prisma: any = {
      academicTerm: { findUnique: jest.fn().mockResolvedValue({ status: 'OPEN' }) },
      teacherAssignment: { findUnique: jest.fn().mockResolvedValue({ institutionId: 'inst-1' }) },
      partialGrade: {
        findUnique: jest.fn().mockResolvedValue(null), // sin fila previa → rama create
        upsert,
      },
    };
    const gradeAudit: any = { record: jest.fn().mockResolvedValue(undefined) };
    return { svc: new PartialGradesService(prisma, gradeAudit), upsert };
  }

  const baseData = {
    studentEnrollmentId: 'se-1',
    teacherAssignmentId: 'ta-1',
    academicTermId: 'at-1',
    componentType: 'COGNITIVO',
    activityIndex: 1,
    activityName: 'Actividad 1',
    score: 5,
  };

  it('NO pasa expectedUpdatedAt al create (frontend envía expectedUpdatedAt=null)', async () => {
    const { svc, upsert } = makeService();

    await svc.upsert({ ...baseData, expectedUpdatedAt: null } as any);

    expect(upsert).toHaveBeenCalledTimes(1);
    const createArg = upsert.mock.calls[0][0].create;
    expect(createArg).not.toHaveProperty('expectedUpdatedAt');
    expect(createArg.institutionId).toBe('inst-1');
    // Los campos reales sí deben ir:
    expect(createArg.studentEnrollmentId).toBe('se-1');
    expect(createArg.score).toBe(5);
  });

  it('tampoco lo pasa cuando expectedUpdatedAt viene undefined', async () => {
    const { svc, upsert } = makeService();

    await svc.upsert({ ...baseData } as any);

    const createArg = upsert.mock.calls[0][0].create;
    expect(createArg).not.toHaveProperty('expectedUpdatedAt');
  });
});
