import { Body, Controller, Get, Post, Delete, Param, UseGuards, Request, Query, BadRequestException } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateGradeDto } from './dto/create-grade.dto';
import { GradesService } from './grades.service';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';

@Controller('grades')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GradesController {
  constructor(
    private readonly gradesService: GradesService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async create(@Body() dto: CreateGradeDto) {
    return this.gradesService.create(dto);
  }

  // Administrativo: devuelve TODOS los grados (incluso sin grupos)
  // Usado por: Structure.tsx, creación de grupos, administración
  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'SECRETARIA')
  async list(@Request() req: any, @Query('institutionId') institutionId?: string) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.gradesService.listByInstitution(instId);
  }

  // Operativo: solo grados que tienen al menos un grupo en la institución
  // Usado por: finanzas, filtros, reportes, módulos operativos
  @Get('active')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'SECRETARIA')
  async listActive(@Request() req: any, @Query('institutionId') institutionId?: string) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.gradesService.listActiveByInstitution(instId);
  }

  // Sincronizar grados y grupos desde el frontend (localStorage -> BD)
  @Post('sync')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async syncGradesAndGroups(
    @Request() req: any,
    @Body() body: { grades: any[] }
  ) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.gradesService.syncGradesAndGroups(institutionId, body.grades);
  }

  @Delete(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async delete(@Param('id') id: string) {
    try {
      return await this.gradesService.delete(id);
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }
  }
}
