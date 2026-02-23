import {
  Controller,
  Get,
  Post,
  Put,
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
import { ApdService } from './apd.service';
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
      pedagogicalNotes?: string;
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
      pedagogicalNotes?: string;
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
      supportStrategy: string;
      familyCommitment?: string;
      followUpDate?: string;
      observations?: string;
      objectives?: any;
      adaptationStrategies?: any;
      evaluationAdjustments?: any;
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
      supportStrategy?: string;
      familyCommitment?: string;
      followUpDate?: string;
      observations?: string;
      objectives?: any;
      adaptationStrategies?: any;
      evaluationAdjustments?: any;
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
}
