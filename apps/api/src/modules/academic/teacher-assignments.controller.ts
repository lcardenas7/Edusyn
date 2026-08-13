import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, Request } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateTeacherAssignmentDto } from './dto/create-teacher-assignment.dto';
import { TeacherAssignmentsService } from './teacher-assignments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveInstitutionId } from '../../common/utils/institution-resolver';

@Controller('teacher-assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeacherAssignmentsController {
  constructor(
    private readonly teacherAssignmentsService: TeacherAssignmentsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async create(@Body() dto: CreateTeacherAssignmentDto) {
    return this.teacherAssignmentsService.create(dto);
  }

  @Post(':id/replace')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async replaceTeacher(
    @Param('id') id: string,
    @Body() body: { newTeacherId: string; reason: string; endDate?: string },
  ) {
    return this.teacherAssignmentsService.replaceTeacher(
      id,
      body.newTeacherId,
      body.reason,
      body.endDate ? new Date(body.endDate) : undefined,
    );
  }

  @Post(':id/end')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async endAssignment(
    @Param('id') id: string,
    @Body() body: { reason: string; endDate?: string },
  ) {
    return this.teacherAssignmentsService.endAssignment(
      id,
      body.reason,
      body.endDate ? new Date(body.endDate) : undefined,
    );
  }

  /**
   * Activar Convivencia como asignatura institucional para todos los grupos de un grado.
   * Puede asignarse al tutor de cada grupo o a un docente específico.
   */
  @Post('convivencia/activate')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR')
  async activateConvivencia(
    @Request() req: any,
    @Body() body: {
      gradeId: string;
      academicYearId: string;
      useTutor: boolean;
      countInAverage: boolean;
      teacherId?: string;
      institutionId?: string;
    },
  ) {
    const instId = await resolveInstitutionId(this.prisma as any, req, body.institutionId);
    if (!instId) throw new Error('No se pudo determinar la institución');

    return this.teacherAssignmentsService.activateConvivenciaForGrade({
      institutionId: instId,
      academicYearId: body.academicYearId,
      gradeId: body.gradeId,
      useTutor: body.useTutor,
      countInAverage: body.countInAverage,
      teacherId: body.teacherId,
    });
  }

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'RECTOR', 'SECRETARIA')
  async list(
    @Request() req: any,
    @Query('academicYearId') academicYearId?: string,
    @Query('groupId') groupId?: string,
    @Query('teacherId') teacherId?: string,
    @Query('institutionId') institutionId?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    const instId = await resolveInstitutionId(this.prisma as any, req, institutionId);
    return this.teacherAssignmentsService.list({
      academicYearId,
      groupId,
      teacherId,
      institutionId: instId,
      activeOnly: activeOnly === 'false' ? false : true,
    });
  }

  @Get('history')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getHistory(
    @Query('academicYearId') academicYearId: string,
    @Query('groupId') groupId: string,
    @Query('subjectId') subjectId: string,
  ) {
    return this.teacherAssignmentsService.getHistory(academicYearId, groupId, subjectId);
  }

  /**
   * Obtener resumen de carga de un docente (para preview antes de transferir)
   */
  @Get('teacher-load/:teacherId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getTeacherLoad(
    @Request() req: any,
    @Param('teacherId') teacherId: string,
    @Query('institutionId') institutionId?: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    const instId = await resolveInstitutionId(this.prisma as any, req, institutionId);
    if (!instId) throw new Error('No se pudo determinar la institución');
    return this.teacherAssignmentsService.getTeacherLoadSummary(teacherId, instId, academicYearId);
  }

  /**
   * Transferir toda la carga de un docente a otro
   */
  @Post('transfer')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async transferLoad(
    @Request() req: any,
    @Body() body: {
      fromTeacherId: string;
      toTeacherId: string;
      reason: string;
      academicYearId?: string;
      assignmentIds?: string[];
      effectiveDate?: string;
    },
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await resolveInstitutionId(this.prisma as any, req, institutionId);
    if (!instId) throw new Error('No se pudo determinar la institución');
    return this.teacherAssignmentsService.transferFullLoad({
      fromTeacherId: body.fromTeacherId,
      toTeacherId: body.toTeacherId,
      institutionId: instId,
      academicYearId: body.academicYearId,
      reason: body.reason,
      assignmentIds: body.assignmentIds,
      effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : undefined,
    });
  }

  /**
   * TEMPORAL: Eliminar toda la carga académica de la institución
   * Solo para ADMIN_INSTITUTIONAL - usar con precaución
   */
  @Delete('all')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async deleteAll(
    @Request() req: any,
    @Query('institutionId') institutionId?: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    const instId = await resolveInstitutionId(this.prisma as any, req, institutionId);
    if (!instId) {
      return { deleted: 0, message: 'No se pudo determinar la institución' };
    }
    return this.teacherAssignmentsService.deleteAll(instId, academicYearId);
  }

  /**
   * Actualizar una asignación (por ahora solo la intensidad horaria).
   */
  @Patch(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { weeklyHours?: number },
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await resolveInstitutionId(this.prisma as any, req, institutionId);
    if (!instId) throw new Error('No se pudo determinar la institución');
    return this.teacherAssignmentsService.updateAssignment(id, instId, body);
  }

  /**
   * Eliminar una asignación individual.
   * Se declara después de las rutas estáticas para que /all no se trate como un id.
   */
  @Delete(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async delete(
    @Request() req: any,
    @Param('id') id: string,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await resolveInstitutionId(this.prisma as any, req, institutionId);
    if (!instId) throw new Error('No se pudo determinar la institución');
    return this.teacherAssignmentsService.delete(id, instId);
  }
}
