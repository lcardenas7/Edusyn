import { Body, Controller, Get, Post, Query, UseGuards, Request } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CampusesService } from './campuses.service';
import { CreateCampusDto } from './dto/create-campus.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';

@Controller('campuses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CampusesController {
  constructor(
    private readonly campusesService: CampusesService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async create(@Body() dto: CreateCampusDto) {
    return this.campusesService.create(dto);
  }

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async list(@Request() req: any, @Query('institutionId') institutionId?: string) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.campusesService.list({ institutionId: instId });
  }
}
