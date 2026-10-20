import { TeacherScheduleService } from '../../src/modules/teacher-schedule/teacher-schedule.service';

/**
 * Laboratorio A/B del horario personal docente.
 *
 * Modela dos instituciones, dos docentes por institución y bloques personales. El doble aplica
 * todos los filtros recibidos (`institutionId`, `teacherId` e `id`) y ejecuta las mutaciones dentro
 * de una transacción reversible. Así, quitar cualquiera de las dimensiones de la guarda hace que
 * las pruebas crucen datos de colegio o de identidad en vez de seguir dando verde por accidente.
 */
export const A = 'school-A';
export const B = 'school-B';

type Call = {
  model: 'teacherScheduleBlock';
  method: string;
  query: any;
  inTransaction: boolean;
};

function matches(row: any, where: any = {}): boolean {
  return Object.entries(where ?? {}).every(
    ([key, value]) => value === undefined || row[key] === value,
  );
}

function snapshot(rows: Record<string, any[]>) {
  return Object.fromEntries(
    Object.entries(rows).map(([model, records]) => [
      model,
      records.map((row) => ({ ...row })),
    ]),
  );
}

export function teacherScheduleFixture() {
  const rows: Record<string, any[]> = {
    institution: [],
    user: [],
    institutionUser: [],
    teacherScheduleBlock: [],
  };
  // Un mismo User puede trabajar en más de una institución. Esta identidad compartida hace que
  // `teacherId` por sí solo NO baste para aislar agendas: el filtro institucional es demostrable.
  rows.user.push({
    id: 'teacher-shared',
    email: 'docente-compartido@example.invalid',
  });

  for (const [suffix, institutionId] of [
    ['A', A],
    ['B', B],
  ] as const) {
    rows.institution.push({ id: institutionId, name: `Colegio ${suffix}` });
    rows.user.push({
      id: `colleague-${suffix}`,
      email: `colega-${suffix.toLowerCase()}@example.invalid`,
    });
    rows.institutionUser.push(
      {
        id: `membership-teacher-${suffix}`,
        institutionId,
        userId: 'teacher-shared',
        isActive: true,
        roles: ['DOCENTE'],
      },
      {
        id: `membership-colleague-${suffix}`,
        institutionId,
        userId: `colleague-${suffix}`,
        isActive: true,
        roles: ['DOCENTE'],
      },
    );
    rows.teacherScheduleBlock.push(
      {
        id: `block-${suffix}`,
        institutionId,
        teacherId: 'teacher-shared',
        dayOfWeek: 'MONDAY',
        startTime: '07:00',
        endTime: '07:45',
        type: 'CLASE',
        title: `Matemáticas ${suffix}`,
        location: `Aula ${suffix}`,
        color: '#2563eb',
        notes: null,
      },
      {
        id: `colleague-block-${suffix}`,
        institutionId,
        teacherId: `colleague-${suffix}`,
        dayOfWeek: 'TUESDAY',
        startTime: '09:00',
        endTime: '09:45',
        type: 'TUTORIA',
        title: `Tutoría colega ${suffix}`,
        location: null,
        color: null,
        notes: null,
      },
    );
  }

  const calls: Call[] = [];
  let nextId = 0;

  function client(inTransaction: boolean) {
    const teacherScheduleBlock = {
      findMany: jest.fn(async (query: any = {}) => {
        calls.push({
          model: 'teacherScheduleBlock',
          method: 'findMany',
          query,
          inTransaction,
        });
        const found = rows.teacherScheduleBlock.filter((row) =>
          matches(row, query.where),
        );
        if (query.orderBy) {
          found.sort(
            (left, right) =>
              left.dayOfWeek.localeCompare(right.dayOfWeek) ||
              left.startTime.localeCompare(right.startTime),
          );
        }
        return found.map((row) => ({ ...row }));
      }),
      findFirst: jest.fn(async (query: any = {}) => {
        calls.push({
          model: 'teacherScheduleBlock',
          method: 'findFirst',
          query,
          inTransaction,
        });
        const found = rows.teacherScheduleBlock.find((row) =>
          matches(row, query.where),
        );
        if (!found) return null;
        if (query.select) {
          return Object.fromEntries(
            Object.entries(query.select)
              .filter(([, selected]) => selected)
              .map(([key]) => [key, found[key]]),
          );
        }
        return { ...found };
      }),
      create: jest.fn(async (query: any) => {
        calls.push({
          model: 'teacherScheduleBlock',
          method: 'create',
          query,
          inTransaction,
        });
        const row = { id: `created-${++nextId}`, ...query.data };
        rows.teacherScheduleBlock.push(row);
        return { ...row };
      }),
      update: jest.fn(async (query: any) => {
        calls.push({
          model: 'teacherScheduleBlock',
          method: 'update',
          query,
          inTransaction,
        });
        const found = rows.teacherScheduleBlock.find((row) =>
          matches(row, query.where),
        );
        if (!found) throw new Error('P2025');
        Object.assign(found, query.data);
        return { ...found };
      }),
      deleteMany: jest.fn(async (query: any) => {
        calls.push({
          model: 'teacherScheduleBlock',
          method: 'deleteMany',
          query,
          inTransaction,
        });
        const before = rows.teacherScheduleBlock.length;
        rows.teacherScheduleBlock = rows.teacherScheduleBlock.filter(
          (row) => !matches(row, query.where),
        );
        return { count: before - rows.teacherScheduleBlock.length };
      }),
    };
    return { teacherScheduleBlock };
  }

  const prisma: any = client(false);
  const tx: any = client(true);
  prisma.institutionUser = {
    findFirst: jest.fn(async (query: any) => {
      const found = rows.institutionUser.find((row) =>
        matches(row, query.where),
      );
      return found ? { institutionId: found.institutionId } : null;
    }),
  };
  prisma.$transaction = jest.fn(async (action: (client: any) => unknown) => {
    const before = snapshot(rows);
    try {
      return await action(tx);
    } catch (error) {
      for (const [model, records] of Object.entries(before)) {
        rows[model].splice(0, rows[model].length, ...records);
      }
      throw error;
    }
  });

  return {
    rows,
    prisma,
    tx,
    calls,
    service: new TeacherScheduleService(prisma),
    writes: () =>
      calls.filter((call) =>
        ['create', 'update', 'deleteMany'].includes(call.method),
      ),
    count: (institutionId: string, teacherId?: string) =>
      rows.teacherScheduleBlock.filter(
        (row) =>
          row.institutionId === institutionId &&
          (teacherId === undefined || row.teacherId === teacherId),
      ).length,
  };
}
