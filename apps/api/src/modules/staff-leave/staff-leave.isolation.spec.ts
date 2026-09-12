import { BadRequestException, NotFoundException } from '@nestjs/common';

import {
  STAFF_LEAVE_SCHOOL_A,
  STAFF_LEAVE_SCHOOL_B,
  staffLeaveFixture,
} from '../../../test/fixtures/staff-leave.fixture';

describe('Permisos del personal · blindaje de servicio', () => {
  let fixture: ReturnType<typeof staffLeaveFixture>;

  beforeEach(() => {
    fixture = staffLeaveFixture();
  });

  function row(id: string) {
    return fixture.rows.staffLeaveRequest.find((item) => item.id === id);
  }

  function expectNoWrites() {
    expect(fixture.writes()).toEqual([]);
  }

  describe.each([
    ['A', 'B', STAFF_LEAVE_SCHOOL_A],
    ['B', 'A', STAFF_LEAVE_SCHOOL_B],
  ] as const)(
    'actor del colegio %s contra datos del colegio %s',
    (actor, foreign, institutionId) => {
      it('no crea una solicitud atribuyéndola a un usuario ajeno', async () => {
        await expect(
          fixture.service.create({
            institutionId,
            requesterId: `requester-${foreign}`,
            type: 'PERMISO_ESPECIAL',
            startDate: '2026-08-10',
            reason: 'Intento cruzado',
          }),
        ).rejects.toBeInstanceOf(NotFoundException);
        expectNoWrites();
      });

      it('no lista solicitudes ajenas aunque se fuerce requesterId', async () => {
        const result = await fixture.service.findAll(institutionId, {
          requesterId: `requester-${foreign}`,
        });
        expect(result).toEqual([]);
        expectNoWrites();
      });

      it('my-requests solo devuelve las solicitudes propias del actor', async () => {
        const result = await fixture.service.findMyRequests(
          `requester-${actor}`,
          institutionId,
        );
        expect(result.map((item: any) => item.id)).toEqual([
          `leave-${actor}-own`,
          `leave-${actor}-approved`,
        ]);
        expect(
          result.every(
            (item: any) => item.requesterId === `requester-${actor}`,
          ),
        ).toBe(true);
        expectNoWrites();
      });

      it('el detalle ajeno es 404 y no devuelve PII', async () => {
        const error = await fixture.service
          .findById(`leave-${foreign}-own`, institutionId)
          .catch((caught) => caught);
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.getResponse()).toEqual({
          statusCode: 404,
          message: 'Solicitud no encontrada',
          error: 'Not Found',
        });
        expect(JSON.stringify(error.getResponse())).not.toContain(
          '@example.invalid',
        );
        expectNoWrites();
      });

      it('no revisa la solicitud ajena y comprueba existencia sin seleccionar PII', async () => {
        await expect(
          fixture.service.review(
            `leave-${foreign}-own`,
            institutionId,
            `admin-${actor}`,
            { status: 'APPROVED' },
          ),
        ).rejects.toBeInstanceOf(NotFoundException);

        const lookup = fixture.calls.find(
          (call) =>
            call.inTransaction &&
            call.model === 'staffLeaveRequest' &&
            call.method === 'findFirst',
        );
        expect(lookup?.args.select).toEqual({ id: true, status: true });
        expect(lookup?.args.include).toBeUndefined();
        expectNoWrites();
      });

      it('no cancela una solicitud ajena ni una solicitud de un colega', async () => {
        await expect(
          fixture.service.cancel(
            `leave-${foreign}-own`,
            institutionId,
            `requester-${actor}`,
          ),
        ).rejects.toBeInstanceOf(NotFoundException);
        await expect(
          fixture.service.cancel(
            `leave-${actor}-peer`,
            institutionId,
            `requester-${actor}`,
          ),
        ).rejects.toBeInstanceOf(NotFoundException);
        expectNoWrites();
      });

      it('las estadísticas no cuentan filas del otro tenant ni relaciones incoherentes', async () => {
        await expect(fixture.service.getStats(institutionId)).resolves.toEqual({
          total: 4,
          pending: 3,
          approved: 1,
          rejected: 0,
        });
        expectNoWrites();
      });
    },
  );

  it('los filtros nested OR e institutionUsers.some excluyen FKs históricas incoherentes', async () => {
    const result = await fixture.service.findAll(STAFF_LEAVE_SCHOOL_A);
    expect(result.map((item: any) => item.id)).toEqual([
      'leave-A-admin',
      'leave-A-peer',
      'leave-A-own',
      'leave-A-approved',
    ]);
    expect(result.map((item: any) => item.id)).not.toEqual(
      expect.arrayContaining([
        'leave-A-foreign-requester',
        'leave-A-foreign-reviewer',
      ]),
    );
  });

  it('un administrador institucional puede revisar su solicitud dentro del tenant', async () => {
    const reviewed = await fixture.service.review(
      'leave-A-admin',
      STAFF_LEAVE_SCHOOL_A,
      'admin-A',
      { status: 'APPROVED', reviewerNote: 'Comisión autorizada' },
    );
    expect(reviewed).toMatchObject({
      id: 'leave-A-admin',
      status: 'APPROVED',
      reviewedById: 'admin-A',
      reviewerNote: 'Comisión autorizada',
    });
    expect(fixture.prisma.staffLeaveRequest.updateMany).not.toHaveBeenCalled();
    expect(fixture.tx.staffLeaveRequest.updateMany).toHaveBeenCalledTimes(1);
    expect(
      fixture.calls.filter((call) => call.inTransaction).length,
    ).toBeGreaterThan(0);
  });

  it('la cancelación legítima usa el tx distinto y solo cambia la solicitud propia', async () => {
    const peerBefore = { ...row('leave-A-peer') };
    const result = await fixture.service.cancel(
      'leave-A-own',
      STAFF_LEAVE_SCHOOL_A,
      'requester-A',
    );
    expect(result).toMatchObject({ id: 'leave-A-own', status: 'CANCELLED' });
    expect(row('leave-A-peer')).toEqual(peerBefore);
    expect(fixture.prisma.staffLeaveRequest.updateMany).not.toHaveBeenCalled();
    expect(fixture.tx.staffLeaveRequest.updateMany).toHaveBeenCalledTimes(1);
  });

  describe('fechas', () => {
    it.each([
      ['fecha inicial inválida', { startDate: 'no-es-fecha' }],
      ['fecha final inválida', { endDate: 'tampoco-es-fecha' }],
      ['rango invertido', { startDate: '2026-08-10', endDate: '2026-08-09' }],
    ])(
      'findAll rechaza %s sin consultar ni escribir',
      async (_name, filters) => {
        await expect(
          fixture.service.findAll(STAFF_LEAVE_SCHOOL_A, filters),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(fixture.calls).toEqual([]);
        expectNoWrites();
      },
    );

    it.each([
      ['fecha inicial inválida', 'no-es-fecha', undefined],
      ['fecha final inválida', undefined, 'no-es-fecha'],
      ['rango invertido', '2026-08-10', '2026-08-09'],
    ])(
      'stats rechaza %s sin consultar ni escribir',
      async (_name, start, end) => {
        await expect(
          fixture.service.getStats(STAFF_LEAVE_SCHOOL_A, start, end),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(fixture.calls).toEqual([]);
        expectNoWrites();
      },
    );

    it.each([
      ['inicio inválido', 'no-es-fecha', undefined],
      ['fin inválido', '2026-08-10', 'no-es-fecha'],
      ['fin anterior', '2026-08-10', '2026-08-09'],
    ])(
      'create rechaza %s antes de buscar al solicitante',
      async (_name, startDate, endDate) => {
        await expect(
          fixture.service.create({
            institutionId: STAFF_LEAVE_SCHOOL_A,
            requesterId: 'requester-A',
            type: 'AUSENCIA',
            startDate,
            endDate,
            reason: 'Fecha inválida',
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(fixture.calls).toEqual([]);
        expectNoWrites();
      },
    );

    it('aplica rangos unilaterales tanto al listado como a stats', async () => {
      const fromJune = await fixture.service.findAll(STAFF_LEAVE_SCHOOL_A, {
        startDate: '2026-06-01',
      });
      expect(fromJune.map((item: any) => item.id)).toEqual([
        'leave-A-admin',
        'leave-A-peer',
      ]);

      const untilMay = await fixture.service.findAll(STAFF_LEAVE_SCHOOL_A, {
        endDate: '2026-05-31',
      });
      expect(untilMay.map((item: any) => item.id)).toEqual([
        'leave-A-own',
        'leave-A-approved',
      ]);
      await expect(
        fixture.service.getStats(STAFF_LEAVE_SCHOOL_A, undefined, '2026-05-31'),
      ).resolves.toEqual({ total: 2, pending: 1, approved: 1, rejected: 0 });
    });
  });

  describe('carreras y rollback', () => {
    it('review detecta que otra operación ganó la carrera', async () => {
      fixture.race('leave-A-own', 'APPROVED');
      await expect(
        fixture.service.review('leave-A-own', STAFF_LEAVE_SCHOOL_A, 'admin-A', {
          status: 'REJECTED',
        }),
      ).rejects.toThrow('La solicitud ya fue revisada');
      expect(row('leave-A-own').status).toBe('APPROVED');
    });

    it('cancel detecta que otra operación ganó la carrera', async () => {
      fixture.race('leave-A-own', 'APPROVED');
      await expect(
        fixture.service.cancel(
          'leave-A-own',
          STAFF_LEAVE_SCHOOL_A,
          'requester-A',
        ),
      ).rejects.toThrow('La solicitud ya no está pendiente');
      expect(row('leave-A-own').status).toBe('APPROVED');
    });

    it('review revierte el update si falla la lectura final', async () => {
      fixture.fail('staffLeaveRequest.findFirst', 2);
      await expect(
        fixture.service.review('leave-A-own', STAFF_LEAVE_SCHOOL_A, 'admin-A', {
          status: 'APPROVED',
        }),
      ).rejects.toThrow('Fallo sintético');
      expect(row('leave-A-own')).toMatchObject({
        status: 'PENDING',
        reviewedById: null,
        reviewedAt: null,
      });
    });

    it('cancel revierte el update si falla la lectura final', async () => {
      fixture.fail('staffLeaveRequest.findFirst', 2);
      await expect(
        fixture.service.cancel(
          'leave-A-own',
          STAFF_LEAVE_SCHOOL_A,
          'requester-A',
        ),
      ).rejects.toThrow('Fallo sintético');
      expect(row('leave-A-own').status).toBe('PENDING');
    });
  });
});
