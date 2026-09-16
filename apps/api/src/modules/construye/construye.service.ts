import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const ALLOWED_MEMBER_ROLES = new Set(['RESEARCH', 'DESIGN', 'DEVELOPMENT', 'TESTING', 'COORDINATION']);
const ALLOWED_JOURNAL_TYPES = new Set([
  'BRIEF_UPDATED', 'SOURCE_ADDED', 'PROMPT_COPIED', 'AI_IMPORT_PROPOSED', 'AI_IMPORT_APPLIED',
  'FILE_CHANGED', 'VERSION_CREATED', 'TEST_RECORDED', 'HELP_REQUESTED', 'TEACHER_COMMENT',
]);
const ALLOWED_FILES = new Set(['index.html', 'styles.css', 'app.js']);
const MAX_FILE_BYTES = 250_000;

type ManifestFile = { path: string; content: string };

export type ConstruyeTeamBrief = {
  problem: string;
  audience: string;
  subject: string;
  grade: '8.º' | '9.º' | '10.º' | '11.º';
  features: string;
  style: string;
};

const BRIEF_GRADES = new Set<ConstruyeTeamBrief['grade']>(['8.º', '9.º', '10.º', '11.º']);

function briefText(value: unknown, field: string, max: number): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new BadRequestException(`${field} debe ser texto`);
  return value.trim().slice(0, max);
}

/** El brief es una estructura pedagógica cerrada. Seleccionar campo por campo impide que el
 * cliente persista offsets, código, identificadores u otros datos fuera de este contrato. */
export function validateTeamBrief(value: unknown): ConstruyeTeamBrief {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('La idea del equipo no tiene un formato válido');
  }
  const source = value as Record<string, unknown>;
  const grade = source.grade === undefined ? '8.º' : source.grade;
  if (typeof grade !== 'string' || !BRIEF_GRADES.has(grade as ConstruyeTeamBrief['grade'])) {
    throw new BadRequestException('El grado del proyecto no es válido');
  }
  return {
    problem: briefText(source.problem, 'El problema', 1500),
    audience: briefText(source.audience, 'El público', 500),
    subject: briefText(source.subject, 'La asignatura', 300),
    grade: grade as ConstruyeTeamBrief['grade'],
    features: briefText(source.features, 'Las funciones', 2500),
    style: briefText(source.style, 'El estilo visual', 1000),
  };
}

function asShortText(value: unknown, field: string, max = 240): string {
  if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(`${field} es obligatorio`);
  return value.trim().slice(0, max);
}

/** Comprueba el contrato F0 antes de persistir una entrega. El preview aislado sigue
 * siendo la barrera de ejecución; este validador evita que la bitácora almacene otros
 * formatos o cargas de tamaño inesperado. */
export function validateStaticManifest(manifest: unknown): { files: ManifestFile[] } {
  if (!manifest || typeof manifest !== 'object' || !Array.isArray((manifest as any).files)) {
    throw new BadRequestException('La versión debe incluir los archivos de la aplicación');
  }
  const files = (manifest as any).files as ManifestFile[];
  if (!files.length || files.length > 3) throw new BadRequestException('La versión debe incluir entre uno y tres archivos');
  const paths = new Set<string>();
  for (const file of files) {
    if (!file || typeof file.path !== 'string' || typeof file.content !== 'string' || !ALLOWED_FILES.has(file.path)) {
      throw new BadRequestException('Solo se permiten index.html, styles.css y app.js');
    }
    if (paths.has(file.path)) throw new BadRequestException('La versión incluye un archivo repetido');
    paths.add(file.path);
    if (Buffer.byteLength(file.content, 'utf8') > MAX_FILE_BYTES) throw new BadRequestException(`El archivo ${file.path} supera el tamaño permitido`);
  }
  if (!paths.has('index.html')) throw new BadRequestException('La versión debe incluir index.html');
  return { files };
}

