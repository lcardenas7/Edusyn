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
  @Roles('ADMIN', 'COORDINATOR', 'TEACHER')
  create(@Request() req, @Body() dto: CreateObservationDto) {
    return this.observerService.create(req.user.id, dto);
  }

  @Put(':id')
  @Roles('ADMIN', 'COORDINATOR', 'TEACHER')
  update(@Param('id') id: string, @Body() dto: UpdateObservationDto) {
    return this.observerService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'COORDINATOR')
  delete(@Param('id') id: string) {
    return this.observerService.delete(id);
  }

  @Get(':id')
  @Roles('ADMIN', 'COORDINATOR', 'TEACHER', 'STUDENT')
  getById(@Param('id') id: string) {
    return this.observerService.getById(id);
  }

  @Get('by-student/:studentEnrollmentId')
  @Roles('ADMIN', 'COORDINATOR', 'TEACHER', 'STUDENT')
  getByStudent(
    @Param('studentEnrollmentId') studentEnrollmentId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.observerService.getByStudent(studentEnrollmentId, startDate, endDate);
  }

  @Get('summary/:studentEnrollmentId')
  @Roles('ADMIN', 'COORDINATOR', 'TEACHER', 'STUDENT')
  getStudentSummary(@Param('studentEnrollmentId') studentEnrollmentId: string) {
    return this.observerService.getStudentSummary(studentEnrollmentId);
  }

  @Get('pending-followups')
  @Roles('ADMIN', 'COORDINATOR', 'TEACHER')
  getPendingFollowUps(@Request() req, @Query('all') all?: string) {
    const authorId = all === 'true' ? undefined : req.user.id;
    return this.observerService.getPendingFollowUps(authorId);
  }

  @Put(':id/notify-parent')
  @Roles('ADMIN', 'COORDINATOR', 'TEACHER')
  markParentNotified(@Param('id') id: string) {
    return this.observerService.markParentNotified(id);
  }
}
