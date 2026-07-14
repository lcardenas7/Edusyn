import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ABP_PHASE_COUNT, resolvePhaseConfig, ABP_BADGE_ON_PHASE, ABP_XP, CANVAS_CARDS, phaseCriteriaMet } from './abp.constants';

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

  // ─── ESTUDIANTE: su equipo ─────────────────────────────────────────────────

  /** El equipo del estudiante autenticado en un proyecto (enriquecido con su config
   * y los votos que ya usó en la Fase 2), o null si no tiene equipo. */
  async getMyTeam(projectId: string, institutionId: string, userId: string) {
    const team = await this.prisma.abpTeam.findFirst({
      where: { projectId, institutionId, members: { some: { studentEnrollment: { student: { userId } } } } },
      include: { ...this.teamInclude(), project: { select: { id: true, title: true, challenge: true, phaseConfig: true } } },
    });
    if (!team) return null;
    const me = this.memberOf(team, userId);
    let myVotesUsed = 0;
    let myVotedIds: string[] = [];
    if (me?.enrollmentId) {
      const votes = await this.prisma.abpContribution.findMany({
        where: { teamId: team.id, phase: 2, type: 'VOTE', studentEnrollmentId: me.enrollmentId },
        select: { refId: true },
      });
      myVotesUsed = votes.length;
      myVotedIds = votes.map(v => v.refId).filter(Boolean) as string[];
    }
    return {
      ...team,
      config: resolvePhaseConfig(team.project?.phaseConfig),
      myEnrollmentId: me?.enrollmentId ?? null,
      myVotesUsed,
      myVotedIds,
    };
  }

  private async loadTeamForUser(teamId: string, institutionId: string, userId: string) {
    const team = await this.prisma.abpTeam.findFirst({
      where: { id: teamId, institutionId },
      include: {
        members: {
          include: {
            studentEnrollment: { include: { student: { select: { userId: true, user: { select: { firstName: true, lastName: true } } } } } },
          },
        },
      },
    });
    if (!team) throw new NotFoundException('Equipo no encontrado');
    const isMember = team.members.some(m => m.studentEnrollment.student.userId === userId);
    if (!isMember) {
      // Permitir también al docente dueño (para pruebas/gestión).
      await this.assertProjectOwner(team.projectId, institutionId, userId);
    }
    return team;
  }

  /** El miembro (matrícula + nombre) que corresponde al usuario, o null si es docente. */
  private memberOf(team: any, userId: string): { enrollmentId: string; name: string } | null {
    const m = (team.members || []).find((x: any) => x.studentEnrollment.student.userId === userId);
    if (!m) return null;
    const u = m.studentEnrollment.student.user;
    return { enrollmentId: m.studentEnrollmentId, name: `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim() || 'Estudiante' };
  }

  // ─── FASE 1: Canvas del Problema ───────────────────────────────────────────

  /** Guarda una tarjeta del canvas (0–3). Registra autor + contribución + XP la
   * primera vez que se llena. Editar después no re-registra (el autor es el primero). */
  async saveCanvasCard(teamId: string, institutionId: string, userId: string, cardIndex: number, value: string) {
    if (cardIndex < 0 || cardIndex >= CANVAS_CARDS.length) throw new BadRequestException('Tarjeta inválida');
    const team = await this.loadTeamForUser(teamId, institutionId, userId);
    const ps = await this.prisma.abpPhaseState.findUnique({ where: { teamId_phase: { teamId, phase: 1 } } });
    if (!ps || ps.status !== 'IN_PROGRESS') throw new BadRequestException('La Fase 1 no está en curso');

    const data: any = ps.data && typeof ps.data === 'object' ? { ...(ps.data as any) } : {};
    const canvas: any[] = Array.isArray(data.canvas) ? [...data.canvas] : [];
    while (canvas.length < CANVAS_CARDS.length) canvas.push(null);
    const prev = canvas[cardIndex];
    const wasFilled = !!(prev && String(prev.value || '').trim());
    const me = this.memberOf(team, userId);

    canvas[cardIndex] = wasFilled
      ? { value, by: prev.by ?? null, byName: prev.byName ?? null } // conserva el autor original
      : { value, by: me?.enrollmentId ?? null, byName: me?.name ?? 'Docente' };
    data.canvas = canvas;
    await this.prisma.abpPhaseState.update({ where: { teamId_phase: { teamId, phase: 1 } }, data: { data } });

    // Primera vez que se llena, con autor estudiante → contribución + XP de equipo.
    if (!wasFilled && value.trim() && me?.enrollmentId) {
      try {
        await this.prisma.abpContribution.create({
          data: { institutionId, teamId, studentEnrollmentId: me.enrollmentId, phase: 1, type: 'CANVAS_CARD', refId: String(cardIndex), detail: `Completó: ${CANVAS_CARDS[cardIndex].q}` },
        });
        await this.prisma.abpTeam.update({ where: { id: teamId }, data: { xp: { increment: ABP_XP.CANVAS_CARD } } });
      } catch { /* @@unique → ya contó, idempotente */ }
    }
    return this.prisma.abpPhaseState.findUnique({ where: { teamId_phase: { teamId, phase: 1 } } });
  }

  // ─── FASE 2: Tormenta de Ideas ─────────────────────────────────────────────

  /** Publica una idea en el muro → +15 XP + contribución IDEA. */
  async addIdea(teamId: string, institutionId: string, userId: string, text: string) {
    const t = (text || '').trim();
    if (!t) throw new BadRequestException('La idea no puede estar vacía');
    const team = await this.loadTeamForUser(teamId, institutionId, userId);
    const ps = await this.prisma.abpPhaseState.findUnique({ where: { teamId_phase: { teamId, phase: 2 } } });
    if (!ps || ps.status !== 'IN_PROGRESS') throw new BadRequestException('La Fase 2 no está en curso');

    const me = this.memberOf(team, userId);
    const data: any = ps.data && typeof ps.data === 'object' ? { ...(ps.data as any) } : {};
    const ideas: any[] = Array.isArray(data.ideas) ? [...data.ideas] : [];
    const idea = { id: randomUUID(), text: t, by: me?.enrollmentId ?? null, byName: me?.name ?? 'Docente', votes: 0 };
    ideas.push(idea);
    data.ideas = ideas;
    await this.prisma.abpPhaseState.update({ where: { teamId_phase: { teamId, phase: 2 } }, data: { data } });

    if (me?.enrollmentId) {
      try {
        await this.prisma.abpContribution.create({
          data: { institutionId, teamId, studentEnrollmentId: me.enrollmentId, phase: 2, type: 'IDEA', refId: idea.id, detail: t.slice(0, 80) },
        });
        await this.prisma.abpTeam.update({ where: { id: teamId }, data: { xp: { increment: ABP_XP.IDEA } } });
      } catch { /* idempotente */ }
    }
    return this.getMyTeam(team.projectId, institutionId, userId);
  }

  /** Vota una idea. Cada voto = UNA fila AbpContribution(VOTE) (dato de participación).
   * Reglas: no votar la propia; máximo config.votesPerStudent; no votar dos veces la misma. */
  async voteIdea(teamId: string, institutionId: string, userId: string, ideaId: string) {
    const team = await this.loadTeamForUser(teamId, institutionId, userId);
    const me = this.memberOf(team, userId);
    if (!me?.enrollmentId) throw new ForbiddenException('Solo los integrantes del equipo pueden votar');
    const ps = await this.prisma.abpPhaseState.findUnique({ where: { teamId_phase: { teamId, phase: 2 } } });
    if (!ps || ps.status !== 'IN_PROGRESS') throw new BadRequestException('La Fase 2 no está en curso');

    const data: any = ps.data && typeof ps.data === 'object' ? { ...(ps.data as any) } : {};
    const ideas: any[] = Array.isArray(data.ideas) ? data.ideas : [];
    const idea = ideas.find(i => i.id === ideaId);
    if (!idea) throw new NotFoundException('Idea no encontrada');
    if (idea.by === me.enrollmentId) throw new BadRequestException('No puedes votar tu propia idea');

    const project = await this.prisma.abpProject.findUnique({ where: { id: team.projectId }, select: { phaseConfig: true } });
    const config = resolvePhaseConfig(project?.phaseConfig);
    const used = await this.prisma.abpContribution.count({ where: { teamId, phase: 2, type: 'VOTE', studentEnrollmentId: me.enrollmentId } });
    if (used >= config.votesPerStudent) throw new BadRequestException('Ya usaste todos tus votos');

    // El @@unique(studentEnrollmentId,type,refId) impide votar dos veces la misma idea.
    try {
      await this.prisma.abpContribution.create({
        data: { institutionId, teamId, studentEnrollmentId: me.enrollmentId, phase: 2, type: 'VOTE', refId: ideaId, detail: `Votó: ${String(idea.text).slice(0, 60)}` },
      });
    } catch {
      throw new BadRequestException('Ya votaste esta idea');
    }
    idea.votes = (idea.votes || 0) + 1;
    await this.prisma.abpPhaseState.update({ where: { teamId_phase: { teamId, phase: 2 } }, data: { data } });
    await this.prisma.abpTeam.update({ where: { id: teamId }, data: { xp: { increment: ABP_XP.VOTE } } });
    return this.getMyTeam(team.projectId, institutionId, userId);
  }

  // ─── FASE 3: Objetivo SMART ────────────────────────────────────────────────

  /** Guarda el objetivo del equipo + los 5 criterios SMART (campo colaborativo). */
  async saveSmart(teamId: string, institutionId: string, userId: string, text: string, checks: boolean[]) {
    const team = await this.loadTeamForUser(teamId, institutionId, userId);
    const ps = await this.prisma.abpPhaseState.findUnique({ where: { teamId_phase: { teamId, phase: 3 } } });
    if (!ps || ps.status !== 'IN_PROGRESS') throw new BadRequestException('La Fase 3 no está en curso');
    const me = this.memberOf(team, userId);
    const prev: any = ps.data && typeof ps.data === 'object' ? (ps.data as any).smart : null;
    const data: any = ps.data && typeof ps.data === 'object' ? { ...(ps.data as any) } : {};
    data.smart = {
      text: String(text || ''),
      checks: Array.isArray(checks) ? checks.slice(0, 5).map(Boolean) : [],
      by: me?.enrollmentId ?? prev?.by ?? null,
      byName: me?.name ?? prev?.byName ?? null,
    };
    await this.prisma.abpPhaseState.update({ where: { teamId_phase: { teamId, phase: 3 } }, data: { data } });
    return this.prisma.abpPhaseState.findUnique({ where: { teamId_phase: { teamId, phase: 3 } } });
  }

  // ─── VALIDACIÓN (gating de fases) ──────────────────────────────────────────

  /** El equipo solicita validar su fase actual → AWAITING + solicitud PENDING.
   * Se exige que se cumplan los criterios automáticos de la fase. */
  async requestValidation(teamId: string, institutionId: string, userId: string) {
    const team = await this.loadTeamForUser(teamId, institutionId, userId);
    const phase = team.currentPhase;
    const ps = await this.prisma.abpPhaseState.findUnique({ where: { teamId_phase: { teamId, phase } } });
    if (!ps || ps.status !== 'IN_PROGRESS') {
      throw new BadRequestException('La fase actual no está en curso');
    }
    const project = await this.prisma.abpProject.findUnique({ where: { id: team.projectId }, select: { phaseConfig: true } });
    if (!phaseCriteriaMet(phase, ps.data, resolvePhaseConfig(project?.phaseConfig), team.members.length)) {
      throw new BadRequestException('Aún no se cumplen los criterios de esta fase');
    }
    await this.prisma.abpPhaseState.update({
      where: { teamId_phase: { teamId, phase } },
      data: { status: 'AWAITING', submittedAt: new Date(), feedback: null },
    });
    // Evita duplicar solicitud pendiente.
    const existing = await this.prisma.abpValidationRequest.findFirst({ where: { teamId, phase, status: 'PENDING' } });
    if (existing) return existing;
    return this.prisma.abpValidationRequest.create({
      data: { institutionId, teamId, phase, status: 'PENDING' },
    });
  }

  /** Cola de validaciones pendientes de las aulas del docente (opcional: por aula). */
  async getQueue(institutionId: string, userId: string, classroomId?: string) {
    const requests = await this.prisma.abpValidationRequest.findMany({
      where: {
        institutionId,
        status: 'PENDING',
        team: {
          project: {
            classroomId: classroomId || undefined,
            classroom: { teacherAssignment: { teacherId: userId } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        team: { select: { id: true, name: true, emoji: true, color: true, projectId: true } },
      },
    });
    return requests;
  }

  /** Docente resuelve una validación: aprueba (desbloquea siguiente + XP + insignia)
   * o devuelve con retroalimentación (la fase vuelve a en curso mostrando el comentario). */
  async resolveValidation(validationId: string, institutionId: string, userId: string, action: 'approve' | 'return', feedback?: string) {
    const vr = await this.prisma.abpValidationRequest.findFirst({
      where: { id: validationId, institutionId, status: 'PENDING' },
      include: { team: { select: { id: true, projectId: true, currentPhase: true, xp: true, badges: true } } },
    });
    if (!vr) throw new NotFoundException('Solicitud no encontrada');
    await this.assertProjectOwner(vr.team.projectId, institutionId, userId);

    if (action === 'return') {
      const fb = (feedback || '').trim() || 'Revisen los criterios de la fase y vuelvan a enviar.';
      await this.prisma.abpPhaseState.update({
        where: { teamId_phase: { teamId: vr.teamId, phase: vr.phase } },
        data: { status: 'IN_PROGRESS', feedback: fb, submittedAt: null },
      });
      return this.prisma.abpValidationRequest.update({
        where: { id: vr.id }, data: { status: 'RETURNED', feedback: fb, resolvedAt: new Date() },
      });
    }

    // approve
    const now = new Date();
    await this.prisma.abpPhaseState.update({
      where: { teamId_phase: { teamId: vr.teamId, phase: vr.phase } },
      data: { status: 'VALIDATED', validatedAt: now, feedback: null },
    });
    const badge = ABP_BADGE_ON_PHASE[vr.phase];
    const nextPhase = vr.phase < ABP_PHASE_COUNT ? vr.phase + 1 : vr.phase;
    if (vr.phase < ABP_PHASE_COUNT) {
      await this.prisma.abpPhaseState.update({
        where: { teamId_phase: { teamId: vr.teamId, phase: nextPhase } },
        data: { status: 'IN_PROGRESS', startedAt: now },
      });
    }
    await this.prisma.abpTeam.update({
      where: { id: vr.teamId },
      data: {
        currentPhase: nextPhase,
        xp: { increment: ABP_XP.PHASE_VALIDATED },
        badges: badge && !vr.team.badges.includes(badge) ? { set: [...vr.team.badges, badge] } : undefined,
      },
    });
    return this.prisma.abpValidationRequest.update({
      where: { id: vr.id }, data: { status: 'APPROVED', resolvedAt: now },
    });
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
