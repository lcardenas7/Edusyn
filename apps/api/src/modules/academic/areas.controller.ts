import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards, Request } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AreasService } from './areas.service';
import { CreateAreaDto, UpdateAreaDto, AddSubjectWithConfigDto, UpdateSubjectDto, CreateSubjectLevelConfigDto, UpdateSubjectLevelConfigDto } from './dto/create-area.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('areas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AreasController {
  constructor(
    private readonly areasService: AreasService,
    private readonly prisma: PrismaService,
  ) {}

  // Helper para obtener institutionId del usuario
  private async resolveInstitutionId(req: any, queryInstitutionId?: string): Promise<string | undefined> {
    let instId = queryInstitutionId || req.user?.institutionId;
    if (!instId && req.user?.id) {
      const institutionUser = await this.prisma.institutionUser.findFirst({
        where: { userId: req.user.id },
        select: { institutionId: true }
      });
      instId = institutionUser?.institutionId;
    }
    return instId;
  }

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async create(@Body() dto: CreateAreaDto) {
    return this.areasService.create(dto);
  }

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'TEACHER', 'DOCENTE', 'COORDINADOR')
  async list(
    @Request() req: any,
    @Query('institutionId') institutionId?: string,
    @Query('academicLevel') academicLevel?: string,
    @Query('gradeId') gradeId?: string,
  ) {
    const instId = await this.resolveInstitutionId(req, institutionId);
    return this.areasService.list({ institutionId: instId, academicLevel, gradeId });
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
  async addSubject(@Param('id') areaId: string, @Body() dto: AddSubjectWithConfigDto) {
    return this.areasService.addSubjectWithConfig(areaId, dto);
  }

  @Post(':id/subjects/:subjectId/configs')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async addSubjectConfig(
    @Param('id') areaId: string,
    @Param('subjectId') subjectId: string,
    @Body() dto: CreateSubjectLevelConfigDto,
  ) {
    return this.areasService.addSubjectLevelConfig(subjectId, dto);
  }

  @Put('configs/:configId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async updateSubjectConfig(
    @Param('configId') configId: string,
    @Body() dto: UpdateSubjectLevelConfigDto,
  ) {
    return this.areasService.updateSubjectLevelConfig(configId, dto);
  }

  @Delete('configs/:configId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async deleteSubjectConfig(@Param('configId') configId: string) {
    return this.areasService.removeSubjectLevelConfig(configId);
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
