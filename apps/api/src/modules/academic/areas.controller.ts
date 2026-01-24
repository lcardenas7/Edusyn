import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AreasService } from './areas.service';
import { CreateAreaDto, UpdateAreaDto, AddSubjectToAreaDto, UpdateSubjectDto } from './dto/create-area.dto';

@Controller('areas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async create(@Body() dto: CreateAreaDto) {
    return this.areasService.create(dto);
  }

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'TEACHER')
  async list(
    @Query('institutionId') institutionId?: string,
    @Query('academicLevel') academicLevel?: string,
    @Query('gradeId') gradeId?: string,
  ) {
    return this.areasService.list({ institutionId, academicLevel, gradeId });
  }

  @Get('for-grade/:gradeId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'TEACHER')
  async getAreasForGrade(
    @Query('institutionId') institutionId: string,
    @Param('gradeId') gradeId: string,
  ) {
    return this.areasService.getAreasForGrade(institutionId, gradeId);
  }

  @Get(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'TEACHER')
  async findById(@Param('id') id: string) {
    return this.areasService.findById(id);
  }

  @Put(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async update(@Param('id') id: string, @Body() dto: UpdateAreaDto) {
    return this.areasService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async delete(@Param('id') id: string) {
    return this.areasService.delete(id);
  }

  @Post(':id/subjects')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async addSubject(@Param('id') areaId: string, @Body() dto: AddSubjectToAreaDto) {
    return this.areasService.addSubjectToArea(areaId, dto);
  }

  @Put('subjects/:subjectId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async updateSubject(@Param('subjectId') subjectId: string, @Body() dto: UpdateSubjectDto) {
    return this.areasService.updateSubject(subjectId, dto);
  }

  @Delete('subjects/:subjectId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async removeSubject(@Param('subjectId') subjectId: string) {
    return this.areasService.removeSubject(subjectId);
  }
}
