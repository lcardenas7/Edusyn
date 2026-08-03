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
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TeacherScheduleService } from './teacher-schedule.service';
import type { TeacherScheduleBlockInput } from './teacher-schedule.service';

/**
 * Horario personal del docente (agenda propia, manual, solo visual).
 * Siempre operan sobre el docente autenticado: teacherId = req.user.id.
 */
@Controller('teacher-schedule')
@UseGuards(JwtAuthGuard)
export class TeacherScheduleController {
  constructor(private readonly service: TeacherScheduleService) {}

  private institution(req: any): string {
    const institutionId = req.user?.institutionId;
    if (!institutionId) {
      throw new BadRequestException('No hay institución en la sesión');
    }
    return institutionId;
  }

  @Get()
  async findMine(@Request() req) {
    return this.service.findMine(this.institution(req), req.user.id);
  }

  @Post()
  async create(@Request() req, @Body() body: TeacherScheduleBlockInput) {
    return this.service.create(this.institution(req), req.user.id, body);
  }

  @Put(':id')
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() body: Partial<TeacherScheduleBlockInput>,
  ) {
    return this.service.update(this.institution(req), req.user.id, id, body);
  }

  @Delete(':id')
  async remove(@Request() req, @Param('id') id: string) {
    return this.service.remove(this.institution(req), req.user.id, id);
  }
}
