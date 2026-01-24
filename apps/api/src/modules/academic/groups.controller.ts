import { Body, Controller, Get, Post, Query, UseGuards, Request } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupsService } from './groups.service';
import { PrismaService } from '../../prisma/prisma.service';

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

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'SECRETARIA')
  async list(
    @Request() req: any,
    @Query('campusId') campusId?: string,
    @Query('shiftId') shiftId?: string,
    @Query('gradeId') gradeId?: string,
    @Query('institutionId') institutionId?: string,
  ) {
    // Si no viene institutionId, intentar obtenerlo del JWT o de la BD
    let instId = institutionId || req.user?.institutionId;
    
    if (!instId && req.user?.id) {
      const institutionUser = await this.prisma.institutionUser.findFirst({
        where: { userId: req.user.id },
        select: { institutionId: true }
      });
      instId = institutionUser?.institutionId;
    }

    return this.groupsService.list({ campusId, shiftId, gradeId, institutionId: instId });
  }
}
