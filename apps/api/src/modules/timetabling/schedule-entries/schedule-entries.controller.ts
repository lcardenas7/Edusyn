import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ScheduleEntriesService } from './schedule-entries.service';
import { ScheduleValidatorService } from './schedule-validator.service';
import { DayOfWeek } from '@prisma/client';

@Controller('timetabling/schedule-entries')
@UseGuards(JwtAuthGuard)
export class ScheduleEntriesController {
  constructor(
    private readonly scheduleEntriesService: ScheduleEntriesService,
    private readonly validatorService: ScheduleValidatorService,
  ) {}

  @Get('grid')
  async getGrid(
    @Request() req,
    @Query('academicYearId') academicYearId: string,
    @Query('groupId') groupId: string,
  ) {
    return this.scheduleEntriesService.getGrid(
      req.user.institutionId,
      academicYearId,
      groupId,
    );
  }

  @Get('by-group')
  async findByGroup(
    @Request() req,
    @Query('academicYearId') academicYearId: string,
    @Query('groupId') groupId: string,
  ) {
    return this.scheduleEntriesService.findByGroup(
      req.user.institutionId,
      academicYearId,
      groupId,
    );
  }

  @Get('by-teacher')
  async findByTeacher(
    @Request() req,
    @Query('academicYearId') academicYearId: string,
    @Query('teacherId') teacherId: string,
  ) {
    return this.scheduleEntriesService.findByTeacher(
      req.user.institutionId,
      academicYearId,
      teacherId,
    );
  }

  @Get('by-room')
  async findByRoom(
    @Request() req,
    @Query('academicYearId') academicYearId: string,
    @Query('roomId') roomId: string,
  ) {
    return this.scheduleEntriesService.findByRoom(
      req.user.institutionId,
      academicYearId,
      roomId,
    );
  }

  @Get('conflicts')
  async getConflicts(
    @Request() req,
    @Query('academicYearId') academicYearId: string,
    @Query('groupId') groupId?: string,
  ) {
    if (groupId) {
      return this.validatorService.validateGroupSchedule(
        req.user.institutionId,
        academicYearId,
        groupId,
      );
    }
    return this.validatorService.getConflictSummary(
      req.user.institutionId,
      academicYearId,
    );
  }

  @Post()
  async create(@Request() req, @Body() data: {
    academicYearId: string;
    groupId: string;
    timeBlockId: string;
    dayOfWeek: DayOfWeek;
    teacherAssignmentId?: string;
    projectName?: string;
    projectDescription?: string;
    roomId?: string;
    notes?: string;
    color?: string;
  }) {
    return this.scheduleEntriesService.create(req.user.institutionId, data);
  }

  @Put(':id')
  async update(@Request() req, @Param('id') id: string, @Body() data: {
    teacherAssignmentId?: string | null;
    projectName?: string | null;
    projectDescription?: string | null;
    roomId?: string | null;
    notes?: string | null;
    color?: string | null;
  }) {
    return this.scheduleEntriesService.update(id, req.user.institutionId, data);
  }

  @Delete(':id')
  async delete(@Request() req, @Param('id') id: string) {
    return this.scheduleEntriesService.delete(id, req.user.institutionId);
  }

  @Delete('clear/:groupId')
  async clearGroupSchedule(
    @Request() req,
    @Param('groupId') groupId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.scheduleEntriesService.clearGroupSchedule(
      req.user.institutionId,
      academicYearId,
      groupId,
    );
  }
}
