import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpsertPerformanceScaleDto } from './dto/upsert-performance-scale.dto';
import { PerformanceScaleService } from './performance-scale.service';

@Controller('performance-scale')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PerformanceScaleController {
  constructor(private readonly performanceScaleService: PerformanceScaleService) {}

  @Post('upsert')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async upsert(@Body() dto: UpsertPerformanceScaleDto) {
    return this.performanceScaleService.upsert(dto);
  }

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async list(@Query('institutionId') institutionId: string) {
    return this.performanceScaleService.list({ institutionId });
  }
}
