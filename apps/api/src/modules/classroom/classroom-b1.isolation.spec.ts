import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { A, B, actorDe, conteo, fixture, noWrites } from '../../../test/fixtures/classroom-b1.fixture';

/**
 * Laboratorio de servicio de Classroom Bloque 1 (17 rutas).
 *
 * Servicio real (ClassroomService + ClassroomTenantAccessService + ActivityGatingService +
 * CompletionService) sobre el doble A/B que filtra de verdad; la sesión se simula con el actor
 * explícito `{ userId, institutionId, roles, isSuperAdmin }`, exactamente como lo construye el
 * controlador desde el JWT. Aquí se demuestra la guarda de aplicación: cadena institucional
 * completa, 404 indistinguible para lo ajeno, 403 dentro del colegio, lotes mixtos atómicos,
 * reversión de transacciones y que el docente compartido A/B no cruza recursos con el mismo
 * userId.
 */
describe('Classroom Bloque 1 · aislamiento de servicio', () => {
  let data: ReturnType<typeof fixture>;
  beforeEach(() => { data = fixture(); });
  // any: las pruebas ejercitan el CONTRATO observable, no los tipos inferidos del servicio.
  const service = (): any => data.service;

  const docenteA = () => actorDe({ institutionId: A }); // teacher-shared, DOCENTE
  const docenteB = () => actorDe({ institutionId: B });
  const otroDocenteA = () => actorDe({ institutionId: A, userId: 'teacher-otro-A' });
  const estudianteA1 = () => actorDe({ institutionId: A, userId: 'user-A1', roles: ['ESTUDIANTE'] });
  const estudianteA2 = () => actorDe({ institutionId: A, userId: 'user-A2', roles: ['ESTUDIANTE'] });
  const estudianteA3 = () => actorDe({ institutionId: A, userId: 'user-A3', roles: ['ESTUDIANTE'] }); // otro grupo
  const estudianteA4 = () => actorDe({ institutionId: A, userId: 'user-A4', roles: ['ESTUDIANTE'] }); // otro año
  const estudianteB1 = () => actorDe({ institutionId: B, userId: 'user-B1', roles: ['ESTUDIANTE'] });
  const acudienteA = () => actorDe({ institutionId: A, userId: 'user-acudiente-A', roles: ['ACUDIENTE'] });
  const superAdminEnA = () => actorDe({ institutionId: A, userId: 'root', roles: [], isSuperAdmin: true });

  const lecturasPII = () => data.calls.filter((c) => c.model === 'student' || c.model === 'studentEnrollment');

  // ═══════════════════════════════════════════════════════════════════════════
  // Matriz de cruce A→B / B→A: toda operación con id del otro colegio → 404
  // indistinguible, sin escrituras y sin lecturas PII secundarias.
  // ═══════════════════════════════════════════════════════════════════════════
  const operacionesCruzadas: Array<[string, (s: any, actor: any, x: string) => Promise<any>]> = [
    ['getById', (s, a, x) => s.getById(a, `class-${x}`)],
    ['update', (s, a, x) => s.update(a, `class-${x}`, { title: 'intruso' })],
    ['getStudents', (s, a, x) => s.getStudents(a, `class-${x}`)],
    ['create', (s, a, x) => s.create(a, { teacherAssignmentId: `ta-${x}` })],
    ['createActivity', (s, a, x) => s.createActivity(a, `class-${x}`, { type: 'TASK', title: 'intrusa' })],
    ['listActivities', (s, a, x) => s.listActivities(a, `class-${x}`)],
    ['getActivity', (s, a, x) => s.getActivity(a, `act-${x}-pub`)],
    ['updateActivity', (s, a, x) => s.updateActivity(a, `act-${x}-pub`, { title: 'intruso' })],
    ['publishActivity', (s, a, x) => s.publishActivity(a, `act-${x}-draft`)],
    ['unpublishActivity', (s, a, x) => s.unpublishActivity(a, `act-${x}-pub`)],
    ['setActivityDependencies', (s, a, x) => s.setActivityDependencies(a, `act-${x}-pub`, [])],
    ['assignStudentsToActivity', (s, a, x) => s.assignStudentsToActivity(a, `act-${x}-restr`, { studentEnrollmentIds: [], isRestrictedToAssigned: false })],
    ['getActivityAssignments', (s, a, x) => s.getActivityAssignments(a, `act-${x}-restr`)],
    ['getClassroomStudentsForAssignment', (s, a, x) => s.getClassroomStudentsForAssignment(a, `class-${x}`)],
    ['deleteActivity', (s, a, x) => s.deleteActivity(a, `act-${x}-pub`, true)],
  ];

  describe.each([[A, 'B'], [B, 'A']] as const)('actor de %s contra el colegio %s', (institution, ajeno) => {
    it.each(operacionesCruzadas)('%s responde 404 sin escribir ni leer PII', async (_nombre, operacion) => {
      await expect(operacion(service(), actorDe({ institutionId: institution }), ajeno)).rejects.toBeInstanceOf(NotFoundException);
      noWrites(data);
      expect(lecturasPII()).toEqual([]);
    });

    it('el 404 de un id ajeno es indistinguible del de uno inexistente', async () => {
      const actor = actorDe({ institutionId: institution });
      const errores = await Promise.all([
        service().getById(actor, `class-${ajeno}`).catch((e) => `${e.constructor.name}:${e.message}`),
        service().getById(actor, 'class-que-no-existe').catch((e) => `${e.constructor.name}:${e.message}`),
        service().getActivity(actor, `act-${ajeno}-pub`).catch((e) => `${e.constructor.name}:${e.message}`),
        service().getActivity(actor, 'act-que-no-existe').catch((e) => `${e.constructor.name}:${e.message}`),
      ]);
      expect(errores[0]).toBe(errores[1]);
      expect(errores[2]).toBe(errores[3]);
    });
  });

  it('el docente compartido tiene recursos disjuntos en A y en B con el MISMO userId', async () => {
    const enA = await service().listForTeacher(docenteA());
    const enB = await service().listForTeacher(docenteB());
    expect(enA.map((c: any) => c.id)).toContain('class-A');
    expect(enA.map((c: any) => c.id)).not.toContain('class-B');
    expect(enB.map((c: any) => c.id)).toEqual(['class-B']);
    const dispA = await service().getAvailableAssignments(docenteA());
    const dispB = await service().getAvailableAssignments(docenteB());
    expect(dispA.map((t: any) => t.id)).toEqual(['ta-disponible-A']);
    expect(dispB).toEqual([]);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Filas incoherentes y aulas personales: 404 como si no existieran.
  // ═══════════════════════════════════════════════════════════════════════════
  it.each([
    ['aula de A con asignación de B', 'class-huerfana-A'],
    ['aula de A cuyo grupo cuelga de una sede de B', 'class-inc-A'],
    ['aula personal de Edusyn Play', 'class-personal-A'],
  ])('%s responde 404 para su PROPIA institución', async (_nombre, classroomId) => {
    await expect(service().getById(docenteA(), classroomId)).rejects.toBeInstanceOf(NotFoundException);
    noWrites(data);
  });

  it('la actividad que cuelga del aula incoherente responde 404', async () => {
    await expect(service().getActivity(docenteA(), 'act-inc-A')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('la matrícula incoherente (dice A, estudiante de B) no se puede asignar aunque grupo y año coincidan', async () => {
    await expect(
      service().assignStudentsToActivity(docenteA(), 'act-A-pub', { studentEnrollmentIds: ['enr-inc-A'], isRestrictedToAssigned: false }),
    ).rejects.toBeInstanceOf(NotFoundException);
    noWrites(data);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Permisos dentro del colegio: 403 (en alcance) vs 404 (ajeno).
  // ═══════════════════════════════════════════════════════════════════════════
  it('el otro docente de A no gestiona el aula del docente compartido: 403 en A, 404 en B', async () => {
    await expect(service().update(otroDocenteA(), 'class-A', { title: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service().update(otroDocenteA(), 'class-B', { title: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service().getStudents(otroDocenteA(), 'class-A')).rejects.toBeInstanceOf(ForbiddenException);
    noWrites(data);
  });

  it('la rama docente de actividades no se filtra a quien no gestiona el aula', async () => {
    await expect(service().listActivities(otroDocenteA(), 'class-A')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service().getActivity(otroDocenteA(), 'act-A-pub')).rejects.toBeInstanceOf(ForbiddenException);
    // ACUDIENTE ya no cae en la rama docente: 403 en alcance, sin revelar borradores ni conteos.
    await expect(service().listActivities(acudienteA(), 'class-A')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('ACUDIENTE no puede ver el aula: el esquema no vincula acudientes con cuentas (404)', async () => {
    await expect(service().getById(acudienteA(), 'class-A')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('SuperAdmin opera en la institución resuelta pero NO se salta las relaciones del recurso', async () => {
    // Ve el aula de la institución resuelta…
    const classroom = await service().getById(superAdminEnA(), 'class-A');
    expect(classroom.id).toBe('class-A');
    // …pero no la de otra institución aunque sea superadmin…
    await expect(service().getById(superAdminEnA(), 'class-B')).rejects.toBeInstanceOf(NotFoundException);
    // …y no gestiona un aula cuyo docente no es él (misma regla que antes).
    await expect(service().update(superAdminEnA(), 'class-A', { title: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
    noWrites(data);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Rama de estudiante: matrícula verificada, borradores y conteos fuera.
  // ═══════════════════════════════════════════════════════════════════════════
  it('el estudiante compatible solo ve publicadas, visibles y asignadas, con su candado', async () => {
    const lista = await service().listActivities(estudianteA1(), 'class-A');
    const ids = lista.map((a: any) => a.id).sort();
    expect(ids).toEqual(['act-A-dep', 'act-A-pub', 'act-A-restr']); // sin el borrador
    const dep = lista.find((a: any) => a.id === 'act-A-dep');
    // prerequisito MIN_SCORE 5 y el alumno solo ENTREGÓ (sin nota) → bloqueada.
    expect(dep.locked).toBe(true);
    expect(dep.requirements).toEqual([
      expect.objectContaining({ prerequisiteId: 'act-A-pub', condition: 'MIN_SCORE', satisfied: false }),
    ]);
    // Su propia entrega viaja en la actividad; la del compañero no.
    const pub = lista.find((a: any) => a.id === 'act-A-pub');
    expect(pub.submissions).toHaveLength(1);
    expect(pub.submissions[0].id).toBe('sub-A1');
    // Nada de conteos docentes en la rama de estudiante.
    expect(pub.gradingPending).toBeUndefined();
  });

  it('la actividad restringida solo se la ve el asignado', async () => {
    const delAsignado = await service().listActivities(estudianteA1(), 'class-A');
    expect(delAsignado.map((a: any) => a.id)).toContain('act-A-restr');
    const delCompanero = await service().listActivities(estudianteA2(), 'class-A');
    expect(delCompanero.map((a: any) => a.id)).not.toContain('act-A-restr');
    await expect(service().getActivity(estudianteA2(), 'act-A-restr')).rejects.toBeInstanceOf(NotFoundException);
    const propia = await service().getActivity(estudianteA1(), 'act-A-restr');
    expect(propia.id).toBe('act-A-restr');
  });

  it('el borrador responde 404 al estudiante aunque el aula sea suya', async () => {
    await expect(service().getActivity(estudianteA1(), 'act-A-draft')).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([
    ['estudiante de otro grupo', () => estudianteA3()],
    ['estudiante de otro año', () => estudianteA4()],
  ])('%s no entra al aula: 404 sin revelar existencia', async (_n, hacerActor) => {
    await expect(service().listActivities(hacerActor(), 'class-A')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service().getActivity(hacerActor(), 'act-A-pub')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service().getById(hacerActor(), 'class-A')).rejects.toBeInstanceOf(NotFoundException);
    noWrites(data);
  });

  it('el estudiante de B no entra al aula de A aunque el aula exista', async () => {
    await expect(service().getById(estudianteB1(), 'class-A')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service().listActivities(estudianteB1(), 'class-A')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('un estudiante A no ve estudiantes: las rutas de PII exigen gestionar el aula', async () => {
    await expect(service().getStudents(estudianteA1(), 'class-A')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service().getActivityAssignments(estudianteA1(), 'act-A-restr')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service().getClassroomStudentsForAssignment(estudianteA1(), 'class-A')).rejects.toBeInstanceOf(ForbiddenException);
    expect(lecturasPII().filter((c) => c.method === 'findMany')).toEqual([]);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Lotes mixtos y reversión transaccional.
  // ═══════════════════════════════════════════════════════════════════════════
  it('un lote mixto de destinatarios (propia + ajena) falla completo antes de escribir', async () => {
    const antes = data.rows.activityAssignment.length;
    await expect(
      service().assignStudentsToActivity(docenteA(), 'act-A-restr', { studentEnrollmentIds: ['enr-A2', 'enr-B1'], isRestrictedToAssigned: true }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(data.rows.activityAssignment.length).toBe(antes); // aa-A1 intacta, nada nuevo
    expect(data.rows.activityAssignment.map((a: any) => a.id)).toEqual(['aa-A1', 'aa-B1']);
    noWrites(data);
  });

  it('una matrícula de otro grupo o de otro año tampoco entra en el lote', async () => {
    for (const ajena of ['enr-A3', 'enr-A4', 'enr-B1']) {
      await expect(
        service().assignStudentsToActivity(docenteA(), 'act-A-restr', { studentEnrollmentIds: [ajena], isRestrictedToAssigned: false }),
      ).rejects.toBeInstanceOf(NotFoundException);
    }
    expect(data.rows.activityAssignment).toHaveLength(2);
  });

  it('un fallo a mitad de la escritura revierte TODA la transacción de destinatarios', async () => {
    data.fail('activityAssignment.createMany');
    await expect(
      service().assignStudentsToActivity(docenteA(), 'act-A-restr', { studentEnrollmentIds: ['enr-A2'], isRestrictedToAssigned: true }),
    ).rejects.toThrow('Fallo forzado');
    // El deleteMany previo se revirtió: aa-A1 sigue ahí y no quedó nada a medias.
    expect(data.rows.activityAssignment.map((a: any) => a.id)).toEqual(['aa-A1', 'aa-B1']);
    const act = data.rows.classroomActivity.find((a: any) => a.id === 'act-A-restr');
    expect(act.isRestrictedToAssigned).toBe(true); // valor original, no el del lote fallido
  });

  it('las escrituras de destinatarios usan el cliente tx, nunca el cliente raíz', async () => {
    const result = await service().assignStudentsToActivity(
      docenteA(), 'act-A-restr', { studentEnrollmentIds: ['enr-A1', 'enr-A2'], isRestrictedToAssigned: true },
    );
    expect(result.assignedStudents).toHaveLength(2);
    expect(data.tx.activityAssignment.createMany).toHaveBeenCalledTimes(1);
    expect(data.prisma.activityAssignment.createMany).not.toHaveBeenCalled();
    expect(data.prisma.activityAssignment.deleteMany).not.toHaveBeenCalled();
    expect(data.tx.classroomActivity.updateMany).toHaveBeenCalledTimes(1);
    expect(data.prisma.classroomActivity.updateMany).not.toHaveBeenCalled();
  });

  it('un lote de dependencias con un prerrequisito ajeno falla completo: 404 y nada escrito', async () => {
    await expect(
      service().setActivityDependencies(docenteA(), 'act-A-draft', [{ prerequisiteId: 'act-A-pub' }, { prerequisiteId: 'act-B-pub' }]),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(data.rows.activityDependency).toHaveLength(1); // solo dep-A1 original
    noWrites(data);
  });

  it('prerrequisito de otra aula del MISMO colegio → 400; de sí misma → 400; ciclo → 400', async () => {
    await expect(
      service().setActivityDependencies(docenteA(), 'act-A-draft', [{ prerequisiteId: 'act-otro-A' }]),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service().setActivityDependencies(docenteA(), 'act-A-draft', [{ prerequisiteId: 'act-A-draft' }]),
    ).rejects.toBeInstanceOf(BadRequestException);
    // act-A-dep ya depende de act-A-pub: hacer que act-A-pub dependa de act-A-dep sería un ciclo.
    await expect(
      service().setActivityDependencies(docenteA(), 'act-A-pub', [{ prerequisiteId: 'act-A-dep' }]),
    ).rejects.toBeInstanceOf(BadRequestException);
    noWrites(data);
  });

  it('un fallo a mitad de la escritura revierte TODA la transacción de dependencias', async () => {
    data.fail('activityDependency.create');
    await expect(
      service().setActivityDependencies(docenteA(), 'act-A-dep', [{ prerequisiteId: 'act-A-pub', condition: 'SUBMITTED' }]),
    ).rejects.toThrow('Fallo forzado');
    // dep-A1 (el deleteMany previo) se revirtió intacta.
    expect(data.rows.activityDependency.map((d: any) => d.id)).toEqual(['dep-A1']);
    expect(data.rows.activityDependency[0].condition).toBe('MIN_SCORE');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Flujos legítimos con contenido y conteos comprobables.
  // ═══════════════════════════════════════════════════════════════════════════
  it('el docente lista sus aulas con el conteo funcional de estudiantes del grupo/año', async () => {
    const lista = await service().listForTeacher(docenteA());
    const aula = lista.find((c: any) => c.id === 'class-A');
    expect(aula).toBeDefined();
    // Conteo funcional previo (groupId+academicYearId+ACTIVE): incluye la fila
    // incoherente histórica; la ruta de PII (getStudents) sí la excluye por cadena.
    expect(aula.studentCount).toBe(3);
  });

  it('el estudiante lista exactamente sus aulas institucionales con su matrícula resuelta', async () => {
    const lista = await service().listForStudent(estudianteA1());
    expect(lista.map((c: any) => c.id)).toEqual(['class-A']);
    expect(lista[0].studentEnrollmentId).toBe('enr-A1');
    // La fila incoherente (aula que dice A pero cuelga de la asignación de B) no se
    // cuela en la lista del estudiante de B: la institución se exige en el aula misma.
    const listaB = await service().listForStudent(estudianteB1());
    expect(listaB.map((c: any) => c.id)).toEqual(['class-B']);
  });

  it('getById del docente trae secciones, anuncios, conteos y el período vigente', async () => {
    const aula = await service().getById(docenteA(), 'class-A');
    expect(aula.title).toBe('Aula A');
    expect(aula.sections).toHaveLength(1);
    expect(aula.sections[0].activities.map((a: any) => a.id)).toEqual(['act-A-dep']); // solo publicadas
    expect(aula.announcements).toHaveLength(1);
    expect(aula._count.activities).toBe(4);
    expect(aula.currentPeriod?.id).toBe('term-A');
    expect(aula.academicPeriods).toHaveLength(1);
  });

  it('getById del estudiante compatible incluye su studentEnrollmentId', async () => {
    const aula = await service().getById(estudianteA1(), 'class-A');
    expect(aula.studentEnrollmentId).toBe('enr-A1');
  });

  it('la rama docente de actividades trae borradores, conteos de pendientes y prerrequisitos', async () => {
    const lista = await service().listActivities(docenteA(), 'class-A');
    expect(lista).toHaveLength(4); // incluye el borrador
    const pub = lista.find((a: any) => a.id === 'act-A-pub');
    expect(pub.gradingPending).toBe(1); // sub-A1 SUBMITTED; la GRADED no cuenta
    const dep = lista.find((a: any) => a.id === 'act-A-dep');
    expect(dep.prerequisites).toEqual([
      expect.objectContaining({ prerequisiteId: 'act-A-pub', condition: 'MIN_SCORE', minScore: 5 }),
    ]);
  });

  it('create crea el aula con la institución del actor y la quita de disponibles', async () => {
    const creada = await service().create(docenteA(), { teacherAssignmentId: 'ta-disponible-A' });
    expect(creada.institutionId).toBe(A);
    expect(creada.title).toBe('Materia A - Grado A A-02');
    const disp = await service().getAvailableAssignments(docenteA());
    expect(disp).toEqual([]);
    // Duplicado → 403 como antes.
    await expect(service().create(docenteA(), { teacherAssignmentId: 'ta-disponible-A' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('create con la asignación de otro docente del mismo colegio → 403', async () => {
    await expect(service().create(docenteA(), { teacherAssignmentId: 'ta-otro-A' })).rejects.toBeInstanceOf(ForbiddenException);
    noWrites(data);
  });

  it('update cambia solo campos permitidos del aula propia', async () => {
    const actualizada = await service().update(docenteA(), 'class-A', { title: 'Aula renombrada', color: '#fff' });
    expect(actualizada.title).toBe('Aula renombrada');
    expect(data.rows.classroom.find((c) => c.id === 'class-A').color).toBe('#fff');
    expect(data.tx.classroom.updateMany).toHaveBeenCalledTimes(1);
    expect(data.prisma.classroom.updateMany).not.toHaveBeenCalled();
  });

  it('getStudents devuelve la PII del grupo propio filtrada por cadena (sin la incoherente)', async () => {
    const students = await service().getStudents(docenteA(), 'class-A');
    expect(students.map((e: any) => e.id).sort()).toEqual(['enr-A1', 'enr-A2']); // no enr-inc-A
    expect(JSON.stringify(students)).not.toContain('DeB');
  });

  it('getClassroomStudentsForAssignment devuelve solo matrículas activas de la institución', async () => {
    const lista = await service().getClassroomStudentsForAssignment(docenteA(), 'class-A');
    expect(lista.map((e: any) => e.enrollmentId).sort()).toEqual(['enr-A1', 'enr-A2']);
  });

  it('createActivity crea borrador en el aula propia; sección ajena al aula → 403', async () => {
    const act = await service().createActivity(docenteA(), 'class-A', {
      type: 'TASK', title: 'Nueva tarea', sectionId: 'section-A1', dueDate: '2026-03-10',
    });
    expect(act.isPublished).toBe(false);
    expect(act.classroomId).toBe('class-A');
    expect(new Date(act.dueDate).toISOString()).toBe('2026-03-10T05:00:00.000Z'); // fecha Colombia
    await expect(
      service().createActivity(docenteA(), 'class-A', { type: 'TASK', title: 'x', sectionId: 'section-B1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('updateActivity edita la actividad propia con fecha parseada; fecha inválida → 400', async () => {
    const act = await service().updateActivity(docenteA(), 'act-A-pub', { title: 'Título nuevo', dueDate: '2026-04-01' });
    expect(act.title).toBe('Título nuevo');
    expect(new Date(act.dueDate).toISOString()).toBe('2026-04-01T05:00:00.000Z');
    await expect(service().updateActivity(docenteA(), 'act-A-pub', { dueDate: 'no-es-fecha' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('publish inmediato y programado conservan su semántica de campos', async () => {
    const programada = await service().publishActivity(docenteA(), 'act-A-draft', { scheduledPublishAt: '2026-12-01' });
    expect(programada.isPublished).toBe(false);
    expect(new Date(programada.scheduledPublishAt).toISOString()).toBe('2026-12-01T05:00:00.000Z');
    const inmediata = await service().publishActivity(docenteA(), 'act-A-draft');
    expect(inmediata.isPublished).toBe(true);
    expect(inmediata.isVisible).toBe(true);
    expect(inmediata.scheduledPublishAt).toBeNull();
    expect(inmediata.publishedAt).toBeInstanceOf(Date);
    const despublicada = await service().unpublishActivity(docenteA(), 'act-A-draft');
    expect(despublicada.isPublished).toBe(false);
    expect(despublicada.scheduledPublishAt).toBeNull();
  });

  it('setActivityDependencies reemplaza el conjunto y normaliza la condición', async () => {
    const deps = await service().setActivityDependencies(docenteA(), 'act-A-draft', [
      { prerequisiteId: 'act-A-pub', condition: 'inventada' }, // normaliza a SUBMITTED
      { prerequisiteId: 'act-A-pub' }, // duplicado: se ignora como antes
    ]);
    expect(deps).toHaveLength(1);
    expect(deps[0]).toMatchObject({ prerequisiteId: 'act-A-pub', condition: 'SUBMITTED' });
  });

  it('getActivityAssignments devuelve los destinatarios propios con su estudiante', async () => {
    const lista = await service().getActivityAssignments(docenteA(), 'act-A-restr');
    expect(lista).toHaveLength(1);
    expect(lista[0].studentEnrollment.student.lastName).toBe('Compatible');
  });

  it('deleteActivity pide confirmación con entregas y borra con force', async () => {
    const confirmacion = await service().deleteActivity(docenteA(), 'act-A-pub', false);
    expect(confirmacion).toMatchObject({ success: false, requiresConfirmation: true, submissionCount: 2 });
    expect(data.rows.classroomActivity.find((a) => a.id === 'act-A-pub')).toBeDefined();
    const borrada = await service().deleteActivity(docenteA(), 'act-A-pub', true);
    expect(borrada).toEqual({ success: true });
    expect(data.rows.classroomActivity.find((a) => a.id === 'act-A-pub')).toBeUndefined();
    expect(data.tx.classroomActivity.deleteMany).toHaveBeenCalledTimes(1);
    expect(data.prisma.classroomActivity.deleteMany).not.toHaveBeenCalled();
  });

  it('los conteos por colegio no se movieron con todos los rechazos', () => {
    expect(conteo(data.rows, 'classroom', A)).toBe(5); // class-A, class-otro-A, huerfana, inc, personal
    expect(conteo(data.rows, 'classroom', B)).toBe(1);
    expect(conteo(data.rows, 'studentEnrollment', A)).toBe(5); // A1-A4 + inc
    expect(conteo(data.rows, 'studentEnrollment', B)).toBe(1);
  });
});
