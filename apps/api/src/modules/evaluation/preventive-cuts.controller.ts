import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PreventiveAlertStatus } from '@prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ExecutePreventiveCutDto } from './dto/execute-preventive-cut.dto';
import { UpsertPreventiveCutConfigDto } from './dto/upsert-preventive-cut-config.dto';
import { UpdatePreventiveAlertDto } from './dto/update-preventive-alert.dto';
import { PreventiveCutsService } from './preventive-cuts.service';

@Controller('preventive-cuts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PreventiveCutsController {
  constructor(private readonly preventiveCutsService: PreventiveCutsService) {}

  @Post('config')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async upsertConfig(@Body() dto: UpsertPreventiveCutConfigDto) {
    return this.preventiveCutsService.upsertConfig(dto);
  }

  @Get('config')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getConfig(@Query('academicTermId') academicTermId: string) {
    return this.preventiveCutsService.getConfig(academicTermId);
  }

  @Post('execute')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async execute(@Body() dto: ExecutePreventiveCutDto) {
    return this.preventiveCutsService.execute(dto);
  }

  @Get('alerts')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async listAlerts(
    @Query('teacherAssignmentId') teacherAssignmentId?: string,
    @Query('academicTermId') academicTermId?: string,
    @Query('studentEnrollmentId') studentEnrollmentId?: string,
    @Query('status') status?: PreventiveAlertStatus,
  ) {
    return this.preventiveCutsService.listAlerts({
      teacherAssignmentId,
      academicTermId,
      studentEnrollmentId,
      status,
    });
  }

  @Patch('alerts/:id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async updateAlert(@Param('id') id: string, @Body() dto: UpdatePreventiveAlertDto) {
    return this.preventiveCutsService.updateAlert(id, dto);
  }
}
