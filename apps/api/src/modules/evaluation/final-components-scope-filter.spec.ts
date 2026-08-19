import { FinalComponentsService } from './final-components.service';

/**
 * D-19 · La PLANILLA recibe del backend solo las fuentes que aplican.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `findByAcademicYear` es lo que alimenta el selector de la planilla. Si la
 * lista se filtrara en el navegador, bastaría un cambio de reglas para que el
 * docente viera una columna cuyo guardado `FinalComponentGradesService`
 * rechaza con 409. Filtrando aquí, ambas rutas leen las mismas reglas con la
 * misma función (`final-component-scope.util`), y no pueden divergir.
 *
 * Lo que estas pruebas fijan:
 *   · sin `teacherAssignmentId` la respuesta es la de siempre (nadie más rompe)
 *   · sin grado conocido NO se recorta nada (fail-open)
 *   · el recorte respeta la jerarquía asignatura > grado > modo por defecto
 */
describe('FinalComponentsService.findByAcademicYear — recorte por alcance', () => {
  const SEM_1 = { id: 'fc1', name: 'Prueba Semestral I', order: 1, weightPercentage: 10, scopeMode: 'ALL_GRADES' };
  const SEM_2 = { id: 'fc2', name: 'Prueba Semestral II', order: 2, weightPercentage: 10, scopeMode: 'ALL_GRADES' };

  function makeService(opts: {
    componentes?: any[];
    asignacion?: { subjectId: string | null; group: { gradeId: string } | null } | null;
    reglas?: Array<{ finalComponentId: string; gradeId: string; subjectId: string | null; applies: boolean }>;
  }) {
    const prisma: any = {
      finalComponent: { findMany: jest.fn().mockResolvedValue(opts.componentes ?? [SEM_1, SEM_2]) },
      teacherAssignment: { findUnique: jest.fn().mockResolvedValue(opts.asignacion ?? null) },
      finalComponentScope: { findMany: jest.fn().mockResolvedValue(opts.reglas ?? []) },
    };
    return { svc: new FinalComponentsService(prisma), prisma };
  }

  const ids = (r: any[]) => r.map((c) => c.id);

  // ═════════════════════════════════════════════════════════════════════════
  // Nadie que ya usaba el endpoint se ve afectado
  // ═════════════════════════════════════════════════════════════════════════
  it('sin teacherAssignmentId devuelve todo y NI SIQUIERA consulta las reglas', async () => {
    const { svc, prisma } = makeService({});
    const res = await svc.findByAcademicYear('y-1');
    expect(ids(res)).toEqual(['fc1', 'fc2']);
    expect(prisma.teacherAssignment.findUnique).not.toHaveBeenCalled();
    expect(prisma.finalComponentScope.findMany).not.toHaveBeenCalled();
  });

  it('si el año no tiene fuentes, no hace consultas extra', async () => {
    const { svc, prisma } = makeService({ componentes: [] });
    expect(await svc.findByAcademicYear('y-1', 'ta-1')).toEqual([]);
    expect(prisma.finalComponentScope.findMany).not.toHaveBeenCalled();
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Fail-open: ante datos incompletos, mejor mostrar de más que ocultar notas
  // ═════════════════════════════════════════════════════════════════════════
  it('asignación inexistente: devuelve todas las fuentes', async () => {
    const { svc } = makeService({ asignacion: null });
    expect(ids(await svc.findByAcademicYear('y-1', 'ta-fantasma'))).toEqual(['fc1', 'fc2']);
  });

  it('asignación sin grupo (y por tanto sin grado): devuelve todas', async () => {
    const { svc } = makeService({ asignacion: { subjectId: 's1', group: null } });
    expect(ids(await svc.findByAcademicYear('y-1', 'ta-1'))).toEqual(['fc1', 'fc2']);
  });

  // ═════════════════════════════════════════════════════════════════════════
  // El comportamiento heredado: ALL_GRADES sin reglas
  // ═════════════════════════════════════════════════════════════════════════
  it('ALL_GRADES y sin reglas: la planilla ve las dos, como antes de D-19', async () => {
    const { svc } = makeService({ asignacion: { subjectId: 's1', group: { gradeId: 'g8' } } });
    expect(ids(await svc.findByAcademicYear('y-1', 'ta-1'))).toEqual(['fc1', 'fc2']);
  });

  // ═════════════════════════════════════════════════════════════════════════
  // El caso que motivó todo: transición no presenta la prueba semestral
  // ═════════════════════════════════════════════════════════════════════════
  it('una regla de grado con applies=false oculta esa fuente', async () => {
    const { svc } = makeService({
      asignacion: { subjectId: 's1', group: { gradeId: 'transicion' } },
      reglas: [{ finalComponentId: 'fc1', gradeId: 'transicion', subjectId: null, applies: false }],
    });
    expect(ids(await svc.findByAcademicYear('y-1', 'ta-1'))).toEqual(['fc2']);
  });

  it('la excepción por asignatura manda sobre la regla del grado', async () => {
    // 8.º no presenta la semestral… salvo en Matemáticas.
    const { svc } = makeService({
      asignacion: { subjectId: 'matematicas', group: { gradeId: 'g8' } },
      reglas: [
        { finalComponentId: 'fc1', gradeId: 'g8', subjectId: null, applies: false },
        { finalComponentId: 'fc1', gradeId: 'g8', subjectId: 'matematicas', applies: true },
      ],
    });
    expect(ids(await svc.findByAcademicYear('y-1', 'ta-1'))).toEqual(['fc1', 'fc2']);
  });

  it('y al revés: el grado sí presenta, pero una asignatura queda exceptuada', async () => {
    const { svc } = makeService({
      asignacion: { subjectId: 'etica', group: { gradeId: 'g8' } },
      reglas: [{ finalComponentId: 'fc1', gradeId: 'g8', subjectId: 'etica', applies: false }],
    });
    expect(ids(await svc.findByAcademicYear('y-1', 'ta-1'))).toEqual(['fc2']);
  });

  // ═════════════════════════════════════════════════════════════════════════
  // SELECTED_GRADES: una fuente nueva no aparece hasta que alguien la habilita
  // ═════════════════════════════════════════════════════════════════════════
  it('SELECTED_GRADES sin reglas: no la ve nadie, hay que declararla', async () => {
    const { svc } = makeService({
      componentes: [{ ...SEM_1, scopeMode: 'SELECTED_GRADES' }, SEM_2],
      asignacion: { subjectId: 's1', group: { gradeId: 'g8' } },
    });
    expect(ids(await svc.findByAcademicYear('y-1', 'ta-1'))).toEqual(['fc2']);
  });

  it('SELECTED_GRADES con el grado habilitado: reaparece', async () => {
    const { svc } = makeService({
      componentes: [{ ...SEM_1, scopeMode: 'SELECTED_GRADES' }, SEM_2],
      asignacion: { subjectId: 's1', group: { gradeId: 'g8' } },
      reglas: [{ finalComponentId: 'fc1', gradeId: 'g8', subjectId: null, applies: true }],
    });
    expect(ids(await svc.findByAcademicYear('y-1', 'ta-1'))).toEqual(['fc1', 'fc2']);
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Las reglas se piden acotadas al grado: no se traen las de toda la institución
  // ═════════════════════════════════════════════════════════════════════════
  it('consulta las reglas filtrando por grado y por los componentes del año', async () => {
    const { svc, prisma } = makeService({ asignacion: { subjectId: 's1', group: { gradeId: 'g8' } } });
    await svc.findByAcademicYear('y-1', 'ta-1');
    expect(prisma.finalComponentScope.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { finalComponentId: { in: ['fc1', 'fc2'] }, gradeId: 'g8' },
      }),
    );
  });
});
