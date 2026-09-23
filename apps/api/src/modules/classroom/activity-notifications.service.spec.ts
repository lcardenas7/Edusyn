import { ActivityNotificationsService } from './activity-notifications.service';

/**
 * Avisos de actividad nueva.
 *
 * Lo que se fija aquí es a quién se avisa y a dónde lleva el aviso, que es lo que el estudiante
 * nota: antes tenía que entrar al aula a mirar si había algo nuevo.
 *
 * Y se fijan las dos reglas que costaron una publicación perdida al escribir esto: el aviso se
 * escribe con el cliente SIN contexto de transacción, y no usa nada que pueda violar el único de
 * `sourceKey`. Con `create()` normal, republicar una actividad abortaba la transacción de la
 * petición entera y la actividad se quedaba sin publicar.
 */
const AULA = 'aula-1';
const ACTIVIDAD = 'act-1';

function matches(row: any, where: any): boolean {
  return Object.entries(where).every(([key, value]: [string, any]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (Array.isArray(value.in)) return value.in.includes(row?.[key]);
      return row?.[key] != null && matches(row[key], value);
    }
    return row?.[key] === value;
  });
}

function matricula(userId: string | null, institutionId = 'inst-A') {
  return {
    id: `enr-${userId ?? 'null'}`, institutionId, groupId: 'grupo-1', academicYearId: 'anio-1', status: 'ACTIVE',
    student: { institutionId, userId }, academicYear: { institutionId },
    group: { campus: { institutionId }, grade: { institutionId } },
  };
}

function actividad(extra: Record<string, unknown> = {}) {
  return {
    id: ACTIVIDAD,
    title: 'Fracciones equivalentes',
    type: 'TASK',
    dueDate: new Date('2026-09-26T23:59:00.000Z'),
    isPublished: true,
    isVisible: true,
    isRouteScoped: false,
    isRestrictedToAssigned: false,
    classroomId: AULA,
    assignedStudents: [],
    classroom: {
      institutionId: 'inst-A',
      isPersonal: false,
      teacherAssignmentId: 'ta-A',
      teacherAssignment: {
        id: 'ta-A',
        institutionId: 'inst-A',
        teacherId: 'docente-1',
        groupId: 'grupo-1',
        academicYearId: 'anio-1',
        academicYear: { institutionId: 'inst-A' },
        group: { campus: { institutionId: 'inst-A' }, grade: { institutionId: 'inst-A' } },
        subject: { name: 'Matemáticas', area: { institutionId: 'inst-A' } },
      },
    },
    ...extra,
  };
}

function hacerServicio(opciones: {
  actividad?: Record<string, unknown> | null;
  matriculas?: Array<ReturnType<typeof matricula>>;
  yaTieneDestinatarios?: number;
  falla?: unknown;
} = {}) {
  const creados: any[] = [];
  const destinatarios: any[] = [];

  const raw = {
    classroomActivity: {
      findUnique: jest.fn().mockResolvedValue(
        opciones.actividad === undefined ? actividad() : opciones.actividad,
      ),
    },
    studentEnrollment: {
      findMany: jest.fn(async ({ where }: any) =>
        (opciones.matriculas ?? [matricula('user-A'), matricula('user-B')]).filter((row) => matches(row, where))),
    },
    message: {
      createMany: jest.fn(async ({ data }: any) => {
        if (opciones.falla) throw opciones.falla;
        creados.push(...data);
        return { count: data.length };
      }),
      findUnique: jest.fn().mockResolvedValue({ id: 'msg-1' }),
    },
    messageRecipient: {
      count: jest.fn().mockResolvedValue(opciones.yaTieneDestinatarios ?? 0),
      createMany: jest.fn(async ({ data }: any) => {
        destinatarios.push(...data);
        return { count: data.length };
      }),
    },
  };

  // El PrismaService real es un Proxy que redirige a la transacción de la petición cuando la hay.
  // Aquí, tocar el proxy en vez de `$raw` es un fallo: rompe la regla 1 del servicio.
  const proxy = new Proxy(
    { $raw: raw },
    {
      get(destino: any, prop: string) {
        if (prop === '$raw') return destino.$raw;
        throw new Error(`El aviso usó el cliente con contexto (.${String(prop)}) en vez de $raw`);
      },
    },
  );

  return { raw, creados, destinatarios, servicio: new ActivityNotificationsService(proxy as any) };
}

