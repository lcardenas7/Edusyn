import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { LearningIdentityService } from '../gamification/learning-identity.service';
import { ApdAiService } from '../apd/ai/apd-ai.service';
import { AiOrchestratorService } from '../apd/ai/ai-orchestrator.service';
import { ABP_PHASE_COUNT, ABP_PHASES, resolvePhaseConfig, ABP_BADGE_ON_PHASE, ABP_XP, CANVAS_CARDS, phaseCriteriaMet, ABP_COEVAL_CRITERIA, rubricFor, MISSION_TEMPLATES, toolCriterionMet } from './abp.constants';

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
    private readonly apdAi: ApdAiService,
    private readonly orchestrator: AiOrchestratorService,
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

  // ─── PORTADA / PRESENTACIÓN (Nivel 1) ──────────────────────────────────────

  private normalizePresentation(p: any) {
    if (!p || typeof p !== 'object') return null;
    const str = (v: any) => (typeof v === 'string' ? v.trim() : '');
    const arr = (v: any) => (Array.isArray(v) ? v.map((x: any) => str(x)).filter(Boolean) : []);
    return {
      banner: str(p.banner),
      videoUrl: str(p.videoUrl),
      teacherMessage: str(p.teacherMessage),
      context: str(p.context),
      why: str(p.why),
      instructions: arr(p.instructions),
      skills: arr(p.skills),
      rules: arr(p.rules),
      timeline: Array.isArray(p.timeline)
        ? p.timeline.map((t: any) => ({ label: str(t?.label), detail: str(t?.detail) })).filter((t: any) => t.label || t.detail)
        : [],
      faq: Array.isArray(p.faq)
        ? p.faq.map((f: any) => ({ q: str(f?.q), a: str(f?.a) })).filter((f: any) => f.q || f.a)
        : [],
    };
  }

  // ─── RECURSOS + ANUNCIOS (Nivel 1) ──────────────────────────────────────────

  async listResources(projectId: string, institutionId: string) {
    return this.prisma.abpResource.findMany({
      where: { projectId, institutionId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async addResource(projectId: string, institutionId: string, userId: string, dto: { type?: string; title: string; url: string; description?: string }) {
    await this.assertProjectOwner(projectId, institutionId, userId);
    if (!dto.title?.trim() || !dto.url?.trim()) throw new BadRequestException('El título y el enlace son obligatorios');
    const valid = ['PDF', 'VIDEO', 'LINK', 'DOC', 'OTHER'];
    const max = await this.prisma.abpResource.aggregate({ where: { projectId }, _max: { sortOrder: true } });
    return this.prisma.abpResource.create({
      data: {
        institutionId, projectId,
        type: (valid.includes(dto.type || '') ? dto.type : 'LINK') as any,
        title: dto.title.trim(), url: dto.url.trim(), description: dto.description?.trim() || null,
        sortOrder: (max._max.sortOrder ?? 0) + 100,
      },
    });
  }

  async deleteResource(resourceId: string, institutionId: string, userId: string) {
    const r = await this.prisma.abpResource.findFirst({ where: { id: resourceId, institutionId }, select: { projectId: true } });
    if (!r) throw new NotFoundException('Recurso no encontrado');
    await this.assertProjectOwner(r.projectId, institutionId, userId);
    await this.prisma.abpResource.delete({ where: { id: resourceId } });
    return { ok: true };
  }

  async listAnnouncements(projectId: string, institutionId: string) {
    return this.prisma.abpAnnouncement.findMany({
      where: { projectId, institutionId },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async addAnnouncement(projectId: string, institutionId: string, userId: string, dto: { content: string; pinned?: boolean }) {
    await this.assertProjectOwner(projectId, institutionId, userId);
    if (!dto.content?.trim()) throw new BadRequestException('El anuncio no puede estar vacío');
    return this.prisma.abpAnnouncement.create({
      data: { institutionId, projectId, content: dto.content.trim(), pinned: !!dto.pinned, authorUserId: userId },
    });
  }

  async setAnnouncementPin(announcementId: string, institutionId: string, userId: string, pinned: boolean) {
    const a = await this.prisma.abpAnnouncement.findFirst({ where: { id: announcementId, institutionId }, select: { projectId: true } });
    if (!a) throw new NotFoundException('Anuncio no encontrado');
    await this.assertProjectOwner(a.projectId, institutionId, userId);
    return this.prisma.abpAnnouncement.update({ where: { id: announcementId }, data: { pinned } });
  }

  async deleteAnnouncement(announcementId: string, institutionId: string, userId: string) {
    const a = await this.prisma.abpAnnouncement.findFirst({ where: { id: announcementId, institutionId }, select: { projectId: true } });
    if (!a) throw new NotFoundException('Anuncio no encontrado');
    await this.assertProjectOwner(a.projectId, institutionId, userId);
    await this.prisma.abpAnnouncement.delete({ where: { id: announcementId } });
    return { ok: true };
  }

  /** Docente actualiza la portada del proyecto (y opcionalmente el reto general). */
  async updatePresentation(projectId: string, institutionId: string, userId: string, dto: { challenge?: string; presentation?: any }) {
    await this.assertProjectOwner(projectId, institutionId, userId);
    const data: any = {};
    if (dto.challenge !== undefined) data.challenge = dto.challenge?.trim() || null;
    if (dto.presentation !== undefined) data.presentation = this.normalizePresentation(dto.presentation);
    const p = await this.prisma.abpProject.update({ where: { id: projectId }, data });
    return { ...p, phaseConfig: resolvePhaseConfig(p.phaseConfig) };
  }

  /** Lectura de la portada para el alumno (campos públicos del proyecto). */
  async getProjectForStudent(projectId: string, institutionId: string) {
    const p = await this.prisma.abpProject.findFirst({
      where: { id: projectId, institutionId },
      select: { id: true, title: true, challenge: true, presentation: true, startDate: true, endDate: true, status: true },
    });
    if (!p) throw new NotFoundException('Proyecto no encontrado');
    return p;
  }

  // ─── CENTRO DE OPERACIONES (docente) ───────────────────────────────────────

  /** Panel de progreso del proyecto: una fila por equipo + contadores globales.
   * Todo se calcula de datos existentes (sin schema nuevo). */
  async getProjectDashboard(projectId: string, institutionId: string, userId: string) {
    const project = await this.assertProjectOwner(projectId, institutionId, userId);
    const teams = await this.prisma.abpTeam.findMany({
      where: { projectId, institutionId },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { members: true } }, phaseStates: { orderBy: { phase: 'asc' } } },
    });
    const pending = await this.prisma.abpValidationRequest.findMany({
      where: { institutionId, status: 'PENDING', team: { projectId } },
      select: { teamId: true, phase: true },
    });
    const pendingTeamIds = new Set(pending.map(p => p.teamId));

    const rows = teams.map(t => {
      const states = t.phaseStates as any[];
      const validated = states.filter(s => s.status === 'VALIDATED').length;
      const curState = states.find(s => s.phase === t.currentPhase)?.status || 'LOCKED';
      const done = t.currentPhase === ABP_PHASE_COUNT && curState === 'VALIDATED';
      return {
        id: t.id, name: t.name, emoji: t.emoji, color: t.color,
        currentPhase: t.currentPhase, currentStatus: curState,
        validatedPhases: validated, progress: Math.round((validated / ABP_PHASE_COUNT) * 100),
        xp: t.xp, members: t._count.members,
        awaitingValidation: pendingTeamIds.has(t.id), done,
      };
    });
    // "Atrasados": equipos con fase actual por debajo del líder del pelotón.
    const maxPhase = rows.reduce((m, r) => Math.max(m, r.currentPhase), 0);
    const behind = rows.filter(r => !r.done && r.currentPhase < maxPhase).length;
    const students = rows.reduce((s, r) => s + r.members, 0);

    return {
      project: { id: project.id, title: project.title, challenge: project.challenge, startDate: project.startDate, endDate: project.endDate, status: project.status },
      summary: { teams: rows.length, students, pendingValidations: pending.length, behind },
      teams: rows,
    };
  }

  /** Preview de la expedición de un equipo para el docente dueño (sin filtro de
   * membresía). Devuelve las 6 fases con su data + misiones enriquecidas (lectura). */
  async getTeamExpedition(teamId: string, institutionId: string, userId: string) {
    const team = await this.prisma.abpTeam.findFirst({
      where: { id: teamId, institutionId },
      include: { ...this.teamInclude(), project: { select: { id: true, title: true, challenge: true, phaseConfig: true } } },
    });
    if (!team) throw new NotFoundException('Equipo no encontrado');
    await this.assertProjectOwner(team.projectId, institutionId, userId);

    const config = resolvePhaseConfig(team.project?.phaseConfig);
    const memberIds = (team.members as any[]).map(m => m.studentEnrollmentId);
    const phaseStates = await this.prisma.abpPhaseState.findMany({
      where: { teamId, institutionId },
      orderBy: { phase: 'asc' },
      include: { missions: { include: { activities: { orderBy: { sortOrder: 'asc' } } }, orderBy: { sortOrder: 'asc' } } },
    });
    for (const ps of phaseStates) await this.markLessonCompletion(ps.missions as any[], memberIds);
    const enrichedPhases = phaseStates.map(ps => {
      const missions = (ps.missions as any[]).map(m => ({ ...m, complete: this.missionComplete(m, ps.phase, ps.data, config, memberIds) }));
      const ready = missions.length > 0
        ? missions.filter(m => m.required).every(m => m.complete)
        : phaseCriteriaMet(ps.phase, ps.data, config, memberIds);
      return { ...ps, missions, ready };
    });
    const siblings = await this.prisma.abpTeam.findMany({
      where: { projectId: team.projectId, institutionId, id: { not: team.id } },
      select: { id: true, name: true, emoji: true }, orderBy: { createdAt: 'asc' },
    });
    return { ...team, config, phaseStates: enrichedPhases, siblings, preview: true };
  }

  // ─── ROSTER (matriculados del aula, para armar equipos) ─────────────────────

  async getRoster(classroomId: string, institutionId: string, userId: string, projectId?: string) {
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

    // Alumnos ya asignados a un equipo de ESTE proyecto: se marcan para que el
    // docente no los pueda seleccionar en otro equipo (createTeam ya lo rechaza,
    // pero aquí evitamos el error mostrándolos deshabilitados con su equipo).
    const assigned = new Map<string, string>();
    if (projectId) {
      const members = await this.prisma.abpTeamMember.findMany({
        where: { institutionId, team: { projectId } },
        select: { studentEnrollmentId: true, team: { select: { name: true, emoji: true } } },
      });
      for (const m of members) {
        assigned.set(m.studentEnrollmentId, `${m.team.emoji ?? ''} ${m.team.name}`.trim());
      }
    }

    return enrollments.map(e => ({
      enrollmentId: e.id,
      studentId: e.studentId,
      name: `${e.student.user?.firstName ?? ''} ${e.student.user?.lastName ?? ''}`.trim() || 'Estudiante',
      assignedTeamName: assigned.get(e.id) ?? null,
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

    const team = await this.prisma.abpTeam.create({
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
    // Siembra las misiones-plantilla de las 6 fases (Opción A: herramienta = misión por defecto).
    await this.seedMissions(team, institutionId);
    return team;
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
    // Misiones de la fase actual con su estado de completitud calculado (Opción A).
    const config = resolvePhaseConfig(team.project?.phaseConfig);
    const memberIds = (team.members as any[]).map(m => m.studentEnrollmentId);
    const curPs = await this.prisma.abpPhaseState.findUnique({
      where: { teamId_phase: { teamId: team.id, phase: team.currentPhase } },
      include: { missions: { include: { activities: { orderBy: { sortOrder: 'asc' } } }, orderBy: { sortOrder: 'asc' } } },
    });
    await this.markLessonCompletion((curPs?.missions as any[]) || [], memberIds);
    const currentMissions = ((curPs?.missions as any[]) || []).map(m => ({ ...m, complete: this.missionComplete(m, team.currentPhase, curPs!.data, config, memberIds) }));
    const readyForValidation = currentMissions.length > 0
      ? currentMissions.filter(m => m.required).every(m => m.complete)
      : phaseCriteriaMet(team.currentPhase, curPs?.data, config, memberIds);
    return {
      ...team,
      config,
      myEnrollmentId: me?.enrollmentId ?? null,
      myVotesUsed,
      myVotedIds,
      siblings,
      currentMissions,
      readyForValidation,
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

  // ─── MISIONES (V1: el trabajo real dentro de las fases-hito) ───────────────

  /** Siembra las misiones por defecto (plantilla) para las 6 fases de un equipo nuevo.
   * La 1ª misión de cada fase es la "misión-herramienta" (Opción A). */
  private async seedMissions(team: any, institutionId: string) {
    for (const ps of team.phaseStates || []) {
      const templates = MISSION_TEMPLATES[ps.phase] || [];
      for (let i = 0; i < templates.length; i++) {
        const t = templates[i];
        await this.prisma.abpMission.create({
          data: {
            institutionId, phaseStateId: ps.id, title: t.title, description: t.description || null,
            sortOrder: i * 100, required: t.required, generatedBy: 'TEMPLATE',
            activities: {
              create: t.tool
                ? [{ institutionId, type: 'CUSTOM' as any, title: t.title, content: { tool: t.tool } as any, sortOrder: 0 }]
                : (t.activities || []).map((a, ai) => ({ institutionId, type: a.type as any, title: a.title, sortOrder: ai * 100 })),
            },
          },
        });
      }
    }
  }

  /** ¿Está completa una misión? Herramienta → criterio de la herramienta; con actividades
   * → todas completas; sin actividades → status COMPLETED (manual). */
  private missionComplete(mission: any, phase: number, data: any, config: any, memberIds: string[]): boolean {
    const acts = mission.activities || [];
    const tool = acts.find((a: any) => (a.content as any)?.tool);
    if (tool) return toolCriterionMet(phase, data, config, memberIds);
    if (acts.length > 0) return acts.every((a: any) => a.completed);
    return mission.status === 'COMPLETED';
  }

  /** ¿La fase está lista para validar? Todas sus misiones `required` completas. */
  private async isPhaseReady(teamId: string, institutionId: string, phase: number): Promise<boolean> {
    const ps = await this.prisma.abpPhaseState.findUnique({
      where: { teamId_phase: { teamId, phase } },
      include: { missions: { include: { activities: true } } },
    });
    if (!ps) return false;
    const project = await this.prisma.abpProject.findFirst({ where: { teams: { some: { id: teamId } } }, select: { phaseConfig: true } });
    const config = resolvePhaseConfig(project?.phaseConfig);
    const members = await this.prisma.abpTeamMember.findMany({ where: { teamId }, select: { studentEnrollmentId: true } });
    const memberIds = members.map(m => m.studentEnrollmentId);
    if ((ps.missions as any[]).length === 0) return toolCriterionMet(phase, ps.data, config, memberIds); // equipos previos sin misiones
    await this.markLessonCompletion(ps.missions as any[], memberIds);
    const required = (ps.missions as any[]).filter(m => m.required);
    return required.every(m => this.missionComplete(m, phase, ps.data, config, memberIds));
  }

  /** Misiones de una fase con su estado de completitud calculado. */
  async listMissions(teamId: string, institutionId: string, userId: string, phase: number) {
    const team = await this.loadTeamForUser(teamId, institutionId, userId);
    const ps = await this.prisma.abpPhaseState.findUnique({ where: { teamId_phase: { teamId, phase } }, include: { missions: { include: { activities: { orderBy: { sortOrder: 'asc' } } }, orderBy: { sortOrder: 'asc' } } } });
    if (!ps) return [];
    const project = await this.prisma.abpProject.findUnique({ where: { id: team.projectId }, select: { phaseConfig: true } });
    const config = resolvePhaseConfig(project?.phaseConfig);
    const memberIds = (team.members as any[]).map(m => m.studentEnrollmentId);
    await this.markLessonCompletion(ps.missions as any[], memberIds);
    return (ps.missions as any[]).map(m => ({ ...m, complete: this.missionComplete(m, phase, ps.data, config, memberIds) }));
  }

  async addMission(teamId: string, institutionId: string, userId: string, phase: number, dto: { title: string; description?: string; required?: boolean }) {
    if (!dto.title?.trim()) throw new BadRequestException('El título de la misión es obligatorio');
    await this.loadTeamForUser(teamId, institutionId, userId);
    const ps = await this.prisma.abpPhaseState.findUnique({ where: { teamId_phase: { teamId, phase } }, select: { id: true } });
    if (!ps) throw new NotFoundException('Fase no encontrada');
    const max = await this.prisma.abpMission.aggregate({ where: { phaseStateId: ps.id }, _max: { sortOrder: true } });
    return this.prisma.abpMission.create({ data: { institutionId, phaseStateId: ps.id, title: dto.title.trim(), description: dto.description?.trim() || null, required: dto.required ?? true, sortOrder: (max._max.sortOrder ?? 0) + 100, generatedBy: 'MANUAL' } });
  }

  /** El docente "libera" una misión a TODOS los equipos del proyecto en una fase.
   * Crea la misión (con sus actividades opcionales) en cada phaseState correspondiente. */
  async broadcastMission(projectId: string, institutionId: string, userId: string, dto: { phase: number; title: string; description?: string; required?: boolean; activities?: { type: string; title: string }[] }) {
    await this.assertProjectOwner(projectId, institutionId, userId);
    if (!dto.title?.trim()) throw new BadRequestException('El título de la misión es obligatorio');
    const phase = dto.phase >= 1 && dto.phase <= 6 ? dto.phase : 1;
    const validTypes = ['READING', 'VIDEO', 'QUIZ', 'INTERVIEW', 'UPLOAD', 'LINK', 'CUSTOM'];
    const acts = (dto.activities || []).filter(a => a?.title?.trim());
    const phaseStates = await this.prisma.abpPhaseState.findMany({
      where: { institutionId, phase, team: { projectId } },
      select: { id: true },
    });
    let count = 0;
    for (const ps of phaseStates) {
      const max = await this.prisma.abpMission.aggregate({ where: { phaseStateId: ps.id }, _max: { sortOrder: true } });
      await this.prisma.abpMission.create({
        data: {
          institutionId, phaseStateId: ps.id,
          title: dto.title.trim(), description: dto.description?.trim() || null,
          required: dto.required ?? true, sortOrder: (max._max.sortOrder ?? 0) + 100, generatedBy: 'MANUAL',
          activities: { create: acts.map((a, i) => ({ institutionId, type: (validTypes.includes(a.type) ? a.type : 'CUSTOM') as any, title: a.title.trim(), sortOrder: i * 100 })) },
        },
      });
      count++;
    }
    return { ok: true, count };
  }

  /** Valeria sugiere actividades para una misión, ligadas a la problemática del equipo.
   * No persiste nada: devuelve las sugerencias para que el docente revise y añada. */
  async suggestActivities(teamId: string, missionId: string, institutionId: string, userId: string, count?: number) {
    const team = await this.loadTeamForUser(teamId, institutionId, userId);
    const mission = await this.prisma.abpMission.findFirst({ where: { id: missionId, institutionId }, include: { phaseState: { select: { phase: true, teamId: true } } } });
    if (!mission || mission.phaseState.teamId !== teamId) throw new NotFoundException('Misión no encontrada');
    if (!this.apdAi.isEnabled()) return { configured: false, activities: [] };
    if (!(await this.orchestrator.withinQuota(institutionId))) throw new BadRequestException('Se alcanzó la cuota mensual de IA de la institución.');

    const phase = mission.phaseState.phase;
    const project = await this.prisma.abpProject.findUnique({ where: { id: team.projectId }, select: { challenge: true } });
    const ps1 = await this.prisma.abpPhaseState.findUnique({ where: { teamId_phase: { teamId, phase: 1 } }, select: { data: true } });
    const canvas = Array.isArray((ps1?.data as any)?.canvas) ? (ps1!.data as any).canvas.map((c: any) => c?.value).filter(Boolean) : [];
    const ps3 = await this.prisma.abpPhaseState.findUnique({ where: { teamId_phase: { teamId, phase: 3 } }, select: { data: true } });
    const smart = (ps3?.data as any)?.smart?.text || '';
    const phaseName = ABP_PHASES.find(p => p.n === phase)?.name || `Fase ${phase}`;

    const route = this.orchestrator.chooseRoute(await this.orchestrator.getPlan(institutionId));
    // En el free tier preferimos Qwen3 para misiones (buen español + JSON). Si está
    // saturado, la cascada de OpenRouter cae al siguiente modelo automáticamente.
    if (route.provider === 'OPENROUTER' && !(route.model || '').includes('qwen')) {
      route.model = 'qwen/qwen3-next-80b-a3b-instruct:free';
    }
    const result = await this.apdAi.generateAbpActivities(
      { challenge: project?.challenge || undefined, teamName: team.name, problem: (team as any).problem || undefined, phase, phaseName, canvas, smart, count },
      route,
    );
    await this.orchestrator.recordUsage(institutionId, this.orchestrator.estimateTokens(JSON.stringify(result), smart, canvas.join(' ')));
    return { configured: true, model: route.model, activities: result.activities };
  }

  /** Alta en lote de actividades de misión (para aplicar las sugerencias de Valeria). */
  async addActivitiesBulk(missionId: string, institutionId: string, userId: string, items: { type: string; title: string }[]) {
    const m = await this.prisma.abpMission.findFirst({ where: { id: missionId, institutionId }, include: { phaseState: { select: { teamId: true } } } });
    if (!m) throw new NotFoundException('Misión no encontrada');
    await this.loadTeamForUser(m.phaseState.teamId, institutionId, userId);
    const valid = ['READING', 'VIDEO', 'QUIZ', 'INTERVIEW', 'UPLOAD', 'LINK', 'CUSTOM'];
    const max = await this.prisma.abpMissionActivity.aggregate({ where: { missionId }, _max: { sortOrder: true } });
    let sort = (max._max.sortOrder ?? 0) + 100;
    const created = [] as any[];
    for (const it of items || []) {
      if (!it?.title?.trim()) continue;
      const c = await this.prisma.abpMissionActivity.create({
        data: { institutionId, missionId, type: (valid.includes(it.type) ? it.type : 'CUSTOM') as any, title: it.title.trim(), sortOrder: sort },
      });
      sort += 100;
      created.push(c);
    }
    return created;
  }

  /** Añade una actividad JUGABLE (lección/juego): crea una ClassroomActivity LESSON
   * oculta de la pestaña Actividades y la enlaza. El contenido se edita con el
   * LessonEditor del aula (activityId = classroomActivity). */
  async addLessonActivity(missionId: string, institutionId: string, userId: string, dto: { title: string }) {
    const m = await this.prisma.abpMission.findFirst({ where: { id: missionId, institutionId }, include: { phaseState: { select: { teamId: true } } } });
    if (!m) throw new NotFoundException('Misión no encontrada');
    const team = await this.loadTeamForUser(m.phaseState.teamId, institutionId, userId);
    const project = await this.prisma.abpProject.findUnique({ where: { id: team.projectId }, select: { classroomId: true } });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    const title = (dto.title || '').trim() || 'Lección';
    const activity = await this.prisma.classroomActivity.create({
      data: { classroomId: project.classroomId, type: 'LESSON', title, isRouteScoped: true, isPublished: true, isVisible: true, maxScore: 100, metadata: { abp: true } as any },
    });
    const max = await this.prisma.abpMissionActivity.aggregate({ where: { missionId }, _max: { sortOrder: true } });
    return this.prisma.abpMissionActivity.create({
      data: { institutionId, missionId, type: 'CUSTOM' as any, title, classroomActivityId: activity.id, sortOrder: (max._max.sortOrder ?? 0) + 100 },
    });
  }

  /** Valeria genera el CONTENIDO jugable de una actividad-lección, anclado a la
   * problemática del equipo. Reemplaza la lección (es regenerable). */
  async generateLessonContent(activityId: string, institutionId: string, userId: string, instructions?: string) {
    const a = await this.prisma.abpMissionActivity.findFirst({
      where: { id: activityId, institutionId },
      include: { mission: { include: { phaseState: { select: { phase: true, teamId: true } } } } },
    });
    if (!a) throw new NotFoundException('Actividad no encontrada');
    if (!a.classroomActivityId) throw new BadRequestException('Esta actividad no es una lección/juego');
    const teamId = a.mission.phaseState.teamId;
    const team = await this.loadTeamForUser(teamId, institutionId, userId);
    if (!this.apdAi.isEnabled()) throw new BadRequestException('Valeria no está configurada (falta la API key de IA).');
    if (!(await this.orchestrator.withinQuota(institutionId))) throw new BadRequestException('Se alcanzó la cuota mensual de IA de la institución.');

    const phase = a.mission.phaseState.phase;
    const project = await this.prisma.abpProject.findUnique({ where: { id: team.projectId }, select: { challenge: true, classroomId: true } });
    const ps1 = await this.prisma.abpPhaseState.findUnique({ where: { teamId_phase: { teamId, phase: 1 } }, select: { data: true } });
    const canvas = Array.isArray((ps1?.data as any)?.canvas) ? (ps1!.data as any).canvas.map((c: any) => c?.value).filter(Boolean) : [];
    const ps3 = await this.prisma.abpPhaseState.findUnique({ where: { teamId_phase: { teamId, phase: 3 } }, select: { data: true } });
    const smart = (ps3?.data as any)?.smart?.text || '';
    const phaseName = ABP_PHASES.find(p => p.n === phase)?.name || `Fase ${phase}`;
    const classroom = project?.classroomId
      ? await this.prisma.classroom.findUnique({ where: { id: project.classroomId }, select: { teacherAssignment: { select: { group: { select: { grade: { select: { name: true } } } } } } } })
      : null;
    const gradeName = classroom?.teacherAssignment?.group?.grade?.name;

    const route = this.orchestrator.chooseRoute(await this.orchestrator.getPlan(institutionId));
    if (route.provider === 'OPENROUTER' && !(route.model || '').includes('qwen')) {
      route.model = 'qwen/qwen3-next-80b-a3b-instruct:free';
    }
    const draft = await this.apdAi.generateAbpLessonSlides(
      { title: a.title, challenge: project?.challenge || undefined, problem: (team as any).problem || undefined, canvas, smart, phase, phaseName, gradeName, instructions },
      route,
    );

    // Reemplaza la lección (regenerable), igual que en las Rutas.
    const existing = await this.prisma.lesson.findUnique({ where: { activityId: a.classroomActivityId }, select: { id: true } });
    if (existing) await this.prisma.lesson.delete({ where: { id: existing.id } });
    await this.prisma.lesson.create({
      data: {
        activityId: a.classroomActivityId,
        title: draft.title,
        description: draft.description,
        slides: {
          create: draft.slides.map((s, i) => ({
            type: s.type as any, sortOrder: i, title: s.title, body: s.body,
            activityData: s.activityData ? (s.activityData as any) : undefined,
            badgeEmoji: s.badgeEmoji, badgeTitle: s.badgeTitle,
          })),
        },
      },
    });
    await this.orchestrator.recordUsage(institutionId, this.orchestrator.estimateTokens(JSON.stringify(draft)));
    return { ok: true, title: draft.title, slides: draft.slides.length, model: route.model };
  }

  /** Marca como completas las actividades-lección cuya ClassroomActivity ya fue
   * entregada por algún integrante del equipo (cálculo on-demand, sin estado nuevo). */
  private async markLessonCompletion(missions: any[], memberEnrollmentIds: string[]) {
    const lessonActs: any[] = [];
    for (const m of missions || []) for (const a of (m.activities || [])) if (a.classroomActivityId) lessonActs.push(a);
    if (lessonActs.length === 0 || memberEnrollmentIds.length === 0) return;
    const actIds = [...new Set(lessonActs.map(a => a.classroomActivityId))];
    const subs = await this.prisma.activitySubmission.findMany({
      where: { activityId: { in: actIds }, studentEnrollmentId: { in: memberEnrollmentIds }, submittedAt: { not: null } },
      select: { activityId: true },
    });
    const done = new Set(subs.map(s => s.activityId));
    for (const a of lessonActs) if (done.has(a.classroomActivityId)) a.completed = true;
  }

  async deleteMission(missionId: string, institutionId: string, userId: string) {
    const m = await this.prisma.abpMission.findFirst({ where: { id: missionId, institutionId }, include: { phaseState: { select: { teamId: true } } } });
    if (!m) throw new NotFoundException('Misión no encontrada');
    await this.loadTeamForUser(m.phaseState.teamId, institutionId, userId);
    await this.prisma.abpMission.delete({ where: { id: missionId } });
    return { ok: true };
  }

  /** Marca/desmarca una misión sin actividades como completada (manual). */
  async setMissionStatus(missionId: string, institutionId: string, userId: string, completed: boolean) {
    const m = await this.prisma.abpMission.findFirst({ where: { id: missionId, institutionId }, include: { phaseState: { select: { teamId: true } } } });
    if (!m) throw new NotFoundException('Misión no encontrada');
    await this.loadTeamForUser(m.phaseState.teamId, institutionId, userId);
    return this.prisma.abpMission.update({ where: { id: missionId }, data: { status: completed ? 'COMPLETED' : 'IN_PROGRESS' } });
  }

  async addActivity(missionId: string, institutionId: string, userId: string, dto: { type: string; title: string; content?: any }) {
    const m = await this.prisma.abpMission.findFirst({ where: { id: missionId, institutionId }, include: { phaseState: { select: { teamId: true } } } });
    if (!m) throw new NotFoundException('Misión no encontrada');
    await this.loadTeamForUser(m.phaseState.teamId, institutionId, userId);
    const valid = ['READING', 'VIDEO', 'QUIZ', 'INTERVIEW', 'UPLOAD', 'LINK', 'CUSTOM'];
    const max = await this.prisma.abpMissionActivity.aggregate({ where: { missionId }, _max: { sortOrder: true } });
    return this.prisma.abpMissionActivity.create({ data: { institutionId, missionId, type: (valid.includes(dto.type) ? dto.type : 'CUSTOM') as any, title: (dto.title || '').trim() || 'Actividad', content: dto.content ?? undefined, sortOrder: (max._max.sortOrder ?? 0) + 100 } });
  }

  async completeActivity(activityId: string, institutionId: string, userId: string, completed: boolean) {
    const a = await this.prisma.abpMissionActivity.findFirst({ where: { id: activityId, institutionId }, include: { mission: { include: { phaseState: { select: { teamId: true } } } } } });
    if (!a) throw new NotFoundException('Actividad no encontrada');
    const team = await this.loadTeamForUser(a.mission.phaseState.teamId, institutionId, userId);
    const me = this.memberOf(team, userId);
    return this.prisma.abpMissionActivity.update({ where: { id: activityId }, data: { completed, completedByEnrollmentId: completed ? (me?.enrollmentId ?? null) : null } });
  }

  async deleteActivity(activityId: string, institutionId: string, userId: string) {
    const a = await this.prisma.abpMissionActivity.findFirst({ where: { id: activityId, institutionId }, include: { mission: { include: { phaseState: { select: { teamId: true } } } } } });
    if (!a) throw new NotFoundException('Actividad no encontrada');
    await this.loadTeamForUser(a.mission.phaseState.teamId, institutionId, userId);
    await this.prisma.abpMissionActivity.delete({ where: { id: activityId } });
    // Si era una lección/juego, elimina también su ClassroomActivity (cascada limpia lección/submissions).
    if (a.classroomActivityId) {
      await this.prisma.classroomActivity.delete({ where: { id: a.classroomActivityId } }).catch(() => { /* ya no existe */ });
    }
    return { ok: true };
  }

  // ─── VALIDACIÓN (gating de fases) ──────────────────────────────────────────

  /** El equipo solicita validar su fase actual → AWAITING + solicitud PENDING.
   * Se exige que todas las misiones `required` de la fase estén completas. */
  async requestValidation(teamId: string, institutionId: string, userId: string) {
    const team = await this.loadTeamForUser(teamId, institutionId, userId);
    const phase = team.currentPhase;
    const ps = await this.prisma.abpPhaseState.findUnique({ where: { teamId_phase: { teamId, phase } } });
    if (!ps || ps.status !== 'IN_PROGRESS') {
      throw new BadRequestException('La fase actual no está en curso');
    }
    if (!(await this.isPhaseReady(teamId, institutionId, phase))) {
      throw new BadRequestException('Aún faltan misiones por completar en esta fase');
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

  // ─── BITÁCORA (AbpLogEntry) + DESCUBRIMIENTOS (AbpDiscovery) — Nivel 2 ───────

  async listLog(teamId: string, institutionId: string, userId: string) {
    await this.loadTeamForUser(teamId, institutionId, userId);
    return this.prisma.abpLogEntry.findMany({ where: { teamId, institutionId }, orderBy: { createdAt: 'desc' } });
  }

  async addLogEntry(teamId: string, institutionId: string, userId: string, dto: { content: string; phase?: number }) {
    const team = await this.loadTeamForUser(teamId, institutionId, userId);
    if (!dto.content?.trim()) throw new BadRequestException('La entrada de bitácora no puede estar vacía');
    const me = this.memberOf(team, userId);
    return this.prisma.abpLogEntry.create({
      data: {
        institutionId, teamId,
        phase: dto.phase && dto.phase >= 1 && dto.phase <= 6 ? dto.phase : null,
        authorStudentEnrollmentId: me?.enrollmentId ?? null,
        authorName: me?.name ?? 'Docente',
        content: dto.content.trim(),
      },
    });
  }

  async deleteLogEntry(entryId: string, institutionId: string, userId: string) {
    const e = await this.prisma.abpLogEntry.findFirst({ where: { id: entryId, institutionId }, select: { teamId: true } });
    if (!e) throw new NotFoundException('Entrada no encontrada');
    await this.loadTeamForUser(e.teamId, institutionId, userId);
    await this.prisma.abpLogEntry.delete({ where: { id: entryId } });
    return { ok: true };
  }

  async listDiscoveries(teamId: string, institutionId: string, userId: string) {
    await this.loadTeamForUser(teamId, institutionId, userId);
    return this.prisma.abpDiscovery.findMany({ where: { teamId, institutionId }, orderBy: { createdAt: 'desc' } });
  }

  async addDiscovery(teamId: string, institutionId: string, userId: string, dto: { phase: number; title: string; description: string; evidenceKind?: string; evidenceUrl?: string; impact?: string }) {
    const team = await this.loadTeamForUser(teamId, institutionId, userId);
    if (!dto.title?.trim()) throw new BadRequestException('El descubrimiento necesita un título');
    if (!dto.description?.trim()) throw new BadRequestException('Describe qué aprendieron');
    const me = this.memberOf(team, userId);
    const impact = ['LOW', 'MEDIUM', 'HIGH'].includes(dto.impact || '') ? dto.impact : 'MEDIUM';
    const phase = dto.phase && dto.phase >= 1 && dto.phase <= 6 ? dto.phase : team.currentPhase;
    const evUrl = (dto.evidenceUrl || '').trim();
    const disc = await this.prisma.abpDiscovery.create({
      data: {
        institutionId, teamId, phase,
        authorStudentEnrollmentId: me?.enrollmentId ?? null,
        authorName: me?.name ?? 'Docente',
        title: dto.title.trim(),
        description: dto.description.trim(),
        evidenceKind: evUrl ? (dto.evidenceKind === 'FILE' ? 'FILE' : 'LINK') : null,
        evidenceUrl: evUrl || null,
        impact: impact as any,
      },
    });
    // Premia la reflexión: XP de equipo + individual (idempotente por descubrimiento).
    if (me?.enrollmentId) {
      try {
        await this.prisma.abpTeam.update({ where: { id: teamId }, data: { xp: { increment: ABP_XP.DISCOVERY } } });
        await this.awardStudentXp(institutionId, me.studentId, me.enrollmentId, ABP_XP.DISCOVERY, 'ABP · descubrimiento', `abp:discovery:${disc.id}`);
      } catch { /* idempotente */ }
    }
    return disc;
  }

  async deleteDiscovery(discoveryId: string, institutionId: string, userId: string) {
    const d = await this.prisma.abpDiscovery.findFirst({ where: { id: discoveryId, institutionId }, select: { teamId: true } });
    if (!d) throw new NotFoundException('Descubrimiento no encontrado');
    await this.loadTeamForUser(d.teamId, institutionId, userId);
    await this.prisma.abpDiscovery.delete({ where: { id: discoveryId } });
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
