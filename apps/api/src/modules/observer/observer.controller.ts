import { Controller, Post, Put, Get, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ObserverService } from './observer.service';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';
import {
  CreateObservationDto,
  UpdateObservationDto,
  CreateActaDto,
  CreateCommitmentDto,
  UpdateCommitmentDto,
  CreateCitationDto,
  UpdateCitationDto,
  CreateReferralDto,
  UpdateReferralDto,
  CreateMeasureDto,
  UpdateMeasureDto,
} from './dto/create-observation.dto';

/**
 * Observador del estudiante: faltas, actas, compromisos, citaciones, remisiones y medidas.
 * PII sensible de menores y material con valor probatorio en procesos de convivencia.
 *
 * ⚠️ AISLAMIENTO MULTI-TENANT (docs/security/RLS-AUDIT-OBSERVER.md). Ninguno de los
 * identificadores que llegan por ruta o cuerpo —`id`, `studentEnrollmentId`, `groupId`,
 * `observationId`— es fuente de autoridad. La institución la resuelve el servidor y el
 * servicio acota cada consulta.
 *
 * Los `@Roles` existentes NO se tocan: el defecto era de aislamiento, no de autorización.
 */
@Controller('observer')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ObserverController {
  constructor(
    private readonly observerService: ObserverService,
    private readonly prisma: PrismaService,
  ) {}

  private inst(req: any) {
    return requireInstitutionId(this.prisma as any, req);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OBSERVACIONES
  // ═══════════════════════════════════════════════════════════════════════════

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async create(@Request() req, @Body() dto: CreateObservationDto) {
    return this.observerService.create(req.user.id, dto, await this.inst(req));
  }

  @Put(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async update(@Request() req, @Param('id') id: string, @Body() dto: UpdateObservationDto) {
    return this.observerService.update(id, dto, await this.inst(req));
  }

  @Delete(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async delete(@Request() req, @Param('id') id: string) {
    return this.observerService.delete(id, await this.inst(req));
  }

  @Get('dashboard')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  getDashboard(@Request() req, @Query('academicYearId') academicYearId: string) {
    return this.observerService.getDashboard(req.user.institutionId, academicYearId);
  }

  @Get('stats/convivencial')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'DOCENTE')
  getConvivencialStats(
    @Request() req,
    @Query('academicYearId') academicYearId: string,
    @Query('groupId') groupId?: string,
    @Query('gradeId') gradeId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.observerService.getConvivencialStats(
      req.user.institutionId,
      academicYearId,
      { groupId, gradeId, startDate, endDate },
    );
  }

  /**
   * ⚠️ `all=true` significa "todos los seguimientos pendientes DE MI INSTITUCIÓN", nunca
   * "de toda la plataforma". Antes, ese parámetro dejaba la consulta sin ningún filtro.
   */
  @Get('pending-followups')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getPendingFollowUps(@Request() req, @Query('all') all?: string) {
    const institutionId = await this.inst(req);
    const authorId = all === 'true' ? undefined : req.user.id;
    return this.observerService.getPendingFollowUps(institutionId, authorId);
  }

  @Get('by-group/:groupId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getByGroup(
    @Param('groupId') groupId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Request() req?,
  ) {
    const institutionId = await this.inst(req);
    const userRoles: string[] = (req?.user?.roles || []).map((r: any) => r.role?.name || r.name || r).filter(Boolean);
    const isAdmin = userRoles.some((r: string) => ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR'].includes(r));
    const authorId = isAdmin ? undefined : req?.user?.id;
    return this.observerService.getByGroup(groupId, academicYearId, institutionId, { type, status, authorId });
  }

  @Get('by-student/:studentEnrollmentId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE')
  async getByStudent(
    @Request() req,
    @Param('studentEnrollmentId') studentEnrollmentId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('type') type?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
  ) {
    return this.observerService.getByStudent(
      studentEnrollmentId,
      await this.inst(req),
      { startDate, endDate, type, category, status },
    );
  }

  @Get('timeline/:studentEnrollmentId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE')
  async getStudentTimeline(@Request() req, @Param('studentEnrollmentId') studentEnrollmentId: string) {
    return this.observerService.getStudentTimeline(studentEnrollmentId, await this.inst(req));
  }

  @Get('summary/:studentEnrollmentId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE')
  async getStudentSummary(@Request() req, @Param('studentEnrollmentId') studentEnrollmentId: string) {
    return this.observerService.getStudentSummary(studentEnrollmentId, await this.inst(req));
  }

  @Get('commission-data')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'DOCENTE')
  getCommissionData(
    @Request() req,
    @Query('academicYearId') academicYearId: string,
    @Query('gradeId') gradeId: string,
    @Query('actaTypes') actaTypes?: string,
  ) {
    const types = actaTypes
      ? actaTypes.split(',').filter(t => ['ACTA_TYPE_I', 'ACTA_TYPE_II', 'ACTA_TYPE_III'].includes(t))
      : ['ACTA_TYPE_I', 'ACTA_TYPE_II', 'ACTA_TYPE_III']
    return this.observerService.getCommissionData(req.user.institutionId, academicYearId, gradeId, types)
  }

  @Get(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE')
  async getById(@Request() req, @Param('id') id: string) {
    return this.observerService.getById(id, await this.inst(req));
  }

  @Put(':id/notify-parent')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async markParentNotified(@Request() req, @Param('id') id: string) {
    return this.observerService.markParentNotified(id, await this.inst(req));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTAS
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('actas')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async createActa(@Request() req, @Body() dto: CreateActaDto) {
    return this.observerService.createActa(dto, await this.inst(req));
  }

  @Put('actas/:id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async updateActa(@Request() req, @Param('id') id: string, @Body() data: any) {
    return this.observerService.updateActa(id, data, await this.inst(req));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPROMISOS
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('commitments')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async createCommitment(@Request() req, @Body() dto: CreateCommitmentDto) {
    return this.observerService.createCommitment(req.user.id, dto, await this.inst(req));
  }

  @Put('commitments/:id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async updateCommitment(@Request() req, @Param('id') id: string, @Body() dto: UpdateCommitmentDto) {
    return this.observerService.updateCommitment(id, req.user.id, dto, await this.inst(req));
  }

  @Get('commitments/by-student/:studentEnrollmentId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE')
  async getCommitmentsByStudent(@Request() req, @Param('studentEnrollmentId') studentEnrollmentId: string) {
    return this.observerService.getCommitmentsByStudent(studentEnrollmentId, await this.inst(req));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CITACIONES
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('citations')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async createCitation(@Request() req, @Body() dto: CreateCitationDto) {
    return this.observerService.createCitation(req.user.id, dto, await this.inst(req));
  }

  @Put('citations/:id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async updateCitation(@Request() req, @Param('id') id: string, @Body() dto: UpdateCitationDto) {
    return this.observerService.updateCitation(id, dto, await this.inst(req));
  }

  @Get('citations/by-student/:studentEnrollmentId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getCitationsByStudent(@Request() req, @Param('studentEnrollmentId') studentEnrollmentId: string) {
    return this.observerService.getCitationsByStudent(studentEnrollmentId, await this.inst(req));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REMISIONES
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('referrals')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async createReferral(@Request() req, @Body() dto: CreateReferralDto) {
    return this.observerService.createReferral(req.user.id, dto, await this.inst(req));
  }

  @Put('referrals/:id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async updateReferral(@Request() req, @Param('id') id: string, @Body() dto: UpdateReferralDto) {
    return this.observerService.updateReferral(id, req.user.id, dto, await this.inst(req));
  }

  @Get('referrals/by-student/:studentEnrollmentId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getReferralsByStudent(@Request() req, @Param('studentEnrollmentId') studentEnrollmentId: string) {
    return this.observerService.getReferralsByStudent(studentEnrollmentId, await this.inst(req));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MEDIDAS PEDAGÓGICAS
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('measures')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async createMeasure(@Request() req, @Body() dto: CreateMeasureDto) {
    return this.observerService.createMeasure(req.user.id, dto, await this.inst(req));
  }

  @Put('measures/:id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async updateMeasure(@Request() req, @Param('id') id: string, @Body() dto: UpdateMeasureDto) {
    return this.observerService.updateMeasure(id, dto, await this.inst(req));
  }
}
