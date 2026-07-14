import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { LearningIdentityService } from '../gamification/learning-identity.service';
import { ABP_PHASE_COUNT, resolvePhaseConfig, ABP_BADGE_ON_PHASE, ABP_XP, CANVAS_CARDS, phaseCriteriaMet, ABP_COEVAL_CRITERIA, rubricFor } from './abp.constants';

// ═══════════════════════════════════════════════════════════════════════════
// EXPEDICIÓN ABP — servicio. Ticket 1: crear proyecto, roster, armar equipos.
// Permisos: docente dueño del aula (teacherAssignment.teacherId === userId).
// Multi-tenant: todo filtrado y creado con institutionId.
// ═══════════════════════════════════════════════════════════════════════════

@Injectable()
export class AbpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: LearningIdentityService,
  ) {}

  /** XP individual a la identidad de aprendizaje del alumno (idempotente, nunca rompe). */
  private async awardStudentXp(institutionId: string, studentId: string | undefined, enrollmentId: string, amount: number, reason: string, key: string) {
    if (!studentId || amount <= 0) return;
    try {
      await this.identity.grantXp({ institutionId, studentId, studentEnrollmentId: enrollmentId, source: 'ABP' as any, amount, reason, idempotencyKey: key });
    } catch { /* la gamificación no puede romper el flujo del ABP */ }
  }

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
    // Otros equipos del proyecto (para la coevaluación de la Fase 6).
    const siblings = await this.prisma.abpTeam.findMany({
      where: { projectId, institutionId, id: { not: team.id } },
      select: { id: true, name: true, emoji: true },
      orderBy: { createdAt: 'asc' },
    });
    return {
      ...team,
      config: resolvePhaseConfig(team.project?.phaseConfig),
      myEnrollmentId: me?.enrollmentId ?? null,
      myVotesUsed,
      myVotedIds,
      siblings,
    };
  }

  private async loadTeamForUser(teamId: string, institutionId: string, userId: string) {
    const team = await this.prisma.abpTeam.findFirst({
      where: { id: teamId, institutionId },
      include: {
        members: {
          include: {
            studentEnrollment: { include: { student: { select: { id: true, userId: true, user: { select: { firstName: true, lastName: true } } } } } },
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

  /** El miembro (matrícula + nombre + studentId) que corresponde al usuario, o null si es docente. */
  private memberOf(team: any, userId: string): { enrollmentId: string; name: string; studentId: string } | null {
    const m = (team.members || []).find((x: any) => x.studentEnrollment.student.userId === userId);
    if (!m) return null;
    const u = m.studentEnrollment.student.user;
    return { enrollmentId: m.studentEnrollmentId, studentId: m.studentEnrollment.student.id, name: `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim() || 'Estudiante' };
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
        await this.awardStudentXp(institutionId, me.studentId, me.enrollmentId, ABP_XP.CANVAS_CARD, 'ABP · tarjeta del reto', `abp:canvas:${teamId}:${cardIndex}:${me.enrollmentId}`);
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
        await this.awardStudentXp(institutionId, me.studentId, me.enrollmentId, ABP_XP.IDEA, 'ABP · idea publicada', `abp:idea:${idea.id}`);
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
    await this.awardStudentXp(institutionId, me.studentId, me.enrollmentId, ABP_XP.VOTE, 'ABP · voto emitido', `abp:vote:${ideaId}:${me.enrollmentId}`);
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

  // ─── FASE 4: Plan de Acción (Kanban) ───────────────────────────────────────

  /** Agrega una tarea al tablero, asignada a un integrante. Columna inicial = Por hacer. */
  async addTask(teamId: string, institutionId: string, userId: string, text: string, ownerEnrollmentId: string) {
    const t = (text || '').trim();
    if (!t) throw new BadRequestException('La tarea no puede estar vacía');
    const team = await this.loadTeamForUser(teamId, institutionId, userId);
    const owner = (team.members as any[]).find(m => m.studentEnrollmentId === ownerEnrollmentId);
    if (!owner) throw new BadRequestException('El responsable debe ser un integrante del equipo');
    const ps = await this.prisma.abpPhaseState.findUnique({ where: { teamId_phase: { teamId, phase: 4 } } });
    if (!ps || ps.status !== 'IN_PROGRESS') throw new BadRequestException('La Fase 4 no está en curso');

    const ownerName = `${owner.studentEnrollment.student.user?.firstName ?? ''} ${owner.studentEnrollment.student.user?.lastName ?? ''}`.trim() || 'Integrante';
    const data: any = ps.data && typeof ps.data === 'object' ? { ...(ps.data as any) } : {};
    const tasks: any[] = Array.isArray(data.tasks) ? [...data.tasks] : [];
    tasks.push({ id: randomUUID(), text: t, owner: ownerEnrollmentId, ownerName, col: 0 });
    data.tasks = tasks;
    await this.prisma.abpPhaseState.update({ where: { teamId_phase: { teamId, phase: 4 } }, data: { data } });
    return this.prisma.abpPhaseState.findUnique({ where: { teamId_phase: { teamId, phase: 4 } } });
  }

  /** Avanza una tarea de columna (0→1→2). Al llegar a "Hecho" la 1ª vez: +20 XP +
   * contribución TASK_DONE atribuida a su responsable (dato de participación). */
  async moveTask(teamId: string, institutionId: string, userId: string, taskId: string) {
    const team = await this.loadTeamForUser(teamId, institutionId, userId);
    const ps = await this.prisma.abpPhaseState.findUnique({ where: { teamId_phase: { teamId, phase: 4 } } });
    if (!ps || ps.status !== 'IN_PROGRESS') throw new BadRequestException('La Fase 4 no está en curso');
    const data: any = ps.data && typeof ps.data === 'object' ? { ...(ps.data as any) } : {};
    const tasks: any[] = Array.isArray(data.tasks) ? data.tasks : [];
    const task = tasks.find(t => t.id === taskId);
    if (!task) throw new NotFoundException('Tarea no encontrada');
    if (task.col >= 2) return this.prisma.abpPhaseState.findUnique({ where: { teamId_phase: { teamId, phase: 4 } } });
    task.col += 1;
    await this.prisma.abpPhaseState.update({ where: { teamId_phase: { teamId, phase: 4 } }, data: { data } });
    if (task.col === 2 && task.owner) {
      try {
        await this.prisma.abpContribution.create({
          data: { institutionId, teamId, studentEnrollmentId: task.owner, phase: 4, type: 'TASK_DONE', refId: taskId, detail: `Terminó: ${String(task.text).slice(0, 60)}` },
        });
        await this.prisma.abpTeam.update({ where: { id: teamId }, data: { xp: { increment: ABP_XP.TASK_DONE } } });
        const ownerStudentId = (team.members as any[]).find(m => m.studentEnrollmentId === task.owner)?.studentEnrollment.student.id;
        await this.awardStudentXp(institutionId, ownerStudentId, task.owner, ABP_XP.TASK_DONE, 'ABP · tarea terminada', `abp:task:${taskId}`);
      } catch { /* idempotente */ }
    }
    return this.prisma.abpPhaseState.findUnique({ where: { teamId_phase: { teamId, phase: 4 } } });
  }

  /** Elimina una tarea del tablero. */
  async removeTask(teamId: string, institutionId: string, userId: string, taskId: string) {
    const team = await this.loadTeamForUser(teamId, institutionId, userId);
    const ps = await this.prisma.abpPhaseState.findUnique({ where: { teamId_phase: { teamId, phase: 4 } } });
    if (!ps) throw new NotFoundException('Fase no encontrada');
    const data: any = ps.data && typeof ps.data === 'object' ? { ...(ps.data as any) } : {};
    data.tasks = (Array.isArray(data.tasks) ? data.tasks : []).filter((t: any) => t.id !== taskId);
    await this.prisma.abpPhaseState.update({ where: { teamId_phase: { teamId, phase: 4 } }, data: { data } });
    return this.prisma.abpPhaseState.findUnique({ where: { teamId_phase: { teamId, phase: 4 } } });
  }

  // ─── FASE 5: Prototipo y Evidencias ────────────────────────────────────────

  /** Agrega una evidencia (enlace externo o archivo ya subido a storage). +15 XP +
   * contribución EVIDENCE. `kind`: 'LINK' | 'FILE'; `url` = enlace o path de storage. */
  async addEvidence(teamId: string, institutionId: string, userId: string, kind: string, url: string, label?: string) {
    const u = (url || '').trim();
    if (!u) throw new BadRequestException('Falta el enlace o archivo de la evidencia');
    const team = await this.loadTeamForUser(teamId, institutionId, userId);
    const ps = await this.prisma.abpPhaseState.findUnique({ where: { teamId_phase: { teamId, phase: 5 } } });
    if (!ps || ps.status !== 'IN_PROGRESS') throw new BadRequestException('La Fase 5 no está en curso');

    const me = this.memberOf(team, userId);
    const data: any = ps.data && typeof ps.data === 'object' ? { ...(ps.data as any) } : {};
    const evidences: any[] = Array.isArray(data.evidences) ? [...data.evidences] : [];
    const ev = { id: randomUUID(), kind: kind === 'FILE' ? 'FILE' : 'LINK', url: u, label: (label || '').trim() || u, by: me?.enrollmentId ?? null, byName: me?.name ?? 'Docente' };
    evidences.push(ev);
    data.evidences = evidences;
    await this.prisma.abpPhaseState.update({ where: { teamId_phase: { teamId, phase: 5 } }, data: { data } });

    if (me?.enrollmentId) {
      try {
        await this.prisma.abpContribution.create({
          data: { institutionId, teamId, studentEnrollmentId: me.enrollmentId, phase: 5, type: 'EVIDENCE', refId: ev.id, detail: ev.label.slice(0, 80) },
        });
        await this.prisma.abpTeam.update({ where: { id: teamId }, data: { xp: { increment: ABP_XP.EVIDENCE } } });
        await this.awardStudentXp(institutionId, me.studentId, me.enrollmentId, ABP_XP.EVIDENCE, 'ABP · evidencia subida', `abp:evidence:${ev.id}`);
      } catch { /* idempotente */ }
    }
    return this.prisma.abpPhaseState.findUnique({ where: { teamId_phase: { teamId, phase: 5 } } });
  }

  /** Elimina una evidencia del listado. */
  async removeEvidence(teamId: string, institutionId: string, userId: string, evidenceId: string) {
    await this.loadTeamForUser(teamId, institutionId, userId);
    const ps = await this.prisma.abpPhaseState.findUnique({ where: { teamId_phase: { teamId, phase: 5 } } });
    if (!ps) throw new NotFoundException('Fase no encontrada');
    const data: any = ps.data && typeof ps.data === 'object' ? { ...(ps.data as any) } : {};
    data.evidences = (Array.isArray(data.evidences) ? data.evidences : []).filter((e: any) => e.id !== evidenceId);
    await this.prisma.abpPhaseState.update({ where: { teamId_phase: { teamId, phase: 5 } }, data: { data } });
    return this.prisma.abpPhaseState.findUnique({ where: { teamId_phase: { teamId, phase: 5 } } });
  }

  // ─── FASE 6: Coevaluación ──────────────────────────────────────────────────

  /** El equipo evalúa a OTRO equipo del proyecto con la rúbrica (escala 1–4).
   * Una coevaluación por (equipo evaluador → equipo evaluado); se puede reeditar. */
  async submitCoeval(teamId: string, institutionId: string, userId: string, targetTeamId: string, scores: number[]) {
    const team = await this.loadTeamForUser(teamId, institutionId, userId);
    if (targetTeamId === teamId) throw new BadRequestException('Un equipo no se evalúa a sí mismo');
    const target = await this.prisma.abpTeam.findFirst({ where: { id: targetTeamId, institutionId, projectId: team.projectId }, select: { id: true } });
    if (!target) throw new BadRequestException('Equipo a evaluar no encontrado en este proyecto');
    const ps = await this.prisma.abpPhaseState.findUnique({ where: { teamId_phase: { teamId, phase: 6 } } });
    if (!ps || ps.status !== 'IN_PROGRESS') throw new BadRequestException('La Fase 6 no está en curso');

    const clean = (Array.isArray(scores) ? scores : []).slice(0, ABP_COEVAL_CRITERIA.length).map(n => Math.max(1, Math.min(4, Math.round(Number(n) || 1))));
    if (clean.length < ABP_COEVAL_CRITERIA.length) throw new BadRequestException('Faltan criterios por calificar');
    const me = this.memberOf(team, userId);
    const data: any = ps.data && typeof ps.data === 'object' ? { ...(ps.data as any) } : {};
    const coevals: any = { ...(data.coevals || {}) };
    coevals[targetTeamId] = { scores: clean, by: me?.enrollmentId ?? null, byName: me?.name ?? 'Docente' };
    data.coevals = coevals;
    await this.prisma.abpPhaseState.update({ where: { teamId_phase: { teamId, phase: 6 } }, data: { data } });

    if (me?.enrollmentId) {
      try {
        await this.prisma.abpContribution.create({
          data: { institutionId, teamId, studentEnrollmentId: me.enrollmentId, phase: 6, type: 'COEVAL', refId: targetTeamId, detail: `Coevaluó a un equipo (${clean.join('/')})` },
        });
      } catch { /* idempotente: ya coevaluó a ese equipo */ }
    }
    return this.getMyTeam(team.projectId, institutionId, userId);
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
    const memberIds = (team.members as any[]).map(m => m.studentEnrollmentId);
    if (!phaseCriteriaMet(phase, ps.data, resolvePhaseConfig(project?.phaseConfig), memberIds)) {
      throw new BadRequestException('Aún no se cumplen los criterios de esta fase');
    }
    // Fase 6: debe haber coevaluado a todos los demás equipos del proyecto.
    if (phase === 6) {
      const siblings = await this.prisma.abpTeam.count({ where: { projectId: team.projectId, institutionId, id: { not: teamId } } });
      const done = Object.keys(((ps.data as any)?.coevals) || {}).length;
      if (siblings > 0 && done < siblings) {
        throw new BadRequestException('Faltan equipos por coevaluar');
      }
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

  /** Docente resuelve una validación: aprueba (rúbrica OBLIGATORIA → desbloquea siguiente +
   * XP + insignia) o devuelve con retroalimentación (la fase vuelve a en curso). */
  async resolveValidation(validationId: string, institutionId: string, userId: string, action: 'approve' | 'return', feedback?: string, rubricScores?: number[], rubricComment?: string) {
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

    // approve — rúbrica obligatoria: todos los criterios de la fase puntuados 1–4.
    const project = await this.prisma.abpProject.findUnique({ where: { id: vr.team.projectId }, select: { phaseConfig: true } });
    const criteria = rubricFor(vr.phase, project?.phaseConfig);
    const scores = (Array.isArray(rubricScores) ? rubricScores : []).map(n => Math.round(Number(n)));
    if (scores.length < criteria.length || scores.some(n => !(n >= 1 && n <= 4))) {
      throw new BadRequestException('Puntúa los criterios de la rúbrica (1–4) para aprobar');
    }

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
    // Hito de equipo: XP individual a cada integrante por la fase validada.
    const memberXp = Math.round(ABP_XP.PHASE_VALIDATED / 2);
    const members = await this.prisma.abpTeamMember.findMany({
      where: { teamId: vr.teamId },
      select: { studentEnrollmentId: true, studentEnrollment: { select: { studentId: true } } },
    });
    for (const m of members) {
      await this.awardStudentXp(institutionId, m.studentEnrollment.studentId, m.studentEnrollmentId, memberXp, `ABP · Fase ${vr.phase} validada`, `abp:phase:${vr.teamId}:${vr.phase}:${m.studentEnrollmentId}`);
    }
    return this.prisma.abpValidationRequest.update({
      where: { id: vr.id },
      data: { status: 'APPROVED', resolvedAt: now, rubricScores: scores.slice(0, criteria.length), rubricComment: (rubricComment || '').trim() || null },
    });
  }

  // ─── PANTALLA DE REVISIÓN + COMENTARIOS (Ticket 9) ─────────────────────────

  /** Descripción legible de los criterios automáticos de una fase (met + label). */
  private criteriaDetails(phase: number, data: any, config: any, memberIds: string[]): { label: string; met: boolean }[] {
    const d = data || {};
    if (phase === 1) {
      const filled = (d.canvas || []).filter((c: any) => c && String(c.value || '').trim()).length;
      return [{ label: `Tarjetas completas ${filled}/${config.minCanvasCards}`, met: filled >= config.minCanvasCards }];
    }
    if (phase === 2) {
      const ideas = d.ideas || []; const votes = ideas.reduce((s: number, i: any) => s + (i.votes || 0), 0);
      const min = config.minIdeasPerMember * (memberIds.length || 1);
      return [
        { label: `Ideas ${ideas.length}/${min}`, met: ideas.length >= min },
        { label: `Votos emitidos ${votes}`, met: votes >= (memberIds.length || 1) },
      ];
    }
    if (phase === 3) {
      const s = d.smart || {}; const ck = (s.checks || []).filter(Boolean).length;
      return [
        { label: `Criterios SMART ${ck}/${config.smartCriteria}`, met: ck >= config.smartCriteria },
        { label: 'Objetivo redactado', met: String(s.text || '').trim().length >= config.minObjectiveLength },
      ];
    }
    if (phase === 4) {
      const tasks = d.tasks || []; const done = tasks.filter((t: any) => t.col === 2).length;
      const owners = new Set(tasks.map((t: any) => t.owner));
      return [
        { label: `Tareas terminadas ${done}/${tasks.length}`, met: tasks.length > 0 && done === tasks.length },
        { label: 'Cada integrante con tarea', met: memberIds.length > 0 && memberIds.every(id => owners.has(id)) },
      ];
    }
    if (phase === 5) {
      const ev = d.evidences || [];
      return [{ label: `Evidencias ${ev.length}/${config.minEvidences}`, met: ev.length >= config.minEvidences }];
    }
    if (phase === 6) {
      const co = Object.keys(d.coevals || {}).length;
      return [{ label: `Equipos coevaluados ${co}`, met: true }];
    }
    return [];
  }

  /** Payload para la pantalla de revisión del docente (una validación pendiente). */
  async getReview(validationId: string, institutionId: string, userId: string) {
    const vr = await this.prisma.abpValidationRequest.findFirst({
      where: { id: validationId, institutionId },
      include: { team: { include: { ...this.teamInclude(), project: { select: { id: true, title: true, phaseConfig: true } } } } },
    });
    if (!vr) throw new NotFoundException('Solicitud no encontrada');
    await this.assertProjectOwner(vr.team.projectId, institutionId, userId);
    const ps = await this.prisma.abpPhaseState.findUnique({ where: { teamId_phase: { teamId: vr.teamId, phase: vr.phase } } });
    const config = resolvePhaseConfig(vr.team.project?.phaseConfig);
    const memberIds = (vr.team.members as any[]).map(m => m.studentEnrollmentId);
    const comments = await this.listComments(vr.teamId, vr.phase, institutionId, userId);
    return {
      validationId: vr.id,
      status: vr.status,
      team: { id: vr.team.id, name: vr.team.name, emoji: vr.team.emoji, color: vr.team.color, problem: vr.team.problem, members: (vr.team.members as any[]).map(m => this.memberName(m)) },
      phase: vr.phase,
      phaseData: ps?.data ?? {},
      phaseStatus: ps?.status,
      startedAt: ps?.startedAt, submittedAt: ps?.submittedAt,
      criteria: this.criteriaDetails(vr.phase, ps?.data, config, memberIds),
      rubricCriteria: rubricFor(vr.phase, vr.team.project?.phaseConfig),
      comments,
    };
  }

  private memberName(m: any): string {
    const u = m.studentEnrollment?.student?.user;
    return `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim() || 'Integrante';
  }

  /** Comentarios de una fase (docente ↔ equipo). Docente dueño o miembro. */
  async listComments(teamId: string, phase: number, institutionId: string, userId: string) {
    await this.loadTeamForUser(teamId, institutionId, userId);
    const ps = await this.prisma.abpPhaseState.findUnique({ where: { teamId_phase: { teamId, phase } }, select: { id: true } });
    if (!ps) return [];
    return this.prisma.abpComment.findMany({
      where: { phaseStateId: ps.id, institutionId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, refType: true, refId: true, authorName: true, authorRole: true, content: true, resolved: true, parentId: true, createdAt: true },
    });
  }

  /** Agrega un comentario (docente o estudiante). Autor dual: estudiante o docente. */
  async addComment(teamId: string, institutionId: string, userId: string, phase: number, refType: string, refId: string | null, content: string, parentId?: string) {
    const c = (content || '').trim();
    if (!c) throw new BadRequestException('El comentario no puede estar vacío');
    const team = await this.loadTeamForUser(teamId, institutionId, userId);
    const ps = await this.prisma.abpPhaseState.findUnique({ where: { teamId_phase: { teamId, phase } }, select: { id: true } });
    if (!ps) throw new NotFoundException('Fase no encontrada');
    const me = this.memberOf(team, userId);
    const isTeacher = !me;
    return this.prisma.abpComment.create({
      data: {
        institutionId, teamId, phaseStateId: ps.id,
        refType: (['CANVAS_CARD', 'IDEA', 'TASK', 'EVIDENCE', 'COEVAL', 'PHASE'].includes(refType) ? refType : 'PHASE') as any,
        refId: refId || null,
        authorStudentEnrollmentId: me?.enrollmentId ?? null,
        authorUserId: isTeacher ? userId : null,
        authorName: me?.name ?? 'Docente',
        authorRole: isTeacher ? 'DOCENTE' : 'ESTUDIANTE',
        content: c,
        parentId: parentId || null,
      },
      select: { id: true, refType: true, refId: true, authorName: true, authorRole: true, content: true, resolved: true, parentId: true, createdAt: true },
    });
  }

  /** Marca un comentario como resuelto / sin resolver. */
  async resolveComment(commentId: string, institutionId: string, userId: string, resolved: boolean) {
    const cm = await this.prisma.abpComment.findFirst({ where: { id: commentId, institutionId }, select: { id: true, teamId: true } });
    if (!cm) throw new NotFoundException('Comentario no encontrado');
    await this.loadTeamForUser(cm.teamId, institutionId, userId);
    return this.prisma.abpComment.update({ where: { id: commentId }, data: { resolved }, select: { id: true, resolved: true } });
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
