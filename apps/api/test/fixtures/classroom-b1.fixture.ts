import { ClassroomService } from '../../src/modules/classroom/classroom.service';
import { ClassroomTenantAccessService, ClassroomActor } from '../../src/modules/classroom/classroom-tenant-access.service';
import { ActivityGatingService } from '../../src/modules/classroom/gating/activity-gating.service';
import { CompletionService } from '../../src/modules/classroom/gating/completion.service';

/**
 * Laboratorio A/B de Classroom Bloque 1 (17 rutas: aulas, actividades y destinatarios).
 *
 * Dos colegios sintéticos con la cadena completa del esquema —institución → sede/grado/jornada →
 * grupo (SIN institutionId propio) → área → materia (tampoco) → asignación docente → aula →
 * sección/actividad → dependencia/destinatario/entrega— y un doble de Prisma que **aplica los
 * filtros de verdad**: igualdad, `in`, `not`, `OR`/`AND`/`NOT`, `some`, rangos y, sobre todo,
 * **filtros por relación anidados** (`teacherAssignment.group.campus.institutionId`,
 * `subject.area.institutionId`, `activity.classroom.institutionId`). Un mock que siempre devuelve
 * la fila pedida no acreditaría nada.
 *
 * Rasgos deliberados de este laboratorio:
 *
 * - **El mismo docente (`teacher-shared`) existe en A y en B** (institutionUser y asignación en
 *   ambos): `userId` no puede ocultar una guarda institucional ausente.
 * - **Otro docente dentro de A** (`teacher-otro-A`), para el caso "docente ajeno del mismo colegio".
 * - **Filas históricas incoherentes** por cadena crítica: un aula de A cuya asignación es de B
 *   (`class-huerfana-A`), una asignación de A cuyo grupo cuelga de una sede de B (`ta-inc-A` →
 *   `class-inc-A` → `act-inc-A`), y una matrícula que dice institución A pero cuyo estudiante es
 *   de B (`enr-inc-A`).
 * - **Aula personal de Edusyn Play** (`class-personal-A`, `isPersonal`): las 17 rutas deben
 *   responder 404 como si no existiera.
 * - **Transacciones reales de mentira**: `$transaction` entrega un objeto `tx` DISTINTO, toma
 *   instantánea y revierte si el callback lanza (como PostgreSQL), y **falla la prueba si el
 *   callback usa el cliente raíz** en vez de `tx` — cualquier llamada al cliente raíz mientras el
 *   callback corre lanza `Error`. `fail(modelo, metodo)` fuerza un fallo intermedio para probar
 *   la reversión completa.
 *
 * Ni datos ni cuentas reales; ninguna conexión a staging o producción.
 */

export const A = 'school-A';
export const B = 'school-B';

const METODOS_ESCRITURA = ['create', 'createMany', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert'];

const MODELOS = [
  'institutionUser', 'academicYear', 'academicTerm', 'campus', 'grade', 'shift', 'group', 'area',
  'subject', 'user', 'student', 'studentEnrollment', 'teacherAssignment', 'classroom',
  'classroomSection', 'classroomMaterial', 'classroomAnnouncement', 'classroomActivity',
  'activityDependency', 'activityAssignment', 'activitySubmission', 'lessonProgress',
  'attitudinalRubric',
];

function mismoValor(a: any, b: any): boolean {
  if (a instanceof Date || b instanceof Date) {
    const x = a instanceof Date ? a.getTime() : new Date(a).getTime();
    const y = b instanceof Date ? b.getTime() : new Date(b).getTime();
    return x === y;
  }
  return a === b;
}

function comparable(v: any): number | string {
  return v instanceof Date ? v.getTime() : v;
}

const OPERADORES = ['in', 'notIn', 'not', 'gte', 'gt', 'lte', 'lt', 'contains', 'some', 'every', 'none'];

function matches(row: any, where: any = {}): boolean {
  if (row === null || row === undefined) return false;
  return Object.entries(where ?? {}).every(([key, value]: [string, any]) => {
    if (value === undefined) return true;
    if (key === 'OR') return value.some((part: any) => matches(row, part));
    if (key === 'AND') return value.every((part: any) => matches(row, part));
    if (key === 'NOT') return !matches(row, value);
    if (value === null) return row[key] === null || row[key] === undefined;
    if (value instanceof Date) return mismoValor(row[key], value);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const claves = Object.keys(value);
      const esOperador = claves.some((k) => OPERADORES.includes(k));
      if (esOperador) {
        return claves.every((op) => {
          const esperado = (value as any)[op];
          const actual = row[key];
          switch (op) {
            case 'in': return esperado.some((v: any) => mismoValor(actual, v));
            case 'notIn': return !esperado.some((v: any) => mismoValor(actual, v));
            case 'not': return esperado === null
              ? actual !== null && actual !== undefined
              : !mismoValor(actual, esperado);
            case 'gte': return comparable(actual) >= comparable(esperado);
            case 'gt': return comparable(actual) > comparable(esperado);
            case 'lte': return comparable(actual) <= comparable(esperado);
            case 'lt': return comparable(actual) < comparable(esperado);
            case 'contains': return String(actual ?? '').includes(String(esperado));
            // Relaciones to-many: `assignedStudents: { some: { studentEnrollmentId } }`.
            case 'some': return (Array.isArray(actual) ? actual : []).some((hijo: any) => matches(hijo, esperado));
            case 'every': return (Array.isArray(actual) ? actual : []).every((hijo: any) => matches(hijo, esperado));
            case 'none': return !(Array.isArray(actual) ? actual : []).some((hijo: any) => matches(hijo, esperado));
            default: return false;
          }
        });
      }
      // Filtro por RELACIÓN: exige que la relación esté embebida en la fila. Es lo que hace
      // demostrable el blindaje de `Group` y `Subject`, que no tienen `institutionId` propio.
      return matches(row[key], value);
    }
    return mismoValor(row[key], value);
  });
}

