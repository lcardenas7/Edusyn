import { PreventiveCutsService } from '../../src/modules/evaluation/preventive-cuts.service';

export const SCHOOL_A = 'school-A';
export const SCHOOL_B = 'school-B';

type Relation = [model: string, foreignKey: string];

const models = [
  'institution',
  'academicYear',
  'academicTerm',
  'preventiveCutConfig',
  'campus',
  'grade',
  'group',
  'area',
  'subject',
  'teacherAssignment',
  'student',
  'studentEnrollment',
  'performanceScale',
  'preventiveAlert',
] as const;

const one: Record<string, Record<string, Relation>> = {
  academicYear: { institution: ['institution', 'institutionId'] },
  academicTerm: { academicYear: ['academicYear', 'academicYearId'] },
  preventiveCutConfig: { academicTerm: ['academicTerm', 'academicTermId'] },
  campus: { institution: ['institution', 'institutionId'] },
  grade: { institution: ['institution', 'institutionId'] },
  group: {
    campus: ['campus', 'campusId'],
    grade: ['grade', 'gradeId'],
  },
  area: { institution: ['institution', 'institutionId'] },
  subject: { area: ['area', 'areaId'] },
  teacherAssignment: {
    academicYear: ['academicYear', 'academicYearId'],
    group: ['group', 'groupId'],
    subject: ['subject', 'subjectId'],
  },
  student: { institution: ['institution', 'institutionId'] },
  studentEnrollment: {
    institution: ['institution', 'institutionId'],
    academicYear: ['academicYear', 'academicYearId'],
    group: ['group', 'groupId'],
    student: ['student', 'studentId'],
  },
  performanceScale: { institution: ['institution', 'institutionId'] },
  preventiveAlert: {
    institution: ['institution', 'institutionId'],
    teacherAssignment: ['teacherAssignment', 'teacherAssignmentId'],
    studentEnrollment: ['studentEnrollment', 'studentEnrollmentId'],
    academicTerm: ['academicTerm', 'academicTermId'],
  },
};

