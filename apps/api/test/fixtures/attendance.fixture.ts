import { AttendanceService } from '../../src/modules/attendance/attendance.service';
import { AttendanceAuditService } from '../../src/modules/attendance/attendance-audit.service';
import { TutoringAttendanceService } from '../../src/modules/attendance/tutoring-attendance.service';

/**
 * Laboratorio A/B de Asistencia (por asignatura y de tutoría).
 *
 * Dos colegios sintéticos con la cadena completa del esquema —institución → sede → grupo (grado,
 * turno, director) → asignación docente (año, materia) → matrícula → registro de asistencia— y un
 * doble de Prisma que **aplica los filtros de verdad**: igualdad, `in`, `not`, rangos de fecha y,
 * sobre todo, **filtros por relación** (`group: { campus: { institutionId } }`, `area: {
 * institutionId }`, `teacherAssignment: { institutionId }`). Sin eso una prueba de aislamiento
 * pasaría aunque la guarda no existiera: el doble devolvería la fila igual.
 *
 * Dos detalles que aquí importan más que en otros módulos:
 *
 * - **Fechas.** Asistencia filtra por `date` exacta y por rangos `gte`/`lte`. Comparar objetos
 *   `Date` con `===` daría siempre falso y los reportes saldrían vacíos sin que nadie lo note, así
 *   que el doble compara por valor.
 * - **Reversión.** `$transaction` toma una instantánea y la restaura si la función lanza, igual
 *   que hace PostgreSQL. La instantánea es superficial por fila para no romper las referencias a
 *   las relaciones embebidas (ni convertir las fechas en cadenas, como haría un `JSON.parse`).
 *
 * Ni datos ni cuentas reales; ninguna conexión a staging o producción.
 */

export const A = 'school-A';
export const B = 'school-B';

/** Día lectivo de referencia de todas las pruebas. */
export const DIA = new Date('2026-03-02T00:00:00.000Z');
/** Día dentro de un período FINALIZED: la regla funcional de fecha cerrada sigue viva. */
export const DIA_CERRADO = new Date('2026-01-20T00:00:00.000Z');

