import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Gestión del workspace compartido "Edusyn Play".
 *
 * - Garantiza que exista la institución `edusyn-personal` (seed idempotente).
 * - Auto-provisiona las entidades académicas mínimas compartidas (Campus, Shift,
 *   AcademicYear, Grade, Group, Area, Subject) una sola vez.
 * - Para cada docente personal, crea su TeacherAssignment + Classroom oculto
 *   con `ownerUserId` + `isPersonal=true`.
 *
 * Todo es idempotente: se puede llamar múltiples veces sin duplicar.
 */
@Injectable()
export class PlayWorkspaceService {
  private readonly logger = new Logger(PlayWorkspaceService.name);
  static readonly INSTITUTION_SLUG = 'edusyn-personal';
  static readonly INSTITUTION_ID = 'edusyn-personal-workspace';

  constructor(private readonly prisma: PrismaService) {}

  /** Devuelve la institución compartida. La crea si no existe (además del seed). */
  async getOrCreateInstitution() {
    const existing = await this.prisma.institution.findUnique({
      where: { slug: PlayWorkspaceService.INSTITUTION_SLUG },
    });
    if (existing) return existing;

    return this.prisma.institution.create({
      data: {
        id: PlayWorkspaceService.INSTITUTION_ID,
        name: 'Edusyn Play',
        slug: PlayWorkspaceService.INSTITUTION_SLUG,
        type: 'PERSONAL',
        isHidden: true,
        status: 'ACTIVE',
      },
    });
  }

  /**
   * Garantiza que existan entidades académicas compartidas (Campus, Shift,
   * AcademicYear, Grade, Group, Area, Subject) para la institución Play.
   * Retorna los IDs requeridos para crear un TeacherAssignment.
   */
  async ensureSharedAcademicEntities(): Promise<{
    institutionId: string;
    campusId: string;
    shiftId: string;
    academicYearId: string;
    gradeId: string;
    groupId: string;
    subjectId: string;
  }> {
    const inst = await this.getOrCreateInstitution();
    const institutionId = inst.id;

    // Campus compartido
    let campus = await this.prisma.campus.findFirst({
      where: { institutionId, name: 'Play' },
    });
    if (!campus) {
      campus = await this.prisma.campus.create({
        data: { institutionId, name: 'Play' },
      });
    }

    // Shift compartido
    let shift = await this.prisma.shift.findFirst({
      where: { campusId: campus.id },
    });
    if (!shift) {
      shift = await this.prisma.shift.create({
        data: { campusId: campus.id, type: 'MORNING' as any, name: 'Play' },
      });
    }

    // AcademicYear compartido (año actual)
    const currentYear = new Date().getFullYear();
    let academicYear = await this.prisma.academicYear.findFirst({
      where: { institutionId, year: currentYear },
    });
    if (!academicYear) {
      academicYear = await this.prisma.academicYear.create({
        data: {
          institutionId,
          year: currentYear,
          startDate: new Date(`${currentYear}-01-01`),
          endDate: new Date(`${currentYear}-12-31`),
        } as any,
      });
    }

    // Grade compartido
    let grade = await this.prisma.grade.findFirst({
      where: { institutionId, name: 'Play' },
    });
    if (!grade) {
      grade = await this.prisma.grade.create({
        data: {
          institutionId,
          stage: 'BASICA_SECUNDARIA' as any,
          name: 'Play',
        },
      });
    }

    // Group compartido
    let group = await this.prisma.group.findFirst({
      where: { campusId: campus.id, shiftId: shift.id, gradeId: grade.id, name: 'Play' },
    });
    if (!group) {
      group = await this.prisma.group.create({
        data: {
          campusId: campus.id,
          shiftId: shift.id,
          gradeId: grade.id,
          name: 'Play',
        },
      });
    }

    // Area compartida
    let area = await this.prisma.area.findFirst({
      where: { institutionId, name: 'Play' },
    });
    if (!area) {
      area = await this.prisma.area.create({
        data: { institutionId, name: 'Play' },
      });
    }

    // Subject compartido
    let subject = await this.prisma.subject.findFirst({
      where: { areaId: area.id, name: 'Play' },
    });
    if (!subject) {
      subject = await this.prisma.subject.create({
        data: { areaId: area.id, name: 'Play' },
      });
    }

    return {
      institutionId,
      campusId: campus.id,
      shiftId: shift.id,
      academicYearId: academicYear.id,
      gradeId: grade.id,
      groupId: group.id,
      subjectId: subject.id,
    };
  }

  /**
   * Crea el TeacherAssignment y el Classroom personal del docente (idempotente).
   * Si ya existe, lo devuelve.
   */
  async ensureTeacherWorkspace(teacherId: string): Promise<{
    institutionId: string;
    teacherAssignmentId: string;
    classroomId: string;
  }> {
    const shared = await this.ensureSharedAcademicEntities();

    // TeacherAssignment (idempotente)
    let assignment = await this.prisma.teacherAssignment.findFirst({
      where: {
        institutionId: shared.institutionId,
        academicYearId: shared.academicYearId,
        groupId: shared.groupId,
        subjectId: shared.subjectId,
        teacherId,
      },
    });
    if (!assignment) {
      assignment = await this.prisma.teacherAssignment.create({
        data: {
          institutionId: shared.institutionId,
          academicYearId: shared.academicYearId,
          groupId: shared.groupId,
          subjectId: shared.subjectId,
          teacherId,
          weeklyHours: 0,
        },
      });
    }

    // Classroom oculto (idempotente — 1 por teacherAssignment)
    let classroom = await this.prisma.classroom.findUnique({
      where: { teacherAssignmentId: assignment.id },
    });
    if (!classroom) {
      classroom = await this.prisma.classroom.create({
        data: {
          institutionId: shared.institutionId,
          teacherAssignmentId: assignment.id,
          title: 'Mi espacio Play',
          isPersonal: true,
          ownerUserId: teacherId,
        },
      });
    }

    return {
      institutionId: shared.institutionId,
      teacherAssignmentId: assignment.id,
      classroomId: classroom.id,
    };
  }
}
