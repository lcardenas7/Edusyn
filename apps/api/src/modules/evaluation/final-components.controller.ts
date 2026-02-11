import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { FinalComponentsService } from './final-components.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { resolveInstitutionId } from '../../common/utils/institution-resolver';

@Controller('final-components')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinalComponentsController {
  constructor(private readonly service: FinalComponentsService) {}

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async findByAcademicYear(@Query('academicYearId') academicYearId: string) {
    return this.service.findByAcademicYear(academicYearId);
  }

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async create(@Body() body: { academicYearId: string; name: string; weightPercentage: number; order: number }, @Req() req: any) {
    const institutionId = await resolveInstitutionId(req.user, body as any);
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
    const institutionId = await resolveInstitutionId(req.user, body as any);
    return this.service.bulkSync(institutionId!, body.academicYearId, body.components);
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
