import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Actor institucional explícito de las rutas blindadas de Classroom (Bloque 1).
 * Todos sus campos provienen de la sesión (JWT), JAMÁS del body/query del cliente.
 */
export interface ClassroomActor {
  userId: string;
  institutionId: string;
  roles: string[];
  isSuperAdmin: boolean;
}

/** Cliente de datos: el PrismaService raíz o una transacción interactiva (tx). */
type Db = any;

/**
 * Cadena institucional completa de un aula. Classroom sí tiene institutionId;
 * Group y Subject NO: el grupo se valida por campus y grado, la materia por área.
 * (A diferencia de Attendance no se exige shift: la cadena acordada para Classroom
 * es group.{campus,grade} — ver docs/PLAN_BLINDAJE_CLASSROOM.md).
 */
const classroomScopeWhere = (institutionId: string) => ({
  institutionId,
  // Edusyn Play: las aulas personales (isPersonal/ownerUserId) NO son institucionales.
  // Estas 17 rutas son exclusivamente institucionales: un aula personal responde 404,
  // indistinguible de un id ajeno o inexistente.
  isPersonal: false,
  teacherAssignment: {
    institutionId,
    academicYear: { institutionId },
    group: {
      campus: { institutionId },
      grade: { institutionId },
    },
    subject: { area: { institutionId } },
  },
});

const TEACHER_ASSIGNMENT_SELECT = {
  id: true,
  institutionId: true,
  teacherId: true,
  groupId: true,
  academicYearId: true,
  subjectId: true,
} as const;

/**
 * Roles con autoridad administrativa para VER un aula de su institución aunque no
 * sean el docente asignado. RECTOR expande a ADMIN_INSTITUTIONAL vía
 * expandEffectiveRoles (ver auth/role-hierarchy.ts); se lista igual por claridad.
 * OJO: un rol llamado 'SUPERADMIN' dentro de un tenant NO está aquí a propósito —
 * el superadmin real se reconoce solo por el claim booleano isSuperAdmin.
 */
const VIEW_ADMIN_ROLES = ['ADMIN_INSTITUTIONAL', 'RECTOR', 'COORDINADOR'];

/** ¿El actor ve el aula solo como estudiante (ni docente asignado, ni admin, ni SuperAdmin)? */
export const esVistaEstudiante = (
  actor: ClassroomActor,
  classroom: { teacherAssignment: { teacherId: string } },
): boolean =>
  !actor.isSuperAdmin &&
  classroom.teacherAssignment.teacherId !== actor.userId &&
  !actor.roles.some((r) => VIEW_ADMIN_ROLES.includes(r));

/**
 * Servicio compartido de acceso institucional para Classroom Bloque 1 (17 rutas).
 *
 * Reglas:
 * - Un id ajeno, inexistente o con cadena histórica incoherente responde 404,
 *   indistinguible, ANTES de cualquier PII o consulta secundaria sensible.
 * - Una falta de permiso sobre un recurso que SÍ pertenece a la institución
 *   responde 403.
 * - SuperAdmin opera con la institución resuelta por requireInstitutionId, pero
 *   nunca se salta la validación de relaciones del recurso.
 * - Todos los métodos aceptan un `tx` opcional para ejecutarse dentro de una
 *   transacción interactiva (guarda + lecturas + escrituras con el mismo cliente).
 */
