import { ReportCardGenerationAuditService } from './report-card-generation-audit.service';

/**
 * Trazabilidad de la emisión de boletines.
 *
 * Lo que estas pruebas protegen no es "que se escriba una fila": es que la fila diga **quién,
 * cuándo, sobre quién y de qué institución**, y que auditar nunca impida entregar un boletín.
 */
describe('ReportCardGenerationAuditService', () => {
  const crear = () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = { reportCardGenerationEvent: { create } } as any;
    return { servicio: new ReportCardGenerationAuditService(prisma), create };
  };

  const ACTOR = { userId: 'u-1', name: 'coord@colegio.local', role: 'COORDINADOR' };

  describe('emisión individual', () => {
    it('registra el hecho con su tipo, su estudiante y su período', async () => {
      const { servicio, create } = crear();

      await servicio.recordSingle({
        institutionId: 'inst-1',
        studentEnrollmentId: 'enr-9',
        academicTermId: 'term-2',
        actor: ACTOR,
      });

      expect(create).toHaveBeenCalledTimes(1);
      expect(create.mock.calls[0][0].data).toMatchObject({
        institutionId: 'inst-1',
        action: 'SINGLE_PDF',
        studentEnrollmentId: 'enr-9',
        academicTermId: 'term-2',
        succeeded: true,
      });
    });

    it('deja constancia de quién lo emitió', async () => {
      const { servicio, create } = crear();
      await servicio.recordSingle({ institutionId: 'inst-1', studentEnrollmentId: 'e', actor: ACTOR });

      expect(create.mock.calls[0][0].data).toMatchObject({
        actorUserId: 'u-1',
        actorName: 'coord@colegio.local',
        actorRole: 'COORDINADOR',
      });
    });

    it('sin actor conocido escribe null, no una cadena inventada', async () => {
      const { servicio, create } = crear();
      await servicio.recordSingle({ institutionId: 'inst-1', studentEnrollmentId: 'e' });

      const d = create.mock.calls[0][0].data;
      expect(d.actorUserId).toBeNull();
      expect(d.actorName).toBeNull();
      expect(d.actorRole).toBeNull();
    });

    it('no fija la marca de tiempo desde el cliente: la pone la base', async () => {
      // `performedAt` tiene @default(now()) en el esquema. Si el servicio lo enviara, un reloj
      // desajustado del proceso podría fechar mal una evidencia forense.
      const { servicio, create } = crear();
      await servicio.recordSingle({ institutionId: 'inst-1', studentEnrollmentId: 'e' });

      expect(create.mock.calls[0][0].data).not.toHaveProperty('performedAt');
    });
  });

  describe('emisión masiva', () => {
    it('registra un solo evento con el recuento, no uno por estudiante', async () => {
      const { servicio, create } = crear();

      await servicio.recordBulk({
        institutionId: 'inst-1',
        groupId: 'grp-8a',
        academicTermId: 'term-2',
        studentCount: 31,
        actor: ACTOR,
      });

      expect(create).toHaveBeenCalledTimes(1);
      expect(create.mock.calls[0][0].data).toMatchObject({
        action: 'BULK_PDF',
        groupId: 'grp-8a',
        studentCount: 31,
        studentEnrollmentId: null,
      });
    });
  });

  describe('aislamiento entre instituciones', () => {
    it('cada evento lleva la institución que le pasaron, sin arrastrar la anterior', async () => {
      const { servicio, create } = crear();

      await servicio.recordSingle({ institutionId: 'inst-A', studentEnrollmentId: 'e1' });
      await servicio.recordSingle({ institutionId: 'inst-B', studentEnrollmentId: 'e2' });

      expect(create.mock.calls[0][0].data.institutionId).toBe('inst-A');
      expect(create.mock.calls[1][0].data.institutionId).toBe('inst-B');
    });

    it('la institución siempre viaja en el evento: nunca queda vacía', async () => {
      // El aislamiento depende de esta columna — por RLS cuando está activa, y por el filtro de
      // la aplicación cuando no lo está. Un evento sin institución sería invisible o global.
      const { servicio, create } = crear();
      await servicio.recordBulk({ institutionId: 'inst-1', groupId: 'g', studentCount: 1 });

      expect(create.mock.calls[0][0].data.institutionId).toBe('inst-1');
    });
  });

  describe('el fallo también se audita, y auditar nunca rompe la emisión', () => {
    it('una emisión fallida queda marcada con su motivo', async () => {
      const { servicio, create } = crear();

      await servicio.recordSingle({
        institutionId: 'inst-1',
        studentEnrollmentId: 'e',
        succeeded: false,
        detail: { error: 'no hay notas del período' },
      });

      expect(create.mock.calls[0][0].data).toMatchObject({
        succeeded: false,
        detail: { error: 'no hay notas del período' },
      });
    });

    it('si la propia auditoría falla, NO propaga el error', async () => {
      // Es la regla que importa: un fallo al auditar no puede dejar a un docente sin poder
      // entregar boletines. Mismo criterio que GradeAuditService.
      const create = jest.fn().mockRejectedValue(new Error('base caída'));
      const servicio = new ReportCardGenerationAuditService({
        reportCardGenerationEvent: { create },
      } as any);

      await expect(
        servicio.recordSingle({ institutionId: 'inst-1', studentEnrollmentId: 'e' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('append-only', () => {
    it('el servicio solo sabe crear: no expone actualizar ni borrar', async () => {
      const { servicio } = crear();
      const metodos = Object.getOwnPropertyNames(Object.getPrototypeOf(servicio));

      expect(metodos).toEqual(expect.arrayContaining(['recordSingle', 'recordBulk']));
      expect(metodos.some((m) => /update|delete|remove/i.test(m))).toBe(false);
    });
  });
});

/**
 * D3 — la integración con la Pieza 2, resuelta por lectura.
 *
 * Lo que se prueba aquí es que la pregunta del rector («¿le cambiaron algo después de que se
 * emitió el boletín?») tiene respuesta SIN acoplar la escritura académica al generador de PDF.
 */
describe('D3 · cambios posteriores a la emisión', () => {
  const emision = new Date('2026-06-01T10:00:00Z');

  function montar(ultimaEmision: any, cambios: any[]) {
    const prisma: any = {
      reportCardGenerationEvent: { findFirst: jest.fn().mockResolvedValue(ultimaEmision), create: jest.fn() },
      gradeAuditEvent: { findMany: jest.fn().mockResolvedValue(cambios) },
    };
    return { svc: new ReportCardGenerationAuditService(prisma), prisma };
  }

  const consulta = { institutionId: 'inst-1', studentEnrollmentId: 'enr-1', academicTermId: 'term-1' };

  it('sin emisión previa NO devuelve "cero cambios": devuelve que nunca se emitió', async () => {
    // La diferencia importa: «no hubo cambios» y «no hubo emisión» son respuestas distintas,
    // y confundirlas daría una falsa tranquilidad.
    const { svc, prisma } = montar(null, []);
    const r = await svc.changesAfterLastEmission(consulta);

    expect(r.emitted).toBe(false);
    expect(r.lastEmission).toBeNull();
    expect(prisma.gradeAuditEvent.findMany).not.toHaveBeenCalled();
  });

  it('solo cuenta lo ocurrido DESPUÉS de la última emisión correcta', async () => {
    const { svc, prisma } = montar({ id: 'g1', performedAt: emision, action: 'SINGLE_PDF' }, []);
    await svc.changesAfterLastEmission(consulta);

    expect(prisma.gradeAuditEvent.findMany.mock.calls[0][0].where.performedAt).toEqual({ gt: emision });
  });

  it('ignora las emisiones que fallaron: un intento fallido no es una emisión', async () => {
    const { svc, prisma } = montar({ id: 'g1', performedAt: emision }, []);
    await svc.changesAfterLastEmission(consulta);

    expect(prisma.reportCardGenerationEvent.findFirst.mock.calls[0][0].where.succeeded).toBe(true);
  });

  it('devuelve los cambios del eje cualitativo junto a los de nota', async () => {
    const { svc } = montar({ id: 'g1', performedAt: emision }, [
      { id: 'a1', source: 'ACHIEVEMENT_JUDGEMENT', action: 'UPDATE', actorName: 'docente@x' },
      { id: 'a2', source: 'PARTIAL_GRADE', action: 'UPDATE', actorName: 'docente@x' },
    ]);
    const r = await svc.changesAfterLastEmission(consulta);

    expect(r.emitted).toBe(true);
    expect(r.changes.map((c: any) => c.source)).toEqual(['ACHIEVEMENT_JUDGEMENT', 'PARTIAL_GRADE']);
  });

  it('toma la emisión MÁS RECIENTE, no la primera', async () => {
    const { svc, prisma } = montar({ id: 'g1', performedAt: emision }, []);
    await svc.changesAfterLastEmission(consulta);

    expect(prisma.reportCardGenerationEvent.findFirst.mock.calls[0][0].orderBy).toEqual({ performedAt: 'desc' });
  });
});
