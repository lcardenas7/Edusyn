import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RecoveryPeriodConfigService } from './recovery-period-config.service';

@Controller('recovery-period-config')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RecoveryPeriodConfigController {
  constructor(private readonly service: RecoveryPeriodConfigService) {}

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getByAcademicYear(@Query('academicYearId') academicYearId: string) {
    return this.service.getByAcademicYear(academicYearId);
  }

  @Get('status')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getPeriodsStatus(@Query('academicYearId') academicYearId: string) {
    return this.service.getPeriodsStatus(academicYearId);
  }

  @Get('check/:academicTermId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async checkPeriodOpen(@Param('academicTermId') academicTermId: string) {
    return this.service.isPeriodOpen(academicTermId);
  }

  @Post(':academicTermId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async upsertConfig(
    @Param('academicTermId') academicTermId: string,
    @Body() data: {
      isOpen: boolean;
      openDate?: string;
      closeDate?: string;
      allowLateEntry?: boolean;
      lateEntryDays?: number;
    },
  ) {
    return this.service.upsertConfig(academicTermId, {
      isOpen: data.isOpen,
      openDate: data.openDate ? new Date(data.openDate) : null,
      closeDate: data.closeDate ? new Date(data.closeDate) : null,
      allowLateEntry: data.allowLateEntry,
      lateEntryDays: data.lateEntryDays,
    });
  }
}
