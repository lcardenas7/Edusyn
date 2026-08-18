import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { FinalComponentsService } from './final-components.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { resolveInstitutionId } from '../../common/utils/institution-resolver';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('final-components')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinalComponentsController {
  constructor(
    private readonly service: FinalComponentsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async findByAcademicYear(@Query('academicYearId') academicYearId: string) {
    return this.service.findByAcademicYear(academicYearId);
  }

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async create(@Body() body: { academicYearId: string; name: string; weightPercentage: number; order: number }, @Req() req: any) {
    const institutionId = await resolveInstitutionId(this.prisma as any, req);
    return this.service.create({
      institutionId: institutionId!,
      ...body,
    });
  }

  @Post('sync')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async bulkSync(
    @Body() body: { academicYearId: string; components: Array<{ id?: string; name: string; weightPercentage: number; order: number }> },
    @Req() req: any,
  ) {
    const institutionId = await resolveInstitutionId(this.prisma as any, req);
    return this.service.bulkSync(institutionId!, body.academicYearId, body.components);
  }

  // ── D-19 · Alcance: qué grados/asignaturas NO presentan una fuente final ──
  // Van ANTES de las rutas con `:id` para que Nest no interprete "scope" como
  // un identificador de componente.

  @Get('scope')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getScope(@Query('academicYearId') academicYearId: string) {
    return this.service.getScope(academicYearId);
  }

  @Post('scope/exclusions')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async addExclusion(
    @Body() body: { finalComponentId: string; gradeId: string; subjectId?: string | null; reason?: string },
    @Req() req: any,
  ) {
    const institutionId = await resolveInstitutionId(this.prisma as any, req);
    return this.service.addExclusion({
      institutionId: institutionId!,
      finalComponentId: body.finalComponentId,
      gradeId: body.gradeId,
      subjectId: body.subjectId ?? null,
      reason: body.reason,
      createdById: req?.user?.id,
    });
  }

  @Delete('scope/exclusions/:exclusionId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async removeExclusion(@Param('exclusionId') exclusionId: string, @Req() req: any) {
    const institutionId = await resolveInstitutionId(this.prisma as any, req);
    return this.service.removeExclusion(exclusionId, institutionId!);
  }

  @Put(':id/toggle-open')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async toggleOpen(@Param('id') id: string, @Body() body: { isOpen: boolean }) {
    return this.service.toggleOpen(id, body.isOpen);
  }

  @Put(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async update(@Param('id') id: string, @Body() body: { name?: string; weightPercentage?: number; order?: number }) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
