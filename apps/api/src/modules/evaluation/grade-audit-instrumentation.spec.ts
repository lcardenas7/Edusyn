import { GradeAuditService } from './grade-audit.service';
import { StudentGradesService } from './student-grades.service';
import { PeriodFinalGradesService } from './period-final-grades.service';
import { PeriodFinalGradeWriter } from './period-final-grade.writer';
import { FinalComponentGradesService } from './final-component-grades.service';

/**
 * D-1 · Contrato de la auditoría de escrituras de notas.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tres de los cuatro servicios que escriben notas no dejaban rastro: se
 * auditaba la captura parcial —reversible— y quedaba en silencio la que fija
 * la nota del boletín. Estas pruebas fijan el contrato de la corrección.
 *
 * Lo que se comprueba, y por qué cada punto importa:
 *
 *  1. Guardar sin cambiar nada NO emite evento. Sin esta condición, cada
 *     pulsación de guardar enterraría los cambios reales bajo ruido.
 *  2. Un fallo de auditoría NO impide guardar la nota. Es la regla de oro:
 *     auditar es obligación del sistema, nunca un riesgo para el docente.
 *  3. Un lote emite un evento por estudiante, todos con la misma correlación:
 *     ocurrió como una sola acción y debe poder leerse así sin perder detalle.
 */
