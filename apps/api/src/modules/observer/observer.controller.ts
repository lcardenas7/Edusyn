import { Controller, Post, Put, Get, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ObserverService } from './observer.service';
import { CreateObservationDto, UpdateObservationDto } from './dto/create-observation.dto';

@Controller('observer')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ObserverController {
  constructor(private readonly observerService: ObserverService) {}

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  create(@Request() req, @Body() dto: CreateObservationDto) {
    return this.observerService.create(req.user.id, dto);
  }

  @Put(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  update(@Param('id') id: string, @Body() dto: UpdateObservationDto) {
    return this.observerService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  delete(@Param('id') id: string) {
    return this.observerService.delete(id);
  }

  @Get(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE')
  getById(@Param('id') id: string) {
    return this.observerService.getById(id);
  }

  @Get('by-student/:studentEnrollmentId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE')
  getByStudent(
    @Param('studentEnrollmentId') studentEnrollmentId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.observerService.getByStudent(studentEnrollmentId, startDate, endDate);
  }

  @Get('summary/:studentEnrollmentId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE')
  getStudentSummary(@Param('studentEnrollmentId') studentEnrollmentId: string) {
    return this.observerService.getStudentSummary(studentEnrollmentId);
  }

  @Get('pending-followups')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  getPendingFollowUps(@Request() req, @Query('all') all?: string) {
    const authorId = all === 'true' ? undefined : req.user.id;
    return this.observerService.getPendingFollowUps(authorId);
  }

  @Put(':id/notify-parent')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  markParentNotified(@Param('id') id: string) {
    return this.observerService.markParentNotified(id);
  }
}
