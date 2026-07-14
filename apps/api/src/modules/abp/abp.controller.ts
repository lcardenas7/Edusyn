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
  async roster(@Param('classroomId') classroomId: string, @Request() req: any) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.getRoster(classroomId, institutionId, userId);
  }

  // Detalle de un proyecto con sus equipos — docente.
  @Get('projects/:projectId')
  @Roles('DOCENTE', 'COORDINADOR')
  async getProject(@Param('projectId') projectId: string, @Request() req: any) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.getProject(projectId, institutionId, userId);
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
  async resolveValidation(@Param('validationId') validationId: string, @Request() req: any, @Body() body: { action: 'approve' | 'return'; feedback?: string; rubricScores?: number[]; rubricComment?: string }) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.resolveValidation(validationId, institutionId, userId, body.action, body.feedback, body.rubricScores, body.rubricComment);
  }

  // Pantalla de revisión del docente (trabajo + criterios + rúbrica + comentarios).
  @Get('validations/:validationId/review')
  @Roles('DOCENTE', 'COORDINADOR')
  async getReview(@Param('validationId') validationId: string, @Request() req: any) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.getReview(validationId, institutionId, userId);
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
