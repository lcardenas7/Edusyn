import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PeriodFinalGradesService } from './period-final-grades.service';

@Controller('period-final-grades')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PeriodFinalGradesController {
  constructor(private readonly periodFinalGradesService: PeriodFinalGradesService) {}

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async upsert(@Body() data: any, @Req() req: any) {
    return this.periodFinalGradesService.upsert({
      ...data,
      enteredById: req.user.id,
    });
  }

  @Post('bulk')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async bulkUpsert(@Body() data: { grades: any[] }, @Req() req: any) {
    return this.periodFinalGradesService.bulkUpsert(data.grades, req.user.id);
  }

  @Get('by-group')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async findByGroup(
    @Query('groupId') groupId: string,
    @Query('academicTermId') academicTermId: string,
  ) {
    return this.periodFinalGradesService.findByGroup(groupId, academicTermId);
  }

  @Get('by-student')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async findByStudent(
    @Query('studentEnrollmentId') studentEnrollmentId: string,
    @Query('academicTermId') academicTermId?: string,
  ) {
    return this.periodFinalGradesService.findByStudent(studentEnrollmentId, academicTermId);
  }

  @Delete(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async delete(@Param('id') id: string) {
    return this.periodFinalGradesService.delete(id);
  }
}
