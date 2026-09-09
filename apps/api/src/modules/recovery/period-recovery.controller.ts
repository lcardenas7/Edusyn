import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PeriodRecoveryService } from './period-recovery.service';
import { RecoverySnapshotService } from './recovery-snapshot.service';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';
import { actorFromRequest } from '../evaluation/grade-audit-actor.util';

@Controller('period-recovery')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PeriodRecoveryController {
  constructor(
    private readonly periodRecoveryService: PeriodRecoveryService,
    private readonly snapshotService: RecoverySnapshotService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('detect')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async detectStudentsNeedingRecovery(
    @Req() req: any,
    @Query('academicTermId') academicTermId: string,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.periodRecoveryService.detectStudentsNeedingRecovery(academicTermId, instId);
  }

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async create(@Body() data: any, @Req() req: any) {
    // El cuerpo NO decide la institución: se resuelve del actor y el servicio comprueba que la
    // matrícula y el período le pertenezcan.
    const instId = await requireInstitutionId(this.prisma as any, req, data?.institutionId);
    return this.periodRecoveryService.create({
      ...data,
      assignedById: req.user.id,
    }, instId);
  }

  @Get('by-term')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async findByTerm(
    @Req() req: any,
    @Query('academicTermId') academicTermId: string,
    @Query('status') status?: string,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.periodRecoveryService.findByTerm(academicTermId, status as any, instId);
  }

  @Get('by-student/:studentEnrollmentId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async findByStudent(
    @Param('studentEnrollmentId') studentEnrollmentId: string,
    @Req() req: any,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.periodRecoveryService.findByStudent(studentEnrollmentId, instId);
  }

  @Patch(':id/activity')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async updateActivity(
    @Param('id') id: string,
    @Body() data: any,
    @Req() req: any,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.periodRecoveryService.updateActivity(id, data, instId);
  }

  @Patch(':id/result')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async registerResult(
    @Param('id') id: string,
    @Body() data: any,
    @Req() req: any,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.periodRecoveryService.registerResult(
      id,
      { ...data, evaluatedById: req.user.id },
      instId,
      // Quién registra el resultado: la nota final que se propague debe
      // atribuirse a esta persona, no al sistema.
      actorFromRequest(req),
    );
  }

  @Patch(':id/review')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async reviewResult(
    @Param('id') id: string,
    @Body() data: any,
    @Req() req: any,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.periodRecoveryService.reviewResult(
      id,
      { ...data, reviewedById: req.user.id },
      instId,
      // Quién aprueba: la nota final que se propague debe atribuirse a esta
      // persona, no al sistema.
      actorFromRequest(req),
    );
  }

  @Get('stats')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getStats(
    @Query('academicTermId') academicTermId: string,
    @Req() req: any,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.periodRecoveryService.getRecoveryStats(academicTermId, instId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GESTIÓN DE SNAPSHOTS DE RECUPERACIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Obtiene el estado actual del proceso de recuperación de un período
   */
  @Get('snapshot-status')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getRecoveryStatus(
    @Req() req: any,
    @Query('academicTermId') academicTermId: string,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.snapshotService.getRecoveryStatus(academicTermId, instId);
  }

  /**
   * Obtiene el flujo de trabajo completo para mostrar en UI
   */
  @Get('workflow')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getRecoveryWorkflow(
    @Req() req: any,
    @Query('academicTermId') academicTermId: string,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.snapshotService.getRecoveryWorkflow(academicTermId, instId);
  }

  /**
   * Cierra la ventana de recuperación de un período
   */
  @Post('close-window')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async closeRecoveryWindow(
    @Body() data: { academicTermId: string; force?: boolean; institutionId?: string },
    @Req() req: any,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, data?.institutionId);
    return this.snapshotService.closeRecoveryWindow(
      data.academicTermId,
      req.user.id,
      data.force || false,
      instId,
    );
  }

  /**
   * Crea snapshots POST_RECOVERY para actualizar boletines
   */
  @Post('create-snapshot')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async createPostRecoverySnapshots(
    @Body() data: { academicTermId: string; institutionId?: string },
    @Req() req: any,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, data?.institutionId);
    return this.snapshotService.createPostRecoverySnapshots(
      data.academicTermId,
      req.user.id,
      instId,
    );
  }

  /**
   * Finaliza el proceso de recuperación del período
   */
  @Post('finalize')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async finalizeRecoveryProcess(
    @Body() data: { academicTermId: string; institutionId?: string },
    @Req() req: any,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, data?.institutionId);
    return this.snapshotService.finalizeRecoveryProcess(data.academicTermId, instId);
  }

  /**
   * Compara snapshots inicial y POST_RECOVERY de un estudiante
   */
  @Get('compare-snapshots')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async compareSnapshots(
    @Req() req: any,
    @Query('academicTermId') academicTermId: string,
    @Query('studentEnrollmentId') studentEnrollmentId: string,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.snapshotService.compareSnapshots(academicTermId, studentEnrollmentId, instId);
  }
}
