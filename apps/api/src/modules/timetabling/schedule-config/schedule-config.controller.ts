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
import { ScheduleConfigService } from './schedule-config.service';
import { ScheduleMode } from '@prisma/client';

@Controller('timetabling/schedule-config')
@UseGuards(JwtAuthGuard)
export class ScheduleConfigController {
  constructor(private readonly scheduleConfigService: ScheduleConfigService) {}

  @Get()
  async findAll(@Request() req, @Query('academicYearId') academicYearId: string) {
    return this.scheduleConfigService.findAll(req.user.institutionId, academicYearId);
  }

  @Post()
  async upsert(@Request() req, @Body() data: {
    academicYearId: string;
    gradeId: string;
    mode?: ScheduleMode;
    maxConsecutiveHours?: number;
    preferDistribution?: boolean;
    avoidHeavyLastHours?: boolean;
    allowDoubleBlocks?: boolean;
  }) {
    return this.scheduleConfigService.upsert(req.user.institutionId, data);
  }

  @Post('bulk')
  async bulkUpsert(@Request() req, @Body() data: {
    academicYearId: string;
    configs: Array<{
      gradeId: string;
      mode?: ScheduleMode;
      maxConsecutiveHours?: number;
      preferDistribution?: boolean;
      avoidHeavyLastHours?: boolean;
      allowDoubleBlocks?: boolean;
    }>;
  }) {
    return this.scheduleConfigService.bulkUpsert(
      req.user.institutionId,
      data.academicYearId,
      data.configs,
    );
  }

  @Delete(':id')
  async delete(@Request() req, @Param('id') id: string) {
    return this.scheduleConfigService.delete(id, req.user.institutionId);
  }
}