@Injectable()
export class ConstruyeService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertClassroomOwner(classroomId: string, institutionId: string, userId: string) {
    const classroom = await this.prisma.classroom.findFirst({
      where: { id: classroomId, institutionId },
      include: { teacherAssignment: { select: { teacherId: true, groupId: true, academicYearId: true } } },
    });
    if (!classroom || classroom.teacherAssignment.teacherId !== userId) {
      throw new ForbiddenException('Aula no encontrada o no tiene permisos');
    }
    return classroom;
  }

  private async projectForTeacher(projectId: string, institutionId: string, userId: string) {
    const project = await (this.prisma as any).construyeProject.findFirst({ where: { id: projectId, institutionId } });
    if (!project) throw new NotFoundException('Proyecto de Construye no encontrado');
    await this.assertClassroomOwner(project.classroomId, institutionId, userId);
    return project;
  }

  private async membership(teamId: string, institutionId: string, userId: string) {
    const team = await (this.prisma as any).construyeTeam.findFirst({ where: { id: teamId, institutionId } });
    if (!team) throw new NotFoundException('Equipo no encontrado');
    const member = await (this.prisma as any).construyeTeamMember.findFirst({
      where: { teamId, institutionId, studentEnrollment: { student: { userId } } },
      include: { studentEnrollment: { select: { id: true, studentId: true } } },
    });
    if (!member) throw new ForbiddenException('Solo los integrantes del equipo pueden realizar esta acción');
    return { team, member };
  }

  private async teamForUser(teamId: string, institutionId: string, userId: string) {
    try { return await this.membership(teamId, institutionId, userId); }
    catch (error) {
      if (!(error instanceof ForbiddenException)) throw error;
      const team = await (this.prisma as any).construyeTeam.findFirst({ where: { id: teamId, institutionId } });
      if (!team) throw new NotFoundException('Equipo no encontrado');
      await this.projectForTeacher(team.projectId, institutionId, userId);
      return { team, member: null };
    }
  }

  async createProject(institutionId: string, userId: string, dto: any) {
    const title = asShortText(dto?.title, 'El título');
    await this.assertClassroomOwner(dto?.classroomId, institutionId, userId);
    if (dto.classroomActivityId) {
      const activity = await this.prisma.classroomActivity.findFirst({ where: { id: dto.classroomActivityId, classroomId: dto.classroomId } });
      if (!activity) throw new BadRequestException('La actividad no pertenece a esta aula');
    }
    return (this.prisma as any).construyeProject.create({ data: {
      institutionId, teacherUserId: userId, classroomId: dto.classroomId, classroomActivityId: dto.classroomActivityId || null,
      title, instructions: typeof dto.instructions === 'string' ? dto.instructions.trim().slice(0, 8000) || null : null,
      briefTemplate: dto.briefTemplate && typeof dto.briefTemplate === 'object' ? dto.briefTemplate : undefined,
      startDate: dto.startDate ? new Date(dto.startDate) : null, dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
    }});
  }

  async listClassroomProjects(classroomId: string, institutionId: string, userId: string, isTeacher: boolean) {
    if (isTeacher) await this.assertClassroomOwner(classroomId, institutionId, userId);
    else {
      const classroom = await this.prisma.classroom.findFirst({ where: { id: classroomId, institutionId }, include: { teacherAssignment: true } });
      if (!classroom || !(await this.prisma.studentEnrollment.findFirst({ where: { institutionId, student: { userId }, groupId: classroom.teacherAssignment.groupId, academicYearId: classroom.teacherAssignment.academicYearId, status: 'ACTIVE' } }))) {
        throw new ForbiddenException('No perteneces a esta aula');
      }
    }
    return (this.prisma as any).construyeProject.findMany({ where: { institutionId, classroomId, status: { not: 'ARCHIVED' } }, orderBy: { createdAt: 'desc' } });
  }

  async createTeam(projectId: string, institutionId: string, userId: string, dto: any) {
    const project = await this.projectForTeacher(projectId, institutionId, userId);
    const members = Array.isArray(dto?.members) ? dto.members : [];
    if (!members.length || members.length > 8) throw new BadRequestException('Un equipo debe tener entre 1 y 8 estudiantes');
    const ids = members.map((member: any) => member?.studentEnrollmentId);
    if (new Set(ids).size !== ids.length || ids.some((id: unknown) => typeof id !== 'string')) throw new BadRequestException('Los integrantes no son válidos');
    const classroom = await this.assertClassroomOwner(project.classroomId, institutionId, userId);
    const enrolled = await this.prisma.studentEnrollment.findMany({ where: { id: { in: ids }, institutionId, groupId: classroom.teacherAssignment.groupId, academicYearId: classroom.teacherAssignment.academicYearId, status: 'ACTIVE' }, select: { id: true } });
    if (enrolled.length !== ids.length) throw new BadRequestException('Todos los integrantes deben estar matriculados en el aula');
    return (this.prisma as any).$transaction(async (tx: any) => {
      const team = await tx.construyeTeam.create({ data: { institutionId, projectId, name: asShortText(dto?.name, 'El nombre del equipo') } });
      await tx.construyeTeamMember.createMany({ data: members.map((member: any) => ({ institutionId, teamId: team.id, studentEnrollmentId: member.studentEnrollmentId, role: ALLOWED_MEMBER_ROLES.has(member.role) ? member.role : 'DEVELOPMENT' })) });
      await tx.construyeJournalEntry.create({ data: { institutionId, projectId, teamId: team.id, actorUserId: userId, type: 'BRIEF_UPDATED', summary: 'El docente creó el equipo y habilitó el espacio de trabajo.' } });
      return team;
    });
  }

  async getMyTeam(projectId: string, institutionId: string, userId: string) {
    const memberships = await (this.prisma as any).construyeTeamMember.findMany({ where: { institutionId, team: { projectId }, studentEnrollment: { student: { userId } } }, include: { team: true } });
    if (!memberships.length) throw new NotFoundException('Todavía no perteneces a un equipo de este proyecto');
    return this.teamDetail(memberships[0].team.id, institutionId, userId);
  }

  async teamDetail(teamId: string, institutionId: string, userId: string) {
    const { team } = await this.teamForUser(teamId, institutionId, userId);
    const [members, versions, journal] = await Promise.all([
      (this.prisma as any).construyeTeamMember.findMany({ where: { teamId, institutionId }, include: { studentEnrollment: { include: { student: { select: { firstName: true, lastName: true } } } } } }),
      (this.prisma as any).construyeVersion.findMany({ where: { teamId, institutionId }, orderBy: { number: 'desc' }, take: 20 }),
      (this.prisma as any).construyeJournalEntry.findMany({ where: { teamId, institutionId }, orderBy: { createdAt: 'desc' }, take: 100 }),
    ]);
    return { team, members, versions, journal };
  }

  async updateBrief(teamId: string, institutionId: string, userId: string, dto: any) {
    const { team, member } = await this.membership(teamId, institutionId, userId);
    const brief = validateTeamBrief(dto?.brief);
    const previous = team.brief && typeof team.brief === 'object' ? validateTeamBrief(team.brief) : null;
    const changedFields = (Object.keys(brief) as (keyof ConstruyeTeamBrief)[])
      .filter((field) => !previous || previous[field] !== brief[field]);

    if (!changedFields.length) return { team, journalEntry: null };

    return (this.prisma as any).$transaction(async (tx: any) => {
      const updatedTeam = await tx.construyeTeam.update({
        where: { id: teamId },
        data: { brief, briefUpdatedAt: new Date() },
      });
      const journalEntry = await tx.construyeJournalEntry.create({
        data: {
          institutionId,
          projectId: team.projectId,
          teamId,
          actorEnrollmentId: member.studentEnrollmentId,
          type: 'BRIEF_UPDATED',
          summary: previous ? 'El equipo actualizó la idea de su proyecto.' : 'El equipo guardó la idea inicial de su proyecto.',
          detail: { brief, changedFields },
        },
      });
      return { team: updatedTeam, journalEntry };
    });
  }

  async createVersion(teamId: string, institutionId: string, userId: string, dto: any) {
    const { team, member } = await this.membership(teamId, institutionId, userId);
    const manifest = validateStaticManifest(dto?.manifest);
    return (this.prisma as any).$transaction(async (tx: any) => {
      const latest = await tx.construyeVersion.findFirst({ where: { teamId, institutionId }, orderBy: { number: 'desc' }, select: { number: true } });
      const version = await tx.construyeVersion.create({ data: { institutionId, projectId: team.projectId, teamId, number: (latest?.number || 0) + 1, label: typeof dto?.label === 'string' ? dto.label.trim().slice(0, 120) || null : null, manifest, createdByEnrollmentId: member.studentEnrollmentId } });
      await tx.construyeJournalEntry.create({ data: { institutionId, projectId: team.projectId, teamId, actorEnrollmentId: member.studentEnrollmentId, type: 'VERSION_CREATED', summary: `Guardaron la versión ${version.number}.`, detail: { files: manifest.files.map((file) => file.path), versionId: version.id } } });
      return version;
    });
  }

  async addJournalEntry(teamId: string, institutionId: string, userId: string, dto: any) {
    const { team, member } = await this.teamForUser(teamId, institutionId, userId);
    const type = ALLOWED_JOURNAL_TYPES.has(dto?.type) ? dto.type : 'HELP_REQUESTED';
    if (member === null && type !== 'TEACHER_COMMENT') throw new ForbiddenException('El docente solo puede dejar comentarios de acompañamiento');
    if (member !== null && type === 'TEACHER_COMMENT') throw new ForbiddenException('Este tipo de entrada es solo para el docente');
    return (this.prisma as any).construyeJournalEntry.create({ data: { institutionId, projectId: team.projectId, teamId, actorEnrollmentId: member?.studentEnrollmentId || null, actorUserId: member ? null : userId, type, summary: asShortText(dto?.summary, 'El mensaje', 1500), detail: dto?.detail && typeof dto.detail === 'object' ? dto.detail : undefined } });
  }

  async dashboard(projectId: string, institutionId: string, userId: string) {
    await this.projectForTeacher(projectId, institutionId, userId);
    const teams = await (this.prisma as any).construyeTeam.findMany({ where: { projectId, institutionId }, include: { members: { include: { studentEnrollment: { include: { student: { select: { firstName: true, lastName: true } } } } } }, versions: { orderBy: { number: 'desc' }, take: 1 }, journal: { orderBy: { createdAt: 'desc' }, take: 5 } } });
    return teams.map((team: any) => ({ id: team.id, name: team.name, brief: team.brief || null, briefUpdatedAt: team.briefUpdatedAt || null, members: team.members, latestVersion: team.versions[0] || null, recentMilestones: team.journal, needsAttention: !team.versions.length || team.journal.some((entry: any) => entry.type === 'HELP_REQUESTED') }));
  }
}