describe('D-1 · auditoría de escrituras de notas', () => {
  const auditoriaFalsa = () => ({ record: jest.fn(), recordMany: jest.fn() });

  /** Servicio con el adaptador real, la única puerta de escritura de la tabla. */
  const servicioNotasFinales = (prisma: any, audit: any) =>
    new PeriodFinalGradesService(prisma, audit, new PeriodFinalGradeWriter(prisma, audit));

  /** Sesión supervisora: la política no le exige titularidad ni causal. */
  const COORDINACION = { userId: 'u-1', roles: ['COORDINADOR'], institutionId: 'inst-1' };

  /** Prisma mínimo para las notas finales, con todo dentro de la misma institución. */
  const prismaNotasFinales = (extra: Record<string, unknown> = {}) => ({
    academicTerm: {
      findUnique: jest.fn().mockResolvedValue({ status: 'OPEN', academicYear: { institutionId: 'inst-1' } }),
    },
    subject: { findUnique: jest.fn().mockResolvedValue({ area: { institutionId: 'inst-1' } }) },
    institution: { findUnique: jest.fn().mockResolvedValue({ allowTeacherFinalGradeOverride: false }) },
    teacherAssignment: { findFirst: jest.fn().mockResolvedValue(null) },
    studentEnrollment: {
      findUnique: jest.fn().mockResolvedValue({ institutionId: 'inst-1', groupId: 'grp-1' }),
    },
    ...extra,
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 1. Guardar sin cambios no genera ruido
  // ═══════════════════════════════════════════════════════════════════════

  describe('un guardado que no cambia la nota no emite evento', () => {
    it('nota de estudiante', async () => {
      const audit = auditoriaFalsa();
      const prisma: any = {
        studentEnrollment: { findUnique: jest.fn().mockResolvedValue({ institutionId: 'inst-1' }) },
        studentGrade: {
          findUnique: jest.fn().mockResolvedValue({ id: 'sg-1', score: 4.5 }),
          upsert: jest.fn().mockResolvedValue({ id: 'sg-1' }),
        },
      };
      const svc = new StudentGradesService(prisma, audit as any);

      await svc.upsert({ studentEnrollmentId: 'enr-1', evaluativeActivityId: 'act-1', score: 4.5 } as any);

      expect(prisma.studentGrade.upsert).toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('nota por componente final', async () => {
      const audit = auditoriaFalsa();
      const prisma: any = {
        finalComponent: { findUnique: jest.fn().mockResolvedValue({ id: 'fc1', name: 'X', scopeMode: 'ALL_GRADES' }) },
        teacherAssignment: { findUnique: jest.fn().mockResolvedValue({ subjectId: 's1', group: { gradeId: 'g8' } }) },
        finalComponentScope: { findMany: jest.fn().mockResolvedValue([]) },
        studentEnrollment: { findUnique: jest.fn().mockResolvedValue({ institutionId: 'inst-1' }) },
        finalComponentGrade: {
          findUnique: jest.fn().mockResolvedValue({ id: 'fcg-1', grade: 3.8, institutionId: 'inst-1' }),
          upsert: jest.fn().mockResolvedValue({ id: 'fcg-1' }),
        },
      };
      const svc = new FinalComponentGradesService(prisma, audit as any);

      await svc.upsert({
        studentEnrollmentId: 'enr-1',
        teacherAssignmentId: 'ta-1',
        finalComponentId: 'fc1',
        grade: 3.8,
      });

      expect(prisma.finalComponentGrade.upsert).toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 2. La regla de oro
  // ═══════════════════════════════════════════════════════════════════════

  describe('un fallo de auditoría nunca bloquea el guardado', () => {
    it('la nota queda guardada aunque el registro forense reviente', async () => {
      // Servicio de auditoría REAL, con una base que falla al escribir el
      // evento: es la única forma de comprobar el contrato de verdad.
      const prismaAuditoria: any = {
        gradeAuditEvent: {
          createMany: jest.fn().mockRejectedValue(new Error('tabla de auditoría caída')),
        },
      };
      const audit = new GradeAuditService(prismaAuditoria);

      const prisma: any = {
        studentEnrollment: { findUnique: jest.fn().mockResolvedValue({ institutionId: 'inst-1' }) },
        studentGrade: {
          findUnique: jest.fn().mockResolvedValue(null),
          upsert: jest.fn().mockResolvedValue({ id: 'sg-9' }),
        },
      };
      const svc = new StudentGradesService(prisma, audit);

      const resultado = await svc.upsert({
        studentEnrollmentId: 'enr-1',
        evaluativeActivityId: 'act-1',
        score: 5,
      } as any);

      expect(prismaAuditoria.gradeAuditEvent.createMany).toHaveBeenCalled();
      expect(resultado).toEqual({ id: 'sg-9' });
    });

    it('el servicio de auditoría no propaga la excepción', async () => {
      const prismaAuditoria: any = {
        gradeAuditEvent: { createMany: jest.fn().mockRejectedValue(new Error('fallo')) },
      };
      const audit = new GradeAuditService(prismaAuditoria);

      await expect(
        audit.record({ institutionId: 'inst-1', action: 'CREATE' }),
      ).resolves.toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 3. Un lote es una sola acción con N estudiantes
  // ═══════════════════════════════════════════════════════════════════════

  describe('una escritura masiva emite un evento por estudiante bajo una correlación común', () => {
    it('nota de estudiante', async () => {
      const audit = auditoriaFalsa();
      const prisma: any = {
        studentEnrollment: { findUnique: jest.fn().mockResolvedValue({ institutionId: 'inst-1' }) },
        studentGrade: {
          findUnique: jest.fn().mockResolvedValue(null),
          upsert: jest.fn().mockResolvedValue({ id: 'sg-x' }),
        },
      };
      const svc = new StudentGradesService(prisma, audit as any);

      await svc.bulkUpsert('act-1', [
        { studentEnrollmentId: 'enr-1', score: 4 },
        { studentEnrollmentId: 'enr-2', score: 5 },
        { studentEnrollmentId: 'enr-3', score: 3 },
      ]);

      expect(audit.record).toHaveBeenCalledTimes(3);
      const lotes = audit.record.mock.calls.map((c: any[]) => c[0].batchId);
      expect(lotes.every(Boolean)).toBe(true);
      expect(new Set(lotes).size).toBe(1);
    });

    it('notas finales de período', async () => {
      const audit = auditoriaFalsa();
      const prisma: any = prismaNotasFinales({
        periodFinalGrade: {
          findUnique: jest.fn().mockResolvedValue(null),
          upsert: jest.fn().mockResolvedValue({ id: 'pfg-x', institutionId: 'inst-1' }),
        },
      });
      const svc = servicioNotasFinales(prisma, audit);

      await svc.bulkUpsert(
        [
          { studentEnrollmentId: 'enr-1', academicTermId: 't1', subjectId: 's1', finalScore: 4 },
          { studentEnrollmentId: 'enr-2', academicTermId: 't1', subjectId: 's1', finalScore: 2 },
        ],
        'user-1',
        COORDINACION,
      );

      expect(audit.record).toHaveBeenCalledTimes(2);
      const lotes = audit.record.mock.calls.map((c: any[]) => c[0].batchId);
      expect(new Set(lotes).size).toBe(1);
      expect(lotes[0]).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 4. El evento dice quién, qué había antes y qué hay ahora
  // ═══════════════════════════════════════════════════════════════════════

  describe('el evento conserva el valor anterior y el actor', () => {
    it('una modificación registra la nota previa, la nueva y quién la cambió', async () => {
      const audit = auditoriaFalsa();
      const prisma: any = prismaNotasFinales({
        periodFinalGrade: {
          findUnique: jest.fn().mockResolvedValue({ id: 'pfg-1', finalScore: 2.5, institutionId: 'inst-1' }),
          upsert: jest.fn().mockResolvedValue({ id: 'pfg-1', institutionId: 'inst-1' }),
        },
      });
      const svc = servicioNotasFinales(prisma, audit);
      const actor = { userId: 'u-1', name: 'quien-actua', role: 'RECTOR' };

      await svc.upsert(
        { studentEnrollmentId: 'enr-1', academicTermId: 't1', subjectId: 's1', finalScore: 4.8, enteredById: 'u-1' },
        { userId: 'u-1', roles: ['RECTOR'], institutionId: 'inst-1' },
        actor,
      );

      expect(audit.record).toHaveBeenCalledTimes(1);
      const [evento, actorRegistrado] = audit.record.mock.calls[0];
      expect(evento).toMatchObject({
        institutionId: 'inst-1',
        source: 'PERIOD_FINAL_GRADE',
        action: 'UPDATE',
        previousScore: 2.5,
        newScore: 4.8,
      });
      expect(actorRegistrado).toEqual(actor);
    });

    it('un borrado conserva el valor que existía', async () => {
      const audit = auditoriaFalsa();
      const prisma: any = {
        finalComponentGrade: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'fcg-1',
            grade: 4.1,
            institutionId: 'inst-1',
            studentEnrollmentId: 'enr-1',
            teacherAssignmentId: 'ta-1',
            finalComponentId: 'fc1',
          }),
          delete: jest.fn().mockResolvedValue({ id: 'fcg-1' }),
        },
      };
      const svc = new FinalComponentGradesService(prisma, audit as any);

      await svc.remove('fcg-1');

      expect(audit.record).toHaveBeenCalledTimes(1);
      expect(audit.record.mock.calls[0][0]).toMatchObject({
        action: 'DELETE',
        previousScore: 4.1,
        newScore: null,
      });
    });
  });
});
