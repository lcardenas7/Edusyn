import { LearningRouteService } from '../../src/modules/learning-route/learning-route.service';
import { CompetencyEvidenceService } from '../../src/modules/learning-route/competency-evidence.service';

/**
 * Laboratorio A/B de Rutas de aprendizaje.
 *
 * Dos colegios sintéticos con la cadena completa del esquema —institución → aula → asignación
 * docente (año, grupo) → ruta → paso → actividad— y un doble de Prisma que **aplica los filtros
 * de verdad**, incluidos los de relación (`classroom: { institutionId }`) y `not`. Sin eso, una
 * prueba de aislamiento pasaría aunque la guarda no existiera: el doble devolvería la fila igual.
 *
 * Nada de datos ni cuentas reales, y ninguna llamada a proveedores de IA: Valeria es un doble.
 */

export const A = 'school-A';
export const B = 'school-B';

const writeMethods = ['create', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert'];

/**
 * Relación inversa (paso → ruta) NO enumerable: se puede filtrar y leer como en Prisma, pero no
 * viaja al serializar la respuesta. Enumerable sería una referencia circular —la ruta lleva sus
 * pasos— y el controlador respondería 500 por culpa del doble, no del código.
 */
function inversa(row: any, key: string, value: any) {
  Object.defineProperty(row, key, { value, enumerable: false, writable: true, configurable: true });
}

function matches(row: any, where: any = {}): boolean {
  if (row === null || row === undefined) return false;
  return Object.entries(where).every(([key, value]: [string, any]) => {
    if (value === undefined) return true;
    if (key === 'OR') return value.some((part: any) => matches(row, part));
    if (key === 'AND') return value.every((part: any) => matches(row, part));
    if (value === null) return row[key] === null || row[key] === undefined;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if ('in' in value) return value.in.includes(row[key]);
      if ('not' in value) {
        return value.not === null ? row[key] !== null && row[key] !== undefined : row[key] !== value.not;
      }
      // Filtro por relación: exige que la relación esté embebida en la fila.
      return matches(row[key], value);
    }
    return row[key] === value;
  });
}

