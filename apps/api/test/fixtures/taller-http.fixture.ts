import { TallerService } from '../../src/modules/taller/taller.service';

export const TALLER_A = 'taller-school-A';
export const TALLER_B = 'taller-school-B';

type Row = Record<string, any>;

/** Evalúa el `where` de las consultas reales; quitar institutionId deja visible la fila ajena. */
function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (value === undefined) return true;
    if (key === 'AND') return (value as Row[]).every((part) => matches(row, part));
    if (key === 'OR') return (value as Row[]).some((part) => matches(row, part));
    if (key === 'NOT') return !matches(row, value as Row);
    const actual = row[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if ('in' in value) return (value.in as any[]).includes(actual);
      if ('some' in value) return Array.isArray(actual) && actual.some((part: Row) => matches(part, value.some));
      if (actual === null || actual === undefined) return false;
      return matches(actual, value as Row);
    }
    return actual === value;
  });
}

export function tallerHttpFixture() {
  const rows: Record<string, Row[]> = {
    abpTeam: [], classroom: [], tallerInstrument: [], tallerObject: [],
    tallerRelation: [], tallerEvent: [],
  };
  for (const [suffix, institutionId] of [['A', TALLER_A], ['B', TALLER_B]]) {
    rows.abpTeam.push({
      id: `team-${suffix}`, institutionId, projectId: `project-${suffix}`,
      project: { classroomId: `class-${suffix}` },
      members: [{ studentEnrollmentId: `enr-${suffix}`, studentEnrollment: {
        student: { userId: 'student-shared', firstName: suffix, lastName: 'Sintético' },
      } }],
    });
    rows.classroom.push({ id: `class-${suffix}`, institutionId,
      teacherAssignment: { teacherId: `teacher-${suffix}` } });
    rows.tallerInstrument.push({ id: `inst-${suffix}`, institutionId,
      teamId: `team-${suffix}`, motor: 'BOARD', dynamic: null, stationId: null });
    for (const n of [1, 2]) rows.tallerObject.push({
      id: `obj-${suffix}-${n}`, institutionId, teamId: `team-${suffix}`,
      instrumentId: `inst-${suffix}`, deletedAt: null, version: 1,
      type: 'PostIt', authorId: `enr-${suffix}`, data: { text: `${suffix} privado` },
    });
    rows.tallerRelation.push({ id: `rel-${suffix}`, institutionId,
      teamId: `team-${suffix}`, fromId: `obj-${suffix}-1`, toId: `obj-${suffix}-2`,
      relType: 'conecta-con' });
  }

  const prisma: any = {};
  let seq = 0;
  for (const [model, data] of Object.entries(rows)) {
    prisma[model] = {
      findFirst: jest.fn(async ({ where }: any) => data.find((row) => matches(row, where)) ?? null),
      findMany: jest.fn(async ({ where }: any) => data.filter((row) => matches(row, where))),
      create: jest.fn(async ({ data: value }: any) => {
        const row = { id: `created-${++seq}`, ...value };
        data.push(row);
        return row;
      }),
      createMany: jest.fn(async ({ data: values }: any) => {
        for (const value of values) data.push({ id: `created-${++seq}`, ...value });
        return { count: values.length };
      }),
      updateMany: jest.fn(async ({ where, data: value }: any) => {
        const found = data.filter((row) => matches(row, where));
        for (const row of found) Object.assign(row, value);
        return { count: found.length };
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        const found = data.filter((row) => matches(row, where));
        for (const row of found) data.splice(data.indexOf(row), 1);
        return { count: found.length };
      }),
    };
  }

  const writes = () => Object.values(prisma).flatMap((delegate: any) =>
    ['create', 'createMany', 'updateMany', 'deleteMany'].flatMap((name) =>
      delegate[name].mock.calls.map((call: any) => ({ name, call }))));
  const secondaryReads = () => Object.values(prisma).flatMap((delegate: any) =>
    delegate.findMany.mock.calls);

  return { rows, prisma, service: new TallerService(prisma), writes, secondaryReads };
}