const METODOS_ESCRITURA = ['create', 'createMany', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert'];

const MODELOS = [
  'institutionUser', 'institutionModule', 'academicYear', 'academicTerm', 'campus', 'grade', 'shift',
  'group', 'area', 'subject', 'user', 'teacherAssignment', 'scheduleEntry', 'student',
  'studentEnrollment', 'attendanceRecord', 'attendanceAuditEvent', 'tutoringAttendance',
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
      const esOperador = claves.some((k) => ['in', 'notIn', 'not', 'gte', 'gt', 'lte', 'lt', 'contains'].includes(k));
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
 * Relación INVERSA (matrícula → sus registros) no enumerable: se puede filtrar y leer como en
 * Prisma, pero no viaja al serializar la respuesta. Enumerable sería una referencia circular
 * —el registro lleva su matrícula— y el controlador respondería 500 por culpa del doble, no del
 * código que se está auditando.
 */
function inversa(row: any, key: string, value: any) {
  Object.defineProperty(row, key, { value, enumerable: false, writable: true, configurable: true });
}

/**
 * `include` con `where` anidado (p. ej. `attendanceRecords: { where: { date: {...} } }`).
 * Se devuelve una COPIA de la fila para no contaminar el estado compartido entre consultas.
 */
function aplicarInclude(row: any, include: any): any {
  if (!include || !row) return row;
  let salida = row;
  for (const [rel, config] of Object.entries(include) as any) {
    if (config && typeof config === 'object' && config.where && Array.isArray(row[rel])) {
      if (salida === row) salida = { ...row };
      inversa(salida, rel, row[rel].filter((hijo: any) => matches(hijo, config.where)));
    }
  }
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

  for (const [x, institutionId] of [['A', A], ['B', B]] as const) {
    const teacherId = `teacher-${x}`;

    rows.institutionModule.push({
      id: `mod-${x}`, institutionId, module: 'ATTENDANCE', isActive: true,
      features: ['TUTORING_ATTENDANCE'],
    });

    const academicYear = {
      id: `year-${x}`, institutionId, status: 'ACTIVE',
      startDate: new Date('2026-01-15T00:00:00.000Z'), endDate: new Date('2026-11-30T00:00:00.000Z'),
    };
    rows.academicYear.push(academicYear);
    rows.academicTerm.push(
      {
        id: `term-${x}`, name: `Período 1 ${x}`, institutionId, academicYearId: academicYear.id, academicYear,
        status: 'OPEN', startDate: new Date('2026-02-01T00:00:00.000Z'), endDate: new Date('2026-04-30T00:00:00.000Z'),
      },
      {
        id: `term-cerrado-${x}`, name: `Período 0 ${x}`, institutionId, academicYearId: academicYear.id, academicYear,
        status: 'FINALIZED', startDate: new Date('2026-01-15T00:00:00.000Z'), endDate: new Date('2026-01-31T00:00:00.000Z'),
      },
    );

    const campus = { id: `campus-${x}`, institutionId, name: `Sede ${x}` };
    const grade = { id: `grade-${x}`, institutionId, name: `Grado ${x}` };
    const shift = { id: `shift-${x}`, campusId: campus.id, campus, name: 'Mañana' };
    rows.campus.push(campus);
    rows.grade.push(grade);
    rows.shift.push(shift);

    // `Group` NO tiene institutionId en el esquema: su institución es la de la sede.
    const group: any = {
      id: `group-${x}`, name: `${x}-01`, campusId: campus.id, campus,
      gradeId: grade.id, grade, shiftId: shift.id, shift, directorId: teacherId,
    };
    rows.group.push(group);

    // `Subject` tampoco: cuelga del área.
    const area = { id: `area-${x}`, institutionId, name: `Área ${x}` };
    const subject: any = { id: `subject-${x}`, name: `Materia ${x}`, areaId: area.id, area };
    rows.area.push(area);
    rows.subject.push(subject);

    const teacher = { id: teacherId, firstName: 'Docente', lastName: x };
    rows.user.push(teacher);
    rows.institutionUser.push({ id: `iu-${x}`, institutionId, userId: teacherId, isActive: true, joinedAt: new Date('2026-01-01T00:00:00.000Z') });

    const teacherAssignment: any = {
      id: `ta-${x}`, institutionId, academicYearId: academicYear.id, academicYear,
      groupId: group.id, group, subjectId: subject.id, subject, teacherId, teacher,
    };
    rows.teacherAssignment.push(teacherAssignment);
    rows.scheduleEntry.push({
      id: `sch-${x}`, institutionId, teacherAssignmentId: teacherAssignment.id,
      academicYearId: academicYear.id, dayOfWeek: 1, startTime: '07:00', endTime: '08:00',
    });

    // Dos estudiantes por colegio: uno presente y uno ausente, para que los reportes tengan
    // aritmética que comprobar y no solo ceros.
    for (const [sufijo, estado] of [['1', 'PRESENT'], ['2', 'ABSENT']] as const) {
      const student = {
        id: `student-${x}${sufijo}`, institutionId, userId: `user-${x}${sufijo}`,
        firstName: `Nombre${sufijo}`, lastName: `Apellido${x}`, documentNumber: `100${sufijo}`,
      };
      rows.student.push(student);
      const enrollment: any = {
        id: `enr-${x}${sufijo}`, institutionId, studentId: student.id, student,
        academicYearId: academicYear.id, academicYear, groupId: group.id, group, status: 'ACTIVE',
      };
      inversa(enrollment, 'attendanceRecords', [] as any[]);
      rows.studentEnrollment.push(enrollment);

      const record: any = {
        id: `rec-${x}${sufijo}`, institutionId,
        teacherAssignmentId: teacherAssignment.id, teacherAssignment,
        studentEnrollmentId: enrollment.id, studentEnrollment: enrollment,
        date: DIA, status: estado, observations: null,
      };
      rows.attendanceRecord.push(record);
      enrollment.attendanceRecords.push(record);

      rows.tutoringAttendance.push({
        id: `tut-${x}${sufijo}`, institutionId, groupId: group.id, group,
        teacherId, teacher, studentEnrollmentId: enrollment.id, studentEnrollment: enrollment,
        date: DIA, status: estado, observations: null,
      });
    }
  }

  const prisma: any = {};
  let siguienteId = 0;
  for (const [modelo, data] of Object.entries(rows)) {
    const buscar = ({ where }: any) => data.find((row) => matches(row, where)) ?? null;
    prisma[modelo] = {
      findFirst: jest.fn(async (args: any = {}) => {
        const row = buscar(args);
        return row ? aplicarInclude(row, args.include) : null;
      }),
      findUnique: jest.fn(async (args: any = {}) => {
        const row = buscar(args);
        return row ? aplicarInclude(row, args.include) : null;
      }),
      findMany: jest.fn(async (args: any = {}) => {
        const encontrados = data.filter((row) => matches(row, args.where));
        const conInclude = encontrados.map((row) => aplicarInclude(row, args.include));
        return args.take ? conInclude.slice(0, args.take) : conInclude;
      }),
      count: jest.fn(async ({ where }: any = {}) => data.filter((row) => matches(row, where)).length),
      groupBy: jest.fn(async ({ where }: any = {}) => data.filter((row) => matches(row, where))),
      aggregate: jest.fn(async ({ where }: any = {}) => ({ _count: data.filter((row) => matches(row, where)).length })),
      create: jest.fn(async ({ data: input }: any) => {
        const row: any = { id: `nuevo-${++siguienteId}`, ...input };
        data.push(row);
        if (modelo === 'attendanceRecord' || modelo === 'tutoringAttendance') {
          row.teacherAssignment = rows.teacherAssignment.find((t) => t.id === row.teacherAssignmentId);
          row.studentEnrollment = rows.studentEnrollment.find((e) => e.id === row.studentEnrollmentId);
          row.group = rows.group.find((g) => g.id === row.groupId);
          if (modelo === 'attendanceRecord' && row.studentEnrollment) row.studentEnrollment.attendanceRecords.push(row);
        }
        return row;
      }),
      createMany: jest.fn(async ({ data: input }: any) => {
        const filas = (Array.isArray(input) ? input : [input]).map((d: any) => ({ id: `nuevo-${++siguienteId}`, ...d }));
        data.push(...filas);
        return { count: filas.length };
      }),
      update: jest.fn(async ({ where, data: input }: any) => {
        const row = buscar({ where });
        if (!row) throw new Error('P2025');
        Object.assign(row, input);
        return row;
      }),
      updateMany: jest.fn(async ({ where, data: input }: any) => {
        const encontrados = data.filter((row) => matches(row, where));
        encontrados.forEach((row) => Object.assign(row, input));
        return { count: encontrados.length };
      }),
      delete: jest.fn(async ({ where }: any) => {
        const row = buscar({ where });
        if (!row) throw new Error('P2025');
        data.splice(data.indexOf(row), 1);
        return row;
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        const encontrados = data.filter((row) => matches(row, where));
        encontrados.forEach((row) => data.splice(data.indexOf(row), 1));
        return { count: encontrados.length };
      }),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const row = buscar({ where });
        if (row) { Object.assign(row, update); return row; }
        const nuevo = { id: `nuevo-${++siguienteId}`, ...create };
        data.push(nuevo);
        return nuevo;
      }),
    };
  }

  /**
   * Igual que en producción: dentro del contexto de tenant la transacción se APLANA (se ejecuta
   * sobre el mismo cliente). Si la función lanza, el estado vuelve atrás: es lo que permite
   * afirmar que un fallo intermedio —o de auditoría— no deja asistencia escrita a medias.
   */
  // Objeto distinto, con los mismos dobles como punto de partida. Así una prueba puede sustituir
  // un método del cliente raíz y demostrar que el callback usa realmente el cliente `tx` recibido.
  const tx: any = Object.fromEntries(
    Object.entries(prisma).map(([modelo, delegate]: [string, any]) => [modelo, { ...delegate }]),
  );

  prisma.$transaction = jest.fn(async (arg: any) => {
    if (Array.isArray(arg)) return Promise.all(arg);
    const antes = instantanea(rows);
    try {
      return await arg(tx);
    } catch (error) {
      restaurar(rows, antes);
      throw error;
    }
  });

  const audit = new AttendanceAuditService(prisma);
  const service = new AttendanceService(prisma, audit);
  const tutoring = new TutoringAttendanceService(prisma);
  return { prisma, tx, rows, service, tutoring, audit };
}

/** Ninguna escritura, en ningún modelo. Se afirma sobre lo que NO ocurrió. */
export function noWrites(prisma: any) {
  for (const [name, delegate] of Object.entries(prisma) as any) {
    if (name === '$transaction') continue;
    for (const metodo of METODOS_ESCRITURA) expect(delegate[metodo]).not.toHaveBeenCalled();
  }
}

/** Ninguna auditoría: un id ajeno no debe dejar rastro forense en el colegio atacado. */
export function noAudit(prisma: any) {
  expect(prisma.attendanceAuditEvent.createMany).not.toHaveBeenCalled();
  expect(prisma.attendanceAuditEvent.create).not.toHaveBeenCalled();
}

/** Filas de asistencia por colegio, para comprobar que un rechazo no movió nada. */
export function conteo(rows: Record<string, any[]>, modelo: string, institutionId: string) {
  return rows[modelo].filter((r) => r.institutionId === institutionId).length;
}
