import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards, Request } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RecoveryConfigService } from './recovery-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';

@Controller('recovery-config')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RecoveryConfigController {
  constructor(
    private readonly configService: RecoveryConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getConfig(
    @Request() req: any,
    @Query('academicYearId') academicYearId: string,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    // Devuelve config completa con reglas granulares incluidas
    const config = await this.configService.getConfig(instId, academicYearId);
    if (config) return config;
    // Si no existe, crear con defaults y devolver
    return this.configService.getOrCreateDefaultConfig(instId, academicYearId);
  }

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async upsertConfig(@Body() data: any) {
    return this.configService.upsertConfig(data);
  }

  // ─── Reglas granulares ───

  @Get(':configId/rules')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async listRules(@Param('configId') configId: string) {
    return this.configService.listRules(configId);
  }

  @Post('rules')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async upsertRule(@Body() data: any) {
    return this.configService.upsertRule(data);
  }

  @Delete('rules/:id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async deleteRule(@Param('id') id: string) {
    return this.configService.deleteRule(id);
  }
}
