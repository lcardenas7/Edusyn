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
    console.log('[FinalComponents] POST /sync received:', JSON.stringify(body));
    const institutionId = await resolveInstitutionId(this.prisma as any, req);
    console.log('[FinalComponents] Resolved institutionId:', institutionId);
    const result = await this.service.bulkSync(institutionId!, body.academicYearId, body.components);
    console.log('[FinalComponents] bulkSync result:', JSON.stringify(result));
    return result;
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
