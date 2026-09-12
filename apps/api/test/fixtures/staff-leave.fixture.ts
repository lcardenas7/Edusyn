import { StaffLeaveService } from '../../src/modules/staff-leave/staff-leave.service';

export const STAFF_LEAVE_SCHOOL_A = 'school-A';
export const STAFF_LEAVE_SCHOOL_B = 'school-B';

type Call = {
  model: string;
  method: string;
  args: any;
  inTransaction: boolean;
};

const writeMethods = new Set([
  'create',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
]);

function sameValue(actual: any, expected: any) {
  if (actual instanceof Date || expected instanceof Date) {
    return new Date(actual).getTime() === new Date(expected).getTime();
  }
  return actual === expected;
}

function comparable(value: any) {
  return value instanceof Date ? value.getTime() : value;
}

export function staffLeaveFixture() {
  const rows: Record<string, any[]> = {
    user: [],
    institutionUser: [],
    staffLeaveRequest: [],
  };
  const calls: Call[] = [];
  let nextId = 0;
  let failure: { point: string; remaining: number } | null = null;
  let racingRequest: { id: string; status: string } | null = null;
  let committedRace: { id: string; status: string } | null = null;

  for (const [suffix, institutionId] of [
    ['A', STAFF_LEAVE_SCHOOL_A],
    ['B', STAFF_LEAVE_SCHOOL_B],
  ] as const) {
    const users = [
      {
        id: `requester-${suffix}`,
        firstName: suffix === 'A' ? 'Ana' : 'Bruno',
        lastName: `Docente ${suffix}`,
        email: `requester-${suffix.toLowerCase()}@example.invalid`,
        isSuperAdmin: false,
      },
      {
        id: `peer-${suffix}`,
        firstName: suffix === 'A' ? 'Alicia' : 'Beatriz',
        lastName: `Orientadora ${suffix}`,
        email: `peer-${suffix.toLowerCase()}@example.invalid`,
        isSuperAdmin: false,
      },
      {
        id: `admin-${suffix}`,
        firstName: suffix === 'A' ? 'Adriana' : 'Bárbara',
        lastName: `Rectora ${suffix}`,
        email: `admin-${suffix.toLowerCase()}@example.invalid`,
        isSuperAdmin: false,
      },
    ];
    rows.user.push(...users);
    rows.institutionUser.push(
      ...users.map((user, index) => ({
        id: `iu-${suffix}-${index + 1}`,
        userId: user.id,
        institutionId,
        isActive: true,
        joinedAt: new Date(`2026-01-0${index + 1}T12:00:00.000Z`),
      })),
    );

    rows.staffLeaveRequest.push(
      {
        id: `leave-${suffix}-own`,
        institutionId,
        requesterId: `requester-${suffix}`,
        type: 'PERMISO_ESPECIAL',
        startDate: new Date('2026-05-10T00:00:00.000Z'),
        endDate: new Date('2026-05-11T00:00:00.000Z'),
        startTime: null,
        endTime: null,
        reason: `Cita médica ${suffix}`,
        attachmentUrl: `https://example.invalid/incapacidad-${suffix}.pdf`,
        status: 'PENDING',
        reviewedById: null,
        reviewedAt: null,
        reviewerNote: null,
        createdAt: new Date('2026-05-01T12:00:00.000Z'),
      },
      {
        id: `leave-${suffix}-peer`,
        institutionId,
        requesterId: `peer-${suffix}`,
        type: 'SALIDA_TEMPRANA',
        startDate: new Date('2026-06-15T00:00:00.000Z'),
        endDate: null,
        startTime: '08:00',
        endTime: '12:00',
        reason: `Diligencia personal ${suffix}`,
        attachmentUrl: null,
        status: 'PENDING',
        reviewedById: null,
        reviewedAt: null,
        reviewerNote: null,
        createdAt: new Date('2026-06-01T12:00:00.000Z'),
      },
      {
        id: `leave-${suffix}-admin`,
        institutionId,
        requesterId: `admin-${suffix}`,
        type: 'AUSENCIA',
        startDate: new Date('2026-07-20T00:00:00.000Z'),
        endDate: new Date('2026-07-21T00:00:00.000Z'),
        startTime: null,
        endTime: null,
        reason: `Comisión académica ${suffix}`,
        attachmentUrl: null,
        status: 'PENDING',
        reviewedById: null,
        reviewedAt: null,
        reviewerNote: null,
        createdAt: new Date('2026-07-01T12:00:00.000Z'),
      },
      {
        id: `leave-${suffix}-approved`,
        institutionId,
        requesterId: `requester-${suffix}`,
        type: 'PERMISO_ESPECIAL',
        startDate: new Date('2026-04-03T00:00:00.000Z'),
        endDate: null,
        startTime: null,
        endTime: null,
        reason: `Calamidad familiar ${suffix}`,
        attachmentUrl: null,
        status: 'APPROVED',
        reviewedById: `admin-${suffix}`,
        reviewedAt: new Date('2026-04-02T15:00:00.000Z'),
        reviewerNote: 'Aprobada',
        createdAt: new Date('2026-04-01T12:00:00.000Z'),
      },
    );
  }

  // Dos filas deliberadamente incoherentes demuestran que no basta filtrar la FK plana.
  // Deben quedar fuera por los filtros relacionales de requester y reviewedBy.
  rows.staffLeaveRequest.push(
    {
      ...rows.staffLeaveRequest.find((row) => row.id === 'leave-A-peer'),
      id: 'leave-A-foreign-requester',
      requesterId: 'requester-B',
      reason: 'PII que A no debe leer',
    },
    {
      ...rows.staffLeaveRequest.find((row) => row.id === 'leave-A-approved'),
      id: 'leave-A-foreign-reviewer',
      reviewedById: 'admin-B',
      reason: 'Revisión ajena que A no debe leer',
    },
  );

  function relation(model: string, row: any, key: string): any {
    if (model === 'user' && key === 'institutionUsers') {
      return rows.institutionUser.filter((item) => item.userId === row.id);
    }
    if (model === 'staffLeaveRequest' && key === 'requester') {
      return rows.user.find((user) => user.id === row.requesterId) ?? null;
    }
    if (model === 'staffLeaveRequest' && key === 'reviewedBy') {
      return rows.user.find((user) => user.id === row.reviewedById) ?? null;
    }
    return undefined;
  }

  function matches(model: string, row: any, where: any = {}): boolean {
    if (!row) return false;
    return Object.entries(where ?? {}).every(
      ([key, expected]: [string, any]) => {
        if (expected === undefined) return true;
        if (key === 'AND') {
          return (Array.isArray(expected) ? expected : [expected]).every(
            (part) => matches(model, row, part),
          );
        }
        if (key === 'OR') {
          return expected.some((part: any) => matches(model, row, part));
        }
        if (key === 'NOT') {
          return !(Array.isArray(expected) ? expected : [expected]).every(
            (part) => matches(model, row, part),
          );
        }

        const related = relation(model, row, key);
        if (related !== undefined) {
          if (Array.isArray(related)) {
            if (expected?.some) {
              return related.some((item) =>
                matches('institutionUser', item, expected.some),
              );
            }
            if (expected?.none) {
              return !related.some((item) =>
                matches('institutionUser', item, expected.none),
              );
            }
            if (expected?.every) {
              return related.every((item) =>
                matches('institutionUser', item, expected.every),
              );
            }
            return false;
          }
          const relatedModel =
            key === 'institutionUsers' ? 'institutionUser' : 'user';
          return matches(relatedModel, related, expected);
        }

        if (expected === null)
          return row[key] === null || row[key] === undefined;
        if (
          expected &&
          typeof expected === 'object' &&
          !Array.isArray(expected) &&
          !(expected instanceof Date)
        ) {
          return Object.entries(expected).every(
            ([operator, value]: [string, any]) => {
              const actual = row[key];
              if (operator === 'in')
                return value.some((item: any) => sameValue(actual, item));
              if (operator === 'notIn')
                return !value.some((item: any) => sameValue(actual, item));
              if (operator === 'gte')
                return comparable(actual) >= comparable(value);
              if (operator === 'gt')
                return comparable(actual) > comparable(value);
              if (operator === 'lte')
                return comparable(actual) <= comparable(value);
              if (operator === 'lt')
                return comparable(actual) < comparable(value);
              if (operator === 'not') return !sameValue(actual, value);
              return false;
            },
          );
        }
        return sameValue(row[key], expected);
      },
    );
  }

  function project(model: string, row: any, args: any = {}) {
    if (!row) return null;
    const projection = args.select ?? args.include;
    const output: any = args.select ? {} : { ...row };
    if (!projection) return output;

    for (const [key, spec] of Object.entries(projection) as [string, any][]) {
      if (!spec) continue;
      const related = relation(model, row, key);
      if (related !== undefined) {
        const relatedModel =
          key === 'institutionUsers' ? 'institutionUser' : 'user';
        output[key] = Array.isArray(related)
          ? related.map((item) =>
              project(relatedModel, item, spec === true ? {} : spec),
            )
          : project(relatedModel, related, spec === true ? {} : spec);
      } else if (args.select) {
        output[key] = row[key];
      }
    }
    return output;
  }

  function ordered(records: any[], orderBy: any) {
    const clauses = orderBy
      ? Array.isArray(orderBy)
        ? orderBy
        : [orderBy]
      : [];
    return [...records].sort((left, right) => {
      for (const clause of clauses) {
        const [key, direction] = Object.entries(clause)[0] as [string, any];
        const delta =
          comparable(left[key]) < comparable(right[key])
            ? -1
            : comparable(left[key]) > comparable(right[key])
              ? 1
              : 0;
        if (delta) return direction === 'desc' ? -delta : delta;
      }
      return 0;
    });
  }

  function maybeFail(model: string, method: string) {
    if (!failure || failure.point !== `${model}.${method}`) return;
    failure.remaining -= 1;
    if (failure.remaining === 0) {
      failure = null;
      throw new Error(`Fallo sintético en ${model}.${method}`);
    }
  }

  function buildClient(inTransaction: boolean) {
    const client: any = {};
    for (const model of Object.keys(rows)) {
      const delegate: any = {};
      delegate.findFirst = jest.fn(async (args: any = {}) => {
        calls.push({ model, method: 'findFirst', args, inTransaction });
        maybeFail(model, 'findFirst');
        const found = rows[model].find((row) =>
          matches(model, row, args.where),
        );
        return project(model, found, args);
      });
      delegate.findUnique = jest.fn(async (args: any = {}) => {
        calls.push({ model, method: 'findUnique', args, inTransaction });
        maybeFail(model, 'findUnique');
        const found = rows[model].find((row) =>
          matches(model, row, args.where),
        );
        return project(model, found, args);
      });
      delegate.findMany = jest.fn(async (args: any = {}) => {
        calls.push({ model, method: 'findMany', args, inTransaction });
        maybeFail(model, 'findMany');
        const found = ordered(
          rows[model].filter((row) => matches(model, row, args.where)),
          args.orderBy,
        );
        return found.map((row) => project(model, row, args));
      });
      delegate.count = jest.fn(async (args: any = {}) => {
        calls.push({ model, method: 'count', args, inTransaction });
        maybeFail(model, 'count');
        return rows[model].filter((row) => matches(model, row, args.where))
          .length;
      });
      delegate.create = jest.fn(async (args: any) => {
        calls.push({ model, method: 'create', args, inTransaction });
        maybeFail(model, 'create');
        const created = {
          id: `leave-created-${++nextId}`,
          status: 'PENDING',
          reviewedById: null,
          reviewedAt: null,
          reviewerNote: null,
          createdAt: new Date('2026-08-01T12:00:00.000Z'),
          ...args.data,
        };
        rows[model].push(created);
        return project(model, created, args);
      });
      delegate.update = jest.fn(async (args: any) => {
        calls.push({ model, method: 'update', args, inTransaction });
        maybeFail(model, 'update');
        const found = rows[model].find((row) =>
          matches(model, row, args.where),
        );
        if (!found) throw new Error('P2025');
        Object.assign(found, args.data);
        return project(model, found, args);
      });
      delegate.updateMany = jest.fn(async (args: any) => {
        calls.push({ model, method: 'updateMany', args, inTransaction });
        maybeFail(model, 'updateMany');
        if (model === 'staffLeaveRequest' && racingRequest) {
          const raced = rows.staffLeaveRequest.find(
            (row) => row.id === racingRequest?.id,
          );
          if (raced) {
            raced.status = racingRequest.status;
            committedRace = { ...racingRequest };
          }
          racingRequest = null;
        }
        const found = rows[model].filter((row) =>
          matches(model, row, args.where),
        );
        found.forEach((row) => Object.assign(row, args.data));
        return { count: found.length };
      });
      delegate.delete = jest.fn(async (args: any) => {
        calls.push({ model, method: 'delete', args, inTransaction });
        maybeFail(model, 'delete');
        const found = rows[model].find((row) =>
          matches(model, row, args.where),
        );
        if (!found) throw new Error('P2025');
        rows[model].splice(rows[model].indexOf(found), 1);
        return found;
      });
      delegate.deleteMany = jest.fn(async (args: any) => {
        calls.push({ model, method: 'deleteMany', args, inTransaction });
        maybeFail(model, 'deleteMany');
        const found = rows[model].filter((row) =>
          matches(model, row, args.where),
        );
        found.forEach((row) => rows[model].splice(rows[model].indexOf(row), 1));
        return { count: found.length };
      });
      client[model] = delegate;
    }
    return client;
  }

  function snapshot() {
    return Object.fromEntries(
      Object.entries(rows).map(([model, records]) => [
        model,
        records.map((row) => ({ row, copy: { ...row } })),
      ]),
    ) as Record<string, Array<{ row: any; copy: any }>>;
  }

  function restore(before: ReturnType<typeof snapshot>) {
    for (const [model, records] of Object.entries(before)) {
      for (const { row, copy } of records) {
        for (const key of Object.keys(row)) if (!(key in copy)) delete row[key];
        Object.assign(row, copy);
      }
      rows[model].splice(
        0,
        rows[model].length,
        ...records.map(({ row }) => row),
      );
    }
  }

  const prisma = buildClient(false);
  const tx = buildClient(true);
  prisma.$transaction = jest.fn(async (operation: any) => {
    const before = snapshot();
    try {
      return await operation(tx);
    } catch (error) {
      restore(before);
      if (committedRace) {
        const raced = rows.staffLeaveRequest.find(
          (row) => row.id === committedRace?.id,
        );
        if (raced) raced.status = committedRace.status;
        committedRace = null;
      }
      throw error;
    }
  });

  const service = new StaffLeaveService(prisma);
  return {
    rows,
    calls,
    prisma,
    tx,
    service,
    writes: () => calls.filter((call) => writeMethods.has(call.method)),
    fail(point: string, occurrence = 1) {
      failure = { point, remaining: occurrence };
    },
    race(id: string, status = 'APPROVED') {
      racingRequest = { id, status };
    },
    resetEvidence() {
      calls.splice(0, calls.length);
      jest.clearAllMocks();
    },
  };
}
