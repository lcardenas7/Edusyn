import { Body, Controller, Get, Post, Patch, Delete, Param, Query, UseGuards, Request, BadRequestException } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupsService } from './groups.service';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveInstitutionId } from '../../common/utils/institution-resolver';

@Controller('groups')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GroupsController {
  constructor(
    private readonly groupsService: GroupsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async create(@Body() dto: CreateGroupDto) {
    return this.groupsService.create(dto);
  }

  @Patch(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR')
  async update(
    @Param('id') id: string,
    @Body() body: { directorId?: string | null; maxCapacity?: number; name?: string; shiftId?: string },
  ) {
    return this.groupsService.update(id, body);
  }

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'SECRETARIA', 'RECTOR')
  async list(
    @Request() req: any,
    @Query('campusId') campusId?: string,
    @Query('shiftId') shiftId?: string,
    @Query('gradeId') gradeId?: string,
    @Query('institutionId') institutionId?: string,
  ) {
    // Usar helper seguro que respeta roles (SUPERADMIN puede usar query, otros no)
    const instId = await resolveInstitutionId(this.prisma as any, req, institutionId);

    return this.groupsService.list({ campusId, shiftId, gradeId, institutionId: instId });
  }

  @Delete(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async delete(@Param('id') id: string) {
    try {
      return await this.groupsService.delete(id);
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }
  }
}
