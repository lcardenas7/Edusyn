import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PerformanceConfigService } from './performance-config.service';

@Controller('performance-config')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PerformanceConfigController {
  constructor(private readonly configService: PerformanceConfigService) {}

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getConfig(@Query('institutionId') institutionId: string) {
    return this.configService.getConfig(institutionId);
  }

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async upsertConfig(
    @Body()
    data: {
      institutionId: string;
      isEnabled?: boolean;
      showByDimension?: boolean;
      allowManualEdit?: boolean;
    },
  ) {
    return this.configService.upsertConfig(data);
  }

  @Get('complements')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getLevelComplements(@Query('institutionId') institutionId: string) {
    return this.configService.getLevelComplements(institutionId);
  }

  @Post('complements')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async upsertLevelComplement(
    @Body()
    data: {
      institutionId: string;
      level: 'SUPERIOR' | 'ALTO' | 'BASICO' | 'BAJO';
      complement: string;
      isActive?: boolean;
      displayMode?: 'CONCATENATE' | 'SEPARATE_LINE';
    },
  ) {
    return this.configService.upsertLevelComplement(data);
  }

  @Post('complements/bulk')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async bulkUpsertComplements(
    @Body()
    data: {
      institutionId: string;
      complements: Array<{
        level: 'SUPERIOR' | 'ALTO' | 'BASICO' | 'BAJO';
        complement: string;
        isActive?: boolean;
        displayMode?: 'CONCATENATE' | 'SEPARATE_LINE';
      }>;
    },
  ) {
    return this.configService.bulkUpsertLevelComplements(
      data.institutionId,
      data.complements,
    );
  }

  @Post('complements/defaults')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async createDefaultComplements(
    @Body() data: { institutionId: string },
  ) {
    return this.configService.createDefaultComplements(data.institutionId);
  }
}