const writeMethods = new Set(['create', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert']);

function cloneRows(rows: Record<string, any[]>): Record<string, any[]> {
  return Object.fromEntries(
    Object.entries(rows).map(([model, records]) => [model, records.map((record) => ({ ...record }))]),
  );
}

export function preventiveCutsFixture() {
  const rows: Record<string, any[]> = Object.fromEntries(models.map((model) => [model, []]));
  const calls: Array<{ model: string; method: string; query: any; inTransaction: boolean }> = [];
  let nextId = 0;
  let failure: { point: string; remaining: number } | null = null;

  for (const suffix of ['A', 'B'] as const) {
    const institutionId = `school-${suffix}`;
    const institution = {
      id: institutionId,
      name: `Colegio ${suffix}`,
      logo: null,
      primaryColor: suffix === 'A' ? '#112233' : '#445566',
    };
    rows.institution.push(institution);
    rows.academicYear.push(
      { id: `year-${suffix}`, institutionId, year: 2026 },
      { id: `year-${suffix}-alt`, institutionId, year: 2025 },
    );
    rows.academicTerm.push(
      { id: `term-${suffix}`, academicYearId: `year-${suffix}`, name: `Periodo ${suffix}` },
      { id: `term-${suffix}-alt`, academicYearId: `year-${suffix}-alt`, name: `Periodo anterior ${suffix}` },
    );
    rows.preventiveCutConfig.push({
      id: `config-${suffix}`,
      academicTermId: `term-${suffix}`,
      cutoffDate: new Date('2026-05-15T12:00:00.000Z'),
      riskThresholdScore: 3,
    });
    rows.campus.push({ id: `campus-${suffix}`, institutionId, name: `Sede ${suffix}` });
    rows.grade.push({ id: `grade-${suffix}`, institutionId, name: `Quinto ${suffix}` });
    rows.group.push({
      id: `group-${suffix}`,
      campusId: `campus-${suffix}`,
      gradeId: `grade-${suffix}`,
      name: `${suffix}1`,
    });
    rows.area.push({ id: `area-${suffix}`, institutionId, name: `Area ${suffix}` });
    rows.subject.push({ id: `subject-${suffix}`, areaId: `area-${suffix}`, name: `Materia ${suffix}` });
    rows.teacherAssignment.push({
      id: `assignment-${suffix}`,
      institutionId,
      academicYearId: `year-${suffix}`,
      groupId: `group-${suffix}`,
      subjectId: `subject-${suffix}`,
      teacherId: `teacher-${suffix}`,
    });
    rows.student.push({
      id: `student-${suffix}`,
      institutionId,
      firstName: `Nombre${suffix}`,
      secondName: null,
      lastName: `Apellido${suffix}`,
      secondLastName: null,
    });
    rows.studentEnrollment.push({
      id: `enrollment-${suffix}`,
      institutionId,
      studentId: `student-${suffix}`,
      academicYearId: `year-${suffix}`,
      groupId: `group-${suffix}`,
      status: 'ACTIVE',
    });
    rows.performanceScale.push(
      { id: `scale-low-${suffix}`, institutionId, level: 'BAJO', minScore: 1, maxScore: 2.99 },
      { id: `scale-basic-${suffix}`, institutionId, level: 'BASICO', minScore: 3, maxScore: 3.99 },
      { id: `scale-high-${suffix}`, institutionId, level: 'ALTO', minScore: 4, maxScore: 5 },
    );
    rows.preventiveAlert.push({
      id: `alert-${suffix}`,
      institutionId,
      teacherAssignmentId: `assignment-${suffix}`,
      studentEnrollmentId: `enrollment-${suffix}`,
      academicTermId: `term-${suffix}`,
      cutoffDate: new Date('2026-04-30T12:00:00.000Z'),
      computedGrade: 2,
      performanceLevel: 'BAJO',
      status: 'IN_RECOVERY',
      recoveryPlan: `Plan ${suffix}`,
      meetingAt: null,
      notes: `Nota ${suffix}`,
      createdAt: new Date(`2026-04-${suffix === 'A' ? '01' : '02'}T12:00:00.000Z`),
    });
  }

  function related(model: string, row: any, key: string): { model: string; row: any } | null {
    const relation = one[model]?.[key];
    if (!relation) return null;
    const [relatedModel, foreignKey] = relation;
    return {
      model: relatedModel,
      row: rows[relatedModel].find((candidate) => candidate.id === row[foreignKey]),
    };
  }

  function matches(model: string, row: any, where: any = {}): boolean {
    if (!row) return false;
    return Object.entries(where ?? {}).every(([key, value]: [string, any]) => {
      if (value === undefined) return true;
      if (key === 'AND') {
        return (Array.isArray(value) ? value : [value]).every((part) => matches(model, row, part));
      }
      if (key === 'OR') return value.some((part: any) => matches(model, row, part));

      const relation = related(model, row, key);
      if (relation) return matches(relation.model, relation.row, value);

      if (value === null) return row[key] === null || row[key] === undefined;
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        if ('in' in value) return value.in.includes(row[key]);
        if ('not' in value) return row[key] !== value.not;
        if ('lte' in value && !(row[key] <= value.lte)) return false;
        if ('gte' in value && !(row[key] >= value.gte)) return false;
        if ('lt' in value && !(row[key] < value.lt)) return false;
        if ('gt' in value && !(row[key] > value.gt)) return false;
        return true;
      }
      return row[key] === value;
    });
  }

  function project(model: string, row: any, query: any = {}): any {
    if (!row) return null;
    const projection = query.select ?? query.include;
    const result: any = query.select ? {} : { ...row };
    if (!projection) return result;

    for (const [key, spec] of Object.entries(projection) as [string, any][]) {
      if (!spec) continue;
      const relation = related(model, row, key);
      if (relation) {
        result[key] = project(relation.model, relation.row, spec === true ? {} : spec);
      } else if (query.select) {
        result[key] = row[key];
      }
    }
    return result;
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
    const db: any = {};
    for (const model of models) {
      const delegate: any = {};
      for (const method of [
        'findFirst',
        'findUnique',
        'findMany',
        'create',
        'update',
        'updateMany',
        'delete',
        'deleteMany',
        'upsert',
      ]) {
        delegate[method] = jest.fn(async (query: any = {}) => {
          calls.push({ model, method, query, inTransaction });
          maybeFail(model, method);
          const records = rows[model].filter((row) => matches(model, row, query.where));

          if (method === 'findFirst' || method === 'findUnique') {
            return project(model, records[0], query);
          }
          if (method === 'findMany') {
            return records.map((record) => project(model, record, query));
          }
          if (method === 'create') {
            const record = { id: `created-${++nextId}`, createdAt: new Date(), ...query.data };
            rows[model].push(record);
            return project(model, record, query);
          }
          if (method === 'update') {
            if (!records[0]) throw new Error('P2025');
            Object.assign(records[0], query.data);
            return project(model, records[0], query);
          }
          if (method === 'updateMany') {
            records.forEach((record) => Object.assign(record, query.data));
            return { count: records.length };
          }
          if (method === 'delete') {
            if (!records[0]) throw new Error('P2025');
            rows[model].splice(rows[model].indexOf(records[0]), 1);
            return records[0];
          }
          if (method === 'deleteMany') {
            records.forEach((record) => rows[model].splice(rows[model].indexOf(record), 1));
            return { count: records.length };
          }

          const existing = records[0];
          if (existing) {
            Object.assign(existing, query.update);
            return project(model, existing, query);
          }
          const record = { id: `created-${++nextId}`, createdAt: new Date(), ...query.create };
          rows[model].push(record);
          return project(model, record, query);
        });
      }
      db[model] = delegate;
    }
    return db;
  }

  const prisma = buildClient(false);
  const tx = buildClient(true);
  prisma.$transaction = jest.fn(async (action: any) => {
    const before = cloneRows(rows);
    try {
      if (Array.isArray(action)) return await Promise.all(action);
      return await action(tx);
    } catch (error) {
      for (const model of models) {
        rows[model].splice(0, rows[model].length, ...before[model]);
      }
      throw error;
    }
  });

  const grades = {
    calculateTermGradeAtDate: jest.fn(async (enrollmentId: string) => ({
      grade: enrollmentId.includes('second') ? 4.2 : 2.5,
      components: [],
    })),
  };
  const storage = {
    resolveFileUrl: jest.fn(async () => 'https://invalid.example/logo.png'),
  };
  const service = new PreventiveCutsService(prisma, grades as any, storage as any);

  function addSecondEnrollment(suffix: 'A' | 'B') {
    const institutionId = `school-${suffix}`;
    rows.student.push({
      id: `student-${suffix}-second`,
      institutionId,
      firstName: `Segundo${suffix}`,
      secondName: null,
      lastName: `Alumno${suffix}`,
      secondLastName: null,
    });
    rows.studentEnrollment.push({
      id: `enrollment-${suffix}-second`,
      institutionId,
      studentId: `student-${suffix}-second`,
      academicYearId: `year-${suffix}`,
      groupId: `group-${suffix}`,
      status: 'ACTIVE',
    });
  }

  return {
    rows,
    calls,
    prisma,
    tx,
    grades,
    storage,
    service,
    addSecondEnrollment,
    fail(point: string, occurrence = 1) {
      failure = { point, remaining: occurrence };
    },
    resetEvidence() {
      calls.splice(0, calls.length);
      jest.clearAllMocks();
    },
    writes() {
      return calls.filter((call) => writeMethods.has(call.method));
    },
  };
}

