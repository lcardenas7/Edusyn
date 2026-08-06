import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { SuperadminService } from './superadmin.service';
import { CreateInstitutionDto, UpdateInstitutionDto, UpdateInstitutionModulesDto } from './dto/create-institution.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('superadmin')
@UseGuards(JwtAuthGuard)
export class SuperadminController {
  constructor(private readonly superadminService: SuperadminService) {}

  /**
   * Obtiene estadísticas globales del sistema
   */
  @Get('stats')
  getSystemStats(@Request() req) {
    return this.superadminService.getSystemStats(req.user.id);
  }

  /**
   * Lista todas las instituciones
   */
  @Get('institutions')
  getAllInstitutions(@Request() req) {
    return this.superadminService.getAllInstitutions(req.user.id);
  }

  /**
   * Obtiene una institución por ID
   */
  @Get('institutions/:id')
  getInstitutionById(@Request() req, @Param('id') id: string) {
    return this.superadminService.getInstitutionById(req.user.id, id);
  }

  /**
   * Estadísticas de uso de una institución (observabilidad)
   */
  @Get('institutions/:id/usage')
  getInstitutionUsage(@Request() req, @Param('id') id: string) {
    return this.superadminService.getInstitutionUsage(req.user.id, id);
  }

  /**
   * Registro forense de cambios de notas.
   * Vista general (todas las instituciones) o por institución vía ?institutionId=
   */
  @Get('grade-audit')
  getGradeAuditLog(
    @Request() req,
    @Query('institutionId') institutionId?: string,
    @Query('action') action?: 'CREATE' | 'UPDATE' | 'DELETE',
    @Query('studentEnrollmentId') studentEnrollmentId?: string,
    @Query('actorUserId') actorUserId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.superadminService.getGradeAuditLog(req.user.id, {
      institutionId,
      action,
      studentEnrollmentId,
      actorUserId,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  /**
   * Crea una nueva institución con su admin/rector
   */
  @Post('institutions')
  createInstitution(@Request() req, @Body() dto: CreateInstitutionDto) {
    return this.superadminService.createInstitution(req.user.id, dto);
  }

  /**
   * Actualiza una institución
   */
  @Put('institutions/:id')
  updateInstitution(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateInstitutionDto,
  ) {
    return this.superadminService.updateInstitution(req.user.id, id, dto);
  }

  /**
   * Actualiza los módulos de una institución
   */
  @Patch('institutions/:id/modules')
  updateInstitutionModules(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateInstitutionModulesDto,
  ) {
    return this.superadminService.updateInstitutionModules(req.user.id, id, dto);
  }

  /**
   * Activa una institución
   */
  @Patch('institutions/:id/activate')
  activateInstitution(@Request() req, @Param('id') id: string) {
    return this.superadminService.updateInstitutionStatus(req.user.id, id, 'ACTIVE');
  }

  /**
   * Suspende una institución
   */
  @Patch('institutions/:id/suspend')
  suspendInstitution(@Request() req, @Param('id') id: string) {
    return this.superadminService.updateInstitutionStatus(req.user.id, id, 'SUSPENDED');
  }

  /**
   * Elimina una institución (requiere confirmación con el nombre)
   */
  @Delete('institutions/:id')
  deleteInstitution(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { confirmationName: string },
  ) {
    return this.superadminService.deleteInstitution(req.user.id, id, body.confirmationName);
  }

  /**
   * Lista usuarios de una institución
   */
  @Get('institutions/:id/users')
  getInstitutionUsers(@Request() req, @Param('id') id: string) {
    return this.superadminService.getInstitutionUsers(req.user.id, id);
  }

  /**
   * Resetea la contraseña de cualquier usuario (SuperAdmin)
   */
  @Post('users/:id/reset-password')
  resetUserPassword(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { newPassword?: string; mustChangePassword?: boolean },
  ) {
    return this.superadminService.resetUserPassword(req.user.id, id, body);
  }
}
