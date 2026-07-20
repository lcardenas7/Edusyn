import { Body, Controller, Delete, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveInstitutionId } from '../../common/utils/institution-resolver';
import { AbpService } from './abp.service';
import { ABP_PHASES, ABP_COEVAL_CRITERIA } from './abp.constants';

// ═══════════════════════════════════════════════════════════════════════════
// EXPEDICIÓN ABP — controller. Ticket 1: crear proyecto, roster, armar equipos.
// ═══════════════════════════════════════════════════════════════════════════

@Controller('abp')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AbpController {
  constructor(
    private readonly service: AbpService,
    private readonly prisma: PrismaService,
  ) {}

  private async ctx(req: any) {
    const userId = req.user.id;
    const institutionId = await resolveInstitutionId(this.prisma as any, req);
    if (!institutionId) throw new Error('No se pudo resolver la institución');
    return { userId, institutionId };
  }

  // Catálogo de las 6 fases + rúbrica de coevaluación (para el front).
  @Get('phases')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  phases() {
    return { phases: ABP_PHASES, coevalCriteria: ABP_COEVAL_CRITERIA };
  }

  // Fase 6: coevaluar a otro equipo.
  @Post('teams/:teamId/coeval')
  @Roles('ESTUDIANTE', 'DOCENTE')
  async coeval(@Param('teamId') teamId: string, @Request() req: any, @Body() body: { targetTeamId: string; scores: number[] }) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.submitCoeval(teamId, institutionId, userId, body.targetTeamId, body.scores);
  }

  // Proyectos ABP de un aula.
  @Get('classroom/:classroomId/projects')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async listByClassroom(@Param('classroomId') classroomId: string, @Request() req: any) {
    const { institutionId } = await this.ctx(req);
    return this.service.listByClassroom(classroomId, institutionId);
  }

  // Matriculados del aula (para armar equipos) — docente.
  @Get('classroom/:classroomId/roster')
  @Roles('DOCENTE', 'COORDINADOR')
  async roster(@Param('classroomId') classroomId: string, @Query('projectId') projectId: string | undefined, @Request() req: any) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.getRoster(classroomId, institutionId, userId, projectId);
  }

  // Detalle de un proyecto con sus equipos — docente.
  @Get('projects/:projectId')
  @Roles('DOCENTE', 'COORDINADOR')
  async getProject(@Param('projectId') projectId: string, @Request() req: any) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.getProject(projectId, institutionId, userId);
  }

  // Portada del proyecto para el alumno (lectura).
  @Get('projects/:projectId/presentation')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async projectPresentation(@Param('projectId') projectId: string, @Request() req: any) {
    const { institutionId } = await this.ctx(req);
    return this.service.getProjectForStudent(projectId, institutionId);
  }

  // Docente edita la portada (y opcionalmente el reto general).
  @Post('projects/:projectId/presentation')
  @Roles('DOCENTE', 'COORDINADOR')
  async updatePresentation(@Param('projectId') projectId: string, @Request() req: any, @Body() body: { challenge?: string; presentation?: any }) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.updatePresentation(projectId, institutionId, userId, body);
  }

  // Docente configura los instrumentos de una estación (Biblioteca de Instrumentos).
  @Post('projects/:projectId/instruments')
  @Roles('DOCENTE', 'COORDINADOR')
  async setPhaseInstruments(@Param('projectId') projectId: string, @Request() req: any, @Body() body: { phase: number; items: { key: string; required?: boolean }[] }) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.setPhaseInstruments(projectId, institutionId, userId, Number(body?.phase), body?.items ?? []);
  }

  // Docente escribe las instrucciones de una estación (qué haremos aquí y cómo).
  @Post('projects/:projectId/station-instructions')
  @Roles('DOCENTE', 'COORDINADOR')
  async setStationInstructions(@Param('projectId') projectId: string, @Request() req: any, @Body() body: { phase: number; text: string }) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.setStationInstructions(projectId, institutionId, userId, Number(body?.phase), body?.text ?? '');
  }

  // ─── Recursos ──────────────────────────────────────────────────────────────
  @Get('projects/:projectId/resources')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async listResources(@Param('projectId') projectId: string, @Request() req: any) {
    const { institutionId } = await this.ctx(req);
    return this.service.listResources(projectId, institutionId);
  }

  @Post('projects/:projectId/resources')
  @Roles('DOCENTE', 'COORDINADOR')
  async addResource(@Param('projectId') projectId: string, @Request() req: any, @Body() body: { type?: string; title: string; url: string; description?: string }) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.addResource(projectId, institutionId, userId, body);
  }

  @Delete('resources/:resourceId')
  @Roles('DOCENTE', 'COORDINADOR')
  async deleteResource(@Param('resourceId') resourceId: string, @Request() req: any) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.deleteResource(resourceId, institutionId, userId);
  }

  // ─── Anuncios ──────────────────────────────────────────────────────────────
  @Get('projects/:projectId/announcements')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async listAnnouncements(@Param('projectId') projectId: string, @Request() req: any) {
    const { institutionId } = await this.ctx(req);
    return this.service.listAnnouncements(projectId, institutionId);
  }

  @Post('projects/:projectId/announcements')
  @Roles('DOCENTE', 'COORDINADOR')
  async addAnnouncement(@Param('projectId') projectId: string, @Request() req: any, @Body() body: { content: string; pinned?: boolean }) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.addAnnouncement(projectId, institutionId, userId, body);
  }

  @Post('announcements/:announcementId/pin')
  @Roles('DOCENTE', 'COORDINADOR')
  async pinAnnouncement(@Param('announcementId') announcementId: string, @Request() req: any, @Body() body: { pinned: boolean }) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.setAnnouncementPin(announcementId, institutionId, userId, !!body.pinned);
  }

  @Delete('announcements/:announcementId')
  @Roles('DOCENTE', 'COORDINADOR')
  async deleteAnnouncement(@Param('announcementId') announcementId: string, @Request() req: any) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.deleteAnnouncement(announcementId, institutionId, userId);
  }

  // Panel de progreso del proyecto (Centro de Operaciones) — docente.
  @Get('projects/:projectId/dashboard')
  @Roles('DOCENTE', 'COORDINADOR')
  async dashboard(@Param('projectId') projectId: string, @Request() req: any) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.getProjectDashboard(projectId, institutionId, userId);
  }

  // Preview de la expedición de un equipo (lectura) — docente dueño.
  @Get('teams/:teamId/expedition')
  @Roles('DOCENTE', 'COORDINADOR')
  async teamExpedition(@Param('teamId') teamId: string, @Request() req: any) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.getTeamExpedition(teamId, institutionId, userId);
  }

  // Crear proyecto ABP — docente.
  @Post('projects')
  @Roles('DOCENTE', 'COORDINADOR')
  async createProject(@Request() req: any, @Body() body: {
    classroomId: string; title: string; challenge?: string; phaseConfig?: any; startDate?: string; endDate?: string;
  }) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.createProject(institutionId, userId, body);
  }

  // Armar equipo — docente.
  @Post('teams')
  @Roles('DOCENTE', 'COORDINADOR')
  async createTeam(@Request() req: any, @Body() body: {
    projectId: string; name: string; emoji?: string; color?: string; problem?: string; memberEnrollmentIds: string[];
  }) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.createTeam(institutionId, userId, body);
  }

  // Eliminar equipo — docente.
  @Delete('teams/:teamId')
  @Roles('DOCENTE', 'COORDINADOR')
  async deleteTeam(@Param('teamId') teamId: string, @Request() req: any) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.deleteTeam(teamId, institutionId, userId);
  }

  // Añadir integrante a un equipo — docente.
  @Post('teams/:teamId/members')
  @Roles('DOCENTE', 'COORDINADOR')
  async addTeamMember(@Param('teamId') teamId: string, @Body() body: { enrollmentId: string }, @Request() req: any) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.addTeamMember(teamId, institutionId, userId, body?.enrollmentId);
  }

  // Sacar integrante de un equipo — docente.
  @Delete('teams/:teamId/members/:enrollmentId')
  @Roles('DOCENTE', 'COORDINADOR')
  async removeTeamMember(@Param('teamId') teamId: string, @Param('enrollmentId') enrollmentId: string, @Request() req: any) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.removeTeamMember(teamId, institutionId, userId, enrollmentId);
  }

  // ─── Identidad del equipo (estudiantes eligen; docente aprueba el rename) ────
  // Fundación: el equipo elige nombre + emblema (DRAFT → CONFIRMED).
  @Post('teams/:teamId/identity')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async foundIdentity(@Param('teamId') teamId: string, @Body() body: { name: string; emoji?: string }, @Request() req: any) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.foundTeamIdentity(teamId, institutionId, userId, body);
  }

  // El equipo solicita cambiar el nombre (→ al docente).
  @Post('teams/:teamId/rename-request')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async requestRename(@Param('teamId') teamId: string, @Body() body: { proposedName: string }, @Request() req: any) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.requestTeamRename(teamId, institutionId, userId, body?.proposedName);
  }

  // El docente aprueba/rechaza el cambio de nombre.
  @Post('teams/:teamId/rename-resolve')
  @Roles('DOCENTE', 'COORDINADOR')
  async resolveRename(@Param('teamId') teamId: string, @Body() body: { approve: boolean }, @Request() req: any) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.resolveTeamRename(teamId, institutionId, userId, !!body?.approve);
  }

  // El estudiante elige su avatar.
  @Post('teams/:teamId/my-avatar')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async setMyAvatar(@Param('teamId') teamId: string, @Body() body: { avatarId: string }, @Request() req: any) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.setMyAvatar(teamId, institutionId, userId, body?.avatarId);
  }

  // ─── Sendero + validaciones (Ticket 2) ─────────────────────────────────────

  // El equipo del estudiante en un proyecto (su expedición).
  @Get('projects/:projectId/my-team')
  @Roles('ESTUDIANTE')
  async myTeam(@Param('projectId') projectId: string, @Request() req: any) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.getMyTeam(projectId, institutionId, userId);
  }

  // El equipo solicita validar su fase actual.
  @Post('teams/:teamId/request-validation')
  @Roles('ESTUDIANTE', 'DOCENTE')
  async requestValidation(@Param('teamId') teamId: string, @Request() req: any) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.requestValidation(teamId, institutionId, userId);
  }

  // Fase 1: guardar una tarjeta del canvas.
  @Post('teams/:teamId/canvas')
  @Roles('ESTUDIANTE', 'DOCENTE')
  async saveCanvas(@Param('teamId') teamId: string, @Request() req: any, @Body() body: { cardIndex: number; value: string }) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.saveCanvasCard(teamId, institutionId, userId, body.cardIndex, body.value ?? '');
  }

  // Fase 2: publicar idea.
  @Post('teams/:teamId/ideas')
  @Roles('ESTUDIANTE', 'DOCENTE')
  async addIdea(@Param('teamId') teamId: string, @Request() req: any, @Body() body: { text: string }) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.addIdea(teamId, institutionId, userId, body.text);
  }

  // Fase 2: votar una idea.
  @Post('teams/:teamId/ideas/:ideaId/vote')
  @Roles('ESTUDIANTE')
  async voteIdea(@Param('teamId') teamId: string, @Param('ideaId') ideaId: string, @Request() req: any) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.voteIdea(teamId, institutionId, userId, ideaId);
  }

  // Fase 3: guardar objetivo SMART.
  @Post('teams/:teamId/smart')
  @Roles('ESTUDIANTE', 'DOCENTE')
  async saveSmart(@Param('teamId') teamId: string, @Request() req: any, @Body() body: { text: string; checks: boolean[] }) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.saveSmart(teamId, institutionId, userId, body.text ?? '', body.checks ?? []);
  }

  // Fase 4: Kanban.
  @Post('teams/:teamId/tasks')
  @Roles('ESTUDIANTE', 'DOCENTE')
  async addTask(@Param('teamId') teamId: string, @Request() req: any, @Body() body: { text: string; ownerEnrollmentId: string }) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.addTask(teamId, institutionId, userId, body.text, body.ownerEnrollmentId);
  }

  @Post('teams/:teamId/tasks/:taskId/move')
  @Roles('ESTUDIANTE', 'DOCENTE')
  async moveTask(@Param('teamId') teamId: string, @Param('taskId') taskId: string, @Request() req: any) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.moveTask(teamId, institutionId, userId, taskId);
  }

  @Delete('teams/:teamId/tasks/:taskId')
  @Roles('ESTUDIANTE', 'DOCENTE')
  async removeTask(@Param('teamId') teamId: string, @Param('taskId') taskId: string, @Request() req: any) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.removeTask(teamId, institutionId, userId, taskId);
  }

  // Fase 5: evidencias.
  @Post('teams/:teamId/evidences')
  @Roles('ESTUDIANTE', 'DOCENTE')
  async addEvidence(@Param('teamId') teamId: string, @Request() req: any, @Body() body: { kind: string; url: string; label?: string }) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.addEvidence(teamId, institutionId, userId, body.kind, body.url, body.label);
  }

  @Delete('teams/:teamId/evidences/:evidenceId')
  @Roles('ESTUDIANTE', 'DOCENTE')
  async removeEvidence(@Param('teamId') teamId: string, @Param('evidenceId') evidenceId: string, @Request() req: any) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.removeEvidence(teamId, institutionId, userId, evidenceId);
  }

  // Cola de validaciones pendientes del docente (opcional ?classroomId=).
  @Get('queue')
  @Roles('DOCENTE', 'COORDINADOR')
  async queue(@Request() req: any, @Query('classroomId') classroomId?: string) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.getQueue(institutionId, userId, classroomId);
  }

  // Docente aprueba (rúbrica obligatoria) o devuelve una validación.
  @Post('validations/:validationId/resolve')
  @Roles('DOCENTE', 'COORDINADOR')
  async resolveValidation(@Param('validationId') validationId: string, @Request() req: any, @Body() body: { action: 'approve' | 'return'; feedback?: string; rubricScores?: number[]; rubricComment?: string; missions?: { title: string; description?: string; required?: boolean; deliverableKind?: string }[] }) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.resolveValidation(validationId, institutionId, userId, body.action, body.feedback, body.rubricScores, body.rubricComment, body.missions);
  }

  // Pantalla de revisión del docente (trabajo + criterios + rúbrica + comentarios).
  @Get('validations/:validationId/review')
  @Roles('DOCENTE', 'COORDINADOR')
  async getReview(@Param('validationId') validationId: string, @Request() req: any) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.getReview(validationId, institutionId, userId);
  }

  // ─── Misiones (el trabajo real dentro de cada fase-hito) ───────────────────
  @Get('teams/:teamId/phases/:phase/missions')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async listMissions(@Param('teamId') teamId: string, @Param('phase') phase: string, @Request() req: any) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.listMissions(teamId, institutionId, userId, parseInt(phase, 10));
  }

  @Post('teams/:teamId/phases/:phase/missions')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async addMission(@Param('teamId') teamId: string, @Param('phase') phase: string, @Request() req: any, @Body() body: { title: string; description?: string; required?: boolean; deliverableKind?: string; assigneeEnrollmentId?: string; dueAt?: string }) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.addMission(teamId, institutionId, userId, parseInt(phase, 10), body);
  }

  // El docente libera una misión a todos los equipos del proyecto (en una fase).
  @Post('projects/:projectId/broadcast-mission')
  @Roles('DOCENTE', 'COORDINADOR')
  async broadcastMission(@Param('projectId') projectId: string, @Request() req: any, @Body() body: { phase: number; title: string; description?: string; required?: boolean; activities?: { type: string; title: string }[] }) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.broadcastMission(projectId, institutionId, userId, body);
  }

  // Valeria sugiere actividades para una misión (docente).
  @Post('teams/:teamId/missions/:missionId/suggest')
  @Roles('DOCENTE', 'COORDINADOR')
  async suggestActivities(@Param('teamId') teamId: string, @Param('missionId') missionId: string, @Request() req: any, @Body() body: { count?: number }) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.suggestActivities(teamId, missionId, institutionId, userId, body?.count);
  }

  // Añade una actividad jugable (lección/juego) enlazada a una ClassroomActivity.
  @Post('missions/:missionId/lesson-activity')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async addLessonActivity(@Param('missionId') missionId: string, @Request() req: any, @Body() body: { title: string }) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.addLessonActivity(missionId, institutionId, userId, body);
  }

  // Actividades/juegos existentes del curso reutilizables en esta misión.
  @Get('missions/:missionId/reusable-activities')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async reusableActivities(@Param('missionId') missionId: string, @Request() req: any) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.listReusableActivities(missionId, institutionId, userId);
  }

  // Reutiliza (enlaza) una actividad/juego existente a la misión.
  @Post('missions/:missionId/attach-activity')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async attachActivity(@Param('missionId') missionId: string, @Request() req: any, @Body() body: { classroomActivityId: string }) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.attachActivity(missionId, institutionId, userId, body?.classroomActivityId);
  }

  // Alta en lote de actividades (aplicar sugerencias de Valeria).
  @Post('missions/:missionId/activities/bulk')
  @Roles('DOCENTE', 'COORDINADOR')
  async addActivitiesBulk(@Param('missionId') missionId: string, @Request() req: any, @Body() body: { items: { type: string; title: string }[] }) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.addActivitiesBulk(missionId, institutionId, userId, body?.items || []);
  }

  @Delete('missions/:missionId')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async deleteMission(@Param('missionId') missionId: string, @Request() req: any) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.deleteMission(missionId, institutionId, userId);
  }

  @Post('missions/:missionId/status')
  @Roles('DOCENTE', 'COORDINADOR')
  async setMissionStatus(@Param('missionId') missionId: string, @Request() req: any, @Body() body: { completed: boolean }) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.setMissionStatus(missionId, institutionId, userId, !!body.completed);
  }

  // El equipo ENTREGA el producto de una misión de entrega (taller dentro del ABP).
  @Post('missions/:missionId/deliver')
  @Roles('ESTUDIANTE', 'DOCENTE')
  async submitDelivery(@Param('missionId') missionId: string, @Request() req: any, @Body() body: { url?: string; text?: string; label?: string }) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.submitMissionDelivery(missionId, institutionId, userId, body || {});
  }

  @Post('missions/:missionId/activities')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async addActivity(@Param('missionId') missionId: string, @Request() req: any, @Body() body: { type: string; title: string; content?: any }) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.addActivity(missionId, institutionId, userId, body);
  }

  @Post('activities/:activityId/complete')
  @Roles('DOCENTE', 'COORDINADOR')
  async completeActivity(@Param('activityId') activityId: string, @Request() req: any, @Body() body: { completed: boolean }) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.completeActivity(activityId, institutionId, userId, !!body.completed);
  }

  // Valeria genera el contenido jugable de una actividad-lección (docente).
  @Post('activities/:activityId/generate-lesson')
  @Roles('DOCENTE', 'COORDINADOR')
  async generateLessonContent(@Param('activityId') activityId: string, @Request() req: any, @Body() body: { instructions?: string }) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.generateLessonContent(activityId, institutionId, userId, body?.instructions);
  }

  @Delete('activities/:activityId')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async deleteActivity(@Param('activityId') activityId: string, @Request() req: any) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.deleteActivity(activityId, institutionId, userId);
  }

  // ─── Bitácora (Nivel 2) ────────────────────────────────────────────────────
  @Get('teams/:teamId/log')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async listLog(@Param('teamId') teamId: string, @Request() req: any) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.listLog(teamId, institutionId, userId);
  }

  @Post('teams/:teamId/log')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async addLog(@Param('teamId') teamId: string, @Request() req: any, @Body() body: { content: string; phase?: number }) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.addLogEntry(teamId, institutionId, userId, body);
  }

  @Delete('log/:entryId')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async deleteLog(@Param('entryId') entryId: string, @Request() req: any) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.deleteLogEntry(entryId, institutionId, userId);
  }

  // ─── Descubrimientos (Nivel 2) ──────────────────────────────────────────────
  @Get('teams/:teamId/discoveries')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async listDiscoveries(@Param('teamId') teamId: string, @Request() req: any) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.listDiscoveries(teamId, institutionId, userId);
  }

  @Post('teams/:teamId/discoveries')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async addDiscovery(@Param('teamId') teamId: string, @Request() req: any, @Body() body: { phase: number; title: string; description: string; evidenceKind?: string; evidenceUrl?: string; impact?: string }) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.addDiscovery(teamId, institutionId, userId, body);
  }

  @Delete('discoveries/:discoveryId')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async deleteDiscovery(@Param('discoveryId') discoveryId: string, @Request() req: any) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.deleteDiscovery(discoveryId, institutionId, userId);
  }

  // ─── Comentarios en línea ──────────────────────────────────────────────────
  @Get('teams/:teamId/comments')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async listComments(@Param('teamId') teamId: string, @Query('phase') phase: string, @Request() req: any) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.listComments(teamId, parseInt(phase, 10), institutionId, userId);
  }

  @Post('teams/:teamId/comments')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async addComment(@Param('teamId') teamId: string, @Request() req: any, @Body() body: { phase: number; refType: string; refId?: string; content: string; parentId?: string }) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.addComment(teamId, institutionId, userId, body.phase, body.refType, body.refId ?? null, body.content, body.parentId);
  }

  @Post('comments/:commentId/resolve')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async resolveComment(@Param('commentId') commentId: string, @Request() req: any, @Body() body: { resolved: boolean }) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.resolveComment(commentId, institutionId, userId, body.resolved);
  }
}
