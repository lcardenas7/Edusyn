import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards, Request, BadRequestException } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TeachersService } from './teachers.service';
import { CreateTeacherDto, UpdateTeacherDto } from './dto/create-teacher.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('teachers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeachersController {
  constructor(
    private readonly teachersService: TeachersService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async create(@Request() req: any, @Body() dto: CreateTeacherDto) {
    // Obtener institutionId del usuario autenticado
    let institutionId = req.user?.institutionId;
    
    // Si no viene en el JWT, buscarlo en la BD (fallback robusto)
    if (!institutionId && req.user?.id) {
      console.log(`[TeachersController] institutionId no está en JWT, buscando en BD para usuario ${req.user.id}`);
      const institutionUser = await this.prisma.institutionUser.findFirst({
        where: { userId: req.user.id },
        select: { institutionId: true }
      });
      institutionId = institutionUser?.institutionId;
      console.log(`[TeachersController] institutionId encontrado en BD: ${institutionId}`);
    }

    if (!institutionId) {
      throw new BadRequestException('No se pudo determinar la institución. Por favor, cierre sesión y vuelva a iniciar.');
    }

    return this.teachersService.create(dto, institutionId);
  }

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async list(@Request() req: any, @Query('isActive') isActive?: string) {
    // Obtener institutionId del usuario autenticado
    let institutionId = req.user?.institutionId;
    
    // Si no viene en el JWT, buscarlo en la BD
    if (!institutionId && req.user?.id) {
      const institutionUser = await this.prisma.institutionUser.findFirst({
        where: { userId: req.user.id },
        select: { institutionId: true }
      });
      institutionId = institutionUser?.institutionId;
    }

    return this.teachersService.list({
      institutionId,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  @Get(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async findById(@Param('id') id: string) {
    return this.teachersService.findById(id);
  }

  @Put(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async update(@Param('id') id: string, @Body() dto: UpdateTeacherDto) {
    return this.teachersService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async delete(@Param('id') id: string) {
    return this.teachersService.delete(id);
  }

  @Get(':id/assignments')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getAssignments(
    @Param('id') id: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.teachersService.getAssignments(id, academicYearId);
  }
}
