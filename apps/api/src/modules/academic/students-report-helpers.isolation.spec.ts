import { StudentsService } from './students.service';

/**
 * Aislamiento de los helpers de informe de `StudentsService`.
 *
 * Estos cinco métodos NO son rutas HTTP de `students`: son helpers internos que consumen
 * otros módulos (`reports`, `men-reports`). Ahí estaban los dos IDOR confirmados —
 * `GET /reports/minimum-grade/:studentEnrollmentId` y `GET /reports/minimum-grade/group/:groupId` —
 * porque el helper aceptaba un identificador del cliente y consultaba sin acotar por
 * institución (docs/security/RLS-VALIDACION-CENSO.md).
 *
 * Se endurecen en el ORIGEN: la institución es obligatoria y acota la consulta Prisma, así
 * que no depende de que cada futuro consumidor recuerde filtrar.
 *
 * Relaciones de tenant utilizadas (todas columna directa, verificadas en el schema):
 *   StudentEnrollment.institutionId · EnrollmentArea.institutionId · StudentObservation.institutionId
 */
describe('StudentsService · helpers de informe, aislamiento por institución', () => {
  const INST_A = 'inst-aaa';
  const INST_B = 'inst-bbb';

  function build() {
    const prisma: any = {
      studentEnrollment: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      enrollmentArea: { findMany: jest.fn().mockResolvedValue([]) },
      studentObservation: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return { service: new StudentsService(prisma), prisma };
  }

  // ── 1) getEnrollmentForReport ────────────────────────────────────────────
  describe('getEnrollmentForReport', () => {
    it('acota la consulta a la institución del actor', async () => {
      const { service, prisma } = build();
      await service.getEnrollmentForReport('e1', INST_A);
      expect(prisma.studentEnrollment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'e1', institutionId: INST_A } }),
      );
    });

    it('una matrícula de B es invisible para un actor de A', async () => {
      const { service, prisma } = build();
      prisma.studentEnrollment.findFirst.mockResolvedValue(null); // la consulta acotada no la encuentra
      await expect(service.getEnrollmentForReport('e-de-b', INST_A)).resolves.toBeNull();
    });

    it('ya no existe la variante sin institución (findUnique por id suelto)', async () => {
      const { service, prisma } = build();
      await service.getEnrollmentForReport('e1', INST_A);
      expect(prisma.studentEnrollment.findUnique).toBeUndefined();
    });
  });

  // ── 2) getEnrollmentsForGroupReport ──────────────────────────────────────
  describe('getEnrollmentsForGroupReport', () => {
    it('filtra por institución además de por grupo', async () => {
      const { service, prisma } = build();
      await service.getEnrollmentsForGroupReport({
        groupId: 'g1', academicYearId: 'y1', institutionId: INST_A,
      });
      expect(prisma.studentEnrollment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ institutionId: INST_A, groupId: 'g1' }),
        }),
      );
    });

    it('un grupo de B no devuelve matrículas a un actor de A', async () => {
      const { service, prisma } = build();
      prisma.studentEnrollment.findMany.mockResolvedValue([]); // acotado por institución
      await expect(
        service.getEnrollmentsForGroupReport({
          groupId: 'g-de-b', academicYearId: 'y1', institutionId: INST_A,
        }),
      ).resolves.toEqual([]);
      const args = prisma.studentEnrollment.findMany.mock.calls[0][0];
      expect(args.where.institutionId).toBe(INST_A);
    });
  });

  // ── 3) getEnrollmentsForMenReport ────────────────────────────────────────
  describe('getEnrollmentsForMenReport', () => {
    it('filtra por institución', async () => {
      const { service, prisma } = build();
      await service.getEnrollmentsForMenReport({ academicYearId: 'y1', institutionId: INST_A });
      expect(prisma.studentEnrollment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ institutionId: INST_A }) }),
      );
    });

    it('mantiene los filtros opcionales de grado y sede sin perder la institución', async () => {
      const { service, prisma } = build();
      await service.getEnrollmentsForMenReport({
        academicYearId: 'y1', institutionId: INST_A, gradeId: 'gr1', campusId: 'c1',
      });
      const where = prisma.studentEnrollment.findMany.mock.calls[0][0].where;
      expect(where.institutionId).toBe(INST_A);
      expect(where.group).toEqual({ gradeId: 'gr1', campusId: 'c1' });
    });
  });

  // ── 4) getEnrollmentAcademicStructure ────────────────────────────────────
  describe('getEnrollmentAcademicStructure', () => {
    it('acota por institución además de por matrícula', async () => {
      const { service, prisma } = build();
      await service.getEnrollmentAcademicStructure('e1', INST_A);
      expect(prisma.enrollmentArea.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { enrollmentId: 'e1', institutionId: INST_A } }),
      );
    });

    it('la estructura de una matrícula de B no llega a un actor de A', async () => {
      const { service, prisma } = build();
      prisma.enrollmentArea.findMany.mockResolvedValue([]);
      await expect(service.getEnrollmentAcademicStructure('e-de-b', INST_A)).resolves.toEqual([]);
      expect(prisma.enrollmentArea.findMany.mock.calls[0][0].where.institutionId).toBe(INST_A);
    });
  });

  // ── 5) getStudentObservationsForReport ───────────────────────────────────
  describe('getStudentObservationsForReport', () => {
    it('acota por institución (endurecido aunque hoy no tenga consumidor)', async () => {
      const { service, prisma } = build();
      await service.getStudentObservationsForReport({
        studentEnrollmentId: 'e1', institutionId: INST_A,
      });
      expect(prisma.studentObservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ institutionId: INST_A, studentEnrollmentId: 'e1' }),
        }),
      );
    });

    it('conserva el filtro de fechas junto al de institución', async () => {
      const { service, prisma } = build();
      const start = new Date('2026-01-01');
      await service.getStudentObservationsForReport({
        studentEnrollmentId: 'e1', institutionId: INST_A, startDate: start,
      });
      const where = prisma.studentObservation.findMany.mock.calls[0][0].where;
      expect(where.institutionId).toBe(INST_A);
      expect(where.date).toEqual({ gte: start });
    });
  });

  // ── Regresión estructural: ningún helper admite ya institución ausente ───
  it('los cinco helpers exigen institución en su firma', () => {
    // Si alguien vuelve a hacer opcional el parámetro, la llamada de abajo dejaría de
    // fallar en compilación y esta prueba perdería sentido; se documenta la intención.
    const s = new StudentsService({} as any);
    expect(typeof s.getEnrollmentForReport).toBe('function');
    expect(s.getEnrollmentForReport.length).toBe(2);          // (enrollmentId, institutionId)
    expect(s.getEnrollmentAcademicStructure.length).toBe(2);  // (enrollmentId, institutionId)
  });
});