export function fixture() {
  const rows: Record<string, any[]> = Object.fromEntries([
    'classroom', 'teacherAssignment', 'learningRoute', 'learningRouteStep', 'classroomActivity',
    'competency', 'competencyEvidence', 'student', 'studentEnrollment', 'lesson',
  ].map((name) => [name, []]));

  // Catálogo GLOBAL de competencias: sin institución, compartido por los dos colegios.
  rows.competency.push(
    { id: 'comp-reading', framework: 'CEFR', level: 'A2', skill: 'READING', code: 'R1', statement: 'Puede leer textos breves', isActive: true, sortOrder: 0 },
    { id: 'comp-writing', framework: 'CEFR', level: 'A2', skill: 'WRITING', code: 'W1', statement: 'Puede escribir notas breves', isActive: true, sortOrder: 1 },
  );

  for (const [x, institutionId] of [['A', A], ['B', B]] as const) {
    const grade = { name: `Grado ${x}` };
    const group = { id: `group-${x}`, grade };
    const teacherAssignment = {
      id: `ta-${x}`, institutionId, academicYearId: `year-${x}`, groupId: group.id, group,
    };
    const classroom = {
      id: `classroom-${x}`, institutionId, teacherAssignmentId: teacherAssignment.id, teacherAssignment,
    };
    const competency = rows.competency[0];
    const route: any = {
      id: `route-${x}`, institutionId, classroomId: classroom.id, classroom,
      title: `Ruta ${x}`, description: 'Sintética', isPublished: false,
      targetCompetencyId: competency.id, targetCompetency: competency, targetLevel: 'A2',
      instructions: 'Indicaciones sintéticas', sourceMaterial: 'Material sintético',
      sortOrder: 0, steps: [] as any[],
    };
    const activity = {
      id: `activity-${x}`, classroomId: classroom.id, classroom,
      type: 'TASK', title: `Actividad ${x}`, isPublished: true, isRouteScoped: true,
    };
    const step: any = {
      id: `step-${x}`, institutionId, routeId: route.id,
      title: `Paso ${x}`, activityId: activity.id, activity,
      competencyId: competency.id, competency, sortOrder: 0,
    };
    inversa(step, 'route', route);
    route.steps.push(step);
    const student = { id: `student-${x}`, institutionId, userId: `user-${x}` };
    rows.teacherAssignment.push(teacherAssignment);
    rows.classroom.push(classroom);
    rows.learningRoute.push(route);
    rows.classroomActivity.push(activity);
    rows.learningRouteStep.push(step);
    rows.student.push(student);
    rows.studentEnrollment.push({
      id: `enr-${x}`, institutionId, studentId: student.id, student,
      academicYearId: teacherAssignment.academicYearId, groupId: group.id, status: 'ACTIVE',
    });
    rows.competencyEvidence.push({
      id: `ev-${x}`, institutionId, studentId: student.id, competencyId: competency.id,
      routeStepId: step.id, score: 80, source: 'ACTIVITY', idempotencyKey: `ev-${x}`,
    });
  }

  const prisma: any = {};
  let nextId = 0;
  for (const [model, data] of Object.entries(rows)) {
    const find = ({ where }: any) => data.find((row) => matches(row, where)) ?? null;
    prisma[model] = {
      findFirst: jest.fn(async (args: any) => find(args)),
      findUnique: jest.fn(async (args: any) => find(args)),
      findMany: jest.fn(async ({ where }: any = {}) => data.filter((row) => matches(row, where))),
      count: jest.fn(async ({ where }: any = {}) => data.filter((row) => matches(row, where)).length),
      aggregate: jest.fn(async ({ where }: any = {}) => ({
        _max: { sortOrder: Math.max(-1, ...data.filter((row) => matches(row, where)).map((row) => row.sortOrder ?? -1)) },
      })),
      create: jest.fn(async ({ data: input }: any) => {
        const row: any = { id: `new-${++nextId}`, ...input };
        // Una ruta nueva nace con su lista de pasos, como la trae Prisma con `include`.
        if (model === 'learningRoute') row.steps = row.steps ?? [];
        data.push(row);
        if (model === 'learningRouteStep') {
          const route = rows.learningRoute.find((r) => r.id === row.routeId);
          if (route) { inversa(row, 'route', route); route.steps = route.steps ?? []; route.steps.push(row); }
        }
        if (model === 'classroomActivity') {
          row.classroom = rows.classroom.find((c) => c.id === row.classroomId);
        }
        return row;
      }),
      update: jest.fn(async ({ where, data: input }: any) => {
        const row = find({ where });
        if (!row) throw new Error('P2025');
        Object.assign(row, input);
        return row;
      }),
      updateMany: jest.fn(async ({ where, data: input }: any) => {
        const found = data.filter((row) => matches(row, where));
        found.forEach((row) => Object.assign(row, input));
        return { count: found.length };
      }),
      delete: jest.fn(async ({ where }: any) => {
        const row = find({ where });
        if (!row) throw new Error('P2025');
        data.splice(data.indexOf(row), 1);
        return row;
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        const found = data.filter((row) => matches(row, where));
        found.forEach((row) => data.splice(data.indexOf(row), 1));
        return { count: found.length };
      }),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const row = find({ where });
        if (row) { Object.assign(row, update); return row; }
        const nuevo = { id: `new-${++nextId}`, ...create };
        data.push(nuevo);
        return nuevo;
      }),
    };
  }

  // Igual que en producción: dentro del contexto de tenant la transacción se aplana.
  prisma.$transaction = jest.fn(async (arg: any) => {
    if (Array.isArray(arg)) return Promise.all(arg);
    const before = JSON.parse(JSON.stringify(rows, (k, v) => (k === 'route' || k === 'classroom' || k === 'teacherAssignment' ? undefined : v)));
    try {
      return await arg(prisma);
    } catch (error) {
      for (const model of Object.keys(rows)) {
        rows[model].splice(0, rows[model].length, ...before[model]);
      }
      throw error;
    }
  });

  // Valeria: doble. Nunca se llama a un proveedor real.
  const apdAi = {
    generateRoutePlan: jest.fn(async () => ({
      title: 'Plan sintético', description: 'Generado por el doble', targetLevel: 'A2', targetSkill: 'READING',
      steps: [{ title: 'Paso generado', skill: 'READING' }],
    })),
    generateEnglishLessonSlides: jest.fn(async () => ({
      title: 'Lección sintética', description: 'Generada por el doble',
      slides: [{ type: 'CONTENT', title: 'Slide', body: 'Texto' }],
    })),
  };

  const service = new LearningRouteService(prisma, apdAi as any);
  const evidence = new CompetencyEvidenceService(prisma);
  return { prisma, rows, service, evidence, apdAi };
}

/** Ninguna escritura, en ningún modelo. Se afirma sobre lo que NO ocurrió. */
export function noWrites(prisma: any) {
  for (const [name, delegate] of Object.entries(prisma) as any) {
    if (name === '$transaction') continue;
    for (const method of writeMethods) expect(delegate[method]).not.toHaveBeenCalled();
  }
}

/** Ninguna llamada de generación: un id ajeno no debe gastar IA. */
export function noAi(apdAi: any) {
  expect(apdAi.generateRoutePlan).not.toHaveBeenCalled();
  expect(apdAi.generateEnglishLessonSlides).not.toHaveBeenCalled();
}
