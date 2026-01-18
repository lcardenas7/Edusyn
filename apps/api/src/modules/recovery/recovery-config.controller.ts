import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RecoveryConfigService } from './recovery-config.service';

@Controller('recovery-config')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RecoveryConfigController {
  constructor(private readonly configService: RecoveryConfigService) {}

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getConfig(
    @Query('institutionId') institutionId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.configService.getOrCreateDefaultConfig(institutionId, academicYearId);
  }

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async upsertConfig(@Body() data: any) {
    return this.configService.upsertConfig(data);
  }
}
