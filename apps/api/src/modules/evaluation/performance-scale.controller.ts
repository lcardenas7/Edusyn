import { Body, Controller, Get, Post, Query, UseGuards, Request } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpsertPerformanceScaleDto } from './dto/upsert-performance-scale.dto';
import { PerformanceScaleService } from './performance-scale.service';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';

@Controller('performance-scale')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PerformanceScaleController {
  constructor(
    private readonly performanceScaleService: PerformanceScaleService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('upsert')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async upsert(@Body() dto: UpsertPerformanceScaleDto) {
    return this.performanceScaleService.upsert(dto);
  }

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async list(@Request() req: any, @Query('institutionId') institutionId?: string) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.performanceScaleService.list({ institutionId: instId });
  }
}
