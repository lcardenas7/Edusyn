import { Body, Controller, Get, Post, UseGuards, Request, Query } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateGradeDto } from './dto/create-grade.dto';
import { GradesService } from './grades.service';
import { PrismaService } from '../../prisma/prisma.service';

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

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'SECRETARIA')
  async list(@Request() req: any, @Query('institutionId') institutionId?: string) {
    // Si viene institutionId, filtrar por institución
    if (institutionId) {
      return this.gradesService.listByInstitution(institutionId);
    }
    // Intentar obtener institutionId del usuario
    let instId = req.user?.institutionId;
    if (!instId && req.user?.id) {
      const institutionUser = await this.prisma.institutionUser.findFirst({
        where: { userId: req.user.id },
        select: { institutionId: true }
      });
      instId = institutionUser?.institutionId;
    }
    if (instId) {
      return this.gradesService.listByInstitution(instId);
    }
    return this.gradesService.list();
  }

  // Sincronizar grados y grupos desde el frontend (localStorage -> BD)
  @Post('sync')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async syncGradesAndGroups(
    @Request() req: any,
    @Body() body: { grades: any[] }
  ) {
    // Obtener institutionId
    let institutionId = req.user?.institutionId;
    if (!institutionId && req.user?.id) {
      const institutionUser = await this.prisma.institutionUser.findFirst({
        where: { userId: req.user.id },
        select: { institutionId: true }
      });
      institutionId = institutionUser?.institutionId;
    }

    if (!institutionId) {
      return { success: false, message: 'No se pudo determinar la institución' };
    }

    return this.gradesService.syncGradesAndGroups(institutionId, body.grades);
  }
}
