import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AchievementService } from './achievement.service';
import { AchievementConfigService } from './achievement-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';

@Controller('achievements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AchievementController {
  constructor(
    private readonly achievementService: AchievementService,
    private readonly configService: AchievementConfigService,
    // A-1/A-2/A-3: necesario para resolver la institución del actor en servidor.
    private readonly prisma: PrismaService,
  ) {}

  /** Extrae el actor (quién hace el cambio) del JWT para la auditoría E-5. */
  private actorFrom(req: any): { userId?: string; name?: string; role?: string } {
    const roles = req?.user?.roles;
    const role = Array.isArray(roles)
      ? roles.map((r: any) => (typeof r === 'string' ? r : r?.role?.name || r?.roleName || r?.name)).filter(Boolean).join(', ')
      : undefined;
    return { userId: req?.user?.id, name: req?.user?.email, role: role || undefined };
  }

  private canManageCatalog(req: any) {
    if (req.user?.isSuperAdmin) return true;
    const roles = (req.user?.roles ?? []).map((role: any) => typeof role === 'string' ? role : role?.role?.name ?? role?.name);
    return roles.some((role: string) => ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR'].includes(role));
  }

  // ============================================
  // CONFIGURATION (Admin/Coordinator only)
  // ============================================

  @Get('config/:institutionId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getConfig(@Param('institutionId') institutionId: string, @Request() req: any) {
    // A-17: el institutionId del path se conserva en el contrato pero NO autoriza.
    const instId = await requireInstitutionId(this.prisma as any, req);
    try {
      return await this.configService.getConfig(instId);
    } catch (error) {
      console.error('[AchievementController] Error getting config:', error);
      throw error;
    }
  }

  @Put('config')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async upsertConfig(
    @Body()
    body: {
      institutionId: string;
      achievementsPerPeriod?: number;
      usePromotionalAchievement?: boolean;
      useAttitudinalAchievement?: boolean;
      attitudinalMode?: 'GENERAL_PER_PERIOD' | 'PER_ACADEMIC_ACHIEVEMENT';
      useValueJudgments?: boolean;
      descriptorMode?: 'FREE' | 'DESCRIPTOR_PER_LEVEL';
      useObservations?: boolean;
      displayMode?: 'SEPARATE' | 'COMBINED';
      displayFormat?: 'LIST' | 'PARAGRAPH';
      judgmentPosition?: 'END_OF_EACH' | 'END_OF_ALL' | 'NONE';
      registrationModel?: 'LEARNING_ONLY' | 'LEARNING_AND_EVIDENCE';
      showLearningInReport?: boolean;
      showEvidencesInReport?: boolean;
      showLevelDescriptorInReport?: boolean;
      showJudgmentInReport?: boolean;
      reportLearningGranularity?: 'PRIMARY_ONLY' | 'ALL';
      learningLabelSingular?: string;
      learningLabelPlural?: string;
      evidenceLabelSingular?: string;
      evidenceLabelPlural?: string;
      learningCatalogMode?: 'TEACHER_MANAGED' | 'ADMIN_FIXED';
      valuationScope?: 'PURPOSE' | 'EVIDENCE';
    },
    @Request() req: any,
  ) {
    // A-13: body.institutionId permanece en el contrato pero NO autoriza.
    const instId = await requireInstitutionId(this.prisma as any, req);
    try {
      return await this.configService.upsertConfig({ ...body, institutionId: instId });
    } catch (error) {
      console.error('[AchievementController] Error upserting config:', error);
      throw error;
    }
  }

  @Get('config/:institutionId/templates')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getValueJudgmentTemplates(@Param('institutionId') institutionId: string, @Request() req: any) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.configService.getValueJudgmentTemplates(instId);
  }

  @Put('config/templates')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async bulkUpsertTemplates(
    @Body()
    body: {
      institutionId: string;
      templates: Array<{
        level: 'SUPERIOR' | 'ALTO' | 'BASICO' | 'BAJO';
        template: string;
        isActive?: boolean;
      }>;
    },
    @Request() req: any,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.configService.bulkUpsertValueJudgmentTemplates(
      instId,
      body.templates,
    );
  }

  @Post('config/:institutionId/templates/defaults')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async createDefaultTemplates(@Param('institutionId') institutionId: string, @Request() req: any) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.configService.createDefaultTemplates(instId);
  }

  // ============================================
  // OBSERVATION TEMPLATES (Admin/Coordinator)
  // ============================================

  @Get('config/:institutionId/observation-templates')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getObservationTemplates(@Param('institutionId') institutionId: string, @Request() req: any) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.configService.getObservationTemplates(instId);
  }

  @Put('config/observation-templates')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async bulkUpsertObservationTemplates(
    @Body()
    body: {
      institutionId: string;
      templates: Array<{
        level: 'SUPERIOR' | 'ALTO' | 'BASICO' | 'BAJO';
        template: string;
        isActive?: boolean;
      }>;
    },
    @Request() req: any,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.configService.bulkUpsertObservationTemplates(
      instId,
      body.templates,
    );
  }

  @Post('config/:institutionId/observation-templates/defaults')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async createDefaultObservationTemplates(@Param('institutionId') institutionId: string, @Request() req: any) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.configService.createDefaultObservationTemplates(instId);
  }

  // ============================================
  // CATÁLOGO COMPARTIDO DE TRANSICIÓN (Admin)
  // ============================================

  @Get('catalog')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getCatalogAchievements(
    @Query() query: { institutionId: string; gradeId: string; subjectId: string; academicYearId: string; academicTermId?: string },
    @Request() req: any,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.achievementService.getCatalogAchievements(query, instId);
  }

  @Post('catalog')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async createCatalogAchievement(
    @Body() body: {
      institutionId: string;
      gradeId: string;
      subjectId: string;
      academicYearId: string;
      academicTermId?: string;
      baseDescription: string;
      evidences?: Array<{ text: string }>;
      levelDescriptors?: Array<{ levelCode: string; text: string }>;
    },
    @Request() req: any,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.achievementService.createCatalogAchievement(body, instId);
  }

  // ============================================
  // CONVIVENCIA (desempeños libres del docente con valoración individual)
  // ============================================

  @Get('convivencia')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getConvivencia(
    @Query('teacherAssignmentId') teacherAssignmentId: string,
    @Query('academicTermId') academicTermId: string,
    @Request() req: any,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.achievementService.getConvivenciaByAssignment(teacherAssignmentId, academicTermId, instId);
  }

  @Put('convivencia')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async upsertConvivencia(
    @Request() req: any,
    @Body() body: { studentEnrollmentId: string; academicTermId: string; subjectId: string; text: string; items?: Array<{ text: string; level?: string | null }> },
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.achievementService.upsertConvivenciaEntry({ ...body, createdById: req.user?.id }, instId);
  }

  // ============================================
  // VALORACIÓN POR IMPRESCINDIBLE (modo EVIDENCE)
  // ============================================

  @Get('evidence-valuations')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getEvidenceValuations(
    @Query('teacherAssignmentId') teacherAssignmentId: string,
    @Query('academicTermId') academicTermId: string,
    @Request() req: any,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.achievementService.getEvidenceValuationsByAssignment(teacherAssignmentId, academicTermId, instId);
  }

  @Put('evidence-valuations')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async upsertEvidenceValuation(
    @Request() req: any,
    @Body() body: { studentEnrollmentId: string; achievementEvidenceId: string; academicTermId: string; performanceLevel: any; observation?: string | null },
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.achievementService.upsertEvidenceValuation({ ...body, createdById: req.user?.id }, instId);
  }

  @Delete('evidence-valuations')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async deleteEvidenceValuation(
    @Request() req: any,
    @Query('studentEnrollmentId') studentEnrollmentId: string,
    @Query('achievementEvidenceId') achievementEvidenceId: string,
    @Query('academicTermId') academicTermId: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.achievementService.deleteEvidenceValuation(
      studentEnrollmentId,
      achievementEvidenceId,
      academicTermId,
      instId,
    );
  }

  // ============================================
  // ACHIEVEMENTS (Teacher)
  // ============================================

  @Get('by-assignment')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getAchievementsByAssignment(
    @Query('teacherAssignmentId') teacherAssignmentId: string,
    @Query('academicTermId') academicTermId: string,
    @Request() req: any,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.achievementService.getAchievementsByAssignment(
      teacherAssignmentId,
      academicTermId,
      instId,
    );
  }

  @Get('promotional/:teacherAssignmentId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getPromotionalAchievements(
    @Param('teacherAssignmentId') teacherAssignmentId: string,
    @Request() req: any,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.achievementService.getPromotionalAchievements(teacherAssignmentId, instId);
  }

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async createAchievement(
    @Body()
    body: {
      teacherAssignmentId: string;
      academicTermId: string;
      orderNumber: number;
      baseDescription: string;
      isPromotional?: boolean;
      levelDescriptors?: Array<{ levelCode: string; text: string }>;
      evidences?: Array<{ text: string }>;
    },
  ) {
    return this.achievementService.createAchievement(body);
  }

  @Put(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async updateAchievement(
    @Param('id') id: string,
    // `evidences[].id` es la clave de la reconciliación: si viene, la evidencia se
    // actualiza conservando su id (y con él las valoraciones históricas que la referencian).
    @Body() body: { baseDescription: string; levelDescriptors?: Array<{ levelCode: string; text: string }>; evidences?: Array<{ id?: string; text: string }> },
    @Request() req: any,
  ) {
    return this.achievementService.updateAchievement(id, body, this.canManageCatalog(req));
  }

  @Post(':id/duplicate')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async duplicateAchievement(@Param('id') id: string) {
    return this.achievementService.duplicateAchievement(id);
  }

  @Delete(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async deleteAchievement(@Param('id') id: string, @Request() req: any) {
    return this.achievementService.deleteAchievement(id, this.canManageCatalog(req));
  }

  // ============================================
  // EVIDENCIAS DE APRENDIZAJE
  // ============================================

  @Post(':id/evidences')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async createEvidence(@Param('id') achievementId: string, @Body() body: { text: string }, @Request() req: any) {
    return this.achievementService.createEvidence(achievementId, body.text, this.canManageCatalog(req));
  }

  @Put(':id/evidences/reorder')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async reorderEvidences(@Param('id') achievementId: string, @Body() body: { orderedIds: string[] }, @Request() req: any) {
    return this.achievementService.reorderEvidences(achievementId, body.orderedIds, this.canManageCatalog(req));
  }

  // Corrección de contenido. El estado de retiro NO se toca aquí: `isActive` dejó de
  // aceptarse (D-12); para retirar o reactivar hay acciones explícitas más abajo.
  @Put('evidences/:evidenceId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async updateEvidence(@Param('evidenceId') evidenceId: string, @Body() body: { text?: string }, @Request() req: any) {
    return this.achievementService.updateEvidence(evidenceId, body, this.canManageCatalog(req));
  }

  // ── Retiro lógico y prospectivo (D-12) ────────────────────────────────────
  // El período se recibe EXPLÍCITAMENTE del cliente: el modelo no tiene concepto de
  // "período en curso" y toda la aplicación trabaja con un período seleccionado.

  @Put('evidences/:evidenceId/retire')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async retireEvidence(
    @Param('evidenceId') evidenceId: string,
    @Body() body: { academicTermId: string; reason?: string },
    @Request() req: any,
  ) {
    return this.achievementService.retireEvidence(evidenceId, body, this.actorFrom(req), this.canManageCatalog(req));
  }

  @Put('evidences/:evidenceId/reactivate')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async reactivateEvidence(
    @Param('evidenceId') evidenceId: string,
    @Body() body: { reason?: string },
    @Request() req: any,
  ) {
    return this.achievementService.reactivateEvidence(evidenceId, body ?? {}, this.actorFrom(req), this.canManageCatalog(req));
  }

  @Delete('evidences/:evidenceId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async deleteEvidence(@Param('evidenceId') evidenceId: string, @Request() req: any) {
    return this.achievementService.deleteEvidence(evidenceId, this.canManageCatalog(req));
  }

  // ============================================
  // ATTITUDINAL ACHIEVEMENTS
  // ============================================

  @Get('attitudinal')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getAttitudinalAchievements(
    @Query('teacherAssignmentId') teacherAssignmentId: string,
    @Query('academicTermId') academicTermId: string,
    @Request() req: any,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.achievementService.getAttitudinalAchievements(
      teacherAssignmentId,
      academicTermId,
      instId,
    );
  }

  @Put('attitudinal')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async upsertAttitudinalAchievement(
    @Body()
    body: {
      teacherAssignmentId: string;
      academicTermId: string;
      achievementId?: string;
      description: string;
    },
  ) {
    return this.achievementService.upsertAttitudinalAchievement(body);
  }

  // ============================================
  // STUDENT ACHIEVEMENTS
  // ============================================

  @Get('students/:achievementId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getStudentAchievements(@Param('achievementId') achievementId: string, @Request() req: any) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.achievementService.getStudentAchievements(achievementId, instId);
  }

  @Get('by-enrollment/:studentEnrollmentId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getStudentAchievementsByEnrollment(
    @Param('studentEnrollmentId') studentEnrollmentId: string,
    @Request() req: any,
    @Query('academicTermId') academicTermId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.achievementService.getStudentAchievementsByEnrollment(
      studentEnrollmentId,
      academicTermId,
      instId,
    );
  }

  @Post('students/generate-suggestions')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async bulkGenerateSuggestions(
    @Body()
    body: {
      achievementId: string;
      institutionId: string;
      studentGrades: Array<{
        studentEnrollmentId: string;
        finalGrade: number;
      }>;
      academicTermId?: string;
    },
    @Request() req: any,
  ) {
    // body.institutionId se conserva en el contrato pero NO autoriza.
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.achievementService.bulkGenerateSuggestions(
      body.achievementId,
      instId,
      body.studentGrades,
      body.academicTermId,
    );
  }

  @Post('students/bulk-assign')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async bulkAssignAchievement(
    @Body()
    body: {
      achievementId: string;
      studentEnrollmentIds: string[];
      institutionId: string;
      academicTermId?: string;
    },
    @Request() req: any,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.achievementService.bulkAssignAchievement(
      body.achievementId,
      body.studentEnrollmentIds,
      instId,
      body.academicTermId,
    );
  }

  @Post('students/auto-fill-observations')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async autoFillObservations(
    @Body()
    body: {
      achievementId: string;
      institutionId: string;
    },
    @Request() req: any,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.achievementService.autoFillObservations(
      body.achievementId,
      instId,
    );
  }

  @Put('students/:id/observation')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async updateStudentObservation(
    @Param('id') id: string,
    @Body() body: { observation: string },
    @Request() req: any,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.achievementService.updateStudentObservation(id, body.observation, instId);
  }

  @Put('students/:id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async upsertStudentAchievement(
    @Param('id') id: string,
    @Body()
    body: {
      studentEnrollmentId: string;
      achievementId: string;
      academicTermId?: string;
      performanceLevel: 'BAJO' | 'BASICO' | 'ALTO' | 'SUPERIOR';
      suggestedText?: string;
      approvedText?: string;
      isTextApproved?: boolean;
      suggestedJudgment?: string;
      approvedJudgment?: string;
      isJudgmentApproved?: boolean;
      attitudinalText?: string;
      observation?: string;
    },
    @Request() req: any,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.achievementService.upsertStudentAchievement({
      ...body,
      approvedById: req.user?.id,
    }, instId);
  }

  @Post('students/:id/approve')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async approveStudentAchievement(
    @Param('id') id: string,
    @Body()
    body: {
      approvedText: string;
      approvedJudgment?: string;
    },
    @Request() req: any,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.achievementService.approveStudentAchievement(id, req.user.id, body, instId);
  }

  // ============================================
  // VALIDATION
  // ============================================

  @Get('validate')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async validatePeriodAchievements(
    @Query('teacherAssignmentId') teacherAssignmentId: string,
    @Query('academicTermId') academicTermId: string,
    @Query('requiredCount') requiredCount: string,
    @Request() req: any,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.achievementService.validatePeriodAchievements(
      teacherAssignmentId,
      academicTermId,
      parseInt(requiredCount) || 1,
      instId,
    );
  }

  @Get('unapproved')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getUnapprovedStudentAchievements(
    @Query('teacherAssignmentId') teacherAssignmentId: string,
    @Query('academicTermId') academicTermId: string,
    @Request() req: any,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.achievementService.getUnapprovedStudentAchievements(
      teacherAssignmentId,
      academicTermId,
      instId,
    );
  }
}
