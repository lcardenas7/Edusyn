import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CampusesService } from './campuses.service';
import { CreateCampusDto } from './dto/create-campus.dto';

@Controller('campuses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CampusesController {
  constructor(private readonly campusesService: CampusesService) {}

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async create(@Body() dto: CreateCampusDto) {
    return this.campusesService.create(dto);
  }

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async list(@Query('institutionId') institutionId?: string) {
    return this.campusesService.list({ institutionId });
  }
}