describe('Avisos de actividad publicada', () => {
  it('avisa a cada estudiante del aula', async () => {
    const { servicio, destinatarios } = hacerServicio();

    await expect(servicio.avisarActividadPublicada(ACTIVIDAD)).resolves.toBe(2);

    expect(destinatarios).toEqual([
      { messageId: 'msg-1', recipientType: 'USER', recipientId: 'user-A' },
      { messageId: 'msg-1', recipientType: 'USER', recipientId: 'user-B' },
    ]);
  });

  it('el aviso lleva DIRECTO a la actividad, no al aula', async () => {
    const { servicio, creados } = hacerServicio();

    await servicio.avisarActividadPublicada(ACTIVIDAD);

    expect(creados[0].link).toBe(`/aula/${AULA}/actividades/${ACTIVIDAD}`);
  });

  it('dice qué es y para cuándo, en hora de Colombia', async () => {
    const { servicio, creados } = hacerServicio();

    await servicio.avisarActividadPublicada(ACTIVIDAD);

    expect(creados[0].subject).toBe('Matemáticas: Fracciones equivalentes');
    // 26-sep 23:59 UTC es todavía el 26 en Colombia (UTC-5); con la zona del servidor sería el 27.
    expect(creados[0].content).toContain('26 de septiembre');
    expect(creados[0].origin).toBe('actividad-publicada');
    expect(creados[0].status).toBe('SENT');
  });

  it('sin fecha de entrega lo dice, en vez de dejar el hueco', async () => {
    const { servicio, creados } = hacerServicio({ actividad: actividad({ dueDate: null }) });

    await servicio.avisarActividadPublicada(ACTIVIDAD);

    expect(creados[0].content).toBe('Tarea nueva, sin fecha de entrega.');
  });

  it('concuerda el género: "Quiz nuevo", no "Quiz nueva"', async () => {
    const { servicio, creados } = hacerServicio({ actividad: actividad({ type: 'QUIZ', dueDate: null }) });

    await servicio.avisarActividadPublicada(ACTIVIDAD);

    expect(creados[0].content).toBe('Quiz nuevo, sin fecha de entrega.');
  });

  describe('no puede tumbar la publicación', () => {
    it('escribe con el cliente sin contexto, fuera de la transacción de la petición', async () => {
      // Si tocara el proxy, el doble lanzaría y el servicio devolvería 0 tras registrar el error.
      const { servicio, raw } = hacerServicio();

      await expect(servicio.avisarActividadPublicada(ACTIVIDAD)).resolves.toBe(2);
      expect(raw.message.createMany).toHaveBeenCalled();
    });

    it('inserta con skipDuplicates: nada aquí puede violar el único de sourceKey', async () => {
      const { servicio, raw } = hacerServicio();

      await servicio.avisarActividadPublicada(ACTIVIDAD);

      expect(raw.message.createMany).toHaveBeenCalledWith(
        expect.objectContaining({ skipDuplicates: true }),
      );
    });

    it('programar() no hace esperar a quien publica', () => {
      const { servicio, raw } = hacerServicio();

      expect(servicio.programar(ACTIVIDAD)).toBeUndefined();
      // Todavía no ha tocado la base: corre cuando la petición ya terminó.
      expect(raw.classroomActivity.findUnique).not.toHaveBeenCalled();
    });

    it('si algo falla, se traga el error: la actividad ya está publicada', async () => {
      const { servicio } = hacerServicio({ falla: new Error('la base se cayó') });
      await expect(servicio.avisarActividadPublicada(ACTIVIDAD)).resolves.toBe(0);
    });
  });

  describe('lo que no se anuncia', () => {
    it('un borrador', async () => {
      const { servicio, raw } = hacerServicio({ actividad: actividad({ isPublished: false }) });
      await expect(servicio.avisarActividadPublicada(ACTIVIDAD)).resolves.toBe(0);
      expect(raw.message.createMany).not.toHaveBeenCalled();
    });

    it('una actividad escondida', async () => {
      const { servicio, raw } = hacerServicio({ actividad: actividad({ isVisible: false }) });
      await expect(servicio.avisarActividadPublicada(ACTIVIDAD)).resolves.toBe(0);
      expect(raw.message.createMany).not.toHaveBeenCalled();
    });

    it('una actividad que vive dentro de una ruta: no se abre desde Actividades', async () => {
      const { servicio, raw } = hacerServicio({ actividad: actividad({ isRouteScoped: true }) });
      await expect(servicio.avisarActividadPublicada(ACTIVIDAD)).resolves.toBe(0);
      expect(raw.message.createMany).not.toHaveBeenCalled();
    });

    it('una actividad restringida sin nadie asignado', async () => {
      const { servicio, raw } = hacerServicio({
        actividad: actividad({ isRestrictedToAssigned: true, assignedStudents: [] }),
      });
      await expect(servicio.avisarActividadPublicada(ACTIVIDAD)).resolves.toBe(0);
      expect(raw.message.createMany).not.toHaveBeenCalled();
    });

    it('un aula donde ningún estudiante tiene usuario todavía', async () => {
      const { servicio, raw } = hacerServicio({ matriculas: [matricula(null)] });
      await expect(servicio.avisarActividadPublicada(ACTIVIDAD)).resolves.toBe(0);
      expect(raw.message.createMany).not.toHaveBeenCalled();
    });

    it('una actividad ya avisada: despublicar y republicar no vuelve a sonar', async () => {
      const { servicio, destinatarios } = hacerServicio({ yaTieneDestinatarios: 25 });
      await expect(servicio.avisarActividadPublicada(ACTIVIDAD)).resolves.toBe(0);
      expect(destinatarios).toEqual([]);
    });

    it('una actividad que no existe tampoco revienta', async () => {
      const { servicio } = hacerServicio({ actividad: null });
      await expect(servicio.avisarActividadPublicada(ACTIVIDAD)).resolves.toBe(0);
    });
  });

  it('solo avisa a los asignados cuando la actividad es para algunos', async () => {
    const { servicio, raw } = hacerServicio({
      actividad: actividad({
        isRestrictedToAssigned: true,
        assignedStudents: [{ studentEnrollmentId: 'matricula-3' }],
      }),
      matriculas: [{ ...matricula('user-C'), id: 'matricula-3' }],
    });

    await expect(servicio.avisarActividadPublicada(ACTIVIDAD)).resolves.toBe(1);
    expect(raw.studentEnrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: ['matricula-3'] } }) }),
    );
  });

  it('no repite a un estudiante matriculado dos veces', async () => {
    const { servicio, destinatarios } = hacerServicio({
      matriculas: [matricula('user-A'), { ...matricula('user-A'), id: 'enr-2' }],
    });

    await expect(servicio.avisarActividadPublicada(ACTIVIDAD)).resolves.toBe(1);
    expect(destinatarios).toHaveLength(1);
  });

  it('avisa de varias de una vez, para las programadas', async () => {
    const { servicio } = hacerServicio();
    await expect(servicio.avisarVarias([ACTIVIDAD, 'act-2'])).resolves.toBe(4);
  });

  it('descarta una matrícula que dice A pero cuyo estudiante pertenece a B', async () => {
    const cross = matricula('user-B', 'inst-A');
    cross.student.institutionId = 'inst-B';
    const { servicio, destinatarios } = hacerServicio({ matriculas: [matricula('user-A'), cross] });
    await expect(servicio.avisarActividadPublicada(ACTIVIDAD)).resolves.toBe(1);
    expect(destinatarios.map((r) => r.recipientId)).toEqual(['user-A']);
  });

  it('descarta una matrícula con sede de otro colegio aunque los ids de grupo y año coincidan', async () => {
    const cross = matricula('user-B');
    cross.group.campus.institutionId = 'inst-B';
    const { servicio, destinatarios } = hacerServicio({ matriculas: [matricula('user-A'), cross] });
    await expect(servicio.avisarActividadPublicada(ACTIVIDAD)).resolves.toBe(1);
    expect(destinatarios.map((r) => r.recipientId)).toEqual(['user-A']);
  });

  it('no anuncia una actividad cuya asignación docente cuelga de otra institución', async () => {
    const bad = actividad();
    bad.classroom.teacherAssignment.institutionId = 'inst-B';
    const { servicio, raw } = hacerServicio({ actividad: bad });
    await expect(servicio.avisarActividadPublicada(ACTIVIDAD)).resolves.toBe(0);
    expect(raw.studentEnrollment.findMany).not.toHaveBeenCalled();
    expect(raw.message.createMany).not.toHaveBeenCalled();
  });
});
