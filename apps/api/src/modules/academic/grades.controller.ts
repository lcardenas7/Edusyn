import { Body, Controller, Get, Post, Patch, Delete, Param, UseGuards, Request, Query, BadRequestException, HttpException } from '@nestjs/common';
import { AcademicStructureType, GradeStage } from '@prisma/client';

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
  async create(@Body() dto: CreateGradeDto, @Request() req: any) {
    const instId = await requireInstitutionId(this.prisma as any, req, (dto as any).institutionId);
    return this.gradesService.create({ ...dto, institutionId: instId });
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

  /**
   * Genera los grados estándar de un nivel educativo (Primaria → 1°…5°),
   * con su número ya asignado. Idempotente.
   */
  @Post('generate')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async generate(
    @Request() req: any,
    @Body() body: { stage: GradeStage; institutionId?: string },
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, body?.institutionId);
    if (!body?.stage) throw new BadRequestException('Falta el nivel educativo (stage).');
    return this.gradesService.generateForStage(instId, body.stage);
  }

  /** Completa el número de los grados que lo tengan vacío, deducido del nombre. */
  @Post('backfill-numbers')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async backfillNumbers(@Request() req: any, @Query('institutionId') institutionId?: string) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.gradesService.backfillNumbers(instId);
  }

  @Post('backfill-structure')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async backfillStructure(@Request() req: any, @Query('institutionId') institutionId?: string) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.gradesService.backfillAcademicStructure(instId);
  }

  /**
   * Detecta (y opcionalmente elimina) grados duplicados por etapa+número.
   * ?apply=true borra solo los duplicados vacíos; sin él, solo reporta.
   */
  @Post('dedupe')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async dedupeGrades(@Request() req: any, @Query('apply') apply?: string, @Query('institutionId') institutionId?: string) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.gradesService.dedupeGrades(instId, apply === 'true');
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

  @Patch(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async update(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { name?: string; stage?: string; number?: number; academicStructure?: AcademicStructureType },
    @Query('institutionId') institutionId?: string
  ) {
    try {
      const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
      return await this.gradesService.update(id, instId, body as any);
    } catch (err: any) {
      // Los errores ya tipados (404 Grado no encontrado, 409 nombre duplicado…)
      // deben conservar su código y mensaje, no degradarse a un 400 genérico.
      if (err instanceof HttpException) throw err;
      throw new BadRequestException(err.message);
    }
  }

  @Delete(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async delete(@Param('id') id: string, @Request() req: any, @Query('institutionId') institutionId?: string) {
    try {
      const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
      return await this.gradesService.delete(id, instId);
    } catch (err: any) {
      // Los errores ya tipados (404 Grado no encontrado, 409 nombre duplicado…)
      // deben conservar su código y mensaje, no degradarse a un 400 genérico.
      if (err instanceof HttpException) throw err;
      throw new BadRequestException(err.message);
    }
  }
}
