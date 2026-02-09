import { Controller, Post, Put, Get, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ObserverService } from './observer.service';
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

@Controller('observer')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ObserverController {
  constructor(private readonly observerService: ObserverService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // OBSERVACIONES
  // ═══════════════════════════════════════════════════════════════════════════

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  create(@Request() req, @Body() dto: CreateObservationDto) {
    return this.observerService.create(req.user.id, dto);
  }

  @Put(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  update(@Param('id') id: string, @Body() dto: UpdateObservationDto) {
    return this.observerService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  delete(@Param('id') id: string) {
    return this.observerService.delete(id);
  }

  @Get('dashboard')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  getDashboard(@Request() req, @Query('academicYearId') academicYearId: string) {
    return this.observerService.getDashboard(req.user.institutionId, academicYearId);
  }

  @Get('pending-followups')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  getPendingFollowUps(@Request() req, @Query('all') all?: string) {
    const authorId = all === 'true' ? undefined : req.user.id;
    return this.observerService.getPendingFollowUps(authorId);
  }

  @Get('by-group/:groupId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  getByGroup(
    @Param('groupId') groupId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    return this.observerService.getByGroup(groupId, academicYearId, { type, status });
  }

  @Get('by-student/:studentEnrollmentId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE')
  getByStudent(
    @Param('studentEnrollmentId') studentEnrollmentId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('type') type?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
  ) {
    return this.observerService.getByStudent(studentEnrollmentId, { startDate, endDate, type, category, status });
  }

  @Get('timeline/:studentEnrollmentId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE')
  getStudentTimeline(@Param('studentEnrollmentId') studentEnrollmentId: string) {
    return this.observerService.getStudentTimeline(studentEnrollmentId);
  }

  @Get('summary/:studentEnrollmentId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE')
  getStudentSummary(@Param('studentEnrollmentId') studentEnrollmentId: string) {
    return this.observerService.getStudentSummary(studentEnrollmentId);
  }

  @Get(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE')
  getById(@Param('id') id: string) {
    return this.observerService.getById(id);
  }

  @Put(':id/notify-parent')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  markParentNotified(@Param('id') id: string) {
    return this.observerService.markParentNotified(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTAS
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('actas')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  createActa(@Body() dto: CreateActaDto) {
    return this.observerService.createActa(dto);
  }

  @Put('actas/:id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  updateActa(@Param('id') id: string, @Body() data: any) {
    return this.observerService.updateActa(id, data);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPROMISOS
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('commitments')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  createCommitment(@Request() req, @Body() dto: CreateCommitmentDto) {
    return this.observerService.createCommitment(req.user.id, dto);
  }

  @Put('commitments/:id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  updateCommitment(@Request() req, @Param('id') id: string, @Body() dto: UpdateCommitmentDto) {
    return this.observerService.updateCommitment(id, req.user.id, dto);
  }

  @Get('commitments/by-student/:studentEnrollmentId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE')
  getCommitmentsByStudent(@Param('studentEnrollmentId') studentEnrollmentId: string) {
    return this.observerService.getCommitmentsByStudent(studentEnrollmentId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CITACIONES
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('citations')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  createCitation(@Request() req, @Body() dto: CreateCitationDto) {
    return this.observerService.createCitation(req.user.id, dto);
  }

  @Put('citations/:id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  updateCitation(@Param('id') id: string, @Body() dto: UpdateCitationDto) {
    return this.observerService.updateCitation(id, dto);
  }

  @Get('citations/by-student/:studentEnrollmentId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  getCitationsByStudent(@Param('studentEnrollmentId') studentEnrollmentId: string) {
    return this.observerService.getCitationsByStudent(studentEnrollmentId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REMISIONES
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('referrals')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  createReferral(@Request() req, @Body() dto: CreateReferralDto) {
    return this.observerService.createReferral(req.user.id, dto);
  }

  @Put('referrals/:id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  updateReferral(@Request() req, @Param('id') id: string, @Body() dto: UpdateReferralDto) {
    return this.observerService.updateReferral(id, req.user.id, dto);
  }

  @Get('referrals/by-student/:studentEnrollmentId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  getReferralsByStudent(@Param('studentEnrollmentId') studentEnrollmentId: string) {
    return this.observerService.getReferralsByStudent(studentEnrollmentId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MEDIDAS PEDAGÓGICAS
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('measures')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  createMeasure(@Request() req, @Body() dto: CreateMeasureDto) {
    return this.observerService.createMeasure(req.user.id, dto);
  }

  @Put('measures/:id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  updateMeasure(@Param('id') id: string, @Body() dto: UpdateMeasureDto) {
    return this.observerService.updateMeasure(id, dto);
  }
}
