import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
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
}
