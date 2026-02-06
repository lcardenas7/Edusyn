import { Body, Controller, Get, Post, Query, UseGuards, Request } from '@nestjs/common';
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
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getConfig(
    @Request() req: any,
    @Query('academicYearId') academicYearId: string,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.configService.getOrCreateDefaultConfig(instId, academicYearId);
  }

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async upsertConfig(@Body() data: any) {
    return this.configService.upsertConfig(data);
  }
}
