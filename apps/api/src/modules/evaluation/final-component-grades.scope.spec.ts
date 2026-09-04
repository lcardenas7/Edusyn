import { ConflictException, NotFoundException } from '@nestjs/common';
import { FinalComponentGradesService } from './final-component-grades.service';

/**
 * D-19 · La CAPTURA rechaza notas de fuentes que no aplican.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El recorte de la planilla evita que el docente llegue aquí por accidente,
 * pero no basta: la petición puede venir de una pestaña abierta desde antes
 * del cambio de reglas, o directamente contra la API. Sin esta guarda la nota
 * se guardaría y quedaría invisible —el cálculo anual la descarta por alcance—,
 * que es justo el tipo de dato fantasma que F1 vino a erradicar.
 *
 * Se rechaza al escribir, no al leer.
 */
describe('FinalComponentGradesService — la guarda de alcance en la captura', () => {
  const COMPONENTE = { id: 'fc1', name: 'Prueba Semestral I', scopeMode: 'ALL_GRADES' };
  const NOTA = { studentEnrollmentId: 'enr-1', teacherAssignmentId: 'ta-1', finalComponentId: 'fc1', grade: 4.2 };

  function makeService(opts: {
    componente?: any;
    asignacion?: { subjectId: string | null; group: { gradeId: string } | null } | null;
    reglas?: Array<{ finalComponentId: string; gradeId: string; subjectId: string | null; applies: boolean }>;
  }) {
    const upsert = jest.fn().mockResolvedValue({ id: 'fcg-1' });
    const prisma: any = {
      finalComponent: {
        findUnique: jest.fn().mockResolvedValue('componente' in opts ? opts.componente : COMPONENTE),
      },
      teacherAssignment: {
        findUnique: jest.fn().mockResolvedValue(
          opts.asignacion === undefined ? { subjectId: 'subj-1', group: { gradeId: 'g8' } } : opts.asignacion,
        ),
      },
      finalComponentScope: { findMany: jest.fn().mockResolvedValue(opts.reglas ?? []) },
      studentEnrollment: { findUnique: jest.fn().mockResolvedValue({ institutionId: 'inst-1' }) },
      // La auditoria obliga a leer el registro previo antes de escribir; sin
      // valor anterior no habria nada forense que registrar.
      finalComponentGrade: { upsert, findUnique: jest.fn().mockResolvedValue(null), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    return { svc: new FinalComponentGradesService(prisma, { record: jest.fn(), recordMany: jest.fn() } as any), prisma, upsert };
  }

  const REGLA_EXCLUYE = [{ finalComponentId: 'fc1', gradeId: 'g8', subjectId: null, applies: false }];

  // ═════════════════════════════════════════════════════════════════════════
  // Lo que ya funcionaba sigue funcionando
  // ═════════════════════════════════════════════════════════════════════════
  it('ALL_GRADES sin reglas: la nota se guarda, como antes de D-19', async () => {
    const { svc, upsert } = makeService({});
    await svc.upsert(NOTA);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0].update).toEqual({ grade: 4.2 });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // El rechazo
  // ═════════════════════════════════════════════════════════════════════════
  it('con el grado excluido, rechaza y NO escribe nada', async () => {
    const { svc, upsert } = makeService({ reglas: REGLA_EXCLUYE });
    await expect(svc.upsert(NOTA)).rejects.toBeInstanceOf(ConflictException);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('el mensaje dice qué evaluación es y cómo desbloquearlo', async () => {
    const { svc } = makeService({ reglas: REGLA_EXCLUYE });
    await expect(svc.upsert(NOTA)).rejects.toThrow(/Prueba Semestral I/);
    await expect(svc.upsert(NOTA)).rejects.toThrow(/alcance/i);
  });

  it('componente inexistente: 404, no 409', async () => {
    const { svc } = makeService({ componente: null });
    await expect(svc.upsert(NOTA)).rejects.toBeInstanceOf(NotFoundException);
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Fail-open: sin grado conocido no se bloquea al docente
  // ═════════════════════════════════════════════════════════════════════════
  it('asignación sin grupo: deja guardar en vez de bloquear por datos incompletos', async () => {
    const { svc, upsert, prisma } = makeService({ asignacion: { subjectId: 's1', group: null } });
    await svc.upsert(NOTA);
    expect(upsert).toHaveBeenCalledTimes(1);
    // Ni siquiera llega a consultar las reglas: sin grado no hay nada que resolver.
    expect(prisma.finalComponentScope.findMany).not.toHaveBeenCalled();
  });

  // ═════════════════════════════════════════════════════════════════════════
  // La excepción por asignatura, en los dos sentidos
  // ═════════════════════════════════════════════════════════════════════════
  it('grado excluido pero asignatura exceptuada: sí guarda', async () => {
    const { svc, upsert } = makeService({
      asignacion: { subjectId: 'matematicas', group: { gradeId: 'g8' } },
      reglas: [
        { finalComponentId: 'fc1', gradeId: 'g8', subjectId: null, applies: false },
        { finalComponentId: 'fc1', gradeId: 'g8', subjectId: 'matematicas', applies: true },
      ],
    });
    await svc.upsert(NOTA);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('grado incluido pero asignatura exceptuada: rechaza solo esa asignatura', async () => {
    const { svc, upsert } = makeService({
      asignacion: { subjectId: 'etica', group: { gradeId: 'g8' } },
      reglas: [{ finalComponentId: 'fc1', gradeId: 'g8', subjectId: 'etica', applies: false }],
    });
    await expect(svc.upsert(NOTA)).rejects.toBeInstanceOf(ConflictException);
    expect(upsert).not.toHaveBeenCalled();
  });

  // ═════════════════════════════════════════════════════════════════════════
  // El bulk: es lo que usa el botón «Guardar» de la planilla
  // ═════════════════════════════════════════════════════════════════════════
  describe('bulkUpsert', () => {
    const LOTE = [
      { studentEnrollmentId: 'e1', teacherAssignmentId: 'ta-1', finalComponentId: 'fc1', grade: 4.0 },
      { studentEnrollmentId: 'e2', teacherAssignmentId: 'ta-1', finalComponentId: 'fc1', grade: 3.5 },
      { studentEnrollmentId: 'e3', teacherAssignmentId: 'ta-1', finalComponentId: 'fc1', grade: 2.8 },
    ];

    it('un lote entero se rechaza ANTES de escribir la primera fila', async () => {
      const { svc, upsert } = makeService({ reglas: REGLA_EXCLUYE });
      await expect(svc.bulkUpsert(LOTE)).rejects.toBeInstanceOf(ConflictException);
      expect(upsert).not.toHaveBeenCalled(); // ni una nota a medias
    });

    it('el alcance se comprueba una vez por (asignación, componente), no por alumno', async () => {
      const { svc, prisma } = makeService({});
      await svc.bulkUpsert(LOTE);
      expect(prisma.finalComponent.findUnique).toHaveBeenCalledTimes(1);
    });

    it('con dos componentes en el lote, comprueba los dos', async () => {
      const { svc, prisma } = makeService({});
      await svc.bulkUpsert([
        ...LOTE,
        { studentEnrollmentId: 'e1', teacherAssignmentId: 'ta-1', finalComponentId: 'fc2', grade: 4.1 },
      ]);
      expect(prisma.finalComponent.findUnique).toHaveBeenCalledTimes(2);
    });

    it('lote válido: guarda todas las notas', async () => {
      const { svc, upsert } = makeService({});
      await svc.bulkUpsert(LOTE);
      expect(upsert).toHaveBeenCalledTimes(3);
    });
  });
});
