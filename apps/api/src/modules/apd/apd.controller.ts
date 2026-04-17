import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SkipTenantCheck } from '../auth/decorators/skip-tenant-check.decorator';
import { ApdService } from './apd.service';
import { ApdAlertsService } from './apd-alerts.service';
import { ApdAcademicService } from './apd-academic.service';
import { ApdAiService } from './ai/apd-ai.service';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';

/**
 * CONTROLADOR APD — Acompañamiento Pedagógico Diferencial
 * 
 * Roles permitidos:
 * - SUPERADMIN, ADMIN_INSTITUTIONAL: acceso total
 * - COORDINADOR, RECTOR, PSICOLOGA: acceso total dentro de su institución
 * - DOCENTE: acceso condicionado a allowTeacherAccess de la institución
 */
@Controller('apd')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApdController {
  constructor(
    private readonly apdService: ApdService,
    private readonly alertsService: ApdAlertsService,
    private readonly academicService: ApdAcademicService,
    private readonly apdAiService: ApdAiService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Valida que un docente tenga acceso al módulo APD.
   * Si el usuario es DOCENTE y la institución no permite acceso docente, lanza error.
   */
  private async validateTeacherAccess(req: any, institutionId: string) {
    const roles: string[] = req.user?.roles || [];
    const isTeacher = roles.includes('DOCENTE') && !roles.some((r: string) =>
      ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'PSICOLOGA'].includes(r),
    );

    if (isTeacher) {
      const config = await this.apdService.getInstitutionConfig(institutionId);
      if (!config?.allowTeacherAccess) {
        throw new ForbiddenException(
          'Los docentes no tienen acceso al módulo APD en esta institución.',
        );
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURACIÓN INSTITUCIONAL
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('config')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR')
  async getConfig(
    @Request() req: any,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.apdService.getInstitutionConfig(instId);
  }

  @Put('config')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'RECTOR')
  async updateConfig(
    @Request() req: any,
    @Body() body: { enableDifferentialSupport?: boolean; allowTeacherAccess?: boolean; institutionId?: string },
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, body.institutionId);
    return this.apdService.updateInstitutionConfig(instId, {
      enableDifferentialSupport: body.enableDifferentialSupport,
      allowTeacherAccess: body.allowTeacherAccess,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERFILES DE ACOMPAÑAMIENTO
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('profiles')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'PSICOLOGA', 'DOCENTE')
  async createProfile(
    @Request() req: any,
    @Body() body: {
      institutionId?: string;
      studentId: string;
      supportCategory: string;
      supportCategoryId?: string;
      pedagogicalNotes?: string;
      learningBarriers?: string;
      strengths?: string;
      supportNeeds?: string;
      learningStyleObservations?: string;
      parentConsentAccepted?: boolean;
      consentDate?: string;
      consentDocumentUrl?: string;
    },
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, body.institutionId);
    await this.validateTeacherAccess(req, instId);
    return this.apdService.createProfile(
      { ...body, institutionId: instId },
      req.user.id,
    );
  }

  @Put('profiles/:id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'PSICOLOGA', 'DOCENTE')
  async updateProfile(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: {
      institutionId?: string;
      supportCategory?: string;
      supportCategoryId?: string;
      pedagogicalNotes?: string;
      learningBarriers?: string;
      strengths?: string;
      supportNeeds?: string;
      learningStyleObservations?: string;
      parentConsentAccepted?: boolean;
      consentDate?: string;
      consentDocumentUrl?: string;
      active?: boolean;
    },
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, body.institutionId);
    await this.validateTeacherAccess(req, instId);
    return this.apdService.updateProfile(id, instId, body, req.user.id);
  }

  @Get('profiles/:id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'PSICOLOGA', 'DOCENTE')
  async getProfile(
    @Request() req: any,
    @Param('id') id: string,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    await this.validateTeacherAccess(req, instId);
    return this.apdService.getProfile(id, instId, req.user.id);
  }

  @Get('profiles/by-student/:studentId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'PSICOLOGA', 'DOCENTE')
  async getProfileByStudent(
    @Request() req: any,
    @Param('studentId') studentId: string,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    await this.validateTeacherAccess(req, instId);
    return this.apdService.getProfileByStudent(studentId, instId);
  }

  @Get('profiles')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'PSICOLOGA', 'DOCENTE')
  async getProfiles(
    @Request() req: any,
    @Query('institutionId') institutionId?: string,
    @Query('active') active?: string,
    @Query('search') search?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    await this.validateTeacherAccess(req, instId);
    return this.apdService.getProfilesByInstitution(instId, {
      active: active !== undefined ? active === 'true' : undefined,
      search: search || undefined,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PLANES DE ACOMPAÑAMIENTO
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('plans')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'PSICOLOGA', 'DOCENTE')
  async createPlan(
    @Request() req: any,
    @Body() body: {
      institutionId?: string;
      studentEnrollmentId: string;
      academicTermId: string;
      supportProfileId?: string;
      achievementId?: string;
      planType?: 'APD' | 'PIAR';
      supportStrategy: string;
      familyCommitment?: string;
      followUpDate?: string;
      observations?: string;
      objectives?: any;
      adaptationStrategies?: any;
      evaluationAdjustments?: any;
      planApprovedByFamily?: boolean;
      familyApprovalDate?: string;
      familySignatureUrl?: string;
    },
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, body.institutionId);
    await this.validateTeacherAccess(req, instId);
    return this.apdService.createPlan(
      { ...body, institutionId: instId },
      req.user.id,
    );
  }

  @Put('plans/:id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'PSICOLOGA', 'DOCENTE')
  async updatePlan(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: {
      institutionId?: string;
      planType?: 'APD' | 'PIAR';
      supportStrategy?: string;
      familyCommitment?: string;
      followUpDate?: string;
      observations?: string;
      objectives?: any;
      adaptationStrategies?: any;
      evaluationAdjustments?: any;
      planApprovedByFamily?: boolean;
      familyApprovalDate?: string;
      familySignatureUrl?: string;
      status?: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
    },
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, body.institutionId);
    await this.validateTeacherAccess(req, instId);
    return this.apdService.updatePlan(id, instId, body, req.user.id);
  }

  @Get('plans/:id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'PSICOLOGA', 'DOCENTE')
  async getPlan(
    @Request() req: any,
    @Param('id') id: string,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    await this.validateTeacherAccess(req, instId);
    return this.apdService.getPlan(id, instId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIVIDADES
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('activities')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'PSICOLOGA', 'DOCENTE')
  async createActivity(
    @Request() req: any,
    @Body() body: {
      institutionId?: string;
      supportPlanId: string;
      topic: string;
      originalActivityDescription?: string;
      teacherFinalActivity?: string;
      adaptationLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
      adjustmentType?: 'CURRICULAR' | 'METHODOLOGICAL' | 'EVALUATIVE' | 'COMMUNICATION' | 'ENVIRONMENTAL';
    },
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, body.institutionId);
    await this.validateTeacherAccess(req, instId);
    return this.apdService.createActivity(body, instId, req.user.id);
  }

  @Put('activities/:id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'PSICOLOGA', 'DOCENTE')
  async updateActivity(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: {
      institutionId?: string;
      topic?: string;
      originalActivityDescription?: string;
      teacherFinalActivity?: string;
      adaptationLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
      adjustmentType?: 'CURRICULAR' | 'METHODOLOGICAL' | 'EVALUATIVE' | 'COMMUNICATION' | 'ENVIRONMENTAL';
      completionStatus?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
      teacherFeedback?: string;
      studentPerformanceScore?: number;
    },
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, body.institutionId);
    await this.validateTeacherAccess(req, instId);
    return this.apdService.updateActivity(id, instId, body, req.user.id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGS DE PROGRESO
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('progress-logs')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'PSICOLOGA', 'DOCENTE')
  async createProgressLog(
    @Request() req: any,
    @Body() body: {
      institutionId?: string;
      supportPlanId: string;
      progressIndicator: number;
      qualitativeObservation?: string;
    },
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, body.institutionId);
    await this.validateTeacherAccess(req, instId);
    return this.apdService.createProgressLog(body, instId, req.user.id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORÍAS DE ACOMPAÑAMIENTO (configurables)
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('categories')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'PSICOLOGA', 'DOCENTE')
  async getCategories(
    @Request() req: any,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.apdService.getCategories(instId);
  }

  @Post('categories')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'RECTOR')
  async createCategory(
    @Request() req: any,
    @Body() body: { institutionId?: string; name: string; description?: string; sortOrder?: number },
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, body.institutionId);
    return this.apdService.createCategory(instId, body);
  }

  @Put('categories/:id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'RECTOR')
  async updateCategory(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { institutionId?: string; name?: string; description?: string; active?: boolean; sortOrder?: number },
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, body.institutionId);
    return this.apdService.updateCategory(id, instId, body);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PARTICIPANTES DEL PLAN (equipo interdisciplinario)
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('participants')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'PSICOLOGA', 'DOCENTE')
  async addParticipant(
    @Request() req: any,
    @Body() body: {
      institutionId?: string;
      supportPlanId: string;
      userId?: string;
      role: 'TEACHER' | 'COUNSELOR' | 'COORDINATOR' | 'FAMILY_MEMBER' | 'EXTERNAL_SPECIALIST';
      fullName?: string;
      relationship?: string;
      observations?: string;
    },
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, body.institutionId);
    await this.validateTeacherAccess(req, instId);
    return this.apdService.addParticipant(body, instId, req.user.id);
  }

  @Delete('participants/:id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'PSICOLOGA')
  async removeParticipant(
    @Request() req: any,
    @Param('id') id: string,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.apdService.removeParticipant(id, instId);
  }

  @Put('participants/:id/sign')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'PSICOLOGA', 'DOCENTE')
  async signParticipant(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { institutionId?: string; signatureUrl?: string },
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, body.institutionId);
    return this.apdService.signParticipant(id, instId, body);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ASIGNATURAS VINCULADAS AL PLAN
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('plan-subjects')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'PSICOLOGA', 'DOCENTE')
  async addPlanSubject(
    @Request() req: any,
    @Body() body: {
      institutionId?: string;
      supportPlanId: string;
      subjectId: string;
      teacherId?: string;
      specificNotes?: string;
    },
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, body.institutionId);
    await this.validateTeacherAccess(req, instId);
    return this.apdService.addPlanSubject(body, instId);
  }

  @Delete('plan-subjects/:id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'PSICOLOGA')
  async removePlanSubject(
    @Request() req: any,
    @Param('id') id: string,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.apdService.removePlanSubject(id, instId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DOCUMENTOS DE SOPORTE
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('documents')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'PSICOLOGA', 'DOCENTE')
  async addDocument(
    @Request() req: any,
    @Body() body: {
      institutionId?: string;
      supportPlanId: string;
      type: 'EVIDENCE' | 'FAMILY_DOCUMENT' | 'ASSESSMENT' | 'REPORT';
      fileName: string;
      fileUrl: string;
      description?: string;
    },
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, body.institutionId);
    await this.validateTeacherAccess(req, instId);
    return this.apdService.addDocument(body, instId, req.user.id);
  }

  @Delete('documents/:id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'PSICOLOGA')
  async removeDocument(
    @Request() req: any,
    @Param('id') id: string,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.apdService.removeDocument(id, instId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORTES APD / PIAR + ÍNDICE DE INCLUSIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('reports/category')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'PSICOLOGA')
  async getReportByCategory(
    @Request() req: any,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.apdService.getReportByCategory(instId);
  }

  @Get('reports/progress')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'PSICOLOGA')
  async getReportProgress(
    @Request() req: any,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.apdService.getReportProgress(instId);
  }

  @Get('reports/grades')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'PSICOLOGA')
  async getReportByGrade(
    @Request() req: any,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.apdService.getReportByGrade(instId);
  }

  @Get('reports/at-risk')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'PSICOLOGA')
  async getReportAtRisk(
    @Request() req: any,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.apdService.getReportAtRisk(instId);
  }

  @Get('inclusion-index')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR')
  async getInclusionIndex(
    @Request() req: any,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.apdService.getInclusionIndex(instId);
  }

  /**
   * Estadísticas de diagnóstico vs perfiles vs planes.
   * Muestra el funnel: Diagnóstico → Perfil APD → Plan Activo
   */
  @Get('diagnosis-stats')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'PSICOLOGA')
  async getDiagnosisStats(
    @Request() req: any,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.apdService.getDiagnosisStats(instId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ALERTAS AUTOMÁTICAS
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('alerts')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'PSICOLOGA', 'DOCENTE')
  async getAlerts(
    @Request() req: any,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    await this.validateTeacherAccess(req, instId);
    return this.alertsService.getAlerts(instId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CRUCE RENDIMIENTO ACADÉMICO VS APD
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('academic-crossover')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'PSICOLOGA')
  async getAcademicCrossover(
    @Request() req: any,
    @Query('institutionId') institutionId?: string,
    @Query('academicTermId') academicTermId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.academicService.getAcademicCrossover(instId, academicTermId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VALERIA AI
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('ai/valeria')
  @SkipTenantCheck()
  @Roles(
    'SUPERADMIN',
    'SUPER_ADMIN',
    'ADMIN_INSTITUTIONAL',
    'ADMIN',
    'COORDINADOR',
    'RECTOR',
    'PSICOLOGA',
    'DOCENTE',
    'ESTUDIANTE',
    'ACUDIENTE',
    'SECRETARIA',
    'ORIENTADOR',
    'BIBLIOTECARIO',
    'AUXILIAR',
    'AUXILIAR_CONTABLE',
  )
  async askValeria(
    @Request() req: any,
    @Body() body: {
      institutionId?: string;
      question: string;
      conversation?: {
        role: 'user' | 'assistant';
        content: string;
      }[];
      context?: {
        institutionName?: string;
        pageName?: string;
        pageSummary?: string;
        currentPath?: string;
        gradeName?: string;
        subjectName?: string;
        topic?: string;
        activityType?: 'QUIZ' | 'EXAM' | 'GUIDE' | 'ACHIEVEMENT' | 'GENERAL';
        details?: string;
      };
      includeVisuals?: boolean;
      visualPlacement?: 'QUESTION_IMAGE' | 'CONTEXT_IMAGE' | 'INLINE';
    },
  ) {
    const institutionId = await requireInstitutionId(this.prisma as any, req, body.institutionId).catch(() => undefined);
    if (!institutionId && !req.user?.isSuperAdmin) {
      throw new ForbiddenException('No se pudo determinar la institución para consultar a Valeria.');
    }

    return this.apdAiService.answerTeacherQuestion({
      type: 'ASK_VALERIA',
      question: body.question,
      conversation: body.conversation,
      context: {
        institutionName: body.context?.institutionName || undefined,
        pageName: body.context?.pageName || undefined,
        pageSummary: body.context?.pageSummary || undefined,
        currentPath: body.context?.currentPath || undefined,
        gradeName: body.context?.gradeName || undefined,
        subjectName: body.context?.subjectName || undefined,
        topic: body.context?.topic || undefined,
        activityType: body.context?.activityType || 'GENERAL',
        details: body.context?.details || undefined,
      },
      includeVisuals: body.includeVisuals,
      visualPlacement: body.visualPlacement,
    });
  }
}
