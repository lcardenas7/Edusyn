import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PeriodFinalGradesService, QuienEscribe } from './period-final-grades.service';
import { actorFromRequest } from './grade-audit-actor.util';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';

@Controller('period-final-grades')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PeriodFinalGradesController {
  constructor(
    private readonly periodFinalGradesService: PeriodFinalGradesService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Quién escribe, según la sesión.
   *
   * La institución se resuelve aquí y NUNCA se toma del cuerpo de la petición:
   * lo que llegue en él solo sirve para contrastarlo, jamás para fijar el
   * alcance.
   */
  private async quienEscribe(req: any): Promise<QuienEscribe> {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    const crudos = req?.user?.roles;
    const roles = Array.isArray(crudos)
      ? crudos
          .map((r: any) => (typeof r === 'string' ? r : r?.role?.name || r?.roleName || r?.name))
          .filter(Boolean)
      : [];
    return {
      userId: req?.user?.id,
      roles,
      esSuperAdmin: req?.user?.isSuperAdmin === true,
      institutionId,
    };
  }

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async upsert(@Body() data: any, @Req() req: any) {
    return this.periodFinalGradesService.upsert(
      { ...data, enteredById: req.user.id },
      await this.quienEscribe(req),
      actorFromRequest(req),
    );
  }

  @Post('bulk')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async bulkUpsert(@Body() data: { grades: any[]; reason?: unknown }, @Req() req: any) {
    // Una causal declarada para el lote se aplica a cada fila que no traiga la suya.
    const grades = (data.grades ?? []).map((g: any) => ({ reason: data.reason, ...g }));
    return this.periodFinalGradesService.bulkUpsert(
      grades,
      req.user.id,
      await this.quienEscribe(req),
      actorFromRequest(req),
    );
  }

  @Get('by-group')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'RECTOR', 'SECRETARIA')
  async findByGroup(
    @Query('groupId') groupId: string,
    @Query('academicTermId') academicTermId: string,
  ) {
    return this.periodFinalGradesService.findByGroup(groupId, academicTermId);
  }

  @Get('by-student')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async findByStudent(
    @Query('studentEnrollmentId') studentEnrollmentId: string,
    @Query('academicTermId') academicTermId?: string,
  ) {
    return this.periodFinalGradesService.findByStudent(studentEnrollmentId, academicTermId);
  }

  @Delete(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async delete(@Param('id') id: string, @Req() req: any, @Query('reason') reason?: string) {
    return this.periodFinalGradesService.delete(
      id,
      await this.quienEscribe(req),
      reason,
      actorFromRequest(req),
    );
  }
}
