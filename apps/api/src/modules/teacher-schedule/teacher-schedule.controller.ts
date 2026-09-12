import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';
import { TeacherScheduleService } from './teacher-schedule.service';
import type { TeacherScheduleBlockInput } from './teacher-schedule.service';

/**
 * Horario personal del docente (agenda propia, manual, solo visual).
 * Siempre operan sobre el docente autenticado: teacherId = req.user.id.
 */
@Controller('teacher-schedule')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'DOCENTE')
export class TeacherScheduleController {
  constructor(
    private readonly service: TeacherScheduleService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async findMine(@Request() req) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.findMine(institutionId, req.user.id);
  }

  @Post()
  async create(@Request() req, @Body() body: TeacherScheduleBlockInput) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.create(institutionId, req.user.id, body);
  }

  @Put(':id')
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() body: Partial<TeacherScheduleBlockInput>,
  ) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.update(institutionId, req.user.id, id, body);
  }

  @Delete(':id')
  async remove(@Request() req, @Param('id') id: string) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.remove(institutionId, req.user.id, id);
  }
}