/**
 * Relación no enumerable: se puede filtrar y leer como en Prisma, pero no viaja al serializar la
 * respuesta HTTP. Las referencias "hacia arriba" (actividad → aula, matrícula → …) y las
 * colecciones inversas vivirían en ciclos y el controlador respondería 500 por culpa del doble.
 */
function oculta(row: any, key: string, value: any) {
  Object.defineProperty(row, key, { value, enumerable: false, writable: true, configurable: true });
}

/** Colección inversa calculada al vuelo: siempre sincronizada con create/delete del doble. */
function inversa(row: any, key: string, getter: () => any[]) {
  Object.defineProperty(row, key, { get: getter, enumerable: false, configurable: true });
}

function ordenar(items: any[], orderBy: any): any[] {
  const criterios = Array.isArray(orderBy) ? orderBy : [orderBy];
  const plano = criterios.filter(
    (c) => c && typeof c === 'object' && Object.values(c).every((v) => v === 'asc' || v === 'desc'),
  );
  if (!plano.length) return items;
  return [...items].sort((x, y) => {
    for (const criterio of plano) {
      for (const [campo, dir] of Object.entries(criterio) as any) {
        const a = comparable(x[campo]);
        const b = comparable(y[campo]);
        if (a === b || a == null || b == null) continue;
        const cmp = a < b ? -1 : 1;
        return dir === 'desc' ? -cmp : cmp;
      }
    }
    return 0;
  });
}

/**
 * `include`/`select` con `where`/`orderBy`/`take`/anidados (p. ej. `sections: { include: {
 * activities: { where: { isPublished: true } } } }` o el `select` con `where` de
 * students-for-assignment). Materializa las relaciones pedidas como enumerables en una COPIA
 * para no contaminar el estado compartido; los escalares seleccionados se ignoran (el doble
 * devuelve la fila completa), que es más de lo que devuelve Prisma, nunca menos.
 */
function proyectar(row: any, args: any): any {
  if (!row) return row;
  let salida = row;
  const procesar = (contenido: any) => {
    for (const [rel, config] of Object.entries(contenido ?? {}) as any) {
      if (!config || typeof config !== 'object') continue; // true (escalar) o relación sin más
      if (rel === '_count') {
        const conteos: Record<string, number> = {};
        for (const [coleccion, conf] of Object.entries(config.select ?? {}) as any) {
          let valor = row[coleccion];
          // _count filtrado de Prisma (p. ej. activities: { where: { isPublished: true } }).
          if (conf && typeof conf === 'object' && conf.where) {
            valor = (Array.isArray(valor) ? valor : []).filter((hijo: any) => matches(hijo, conf.where));
          }
          conteos[coleccion] = Array.isArray(valor) ? valor.length : 0;
        }
        if (salida === row) salida = { ...row };
        salida._count = conteos;
        continue;
      }
      const valor = row[rel];
      if (Array.isArray(valor)) {
        let items = valor;
        if (config.where) items = items.filter((hijo: any) => matches(hijo, config.where));
        const anidado = config.include || config.select;
        if (anidado) items = items.map((hijo: any) => proyectar(hijo, { include: anidado }));
        if (config.orderBy) items = ordenar(items, config.orderBy);
        if (config.take) items = items.slice(0, config.take);
        if (salida === row) salida = { ...row };
        salida[rel] = items;
      } else if (valor && typeof valor === 'object' && (config.include || config.select)) {
        if (salida === row) salida = { ...row };
        salida[rel] = proyectar(valor, { include: config.include || config.select });
      }
    }
  };
  procesar(args?.include);
  procesar(args?.select);
  return salida;
}

function instantanea(rows: Record<string, any[]>) {
  const snap: Record<string, Array<{ row: any; copia: any }>> = {};
  for (const [modelo, data] of Object.entries(rows)) {
    snap[modelo] = data.map((row) => ({ row, copia: { ...row } }));
  }
  return snap;
}

function restaurar(rows: Record<string, any[]>, snap: ReturnType<typeof instantanea>) {
  for (const [modelo, entradas] of Object.entries(snap)) {
    for (const { row, copia } of entradas) {
      for (const k of Object.keys(row)) if (!(k in copia)) delete row[k];
      Object.assign(row, copia);
    }
    rows[modelo].splice(0, rows[modelo].length, ...entradas.map((e) => e.row));
  }
}