@Injectable()
export class ClassroomTenantAccessService {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Db): Db {
    return tx ?? this.prisma;
  }

  /**
   * Aula en alcance con la cadena completa validada:
   * classroom.institutionId + teacherAssignment.institutionId +
   * academicYear.institutionId + group.{campus,grade}.institutionId +
   * subject.area.institutionId. Ajena/inexistente/incoherente/personal → 404.
   */
  async classroomInScope(actor: ClassroomActor, classroomId: string, tx?: Db) {
    const classroom = await this.db(tx).classroom.findFirst({
      where: { id: classroomId, ...classroomScopeWhere(actor.institutionId) },
      include: { teacherAssignment: { select: TEACHER_ASSIGNMENT_SELECT } },
    });
    if (!classroom) throw new NotFoundException('Aula no encontrada');
    return classroom;
  }

  /**
   * Actividad en alcance: cuelga de un aula con la cadena completa validada.
   * Ajena/inexistente → 404.
   */
  async activityInScope(actor: ClassroomActor, activityId: string, tx?: Db) {
    const activity = await this.db(tx).classroomActivity.findFirst({
      where: {
        id: activityId,
        classroom: classroomScopeWhere(actor.institutionId),
      },
      include: {
        classroom: {
          select: {
            id: true,
            institutionId: true,
            title: true,
            teacherAssignment: { select: TEACHER_ASSIGNMENT_SELECT },
          },
        },
      },
    });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    return activity;
  }

  /**
   * Asignación docente en alcance (para crear aula desde teacherAssignmentId):
   * cadena completa + vigente (endDate null, como exigía el código anterior).
   * Ajena/inexistente → 404.
   */
  async assignmentInScope(actor: ClassroomActor, teacherAssignmentId: string, tx?: Db) {
    const assignment = await this.db(tx).teacherAssignment.findFirst({
      where: {
        id: teacherAssignmentId,
        institutionId: actor.institutionId,
        endDate: null,
        academicYear: { institutionId: actor.institutionId },
        group: {
          campus: { institutionId: actor.institutionId },
          grade: { institutionId: actor.institutionId },
        },
        subject: { area: { institutionId: actor.institutionId } },
      },
      include: { group: { include: { grade: true } }, subject: true },
    });
    if (!assignment) throw new NotFoundException('Asignación no encontrada');
    return assignment;
  }

  /**
   * GESTIÓN (crear aula desde la asignación, editar, publicar, destinatarios…):
   * SOLO el docente asignado. El código anterior ya denegaba la gestión a
   * COORDINADOR/RECTOR/ADMIN_INSTITUTIONAL que no fueran el docente de la
   * asignación (ownership por teacherId); se conserva ese comportamiento y no se
   * amplía. SuperAdmin tampoco se salta esta regla. El recurso ya está en alcance
   * (lo garantiza classroomInScope/activityInScope antes), así que aquí → 403.
   */
  assertCanManageClassroom(
    actor: ClassroomActor,
    classroom: { teacherAssignment: { teacherId: string } },
  ): void {
    if (classroom.teacherAssignment.teacherId !== actor.userId) {
      throw new ForbiddenException('Aula no encontrada o no tiene permisos');
    }
  }

  /** Misma regla de gestión aplicada a la asignación origen de un aula nueva. */
  assertCanUseAssignment(
    actor: ClassroomActor,
    assignment: { teacherId: string },
  ): void {
    if (assignment.teacherId !== actor.userId) {
      throw new ForbiddenException('Asignación no encontrada o no pertenece al docente');
    }
  }

  /**
   * VISTA del aula (GET /classrooms/:id): docente asignado, SuperAdmin, rol
   * administrativo institucional (ADMIN_INSTITUTIONAL/RECTOR/COORDINADOR), o
   * estudiante con matrícula ACTIVA compatible (institución + año + grupo del aula).
   *
   * ACUDIENTE: el esquema NO vincula Guardian con cuentas de usuario (Guardian no
   * tiene userId), así que no se puede acreditar la relación acudiente→estudiante;
   * responde 404 para no revelar existencia. Esto cierra el defecto anterior, que
   * dejaba el aula abierta a cualquier usuario autenticado de cualquier colegio.
   *
   * Estudiante sin matrícula compatible → 404 (no revelar). Resto (p. ej. DOCENTE
   * no asignado de la misma institución) → 403.
   */
  async assertCanViewClassroom(
    actor: ClassroomActor,
    classroom: { teacherAssignment: { teacherId: string; groupId: string; academicYearId: string } },
    tx?: Db,
  ): Promise<void> {
    if (actor.isSuperAdmin) return;
    if (classroom.teacherAssignment.teacherId === actor.userId) return;
    if (actor.roles.some((r) => VIEW_ADMIN_ROLES.includes(r))) return;
    if (actor.roles.includes('ESTUDIANTE')) {
      const enrollmentId = await this.studentEnrollmentInClassroom(actor, classroom, tx);
      if (enrollmentId) return;
      throw new NotFoundException('Aula no encontrada');
    }
    if (actor.roles.includes('ACUDIENTE')) {
      throw new NotFoundException('Aula no encontrada');
    }
    throw new ForbiddenException('No tiene permisos para ver esta aula');
  }

  /**
   * Matrícula ACTIVA del actor (como estudiante) compatible con el aula:
   * student.userId = actor, student.institutionId, enrollment.institutionId,
   * academicYearId y groupId del aula, y cadena año/grupo íntegra.
   * Devuelve el enrollmentId o null si no existe.
   */
  async studentEnrollmentInClassroom(
    actor: ClassroomActor,
    classroom: { teacherAssignment: { groupId: string; academicYearId: string } },
    tx?: Db,
  ): Promise<string | null> {
    const institutionId = actor.institutionId;
    const student = await this.db(tx).student.findFirst({
      where: { userId: actor.userId, institutionId },
      select: { id: true },
    });
    if (!student) return null;
    const enrollment = await this.db(tx).studentEnrollment.findFirst({
      where: {
        studentId: student.id,
        institutionId,
        student: { institutionId },
        groupId: classroom.teacherAssignment.groupId,
        academicYearId: classroom.teacherAssignment.academicYearId,
        status: 'ACTIVE',
        academicYear: { institutionId },
        group: {
          campus: { institutionId },
          grade: { institutionId },
        },
      },
      select: { id: true },
    });
    return enrollment?.id ?? null;
  }

  /**
   * Destinatario de actividad: matrícula compatible con el aula de la actividad
   * (misma institución, mismo academicYearId y groupId del aula, estudiante de la
   * institución y cadena año/grupo íntegra). Ajena/inexistente/incompatible → 404.
   * No se exige status ACTIVE: el código anterior permitía asignar cualquier
   * matrícula y el filtro de estado es una decisión funcional distinta del
   * aislamiento; aquí solo se acredita la pertenencia.
   */
  async enrollmentInScope(
    actor: ClassroomActor,
    studentEnrollmentId: string,
    classroom: { teacherAssignment: { groupId: string; academicYearId: string } },
    tx?: Db,
  ) {
    const institutionId = actor.institutionId;
    const enrollment = await this.db(tx).studentEnrollment.findFirst({
      where: {
        id: studentEnrollmentId,
        institutionId,
        student: { institutionId },
        academicYearId: classroom.teacherAssignment.academicYearId,
        groupId: classroom.teacherAssignment.groupId,
        academicYear: { institutionId },
        group: {
          campus: { institutionId },
          grade: { institutionId },
        },
      },
      select: { id: true, studentId: true, groupId: true, academicYearId: true, status: true },
    });
    if (!enrollment) throw new NotFoundException('Matrícula no encontrada');
    return enrollment;
  }

  /**
   * Prerrequisitos de una actividad: cada uno debe existir y colgar de un aula de
   * la institución del actor (ajeno/inexistente → 404 ANTES de cualquier otra
   * filtración), no ser la propia actividad (400) y pertenecer a la MISMA aula
   * (400, como hacía el código anterior). La validación de ciclos queda en el
   * servicio, sobre el grafo existente (activity-graph.util).
   */
  async assertDependenciesValid(
    actor: ClassroomActor,
    activity: { id: string; classroomId: string },
    prerequisiteIds: string[],
    tx?: Db,
  ): Promise<void> {
    for (const prerequisiteId of prerequisiteIds) {
      if (prerequisiteId === activity.id) {
        throw new BadRequestException('Una actividad no puede depender de sí misma');
      }
      const prerequisite = await this.db(tx).classroomActivity.findFirst({
        where: {
          id: prerequisiteId,
          classroom: { institutionId: actor.institutionId },
        },
        select: { id: true, classroomId: true },
      });
      if (!prerequisite) throw new NotFoundException('Prerrequisito no encontrado');
      if (prerequisite.classroomId !== activity.classroomId) {
        throw new BadRequestException('El prerrequisito debe pertenecer a la misma aula');
      }
    }
  }
}
