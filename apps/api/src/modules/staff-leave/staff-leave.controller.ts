import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { StaffLeaveService } from './staff-leave.service';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';

@Controller('staff-leave')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StaffLeaveController {
  constructor(
    private readonly staffLeaveService: StaffLeaveService,
    private readonly prisma: PrismaService,
  ) {}

  // Docente crea solicitud
  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'RECTOR', 'ORIENTADOR', 'SECRETARIA')
  async create(@Body() data: any, @Req() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req, data.institutionId);
    return this.staffLeaveService.create({
      ...data,
      institutionId,
      requesterId: req.user.id,
    });
  }

  // Mis solicitudes (docente ve las suyas)
  @Get('my-requests')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'RECTOR', 'ORIENTADOR', 'SECRETARIA')
  async findMyRequests(@Req() req: any, @Query('institutionId') institutionId?: string) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.staffLeaveService.findMyRequests(req.user.id, instId);
  }

  // Listar todas (admin/coordinador/rector)
  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR')
  async findAll(
    @Req() req: any,
    @Query('institutionId') institutionId?: string,
    @Query('status') status?: string,
    @Query('requesterId') requesterId?: string,
    @Query('type') type?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.staffLeaveService.findAll(instId, {
      status: status as any,
      requesterId,
      type: type as any,
      startDate,
      endDate,
    });
  }

  // Detalle de una solicitud
  @Get(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'RECTOR', 'ORIENTADOR', 'SECRETARIA')
  async findById(@Param('id') id: string) {
    return this.staffLeaveService.findById(id);
  }

  // Revisar (aprobar/rechazar) — solo rector/admin/coordinador
  @Patch(':id/review')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR')
  async review(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    return this.staffLeaveService.review(id, req.user.id, data);
  }

  // Cancelar (solo el solicitante)
  @Patch(':id/cancel')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'RECTOR', 'ORIENTADOR', 'SECRETARIA')
  async cancel(@Param('id') id: string, @Req() req: any) {
    return this.staffLeaveService.cancel(id, req.user.id);
  }

  // Estadísticas
  @Get('stats/summary')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR')
  async getStats(
    @Req() req: any,
    @Query('institutionId') institutionId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.staffLeaveService.getStats(instId, startDate, endDate);
  }
}
