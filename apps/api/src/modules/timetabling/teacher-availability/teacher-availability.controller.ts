import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TeacherAvailabilityService } from './teacher-availability.service';
import { DayOfWeek } from '@prisma/client';

@Controller('timetabling/teacher-availability')
@UseGuards(JwtAuthGuard)
export class TeacherAvailabilityController {
  constructor(private readonly teacherAvailabilityService: TeacherAvailabilityService) {}

  @Get()
  async findAll(
    @Request() req,
    @Query('academicYearId') academicYearId: string,
    @Query('teacherId') teacherId?: string,
  ) {
    if (teacherId) {
      return this.teacherAvailabilityService.findByTeacher(
        req.user.institutionId,
        academicYearId,
        teacherId,
      );
    }
    return this.teacherAvailabilityService.findAll(req.user.institutionId, academicYearId);
  }

  @Post()
  async upsert(@Request() req, @Body() data: {
    academicYearId: string;
    teacherId: string;
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
    isAvailable?: boolean;
    reason?: string;
  }) {
    return this.teacherAvailabilityService.upsert(req.user.institutionId, data);
  }

  @Post('bulk')
  async bulkSet(@Request() req, @Body() data: {
    academicYearId: string;
    teacherId: string;
    entries: Array<{
      dayOfWeek: DayOfWeek;
      startTime: string;
      endTime: string;
      isAvailable?: boolean;
      reason?: string;
    }>;
  }) {
    return this.teacherAvailabilityService.bulkSet(
      req.user.institutionId,
      data.academicYearId,
      data.teacherId,
      data.entries,
    );
  }

  @Delete(':id')
  async delete(@Request() req, @Param('id') id: string) {
    return this.teacherAvailabilityService.delete(id, req.user.institutionId);
  }
}
