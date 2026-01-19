import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SubjectPerformanceService } from './subject-performance.service';

@Controller('subject-performance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubjectPerformanceController {
  constructor(private readonly performanceService: SubjectPerformanceService) {}

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getByTeacherAssignment(
    @Query('teacherAssignmentId') teacherAssignmentId: string,
    @Query('academicTermId') academicTermId: string,
  ) {
    return this.performanceService.getByTeacherAssignment(
      teacherAssignmentId,
      academicTermId,
    );
  }

  @Get('by-group')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getByGroup(
    @Query('groupId') groupId: string,
    @Query('academicTermId') academicTermId: string,
  ) {
    return this.performanceService.getByGroup(groupId, academicTermId);
  }

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async upsert(
    @Body()
    data: {
      teacherAssignmentId: string;
      academicTermId: string;
      dimension: 'COGNITIVO' | 'PROCEDIMENTAL' | 'ACTITUDINAL';
      baseDescription: string;
    },
  ) {
    return this.performanceService.upsert(data);
  }

  @Post('bulk')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async bulkUpsert(
    @Body()
    data: {
      teacherAssignmentId: string;
      academicTermId: string;
      performances: Array<{
        dimension: 'COGNITIVO' | 'PROCEDIMENTAL' | 'ACTITUDINAL';
        baseDescription: string;
      }>;
    },
  ) {
    return this.performanceService.bulkUpsert(
      data.teacherAssignmentId,
      data.academicTermId,
      data.performances,
    );
  }

  @Delete(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async delete(@Param('id') id: string) {
    return this.performanceService.delete(id);
  }
}
