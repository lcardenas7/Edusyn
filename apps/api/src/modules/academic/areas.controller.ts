import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards, Request } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AreasService } from './areas.service';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveInstitutionId } from '../../common/utils/institution-resolver';
import { SubjectType } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════
// CONTROLADOR DE CATÁLOGO ACADÉMICO
// Gestiona el catálogo de áreas y asignaturas (independiente de plantillas)
// ═══════════════════════════════════════════════════════════════════════════

@Controller('areas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AreasController {
  constructor(
    private readonly areasService: AreasService,
    private readonly prisma: PrismaService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // ÁREAS
  // ═══════════════════════════════════════════════════════════════════════════

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async createArea(
    @Body() body: {
      institutionId: string;
      name: string;
      code?: string;
      description?: string;
      order?: number;
    },
  ) {
    return this.areasService.createArea(body);
  }

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'TEACHER', 'DOCENTE', 'COORDINADOR')
  async listAreas(
    @Request() req: any,
    @Query('institutionId') institutionId?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const instId = await resolveInstitutionId(this.prisma as any, req, institutionId);
    if (!instId) return [];
    return this.areasService.listAreas(instId, includeInactive === 'true');
  }

  @Get(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'TEACHER', 'DOCENTE', 'COORDINADOR')
  async getArea(@Param('id') id: string) {
    return this.areasService.findAreaById(id);
  }

  @Put(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async updateArea(
    @Param('id') id: string,
    @Body() body: {
      name?: string;
      code?: string;
      description?: string;
      order?: number;
      isActive?: boolean;
    },
  ) {
    return this.areasService.updateArea(id, body);
  }

  @Delete(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async deleteArea(@Param('id') id: string) {
    return this.areasService.deleteArea(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ASIGNATURAS
  // ═══════════════════════════════════════════════════════════════════════════

  @Post(':areaId/subjects')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async createSubject(
    @Param('areaId') areaId: string,
    @Body() body: {
      name: string;
      code?: string;
      description?: string;
      subjectType?: SubjectType;
      order?: number;
    },
  ) {
    return this.areasService.createSubject({ areaId, ...body });
  }

  @Get(':areaId/subjects')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'TEACHER', 'DOCENTE', 'COORDINADOR')
  async listSubjectsByArea(
    @Param('areaId') areaId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.areasService.listSubjectsByArea(areaId, includeInactive === 'true');
  }

  @Get('subjects/all')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'TEACHER', 'DOCENTE', 'COORDINADOR')
  async listAllSubjects(
    @Request() req: any,
    @Query('institutionId') institutionId?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const instId = await resolveInstitutionId(this.prisma as any, req, institutionId);
    if (!instId) return [];
    return this.areasService.listAllSubjects(instId, includeInactive === 'true');
  }

  @Get('subjects/:subjectId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'TEACHER', 'DOCENTE', 'COORDINADOR')
  async getSubject(@Param('subjectId') subjectId: string) {
    return this.areasService.findSubjectById(subjectId);
  }

  @Put('subjects/:subjectId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async updateSubject(
    @Param('subjectId') subjectId: string,
    @Body() body: {
      name?: string;
      code?: string;
      description?: string;
      subjectType?: SubjectType;
      order?: number;
      isActive?: boolean;
    },
  ) {
    return this.areasService.updateSubject(subjectId, body);
  }

  @Delete('subjects/:subjectId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async deleteSubject(@Param('subjectId') subjectId: string) {
    return this.areasService.deleteSubject(subjectId);
  }
}