export function fixture() {
  const rows: Record<string, any[]> = Object.fromEntries(MODELOS.map((name) => [name, []]));

  // ─── Usuarios ─────────────────────────────────────────────────────────────
  // EL MISMO docente en AMBOS colegios: userId no puede tapar una guarda ausente.
  const teacherShared = { id: 'teacher-shared', firstName: 'Docente', lastName: 'Compartido', email: 'shared@example.invalid' };
  const teacherOtroA = { id: 'teacher-otro-A', firstName: 'Docente', lastName: 'AjenoA', email: 'otro@example.invalid' };
  rows.user.push(teacherShared, teacherOtroA, { id: 'root', firstName: 'Root', lastName: 'Platform', email: 'root@example.invalid' });
  rows.institutionUser.push(
    { id: 'iu-shared-A', institutionId: A, userId: teacherShared.id, isActive: true, joinedAt: new Date('2026-01-01T00:00:00.000Z') },
    { id: 'iu-shared-B', institutionId: B, userId: teacherShared.id, isActive: true, joinedAt: new Date('2026-02-01T00:00:00.000Z') },
    { id: 'iu-otro-A', institutionId: A, userId: teacherOtroA.id, isActive: true, joinedAt: new Date('2026-01-01T00:00:00.000Z') },
  );

  // ─── Cadena por colegio ───────────────────────────────────────────────────
  for (const [x, institutionId] of [['A', A], ['B', B]] as const) {
    const academicYear: any = {
      id: `year-${x}`, institutionId, status: 'ACTIVE',
      startDate: new Date('2026-01-15T00:00:00.000Z'), endDate: new Date('2026-11-30T00:00:00.000Z'),
    };
    rows.academicYear.push(academicYear);
    rows.academicTerm.push({
      id: `term-${x}`, name: `Período 1 ${x}`, type: 'PERIOD', institutionId,
      academicYearId: academicYear.id, academicYear, status: 'OPEN',
      startDate: new Date('2020-01-01T00:00:00.000Z'), endDate: new Date('2030-12-31T00:00:00.000Z'),
    });

    const campus = { id: `campus-${x}`, institutionId, name: `Sede ${x}` };
    const grade = { id: `grade-${x}`, institutionId, name: `Grado ${x}` };
    const shift: any = { id: `shift-${x}`, campusId: campus.id, campus, name: 'Mañana' };
    rows.campus.push(campus);
    rows.grade.push(grade);
    rows.shift.push(shift);

    // `Group` NO tiene institutionId: su institución es la de su sede y su grado.
    const group: any = {
      id: `group-${x}`, name: `${x}-01`, campusId: campus.id, campus,
      gradeId: grade.id, grade, shiftId: shift.id, shift,
    };
    rows.group.push(group);

    // `Subject` tampoco: cuelga del área.
    const area = { id: `area-${x}`, institutionId, name: `Área ${x}` };
    const subject: any = { id: `subject-${x}`, name: `Materia ${x}`, areaId: area.id, area };
    rows.area.push(area);
    rows.subject.push(subject);

    const teacherAssignment: any = {
      id: `ta-${x}`, institutionId, academicYearId: academicYear.id, academicYear,
      groupId: group.id, group, subjectId: subject.id, subject,
      teacherId: teacherShared.id, teacher: teacherShared, startDate: new Date('2026-01-15T00:00:00.000Z'), endDate: null,
    };
    rows.teacherAssignment.push(teacherAssignment);

    const classroom: any = {
      id: `class-${x}`, institutionId, teacherAssignmentId: teacherAssignment.id,
      title: `Aula ${x}`, description: null, coverImage: null, color: null, isActive: true,
      ownerUserId: null, isPersonal: false, createdAt: new Date('2026-02-01T00:00:00.000Z'),
      teacherAssignment,
    };
    rows.classroom.push(classroom);
    oculta(teacherAssignment, 'classroom', classroom);

    const section: any = {
      id: `section-${x}1`, classroomId: classroom.id, title: `Unidad ${x}`, description: null,
      sortOrder: 1, isVisible: true, academicTermId: `term-${x}`,
    };
    oculta(section, 'classroom', classroom);
    rows.classroomSection.push(section);

    rows.classroomMaterial.push({
      id: `mat-${x}1`, sectionId: section.id, type: 'LINK', title: `Material ${x}`,
      content: null, fileUrl: null, isVisible: true, sortOrder: 1,
    });

    rows.classroomAnnouncement.push({
      id: `ann-${x}1`, classroomId: classroom.id, title: `Anuncio ${x}`, content: 'Contenido',
      isPinned: false, createdAt: new Date('2026-02-10T00:00:00.000Z'), authorId: teacherShared.id, author: teacherShared,
    });
  }

  // Segundo grupo y año viejo de A (matrículas de otro grupo / otro año).
  const group2A: any = {
    id: 'group2-A', name: 'A-02', campusId: 'campus-A', campus: rows.campus.find((c) => c.id === 'campus-A'),
    gradeId: 'grade-A', grade: rows.grade.find((g) => g.id === 'grade-A'),
    shiftId: 'shift-A', shift: rows.shift.find((s) => s.id === 'shift-A'),
  };
  rows.group.push(group2A);
  const yearOldA: any = {
    id: 'year-old-A', institutionId: A, status: 'ARCHIVED',
    startDate: new Date('2025-01-15T00:00:00.000Z'), endDate: new Date('2025-11-30T00:00:00.000Z'),
  };
  rows.academicYear.push(yearOldA);
  // Período del año VIEJO de A: un academicTermId de otro año del mismo colegio debe
  // responder 404 al crear actividad (incompatible con el año del aula).
  rows.academicTerm.push({
    id: 'term-old-A', name: 'Período viejo A', type: 'PERIOD', institutionId: A,
    academicYearId: yearOldA.id, academicYear: yearOldA, status: 'CLOSED',
    startDate: new Date('2025-02-01T00:00:00.000Z'), endDate: new Date('2025-06-30T00:00:00.000Z'),
  });

  // Rúbricas actitudinales (tienen institutionId propio): rubricId ajeno → 404.
  rows.attitudinalRubric.push(
    { id: 'rubric-A', institutionId: A, name: 'Rúbrica A', isActive: true },
    { id: 'rubric-B', institutionId: B, name: 'Rúbrica B', isActive: true },
  );

  // El otro docente de A: su propia asignación y su propia aula (en group2-A).
  const taOtroA: any = {
    id: 'ta-otro-A', institutionId: A, academicYearId: 'year-A', academicYear: rows.academicYear.find((y) => y.id === 'year-A'),
    groupId: group2A.id, group: group2A, subjectId: 'subject-A', subject: rows.subject.find((s) => s.id === 'subject-A'),
    teacherId: teacherOtroA.id, teacher: teacherOtroA, startDate: new Date('2026-01-15T00:00:00.000Z'), endDate: null,
  };
  rows.teacherAssignment.push(taOtroA);
  const classOtroA: any = {
    id: 'class-otro-A', institutionId: A, teacherAssignmentId: taOtroA.id, title: 'Aula del otro docente',
    description: null, coverImage: null, color: null, isActive: true, ownerUserId: null, isPersonal: false,
    createdAt: new Date('2026-02-01T00:00:00.000Z'), teacherAssignment: taOtroA,
  };
  rows.classroom.push(classOtroA);
  oculta(taOtroA, 'classroom', classOtroA);

  // Asignación SIN aula del docente compartido en A (para available-assignments y create).
  const taDisponibleA: any = {
    id: 'ta-disponible-A', institutionId: A, academicYearId: 'year-A', academicYear: rows.academicYear.find((y) => y.id === 'year-A'),
    groupId: group2A.id, group: group2A, subjectId: 'subject-A', subject: rows.subject.find((s) => s.id === 'subject-A'),
    teacherId: teacherShared.id, teacher: teacherShared, startDate: new Date('2026-01-15T00:00:00.000Z'), endDate: null,
  };
  oculta(taDisponibleA, 'classroom', null);
  rows.teacherAssignment.push(taDisponibleA);

  // ─── Filas históricas INCOHERENTES (una por cadena crítica) ───────────────
  // 1. Aula de A cuya asignación es de B.
  const classHuerfanaA: any = {
    id: 'class-huerfana-A', institutionId: A, teacherAssignmentId: 'ta-B', title: 'Aula huérfana A',
    description: null, coverImage: null, color: null, isActive: true, ownerUserId: null, isPersonal: false,
    createdAt: new Date('2026-02-01T00:00:00.000Z'),
    teacherAssignment: rows.teacherAssignment.find((t) => t.id === 'ta-B'),
  };
  rows.classroom.push(classHuerfanaA);
  // 2. Asignación de A cuyo grupo cuelga de una sede de B (+ su aula + su actividad).
  const taIncA: any = {
    id: 'ta-inc-A', institutionId: A, academicYearId: 'year-A', academicYear: rows.academicYear.find((y) => y.id === 'year-A'),
    groupId: 'group-B', group: rows.group.find((g) => g.id === 'group-B'),
    subjectId: 'subject-A', subject: rows.subject.find((s) => s.id === 'subject-A'),
    teacherId: teacherShared.id, teacher: teacherShared, startDate: new Date('2026-01-15T00:00:00.000Z'), endDate: null,
  };
  rows.teacherAssignment.push(taIncA);
  const classIncA: any = {
    id: 'class-inc-A', institutionId: A, teacherAssignmentId: taIncA.id, title: 'Aula incoherente A',
    description: null, coverImage: null, color: null, isActive: true, ownerUserId: null, isPersonal: false,
    createdAt: new Date('2026-02-01T00:00:00.000Z'), teacherAssignment: taIncA,
  };
  rows.classroom.push(classIncA);
  oculta(taIncA, 'classroom', classIncA);
  // 3. Aula personal de Edusyn Play en A (no institucional).
  const taPersonalA: any = {
    id: 'ta-personal-A', institutionId: A, academicYearId: 'year-A', academicYear: rows.academicYear.find((y) => y.id === 'year-A'),
    groupId: 'group-A', group: rows.group.find((g) => g.id === 'group-A'),
    subjectId: 'subject-A', subject: rows.subject.find((s) => s.id === 'subject-A'),
    teacherId: teacherShared.id, teacher: teacherShared, startDate: new Date('2026-01-15T00:00:00.000Z'), endDate: null,
  };
  rows.teacherAssignment.push(taPersonalA);
  const classPersonalA: any = {
    id: 'class-personal-A', institutionId: A, teacherAssignmentId: taPersonalA.id, title: 'Aula Play personal',
    description: null, coverImage: null, color: null, isActive: true, ownerUserId: teacherShared.id, isPersonal: true,
    createdAt: new Date('2026-02-01T00:00:00.000Z'), teacherAssignment: taPersonalA,
  };
  rows.classroom.push(classPersonalA);
  oculta(taPersonalA, 'classroom', classPersonalA);

  // 5-7. Asignaciones de A con UNA rama de la cadena colgando de B (año, grupo, materia),
  //    SIN aula: available-assignments no puede ofrecerlas aunque institutionId diga A.
  const asignacionInc = (id: string, extra: any) => {
    const ta: any = {
      id, institutionId: A,
      academicYearId: 'year-A', academicYear: rows.academicYear.find((y) => y.id === 'year-A'),
      groupId: 'group-A', group: rows.group.find((g) => g.id === 'group-A'),
      subjectId: 'subject-A', subject: rows.subject.find((s) => s.id === 'subject-A'),
      teacherId: teacherShared.id, teacher: teacherShared,
      startDate: new Date('2026-01-15T00:00:00.000Z'), endDate: null, ...extra,
    };
    rows.teacherAssignment.push(ta);
    return ta;
  };
  asignacionInc('ta-inc-year-A', {
    academicYearId: 'year-B', academicYear: rows.academicYear.find((y) => y.id === 'year-B'),
  });
  asignacionInc('ta-inc-group-A', {
    groupId: 'group-B', group: rows.group.find((g) => g.id === 'group-B'),
  });
  asignacionInc('ta-inc-subject-A', {
    subjectId: 'subject-B', subject: rows.subject.find((s) => s.id === 'subject-B'),
  });
  for (const id of ['ta-inc-year-A', 'ta-inc-group-A', 'ta-inc-subject-A']) {
    oculta(rows.teacherAssignment.find((t) => t.id === id), 'classroom', null);
  }
  // 8-9. Lo mismo pero CON aula: listForTeacher no puede listar esas aulas aunque la
  //    asignación sea del docente y diga institución A.
  const ta2IncYearA = asignacionInc('ta2-inc-year-A', {
    academicYearId: 'year-B', academicYear: rows.academicYear.find((y) => y.id === 'year-B'),
  });
  const ta2IncSubjectA = asignacionInc('ta2-inc-subject-A', {
    subjectId: 'subject-B', subject: rows.subject.find((s) => s.id === 'subject-B'),
  });
  for (const [ta, id] of [[ta2IncYearA, 'class-inc-year-A'], [ta2IncSubjectA, 'class-inc-subject-A']] as const) {
    const c: any = {
      id, institutionId: A, teacherAssignmentId: ta.id, title: `Aula incoherente ${id}`,
      description: null, coverImage: null, color: null, isActive: true, ownerUserId: null, isPersonal: false,
      createdAt: new Date('2026-02-01T00:00:00.000Z'), teacherAssignment: ta,
    };
    rows.classroom.push(c);
    oculta(ta, 'classroom', c);
  }

  // ─── Actividades ──────────────────────────────────────────────────────────
  const classA = rows.classroom.find((c) => c.id === 'class-A');
  const classB = rows.classroom.find((c) => c.id === 'class-B');

  // Sección OCULTA de class-A (con un material visible dentro) y un material OCULTO en la
  // sección visible: la proyección de estudiante de getById no puede entregar ninguno de
  // los dos; el docente conserva ambos.
  const sectionA2: any = {
    id: 'section-A2', classroomId: classA.id, title: 'Unidad oculta A', description: null,
    sortOrder: 2, isVisible: false, academicTermId: null,
  };
  oculta(sectionA2, 'classroom', classA);
  rows.classroomSection.push(sectionA2);
  rows.classroomMaterial.push({
    id: 'mat-A1-oculto', sectionId: 'section-A1', type: 'LINK', title: 'Material oculto A',
    content: null, fileUrl: null, isVisible: false, sortOrder: 2,
  });
  rows.classroomMaterial.push({
    id: 'mat-A2', sectionId: 'section-A2', type: 'LINK', title: 'Material de sección oculta',
    content: null, fileUrl: null, isVisible: true, sortOrder: 1,
  });
  // Sección del OTRO aula de A (mismo colegio, otra aula): una FK cruzada dentro de la
  // MISMA institución tampoco acredita pertenencia — la guarda de sección exige el
  // classroomId del aula, no solo la institución.
  const sectionOtroA: any = {
    id: 'section-otro-A1', classroomId: classOtroA.id, title: 'Unidad del otro aula A',
    description: null, sortOrder: 1, isVisible: true, academicTermId: null,
  };
  oculta(sectionOtroA, 'classroom', classOtroA);
  rows.classroomSection.push(sectionOtroA);
  const actividad = (id: string, classroom: any, extra: any = {}) => {
    const act: any = {
      id, classroomId: classroom.id, sectionId: null, academicTermId: null,
      type: 'TASK', title: `Actividad ${id}`, description: null, maxScore: 5,
      dueDate: null, openDate: null, allowLateSubmit: false, maxAttempts: 1,
      shuffleQuestions: false, showResults: true, isVisible: true, isPublished: false,
      scheduledPublishAt: null, publishedAt: null, sortOrder: 0, isRouteScoped: false,
      metadata: null, isRestrictedToAssigned: false, rubricId: null,
      createdAt: new Date('2026-02-05T00:00:00.000Z'), ...extra,
    };
    oculta(act, 'classroom', classroom);
    rows.classroomActivity.push(act);
    return act;
  };
  actividad('act-A-pub', classA, { isPublished: true, publishedAt: new Date('2026-02-06T00:00:00.000Z') });
  actividad('act-A-draft', classA); // borrador: nunca visible para estudiantes
  actividad('act-A-restr', classA, { isPublished: true, publishedAt: new Date('2026-02-06T00:00:00.000Z'), isRestrictedToAssigned: true });
  actividad('act-A-dep', classA, { isPublished: true, publishedAt: new Date('2026-02-07T00:00:00.000Z'), sectionId: 'section-A1' });
  actividad('act-B-pub', classB, { isPublished: true, publishedAt: new Date('2026-02-06T00:00:00.000Z') });
  actividad('act-B-draft', classB);
  actividad('act-B-restr', classB, { isPublished: true, publishedAt: new Date('2026-02-06T00:00:00.000Z'), isRestrictedToAssigned: true });
  actividad('act-otro-A', classOtroA, { isPublished: true, publishedAt: new Date('2026-02-06T00:00:00.000Z') });
  actividad('act-inc-A', classIncA, { isPublished: true, publishedAt: new Date('2026-02-06T00:00:00.000Z') });

  // Dependencia: act-A-dep exige act-A-pub con MIN_SCORE 5 (el alumno A1 solo la entregó,
  // sin nota → queda bloqueada; hay algo que comprobar en ambos estados).
  rows.activityDependency.push({
    id: 'dep-A1', activityId: 'act-A-dep', prerequisiteId: 'act-A-pub', condition: 'MIN_SCORE', minScore: 5,
    activity: rows.classroomActivity.find((a) => a.id === 'act-A-dep'),
    prerequisite: rows.classroomActivity.find((a) => a.id === 'act-A-pub'),
  });

  // ─── Estudiantes y matrículas ─────────────────────────────────────────────
  const estudiante = (id: string, institutionId: string, userId: string, apellido: string) => {
    const user = { id: userId, firstName: `Nombre-${id}`, lastName: apellido, email: `${userId}@example.invalid` };
    rows.user.push(user);
    const student: any = {
      id, institutionId, userId, firstName: `Nombre-${id}`, lastName: apellido,
      secondLastName: null, photo: null, documentNumber: `doc-${id}`, user,
    };
    rows.student.push(student);
    rows.institutionUser.push({ id: `iu-${id}`, institutionId, userId, isActive: true, joinedAt: new Date('2026-01-01T00:00:00.000Z') });
    return student;
  };
  const matricula = (id: string, student: any, groupId: string, academicYearId: string, institutionId: string) => {
    const enrollment: any = {
      id, institutionId, studentId: student.id, student, academicYearId, groupId, status: 'ACTIVE',
      academicYear: rows.academicYear.find((y) => y.id === academicYearId),
      group: rows.group.find((g) => g.id === groupId),
    };
    rows.studentEnrollment.push(enrollment);
    return enrollment;
  };
  const studentA1 = estudiante('student-A1', A, 'user-A1', 'Compatible');
  const studentA2 = estudiante('student-A2', A, 'user-A2', 'Companero');
  const studentA3 = estudiante('student-A3', A, 'user-A3', 'OtroGrupo');
  const studentA4 = estudiante('student-A4', A, 'user-A4', 'OtroAno');
  const studentB1 = estudiante('student-B1', B, 'user-B1', 'DeB');
  matricula('enr-A1', studentA1, 'group-A', 'year-A', A);   // compatible con class-A
  matricula('enr-A2', studentA2, 'group-A', 'year-A', A);   // compañero del mismo grupo
  matricula('enr-A3', studentA3, 'group2-A', 'year-A', A);  // otro grupo
  matricula('enr-A4', studentA4, 'group-A', 'year-old-A', A); // otro año
  matricula('enr-B1', studentB1, 'group-B', 'year-B', B);
  // 4. Matrícula incoherente: dice institución A y cuelga de group-A/year-A, pero el
  //    estudiante es de B. Las guardas por cadena (student.institutionId) deben rechazarla.
  matricula('enr-inc-A', studentB1, 'group-A', 'year-A', A);
  // Matrícula del MISMO estudiante A1 pero en el año viejo: una entrega ligada a ella NO
  // es la entrega del actor en esta aula (el filtro debe ser por studentEnrollmentId
  // validado, no por student.userId).
  matricula('enr-A1-old', studentA1, 'group-A', 'year-old-A', A);

  // ─── Destinatarios y entregas ─────────────────────────────────────────────
  const destinatario = (id: string, activityId: string, studentEnrollmentId: string) => {
    const aa: any = { id, activityId, studentEnrollmentId };
    oculta(aa, 'activity', rows.classroomActivity.find((a) => a.id === activityId));
    aa.studentEnrollment = rows.studentEnrollment.find((e) => e.id === studentEnrollmentId);
    rows.activityAssignment.push(aa);
  };
  destinatario('aa-A1', 'act-A-restr', 'enr-A1');
  destinatario('aa-B1', 'act-B-restr', 'enr-B1');
  // Destinatario PREEXISTENTE incoherente (escrito cuando el alta no validaba): cuelga de
  // enr-inc-A (matrícula que dice A pero cuyo estudiante es de B). La lectura de
  // destinatarios no puede devolverlo: filtraría PII de un menor de B.
  destinatario('aa-inc-A', 'act-A-restr', 'enr-inc-A');

  const entrega = (id: string, activityId: string, studentEnrollmentId: string, status: string, score: number | null) => {
    const sub: any = {
      id, activityId, studentEnrollmentId, status, score, attemptNumber: 1,
      submittedAt: new Date('2026-02-20T00:00:00.000Z'), feedback: null,
      studentEnrollment: rows.studentEnrollment.find((e) => e.id === studentEnrollmentId),
    };
    oculta(sub, 'activity', rows.classroomActivity.find((a) => a.id === activityId));
    rows.activitySubmission.push(sub);
  };
  entrega('sub-A1', 'act-A-pub', 'enr-A1', 'SUBMITTED', null); // pendiente de calificar
  entrega('sub-A2', 'act-A-pub', 'enr-A2', 'GRADED', 4);
  // Entrega del mismo usuario A1 pero ligada a su matrícula del AÑO VIEJO: no es su
  // entrega en esta aula. attemptNumber mayor para que, si el filtro fuera por
  // student.userId, fuera la primera en aparecer.
  const subOld: any = {
    id: 'sub-A1-old', activityId: 'act-A-pub', studentEnrollmentId: 'enr-A1-old',
    status: 'GRADED', score: 5, attemptNumber: 2,
    submittedAt: new Date('2025-03-01T00:00:00.000Z'), feedback: null,
    studentEnrollment: rows.studentEnrollment.find((e) => e.id === 'enr-A1-old'),
  };
  oculta(subOld, 'activity', rows.classroomActivity.find((a) => a.id === 'act-A-pub'));
  rows.activitySubmission.push(subOld);

  // ─── Colecciones inversas calculadas (siempre sincronizadas) ──────────────
  for (const classroom of rows.classroom) {
    inversa(classroom, 'sections', () => rows.classroomSection.filter((s) => s.classroomId === classroom.id));
    inversa(classroom, 'activities', () => rows.classroomActivity.filter((a) => a.classroomId === classroom.id));
    inversa(classroom, 'announcements', () => rows.classroomAnnouncement.filter((a) => a.classroomId === classroom.id));
  }
  for (const section of rows.classroomSection) {
    inversa(section, 'materials', () => rows.classroomMaterial.filter((m) => m.sectionId === section.id));
    inversa(section, 'activities', () => rows.classroomActivity.filter((a) => a.sectionId === section.id));
    const term = rows.academicTerm.find((t) => t.id === section.academicTermId);
    if (term) section.academicTerm = term;
  }
  for (const activity of rows.classroomActivity) {
    inversa(activity, 'assignedStudents', () => rows.activityAssignment.filter((a) => a.activityId === activity.id));
    inversa(activity, 'submissions', () => rows.activitySubmission.filter((s) => s.activityId === activity.id));
  }
  for (const group of rows.group) {
    inversa(group, 'studentEnrollments', () => rows.studentEnrollment.filter((e) => e.groupId === group.id));
  }

  // ─── Doble de Prisma ──────────────────────────────────────────────────────
  const calls: Array<{ model: string; method: string; args: any; inTransaction: boolean }> = [];
  let siguienteId = 0;
  let fallo: { point: string; remaining: number; props?: Record<string, any> } | null = null;
  let enTransaccion = false;

  function buildClient(esTx: boolean) {
    const client: any = {};
    for (const modelo of MODELOS) {
      const data = rows[modelo];
      const delegate: any = {};
      const registrar = (method: string, fn: (args?: any) => any) => {
        delegate[method] = jest.fn(async (args: any = {}) => {
          // El cliente RAÍZ no puede usarse mientras corre el callback de una
          // transacción: si pasa, la prueba falla aquí mismo con un mensaje claro.
          if (!esTx && enTransaccion) {
            throw new Error(`Se usó el cliente raíz (${modelo}.${method}) dentro de una transacción: debía usarse tx`);
          }
          calls.push({ model: modelo, method, args, inTransaction: esTx });
          if (fallo && fallo.point === `${modelo}.${method}` && esTx) {
            if (--fallo.remaining === 0) {
              const props = fallo.props;
              fallo = null;
              throw Object.assign(new Error(`Fallo forzado en ${modelo}.${method}`), props);
            }
          }
          return fn(args);
        });
      };

      const buscar = (where: any) => data.find((row) => matches(row, where)) ?? null;

      registrar('findFirst', (args) => {
        const row = buscar(args.where);
        return row ? proyectar(row, args) : null;
      });
      registrar('findUnique', (args) => {
        const row = buscar(args.where);
        return row ? proyectar(row, args) : null;
      });
      registrar('findMany', (args) => {
        let encontrados = data.filter((row) => matches(row, args.where));
        if (args.orderBy) encontrados = ordenar(encontrados, args.orderBy);
        const conInclude = encontrados.map((row) => proyectar(row, args));
        return args.take ? conInclude.slice(0, args.take) : conInclude;
      });
      registrar('count', (args) => data.filter((row) => matches(row, args.where)).length);
      registrar('groupBy', (args) => {
        const campos: string[] = args.by ?? [];
        const grupos = new Map<string, any[]>();
        for (const row of data.filter((r) => matches(r, args.where))) {
          const clave = campos.map((f) => String(row[f])).join('|');
          const lista = grupos.get(clave);
          if (lista) lista.push(row); else grupos.set(clave, [row]);
        }
        return [...grupos.entries()].map(([clave, filas]) => ({
          ...Object.fromEntries(campos.map((f, i) => [f, clave.split('|')[i]])),
          _count: { _all: filas.length },
        }));
      });
      registrar('aggregate', (args) => ({ _count: data.filter((row) => matches(row, args.where)).length }));
      registrar('create', (args) => {
        // Unicidad real del esquema: Classroom.teacherAssignmentId es @unique. La carrera
        // se traduce a P2002, como haría PostgreSQL.
        if (modelo === 'classroom') {
          const duplicado = rows.classroom.find((c) => c.teacherAssignmentId === args.data.teacherAssignmentId);
          if (duplicado) {
            throw Object.assign(new Error('Unique constraint failed on teacherAssignmentId'), { code: 'P2002' });
          }
        }
        const row: any = { id: `nuevo-${++siguienteId}`, ...args.data };
        data.push(row);
        // Relaciones embebidas mínimas para que la respuesta y los filtros sigan siendo reales.
        if (modelo === 'classroom') {
          row.teacherAssignment = rows.teacherAssignment.find((t) => t.id === row.teacherAssignmentId) ?? null;
          if (row.teacherAssignment) oculta(row.teacherAssignment, 'classroom', row);
        }
        if (modelo === 'classroomActivity') {
          oculta(row, 'classroom', rows.classroom.find((c) => c.id === row.classroomId) ?? null);
          row.section = rows.classroomSection.find((s) => s.id === row.sectionId) ?? null;
          inversa(row, 'assignedStudents', () => rows.activityAssignment.filter((a) => a.activityId === row.id));
          inversa(row, 'submissions', () => rows.activitySubmission.filter((s) => s.activityId === row.id));
        }
        if (modelo === 'activityDependency') {
          oculta(row, 'activity', rows.classroomActivity.find((a) => a.id === row.activityId) ?? null);
          row.prerequisite = rows.classroomActivity.find((a) => a.id === row.prerequisiteId) ?? null;
        }
        if (modelo === 'activityAssignment') {
          oculta(row, 'activity', rows.classroomActivity.find((a) => a.id === row.activityId) ?? null);
          row.studentEnrollment = rows.studentEnrollment.find((e) => e.id === row.studentEnrollmentId) ?? null;
        }
        return proyectar(row, args);
      });
      registrar('createMany', (args) => {
        const filas = (Array.isArray(args.data) ? args.data : [args.data]).map((d: any) => ({ id: `nuevo-${++siguienteId}`, ...d }));
        for (const fila of filas) {
          data.push(fila);
          if (modelo === 'activityAssignment') {
            oculta(fila, 'activity', rows.classroomActivity.find((a) => a.id === fila.activityId) ?? null);
            fila.studentEnrollment = rows.studentEnrollment.find((e) => e.id === fila.studentEnrollmentId) ?? null;
          }
        }
        return { count: filas.length };
      });
      registrar('update', (args) => {
        const row = buscar(args.where);
        if (!row) throw new Error('P2025');
        Object.assign(row, args.data);
        return proyectar(row, args);
      });
      registrar('updateMany', (args) => {
        const encontrados = data.filter((row) => matches(row, args.where));
        encontrados.forEach((row) => Object.assign(row, args.data));
        return { count: encontrados.length };
      });
      registrar('delete', (args) => {
        const row = buscar(args.where);
        if (!row) throw new Error('P2025');
        data.splice(data.indexOf(row), 1);
        return row;
      });
      registrar('deleteMany', (args) => {
        const encontrados = data.filter((row) => matches(row, args.where));
        encontrados.forEach((row) => data.splice(data.indexOf(row), 1));
        return { count: encontrados.length };
      });
      registrar('upsert', (args) => {
        const row = buscar(args.where);
        if (row) { Object.assign(row, args.update); return row; }
        const nuevo = { id: `nuevo-${++siguienteId}`, ...args.create };
        data.push(nuevo);
        return nuevo;
      });
      client[modelo] = delegate;
    }
    return client;
  }

  const prisma = buildClient(false);
  const tx = buildClient(true);

  /**
   * Igual que en producción: la transacción toma instantánea y revierte si la función lanza.
   * El callback recibe un objeto `tx` DISTINTO; mientras corre, el cliente raíz está vetado.
   */
  prisma.$transaction = jest.fn(async (arg: any) => {
    if (Array.isArray(arg)) return Promise.all(arg);
    const antes = instantanea(rows);
    enTransaccion = true;
    try {
      return await arg(tx);
    } catch (error) {
      restaurar(rows, antes);
      throw error;
    } finally {
      enTransaccion = false;
    }
  });

  const completion = new CompletionService(prisma);
  const gating = new ActivityGatingService(prisma, completion);
  const access = new ClassroomTenantAccessService(prisma);
  const avisos = { programar: jest.fn() };
  const service = new ClassroomService(prisma, {} as any, {} as any, gating, access, avisos as any);

  return {
    rows,
    calls,
    prisma,
    tx,
    service,
    avisos,
    access,
    gating,
    completion,
    /** Escrituras registradas (en raíz o en tx). */
    writes: () => calls.filter((call) => METODOS_ESCRITURA.includes(call.method)),
    /** Fuerza un fallo en la N-ésima llamada a `modelo.metodo` dentro de tx (props extra, p. ej. code P2002). */
    fail(point: string, occurrence = 1, props?: Record<string, any>) {
      fallo = { point, remaining: occurrence, props };
    },
  };
}

export type ClassroomFixture = ReturnType<typeof fixture>;

/** Actor de servicio construido como lo hace el controlador: solo datos de sesión. */
export function actorDe(parcial: Partial<ClassroomActor> & { institutionId: string }): ClassroomActor {
  return { userId: 'teacher-shared', roles: ['DOCENTE'], isSuperAdmin: false, ...parcial };
}

/** Ninguna escritura, en ningún modelo, ni en el cliente raíz ni en tx. */
export function noWrites(data: ClassroomFixture) {
  expect(data.writes()).toEqual([]);
}

/** Filas de un modelo por colegio (para comprobar que un rechazo no movió nada). */
export function conteo(rows: Record<string, any[]>, modelo: string, institutionId: string) {
  return rows[modelo].filter((r) => r.institutionId === institutionId).length;
}
