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
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TemplatesService } from './templates.service';
import { AcademicLevel, AreaCalculationType, AreaApprovalRule, AreaRecoveryRule, GroupExceptionType } from '@prisma/client';

@Controller('academic-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // PLANTILLAS
  // ═══════════════════════════════════════════════════════════════════════════

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async createTemplate(
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
    return this.templatesService.createTemplate(body);
  }

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async listTemplates(
    @Query('institutionId') institutionId: string,
    @Query('academicYearId') academicYearId: string,  // 🔥 REQUERIDO
    @Query('level') level?: AcademicLevel,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.templatesService.listTemplates(
      institutionId,
      academicYearId,
      level,
      includeInactive === 'true',
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
    @Query('institutionId') institutionId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.templatesService.listGradesWithTemplates(institutionId, academicYearId);
  }

  @Get(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getTemplate(@Param('id') id: string) {
    return this.templatesService.findTemplateById(id);
  }

  @Put(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async updateTemplate(
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
    return this.templatesService.updateTemplate(id, body);
  }

  @Delete(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async deleteTemplate(@Param('id') id: string) {
    return this.templatesService.deleteTemplate(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ÁREAS EN PLANTILLA
  // ═══════════════════════════════════════════════════════════════════════════

  @Post(':templateId/areas')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async addAreaToTemplate(
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
    return this.templatesService.addAreaToTemplate({ templateId, ...body });
  }

  @Put('areas/:templateAreaId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async updateTemplateArea(
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
    return this.templatesService.updateTemplateArea(templateAreaId, body);
  }

  @Delete('areas/:templateAreaId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async removeAreaFromTemplate(@Param('templateAreaId') templateAreaId: string) {
    return this.templatesService.removeAreaFromTemplate(templateAreaId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ASIGNATURAS EN PLANTILLA
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('areas/:templateAreaId/subjects')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async addSubjectToTemplateArea(
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
    return this.templatesService.addSubjectToTemplateArea({ templateAreaId, ...body });
  }

  @Put('subjects/:templateSubjectId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async updateTemplateSubject(
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
    return this.templatesService.updateTemplateSubject(templateSubjectId, body);
  }

  @Delete('subjects/:templateSubjectId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async removeSubjectFromTemplateArea(@Param('templateSubjectId') templateSubjectId: string) {
    return this.templatesService.removeSubjectFromTemplateArea(templateSubjectId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ASIGNACIÓN A GRADOS (POR AÑO ACADÉMICO)
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('grades/:gradeId/assign')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async assignTemplateToGrade(
    @Param('gradeId') gradeId: string,
    @Body() body: { templateId: string; academicYearId: string; overrides?: any },
  ) {
    return this.templatesService.assignTemplateToGrade(gradeId, body.templateId, body.academicYearId, body.overrides);
  }

  @Delete('grades/:gradeId/assign')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async removeTemplateFromGrade(
    @Param('gradeId') gradeId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.templatesService.removeTemplateFromGrade(gradeId, academicYearId);
  }

  @Get('grades/:gradeId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getGradeTemplate(
    @Param('gradeId') gradeId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.templatesService.getGradeTemplate(gradeId, academicYearId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXCEPCIONES POR GRUPO (POR AÑO ACADÉMICO)
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('groups/:groupId/exceptions')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async addGroupException(
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
    return this.templatesService.addGroupException({ groupId, ...body });
  }

  @Delete('groups/:groupId/exceptions/:subjectId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async removeGroupException(
    @Param('groupId') groupId: string,
    @Param('subjectId') subjectId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.templatesService.removeGroupException(groupId, subjectId, academicYearId);
  }

  @Get('groups/:groupId/exceptions')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getGroupExceptions(
    @Param('groupId') groupId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.templatesService.getGroupExceptions(groupId, academicYearId);
  }

  @Get('groups/:groupId/effective-structure')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getEffectiveStructureForGroup(
    @Param('groupId') groupId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.templatesService.getEffectiveStructureForGroup(groupId, academicYearId);
  }
}
