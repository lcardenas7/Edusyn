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
import { TemplatesService } from './templates.service';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';
import { AcademicLevel, AreaCalculationType, AreaApprovalRule, AreaRecoveryRule, GroupExceptionType } from '@prisma/client';

@Controller('academic-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TemplatesController {
  constructor(
    private readonly templatesService: TemplatesService,
    private readonly prisma: PrismaService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // PLANTILLAS
  // ═══════════════════════════════════════════════════════════════════════════

  // Asistente "Plan de Estudios" — orquesta catálogo + plantilla + asignación a grado
  @Post('quick-setup')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async quickSetup(
    @Request() req: any,
    @Body() body: {
      institutionId: string;
      academicYearId: string;
      gradeId: string;
      areas: Array<{
        areaId?: string;
        newAreaName?: string;
        subjects: Array<{ subjectId?: string; newSubjectName?: string; weeklyHours: number; subjectType?: string }>;
      }>;
    },
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, body.institutionId);
    return this.templatesService.quickSetup({ ...body, institutionId: instId });
  }

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async createTemplate(
    @Request() req: any,
    @Body() body: {
      institutionId: string;
      academicYearId: string;  // 🔥 REQUERIDO
      name: string;
      description?: string;
      level: AcademicLevel;
      isDefault?: boolean;
      achievementsPerPeriod?: number;
      useAttitudinalAchievement?: boolean;
    },
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, body.institutionId);
    return this.templatesService.createTemplate({ ...body, institutionId: instId });
  }

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async listTemplates(
    @Request() req: any,
    @Query('institutionId') institutionId: string,
    @Query('academicYearId') academicYearId: string,  // 🔥 REQUERIDO
    @Query('level') level?: AcademicLevel,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.templatesService.listTemplates(instId, academicYearId, level, includeInactive === 'true'
    );
  }

  @Get('enums')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getEnums() {
    return this.templatesService.getEnums();
  }

  // 🔥 IMPORTANTE: Esta ruta debe estar ANTES de @Get(':id') para no ser capturada
  @Get('grades')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async listGradesWithTemplates(
    @Request() req: any,
    @Query('institutionId') institutionId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    // Nunca confiar en el institutionId del query: el resolver fuerza la institución
    // del JWT para usuarios normales y solo deja elegir a SUPERADMIN.
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.templatesService.listGradesWithTemplates(instId, academicYearId);
  }

  @Get(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getTemplate(
    @Request() req: any, @Param('id') id: string) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.templatesService.findTemplateById(id, instId);
  }

  @Put(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async updateTemplate(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: {
      name?: string;
      description?: string;
      level?: AcademicLevel;
      isDefault?: boolean;
      isActive?: boolean;
      achievementsPerPeriod?: number;
      useAttitudinalAchievement?: boolean;
    },
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.templatesService.updateTemplate(id, body, instId);
  }

  @Delete(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async deleteTemplate(
    @Request() req: any, @Param('id') id: string) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.templatesService.deleteTemplate(id, instId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ÁREAS EN PLANTILLA
  // ═══════════════════════════════════════════════════════════════════════════

  @Post(':templateId/areas')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async addAreaToTemplate(
    @Request() req: any,
    @Param('templateId') templateId: string,
    @Body() body: {
      areaId: string;
      weightPercentage?: number;
      calculationType?: AreaCalculationType;
      approvalRule?: AreaApprovalRule;
      recoveryRule?: AreaRecoveryRule;
      isMandatory?: boolean;
      order?: number;
    },
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.templatesService.addAreaToTemplate({ ...body, templateId }, instId);
  }

  @Put('areas/:templateAreaId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async updateTemplateArea(
    @Request() req: any,
    @Param('templateAreaId') templateAreaId: string,
    @Body() body: {
      weightPercentage?: number;
      calculationType?: AreaCalculationType;
      approvalRule?: AreaApprovalRule;
      recoveryRule?: AreaRecoveryRule;
      isMandatory?: boolean;
      order?: number;
    },
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.templatesService.updateTemplateArea(templateAreaId, body, instId);
  }

  @Delete('areas/:templateAreaId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async removeAreaFromTemplate(
    @Request() req: any, @Param('templateAreaId') templateAreaId: string) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.templatesService.removeAreaFromTemplate(templateAreaId, instId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ASIGNATURAS EN PLANTILLA
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('areas/:templateAreaId/subjects')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async addSubjectToTemplateArea(
    @Request() req: any,
    @Param('templateAreaId') templateAreaId: string,
    @Body() body: {
      subjectId: string;
      weeklyHours?: number;
      weightPercentage?: number;
      isDominant?: boolean;
      order?: number;
      achievementsPerPeriod?: number;
      useAttitudinalAchievement?: boolean;
    },
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.templatesService.addSubjectToTemplateArea({ ...body, templateAreaId }, instId);
  }

  @Put('subjects/:templateSubjectId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async updateTemplateSubject(
    @Request() req: any,
    @Param('templateSubjectId') templateSubjectId: string,
    @Body() body: {
      weeklyHours?: number;
      weightPercentage?: number;
      isDominant?: boolean;
      order?: number;
      achievementsPerPeriod?: number | null;
      useAttitudinalAchievement?: boolean | null;
    },
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.templatesService.updateTemplateSubject(templateSubjectId, body, instId);
  }

  @Delete('subjects/:templateSubjectId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async removeSubjectFromTemplateArea(
    @Request() req: any,
    @Param('templateSubjectId') templateSubjectId: string,
    @Query('force') force?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.templatesService.removeSubjectFromTemplateArea(templateSubjectId, instId, force === 'true');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ASIGNACIÓN A GRADOS (POR AÑO ACADÉMICO)
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('grades/:gradeId/assign')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async assignTemplateToGrade(
    @Request() req: any,
    @Param('gradeId') gradeId: string,
    @Body() body: { templateId: string; academicYearId: string; overrides?: any },
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.templatesService.assignTemplateToGrade(gradeId, body.templateId, body.academicYearId, instId, body.overrides);
  }

  @Post('grades/:gradeId/sync-from-assignments')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async syncTemplateFromActiveAssignments(
    @Request() req: any,
    @Param('gradeId') gradeId: string,
    @Body() body: { academicYearId: string },
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.templatesService.syncTemplateFromActiveAssignments(gradeId, body.academicYearId, instId);
  }

  @Delete('grades/:gradeId/assign')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async removeTemplateFromGrade(
    @Request() req: any,
    @Param('gradeId') gradeId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.templatesService.removeTemplateFromGrade(gradeId, academicYearId, instId);
  }

  @Get('grades/:gradeId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getGradeTemplate(
    @Request() req: any,
    @Param('gradeId') gradeId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.templatesService.getGradeTemplate(gradeId, academicYearId, instId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXCEPCIONES POR GRUPO (POR AÑO ACADÉMICO)
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('groups/:groupId/exceptions')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async addGroupException(
    @Request() req: any,
    @Param('groupId') groupId: string,
    @Body() body: {
      subjectId: string;
      academicYearId: string;
      type: GroupExceptionType;
      weeklyHours?: number;
      weightPercentage?: number;
      reason?: string;
    },
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.templatesService.addGroupException({ ...body, groupId }, instId);
  }

  @Delete('groups/:groupId/exceptions/:subjectId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async removeGroupException(
    @Request() req: any,
    @Param('groupId') groupId: string,
    @Param('subjectId') subjectId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.templatesService.removeGroupException(groupId, subjectId, academicYearId, instId);
  }

  @Get('groups/:groupId/exceptions')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getGroupExceptions(
    @Request() req: any,
    @Param('groupId') groupId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.templatesService.getGroupExceptions(groupId, academicYearId, instId);
  }

  @Get('groups/:groupId/effective-structure')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getEffectiveStructureForGroup(
    @Request() req: any,
    @Param('groupId') groupId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.templatesService.getEffectiveStructureForGroupInScope(groupId, academicYearId, institutionId);
  }
}
