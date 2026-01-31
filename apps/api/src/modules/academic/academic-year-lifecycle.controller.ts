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
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AcademicYearLifecycleService } from './academic-year-lifecycle.service';
import type { CreateAcademicYearDto } from './academic-year-lifecycle.service';

@Controller('academic-years')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AcademicYearLifecycleController {
  constructor(private readonly yearService: AcademicYearLifecycleService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // CRUD BÁSICO
  // ═══════════════════════════════════════════════════════════════════════════

  @Post()
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN')
  async createYear(@Body() dto: CreateAcademicYearDto) {
    return this.yearService.createYear(dto);
  }

  // Endpoint con query param (para compatibilidad con frontend)
  @Get()
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'DOCENTE', 'SECRETARIA')
  async getYears(@Query('institutionId') institutionId: string) {
    console.log('[AcademicYearController] getYears called with institutionId:', institutionId);
    if (!institutionId) {
      return [];
    }
    const years = await this.yearService.getYearsByInstitution(institutionId);
    console.log('[AcademicYearController] Returning', years.length, 'years with terms');
    return years;
  }

  @Get('institution/:institutionId')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'DOCENTE')
  async getYearsByInstitution(@Param('institutionId') institutionId: string) {
    return this.yearService.getYearsByInstitution(institutionId);
  }

  @Get('institution/:institutionId/current')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE')
  async getCurrentYear(@Param('institutionId') institutionId: string) {
    return this.yearService.getCurrentYear(institutionId);
  }

  @Get(':yearId')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'DOCENTE')
  async getYearById(@Param('yearId') yearId: string) {
    return this.yearService.getYearById(yearId);
  }

  @Put(':yearId')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN')
  async updateYear(
    @Param('yearId') yearId: string,
    @Body() dto: Partial<CreateAcademicYearDto>,
  ) {
    return this.yearService.updateYear(yearId, dto);
  }

  @Delete(':yearId')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN')
  async deleteYear(@Param('yearId') yearId: string) {
    return this.yearService.deleteYear(yearId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CICLO DE VIDA DEL AÑO
  // ═══════════════════════════════════════════════════════════════════════════

  @Post(':yearId/activate')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN')
  async activateYear(@Param('yearId') yearId: string, @Request() req: any) {
    return this.yearService.activateYear({
      yearId,
      userId: req.user.id,
    });
  }

  @Post(':yearId/close')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN')
  async closeYear(
    @Param('yearId') yearId: string,
    @Body() body: { calculatePromotions?: boolean },
    @Request() req: any,
  ) {
    return this.yearService.closeYear({
      yearId,
      userId: req.user.id,
      calculatePromotions: body.calculatePromotions,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDACIONES
  // ═══════════════════════════════════════════════════════════════════════════

  @Get(':yearId/validate-activation')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN')
  async validateForActivation(@Param('yearId') yearId: string) {
    const errors = await this.yearService.validateYearForActivation(yearId);
    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  @Get(':yearId/validate-closure')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN')
  async validateForClosure(@Param('yearId') yearId: string) {
    const errors = await this.yearService.validateYearForClosure(yearId);
    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROMOCIONES
  // ═══════════════════════════════════════════════════════════════════════════

  @Get(':yearId/promotion-preview')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN')
  async previewPromotions(@Param('yearId') yearId: string) {
    return this.yearService.previewPromotions(yearId);
  }

  @Post(':fromYearId/promote-to/:toYearId')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN')
  async promoteStudents(
    @Param('fromYearId') fromYearId: string,
    @Param('toYearId') toYearId: string,
    @Request() req: any,
  ) {
    return this.yearService.promoteStudents({
      fromYearId,
      toYearId,
      userId: req.user.id,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERMISOS POR ESTADO
  // ═══════════════════════════════════════════════════════════════════════════

  @Get(':yearId/permissions')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'DOCENTE')
  async getYearPermissions(@Param('yearId') yearId: string) {
    const [canEditStructure, canRecordGrades, canEnrollStudents, canModify] =
      await Promise.all([
        this.yearService.canEditStructure(yearId),
        this.yearService.canRecordGrades(yearId),
        this.yearService.canEnrollStudents(yearId),
        this.yearService.canModify(yearId),
      ]);

    return {
      canEditStructure,
      canRecordGrades,
      canEnrollStudents,
      canModify,
    };
  }
}
