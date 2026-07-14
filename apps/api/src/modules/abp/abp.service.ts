import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ABP_PHASE_COUNT, resolvePhaseConfig } from './abp.constants';

// ═══════════════════════════════════════════════════════════════════════════
// EXPEDICIÓN ABP — servicio. Ticket 1: crear proyecto, roster, armar equipos.
// Permisos: docente dueño del aula (teacherAssignment.teacherId === userId).
// Multi-tenant: todo filtrado y creado con institutionId.
// ═══════════════════════════════════════════════════════════════════════════

@Injectable()
export class AbpService {
  constructor(private readonly prisma: PrismaService) {}

  /** Valida que el aula exista en la institución y que el docente sea su dueño. */
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

  /** Carga un proyecto validando que su aula pertenezca al docente. */
  private async assertProjectOwner(projectId: string, institutionId: string, userId: string) {
    const project = await this.prisma.abpProject.findFirst({
      where: { id: projectId, institutionId },
    });
    if (!project) throw new NotFoundException('Proyecto ABP no encontrado');
    await this.assertClassroomOwner(project.classroomId, institutionId, userId);
    return project;
  }

  // ─── PROYECTO ──────────────────────────────────────────────────────────────

  /** Docente crea un proyecto ABP en su aula. phaseConfig es opcional (defaults en código). */
  async createProject(institutionId: string, userId: string, dto: {
    classroomId: string; title: string; challenge?: string; phaseConfig?: any;
    startDate?: string; endDate?: string;
  }) {
    if (!dto.title?.trim()) throw new BadRequestException('El título es obligatorio');
    await this.assertClassroomOwner(dto.classroomId, institutionId, userId);
    return this.prisma.abpProject.create({
      data: {
        institutionId,
        classroomId: dto.classroomId,
        title: dto.title.trim(),
        challenge: dto.challenge?.trim() || null,
        phaseConfig: dto.phaseConfig ?? undefined, // null → defaults en lectura
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });
  }

  /** Lista los proyectos ABP de un aula (docente: todos; estudiante: los del aula). */
  async listByClassroom(classroomId: string, institutionId: string) {
    const projects = await this.prisma.abpProject.findMany({
      where: { classroomId, institutionId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { teams: true } } },
    });
    return projects.map(p => ({ ...p, phaseConfig: resolvePhaseConfig(p.phaseConfig) }));
  }

  /** Detalle de un proyecto con sus equipos y miembros (docente dueño). */
  async getProject(projectId: string, institutionId: string, userId: string) {
    const project = await this.assertProjectOwner(projectId, institutionId, userId);
    const teams = await this.listTeams(projectId, institutionId);
    return { ...project, phaseConfig: resolvePhaseConfig(project.phaseConfig), teams };
  }

  // ─── ROSTER (matriculados del aula, para armar equipos) ─────────────────────

  async getRoster(classroomId: string, institutionId: string, userId: string) {
    const classroom = await this.assertClassroomOwner(classroomId, institutionId, userId);
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        groupId: classroom.teacherAssignment.groupId,
        academicYearId: classroom.teacherAssignment.academicYearId,
        status: 'ACTIVE',
      },
      include: { student: { include: { user: { select: { id: true, firstName: true, lastName: true } } } } },
      orderBy: { student: { user: { lastName: 'asc' } } },
    });
    return enrollments.map(e => ({
      enrollmentId: e.id,
      studentId: e.studentId,
      name: `${e.student.user?.firstName ?? ''} ${e.student.user?.lastName ?? ''}`.trim() || 'Estudiante',
    }));
  }

  // ─── EQUIPOS ───────────────────────────────────────────────────────────────

  /** Docente arma un equipo: nombre/identidad + miembros (matriculados del aula). */
  async createTeam(institutionId: string, userId: string, dto: {
    projectId: string; name: string; emoji?: string; color?: string;
    problem?: string; memberEnrollmentIds: string[];
  }) {
    if (!dto.name?.trim()) throw new BadRequestException('El nombre del equipo es obligatorio');
    await this.assertProjectOwner(dto.projectId, institutionId, userId);

    const memberIds = [...new Set(dto.memberEnrollmentIds || [])];
    if (memberIds.length === 0) throw new BadRequestException('Asigna al menos un integrante');

    // Un alumno no puede estar en dos equipos del mismo proyecto.
    const taken = await this.prisma.abpTeamMember.findMany({
      where: { studentEnrollmentId: { in: memberIds }, team: { projectId: dto.projectId } },
      select: { studentEnrollmentId: true },
    });
    if (taken.length > 0) {
      throw new BadRequestException('Uno o más estudiantes ya están en otro equipo de este proyecto');
    }

    return this.prisma.abpTeam.create({
      data: {
        institutionId,
        projectId: dto.projectId,
        name: dto.name.trim(),
        emoji: dto.emoji || '🚀',
        color: dto.color || '#0E4A5A',
        problem: dto.problem?.trim() || null,
        currentPhase: 1,
        members: { create: memberIds.map(id => ({ institutionId, studentEnrollmentId: id })) },
        // Estado inicial de las 6 fases: la 1 en curso, el resto bloqueadas.
        phaseStates: {
          create: Array.from({ length: ABP_PHASE_COUNT }, (_, i) => ({
            institutionId,
            phase: i + 1,
            status: i === 0 ? ('IN_PROGRESS' as const) : ('LOCKED' as const),
            startedAt: i === 0 ? new Date() : null,
          })),
        },
      },
      include: this.teamInclude(),
    });
  }

  async listTeams(projectId: string, institutionId: string) {
    return this.prisma.abpTeam.findMany({
      where: { projectId, institutionId },
      orderBy: { createdAt: 'asc' },
      include: this.teamInclude(),
    });
  }

  /** Elimina un equipo (docente dueño). */
  async deleteTeam(teamId: string, institutionId: string, userId: string) {
    const team = await this.prisma.abpTeam.findFirst({ where: { id: teamId, institutionId }, select: { projectId: true } });
    if (!team) throw new NotFoundException('Equipo no encontrado');
    await this.assertProjectOwner(team.projectId, institutionId, userId);
    await this.prisma.abpTeam.delete({ where: { id: teamId } });
    return { ok: true };
  }

  private teamInclude() {
    return {
      members: {
        include: {
          studentEnrollment: {
            include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
          },
        },
      },
      phaseStates: { orderBy: { phase: 'asc' as const } },
    };
  }
}
