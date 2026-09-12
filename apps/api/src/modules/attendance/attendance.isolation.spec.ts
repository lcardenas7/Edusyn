import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { A, B, DIA, DIA_CERRADO, conteo, fixture, noAudit, noWrites } from '../../../test/fixtures/attendance.fixture';

/**
 * Aislamiento de Asistencia a nivel de SERVICIO.
 *
 * Cada caso se ejecuta en las dos direcciones (actor de A contra B y actor de B contra A) y afirma
 * también **lo que no ocurrió**: ninguna escritura, ninguna auditoría y ningún cambio en el conteo
 * de filas del colegio atacado. Un 404 que además hubiera escrito no sería un rechazo.
 *
 * Lo que aquí se demuestra es la guarda de la APLICACIÓN. PostgreSQL, RLS y el despliegue se
 * declaran aparte.
 */
describe('Asistencia · aislamiento por servicio', () => {
  let data: ReturnType<typeof fixture>;

  beforeEach(() => { data = fixture(); });

  const otro = (x: string) => (x === 'A' ? 'B' : 'A');
  const inst = (x: string) => (x === 'A' ? A : B);

  /** Nada se movió en NINGUNO de los dos colegios. */
  const nadaSeMovio = () => {
    noWrites(data.prisma);
    noAudit(data.prisma);
    expect(conteo(data.rows, 'attendanceRecord', A)).toBe(2);
    expect(conteo(data.rows, 'attendanceRecord', B)).toBe(2);
    expect(conteo(data.rows, 'tutoringAttendance', A)).toBe(2);
    expect(conteo(data.rows, 'tutoringAttendance', B)).toBe(2);
  };

  describe.each([['A'], ['B']])('actor del colegio %s contra el otro', (x) => {
    const yo = inst(x);
    const ajeno = otro(x);

    // ─── Asistencia por asignatura ──────────────────────────────────────────
    it('no registra asistencia masiva en una asignación ajena', async () => {
      await expect(data.service.recordBulk(
        { teacherAssignmentId: `ta-${ajeno}`, date: DIA.toISOString(), records: [{ studentEnrollmentId: `enr-${ajeno}1`, status: 'PRESENT' as any }] },
        yo,
      )).rejects.toBeInstanceOf(NotFoundException);
      nadaSeMovio();
    });

    it('no cuelga una matrícula ajena de una asignación propia', async () => {
      await expect(data.service.recordBulk(
        { teacherAssignmentId: `ta-${x}`, date: DIA.toISOString(), records: [{ studentEnrollmentId: `enr-${ajeno}1`, status: 'ABSENT' as any }] },
        yo,
      )).rejects.toBeInstanceOf(NotFoundException);
      nadaSeMovio();
    });

    it('no actualiza un registro ajeno', async () => {
      await expect(data.service.update(`rec-${ajeno}1`, { status: 'ABSENT' as any }, yo))
        .rejects.toBeInstanceOf(NotFoundException);
      expect(data.rows.attendanceRecord.find((r) => r.id === `rec-${ajeno}1`).status).toBe('PRESENT');
      nadaSeMovio();
    });

    it('no lee por asignación ajena', async () => {
      await expect(data.service.getByAssignmentAndDate(`ta-${ajeno}`, DIA.toISOString(), yo))
        .rejects.toBeInstanceOf(NotFoundException);
      nadaSeMovio();
    });

    it('no lee por matrícula ajena', async () => {
      await expect(data.service.getByStudent(`enr-${ajeno}1`, yo))
        .rejects.toBeInstanceOf(NotFoundException);
      nadaSeMovio();
    });

    it('no resume una matrícula ajena', async () => {
      await expect(data.service.getStudentSummary(`enr-${ajeno}1`, yo))
        .rejects.toBeInstanceOf(NotFoundException);
      nadaSeMovio();
    });

    it('no acepta un período ajeno sobre una matrícula propia', async () => {
      await expect(data.service.getStudentSummary(`enr-${x}1`, yo, `term-${ajeno}`))
        .rejects.toBeInstanceOf(NotFoundException);
      nadaSeMovio();
    });

    it('el reporte de asignación ajena responde 404, no un error genérico', async () => {
      const error = await data.service
        .getGroupAttendanceReport(`ta-${ajeno}`, DIA.toISOString(), DIA.toISOString(), yo)
        .catch((e) => e);
      expect(error).toBeInstanceOf(NotFoundException);
      nadaSeMovio();
    });

    it('no reporta por grupo ajeno ni por año ajeno', async () => {
      await expect(data.service.getReportByGroup(`group-${ajeno}`, `year-${x}`, yo))
        .rejects.toBeInstanceOf(NotFoundException);
      await expect(data.service.getReportByGroup(`group-${x}`, `year-${ajeno}`, yo))
        .rejects.toBeInstanceOf(NotFoundException);
      nadaSeMovio();
    });

    it('no consolida con año ni materia ajenos', async () => {
      await expect(data.service.getConsolidatedReport({ academicYearId: `year-${ajeno}`, institutionId: yo }))
        .rejects.toBeInstanceOf(NotFoundException);
      await expect(data.service.getConsolidatedReport({ academicYearId: `year-${x}`, institutionId: yo, subjectId: `subject-${ajeno}` }))
        .rejects.toBeInstanceOf(NotFoundException);
      nadaSeMovio();
    });

    it('no mide cumplimiento docente con año, grupo o materia ajenos', async () => {
      await expect(data.service.getTeacherComplianceReport({ academicYearId: `year-${ajeno}`, institutionId: yo }))
        .rejects.toBeInstanceOf(NotFoundException);
      await expect(data.service.getTeacherComplianceReport({ academicYearId: `year-${x}`, institutionId: yo, groupId: `group-${ajeno}` }))
        .rejects.toBeInstanceOf(NotFoundException);
      await expect(data.service.getTeacherComplianceReport({ academicYearId: `year-${x}`, institutionId: yo, subjectId: `subject-${ajeno}` }))
        .rejects.toBeInstanceOf(NotFoundException);
      nadaSeMovio();
    });

    it('no detalla con año, grupo, materia o matrícula ajenos', async () => {
      const base = { academicYearId: `year-${x}`, institutionId: yo };
      await expect(data.service.getDetailedReport({ ...base, academicYearId: `year-${ajeno}` })).rejects.toBeInstanceOf(NotFoundException);
      await expect(data.service.getDetailedReport({ ...base, groupId: `group-${ajeno}` })).rejects.toBeInstanceOf(NotFoundException);
      await expect(data.service.getDetailedReport({ ...base, subjectId: `subject-${ajeno}` })).rejects.toBeInstanceOf(NotFoundException);
      await expect(data.service.getDetailedReport({ ...base, studentEnrollmentId: `enr-${ajeno}1` })).rejects.toBeInstanceOf(NotFoundException);
      nadaSeMovio();
    });

    // ─── Tutoría ────────────────────────────────────────────────────────────
    it('no registra tutoría en un grupo ajeno, ni siquiera siendo su director', async () => {
      await expect(data.tutoring.recordBulk({
        groupId: `group-${ajeno}`, institutionId: yo, teacherId: `teacher-${ajeno}`,
        date: DIA.toISOString(), userRoles: ['ADMIN_INSTITUTIONAL'],
        records: [{ studentEnrollmentId: `enr-${ajeno}1`, status: 'ABSENT' as any }],
      })).rejects.toBeInstanceOf(NotFoundException);
      nadaSeMovio();
    });

    it('no lee tutoría de un grupo ajeno', async () => {
      await expect(data.tutoring.getByGroupAndDate(`group-${ajeno}`, DIA.toISOString(), yo))
        .rejects.toBeInstanceOf(NotFoundException);
      nadaSeMovio();
    });

    it('no resume tutoría de una matrícula ajena', async () => {
      await expect(data.tutoring.getStudentSummary(`enr-${ajeno}1`, yo))
        .rejects.toBeInstanceOf(NotFoundException);
      nadaSeMovio();
    });

    it('la frontera institucional va ANTES que el permiso interno: grupo ajeno es 404, no 403', async () => {
      const error = await data.tutoring
        .assertCanReadGroupReport(`group-${ajeno}`, yo, `teacher-${x}`, ['DOCENTE'])
        .catch((e) => e);
      expect(error).toBeInstanceOf(NotFoundException);
      expect(error).not.toBeInstanceOf(ForbiddenException);
      nadaSeMovio();
    });

    it('ni siquiera un SuperAdmin con institución fijada cruza a un grupo ajeno', async () => {
      await expect(data.tutoring.assertCanReadGroupReport(`group-${ajeno}`, yo, 'root', [], true))
        .rejects.toBeInstanceOf(NotFoundException);
      nadaSeMovio();
    });

    it('no reporta tutoría por grupo ni año ajenos', async () => {
      await expect(data.tutoring.getReportByGroup(`group-${ajeno}`, `year-${x}`, yo))
        .rejects.toBeInstanceOf(NotFoundException);
      await expect(data.tutoring.getReportByGroup(`group-${x}`, `year-${ajeno}`, yo))
        .rejects.toBeInstanceOf(NotFoundException);
      nadaSeMovio();
    });

    it('no detalla tutoría con año, grupo o matrícula ajenos', async () => {
      const base = { institutionId: yo, academicYearId: `year-${x}` };
      await expect(data.tutoring.getDetailedReport({ ...base, academicYearId: `year-${ajeno}` })).rejects.toBeInstanceOf(NotFoundException);
      await expect(data.tutoring.getDetailedReport({ ...base, groupId: `group-${ajeno}` })).rejects.toBeInstanceOf(NotFoundException);
      await expect(data.tutoring.getDetailedReport({ ...base, studentEnrollmentId: `enr-${ajeno}1` })).rejects.toBeInstanceOf(NotFoundException);
      nadaSeMovio();
    });

    it('la tutoría de otro colegio no cuenta como habilitada por tener el módulo activo aquí', async () => {
      data.rows.institutionModule.find((m) => m.institutionId === inst(ajeno)).features = [];
      expect(await data.tutoring.isTutoringEnabled(inst(ajeno))).toBe(false);
      expect(await data.tutoring.isTutoringEnabled(yo)).toBe(true);
    });

    it('los grupos dirigidos no incluyen los del otro colegio aunque comparta docente', async () => {
      data.rows.group.find((g) => g.id === `group-${ajeno}`).directorId = `teacher-${x}`;
      const grupos = await data.tutoring.getDirectedGroups(`teacher-${x}`, yo);
      expect(grupos.map((g: any) => g.id)).toEqual([`group-${x}`]);
    });
  });

  // ─── Referencias secundarias mezcladas dentro del mismo colegio ────────────
  it('una matrícula del mismo colegio pero de OTRO grupo no entra en la asignación', async () => {
    data.rows.studentEnrollment.push({
      id: 'enr-A-otro-grupo', institutionId: A, studentId: 'student-A3',
      student: { id: 'student-A3', firstName: 'Otro', lastName: 'Grupo' },
      academicYearId: 'year-A', groupId: 'group-A-otro', group: { id: 'group-A-otro', campus: { institutionId: A } },
      status: 'ACTIVE', attendanceRecords: [],
    });
    await expect(data.service.recordBulk(
      { teacherAssignmentId: 'ta-A', date: DIA.toISOString(), records: [{ studentEnrollmentId: 'enr-A-otro-grupo', status: 'PRESENT' as any }] },
      A,
    )).rejects.toBeInstanceOf(NotFoundException);
    noWrites(data.prisma);
  });

  it('una matrícula del mismo grupo pero de OTRO año tampoco entra', async () => {
    const enr = data.rows.studentEnrollment.find((e) => e.id === 'enr-A1');
    enr.academicYearId = 'year-A-anterior';
    await expect(data.service.recordBulk(
      { teacherAssignmentId: 'ta-A', date: DIA.toISOString(), records: [{ studentEnrollmentId: 'enr-A1', status: 'PRESENT' as any }] },
      A,
    )).rejects.toBeInstanceOf(NotFoundException);
    noWrites(data.prisma);
  });

  it('una FK histórica incoherente no basta: el grupo se valida por su sede', async () => {
    // Fila marcada como de A, pero colgada de una sede de B: la relación manda.
    data.rows.group.push({ id: 'group-mixto', name: 'Mixto', campusId: 'campus-B', campus: { id: 'campus-B', institutionId: B }, grade: { name: 'X' } });
    await expect(data.service.getReportByGroup('group-mixto', 'year-A', A))
      .rejects.toBeInstanceOf(NotFoundException);
    noWrites(data.prisma);
  });

  // ─── Fechas y contexto ────────────────────────────────────────────────────
  it.each([
    ['registro masivo', () => data.service.recordBulk({ teacherAssignmentId: 'ta-A', date: 'no-es-fecha', records: [{ studentEnrollmentId: 'enr-A1', status: 'PRESENT' as any }] }, A)],
    ['lectura por asignación', () => data.service.getByAssignmentAndDate('ta-A', 'ayer', A)],
    ['lectura por estudiante', () => data.service.getByStudent('enr-A1', A, 'mal', undefined)],
    ['reporte de asignación', () => data.service.getGroupAttendanceReport('ta-A', 'mal', 'peor', A)],
    ['reporte por grupo', () => data.service.getReportByGroup('group-A', 'year-A', A, { startDate: 'mal' })],
    ['consolidado', () => data.service.getConsolidatedReport({ academicYearId: 'year-A', institutionId: A, endDate: 'mal' })],
    ['tutoría por grupo y fecha', () => data.tutoring.getByGroupAndDate('group-A', 'mal', A)],
  ])('una fecha inválida en %s es 400, no un Invalid Date silencioso', async (_caso, ejecutar) => {
    await expect(ejecutar()).rejects.toBeInstanceOf(BadRequestException);
    noWrites(data.prisma);
  });

  it('una lista de registros vacía es 400 y no abre transacción', async () => {
    await expect(data.service.recordBulk({ teacherAssignmentId: 'ta-A', date: DIA.toISOString(), records: [] }, A))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(data.prisma.$transaction).not.toHaveBeenCalled();
    noWrites(data.prisma);
  });

  // ─── Reglas funcionales legítimas que deben sobrevivir ────────────────────
  it('un período FINALIZED sigue bloqueando la fecha, y no escribe nada', async () => {
    await expect(data.service.recordBulk(
      { teacherAssignmentId: 'ta-A', date: DIA_CERRADO.toISOString(), records: [{ studentEnrollmentId: 'enr-A1', status: 'ABSENT' as any }] },
      A,
    )).rejects.toBeInstanceOf(ForbiddenException);
    noWrites(data.prisma);
  });

  it('el docente que no dirige el grupo sigue sin poder registrar tutoría (403 dentro del colegio)', async () => {
    await expect(data.tutoring.recordBulk({
      groupId: 'group-A', institutionId: A, teacherId: 'teacher-A-suplente',
      date: DIA.toISOString(), userRoles: ['DOCENTE'],
      records: [{ studentEnrollmentId: 'enr-A1', status: 'PRESENT' as any }],
    })).rejects.toBeInstanceOf(ForbiddenException);
    noWrites(data.prisma);
  });

  it('con la tutoría deshabilitada no se registra, aunque el grupo sea propio', async () => {
    data.rows.institutionModule.find((m) => m.institutionId === A).features = [];
    await expect(data.tutoring.recordBulk({
      groupId: 'group-A', institutionId: A, teacherId: 'teacher-A',
      date: DIA.toISOString(), userRoles: ['DOCENTE'],
      records: [{ studentEnrollmentId: 'enr-A1', status: 'PRESENT' as any }],
    })).rejects.toBeInstanceOf(ForbiddenException);
    noWrites(data.prisma);
  });

  // ─── Casos legítimos y aritmética ─────────────────────────────────────────
  it('el registro propio actualiza el existente y audita el cambio de estado', async () => {
    const salida = await data.service.recordBulk(
      { teacherAssignmentId: 'ta-A', date: DIA.toISOString(), records: [{ studentEnrollmentId: 'enr-A1', status: 'ABSENT' as any }] },
      A,
      { userId: 'teacher-A', name: 'Docente A', role: 'DOCENTE' },
    );
    expect(salida).toHaveLength(1);
    expect(data.rows.attendanceRecord.find((r) => r.id === 'rec-A1').status).toBe('ABSENT');
    // No se creó una fila nueva: se actualizó la que ya existía para ese día.
    expect(conteo(data.rows, 'attendanceRecord', A)).toBe(2);
    expect(data.prisma.attendanceRecord.create).not.toHaveBeenCalled();
    expect(data.prisma.attendanceAuditEvent.createMany).toHaveBeenCalledTimes(1);
    const evento = data.prisma.attendanceAuditEvent.createMany.mock.calls[0][0].data[0];
    expect(evento).toMatchObject({ institutionId: A, action: 'UPDATE', previousStatus: 'PRESENT', newStatus: 'ABSENT', actorUserId: 'teacher-A' });
  });

  it('un día nuevo crea filas y las audita como CREATE', async () => {
    const otroDia = new Date('2026-03-03T00:00:00.000Z').toISOString();
    await data.service.recordBulk(
      { teacherAssignmentId: 'ta-A', date: otroDia, records: [
        { studentEnrollmentId: 'enr-A1', status: 'PRESENT' as any },
        { studentEnrollmentId: 'enr-A2', status: 'LATE' as any },
      ] },
      A,
    );
    expect(conteo(data.rows, 'attendanceRecord', A)).toBe(4);
    expect(conteo(data.rows, 'attendanceRecord', B)).toBe(2);
    const eventos = data.prisma.attendanceAuditEvent.createMany.mock.calls[0][0].data;
    expect(eventos).toHaveLength(2);
    expect(eventos.every((e: any) => e.action === 'CREATE' && e.institutionId === A)).toBe(true);
  });

  it('el resumen del estudiante cuenta solo su colegio y su matrícula', async () => {
    const resumen = await data.service.getStudentSummary('enr-A1', A);
    expect(resumen).toMatchObject({ total: 1, present: 1, absent: 0, attendanceRate: 100 });
  });

  it('el reporte de asignación suma bien: uno presente y uno ausente', async () => {
    const reporte = await data.service.getGroupAttendanceReport('ta-A', DIA.toISOString(), DIA.toISOString(), A);
    expect(reporte).toHaveLength(2);
    expect(reporte.map((r: any) => r.summary.attendanceRate).sort()).toEqual([0, 100]);
    expect(reporte.every((r: any) => r.summary.total === 1)).toBe(true);
  });

  it('el reporte de asignación excluye días fuera del rango', async () => {
    const reporte = await data.service.getGroupAttendanceReport(
      'ta-A', '2026-04-01T00:00:00.000Z', '2026-04-30T00:00:00.000Z', A,
    );
    expect(reporte.every((r: any) => r.summary.total === 0)).toBe(true);
  });

  it('el detallado propio devuelve solo filas propias, con su total y sin truncar', async () => {
    const reporte = await data.service.getDetailedReport({ academicYearId: 'year-A', institutionId: A });
    expect(reporte.total).toBe(2);
    expect(reporte.truncated).toBe(false);
    expect(reporte.rows.every((f: any) => f.groupName.includes('A') && f.subjectName === 'Materia A')).toBe(true);
    expect(data.prisma.attendanceRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ institutionId: A }) }),
    );
  });

  it('el detallado de tutoría propio devuelve solo filas propias', async () => {
    const filas = await data.tutoring.getDetailedReport({ institutionId: A, academicYearId: 'year-A' });
    expect(filas).toHaveLength(2);
    expect(filas.every((f: any) => f.groupName.includes('A'))).toBe(true);
  });

  // ─── Atomicidad ───────────────────────────────────────────────────────────
  it('si falla la auditoría, la asistencia NO queda escrita', async () => {
    data.prisma.attendanceAuditEvent.createMany.mockRejectedValueOnce(new Error('auditoría caída'));
    await expect(data.service.recordBulk(
      { teacherAssignmentId: 'ta-A', date: DIA.toISOString(), records: [{ studentEnrollmentId: 'enr-A1', status: 'ABSENT' as any }] },
      A,
    )).rejects.toThrow('auditoría caída');
    // Revertido: el estado anterior sigue en su sitio.
    expect(data.rows.attendanceRecord.find((r) => r.id === 'rec-A1').status).toBe('PRESENT');
    expect(conteo(data.rows, 'attendanceRecord', A)).toBe(2);
  });

  it('si falla una escritura intermedia, ninguna de las anteriores sobrevive', async () => {
    const otroDia = new Date('2026-03-04T00:00:00.000Z').toISOString();
    const crearReal = data.prisma.attendanceRecord.create.getMockImplementation();
    let llamadas = 0;
    data.prisma.attendanceRecord.create.mockImplementation(async (args: any) => {
      if (++llamadas === 2) throw new Error('fallo en la segunda fila');
      return crearReal(args);
    });
    await expect(data.service.recordBulk(
      { teacherAssignmentId: 'ta-A', date: otroDia, records: [
        { studentEnrollmentId: 'enr-A1', status: 'PRESENT' as any },
        { studentEnrollmentId: 'enr-A2', status: 'ABSENT' as any },
      ] },
      A,
    )).rejects.toThrow('fallo en la segunda fila');
    expect(conteo(data.rows, 'attendanceRecord', A)).toBe(2);
    noAudit(data.prisma);
  });

  it('si falla la escritura de tutoría a mitad, no queda media jornada registrada', async () => {
    const otroDia = new Date('2026-03-05T00:00:00.000Z').toISOString();
    const crearReal = data.prisma.tutoringAttendance.create.getMockImplementation();
    let llamadas = 0;
    data.prisma.tutoringAttendance.create.mockImplementation(async (args: any) => {
      if (++llamadas === 2) throw new Error('fallo de tutoría');
      return crearReal(args);
    });
    await expect(data.tutoring.recordBulk({
      groupId: 'group-A', institutionId: A, teacherId: 'teacher-A', date: otroDia, userRoles: ['DOCENTE'],
      records: [
        { studentEnrollmentId: 'enr-A1', status: 'PRESENT' as any },
        { studentEnrollmentId: 'enr-A2', status: 'ABSENT' as any },
      ],
    })).rejects.toThrow('fallo de tutoría');
    expect(conteo(data.rows, 'tutoringAttendance', A)).toBe(2);
  });

  it('la revalidación dentro de la transacción cierra la carrera guarda→escritura', async () => {
    // La asignación deja de ser de este colegio justo después de pasar la guarda.
    data.prisma.teacherAssignment.count.mockResolvedValueOnce(0);
    await expect(data.service.recordBulk(
      { teacherAssignmentId: 'ta-A', date: new Date('2026-03-06T00:00:00.000Z').toISOString(), records: [{ studentEnrollmentId: 'enr-A1', status: 'PRESENT' as any }] },
      A,
    )).rejects.toBeInstanceOf(NotFoundException);
    expect(conteo(data.rows, 'attendanceRecord', A)).toBe(2);
    noAudit(data.prisma);
  });
});
